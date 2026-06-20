import os
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich.text import Text

from . import __app_name__, __version__
from .config import (
    add_institute,
    get_current_institute,
    load_config,
    remove_institute,
    switch_institute,
)
from .logger import get_logger
from .models import (
    ArtifactCategory,
    PersonRole,
    ProjectPhase,
    ProjectStatus,
    SampleStatus,
    SampleType,
)
from . import db
from . import photo as photo_module
from . import report as report_module
from . import scheduler as scheduler_module
from . import sync as sync_module

logger = get_logger(__name__)
console = Console()

app = typer.Typer(
    name=__app_name__,
    help="考古发掘项目管理系统",
    add_completion=False,
    no_args_is_help=True,
)

project_app = typer.Typer(help="项目全生命周期管理")
trench_app = typer.Typer(help="探方与层位三维记录")
artifact_app = typer.Typer(help="出土遗物编号与影像关联")
sample_app = typer.Typer(help="采样标本送检追踪")
schedule_app = typer.Typer(help="跨项目人员设备调度")
budget_app = typer.Typer(help="经费执行率统计")
sync_app = typer.Typer(help="离线数据同步")
report_app = typer.Typer(help="发掘简报与年报生成")
photo_app = typer.Typer(help="照片处理工具")
config_app = typer.Typer(help="系统配置管理")

app.add_typer(project_app, name="project")
app.add_typer(trench_app, name="trench")
app.add_typer(artifact_app, name="artifact")
app.add_typer(sample_app, name="sample")
app.add_typer(schedule_app, name="schedule")
app.add_typer(budget_app, name="budget")
app.add_typer(sync_app, name="sync")
app.add_typer(report_app, name="report")
app.add_typer(photo_app, name="photo")
app.add_typer(config_app, name="config")


def _status_emoji(status: str) -> str:
    status_map = {
        "not_started": "⏳",
        "in_progress": "🔄",
        "completed": "✅",
        "suspended": "⏸️",
    }
    return status_map.get(status, "❓")


def _phase_emoji(phase: str) -> str:
    phase_map = {
        "prospecting": "🔍",
        "excavation": "⛏️",
        "sampling": "🧪",
        "processing": "📦",
        "report": "📝",
    }
    return phase_map.get(phase, "❓")


def _color_status(status: str) -> str:
    color_map = {
        "not_started": "dim",
        "in_progress": "blue",
        "completed": "green",
        "suspended": "yellow",
    }
    return color_map.get(status, "white")


@app.command("version")
def version():
    """显示版本信息"""
    console.print(f"[bold green]{__app_name__}[/bold green] v{__version__}")
    console.print("考古发掘项目管理系统")


@app.command("info")
def info():
    """显示系统信息"""
    institute = get_current_institute()
    config = load_config()
    status = sync_module.get_sync_status()

    table = Table(title="系统信息", show_header=False, border_style="blue")
    table.add_column("项目", style="cyan", no_wrap=True)
    table.add_column("值", style="white")
    table.add_row("应用名称", __app_name__)
    table.add_row("版本", __version__)
    table.add_row("当前研究所", f"[bold]{institute.name}[/bold] ({institute.code})")
    table.add_row("遗址总数", str(institute.sites))
    table.add_row("未同步记录", f"[yellow]{status['unsynced_count']}[/yellow] 条")
    table.add_row("未解决冲突", f"[red]{status['unresolved_conflicts']}[/red] 个")
    table.add_row("同步包数量", str(status['package_count']))

    console.print(table)


@project_app.command("create")
def project_create(
    name: str = typer.Option(..., "--name", "-n", help="项目名称"),
    code: str = typer.Option(..., "--code", "-c", help="项目编号"),
    site_name: str = typer.Option(..., "--site", "-s", help="遗址名称"),
    site_code: str = typer.Option(..., "--site-code", help="遗址代号"),
    leader: str = typer.Option("", "--leader", "-l", help="项目负责人"),
    start_date: Optional[str] = typer.Option(None, "--start", help="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = typer.Option(None, "--end", help="结束日期 (YYYY-MM-DD)"),
    area: float = typer.Option(0.0, "--area", "-a", help="发掘面积(平方米)"),
    budget: float = typer.Option(0.0, "--budget", "-b", help="项目预算"),
    description: str = typer.Option("", "--desc", "-d", help="项目描述"),
):
    """创建新的发掘项目"""
    from .models import Project

    try:
        start = date.fromisoformat(start_date) if start_date else None
        end = date.fromisoformat(end_date) if end_date else None
    except ValueError:
        console.print("[red]错误：日期格式不正确，请使用 YYYY-MM-DD 格式[/red]")
        raise typer.Exit(1)

    project = Project(
        name=name,
        code=code,
        site_name=site_name,
        site_code=site_code,
        leader=leader,
        start_date=start,
        end_date=end,
        area=area,
        budget=budget,
        description=description,
    )

    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            transient=True,
        ) as progress:
            progress.add_task("创建项目中...", total=None)
            created = db.create_project(project)
    except Exception as e:
        console.print(f"[red]创建项目失败：{e}[/red]")
        raise typer.Exit(1)

    console.print(Panel.fit(
        f"[bold green]✓ 项目创建成功[/bold green]\n\n"
        f"项目ID: [cyan]{created.id}[/cyan]\n"
        f"项目名称: [white]{created.name}[/white]\n"
        f"项目编号: [white]{created.code}[/white]\n"
        f"遗址: [white]{created.site_name} ({created.site_code})[/white]",
        title="项目创建",
        border_style="green",
    ))


@project_app.command("list")
def project_list(
    status: Optional[ProjectStatus] = typer.Option(None, "--status", "-s", help="按状态筛选"),
    phase: Optional[ProjectPhase] = typer.Option(None, "--phase", "-p", help="按阶段筛选"),
    limit: int = typer.Option(50, "--limit", "-n", help="显示数量"),
):
    """列出所有发掘项目"""
    projects = db.list_projects(status=status, phase=phase, limit=limit)

    table = Table(title=f"发掘项目列表 ({len(projects)}个)", show_lines=False, row_styles=["none", "dim"])
    table.add_column("ID", style="cyan", width=6)
    table.add_column("编号", style="white", width=12)
    table.add_column("名称", style="white", width=20)
    table.add_column("遗址", style="white", width=16)
    table.add_column("阶段", style="magenta", width=10)
    table.add_column("状态", style="green", width=10)
    table.add_column("负责人", style="yellow", width=10)
    table.add_column("面积(㎡)", style="blue", width=10, justify="right")

    for p in projects:
        table.add_row(
            str(p.id),
            p.code,
            Text(p.name, overflow="ellipsis"),
            Text(p.site_name, overflow="ellipsis"),
            f"{_phase_emoji(p.phase.value)} {ProjectPhase.get_phase_name(p.phase)}",
            f"{_status_emoji(p.status.value)} {ProjectStatus.get_status_name(p.status)}",
            p.leader or "-",
            f"{p.area:,.1f}",
        )

    console.print(table)


