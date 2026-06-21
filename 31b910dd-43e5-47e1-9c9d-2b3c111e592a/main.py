import argparse
import shutil
import sys
import time
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import (
    BASE_DIR, REPORT_DIR, LOG_DIR, DATA_DIR, DB_PATH,
    CTD_MODULES, DRUG_TYPE_CONFIG, REVIEW_MODULES, ISSUE_SEVERITY,
    CHECK_STATUS, TASK_PRIORITY, DISK_SPACE_THRESHOLD_MB, PERFORMANCE,
)
from logger import logger
from database import DatabaseManager
from ctd_validator import CTDValidator
from file_checker import FileChecker
from issue_classifier import IssueClassifier, ClassifiedIssue
from report_generator import ReportGenerator, MODULE_LABELS, SEVERITY_LABELS, RECOMMENDATION_LABELS


RESET = "\033[0m"
BOLD = "\033[1m"
CLEAR_LINE = "\033[2K\r"
CURSOR_UP = "\033[1A"


class ProgressDisplay:
    def __init__(self, project_name: str) -> None:
        self.project_name = project_name
        self.module_status: Dict[str, str] = {m["key"]: "PENDING" for m in REVIEW_MODULES}
        self.module_issues: Dict[str, int] = {m["key"]: 0 for m in REVIEW_MODULES}
        self.overall_progress: float = 0.0
        self.start_time: float = time.time()
        self.current_module: str = ""
        self.issues_found: List[str] = []
        self._lock = threading.Lock()
        self._lines_printed = 0

    def set_module_status(self, module_key: str, status: str, issues_count: int = 0) -> None:
        with self._lock:
            self.module_status[module_key] = status
            self.module_issues[module_key] = issues_count
            completed = sum(1 for s in self.module_status.values() if s in ("PASS", "WARNING", "ERROR"))
            self.overall_progress = (completed / len(REVIEW_MODULES)) * 100
            if status == "RUNNING":
                self.current_module = module_key
            self._refresh()

    def add_issue_highlight(self, description: str, severity: str) -> None:
        with self._lock:
            color = ISSUE_SEVERITY.get(severity, {}).get("color", "")
            label = ISSUE_SEVERITY.get(severity, {}).get("label", severity)
            self.issues_found.append(f"{color}[{label}]{RESET} {description[:80]}")
            self._refresh()

    def _status_icon(self, status: str) -> str:
        info = CHECK_STATUS.get(status, CHECK_STATUS["PENDING"])
        return f"{info['color']}{info['icon']}{RESET}"

    def _refresh(self) -> None:
        if self._lines_printed > 0:
            sys.stdout.write(CURSOR_UP * self._lines_printed)

        lines: List[str] = []
        lines.append(f"{BOLD}=== CTD申报资料智能审查系统 ==={RESET}")
        lines.append(f"项目: {self.project_name}")
        lines.append(f"开始: {datetime.fromtimestamp(self.start_time).strftime('%H:%M:%S')} | "
                     f"已用时: {int(time.time() - self.start_time)}秒")

        bar_width = 40
        filled = int(self.overall_progress / 100 * bar_width)
        bar = "█" * filled + "░" * (bar_width - filled)
        eta = ""
        if self.overall_progress > 0 and self.overall_progress < 100:
            remaining = (time.time() - self.start_time) / self.overall_progress * (100 - self.overall_progress)
            eta = f" | 预计剩余: {int(remaining)}秒"
        lines.append(f"进度: [{bar}] {self.overall_progress:5.1f}%{eta}")
        lines.append("")
        lines.append(f"{'模块':<18} {'状态':<8} {'问题数':>6}")
        lines.append("-" * 36)
        for mod in REVIEW_MODULES:
            key = mod["key"]
            status = self.module_status[key]
            icon = self._status_icon(status)
            issues = self.module_issues[key]
            marker = " ◀" if key == self.current_module and status == "RUNNING" else ""
            lines.append(f"{MODULE_LABELS.get(key, key):<18} {icon} {CHECK_STATUS.get(status, {}).get('label', '待检'):<6} {issues:>6}{marker}")

        lines.append("")
        if self.issues_found:
            lines.append(f"{BOLD}发现问题（最新5条）:{RESET}")
            for issue in self.issues_found[-5:]:
                lines.append(f"  {issue}")

        output = "\n".join(lines) + "\n"
        sys.stdout.write(CLEAR_LINE + output)
        sys.stdout.flush()
        self._lines_printed = len(lines)

    def finalize(self) -> None:
        with self._lock:
            self.overall_progress = 100
            for k in self.module_status:
                if self.module_status[k] == "PENDING":
                    self.module_status[k] = "PASS"
            self._refresh()
            sys.stdout.write("\n")


