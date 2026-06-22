from datetime import datetime
from app import db


class OrthodonticRecord(db.Model):
    __tablename__ = 'orthodontic_records'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'))
    start_date = db.Column(db.Date)
    bracket_type = db.Column(db.String(50))
    archwire_sequence = db.Column(db.JSON)
    attachments = db.Column(db.JSON)
    total_movement = db.Column(db.Float, default=0)
    progress = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default='in_progress')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    visits = db.relationship('OrthodonticVisit', backref='record', lazy='dynamic', order_by='OrthodonticVisit.visit_date')

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'doctor_id': self.doctor_id,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'bracket_type': self.bracket_type,
            'archwire_sequence': self.archwire_sequence or [],
            'attachments': self.attachments or [],
            'total_movement': self.total_movement,
            'progress': self.progress,
            'status': self.status,
            'visits_count': self.visits.count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class OrthodonticVisit(db.Model):
    __tablename__ = 'orthodontic_visits'

    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey('orthodontic_records.id'), nullable=False, index=True)
    visit_date = db.Column(db.Date, nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'))
    tooth_movement = db.Column(db.Float, default=0)
    adjustment = db.Column(db.Text)
    notes = db.Column(db.Text)
    next_visit = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'record_id': self.record_id,
            'date': self.visit_date.isoformat() if self.visit_date else None,
            'doctor_id': self.doctor_id,
            'tooth_movement': self.tooth_movement,
            'adjustment': self.adjustment,
            'notes': self.notes,
            'next_visit': self.next_visit.isoformat() if self.next_visit else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
