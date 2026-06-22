from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date, timedelta
from app import db, redis_client
from app.models import Appointment, Patient, Doctor, Clinic
import json

appointment_bp = Blueprint('appointment', __name__)


@appointment_bp.route('/available', methods=['GET'])
@jwt_required()
def get_available_slots():
    clinic_id = request.args.get('clinic_id', type=int)
    department = request.args.get('department', '')
    doctor_id = request.args.get('doctor_id', type=int)
    date_str = request.args.get('date', '')

    cache_key = f'appointments:available:{clinic_id}:{department}:{doctor_id}:{date_str}'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify(json.loads(cached))

    target_date = date.fromisoformat(date_str) if date_str else date.today()

    query = Appointment.query.filter_by(appointment_date=target_date)

    if doctor_id:
        query = query.filter_by(doctor_id=doctor_id)
    elif department:
        query = query.join(Doctor).filter(Doctor.department == department)
    elif clinic_id:
        query = query.filter_by(clinic_id=clinic_id)

    booked_appointments = query.all()
    booked_slots = {}
    for appt in booked_appointments:
        if appt.doctor_id not in booked_slots:
            booked_slots[appt.doctor_id] = []
        if appt.status != 'cancelled':
            booked_slots[appt.doctor_id].append(appt.time_slot)

    doctor_query = Doctor.query
    if doctor_id:
        doctor_query = doctor_query.filter_by(id=doctor_id)
    if department:
        doctor_query = doctor_query.filter_by(department=department)
    if clinic_id:
        doctor_query = doctor_query.filter_by(clinic_id=clinic_id)

    doctors = doctor_query.all()

    time_slots = [
        '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
        '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00',
    ]

    result = []
    for doctor in doctors:
        doctor_slots = []
        booked = booked_slots.get(doctor.id, [])
        for slot in time_slots:
            doctor_slots.append({
                'time': slot,
                'available': slot not in booked,
            })
        result.append({
            'doctor': doctor.to_dict(),
            'slots': doctor_slots,
        })

    response_data = {
        'date': target_date.isoformat(),
        'doctors': result,
        'time_slots': time_slots,
    }

    redis_client.setex(cache_key, 300, json.dumps(response_data))

    return jsonify(response_data)


@appointment_bp.route('', methods=['GET'])
@jwt_required()
def get_appointments():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    status = request.args.get('status', '')
    date_str = request.args.get('date', '')
    doctor_id = request.args.get('doctor_id', type=int)
    clinic_id = request.args.get('clinic_id', type=int)

    query = Appointment.query

    if status:
        query = query.filter_by(status=status)
    if date_str:
        query = query.filter_by(appointment_date=date.fromisoformat(date_str))
    if doctor_id:
        query = query.filter_by(doctor_id=doctor_id)
    if clinic_id:
        query = query.filter_by(clinic_id=clinic_id)

    pagination = query.order_by(Appointment.appointment_date.desc(), Appointment.time_slot.asc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    appointments = [a.to_dict() for a in pagination.items]

    return jsonify({
        'appointments': appointments,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    })


@appointment_bp.route('/<int:appointment_id>', methods=['GET'])
@jwt_required()
def get_appointment(appointment_id):
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({'message': '预约不存在'}), 404

    return jsonify({'appointment': appointment.to_dict()})


@appointment_bp.route('', methods=['POST'])
@jwt_required()
def create_appointment():
    data = request.get_json()

    required_fields = ['patient_id', 'doctor_id', 'date', 'time_slot']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'{field}不能为空'}), 400

    patient = Patient.query.get(data['patient_id'])
    if not patient:
        return jsonify({'message': '患者不存在'}), 404

    doctor = Doctor.query.get(data['doctor_id'])
    if not doctor:
        return jsonify({'message': '医生不存在'}), 404

    appt_date = date.fromisoformat(data['date'])
    if appt_date < date.today():
        return jsonify({'message': '不能预约过去的日期'}), 400

    existing = Appointment.query.filter_by(
        doctor_id=data['doctor_id'],
        appointment_date=appt_date,
        time_slot=data['time_slot'],
    ).filter(Appointment.status != 'cancelled').first()

    if existing:
        return jsonify({'message': '该时段已被预约'}), 400

    queue_key = f'appointment:queue:{data["doctor_id"]}:{data["date"]}'
    queue_position = redis_client.incr(queue_key)
    redis_client.expire(queue_key, 86400)

    appointment = Appointment(
        patient_id=data['patient_id'],
        clinic_id=doctor.clinic_id,
        department=doctor.department,
        doctor_id=data['doctor_id'],
        appointment_date=appt_date,
        time_slot=data['time_slot'],
        appointment_type=data.get('type', '普通挂号'),
        symptom=data.get('symptom', ''),
        status='confirmed',
    )

    db.session.add(appointment)
    db.session.commit()

    cache_keys = [
        f'appointments:available:{doctor.clinic_id}:{doctor.department}:{data["doctor_id"]}:{data["date"]}',
        f'appointments:available::{doctor.department}:{data["doctor_id"]}:{data["date"]}',
    ]
    for key in cache_keys:
        redis_client.delete(key)

    cache_patterns = redis_client.keys('appointments:*')
    if cache_patterns:
        redis_client.delete(*cache_patterns)

    redis_client.lpush('appointment:notifications', json.dumps({
        'appointment_id': appointment.id,
        'patient_name': patient.name,
        'phone': patient.phone,
        'type': 'new_appointment',
    }))

    return jsonify({
        'message': '预约成功',
        'appointment': appointment.to_dict(),
        'queue_position': queue_position,
    }), 201


