"""
main.py
================================================================================
社会保险基金申报自动化工具 - 主调度模块。

职责：
  1. 命令行交互界面（配置文件路径、操作模式、-v 调试日志）
  2. 调度整体流程、异常恢复、日志记录
  3. 断点续传与恢复
  4. 实时进度显示（当前步骤、已处理/剩余数量）
  5. 内存占用监控
  6. 全量申报 / 增量申报 / 仅校验 三种模式

用法：
    python main.py -c config.yaml -m full -i ./input -v
    python main.py --config config.yaml --mode validate --input ./input
    python main.py --resume          # 从断点继续
"""

from __future__ import annotations

import argparse
import json
import logging
import logging.handlers
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit("缺少 PyYAML 依赖，请运行：pip install pyyaml") from exc

from data_validator import (ConsistencyReport, DataValidator, ValidationResult,
                            summarize_result)
from error_handler import ErrorHandler, InterventionRequired
from excel_parser import ExcelParser, ParsedSheet
from gui_automator import GuiAutomator
from pdf_parser import PdfParser, ReceiptInfo

logger = logging.getLogger("si_automation")

# 操作模式常量
MODE_FULL = "full"
MODE_INCREMENT = "increment"
MODE_VALIDATE = "validate"
VALID_MODES = (MODE_FULL, MODE_INCREMENT, MODE_VALIDATE)

# 流水线阶段
PHASE_INIT = "init"
PHASE_PARSE = "parse"
PHASE_VALIDATE = "validate"
PHASE_LOGIN = "login"
PHASE_PERSONNEL = "personnel"
PHASE_WAGE = "wage"
PHASE_RECEIPT = "receipt"
PHASE_REPORT = "report"
PHASE_DONE = "done"


# ============================== 配置与日志 ==============================

def load_config(config_path: str) -> Dict[str, Any]:
    """加载 YAML 配置文件。"""
    if not os.path.isfile(config_path):
        raise FileNotFoundError(f"配置文件不存在：{config_path}")
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    if not isinstance(config, dict):
        raise ValueError("配置文件格式错误：根节点应为字典")
    logger.info("配置已加载：%s", config_path)
    return config


def setup_logging(config: Dict[str, Any], verbose: bool = False) -> None:
    """配置日志（控制台 + 滚动文件）。"""
    log_cfg: Dict[str, Any] = config.get("logging", {})
    sys_cfg: Dict[str, Any] = config.get("system", {})
    level = logging.DEBUG if verbose else getattr(logging, log_cfg.get("level", "INFO"), logging.INFO)
    log_dir = sys_cfg.get("log_dir", "./logs")
    os.makedirs(log_dir, exist_ok=True)
    fmt = log_cfg.get("format", "%(asctime)s [%(levelname)s] %(name)s - %(message)s")
    date_fmt = log_cfg.get("date_format", "%Y-%m-%d %H:%M:%S")
    formatter = logging.Formatter(fmt, datefmt=date_fmt)

    root = logging.getLogger()
    root.setLevel(level)
    # 清理已有 handler，避免重复
    for h in list(root.handlers):
        root.removeHandler(h)

    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    console.setFormatter(formatter)
    root.addHandler(console)

    name_fmt = log_cfg.get("filename_format", "si_automation_%Y%m%d.log")
    filename = time.strftime(name_fmt)
    max_bytes = int(log_cfg.get("max_file_size_mb", 10)) * 1024 * 1024
    backup = int(log_cfg.get("backup_count", 7))
    file_handler = logging.handlers.RotatingFileHandler(
        os.path.join(log_dir, filename), maxBytes=max_bytes,
        backupCount=backup, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)


# ============================== 进度展示 ==============================

