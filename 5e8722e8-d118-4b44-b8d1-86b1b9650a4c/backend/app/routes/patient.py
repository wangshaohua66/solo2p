from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, redis_client
from app.models import Patient, Appointment, MedicalRecord
from datetime import datetime
import json

patient_bp = Blueprint('patient', __name__)


@patient_bp.route('', methods=['GET'])
@jwt_required()
def get_patients():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '')
    status = request.args.get('status', '')

    cache_key = f'patients:page:{page}:per_page:{per_page}:search:{search}:status:{status}'
    cached = redis_client.get(cache_key)

    query = Patient.query

    if search:
        query = query.filter(
            (Patient.name.like(f'%{search}%')) |
            (Patient.phone.like(f'%{search}%'))
        )

    if status:
        query = query.filter_by(status=status)

    pagination = query.order_by(Patient.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    patients = [p.to_summary_dict() for p in pagination.items]

    return jsonify({
        'patients': patients,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    })


@patient_bp.route('/<int:patient_id>', methods=['GET'])
@jwt_required()
def get_patient(patient_id):
    cache_key = f'patient:{patient_id}'
    cached = redis_client.get(cache_key)

    if cached:
        return jsonify({'patient': json.loads(cached)})

    patient = Patient.query.get(patient_id)
    if not patient:
        return jsonify({'message': '患者不存在'}), 404

    patient_dict = patient.to_dict()

    appointments = Appointment.query.filter_by(patient_id=patient_id).order_by(
        Appointment.appointment_date.desc()
    ).limit(5).all()
    patient_dict['recent_appointments'] = [a.to_dict() for a in appointments]

    records = MedicalRecord.query.filter_by(patient_id=patient_id).order_by(
        MedicalRecord.visit_date.desc()
    ).limit(5).all()
    patient_dict['recent_records'] = [r.to_dict() for r in records]

    redis_client.setex(cache_key, 300, json.dumps(patient_dict))

    return jsonify({'patient': patient_dict})


@patient_bp.route('', methods=['POST'])
@jwt_required()
def create_patient():
    data = request.get_json()

    required_fields = ['name', 'phone']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'{field}不能为空'}), 400

    if Patient.query.filter_by(phone=data['phone']).first():
        return jsonify({'message': '该手机号已注册'}), 400

    patient = Patient(
        name=data['name'],
        gender=data.get('gender'),
        age=data.get('age'),
        phone=data['phone'],
        id_card=data.get('id_card'),
        address=data.get('address'),
        allergies=data.get('allergies', []),
        medical_history=data.get('medical_history', []),
    )

    db.session.add(patient)
    db.session.commit()

    cache_keys = redis_client.keys('patients:*')
    if cache_keys:
        redis_client.delete(*cache_keys)

    return jsonify({
        'message': '患者创建成功',
        'patient': patient.to_dict(),
    }), 201


@patient_bp.route('/<int:patient_id>', methods=['PUT'])
@jwt_required()
def update_patient(patient_id):
    patient = Patient.query.get(patient_id)
    if not patient:
        return jsonify({'message': '患者不存在'}), 404

    data = request.get_json()

    patient.name = data.get('name', patient.name)
    patient.gender = data.get('gender', patient.gender)
    patient.age = data.get('age', patient.age)
    patient.phone = data.get('phone', patient.phone)
    patient.id_card = data.get('id_card', patient.id_card)
    patient.address = data.get('address', patient.address)
    patient.allergies = data.get('allergies', patient.allergies)
    patient.medical_history = data.get('medical_history', patient.medical_history)
    patient.status = data.get('status', patient.status)

    db.session.commit()

    cache_key = f'patient:{patient_id}'
    redis_client.delete(cache_key)
    cache_keys = redis_client.keys('patients:*')
    if cache_keys:
        redis_client.delete(*cache_keys)

    return jsonify({
        'message': '患者信息更新成功',
        'patient': patient.to_dict(),
    })


@patient_bp.route('/<int:patient_id>', methods=['DELETE'])
@jwt_required()
def delete_patient(patient_id):
    patient = Patient.query.get(patient_id)
    if not patient:
        return jsonify({'message': '患者不存在'}), 404

    patient.status = 'inactive'
    db.session.commit()

    cache_key = f'patient:{patient_id}'
    redis_client.delete(cache_key)
    cache_keys = redis_client.keys('patients:*')
    if cache_keys:
        redis_client.delete(*cache_keys)

    return jsonify({'message': '患者已删除'})


@patient_bp.route('/<int:patient_id>/records', methods=['GET'])
@jwt_required()
def get_patient_records(patient_id):
    patient = Patient.query.get(patient_id)
    if not patient:
        return jsonify({'message': '患者不存在'}), 404

    records = MedicalRecord.query.filter_by(patient_id=patient_id).order_by(
        MedicalRecord.visit_date.desc()
    ).all()

    return jsonify({'records': [r.to_dict() for r in records]})


@patient_bp.route('/<int:patient_id>/appointments', methods=['GET'])
@jwt_required()
def get_patient_appointments(patient_id):
    patient = Patient.query.get(patient_id)
    if not patient:
        return jsonify({'message': '患者不存在'}), 404

    status = request.args.get('status', '')
    query = Appointment.query.filter_by(patient_id=patient_id)

    if status:
        query = query.filter_by(status=status)

    appointments = query.order_by(Appointment.appointment_date.desc()).all()

    return jsonify({'appointments': [a.to_dict() for a in appointments]})
