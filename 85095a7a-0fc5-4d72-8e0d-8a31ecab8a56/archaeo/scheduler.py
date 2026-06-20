from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from .logger import get_logger
from .models import (
    Assignment,
    Equipment,
    Person,
    PersonRole,
    Project,
    ScheduleConflict,
)
from . import db

logger = get_logger(__name__)


def detect_person_conflicts() -> List[ScheduleConflict]:
    conflicts: List[ScheduleConflict] = []
    assignments = db.list_assignments(assignment_type="person", limit=5000)
    person_assignments: Dict[int, List[Assignment]] = {}

    for a in assignments:
        if a.person_id:
            if a.person_id not in person_assignments:
                person_assignments[a.person_id] = []
            person_assignments[a.person_id].append(a)

    for person_id, person_assigns in person_assignments.items():
        person = db.get_person(person_id)
        if not person:
            continue

        sorted_assigns = sorted(
            [a for a in person_assigns if a.start_date and a.end_date],
            key=lambda x: x.start_date,
        )

        for i in range(len(sorted_assigns)):
            for j in range(i + 1, len(sorted_assigns)):
                a1 = sorted_assigns[i]
                a2 = sorted_assigns[j]

                if _date_overlap(a1.start_date, a1.end_date, a2.start_date, a2.end_date):
                    project_a = db.get_project(a1.project_id)
                    project_b = db.get_project(a2.project_id)

                    overlap_start = max(a1.start_date, a2.start_date)
                    overlap_end = min(a1.end_date, a2.end_date)

                    conflict = ScheduleConflict(
                        person_id=person_id,
                        name=person.name,
                        type="person",
                        project_a=project_a.name if project_a else f"项目{a1.project_id}",
                        project_b=project_b.name if project_b else f"项目{a2.project_id}",
                        start_date=overlap_start,
                        end_date=overlap_end,
                        suggestion=_generate_suggestion(person, a1, a2),
                    )
                    conflicts.append(conflict)

    logger.info(f"检测到 {len(conflicts)} 个人员冲突")
    return conflicts


def detect_equipment_conflicts() -> List[ScheduleConflict]:
    conflicts: List[ScheduleConflict] = []
    assignments = db.list_assignments(assignment_type="equipment", limit=5000)
    equip_assignments: Dict[int, List[Assignment]] = {}

    for a in assignments:
        if a.equipment_id:
            if a.equipment_id not in equip_assignments:
                equip_assignments[a.equipment_id] = []
            equip_assignments[a.equipment_id].append(a)

    for equip_id, equip_assigns in equip_assignments.items():
        equipment = db.get_equipment(equip_id)
        if not equipment:
            continue

        sorted_assigns = sorted(
            [a for a in equip_assigns if a.start_date and a.end_date],
            key=lambda x: x.start_date,
        )

        for i in range(len(sorted_assigns)):
            for j in range(i + 1, len(sorted_assigns)):
                a1 = sorted_assigns[i]
                a2 = sorted_assigns[j]

                if _date_overlap(a1.start_date, a1.end_date, a2.start_date, a2.end_date):
                    project_a = db.get_project(a1.project_id)
                    project_b = db.get_project(a2.project_id)

                    overlap_start = max(a1.start_date, a2.start_date)
                    overlap_end = min(a1.end_date, a2.end_date)

                    conflict = ScheduleConflict(
                        equipment_id=equip_id,
                        name=equipment.name,
                        type="equipment",
                        project_a=project_a.name if project_a else f"项目{a1.project_id}",
                        project_b=project_b.name if project_b else f"项目{a2.project_id}",
                        start_date=overlap_start,
                        end_date=overlap_end,
                        suggestion=f"设备 {equipment.name} 在两个项目间存在时间冲突",
                    )
                    conflicts.append(conflict)

    logger.info(f"检测到 {len(conflicts)} 个设备冲突")
    return conflicts


def _date_overlap(start1: date, end1: date, start2: date, end2: date) -> bool:
    return start1 <= end2 and start2 <= end1


def _generate_suggestion(person: Person, a1: Assignment, a2: Assignment) -> str:
    suggestions = []

    if a1.start_date < a2.start_date:
        if a1.end_date > a2.start_date:
            days_overlap = (min(a1.end_date, a2.end_date) - a2.start_date).days + 1
            suggestions.append(f"调整 {person.name} 在项目 {a1.project_id} 的结束日期提前 {days_overlap} 天")

    if a2.start_date < a1.start_date:
        if a2.end_date > a1.start_date:
            days_overlap = (min(a1.end_date, a2.end_date) - a1.start_date).days + 1
            suggestions.append(f"调整 {person.name} 在项目 {a2.project_id} 的结束日期提前 {days_overlap} 天")

    if not suggestions:
        suggestions.append("两个项目人员安排有重叠，建议协调时间或增派人手")

    return "; ".join(suggestions)