def check_disk_space() -> bool:
    try:
        usage = shutil.disk_usage(str(BASE_DIR))
        free_mb = usage.free / (1024 * 1024)
        if free_mb < DISK_SPACE_THRESHOLD_MB:
            logger.warning(f"磁盘空间不足: {free_mb:.0f}MB < 阈值 {DISK_SPACE_THRESHOLD_MB}MB")
            return False
        logger.info(f"磁盘可用空间: {free_mb:.0f}MB")
        return True
    except Exception as e:
        logger.warning(f"磁盘空间检测失败: {e}")
        return True


def validate_folder_path(path_str: str) -> Optional[Path]:
    path = Path(path_str).expanduser().resolve()
    if not path.exists():
        print(f"错误: 路径不存在 - {path}")
        return None
    if not path.is_dir():
        print(f"错误: 不是目录 - {path}")
        return None
    return path


def get_folder_stats(folder: Path) -> tuple[int, float]:
    total_files = 0
    total_size = 0
    for p in folder.rglob("*"):
        if p.is_file():
            total_files += 1
            try:
                total_size += p.stat().st_size
            except OSError:
                pass
    return total_files, total_size / (1024 * 1024)


def interactive_prompt() -> Dict[str, Any]:
    print(f"\n{BOLD}=== CTD申报资料智能审查系统 ==={RESET}\n")
    config: Dict[str, Any] = {}

    while True:
        raw = input("请输入申报资料目录路径: ").strip()
        if not raw:
            continue
        folder = validate_folder_path(raw)
        if folder:
            config["folder_path"] = folder
            break

    default_name = config["folder_path"].name
    name_input = input(f"项目名称（回车使用默认: {default_name}）: ").strip()
    config["project_name"] = name_input or default_name

    print("\n药品类型:")
    for i, (key, info) in enumerate(DRUG_TYPE_CONFIG.items(), 1):
        print(f"  {i}. {info['label']}")
    while True:
        drug_choice = input("请选择药品类型（默认: 1 化学药）: ").strip() or "1"
        if drug_choice.isdigit() and 1 <= int(drug_choice) <= len(DRUG_TYPE_CONFIG):
            keys = list(DRUG_TYPE_CONFIG.keys())
            config["drug_type"] = keys[int(drug_choice) - 1]
            break
        print("无效选择，请重新输入")

    print("\n优先级:")
    for i, (key, val) in enumerate(TASK_PRIORITY.items(), 1):
        print(f"  {i}. {key}")
    pri_choice = input("请选择优先级（默认: 2 NORMAL）: ").strip() or "2"
    if pri_choice.isdigit() and 1 <= int(pri_choice) <= len(TASK_PRIORITY):
        keys = list(TASK_PRIORITY.keys())
        config["priority"] = keys[int(pri_choice) - 1]
    else:
        config["priority"] = "NORMAL"

    applicant = input("申请人（可选）: ").strip()
    config["applicant"] = applicant

    return config