class ProgressTracker:
    """实时进度展示：当前步骤、已处理、剩余。"""

    def __init__(self) -> None:
        self.current_step: str = ""
        self.total: int = 0
        self.done: int = 0
        self.start_time: float = time.time()

    def start(self, step: str, total: int) -> None:
        self.current_step = step
        self.total = total
        self.done = 0
        self.start_time = time.time()
        self._render()

    def advance(self, n: int = 1) -> None:
        self.done += n
        self._render()

    def set_step(self, step: str) -> None:
        self.current_step = step
        self._render()

    def _render(self) -> None:
        remaining = max(0, self.total - self.done)
        pct = (self.done / self.total * 100) if self.total else 0.0
        elapsed = time.time() - self.start_time
        bar_len = 30
        filled = int(bar_len * self.done / self.total) if self.total else 0
        bar = "#" * filled + "-" * (bar_len - filled)
        line = (f"\r[{bar}] {pct:5.1f}% | {self.current_step} | "
                f"已处理 {self.done}/{self.total} | 剩余 {remaining} | "
                f"用时 {elapsed:.0f}s")
        sys.stdout.write(line)
        sys.stdout.flush()
        if self.total and self.done >= self.total:
            sys.stdout.write("\n")
            sys.stdout.flush()

    def error(self, message: str) -> None:
        sys.stdout.write("\n")
        sys.stdout.flush()
        highlight = f"\033[91m[错误] {message}\033[0m"
        print(highlight, flush=True)


# ============================== 断点续传 ==============================

class CheckpointManager:
    """断点续传管理器：记录每步执行状态，支持从断点继续。"""

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config
        cp_cfg: Dict[str, Any] = config.get("checkpoint", {})
        self.enabled = bool(cp_cfg.get("enabled", True))
        self.save_interval = int(cp_cfg.get("save_interval", 10))
        self.verify_on_resume = bool(cp_cfg.get("verify_on_resume", True))
        sys_cfg: Dict[str, Any] = config.get("system", {})
        self.path = sys_cfg.get("checkpoint_file", "./logs/checkpoint.json")
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        self.state: Dict[str, Any] = self._default_state()

    @staticmethod
    def _default_state() -> Dict[str, Any]:
        return {
            "phase": PHASE_INIT,
            "personnel_done": 0,
            "wage_done": 0,
            "receipts_done": 0,
            "personnel_total": 0,
            "wage_total": 0,
            "receipts_total": 0,
            "updated_at": "",
            "errors": [],
        }

    def load(self) -> Dict[str, Any]:
        if not self.enabled or not os.path.isfile(self.path):
            return self._default_state()
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                self.state = json.load(f)
            logger.info("断点状态已加载：%s（阶段=%s）", self.path, self.state.get("phase"))
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("断点文件读取失败，重新开始：%s", exc)
            self.state = self._default_state()
        return self.state

    def save(self, **updates: Any) -> None:
        if not self.enabled:
            return
        self.state.update(updates)
        self.state["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        tmp = self.path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.state, f, ensure_ascii=False, indent=2)
            os.replace(tmp, self.path)
        except OSError as exc:
            logger.warning("断点保存失败：%s", exc)

    def mark_done(self, phase: str, **counts: Any) -> None:
        self.save(phase=phase, **counts)

    def reset(self) -> None:
        self.state = self._default_state()
        if os.path.isfile(self.path):
            os.remove(self.path)
        logger.info("断点状态已重置")

    def should_skip(self, phase: str) -> bool:
        """判断某阶段是否已断点完成。"""
        order = [PHASE_INIT, PHASE_PARSE, PHASE_VALIDATE, PHASE_LOGIN,
                 PHASE_PERSONNEL, PHASE_WAGE, PHASE_RECEIPT, PHASE_REPORT, PHASE_DONE]
        try:
            saved_idx = order.index(self.state.get("phase", PHASE_INIT))
            target_idx = order.index(phase)
        except ValueError:
            return False
        return saved_idx > target_idx


# ============================== 内存监控 ==============================

class MemoryMonitor:
    """内存占用监控，超限告警。"""

    def __init__(self, limit_mb: int = 500) -> None:
        self.limit_mb = limit_mb
        self._peak = 0

    def current_mb(self) -> float:
        try:
            import psutil  # type: ignore
            return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)
        except ImportError:
            pass
        try:
            import resource  # type: ignore
            usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            # macOS 返回字节，Linux 返回 KB
            if sys.platform == "darwin":
                return usage / (1024 * 1024)
            return usage / 1024
        except Exception:  # noqa: BLE001
            return 0.0

    def check(self) -> bool:
        cur = self.current_mb()
        self._peak = max(self._peak, cur)
        if cur > self.limit_mb:
            logger.warning("内存占用 %.0fMB 超过限制 %dMB", cur, self.limit_mb)
            return False
        return True

    @property
    def peak_mb(self) -> float:
        return self._peak


# ============================== 性能指标统计 ==============================

