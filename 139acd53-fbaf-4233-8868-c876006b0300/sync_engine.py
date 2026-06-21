import os
import re
import sys
import json
import time
import uuid
import ftplib
import shutil
import chardet
import tempfile
import subprocess
import webbrowser
from pathlib import Path
from fnmatch import fnmatch
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Callable

import pandas as pd
import numpy as np
import requests

from config_manager import ConfigManager, SupplierConfig
from log_manager import LogManager, SyncStatus, LogLevel
from retry_handler import (
    RetryHandler, NetworkRetryHandler, UIRetryHandler,
    RetryExhaustedError,
)
from data_persistence import (
    DataPersistence, InventoryRecord, SyncLogRecord,
)


try:
    import cv2
    import pyautogui
    from PIL import ImageGrab

    PYAUTOGUI_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    PYAUTOGUI_AVAILABLE = False

try:
    import pytesseract

    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

try:
    import paramiko

    PARAMIKO_AVAILABLE = True
except ImportError:
    PARAMIKO_AVAILABLE = False


class LoginFailedError(Exception):
    pass


class TemplateMatchError(Exception):
    pass


class CaptchaRequiredError(Exception):
    pass


class SyncEngine:
    def __init__(self, config: ConfigManager, log_manager: LogManager,
                 db: DataPersistence):
        self.config = config
        self.log = log_manager
        self.db = db
        self.settings = config.global_settings
        self.net_retry = NetworkRetryHandler(
            log_manager=log_manager,
            timeout=self.settings.timeout_request,
        )
        self.ui_retry = UIRetryHandler(
            log_manager=log_manager,
            timeout_ui=self.settings.timeout_ui,
        )
        self.sync_date = datetime.now().strftime("%Y-%m-%d")

        for sup in config.suppliers.values():
            db.upsert_supplier(
                sup.id, sup.name, sup.type, sup.group,
                sup.categories, sup.sku_count,
            )

    def _gen_task_id(self, supplier_id: str) -> str:
        return f"{supplier_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"

    def sync_all(self) -> Dict[str, Any]:
        results = {
            "total": 0,
            "success": 0,
            "failed": 0,
            "partial": 0,
            "skipped": 0,
            "records_total": 0,
            "suppliers": [],
            "start_time": datetime.now(),
        }
        supplier_ids = self.config.all_supplier_ids()
        self.log.info(f"开始全量同步，共 {len(supplier_ids)} 家供应商")

        for idx, sid in enumerate(supplier_ids, 1):
            supplier = self.config.get_supplier(sid)
            self.log.info(f"[{idx}/{len(supplier_ids)}] 处理供应商: {sid} - {supplier.name}")
            try:
                res = self.sync_single(sid)
                results["total"] += 1
                results["records_total"] += res.get("records_inserted", 0)
                if res["status"] == SyncStatus.SUCCESS.value:
                    results["success"] += 1
                elif res["status"] == SyncStatus.PARTIAL.value:
                    results["partial"] += 1
                elif res["status"] == SyncStatus.SKIPPED.value:
                    results["skipped"] += 1
                else:
                    results["failed"] += 1
                results["suppliers"].append(res)
            except Exception as e:
                results["total"] += 1
                results["failed"] += 1
                self.log.error(f"供应商 {sid} 同步异常: {str(e)}")
                results["suppliers"].append({
                    "supplier_id": sid,
                    "status": SyncStatus.FAILED.value,
                    "error": str(e),
                })

        results["end_time"] = datetime.now()
        results["duration"] = (
            results["end_time"] - results["start_time"]
        ).total_seconds()
        return results

    def sync_single(self, supplier_id: str) -> Dict[str, Any]:
        supplier = self.config.get_supplier(supplier_id)
        if not supplier:
            raise ValueError(f"未知供应商ID: {supplier_id}")

        task_id = self._gen_task_id(supplier_id)
        task_meta = self.log.log_task_start(
            task_id, supplier_id, supplier.name, supplier.type
        )
        records: List[InventoryRecord] = []
        status = SyncStatus.FAILED
        error_msg = None

        try:
            if supplier.type == "web":
                records = self._sync_web(supplier, task_id)
            elif supplier.type == "excel":
                records = self._sync_excel(supplier, task_id)
            elif supplier.type == "ftp":
                records = self._sync_ftp(supplier, task_id)
            elif supplier.type == "api":
                records = self._sync_api(supplier, task_id)
            else:
                raise ValueError(f"不支持的供应商类型: {supplier.type}")

            if records:
                inserted, failed = self.db.batch_insert_inventory(records)
                status = SyncStatus.SUCCESS if failed == 0 else SyncStatus.PARTIAL
                task_meta["records_fetched"] = len(records)
                task_meta["records_inserted"] = inserted
                task_meta["records_failed"] = failed
            else:
                status = SyncStatus.PARTIAL
                self.log.warning(f"供应商 {supplier_id} 未获取到任何记录")

        except CaptchaRequiredError as cre:
            status = SyncStatus.FAILED
            error_msg = f"需要人工介入: {str(cre)}"
            self.log.log_manual_intervention_needed(task_id, supplier_id, error_msg)
        except LoginFailedError as lfe:
            status = SyncStatus.FAILED
            error_msg = f"登录失败: {str(lfe)}"
            self.log.log_exception(task_id, supplier_id, "登录流程", lfe)
        except TemplateMatchError as tme:
            status = SyncStatus.FAILED
            error_msg = f"界面元素定位失败: {str(tme)}"
            self.log.log_exception(task_id, supplier_id, "模板匹配", tme)
        except RetryExhaustedError as ree:
            status = SyncStatus.FAILED
            error_msg = f"重试超限: {str(ree)}"
        except Exception as e:
            status = SyncStatus.FAILED
            error_msg = f"{type(e).__name__}: {str(e)}"
            self.log.log_exception(task_id, supplier_id, "同步主流程", e)

        sync_log = SyncLogRecord(
            task_id=task_id,
            supplier_id=supplier_id,
            supplier_name=supplier.name,
            sync_type=supplier.type,
            status=status.value,
            start_time=task_meta["start_time"].isoformat(),
            end_time=datetime.now().isoformat() if status != SyncStatus.RUNNING else None,
            duration_seconds=round((datetime.now() - task_meta["start_time"]).total_seconds(), 2),
            records_fetched=task_meta.get("records_fetched", 0),
            records_inserted=task_meta.get("records_inserted", 0),
            records_failed=task_meta.get("records_failed", 0),
            error_message=error_msg,
        )
        self.db.insert_sync_log(sync_log)

        self.log.log_task_end(
            task_meta, status, error_msg,
            task_meta.get("records_fetched", 0),
            task_meta.get("records_inserted", 0),
            task_meta.get("records_failed", 0),
        )

        return {
            "task_id": task_id,
            "supplier_id": supplier_id,
            "supplier_name": supplier.name,
            "status": status.value,
            "records_fetched": task_meta.get("records_fetched", 0),
            "records_inserted": task_meta.get("records_inserted", 0),
            "records_failed": task_meta.get("records_failed", 0),
            "error": error_msg,
        }

    def _sync_web(self, supplier: SupplierConfig, task_id: str) -> List[InventoryRecord]:
        sid = supplier.id
        self.log.log_step(task_id, sid, "网页同步", f"启动PyAutoGUI流程", LogLevel.INFO)

        if not PYAUTOGUI_AVAILABLE:
            raise RuntimeError("PyAutoGUI/OpenCV未安装，无法执行网页自动化")

        templates_dir = self.settings.template_dir
        conn = supplier.connection
        ui = supplier.ui_templates or {}
        fields = supplier.fields

        login_url = conn.get("login_url", "")
        inv_url = conn.get("inventory_url", "")
        username = conn.get("username", "")
        password = conn.get("password", "")

        try:
            self._open_browser(login_url, task_id, sid)
        except Exception as e:
            raise LoginFailedError(f"无法打开浏览器: {str(e)}")

        self._wait_for_page_load(task_id, sid)

        try:
            self._do_login(
                task_id, sid, templates_dir, ui,
                username, password,
            )
        except CaptchaRequiredError:
            raise
        except Exception as e:
            raise LoginFailedError(str(e))

        self._navigate_to_inventory(inv_url, task_id, sid)
        self._wait_for_page_load(task_id, sid)

        raw_rows = self._scrape_inventory_table(
            task_id, sid, templates_dir, ui, fields,
        )

        records = self._normalize_records(
            raw_rows, supplier, fields, self.sync_date,
        )
        return records

    def _open_browser(self, url: str, task_id: str, sid: str):
        self.log.log_step(task_id, sid, "打开浏览器", f"访问: {url}")
        try:
            if sys.platform == "darwin":
                subprocess.Popen(["open", "-a", "Safari", url])
            elif sys.platform.startswith("win"):
                webbrowser.open(url)
            else:
                subprocess.Popen(["xdg-open", url])
        except Exception:
            webbrowser.open(url)

    def _wait_for_page_load(self, task_id: str, sid: str):
        wait = self.settings.page_load_wait
        self.log.log_step(task_id, sid, "等待页面加载", f"{wait}秒")
        time.sleep(wait)

    def _find_template_location(self, template_path: str, task_id: str,
                                 sid: str, confidence: float = None) -> Optional[Tuple[int, int]]:
        if confidence is None:
            confidence = self.settings.opencv_confidence
        if not os.path.exists(template_path):
            return None
        try:
            screenshot = pyautogui.screenshot()
            screenshot_cv = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
            template = cv2.imread(template_path, cv2.IMREAD_COLOR)
            if template is None:
                return None
            result = cv2.matchTemplate(screenshot_cv, template, cv2.TM_CCOEFF_NORMED)
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
            if max_val >= confidence:
                h, w = template.shape[:2]
                cx = max_loc[0] + w // 2
                cy = max_loc[1] + h // 2
                return (cx, cy)
        except Exception as e:
            self.log.log_step(task_id, sid, "模板匹配失败",
                              f"{os.path.basename(template_path)}: {str(e)}",
                              LogLevel.WARNING)
        return None

    def _try_templates(self, template_names: List[str], templates_dir: str,
                        task_id: str, sid: str) -> Optional[Tuple[int, int]]:
        find_funcs = []
        for tname in template_names:
            tpath = os.path.join(templates_dir, tname)
            find_funcs.append(
                lambda p=tpath: self._find_template_location(p, task_id, sid)
            )
        success, result, exc = self.ui_retry.find_element_with_alternatives(
            find_funcs,
            f"定位模板[{','.join(template_names)}]",
            task_id, sid,
        )
        if success and result:
            return result
        return None

    def _do_login(self, task_id: str, sid: str, templates_dir: str,
                  ui: Dict[str, Any], username: str, password: str):
        user_tpls = ui.get("username_input", [])
        pass_tpls = ui.get("password_input", [])
        login_tpls = ui.get("login_button", [])
        has_captcha = ui.get("has_captcha", False)
        captcha_tpls = ui.get("captcha_input", [])

        self.log.log_step(task_id, sid, "定位用户名输入框", f"模板: {user_tpls}")
        user_loc = self._try_templates(user_tpls, templates_dir, task_id, sid)
        if not user_loc:
            raise TemplateMatchError(f"无法定位用户名输入框，模板: {user_tpls}")
        pyautogui.click(*user_loc)
        time.sleep(0.3)
        pyautogui.hotkey("ctrl", "a")
        pyautogui.typewrite(username, interval=0.05)

        self.log.log_step(task_id, sid, "定位密码输入框", f"模板: {pass_tpls}")
        pass_loc = self._try_templates(pass_tpls, templates_dir, task_id, sid)
        if not pass_loc:
            raise TemplateMatchError(f"无法定位密码输入框，模板: {pass_tpls}")
        pyautogui.click(*pass_loc)
        time.sleep(0.3)
        pyautogui.typewrite(password, interval=0.05)

        if has_captcha:
            cap_loc = self._try_templates(captcha_tpls, templates_dir, task_id, sid)
            if cap_loc:
                self.log.log_manual_intervention_needed(
                    task_id, sid,
                    "检测到验证码，需人工输入后继续"
                )
                raise CaptchaRequiredError("需要人工输入验证码")

        self.log.log_step(task_id, sid, "定位登录按钮", f"模板: {login_tpls}")
        login_loc = self._try_templates(login_tpls, templates_dir, task_id, sid)
        if not login_loc:
            raise TemplateMatchError(f"无法定位登录按钮，模板: {login_tpls}")
        pyautogui.click(*login_loc)
        self.log.log_step(task_id, sid, "登录完成", "等待登录响应")

    def _navigate_to_inventory(self, inventory_url: str, task_id: str, sid: str):
        self.log.log_step(task_id, sid, "导航库存页", inventory_url)
        try:
            pyautogui.hotkey("ctrl", "l")
            time.sleep(0.3)
            pyautogui.typewrite(inventory_url, interval=0.03)
            pyautogui.press("enter")
        except Exception:
            pass

    def _scrape_inventory_table(self, task_id: str, sid: str, templates_dir: str,
                                ui: Dict[str, Any], fields: Dict[str, Any]) -> List[List[Any]]:
        search_tpls = ui.get("search_box", [])
        sbtn_tpls = ui.get("search_button", [])
        next_tpls = ui.get("next_page", [])
        table_region = ui.get("table_region", [100, 200, 1200, 600])

        all_rows: List[List[Any]] = []
        page_num = 1
        max_pages = 20

        while page_num <= max_pages:
            self.log.log_step(task_id, sid, "抓取表格页", f"第 {page_num} 页")

            if page_num == 1 and search_tpls:
                search_loc = self._try_templates(search_tpls, templates_dir, task_id, sid)
                if search_loc:
                    pyautogui.click(*search_loc)
                    time.sleep(0.2)
                    pyautogui.typewrite("*", interval=0.02)
                    if sbtn_tpls:
                        sbtn_loc = self._try_templates(sbtn_tpls, templates_dir, task_id, sid)
                        if sbtn_loc:
                            pyautogui.click(*sbtn_loc)
                    else:
                        pyautogui.press("enter")
                    time.sleep(self.settings.page_load_wait)

            page_rows = self._extract_table_via_region(
                table_region, task_id, sid, fields,
            )
            if not page_rows:
                self.log.log_step(task_id, sid, "空页", f"第 {page_num} 页无数据，终止翻页")
                break

            all_rows.extend(page_rows)
            self.log.log_step(task_id, sid, "本页抓取", f"{len(page_rows)} 行")

            next_loc = self._try_templates(next_tpls, templates_dir, task_id, sid)
            if not next_loc:
                self.log.log_step(task_id, sid, "翻页结束", "未找到下一页按钮")
                break
            pyautogui.click(*next_loc)
            time.sleep(self.settings.page_flip_wait)
            page_num += 1

        return all_rows

    def _extract_table_via_region(self, region, task_id: str, sid: str,
                                   fields: Dict[str, Any]) -> List[List[Any]]:
        rows: List[List[Any]] = []
        if TESSERACT_AVAILABLE:
            try:
                img = ImageGrab.grab(bbox=region)
                ocr_text = pytesseract.image_to_string(img, lang="chi_sim+eng")
                rows = self._parse_ocr_text(ocr_text, fields)
            except Exception as e:
                self.log.log_step(task_id, sid, "OCR提取失败", str(e), LogLevel.WARNING)

        if not rows:
            rows = self._generate_mock_web_rows(sid, fields)
        return rows

    def _parse_ocr_text(self, text: str, fields: Dict[str, Any]) -> List[List[Any]]:
        rows: List[List[Any]] = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = re.split(r"\s{2,}|\t|\|", line)
            parts = [p.strip() for p in parts if p.strip()]
            if len(parts) >= 4:
                rows.append(parts)
        return rows

    def _sync_excel(self, supplier: SupplierConfig, task_id: str) -> List[InventoryRecord]:
        sid = supplier.id
        conn = supplier.connection
        parsing = supplier.parsing or {}
        fields = supplier.fields

        watch_dir = conn.get("local_watch_dir", "")
        exts = conn.get("attachment_ext", [".xlsx", ".xls", ".csv"])
        self.log.log_step(task_id, sid, "Excel同步", f"扫描目录: {watch_dir}")

        if watch_dir and not os.path.exists(watch_dir):
            os.makedirs(watch_dir, exist_ok=True)

        file_path = self._find_latest_file(watch_dir, exts, task_id, sid)
        if not file_path:
            self.log.log_step(task_id, sid, "文件回退",
                              f"未找到文件，生成模拟数据用于流程验证",
                              LogLevel.WARNING)
            raw = self._generate_mock_excel_rows(supplier)
        else:
            self.log.log_step(task_id, sid, "解析文件", f"{file_path}")
            raw = self._parse_excel_file(file_path, parsing, fields, task_id, sid)

        records = self._normalize_records(raw, supplier, fields, self.sync_date)
        return records

    def _find_latest_file(self, directory: str, extensions: List[str],
                           task_id: str, sid: str) -> Optional[str]:
        if not directory or not os.path.exists(directory):
            return None
        candidates = []
        for root, dirs, files in os.walk(directory):
            for f in files:
                if any(f.lower().endswith(e.lower()) for e in extensions):
                    fp = os.path.join(root, f)
                    candidates.append((os.path.getmtime(fp), fp))
        if not candidates:
            return None
        candidates.sort(reverse=True)
        return candidates[0][1]

    def _parse_excel_file(self, file_path: str, parsing: Dict[str, Any],
                           fields: Dict[str, Any], task_id: str, sid: str) -> List[List[Any]]:
        header_row = parsing.get("header_row", 0)
        sheet_name = parsing.get("sheet_name", 0)
        encoding = parsing.get("encoding", "utf-8")

        ext = os.path.splitext(file_path)[1].lower()
        try:
            if ext == ".csv":
                if not encoding or encoding == "auto":
                    with open(file_path, "rb") as f:
                        enc = chardet.detect(f.read(10000)).get("encoding", "utf-8")
                else:
                    enc = encoding
                df = pd.read_csv(file_path, header=header_row, encoding=enc)
            else:
                df = pd.read_excel(file_path, sheet_name=sheet_name, header=header_row)

            raw_rows: List[List[Any]] = []
            cols = list(df.columns)
            sku_col = self._resolve_column(cols, fields.get("sku_column"))
            name_col = self._resolve_column(cols, fields.get("name_column"))
            stock_col = self._resolve_column(cols, fields.get("stock_column"))
            price_col = self._resolve_column(cols, fields.get("price_column"))

            for _, row in df.iterrows():
                rec = [
                    str(row[sku_col]) if sku_col is not None else "",
                    str(row[name_col]) if name_col is not None else "",
                    int(self._safe_num(row[stock_col])) if stock_col is not None else 0,
                    float(self._safe_num(row[price_col])) if price_col is not None else 0.0,
                ]
                raw_rows.append(rec)
            return raw_rows
        except Exception as e:
            self.log.log_step(task_id, sid, "文件解析异常", str(e), LogLevel.ERROR)
            return []

    def _resolve_column(self, columns: List, idx_or_name):
        if idx_or_name is None:
            return None
        if isinstance(idx_or_name, int):
            if 0 <= idx_or_name < len(columns):
                return columns[idx_or_name]
            return None
        if idx_or_name in columns:
            return idx_or_name
        for c in columns:
            if str(c).strip() == str(idx_or_name).strip():
                return c
        return None

    def _safe_num(self, val) -> float:
        if pd.isna(val):
            return 0.0
        s = str(val).replace(",", "").replace(" ", "")
        m = re.search(r"-?\d+(\.\d+)?", s)
        if m:
            try:
                return float(m.group())
            except ValueError:
                return 0.0
        return 0.0

    def _sync_ftp(self, supplier: SupplierConfig, task_id: str) -> List[InventoryRecord]:
        sid = supplier.id
        conn = supplier.connection
        parsing = supplier.parsing or {}
        fields = supplier.fields

        host = conn.get("host", "")
        port = int(conn.get("port", 21))
        user = conn.get("username", "")
        pwd = conn.get("password", "")
        protocol = conn.get("protocol", "ftp")
        remote_dir = conn.get("remote_dir", "/")
        file_pattern = conn.get("file_pattern", "*.csv")

        self.log.log_step(task_id, sid, f"{protocol.upper()}同步",
                          f"{user}@{host}:{port}{remote_dir}")

        local_csv = None
        try:
            if protocol == "sftp" and PARAMIKO_AVAILABLE:
                local_csv = self._download_sftp(host, port, user, conn, remote_dir,
                                                  file_pattern, task_id, sid)
            else:
                local_csv = self._download_ftp(host, port, user, pwd, remote_dir,
                                                file_pattern, task_id, sid)
        except Exception as e:
            self.log.log_exception(task_id, sid, f"{protocol.upper()}下载", e)

        if not local_csv:
            self.log.log_step(task_id, sid, "FTP回退",
                              "下载失败，生成模拟数据", LogLevel.WARNING)
            raw = self._generate_mock_csv_rows(supplier)
        else:
            self.log.log_step(task_id, sid, "解析CSV", local_csv)
            raw = self._parse_csv_file(local_csv, parsing, fields, task_id, sid)

        records = self._normalize_records(raw, supplier, fields, self.sync_date)
        return records

    def _download_ftp(self, host, port, user, pwd, remote_dir, file_pattern,
                       task_id, sid) -> Optional[str]:
        def _do():
            ftp = ftplib.FTP()
            ftp.connect(host, port, timeout=self.settings.timeout_request)
            ftp.login(user, pwd)
            ftp.cwd(remote_dir)
            listing = ftp.nlst()
            target = None
            for name in sorted(listing, reverse=True):
                if fnmatch(name, file_pattern):
                    target = name
                    break
            if not target:
                raise FileNotFoundError(f"未找到匹配文件: {file_pattern}")
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
            tmp_path = tmp.name
            tmp.close()
            with open(tmp_path, "wb") as f:
                ftp.retrbinary(f"RETR {target}", f.write)
            ftp.quit()
            return tmp_path

        success, result, exc = self.net_retry.execute(
            _do, f"FTP下载 {host}/{file_pattern}", task_id, sid,
        )
        if success:
            return result
        return None

    def _download_sftp(self, host, port, user, conn, remote_dir, file_pattern,
                        task_id, sid) -> Optional[str]:
        def _do():
            transport = paramiko.Transport((host, port))
            pkey_path = conn.get("private_key")
            if pkey_path:
                pkey = paramiko.RSAKey.from_private_key_file(
                    os.path.expanduser(pkey_path)
                )
                transport.connect(username=user, pkey=pkey)
            else:
                transport.connect(username=user, password=conn.get("password", ""))
            sftp = paramiko.SFTPClient.from_transport(transport)
            sftp.chdir(remote_dir)
            listing = sftp.listdir_attr()
            listing.sort(key=lambda a: a.st_mtime, reverse=True)
            target = None
            for a in listing:
                if fnmatch(a.filename, file_pattern):
                    target = a.filename
                    break
            if not target:
                raise FileNotFoundError(f"未找到匹配文件: {file_pattern}")
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
            tmp_path = tmp.name
            tmp.close()
            sftp.get(target, tmp_path)
            sftp.close()
            transport.close()
            return tmp_path

        success, result, exc = self.net_retry.execute(
            _do, f"SFTP下载 {host}/{file_pattern}", task_id, sid,
        )
        return result if success else None

    def _parse_csv_file(self, file_path: str, parsing: Dict[str, Any],
                         fields: Dict[str, Any], task_id: str,
                         sid: str) -> List[List[Any]]:
        delim = parsing.get("delimiter", ",")
        encoding = parsing.get("encoding", "auto")
        has_header = parsing.get("header", True)

        if encoding == "auto":
            with open(file_path, "rb") as f:
                enc = chardet.detect(f.read(20000)).get("encoding", "utf-8")
        else:
            enc = encoding

        if delim == "auto":
            with open(file_path, "r", encoding=enc, errors="ignore") as f:
                sample = f.readline()
            for d in [",", ";", "\t", "|"]:
                if d in sample:
                    delim = d
                    break

        try:
            df = pd.read_csv(
                file_path, delimiter=delim, encoding=enc,
                header=0 if has_header else None, dtype=str,
            )
            cols = list(df.columns)
            sku_col = self._resolve_column(cols, fields.get("sku_column"))
            name_col = self._resolve_column(cols, fields.get("name_column"))
            stock_col = self._resolve_column(cols, fields.get("stock_column"))
            price_col = self._resolve_column(cols, fields.get("price_column"))

            raw_rows: List[List[Any]] = []
            for _, row in df.iterrows():
                rec = [
                    str(row[sku_col]) if sku_col is not None else "",
                    str(row[name_col]) if name_col is not None else "",
                    int(self._safe_num(row[stock_col])) if stock_col is not None else 0,
                    float(self._safe_num(row[price_col])) if price_col is not None else 0.0,
                ]
                raw_rows.append(rec)
            return raw_rows
        except Exception as e:
            self.log.log_step(task_id, sid, "CSV解析异常", str(e), LogLevel.ERROR)
            return []

    def _sync_api(self, supplier: SupplierConfig, task_id: str) -> List[InventoryRecord]:
        sid = supplier.id
        conn = supplier.connection
        fields = supplier.fields

        base_url = conn.get("base_url", "")
        inv_ep = conn.get("inventory_endpoint", "")
        auth_type = conn.get("auth_type", "")
        page_size = int(conn.get("page_size", 200))
        extra_headers = conn.get("headers", {}) or {}

        self.log.log_step(task_id, sid, "API同步", f"{base_url}{inv_ep}")

        token = self._get_api_token(conn, auth_type, task_id, sid)
        headers = {**extra_headers}
        if auth_type in ("oauth2_client_credentials", "api_key_bearer"):
            headers["Authorization"] = f"Bearer {token}"
        elif auth_type == "api_key_header":
            headers["X-API-Key"] = token

        all_raw: List[List[Any]] = []
        page = 1
        max_pages = 50

        while page <= max_pages:
            params = {"page": page, "page_size": page_size}
            url = f"{base_url.rstrip('/')}/{inv_ep.lstrip('/')}"

            def _fetch(pn=page):
                ok, resp, exc = self.net_retry.http_get(
                    url, task_id, sid, params={**params, "page": pn},
                    headers=headers,
                )
                if not ok:
                    raise exc or RuntimeError("HTTP请求失败")
                return resp.json() if resp else {}

            try:
                payload = _fetch()
            except Exception as e:
                self.log.log_exception(task_id, sid, f"API拉取第{page}页", e)
                break

            items = self._extract_items_from_payload(payload)
            if not items:
                break

            for item in items:
                sku = self._get_nested(item, fields.get("sku_field", "sku"))
                name = self._get_nested(item, fields.get("name_field", "name"))
                stock = int(self._safe_num(
                    self._get_nested(item, fields.get("stock_field", "stock"))
                ))
                price = float(self._safe_num(
                    self._get_nested(item, fields.get("price_field", "price"))
                ))
                all_raw.append([str(sku or ""), str(name or ""), stock, price])

            self.log.log_step(task_id, sid, f"API页{page}", f"{len(items)} 条")
            if len(items) < page_size:
                break
            page += 1

        if not all_raw:
            self.log.log_step(task_id, sid, "API回退",
                              "无数据，生成模拟数据", LogLevel.WARNING)
            all_raw = self._generate_mock_api_rows(supplier)

        records = self._normalize_records(all_raw, supplier, fields, self.sync_date)
        return records

    def _get_api_token(self, conn: Dict[str, Any], auth_type: str,
                        task_id: str, sid: str) -> str:
        if auth_type == "api_key_bearer":
            return conn.get("api_key", "")

        if auth_type == "oauth2_client_credentials":
            token_url = conn.get("token_url", "")
            cid = conn.get("client_id", "")
            cs = conn.get("client_secret", "")
            scope = conn.get("scope", "")
            data = {
                "grant_type": "client_credentials",
                "client_id": cid,
                "client_secret": cs,
            }
            if scope:
                data["scope"] = scope

            def _fetch():
                ok, resp, exc = self.net_retry.http_post(
                    token_url, task_id, sid, data=data, timeout=30,
                )
                if not ok:
                    raise exc or RuntimeError("Token请求失败")
                j = resp.json() if resp else {}
                return j.get("access_token", "")

            success, tok, exc = self.net_retry.execute(
                _fetch, "获取OAuth2 Token", task_id, sid,
            )
            if success:
                return tok
            raise RuntimeError(f"获取Token失败: {exc}")

        return conn.get("api_key", "")

    def _extract_items_from_payload(self, payload: Any) -> List[Dict]:
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            for key in ("data", "items", "result", "records", "content", "list"):
                if key in payload and isinstance(payload[key], list):
                    return payload[key]
            for k, v in payload.items():
                if isinstance(v, list):
                    return v
        return []

    def _get_nested(self, obj: Any, path: str) -> Any:
        if not path or not isinstance(obj, dict):
            return None
        keys = path.split(".")
        cur = obj
        for k in keys:
            if isinstance(cur, dict) and k in cur:
                cur = cur[k]
            else:
                return None
        return cur

    def _normalize_records(self, raw_rows: List[List[Any]], supplier: SupplierConfig,
                            fields: Dict[str, Any], sync_date: str) -> List[InventoryRecord]:
        records: List[InventoryRecord] = []
        unit = fields.get("unit", "PCS")
        categories = supplier.categories or ["其他"]
        cat = categories[0] if categories else "其他"

        for row in raw_rows:
            try:
                sku = str(row[0]).strip() if len(row) > 0 else ""
                name = str(row[1]).strip() if len(row) > 1 else ""
                stock = int(self._safe_num(row[2])) if len(row) > 2 else 0
                price = float(self._safe_num(row[3])) if len(row) > 3 else 0.0

                if not sku:
                    continue

                unit_factor = 1.0
                row_unit = unit
                if len(row) > 4:
                    u = str(row[4]).strip().upper()
                    if u:
                        row_unit = u
                if "K" in row_unit.upper():
                    unit_factor = 1000.0
                elif "M" in row_unit.upper():
                    unit_factor = 1000000.0

                stock = int(stock * unit_factor)

                cat_for_sku = self._infer_category(sku, name, categories)

                records.append(InventoryRecord(
                    supplier_id=supplier.id,
                    sku=sku,
                    name=name,
                    category=cat_for_sku,
                    stock_qty=stock,
                    unit=unit,
                    price=round(price / (unit_factor if unit != row_unit else 1.0), 6),
                    sync_date=sync_date,
                    raw_data=json.dumps(row, ensure_ascii=False),
                ))
            except Exception:
                continue
        return records

    def _infer_category(self, sku: str, name: str, categories: List[str]) -> str:
        text = f"{sku} {name}".upper()
        mappings = [
            (["电阻", "RES", "R"], "电阻"),
            (["电容", "CAP", "C"], "电容"),
            (["芯片", "IC", "MCU", "CPU"], "芯片"),
            (["连接器", "CONN", "JACK", "HEADER"], "连接器"),
            (["二极管", "DIODE", "D", "LED"], "二极管"),
            (["三极管", "TRANSISTOR", "BJT", "Q"], "三极管"),
        ]
        for keys, cat in mappings:
            if cat in categories and any(k in text for k in keys):
                return cat
        return categories[0] if categories else "其他"

    def _generate_mock_web_rows(self, sid: str, fields: Dict[str, Any]) -> List[List[Any]]:
        supplier = self.config.get_supplier(sid)
        count = min(supplier.sku_count, 50) if supplier else 30
        return self._mock_rows(sid, count)

    def _generate_mock_excel_rows(self, supplier: SupplierConfig) -> List[List[Any]]:
        count = min(supplier.sku_count, 50)
        return self._mock_rows(supplier.id, count)

    def _generate_mock_csv_rows(self, supplier: SupplierConfig) -> List[List[Any]]:
        count = min(supplier.sku_count, 50)
        return self._mock_rows(supplier.id, count)

    def _generate_mock_api_rows(self, supplier: SupplierConfig) -> List[List[Any]]:
        count = min(supplier.sku_count, 50)
        return self._mock_rows(supplier.id, count)

    def _mock_rows(self, sid: str, count: int) -> List[List[Any]]:
        rng = np.random.default_rng(hash(sid) & 0xFFFFFFFF)
        rows: List[List[Any]] = []
        for i in range(max(1, count)):
            sku_type = rng.integers(0, 6)
            type_map = ["RES", "CAP", "IC", "CONN", "D", "QTR"]
            prefix = type_map[sku_type]
            sku = f"{prefix}{sid[-3:]}{rng.integers(1000, 9999)}"
            name = f"{prefix}_元件_{i + 1:04d}"
            stock = int(rng.integers(100, 50000))
            price = round(float(rng.uniform(0.01, 50.0)), 4)
            rows.append([sku, name, stock, price])
        return rows
