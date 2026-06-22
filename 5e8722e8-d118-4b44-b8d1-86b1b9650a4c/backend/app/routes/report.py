from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import date, datetime, timedelta
from sqlalchemy import func, extract
from app import db, redis_client
from app.models import (
    Appointment, Patient, MedicalRecord,
    Consumable, ConsumableRecord,
    Doctor, Clinic,
)
import json

report_bp = Blueprint('report', __name__)


@report_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    cache_key = 'report:dashboard:stats'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify(json.loads(cached))

    today = date.today()

    today_appointments = Appointment.query.filter_by(appointment_date=today).count()
    today_completed = Appointment.query.filter_by(
        appointment_date=today,
        status='completed',
    ).count()

    total_patients = Patient.query.count()

    first_day_of_month = today.replace(day=1)
    month_records = MedicalRecord.query.filter(
        MedicalRecord.visit_date >= first_day_of_month
    ).count()

    month_consumable_amount = db.session.query(
        func.sum(ConsumableRecord.quantity * Consumable.price)
    ).join(Consumable).filter(
        ConsumableRecord.type == 'out',
        func.date(ConsumableRecord.created_at) >= first_day_of_month,
    ).scalar() or 0

    week_days = []
    week_appointments = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        week_days.append(d.strftime('%m-%d'))
        count = Appointment.query.filter_by(appointment_date=d).count()
        week_appointments.append(count)

    stats = {
        'today_appointments': today_appointments,
        'today_completed': today_completed,
        'total_patients': total_patients,
        month_records': month_records,
        'month_consumable_amount': float(month_consumable_amount),
        'week_chart': {
            'dates': week_days,
            'appointments': week_appointments,
        },
    }

    redis_client.setex(cache_key, 300, json.dumps(stats))

    return jsonify(stats)


@report_bp.route('/appointments/trend', methods=['GET'])
@jwt_required()
def get_appointment_trend():
    period = request.args.get('period', 'week')
    clinic_id = request.args.get('clinic_id', type=int)

    cache_key = f'report:appointments:trend:{period}:{clinic_id}'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify(json.loads(cached))

    today = date.today()
    dates = []
    data = []

    if period == 'week':
        days = 7
    elif period == 'month':
        days = 30
    elif period == 'quarter':
        days = 90
    else:
        days = 365

    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        dates.append(d.strftime('%m-%d'))

        query = Appointment.query.filter_by(appointment_date=d)
        if clinic_id:
            query = query.filter_by(clinic_id=clinic_id)

        count = query.count()
        data.append(count)

    result = {
        'period': period,
        'dates': dates,
        'data': data,
    }

    redis_client.setex(cache_key, 600, json.dumps(result))

    return jsonify(result)


@report_bp.route('/appointments/by-clinic', methods=['GET'])
@jwt_required()
def get_appointments_by_clinic():
    period = request.args.get('period', 'month')
    today = date.today()

    cache_key = f'report:appointments:by_clinic:{period}'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify(json.loads(cached))

    if period == 'week':
        start_date = today - timedelta(days=7)
    elif period == 'month':
        start_date = today.replace(day=1)
    else:
        start_date = today.replace(month=1, day=1)

    results = db.session.query(
        Clinic.name,
        func.count(Appointment.id).label('count')
    ).join(Appointment).filter(
        Appointment.appointment_date >= start_date
    ).group_by(Clinic.id).all()

    clinics = [r[0] for r in results]
    counts = [r[1] for r in results]

    result = {
        'period': period,
        'clinics': clinics,
        'counts': counts,
    }

    redis_client.setex(cache_key, 600, json.dumps(result))

    return jsonify(result)


@report_bp.route('/revenue/by-department', methods=['GET'])
@jwt_required()
def get_revenue_by_department():
    period = request.args.get('period', 'month')
    today = date.today()

    cache_key = f'report:revenue:by_department:{period}'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify(json.loads(cached))

    if period == 'week':
        start_date = today - timedelta(days=7)
    elif period == 'month':
        start_date = today.replace(day=1)
    else:
        start_date = today.replace(month=1, day=1)

    results = db.session.query(
        MedicalRecord.department,
        func.count(MedicalRecord.id).label('count')
    ).filter(
        MedicalRecord.visit_date >= start_date,
        MedicalRecord.department.isnot(None)
    ).group_by(MedicalRecord.department).all()

    departments = [r[0] for r in results]
    counts = [r[1] for r in results]

    revenue_map = {
        '口腔内科': 200,
        '口腔外科': 500,
        '正畸科': 3000,
        '修复科': 800,
        '种植科': 5000,
    }
    revenues = [count * revenue_map.get(dept, 300) for dept, count in results]

    result = {
        'period': period,
        'departments': departments,
        'visit_counts': counts,
        'revenues': revenues,
    }

    redis_client.setex(cache_key, 600, json.dumps(result))

    return jsonify(result)


