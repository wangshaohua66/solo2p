from datetime import datetime, date
from app import db


class TriageQueue(db.Model):
    """分诊排队表"""
    __tablename__ = 'triage_queues'

    id = db.Column(db.Integer, primary_key=True)
    queue_date = db.Column(db.Date, nullable=False, index=True)
    clinic_id = db.Column(db.Integer, nullable=False, index=True)
    department = db.Column(db.String(50), nullable=False, index=True)
    patient_id = db.Column(db.Integer, nullable=False)
    patient_name = db.Column(db.String(50), nullable=False)
    queue_number = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), default='waiting')
    doctor_id = db.Column(db.Integer)
    doctor_name = db.Column(db.String(50))
    triage_note = db.Column(db.Text)
    arrived_at = db.Column(db.DateTime)
    called_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('queue_date', 'clinic_id', 'department', 'queue_number', name='uq_daily_queue'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'queue_date': self.queue_date.isoformat() if self.queue_date else None,
            'clinic_id': self.clinic_id,
            'department': self.department,
            'patient_id': self.patient_id,
            'patient_name': self.patient_name,
            'queue_number': self.queue_number,
            'status': self.status,
            'doctor_id': self.doctor_id,
            'doctor_name': self.doctor_name,
            'triage_note': self.triage_note,
            'arrived_at': self.arrived_at.isoformat() if self.arrived_at else None,
            'called_at': self.called_at.isoformat() if self.called_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