def run_review(config: Dict[str, Any], resume_from: Optional[int] = None) -> Dict[str, Any]:
    folder_path: Path = config["folder_path"]
    project_name = config["project_name"]
    drug_type = config["drug_type"]
    priority = config.get("priority", "NORMAL")
    applicant = config.get("applicant", "")

    logger.info(f"开始审查项目: {project_name}")
    logger.info(f"资料路径: {folder_path}")
    logger.info(f"药品类型: {DRUG_TYPE_CONFIG[drug_type]['label']}")

    db = DatabaseManager()

    if resume_from:
        logger.info(f"恢复审查项目 ID={resume_from}")
        project = db.get_project(resume_from)
        if not project:
            logger.error("待恢复的项目不存在")
            return {"success": False}
        project_id = resume_from
        checkpoint = db.load_checkpoint(project_id) or {}
        completed_modules = checkpoint.get("completed_modules", [])
    else:
        total_files, total_size_mb = get_folder_stats(folder_path)
        project_id = db.create_project(
            project_name=project_name,
            drug_type=drug_type,
            folder_path=str(folder_path),
            applicant=applicant,
            priority=priority,
            total_files=total_files,
            total_size_mb=total_size_mb,
        )
        completed_modules = []
        logger.info(f"项目已创建 ID={project_id}, 文件数={total_files}, 大小={total_size_mb:.2f}MB")

    display = ProgressDisplay(project_name)

    start_time = time.time()
    all_issues: List[Any] = []
    structure_diff: List[str] = []
    overview_info = None
    stats_by_module: Dict[str, int] = {}

    ctd_validator = CTDValidator(str(folder_path), drug_type)
    display.set_module_status("ctd_structure", "RUNNING")

    if "ctd_structure" not in completed_modules:
        structure_issues_raw, structure_stats = ctd_validator.validate_structure()
        structure_diff = ctd_validator.directory_tree_diff
        ctd_issue_count = len(structure_issues_raw)
        for issue in structure_issues_raw:
            severity_display = getattr(issue, "severity", "DEFECT")
            display.add_issue_highlight(getattr(issue, "description", ""), severity_display)
        all_issues.extend(structure_issues_raw)
        stats_by_module["ctd_structure"] = ctd_issue_count
        status = "ERROR" if ctd_issue_count > 0 and any(
            getattr(i, "severity", "") == "FATAL" for i in structure_issues_raw
        ) else ("WARNING" if ctd_issue_count > 0 else "PASS")
        db.update_module_progress(project_id, "ctd_structure", status, ctd_issue_count)
        display.set_module_status("ctd_structure", status, ctd_issue_count)
        completed_modules.append("ctd_structure")
        db.save_checkpoint(project_id, {
            "completed_modules": completed_modules,
            "issues_collected": len(all_issues),
        })
    else:
        ctd_validator.scan_directory()
        display.set_module_status("ctd_structure", "WARNING", stats_by_module.get("ctd_structure", 0))

    files = ctd_validator.get_all_files()
    files_by_module = ctd_validator.get_files_by_module()

    file_checker = FileChecker(files, drug_type, files_by_module)

    module_checks = [
        ("file_naming", lambda: file_checker.check_file_naming()),
        ("page_continuity", lambda: file_checker.check_page_continuity()),
        ("signature_seal", lambda: file_checker.check_signature_seal()),
    ]

    for mod_key, check_fn in module_checks:
        if mod_key in completed_modules:
            display.set_module_status(mod_key, "WARNING", stats_by_module.get(mod_key, 0))
            continue

        display.set_module_status(mod_key, "RUNNING")
        db.update_module_progress(project_id, mod_key, "RUNNING")
        mod_start = time.time()
        try:
            issues = check_fn()
            count = len(issues)
            for issue in issues:
                display.add_issue_highlight(
                    getattr(issue, "description", ""),
                    getattr(issue, "severity", "DEFECT"),
                )
            all_issues.extend(issues)
            stats_by_module[mod_key] = count
            status = "ERROR" if any(getattr(i, "severity", "") == "FATAL" for i in issues) else (
                "WARNING" if count > 0 else "PASS"
            )
        except Exception as e:
            logger.error(f"{mod_key} 检查异常: {e}", exception=e)
            status = "ERROR"
            count = 0

        db.update_module_progress(project_id, mod_key, status, count, time.time() - mod_start)
        display.set_module_status(mod_key, status, count)
        completed_modules.append(mod_key)
        db.save_checkpoint(project_id, {
            "completed_modules": completed_modules,
            "issues_collected": len(all_issues),
        })

    display.set_module_status("overview_check", "RUNNING")
    db.update_module_progress(project_id, "overview_check", "RUNNING")
    if "overview_check" not in completed_modules:
        try:
            overview_issues, overview_info = file_checker.check_overview_content()
            count = len(overview_issues)
            for issue in overview_issues:
                display.add_issue_highlight(
                    getattr(issue, "description", ""),
                    getattr(issue, "severity", "DEFECT"),
                )
            all_issues.extend(overview_issues)
            stats_by_module["overview_check"] = count
            status = "WARNING" if count > 0 else "PASS"
        except Exception as e:
            logger.error(f"综述内容抽检异常: {e}", exception=e)
            status = "ERROR"
            count = 0
        db.update_module_progress(project_id, "overview_check", status, count)
        display.set_module_status("overview_check", status, count)
        completed_modules.append("overview_check")
        db.save_checkpoint(project_id, {
            "completed_modules": completed_modules,
            "issues_collected": len(all_issues),
        })
    else:
        display.set_module_status("overview_check", "WARNING", stats_by_module.get("overview_check", 0))

    display.set_module_status("cross_validate", "RUNNING")
    db.update_module_progress(project_id, "cross_validate", "RUNNING")
    if "cross_validate" not in completed_modules:
        project_ctx = {
            "project_name": project_name,
            "applicant": applicant,
        }
        try:
            cross_issues = file_checker.cross_validate_with_directory(project_ctx)
            count = len(cross_issues)
            for issue in cross_issues:
                display.add_issue_highlight(
                    getattr(issue, "description", ""),
                    getattr(issue, "severity", "DEFECT"),
                )
            all_issues.extend(cross_issues)
            stats_by_module["cross_validate"] = count
            status = "WARNING" if count > 0 else "PASS"
        except Exception as e:
            logger.error(f"交叉校验异常: {e}", exception=e)
            status = "ERROR"
            count = 0
        db.update_module_progress(project_id, "cross_validate", status, count)
        display.set_module_status("cross_validate", status, count)
        completed_modules.append("cross_validate")
    else:
        display.set_module_status("cross_validate", "WARNING", stats_by_module.get("cross_validate", 0))

    logger.info("开始问题分类与历史匹配")
    classifier = IssueClassifier(db)
    stats = classifier.classify_all(all_issues, project_id)

    classified_issues: List[ClassifiedIssue] = classifier.classified_issues
    db.insert_issues(project_id, classifier.to_db_records())

    display.finalize()

    total_duration = time.time() - start_time
    logger.step("全量审查", start_time)

    project_info = {
        "project_name": project_name,
        "drug_type": drug_type,
        "applicant": applicant,
        "folder_path": folder_path,
        "total_files": sum(files_by_module.values().__class__(), []) and len(files),
        "total_size_mb": sum(
            (lambda f: f.stat().st_size if f.exists() else 0)(f)
            for f in files
        ) / (1024 * 1024) if files else 0,
        "overview_info": overview_info,
    }
    total_size_calc = 0.0
    for f in files:
        try:
            total_size_calc += f.stat().st_size
        except OSError:
            pass
    project_info["total_size_mb"] = total_size_calc / (1024 * 1024)
    project_info["total_files"] = len(files)

    db.update_project(
        project_id,
        progress=100,
        total_files=project_info["total_files"],
        total_size_mb=project_info["total_size_mb"],
    )
    db.complete_project(project_id)

    logger.info("生成审查报告")
    reporter = ReportGenerator(project_name)
    report_paths = reporter.generate_reports(
        classified_issues, stats, project_info, structure_diff
    )

    classifier.print_summary()

    print(f"\n{BOLD}审查完成！{RESET}")
    print(f"总耗时: {total_duration:.1f} 秒")
    print(f"\n{BOLD}报告文件路径:{RESET}")
    for fmt, path in report_paths.items():
        print(f"  {fmt.upper():>5}: {path}")
    print(f"\n审查记录 ID: {project_id} (可用于回溯)")

    return {
        "success": True,
        "project_id": project_id,
        "total_duration": total_duration,
        "stats": stats,
        "report_paths": report_paths,
        "issues_count": stats["total"],
    }


