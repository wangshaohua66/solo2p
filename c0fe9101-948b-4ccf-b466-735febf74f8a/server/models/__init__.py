from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class TimestampMixin:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Hospital(db.Model, TimestampMixin):
    __tablename__ = 'hospitals'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    address = db.Column(db.String(256))
    phone = db.Column(db.String(32))
    type = db.Column(db.String(20), default='normal')  # normal, emergency_24h
    is_active = db.Column(db.Boolean, default=True)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)

    departments = db.relationship('Department', backref='hospital', lazy=True)
    cages = db.relationship('Cage', backref='hospital', lazy=True)
    users = db.relationship('User', backref='hospital', lazy=True)
    medical_records = db.relationship('MedicalRecord', backref='hospital', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'phone': self.phone,
            'type': self.type,
            'is_active': self.is_active,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Department(db.Model, TimestampMixin):
    __tablename__ = 'departments'

    id = db.Column(db.Integer, primary_key=True)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'), nullable=False)
    name = db.Column(db.String(64), nullable=False)  # 内科, 外科, 影像科, 检验科
    description = db.Column(db.String(256))
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'hospital_id': self.hospital_id,
            'name': self.name,
            'description': self.description,
            'is_active': self.is_active
        }


class User(db.Model, TimestampMixin):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    real_name = db.Column(db.String(64), nullable=False)
    role = db.Column(db.String(32), nullable=False)  # doctor, lab_tech, pharmacist, nurse, manager, director
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'))
    department = db.Column(db.String(64))
    phone = db.Column(db.String(32))
    email = db.Column(db.String(128))
    qualification = db.Column(db.String(128))  # 资质证书
    is_active = db.Column(db.Boolean, default=True)
    weekly_max_hours = db.Column(db.Integer, default=48)  # 每周最大工时

    medical_records = db.relationship('MedicalRecord', backref='doctor', foreign_keys='MedicalRecord.doctor_id', lazy=True)
    lab_results_submitted = db.relationship('LabResult', backref='technician', foreign_keys='LabResult.technician_id', lazy=True)
    schedules = db.relationship('Schedule', backref='user', foreign_keys='Schedule.user_id', lazy=True)
    notifications_received = db.relationship('Notification', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self, include_sensitive=False):
        data = {
            'id': self.id,
            'username': self.username,
            'real_name': self.real_name,
            'role': self.role,
            'hospital_id': self.hospital_id,
            'hospital_name': self.hospital.name if self.hospital else None,
            'department': self.department,
            'phone': self.phone,
            'email': self.email,
            'qualification': self.qualification,
            'is_active': self.is_active,
            'weekly_max_hours': self.weekly_max_hours
        }
        if include_sensitive:
            data['email'] = self.email
        return data


class Owner(db.Model, TimestampMixin):
    __tablename__ = 'owners'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    phone = db.Column(db.String(32), nullable=False)
    id_card = db.Column(db.String(32))
    address = db.Column(db.String(256))
    wechat = db.Column(db.String(64))
    remark = db.Column(db.Text)

    pets = db.relationship('Pet', backref='owner', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'id_card': self.id_card,
            'address': self.address,
            'wechat': self.wechat,
            'remark': self.remark
        }


class Pet(db.Model, TimestampMixin):
    __tablename__ = 'pets'

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('owners.id'), nullable=False)
    name = db.Column(db.String(64), nullable=False)
    species = db.Column(db.String(32), nullable=False)  # 犬, 猫, 其他
    breed = db.Column(db.String(64))
    gender = db.Column(db.String(10))  # male, female, unknown
    birth_date = db.Column(db.Date)
    weight = db.Column(db.Float)
    color = db.Column(db.String(32))
    microchip_id = db.Column(db.String(64))
    is_neutered = db.Column(db.Boolean, default=False)
    allergy_history = db.Column(db.Text)
    remark = db.Column(db.Text)

    medical_records = db.relationship('MedicalRecord', backref='pet', lazy=True)
    hospitalizations = db.relationship('Hospitalization', backref='pet', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'owner_id': self.owner_id,
            'owner_name': self.owner.name if self.owner else None,
            'owner_phone': self.owner.phone if self.owner else None,
            'name': self.name,
            'species': self.species,
            'breed': self.breed,
            'gender': self.gender,
            'birth_date': self.birth_date.isoformat() if self.birth_date else None,
            'weight': self.weight,
            'color': self.color,
            'microchip_id': self.microchip_id,
            'is_neutered': self.is_neutered,
            'allergy_history': self.allergy_history,
            'remark': self.remark
        }