@dataclass
class PerformanceMetricsTracker:
    """OCR 识别准确率与界面元素定位成功率统计。

    阈值：OCR 识别准确率 ≥ 95%，界面元素定位成功率 ≥ 98%
    """
    OCR_THRESHOLD: float = 0.95
    LOCATE_THRESHOLD: float = 0.98

    ocr_total: int = 0
    ocr_success: int = 0
    locate_total: int = 0
    locate_success: int = 0
    skip_errors: bool = False

    def on_metric(self, metric_type: str, success: bool,
                  details: Optional[Dict[str, Any]] = None) -> None:
        """作为回调，接收来自 GuiAutomator/PdfParser 的指标事件。"""
        if metric_type == "ocr_recognize":
            self.ocr_total += 1
            if success:
                self.ocr_success += 1
        elif metric_type == "element_locate":
            self.locate_total += 1
            if success:
                self.locate_success += 1

    @property
    def ocr_rate(self) -> Optional[float]:
        if self.ocr_total == 0:
            return None
        return self.ocr_success / self.ocr_total

    @property
    def locate_rate(self) -> Optional[float]:
        if self.locate_total == 0:
            return None
        return self.locate_success / self.locate_total

    def report(self) -> Dict[str, Any]:
        """生成统计报告字典。"""
        ocr_rate = self.ocr_rate
        locate_rate = self.locate_rate
        ocr_ok = ocr_rate is None or ocr_rate >= self.OCR_THRESHOLD
        locate_ok = locate_rate is None or locate_rate >= self.LOCATE_THRESHOLD
        return {
            "ocr_recognize": {
                "total": self.ocr_total,
                "success": self.ocr_success,
                "rate": round(ocr_rate, 4) if ocr_rate is not None else None,
                "threshold": self.OCR_THRESHOLD,
                "ok": ocr_ok,
            },
            "element_locate": {
                "total": self.locate_total,
                "success": self.locate_success,
                "rate": round(locate_rate, 4) if locate_rate is not None else None,
                "threshold": self.LOCATE_THRESHOLD,
                "ok": locate_ok,
            },
            "overall_ok": ocr_ok and locate_ok,
        }

    def print_report(self) -> None:
        """在控制台打印格式化的统计报告。"""
        report = self.report()
        ocr = report["ocr_recognize"]
        loc = report["element_locate"]
        ocr_rate_str = f"{ocr['rate'] * 100:.2f}%" if ocr['rate'] is not None else "无数据"
        loc_rate_str = f"{loc['rate'] * 100:.2f}%" if loc['rate'] is not None else "无数据"
        ocr_ok = "✓ 达标" if ocr['ok'] else "✗ 未达标"
        loc_ok = "✓ 达标" if loc['ok'] else "✗ 未达标"
        line = "=" * 70
        print(f"\n{line}")
        print("  性能指标统计报告")
        print(line)
        print(f"  OCR 识别准确率：{ocr_rate_str}  "
              f"(成功 {ocr['success']}/{ocr['total']}，阈值 ≥{self.OCR_THRESHOLD*100:.0f}%)  {ocr_ok}")
        print(f"  元素定位成功率：{loc_rate_str}  "
              f"(成功 {loc['success']}/{loc['total']}，阈值 ≥{self.LOCATE_THRESHOLD*100:.0f}%)  {loc_ok}")
        if report["overall_ok"]:
            print(f"  综合结论：✓ 全部性能指标达标")
        else:
            print(f"  综合结论：✗ 存在未达标指标，请检查")
        print(line + "\n", flush=True)
        if not report["overall_ok"]:
            logger.warning("性能指标未达标：OCR=%s，定位=%s", ocr_rate_str, loc_rate_str)


# ============================== 流水线 ==============================

@dataclass
class PipelineInputs:
    """解析得到的输入数据。"""
    wage_rows: List[Dict[str, Any]] = field(default_factory=list)
    personnel_rows: List[Dict[str, Any]] = field(default_factory=list)
    receipts: List[ReceiptInfo] = field(default_factory=list)
    wage_source: str = ""
    personnel_source: str = ""
    receipt_sources: List[str] = field(default_factory=list)


