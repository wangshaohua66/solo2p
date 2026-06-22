import os
from datetime import datetime, date
from typing import Optional, List
from contextlib import contextmanager
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, DateTime, Date,
    Float, Boolean, ForeignKey, Enum, Index
)
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from sqlalchemy.exc import SQLAlchemyError, OperationalError

from utils.config import config
from utils.logger import get_logger

logger = get_logger(__name__)

Base = declarative_base()


WORK_TYPES = ['text', 'art', 'music', 'audiovisual']
WORK_TYPE_NAMES = {
    'text': '文字作品',
    'art': '美术作品',
    'music': '音乐作品',
    'audiovisual': '视听作品',
}

APPLICANT_TYPES = ['individual', 'company', 'institution']
APPLICANT_TYPE_NAMES = {
    'individual': '个人',
    'company': '企业',
    'institution': '事业单位',
}

REGISTRATION_STATUS = [
    'submitted', 'formal_review', 'substantive_review',
    'payment_pending', 'payment_confirmed', 'certificate_issued',
    'rejected', 'withdrawn'
]
REGISTRATION_STATUS_NAMES = {
    'submitted': '已提交',
    'formal_review': '形式审查中',
    'substantive_review': '实质审查中',
    'payment_pending': '待缴费',
    'payment_confirmed': '缴费已确认',
    'certificate_issued': '证书已发放',
    'rejected': '已驳回',
    'withdrawn': '已撤回',
}

REVIEW_ROLES = ['examiner', 'finance', 'editor']
REVIEW_ROLE_NAMES = {
    'examiner': '审查员',
    'finance': '财务人员',
    'editor': '公告编辑',
}

PAYMENT_STATUS = ['pending', 'paid', 'refunded', 'overdue']
PAYMENT_STATUS_NAMES = {
    'pending': '待缴费',
    'paid': '已缴费',
    'refunded': '已退款',
    'overdue': '已逾期',
}


