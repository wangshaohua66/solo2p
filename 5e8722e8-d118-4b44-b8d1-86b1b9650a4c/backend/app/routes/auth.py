from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from app import db, redis_client
from app.models import User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'message': '用户名和密码不能为空'}), 400

    user = User.query.filter_by(username=username).first()

    if not user:
        return jsonify({'message': '用户不存在'}), 401

    if not user.check_password(password):
        return jsonify({'message': '密码错误'}), 401

    if user.status != 'active':
        return jsonify({'message': '账号已被禁用'}), 403

    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)

    cache_key = f'user:{user.id}'
    redis_client.setex(cache_key, 3600, str(user.to_dict()))

    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
    })


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    name = data.get('name')
    role = data.get('role', 'staff')

    if not username or not password:
        return jsonify({'message': '用户名和密码不能为空'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'message': '用户名已存在'}), 400

    user = User(username=username, name=name, role=role)
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return jsonify({
        'message': '注册成功',
        'user': user.to_dict(),
    }), 201


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user_id = get_jwt_identity()
    access_token = create_access_token(identity=current_user_id)
    return jsonify({'access_token': access_token})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    current_user_id = get_jwt_identity()

    cache_key = f'user:{current_user_id}'
    cached_user = redis_client.get(cache_key)

    if cached_user:
        return jsonify({'user': cached_user})

    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'message': '用户不存在'}), 404

    redis_client.setex(cache_key, 3600, str(user.to_dict()))

    return jsonify({'user': user.to_dict()})


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    current_user_id = get_jwt_identity()
    cache_key = f'user:{current_user_id}'
    redis_client.delete(cache_key)
    return jsonify({'message': '退出成功'})
