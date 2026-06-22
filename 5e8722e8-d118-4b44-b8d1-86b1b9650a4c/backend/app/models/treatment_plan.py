from datetime import datetime
from app import db


class TreatmentPlan(db.Model):
    __tablename__ = 'treatment_plans'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'), nullable=False)
    plan_type = db.Column(db.String(50))
    plan_name = db.Column(db.String(100))
    description = db.Column(db.Text)
    start_date = db.Column(db.Date)
    expected_end_date = db.Column(db.Date)
    status = db.Column(db.String(20), default='in_progress')
    total_visits = db.Column(db.Integer, default=0)
    completed_visits = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'doctor_id': self.doctor_id,
            'plan_type': self.plan_type,
            'plan_name': self.plan_name,
            'description': self.description,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'expected_end_date': self.expected_end_date.isoformat() if self.expected_end_date else None,
            'status': self.status,
            'total_visits': self.total_visits,
            'completed_visits': self.completed_visits,
            'progress': round((self.completed_visits / self.total_visits * 100), 1) if self.total_visits > 0 else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class RecheckPlan(db.Model):
    __tablename__ = 'recheck_plans'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False, index=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('treatment_plans.id'))
    visit_date = db.Column(db.Date, nullable=False)
    visit_type = db.Column(db.String(50))
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'))
    status = db.Column(db.String(20), default='pending')
    notes = db.Column(db.Text)
    reminder_sent = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'plan_id': self.plan_id,
            'date': self.visit_date.isoformat() if self.visit_date else None,
            'type': self.visit_type,
            'doctor_id': self.doctor_id,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
