from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date, datetime
from app import db, redis_client
from app.models.triage import TriageQueue
from app.models.patient import Patient
from app.models.clinic import Doctor

triage_bp = Blueprint('triage', __name__)


@triage_bp.route('/queue', methods=['GET'])
@jwt_required()
def get_queue():
    clinic_id = request.args.get('clinic_id', type=int)
    department = request.args.get('department', '')
    queue_date = request.args.get('date', date.today().isoformat())
    status = request.args.get('status', '')

    cache_key = f'triage:queue:{clinic_id}:{department}:{queue_date}:{status}'
    cached = redis_client.get(cache_key)
    if cached:
        import json
        return jsonify({'queue': json.loads(cached)})

    query = TriageQueue.query.filter(TriageQueue.queue_date == date.fromisoformat(queue_date))

    if clinic_id:
        query = query.filter_by(clinic_id=clinic_id)
    if department:
        query = query.filter_by(department=department)
    if status:
        query = query.filter_by(status=status)

    queue = query.order_by(TriageQueue.queue_number.asc()).all()
    queue_list = [q.to_dict() for q in queue]

    import json
    redis_client.setex(cache_key, 30, json.dumps(queue_list))

    return jsonify({'queue': queue_list})


@triage_bp.route('/queue/add', methods=['POST'])
@jwt_required()
def add_to_queue():
    data = request.get_json()

    required_fields = ['patient_id', 'clinic_id', 'department']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'{field}不能为空'}), 400

    patient = Patient.query.get(data['patient_id'])
    if not patient:
        return jsonify({'message': '患者不存在'}), 404

    queue_date = date.today()

    redis_queue_key = f'triage:number:{queue_date.isoformat()}:{data["clinic_id"]}:{data["department"]}'
    queue_number = redis_client.incr(redis_queue_key)
    redis_client.expire(redis_queue_key, 86400)

    triage = TriageQueue(
        queue_date=queue_date,
        clinic_id=data['clinic_id'],
        department=data['department'],
        patient_id=data['patient_id'],
        patient_name=patient.name,
        queue_number=queue_number,
        status='waiting',
        triage_note=data.get('note', ''),
        arrived_at=datetime.utcnow(),
    )

    db.session.add(triage)
    db.session.commit()

    _invalidate_queue_cache(data['clinic_id'], data['department'])

    return jsonify({
        'message': '已加入分诊队列',
        'triage': triage.to_dict(),
        'queue_number': queue_number,
    }), 201


@triage_bp.route('/queue/<int:triage_id>/call', methods=['POST'])
@jwt_required()
def call_patient(triage_id):
    triage = TriageQueue.query.get(triage_id)
    if not triage:
        return jsonify({'message': '排队记录不存在'}), 404

    if triage.status not in ['waiting', 'called']:
        return jsonify({'message': '该患者状态不可呼叫'}), 400

    data = request.get_json() or {}
    doctor_id = data.get('doctor_id')
    doctor_name = data.get('doctor_name')

    if doctor_id:
        doctor = Doctor.query.get(doctor_id)
        if doctor:
            triage.doctor_id = doctor.id
            triage.doctor_name = doctor.name
    elif doctor_name:
        triage.doctor_name = doctor_name

    triage.status = 'called'
    triage.called_at = datetime.utcnow()
    db.session.commit()

    _invalidate_queue_cache(triage.clinic_id, triage.department)

    _broadcast_call(triage)

    return jsonify({
        'message': '已呼叫患者',
        'triage': triage.to_dict(),
    })


@triage_bp.route('/queue/<int:triage_id>/complete', methods=['POST'])
@jwt_required()
def complete_triage(triage_id):
    triage = TriageQueue.query.get(triage_id)
    if not triage:
        return jsonify({'message': '排队记录不存在'}), 404

    triage.status = 'completed'
    triage.completed_at = datetime.utcnow()
    db.session.commit()

    _invalidate_queue_cache(triage.clinic_id, triage.department)

    return jsonify({
        'message': '分诊完成',
        'triage': triage.to_dict(),
    })


