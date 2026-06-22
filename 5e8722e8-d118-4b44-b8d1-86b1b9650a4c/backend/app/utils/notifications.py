import json
import logging
from datetime import datetime, timedelta
from app import redis_client, db
from app.config import Config
from app.models.appointment import Appointment
from app.models.patient import Patient

logger = logging.getLogger(__name__)


class NotificationService:
    QUEUE_KEY = 'appointment:notifications'
    REMINDER_KEY = 'appointment:reminders'

    @classmethod
    def push_notification(cls, notification_type, data):
        notification = {
            'type': notification_type,
            'data': data,
        }
        redis_client.lpush(cls.QUEUE_KEY, json.dumps(notification))
        return True

    @classmethod
    def pop_notification(cls):
        result = redis_client.rpop(cls.QUEUE_KEY)
        if result:
            return json.loads(result)
        return None

    @classmethod
    def schedule_reminder(cls, appointment_id, remind_time, message):
        reminder = {
            'appointment_id': appointment_id,
            'message': message,
            'remind_time': remind_time.isoformat() if hasattr(remind_time, 'isoformat') else str(remind_time),
        }
        score = remind_time.timestamp() if hasattr(remind_time, 'timestamp') else 0
        redis_client.zadd(cls.REMINDER_KEY, {json.dumps(reminder): score})
        return True

    @classmethod
    def get_due_reminders(cls, current_time):
        timestamp = current_time.timestamp() if hasattr(current_time, 'timestamp') else 0
        reminders = redis_client.zrangebyscore(cls.REMINDER_KEY, 0, timestamp)
        result = []
        for r in reminders:
            try:
                result.append(json.loads(r))
            except (json.JSONDecodeError, TypeError):
                pass
        return result

    @classmethod
    def remove_reminder(cls, reminder):
        redis_client.zrem(cls.REMINDER_KEY, json.dumps(reminder))


class SMSService:
    @staticmethod
    def send_sms(phone, template_code=None, template_param=None, message=None):
        if Config.SMS_PROVIDER == 'aliyun':
            return SMSService._send_aliyun_sms(phone, template_code, template_param)
        else:
            return SMSService._send_mock_sms(phone, message)

    @staticmethod
    def _send_mock_sms(phone, message=None):
        msg = message or '您的预约提醒'
        logger.info(f'[SMS Mock] 发送短信到 {phone}: {msg}')
        return True, 'mock_success'

    @staticmethod
    def _send_aliyun_sms(phone, template_code, template_param):
        try:
            from alibabacloud_dysmsapi20170525.client import Client as DysmsapiClient
            from alibabacloud_tea_openapi import models as open_api_models
            from alibabacloud_dysmsapi20170525 import models as dysmsapi_models
            from alibabacloud_tea_util import models as util_models

            config = open_api_models.Config(
                access_key_id=Config.ALIYUN_ACCESS_KEY_ID,
                access_key_secret=Config.ALIYUN_ACCESS_KEY_SECRET,
            )
            config.endpoint = f'dysmsapi.aliyuncs.com'
            client = DysmsapiClient(config)

            send_sms_request = dysmsapi_models.SendSmsRequest(
                sign_name=Config.ALIYUN_SMS_SIGN_NAME,
                template_code=template_code or Config.ALIYUN_SMS_TEMPLATE_CODE,
                phone_numbers=phone,
                template_param=json.dumps(template_param) if template_param else None,
            )

            runtime = util_models.RuntimeOptions()
            response = client.send_sms_with_options(send_sms_request, runtime)
            
            if response.body.code == 'OK':
                logger.info(f'[SMS Aliyun] 发送成功: {phone}, BizId: {response.body.biz_id}')
                return True, response.body.biz_id
            else:
                logger.error(f'[SMS Aliyun] 发送失败: {phone}, Code: {response.body.code}, Message: {response.body.message}')
                return False, response.body.message

        except ImportError:
            logger.warning('阿里云短信SDK未安装，使用模拟模式')
            return SMSService._send_mock_sms(phone)
        except Exception as e:
            logger.error(f'[SMS Aliyun] 发送异常: {str(e)}')
            return False, str(e)

    @staticmethod
    def send_appointment_reminder(phone, patient_name, doctor_name, date, time):
        template_param = {
            'name': patient_name,
            'doctor': doctor_name,
            'date': date,
            'time': time,
        }
        message = f'【口腔医疗】{patient_name}您好，您预约的{doctor_name}医生于{date} {time}的就诊，请准时到达。'
        return SMSService.send_sms(
            phone,
            template_code=Config.ALIYUN_SMS_TEMPLATE_REMINDER,
            template_param=template_param,
            message=message,
        )

    @staticmethod
    def send_appointment_confirm(phone, patient_name, doctor_name, date, time):
        template_param = {
            'name': patient_name,
            'doctor': doctor_name,
            'date': date,
            'time': time,
        }
        message = f'【口腔医疗】{patient_name}您好，您已成功预约{doctor_name}医生，时间：{date} {time}，请准时到达。'
        return SMSService.send_sms(
            phone,
            template_code=Config.ALIYUN_SMS_TEMPLATE_CONFIRM,
            template_param=template_param,
            message=message,
        )


