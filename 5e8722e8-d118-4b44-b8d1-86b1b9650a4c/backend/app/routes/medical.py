from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date, datetime
from app import db, redis_client
from app.models import (
    MedicalRecord, MedicalImage, Patient, Doctor,
    TreatmentPlan, RecheckPlan,
    OrthodonticRecord, OrthodonticVisit,
    ImplantRecord, ImplantStage,
)
import json
import os

medical_bp = Blueprint('medical', __name__)


@medical_bp.route('/records', methods=['GET'])
@jwt_required()
def get_records():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    patient_id = request.args.get('patient_id', type=int)
    doctor_id = request.args.get('doctor_id', type=int)

    query = MedicalRecord.query

    if patient_id:
        query = query.filter_by(patient_id=patient_id)
    if doctor_id:
        query = query.filter_by(doctor_id=doctor_id)

    pagination = query.order_by(MedicalRecord.visit_date.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    records = [r.to_dict() for r in pagination.items]

    return jsonify({
        'records': records,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
    })


@medical_bp.route('/records/<int:record_id>', methods=['GET'])
@jwt_required()
def get_record(record_id):
    record = MedicalRecord.query.get(record_id)
    if not record:
        return jsonify({'message': '病历不存在'}), 404

    return jsonify({'record': record.to_dict()})


@medical_bp.route('/records', methods=['POST'])
@jwt_required()
def create_record():
    data = request.get_json()

    required_fields = ['patient_id', 'doctor_id', 'visit_date', 'diagnosis']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'{field}不能为空'}), 400

    patient = Patient.query.get(data['patient_id'])
    if not patient:
        return jsonify({'message': '患者不存在'}), 404

    doctor = Doctor.query.get(data['doctor_id'])
    if not doctor:
        return jsonify({'message': '医生不存在'}), 404

    record = MedicalRecord(
        patient_id=data['patient_id'],
        doctor_id=data['doctor_id'],
        department=doctor.department,
        visit_date=date.fromisoformat(data['visit_date']),
        chief_complaint=data.get('chief_complaint', ''),
        present_illness=data.get('present_illness', ''),
        past_history=data.get('past_history', ''),
        diagnosis=data['diagnosis'],
        treatment_plan=data.get('treatment_plan', ''),
        prescription=data.get('prescription', []),
        images=data.get('images', []),
        next_visit=date.fromisoformat(data['next_visit']) if data.get('next_visit') else None,
    )

    db.session.add(record)
    db.session.commit()

    cache_key = f'patient:{data["patient_id"]}'
    redis_client.delete(cache_key)

    if data.get('next_visit'):
        recheck = RecheckPlan(
            patient_id=data['patient_id'],
            visit_date=date.fromisoformat(data['next_visit']),
            visit_type='复诊',
            doctor_id=data['doctor_id'],
        )
        db.session.add(recheck)
        db.session.commit()

    return jsonify({
        'message': '病历创建成功',
        'record': record.to_dict(),
    }), 201


@medical_bp.route('/records/<int:record_id>', methods=['PUT'])
@jwt_required()
def update_record(record_id):
    record = MedicalRecord.query.get(record_id)
    if not record:
        return jsonify({'message': '病历不存在'}), 404

    data = request.get_json()

    record.chief_complaint = data.get('chief_complaint', record.chief_complaint)
    record.present_illness = data.get('present_illness', record.present_illness)
    record.past_history = data.get('past_history', record.past_history)
    record.diagnosis = data.get('diagnosis', record.diagnosis)
    record.treatment_plan = data.get('treatment_plan', record.treatment_plan)
    record.prescription = data.get('prescription', record.prescription)
    record.images = data.get('images', record.images)

    if data.get('next_visit'):
        record.next_visit = date.fromisoformat(data['next_visit'])

    db.session.commit()

    cache_key = f'patient:{record.patient_id}'
    redis_client.delete(cache_key)

    return jsonify({
        'message': '病历更新成功',
        'record': record.to_dict(),
    })