@triage_bp.route('/queue/<int:triage_id>/skip', methods=['POST'])
@jwt_required()
def skip_patient(triage_id):
    triage = TriageQueue.query.get(triage_id)
    if not triage:
        return jsonify({'message': '排队记录不存在'}), 404

    triage.status = 'skipped'
    db.session.commit()

    _invalidate_queue_cache(triage.clinic_id, triage.department)

    return jsonify({
        'message': '已跳过该患者',
        'triage': triage.to_dict(),
    })


@triage_bp.route('/queue/<int:triage_id>/recall', methods=['POST'])
@jwt_required()
def recall_patient(triage_id):
    triage = TriageQueue.query.get(triage_id)
    if not triage:
        return jsonify({'message': '排队记录不存在'}), 404

    if triage.status != 'skipped':
        return jsonify({'message': '只能重新呼叫已跳过的患者'}), 400

    triage.status = 'waiting'
    db.session.commit()

    _invalidate_queue_cache(triage.clinic_id, triage.department)

    return jsonify({
        'message': '已重新加入排队',
        'triage': triage.to_dict(),
    })


@triage_bp.route('/queue/<int:triage_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_triage(triage_id):
    triage = TriageQueue.query.get(triage_id)
    if not triage:
        return jsonify({'message': '排队记录不存在'}), 404

    triage.status = 'cancelled'
    db.session.commit()

    _invalidate_queue_cache(triage.clinic_id, triage.department)

    return jsonify({
        'message': '已取消排队',
        'triage': triage.to_dict(),
    })


@triage_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_triage_stats():
    clinic_id = request.args.get('clinic_id', type=int)
    queue_date = request.args.get('date', date.today().isoformat())

    query = TriageQueue.query.filter(TriageQueue.queue_date == date.fromisoformat(queue_date))
    if clinic_id:
        query = query.filter_by(clinic_id=clinic_id)

    all_triages = query.all()

    stats = {
        'total': len(all_triages),
        'waiting': sum(1 for t in all_triages if t.status == 'waiting'),
        'called': sum(1 for t in all_triages if t.status == 'called'),
        'completed': sum(1 for t in all_triages if t.status == 'completed'),
        'skipped': sum(1 for t in all_triages if t.status == 'skipped'),
        'cancelled': sum(1 for t in all_triages if t.status == 'cancelled'),
    }

    departments = {}
    for t in all_triages:
        if t.department not in departments:
            departments[t.department] = {'total': 0, 'waiting': 0}
        departments[t.department]['total'] += 1
        if t.status == 'waiting':
            departments[t.department]['waiting'] += 1

    stats['by_department'] = departments

    return jsonify({'stats': stats})


@triage_bp.route('/current-call', methods=['GET'])
@jwt_required()
def get_current_call():
    clinic_id = request.args.get('clinic_id', type=int)
    department = request.args.get('department', '')

    cache_key = f'triage:current:{clinic_id}:{department}'
    cached = redis_client.get(cache_key)
    if cached:
        import json
        return jsonify(json.loads(cached))

    query = TriageQueue.query.filter(
        TriageQueue.queue_date == date.today(),
        TriageQueue.status == 'called',
    )

    if clinic_id:
        query = query.filter_by(clinic_id=clinic_id)
    if department:
        query = query.filter_by(department=department)

    current = query.order_by(TriageQueue.called_at.desc()).first()

    result = {
        'current': current.to_dict() if current else None,
    }

    import json
    redis_client.setex(cache_key, 10, json.dumps(result))

    return jsonify(result)


def _invalidate_queue_cache(clinic_id, department):
    import json
    patterns = [
        f'triage:queue:{clinic_id}:*',
        f'triage:current:{clinic_id}:*',
    ]
    for pattern in patterns:
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)


def _broadcast_call(triage):
    call_data = {
        'triage_id': triage.id,
        'patient_name': triage.patient_name,
        'queue_number': triage.queue_number,
        'department': triage.department,
        'doctor_name': triage.doctor_name,
        'called_at': triage.called_at.isoformat() if triage.called_at else None,
    }
    import json
    redis_client.publish('triage:call_channel', json.dumps(call_data))