def send_sms(phone, message):
    success, _ = SMSService.send_sms(phone, message=message)
    return success


def send_in_app_message(user_id, message):
    key = f'messages:user:{user_id}'
    msg = {
        'message': message,
        'read': False,
        'created_at': datetime.now().isoformat(),
    }
    redis_client.lpush(key, json.dumps(msg))
    return True


class AppointmentReminderScheduler:
    @staticmethod
    def check_and_send_reminders():
        """检查并发送未来24小时内的预约提醒"""
        try:
            now = datetime.now()
            target_time = now + timedelta(hours=24)
            
            appointments = Appointment.query.filter(
                Appointment.status == 'confirmed',
                Appointment.appointment_date >= now.date(),
                Appointment.appointment_date <= target_time.date(),
            ).all()

            sent_count = 0
            for appointment in appointments:
                try:
                    appointment_dt = datetime.combine(
                        appointment.appointment_date,
                        datetime.strptime(appointment.time_slot, '%H:%M').time()
                    )
                    
                    time_diff = (appointment_dt - now).total_seconds() / 3600
                    
                    if 23 <= time_diff <= 25:
                        reminder_key = f'reminder_sent:{appointment.id}:{appointment.appointment_date.isoformat()}'
                        if redis_client.exists(reminder_key):
                            continue

                        patient = Patient.query.get(appointment.patient_id)
                        if patient and patient.phone:
                            success, _ = SMSService.send_appointment_reminder(
                                patient.phone,
                                patient.name,
                                appointment.doctor_name if hasattr(appointment, 'doctor_name') else '医生',
                                appointment.appointment_date.strftime('%Y年%m月%d日'),
                                appointment.time_slot,
                            )
                            
                            if success:
                                redis_client.setex(reminder_key, 86400 * 2, '1')
                                send_in_app_message(
                                    appointment.patient_id,
                                    f'复诊提醒：您预约的{appointment.time_slot}就诊，请准时到达'
                                )
                                sent_count += 1
                                logger.info(f'已发送预约提醒: appointment_id={appointment.id}, patient={patient.name}')
                                
                except Exception as e:
                    logger.error(f'处理预约提醒失败 appointment_id={appointment.id}: {str(e)}')
                    continue

            logger.info(f'预约提醒检查完成，共发送 {sent_count} 条提醒')
            return sent_count

        except Exception as e:
            logger.error(f'预约提醒调度异常: {str(e)}')
            return 0


def init_scheduler(app):
    """初始化定时任务调度器"""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger

        scheduler = BackgroundScheduler()
        
        scheduler.add_job(
            AppointmentReminderScheduler.check_and_send_reminders,
            trigger=IntervalTrigger(hours=1),
            id='appointment_reminder_check',
            name='预约提醒检查',
            replace_existing=True,
        )

        scheduler.start()
        app.scheduler = scheduler
        
        logger.info('APScheduler 定时任务调度器已启动')
        return scheduler

    except ImportError:
        logger.warning('APScheduler 未安装，定时任务功能不可用')
        app.scheduler = None
        return None
    except Exception as e:
        logger.error(f'初始化调度器失败: {str(e)}')
        app.scheduler = None
        return None