@project_app.command("show")
def project_show(
    project_id: int = typer.Argument(..., help="项目ID"),
):
    """显示项目详细信息"""
    project = db.get_project(project_id)
    if not project:
        console.print(f"[red]项目 {project_id} 不存在[/red]")
        raise typer.Exit(1)

    checklist = project.get_checklist_status()
    completed = sum(1 for v in checklist.values() if v)
    total = len(checklist)

    info_table = Table(show_header=False, border_style="blue")
    info_table.add_column("属性", style="cyan", width=15)
    info_table.add_column("值", style="white")
    info_table.add_row("项目ID", str(project.id))
    info_table.add_row("项目编号", project.code)
    info_table.add_row("项目名称", project.name)
    info_table.add_row("遗址名称", f"{project.site_name} ({project.site_code})")
    info_table.add_row("当前阶段", f"{_phase_emoji(project.phase.value)} [magenta]{ProjectPhase.get_phase_name(project.phase)}[/magenta]")
    info_table.add_row("项目状态", f"{_status_emoji(project.status.value)} [{_color_status(project.status.value)}]{ProjectStatus.get_status_name(project.status)}[/{_color_status(project.status.value)}]")
    info_table.add_row("项目负责人", project.leader or "-")
    info_table.add_row("开始日期", str(project.start_date) if project.start_date else "-")
    info_table.add_row("结束日期", str(project.end_date) if project.end_date else "-")
    info_table.add_row("发掘面积", f"{project.area:,.1f} 平方米")
    info_table.add_row("项目预算", f"¥ {project.budget:,.2f}")
    info_table.add_row("阶段进度", f"{completed}/{total} 项已完成")

    console.print(Panel(info_table, title=f"项目详情: {project.name}", border_style="blue"))

    if checklist:
        cl_table = Table(title="当前阶段校验清单", show_header=False)
        cl_table.add_column("状态", width=4)
        cl_table.add_column("项目", style="white")
        for item, done in checklist.items():
            emoji = "✅" if done else "⬜"
            style = "green" if done else "yellow"
            cl_table.add_row(emoji, Text(item, style=style))
        console.print(cl_table)

    if project.description:
        console.print(Panel(project.description, title="项目描述", border_style="dim"))


@project_app.command("update")
def project_update(
    project_id: int = typer.Argument(..., help="项目ID"),
    name: Optional[str] = typer.Option(None, "--name", "-n", help="项目名称"),
    leader: Optional[str] = typer.Option(None, "--leader", "-l", help="项目负责人"),
    status: Optional[ProjectStatus] = typer.Option(None, "--status", "-s", help="项目状态"),
    area: Optional[float] = typer.Option(None, "--area", "-a", help="发掘面积"),
    budget: Optional[float] = typer.Option(None, "--budget", "-b", help="项目预算"),
    description: Optional[str] = typer.Option(None, "--desc", "-d", help="项目描述"),
):
    """更新项目信息"""
    project = db.get_project(project_id)
    if not project:
        console.print(f"[red]项目 {project_id} 不存在[/red]")
        raise typer.Exit(1)

    if name is not None:
        project.name = name
    if leader is not None:
        project.leader = leader
    if status is not None:
        project.status = status
    if area is not None:
        project.area = area
    if budget is not None:
        project.budget = budget
    if description is not None:
        project.description = description

    try:
        updated = db.update_project(project)
        console.print(f"[green]✓ 项目 {updated.id} 更新成功[/green]")
    except Exception as e:
        console.print(f"[red]更新失败：{e}[/red]")
        raise typer.Exit(1)


@project_app.command("delete")
def project_delete(
    project_id: int = typer.Argument(..., help="项目ID"),
    force: bool = typer.Option(False, "--force", "-f", help="强制删除，不提示确认"),
):
    """删除发掘项目"""
    project = db.get_project(project_id)
    if not project:
        console.print(f"[red]项目 {project_id} 不存在[/red]")
        raise typer.Exit(1)

    if not force:
        confirm = typer.confirm(f"确定要删除项目「{project.name}」吗？此操作不可恢复")
        if not confirm:
            console.print("已取消删除")
            return

    if db.delete_project(project_id):
        console.print(f"[green]✓ 项目 {project_id} 已删除[/green]")
    else:
        console.print(f"[red]删除项目 {project_id} 失败[/red]")


@project_app.command("advance")
def project_advance(
    project_id: int = typer.Argument(..., help="项目ID"),
):
    """推进项目到下一阶段"""
    try:
        project = db.advance_project_phase(project_id)
        console.print(
            f"[green]✓ 项目已推进到下一阶段: "
            f"{_phase_emoji(project.phase.value)} {ProjectPhase.get_phase_name(project.phase)}[/green]"
        )
    except ValueError as e:
        console.print(f"[red]无法推进：{e}[/red]")
        raise typer.Exit(1)


@project_app.command("checklist")
def project_checklist(
    project_id: int = typer.Argument(..., help="项目ID"),
    item: Optional[str] = typer.Option(None, "--item", "-i", help="要标记的校验项"),
    done: bool = typer.Option(True, "--done/--not-done", help="标记为完成/未完成"),
):
    """管理项目阶段校验清单"""
    project = db.get_project(project_id)
    if not project:
        console.print(f"[red]项目 {project_id} 不存在[/red]")
        raise typer.Exit(1)

    current_checklist = project.get_checklist_status()

    if item is None:
        cl_table = Table(title=f"{ProjectPhase.get_phase_name(project.phase)} - 校验清单", show_header=False)
        cl_table.add_column("状态", width=4)
        cl_table.add_column("项目", style="white")
        for check_item, is_done in current_checklist.items():
            emoji = "✅" if is_done else "⬜"
            style = "green" if is_done else "yellow"
            cl_table.add_row(emoji, Text(check_item, style=style))
        console.print(cl_table)
        return

    if item not in current_checklist:
        console.print(f"[red]校验项「{item}」不存在[/red]")
        console.print("可用的校验项：")
        for check_item in current_checklist:
            console.print(f"  - {check_item}")
        raise typer.Exit(1)

    project.phase_checklist[item] = done
    db.update_project(project)

    status_text = "完成" if done else "未完成"
    console.print(f"[green]✓ 校验项「{item}」已标记为 {status_text}[/green]")


@trench_app.command("create")
def trench_create(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    code: str = typer.Option(..., "--code", "-c", help="探方编号"),
    grid_row: int = typer.Option(0, "--row", "-r", help="网格行号"),
    grid_col: int = typer.Option(0, "--col", "-C", help="网格列号"),
    length: float = typer.Option(5.0, "--length", "-l", help="长度(米)"),
    width: float = typer.Option(5.0, "--width", "-w", help="宽度(米)"),
    x: float = typer.Option(0.0, "--x", help="X坐标"),
    y: float = typer.Option(0.0, "--y", help="Y坐标"),
    description: str = typer.Option("", "--desc", "-d", help="探方描述"),
):
    """创建新探方"""
    from .models import Trench

    trench = Trench(
        project_id=project_id,
        code=code,
        grid_row=grid_row,
        grid_col=grid_col,
        x_coordinate=x,
        y_coordinate=y,
        length=length,
        width=width,
        description=description,
    )

    try:
        created = db.create_trench(trench)
        console.print(f"[green]✓ 探方 {created.code} 创建成功 (ID: {created.id})[/green]")
    except Exception as e:
        console.print(f"[red]创建探方失败：{e}[/red]")
        raise typer.Exit(1)


@trench_app.command("list")
def trench_list(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    limit: int = typer.Option(100, "--limit", "-n", help="显示数量"),
):
    """列出项目探方"""
    trenches = db.list_trenches(project_id=project_id, limit=limit)

    table = Table(title=f"探方列表 ({len(trenches)}个)", row_styles=["none", "dim"])
    table.add_column("ID", style="cyan", width=6)
    table.add_column("探方号", style="white", width=12)
    table.add_column("网格", style="yellow", width=10)
    table.add_column("尺寸", style="white", width=14)
    table.add_column("深度", style="blue", width=8, justify="right")
    table.add_column("状态", style="green", width=10)

    for t in trenches:
        table.add_row(
            str(t.id),
            t.code,
            f"{t.grid_row}×{t.grid_col}",
            f"{t.length}×{t.width}m",
            f"{t.depth}m",
            f"{_status_emoji(t.status)} {t.status}",
        )

    console.print(table)