class Applicant(Base):
    __tablename__ = 'applicants'

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False, index=True)
    applicant_type = Column(Enum(*APPLICANT_TYPES), nullable=False)
    id_card = Column(String(50), unique=True, index=True)
    phone = Column(String(20))
    email = Column(String(100))
    address = Column(String(500))
    region = Column(String(100), index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    registrations = relationship('Registration', back_populates='applicant')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'applicant_type': self.applicant_type,
            'applicant_type_name': APPLICANT_TYPE_NAMES.get(self.applicant_type, ''),
            'id_card': self.id_card,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'region': self.region,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Work(Base):
    __tablename__ = 'works'

    id = Column(Integer, primary_key=True)
    title = Column(String(300), nullable=False, index=True)
    work_type = Column(Enum(*WORK_TYPES), nullable=False, index=True)
    creation_date = Column(Date)
    publication_date = Column(Date)
    completion_date = Column(Date)
    author = Column(String(200))
    description = Column(Text)
    keywords = Column(String(500))
    file_path = Column(String(500))
    file_hash = Column(String(64), index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    registrations = relationship('Registration', back_populates='work')
    features = relationship('WorkFeature', back_populates='work', cascade='all, delete-orphan')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'title': self.title,
            'work_type': self.work_type,
            'work_type_name': WORK_TYPE_NAMES.get(self.work_type, ''),
            'creation_date': self.creation_date.isoformat() if self.creation_date else None,
            'publication_date': self.publication_date.isoformat() if self.publication_date else None,
            'author': self.author,
            'description': self.description,
            'keywords': self.keywords,
            'file_path': self.file_path,
            'file_hash': self.file_hash,
        }


class WorkFeature(Base):
    __tablename__ = 'work_features'

    id = Column(Integer, primary_key=True)
    work_id = Column(Integer, ForeignKey('works.id'), nullable=False, index=True)
    feature_type = Column(String(50), nullable=False, index=True)
    feature_value = Column(Text, nullable=False)
    feature_hash = Column(String(64), index=True)
    created_at = Column(DateTime, default=datetime.now)

    work = relationship('Work', back_populates='features')

    __table_args__ = (
        Index('idx_work_feature', 'work_id', 'feature_type', unique=True),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'work_id': self.work_id,
            'feature_type': self.feature_type,
            'feature_value': self.feature_value,
            'feature_hash': self.feature_hash,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Registration(Base):
    __tablename__ = 'registrations'

    id = Column(Integer, primary_key=True)
    application_no = Column(String(30), unique=True, nullable=False, index=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id'), nullable=False, index=True)
    work_id = Column(Integer, ForeignKey('works.id'), nullable=False, index=True)
    status = Column(Enum(*REGISTRATION_STATUS), default='submitted', index=True)
    submission_date = Column(DateTime, default=datetime.now, index=True)
    formal_review_date = Column(DateTime)
    substantive_review_date = Column(DateTime)
    payment_date = Column(DateTime)
    issue_date = Column(DateTime)
    expected_completion_date = Column(Date)
    is_unique = Column(Boolean, default=True)
    similarity_score = Column(Float)
    similarity_note = Column(Text)
    review_notes = Column(Text)
    rejection_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    applicant = relationship('Applicant', back_populates='registrations')
    work = relationship('Work', back_populates='registrations')
    reviews = relationship('ReviewRecord', back_populates='registration', cascade='all, delete-orphan')
    payments = relationship('Payment', back_populates='registration', cascade='all, delete-orphan')
    certificates = relationship('Certificate', back_populates='registration', cascade='all, delete-orphan')

    def to_dict(self, include_details: bool = False) -> dict:
        data = {
            'id': self.id,
            'application_no': self.application_no,
            'applicant_id': self.applicant_id,
            'work_id': self.work_id,
            'status': self.status,
            'status_name': REGISTRATION_STATUS_NAMES.get(self.status, ''),
            'submission_date': self.submission_date.isoformat() if self.submission_date else None,
            'formal_review_date': self.formal_review_date.isoformat() if self.formal_review_date else None,
            'substantive_review_date': self.substantive_review_date.isoformat() if self.substantive_review_date else None,
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'issue_date': self.issue_date.isoformat() if self.issue_date else None,
            'expected_completion_date': self.expected_completion_date.isoformat() if self.expected_completion_date else None,
            'is_unique': self.is_unique,
            'similarity_score': self.similarity_score,
            'similarity_note': self.similarity_note,
            'review_notes': self.review_notes,
            'rejection_reason': self.rejection_reason,
        }
        if include_details:
            if self.applicant:
                data['applicant'] = self.applicant.to_dict()
            if self.work:
                data['work'] = self.work.to_dict()
        return data


class ReviewRecord(Base):
    __tablename__ = 'review_records'

    id = Column(Integer, primary_key=True)
    registration_id = Column(Integer, ForeignKey('registrations.id'), nullable=False, index=True)
    reviewer = Column(String(100), nullable=False)
    reviewer_role = Column(Enum(*REVIEW_ROLES), nullable=False)
    review_date = Column(DateTime, default=datetime.now)
    review_stage = Column(String(50))
    review_result = Column(String(20))
    comments = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    registration = relationship('Registration', back_populates='reviews')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'registration_id': self.registration_id,
            'reviewer': self.reviewer,
            'reviewer_role': self.reviewer_role,
            'reviewer_role_name': REVIEW_ROLE_NAMES.get(self.reviewer_role, ''),
            'review_date': self.review_date.isoformat() if self.review_date else None,
            'review_stage': self.review_stage,
            'review_result': self.review_result,
            'comments': self.comments,
        }


class Payment(Base):
    __tablename__ = 'payments'

    id = Column(Integer, primary_key=True)
    registration_id = Column(Integer, ForeignKey('registrations.id'), nullable=False, index=True)
    payment_no = Column(String(50), unique=True, index=True)
    amount = Column(Float, nullable=False)
    status = Column(Enum(*PAYMENT_STATUS), default='pending', index=True)
    payment_method = Column(String(50))
    bank_receipt_no = Column(String(100), index=True)
    payment_date = Column(DateTime)
    confirmed_by = Column(String(100))
    confirmation_date = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    registration = relationship('Registration', back_populates='payments')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'registration_id': self.registration_id,
            'payment_no': self.payment_no,
            'amount': self.amount,
            'status': self.status,
            'status_name': PAYMENT_STATUS_NAMES.get(self.status, ''),
            'payment_method': self.payment_method,
            'bank_receipt_no': self.bank_receipt_no,
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'confirmed_by': self.confirmed_by,
            'confirmation_date': self.confirmation_date.isoformat() if self.confirmation_date else None,
            'notes': self.notes,
        }


class Certificate(Base):
    __tablename__ = 'certificates'

    id = Column(Integer, primary_key=True)
    registration_id = Column(Integer, ForeignKey('registrations.id'), nullable=False, index=True)
    certificate_no = Column(String(50), unique=True, nullable=False, index=True)
    anti_counterfeiting_code = Column(String(64), unique=True, index=True)
    qr_code_data = Column(Text)
    file_path = Column(String(500))
    issued_date = Column(DateTime, default=datetime.now)
    is_reissued = Column(Boolean, default=False)
    reissue_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    registration = relationship('Registration', back_populates='certificates')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'registration_id': self.registration_id,
            'certificate_no': self.certificate_no,
            'anti_counterfeiting_code': self.anti_counterfeiting_code,
            'file_path': self.file_path,
            'issued_date': self.issued_date.isoformat() if self.issued_date else None,
            'is_reissued': self.is_reissued,
            'reissue_reason': self.reissue_reason,
        }


