from datetime import datetime
from sqlalchemy import and_, or_, desc, func
from models import db, Pet, Owner, MedicalRecord, Hospital, User, RecordAttachment


class MedicalService:

    @staticmethod
    def get_pet_medical_records(pet_id, page=1, per_page=50, include_details=False):
        query = MedicalRecord.query.filter_by(pet_id=pet_id).order_by(desc(MedicalRecord.visit_date))
        total = query.count()
        records = query.offset((page - 1) * per_page).limit(per_page).all()
        return {
            'total': total,
            'page': page,
            'per_page': per_page,
            'items': [r.to_dict(include_details=include_details) for r in records]
        }

    @staticmethod
    def get_complete_pet_history(pet_id):
        pet = Pet.query.get(pet_id)
        if not pet:
            return None

        records = MedicalRecord.query.filter_by(pet_id=pet_id).order_by(MedicalRecord.visit_date).all()
        record_ids = [r.id for r in records]

        hospital_names = {h.id: h.name for h in Hospital.query.all()}
        doctor_names = {u.id: u.real_name for u in User.query.all()}

        timeline = []
        for record in records:
            timeline.append({
                'record_id': record.id,
                'date': record.visit_date.isoformat() if record.visit_date else None,
                'hospital': hospital_names.get(record.hospital_id, '未知'),
                'doctor': doctor_names.get(record.doctor_id, '未知'),
                'department': record.department,
                'visit_type': record.visit_type,
                'chief_complaint': record.chief_complaint,
                'diagnosis': record.diagnosis,
                'status': record.status,
                'has_prescription': len(record.prescriptions) > 0,
                'has_lab': len(record.lab_results) > 0,
                'has_attachment': len(record.attachments) > 0
            })

        return {
            'pet': pet.to_dict(),
            'owner': pet.owner.to_dict() if pet.owner else None,
            'total_visits': len(records),
            'hospitals_visited': len(set(r.hospital_id for r in records)),
            'timeline': timeline,
            'allergies': pet.allergy_history,
            'records': [r.to_dict(include_details=True) for r in records]
        }

    @staticmethod
    def create_medical_record(data):
        record = MedicalRecord(
            pet_id=data.get('pet_id'),
            owner_id=data.get('owner_id'),
            hospital_id=data.get('hospital_id'),
            doctor_id=data.get('doctor_id'),
            department=data.get('department'),
            visit_type=data.get('visit_type', 'outpatient'),
            referral_from_id=data.get('referral_from_id'),
            chief_complaint=data.get('chief_complaint'),
            present_illness=data.get('present_illness'),
            past_history=data.get('past_history'),
            physical_exam=data.get('physical_exam'),
            temperature=data.get('temperature'),
            heart_rate=data.get('heart_rate'),
            respiratory_rate=data.get('respiratory_rate'),
            diagnosis=data.get('diagnosis'),
            treatment_plan=data.get('treatment_plan'),
            status=data.get('status', 'in_progress'),
            visit_date=datetime.fromisoformat(data['visit_date'].replace('Z', '+00:00')) if data.get('visit_date') else datetime.utcnow()
        )
        db.session.add(record)
        db.session.commit()
        return record

    @staticmethod
    def update_medical_record(record_id, data):
        record = MedicalRecord.query.get(record_id)
        if not record:
            return None
        for key, value in data.items():
            if hasattr(record, key) and key not in ('id', 'created_at', 'updated_at'):
                if key == 'visit_date' and value:
                    setattr(record, key, datetime.fromisoformat(value.replace('Z', '+00:00')))
                else:
                    setattr(record, key, value)
        db.session.commit()
        return record

    @staticmethod
    def create_referral(source_record_id, target_hospital_id, target_doctor_id=None):
        source = MedicalRecord.query.get(source_record_id)
        if not source:
            return None

        new_record = MedicalRecord(
            pet_id=source.pet_id,
            owner_id=source.owner_id,
            hospital_id=target_hospital_id,
            doctor_id=target_doctor_id,
            department=source.department,
            visit_type='referral',
            referral_from_id=source_record_id,
            chief_complaint=source.chief_complaint,
            diagnosis=source.diagnosis,
            treatment_plan=source.treatment_plan,
            status='in_progress',
            visit_date=datetime.utcnow()
        )
        db.session.add(new_record)
        source.status = 'referred'
        db.session.commit()
        return new_record

    @staticmethod
    def search_pets(keyword, hospital_id=None, page=1, per_page=20):
        query = Pet.query.join(Owner)
        if keyword:
            like_pattern = f'%{keyword}%'
            query = query.filter(or_(
                Pet.name.ilike(like_pattern),
                Pet.breed.ilike(like_pattern),
                Pet.microchip_id.ilike(like_pattern),
                Owner.name.ilike(like_pattern),
                Owner.phone.ilike(like_pattern)
            ))
        total = query.count()
        pets = query.order_by(desc(Pet.updated_at)).offset((page - 1) * per_page).limit(per_page).all()
        return {
            'total': total,
            'items': [p.to_dict() for p in pets]
        }

    @staticmethod
    def create_pet(data):
        pet = Pet(
            owner_id=data.get('owner_id'),
            name=data.get('name'),
            species=data.get('species'),
            breed=data.get('breed'),
            gender=data.get('gender'),
            birth_date=datetime.fromisoformat(data['birth_date']).date() if data.get('birth_date') else None,
            weight=data.get('weight'),
            color=data.get('color'),
            microchip_id=data.get('microchip_id'),
            is_neutered=data.get('is_neutered', False),
            allergy_history=data.get('allergy_history'),
            remark=data.get('remark')
        )
        db.session.add(pet)
        db.session.commit()
        return pet

    @staticmethod
    def create_owner(data):
        owner = Owner(
            name=data.get('name'),
            phone=data.get('phone'),
            id_card=data.get('id_card'),
            address=data.get('address'),
            wechat=data.get('wechat'),
            remark=data.get('remark')
        )
        db.session.add(owner)
        db.session.commit()
        return owner

    @staticmethod
    def add_attachment(record_id, file_name, file_path, file_type, uploaded_by, file_size=None):
        attachment = RecordAttachment(
            medical_record_id=record_id,
            file_name=file_name,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            uploaded_by=uploaded_by
        )
        db.session.add(attachment)
        db.session.commit()
        return attachment

    @staticmethod
    def search_records(hospital_id=None, doctor_id=None, pet_id=None, status=None,
                       start_date=None, end_date=None, keyword=None,
                       page=1, per_page=20):
        query = MedicalRecord.query

        if hospital_id:
            query = query.filter_by(hospital_id=hospital_id)
        if doctor_id:
            query = query.filter_by(doctor_id=doctor_id)
        if pet_id:
            query = query.filter_by(pet_id=pet_id)
        if status:
            query = query.filter_by(status=status)
        if start_date:
            query = query.filter(MedicalRecord.visit_date >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(MedicalRecord.visit_date <= datetime.fromisoformat(end_date))
        if keyword:
            like = f'%{keyword}%'
            query = query.join(Pet, MedicalRecord.pet_id == Pet.id).join(Owner, Pet.owner_id == Owner.id).filter(
                or_(Pet.name.ilike(like), Owner.name.ilike(like), Owner.phone.ilike(like),
                    MedicalRecord.chief_complaint.ilike(like), MedicalRecord.diagnosis.ilike(like))
            )

        total = query.count()
        records = query.order_by(desc(MedicalRecord.visit_date)).offset((page - 1) * per_page).limit(per_page).all()
        return {
            'total': total,
            'page': page,
            'per_page': per_page,
            'items': [r.to_dict() for r in records]
        }
