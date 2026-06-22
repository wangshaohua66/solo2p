from datetime import datetime
from app import db


class MedicalRecord(db.Model):
    __tablename__ = 'medical_records'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'), nullable=False)
    department = db.Column(db.String(50))
    visit_date = db.Column(db.Date, nullable=False, index=True)
    chief_complaint = db.Column(db.Text)
    present_illness = db.Column(db.Text)
    past_history = db.Column(db.Text)
    diagnosis = db.Column(db.Text)
    treatment_plan = db.Column(db.Text)
    prescription = db.Column(db.JSON)
    images = db.Column(db.JSON)
    next_visit = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    doctor = db.relationship('Doctor', backref='medical_records')

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient.name if self.patient else '',
            'doctor_id': self.doctor_id,
            'doctor_name': self.doctor.name if self.doctor else '',
            'department': self.department,
            'date': self.visit_date.isoformat() if self.visit_date else None,
            'chief_complaint': self.chief_complaint,
            'present_illness': self.present_illness,
            'past_history': self.past_history,
            'diagnosis': self.diagnosis,
            'treatment_plan': self.treatment_plan,
            'prescription': self.prescription or [],
            'images': self.images or [],
            'next_visit': self.next_visit.isoformat() if self.next_visit else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class MedicalImage(db.Model):
    __tablename__ = 'medical_images'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False, index=True)
    record_id = db.Column(db.Integer, db.ForeignKey('medical_records.id'))
    file_name = db.Column(db.String(255))
    file_path = db.Column(db.String(255))
    file_size = db.Column(db.Integer)
    image_type = db.Column(db.String(50))
    uploaded_by = db.Column(db.Integer, db.ForeignKey('doctors.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'record_id': self.record_id,
            'file_name': self.file_name,
            'file_path': self.file_path,
            'file_size': self.file_size,
            'image_type': self.image_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