class MedicalRecord(db.Model, TimestampMixin):
    __tablename__ = 'medical_records'

    id = db.Column(db.Integer, primary_key=True)
    pet_id = db.Column(db.Integer, db.ForeignKey('pets.id'), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('owners.id'))
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    department = db.Column(db.String(64))
    visit_type = db.Column(db.String(32), default='outpatient')  # outpatient, emergency, referral, revisit
    referral_from_id = db.Column(db.Integer, db.ForeignKey('medical_records.id'))
    chief_complaint = db.Column(db.Text)
    present_illness = db.Column(db.Text)
    past_history = db.Column(db.Text)
    physical_exam = db.Column(db.Text)
    temperature = db.Column(db.Float)
    heart_rate = db.Column(db.Integer)
    respiratory_rate = db.Column(db.Integer)
    diagnosis = db.Column(db.Text)
    treatment_plan = db.Column(db.Text)
    status = db.Column(db.String(20), default='in_progress')  # in_progress, completed, referred
    visit_date = db.Column(db.DateTime, default=datetime.utcnow)

    referrals_to = db.relationship('MedicalRecord', backref=db.backref('referral_from', remote_side=[id]), lazy=True)
    prescriptions = db.relationship('Prescription', backref='medical_record', lazy=True, cascade='all, delete-orphan')
    lab_results = db.relationship('LabResult', backref='medical_record', lazy=True, cascade='all, delete-orphan')
    attachments = db.relationship('RecordAttachment', backref='medical_record', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, include_details=False):
        data = {
            'id': self.id,
            'pet_id': self.pet_id,
            'pet_name': self.pet.name if self.pet else None,
            'owner_id': self.owner_id,
            'owner_name': self.owner.name if self.owner else None,
            'hospital_id': self.hospital_id,
            'hospital_name': self.hospital.name if self.hospital else None,
            'doctor_id': self.doctor_id,
            'doctor_name': self.doctor.real_name if self.doctor else None,
            'department': self.department,
            'visit_type': self.visit_type,
            'referral_from_id': self.referral_from_id,
            'chief_complaint': self.chief_complaint,
            'diagnosis': self.diagnosis,
            'status': self.status,
            'visit_date': self.visit_date.isoformat() if self.visit_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_details:
            data.update({
                'present_illness': self.present_illness,
                'past_history': self.past_history,
                'physical_exam': self.physical_exam,
                'temperature': self.temperature,
                'heart_rate': self.heart_rate,
                'respiratory_rate': self.respiratory_rate,
                'treatment_plan': self.treatment_plan,
                'prescriptions': [p.to_dict(include_items=True) for p in self.prescriptions],
                'lab_results': [lr.to_dict() for lr in self.lab_results],
                'attachments': [a.to_dict() for a in self.attachments]
            })
        return data


class RecordAttachment(db.Model, TimestampMixin):
    __tablename__ = 'record_attachments'

    id = db.Column(db.Integer, primary_key=True)
    medical_record_id = db.Column(db.Integer, db.ForeignKey('medical_records.id'), nullable=False)
    file_name = db.Column(db.String(256), nullable=False)
    file_path = db.Column(db.String(512), nullable=False)
    file_type = db.Column(db.String(64))  # xray, ultrasound, blood_work, other
    file_size = db.Column(db.Integer)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    def to_dict(self):
        return {
            'id': self.id,
            'medical_record_id': self.medical_record_id,
            'file_name': self.file_name,
            'file_path': self.file_path,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'uploaded_by': self.uploaded_by
        }


class Cage(db.Model, TimestampMixin):
    __tablename__ = 'cages'

    id = db.Column(db.Integer, primary_key=True)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'), nullable=False)
    zone = db.Column(db.String(32))  # 区域
    code = db.Column(db.String(32), nullable=False)  # 笼位编号
    type = db.Column(db.String(32), default='standard')  # standard, emergency, ICU, isolation
    size = db.Column(db.String(20), default='medium')  # small, medium, large
    status = db.Column(db.String(20), default='available')  # available, occupied, reserved, cleaning, maintenance
    remark = db.Column(db.String(256))

    hospitalizations = db.relationship('Hospitalization', backref='cage', lazy=True)

    __table_args__ = (db.UniqueConstraint('hospital_id', 'code', name='uix_hospital_cage_code'),)

    def to_dict(self, include_current_hospitalization=False):
        data = {
            'id': self.id,
            'hospital_id': self.hospital_id,
            'zone': self.zone,
            'code': self.code,
            'type': self.type,
            'size': self.size,
            'status': self.status,
            'remark': self.remark
        }
        if include_current_hospitalization:
            current = next((h for h in self.hospitalizations if h.status in ('admitted', 'reserved')), None)
            if current:
                data['current_hospitalization'] = current.to_dict()
        return data


class Hospitalization(db.Model, TimestampMixin):
    __tablename__ = 'hospitalizations'

    id = db.Column(db.Integer, primary_key=True)
    pet_id = db.Column(db.Integer, db.ForeignKey('pets.id'), nullable=False)
    medical_record_id = db.Column(db.Integer, db.ForeignKey('medical_records.id'))
    cage_id = db.Column(db.Integer, db.ForeignKey('cages.id'), nullable=False)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'), nullable=False)
    admitting_doctor_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    status = db.Column(db.String(20), default='reserved')  # reserved, admitted, discharged, cancelled
    admission_reason = db.Column(db.Text)
    admission_date = db.Column(db.DateTime)
    expected_discharge_date = db.Column(db.DateTime)
    actual_discharge_date = db.Column(db.DateTime)
    discharge_summary = db.Column(db.Text)
    daily_notes = db.Column(db.Text)
    is_emergency = db.Column(db.Boolean, default=False)

    admitting_doctor = db.relationship('User', foreign_keys=[admitting_doctor_id])

    def to_dict(self):
        return {
            'id': self.id,
            'pet_id': self.pet_id,
            'pet_name': self.pet.name if self.pet else None,
            'pet_species': self.pet.species if self.pet else None,
            'medical_record_id': self.medical_record_id,
            'cage_id': self.cage_id,
            'cage_code': self.cage.code if self.cage else None,
            'hospital_id': self.hospital_id,
            'hospital_name': self.hospital.name if self.hospital else None,
            'admitting_doctor_id': self.admitting_doctor_id,
            'admitting_doctor_name': self.admitting_doctor.real_name if self.admitting_doctor else None,
            'status': self.status,
            'admission_reason': self.admission_reason,
            'admission_date': self.admission_date.isoformat() if self.admission_date else None,
            'expected_discharge_date': self.expected_discharge_date.isoformat() if self.expected_discharge_date else None,
            'actual_discharge_date': self.actual_discharge_date.isoformat() if self.actual_discharge_date else None,
            'discharge_summary': self.discharge_summary,
            'daily_notes': self.daily_notes,
            'is_emergency': self.is_emergency,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Medicine(db.Model, TimestampMixin):
    __tablename__ = 'medicines'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    generic_name = db.Column(db.String(128))
    spec = db.Column(db.String(64))  # 规格
    manufacturer = db.Column(db.String(128))
    batch_number = db.Column(db.String(64))
    category = db.Column(db.String(64))  # antibiotic, analgesic, psychotropic, vitamin, other
    is_controlled = db.Column(db.Boolean, default=False)  # 管制药/精神类
    is_prescription = db.Column(db.Boolean, default=True)
    unit = db.Column(db.String(20), default='box')  # box, bottle, tablet, ml
    stock_quantity = db.Column(db.Integer, default=0)
    safety_stock = db.Column(db.Integer, default=10)  # 安全库存阈值
    unit_price = db.Column(db.Float, default=0.0)
    expiry_date = db.Column(db.Date)
    storage_condition = db.Column(db.String(128))
    is_active = db.Column(db.Boolean, default=True)

    prescription_items = db.relationship('PrescriptionItem', backref='medicine', lazy=True)

    __table_args__ = (db.UniqueConstraint('name', 'spec', 'batch_number', name='uix_medicine_name_spec_batch'),)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'generic_name': self.generic_name,
            'spec': self.spec,
            'manufacturer': self.manufacturer,
            'batch_number': self.batch_number,
            'category': self.category,
            'is_controlled': self.is_controlled,
            'is_prescription': self.is_prescription,
            'unit': self.unit,
            'stock_quantity': self.stock_quantity,
            'safety_stock': self.safety_stock,
            'unit_price': self.unit_price,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'storage_condition': self.storage_condition,
            'is_active': self.is_active,
            'is_low_stock': self.stock_quantity <= self.safety_stock
        }


class Prescription(db.Model, TimestampMixin):
    __tablename__ = 'prescriptions'

    id = db.Column(db.Integer, primary_key=True)
    medical_record_id = db.Column(db.Integer, db.ForeignKey('medical_records.id'), nullable=False)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'), nullable=False)
    prescribed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    first_approver_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    second_approver_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    has_controlled = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(20), default='pending')  # pending, first_approved, second_approved, dispensed, cancelled
    dispense_date = db.Column(db.DateTime)
    dispensed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    total_amount = db.Column(db.Float, default=0.0)
    remark = db.Column(db.Text)

    prescribed_by = db.relationship('User', foreign_keys=[prescribed_by_id])
    first_approver = db.relationship('User', foreign_keys=[first_approver_id])
    second_approver = db.relationship('User', foreign_keys=[second_approver_id])
    dispensed_by = db.relationship('User', foreign_keys=[dispensed_by_id])
    items = db.relationship('PrescriptionItem', backref='prescription', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, include_items=False):
        data = {
            'id': self.id,
            'medical_record_id': self.medical_record_id,
            'hospital_id': self.hospital_id,
            'prescribed_by_id': self.prescribed_by_id,
            'prescribed_by_name': self.prescribed_by.real_name if self.prescribed_by else None,
            'first_approver_id': self.first_approver_id,
            'first_approver_name': self.first_approver.real_name if self.first_approver else None,
            'second_approver_id': self.second_approver_id,
            'second_approver_name': self.second_approver.real_name if self.second_approver else None,
            'has_controlled': self.has_controlled,
            'status': self.status,
            'dispense_date': self.dispense_date.isoformat() if self.dispense_date else None,
            'dispensed_by_id': self.dispensed_by_id,
            'dispensed_by_name': self.dispensed_by.real_name if self.dispensed_by else None,
            'total_amount': self.total_amount,
            'remark': self.remark,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_items:
            data['items'] = [item.to_dict() for item in self.items]
        return data


class PrescriptionItem(db.Model, TimestampMixin):
    __tablename__ = 'prescription_items'

    id = db.Column(db.Integer, primary_key=True)
    prescription_id = db.Column(db.Integer, db.ForeignKey('prescriptions.id'), nullable=False)
    medicine_id = db.Column(db.Integer, db.ForeignKey('medicines.id'), nullable=False)
    dosage = db.Column(db.String(128))  # 用法用量
    quantity = db.Column(db.Float, nullable=False)
    unit_price = db.Column(db.Float, default=0.0)
    subtotal = db.Column(db.Float, default=0.0)
    remark = db.Column(db.String(256))

    def to_dict(self):
        return {
            'id': self.id,
            'prescription_id': self.prescription_id,
            'medicine_id': self.medicine_id,
            'medicine_name': self.medicine.name if self.medicine else None,
            'medicine_spec': self.medicine.spec if self.medicine else None,
            'is_controlled': self.medicine.is_controlled if self.medicine else False,
            'dosage': self.dosage,
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'subtotal': self.subtotal,
            'remark': self.remark
        }


class LabTest(db.Model, TimestampMixin):
    __tablename__ = 'lab_tests'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(32), unique=True, nullable=False)
    name = db.Column(db.String(128), nullable=False)
    category = db.Column(db.String(64))  # blood, imaging, urine, pathology, other
    subcategory = db.Column(db.String(64))  # 血常规, 生化, X光, B超, etc.
    unit = db.Column(db.String(32))
    reference_min = db.Column(db.Float)
    reference_max = db.Column(db.Float)
    reference_text = db.Column(db.String(128))  # 文本参考值
    price = db.Column(db.Float, default=0.0)
    is_active = db.Column(db.Boolean, default=True)
    need_attachment = db.Column(db.Boolean, default=False)

    lab_result_items = db.relationship('LabResultItem', backref='lab_test', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'category': self.category,
            'subcategory': self.subcategory,
            'unit': self.unit,
            'reference_min': self.reference_min,
            'reference_max': self.reference_max,
            'reference_text': self.reference_text,
            'price': self.price,
            'is_active': self.is_active,
            'need_attachment': self.need_attachment
        }