def get_person_schedule(person_id: int, start_date: Optional[date] = None,
                        end_date: Optional[date] = None) -> List[Dict[str, Any]]:
    person = db.get_person(person_id)
    if not person:
        return []

    assignments = db.list_assignments(person_id=person_id, limit=500)
    schedule = []

    for assignment in assignments:
        if start_date and assignment.end_date and assignment.end_date < start_date:
            continue
        if end_date and assignment.start_date and assignment.start_date > end_date:
            continue

        project = db.get_project(assignment.project_id)
        schedule.append({
            "assignment_id": assignment.id,
            "project_id": assignment.project_id,
            "project_name": project.name if project else "",
            "role": assignment.role,
            "start_date": assignment.start_date,
            "end_date": assignment.end_date,
            "notes": assignment.notes,
        })

    return sorted(schedule, key=lambda x: x["start_date"] or date.min)


def get_project_personnel(project_id: int) -> List[Dict[str, Any]]:
    assignments = db.list_assignments(project_id=project_id, assignment_type="person", limit=500)
    personnel = []

    for assignment in assignments:
        if assignment.person_id:
            person = db.get_person(assignment.person_id)
            if person:
                personnel.append({
                    "person_id": person.id,
                    "name": person.name,
                    "role": assignment.role or PersonRole.get_role_name(person.role),
                    "skills": person.skills,
                    "start_date": assignment.start_date,
                    "end_date": assignment.end_date,
                })

    return personnel


def get_available_persons(start_date: date, end_date: date, role: Optional[PersonRole] = None,
                          skills: Optional[List[str]] = None) -> List[Person]:
    all_persons = db.list_persons(role=role.value if role else None, limit=1000)
    available = []

    for person in all_persons:
        if person.status != "available":
            continue

        assignments = db.list_assignments(person_id=person.id, limit=500)
        is_available = True

        for assignment in assignments:
            if assignment.start_date and assignment.end_date:
                if _date_overlap(start_date, end_date, assignment.start_date, assignment.end_date):
                    is_available = False
                    break

        if is_available and skills:
            person_skills_lower = [s.lower() for s in person.skills]
            has_skills = all(
                any(skill.lower() in ps for ps in person_skills_lower)
                for skill in skills
            )
            if not has_skills:
                is_available = False

        if is_available:
            available.append(person)

    return available


def optimize_schedule(project_id: int) -> Dict[str, Any]:
    project = db.get_project(project_id)
    if not project:
        return {"error": "项目不存在"}

    person_conflicts = detect_person_conflicts()
    equip_conflicts = detect_equipment_conflicts()

    project_person_conflicts = [
        c for c in person_conflicts
        if project.name in (c.project_a, c.project_b)
    ]

    result = {
        "project_name": project.name,
        "total_person_conflicts": len(person_conflicts),
        "total_equipment_conflicts": len(equip_conflicts),
        "project_related_conflicts": len(project_person_conflicts),
        "conflict_details": project_person_conflicts,
        "suggestions": [],
    }

    if project_person_conflicts:
        result["suggestions"].append(f"本项目涉及 {len(project_person_conflicts)} 个人员冲突")
        for conflict in project_person_conflicts[:5]:
            result["suggestions"].append(conflict.suggestion)

    return result


def get_person_workload(person_id: int, year: Optional[int] = None) -> Dict[str, Any]:
    if year is None:
        year = date.today().year

    person = db.get_person(person_id)
    if not person:
        return {"error": "人员不存在"}

    assignments = db.list_assignments(person_id=person_id, limit=500)
    total_days = 0
    project_count = 0

    for assignment in assignments:
        if not assignment.start_date or not assignment.end_date:
            continue

        if assignment.start_date.year <= year <= assignment.end_date.year:
            year_start = date(year, 1, 1)
            year_end = date(year, 12, 31)
            actual_start = max(assignment.start_date, year_start)
            actual_end = min(assignment.end_date, year_end)
            days = (actual_end - actual_start).days + 1
            total_days += max(0, days)
            project_count += 1

    work_days_per_year = 250
    utilization_rate = (total_days / work_days_per_year * 100) if work_days_per_year > 0 else 0

    return {
        "person_id": person_id,
        "name": person.name,
        "role": PersonRole.get_role_name(person.role),
        "year": year,
        "total_days": total_days,
        "project_count": project_count,
        "utilization_rate": round(utilization_rate, 1),
        "status": "过载" if utilization_rate > 100 else ("饱满" if utilization_rate > 80 else "正常"),
    }


def get_team_workload_summary(year: Optional[int] = None) -> List[Dict[str, Any]]:
    if year is None:
        year = date.today().year

    persons = db.list_persons(limit=1000)
    summary = []

    for person in persons:
        workload = get_person_workload(person.id, year)
        summary.append(workload)

    return sorted(summary, key=lambda x: x.get("utilization_rate", 0), reverse=True)
