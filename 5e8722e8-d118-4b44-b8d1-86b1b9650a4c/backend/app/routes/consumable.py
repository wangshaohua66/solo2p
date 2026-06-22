from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date, datetime
from app import db, redis_client
from app.models import Consumable, ConsumableRecord, PurchaseRequest, Clinic
import json

consumable_bp = Blueprint('consumable', __name__)


@consumable_bp.route('', methods=['GET'])
@jwt_required()
def get_consumables():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    category = request.args.get('category', '')
    clinic_id = request.args.get('clinic_id', type=int)
    search = request.args.get('search', '')
    low_stock_only = request.args.get('low_stock_only', 'false').lower() == 'true'

    cache_key = f'consumables:{page}:{per_page}:{category}:{clinic_id}:{search}:{low_stock_only}'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify(json.loads(cached))

    query = Consumable.query

    if category:
        query = query.filter_by(category=category)
    if clinic_id:
        query = query.filter_by(clinic_id=clinic_id)
    if search:
        query = query.filter(Consumable.name.like(f'%{search}%'))
    if low_stock_only:
        query = query.filter(Consumable.stock < Consumable.min_stock)

    pagination = query.order_by(Consumable.name.asc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    consumables = [c.to_dict() for c in pagination.items]

    result = {
        'consumables': consumables,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }

    redis_client.setex(cache_key, 120, json.dumps(result))

    return jsonify(result)


@consumable_bp.route('/<int:consumable_id>', methods=['GET'])
@jwt_required()
def get_consumable(consumable_id):
    consumable = Consumable.query.get(consumable_id)
    if not consumable:
        return jsonify({'message': '耗材不存在'}), 404

    return jsonify({'consumable': consumable.to_dict()})


@consumable_bp.route('', methods=['POST'])
@jwt_required()
def create_consumable():
    data = request.get_json()

    required_fields = ['name', 'category', 'clinic_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'{field}不能为空'}), 400

    clinic = Clinic.query.get(data['clinic_id'])
    if not clinic:
        return jsonify({'message': '门诊不存在'}), 404

    consumable = Consumable(
        name=data['name'],
        category=data['category'],
        spec=data.get('spec', ''),
        unit=data.get('unit', '个'),
        stock=data.get('stock', 0),
        min_stock=data.get('min_stock', 0),
        price=data.get('price', 0),
        clinic_id=data['clinic_id'],
        barcode=data.get('barcode', ''),
    )

    db.session.add(consumable)
    db.session.commit()

    cache_keys = redis_client.keys('consumables:*')
    if cache_keys:
        redis_client.delete(*cache_keys)

    return jsonify({
        'message': '耗材创建成功',
        'consumable': consumable.to_dict(),
    }), 201


@consumable_bp.route('/<int:consumable_id>', methods=['PUT'])
@jwt_required()
def update_consumable(consumable_id):
    consumable = Consumable.query.get(consumable_id)
    if not consumable:
        return jsonify({'message': '耗材不存在'}), 404

    data = request.get_json()

    consumable.name = data.get('name', consumable.name)
    consumable.category = data.get('category', consumable.category)
    consumable.spec = data.get('spec', consumable.spec)
    consumable.unit = data.get('unit', consumable.unit)
    consumable.min_stock = data.get('min_stock', consumable.min_stock)
    consumable.price = data.get('price', consumable.price)
    consumable.barcode = data.get('barcode', consumable.barcode)

    db.session.commit()

    cache_keys = redis_client.keys('consumables:*')
    if cache_keys:
        redis_client.delete(*cache_keys)

    return jsonify({
        'message': '耗材更新成功',
        'consumable': consumable.to_dict(),
    })


@consumable_bp.route('/stock-in', methods=['POST'])
@jwt_required()
def stock_in():
    data = request.get_json()

    required_fields = ['consumable_id', 'quantity', 'operator_name']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'{field}不能为空'}), 400

    consumable = Consumable.query.get(data['consumable_id'])
    if not consumable:
        return jsonify({'message': '耗材不存在'}), 404

    quantity = data['quantity']
    if quantity <= 0:
        return jsonify({'message': '数量必须大于0'}), 400

    record = ConsumableRecord(
        consumable_id=data['consumable_id'],
        type='in',
        quantity=quantity,
        operator_name=data['operator_name'],
        remark=data.get('remark', ''),
    )

    consumable.stock += quantity

    db.session.add(record)
    db.session.commit()

    cache_keys = redis_client.keys('consumables:*')
    if cache_keys:
        redis_client.delete(*cache_keys)

    return jsonify({
        'message': '入库成功',
        'record': record.to_dict(),
        'current_stock': consumable.stock,
    })


