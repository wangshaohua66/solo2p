from datetime import datetime
from app import db


class Clinic(db.Model):
    __tablename__ = 'clinics'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(255))
    phone = db.Column(db.String(20))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    departments = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, include_location=False):
        data = {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'phone': self.phone,
            'departments': self.departments or [],
        }
        if include_location:
            data['latitude'] = self.latitude
            data['longitude'] = self.longitude
        return data


class Doctor(db.Model):
    __tablename__ = 'doctors'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(50))
    department = db.Column(db.String(50), nullable=False)
    clinic_id = db.Column(db.Integer, db.ForeignKey('clinics.id'), nullable=False)
    rating = db.Column(db.Float, default=5.0)
    specialty = db.Column(db.JSON)
    avatar = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    clinic = db.relationship('Clinic', backref='doctors')

    def to_dict(self, include_distance=False, user_lat=None, user_lng=None):
        data = {
            'id': self.id,
            'name': self.name,
            'title': self.title,
            'department': self.department,
            'clinic_id': self.clinic_id,
            'clinic_name': self.clinic.name if self.clinic else '',
            'clinic_address': self.clinic.address if self.clinic else '',
            'rating': self.rating,
            'specialty': self.specialty or [],
            'avatar': self.avatar,
        }
        if include_distance and user_lat and user_lng and self.clinic and self.clinic.latitude and self.clinic.longitude:
            from app.utils.geo import calculate_distance
            data['distance'] = calculate_distance(user_lat, user_lng, self.clinic.latitude, self.clinic.longitude)
        return data
