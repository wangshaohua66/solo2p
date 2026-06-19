import os
import re
import sys
import time
import json
import hmac
import base64
import signal
import hashlib
import logging
import urllib.parse
import argparse
import traceback
import multiprocessing
from logging.handlers import RotatingFileHandler
from typing import Optional, Dict, List, Tuple, Any, Callable
from pathlib import Path
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict

import yaml
from tqdm import tqdm
from PIL import Image, ImageEnhance

try:
    import pytesseract
except ImportError:
    pytesseract = None

from retry_handler import RetryConfig, RetryHandler, RetryStats
from opencv_detector import (
    ImagePreprocessor,
)
from invoice_captcha import CaptchaRecognizer, CaptchaSolver, CaptchaError
from u8_automation import U8Automation, U8AutomationError, ElementNotFoundException
from pdf_processor import PDFProcessor, PDFInvoiceExtractor, PDFProcessingError
from memory_monitor import (
    MemoryMonitor,
    MemoryGuard,
    MemoryExceededError,
    MemoryLevel,
)


class _NullGuard:
    def __enter__(self) -> "_NullGuard":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        pass


@dataclass
class InvoiceData:
    file_path: str
    file_hash: str
    invoice_code: Optional[str] = None
    invoice_number: Optional[str] = None
    tax_id: Optional[str] = None
    amount: Optional[str] = None
    invoice_date: Optional[str] = None
    seller: Optional[str] = None
    ocr_confidence: float = 0.0
    status: str = "pending"
    error_message: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    processing_duration: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ProcessingStats:
    total_invoices: int = 0
    completed: int = 0
    failed: int = 0
    ocr_success: int = 0
    fill_success: int = 0
    total_duration: float = 0.0
    avg_processing_time: float = 0.0
    ocr_accuracy: float = 0.0
    fill_accuracy: float = 0.0
    start_time: float = field(default_factory=time.time)

    def update(self, invoice: InvoiceData, success: bool) -> None:
        self.total_invoices += 1
        if success:
            self.completed += 1
            if invoice.ocr_confidence > 0:
                self.ocr_success += 1
            self.fill_success += 1
        else:
            self.failed += 1

        if self.total_invoices > 0:
            self.avg_processing_time = self.total_duration / self.total_invoices
            self.ocr_accuracy = self.ocr_success / self.total_invoices
            self.fill_accuracy = self.fill_success / self.total_invoices

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result["elapsed_time"] = time.time() - self.start_time
        result["remaining_invoices"] = self.total_invoices - self.completed - self.failed
        if self.avg_processing_time > 0 and result["remaining_invoices"] > 0:
            result["estimated_remaining_time"] = result["remaining_invoices"] * self.avg_processing_time
        else:
            result["estimated_remaining_time"] = 0
        return result


