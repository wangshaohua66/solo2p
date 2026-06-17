from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_refresh_token
from models import db, User, Hospital, Notification
from services.auth_service import authenticate, generate_tokens, get_current_user, require_permissions, batch_create_notifications

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'code': 400, 'message': '用户名和密码不能为空'}), 400

    user = authenticate(username, password)
    if not user:
        return jsonify({'code': 401, 'message': '用户名或密码错误'}), 401

    access_token, refresh_token = generate_tokens(user)
    return jsonify({
        'code': 200,
        'message': '登录成功',
        'data': {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict()
        }
    })


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return jsonify({'code': 401, 'message': '用户不存在或已禁用'}), 401

    access_token, _ = generate_tokens(user)
    return jsonify({
        'code': 200,
        'data': {'access_token': access_token}
    })


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify({'code': 200, 'message': '退出成功'})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    user = get_current_user()
    if not user:
        return jsonify({'code': 401, 'message': '未登录'}), 401
    return jsonify({
        'code': 200,
        'data': user.to_dict()
    })


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    user = get_current_user()
    if not user:
        return jsonify({'code': 401, 'message': '未登录'}), 401

    data = request.get_json()
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')

    if not user.check_password(old_password):
        return jsonify({'code': 400, 'message': '原密码错误'}), 400
    if len(new_password) < 6:
        return jsonify({'code': 400, 'message': '新密码至少6位'}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({'code': 200, 'message': '密码修改成功'})


@auth_bp.route('/hospitals', methods=['GET'])
@jwt_required()
def get_hospitals():
    hospitals = Hospital.query.filter_by(is_active=True).order_by(Hospital.type.desc(), Hospital.name).all()
    return jsonify({
        'code': 200,
        'data': [h.to_dict() for h in hospitals]
    })


@auth_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    user = get_current_user()
    if not user:
        return jsonify({'code': 401, 'message': '未登录'}), 401

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    is_read = request.args.get('is_read', type=lambda x: x.lower() == 'true')
    type = request.args.get('type')

    query = Notification.query.filter_by(user_id=user.id)
    if is_read is not None:
        query = query.filter_by(is_read=is_read)
    if type:
        query = query.filter_by(type=type)

    total = query.count()
    notifications = query.order_by(Notification.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'code': 200,
        'data': {
            'total': total,
            'unread_count': Notification.query.filter_by(user_id=user.id, is_read=False).count(),
            'items': [n.to_dict() for n in notifications]
        }
    })


@auth_bp.route('/notifications/<int:id>/read', methods=['POST'])
@jwt_required()
def mark_notification_read(id):
    user = get_current_user()
    if not user:
        return jsonify({'code': 401, 'message': '未登录'}), 401

    n = Notification.query.get(id)
    if not n or n.user_id != user.id:
        return jsonify({'code': 404, 'message': '通知不存在'}), 404

    n.is_read = True
    from datetime import datetime
    n.read_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'code': 200, 'message': '已标记已读'})


@auth_bp.route('/notifications/read-all', methods=['POST'])
@jwt_required()
def mark_all_notifications_read():
    user = get_current_user()
    if not user:
        return jsonify({'code': 401, 'message': '未登录'}), 401

    from datetime import datetime
    Notification.query.filter_by(user_id=user.id, is_read=False).update(
        {Notification.is_read: True, Notification.read_at: datetime.utcnow()},
        synchronize_session=False
    )
    db.session.commit()
    return jsonify({'code': 200, 'message': '全部已读'})