@trench_app.command("stratum-add")
def trench_stratum_add(
    trench_id: int = typer.Option(..., "--trench", "-t", help="探方ID"),
    layer: str = typer.Option(..., "--layer", "-l", help="层位号"),
    depth_top: float = typer.Option(0.0, "--top", help="顶部深度"),
    depth_bottom: float = typer.Option(0.0, "--bottom", help="底部深度"),
    soil_color: str = typer.Option("", "--color", help="土色"),
    soil_texture: str = typer.Option("", "--texture", help="土质"),
    inclusions: str = typer.Option("", "--inclusions", help="包含物"),
    description: str = typer.Option("", "--desc", "-d", help="描述"),
    parent_id: Optional[int] = typer.Option(None, "--parent", "-p", help="父层层位ID"),
    order: int = typer.Option(0, "--order", "-o", help="排序序号"),
):
    """添加探方层位记录"""
    from .models import Stratum

    stratum = Stratum(
        trench_id=trench_id,
        layer_number=layer,
        depth_top=depth_top,
        depth_bottom=depth_bottom,
        soil_color=soil_color,
        soil_texture=soil_texture,
        inclusions=inclusions,
        description=description,
        parent_id=parent_id,
        order_index=order,
    )

    try:
        created = db.create_stratum(stratum)
        console.print(f"[green]✓ 层位 {created.layer_number} 添加成功 (ID: {created.id})[/green]")
    except ValueError as e:
        console.print(f"[red]添加失败：{e}[/red]")
        raise typer.Exit(1)


@trench_app.command("stratum-list")
def trench_stratum_list(
    trench_id: int = typer.Option(..., "--trench", "-t", help="探方ID"),
):
    """列出探方层位记录"""
    strata = db.list_strata(trench_id=trench_id)

    table = Table(title=f"探方层位列表 ({len(strata)}层)", row_styles=["none", "dim"])
    table.add_column("ID", style="cyan", width=6)
    table.add_column("层位号", style="white", width=12)
    table.add_column("深度范围", style="yellow", width=14)
    table.add_column("土色", style="white", width=12)
    table.add_column("土质", style="white", width=12)
    table.add_column("包含物", style="green", width=20)
    table.add_column("父层", style="magenta", width=8)

    for s in strata:
        table.add_row(
            str(s.id),
            s.layer_number,
            f"{s.depth_top}~{s.depth_bottom}m",
            s.soil_color or "-",
            s.soil_texture or "-",
            Text(s.inclusions or "-", overflow="ellipsis"),
            str(s.parent_id) if s.parent_id else "-",
        )

    console.print(table)


@trench_app.command("export-geojson")
def trench_export_geojson(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    output: str = typer.Option(..., "--output", "-o", help="输出文件路径"),
):
    """导出探方分布平面图为 GeoJSON 格式"""
    import json

    try:
        geojson_data = db.export_trenches_geojson(project_id)
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(geojson_data, f, ensure_ascii=False, indent=2)

        console.print(
            f"[green]✓ 导出成功: {geojson_data['properties']['trench_count']} 个探方[/green]\n"
            f"[cyan]输出文件: {output_path}[/cyan]"
        )
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)


@artifact_app.command("create")
def artifact_create(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    code: Optional[str] = typer.Option(None, "--code", "-c", help="遗物编号（留空则自动生成）"),
    name: str = typer.Option("", "--name", "-n", help="遗物名称"),
    category: ArtifactCategory = typer.Option(ArtifactCategory.OTHER, "--category", "-t", help="遗物类别"),
    trench_id: Optional[int] = typer.Option(None, "--trench", "-T", help="探方ID"),
    layer: str = typer.Option("", "--layer", "-l", help="层位号"),
    quantity: int = typer.Option(1, "--qty", "-q", help="数量"),
    description: str = typer.Option("", "--desc", "-d", help="描述"),
    storage: str = typer.Option("", "--storage", "-s", help="存储位置"),
    discovered_by: str = typer.Option("", "--discoverer", help="发现人"),
):
    """登记出土遗物"""
    from .models import Artifact

    code_value = code
    if not code_value:
        project = db.get_project(project_id)
        if not project:
            console.print(f"[red]项目 {project_id} 不存在[/red]")
            raise typer.Exit(1)

        site_code = project.site_code or project.code

        trench_code = ""
        if trench_id:
            trench = db.get_trench(trench_id)
            if trench:
                trench_code = trench.code

        if not trench_code or not layer:
            console.print("[red]自动编号需要提供探方ID和层位号[/red]")
            raise typer.Exit(1)

        next_seq = db.get_next_artifact_seq(project_id, site_code, trench_code, layer)
        code_value = db.generate_artifact_code(site_code, trench_code, layer, next_seq)

    artifact = Artifact(
        project_id=project_id,
        code=code_value,
        name=name,
        category=category,
        trench_id=trench_id,
        layer=layer,
        quantity=quantity,
        description=description,
        storage_location=storage,
        discovered_by=discovered_by,
    )

    try:
        created = db.create_artifact(artifact)
        console.print(f"[green]✓ 遗物 {created.code} 登记成功 (ID: {created.id})[/green]")
    except Exception as e:
        console.print(f"[red]登记失败：{e}[/red]")
        raise typer.Exit(1)


@artifact_app.command("list")
def artifact_list(
    project_id: Optional[int] = typer.Option(None, "--project", "-p", help="项目ID"),
    category: Optional[ArtifactCategory] = typer.Option(None, "--category", "-c", help="按类别筛选"),
    limit: int = typer.Option(50, "--limit", "-n", help="显示数量"),
):
    """列出出土遗物"""
    cat_value = category.value if category else None
    artifacts = db.list_artifacts(project_id=project_id, category=cat_value, limit=limit)

    table = Table(title=f"出土遗物列表 ({len(artifacts)}件)", row_styles=["none", "dim"])
    table.add_column("ID", style="cyan", width=6)
    table.add_column("编号", style="white", width=20)
    table.add_column("名称", style="white", width=16)
    table.add_column("类别", style="magenta", width=10)
    table.add_column("层位", style="yellow", width=10)
    table.add_column("数量", style="green", width=8, justify="right")

    for a in artifacts:
        table.add_row(
            str(a.id),
            a.code,
            Text(a.name or "-", overflow="ellipsis"),
            ArtifactCategory.get_category_name(a.category),
            a.layer or "-",
            str(a.quantity),
        )

    console.print(table)


@artifact_app.command("show")
def artifact_show(
    artifact_id: int = typer.Argument(..., help="遗物ID"),
):
    """显示遗物详细信息"""
    artifact = db.get_artifact(artifact_id)
    if not artifact:
        console.print(f"[red]遗物 {artifact_id} 不存在[/red]")
        raise typer.Exit(1)

    info_table = Table(show_header=False, border_style="blue")
    info_table.add_column("属性", style="cyan", width=15)
    info_table.add_column("值", style="white")
    info_table.add_row("遗物ID", str(artifact.id))
    info_table.add_row("遗物编号", artifact.code)
    info_table.add_row("遗物名称", artifact.name or "-")
    info_table.add_row("类别", ArtifactCategory.get_category_name(artifact.category))
    info_table.add_row("所属项目", str(artifact.project_id))
    info_table.add_row("探方", str(artifact.trench_id) if artifact.trench_id else "-")
    info_table.add_row("层位", artifact.layer or "-")
    info_table.add_row("数量", str(artifact.quantity))
    info_table.add_row("照片数", str(artifact.photo_count))
    info_table.add_row("存储位置", artifact.storage_location or "-")
    info_table.add_row("发现人", artifact.discovered_by or "-")

    console.print(Panel(info_table, title=f"遗物详情: {artifact.code}", border_style="blue"))

    if artifact.description:
        console.print(Panel(artifact.description, title="描述", border_style="dim"))