@medical_bp.route('/images/upload', methods=['POST'])
@jwt_required()
def upload_image():
    if 'file' not in request.files:
        return jsonify({'message': '没有上传文件'}), 400

    file = request.files['file']
    patient_id = request.form.get('patient_id', type=int)
    record_id = request.form.get('record_id', type=int)

    if file.filename == '':
        return jsonify({'message': '文件名为空'}), 400

    if not patient_id:
        return jsonify({'message': 'patient_id不能为空'}), 400

    from app.config import Config
    upload_folder = Config.UPLOAD_FOLDER
    os.makedirs(upload_folder, exist_ok=True)

    filename = f"{patient_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    filepath = os.path.join(upload_folder, filename)
    file.save(filepath)

    file_size = os.path.getsize(filepath)

    image = MedicalImage(
        patient_id=patient_id,
        record_id=record_id,
        file_name=file.filename,
        file_path=filepath,
        file_size=file_size,
        image_type=request.form.get('image_type', 'dicom'),
    )

    db.session.add(image)
    db.session.commit()

    return jsonify({
        'message': '上传成功',
        'image': image.to_dict(),
    }), 201


@medical_bp.route('/orthodontic', methods=['GET'])
@jwt_required()
def get_orthodontic_records():
    patient_id = request.args.get('patient_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    query = OrthodonticRecord.query
    if patient_id:
        query = query.filter_by(patient_id=patient_id)

    pagination = query.order_by(OrthodonticRecord.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    records = [r.to_dict() for r in pagination.items]

    return jsonify({
        'records': records,
        'total': pagination.total,
    })


@medical_bp.route('/orthodontic', methods=['POST'])
@jwt_required()
def create_orthodontic_record():
    data = request.get_json()

    record = OrthodonticRecord(
        patient_id=data['patient_id'],
        doctor_id=data.get('doctor_id'),
        start_date=date.fromisoformat(data['start_date']) if data.get('start_date') else None,
        bracket_type=data.get('bracket_type', ''),
        archwire_sequence=data.get('archwire_sequence', []),
        attachments=data.get('attachments', []),
    )

    db.session.add(record)
    db.session.commit()

    stage_names = ['术前检查', '托槽安装', '初次调整', '中期调整', '精细调整', '保持期']
    for i, name in enumerate(stage_names):
        pass

    return jsonify({
        'message': '正畸记录创建成功',
        'record': record.to_dict(),
    }), 201


@medical_bp.route('/orthodontic/<int:record_id>/visits', methods=['GET'])
@jwt_required()
def get_orthodontic_visits(record_id):
    record = OrthodonticRecord.query.get(record_id)
    if not record:
        return jsonify({'message': '正畸记录不存在'}), 404

    visits = record.visits.order_by(OrthodonticVisit.visit_date.asc()).all()

    return jsonify({'visits': [v.to_dict() for v in visits]})


@medical_bp.route('/orthodontic/<int:record_id>/visits', methods=['POST'])
@jwt_required()
def add_orthodontic_visit(record_id):
    record = OrthodonticRecord.query.get(record_id)
    if not record:
        return jsonify({'message': '正畸记录不存在'}), 404

    data = request.get_json()

    visit = OrthodonticVisit(
        record_id=record_id,
        visit_date=date.fromisoformat(data['visit_date']),
        doctor_id=data.get('doctor_id'),
        tooth_movement=data.get('tooth_movement', 0),
        adjustment=data.get('adjustment', ''),
        notes=data.get('notes', ''),
        next_visit=date.fromisoformat(data['next_visit']) if data.get('next_visit') else None,
    )

    db.session.add(visit)

    record.total_movement += data.get('tooth_movement', 0)
    visits_count = record.visits.count()
    if visits_count > 0:
        record.progress = min(100, round(visits_count / 12 * 100, 1))

    db.session.commit()

    return jsonify({
        'message': '复诊记录添加成功',
        'visit': visit.to_dict(),
    }), 201


@medical_bp.route('/implant', methods=['GET'])
@jwt_required()
def get_implant_records():
    patient_id = request.args.get('patient_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    query = ImplantRecord.query
    if patient_id:
        query = query.filter_by(patient_id=patient_id)

    pagination = query.order_by(ImplantRecord.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    records = [r.to_dict() for r in pagination.items]

    return jsonify({
        'records': records,
        'total': pagination.total,
    })


@medical_bp.route('/implant', methods=['POST'])
@jwt_required()
def create_implant_record():
    data = request.get_json()

    record = ImplantRecord(
        patient_id=data['patient_id'],
        doctor_id=data.get('doctor_id'),
        implant_brand=data.get('implant_brand', ''),
        implant_model=data.get('implant_model', ''),
        implant_spec=data.get('implant_spec', ''),
        position=data.get('position', ''),
        bone_graft_amount=data.get('bone_graft_amount', 0),
        surgery_date=date.fromisoformat(data['surgery_date']) if data.get('surgery_date') else None,
    )

    db.session.add(record)
    db.session.commit()

    stage_names = ['术前检查', '手术植入', '骨结合期', '二期手术', '牙冠修复']
    checklists = {
        0: ['口腔检查', 'CBCT拍摄', '血压测量', '血糖检测', '过敏史询问', '手术知情同意'],
        1: ['局部麻醉', '种植窝预备', '植入种植体', '缝合伤口', '术后拍片', '医嘱告知'],
        2: ['创口检查', '牙龈健康评估', '骨结合影像评估', '口腔卫生指导', '预约复查'],
        3: ['二期手术', '愈合基台安装', '牙龈成形', '取模记录', '牙冠制作'],
        4: ['牙冠试戴', '咬合调整', '粘接固定', '术后拍片', '使用指导', '定期复查'],
    }

    for i, name in enumerate(stage_names):
        stage = ImplantStage(
            record_id=record.id,
            stage_index=i,
            stage_name=name,
            status='pending' if i > 0 else 'in_progress',
            checklist=checklists.get(i, []),
            completed_items=[],
        )
        db.session.add(stage)

    db.session.commit()

    return jsonify({
        'message': '种植记录创建成功',
        'record': record.to_dict(),
    }), 201


@medical_bp.route('/implant/<int:record_id>/stages', methods=['GET'])
@jwt_required()
def get_implant_stages(record_id):
    record = ImplantRecord.query.get(record_id)
    if not record:
        return jsonify({'message': '种植记录不存在'}), 404

    stages = record.stages.order_by(ImplantStage.stage_index.asc()).all()

    return jsonify({'stages': [s.to_dict() for s in stages]})


@medical_bp.route('/implant/stages/<int:stage_id>/complete', methods=['POST'])
@jwt_required()
def complete_implant_stage(stage_id):
    stage = ImplantStage.query.get(stage_id)
    if not stage:
        return jsonify({'message': '阶段不存在'}), 404

    stage.status = 'completed'
    stage.completed_date = date.today()
    stage.completed_items = stage.checklist or []

    record = stage.record
    if record:
        next_stage = ImplantStage.query.filter_by(
            record_id=record.id,
            stage_index=stage.stage_index + 1,
        ).first()
        if next_stage:
            next_stage.status = 'in_progress'
            record.current_stage = stage.stage_index + 1
        else:
            record.current_stage = stage.stage_index
            record.status = 'completed'

    db.session.commit()

    return jsonify({
        'message': '阶段完成',
        'stage': stage.to_dict(),
    })


@medical_bp.route('/treatment-plans', methods=['GET'])
@jwt_required()
def get_treatment_plans():
    patient_id = request.args.get('patient_id', type=int)
    query = TreatmentPlan.query
    if patient_id:
        query = query.filter_by(patient_id=patient_id)

    plans = query.order_by(TreatmentPlan.created_at.desc()).all()

    return jsonify({'plans': [p.to_dict() for p in plans]})


@medical_bp.route('/recheck-plans', methods=['GET'])
@jwt_required()
def get_recheck_plans():
    patient_id = request.args.get('patient_id', type=int)
    status = request.args.get('status', '')

    query = RecheckPlan.query
    if patient_id:
        query = query.filter_by(patient_id=patient_id)
    if status:
        query = query.filter_by(status=status)

    plans = query.order_by(RecheckPlan.visit_date.asc()).all()

    return jsonify({'plans': [p.to_dict() for p in plans]})


@medical_bp.route('/recheck-plans/<int:plan_id>/confirm', methods=['POST'])
@jwt_required()
def confirm_recheck(plan_id):
    plan = RecheckPlan.query.get(plan_id)
    if not plan:
        return jsonify({'message': '复诊计划不存在'}), 404

    plan.status = 'confirmed'
    db.session.commit()

    return jsonify({'message': '复诊已确认'})
