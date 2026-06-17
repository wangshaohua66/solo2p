from flask import Blueprint, request, jsonify
from services.auth_service import get_current_user, require_permissions, ROLE_PERMISSIONS
from services.pharmacy_service import PharmacyService

pharmacy_bp = Blueprint('pharmacy', __name__, url_prefix='/api/pharmacy')


@pharmacy_bp.route('/medicines', methods=['GET'])
@require_permissions('pharmacy:read')
def get_medicines():
    user = get_current_user()
    requested_hospital_id = request.args.get('hospital_id', type=int)
    if user.role in ('director',):
        hospital_id = requested_hospital_id or user.hospital_id
    else:
        hospital_id = user.hospital_id
    params = {
        'hospital_id': hospital_id,
        'category': request.args.get('category'),
        'is_controlled': request.args.get('is_controlled', type=lambda x: x.lower() == 'true' if x else None),
        'is_low_stock': request.args.get('is_low_stock', 'false').lower() == 'true',
        'keyword': request.args.get('keyword', ''),
        'is_active': request.args.get('is_active', 'true').lower() == 'true' if request.args.get('is_active') else None,
        'page': request.args.get('page', 1, type=int),
        'per_page': request.args.get('per_page', 50, type=int)
    }
    result = PharmacyService.get_medicines(**params)
    return jsonify({'code': 200, 'data': result})


@pharmacy_bp.route('/medicines/low-stock', methods=['GET'])
@require_permissions('pharmacy:read')
def get_low_stock():
    user = get_current_user()
    requested_hospital_id = request.args.get('hospital_id', type=int)
    if user.role == 'director':
        hospital_id = requested_hospital_id or user.hospital_id
    else:
        hospital_id = user.hospital_id
    meds = PharmacyService.get_low_stock_medicines(hospital_id)
    return jsonify({'code': 200, 'data': [m.to_dict() for m in meds]})


@pharmacy_bp.route('/medicines', methods=['POST'])
@require_permissions('pharmacy:write')
def create_medicine():
    data = request.get_json()
    user = get_current_user()
    if not data.get('name'):
        return jsonify({'code': 400, 'message': '请填写药品名称'}), 400
    data['hospital_id'] = user.hospital_id
    med, err = PharmacyService.create_medicine(data)
    if err:
        return jsonify({'code': 400, 'message': err}), 400
    return jsonify({'code': 200, 'message': '创建成功', 'data': med.to_dict()})


@pharmacy_bp.route('/medicines/<int:id>/stock', methods=['POST'])
@require_permissions('pharmacy:write')
def update_stock(id):
    data = request.get_json()
    user = get_current_user()
    quantity_change = data.get('quantity_change')
    change_type = data.get('change_type')
    if quantity_change is None or not change_type:
        return jsonify({'code': 400, 'message': '请填写变动数量和类型'}), 400
    log, err = PharmacyService.update_stock(
        medicine_id=id,
        quantity_change=quantity_change,
        change_type=change_type,
        operator_id=user.id,
        hospital_id=user.hospital_id,
        related_type=data.get('related_type'),
        related_id=data.get('related_id'),
        remark=data.get('remark')
    )
    if err:
        return jsonify({'code': 400, 'message': err}), 400
    return jsonify({'code': 200, 'message': '库存已更新', 'data': log.to_dict()})


@pharmacy_bp.route('/prescriptions', methods=['GET'])
@require_permissions('prescription:read')
def get_prescriptions():
    user = get_current_user()
    requested_hospital_id = request.args.get('hospital_id', type=int)
    if user.role == 'director':
        hospital_id = requested_hospital_id or user.hospital_id
    else:
        hospital_id = user.hospital_id
    params = {
        'hospital_id': hospital_id,
        'status': request.args.get('status'),
        'has_controlled': request.args.get('has_controlled', type=lambda x: x.lower() == 'true' if x else None),
        'prescribed_by_id': request.args.get('prescribed_by_id', type=int),
        'medical_record_id': request.args.get('medical_record_id', type=int),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'page': request.args.get('page', 1, type=int),
        'per_page': request.args.get('per_page', 20, type=int)
    }
    result = PharmacyService.search_prescriptions(**params)
    return jsonify({'code': 200, 'data': result})


@pharmacy_bp.route('/prescriptions', methods=['POST'])
@require_permissions('prescription:write')
def create_prescription():
    data = request.get_json()
    user = get_current_user()
    if not data.get('medical_record_id') or not data.get('items'):
        return jsonify({'code': 400, 'message': '请指定病历和药品明细'}), 400
    if not data.get('hospital_id'):
        data['hospital_id'] = user.hospital_id
    prescription = PharmacyService.create_prescription(data, prescribed_by_id=user.id)
    return jsonify({'code': 200, 'message': '处方已创建', 'data': prescription.to_dict(include_items=True)})


@pharmacy_bp.route('/prescriptions/<int:id>/approve', methods=['POST'])
def approve_prescription(id):
    user = get_current_user()
    if not user:
        return jsonify({'code': 401, 'message': '未登录或登录已过期'}), 401

    data = request.get_json()
    level = data.get('level', 1)

    user_perms = set(ROLE_PERMISSIONS.get(user.role, []))
    if user.role == 'director':
        for perms in ROLE_PERMISSIONS.values():
            user_perms.update(perms)

    required_perm = 'prescription:approve_1st' if level == 1 else 'prescription:approve_2nd'
    if required_perm not in user_perms:
        return jsonify({'code': 403, 'message': f'无{("一审" if level == 1 else "二审")}审核权限'}), 403

    pres, err = PharmacyService.approve_prescription(id, approver_id=user.id, approval_level=level)
    if err:
        return jsonify({'code': 400, 'message': err}), 400
    return jsonify({'code': 200, 'message': '审核完成', 'data': pres.to_dict(include_items=True)})


@pharmacy_bp.route('/prescriptions/<int:id>/dispense', methods=['POST'])
@require_permissions('prescription:dispense')
def dispense_prescription(id):
    user = get_current_user()
    pres, err = PharmacyService.dispense_prescription(id, dispenser_id=user.id, hospital_id=user.hospital_id)
    if err:
        return jsonify({'code': 400, 'message': err}), 400
    return jsonify({'code': 200, 'message': '发药完成', 'data': pres.to_dict(include_items=True)})


@pharmacy_bp.route('/stock-logs', methods=['GET'])
@require_permissions('pharmacy:read')
def get_stock_logs():
    user = get_current_user()
    requested_hospital_id = request.args.get('hospital_id', type=int)
    if user.role == 'director':
        hospital_id = requested_hospital_id or user.hospital_id
    else:
        hospital_id = user.hospital_id
    params = {
        'medicine_id': request.args.get('medicine_id', type=int),
        'hospital_id': hospital_id,
        'change_type': request.args.get('change_type'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'page': request.args.get('page', 1, type=int),
        'per_page': request.args.get('per_page', 50, type=int)
    }
    result = PharmacyService.get_stock_logs(**params)
    return jsonify({'code': 200, 'data': result})