@sample_app.command("create")
def sample_create(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    code: Optional[str] = typer.Option(None, "--code", "-c", help="标本编号（留空则自动生成）"),
    sample_type: SampleType = typer.Option(SampleType.OTHER, "--type", "-t", help="标本类型"),
    trench_id: Optional[int] = typer.Option(None, "--trench", "-T", help="探方ID"),
    description: str = typer.Option("", "--desc", "-d", help="描述"),
    collected_by: str = typer.Option("", "--collector", help="采集人"),
    lab: str = typer.Option("", "--lab", "-l", help="送检机构"),
    expected_days: int = typer.Option(0, "--days", help="预期检测天数"),
):
    """登记采样标本"""
    from .models import Sample

    code_value = code
    if not code_value:
        project = db.get_project(project_id)
        if not project:
            console.print(f"[red]项目 {project_id} 不存在[/red]")
            raise typer.Exit(1)

        site_code = project.site_code or project.code
        next_seq = db.get_next_sample_seq(project_id, site_code, sample_type.value)
        code_value = db.generate_sample_code(site_code, sample_type.value, next_seq)

    sample = Sample(
        project_id=project_id,
        code=code_value,
        sample_type=sample_type,
        trench_id=trench_id,
        description=description,
        collected_by=collected_by,
        lab_name=lab,
        expected_days=expected_days if expected_days > 0 else SampleType.get_test_days(sample_type),
    )

    try:
        created = db.create_sample(sample)
        console.print(f"[green]✓ 标本 {created.code} 登记成功 (ID: {created.id})[/green]")
    except Exception as e:
        console.print(f"[red]登记失败：{e}[/red]")
        raise typer.Exit(1)


@sample_app.command("list")
def sample_list(
    project_id: Optional[int] = typer.Option(None, "--project", "-p", help="项目ID"),
    status: Optional[SampleStatus] = typer.Option(None, "--status", "-s", help="按状态筛选"),
    sample_type: Optional[SampleType] = typer.Option(None, "--type", "-t", help="按类型筛选"),
    limit: int = typer.Option(50, "--limit", "-n", help="显示数量"),
):
    """列出采样标本"""
    samples = db.list_samples(project_id=project_id, status=status, sample_type=sample_type, limit=limit)

    status_emoji = {
        "collected": "📦",
        "sent": "📤",
        "testing": "🔬",
        "completed": "✅",
        "overdue": "⚠️",
    }

    table = Table(title=f"采样标本列表 ({len(samples)}件)", row_styles=["none", "dim"])
    table.add_column("ID", style="cyan", width=6)
    table.add_column("编号", style="white", width=20)
    table.add_column("类型", style="magenta", width=10)
    table.add_column("状态", style="green", width=12)
    table.add_column("送检机构", style="yellow", width=16)
    table.add_column("预期天数", style="blue", width=10, justify="right")

    for s in samples:
        table.add_row(
            str(s.id),
            s.code,
            SampleType.get_type_name(s.sample_type),
            f"{status_emoji.get(s.status.value, '❓')} {SampleStatus.get_status_name(s.status)}",
            Text(s.lab_name or "-", overflow="ellipsis"),
            str(s.expected_days),
        )

    console.print(table)


@sample_app.command("send")
def sample_send(
    sample_id: int = typer.Argument(..., help="标本ID"),
    lab: str = typer.Option(..., "--lab", "-l", help="送检机构"),
    sent_date: Optional[str] = typer.Option(None, "--date", "-d", help="送检日期 (YYYY-MM-DD)"),
):
    """标记标本已送检"""
    sample = db.get_sample(sample_id)
    if not sample:
        console.print(f"[red]标本 {sample_id} 不存在[/red]")
        raise typer.Exit(1)

    try:
        sent = date.fromisoformat(sent_date) if sent_date else date.today()
    except ValueError:
        console.print("[red]日期格式不正确[/red]")
        raise typer.Exit(1)

    sample.sent_date = sent
    sample.lab_name = lab
    sample.status = SampleStatus.SENT

    updated = db.update_sample(sample)
    console.print(f"[green]✓ 标本 {updated.code} 已标记为送检[/green]")


@sample_app.command("complete")
def sample_complete(
    sample_id: int = typer.Argument(..., help="标本ID"),
    result: str = typer.Option("", "--result", "-r", help="检测结果"),
    result_date: Optional[str] = typer.Option(None, "--date", "-d", help="结果日期"),
):
    """标记标本检测完成"""
    sample = db.get_sample(sample_id)
    if not sample:
        console.print(f"[red]标本 {sample_id} 不存在[/red]")
        raise typer.Exit(1)

    try:
        result_dt = date.fromisoformat(result_date) if result_date else date.today()
    except ValueError:
        console.print("[red]日期格式不正确[/red]")
        raise typer.Exit(1)

    sample.result = result
    sample.result_date = result_dt
    sample.status = SampleStatus.COMPLETED

    updated = db.update_sample(sample)
    console.print(f"[green]✓ 标本 {updated.code} 检测完成[/green]")


@sample_app.command("check-overdue")
def sample_check_overdue():
    """检查超期未回的标本"""
    count = db.update_overdue_samples()
    if count > 0:
        console.print(f"[yellow]⚠️ 发现 {count} 件超期标本[/yellow]")
        samples = db.list_samples(status=SampleStatus.OVERDUE, limit=100)
        table = Table(title="超期标本", row_styles=["none", "dim"])
        table.add_column("编号", style="white")
        table.add_column("类型", style="magenta")
        table.add_column("送检机构", style="yellow")
        table.add_column("送检日期", style="red")
        for s in samples:
            table.add_row(s.code, SampleType.get_type_name(s.sample_type), s.lab_name, str(s.sent_date))
        console.print(table)
    else:
        console.print("[green]✓ 没有超期标本[/green]")


@sample_app.command("summary")
def sample_summary(
    project_id: Optional[int] = typer.Option(None, "--project", "-p", help="按项目筛选"),
    sample_type: Optional[SampleType] = typer.Option(None, "--type", "-t", help="按标本类型筛选"),
):
    """汇总送检状态"""
    summary = db.get_sample_summary(
        project_id=project_id,
        sample_type=sample_type.value if sample_type else None,
    )

    console.print(Panel(
        f"[bold]标本送检状态汇总[/bold]\n\n"
        f"总数: {summary['total']} 件\n"
        f"已送检: {summary['sent']} 件\n"
        f"送检率: {summary['send_rate']}%\n"
        f"超期: {summary['overdue']} 件",
        title="📊 标本汇总",
        border_style="cyan",
    ))

    status_table = Table(title="各状态计数", row_styles=["none", "dim"])
    status_table.add_column("状态", style="white")
    status_table.add_column("数量", style="cyan", justify="right")
    status_table.add_column("占比", style="green", justify="right")

    from .models import SampleStatus
    total = summary["total"] if summary["total"] > 0 else 1
    for status_val, count in summary["status_counts"].items():
        status_name = SampleStatus.get_status_name(status_val)
        pct = round(count / total * 100, 1)
        status_table.add_row(status_name, str(count), f"{pct}%")

    console.print(status_table)

    if summary["type_counts"]:
        type_table = Table(title="各类型计数", row_styles=["none", "dim"])
        type_table.add_column("类型", style="white")
        type_table.add_column("数量", style="magenta", justify="right")
        type_table.add_column("占比", style="green", justify="right")

        for type_val, count in summary["type_counts"].items():
            type_name = SampleType.get_type_name(SampleType(type_val))
            pct = round(count / total * 100, 1)
            type_table.add_row(type_name, str(count), f"{pct}%")

        console.print(type_table)


