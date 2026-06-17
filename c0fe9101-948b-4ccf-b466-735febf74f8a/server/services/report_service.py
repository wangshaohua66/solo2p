from datetime import datetime, timedelta, date
from collections import defaultdict
from sqlalchemy import func, and_, case, extract
from models import (
    db, MedicalRecord, Hospital, User, Prescription, PrescriptionItem,
    Medicine, LabResult, Hospitalization, Schedule, Cage, LabResultItem, Pet
)


class ReportService:

    @staticmethod
    def _parse_date_range(start_date=None, end_date=None):
        today = date.today()
        if end_date is None:
            end_date = today
        elif isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date).date()
        if start_date is None:
            start_date = today - timedelta(days=29)
        elif isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date).date()
        return start_date, end_date

    @staticmethod
    def get_board_summary(hospital_id=None, start_date=None, end_date=None):
        start_date, end_date = ReportService._parse_date_range(start_date, end_date)
        previous_start = start_date - (end_date - start_date)

        def _stats(sd, ed):
            records_q = MedicalRecord.query.filter(
                MedicalRecord.visit_date >= datetime.combine(sd, datetime.min.time()),
                MedicalRecord.visit_date <= datetime.combine(ed, datetime.max.time())
            )
            if hospital_id:
                records_q = records_q.filter_by(hospital_id=hospital_id)
            visit_count = records_q.count()

            pet_ids = records_q.with_entities(MedicalRecord.pet_id).distinct().all()
            pet_count = len(pet_ids)

            revisit_q = records_q.group_by(MedicalRecord.pet_id).having(func.count(MedicalRecord.id) > 1)
            revisit_count = revisit_q.count()

            pres_q = Prescription.query.filter(
                Prescription.status == 'dispensed',
                Prescription.dispense_date >= datetime.combine(sd, datetime.min.time()),
                Prescription.dispense_date <= datetime.combine(ed, datetime.max.time())
            )
            if hospital_id:
                pres_q = pres_q.filter_by(hospital_id=hospital_id)
            revenue = pres_q.with_entities(func.coalesce(func.sum(Prescription.total_amount), 0)).scalar() or 0
            prescription_count = pres_q.count()

            lab_q = LabResult.query.filter(
                LabResult.created_at >= datetime.combine(sd, datetime.min.time()),
                LabResult.created_at <= datetime.combine(ed, datetime.max.time())
            )
            if hospital_id:
                lab_q = lab_q.filter_by(hospital_id=hospital_id)
            lab_count = lab_q.count()
            abnormal_count = lab_q.join(LabResultItem).filter(LabResultItem.is_abnormal == True).count()

            return {
                'visits': visit_count,
                'unique_pets': pet_count,
                'revisits': revisit_count,
                'revisit_rate': round((revisit_count / pet_count * 100) if pet_count > 0 else 0, 1),
                'revenue': round(float(revenue), 2),
                'prescriptions': prescription_count,
                'lab_tests': lab_count,
                'abnormal_lab_rate': round((abnormal_count / lab_count * 100) if lab_count > 0 else 0, 1)
            }

        current = _stats(start_date, end_date)
        previous = _stats(previous_start, start_date - timedelta(days=1))

        comparison = {}
        for k in current:
            if isinstance(current[k], (int, float)) and previous[k] != 0:
                comparison[f'{k}_yoy'] = round((current[k] - previous[k]) / previous[k] * 100, 1)
            else:
                comparison[f'{k}_yoy'] = None

        active_cages_q = Cage.query
        if hospital_id:
            active_cages_q = active_cages_q.filter_by(hospital_id=hospital_id)
        total_cages = active_cages_q.count()
        occupied_cages = active_cages_q.filter(Cage.status.in_(['occupied', 'reserved'])).count()

        hosp_active_q = Hospitalization.query.filter(Hospitalization.status.in_(['admitted', 'reserved']))
        if hospital_id:
            hosp_active_q = hosp_active_q.filter_by(hospital_id=hospital_id)
        active_hospitalizations = hosp_active_q.count()

        doctors_q = User.query.filter_by(is_active=True, role='doctor')
        if hospital_id:
            doctors_q = doctors_q.filter_by(hospital_id=hospital_id)
        doctors_on_duty = doctors_q.count()

        return {
            'current': current,
            'previous': previous,
            'comparison': comparison,
            'realtime': {
                'total_cages': total_cages,
                'occupied_cages': occupied_cages,
                'cage_occupancy': round((occupied_cages / total_cages * 100) if total_cages > 0 else 0, 1),
                'active_hospitalizations': active_hospitalizations,
                'doctors_on_duty': doctors_on_duty
            },
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            }
        }

    @staticmethod
    def get_daily_visits_trend(hospital_id=None, days=30):
        end_date = date.today()
        start_date = end_date - timedelta(days=days - 1)

        daily = defaultdict(lambda: {'visits': 0, 'revenue': 0.0, 'emergency': 0})

        records = MedicalRecord.query.filter(
            MedicalRecord.visit_date >= datetime.combine(start_date, datetime.min.time()),
            MedicalRecord.visit_date <= datetime.combine(end_date, datetime.max.time())
        )
        if hospital_id:
            records = records.filter_by(hospital_id=hospital_id)
        for r in records.all():
            d = r.visit_date.date().isoformat()
            daily[d]['visits'] += 1
            if r.visit_type == 'emergency':
                daily[d]['emergency'] += 1

        pres = Prescription.query.filter(
            Prescription.status == 'dispensed',
            Prescription.dispense_date >= datetime.combine(start_date, datetime.min.time()),
            Prescription.dispense_date <= datetime.combine(end_date, datetime.max.time())
        )
        if hospital_id:
            pres = pres.filter_by(hospital_id=hospital_id)
        for p in pres.all():
            d = p.dispense_date.date().isoformat()
            daily[d]['revenue'] += float(p.total_amount or 0)

        trend = []
        for i in range(days):
            d = (start_date + timedelta(days=i)).isoformat()
            data = daily.get(d, {'visits': 0, 'revenue': 0.0, 'emergency': 0})
            trend.append({
                'date': d,
                'visits': data['visits'],
                'revenue': round(data['revenue'], 2),
                'emergency': data['emergency']
            })

        return trend

    @staticmethod
    def get_hospital_comparison(start_date=None, end_date=None):
        start_date, end_date = ReportService._parse_date_range(start_date, end_date)
        hospitals = Hospital.query.filter_by(is_active=True).all()

        results = []
        for h in hospitals:
            stats = ReportService.get_board_summary(
                hospital_id=h.id,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat()
            )
            results.append({
                'hospital_id': h.id,
                'hospital_name': h.name,
                'hospital_type': h.type,
                **stats['current']
            })
        return results

    @staticmethod
    def get_department_breakdown(hospital_id=None, start_date=None, end_date=None):
        start_date, end_date = ReportService._parse_date_range(start_date, end_date)

        query = MedicalRecord.query.filter(
            MedicalRecord.visit_date >= datetime.combine(start_date, datetime.min.time()),
            MedicalRecord.visit_date <= datetime.combine(end_date, datetime.max.time())
        )
        if hospital_id:
            query = query.filter_by(hospital_id=hospital_id)

        dept_stats = defaultdict(lambda: {'visits': 0, 'revenue': 0.0})

        records = query.all()
        record_ids = [r.id for r in records]

        revenue_map = defaultdict(float)
        if record_ids:
            pres_rows = db.session.query(
                Prescription.medical_record_id,
                func.sum(Prescription.total_amount)
            ).filter(
                Prescription.medical_record_id.in_(record_ids),
                Prescription.status == 'dispensed'
            ).group_by(Prescription.medical_record_id).all()
            for rid, rev in pres_rows:
                revenue_map[rid] = float(rev or 0)

        for r in records:
            dept = r.department or '未分类'
            dept_stats[dept]['visits'] += 1
            dept_stats[dept]['revenue'] += revenue_map.get(r.id, 0)

        return [
            {
                'department': k,
                'visits': v['visits'],
                'revenue': round(v['revenue'], 2),
                'avg_revenue': round(v['revenue'] / v['visits'], 2) if v['visits'] > 0 else 0
            }
            for k, v in dept_stats.items()
        ]

    @staticmethod
    def get_doctor_ranking(hospital_id=None, start_date=None, end_date=None, limit=10):
        start_date, end_date = ReportService._parse_date_range(start_date, end_date)

        query = MedicalRecord.query.filter(
            MedicalRecord.visit_date >= datetime.combine(start_date, datetime.min.time()),
            MedicalRecord.visit_date <= datetime.combine(end_date, datetime.max.time()),
            MedicalRecord.doctor_id.isnot(None)
        )
        if hospital_id:
            query = query.filter_by(hospital_id=hospital_id)

        records = query.all()
        doc_stats = defaultdict(lambda: {'visits': 0, 'record_ids': []})
        for r in records:
            doc_stats[r.doctor_id]['visits'] += 1
            doc_stats[r.doctor_id]['record_ids'].append(r.id)

        doctor_ids = list(doc_stats.keys())
        revenue_map = defaultdict(float)
        for doc_id in doctor_ids:
            rids = doc_stats[doc_id]['record_ids']
            if rids:
                rev = db.session.query(func.sum(Prescription.total_amount)).filter(
                    Prescription.medical_record_id.in_(rids),
                    Prescription.status == 'dispensed'
                ).scalar() or 0
                revenue_map[doc_id] = float(rev)

        ranking = []
        for doc_id, stats in doc_stats.items():
            user = User.query.get(doc_id)
            if not user:
                continue
            ranking.append({
                'doctor_id': doc_id,
                'doctor_name': user.real_name,
                'department': user.department,
                'hospital_name': user.hospital.name if user.hospital else None,
                'visits': stats['visits'],
                'revenue': round(revenue_map[doc_id], 2),
                'avg_revenue': round(revenue_map[doc_id] / stats['visits'], 2) if stats['visits'] > 0 else 0
            })

        ranking.sort(key=lambda x: x['visits'], reverse=True)
        return ranking[:limit]

    @staticmethod
    def get_medicine_consumption(hospital_id=None, start_date=None, end_date=None, limit=20):
        start_date, end_date = ReportService._parse_date_range(start_date, end_date)

        pres_query = Prescription.query.filter(
            Prescription.status == 'dispensed',
            Prescription.dispense_date >= datetime.combine(start_date, datetime.min.time()),
            Prescription.dispense_date <= datetime.combine(end_date, datetime.max.time())
        )
        if hospital_id:
            pres_query = pres_query.filter_by(hospital_id=hospital_id)
        pres_ids = [p.id for p in pres_query.all()]

        consumption = defaultdict(lambda: {'quantity': 0, 'amount': 0.0})
        if pres_ids:
            items = PrescriptionItem.query.filter(PrescriptionItem.prescription_id.in_(pres_ids)).all()
            for item in items:
                consumption[item.medicine_id]['quantity'] += float(item.quantity or 0)
                consumption[item.medicine_id]['amount'] += float(item.subtotal or 0)

        results = []
        for med_id, stats in consumption.items():
            med = Medicine.query.get(med_id)
            if not med:
                continue
            results.append({
                'medicine_id': med_id,
                'medicine_name': med.name,
                'spec': med.spec,
                'category': med.category,
                'quantity': round(stats['quantity'], 2),
                'amount': round(stats['amount'], 2)
            })

        results.sort(key=lambda x: x['amount'], reverse=True)
        return results[:limit]

    @staticmethod
    def get_monthly_comparison(hospital_id=None, year=None):
        if year is None:
            year = date.today().year

        monthly = defaultdict(lambda: {'visits': 0, 'revenue': 0.0, 'prescriptions': 0, 'lab_tests': 0})

        records = MedicalRecord.query.filter(extract('year', MedicalRecord.visit_date) == year)
        if hospital_id:
            records = records.filter_by(hospital_id=hospital_id)
        for r in records.all():
            m = r.visit_date.month
            monthly[m]['visits'] += 1

        pres = Prescription.query.filter(
            Prescription.status == 'dispensed',
            extract('year', Prescription.dispense_date) == year
        )
        if hospital_id:
            pres = pres.filter_by(hospital_id=hospital_id)
        for p in pres.all():
            m = p.dispense_date.month
            monthly[m]['revenue'] += float(p.total_amount or 0)
            monthly[m]['prescriptions'] += 1

        labs = LabResult.query.filter(extract('year', LabResult.created_at) == year)
        if hospital_id:
            labs = labs.filter_by(hospital_id=hospital_id)
        for l in labs.all():
            m = l.created_at.month
            monthly[m]['lab_tests'] += 1

        return [
            {
                'month': m,
                'visits': monthly[m]['visits'],
                'revenue': round(monthly[m]['revenue'], 2),
                'prescriptions': monthly[m]['prescriptions'],
                'lab_tests': monthly[m]['lab_tests']
            }
            for m in range(1, 13)
        ]

    @staticmethod
    def get_quality_metrics(hospital_id=None, start_date=None, end_date=None):
        start_date, end_date = ReportService._parse_date_range(start_date, end_date)

        records_q = MedicalRecord.query.filter(
            MedicalRecord.visit_date >= datetime.combine(start_date, datetime.min.time()),
            MedicalRecord.visit_date <= datetime.combine(end_date, datetime.max.time())
        )
        if hospital_id:
            records_q = records_q.filter_by(hospital_id=hospital_id)
        records = records_q.all()
        total_records = len(records)
        completed = sum(1 for r in records if r.status == 'completed')

        pres_q = Prescription.query
        if hospital_id:
            pres_q = pres_q.filter_by(hospital_id=hospital_id)
        all_pres = pres_q.all()
        total_pres = len(all_pres)
        pres_with_issue = sum(1 for p in all_pres if p.status in ('pending',))

        lab_q = LabResult.query.filter(
            LabResult.created_at >= datetime.combine(start_date, datetime.min.time()),
            LabResult.created_at <= datetime.combine(end_date, datetime.max.time())
        )
        if hospital_id:
            lab_q = lab_q.filter_by(hospital_id=hospital_id)
        labs = lab_q.all()
        total_labs = len(labs)
        reviewed = sum(1 for l in labs if l.status == 'reviewed')

        return {
            'record_completion_rate': round((completed / total_records * 100) if total_records > 0 else 0, 1),
            'prescription_issue_rate': round((pres_with_issue / total_pres * 100) if total_pres > 0 else 0, 1),
            'lab_review_rate': round((reviewed / total_labs * 100) if total_labs > 0 else 0, 1),
            'total_records': total_records,
            'completed_records': completed,
            'total_prescriptions': total_pres,
            'pending_prescriptions': pres_with_issue,
            'total_labs': total_labs,
            'reviewed_labs': reviewed
        }
