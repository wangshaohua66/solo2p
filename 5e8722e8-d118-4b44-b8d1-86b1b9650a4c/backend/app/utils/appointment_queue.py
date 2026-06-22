import json
import time
import logging
from datetime import datetime
from threading import Thread
from app import redis_client, db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.clinic import Doctor
from app.utils.notifications import SMSService, send_in_app_message

logger = logging.getLogger(__name__)


class AppointmentQueue:
    """预约消息队列 - 使用 Redis List 实现"""
    
    QUEUE_KEY = 'appointment:queue'
    RESULT_KEY_PREFIX = 'appointment:result:'
    DEAD_LETTER_KEY = 'appointment:dead_letter'
    PROCESSING_KEY = 'appointment:processing'
    RESULT_TTL = 3600

    @classmethod
    def enqueue(cls, appointment_data):
        """
        预约请求入队
        
        Args:
            appointment_data: 预约数据字典
        
        Returns:
            dict: { 'success': bool, 'queue_id': str, 'position': int }
        """
        queue_id = f"appt_{int(time.time() * 1000)}_{hash(str(appointment_data)) % 10000}"
        
        message = {
            'queue_id': queue_id,
            'data': appointment_data,
            'status': 'pending',
            'created_at': datetime.now().isoformat(),
        }
        
        redis_client.lpush(cls.QUEUE_KEY, json.dumps(message))
        position = redis_client.llen(cls.QUEUE_KEY)
        
        result_key = f'{cls.RESULT_KEY_PREFIX}{queue_id}'
        redis_client.setex(result_key, cls.RESULT_TTL, json.dumps({
            'status': 'pending',
            'message': '预约请求已排队，正在处理中...',
            'position': position,
        }))
        
        logger.info(f'预约请求已入队: queue_id={queue_id}, position={position}')
        
        return {
            'success': True,
            'queue_id': queue_id,
            'position': position,
            'message': '预约请求已提交，正在排队处理',
        }

    @classmethod
    def dequeue(cls):
        """
        从队列中取出预约请求（阻塞式）
        
        Returns:
            dict: 预约消息或None
        """
        result = redis_client.brpop(cls.QUEUE_KEY, timeout=1)
        if result:
            _, message_str = result
            try:
                message = json.loads(message_str)
                return message
            except (json.JSONDecodeError, TypeError):
                logger.error(f'队列消息解析失败: {message_str}')
                return None
        return None

    @classmethod
    def get_result(cls, queue_id):
        """
        获取预约处理结果
        
        Args:
            queue_id: 队列ID
        
        Returns:
            dict: 处理结果或None
        """
        result_key = f'{cls.RESULT_KEY_PREFIX}{queue_id}'
        result = redis_client.get(result_key)
        if result:
            try:
                return json.loads(result)
            except (json.JSONDecodeError, TypeError):
                return None
        return None

    @classmethod
    def set_result(cls, queue_id, status, appointment=None, error_message=None):
        """
        设置预约处理结果
        
        Args:
            queue_id: 队列ID
            status: 状态 (success/failed)
            appointment: 预约数据
            error_message: 错误信息
        """
        result_key = f'{cls.RESULT_KEY_PREFIX}{queue_id}'
        result = {
            'status': status,
            'queue_id': queue_id,
            'processed_at': datetime.now().isoformat(),
        }
        
        if appointment:
            result['appointment'] = appointment
        if error_message:
            result['message'] = error_message
        
        redis_client.setex(result_key, cls.RESULT_TTL, json.dumps(result))

    @classmethod
    def get_queue_length(cls):
        """获取队列长度"""
        return redis_client.llen(cls.QUEUE_KEY)

    @classmethod
    def send_to_dead_letter(cls, message, error):
        """
        发送到死信队列
        
        Args:
            message: 消息内容
            error: 错误信息
        """
        dead_letter = {
            'message': message,
            'error': str(error),
            'failed_at': datetime.now().isoformat(),
        }
        redis_client.lpush(cls.DEAD_LETTER_KEY, json.dumps(dead_letter))
        logger.error(f'消息已送入死信队列: {error}')

    @classmethod
    def process_appointment(cls, message):
        """
        处理单个预约请求
        
        Args:
            message: 队列消息
        
        Returns:
            bool: 是否处理成功
        """
        try:
            data = message['data']
            queue_id = message['queue_id']
            
            patient_id = data.get('patient_id')
            doctor_id = data.get('doctor_id')
            appointment_date = data.get('date')
            time_slot = data.get('time_slot')
            
            patient = Patient.query.get(patient_id)
            if not patient:
                cls.set_result(queue_id, 'failed', error_message='患者不存在')
                return False
            
            doctor = Doctor.query.get(doctor_id)
            if not doctor:
                cls.set_result(queue_id, 'failed', error_message='医生不存在')
                return False
            
            from datetime import date
            appt_date = date.fromisoformat(appointment_date)
            if appt_date < date.today():
                cls.set_result(queue_id, 'failed', error_message='不能预约过去的日期')
                return False
            
            existing = Appointment.query.filter_by(
                doctor_id=doctor_id,
                appointment_date=appt_date,
                time_slot=time_slot,
            ).filter(Appointment.status != 'cancelled').first()
            
            if existing:
                cls.set_result(queue_id, 'failed', error_message='该时段已被预约')
                return False
            
            queue_key = f'appointment:queue:{doctor_id}:{appointment_date}'
            queue_position = redis_client.incr(queue_key)
            redis_client.expire(queue_key, 86400)
            
            appointment = Appointment(
                patient_id=patient_id,
                clinic_id=doctor.clinic_id,
                department=doctor.department,
                doctor_id=doctor_id,
                appointment_date=appt_date,
                time_slot=time_slot,
                appointment_type=data.get('type', '普通挂号'),
                symptom=data.get('symptom', ''),
                status='confirmed',
            )
            
            db.session.add(appointment)
            db.session.commit()
            
            appointment_dict = appointment.to_dict()
            cls.set_result(queue_id, 'success', appointment=appointment_dict)
            
            try:
                if patient.phone:
                    SMSService.send_appointment_confirm(
                        patient.phone,
                        patient.name,
                        doctor.name,
                        appointment_date,
                        time_slot,
                    )
            except Exception as e:
                logger.warning(f'发送预约确认短信失败: {e}')
            
            try:
                send_in_app_message(
                    patient_id,
                    f'您预约的{doctor.name}医生{appointment_date} {time_slot}就诊已确认'
                )
            except Exception as e:
                logger.warning(f'发送站内消息失败: {e}')
            
            cache_patterns = redis_client.keys('appointments:*')
            if cache_patterns:
                redis_client.delete(*cache_patterns)
            
            logger.info(f'预约处理成功: queue_id={queue_id}, appointment_id={appointment.id}')
            return True
            
        except Exception as e:
            logger.error(f'处理预约失败: {e}')
            cls.send_to_dead_letter(message, e)
            if message.get('queue_id'):
                cls.set_result(message['queue_id'], 'failed', error_message=str(e))
            return False