@schedule_app.command("person-add")
def schedule_person_add(
    name: str = typer.Option(..., "--name", "-n", help="姓名"),
    role: PersonRole = typer.Option(PersonRole.WORKER, "--role", "-r", help="角色"),
    skills: Optional[str] = typer.Option(None, "--skills", "-s", help="技能标签，用逗号分隔"),
    phone: str = typer.Option("", "--phone", help="电话"),
    email: str = typer.Option("", "--email", help="邮箱"),
):
    """添加人员"""
    from .models import Person

    skill_list = [s.strip() for s in skills.split(",")] if skills else []

    person = Person(
        name=name,
        role=role,
        skills=skill_list,
        phone=phone,
        email=email,
    )

    try:
        created = db.create_person(person)
        console.print(f"[green]✓ 人员 {created.name} 添加成功 (ID: {created.id})[/green]")
    except Exception as e:
        console.print(f"[red]添加失败：{e}[/red]")
        raise typer.Exit(1)


@schedule_app.command("person-list")
def schedule_person_list(
    role: Optional[PersonRole] = typer.Option(None, "--role", "-r", help="按角色筛选"),
    limit: int = typer.Option(100, "--limit", "-n", help="显示数量"),
):
    """列出人员"""
    role_value = role.value if role else None
    persons = db.list_persons(role=role_value, limit=limit)

    table = Table(title=f"人员列表 ({len(persons)}人)", row_styles=["none", "dim"])
    table.add_column("ID", style="cyan", width=6)
    table.add_column("姓名", style="white", width=12)
    table.add_column("角色", style="magenta", width=10)
    table.add_column("技能", style="yellow", width=24)
    table.add_column("电话", style="green", width=14)
    table.add_column("状态", style="blue", width=10)

    for p in persons:
        table.add_row(
            str(p.id),
            p.name,
            PersonRole.get_role_name(p.role),
            Text(", ".join(p.skills), overflow="ellipsis"),
            p.phone or "-",
            f"{_status_emoji(p.status)} {p.status}",
        )

    console.print(table)


@schedule_app.command("assign-person")
def schedule_assign_person(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    person_id: int = typer.Option(..., "--person", "-P", help="人员ID"),
    role: str = typer.Option("", "--role", "-r", help="项目中角色"),
    start: Optional[str] = typer.Option(None, "--start", "-s", help="开始日期"),
    end: Optional[str] = typer.Option(None, "--end", "-e", help="结束日期"),
    notes: str = typer.Option("", "--notes", help="备注"),
):
    """分配人员到项目"""
    from .models import Assignment

    try:
        start_date = date.fromisoformat(start) if start else None
        end_date = date.fromisoformat(end) if end else None
    except ValueError:
        console.print("[red]日期格式不正确[/red]")
        raise typer.Exit(1)

    assignment = Assignment(
        project_id=project_id,
        person_id=person_id,
        assignment_type="person",
        role=role,
        start_date=start_date,
        end_date=end_date,
        notes=notes,
    )

    try:
        created = db.create_assignment(assignment)
        console.print(f"[green]✓ 人员分配成功 (ID: {created.id})[/green]")
    except Exception as e:
        console.print(f"[red]分配失败：{e}[/red]")
        raise typer.Exit(1)


@schedule_app.command("check-conflicts")
def schedule_check_conflicts():
    """检查人员和设备调度冲突"""
    person_conflicts = scheduler_module.detect_person_conflicts()
    equip_conflicts = scheduler_module.detect_equipment_conflicts()

    total = len(person_conflicts) + len(equip_conflicts)
    console.print(f"[bold]检测结果: 共发现 {total} 个冲突[/bold]")

    if person_conflicts:
        table = Table(title=f"人员冲突 ({len(person_conflicts)}个)", row_styles=["none", "dim"])
        table.add_column("人员", style="white", width=12)
        table.add_column("项目A", style="yellow", width=20)
        table.add_column("项目B", style="yellow", width=20)
        table.add_column("重叠时间", style="red", width=20)
        table.add_column("建议", style="green")

        for c in person_conflicts:
            table.add_row(
                c.name,
                Text(c.project_a, overflow="ellipsis"),
                Text(c.project_b, overflow="ellipsis"),
                f"{c.start_date} ~ {c.end_date}",
                Text(c.suggestion, overflow="ellipsis"),
            )

        console.print(table)

    if equip_conflicts:
        table = Table(title=f"设备冲突 ({len(equip_conflicts)}个)", row_styles=["none", "dim"])
        table.add_column("设备", style="white", width=12)
        table.add_column("项目A", style="yellow", width=20)
        table.add_column("项目B", style="yellow", width=20)
        table.add_column("重叠时间", style="red", width=20)

        for c in equip_conflicts:
            table.add_row(
                c.name,
                Text(c.project_a, overflow="ellipsis"),
                Text(c.project_b, overflow="ellipsis"),
                f"{c.start_date} ~ {c.end_date}",
            )
        console.print(table)

    if total == 0:
        console.print("[green]✓ 未发现调度冲突[/green]")


@schedule_app.command("workload")
def schedule_workload(
    year: Optional[int] = typer.Option(None, "--year", "-y", help="年份"),
):
    """查看人员工作量统计"""
    if year is None:
        year = date.today().year

    summary = scheduler_module.get_team_workload_summary(year)

    table = Table(title=f"{year}年人员工作量统计", row_styles=["none", "dim"])
    table.add_column("姓名", style="white", width=12)
    table.add_column("角色", style="magenta", width=10)
    table.add_column("工作天数", style="blue", width=10, justify="right")
    table.add_column("项目数", style="green", width=8, justify="right")
    table.add_column("利用率", style="yellow", width=12, justify="right")
    table.add_column("状态", style="red", width=10)

    for s in summary[:20]:
        color = "red" if s.get("utilization_rate", 0) > 100 else ("yellow" if s.get("utilization_rate", 0) > 80 else "green")
        table.add_row(
            s.get("name", ""),
            s.get("role", ""),
            str(s.get("total_days", 0)),
            str(s.get("project_count", 0)),
            f"[{color}]{s.get('utilization_rate', 0):.1f}%[/{color}]",
            s.get("status", ""),
        )

    console.print(table)


@schedule_app.command("equipment-add")
def schedule_equipment_add(
    name: str = typer.Option(..., "--name", "-n", help="设备名称"),
    code: str = typer.Option(..., "--code", "-c", help="设备编号"),
    category: str = typer.Option("", "--category", "-t", help="设备类别"),
    status: str = typer.Option("available", "--status", help="设备状态"),
    desc: str = typer.Option("", "--desc", "-d", help="设备描述"),
):
    """添加设备"""
    from .models import Equipment

    equipment = Equipment(
        name=name,
        code=code,
        category=category,
        status=status,
        description=desc,
    )

    try:
        created = db.create_equipment(equipment)
        console.print(f"[green]✓ 设备 {created.name} 添加成功 (ID: {created.id})[/green]")
    except Exception as e:
        console.print(f"[red]添加失败：{e}[/red]")
        raise typer.Exit(1)


@schedule_app.command("equipment-list")
def schedule_equipment_list(
    category: Optional[str] = typer.Option(None, "--category", "-c", help="按类别筛选"),
    status: Optional[str] = typer.Option(None, "--status", "-s", help="按状态筛选"),
    limit: int = typer.Option(50, "--limit", "-n", help="显示数量"),
):
    """列出设备清单"""
    equipments = db.list_equipment(category=category, status=status, limit=limit)

    table = Table(title=f"设备清单 ({len(equipments)}台)", row_styles=["none", "dim"])
    table.add_column("ID", style="cyan", width=6)
    table.add_column("编号", style="yellow", width=12)
    table.add_column("名称", style="white", width=16)
    table.add_column("类别", style="magenta", width=10)
    table.add_column("状态", style="green", width=10)
    table.add_column("描述", style="blue", width=20)

    for e in equipments:
        table.add_row(
            str(e.id),
            e.code,
            e.name,
            e.category or "-",
            e.status,
            Text(e.description or "-", overflow="ellipsis"),
        )

    console.print(table)