def list_projects_action(limit: int, status_filter: Optional[str]) -> None:
    db = DatabaseManager()
    projects = db.list_projects(status=status_filter, limit=limit)
    if not projects:
        print("暂无审查记录")
        return

    print(f"\n{BOLD}审查记录（共 {len(projects)} 条）{RESET}")
    print("-" * 90)
    print(f"{'ID':>4}  {'状态':<10}  {'药品类型':<8}  {'项目名称':<30}  {'创建时间':<20}")
    print("-" * 90)
    for p in projects:
        drug_label = DRUG_TYPE_CONFIG.get(p.get("drug_type", "chemical"), {}).get("label", "")
        created = p.get("created_at", "")[:19].replace("T", " ")
        print(f"{p['id']:>4}  {p.get('status', ''):<10}  {drug_label:<8}  "
              f"{p.get('project_name', '')[:30]:<30}  {created:<20}")


def show_project_details(project_id: int, severity_filter: Optional[str]) -> None:
    db = DatabaseManager()
    project = db.get_project(project_id)
    if not project:
        print(f"未找到项目 ID={project_id}")
        return

    drug_label = DRUG_TYPE_CONFIG.get(project.get("drug_type", "chemical"), {}).get("label", "")
    print(f"\n{BOLD}项目详情{RESET}")
    print(f"  ID: {project['id']}")
    print(f"  项目名称: {project.get('project_name', '')}")
    print(f"  药品类型: {drug_label}")
    print(f"  申请人: {project.get('applicant', '—')}")
    print(f"  资料路径: {project.get('folder_path', '')}")
    print(f"  状态: {project.get('status', '')}")
    print(f"  进度: {project.get('progress', 0):.1f}%")
    print(f"  文件总数: {project.get('total_files', 0)}")
    print(f"  资料大小: {project.get('total_size_mb', 0):.2f} MB")
    print(f"  开始时间: {project.get('started_at', '—')}")
    print(f"  完成时间: {project.get('completed_at', '—')}")

    issues = db.get_project_issues(project_id, severity=severity_filter)
    if not issues:
        print("\n无问题记录")
        return

    print(f"\n{BOLD}问题清单（共 {len(issues)} 条）{RESET}")
    if severity_filter:
        print(f"  筛选: {SEVERITY_LABELS.get(severity_filter, severity_filter)}")
    print("-" * 100)
    print(f"{'ID':>4}  {'严重程度':<8}  {'模块':<18}  {'问题类型':<20}  描述")
    print("-" * 100)
    for issue in issues:
        sev_label = SEVERITY_LABELS.get(issue.get("severity", ""), issue.get("severity", ""))
        mod_label = MODULE_LABELS.get(issue.get("module", ""), issue.get("module", ""))
        desc = issue.get("description", "")[:45]
        print(f"{issue['id']:>4}  {sev_label:<8}  {mod_label:<18}  "
              f"{issue.get('issue_type', ''):<20}  {desc}")


