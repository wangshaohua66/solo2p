from flask import Blueprint, request, jsonify, current_app
from services.auth_service import get_current_user, require_permissions
from services.lab_service import LabService
import os
from datetime import datetime
from werkzeug.utils import secure_filename

lab_bp = Blueprint('lab', __name__, url_prefix='/api/lab')


@lab_bp.route('/tests', methods=['GET'])
@require_permissions('lab:read')
def get_lab_tests():
    params = {
        'category': request.args.get('category'),
        'subcategory': request.args.get('subcategory'),
        'keyword': request.args.get('keyword', ''),
        'is_active': request.args.get('is_active', 'true').lower() == 'true'
    }
    if request.args.get('is_active') is None:
        params['is_active'] = None
    tests = LabService.get_lab_tests(**params)
    return jsonify({'code': 200, 'data': tests})


@lab_bp.route('/tests', methods=['POST'])
@require_permissions('lab:submit')
def create_lab_test():
    data = request.get_json()
    if not data.get('code') or not data.get('name'):
        return jsonify({'code': 400, 'message': '请填写编码和名称'}), 400
    test, err = LabService.create_lab_test(data)
    if err:
        return jsonify({'code': 400, 'message': err}), 400
    return jsonify({'code': 200, 'message': '创建成功', 'data': test.to_dict()})


@lab_bp.route('/results', methods=['GET'])
@require_permissions('lab:read')
def search_results():
    user = get_current_user()
    requested_hospital_id = request.args.get('hospital_id', type=int)
    if user.role == 'director':
        hospital_id = requested_hospital_id or user.hospital_id
    else:
        hospital_id = user.hospital_id
    params = {
        'hospital_id': hospital_id,
        'status': request.args.get('status'),
        'category': request.args.get('category'),
        'priority': request.args.get('priority'),
        'requesting_doctor_id': request.args.get('requesting_doctor_id', type=int),
        'technician_id': request.args.get('technician_id', type=int),
        'medical_record_id': request.args.get('medical_record_id', type=int),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'only_abnormal': request.args.get('only_abnormal', 'false').lower() == 'true',
        'page': request.args.get('page', 1, type=int),
        'per_page': request.args.get('per_page', 20, type=int)
    }
    result = LabService.search_lab_results(**params)
    return jsonify({'code': 200, 'data': result})


@lab_bp.route('/results', methods=['POST'])
@require_permissions('lab:request')
def create_result():
    data = request.get_json()
    user = get_current_user()
    if not data.get('hospital_id'):
        data['hospital_id'] = user.hospital_id
    result = LabService.create_lab_result(data, requesting_doctor_id=user.id)
    return jsonify({'code': 200, 'message': '已创建检验申请', 'data': result.to_dict(include_items=True)})


@lab_bp.route('/results/<int:id>', methods=['GET'])
@require_permissions('lab:read')
def get_result(id):
    result = LabService.get_lab_result(id, include_items=True)
    if not result:
        return jsonify({'code': 404, 'message': '检验结果不存在'}), 404
    return jsonify({'code': 200, 'data': result})


@lab_bp.route('/results/<int:id>/submit', methods=['POST'])
@require_permissions('lab:submit')
def submit_result(id):
    data = request.get_json()
    user = get_current_user()
    items = data.get('items', [])
    conclusion = data.get('overall_conclusion')

    result, err = LabService.submit_lab_result(
        result_id=id,
        technician_id=user.id,
        items_data=items,
        overall_conclusion=conclusion,
        attachment_path=data.get('attachment_path')
    )
    if err:
        return jsonify({'code': 400, 'message': err}), 400
    return jsonify({'code': 200, 'message': '提交成功', 'data': result.to_dict(include_items=True)})


@lab_bp.route('/results/<int:id>/review', methods=['POST'])
@require_permissions('lab:review')
def review_result(id):
    user = get_current_user()
    result = LabService.review_lab_result(id, reviewer_id=user.id)
    if not result:
        return jsonify({'code': 404, 'message': '检验结果不存在'}), 404
    return jsonify({'code': 200, 'message': '审核完成', 'data': result.to_dict(include_items=True)})


@lab_bp.route('/results/<int:id>/attachment', methods=['POST'])
@require_permissions('lab:submit')
def upload_attachment(id):
    if 'file' not in request.files:
        return jsonify({'code': 400, 'message': '未找到文件'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'code': 400, 'message': '未选择文件'}), 400

    upload_dir = os.path.join(current_app.root_path, 'uploads', 'lab', str(id))
    os.makedirs(upload_dir, exist_ok=True)
    filename = secure_filename(f"{datetime.utcnow().timestamp()}_{file.filename}")
    file_path = os.path.join(upload_dir, filename)
    file.save(file_path)

    return jsonify({
        'code': 200,
        'message': '上传成功',
        'data': {'path': f"/uploads/lab/{id}/{filename}", 'name': file.filename}
    })


@lab_bp.route('/trend/<int:pet_id>/<int:lab_test_id>', methods=['GET'])
@require_permissions('lab:read')
def get_test_trend(pet_id, lab_test_id):
    limit = request.args.get('limit', 20, type=int)
    result = LabService.get_test_history_trend(pet_id, lab_test_id, limit)
    return jsonify({'code': 200, 'data': result})