@schedule_app.command("assign-equip")
def schedule_assign_equipment(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    equipment_id: int = typer.Option(..., "--equipment", "-e", help="设备ID"),
    start_date: str = typer.Option(..., "--start", "-s", help="开始日期 (YYYY-MM-DD)"),
    end_date: str = typer.Option(..., "--end", "-d", help="结束日期 (YYYY-MM-DD)"),
    notes: str = typer.Option("", "--notes", "-n", help="备注"),
):
    """分配设备到项目"""
    from .models import Assignment
    from datetime import datetime

    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        console.print("[red]日期格式错误，请使用 YYYY-MM-DD[/red]")
        raise typer.Exit(1)

    assignment = Assignment(
        project_id=project_id,
        equipment_id=equipment_id,
        assignment_type="equipment",
        start_date=start_dt,
        end_date=end_dt,
        notes=notes,
    )

    try:
        created = db.create_assignment(assignment)
        console.print(f"[green]✓ 设备分配成功 (分配ID: {created.id})[/green]")
    except Exception as e:
        console.print(f"[red]分配失败：{e}[/red]")
        raise typer.Exit(1)


@budget_app.command("add")
def budget_add(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    category: str = typer.Option(..., "--category", "-c", help="预算科目"),
    budgeted: float = typer.Option(0.0, "--budget", "-b", help="预算金额"),
    actual: float = typer.Option(0.0, "--actual", "-a", help="实际支出"),
    year: Optional[int] = typer.Option(None, "--year", "-y", help="所属年度"),
    quarter: Optional[int] = typer.Option(None, "--quarter", "-q", help="所属季度 (1-4)"),
    expenditure_date: Optional[str] = typer.Option(
        None, "--date", "-d", help="支出日期 (YYYY-MM-DD)，未指定季度/年份时自动推导"
    ),
    notes: str = typer.Option("", "--notes", "-n", help="备注"),
):
    """添加预算科目"""
    from datetime import date as date_type
    from .models import BudgetItem

    exp_date: Optional[date_type] = None
    if expenditure_date:
        try:
            exp_date = date_type.fromisoformat(expenditure_date)
        except ValueError:
            console.print("[red]日期格式错误，应为 YYYY-MM-DD[/red]")
            raise typer.Exit(1)

    item = BudgetItem(
        project_id=project_id,
        category=category,
        budgeted=budgeted,
        actual=actual,
        year=year,
        quarter=quarter,
        expenditure_date=exp_date,
        notes=notes,
    )

    try:
        created = db.create_budget_item(item)
        quarter_info = f" ({created.year or '-'}年Q{created.quarter})" if created.quarter else ""
        console.print(f"[green]✓ 预算科目 {created.category} 添加成功{quarter_info} (ID: {created.id})[/green]")
    except Exception as e:
        console.print(f"[red]添加失败：{e}[/red]")
        raise typer.Exit(1)


@budget_app.command("list")
def budget_list(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    year: Optional[int] = typer.Option(None, "--year", "-y", help="按年度筛选"),
    quarter: Optional[int] = typer.Option(None, "--quarter", "-q", help="按季度筛选 (1-4)"),
):
    """列出项目预算执行情况"""
    from .report import generate_budget_report

    report_data = generate_budget_report(project_id, quarter=quarter, year=year)
    items = report_data["budget_items"]

    title = f"{report_data['year']}年经费执行情况 (共{report_data['item_count']}项)"
    if quarter:
        title = f"{report_data['year']}年Q{quarter}经费执行情况 (共{report_data['item_count']}项)"
    table = Table(title=title, row_styles=["none", "dim"])
    table.add_column("ID", style="cyan", width=5)
    table.add_column("预算科目", style="white", width=18)
    table.add_column("年份", style="dim", width=7, justify="center")
    table.add_column("季度", style="magenta", width=6, justify="center")
    table.add_column("预算金额", style="blue", width=14, justify="right")
    table.add_column("实际支出", style="green", width=14, justify="right")
    table.add_column("执行率", style="yellow", width=12, justify="right")
    table.add_column("预警", style="red", width=10)

    for item in items:
        rate_color = "red" if item.has_deviation else "green"
        warn = "⚠️ 超20%" if item.has_deviation else "正常"
        y_str = str(item.year) if item.year else (
            str(item.expenditure_date.year) if item.expenditure_date else "-"
        )
        q_str = f"Q{item.quarter}" if item.quarter else (
            f"Q{((item.expenditure_date.month - 1) // 3 + 1)}" if item.expenditure_date else "-"
        )
        table.add_row(
            str(item.id),
            item.category,
            y_str,
            q_str,
            f"¥ {item.budgeted:,.2f}",
            f"¥ {item.actual:,.2f}",
            f"[{rate_color}]{item.execution_rate:.1f}%[/{rate_color}]",
            warn,
        )

    console.print(table)

    summary_table = Table(show_header=False, border_style="blue")
    summary_table.add_column("项目", style="cyan", width=18)
    summary_table.add_column("值", style="white")
    if quarter:
        summary_table.add_row(f"Q{quarter}预算", f"¥ {report_data['total_budgeted']:,.2f}")
        summary_table.add_row(f"Q{quarter}支出", f"¥ {report_data['total_actual']:,.2f}")
        summary_table.add_row(f"Q{quarter}执行率", f"{report_data['execution_rate']:.1f}%")
        summary_table.add_row("", "")
    summary_table.add_row("全年总预算", f"¥ {report_data['total_budgeted']:,.2f}")
    summary_table.add_row("全年总支出", f"¥ {report_data['total_actual']:,.2f}")
    summary_table.add_row("全年执行率", f"{report_data['execution_rate']:.1f}%")
    if report_data.get("unassigned_count", 0) > 0:
        summary_table.add_row("未指定季度记录", f"{report_data['unassigned_count']} 条")
    if report_data.get("year_unassigned_count", 0) > 0:
        summary_table.add_row("未指定年份记录", f"{report_data['year_unassigned_count']} 条 (默认计入)")

    panel_title = "经费汇总" if not quarter else f"Q{quarter}经费汇总"
    console.print(Panel(summary_table, title=panel_title, border_style="blue"))


@budget_app.command("update")
def budget_update(
    item_id: int = typer.Argument(..., help="预算项ID"),
    budgeted: Optional[float] = typer.Option(None, "--budget", "-b", help="预算金额"),
    actual: Optional[float] = typer.Option(None, "--actual", "-a", help="实际支出"),
    year: Optional[int] = typer.Option(None, "--year", "-y", help="所属年度"),
    quarter: Optional[int] = typer.Option(None, "--quarter", "-q", help="所属季度 (1-4)"),
    expenditure_date: Optional[str] = typer.Option(None, "--date", "-d", help="支出日期 (YYYY-MM-DD)"),
    notes: Optional[str] = typer.Option(None, "--notes", "-n", help="备注"),
):
    """更新预算执行情况"""
    from datetime import date as date_type

    item = db.get_budget_item(item_id)
    if not item:
        console.print(f"[red]预算项 {item_id} 不存在[/red]")
        raise typer.Exit(1)

    if budgeted is not None:
        item.budgeted = budgeted
    if actual is not None:
        item.actual = actual
    if year is not None:
        item.year = year
    if quarter is not None:
        item.quarter = quarter
    if expenditure_date is not None:
            if expenditure_date == "":
                item.expenditure_date = None
            else:
                try:
                    item.expenditure_date = date_type.fromisoformat(expenditure_date)
                except ValueError:
                    console.print("[red]日期格式错误，应为 YYYY-MM-DD[/red]")
                    raise typer.Exit(1)
    if notes is not None:
        item.notes = notes

    updated = db.update_budget_item(item)
    quarter_info = f" ({updated.year or '-'}年Q{updated.quarter})" if updated.quarter else ""
    console.print(f"[green]✓ 预算项 {updated.category} 更新成功{quarter_info}[/green]")


