from flask import Flask, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import redis
import logging

from app.config import config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
redis_client = None

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


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
    from app.routes.triage import triage_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(patient_bp, url_prefix='/api/patients')
    app.register_blueprint(appointment_bp, url_prefix='/api/appointments')
    app.register_blueprint(medical_bp, url_prefix='/api/medical')
    app.register_blueprint(report_bp, url_prefix='/api/reports')
    app.register_blueprint(consumable_bp, url_prefix='/api/consumables')
    app.register_blueprint(triage_bp, url_prefix='/api/triage')
    
    from app.utils.cache import RateLimiter
    
    @app.before_request
    def before_request():
        if app.config.get('RATE_LIMIT_ENABLED', True):
            identifier = request.remote_addr or 'unknown'
            limit_exceeded, remaining, reset_time = RateLimiter.check_rate_limit(identifier)
            if limit_exceeded:
                return {
                    'message': '请求过于频繁，请稍后再试',
                    'remaining': remaining,
                    'reset_time': reset_time
                }, 429
    
    @app.after_request
    def after_request(response):
        if app.config.get('RATE_LIMIT_ENABLED', True):
            identifier = request.remote_addr or 'unknown'
            _, remaining, reset_time = RateLimiter.check_rate_limit(identifier)
            response.headers['X-RateLimit-Remaining'] = str(remaining)
            response.headers['X-RateLimit-Reset'] = str(reset_time)
        return response
    
    if app.config.get('SCHEDULER_ENABLED', True):
        with app.app_context():
            from app.utils.notifications import init_scheduler
            init_scheduler(app)
    
    if app.config.get('APPOINTMENT_ASYNC_ENABLED', True):
        with app.app_context():
            from app.utils.appointment_queue import init_queue_worker
            init_queue_worker(app)
    
    @app.route('/api/health')
    def health_check():
        return {'status': 'ok', 'message': 'Dental Clinic API is running'}
    
    return app