class DeclarationPipeline:
    """申报自动化主流水线。"""

    def __init__(self, config: Dict[str, Any], mode: str = MODE_FULL,
                 input_dir: str = "./input", resume: bool = False) -> None:
        self.config = config
        self.mode = mode
        self.input_dir = input_dir
        self.resume = resume
        self.progress = ProgressTracker()
        self.checkpoint = CheckpointManager(config)
        self.memory = MemoryMonitor(int(config.get("system", {}).get("memory_limit_mb", 500)))
        self.metrics = PerformanceMetricsTracker()
        self.inputs = PipelineInputs()
        self.consistency_report: Optional[ConsistencyReport] = None
        self.validation_result: Optional[ValidationResult] = None
        self._error_id_cards: Set[str] = set()

        sys_cfg: Dict[str, Any] = config.get("system", {})
        self.screenshot_dir = sys_cfg.get("screenshot_dir", "./screenshots")
        self.template_dir = sys_cfg.get("template_dir", "./templates")
        os.makedirs(self.screenshot_dir, exist_ok=True)
        os.makedirs(self.input_dir, exist_ok=True)

        # 组件（惰性初始化：仅校验模式不创建 GUI 自动化器）
        self.excel_parser = ExcelParser(config)
        self.pdf_parser = PdfParser(config)
        self.validator = DataValidator(config)
        self.automator: Optional[GuiAutomator] = None
        self.error_handler = ErrorHandler(
            config, screenshot_callback=self._screenshot_callback)

    def _screenshot_callback(self, tag: str) -> str:
        if self.automator is not None:
            return self.automator.save_failure_screenshot(tag)
        return ""

    # ---------------------------- 主流程 ----------------------------

    def run(self) -> int:
        """执行主流水线，返回退出码（0=成功）。"""
        start = time.time()
        logger.info("==== 社保申报自动化启动 | 模式=%s | 输入=%s ====",
                    self.mode, self.input_dir)
        if self.resume:
            self.checkpoint.load()
        else:
            self.checkpoint.reset()

        try:
            self._phase_parse()
            self._phase_validate()
            if self.mode == MODE_VALIDATE:
                self._phase_report(validate_only=True)
                return 0
            self._init_automator()
            self._phase_login()
            self._phase_personnel()
            self._phase_wage()
            self._phase_receipt()
            self._phase_report()
        except InterventionRequired as exc:
            self.progress.error(f"需人工介入：{exc}")
            logger.error("流程因人工介入异常中断")
            return 2
        except KeyboardInterrupt:
            self.progress.error("用户中断（Ctrl+C），状态已保存，可用 --resume 继续")
            self.checkpoint.save(phase=self.progress.current_step or PHASE_DONE)
            return 130
        except Exception as exc:  # noqa: BLE001
            self.progress.error(f"未捕获异常：{exc}")
            logger.exception("流水线执行失败")
            return 1
        finally:
            elapsed = time.time() - start
            logger.info("==== 流程结束 | 用时 %.1f 分钟 | 内存峰值 %.0fMB ====",
                        elapsed / 60, self.memory.peak_mb)
            # 输出性能指标统计报告并校验阈值
            self.metrics.print_report()
        return 0

    # ---------------------------- 阶段：解析 ----------------------------

    def _phase_parse(self) -> None:
        if self.checkpoint.should_skip(PHASE_PARSE):
            logger.info("跳过解析阶段（断点已完成）")
            return
        self.progress.set_step("解析输入文件")
        logger.info("阶段：解析本地 Excel / PDF 文件")

        # 查找输入文件
        excel_files: List[str] = []
        pdf_files: List[str] = []
        for root_dir, _dirs, files in os.walk(self.input_dir):
            for fn in files:
                fp = os.path.join(root_dir, fn)
                ext = os.path.splitext(fn)[1].lower()
                if ext in (".xlsx", ".xls", ".csv"):
                    excel_files.append(fp)
                elif ext == ".pdf":
                    pdf_files.append(fp)
        logger.info("发现 Excel 文件 %d 个，PDF 文件 %d 个", len(excel_files), len(pdf_files))

        # 解析 Excel：自动识别工资表与人员变动表
        for fp in excel_files:
            try:
                sheets = self.excel_parser.parse_file(fp)
            except Exception as exc:  # noqa: BLE001
                logger.error("解析 Excel 失败 %s: %s", fp, exc)
                continue
            for sheet in sheets:
                if sheet.table_type == "wage" and not self.inputs.wage_rows:
                    self.inputs.wage_rows = sheet.rows
                    self.inputs.wage_source = fp
                elif sheet.table_type == "personnel" and not self.inputs.personnel_rows:
                    self.inputs.personnel_rows = sheet.rows
                    self.inputs.personnel_source = fp

        # 解析 PDF 回单
        if pdf_files:
            self.inputs.receipt_sources = pdf_files
            self.inputs.receipts = self.pdf_parser.parse_receipts(pdf_files)

        logger.info("解析结果：工资表 %d 行，人员变动 %d 行，回单 %d 张",
                    len(self.inputs.wage_rows), len(self.inputs.personnel_rows),
                    len(self.inputs.receipts))

        # 人数上限校验：超过 500 人发出警告并提示用户确认
        PERSON_LIMIT = 500
        wage_count = len(self.inputs.wage_rows)
        personnel_count = len(self.inputs.personnel_rows)
        if wage_count > PERSON_LIMIT or personnel_count > PERSON_LIMIT:
            self.progress.error(
                f"处理人数超过上限：工资表 {wage_count} 人，人员变动 {personnel_count} 人"
                f"（单批次最大 {PERSON_LIMIT} 人）")
            try:
                confirm = input("数据量较大，继续处理可能较慢且占用较多内存。确认继续？(y/N) > ")
                if confirm.strip().lower() != "y":
                    logger.warning("用户因人数超限终止流程")
                    raise InterventionRequired(f"处理人数超过 {PERSON_LIMIT} 人，用户选择终止")
            except (EOFError, KeyboardInterrupt):
                raise
            logger.info("用户确认继续，允许超限处理")

        self.memory.check()
        self.checkpoint.mark_done(PHASE_PARSE,
                                  wage_total=len(self.inputs.wage_rows),
                                  personnel_total=len(self.inputs.personnel_rows),
                                  receipts_total=len(self.inputs.receipts))

    # ---------------------------- 阶段：校验 ----------------------------

    def _phase_validate(self) -> None:
        if self.checkpoint.should_skip(PHASE_VALIDATE):
            logger.info("跳过校验阶段（断点已完成）")
            return
        self.progress.set_step("数据合规校验")
        logger.info("阶段：数据合规性校验")

        overall = ValidationResult(ok=True)

        # 人员变动表校验
        if self.inputs.personnel_rows:
            res = self.validator.validate_personnel_table(self.inputs.personnel_rows)
            overall.merge(res)
        # 工资表校验
        if self.inputs.wage_rows:
            res = self.validator.validate_wage_table(self.inputs.wage_rows)
            overall.merge(res)
        # 跨表一致性
        if self.inputs.personnel_rows and self.inputs.wage_rows:
            report, res = self.validator.check_consistency(
                self.inputs.personnel_rows, self.inputs.wage_rows)
            self.consistency_report = report
            overall.merge(res)

        # 回单金额与申报金额比对（如已解析）
        if self.inputs.receipts and self.inputs.wage_rows:
            declared = sum(
                (r.get("pension_base") or 0) for r in self.inputs.wage_rows)
            for receipt in self.inputs.receipts:
                if receipt.amount is not None:
                    issue = self.validator.match_receipt_to_declaration(
                        receipt.amount, float(declared))
                    overall.issues.append(issue)

        self.progress.set_step("校验完成")
        print("\n" + summarize_result(overall) + "\n", flush=True)

        # 存储校验结果，供后续阶段按行跳过错误项
        self.validation_result = overall
        self._error_id_cards: set = set()
        for issue in overall.issues:
            if issue.level == "ERROR" and issue.id_card:
                self._error_id_cards.add(issue.id_card)

        # 校验模式：生成差异报告并退出
        if self.mode == MODE_VALIDATE:
            self._write_validation_report(overall)
            return

        # 全量/增量模式：若有 ERROR 则暂停等待确认
        if overall.error_count > 0:
            self.progress.error(f"校验发现 {overall.error_count} 个错误，请确认后继续")
            try:
                user_input = input("按回车继续（输入 s 跳过错误项继续申报）> ")
                if user_input.strip().lower() == "s":
                    logger.info("用户选择跳过错误项，将在后续申报阶段自动跳过含 ERROR 的记录")
                    self.metrics.skip_errors = True
            except (EOFError, KeyboardInterrupt):
                raise
        self.checkpoint.mark_done(PHASE_VALIDATE)
        self.memory.check()

    # ---------------------------- 阶段：登录 ----------------------------

    def _init_automator(self) -> None:
        if self.automator is not None:
            return
        self.automator = GuiAutomator(
            self.config, screenshot_dir=self.screenshot_dir,
            template_dir=self.template_dir,
            metrics_callback=self.metrics.on_metric)
        logger.info("GUI 自动化器已初始化")

    def _phase_login(self) -> None:
        if self.checkpoint.should_skip(PHASE_LOGIN):
            logger.info("跳过登录阶段（断点已完成）")
            return
        if self.automator is None:
            raise RuntimeError("自动化器未初始化")
        self.progress.set_step("登录网上办事大厅")
        logger.info("阶段：登录网上办事大厅")
        target_cfg: Dict[str, Any] = self.config.get("target", {})

        @self.error_handler.retry(step="打开登录页")
        def open_login() -> None:
            import webbrowser
            webbrowser.open(target_cfg.get("login_url", ""))
            time.sleep(float(target_cfg.get("page_load_wait", 3)))

        open_login()
        # 登录涉及用户名/密码/验证码，验证码需人工介入
        try:
            with self.error_handler.guard("登录"):
                # 提示用户输入验证码
                self.error_handler.prompt_intervention(
                    "请在浏览器中完成登录（含验证码）后按回车继续", step="登录")
        except InterventionRequired:
            raise
        self.checkpoint.mark_done(PHASE_LOGIN)
        self.memory.check()

    # ---------------------------- 阶段：人员变动申报 ----------------------------

    def _phase_personnel(self) -> None:
        if self.mode == MODE_INCREMENT and not self.inputs.personnel_rows:
            logger.info("增量模式：无人员变动，跳过")
            return
        if self.checkpoint.should_skip(PHASE_PERSONNEL):
            logger.info("跳过人员申报阶段（断点已完成）")
            return
        if self.automator is None:
            raise RuntimeError("自动化器未初始化")
        rows = self.inputs.personnel_rows
        start = int(self.checkpoint.state.get("personnel_done", 0))
        self.progress.start("人员变动申报", len(rows))
        self.progress.done = start
        self._render()

        field_map: Dict[str, Any] = self.config.get("field_mapping", {}).get("personnel", {})
        templates: Dict[str, Any] = self.config.get("templates", {})

        for idx in range(start, len(rows)):
            row = rows[idx]
            self.progress.set_step(f"人员变动 {idx + 1}/{len(rows)}")
            # 跳过错误项：当用户输入 "s" 且该行身份证含 ERROR 级校验问题时跳过
            if self.metrics.skip_errors and row.get("id_card") in self._error_id_cards:
                logger.info("跳过含错误的人员记录 %s (%s)",
                            row.get("id_card"), row.get("name"))
                self.progress.advance()
                continue
            try:
                with self.error_handler.guard(f"人员变动第{idx + 1}行"):
                    self._declare_one_personnel(row, templates, field_map)
            except Exception as exc:  # noqa: BLE001
                logger.error("人员变动第 %d 行失败：%s", idx + 1, exc)
            self.progress.advance()
            if (idx + 1) % self.checkpoint.save_interval == 0:
                self.checkpoint.save(personnel_done=idx + 1, phase=PHASE_PERSONNEL)
            self.memory.check()
        self.checkpoint.mark_done(PHASE_PERSONNEL, personnel_done=len(rows))

    def _declare_one_personnel(self, row: Dict[str, Any],
                                templates: Dict[str, Any],
                                field_map: Dict[str, Any]) -> None:
        assert self.automator is not None
        auto = self.automator
        # 点击新增按钮
        add_tpl = templates.get("personnel_add_button", "personnel_add.png")
        auto.click_element(add_tpl, wait_after=0.5)
        # 身份证号
        id_tpl = templates.get("personnel_id_input", "personnel_id.png")
        if auto.click_element(id_tpl, wait_after=0.3):
            auto.type_text(str(row.get("id_card", "")))
        # 姓名
        name_tpl = templates.get("personnel_name_input", "personnel_name.png")
        if auto.click_element(name_tpl, wait_after=0.3):
            auto.type_text(str(row.get("name", "")))
        # 参保类型下拉
        ins_type = str(row.get("insurance_type", ""))
        type_tpl = templates.get("personnel_type_select", "personnel_type.png")
        if ins_type:
            auto.select_dropdown(type_tpl, ins_type)
        # 保存
        save_tpl = templates.get("personnel_save_button", "personnel_save.png")
        auto.click_element(save_tpl, wait_after=0.8)
        # 回显校验
        if auto.click_element(id_tpl, wait_after=0.2):
            auto.compare_echo(id_tpl, str(row.get("id_card", "")))

    # ---------------------------- 阶段：工资基数申报 ----------------------------

    def _phase_wage(self) -> None:
        if self.checkpoint.should_skip(PHASE_WAGE):
            logger.info("跳过工资申报阶段（断点已完成）")
            return
        if self.automator is None:
            raise RuntimeError("自动化器未初始化")
        rows = self.inputs.wage_rows
        start = int(self.checkpoint.state.get("wage_done", 0))
        self.progress.start("工资基数申报", len(rows))
        self.progress.done = start
        self._render()

        templates: Dict[str, Any] = self.config.get("templates", {})
        for idx in range(start, len(rows)):
            row = rows[idx]
            self.progress.set_step(f"工资基数 {idx + 1}/{len(rows)}")
            # 跳过错误项：当用户输入 "s" 且该行身份证含 ERROR 级校验问题时跳过
            if self.metrics.skip_errors and row.get("id_card") in self._error_id_cards:
                logger.info("跳过含错误的工资记录 %s (%s)",
                            row.get("id_card"), row.get("name"))
                self.progress.advance()
                continue
            try:
                with self.error_handler.guard(f"工资基数第{idx + 1}行"):
                    self._declare_one_wage(row, templates)
            except Exception as exc:  # noqa: BLE001
                logger.error("工资基数第 %d 行失败：%s", idx + 1, exc)
            self.progress.advance()
            if (idx + 1) % self.checkpoint.save_interval == 0:
                self.checkpoint.save(wage_done=idx + 1, phase=PHASE_WAGE)
            self.memory.check()
        self.checkpoint.mark_done(PHASE_WAGE, wage_done=len(rows))

    def _declare_one_wage(self, row: Dict[str, Any], templates: Dict[str, Any]) -> None:
        assert self.automator is not None
        auto = self.automator
        # 定位该人员行（按身份证号查找输入）
        id_tpl = templates.get("wage_id_input", "wage_id.png")
        auto.click_element(id_tpl, wait_after=0.3)
        auto.type_text(str(row.get("id_card", "")))
        auto.press_key("tab")
        # 依次填入各险种基数
        base_fields = [
            ("pension_base", "wage_base_input"),
            ("medical_base", "wage_base_input"),
            ("unemployment_base", "wage_base_input"),
            ("workinjury_base", "wage_base_input"),
            ("maternity_base", "wage_base_input"),
        ]
        base_tpl = templates.get("wage_base_input", "wage_base.png")
        for field_key, tpl_key in base_fields:
            value = row.get(field_key)
            if value in (None, ""):
                continue
            auto.type_text(str(value))
            auto.press_key("tab")
            # 回显比对
            if not auto.compare_echo(tpl_key, str(value)):
                logger.warning("工资基数回显不一致：%s=%s", field_key, value)
                self.error_handler.prompt_intervention(
                    f"工资基数 {field_key} 回显与源数据不一致，请人工核对", step="工资基数")

    # ---------------------------- 阶段：回单上传 ----------------------------

    def _phase_receipt(self) -> None:
        if self.checkpoint.should_skip(PHASE_RECEIPT):
            logger.info("跳过回单上传阶段（断点已完成）")
            return
        if self.automator is None:
            raise RuntimeError("自动化器未初始化")
        receipts = self.inputs.receipts
        if not receipts:
            logger.info("无回单需上传")
            self.checkpoint.mark_done(PHASE_RECEIPT, receipts_done=0)
            return
        self.progress.start("缴费凭证上传", len(receipts))
        templates: Dict[str, Any] = self.config.get("templates", {})
        upload_tpl = templates.get("receipt_upload_area", "receipt_area.png")
        confirm_tpl = templates.get("receipt_confirm_button", "receipt_confirm.png")
        success = 0
        for idx, receipt in enumerate(receipts):
            self.progress.set_step(f"回单上传 {idx + 1}/{len(receipts)}")
            try:
                with self.error_handler.guard(f"回单上传第{idx + 1}张"):
                    ok = self.automator.upload_file(
                        upload_tpl, receipt.file_path, wait_for_confirm=confirm_tpl)
                    if ok:
                        success += 1
            except Exception as exc:  # noqa: BLE001
                logger.error("回单上传第 %d 张失败：%s", idx + 1, exc)
            self.progress.advance()
            self.checkpoint.save(receipts_done=idx + 1, phase=PHASE_RECEIPT)
            self.memory.check()
        self.checkpoint.mark_done(PHASE_RECEIPT, receipts_done=len(receipts))
        logger.info("回单上传完成：成功 %d/%d", success, len(receipts))

    # ---------------------------- 阶段：报告 ----------------------------

    def _phase_report(self, validate_only: bool = False) -> None:
        self.progress.set_step("生成执行报告")
        report: Dict[str, Any] = {
            "mode": self.mode,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "inputs": {
                "wage_rows": len(self.inputs.wage_rows),
                "personnel_rows": len(self.inputs.personnel_rows),
                "receipts": len(self.inputs.receipts),
                "wage_source": self.inputs.wage_source,
                "personnel_source": self.inputs.personnel_source,
            },
            "errors": self.error_handler.summarize(),
            "memory_peak_mb": round(self.memory.peak_mb, 1),
        }
        if self.consistency_report is not None:
            report["consistency"] = self.consistency_report.to_dict()
        if validate_only:
            report["validate_only"] = True
        report_path = os.path.join(
            self.config.get("system", {}).get("log_dir", "./logs"),
            f"report_{time.strftime('%Y%m%d_%H%M%S')}.json")
        try:
            with open(report_path, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            logger.info("执行报告已生成：%s", report_path)
        except OSError as exc:
            logger.error("报告写入失败：%s", exc)
        self.checkpoint.mark_done(PHASE_REPORT)
        if validate_only:
            self.checkpoint.reset()

    def _write_validation_report(self, result: Any) -> None:
        report_path = os.path.join(
            self.config.get("system", {}).get("log_dir", "./logs"),
            f"validation_{time.strftime('%Y%m%d_%H%M%S')}.json")
        payload = {
            "mode": MODE_VALIDATE,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "ok": result.ok,
            "error_count": result.error_count,
            "warning_count": result.warning_count,
            "issues": [
                {"level": i.level, "field": i.field, "message": i.message,
                 "row": i.row_index, "id_card": i.id_card}
                for i in result.issues if i.level != "INFO"
            ],
            "consistency": self.consistency_report.to_dict()
            if self.consistency_report else None,
        }
        try:
            with open(report_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            print(f"校验报告已生成：{report_path}", flush=True)
        except OSError as exc:
            logger.error("校验报告写入失败：%s", exc)

    def _render(self) -> None:
        # 占位，避免静默模式下无输出
        pass


# ============================== CLI ==============================

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="si_automation",
        description="社会保险基金申报自动化工具",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument("-c", "--config", default="config.yaml",
                        help="配置文件路径（默认 config.yaml）")
    parser.add_argument("-m", "--mode", choices=VALID_MODES, default=None,
                        help="操作模式：full=全量申报 / increment=增量申报 / "
                             "validate=仅校验（默认取 config.system.default_mode）")
    parser.add_argument("-i", "--input", default="./input",
                        help="输入文件目录（默认 ./input）")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="输出详细调试日志")
    parser.add_argument("--resume", action="store_true",
                        help="从上次断点继续执行")
    parser.add_argument("--reset", action="store_true",
                        help="清除断点状态重新开始")
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    config = load_config(args.config)
    setup_logging(config, verbose=args.verbose)

    mode = args.mode or config.get("system", {}).get("default_mode", MODE_FULL)
    if mode not in VALID_MODES:
        logger.error("无效操作模式：%s", mode)
        return 1

    if args.reset:
        CheckpointManager(config).reset()
        logger.info("已清除断点状态")

    logger.info("启动参数：mode=%s, input=%s, resume=%s, verbose=%s",
                mode, args.input, args.resume, args.verbose)

    pipeline = DeclarationPipeline(config, mode=mode, input_dir=args.input,
                                   resume=args.resume)
    return pipeline.run()


if __name__ == "__main__":
    sys.exit(main())