@budget_app.command("export")
def budget_export(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    output: str = typer.Option(..., "--output", "-o", help="输出文件路径"),
    quarter: Optional[int] = typer.Option(None, "--quarter", "-q", help="季度 (1-4)，不指定则全年"),
    year: Optional[int] = typer.Option(None, "--year", "-y", help="年份，不指定则当前年"),
):
    """导出经费执行表为Excel"""
    try:
        output_path = Path(output)
        result = report_module.export_budget_excel(
            project_id, 
            output_path,
            quarter=quarter,
            year=year,
        )
        console.print(f"[green]✓ 经费报表已导出到: {result}[/green]")
    except ImportError:
        console.print("[red]错误：需要安装 openpyxl 库[/red]")
        console.print("运行: pip install openpyxl")
        raise typer.Exit(1)
    except Exception as e:
        console.print(f"[red]导出失败：{e}[/red]")
        raise typer.Exit(1)


@sync_app.command("package")
def sync_package(
    batch_id: Optional[str] = typer.Option(None, "--batch", "-b", help="批次ID"),
    limit: int = typer.Option(10000, "--limit", "-n", help="最大记录数"),
    batch_size: int = typer.Option(1000, "--batch-size", "-s", help="每批处理大小"),
):
    """打包增量数据用于同步"""
    batch_id, count = sync_module.package_incremental_data(batch_id=batch_id, limit=limit, batch_size=batch_size)

    if count == 0:
        console.print("[yellow]没有待同步的数据[/yellow]")
    else:
        sync_dir = sync_module.get_sync_dir()
        package_file = sync_dir / f"{batch_id}.json"
        console.print(f"[green]✓ 打包完成: {count} 条记录[/green]")
        console.print(f"[cyan]同步包: {package_file}[/cyan]")


@sync_app.command("resume")
def sync_resume(
    limit: int = typer.Option(10000, "--limit", "-n", help="最大记录数"),
    batch_size: int = typer.Option(1000, "--batch-size", "-s", help="每批处理大小"),
):
    """从中断点继续打包同步数据"""
    batch_id, count = sync_module.resume_sync_package(limit=limit, batch_size=batch_size)

    if count == 0:
        console.print("[yellow]没有待同步的数据[/yellow]")
    else:
        sync_dir = sync_module.get_sync_dir()
        package_file = sync_dir / f"{batch_id}.json"
        console.print(f"[green]✓ 断点续传打包完成: {count} 条记录[/green]")
        console.print(f"[cyan]同步包: {package_file}[/cyan]")


@sync_app.command("batches")
def sync_batches(
    limit: int = typer.Option(10, "--limit", "-n", help="显示数量"),
):
    """列出同步批次列表"""
    batches = sync_module.list_all_sync_batches(limit=limit)

    table = Table(title="同步批次列表", row_styles=["none", "dim"])
    table.add_column("批次ID", style="cyan", width=40)
    table.add_column("状态", style="white", width=12)
    table.add_column("总记录", style="blue", justify="right", width=8)
    table.add_column("已处理", style="green", justify="right", width=8)
    table.add_column("进度", style="yellow", width=16)

    for b in batches:
        total = b.get("total_records", 0)
        processed = b.get("processed_records", 0)
        pct = (processed / total * 100) if total > 0 else 0
        status = b.get("status", "unknown")
        status_emoji = _get_batch_status_emoji(status)
        
        table.add_row(
            b.get("batch_id", ""),
            f"{status_emoji} {status}",
            str(total),
            str(processed),
            f"{pct:.1f}%",
        )

    console.print(table)


def _get_batch_status_emoji(status: str) -> str:
    status_map = {
        "pending": "⏳",
        "in_progress": "🔄",
        "completed": "✅",
        "failed": "❌",
    }
    return status_map.get(status, "❓")


@sync_app.command("apply")
def sync_apply(
    package: str = typer.Argument(..., help="同步包文件路径"),
    resolve: bool = typer.Option(False, "--resolve", "-r", help="自动解决冲突（使用本地版本）"),
):
    """应用同步数据包"""
    package_path = Path(package)
    if not package_path.exists():
        console.print(f"[red]同步包文件不存在: {package_path}[/red]")
        raise typer.Exit(1)

    try:
        result = sync_module.apply_sync_package(package_path, resolve_conflicts=resolve)
        console.print(Panel.fit(
            f"[bold]同步结果[/bold]\n\n"
            f"批次: [cyan]{result['batch_id']}[/cyan]\n"
            f"总计: [white]{result['total']}[/white] 条\n"
            f"成功: [green]{result['applied']}[/green] 条\n"
            f"冲突: [yellow]{result['conflicts']}[/yellow] 条\n"
            f"跳过: [dim]{result['skipped']}[/dim] 条",
            title="同步完成",
            border_style="green" if result['conflicts'] == 0 else "yellow",
        ))
    except Exception as e:
        console.print(f"[red]同步失败：{e}[/red]")
        raise typer.Exit(1)


@sync_app.command("status")
def sync_status():
    """查看同步状态"""
    status = sync_module.get_sync_status()
    packages = sync_module.list_sync_packages()

    info_table = Table(show_header=False, border_style="blue")
    info_table.add_column("项目", style="cyan", width=18)
    info_table.add_column("值", style="white")
    info_table.add_row("未同步记录", f"[yellow]{status['unsynced_count']}[/yellow] 条")
    info_table.add_row("未解决冲突", f"[red]{status['unresolved_conflicts']}[/red] 个")
    info_table.add_row("同步包数量", str(status['package_count']))

    console.print(Panel(info_table, title="同步状态", border_style="blue"))

    if packages:
        pkg_table = Table(title="最近同步包", row_styles=["none", "dim"])
        pkg_table.add_column("批次ID", style="cyan")
        pkg_table.add_column("记录数", style="green", justify="right")
        pkg_table.add_column("生成时间", style="yellow")

        for pkg in packages[:10]:
            pkg_table.add_row(pkg["batch_id"], str(pkg["record_count"]), pkg["generated_at"])

        console.print(pkg_table)


@sync_app.command("conflicts")
def sync_conflicts(
    resolved: bool = typer.Option(False, "--all", "-a", help="显示所有（包括已解决）"),
):
    """列出同步冲突"""
    conflicts = db.list_sync_conflicts(resolved=None if resolved else False)

    if not conflicts:
        console.print("[green]✓ 没有同步冲突[/green]")
        return

    table = Table(title=f"同步冲突 ({len(conflicts)}个)", row_styles=["none", "dim"])
    table.add_column("ID", style="cyan", width=6)
    table.add_column("表名", style="white", width=14)
    table.add_column("记录ID", style="yellow", width=10)
    table.add_column("状态", style="green", width=10)
    table.add_column("批次", style="magenta", width=20)

    for c in conflicts:
        status = "已解决" if c.resolved else "待处理"
        status_color = "green" if c.resolved else "red"
        table.add_row(
            str(c.id),
            c.table_name,
            str(c.record_id),
            f"[{status_color}]{status}[/{status_color}]",
            c.sync_batch,
        )

    console.print(table)


@sync_app.command("resolve")
def sync_resolve(
    conflict_id: int = typer.Argument(..., help="冲突ID"),
    use_local: bool = typer.Option(True, "--local/--remote", help="使用本地/远程版本"),
):
    """解决同步冲突"""
    success = sync_module.resolve_conflict(conflict_id, use_local=use_local)
    if success:
        version = "本地" if use_local else "远程"
        console.print(f"[green]✓ 冲突 {conflict_id} 已解决（使用{version}版本）[/green]")
    else:
        console.print(f"[red]解决冲突 {conflict_id} 失败[/red]")


