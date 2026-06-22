"""
pdf_parser.py
================================================================================
银行电子回单 PDF 解析模块：解析回单 PDF，通过 OCR 提取缴费金额、缴费日期、
银行流水号、收款单位，并自动匹配对应社保费种。

策略：
  1. 优先用 PyPDF2 提取文本层（适用于电子回单）
  2. 文本不足时回退到提取 PDF 内嵌图片，经 OpenCV 预处理后 pytesseract OCR
  3. 使用 config 中正则提取关键字段
  4. 根据关键词匹配社保费种（养老/医疗/失业/工伤/生育）
"""

from __future__ import annotations

import io
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from PIL import Image
from PyPDF2 import PdfReader
from PyPDF2.errors import PdfReadError

logger = logging.getLogger(__name__)

# 社保费种关键词映射
_INSURANCE_KEYWORDS: Dict[str, List[str]] = {
    "养老": ["养老", "养老金", "基本养老"],
    "医疗": ["医疗", "医保", "基本医疗"],
    "失业": ["失业", "失业金"],
    "工伤": ["工伤", "工伤保险"],
    "生育": ["生育", "生育保险"],
}


@dataclass
class ReceiptInfo:
    """单张银行回单解析结果。"""
    file_path: str
    amount: Optional[float] = None
    pay_date: Optional[str] = None  # YYYY-MM-DD
    serial_no: Optional[str] = None
    payee: Optional[str] = None
    insurance_types: List[str] = field(default_factory=list)
    raw_text: str = ""
    ocr_text: str = ""
    confidence: float = 0.0
    warnings: List[str] = field(default_factory=list)
    parse_ok: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "amount": self.amount,
            "pay_date": self.pay_date,
            "serial_no": self.serial_no,
            "payee": self.payee,
            "insurance_types": self.insurance_types,
            "confidence": self.confidence,
            "parse_ok": self.parse_ok,
            "warnings": self.warnings,
        }


