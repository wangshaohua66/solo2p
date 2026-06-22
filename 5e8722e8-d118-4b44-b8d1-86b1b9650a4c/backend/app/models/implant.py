from datetime import datetime
from app import db


class ImplantRecord(db.Model):
    __tablename__ = 'implant_records'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'))
    implant_brand = db.Column(db.String(100))
    implant_model = db.Column(db.String(100))
    implant_spec = db.Column(db.String(100))
    position = db.Column(db.String(50))
    bone_graft_amount = db.Column(db.Float, default=0)
    current_stage = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='in_progress')
    surgery_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stages = db.relationship('ImplantStage', backref='record', lazy='dynamic', order_by='ImplantStage.stage_index')

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'doctor_id': self.doctor_id,
            'implant_brand': self.implant_brand,
            'implant_model': self.implant_model,
            'implant_spec': self.implant_spec,
            'position': self.position,
            'bone_graft_amount': self.bone_graft_amount,
            'current_stage': self.current_stage,
            'status': self.status,
            'surgery_date': self.surgery_date.isoformat() if self.surgery_date else None,
            'total_stages': 5,
            'progress': round((self.current_stage / 5) * 100, 1),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ImplantStage(db.Model):
    __tablename__ = 'implant_stages'

    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey('implant_records.id'), nullable=False, index=True)
    stage_index = db.Column(db.Integer, nullable=False)
    stage_name = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='pending')
    completed_date = db.Column(db.Date)
    checklist = db.Column(db.JSON)
    completed_items = db.Column(db.JSON)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'record_id': self.record_id,
            'stage_index': self.stage_index,
            'stage_name': self.stage_name,
            'status': self.status,
            'completed_date': self.completed_date.isoformat() if self.completed_date else None,
            'checklist': self.checklist or [],
            'completed_items': self.completed_items or [],
            'notes': self.notes,
        }
