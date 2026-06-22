from app.routes.auth import auth_bp
from app.routes.patient import patient_bp
from app.routes.appointment import appointment_bp
from app.routes.medical import medical_bp
from app.routes.report import report_bp
from app.routes.consumable import consumable_bp

__all__ = [
    'auth_bp',
    'patient_bp',
    'appointment_bp',
    'medical_bp',
    'report_bp',
    'consumable_bp',
]