class ConfigManager:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self._config: Optional[Dict] = None
        self._last_modified: float = 0.0
        self.load_config()

    def load_config(self) -> Dict:
        with open(self.config_path, "r", encoding="utf-8") as f:
            self._config = yaml.safe_load(f)
        self._last_modified = os.path.getmtime(self.config_path)
        return self._config

    def get_config(self, auto_reload: bool = True) -> Dict:
        if auto_reload and self._check_modified():
            logger.info("Config file changed, reloading...", extra={
                "operation": "config_reload",
                "status": "success",
                "duration": 0.0,
            })
            self.load_config()
        return self._config or {}

    def _check_modified(self) -> bool:
        try:
            current_modified = os.path.getmtime(self.config_path)
            if current_modified > self._last_modified:
                return True
        except OSError:
            pass
        return False

    def __getitem__(self, key: str) -> Any:
        return self.get_config()[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self.get_config().get(key, default)


class OCREngine:
    def __init__(self, config: Dict, preprocessor: ImagePreprocessor):
        if pytesseract is None:
            raise ImportError("pytesseract is required for OCREngine")

        self.config = config.get("ocr", {})
        self.preprocessor = preprocessor

        tesseract_cmd = self.config.get("tesseract_cmd")
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

        self.language = self.config.get("language", "chi_sim+eng")
        self.psm = self.config.get("psm", 6)
        self.oem = self.config.get("oem", 3)
        self.min_confidence = self.config.get("min_confidence", 70)
        self.fields = self.config.get("fields", [])
        self.retry_config = RetryConfig.from_yaml_config(config.get("retry", {}))

    def _get_tesseract_config(self) -> str:
        return f"--oem {self.oem} --psm {self.psm}"

    def extract_text(self, image: Image.Image) -> Tuple[str, float]:
        start_time = time.time()
        try:
            processed_image = self.preprocessor.preprocess_invoice(image)
            processed_image = self.preprocessor.auto_rotate(processed_image)
            processed_image = self.preprocessor.crop_to_content(processed_image)
            processed_image = self.preprocessor.enhance_text(processed_image)

            config = self._get_tesseract_config()
            result = pytesseract.image_to_data(
                processed_image,
                lang=self.language,
                config=config,
                output_type=pytesseract.Output.DICT,
            )

            texts = result.get("text", [])
            confidences = result.get("conf", [])

            valid_parts = []
            total_confidence = 0.0
            valid_count = 0

            for text, conf in zip(texts, confidences):
                text = text.strip()
                if text and conf != -1:
                    valid_parts.append(text)
                    total_confidence += float(conf)
                    valid_count += 1

            full_text = "\n".join(valid_parts)
            avg_confidence = total_confidence / valid_count if valid_count > 0 else 0.0

            duration = time.time() - start_time
            logger.info(
                f"OCR text extraction completed (confidence: {avg_confidence:.1f}%)",
                extra={
                    "operation": "ocr_extract",
                    "status": "success",
                    "duration": duration,
                    "confidence": avg_confidence,
                    "text_length": len(full_text),
                },
            )

            return full_text, avg_confidence

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"OCR text extraction failed: {str(e)}",
                extra={
                    "operation": "ocr_extract",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise

    def parse_fields(self, text: str, avg_confidence: float) -> Dict[str, Any]:
        start_time = time.time()
        fields = {}

        for field_config in self.fields:
            field_name = field_config["name"]
            pattern = field_config["pattern"]
            required = field_config.get("required", False)

            match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
            if match:
                value = match.group(1).strip()
                fields[field_name] = self._normalize_field(field_name, value)
            elif required:
                raise ValueError(f"Required field '{field_name}' not found in OCR text")
            else:
                fields[field_name] = None

        fields["ocr_confidence"] = avg_confidence

        duration = time.time() - start_time
        logger.info(
            f"Field parsing completed: {len(fields)} fields extracted",
            extra={
                "operation": "ocr_parse",
                "status": "success",
                "duration": duration,
                "fields": list(fields.keys()),
            },
        )

        return fields

    def _normalize_field(self, field_name: str, value: str) -> str:
        value = value.strip()
        if field_name == "amount":
            value = re.sub(r'[¥￥,\s]', '', value)
        elif field_name == "invoice_date":
            value = re.sub(r'[年月日]', '-', value)
            value = re.sub(r'-+', '-', value).strip('-')
        elif field_name in ["invoice_code", "invoice_number", "tax_id"]:
            value = re.sub(r'\D', '', value)
        return value

    def process_image(self, image_path: str) -> Dict[str, Any]:
        handler = RetryHandler(self.retry_config, "ocr_process_image")

        def try_process():
            image = Image.open(image_path)
            text, confidence = self.extract_text(image)
            return self.parse_fields(text, confidence)

        return handler.execute(try_process)

    def process_pdf(self, pdf_path: str, pdf_processor: PDFProcessor) -> Dict[str, Any]:
        handler = RetryHandler(self.retry_config, "ocr_process_pdf")

        def try_process():
            pages = pdf_processor.get_all_pages_with_text(pdf_path)
            all_text = []
            total_confidence = 0.0
            ocr_page_count = 0

            for page in pages:
                if page.text and len(page.text.strip()) > 50:
                    all_text.append(page.text)
                    total_confidence += 100.0
                    ocr_page_count += 1
                else:
                    text, confidence = self.extract_text(page.image)
                    all_text.append(text)
                    total_confidence += confidence
                    ocr_page_count += 1

            full_text = "\n\n".join(all_text)
            avg_confidence = total_confidence / ocr_page_count if ocr_page_count > 0 else 0.0
            return self.parse_fields(full_text, avg_confidence)

        return handler.execute(try_process)

    def process_file(self, file_path: str, pdf_processor: Optional[PDFProcessor] = None) -> Dict[str, Any]:
        ext = os.path.splitext(file_path)[1].lower()

        if ext == ".pdf":
            if pdf_processor is None:
                raise ValueError("PDF processor is required for PDF files")
            return self.process_pdf(file_path, pdf_processor)
        else:
            return self.process_image(file_path)


class DingTalkNotifier:
    def __init__(self, config: Dict):
        self.config = config.get("dingtalk", {})
        self.webhook_url = self.config.get("webhook_url", "")
        self.secret = self.config.get("secret", "")
        self.at_mobiles = self.config.get("at_mobiles", [])
        self.at_all = self.config.get("at_all", False)
        self.notify_on = self.config.get("notify_on", ["error", "batch_complete"])
        self.enabled = bool(self.webhook_url)

    def _sign(self) -> Tuple[str, int]:
        if not self.secret:
            return "", 0

        timestamp = int(round(time.time() * 1000))
        string_to_sign = f"{timestamp}\n{self.secret}"
        hmac_code = hmac.new(
            self.secret.encode("utf-8"),
            string_to_sign.encode("utf-8"),
            digestmod=hashlib.sha256
        ).digest()
        sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
        return sign, timestamp

    def send_message(self, message: str, level: str = "info") -> bool:
        if not self.enabled:
            return False

        if level not in self.notify_on:
            return True

        try:
            import requests

            sign, timestamp = self._sign()
            url = self.webhook_url
            if sign:
                url = f"{url}&timestamp={timestamp}&sign={sign}"

            headers = {"Content-Type": "application/json"}
            payload = {
                "msgtype": "text",
                "text": {"content": f"【发票自动化系统】{message}"},
                "at": {
                    "atMobiles": self.at_mobiles,
                    "isAtAll": self.at_all,
                },
            }

            response = requests.post(url, json=payload, headers=headers, timeout=10)
            result = response.json()

            if result.get("errcode") == 0:
                logger.info(
                    f"DingTalk notification sent: {message[:50]}",
                    extra={
                        "operation": "dingtalk_notify",
                        "status": "success",
                        "duration": 0.0,
                        "message_level": level,
                    },
                )
                return True
            else:
                logger.error(
                    f"DingTalk notification failed: {result.get('errmsg')}",
                    extra={
                        "operation": "dingtalk_notify",
                        "status": "failed",
                        "duration": 0.0,
                        "error": result.get("errmsg"),
                    },
                )
                return False

        except Exception as e:
            logger.error(
                f"DingTalk notification error: {str(e)}",
                extra={
                    "operation": "dingtalk_notify",
                    "status": "error",
                    "duration": 0.0,
                    "error": str(e),
                },
            )
            return False

    def notify_error(self, error_message: str) -> None:
        self.send_message(f"❌ 处理出错: {error_message}", level="error")

    def notify_batch_complete(self, stats: ProcessingStats) -> None:
        message = (
            f"✅ 批量处理完成\n"
            f"总计: {stats.total_invoices} 张\n"
            f"成功: {stats.completed} 张\n"
            f"失败: {stats.failed} 张\n"
            f"OCR准确率: {stats.ocr_accuracy:.1%}\n"
            f"平均耗时: {stats.avg_processing_time:.1f}秒/张\n"
            f"总耗时: {stats.total_duration:.1f}秒"
        )
        self.send_message(message, level="batch_complete")


class StateManager:
    def __init__(self, config: Dict, memory_monitor: Optional[MemoryMonitor] = None):
        state_config = config.get("state_tracking", {})
        self.file_path = state_config.get("file_path", "./state/invoice_state.json")
        self.save_interval = state_config.get("save_interval", 10)
        self.valid_states = state_config.get("states", ["pending", "completed", "failed"])
        self._state: Dict[str, Dict] = {}
        self._change_count = 0
        self._memory_monitor = memory_monitor
        self._last_memory_check = 0.0
        self._memory_check_cooldown = 5.0
        self._load_state()

    def _check_memory(self) -> None:
        if self._memory_monitor is None:
            return

        current_time = time.time()
        if current_time - self._last_memory_check < self._memory_check_cooldown:
            return

        self._last_memory_check = current_time
        ok, snapshot = self._memory_monitor.check_memory()

        if not ok:
            self._memory_monitor.try_cleanup()

        if snapshot.level == MemoryLevel.WARNING:
            logger.warning(
                f"High memory during state operation: {snapshot.rss_mb:.1f}MB / "
                f"{snapshot.limit_mb:.1f}MB ({snapshot.usage_ratio:.1%})",
                extra={
                    "operation": "state_memory_check",
                    "status": "warning",
                    "duration": 0.0,
                    "rss_mb": snapshot.rss_mb,
                    "usage_ratio": snapshot.usage_ratio,
                },
            )

    def _load_state(self) -> None:
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    self._state = json.load(f)
                logger.info(
                    f"Loaded state from {self.file_path}: {len(self._state)} records",
                    extra={
                        "operation": "state_load",
                        "status": "success",
                        "duration": 0.0,
                        "record_count": len(self._state),
                    },
                )
            except Exception as e:
                logger.warning(
                    f"Failed to load state: {str(e)}, starting fresh",
                    extra={
                        "operation": "state_load",
                        "status": "failed",
                        "duration": 0.0,
                        "error": str(e),
                    },
                )
                self._state = {}

    def _save_state(self, force: bool = False) -> None:
        self._change_count += 1
        if not force and self._change_count < self.save_interval:
            return

        try:
            os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self._state, f, ensure_ascii=False, indent=2)
            self._change_count = 0
            logger.debug(
                f"State saved to {self.file_path}",
                extra={
                    "operation": "state_save",
                    "status": "success",
                    "duration": 0.0,
                    "record_count": len(self._state),
                },
            )
        except Exception as e:
            logger.error(
                f"Failed to save state: {str(e)}",
                extra={
                    "operation": "state_save",
                    "status": "failed",
                    "duration": 0.0,
                    "error": str(e),
                },
            )

    def get_invoice(self, file_hash: str) -> Optional[Dict]:
        return self._state.get(file_hash)

    def update_invoice(self, invoice: InvoiceData) -> None:
        self._check_memory()
        invoice.updated_at = time.time()
        self._state[invoice.file_hash] = invoice.to_dict()
        self._save_state()

    def get_pending_invoices(self, file_hashes: List[str]) -> List[str]:
        pending = []
        for h in file_hashes:
            state = self._state.get(h, {})
            if state.get("status") not in ["completed"]:
                pending.append(h)
        return pending

    def flush(self) -> None:
        self._save_state(force=True)


class InvoiceProcessor:
    def __init__(
        self,
        config_manager: ConfigManager,
        ocr_engine: OCREngine,
        state_manager: StateManager,
        notifier: DingTalkNotifier,
        pdf_processor: Optional[PDFProcessor] = None,
        memory_monitor: Optional[MemoryMonitor] = None,
    ):
        self.config_manager = config_manager
        self.ocr_engine = ocr_engine
        self.state_manager = state_manager
        self.notifier = notifier
        self.pdf_processor = pdf_processor
        self.memory_monitor = memory_monitor
        self._shutdown = False
        self.retry_config = RetryConfig.from_yaml_config(config_manager.get("retry", {}))

        memory_config = config_manager.get("memory_monitoring", {})
        self.enforce_memory_limit = memory_config.get("enforce_limit", True)
        self.reject_on_critical = memory_config.get("reject_on_critical", True)

    def _check_memory_before_operation(self, operation_name: str, required_mb: float = 0.0) -> bool:
        if self.memory_monitor is None or not self.enforce_memory_limit:
            return True

        ok, snapshot = self.memory_monitor.check_memory()

        if snapshot.level == MemoryLevel.CRITICAL and self.reject_on_critical:
            logger.error(
                f"Memory critical, rejecting {operation_name}: "
                f"{snapshot.rss_mb:.1f}MB / {snapshot.limit_mb:.1f}MB ({snapshot.usage_ratio:.1%})",
                extra={
                    "operation": f"memory_guard_{operation_name}",
                    "status": "rejected",
                    "duration": 0.0,
                    "rss_mb": snapshot.rss_mb,
                    "usage_ratio": snapshot.usage_ratio,
                },
            )
            self.notifier.notify_error(
                f"内存超限，操作被拒绝: {operation_name}\n"
                f"当前: {snapshot.rss_mb:.1f}MB / 限制: {snapshot.limit_mb:.1f}MB"
            )
            return False

        if not self.memory_monitor.ensure_capacity(required_mb):
            logger.error(
                f"Memory capacity insufficient for {operation_name}",
                extra={
                    "operation": f"memory_guard_{operation_name}",
                    "status": "insufficient",
                    "duration": 0.0,
                    "required_mb": required_mb,
                },
            )
            return False

        return True

    def signal_handler(self, signum, frame):
        logger.info(
            f"Received signal {signum}, initiating graceful shutdown...",
            extra={
                "operation": "shutdown_signal",
                "status": "received",
                "duration": 0.0,
                "signal": signum,
            },
        )
        self._shutdown = True

    def calculate_file_hash(self, file_path: str) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def scan_invoice_files(self, directory: str) -> List[InvoiceData]:
        invoices = []
        supported_extensions = (".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".pdf")

        for root, dirs, files in os.walk(directory):
            for filename in files:
                if filename.lower().endswith(supported_extensions):
                    file_path = os.path.join(root, filename)
                    file_hash = self.calculate_file_hash(file_path)
                    invoice = InvoiceData(
                        file_path=file_path,
                        file_hash=file_hash,
                    )
                    invoices.append(invoice)

        logger.info(
            f"Scanned {len(invoices)} invoice files from {directory}",
            extra={
                "operation": "scan_files",
                "status": "success",
                "duration": 0.0,
                "file_count": len(invoices),
            },
        )

        return invoices

    def filter_pending_invoices(self, invoices: List[InvoiceData]) -> List[InvoiceData]:
        pending_hashes = self.state_manager.get_pending_invoices(
            [inv.file_hash for inv in invoices]
        )
        pending = [inv for inv in invoices if inv.file_hash in pending_hashes]

        logger.info(
            f"Filtered to {len(pending)} pending invoices (skip {len(invoices) - len(pending)} completed)",
            extra={
                "operation": "filter_pending",
                "status": "success",
                "duration": 0.0,
                "pending_count": len(pending),
                "skipped_count": len(invoices) - len(pending),
            },
        )

        return pending

    def process_single_invoice(
        self,
        invoice: InvoiceData,
        u8_automation: Optional[U8Automation] = None,
        dry_run: bool = False,
    ) -> InvoiceData:
        start_time = time.time()
        logger.info(
            f"Starting processing: {os.path.basename(invoice.file_path)}",
            extra={
                "operation": "process_start",
                "status": "start",
                "duration": 0.0,
                "file": invoice.file_path,
            },
        )

        try:
            if self._shutdown:
                raise KeyboardInterrupt("Shutdown requested")

            if not self._check_memory_before_operation("invoice_processing", required_mb=50.0):
                invoice.status = "failed"
                invoice.error_message = "Memory limit exceeded, operation rejected"
                invoice.processing_duration = time.time() - start_time
                self.state_manager.update_invoice(invoice)
                return invoice

            invoice.status = "preprocessing"
            self.state_manager.update_invoice(invoice)

            invoice.status = "ocr"
            self.state_manager.update_invoice(invoice)

            with MemoryGuard(self.memory_monitor, "ocr_processing") if self.memory_monitor else _NullGuard():
                ocr_result = self.ocr_engine.process_file(invoice.file_path, self.pdf_processor)

            invoice.invoice_code = ocr_result.get("invoice_code")
            invoice.invoice_number = ocr_result.get("invoice_number")
            invoice.tax_id = ocr_result.get("tax_id")
            invoice.amount = ocr_result.get("amount")
            invoice.invoice_date = ocr_result.get("invoice_date")
            invoice.seller = ocr_result.get("seller")
            invoice.ocr_confidence = ocr_result.get("ocr_confidence", 0.0)

            required_fields = [
                f["name"] for f in self.config_manager.get("ocr", {}).get("fields", [])
                if f.get("required", False)
            ]
            for field in required_fields:
                if not getattr(invoice, field):
                    raise ValueError(f"Required field '{field}' is empty after OCR")

            self.state_manager.update_invoice(invoice)

            if not dry_run and u8_automation is not None:
                if not self._check_memory_before_operation("u8_filling", required_mb=20.0):
                    invoice.status = "failed"
                    invoice.error_message = "Memory limit exceeded before U8 filling"
                    invoice.processing_duration = time.time() - start_time
                    self.state_manager.update_invoice(invoice)
                    return invoice

                invoice.status = "filling"
                self.state_manager.update_invoice(invoice)

                invoice_data = {
                    "invoice_code": invoice.invoice_code,
                    "invoice_number": invoice.invoice_number,
                    "tax_id": invoice.tax_id,
                    "amount": invoice.amount,
                    "invoice_date": invoice.invoice_date,
                    "seller": invoice.seller or "",
                }

                u8_automation.process_invoice(invoice_data, required_fields)

            invoice.status = "completed"
            invoice.processing_duration = time.time() - start_time
            self.state_manager.update_invoice(invoice)

            if self.memory_monitor is not None:
                self.memory_monitor.try_cleanup()

            logger.info(
                f"Successfully processed: {os.path.basename(invoice.file_path)}",
                extra={
                    "operation": "process_complete",
                    "status": "success",
                    "duration": invoice.processing_duration,
                    "file": invoice.file_path,
                    "invoice_code": invoice.invoice_code,
                    "confidence": invoice.ocr_confidence,
                },
            )

        except KeyboardInterrupt as e:
            invoice.status = "pending"
            invoice.error_message = f"Interrupted: {str(e)}"
            invoice.processing_duration = time.time() - start_time
            self.state_manager.update_invoice(invoice)
            raise

        except Exception as e:
            invoice.status = "failed"
            invoice.error_message = f"{type(e).__name__}: {str(e)}"
            invoice.processing_duration = time.time() - start_time
            self.state_manager.update_invoice(invoice)

            logger.error(
                f"Failed to process {os.path.basename(invoice.file_path)}: {invoice.error_message}",
                extra={
                    "operation": "process_failed",
                    "status": "failed",
                    "duration": invoice.processing_duration,
                    "file": invoice.file_path,
                    "error": invoice.error_message,
                },
            )
            self.notifier.notify_error(
                f"发票处理失败: {os.path.basename(invoice.file_path)}\n错误: {invoice.error_message}"
            )

        return invoice


def init_worker(config_path: str):
    global _worker_config
    _worker_config = config_path

    signal.signal(signal.SIGINT, signal.SIG_IGN)


def process_invoice_worker(invoice_data: Dict, config_path: str, dry_run: bool) -> Dict:
    try:
        config_manager = ConfigManager(config_path)
        config = config_manager.get_config()

        preprocessor = ImagePreprocessor.from_yaml_config(config)
        ocr_engine = OCREngine(config, preprocessor)

        try:
            memory_monitor = MemoryMonitor.from_yaml_config(config)
        except ImportError:
            memory_monitor = None

        state_manager = StateManager(config, memory_monitor)
        notifier = DingTalkNotifier(config)

        try:
            pdf_processor = PDFProcessor.from_yaml_config(config)
        except ImportError:
            pdf_processor = None

        processor = InvoiceProcessor(
            config_manager,
            ocr_engine,
            state_manager,
            notifier,
            pdf_processor,
            memory_monitor,
        )
        invoice = InvoiceData(**invoice_data)

        result = processor.process_single_invoice(invoice, dry_run=dry_run)
        return result.to_dict()

    except Exception as e:
        traceback.print_exc()
        invoice_data["status"] = "failed"
        invoice_data["error_message"] = f"Worker error: {str(e)}"
        return invoice_data


class InvoiceAutomationSystem:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.config_manager = ConfigManager(config_path)
        self.config = self.config_manager.get_config()

        self._setup_logging()

        system_config = self.config.get("system", {})
        self.memory_limit_mb = system_config.get("memory_limit_mb", 500)

        try:
            self.memory_monitor = MemoryMonitor.from_yaml_config(self.config)
            self.memory_monitor.start_monitoring(
                on_warning=self._on_memory_warning,
                on_critical=self._on_memory_critical,
            )
            logger.info(
                f"Memory monitor initialized: limit={self.memory_limit_mb}MB",
                extra={
                    "operation": "memory_monitor_init",
                    "status": "success",
                    "duration": 0.0,
                    "limit_mb": self.memory_limit_mb,
                },
            )
        except ImportError:
            logger.warning(
                "psutil not installed, memory monitoring will be disabled. "
                "Install with: pip install psutil",
                extra={
                    "operation": "memory_monitor_init",
                    "status": "disabled",
                    "duration": 0.0,
                },
            )
            self.memory_monitor = None

        self.preprocessor = ImagePreprocessor.from_yaml_config(self.config)
        self.ocr_engine = OCREngine(self.config, self.preprocessor)
        self.state_manager = StateManager(self.config, self.memory_monitor)
        self.notifier = DingTalkNotifier(self.config)

        try:
            self.pdf_processor = PDFProcessor.from_yaml_config(self.config)
            self.pdf_extractor = PDFInvoiceExtractor(self.pdf_processor)
        except ImportError:
            logger.warning(
                "PyMuPDF not installed, PDF processing will be disabled. "
                "Install with: pip install PyMuPDF",
                extra={
                    "operation": "pdf_init",
                    "status": "disabled",
                    "duration": 0.0,
                },
            )
            self.pdf_processor = None
            self.pdf_extractor = None

        self.processor = InvoiceProcessor(
            self.config_manager,
            self.ocr_engine,
            self.state_manager,
            self.notifier,
            self.pdf_processor,
            self.memory_monitor,
        )

        self.captcha_recognizer = CaptchaRecognizer.from_yaml_config(self.config)
        self.captcha_solver = CaptchaSolver(self.captcha_recognizer)

        self.u8_automation: Optional[U8Automation] = None

        signal.signal(signal.SIGINT, self.processor.signal_handler)
        signal.signal(signal.SIGTERM, self.processor.signal_handler)

        self.stats = ProcessingStats()
        self.retry_stats = RetryStats()

    def _on_memory_warning(self, snapshot) -> None:
        logger.warning(
            f"Memory warning callback: {snapshot.rss_mb:.1f}MB / {snapshot.limit_mb:.1f}MB",
            extra={
                "operation": "memory_warning_callback",
                "status": "warning",
                "duration": 0.0,
                "rss_mb": snapshot.rss_mb,
                "usage_ratio": snapshot.usage_ratio,
            },
        )

    def _on_memory_critical(self, snapshot) -> None:
        logger.error(
            f"Memory critical callback: {snapshot.rss_mb:.1f}MB / {snapshot.limit_mb:.1f}MB",
            extra={
                "operation": "memory_critical_callback",
                "status": "critical",
                "duration": 0.0,
                "rss_mb": snapshot.rss_mb,
                "usage_ratio": snapshot.usage_ratio,
            },
        )
        self.notifier.notify_error(
            f"内存使用达到临界值!\n"
            f"当前: {snapshot.rss_mb:.1f}MB / 限制: {snapshot.limit_mb:.1f}MB "
            f"({snapshot.usage_ratio:.1%})"
        )

    def _setup_logging(self) -> None:
        logging_config = self.config.get("logging", {})
        log_level = getattr(logging, logging_config.get("level", "INFO").upper(), logging.INFO)
        log_format = logging_config.get(
            "format",
            "%(asctime)s | %(levelname)-8s | %(operation)s | %(status)s | %(duration).3fs | %(message)s",
        )
        date_format = logging_config.get("date_format", "%Y-%m-%d %H:%M:%S")
        file_path = logging_config.get("file_path", "./logs/invoice_automation.log")
        max_file_size = logging_config.get("max_file_size_mb", 50) * 1024 * 1024
        backup_count = logging_config.get("backup_count", 10)

        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        class ContextFilter(logging.Filter):
            def filter(self, record):
                if not hasattr(record, "operation"):
                    record.operation = "system"
                if not hasattr(record, "status"):
                    record.status = "info"
                if not hasattr(record, "duration"):
                    record.duration = 0.0
                return True

        root_logger = logging.getLogger()
        root_logger.setLevel(log_level)
        root_logger.handlers.clear()
        root_logger.addFilter(ContextFilter())

        file_handler = RotatingFileHandler(
            file_path,
            maxBytes=max_file_size,
            backupCount=backup_count,
            encoding="utf-8",
        )
        file_handler.setFormatter(logging.Formatter(log_format, datefmt=date_format))
        root_logger.addHandler(file_handler)

        if logging_config.get("console_output", True):
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setFormatter(logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(message)s",
                datefmt=date_format,
            ))
            root_logger.addHandler(console_handler)

        global logger
        logger = logging.getLogger(__name__)

    def initialize_u8(self) -> None:
        logger.info("Initializing U8 automation (Selenium WebDriver)...", extra={
            "operation": "u8_init",
            "status": "start",
            "duration": 0.0,
        })

        try:
            self.u8_automation = U8Automation.from_yaml_config(
                self.config, self.captcha_solver
            )
            self.u8_automation.initialize()

            logger.info("U8 automation initialized successfully", extra={
                "operation": "u8_init",
                "status": "success",
                "duration": 0.0,
            })

        except Exception as e:
            logger.error(f"U8 automation initialization failed: {str(e)}", extra={
                "operation": "u8_init",
                "status": "failed",
                "duration": 0.0,
                "error": str(e),
            })
            raise

    def process_batch(
        self,
        invoice_dir: str,
        max_workers: Optional[int] = None,
        dry_run: bool = False,
        resume: bool = True,
    ) -> ProcessingStats:
        start_time = time.time()
        self.stats = ProcessingStats()

        logger.info(
            f"Starting batch processing: {invoice_dir} (workers={max_workers}, dry_run={dry_run})",
            extra={
                "operation": "batch_start",
                "status": "start",
                "duration": 0.0,
                "directory": invoice_dir,
                "max_workers": max_workers,
                "dry_run": dry_run,
            },
        )

        all_invoices = self.processor.scan_invoice_files(invoice_dir)

        if resume:
            invoices_to_process = self.processor.filter_pending_invoices(all_invoices)
        else:
            invoices_to_process = all_invoices

        if not invoices_to_process:
            logger.info("No invoices to process", extra={
                "operation": "batch_complete",
                "status": "no_work",
                "duration": 0.0,
            })
            return self.stats

        if max_workers is None:
            system_config = self.config_manager.get_config().get("system", {})
            max_workers = system_config.get("max_concurrent_tasks", 5)
            max_concurrent_limit = system_config.get("max_concurrent_limit", 10)
        else:
            max_concurrent_limit = 10

        max_workers = max(1, min(int(max_workers), int(max_concurrent_limit), len(invoices_to_process)))

        if not dry_run and max_workers > 1:
            logger.warning(
                "Multi-processing with U8 automation may cause conflicts, using single worker",
                extra={
                    "operation": "batch_start",
                    "status": "warning",
                    "duration": 0.0,
                },
            )
            max_workers = 1

        pbar = tqdm(
            total=len(invoices_to_process),
            desc="Processing invoices",
            unit="inv",
            dynamic_ncols=True,
        )

        try:
            if max_workers > 1:
                with ProcessPoolExecutor(
                    max_workers=max_workers,
                    initializer=init_worker,
                    initargs=(self.config_path,),
                ) as executor:
                    future_to_invoice = {
                        executor.submit(
                            process_invoice_worker,
                            inv.to_dict(),
                            self.config_path,
                            dry_run,
                        ): inv
                        for inv in invoices_to_process
                    }

                    for future in as_completed(future_to_invoice):
                        if self.processor._shutdown:
                            for f in future_to_invoice:
                                f.cancel()
                            break

                        invoice = future_to_invoice[future]
                        try:
                            result = future.result()
                            success = result.get("status") == "completed"
                            self.stats.total_duration += result.get("processing_duration", 0)
                            self.stats.update(InvoiceData(**result), success)
                        except Exception as e:
                            self.stats.update(invoice, False)
                            logger.error(f"Worker error for {invoice.file_path}: {str(e)}")

                        pbar.update(1)
                        pbar.set_postfix({
                            "OK": self.stats.completed,
                            "FAIL": self.stats.failed,
                            "ACC": f"{self.stats.ocr_accuracy:.0%}",
                        })
            else:
                for invoice in invoices_to_process:
                    if self.processor._shutdown:
                        break

                    result = self.processor.process_single_invoice(
                        invoice, self.u8_automation, dry_run
                    )
                    success = result.status == "completed"
                    self.stats.total_duration += result.processing_duration
                    self.stats.update(result, success)

                    pbar.update(1)
                    pbar.set_postfix({
                        "OK": self.stats.completed,
                        "FAIL": self.stats.failed,
                        "ACC": f"{self.stats.ocr_accuracy:.0%}",
                    })

        finally:
            pbar.close()
            self.state_manager.flush()

        total_duration = time.time() - start_time
        self.stats.total_duration = total_duration

        log_extra = {
            "operation": "batch_complete",
            "status": "complete",
            "duration": total_duration,
            "total": self.stats.total_invoices,
            "completed": self.stats.completed,
            "failed": self.stats.failed,
            "ocr_accuracy": self.stats.ocr_accuracy,
            "avg_time": self.stats.avg_processing_time,
        }

        if self.stats.failed == 0:
            logger.info(
                f"Batch processing completed successfully: "
                f"{self.stats.completed}/{self.stats.total_invoices} invoices",
                extra=log_extra,
            )
        else:
            logger.warning(
                f"Batch processing completed with errors: "
                f"{self.stats.completed} ok, {self.stats.failed} failed out of {self.stats.total_invoices}",
                extra=log_extra,
            )

        self.notifier.notify_batch_complete(self.stats)

        return self.stats

    def run_single(self, invoice_path: str, dry_run: bool = False) -> InvoiceData:
        file_hash = self.processor.calculate_file_hash(invoice_path)
        invoice = InvoiceData(file_path=invoice_path, file_hash=file_hash)

        result = self.processor.process_single_invoice(
            invoice, self.u8_automation, dry_run
        )
        self.state_manager.flush()

        return result

    def show_status(self) -> None:
        stats_dict = self.stats.to_dict()
        print("\n" + "=" * 60)
        print("发票自动化处理系统 - 状态报告")
        print("=" * 60)
        print(f"启动时间: {datetime.fromtimestamp(self.stats.start_time).strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"已运行: {stats_dict['elapsed_time']:.1f} 秒")
        print(f"总发票数: {stats_dict['total_invoices']}")
        print(f"已完成: {stats_dict['completed']}")
        print(f"失败: {stats_dict['failed']}")
        print(f"OCR准确率: {stats_dict['ocr_accuracy']:.1%}")
        print(f"填报准确率: {stats_dict['fill_accuracy']:.1%}")
        print(f"平均处理时间: {stats_dict['avg_processing_time']:.1f} 秒/张")
        print(f"预计剩余时间: {stats_dict['estimated_remaining_time']:.1f} 秒")
        if self.memory_monitor is not None:
            mem_stats = self.memory_monitor.get_stats()
            current = mem_stats["current"]
            print("-" * 60)
            print("内存监控:")
            print(f"  当前使用: {current['rss_mb']:.1f}MB / {self.memory_limit_mb}MB "
                  f"({current['usage_ratio']:.1%})")
            print(f"  峰值使用: {mem_stats['peak_rss_mb']:.1f}MB")
            print(f"  内存等级: {current['level']}")
            print(f"  警告次数: {mem_stats['warning_count']}")
            print(f"  临界次数: {mem_stats['critical_count']}")
            print(f"  GC次数: {mem_stats['gc_count']}")
        print("=" * 60 + "\n")

    def cleanup(self) -> None:
        if self.memory_monitor is not None:
            self.memory_monitor.stop_monitoring()
        if self.u8_automation is not None:
            self.u8_automation.cleanup()
        self.state_manager.flush()
        logger.info("System cleanup completed", extra={
            "operation": "cleanup",
            "status": "success",
            "duration": 0.0,
        })


def main():
    parser = argparse.ArgumentParser(
        description="发票自动化处理系统 - 自动识别OCR并录入用友U8系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "-c", "--config",
        default="./config.yaml",
        help="配置文件路径 (默认: ./config.yaml)",
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    batch_parser = subparsers.add_parser("batch", help="批量处理发票目录")
    batch_parser.add_argument(
        "-d", "--directory",
        default="./invoices",
        help="发票图片目录 (默认: ./invoices)",
    )
    batch_parser.add_argument(
        "-w", "--workers",
        type=int,
        default=None,
        help="并发工作进程数 (默认: 读取配置)",
    )
    batch_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅OCR识别，不执行U8录入",
    )
    batch_parser.add_argument(
        "--no-resume",
        action="store_true",
        help="不使用断点续传，重新处理所有发票",
    )

    single_parser = subparsers.add_parser("single", help="处理单张发票")
    single_parser.add_argument(
        "-f", "--file",
        required=True,
        help="发票图片文件路径",
    )
    single_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅OCR识别，不执行U8录入",
    )

    status_parser = subparsers.add_parser("status", help="显示处理状态")
    init_parser = subparsers.add_parser("init", help="仅初始化U8连接并退出")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    try:
        system = InvoiceAutomationSystem(args.config)

        if args.command == "init":
            system.initialize_u8()
            print("✅ U8系统连接初始化成功")
            return

        if args.command == "status":
            system.show_status()
            return

        if not args.dry_run:
            system.initialize_u8()

        if args.command == "batch":
            stats = system.process_batch(
                invoice_dir=args.directory,
                max_workers=args.workers,
                dry_run=args.dry_run,
                resume=not args.no_resume,
            )
            system.show_status()
            return stats

        if args.command == "single":
            result = system.run_single(args.file, args.dry_run)
            print("\n" + "=" * 60)
            print("单张发票处理结果")
            print("=" * 60)
            print(f"文件: {os.path.basename(result.file_path)}")
            print(f"状态: {'✅ 成功' if result.status == 'completed' else '❌ 失败'}")
            print(f"发票代码: {result.invoice_code or 'N/A'}")
            print(f"发票号码: {result.invoice_number or 'N/A'}")
            print(f"纳税人识别号: {result.tax_id or 'N/A'}")
            print(f"金额: {result.amount or 'N/A'}")
            print(f"开票日期: {result.invoice_date or 'N/A'}")
            print(f"销售方: {result.seller or 'N/A'}")
            print(f"OCR置信度: {result.ocr_confidence:.1f}%")
            print(f"处理耗时: {result.processing_duration:.1f} 秒")
            if result.error_message:
                print(f"错误信息: {result.error_message}")
            print("=" * 60 + "\n")
            return result

    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断，正在安全关闭...")
        if "system" in locals():
            system.cleanup()
        sys.exit(130)

    except Exception as e:
        print(f"\n❌ 系统错误: {str(e)}")
        traceback.print_exc()
        if "system" in locals():
            system.cleanup()
        sys.exit(1)

    finally:
        if "system" in locals():
            system.cleanup()


if __name__ == "__main__":
    main()
