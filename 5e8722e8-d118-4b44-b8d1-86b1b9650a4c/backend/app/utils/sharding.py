import re
import logging
from datetime import datetime, date
from sqlalchemy import Table, Column, Integer, String, Text, DateTime, ForeignKey, Date, JSON
from sqlalchemy.schema import CreateTable
from app import db, redis_client
from app.config import Config

logger = logging.getLogger(__name__)


BASE_TABLE_NAME = 'medical_records'

MEDICAL_RECORD_COLUMNS = [
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('patient_id', Integer, nullable=False, index=True),
    Column('doctor_id', Integer, nullable=False),
    Column('clinic_id', Integer),
    Column('department', String(50)),
    Column('visit_date', Date, nullable=False, index=True),
    Column('chief_complaint', Text),
    Column('present_illness', Text),
    Column('past_history', Text),
    Column('diagnosis', Text),
    Column('treatment_plan', Text),
    Column('prescription', Text),
    Column('images', JSON),
    Column('status', String(20), default='completed'),
    Column('created_at', DateTime, default=datetime.utcnow),
    Column('updated_at', DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
]


class MedicalRecordSharding:
    """诊疗记录按月分表管理器"""
    
    @staticmethod
    def get_table_name(year=None, month=None):
        """
        获取分表名称
        
        Args:
            year: 年份，默认当前年
            month: 月份，默认当前月
        
        Returns:
            分表名称，格式：medical_records_YYYY_MM
        """
        if year is None or month is None:
            now = datetime.now()
            year = year or now.year
            month = month or now.month
        
        return f'{BASE_TABLE_NAME}_{year}_{month:02d}'

    @staticmethod
    def get_table_name_from_date(visit_date):
        """
        根据就诊日期获取分表名称
        
        Args:
            visit_date: 就诊日期 (date/datetime/str)
        
        Returns:
            分表名称
        """
        if isinstance(visit_date, str):
            visit_date = date.fromisoformat(visit_date)
        return MedicalRecordSharding.get_table_name(visit_date.year, visit_date.month)

    @staticmethod
    def table_exists(table_name):
        """
        检查表是否存在
        
        Args:
            table_name: 表名
        
        Returns:
            bool
        """
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        return table_name in inspector.get_table_names()

    @staticmethod
    def create_table(table_name):
        """
        创建分表
        
        Args:
            table_name: 表名
        
        Returns:
            bool
        """
        try:
            if MedicalRecordSharding.table_exists(table_name):
                return True
            
            table = Table(
                table_name,
                db.Model.metadata,
                *MEDICAL_RECORD_COLUMNS,
                extend_existing=True
            )
            
            table.create(db.engine)
            
            index_sql = f"""
                CREATE INDEX idx_{table_name}_patient_date ON {table_name} (patient_id, visit_date);
                CREATE INDEX idx_{table_name}_doctor_date ON {table_name} (doctor_id, visit_date);
            """
            
            with db.engine.connect() as conn:
                conn.execute(db.text(index_sql))
                conn.commit()
            
            redis_client.setex(f'table_exists:{table_name}', 86400 * 30, '1')
            
            logger.info(f'分表创建成功: {table_name}')
            return True
            
        except Exception as e:
            logger.error(f'创建分表失败 {table_name}: {str(e)}')
            return False

    @staticmethod
    def ensure_table_for_date(visit_date):
        """
        确保指定日期的分表存在，不存在则创建
        
        Args:
            visit_date: 就诊日期
        
        Returns:
            表名
        """
        table_name = MedicalRecordSharding.get_table_name_from_date(visit_date)
        
        cache_key = f'table_exists:{table_name}'
        if redis_client.exists(cache_key):
            return table_name
        
        if not MedicalRecordSharding.table_exists(table_name):
            MedicalRecordSharding.create_table(table_name)
        else:
            redis_client.setex(cache_key, 86400 * 30, '1')
        
        return table_name

    @staticmethod
    def get_tables_in_range(start_date, end_date):
        """
        获取日期范围内的所有分表
        
        Args:
            start_date: 开始日期
            end_date: 结束日期
        
        Returns:
            表名列表
        """
        if isinstance(start_date, str):
            start_date = date.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = date.fromisoformat(end_date)
        
        tables = []
        current_year = start_date.year
        current_month = start_date.month
        
        while (current_year < end_date.year) or \
              (current_year == end_date.year and current_month <= end_date.month):
            
            table_name = MedicalRecordSharding.get_table_name(current_year, current_month)
            if MedicalRecordSharding.table_exists(table_name):
                tables.append(table_name)
            
            current_month += 1
            if current_month > 12:
                current_month = 1
                current_year += 1
        
        return tables

    @staticmethod
    def insert_record(record_data):
        """
        插入诊疗记录到对应的分表
        
        Args:
            record_data: 记录数据字典
        
        Returns:
            记录ID
        """
        visit_date = record_data.get('visit_date') or date.today()
        table_name = MedicalRecordSharding.ensure_table_for_date(visit_date)
        
        columns = ', '.join(record_data.keys())
        placeholders = ', '.join([f':{key}' for key in record_data.keys()])
        
        sql = f'INSERT INTO {table_name} ({columns}) VALUES ({placeholders})'
        
        with db.engine.connect() as conn:
            result = conn.execute(db.text(sql), record_data)
            conn.commit()
            record_id = result.lastrowid
        
        logger.info(f'诊疗记录已插入分表 {table_name}, ID: {record_id}')
        return record_id

    @staticmethod
    def get_record(record_id, visit_date=None):
        """
        获取单条诊疗记录
        
        Args:
            record_id: 记录ID
            visit_date: 就诊日期（可选，提升查询速度）
        
        Returns:
            记录字典或None
        """
        if visit_date:
            table_name = MedicalRecordSharding.get_table_name_from_date(visit_date)
            sql = f'SELECT * FROM {table_name} WHERE id = :id'
            with db.engine.connect() as conn:
                result = conn.execute(db.text(sql), {'id': record_id}).mappings().first()
                return dict(result) if result else None
        
        for year in range(datetime.now().year, datetime.now().year - 6, -1):
            for month in range(12, 0, -1):
                table_name = MedicalRecordSharding.get_table_name(year, month)
                if not MedicalRecordSharding.table_exists(table_name):
                    continue
                sql = f'SELECT * FROM {table_name} WHERE id = :id'
                with db.engine.connect() as conn:
                    result = conn.execute(db.text(sql), {'id': record_id}).mappings().first()
                    if result:
                        return dict(result)
        
        return None

    @staticmethod
    def get_patient_records(patient_id, start_date=None, end_date=None, page=1, per_page=10):
        """
        获取患者的诊疗记录列表（支持跨分表查询）
        
        Args:
            patient_id: 患者ID
            start_date: 开始日期
            end_date: 结束日期
            page: 页码
            per_page: 每页数量
        
        Returns:
            (记录列表, 总数)
        """
        if start_date and end_date:
            tables = MedicalRecordSharding.get_tables_in_range(start_date, end_date)
        else:
            tables = []
            for year in range(datetime.now().year, datetime.now().year - 6, -1):
                for month in range(12, 0, -1):
                    table_name = MedicalRecordSharding.get_table_name(year, month)
                    if MedicalRecordSharding.table_exists(table_name):
                        tables.append(table_name)
        
        if not tables:
            return [], 0
        
        all_records = []
        
        for table_name in tables:
            sql = f'SELECT * FROM {table_name} WHERE patient_id = :patient_id'
            params = {'patient_id': patient_id}
            
            if start_date:
                sql += ' AND visit_date >= :start_date'
                params['start_date'] = start_date
            if end_date:
                sql += ' AND visit_date <= :end_date'
                params['end_date'] = end_date
            
            sql += ' ORDER BY visit_date DESC'
            
            with db.engine.connect() as conn:
                records = conn.execute(db.text(sql), params).mappings().all()
                all_records.extend([dict(r) for r in records])
        
        all_records.sort(key=lambda x: x['visit_date'], reverse=True)
        
        total = len(all_records)
        start = (page - 1) * per_page
        end = start + per_page
        page_records = all_records[start:end]
        
        return page_records, total

    @staticmethod
    def update_record(record_id, visit_date, update_data):
        """
        更新诊疗记录
        
        Args:
            record_id: 记录ID
            visit_date: 就诊日期
            update_data: 更新数据字典
        
        Returns:
            bool
        """
        table_name = MedicalRecordSharding.ensure_table_for_date(visit_date)
        
        set_clause = ', '.join([f'{key} = :{key}' for key in update_data.keys()])
        params = {**update_data, 'id': record_id}
        
        sql = f'UPDATE {table_name} SET {set_clause} WHERE id = :id'
        
        with db.engine.connect() as conn:
            result = conn.execute(db.text(sql), params)
            conn.commit()
        
        return result.rowcount > 0

    @staticmethod
    def get_monthly_stats(year=None):
        """
        获取月度统计表
        
        Args:
            year: 年份，默认今年
        
        Returns:
            每月记录数统计
        """
        if year is None:
            year = datetime.now().year
        
        stats = {}
        for month in range(1, 13):
            table_name = MedicalRecordSharding.get_table_name(year, month)
            if MedicalRecordSharding.table_exists(table_name):
                sql = f'SELECT COUNT(*) as count FROM {table_name}'
                with db.engine.connect() as conn:
                    result = conn.execute(db.text(sql)).scalar()
                    stats[f'{year}-{month:02d}'] = result
            else:
                stats[f'{year}-{month:02d}'] = 0
        
        return stats

    @staticmethod
    def get_all_sharding_tables():
        """
        获取所有分表
        
        Returns:
            表名列表
        """
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        all_tables = inspector.get_table_names()
        
        pattern = re.compile(rf'^{BASE_TABLE_NAME}_\d{{4}}_\d{{2}}$')
        sharding_tables = [t for t in all_tables if pattern.match(t)]
        sharding_tables.sort(reverse=True)
        
        return sharding_tables


class ShardingRouter:
    """分表路由类 - 提供便捷的分表操作接口"""
    
    @staticmethod
    def add_medical_record(patient_id, doctor_id, **kwargs):
        """新增诊疗记录"""
        data = {
            'patient_id': patient_id,
            'doctor_id': doctor_id,
            'visit_date': kwargs.get('visit_date') or date.today(),
            'clinic_id': kwargs.get('clinic_id'),
            'department': kwargs.get('department'),
            'chief_complaint': kwargs.get('chief_complaint', ''),
            'present_illness': kwargs.get('present_illness', ''),
            'past_history': kwargs.get('past_history', ''),
            'diagnosis': kwargs.get('diagnosis', ''),
            'treatment_plan': kwargs.get('treatment_plan', ''),
            'prescription': kwargs.get('prescription', ''),
            'images': kwargs.get('images'),
            'status': kwargs.get('status', 'completed'),
        }
        return MedicalRecordSharding.insert_record(data)

    @staticmethod
    def list_patient_records(patient_id, page=1, per_page=10, start_date=None, end_date=None):
        """获取患者诊疗记录列表"""
        return MedicalRecordSharding.get_patient_records(
            patient_id, start_date, end_date, page, per_page
        )

    @staticmethod
    def get_medical_record(record_id, visit_date=None):
        """获取单条诊疗记录"""
        return MedicalRecordSharding.get_record(record_id, visit_date)

    @staticmethod
    def update_medical_record(record_id, visit_date, **kwargs):
        """更新诊疗记录"""
        return MedicalRecordSharding.update_record(record_id, visit_date, kwargs)

    @staticmethod
    def get_sharding_tables():
        """获取所有分表列表"""
        return MedicalRecordSharding.get_all_sharding_tables()

    @staticmethod
    def get_stats(year=None):
        """获取分表统计"""
        return MedicalRecordSharding.get_monthly_stats(year)