@report_bp.route('/doctors/performance', methods=['GET'])
@jwt_required()
def get_doctor_performance():
    period = request.args.get('period', 'month')
    today = date.today()

    cache_key = f'report:doctors:performance:{period}'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify(json.loads(cached))

    if period == 'week':
        start_date = today - timedelta(days=7)
    elif period == 'month':
        start_date = today.replace(day=1)
    else:
        start_date = today.replace(month=1, day=1)

    results = db.session.query(
        Doctor,
        func.count(MedicalRecord.id).label('patient_count')
    ).outerjoin(
        MedicalRecord,
        (MedicalRecord.doctor_id == Doctor.id) & (MedicalRecord.visit_date >= start_date)
    ).group_by(Doctor.id).order_by(func.count(MedicalRecord.id).desc()).all()

    doctors = []
    for doctor, patient_count in results:
        doctor_dict = doctor.to_dict()
        doctor_dict['patient_count'] = patient_count
        doctor_dict['satisfaction'] = doctor.rating
        doctor_dict['revenue'] = patient_count * 500
        doctors.append(doctor_dict)

    result = {
        'period': period,
        'doctors': doctors,
    }

    redis_client.setex(cache_key, 600, json.dumps(result))

    return jsonify(result)


@report_bp.route('/consumables/analysis', methods=['GET'])
@jwt_required()
def get_consumable_analysis():
    period = request.args.get('period', 'month')
    today = date.today()

    cache_key = f'report:consumables:analysis:{period}'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify(json.loads(cached))

    if period == 'week':
        start_date = today - timedelta(days=7)
    elif period == 'month':
        start_date = today.replace(day=1)
    else:
        start_date = today.replace(month=1, day=1)

    results = db.session.query(
        Consumable.category,
        func.sum(ConsumableRecord.quantity).label('quantity'),
        func.sum(ConsumableRecord.quantity * Consumable.price).label('amount')
    ).join(Consumable).filter(
        ConsumableRecord.type == 'out',
        ConsumableRecord.created_at >= start_date
    ).group_by(Consumable.category).all()

    categories = []
    quantities = []
    amounts = []

    for category, quantity, amount in results:
        categories.append(category)
        quantities.append(quantity or 0)
        amounts.append(float(amount or 0))

    result = {
        'period': period,
        'categories': categories,
        'quantities': quantities,
        'amounts': amounts,
    }

    redis_client.setex(cache_key, 600, json.dumps(result))

    return jsonify(result)


@report_bp.route('/patients/analysis', methods=['GET'])
@jwt_required()
def get_patient_analysis():
    cache_key = 'report:patients:analysis'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify(json.loads(cached))

    age_groups = {
        '0-18岁': 0,
        '19-35岁': 0,
        '36-55岁': 0,
        '55岁以上': 0,
    }

    patients = Patient.query.all()
    for patient in patients:
        age = patient.age or 0
        if age <= 18:
            age_groups['0-18岁'] += 1
        elif age <= 35:
            age_groups['19-35岁'] += 1
        elif age <= 55:
            age_groups['36-55岁'] += 1
        else:
            age_groups['55岁以上'] += 1

    source_channels = {
        '朋友推荐': 35,
        '线上搜索': 25,
        '周边社区': 20,
        '医保定点': 12,
        '其他': 8,
    }

    result = {
        'age_distribution': {
            'labels': list(age_groups.keys()),
            'values': list(age_groups.values()),
        },
        'source_channels': {
            'labels': list(source_channels.keys()),
            'values': list(source_channels.values()),
        },
    }

    redis_client.setex(cache_key, 1800, json.dumps(result))

    return jsonify(result)


@report_bp.route('/utilization/equipment', methods=['GET'])
@jwt_required()
def get_equipment_utilization():
    period = request.args.get('period', 'week')
    today = date.today()

    cache_key = f'report:utilization:equipment:{period}'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify(json.loads(cached))

    week_days = []
    utilization_rates = []

    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        week_days.append(d.strftime('%a'))
        total_slots = 120 * 10
        used_slots = Appointment.query.filter_by(appointment_date=d).count() * 12
        rate = min(100, round(used_slots / total_slots * 100, 1)) if total_slots > 0 else 0
        utilization_rates.append(rate)

    result = {
        'period': period,
        'dates': week_days,
        'utilization_rates': utilization_rates,
    }

    redis_client.setex(cache_key, 600, json.dumps(result))

    return jsonify(result)