@appointment_bp.route('/<int:appointment_id>', methods=['PUT'])
@jwt_required()
def update_appointment(appointment_id):
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({'message': '预约不存在'}), 404

    data = request.get_json()

    if 'status' in data:
        appointment.status = data['status']
    if 'symptom' in data:
        appointment.symptom = data['symptom']

    db.session.commit()

    cache_patterns = redis_client.keys('appointments:*')
    if cache_patterns:
        redis_client.delete(*cache_patterns)

    return jsonify({
        'message': '预约更新成功',
        'appointment': appointment.to_dict(),
    })


@appointment_bp.route('/<int:appointment_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_appointment(appointment_id):
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({'message': '预约不存在'}), 404

    if appointment.status == 'completed':
        return jsonify({'message': '已完成的预约不能取消'}), 400

    appointment.status = 'cancelled'
    db.session.commit()

    cache_patterns = redis_client.keys('appointments:*')
    if cache_patterns:
        redis_client.delete(*cache_patterns)

    return jsonify({'message': '预约已取消'})


@appointment_bp.route('/doctors', methods=['GET'])
@jwt_required()
def get_doctors():
    clinic_id = request.args.get('clinic_id', type=int)
    department = request.args.get('department', '')
    sort_by = request.args.get('sort_by', 'rating')

    cache_key = f'doctors:{clinic_id}:{department}:{sort_by}'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify({'doctors': json.loads(cached)})

    query = Doctor.query

    if clinic_id:
        query = query.filter_by(clinic_id=clinic_id)
    if department:
        query = query.filter_by(department=department)

    if sort_by == 'rating':
        query = query.order_by(Doctor.rating.desc())
    elif sort_by == 'name':
        query = query.order_by(Doctor.name.asc())

    doctors = query.all()
    doctor_dicts = [d.to_dict() for d in doctors]

    redis_client.setex(cache_key, 600, json.dumps(doctor_dicts))

    return jsonify({'doctors': doctor_dicts})


@appointment_bp.route('/clinics', methods=['GET'])
@jwt_required()
def get_clinics():
    cache_key = 'clinics:all'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify({'clinics': json.loads(cached)})

    clinics = Clinic.query.all()
    clinic_dicts = [c.to_dict() for c in clinics]

    redis_client.setex(cache_key, 3600, json.dumps(clinic_dicts))

    return jsonify({'clinics': clinic_dicts})
