from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import current_app, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, verify_jwt_in_request
from models import db, User, Notification


ROLE_PERMISSIONS = {
    'doctor': ['medical_record:read', 'medical_record:write', 'medical_record:own',
               'lab:request', 'lab:read', 'lab:review',
               'prescription:write', 'prescription:approve_1st',
               'hospitalization:read', 'hospitalization:write',
               'schedule:read', 'schedule:own',
               'notification:read', 'notification:write'],
    'lab_tech': ['lab:read', 'lab:submit', 'lab:own',
                 'medical_record:read',
                 'notification:read', 'notification:write',
                 'schedule:read', 'schedule:own'],
    'pharmacist': ['pharmacy:read', 'pharmacy:write', 'pharmacy:dispense',
                   'prescription:read', 'prescription:approve_2nd', 'prescription:dispense',
                   'notification:read', 'notification:write',
                   'schedule:read', 'schedule:own'],
    'nurse': ['hospitalization:read', 'hospitalization:write', 'hospitalization:care',
              'medical_record:read',
              'lab:read',
              'notification:read', 'notification:write',
              'schedule:read', 'schedule:own'],
    'manager': ['medical_record:read',
                'hospitalization:read',
                'lab:read',
                'pharmacy:read', 'pharmacy:write',
                'schedule:read', 'schedule:write', 'schedule:manage',
                'report:read', 'report:hospital',
                'notification:read', 'notification:write',
                'user:read', 'user:hospital'],
    'director': ['medical_record:read', 'medical_record:all',
                 'hospitalization:read', 'hospitalization:all',
                 'lab:read', 'lab:all',
                 'pharmacy:read', 'pharmacy:all', 'pharmacy:write',
                 'prescription:read', 'prescription:approve_1st', 'prescription:approve_2nd',
                 'schedule:read', 'schedule:write', 'schedule:all',
                 'report:read', 'report:all',
                 'notification:read', 'notification:write', 'notification:all',
                 'user:read', 'user:write', 'user:all',
                 'hospital:read', 'hospital:write']
}


def generate_tokens(user):
    access_token = create_access_token(
        identity=user.id,
        additional_claims={
            'role': user.role,
            'hospital_id': user.hospital_id,
            'username': user.username,
            'real_name': user.real_name
        },
        expires_delta=timedelta(hours=12)
    )
    refresh_token = create_refresh_token(
        identity=user.id,
        expires_delta=timedelta(days=7)
    )
    return access_token, refresh_token


def authenticate(username, password):
    user = User.query.filter_by(username=username, is_active=True).first()
    if not user or not user.check_password(password):
        return None
    return user


def get_current_user():
    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        return user
    except Exception:
        return None


def require_permissions(*permissions):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'code': 401, 'message': '未登录或登录已过期'}), 401

            user_perms = ROLE_PERMISSIONS.get(user.role, [])
            all_perms = set(user_perms)
            if user.role == 'director':
                for perms in ROLE_PERMISSIONS.values():
                    all_perms.update(perms)

            for perm in permissions:
                if perm not in all_perms:
                    return jsonify({'code': 403, 'message': '权限不足'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_roles(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'code': 401, 'message': '未登录或登录已过期'}), 401
            if user.role not in roles:
                return jsonify({'code': 403, 'message': '角色权限不足'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def create_notification(user_id, type, title, content, related_type=None, related_id=None, priority='normal'):
    try:
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            content=content,
            related_type=related_type,
            related_id=related_id,
            priority=priority
        )
        db.session.add(notification)
        db.session.commit()
        return notification
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'创建通知失败: {str(e)}')
        return None


def batch_create_notifications(user_ids, type, title, content, related_type=None, related_id=None, priority='normal'):
    notifications = []
    for uid in user_ids:
        notifications.append(Notification(
            user_id=uid,
            type=type,
            title=title,
            content=content,
            related_type=related_type,
            related_id=related_id,
            priority=priority
        ))
    try:
        db.session.bulk_save_objects(notifications)
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'批量创建通知失败: {str(e)}')
        return False
