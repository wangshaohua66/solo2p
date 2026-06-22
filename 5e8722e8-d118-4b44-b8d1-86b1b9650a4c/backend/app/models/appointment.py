from datetime import datetime
from app import db


class Appointment(db.Model):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False, index=True)
    clinic_id = db.Column(db.Integer, db.ForeignKey('clinics.id'), nullable=False)
    department = db.Column(db.String(50), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'), nullable=False)
    appointment_date = db.Column(db.Date, nullable=False, index=True)
    time_slot = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='pending')
    appointment_type = db.Column(db.String(50))
    symptom = db.Column(db.Text)
    reminder_sent = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    clinic = db.relationship('Clinic', backref='appointments')
    doctor = db.relationship('Doctor', backref='appointments')

    __table_args__ = (
        db.Index('idx_doctor_date_slot', 'doctor_id', 'appointment_date', 'time_slot', unique=True),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient.name if self.patient else '',
            'clinic_id': self.clinic_id,
            'clinic_name': self.clinic.name if self.clinic else '',
            'department': self.department,
            'doctor_id': self.doctor_id,
            'doctor_name': self.doctor.name if self.doctor else '',
            'date': self.appointment_date.isoformat() if self.appointment_date else None,
            'time_slot': self.time_slot,
            'status': self.status,
            'type': self.appointment_type,
            'symptom': self.symptom,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