class LabResult(db.Model, TimestampMixin):
    __tablename__ = 'lab_results'

    id = db.Column(db.Integer, primary_key=True)
    medical_record_id = db.Column(db.Integer, db.ForeignKey('medical_records.id'), nullable=False)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'), nullable=False)
    technician_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    requesting_doctor_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    category = db.Column(db.String(64))
    status = db.Column(db.String(20), default='pending')  # pending, in_progress, completed, reviewed
    overall_conclusion = db.Column(db.Text)
    submitted_at = db.Column(db.DateTime)
    reviewed_at = db.Column(db.DateTime)
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    attachment_path = db.Column(db.String(512))
    priority = db.Column(db.String(20), default='normal')  # normal, urgent, emergency

    requesting_doctor = db.relationship('User', foreign_keys=[requesting_doctor_id])
    reviewed_by = db.relationship('User', foreign_keys=[reviewed_by_id])
    items = db.relationship('LabResultItem', backref='lab_result', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, include_items=True):
        data = {
            'id': self.id,
            'medical_record_id': self.medical_record_id,
            'hospital_id': self.hospital_id,
            'hospital_name': self.hospital.name if self.hospital else None,
            'technician_id': self.technician_id,
            'technician_name': self.technician.real_name if self.technician else None,
            'requesting_doctor_id': self.requesting_doctor_id,
            'requesting_doctor_name': self.requesting_doctor.real_name if self.requesting_doctor else None,
            'category': self.category,
            'status': self.status,
            'overall_conclusion': self.overall_conclusion,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'reviewed_by_id': self.reviewed_by_id,
            'attachment_path': self.attachment_path,
            'priority': self.priority,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_items:
            data['items'] = [item.to_dict() for item in self.items]
            data['has_abnormal'] = any(item.is_abnormal for item in self.items)
        return data


class LabResultItem(db.Model, TimestampMixin):
    __tablename__ = 'lab_result_items'

    id = db.Column(db.Integer, primary_key=True)
    lab_result_id = db.Column(db.Integer, db.ForeignKey('lab_results.id'), nullable=False)
    lab_test_id = db.Column(db.Integer, db.ForeignKey('lab_tests.id'), nullable=False)
    result_value = db.Column(db.Float)
    result_text = db.Column(db.String(256))
    is_abnormal = db.Column(db.Boolean, default=False)
    abnormal_type = db.Column(db.String(10))  # high, low
    remark = db.Column(db.String(256))

    def to_dict(self):
        return {
            'id': self.id,
            'lab_result_id': self.lab_result_id,
            'lab_test_id': self.lab_test_id,
            'test_code': self.lab_test.code if self.lab_test else None,
            'test_name': self.lab_test.name if self.lab_test else None,
            'category': self.lab_test.category if self.lab_test else None,
            'subcategory': self.lab_test.subcategory if self.lab_test else None,
            'unit': self.lab_test.unit if self.lab_test else None,
            'reference_min': self.lab_test.reference_min if self.lab_test else None,
            'reference_max': self.lab_test.reference_max if self.lab_test else None,
            'reference_text': self.lab_test.reference_text if self.lab_test else None,
            'result_value': self.result_value,
            'result_text': self.result_text,
            'is_abnormal': self.is_abnormal,
            'abnormal_type': self.abnormal_type,
            'remark': self.remark
        }


class Schedule(db.Model, TimestampMixin):
    __tablename__ = 'schedules'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'), nullable=False)
    shift_date = db.Column(db.Date, nullable=False)
    shift_type = db.Column(db.String(20), nullable=False)  # morning, afternoon, night, day_off, on_call, emergency
    start_time = db.Column(db.Time)
    end_time = db.Column(db.Time)
    department = db.Column(db.String(64))
    is_emergency_duty = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(20), default='confirmed')  # draft, confirmed, swapped, cancelled
    swap_with_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    remark = db.Column(db.String(256))

    swap_with = db.relationship('User', foreign_keys=[swap_with_id])

    __table_args__ = (db.UniqueConstraint('user_id', 'shift_date', 'shift_type', name='uix_user_date_shift'),)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.real_name if self.user else None,
            'user_role': self.user.role if self.user else None,
            'hospital_id': self.hospital_id,
            'shift_date': self.shift_date.isoformat() if self.shift_date else None,
            'shift_type': self.shift_type,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'department': self.department,
            'is_emergency_duty': self.is_emergency_duty,
            'status': self.status,
            'swap_with_id': self.swap_with_id,
            'swap_with_name': self.swap_with.real_name if self.swap_with else None,
            'remark': self.remark
        }


