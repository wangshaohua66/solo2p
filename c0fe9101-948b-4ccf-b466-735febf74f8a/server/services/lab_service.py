from datetime import datetime, timedelta
from sqlalchemy import and_, desc, func
from models import db, LabTest, LabResult, LabResultItem, MedicalRecord, User, Hospital
from services.auth_service import create_notification


class LabService:

    @staticmethod
    def get_lab_tests(category=None, subcategory=None, keyword=None, is_active=True):
        query = LabTest.query
        if is_active is not None:
            query = query.filter_by(is_active=is_active)
        if category:
            query = query.filter_by(category=category)
        if subcategory:
            query = query.filter_by(subcategory=subcategory)
        if keyword:
            like = f'%{keyword}%'
            query = query.filter(LabTest.name.ilike(like) | LabTest.code.ilike(like))
        tests = query.order_by(LabTest.category, LabTest.code).all()
        return [t.to_dict() for t in tests]

    @staticmethod
    def create_lab_result(data, requesting_doctor_id=None):
        result = LabResult(
            medical_record_id=data.get('medical_record_id'),
            hospital_id=data.get('hospital_id'),
            requesting_doctor_id=requesting_doctor_id or data.get('requesting_doctor_id'),
            category=data.get('category'),
            status='pending',
            priority=data.get('priority', 'normal'),
            attachment_path=data.get('attachment_path')
        )
        db.session.add(result)
        db.session.flush()

        items_data = data.get('items', [])
        for item in items_data:
            li = LabResultItem(
                lab_result_id=result.id,
                lab_test_id=item.get('lab_test_id'),
                remark=item.get('remark')
            )
            db.session.add(li)

        db.session.commit()
        return result

    @staticmethod
    def submit_lab_result(result_id, technician_id, items_data, overall_conclusion=None, attachment_path=None):
        result = LabResult.query.get(result_id)
        if not result:
            return None, '检验结果不存在'

        result.technician_id = technician_id
        result.status = 'completed'
        result.submitted_at = datetime.utcnow()
        result.overall_conclusion = overall_conclusion
        if attachment_path:
            result.attachment_path = attachment_path

        has_abnormal = False
        for item_data in items_data:
            item = LabResultItem.query.get(item_data.get('id')) if item_data.get('id') else None
            if not item:
                for li in result.items:
                    if li.lab_test_id == item_data.get('lab_test_id'):
                        item = li
                        break
            if not item:
                continue

            test = LabTest.query.get(item.lab_test_id)
            item.result_value = item_data.get('result_value')
            item.result_text = item_data.get('result_text')
            item.remark = item_data.get('remark')

            is_abnormal = False
            abnormal_type = None
            if test and item.result_value is not None:
                if test.reference_min is not None and item.result_value < test.reference_min:
                    is_abnormal = True
                    abnormal_type = 'low'
                if test.reference_max is not None and item.result_value > test.reference_max:
                    is_abnormal = True
                    abnormal_type = 'high'
            item.is_abnormal = is_abnormal
            item.abnormal_type = abnormal_type
            if is_abnormal:
                has_abnormal = True

        db.session.commit()

        if result.requesting_doctor_id:
            create_notification(
                user_id=result.requesting_doctor_id,
                type='lab_result',
                title=f'检验结果已出具{"（异常）" if has_abnormal else ""}',
                content=f'病历{result.medical_record_id}的{result.category}检验结果已完成，请及时查看',
                related_type='LabResult',
                related_id=result.id,
                priority='high' if has_abnormal else 'normal'
            )

        return result, None

    @staticmethod
    def review_lab_result(result_id, reviewer_id):
        result = LabResult.query.get(result_id)
        if not result:
            return None
        result.status = 'reviewed'
        result.reviewed_at = datetime.utcnow()
        result.reviewed_by_id = reviewer_id
        db.session.commit()
        return result

    @staticmethod
    def get_lab_result(result_id, include_items=True):
        result = LabResult.query.get(result_id)
        return result.to_dict(include_items=include_items) if result else None

    @staticmethod
    def search_lab_results(hospital_id=None, status=None, category=None, priority=None,
                           requesting_doctor_id=None, technician_id=None, medical_record_id=None,
                           start_date=None, end_date=None, only_abnormal=False,
                           page=1, per_page=20):
        query = LabResult.query

        if hospital_id:
            query = query.filter_by(hospital_id=hospital_id)
        if status:
            query = query.filter_by(status=status)
        if category:
            query = query.filter_by(category=category)
        if priority:
            query = query.filter_by(priority=priority)
        if requesting_doctor_id:
            query = query.filter_by(requesting_doctor_id=requesting_doctor_id)
        if technician_id:
            query = query.filter_by(technician_id=technician_id)
        if medical_record_id:
            query = query.filter_by(medical_record_id=medical_record_id)
        if start_date:
            query = query.filter(LabResult.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(LabResult.created_at <= datetime.fromisoformat(end_date))
        if only_abnormal:
            query = query.join(LabResultItem, LabResultItem.lab_result_id == LabResult.id).filter(
                LabResultItem.is_abnormal == True
            ).distinct()

        total = query.count()
        results = query.order_by(desc(LabResult.created_at)).offset((page - 1) * per_page).limit(per_page).all()
        return {
            'total': total,
            'page': page,
            'per_page': per_page,
            'items': [r.to_dict(include_items=True) for r in results]
        }

    @staticmethod
    def get_test_history_trend(pet_id, lab_test_id, limit=20):
        items = LabResultItem.query.join(
            LabResult, LabResultItem.lab_result_id == LabResult.id
        ).join(
            MedicalRecord, LabResult.medical_record_id == MedicalRecord.id
        ).filter(
            MedicalRecord.pet_id == pet_id,
            LabResultItem.lab_test_id == lab_test_id,
            LabResult.status.in_(['completed', 'reviewed']),
            LabResultItem.result_value.isnot(None)
        ).order_by(LabResult.submitted_at.desc()).limit(limit).all()

        test = LabTest.query.get(lab_test_id)
        trend = []
        for item in reversed(items):
            trend.append({
                'date': item.lab_result.submitted_at.isoformat() if item.lab_result.submitted_at else item.lab_result.created_at.isoformat(),
                'value': item.result_value,
                'is_abnormal': item.is_abnormal,
                'abnormal_type': item.abnormal_type,
                'record_id': item.lab_result.medical_record_id,
                'hospital': item.lab_result.hospital.name if item.lab_result.hospital else None
            })

        return {
            'test': test.to_dict() if test else None,
            'trend': trend,
            'count': len(trend)
        }

    @staticmethod
    def create_lab_test(data):
        existing = LabTest.query.filter_by(code=data['code']).first()
        if existing:
            return None, '项目编码已存在'
        test = LabTest(
            code=data['code'],
            name=data['name'],
            category=data.get('category'),
            subcategory=data.get('subcategory'),
            unit=data.get('unit'),
            reference_min=data.get('reference_min'),
            reference_max=data.get('reference_max'),
            reference_text=data.get('reference_text'),
            price=data.get('price', 0),
            is_active=data.get('is_active', True),
            need_attachment=data.get('need_attachment', False)
        )
        db.session.add(test)
        db.session.commit()
        return test, None
