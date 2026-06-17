from flask import Blueprint, request, jsonify
from services.auth_service import get_current_user, require_permissions
from services.report_service import ReportService
from models import User

report_bp = Blueprint('report', __name__, url_prefix='/api/report')


@report_bp.route('/board/summary', methods=['GET'])
@require_permissions('report:read')
def get_board_summary():
    user = get_current_user()
    hospital_id = request.args.get('hospital_id', type=int)
    if user.role == 'manager' and not hospital_id:
        hospital_id = user.hospital_id
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    result = ReportService.get_board_summary(hospital_id, start_date, end_date)
    return jsonify({'code': 200, 'data': result})


@report_bp.route('/board/trend', methods=['GET'])
@require_permissions('report:read')
def get_daily_trend():
    user = get_current_user()
    hospital_id = request.args.get('hospital_id', type=int)
    if user.role == 'manager' and not hospital_id:
        hospital_id = user.hospital_id
    days = request.args.get('days', 30, type=int)
    result = ReportService.get_daily_visits_trend(hospital_id, days)
    return jsonify({'code': 200, 'data': result})


@report_bp.route('/hospital-comparison', methods=['GET'])
@require_permissions('report:all')
def get_hospital_comparison():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    result = ReportService.get_hospital_comparison(start_date, end_date)
    return jsonify({'code': 200, 'data': result})


@report_bp.route('/department-breakdown', methods=['GET'])
@require_permissions('report:read')
def get_department_breakdown():
    user = get_current_user()
    hospital_id = request.args.get('hospital_id', type=int)
    if user.role == 'manager' and not hospital_id:
        hospital_id = user.hospital_id
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    result = ReportService.get_department_breakdown(hospital_id, start_date, end_date)
    return jsonify({'code': 200, 'data': result})


@report_bp.route('/doctor-ranking', methods=['GET'])
@require_permissions('report:read')
def get_doctor_ranking():
    user = get_current_user()
    hospital_id = request.args.get('hospital_id', type=int)
    if user.role == 'manager' and not hospital_id:
        hospital_id = user.hospital_id
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit = request.args.get('limit', 10, type=int)
    result = ReportService.get_doctor_ranking(hospital_id, start_date, end_date, limit)
    return jsonify({'code': 200, 'data': result})


@report_bp.route('/medicine-consumption', methods=['GET'])
@require_permissions('report:read')
def get_medicine_consumption():
    user = get_current_user()
    hospital_id = request.args.get('hospital_id', type=int)
    if user.role == 'manager' and not hospital_id:
        hospital_id = user.hospital_id
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit = request.args.get('limit', 20, type=int)
    result = ReportService.get_medicine_consumption(hospital_id, start_date, end_date, limit)
    return jsonify({'code': 200, 'data': result})


@report_bp.route('/monthly-comparison', methods=['GET'])
@require_permissions('report:read')
def get_monthly_comparison():
    user = get_current_user()
    hospital_id = request.args.get('hospital_id', type=int)
    if user.role == 'manager' and not hospital_id:
        hospital_id = user.hospital_id
    year = request.args.get('year', type=int)
    result = ReportService.get_monthly_comparison(hospital_id, year)
    return jsonify({'code': 200, 'data': result})


@report_bp.route('/quality-metrics', methods=['GET'])
@require_permissions('report:all')
def get_quality_metrics():
    user = get_current_user()
    hospital_id = request.args.get('hospital_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    result = ReportService.get_quality_metrics(hospital_id, start_date, end_date)
    return jsonify({'code': 200, 'data': result})


@report_bp.route('/users', methods=['GET'])
@require_permissions('user:read')
def get_users():
    user = get_current_user()
    role = request.args.get('role')
    hospital_id = request.args.get('hospital_id', type=int)
    is_active = request.args.get('is_active', type=lambda x: x.lower() == 'true' if x else None)
    keyword = request.args.get('keyword', '')

    query = User.query
    if role:
        query = query.filter_by(role=role)
    if is_active is not None:
        query = query.filter_by(is_active=is_active)
    if hospital_id:
        query = query.filter_by(hospital_id=hospital_id)
    elif user.role == 'manager':
        query = query.filter_by(hospital_id=user.hospital_id)
    elif user.role not in ('director',):
        query = query.filter_by(id=user.id)
    if keyword:
        like = f'%{keyword}%'
        query = query.filter(User.real_name.ilike(like) | User.username.ilike(like))

    users = query.order_by(User.hospital_id, User.role, User.real_name).all()
    return jsonify({'code': 200, 'data': [u.to_dict() for u in users]})
