from flask import Blueprint, request, jsonify, current_app
from models import db, MedicalRecord
from services.auth_service import get_current_user, require_permissions
from services.medical_service import MedicalService
import os
from datetime import datetime
from werkzeug.utils import secure_filename

medical_bp = Blueprint('medical', __name__, url_prefix='/api/medical')


@medical_bp.route('/pets/search', methods=['GET'])
@require_permissions('medical_record:read')
def search_pets():
    keyword = request.args.get('keyword', '')
    hospital_id = request.args.get('hospital_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    result = MedicalService.search_pets(keyword, hospital_id, page, per_page)
    return jsonify({'code': 200, 'data': result})


@medical_bp.route('/pets', methods=['POST'])
@require_permissions('medical_record:write')
def create_pet():
    data = request.get_json()
    user = get_current_user()
    if not data.get('owner_id') and not data.get('owner'):
        return jsonify({'code': 400, 'message': '请指定主人信息'}), 400

    if not data.get('owner_id') and data.get('owner'):
        owner = MedicalService.create_owner(data['owner'])
        data['owner_id'] = owner.id

    pet = MedicalService.create_pet(data)
    return jsonify({'code': 200, 'message': '创建成功', 'data': pet.to_dict()})


@medical_bp.route('/owners', methods=['POST'])
@require_permissions('medical_record:write')
def create_owner():
    data = request.get_json()
    owner = MedicalService.create_owner(data)
    return jsonify({'code': 200, 'message': '创建成功', 'data': owner.to_dict()})


@medical_bp.route('/pets/<int:pet_id>/history', methods=['GET'])
@require_permissions('medical_record:read')
def get_pet_history(pet_id):
    history = MedicalService.get_complete_pet_history(pet_id)
    if not history:
        return jsonify({'code': 404, 'message': '宠物不存在'}), 404
    return jsonify({'code': 200, 'data': history})


@medical_bp.route('/pets/<int:pet_id>/records', methods=['GET'])
@require_permissions('medical_record:read')
def get_pet_records(pet_id):
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    include_details = request.args.get('details', 'false').lower() == 'true'
    result = MedicalService.get_pet_medical_records(pet_id, page, per_page, include_details)
    return jsonify({'code': 200, 'data': result})


@medical_bp.route('/records', methods=['GET'])
@require_permissions('medical_record:read')
def search_records():
    params = {
        'hospital_id': request.args.get('hospital_id', type=int),
        'doctor_id': request.args.get('doctor_id', type=int),
        'pet_id': request.args.get('pet_id', type=int),
        'status': request.args.get('status'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'keyword': request.args.get('keyword', ''),
        'page': request.args.get('page', 1, type=int),
        'per_page': request.args.get('per_page', 20, type=int)
    }
    result = MedicalService.search_records(**params)
    return jsonify({'code': 200, 'data': result})


@medical_bp.route('/records', methods=['POST'])
@require_permissions('medical_record:write')
def create_record():
    data = request.get_json()
    user = get_current_user()
    if not data.get('doctor_id'):
        data['doctor_id'] = user.id
    if not data.get('hospital_id'):
        data['hospital_id'] = user.hospital_id

    record = MedicalService.create_medical_record(data)
    return jsonify({'code': 200, 'message': '病历创建成功', 'data': record.to_dict(include_details=True)})


@medical_bp.route('/records/<int:record_id>', methods=['GET'])
@require_permissions('medical_record:read')
def get_record(record_id):
    record = MedicalRecord.query.get(record_id)
    if not record:
        return jsonify({'code': 404, 'message': '病历不存在'}), 404
    return jsonify({'code': 200, 'data': record.to_dict(include_details=True)})


@medical_bp.route('/records/<int:record_id>', methods=['PUT'])
@require_permissions('medical_record:write')
def update_record(record_id):
    data = request.get_json()
    record = MedicalService.update_medical_record(record_id, data)
    if not record:
        return jsonify({'code': 404, 'message': '病历不存在'}), 404
    return jsonify({'code': 200, 'message': '更新成功', 'data': record.to_dict(include_details=True)})


@medical_bp.route('/records/<int:record_id>/referral', methods=['POST'])
@require_permissions('medical_record:write')
def create_referral(record_id):
    data = request.get_json() or {}
    target_hospital_id = data.get('target_hospital_id')
    target_doctor_id = data.get('target_doctor_id')
    skip_duplicate_check = data.get('skip_duplicate_check', False)
    if not target_hospital_id:
        return jsonify({'code': 400, 'message': '请指定目标院区'}), 400

    new_record, error = MedicalService.create_referral(
        record_id, target_hospital_id, target_doctor_id,
        skip_duplicate_check=skip_duplicate_check
    )
    if error:
        if isinstance(error, dict) and error.get('error') == 'duplicate_detected':
            return jsonify({
                'code': 409,
                'message': error.get('message', '检测到重复检验项目'),
                'data': {'duplicate_tests': error.get('duplicate_tests', [])}
            }), 409
        return jsonify({'code': 400, 'message': str(error)}), 400
    return jsonify({'code': 200, 'message': '转诊成功', 'data': new_record.to_dict(include_details=True)})


@medical_bp.route('/records/<int:record_id>/attachments', methods=['POST'])
@require_permissions('medical_record:write')
def upload_attachment(record_id):
    if 'file' not in request.files:
        return jsonify({'code': 400, 'message': '未找到文件'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'code': 400, 'message': '未选择文件'}), 400

    user = get_current_user()
    upload_dir = os.path.join(current_app.root_path, 'uploads', 'records', str(record_id))
    os.makedirs(upload_dir, exist_ok=True)

    filename = secure_filename(f"{datetime.utcnow().timestamp()}_{file.filename}")
    file_path = os.path.join(upload_dir, filename)
    file.save(file_path)

    file_type = request.form.get('file_type', 'other')
    attachment = MedicalService.add_attachment(
        record_id=record_id,
        file_name=file.filename,
        file_path=f"/uploads/records/{record_id}/{filename}",
        file_type=file_type,
        uploaded_by=user.id,
        file_size=os.path.getsize(file_path)
    )
    return jsonify({'code': 200, 'message': '上传成功', 'data': attachment.to_dict()})