@consumable_bp.route('/stock-out', methods=['POST'])
@jwt_required()
def stock_out():
    data = request.get_json()

    required_fields = ['consumable_id', 'quantity', 'operator_name']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'{field}不能为空'}), 400

    consumable = Consumable.query.get(data['consumable_id'])
    if not consumable:
        return jsonify({'message': '耗材不存在'}), 404

    quantity = data['quantity']
    if quantity <= 0:
        return jsonify({'message': '数量必须大于0'}), 400

    if consumable.stock < quantity:
        return jsonify({'message': '库存不足'}), 400

    record = ConsumableRecord(
        consumable_id=data['consumable_id'],
        type='out',
        quantity=quantity,
        operator_name=data['operator_name'],
        related_patient_id=data.get('patient_id'),
        remark=data.get('remark', ''),
    )

    consumable.stock -= quantity

    db.session.add(record)
    db.session.commit()

    if consumable.stock < consumable.min_stock:
        existing_request = PurchaseRequest.query.filter_by(
            consumable_id=consumable.id,
            status='pending',
        ).first()

        if not existing_request:
            purchase_request = PurchaseRequest(
                consumable_id=consumable.id,
                quantity=consumable.min_stock * 2,
            )
            db.session.add(purchase_request)
            db.session.commit()

    cache_keys = redis_client.keys('consumables:*')
    if cache_keys:
        redis_client.delete(*cache_keys)

    return jsonify({
        'message': '出库成功',
        'record': record.to_dict(),
        'current_stock': consumable.stock,
        'low_stock': consumable.stock < consumable.min_stock,
    })


@consumable_bp.route('/records', methods=['GET'])
@jwt_required()
def get_records():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    type = request.args.get('type', '')
    consumable_id = request.args.get('consumable_id', type=int)

    query = ConsumableRecord.query

    if type:
        query = query.filter_by(type=type)
    if consumable_id:
        query = query.filter_by(consumable_id=consumable_id)

    pagination = query.order_by(ConsumableRecord.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    records = [r.to_dict() for r in pagination.items]

    return jsonify({
        'records': records,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
    })


@consumable_bp.route('/low-stock', methods=['GET'])
@jwt_required()
def get_low_stock():
    clinic_id = request.args.get('clinic_id', type=int)

    query = Consumable.query.filter(Consumable.stock < Consumable.min_stock)

    if clinic_id:
        query = query.filter_by(clinic_id=clinic_id)

    consumables = query.order_by(Consumable.stock.asc()).all()

    return jsonify({'consumables': [c.to_dict() for c in consumables]})


@consumable_bp.route('/purchase-requests', methods=['GET'])
@jwt_required()
def get_purchase_requests():
    status = request.args.get('status', '')
    query = PurchaseRequest.query

    if status:
        query = query.filter_by(status=status)

    requests = query.order_by(PurchaseRequest.created_at.desc()).all()

    return jsonify({'requests': [r.to_dict() for r in requests]})


@consumable_bp.route('/purchase-requests/<int:request_id>/approve', methods=['POST'])
@jwt_required()
def approve_purchase_request(request_id):
    purchase_request = PurchaseRequest.query.get(request_id)
    if not purchase_request:
        return jsonify({'message': '采购申请不存在'}), 404

    purchase_request.status = 'approved'
    db.session.commit()

    return jsonify({'message': '采购申请已批准'})


@consumable_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    cache_key = 'consumables:categories'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify({'categories': json.loads(cached)})

    categories = db.session.query(Consumable.category).distinct().all()
    category_list = [c[0] for c in categories]

    redis_client.setex(cache_key, 3600, json.dumps(category_list))

    return jsonify({'categories': category_list})