class PdfParser:
    """银行回单 PDF 解析器。"""

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config
        ocr_cfg: Dict[str, Any] = config.get("ocr", {})
        self.tesseract_cmd = ocr_cfg.get("tesseract_cmd", "")
        self.language = ocr_cfg.get("language", "chi_sim+eng")
        self.psm = str(ocr_cfg.get("psm", 6))
        self.oem = str(ocr_cfg.get("oem", 3))
        self.dpi = int(ocr_cfg.get("dpi", 300))
        self.binary_threshold = int(ocr_cfg.get("binary_threshold", 180))
        self.amount_pattern = ocr_cfg.get(
            "amount_pattern", r'(?:大写|金额)[:：]?\s*([0-9,]+\.\d{2})')
        self.date_pattern = ocr_cfg.get(
            "date_pattern", r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)')
        self.serial_pattern = ocr_cfg.get(
            "serial_pattern", r'([A-Z0-9]{6,32})')
        self._tesseract_ready = False

    # ---------------------------- 公共入口 ----------------------------

    def parse_receipt(self, file_path: str) -> ReceiptInfo:
        """解析单张银行回单 PDF。"""
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"PDF 文件不存在：{file_path}")
        info = ReceiptInfo(file_path=file_path)

        # 1. 文本层提取
        text = self._extract_text(file_path)
        info.raw_text = text
        # 2. 若文本不足，回退 OCR
        if len(re.sub(r"\s", "", text)) < 30:
            ocr_text = self._ocr_pdf(file_path)
            info.ocr_text = ocr_text
            combined = (text + "\n" + ocr_text).strip()
        else:
            combined = text
        if not combined:
            info.warnings.append("未能提取任何文本（可能为扫描件且无内嵌图片）")
            return info
        # 3. 字段提取
        self._extract_fields(info, combined)
        # 4. 费种匹配
        info.insurance_types = self._match_insurance_types(combined)
        # 5. 完整性判定
        info.parse_ok = all([info.amount is not None, info.pay_date,
                              info.serial_no, info.payee])
        info.confidence = self._estimate_confidence(info)
        logger.info("回单解析 %s：金额=%s 日期=%s 流水=%s 费种=%s 置信=%.2f",
                    os.path.basename(file_path), info.amount, info.pay_date,
                    info.serial_no, info.insurance_types, info.confidence)
        return info

    def parse_receipts(self, file_paths: List[str]) -> List[ReceiptInfo]:
        """批量解析多张回单。"""
        results: List[ReceiptInfo] = []
        for fp in file_paths:
            try:
                results.append(self.parse_receipt(fp))
            except Exception as exc:  # noqa: BLE001
                logger.error("解析回单失败 %s: %s", fp, exc)
                results.append(ReceiptInfo(file_path=fp,
                                           parse_ok=False,
                                           warnings=[f"解析异常: {exc}"]))
        return results

    # ---------------------------- 文本层提取 ----------------------------

    def _extract_text(self, file_path: str) -> str:
        """使用 PyPDF2 提取全部页面文本。"""
        try:
            reader = PdfReader(file_path)
        except PdfReadError as exc:
            logger.warning("PDF 读取失败 %s: %s", file_path, exc)
            return ""
        chunks: List[str] = []
        for idx, page in enumerate(reader.pages):
            try:
                txt = page.extract_text() or ""
            except Exception as exc:  # noqa: BLE001
                logger.debug("第 %d 页文本提取失败: %s", idx + 1, exc)
                txt = ""
            chunks.append(txt)
        return "\n".join(chunks)

    # ---------------------------- OCR 回退 ----------------------------

    def _ocr_pdf(self, file_path: str) -> str:
        """提取 PDF 内嵌图片并 OCR。无可用图片或 OCR 不可用时返回空串。"""
        if not self._init_tesseract():
            return ""
        images = self._extract_images(file_path)
        if not images:
            return ""
        ocr_chunks: List[str] = []
        for img in images:
            processed = self._preprocess_image(img)
            try:
                import pytesseract
                text = pytesseract.image_to_string(
                    processed, lang=self.language,
                    config=f"--psm {self.psm} --oem {self.oem}")
                ocr_chunks.append(text)
            except Exception as exc:  # noqa: BLE001
                logger.debug("OCR 单页失败: %s", exc)
        return "\n".join(ocr_chunks)

    def _init_tesseract(self) -> bool:
        """初始化 tesseract，返回是否可用。"""
        if self._tesseract_ready:
            return True
        try:
            import pytesseract  # noqa: F401
            if self.tesseract_cmd:
                import pytesseract as _pt
                _pt.pytesseract.tesseract_cmd = self.tesseract_cmd
            # 探测可用性
            import pytesseract as _pt
            _pt.get_tesseract_version()
            self._tesseract_ready = True
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("tesseract 不可用，跳过 OCR: %s", exc)
            return False

    def _extract_images(self, file_path: str) -> List[Image.Image]:
        """从 PDF 提取内嵌图片（XObject）为 PIL Image。"""
        images: List[Image.Image] = []
        try:
            reader = PdfReader(file_path)
        except PdfReadError:
            return images
        for page in reader.pages:
            try:
                # PyPDF2 3.x: page.images 返回 ImageFile 列表
                if hasattr(page, "images"):
                    for img_file in page.images:
                        try:
                            data = img_file.data
                            img = Image.open(io.BytesIO(data))
                            if img.mode not in ("L", "RGB"):
                                img = img.convert("L")
                            images.append(img)
                        except Exception as exc:  # noqa: BLE001
                            logger.debug("图片解码失败: %s", exc)
            except Exception as exc:  # noqa: BLE001
                logger.debug("页面图片提取失败: %s", exc)
        logger.debug("从 %s 提取到 %d 张内嵌图片", file_path, len(images))
        return images

    def _preprocess_image(self, img: Image.Image) -> Image.Image:
        """OpenCV 预处理：灰度→放大→二值化→降噪，提升 OCR 识别率。"""
        try:
            import cv2
            import numpy as np
        except ImportError:
            logger.debug("OpenCV 未安装，使用原图进行 OCR")
            return img
        arr = np.array(img.convert("L"))
        h, w = arr.shape[:2]
        # 放大小字体
        scale = max(1.0, self.dpi / 150.0)
        if scale > 1.0:
            arr = cv2.resize(arr, (int(w * scale), int(h * scale)),
                            interpolation=cv2.INTER_CUBIC)
        # 自适应阈值二值化（对回单这种光照不均的扫描件更稳健）
        arr = cv2.adaptiveThreshold(
            arr, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 31, self.binary_threshold)
        # 降噪
        arr = cv2.medianBlur(arr, 3)
        return Image.fromarray(arr)

    # ---------------------------- 字段提取 ----------------------------

    def _extract_fields(self, info: ReceiptInfo, text: str) -> None:
        """从文本中提取金额、日期、流水号、收款单位。"""
        info.amount = self._extract_amount(text)
        info.pay_date = self._extract_date(text)
        info.serial_no = self._extract_serial(text, info.pay_date)
        info.payee = self._extract_payee(text)

    def _extract_amount(self, text: str) -> Optional[float]:
        matches = re.findall(self.amount_pattern, text)
        for raw in matches:
            cleaned = raw.replace(",", "")
            try:
                return float(cleaned)
            except ValueError:
                continue
        # 兜底：查找所有“数字+.2位小数”取最大值（回单金额通常最大）
        all_amounts = re.findall(r'(\d{1,3}(?:,\d{3})*\.\d{2})', text)
        if not all_amounts:
            all_amounts = re.findall(r'(\d+\.\d{2})', text)
        for raw in all_amounts:
            try:
                return float(raw.replace(",", ""))
            except ValueError:
                continue
        return None

    def _extract_date(self, text: str) -> Optional[str]:
        matches = re.findall(self.date_pattern, text)
        for raw in matches:
            normalized = self._normalize_date(raw)
            if normalized:
                return normalized
        return None

    def _extract_serial(self, text: str, pay_date: Optional[str]) -> Optional[str]:
        """提取流水号，排除日期串。"""
        candidates = re.findall(self.serial_pattern, text)
        date_digits = re.sub(r"\D", "", pay_date or "")
        for c in candidates:
            if c == date_digits:
                continue
            # 排除纯日期数字串
            if c.isdigit() and len(c) == 8:
                continue
            return c
        return None

    def _extract_payee(self, text: str) -> Optional[str]:
        """提取收款单位，匹配“收款单位/收款人/收款方”后跟随的字符串。"""
        patterns = [
            r'收款单位[:：\s]*([^\n]+?)[\s\r\n]',
            r'收款人[:：\s]*([^\n]+?)[\s\r\n]',
            r'收款方[:：\s]*([^\n]+?)[\s\r\n]',
            r'户名[:：\s]*([^\n]+?)[\s\r\n]',
        ]
        # 宽松模式（取到行尾）
        lazy_patterns = [
            r'收款单位[:：\s]*(.+)',
            r'收款人[:：\s]*(.+)',
            r'收款方[:：\s]*(.+)',
            r'户名[:：\s]*(.+)',
        ]
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                return m.group(1).strip()
        for pat in lazy_patterns:
            m = re.search(pat, text)
            if m:
                return m.group(1).strip()
        return None

    @staticmethod
    def _normalize_date(text: str) -> Optional[str]:
        text = text.strip()
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y年%m月%d日", "%Y%m%d"):
            try:
                return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        # 提取数字
        nums = re.findall(r"\d+", text)
        if len(nums) >= 3:
            try:
                y, mo, d = int(nums[0]), int(nums[1]), int(nums[2])
                if 1900 <= y <= 2100 and 1 <= mo <= 12 and 1 <= d <= 31:
                    return f"{y:04d}-{mo:02d}-{d:02d}"
            except (ValueError, IndexError):
                pass
        return None

    def _match_insurance_types(self, text: str) -> List[str]:
        """根据关键词匹配社保费种。"""
        matched: List[str] = []
        for ins_type, keywords in _INSURANCE_KEYWORDS.items():
            if any(kw in text for kw in keywords):
                if ins_type not in matched:
                    matched.append(ins_type)
        return matched

    @staticmethod
    def _estimate_confidence(info: ReceiptInfo) -> float:
        """根据已提取字段数估算置信度。"""
        score = 0.0
        if info.amount is not None:
            score += 0.3
        if info.pay_date:
            score += 0.25
        if info.serial_no:
            score += 0.2
        if info.payee:
            score += 0.15
        if info.insurance_types:
            score += 0.1
        return round(min(score, 1.0), 2)
