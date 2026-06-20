import os
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .config import get_config_dir
from .logger import get_logger
from .models import (
    Artifact,
    ArtifactCategory,
    BudgetItem,
    Person,
    PersonRole,
    Project,
    ProjectPhase,
    ProjectStatus,
    ReportData,
    Sample,
    SampleStatus,
    SampleType,
    Stratum,
    Trench,
)
from . import db

logger = get_logger(__name__)

_TEMPLATE_DIR = Path(__file__).parent / "templates"


def _get_template_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def _format_date(value: Optional[date]) -> str:
    if not value:
        return ""
    return value.strftime("%Y年%m月%d日")


def _format_datetime(value: Optional[datetime]) -> str:
    if not value:
        return ""
    return value.strftime("%Y年%m月%d日 %H:%M")


def _format_number(value: float, decimals: int = 2) -> str:
    return f"{value:,.{decimals}f}"


def _get_phase_name(phase: str) -> str:
    return ProjectPhase.get_phase_name(ProjectPhase(phase))


def _get_status_name(status: str) -> str:
    status_map = {
        "not_started": "未开始",
        "in_progress": "进行中",
        "completed": "已完成",
        "suspended": "已暂停",
    }
    return status_map.get(status, status)


def _get_category_name(cat: str) -> str:
    return ArtifactCategory.get_category_name(ArtifactCategory(cat))


def _get_sample_type_name(st: str) -> str:
    return SampleType.get_type_name(SampleType(st))


def _get_sample_status_name(st: str) -> str:
    status_map = {
        "collected": "已采集",
        "sent": "已送检",
        "testing": "检测中",
        "completed": "已完成",
        "overdue": "已超期",
    }
    return status_map.get(st, st)


def _get_role_name(role: str) -> str:
    return PersonRole.get_role_name(PersonRole(role))


def generate_briefing(project_id: int, output_path: Optional[Path] = None) -> Path:
    project = db.get_project(project_id)
    if not project:
        raise ValueError(f"项目 {project_id} 不存在")

    trenches = db.list_trenches(project_id=project_id, limit=1000)
    artifacts = db.list_artifacts(project_id=project_id, limit=10000)
    samples = db.list_samples(project_id=project_id, limit=1000)

    strata = []
    for trench in trenches:
        trench_strata = db.list_strata(trench_id=trench.id, limit=500)
        strata.extend(trench_strata)

    budget_items = db.list_budget_items(project_id=project_id)
    budget_summary = db.get_project_budget_summary(project_id)

    personnel = []
    assignments = db.list_assignments(project_id=project_id, assignment_type="person", limit=500)
    person_ids = set()
    for a in assignments:
        if a.person_id:
            person_ids.add(a.person_id)
    for pid in person_ids:
        person = db.get_person(pid)
        if person:
            personnel.append(person)

    report_data = ReportData(
        project=project,
        trenches=trenches,
        artifacts=artifacts,
        samples=samples,
        strata=strata,
        personnel=personnel,
        budget_items=budget_items,
        generated_at=datetime.now(),
    )

    env = _get_template_env()
    env.filters["format_date"] = _format_date
    env.filters["format_datetime"] = _format_datetime
    env.filters["format_number"] = _format_number
    env.filters["phase_name"] = _get_phase_name
    env.filters["status_name"] = _get_status_name
    env.filters["category_name"] = _get_category_name
    env.filters["sample_type_name"] = _get_sample_type_name
    env.filters["sample_status_name"] = _get_sample_status_name
    env.filters["role_name"] = _get_role_name

    template = env.get_template("briefing.html")

    artifact_stats = _count_by_category(artifacts)
    sample_stats = _count_by_sample_type(samples)
    sample_status_stats = _count_by_sample_status(samples)

    context = {
        "report": report_data,
        "project": project,
        "trenches": trenches,
        "artifacts": artifacts,
        "samples": samples,
        "strata": strata,
        "personnel": personnel,
        "budget_items": budget_items,
        "budget_summary": budget_summary,
        "artifact_stats": artifact_stats,
        "sample_stats": sample_stats,
        "sample_status_stats": sample_status_stats,
        "trench_count": len(trenches),
        "artifact_count": len(artifacts),
        "sample_count": len(samples),
        "stratum_count": len(strata),
        "generated_at": datetime.now(),
    }

    html_content = template.render(context)

    if output_path is None:
        report_dir = get_config_dir() / "reports"
        report_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = report_dir / f"briefing_{project.code}_{timestamp}.html"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    logger.info(f"发掘简报已生成: {output_path}")
    return output_path