@report_app.command("briefing")
def report_briefing(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="输出文件路径"),
    fmt: str = typer.Option("doc", "--format", "-f", help="输出格式: doc 或 html"),
):
    """生成发掘简报"""
    try:
        output_path = Path(output) if output else None
        result = report_module.generate_briefing(project_id, output_path, format=fmt)
        console.print(f"[green]✓ 发掘简报已生成: {result}[/green]")
    except Exception as e:
        console.print(f"[red]生成失败：{e}[/red]")
        raise typer.Exit(1)


@report_app.command("annual")
def report_annual(
    year: int = typer.Option(..., "--year", "-y", help="年份"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="输出文件路径"),
):
    """生成年度工作报告"""
    try:
        output_path = Path(output) if output else None
        result = report_module.generate_annual_report(year, output_path)
        console.print(f"[green]✓ 年度报告已生成: {result}[/green]")
    except Exception as e:
        console.print(f"[red]生成失败：{e}[/red]")
        raise typer.Exit(1)


@photo_app.command("thumbnails")
def photo_thumbnails(
    photo_dir: str = typer.Argument(..., help="照片目录路径"),
    output_dir: Optional[str] = typer.Option(None, "--output", "-o", help="输出目录"),
):
    """批量生成照片缩略图"""
    photo_path = Path(photo_dir)
    if not photo_path.is_dir():
        console.print(f"[red]目录不存在: {photo_dir}[/red]")
        raise typer.Exit(1)

    output_path = Path(output_dir) if output_dir else None

    with Progress() as progress:
        task = progress.add_task("生成缩略图...", total=None)
        thumbnails = photo_module.batch_generate_thumbnails(photo_path, output_path)
        progress.update(task, completed=len(thumbnails))

    console.print(f"[green]✓ 生成 {len(thumbnails)} 张缩略图[/green]")


@photo_app.command("rename")
def photo_rename(
    photo_dir: str = typer.Argument(..., help="照片目录路径"),
    prefix: str = typer.Option(..., "--prefix", "-p", help="文件名前缀"),
    start: int = typer.Option(1, "--start", "-s", help="起始序号"),
):
    """批量重命名照片"""
    photo_path = Path(photo_dir)
    if not photo_path.is_dir():
        console.print(f"[red]目录不存在: {photo_dir}[/red]")
        raise typer.Exit(1)

    renamed = photo_module.batch_rename_photos(photo_path, prefix, start)

    table = Table(title=f"重命名完成 ({len(renamed)}个文件)", row_styles=["none", "dim"])
    table.add_column("原文件名", style="dim")
    table.add_column("→", style="yellow")
    table.add_column("新文件名", style="green")

    for old, new in renamed[:20]:
        table.add_row(old.name, "→", new.name)

    if len(renamed) > 20:
        table.add_row(f"... 共 {len(renamed)} 个文件", "", "")

    console.print(table)


@photo_app.command("match")
def photo_match(
    project_id: int = typer.Option(..., "--project", "-p", help="项目ID"),
    photo_dir: str = typer.Argument(..., help="照片目录路径"),
):
    """批量匹配照片到遗物"""
    photo_path = Path(photo_dir)
    if not photo_path.is_dir():
        console.print(f"[red]目录不存在: {photo_dir}[/red]")
        raise typer.Exit(1)

    try:
        with Progress() as progress:
            task = progress.add_task("匹配照片中...", total=None)
            matched, unmatched = photo_module.match_photos_to_artifacts(project_id, photo_path)
            progress.update(task, completed=len(matched) + len(unmatched))

        console.print(Panel.fit(
            f"[bold]匹配结果[/bold]\n\n"
            f"成功匹配: [green]{len(matched)}[/green] 张\n"
            f"待确认: [yellow]{len(unmatched)}[/yellow] 张",
            title="照片匹配完成",
            border_style="green",
        ))
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)


@photo_app.command("info")
def photo_info(
    image: str = typer.Argument(..., help="图片文件路径"),
):
    """查看照片信息"""
    image_path = Path(image)
    if not image_path.is_file():
        console.print(f"[red]文件不存在: {image}[/red]")
        raise typer.Exit(1)

    info = photo_module.get_photo_info(image_path)

    info_table = Table(show_header=False, border_style="blue")
    info_table.add_column("属性", style="cyan", width=15)
    info_table.add_column("值", style="white")
    info_table.add_row("文件名", info["name"])
    info_table.add_row("文件大小", f"{info['size']:,} bytes")
    info_table.add_row("尺寸", f"{info['width']} × {info['height']}")
    info_table.add_row("格式", info["format"])
    info_table.add_row("拍摄时间", str(info["photo_time"]) if info["photo_time"] else "-")
    info_table.add_row("GPS纬度", f"{info['gps_latitude']:.6f}" if info["gps_latitude"] else "-")
    info_table.add_row("GPS经度", f"{info['gps_longitude']:.6f}" if info["gps_longitude"] else "-")
    info_table.add_row("相机品牌", info["camera_make"] or "-")
    info_table.add_row("相机型号", info["camera_model"] or "-")

    console.print(Panel(info_table, title="照片信息", border_style="blue"))


@config_app.command("show")
def config_show():
    """显示当前配置"""
    config = load_config()
    institute = get_current_institute()

    info_table = Table(show_header=False, border_style="blue")
    info_table.add_column("配置项", style="cyan", width=20)
    info_table.add_column("值", style="white")
    info_table.add_row("当前研究所", f"[bold]{institute.name}[/bold]")
    info_table.add_row("研究所代码", institute.code)
    info_table.add_row("遗址总数", str(institute.sites))
    info_table.add_row("数据库路径", str(config.database.path))
    info_table.add_row("日志目录", config.log.directory)
    info_table.add_row("日志保留天数", str(config.log.retention_days))
    info_table.add_row("日志级别", config.log.level)

    console.print(Panel(info_table, title="系统配置", border_style="blue"))

    if len(config.institutes) > 1:
        ins_table = Table(title="所有研究所", row_styles=["none", "dim"])
        ins_table.add_column("名称", style="white")
        ins_table.add_column("代码", style="cyan")
        ins_table.add_column("遗址数", style="green", justify="right")
        ins_table.add_column("当前", style="yellow")

        for name, ins in config.institutes.items():
            current = "✅" if name == config.current_institute else ""
            ins_table.add_row(ins.name, ins.code, str(ins.sites), current)

        console.print(ins_table)


@config_app.command("switch")
def config_switch(
    name: str = typer.Argument(..., help="研究所名称"),
):
    """切换当前研究所配置"""
    success = switch_institute(name)
    if success:
        console.print(f"[green]✓ 已切换到研究所: {name}[/green]")
    else:
        console.print(f"[red]研究所 {name} 不存在[/red]")
        raise typer.Exit(1)


@config_app.command("add")
def config_add(
    name: str = typer.Option(..., "--name", "-n", help="研究所名称"),
    code: str = typer.Option(..., "--code", "-c", help="研究所代码"),
    sites: int = typer.Option(0, "--sites", "-s", help="遗址数量"),
):
    """添加研究所配置"""
    add_institute(name, code, sites)
    console.print(f"[green]✓ 已添加研究所: {name} ({code})[/green]")


@config_app.command("remove")
def config_remove(
    name: str = typer.Argument(..., help="研究所名称"),
):
    """删除研究所配置"""
    if name == "default":
        console.print("[red]不能删除默认配置[/red]")
        raise typer.Exit(1)

    success = remove_institute(name)
    if success:
        console.print(f"[green]✓ 已删除研究所: {name}[/green]")
    else:
        console.print(f"[red]研究所 {name} 不存在[/red]")
        raise typer.Exit(1)


def main():
    app()


if __name__ == "__main__":
    main()
