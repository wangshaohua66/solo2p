from datetime import datetime
from app import db


class Consumable(db.Model):
    __tablename__ = 'consumables'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    category = db.Column(db.String(50), nullable=False, index=True)
    spec = db.Column(db.String(100))
    unit = db.Column(db.String(20))
    stock = db.Column(db.Integer, default=0)
    min_stock = db.Column(db.Integer, default=0)
    price = db.Column(db.Float, default=0)
    clinic_id = db.Column(db.Integer, db.ForeignKey('clinics.id'), nullable=False)
    barcode = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    clinic = db.relationship('Clinic', backref='consumables')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'spec': self.spec,
            'unit': self.unit,
            'stock': self.stock,
            'min_stock': self.min_stock,
            'price': self.price,
            'clinic_id': self.clinic_id,
            'clinic_name': self.clinic.name if self.clinic else '',
            'barcode': self.barcode,
            'is_low_stock': self.stock < self.min_stock,
        }


class ConsumableRecord(db.Model):
    __tablename__ = 'consumable_records'

    id = db.Column(db.Integer, primary_key=True)
    consumable_id = db.Column(db.Integer, db.ForeignKey('consumables.id'), nullable=False, index=True)
    type = db.Column(db.String(10), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    operator_id = db.Column(db.Integer)
    operator_name = db.Column(db.String(50))
    related_patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'))
    remark = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    consumable = db.relationship('Consumable', backref='records')

    def to_dict(self):
        return {
            'id': self.id,
            'consumable_id': self.consumable_id,
            'consumable_name': self.consumable.name if self.consumable else '',
            'type': self.type,
            'quantity': self.quantity,
            'operator_name': self.operator_name,
            'remark': self.remark,
            'date': self.created_at.strftime('%Y-%m-%d') if self.created_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class PurchaseRequest(db.Model):
    __tablename__ = 'purchase_requests'

    id = db.Column(db.Integer, primary_key=True)
    consumable_id = db.Column(db.Integer, db.ForeignKey('consumables.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), default='pending')
    requested_by = db.Column(db.Integer)
    approved_by = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    consumable = db.relationship('Consumable', backref='purchase_requests')

    def to_dict(self):
        return {
            'id': self.id,
            'consumable_id': self.consumable_id,
            'consumable_name': self.consumable.name if self.consumable else '',
            'quantity': self.quantity,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