def generate_annual_report(year: int, output_path: Optional[Path] = None) -> Path:
    projects = db.list_projects(limit=1000)

    project_summaries = []
    total_budget = 0.0
    total_actual = 0.0
    total_artifacts = 0
    total_samples = 0
    total_trenches = 0

    for project in projects:
        start_year = project.start_date.year if project.start_date else None
        end_year = project.end_date.year if project.end_date else None

        if start_year and end_year:
            if start_year <= year <= end_year or (project.status == ProjectStatus.IN_PROGRESS and start_year <= year):
                pass
            elif start_year > year or (end_year and end_year < year):
                continue
        elif project.created_at and project.created_at.year == year:
            pass
        else:
            continue

        artifacts = db.list_artifacts(project_id=project.id, limit=10000)
        samples = db.list_samples(project_id=project.id, limit=1000)
        trenches = db.list_trenches(project_id=project.id, limit=1000)
        budget_summary = db.get_project_budget_summary(project.id)

        summary = {
            "project": project,
            "artifact_count": len(artifacts),
            "sample_count": len(samples),
            "trench_count": len(trenches),
            "budget_summary": budget_summary,
        }
        project_summaries.append(summary)

        total_budget += budget_summary["total_budgeted"]
        total_actual += budget_summary["total_actual"]
        total_artifacts += len(artifacts)
        total_samples += len(samples)
        total_trenches += len(trenches)

    phase_stats = _count_projects_by_phase(projects)
    status_stats = _count_projects_by_status(projects)

    persons = db.list_persons(limit=1000)
    person_role_stats = _count_persons_by_role(persons)

    env = _get_template_env()
    env.filters["format_date"] = _format_date
    env.filters["format_datetime"] = _format_datetime
    env.filters["format_number"] = _format_number
    env.filters["phase_name"] = _get_phase_name
    env.filters["status_name"] = _get_status_name
    env.filters["category_name"] = _get_category_name
    env.filters["sample_type_name"] = _get_sample_type_name
    env.filters["sample_status_name"] = _get_sample_status_name
    env.filters["role_name"] = _get_role_name

    template = env.get_template("annual_report.html")

    context = {
        "year": year,
        "project_count": len(project_summaries),
        "total_budget": total_budget,
        "total_actual": total_actual,
        "execution_rate": (total_actual / total_budget * 100) if total_budget > 0 else 0,
        "total_artifacts": total_artifacts,
        "total_samples": total_samples,
        "total_trenches": total_trenches,
        "total_personnel": len(persons),
        "projects": project_summaries,
        "phase_stats": phase_stats,
        "status_stats": status_stats,
        "person_role_stats": person_role_stats,
        "generated_at": datetime.now(),
    }

    html_content = template.render(context)

    if output_path is None:
        report_dir = get_config_dir() / "reports"
        report_dir.mkdir(parents=True, exist_ok=True)
        output_path = report_dir / f"annual_report_{year}.html"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    logger.info(f"年度报告已生成: {output_path}")
    return output_path


def generate_budget_report(project_id: int, quarter: Optional[int] = None,
                           year: Optional[int] = None) -> Dict[str, Any]:
    project = db.get_project(project_id)
    if not project:
        raise ValueError(f"项目 {project_id} 不存在")

    if year is None:
        year = date.today().year

    budget_items = db.list_budget_items(project_id=project_id)
    budget_summary = db.get_project_budget_summary(project_id)

    deviation_items = [item for item in budget_items if item.has_deviation]

    return {
        "project_name": project.name,
        "project_code": project.code,
        "year": year,
        "quarter": quarter,
        "total_budgeted": budget_summary["total_budgeted"],
        "total_actual": budget_summary["total_actual"],
        "execution_rate": budget_summary["execution_rate"],
        "item_count": budget_summary["item_count"],
        "deviation_count": len(deviation_items),
        "deviation_items": deviation_items,
        "budget_items": budget_items,
    }


