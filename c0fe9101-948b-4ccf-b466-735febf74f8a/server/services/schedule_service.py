import random
from datetime import datetime, timedelta, date, time
from collections import defaultdict
from sqlalchemy import and_, desc
from models import db, Schedule, User, Hospital
from services.auth_service import create_notification


SHIFT_TIMES = {
    'morning': (time(8, 0), time(14, 0)),
    'afternoon': (time(14, 0), time(20, 0)),
    'night': (time(20, 0), time(8, 0)),
    'day_off': (None, None),
    'on_call': (time(8, 0), time(20, 0)),
    'emergency': (time(0, 0), time(23, 59))
}

SHIFT_HOURS = {
    'morning': 6,
    'afternoon': 6,
    'night': 12,
    'day_off': 0,
    'on_call': 12,
    'emergency': 24
}

EMERGENCY_KEYWORDS = ['急诊', 'emergency', '急救', '24h', '夜诊']
ICU_KEYWORDS = ['icu', '重症', 'intensive', '监护']


class ScheduleService:

    @staticmethod
    def _is_emergency_certified(user):
        if not user.qualification:
            return False
        q = user.qualification.lower()
        return any(kw in q for kw in EMERGENCY_KEYWORDS)

    @staticmethod
    def _is_icu_certified(user):
        if not user.qualification:
            return False
        q = user.qualification.lower()
        return any(kw in q for kw in ICU_KEYWORDS)

    @staticmethod
    def _get_week_dates(start_date=None):
        if start_date is None:
            today = date.today()
            start_date = today - timedelta(days=today.weekday())
        elif isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date).date()
        return [start_date + timedelta(days=i) for i in range(7)]

    @staticmethod
    def get_schedules(hospital_id=None, user_id=None, department=None,
                      start_date=None, end_date=None, shift_type=None,
                      include_emergency_only=False):
        query = Schedule.query
        if hospital_id:
            query = query.filter_by(hospital_id=hospital_id)
        if user_id:
            query = query.filter_by(user_id=user_id)
        if department:
            query = query.filter_by(department=department)
        if shift_type:
            query = query.filter_by(shift_type=shift_type)
        if start_date:
            sd = datetime.fromisoformat(start_date).date() if isinstance(start_date, str) else start_date
            query = query.filter(Schedule.shift_date >= sd)
        if end_date:
            ed = datetime.fromisoformat(end_date).date() if isinstance(end_date, str) else end_date
            query = query.filter(Schedule.shift_date <= ed)
        if include_emergency_only:
            query = query.filter_by(is_emergency_duty=True)

        schedules = query.order_by(Schedule.shift_date, Schedule.shift_type).all()
        return [s.to_dict() for s in schedules]

    @staticmethod
    def get_week_schedule_matrix(hospital_id=None, start_date=None, department=None):
        dates = ScheduleService._get_week_dates(start_date)
        users_query = User.query.filter_by(is_active=True)
        if hospital_id:
            users_query = users_query.filter_by(hospital_id=hospital_id)
        if department:
            users_query = users_query.filter(User.department == department)
        users = users_query.filter(User.role.in_(['doctor', 'nurse', 'lab_tech'])).order_by(User.role, User.real_name).all()

        schedule_map = {}
        for s in ScheduleService.get_schedules(hospital_id=hospital_id, start_date=dates[0].isoformat(), end_date=dates[-1].isoformat()):
            key = (s['user_id'], s['shift_date'])
            schedule_map[key] = s

        matrix = []
        for user in users:
            row = {
                'user_id': user.id,
                'user_name': user.real_name,
                'role': user.role,
                'department': user.department,
                'weekly_hours': 0,
                'days': []
            }
            for d in dates:
                key = (user.id, d.isoformat())
                s = schedule_map.get(key)
                if s:
                    row['weekly_hours'] += SHIFT_HOURS.get(s['shift_type'], 0)
                row['days'].append({
                    'date': d.isoformat(),
                    'weekday': d.strftime('%A'),
                    'schedule': s
                })
            matrix.append(row)

        summary = defaultdict(lambda: defaultdict(int))
        for d in dates:
            date_str = d.isoformat()
            for user in users:
                key = (user.id, date_str)
                s = schedule_map.get(key)
                if s:
                    summary[date_str][s['shift_type']] += 1
                    summary[date_str]['total'] += 1
                    if s.get('is_emergency_duty'):
                        summary[date_str]['emergency'] += 1

        return {
            'dates': [{'date': d.isoformat(), 'weekday': d.strftime('%A'), 'day': d.day} for d in dates],
            'matrix': matrix,
            'daily_summary': {k: dict(v) for k, v in summary.items()}
        }

    @staticmethod
    def generate_auto_schedule(hospital_id, start_date=None):
        dates = ScheduleService._get_week_dates(start_date)
        users = User.query.filter_by(
            hospital_id=hospital_id, is_active=True
        ).filter(User.role.in_(['doctor', 'nurse', 'lab_tech'])).all()

        hospital = Hospital.query.get(hospital_id)
        is_emergency_hospital = hospital and hospital.type == 'emergency_24h'

        emergency_certified = [u for u in users if ScheduleService._is_emergency_certified(u)]
        icu_certified = [u for u in users if ScheduleService._is_icu_certified(u)]

        existing = Schedule.query.filter(
            Schedule.hospital_id == hospital_id,
            Schedule.shift_date.between(dates[0], dates[-1])
        ).all()
        existing_keys = {(s.user_id, s.shift_date): s for s in existing}

        user_weekly_hours = defaultdict(int)
        user_daily_assigned = defaultdict(set)
        user_night_count = defaultdict(int)
        for s in existing:
            user_weekly_hours[s.user_id] += SHIFT_HOURS.get(s.shift_type, 0)
            user_daily_assigned[s.user_id].add(s.shift_date)
            if s.shift_type == 'night':
                user_night_count[s.user_id] += 1

        day_shifts = ['morning', 'afternoon']
        rotation_len = len(day_shifts)

        created_count = 0
        warnings = []
        night_coverage = defaultdict(int)

        for day_idx, d in enumerate(dates):
            is_weekend = day_idx >= 5
            for user in users:
                key = (user.id, d)
                if key in existing_keys:
                    continue

                max_hours = user.weekly_max_hours or 48
                current_hours = user_weekly_hours[user.id]

                if is_weekend and current_hours >= 40:
                    shift = 'day_off'
                elif is_weekend:
                    shift = 'day_off'
                else:
                    base_idx = user.id % rotation_len
                    candidate = day_shifts[(base_idx + day_idx) % rotation_len]

                    if current_hours + SHIFT_HOURS.get(candidate, 0) > max_hours:
                        shift = 'day_off'
                    else:
                        shift = candidate

                if shift in ('morning', 'afternoon') and current_hours + SHIFT_HOURS.get(shift, 0) > max_hours:
                    shift = 'day_off'

                start_time, end_time = SHIFT_TIMES.get(shift, (None, None))
                is_emergency = False

                schedule = Schedule(
                    user_id=user.id,
                    hospital_id=hospital_id,
                    shift_date=d,
                    shift_type=shift,
                    start_time=start_time,
                    end_time=end_time,
                    department=user.department,
                    is_emergency_duty=is_emergency,
                    status='draft'
                )
                db.session.add(schedule)
                user_weekly_hours[user.id] += SHIFT_HOURS.get(shift, 0)
                user_daily_assigned[user.id].add(d)
                created_count += 1

        if emergency_certified:
            for day_idx, d in enumerate(dates):
                assigned_night = False
                for user in emergency_certified:
                    max_hours = user.weekly_max_hours or 48
                    if user_weekly_hours[user.id] + SHIFT_HOURS['night'] > max_hours:
                        continue
                    if d in user_daily_assigned[user.id]:
                        existing_s = existing_keys.get((user.id, d))
                        if existing_s and existing_s.shift_type in ('morning', 'afternoon', 'night', 'emergency'):
                            assigned_night = True
                            night_coverage[d.isoformat()] += 1
                            break
                        continue
                    if user_night_count[user.id] >= 3:
                        continue

                    conflict = existing_keys.get((user.id, d))
                    if conflict:
                        db.session.delete(conflict)
                        user_weekly_hours[user.id] -= SHIFT_HOURS.get(conflict.shift_type, 0)
                        existing_keys.pop((user.id, d), None)

                    schedule = Schedule(
                        user_id=user.id,
                        hospital_id=hospital_id,
                        shift_date=d,
                        shift_type='night',
                        start_time=SHIFT_TIMES['night'][0],
                        end_time=SHIFT_TIMES['night'][1],
                        department=user.department,
                        is_emergency_duty=True,
                        status='draft'
                    )
                    db.session.add(schedule)
                    user_weekly_hours[user.id] += SHIFT_HOURS['night']
                    user_daily_assigned[user.id].add(d)
                    user_night_count[user.id] += 1
                    night_coverage[d.isoformat()] += 1
                    created_count += 1
                    assigned_night = True
                    break

                if not assigned_night:
                    warnings.append(f'{d.isoformat()} 夜班无可用急诊资质人员')
        else:
            for d in dates:
                warnings.append(f'{d.isoformat()} 无急诊资质医生，夜班排班受限')

        if is_emergency_hospital:
            for day_idx, d in enumerate(dates):
                has_24h = any(
                    s.shift_type == 'emergency'
                    for s in Schedule.query.filter_by(
                        hospital_id=hospital_id, shift_date=d, status='draft'
                    ).all()
                )
                if not has_24h and emergency_certified:
                    for user in emergency_certified:
                        max_hours = user.weekly_max_hours or 48
                        if user_weekly_hours[user.id] + SHIFT_HOURS['emergency'] > max_hours:
                            continue
                        schedule = Schedule(
                            user_id=user.id,
                            hospital_id=hospital_id,
                            shift_date=d,
                            shift_type='emergency',
                            start_time=SHIFT_TIMES['emergency'][0],
                            end_time=SHIFT_TIMES['emergency'][1],
                            department=user.department,
                            is_emergency_duty=True,
                            status='draft'
                        )
                        db.session.add(schedule)
                        user_weekly_hours[user.id] += SHIFT_HOURS['emergency']
                        created_count += 1
                        break

        db.session.commit()
        return {
            'created': created_count,
            'existing': len(existing),
            'dates': [d.isoformat() for d in dates],
            'warnings': warnings,
            'emergency_certified_count': len(emergency_certified),
            'icu_certified_count': len(icu_certified),
            'night_coverage': dict(night_coverage)
        }

    @staticmethod
    def create_or_update_schedule(data):
        shift_date = datetime.fromisoformat(data['shift_date']).date() if isinstance(data['shift_date'], str) else data['shift_date']
        existing = Schedule.query.filter_by(
            user_id=data['user_id'],
            shift_date=shift_date
        ).first()

        start_time, end_time = SHIFT_TIMES.get(data.get('shift_type', 'morning'), (None, None))

        if existing:
            for key, value in data.items():
                if hasattr(existing, key) and key not in ('id', 'created_at', 'updated_at'):
                    if key == 'shift_date':
                        continue
                    setattr(existing, key, value)
            existing.start_time = start_time
            existing.end_time = end_time
            existing.status = 'confirmed'
            db.session.commit()
            return existing

        schedule = Schedule(
            user_id=data['user_id'],
            hospital_id=data['hospital_id'],
            shift_date=shift_date,
            shift_type=data.get('shift_type', 'morning'),
            start_time=start_time,
            end_time=end_time,
            department=data.get('department'),
            is_emergency_duty=data.get('is_emergency_duty', False),
            status=data.get('status', 'confirmed'),
            remark=data.get('remark')
        )
        db.session.add(schedule)
        db.session.commit()
        return schedule

    @staticmethod
    def swap_schedule(schedule_id, swap_with_id, requester_id):
        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return None, '排班不存在'

        target_shift_date = schedule.shift_date
        other = Schedule.query.filter_by(
            user_id=swap_with_id, shift_date=target_shift_date
        ).first()

        schedule.swap_with_id = swap_with_id
        schedule.status = 'swapped'

        if other:
            other.user_id = schedule.user_id
        else:
            new_s = Schedule(
                user_id=schedule.user_id,
                hospital_id=schedule.hospital_id,
                shift_date=target_shift_date,
                shift_type=schedule.shift_type,
                start_time=schedule.start_time,
                end_time=schedule.end_time,
                department=schedule.department,
                status='confirmed',
                remark=f'与#{schedule_id}换班'
            )
            db.session.add(new_s)

        schedule.user_id = swap_with_id

        db.session.commit()

        create_notification(
            user_id=swap_with_id,
            type='schedule',
            title='排班换班通知',
            content=f'您与他人的{target_shift_date}排班已完成调换',
            related_type='Schedule',
            related_id=schedule.id
        )

        return schedule, None

    @staticmethod
    def delete_schedule(schedule_id):
        schedule = Schedule.query.get(schedule_id)
        if schedule:
            db.session.delete(schedule)
            db.session.commit()
            return True
        return False

    @staticmethod
    def find_emergency_on_call(hospital_id, target_datetime=None):
        if target_datetime is None:
            target_datetime = datetime.utcnow()
        target_date = target_datetime.date()
        target_time = target_datetime.time()

        on_call = Schedule.query.filter(
            Schedule.hospital_id == hospital_id,
            Schedule.shift_date == target_date,
            Schedule.status == 'confirmed'
        ).all()

        matching = []
        for s in on_call:
            if s.is_emergency_duty or s.shift_type in ('night', 'emergency'):
                start, end = s.start_time, s.end_time
                if start and end:
                    if start <= end:
                        in_shift = start <= target_time <= end
                    else:
                        in_shift = target_time >= start or target_time <= end
                    if in_shift:
                        matching.append(s)

        if not matching:
            matching = [s for s in on_call if s.shift_type in ('morning', 'afternoon', 'on_call')]

        matching.sort(key=lambda s: (s.user.role != 'doctor', s.user.role != 'nurse'))
        return [s.to_dict() for s in matching]

    @staticmethod
    def find_nearest_emergency_doctor(latitude, longitude, radius_km=20):
        hospitals = Hospital.query.filter_by(type='emergency_24h', is_active=True).all()
        import math
        def haversine(lat1, lon1, lat2, lon2):
            R = 6371
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
            return R * 2 * math.asin(math.sqrt(a))

        hospitals_with_dist = []
        for h in hospitals:
            if h.latitude and h.longitude:
                dist = haversine(latitude, longitude, h.latitude, h.longitude)
                if dist <= radius_km:
                    hospitals_with_dist.append((h, dist))
        hospitals_with_dist.sort(key=lambda x: x[1])

        results = []
        for hospital, dist in hospitals_with_dist[:5]:
            doctors = ScheduleService.find_emergency_on_call(hospital.id)
            results.append({
                'hospital': hospital.to_dict(),
                'distance_km': round(dist, 2),
                'on_call_staff': doctors
            })
        return results

    @staticmethod
    def publish_week_schedule(hospital_id, start_date=None):
        dates = ScheduleService._get_week_dates(start_date)
        schedules = Schedule.query.filter(
            Schedule.hospital_id == hospital_id,
            Schedule.shift_date.between(dates[0], dates[-1]),
            Schedule.status == 'draft'
        ).all()

        user_ids = set()
        for s in schedules:
            s.status = 'confirmed'
            user_ids.add(s.user_id)

        db.session.commit()

        from services.auth_service import batch_create_notifications
        batch_create_notifications(
            user_ids=list(user_ids),
            type='schedule',
            title='新排班已发布',
            content=f'{dates[0].isoformat()} ~ {dates[-1].isoformat()} 的排班已确认发布',
            priority='normal'
        )

        return len(schedules)