class AppointmentQueueWorker:
    """预约队列消费者 - 后台线程消费"""
    
    def __init__(self, app, num_workers=2):
        self.app = app
        self.num_workers = num_workers
        self.workers = []
        self.running = False

    def start(self):
        """启动消费者线程"""
        if self.running:
            return
        
        self.running = True
        
        for i in range(self.num_workers):
            t = Thread(target=self._worker_loop, args=(i,), daemon=True)
            t.start()
            self.workers.append(t)
        
        logger.info(f'预约队列消费者已启动，工作线程数: {self.num_workers}')

    def stop(self):
        """停止消费者"""
        self.running = False
        for t in self.workers:
            t.join(timeout=5)
        self.workers = []
        logger.info('预约队列消费者已停止')

    def _worker_loop(self, worker_id):
        """消费者循环"""
        logger.info(f'消费者线程 {worker_id} 启动')
        
        while self.running:
            try:
                with self.app.app_context():
                    message = AppointmentQueue.dequeue()
                    if message:
                        logger.info(f'线程 {worker_id} 处理预约: {message.get("queue_id")}')
                        AppointmentQueue.process_appointment(message)
                    else:
                        time.sleep(0.1)
                        
            except Exception as e:
                logger.error(f'消费者线程 {worker_id} 异常: {e}')
                time.sleep(1)
        
        logger.info(f'消费者线程 {worker_id} 退出')


def init_queue_worker(app):
    """初始化预约队列消费者"""
    try:
        worker = AppointmentQueueWorker(app, num_workers=2)
        worker.start()
        app.appointment_queue_worker = worker
        return worker
    except Exception as e:
        logger.error(f'初始化预约队列消费者失败: {e}')
        app.appointment_queue_worker = None
        return None