def export_budget_excel(project_id: int, output_path: Path) -> Path:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, PatternFill
    except ImportError:
        logger.warning("openpyxl 未安装，无法导出 Excel")
        raise

    budget_data = generate_budget_report(project_id)
    budget_items = budget_data["budget_items"]

    wb = Workbook()
    ws = wb.active
    ws.title = "经费执行情况"

    header_font = Font(bold=True, size=12)
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font_white = Font(bold=True, size=12, color="FFFFFF")
    center_align = Alignment(horizontal="center", vertical="center")

    ws["A1"] = f"{budget_data['project_name']} - 经费执行表"
    ws["A1"].font = Font(bold=True, size=14)
    ws.merge_cells("A1:E1")
    ws["A1"].alignment = center_align

    headers = ["预算科目", "预算金额", "实际支出", "执行率", "偏差预警"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col, value=header)
        cell.font = header_font_white
        cell.fill = header_fill
        cell.alignment = center_align

    for row_idx, item in enumerate(budget_items, 4):
        ws.cell(row=row_idx, column=1, value=item.category)
        ws.cell(row=row_idx, column=2, value=item.budgeted)
        ws.cell(row=row_idx, column=3, value=item.actual)
        ws.cell(row=row_idx, column=4, value=f"{item.execution_rate:.1f}%")

        deviation_cell = ws.cell(row=row_idx, column=5)
        if item.has_deviation:
            deviation_cell.value = "⚠️ 偏差超20%"
            deviation_cell.font = Font(color="FF0000")
        else:
            deviation_cell.value = "正常"

    summary_row = len(budget_items) + 5
    ws.cell(row=summary_row, column=1, value="合计").font = Font(bold=True)
    ws.cell(row=summary_row, column=2, value=budget_data["total_budgeted"]).font = Font(bold=True)
    ws.cell(row=summary_row, column=3, value=budget_data["total_actual"]).font = Font(bold=True)
    ws.cell(row=summary_row, column=4, value=f"{budget_data['execution_rate']:.1f}%").font = Font(bold=True)

    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 15
    ws.column_dimensions["C"].width = 15
    ws.column_dimensions["D"].width = 12
    ws.column_dimensions["E"].width = 18

    output_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(output_path)
    logger.info(f"经费报表已导出: {output_path}")
    return output_path


def _count_by_category(artifacts: List[Artifact]) -> Dict[str, int]:
    stats: Dict[str, int] = {}
    for artifact in artifacts:
        cat = artifact.category.value
        stats[cat] = stats.get(cat, 0) + artifact.quantity
    return stats


def _count_by_sample_type(samples: List[Sample]) -> Dict[str, int]:
    stats: Dict[str, int] = {}
    for sample in samples:
        st = sample.sample_type.value
        stats[st] = stats.get(st, 0) + 1
    return stats


def _count_by_sample_status(samples: List[Sample]) -> Dict[str, int]:
    stats: Dict[str, int] = {}
    for sample in samples:
        st = sample.status.value
        stats[st] = stats.get(st, 0) + 1
    return stats


def _count_projects_by_phase(projects: List[Project]) -> Dict[str, int]:
    stats: Dict[str, int] = {}
    for project in projects:
        phase = project.phase.value
        stats[phase] = stats.get(phase, 0) + 1
    return stats


def _count_projects_by_status(projects: List[Project]) -> Dict[str, int]:
    stats: Dict[str, int] = {}
    for project in projects:
        status = project.status.value
        stats[status] = stats.get(status, 0) + 1
    return stats


def _count_persons_by_role(persons: List[Person]) -> Dict[str, int]:
    stats: Dict[str, int] = {}
    for person in persons:
        role = person.role.value
        stats[role] = stats.get(role, 0) + 1
    return stats
