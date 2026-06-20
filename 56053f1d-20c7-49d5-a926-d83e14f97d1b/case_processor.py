"""
case_processor.py
================================================================================
单案件处理流程编排模块

职责:
  1. 协调单案件处理流程: 图像分析 -> 损伤分类 -> 理赔系统录入
  2. 严格时间预算控制 (图像<30s, 录入<60s, 整体<120s)
  3. 案件状态追踪 (轮询审核结果, 驳回转人工)
  4. 夜间无人值守模式 (定时监控新案件并处理, 完成后邮件通知)
  5. 结果回写输出目录并更新案件状态库
"""

import json
import os
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, time as dtime
from typing import List, Optional

import yaml

from damage_classifier import DamageClassifier, ClassificationResult
from exception_handler import (
    CaseProcessingTimeout,
    ManualQueueRouter,
    RPAException,
    safe_execute,
)
from image_analyzer import AnalysisResult, DamageRegion, ImageAnalyzer
from logger import AppLogger, get_logger, with_context
from robot_operator import RobotOperator

log = get_logger("case_processor")


@dataclass
class CaseResult:
    """单案件处理结果。"""
    case_no: str
    status: str = "pending"          # pending/processing/success/failed/manual
    image_analysis_ok: bool = False
    classification_ok: bool = False
    entry_ok: bool = False
    damage_count: int = 0
    total_cost: float = 0.0
    total_labor_hours: float = 0.0
    durations: dict = field(default_factory=dict)
    error: str = ""
    result_path: str = ""
    submitted_at: str = ""
    audit_status: str = ""           # approved/rejected/supplement/unknown