def show_common_issues(limit: int) -> None:
    db = DatabaseManager()
    stats = db.get_common_issue_stats(limit)
    if not stats:
        print("历史问题库为空")
        return
    print(f"\n{BOLD}常见问题排行榜 TOP{limit}{RESET}")
    print("-" * 70)
    print(f"{'频次':>5}  {'严重程度':<8}  {'问题类型':<28}  建议")
    print("-" * 70)
    for s in stats:
        sev_label = SEVERITY_LABELS.get(s.get("severity", ""), s.get("severity", ""))
        sug = (s.get("typical_suggestion", "") or "")[:30]
        print(f"{s.get('occurrence_count', 0):>5}  {sev_label:<8}  {s.get('issue_type', ''):<28}  {sug}")


def export_project_action(project_id: int) -> None:
    db = DatabaseManager()
    project = db.get_project(project_id)
    if not project:
        print(f"未找到项目 ID={project_id}")
        return
    safe_name = "".join(c for c in project.get("project_name", f"project_{project_id}")
                        if c.isalnum() or c in "-_ ").strip().replace(" ", "_")
    export_path = REPORT_DIR / f"{safe_name}_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    db.export_project_data(project_id, export_path)
    print(f"项目数据已导出: {export_path}")


def backup_action() -> None:
    db = DatabaseManager()
    path = db.backup_database()
    print(f"数据库已备份: {path}")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ctd-review",
        description="药品注册申报资料CTD格式智能审查系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py review                            # 交互式启动审查
  python main.py review -f /path/to/files -n 项目名 -d chemical  # 命令行参数审查
  python main.py list                              # 列出审查记录
  python main.py show 1                            # 查看项目ID=1的详情
  python main.py show 1 -s FATAL                   # 仅查看致命错误
  python main.py common                            # 查看常见问题排行
  python main.py resume 1                          # 恢复中断的审查
  python main.py backup                            # 备份数据库
  python main.py info                              # 显示系统信息
        """,
    )
    sub = parser.add_subparsers(dest="command", required=False)

    review_p = sub.add_parser("review", help="启动资料审查")
    review_p.add_argument("-f", "--folder", type=str, help="申报资料目录路径")
    review_p.add_argument("-n", "--name", type=str, help="项目名称")
    review_p.add_argument("-d", "--drug-type", choices=list(DRUG_TYPE_CONFIG.keys()),
                          default="chemical", help="药品类型")
    review_p.add_argument("-p", "--priority", choices=list(TASK_PRIORITY.keys()),
                          default="NORMAL", help="优先级")
    review_p.add_argument("-a", "--applicant", type=str, default="", help="申请人")
    review_p.add_argument("-r", "--resume", type=int, help="恢复指定ID的审查项目")

    list_p = sub.add_parser("list", help="列出审查记录")
    list_p.add_argument("-l", "--limit", type=int, default=20, help="显示条数")
    list_p.add_argument("-s", "--status", type=str, choices=["PENDING", "RUNNING", "COMPLETED"],
                        help="按状态过滤")

    show_p = sub.add_parser("show", help="查看项目详情")
    show_p.add_argument("project_id", type=int, help="项目ID")
    show_p.add_argument("-s", "--severity", type=str,
                        choices=list(ISSUE_SEVERITY.keys()),
                        help="按严重程度过滤问题")

    sub.add_parser("common", help="查看常见问题排行").add_argument(
        "-l", "--limit", type=int, default=20, help="显示条数"
    )

    resume_p = sub.add_parser("resume", help="恢复中断的审查")
    resume_p.add_argument("project_id", type=int, help="要恢复的项目ID")

    sub.add_parser("backup", help="备份数据库")

    export_p = sub.add_parser("export", help="导出项目数据")
    export_p.add_argument("project_id", type=int, help="项目ID")

    sub.add_parser("info", help="显示系统信息")

    return parser


def print_system_info() -> None:
    print(f"\n{BOLD}=== CTD申报资料智能审查系统 ==={RESET}")
    print(f"  基础目录: {BASE_DIR}")
    print(f"  数据目录: {DATA_DIR}")
    print(f"  报告目录: {REPORT_DIR}")
    print(f"  日志目录: {LOG_DIR}")
    print(f"  数据库:   {DB_PATH}")
    print(f"  最大并行任务: {PERFORMANCE['max_parallel_tasks']}")
    print(f"  单任务时限: {PERFORMANCE['max_review_time_minutes']} 分钟")
    print(f"  内存限制: {PERFORMANCE['max_memory_mb']} MB")
    print(f"  日志保留: {PERFORMANCE['log_retention_days']} 天")
    print()
    print(f"  支持药品类型: {', '.join(v['label'] for v in DRUG_TYPE_CONFIG.values())}")
    print(f"  检查模块: {', '.join(m['name'] for m in REVIEW_MODULES)}")
    disk_ok = check_disk_space()
    print(f"  磁盘状态: {'正常' if disk_ok else '⚠ 空间不足'}")


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()

    if not args.command:
        print_system_info()
        parser.print_help()
        return 0

    if not check_disk_space():
        print("警告: 磁盘空间不足，部分功能可能受限")

    if args.command == "info":
        print_system_info()
        return 0

    if args.command == "backup":
        backup_action()
        return 0

    if args.command == "common":
        show_common_issues(args.limit)
        return 0

    if args.command == "list":
        list_projects_action(args.limit, args.status)
        return 0

    if args.command == "show":
        show_project_details(args.project_id, args.severity)
        return 0

    if args.command == "export":
        export_project_action(args.project_id)
        return 0

    if args.command == "resume":
        db = DatabaseManager()
        project = db.get_project(args.project_id)
        if not project:
            print(f"错误: 项目 ID={args.project_id} 不存在")
            return 1
        config = {
            "folder_path": Path(project["folder_path"]),
            "project_name": project["project_name"],
            "drug_type": project.get("drug_type", "chemical"),
            "priority": project.get("priority", "NORMAL"),
            "applicant": project.get("applicant", ""),
        }
        result = run_review(config, resume_from=args.project_id)
        return 0 if result.get("success") else 1

    if args.command == "review":
        if args.resume:
            db = DatabaseManager()
            project = db.get_project(args.resume)
            if not project:
                print(f"错误: 项目 ID={args.resume} 不存在")
                return 1
            config = {
                "folder_path": Path(project["folder_path"]),
                "project_name": project["project_name"],
                "drug_type": project.get("drug_type", "chemical"),
                "priority": project.get("priority", "NORMAL"),
                "applicant": project.get("applicant", ""),
            }
            result = run_review(config, resume_from=args.resume)
            return 0 if result.get("success") else 1

        if args.folder:
            folder = validate_folder_path(args.folder)
            if not folder:
                return 1
            config = {
                "folder_path": folder,
                "project_name": args.name or folder.name,
                "drug_type": args.drug_type,
                "priority": args.priority,
                "applicant": args.applicant,
            }
            result = run_review(config)
            return 0 if result.get("success") else 1
        else:
            config = interactive_prompt()
            result = run_review(config)
            return 0 if result.get("success") else 1

    parser.print_help()
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n用户中断操作")
        sys.exit(130)
    except Exception as e:
        logger.critical(f"程序异常终止: {e}", exception=e)
        print(f"\n程序异常终止: {e}")
        print("详细信息请查看日志文件")
        sys.exit(1)
