from flask import Blueprint, request, jsonify
from services.auth_service import get_current_user, require_permissions
from services.hospitalization_service import HospitalizationService

hospitalization_bp = Blueprint('hospitalization', __name__, url_prefix='/api/hospitalization')


@hospitalization_bp.route('/cages/grid', methods=['GET'])
@require_permissions('hospitalization:read')
def get_cage_grid():
    hospital_id = request.args.get('hospital_id', type=int)
    user = get_current_user()
    if not hospital_id:
        hospital_id = user.hospital_id
    result = HospitalizationService.get_cage_grid(hospital_id)
    return jsonify({'code': 200, 'data': result})


@hospitalization_bp.route('/cages', methods=['GET'])
@require_permissions('hospitalization:read')
def get_cages():
    hospital_id = request.args.get('hospital_id', type=int)
    user = get_current_user()
    if not hospital_id:
        hospital_id = user.hospital_id
    include_h = request.args.get('with_patient', 'false').lower() == 'true'
    cages = HospitalizationService.get_cages_by_hospital(hospital_id, include_hospitalization=include_h)
    return jsonify({'code': 200, 'data': cages})


@hospitalization_bp.route('/cages', methods=['POST'])
@require_permissions('hospitalization:write')
def create_cage():
    data = request.get_json()
    user = get_current_user()
    if not data.get('hospital_id'):
        data['hospital_id'] = user.hospital_id
    cage, err = HospitalizationService.create_cage(data)
    if err:
        return jsonify({'code': 400, 'message': err}), 400
    return jsonify({'code': 200, 'message': '创建成功', 'data': cage.to_dict()})


@hospitalization_bp.route('/cages/<int:cage_id>/status', methods=['PUT'])
@require_permissions('hospitalization:write')
def update_cage_status(cage_id):
    data = request.get_json()
    cage = HospitalizationService.update_cage_status(cage_id, data.get('status'), data.get('remark'))
    if not cage:
        return jsonify({'code': 404, 'message': '笼位不存在'}), 404
    return jsonify({'code': 200, 'message': '更新成功', 'data': cage.to_dict()})


@hospitalization_bp.route('/cages/<int:cage_id>/check-conflict', methods=['GET'])
@require_permissions('hospitalization:read')
def check_cage_conflict(cage_id):
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    exclude_id = request.args.get('exclude_id', type=int)
    if not start_date or not end_date:
        return jsonify({'code': 400, 'message': '请提供起止日期'}), 400
    conflict, h = HospitalizationService.check_cage_conflict(cage_id, start_date, end_date, exclude_id)
    return jsonify({
        'code': 200,
        'data': {
            'has_conflict': conflict,
            'conflict_with': h.to_dict() if h else None
        }
    })


@hospitalization_bp.route('/hospitalizations', methods=['GET'])
@require_permissions('hospitalization:read')
def get_hospitalizations():
    params = {
        'hospital_id': request.args.get('hospital_id', type=int),
        'status': request.args.get('status'),
        'page': request.args.get('page', 1, type=int),
        'per_page': request.args.get('per_page', 50, type=int)
    }
    user = get_current_user()
    if not params['hospital_id']:
        params['hospital_id'] = user.hospital_id
    result = HospitalizationService.get_active_hospitalizations(**params)
    return jsonify({'code': 200, 'data': result})


@hospitalization_bp.route('/hospitalizations', methods=['POST'])
@require_permissions('hospitalization:write')
def create_hospitalization():
    data = request.get_json()
    user = get_current_user()
    if not data.get('hospital_id'):
        data['hospital_id'] = user.hospital_id
    hospitalization, err = HospitalizationService.create_hospitalization(data, current_user_id=user.id)
    if err:
        return jsonify({'code': 400, 'message': err}), 400
    return jsonify({'code': 200, 'message': '创建成功', 'data': hospitalization.to_dict()})


@hospitalization_bp.route('/hospitalizations/emergency', methods=['POST'])
@require_permissions('hospitalization:write')
def emergency_admission():
    data = request.get_json()
    user = get_current_user()
    hospital_id = data.get('hospital_id') or user.hospital_id
    pet_id = data.get('pet_id')
    medical_record_id = data.get('medical_record_id')
    if not pet_id:
        return jsonify({'code': 400, 'message': '请指定宠物'}), 400
    hospitalization, err = HospitalizationService.assign_emergency_cage(hospital_id, pet_id, medical_record_id)
    if err:
        return jsonify({'code': 400, 'message': err}), 400
    return jsonify({'code': 200, 'message': '急诊分配成功', 'data': hospitalization.to_dict()})


@hospitalization_bp.route('/hospitalizations/<int:id>', methods=['PUT'])
@require_permissions('hospitalization:write')
def update_hospitalization(id):
    data = request.get_json()
    hospitalization, err = HospitalizationService.update_hospitalization(id, data)
    if err:
        return jsonify({'code': 400, 'message': err}), 400
    if not hospitalization:
        return jsonify({'code': 404, 'message': '记录不存在'}), 404
    return jsonify({'code': 200, 'message': '更新成功', 'data': hospitalization.to_dict()})


@hospitalization_bp.route('/hospitalizations/upcoming-discharges', methods=['GET'])
@require_permissions('hospitalization:read')
def upcoming_discharges():
    hospital_id = request.args.get('hospital_id', type=int)
    days = request.args.get('days', 3, type=int)
    user = get_current_user()
    if not hospital_id:
        hospital_id = user.hospital_id
    result = HospitalizationService.get_upcoming_discharges(hospital_id, days)
    return jsonify({'code': 200, 'data': result})


@hospitalization_bp.route('/hospitalizations/discharge-reminder/trigger', methods=['POST'])
@require_permissions('hospitalization:write')
def trigger_discharge_reminder():
    days = request.args.get('days', 3, type=int)
    count = HospitalizationService.check_and_notify_upcoming_discharges(days=days)
    return jsonify({'code': 200, 'message': f'已检查并发送{count}条到期提醒', 'data': {'notified_count': count}})