class CaseProcessor:
    def __init__(self, config_path: str = "config.yaml", dry_run: bool = False):
        self.config_path = config_path
        with open(config_path, "r", encoding="utf-8") as f:
            self.cfg = yaml.safe_load(f)
        sys_cfg = self.cfg.get("system", {})
        self.output_dir = sys_cfg.get("output_dir", "./data/output")
        self.watch_dir = sys_cfg.get("watch_dir", "./data/watch")
        os.makedirs(self.output_dir, exist_ok=True)
        self.image_timeout = float(sys_cfg.get("image_analysis_timeout", 30))
        self.entry_timeout = float(sys_cfg.get("system_entry_timeout", 60))
        self.case_timeout = float(sys_cfg.get("case_total_timeout", 120))
        self.state_db = sys_cfg.get("case_state_db", "./data/case_state.json")

        # 组装各模块
        self.analyzer = ImageAnalyzer(config_path)
        self.classifier = DamageClassifier(config_path)
        self.robot = RobotOperator(config_path, dry_run=dry_run)
        self.manual_router = ManualQueueRouter(config_path)

    # --------------------------------------------------------------------------
    # 1. 单案件处理主流程
    # --------------------------------------------------------------------------
    def process_case(self, case_dir: str, case_no: str,
                    meta: Optional[dict] = None) -> CaseResult:
        """
        处理单个案件, 严格遵循时间预算。
        meta: 案件元数据 (车牌/车型/修理厂/出险日期/出险地点等), 用于补全字段。
        """
        meta = meta or {}
        result = CaseResult(case_no=case_no, status="processing")
        t_start = time.time()
        log.info("案件开始处理 | case=%s dir=%s", case_no, case_dir)

        try:
            # 阶段1: 图像分析 (预算 30s): 分析所有图片 + 汇总损伤区域
            def _image_stage():
                img_results = self.analyzer.analyze_case(case_dir, case_no)
                regions = self.analyzer.aggregate_damage(img_results)
                return regions, img_results

            with with_context(case_no, "image_analysis"):
                regions, img_results = self._run_with_timeout(
                    _image_stage, self.image_timeout, case_no, "图像分析")
            result.image_analysis_ok = True
            result.durations["image_analysis"] = round(
                time.time() - t_start, 2)

            if not regions:
                log.warning("未识别到损伤, 标记失败转人工 | case=%s", case_no)
                raise RPAException("未识别到任何损伤区域", case_no, "no_damage")

            # 阶段2: 损伤分类 (剩余预算内)
            t_cls = time.time()
            with with_context(case_no, "classification"):
                cls_result = self._run_with_timeout(
                    lambda: self.classifier.classify_all(regions, case_no),
                    15, case_no, "损伤分类")
            if not cls_result.success:
                raise RPAException(
                    f"损伤分类失败: {cls_result.error}", case_no, "classification")
            result.classification_ok = True
            result.damage_count = len(cls_result.items)
            result.total_cost = cls_result.grand_total
            result.total_labor_hours = cls_result.total_labor_hours
            result.durations["classification"] = round(time.time() - t_cls, 2)

            # 保存标注图与分类结果到输出目录
            self._save_intermediate(case_no, img_results, cls_result)

            # 阶段3: 理赔系统录入 (预算 60s)
            t_entry = time.time()
            remaining = self.case_timeout - (time.time() - t_start)
            entry_budget = min(self.entry_timeout, max(remaining - 5, 10))
            fields = self.classifier.to_entry_fields(cls_result, case_no)
            fields = self._merge_meta(fields, meta)
            photo_paths = [r.image_path for r in img_results if r.success]
            with with_context(case_no, "system_entry"):
                entry_result = self._run_with_timeout(
                    lambda: self.robot.perform_full_entry(
                        fields, photo_paths, case_no),
                    entry_budget, case_no, "理赔系统录入")
            result.entry_ok = entry_result.get("success", False)
            result.durations["system_entry"] = round(time.time() - t_entry, 2)

            if result.entry_ok:
                result.status = "success"
                result.submitted_at = datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S")
                log.info(
                    "案件处理成功 | case=%s 损伤=%d 费用=%.2f 总耗时=%.2fs",
                    case_no, result.damage_count, result.total_cost,
                    time.time() - t_start)
            else:
                raise RPAException("理赔系统录入未成功", case_no, "entry")

        except CaseProcessingTimeout as exc:
            result.status = "failed"
            result.error = str(exc)
            log.error("案件处理超时 | case=%s err=%s", case_no, exc)
            self._route_failure(case_no, str(exc), case_dir, result)
        except RPAException as exc:
            result.status = "failed"
            result.error = str(exc)
            log.error("案件处理失败 | case=%s err=%s", case_no, exc)
            self._route_failure(case_no, str(exc), case_dir, result)
        except Exception as exc:
            result.status = "failed"
            result.error = str(exc)
            log.error("案件处理未知异常 | case=%s err=%s", case_no, exc,
                      exc_info=True)
            self._route_failure(case_no, str(exc), case_dir, result)
        finally:
            result.durations["total"] = round(time.time() - t_start, 2)
            self._save_result(case_no, result)
            self._update_state_db(result)
        return result

    # --------------------------------------------------------------------------
    # 超时控制包装
    # --------------------------------------------------------------------------
    def _run_with_timeout(self, func, timeout: float, case_no: str,
                          stage_name: str):
        """
        简易超时控制: 通过子线程执行, 超时则抛 CaseProcessingTimeout。
        返回函数返回值。
        """
        from threading import Thread
        import queue as _queue

        q: _queue.Queue = _queue.Queue()
        exc_holder = {}

        def _target():
            try:
                q.put(("ok", func()))
            except Exception as exc:
                q.put(("err", exc))

        t = Thread(target=_target, daemon=True)
        t.start()
        t.join(timeout=timeout)
        if t.is_alive():
            raise CaseProcessingTimeout(
                f"{stage_name} 超时 ({timeout}s)", case_no)
        if q.empty():
            raise CaseProcessingTimeout(
                f"{stage_name} 无返回 ({timeout}s)", case_no)
        status, payload = q.get()
        if status == "err":
            raise payload
        return payload

    # --------------------------------------------------------------------------
    # 2. 元数据合并
    # --------------------------------------------------------------------------
    @staticmethod
    def _merge_meta(fields: dict, meta: dict) -> dict:
        """将案件元数据合并到录入字段中 (覆盖空字段)。"""
        mapping = {
            "license_plate": "license_plate",
            "vehicle_model": "vehicle_model",
            "repair_shop": "repair_shop",
            "accident_date": "accident_date",
            "accident_location": "accident_location",
        }
        for field_key, meta_key in mapping.items():
            if meta.get(meta_key) and (not fields.get(field_key)):
                fields[field_key] = meta[meta_key]
        return fields

    # --------------------------------------------------------------------------
    # 3. 中间结果保存
    # --------------------------------------------------------------------------
    def _save_intermediate(self, case_no: str,
                           img_results: List[AnalysisResult],
                           cls_result: ClassificationResult):
        case_out = os.path.join(self.output_dir, case_no)
        os.makedirs(case_out, exist_ok=True)
        # 保存标注图
        for r in img_results:
            if r.success:
                self.analyzer.save_annotated(r, case_no)
        # 保存分类结果 JSON
        path = os.path.join(case_out, "classification.json")
        try:
            data = {
                "case_no": case_no,
                "items": [asdict(i) for i in cls_result.items],
                "total_labor_hours": cls_result.total_labor_hours,
                "total_parts_cost": cls_result.total_parts_cost,
                "total_labor_cost": cls_result.total_labor_cost,
                "grand_total": cls_result.grand_total,
            }
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as exc:
            log.warning("保存分类结果失败 | case=%s err=%s", case_no, exc)

    def _save_result(self, case_no: str, result: CaseResult):
        case_out = os.path.join(self.output_dir, case_no)
        os.makedirs(case_out, exist_ok=True)
        path = os.path.join(case_out, "case_result.json")
        result.result_path = path
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(asdict(result), f, ensure_ascii=False, indent=2)
        except Exception as exc:
            log.warning("保存案件结果失败 | case=%s err=%s", case_no, exc)

    # --------------------------------------------------------------------------
    # 4. 失败转人工队列
    # --------------------------------------------------------------------------
    def _route_failure(self, case_no: str, reason: str, case_dir: str,
                       result: CaseResult):
        if self.cfg.get("exception_handling", {}).get(
                "failure_to_manual", True):
            try:
                self.manual_router.route_to_manual(
                    case_no, reason, case_dir, asdict(result))
                result.status = "manual"
            except Exception as exc:
                log.error("转入人工队列失败 | case=%s err=%s", case_no, exc)

    # --------------------------------------------------------------------------
    # 5. 案件状态库
    # --------------------------------------------------------------------------
    def _load_state_db(self) -> dict:
        if os.path.exists(self.state_db):
            try:
                with open(self.state_db, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _update_state_db(self, result: CaseResult):
        try:
            db = self._load_state_db()
            db[result.case_no] = {
                "status": result.status,
                "submitted_at": result.submitted_at,
                "total_cost": result.total_cost,
                "audit_status": result.audit_status,
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            os.makedirs(os.path.dirname(self.state_db), exist_ok=True)
            with open(self.state_db, "w", encoding="utf-8") as f:
                json.dump(db, f, ensure_ascii=False, indent=2)
        except Exception as exc:
            log.warning("更新案件状态库失败 | case=%s err=%s",
                       result.case_no, exc)

    # --------------------------------------------------------------------------
    # 6. 案件状态追踪 (审核结果轮询)
    # --------------------------------------------------------------------------
    def track_case_status(self, case_no: str, max_retry: Optional[int] = None,
                          poll_interval: Optional[float] = None) -> str:
        """轮询已提交案件审核状态, 驳回转人工。"""
        track_cfg = self.cfg.get("case_tracking", {})
        max_retry = max_retry or int(track_cfg.get("poll_max_retry", 5))
        poll_interval = poll_interval or float(
            track_cfg.get("poll_interval", 60))

        for attempt in range(1, max_retry + 1):
            status = self.robot.query_case_status(case_no)
            log.info("状态轮询 | case=%s attempt=%d status=%s",
                     case_no, attempt, status)
            if status in ("approved", "rejected", "supplement"):
                break
            time.sleep(poll_interval)

        result = CaseResult(case_no=case_no)
        result.audit_status = status
        self._update_state_db(result)

        # 驳回 / 需补充材料 -> 转人工
        if status in ("rejected", "supplement") and \
                track_cfg.get("rejected_to_manual", True):
            log.warning("案件审核未通过, 转人工 | case=%s status=%s",
                        case_no, status)
            self.manual_router.mark_case_failed(
                case_no, f"审核结果: {status}")
        return status

    # --------------------------------------------------------------------------
    # 7. 夜间无人值守模式
    # --------------------------------------------------------------------------
    def run_night_mode(self):
        """
        夜间无人值守: 在设定时段内监控 watch_dir 新案件并处理,
        处理完成后发送邮件通知值班人员。
        """
        night_cfg = self.cfg.get("night_mode", {})
        if not night_cfg.get("enabled", False):
            log.info("夜间模式未启用")
            return
        start_t = self._parse_time(night_cfg.get("start_time", "20:00"))
        end_t = self._parse_time(night_cfg.get("end_time", "08:00"))
        poll_interval = float(night_cfg.get("poll_interval", 30))

        log.info("进入夜间无人值守模式 | 时段 %s-%s 轮询间隔=%ss",
                 night_cfg.get("start_time"), night_cfg.get("end_time"),
                 poll_interval)

        processed_count = 0
        failed_count = 0
        while self._in_night_window(start_t, end_t):
            new_cases = self._discover_new_cases()
            if not new_cases:
                time.sleep(poll_interval)
                continue
            for case_no, case_dir, meta in new_cases:
                res = self.process_case(case_dir, case_no, meta)
                if res.status == "success":
                    processed_count += 1
                else:
                    failed_count += 1
            time.sleep(poll_interval)

        # 夜间处理结束, 发送邮件通知值班人员
        if night_cfg.get("notify_on_complete", True):
            subject = "[车险理赔RPA] 夜间处理完成通知"
            body = (f"夜间无人值守处理已结束\n"
                    f"成功: {processed_count} 件\n"
                    f"失败: {failed_count} 件\n"
                    f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            AppLogger.send_alert(subject, body)
            log.info("夜间处理完成通知已发送 | 成功=%d 失败=%d",
                     processed_count, failed_count)

    def _discover_new_cases(self) -> List[tuple]:
        """扫描 watch_dir 发现新案件 (每个子目录为一个案件)。"""
        cases = []
        if not os.path.isdir(self.watch_dir):
            return cases
        db = self._load_state_db()
        for name in sorted(os.listdir(self.watch_dir)):
            case_dir = os.path.join(self.watch_dir, name)
            if not os.path.isdir(case_dir):
                continue
            # 已处理的案件跳过
            if name in db and db[name].get("status") in ("success", "manual"):
                continue
            meta = self._load_case_meta(case_dir)
            cases.append((name, case_dir, meta))
        return cases

    @staticmethod
    def _load_case_meta(case_dir: str) -> dict:
        """读取案件目录下的 meta.json 元数据 (车牌/车型等)。"""
        meta_path = os.path.join(case_dir, "meta.json")
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    @staticmethod
    def _parse_time(t_str: str):
        h, m = t_str.split(":")
        return dtime(int(h), int(m))

    @staticmethod
    def _in_night_window(start_t, end_t) -> bool:
        now = datetime.now().time()
        if start_t <= end_t:
            return start_t <= now <= end_t
        # 跨午夜 (如 20:00-08:00)
        return now >= start_t or now <= end_t