class Notification(db.Model, TimestampMixin):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    type = db.Column(db.String(32), nullable=False)  # lab_result, prescription, schedule, emergency, system
    title = db.Column(db.String(256), nullable=False)
    content = db.Column(db.Text)
    related_type = db.Column(db.String(64))  # LabResult, Prescription, etc.
    related_id = db.Column(db.Integer)
    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime)
    priority = db.Column(db.String(20), default='normal')  # low, normal, high, urgent

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'type': self.type,
            'title': self.title,
            'content': self.content,
            'related_type': self.related_type,
            'related_id': self.related_id,
            'is_read': self.is_read,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'priority': self.priority,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class StockLog(db.Model, TimestampMixin):
    __tablename__ = 'stock_logs'

    id = db.Column(db.Integer, primary_key=True)
    medicine_id = db.Column(db.Integer, db.ForeignKey('medicines.id'), nullable=False)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'))
    change_type = db.Column(db.String(20), nullable=False)  # purchase, dispense, return, adjust, expiry
    quantity_change = db.Column(db.Integer, nullable=False)
    balance_after = db.Column(db.Integer, nullable=False)
    related_type = db.Column(db.String(64))  # Prescription, PurchaseOrder
    related_id = db.Column(db.Integer)
    operator_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    remark = db.Column(db.String(256))

    medicine = db.relationship('Medicine')
    operator = db.relationship('User', foreign_keys=[operator_id])

    def to_dict(self):
        return {
            'id': self.id,
            'medicine_id': self.medicine_id,
            'medicine_name': self.medicine.name if self.medicine else None,
            'hospital_id': self.hospital_id,
            'change_type': self.change_type,
            'quantity_change': self.quantity_change,
            'balance_after': self.balance_after,
            'related_type': self.related_type,
            'related_id': self.related_id,
            'operator_id': self.operator_id,
            'operator_name': self.operator.real_name if self.operator else None,
            'remark': self.remark,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