class Publication(Base):
    __tablename__ = 'publications'

    id = Column(Integer, primary_key=True)
    publication_no = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(300), nullable=False)
    publication_date = Column(Date, index=True)
    start_date = Column(Date)
    end_date = Column(Date)
    total_count = Column(Integer, default=0)
    html_path = Column(String(500))
    text_path = Column(String(500))
    is_published = Column(Boolean, default=False)
    published_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    items = relationship('PublicationItem', back_populates='publication', cascade='all, delete-orphan')

    def to_dict(self, include_items: bool = False) -> dict:
        data = {
            'id': self.id,
            'publication_no': self.publication_no,
            'title': self.title,
            'publication_date': self.publication_date.isoformat() if self.publication_date else None,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'total_count': self.total_count,
            'html_path': self.html_path,
            'text_path': self.text_path,
            'is_published': self.is_published,
            'published_by': self.published_by,
        }
        if include_items and self.items:
            data['items'] = [item.to_dict() for item in self.items]
        return data


class PublicationItem(Base):
    __tablename__ = 'publication_items'

    id = Column(Integer, primary_key=True)
    publication_id = Column(Integer, ForeignKey('publications.id'), nullable=False, index=True)
    registration_id = Column(Integer, ForeignKey('registrations.id'), nullable=False, index=True)
    sequence_no = Column(Integer)
    work_title = Column(String(300))
    applicant_name = Column(String(200))
    work_type = Column(String(20))
    registration_date = Column(Date)
    created_at = Column(DateTime, default=datetime.now)

    publication = relationship('Publication', back_populates='items')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'publication_id': self.publication_id,
            'registration_id': self.registration_id,
            'sequence_no': self.sequence_no,
            'work_title': self.work_title,
            'applicant_name': self.applicant_name,
            'work_type': self.work_type,
            'work_type_name': WORK_TYPE_NAMES.get(self.work_type, ''),
            'registration_date': self.registration_date.isoformat() if self.registration_date else None,
        }


class VerificationRecord(Base):
    __tablename__ = 'verification_records'

    id = Column(Integer, primary_key=True)
    registration_id = Column(Integer, ForeignKey('registrations.id'), nullable=False, index=True)
    source = Column(String(50), nullable=False)
    query_result = Column(String(20))
    match_count = Column(Integer, default=0)
    match_details = Column(Text)
    verification_date = Column(DateTime, default=datetime.now)
    report_path = Column(String(500))
    created_at = Column(DateTime, default=datetime.now)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'registration_id': self.registration_id,
            'source': self.source,
            'query_result': self.query_result,
            'match_count': self.match_count,
            'match_details': self.match_details,
            'verification_date': self.verification_date.isoformat() if self.verification_date else None,
            'report_path': self.report_path,
        }


class DatabaseManager:
    _instance = None
    _engine = None
    _Session = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self) -> None:
        db_path = config.get('database.path', 'data/db/copyright.db')
        db_url = f'sqlite:///{db_path}'

        db_dir = os.path.dirname(db_path)
        os.makedirs(db_dir, exist_ok=True)

        self._engine = create_engine(
            db_url,
            echo=config.get('database.echo', False),
            pool_size=config.get('database.pool_size', 5),
            connect_args={'check_same_thread': False, 'timeout': 30}
        )
        self._Session = sessionmaker(bind=self._engine)
        self._create_tables()

    def _create_tables(self) -> None:
        retry_count = 0
        max_retries = 3
        while retry_count < max_retries:
            try:
                Base.metadata.create_all(self._engine)
                logger.info("Database tables created successfully")
                return
            except OperationalError as e:
                retry_count += 1
                logger.warning(f"Database connection failed (attempt {retry_count}/{max_retries}): {e}")
                if retry_count == max_retries:
                    logger.error("Failed to connect to database after max retries")
                    raise

    @contextmanager
    def get_session(self):
        session = self._Session()
        try:
            yield session
            session.commit()
        except SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            session.close()

    def get_engine(self):
        return self._engine


db_manager = DatabaseManager()
