from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import redis

from app.config import config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
redis_client = None


def create_app(config_name=None):
    if config_name is None:
        config_name = 'default'
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, origins=app.config['CORS_ORIGINS'])
    
    global redis_client
    redis_client = redis.from_url(app.config['REDIS_URL'], decode_responses=True)
    
    from app.routes.auth import auth_bp
    from app.routes.patient import patient_bp
    from app.routes.appointment import appointment_bp
    from app.routes.medical import medical_bp
    from app.routes.report import report_bp
    from app.routes.consumable import consumable_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(patient_bp, url_prefix='/api/patients')
    app.register_blueprint(appointment_bp, url_prefix='/api/appointments')
    app.register_blueprint(medical_bp, url_prefix='/api/medical')
    app.register_blueprint(report_bp, url_prefix='/api/reports')
    app.register_blueprint(consumable_bp, url_prefix='/api/consumables')
    
    @app.route('/api/health')
    def health_check():
        return {'status': 'ok', 'message': 'Dental Clinic API is running'}
    
    return app
