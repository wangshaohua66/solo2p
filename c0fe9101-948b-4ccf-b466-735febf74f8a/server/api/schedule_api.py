from flask import Blueprint, request, jsonify
from services.auth_service import get_current_user, require_permissions
from services.schedule_service import ScheduleService

schedule_bp = Blueprint('schedule', __name__, url_prefix='/api/schedule')


@schedule_bp.route('/', methods=['GET'])
@require_permissions('schedule:read')
def get_schedules():
    user = get_current_user()
    params = {
        'hospital_id': request.args.get('hospital_id', type=int) or user.hospital_id,
        'user_id': request.args.get('user_id', type=int),
        'department': request.args.get('department'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'shift_type': request.args.get('shift_type'),
        'include_emergency_only': request.args.get('emergency_only', 'false').lower() == 'true'
    }
    schedules = ScheduleService.get_schedules(**params)
    return jsonify({'code': 200, 'data': schedules})


@schedule_bp.route('/week-matrix', methods=['GET'])
@require_permissions('schedule:read')
def get_week_matrix():
    user = get_current_user()
    hospital_id = request.args.get('hospital_id', type=int) or user.hospital_id
    start_date = request.args.get('start_date')
    department = request.args.get('department')
    result = ScheduleService.get_week_schedule_matrix(hospital_id, start_date, department)
    return jsonify({'code': 200, 'data': result})


@schedule_bp.route('/generate', methods=['POST'])
@require_permissions('schedule:manage')
def generate_schedule():
    user = get_current_user()
    data = request.get_json() or {}
    hospital_id = data.get('hospital_id') or user.hospital_id
    start_date = data.get('start_date')
    result = ScheduleService.generate_auto_schedule(hospital_id, start_date)
    return jsonify({'code': 200, 'message': f'自动生成完成，新增{result["created"]}条排班', 'data': result})


@schedule_bp.route('/publish', methods=['POST'])
@require_permissions('schedule:manage')
def publish_schedule():
    user = get_current_user()
    data = request.get_json() or {}
    hospital_id = data.get('hospital_id') or user.hospital_id
    start_date = data.get('start_date')
    count = ScheduleService.publish_week_schedule(hospital_id, start_date)
    return jsonify({'code': 200, 'message': f'已发布{count}条排班'})


@schedule_bp.route('/', methods=['POST'])
@require_permissions('schedule:write', 'schedule:manage')
def create_or_update():
    data = request.get_json()
    user = get_current_user()
    if not data.get('user_id') or not data.get('shift_date'):
        return jsonify({'code': 400, 'message': '请指定人员和日期'}), 400
    if not data.get('hospital_id'):
        data['hospital_id'] = user.hospital_id
    schedule = ScheduleService.create_or_update_schedule(data)
    return jsonify({'code': 200, 'message': '排班已更新', 'data': schedule.to_dict()})


@schedule_bp.route('/<int:id>/swap', methods=['POST'])
@require_permissions('schedule:write', 'schedule:manage')
def swap_schedule(id):
    data = request.get_json()
    user = get_current_user()
    swap_with = data.get('swap_with_id')
    if not swap_with:
        return jsonify({'code': 400, 'message': '请指定换班人员'}), 400
    schedule, err = ScheduleService.swap_schedule(id, swap_with, requester_id=user.id)
    if err:
        return jsonify({'code': 400, 'message': err}), 400
    return jsonify({'code': 200, 'message': '换班成功', 'data': schedule.to_dict()})


@schedule_bp.route('/<int:id>', methods=['DELETE'])
@require_permissions('schedule:manage')
def delete_schedule(id):
    ok = ScheduleService.delete_schedule(id)
    if not ok:
        return jsonify({'code': 404, 'message': '排班不存在'}), 404
    return jsonify({'code': 200, 'message': '已删除'})


@schedule_bp.route('/emergency-on-call', methods=['GET'])
@require_permissions('schedule:read')
def get_emergency_on_call():
    hospital_id = request.args.get('hospital_id', type=int)
    if not hospital_id:
        user = get_current_user()
        hospital_id = user.hospital_id
    result = ScheduleService.find_emergency_on_call(hospital_id)
    return jsonify({'code': 200, 'data': result})


@schedule_bp.route('/nearest-emergency', methods=['GET'])
@require_permissions('schedule:read')
def find_nearest_emergency():
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    if lat is None or lng is None:
        return jsonify({'code': 400, 'message': '请提供坐标'}), 400
    radius = request.args.get('radius', 20, type=float)
    result = ScheduleService.find_nearest_emergency_doctor(lat, lng, radius)
    return jsonify({'code': 200, 'data': result})
