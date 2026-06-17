from datetime import datetime, timedelta
from sqlalchemy import and_, or_, desc
from models import db, Cage, Hospitalization, Pet, Hospital, User
from services.auth_service import create_notification


class HospitalizationService:

    @staticmethod
    def get_cages_by_hospital(hospital_id, include_hospitalization=False):
        cages = Cage.query.filter_by(hospital_id=hospital_id).order_by(Cage.zone, Cage.code).all()
        return [c.to_dict(include_current_hospitalization=include_hospitalization) for c in cages]

    @staticmethod
    def get_cage_grid(hospital_id):
        cages = Cage.query.filter_by(hospital_id=hospital_id).order_by(Cage.zone, Cage.code).all()
        zones = {}
        for cage in cages:
            if cage.zone not in zones:
                zones[cage.zone] = {
                    'zone': cage.zone,
                    'cages': [],
                    'stats': {'total': 0, 'available': 0, 'occupied': 0, 'reserved': 0, 'cleaning': 0, 'maintenance': 0}
                }
            cage_data = cage.to_dict(include_current_hospitalization=True)
            zones[cage.zone]['cages'].append(cage_data)
            zones[cage.zone]['stats']['total'] += 1
            zones[cage.zone]['stats'][cage.status] += 1

        summary = {
            'total': len(cages),
            'available': sum(1 for c in cages if c.status == 'available'),
            'occupied': sum(1 for c in cages if c.status == 'occupied'),
            'reserved': sum(1 for c in cages if c.status == 'reserved'),
            'cleaning': sum(1 for c in cages if c.status == 'cleaning'),
            'maintenance': sum(1 for c in cages if c.status == 'maintenance')
        }
        return {'zones': list(zones.values()), 'summary': summary}

    @staticmethod
    def check_cage_conflict(cage_id, start_date, end_date, exclude_hospitalization_id=None):
        query = Hospitalization.query.filter(
            Hospitalization.cage_id == cage_id,
            Hospitalization.status.in_(['reserved', 'admitted'])
        )
        if exclude_hospitalization_id:
            query = query.filter(Hospitalization.id != exclude_hospitalization_id)

        start_dt = datetime.fromisoformat(start_date) if isinstance(start_date, str) else start_date
        end_dt = datetime.fromisoformat(end_date) if isinstance(end_date, str) else end_date

        for h in query.all():
            h_start = h.admission_date or h.created_at
            h_end = h.expected_discharge_date or (h_start + timedelta(days=7))
            if start_dt < h_end and end_dt > h_start:
                return True, h
        return False, None

    @staticmethod
    def create_hospitalization(data, current_user_id=None):
        cage = Cage.query.get(data.get('cage_id'))
        if not cage:
            return None, '笼位不存在'

        if cage.status not in ('available', 'reserved'):
            return None, f'笼位状态为{cage.status}，不可分配'

        admission_date = datetime.fromisoformat(data['admission_date']) if data.get('admission_date') else datetime.utcnow()
        expected_discharge = datetime.fromisoformat(data['expected_discharge_date']) if data.get('expected_discharge_date') else (admission_date + timedelta(days=7))

        conflict, conflict_h = HospitalizationService.check_cage_conflict(
            data['cage_id'], admission_date.isoformat(), expected_discharge.isoformat()
        )
        if conflict:
            return None, f'笼位与{conflict_h.id}号住院记录冲突'

        hospitalization = Hospitalization(
            pet_id=data.get('pet_id'),
            medical_record_id=data.get('medical_record_id'),
            cage_id=data.get('cage_id'),
            hospital_id=cage.hospital_id,
            admitting_doctor_id=data.get('admitting_doctor_id', current_user_id),
            status=data.get('status', 'reserved'),
            admission_reason=data.get('admission_reason'),
            admission_date=admission_date,
            expected_discharge_date=expected_discharge,
            daily_notes=data.get('daily_notes'),
            is_emergency=data.get('is_emergency', False)
        )
        cage.status = 'occupied' if hospitalization.status == 'admitted' else 'reserved'

        db.session.add(hospitalization)
        db.session.commit()
        return hospitalization, None

    @staticmethod
    def assign_emergency_cage(hospital_id, pet_id, medical_record_id=None):
        available_cages = Cage.query.filter(
            Cage.hospital_id == hospital_id,
            Cage.status == 'available',
            Cage.type.in_(['emergency', 'ICU'])
        ).order_by(Cage.type).all()

        if not available_cages:
            available_cages = Cage.query.filter(
                Cage.hospital_id == hospital_id,
                Cage.status == 'available'
            ).all()

        if not available_cages:
            return None, '无可用笼位'

        cage = available_cages[0]
        data = {
            'pet_id': pet_id,
            'medical_record_id': medical_record_id,
            'cage_id': cage.id,
            'status': 'admitted',
            'is_emergency': True,
            'admission_reason': '急诊入院',
            'admission_date': datetime.utcnow().isoformat()
        }
        return HospitalizationService.create_hospitalization(data)

    @staticmethod
    def update_hospitalization(hospitalization_id, data):
        h = Hospitalization.query.get(hospitalization_id)
        if not h:
            return None, '记录不存在'

        old_status = h.status
        for key, value in data.items():
            if hasattr(h, key) and key not in ('id', 'created_at', 'updated_at'):
                if key in ('admission_date', 'expected_discharge_date', 'actual_discharge_date') and value:
                    setattr(h, key, datetime.fromisoformat(value))
                else:
                    setattr(h, key, value)

        if data.get('status') and data['status'] != old_status:
            cage = Cage.query.get(h.cage_id)
            if cage:
                if data['status'] == 'discharged':
                    cage.status = 'cleaning'
                    h.actual_discharge_date = datetime.utcnow()
                elif data['status'] == 'admitted':
                    cage.status = 'occupied'
                    if not h.admission_date:
                        h.admission_date = datetime.utcnow()
                elif data['status'] == 'cancelled':
                    cage.status = 'available'

        db.session.commit()
        return h, None

    @staticmethod
    def get_active_hospitalizations(hospital_id=None, status=None, page=1, per_page=50):
        query = Hospitalization.query
        if hospital_id:
            query = query.filter_by(hospital_id=hospital_id)
        if status:
            query = query.filter_by(status=status)
        else:
            query = query.filter(Hospitalization.status.in_(['reserved', 'admitted']))

        total = query.count()
        records = query.order_by(desc(Hospitalization.created_at)).offset((page - 1) * per_page).limit(per_page).all()
        return {
            'total': total,
            'page': page,
            'per_page': per_page,
            'items': [r.to_dict() for r in records]
        }

    @staticmethod
    def get_upcoming_discharges(hospital_id=None, days=3):
        threshold = datetime.utcnow() + timedelta(days=days)
        query = Hospitalization.query.filter(
            Hospitalization.status == 'admitted',
            Hospitalization.expected_discharge_date <= threshold
        )
        if hospital_id:
            query = query.filter_by(hospital_id=hospital_id)
        records = query.order_by(Hospitalization.expected_discharge_date).all()
        return [r.to_dict() for r in records]

    @staticmethod
    def update_cage_status(cage_id, status, remark=None):
        cage = Cage.query.get(cage_id)
        if not cage:
            return None
        cage.status = status
        if remark is not None:
            cage.remark = remark
        db.session.commit()
        return cage

    @staticmethod
    def create_cage(data):
        existing = Cage.query.filter_by(hospital_id=data['hospital_id'], code=data['code']).first()
        if existing:
            return None, '笼位编号已存在'
        cage = Cage(
            hospital_id=data['hospital_id'],
            zone=data.get('zone', '默认区'),
            code=data['code'],
            type=data.get('type', 'standard'),
            size=data.get('size', 'medium'),
            status=data.get('status', 'available'),
            remark=data.get('remark')
        )
        db.session.add(cage)
        db.session.commit()
        return cage, None
