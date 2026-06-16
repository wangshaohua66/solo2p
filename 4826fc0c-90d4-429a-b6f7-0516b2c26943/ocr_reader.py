import os
import re
import time
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
import pytesseract
from PIL import Image
from loguru import logger


@dataclass
class OCRResult:
    element: str
    value: Optional[float]
    confidence: float
    raw_text: str
    needs_review: bool = False


@dataclass
class OCRBatchResult:
    sample_id: str
    instrument_id: str
    results: List[OCRResult] = field(default_factory=list)
    success: bool = False
    error_message: str = ""
    preprocessed_image_path: str = ""


class OCRReader:
    def __init__(self, ocr_config: Dict[str, Any], global_config: Dict[str, Any]):
        self.config = ocr_config
        self.global_config = global_config
        self._confidence_threshold = global_config.get("ocr_confidence_threshold", 0.90)
        self._audit_dir = Path(global_config.get("audit_log_dir", "audit_logs"))
        self._audit_dir.mkdir(parents=True, exist_ok=True)
        self._max_retry = global_config.get("max_retry_count", 3)
        self._backoff_base = global_config.get("retry_backoff_base", 2.0)

        tesseract_cmd = ocr_config.get("tesseract_cmd", "")
        if tesseract_cmd and os.path.exists(tesseract_cmd):
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

        self._digit_templates: Dict[str, np.ndarray] = {}
        self._load_digit_templates()

    def _load_digit_templates(self) -> None:
        templates_dir = Path(self.config.get("digit_templates_dir", "templates/digits"))
        try:
            if not templates_dir.exists():
                templates_dir.mkdir(parents=True, exist_ok=True)
                logger.info(f"数字模板目录不存在，已创建: {templates_dir}，数字模板校正功能将跳过")
                return

            png_files = list(templates_dir.glob("*.png"))
            if not png_files:
                logger.warning(f"数字模板目录为空: {templates_dir}，数字模板二次校正功能已禁用")
                return

            loaded_count = 0
            for f in png_files:
                try:
                    digit = f.stem
                    img = cv2.imread(str(f), cv2.IMREAD_GRAYSCALE)
                    if img is not None:
                        self._digit_templates[digit] = img
                        loaded_count += 1
                except Exception as e:
                    logger.warning(f"加载数字模板 {f.name} 失败: {e}")

            if loaded_count == 0:
                logger.warning("未成功加载任何数字模板，数字模板二次校正功能将跳过")
            else:
                logger.info(f"已加载 {loaded_count} 个数字模板")
        except Exception as e:
            logger.warning(f"数字模板加载过程异常，已优雅降级: {e}")

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        pp_cfg = self.config.get("preprocessing", {})
        scale = pp_cfg.get("scale_factor", 2.0)
        denoise_kernel = pp_cfg.get("denoise_kernel", 3)
        morph_kernel_size = pp_cfg.get("morph_kernel", [2, 2])

        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        if scale != 1.0:
            h, w = gray.shape
            gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

        if denoise_kernel > 0:
            gray = cv2.GaussianBlur(gray, (denoise_kernel, denoise_kernel), 0)

        method = pp_cfg.get("threshold_method", "adaptive")
        if method == "adaptive":
            block_size = pp_cfg.get("adaptive_block_size", 11)
            c = pp_cfg.get("adaptive_c", 2)
            binary = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY_INV, block_size, c
            )
        elif method == "otsu":
            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        else:
            _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, tuple(morph_kernel_size))
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

        return binary

    def _extract_data_with_confidence(self, image: np.ndarray, config: str = "") -> Tuple[str, float]:
        try:
            data = pytesseract.image_to_data(
                image,
                lang=self.config.get("tesseract_lang", "eng"),
                config=config or self.config.get("custom_config", "--psm 6"),
                output_type=pytesseract.Output.DICT
            )

            texts = []
            confidences = []
            for i, text in enumerate(data.get("text", [])):
                if text.strip():
                    conf = float(data.get("conf", [0])[i])
                    if conf > 0:
                        texts.append(text.strip())
                        confidences.append(conf)

            if not texts:
                return "", 0.0

            joined = " ".join(texts)
            avg_conf = sum(confidences) / len(confidences) / 100.0
            return joined, avg_conf
        except Exception as e:
            logger.warning(f"OCR 详细数据提取失败: {e}")
            try:
                text = pytesseract.image_to_string(
                    image,
                    lang=self.config.get("tesseract_lang", "eng"),
                    config=config or self.config.get("custom_config", "--psm 6")
                ).strip()
                return text, 0.5 if text else 0.0
            except Exception as e2:
                logger.error(f"OCR 基础识别失败: {e2}")
                return "", 0.0

    def _template_match_digit(self, char_img: np.ndarray) -> Tuple[str, float]:
        if not self._digit_templates:
            return "", 0.0

        char_gray = char_img if len(char_img.shape) == 2 else cv2.cvtColor(char_img, cv2.COLOR_BGR2GRAY)
        _, char_bin = cv2.threshold(char_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        best_digit = ""
        best_score = 0.0

        for digit, template in self._digit_templates.items():
            try:
                th, tw = template.shape
                ch, cw = char_bin.shape
                if ch < th or cw < tw:
                    continue

                result = cv2.matchTemplate(char_bin, template, cv2.TM_CCOEFF_NORMED)
                _, max_val, _, _ = cv2.minMaxLoc(result)
                if max_val > best_score:
                    best_score = max_val
                    best_digit = digit
            except Exception:
                continue

        return best_digit, best_score

    def _digit_template_correction(self, text: str, confidence: float, image: np.ndarray) -> Tuple[str, float]:
        if confidence >= self._confidence_threshold:
            return text, confidence

        if not self._digit_templates:
            return text, confidence

        corrected_chars = []
        total_score = 0.0
        count = 0

        try:
            contours, _ = cv2.findContours(image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            contours = sorted(contours, key=lambda c: cv2.boundingRect(c)[0])

            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                if w < 5 or h < 10:
                    continue
                char_roi = image[y:y+h, x:x+w]
                digit, score = self._template_match_digit(char_roi)
                if digit and score >= 0.6:
                    corrected_chars.append(digit)
                    total_score += score
                    count += 1
        except Exception as e:
            logger.debug(f"数字模板校正异常: {e}")

        if corrected_chars and count > 0:
            corrected = "".join(corrected_chars)
            if re.match(r'^-?\d*\.?\d+%?$', corrected):
                avg_score = total_score / count
                if avg_score > confidence:
                    return corrected, avg_score

        return text, confidence

    def _parse_value(self, raw_text: str) -> Optional[float]:
        if not raw_text:
            return None
        cleaned = raw_text.replace(",", ".").replace(" ", "").strip()
        cleaned = cleaned.rstrip("%")
        match = re.search(r'-?\d+\.?\d*', cleaned)
        if match:
            try:
                return float(match.group())
            except ValueError:
                return None
        return None

    def _parse_table_layout(self, image: np.ndarray, result_cfg: Dict[str, Any],
                           elements: List[Dict[str, str]]) -> List[OCRResult]:
        results: List[OCRResult] = []
        columns = result_cfg.get("columns", [])
        h, w = image.shape[:2]

        symbol_col = next((c for c in columns if c["name"] == "symbol"), None)
        value_col = next((c for c in columns if c["name"] == "value"), None)
        if not symbol_col or not value_col:
            return results

        row_height = h // max(len(elements), 1)

        for idx, elem_cfg in enumerate(elements):
            elem_symbol = elem_cfg["symbol"]
            y_start = idx * row_height
            y_end = (idx + 1) * row_height if idx < len(elements) - 1 else h

            sym_roi = image[y_start:y_end, symbol_col["x_offset"]:symbol_col["x_offset"] + symbol_col["width"]]
            val_roi = image[y_start:y_end, value_col["x_offset"]:value_col["x_offset"] + value_col["width"]]

            sym_text, sym_conf = self._extract_data_with_confidence(sym_roi, "--psm 7")
            val_text, val_conf = self._extract_data_with_confidence(val_roi)

            val_text, val_conf = self._digit_template_correction(val_text, val_conf, self.preprocess_image(val_roi))

            parsed_value = self._parse_value(val_text)
            results.append(OCRResult(
                element=elem_symbol,
                value=parsed_value,
                confidence=val_conf,
                raw_text=val_text,
                needs_review=(val_conf < self._confidence_threshold or parsed_value is None)
            ))

        return results

    def _parse_grid_layout(self, image: np.ndarray, result_cfg: Dict[str, Any],
                          elements: List[Dict[str, str]]) -> List[OCRResult]:
        results: List[OCRResult] = []
        cell_w = result_cfg.get("cell_width", 150)
        cell_h = result_cfg.get("cell_height", 35)
        cols = result_cfg.get("columns_count", 3)

        for idx, elem_cfg in enumerate(elements):
            row = idx // cols
            col = idx % cols
            x_start = col * cell_w
            x_end = x_start + cell_w
            y_start = row * cell_h
            y_end = y_start + cell_h

            cell = image[y_start:y_end, x_start:x_end]
            if cell.size == 0:
                results.append(OCRResult(
                    element=elem_cfg["symbol"], value=None, confidence=0.0,
                    raw_text="", needs_review=True
                ))
                continue

            mid = cell_w // 2
            sym_cell = cell[:, :mid]
            val_cell = cell[:, mid:]

            sym_text, _ = self._extract_data_with_confidence(sym_cell, "--psm 7")
            val_text, val_conf = self._extract_data_with_confidence(val_cell)
            val_text, val_conf = self._digit_template_correction(val_text, val_conf, self.preprocess_image(val_cell))

            parsed_value = self._parse_value(val_text)
            results.append(OCRResult(
                element=elem_cfg["symbol"],
                value=parsed_value,
                confidence=val_conf,
                raw_text=val_text,
                needs_review=(val_conf < self._confidence_threshold or parsed_value is None)
            ))

        return results

    def _parse_list_layout(self, image: np.ndarray, result_cfg: Dict[str, Any],
                          elements: List[Dict[str, str]]) -> List[OCRResult]:
        results: List[OCRResult] = []
        row_h = result_cfg.get("row_height", 28)
        h, w = image.shape[:2]
        mid = w // 2

        for idx, elem_cfg in enumerate(elements):
            y_start = idx * row_h
            y_end = y_start + row_h if idx < len(elements) - 1 else h

            sym_cell = image[y_start:y_end, :mid]
            val_cell = image[y_start:y_end, mid:]

            if sym_cell.size == 0 or val_cell.size == 0:
                results.append(OCRResult(
                    element=elem_cfg["symbol"], value=None, confidence=0.0,
                    raw_text="", needs_review=True
                ))
                continue

            sym_text, _ = self._extract_data_with_confidence(sym_cell, "--psm 7")
            val_text, val_conf = self._extract_data_with_confidence(val_cell)
            val_text, val_conf = self._digit_template_correction(val_text, val_conf, self.preprocess_image(val_cell))

            parsed_value = self._parse_value(val_text)
            results.append(OCRResult(
                element=elem_cfg["symbol"],
                value=parsed_value,
                confidence=val_conf,
                raw_text=val_text,
                needs_review=(val_conf < self._confidence_threshold or parsed_value is None)
            ))

        return results

    def _parse_dual_layout(self, image: np.ndarray, result_cfg: Dict[str, Any],
                          elements: List[Dict[str, str]]) -> List[OCRResult]:
        results: List[OCRResult] = []
        carbon_roi = result_cfg.get("carbon_roi", [])
        sulfur_roi = result_cfg.get("sulfur_roi", [])

        element_rois = {
            "C": carbon_roi,
            "S": sulfur_roi,
        }

        for elem_cfg in elements:
            symbol = elem_cfg["symbol"]
            roi = element_rois.get(symbol)
            if not roi or len(roi) < 4:
                results.append(OCRResult(
                    element=symbol, value=None, confidence=0.0,
                    raw_text="", needs_review=True
                ))
                continue

            x, y, w, h = roi
            h_full, w_full = image.shape[:2]
            x = max(0, min(x, w_full - 1))
            y = max(0, min(y, h_full - 1))
            w = min(w, w_full - x)
            h = min(h, h_full - y)

            cell = image[y:y+h, x:x+w]
            if cell.size == 0:
                results.append(OCRResult(
                    element=symbol, value=None, confidence=0.0,
                    raw_text="", needs_review=True
                ))
                continue

            val_text, val_conf = self._extract_data_with_confidence(cell)
            val_text, val_conf = self._digit_template_correction(val_text, val_conf, self.preprocess_image(cell))

            parsed_value = self._parse_value(val_text)
            results.append(OCRResult(
                element=symbol,
                value=parsed_value,
                confidence=val_conf,
                raw_text=val_text,
                needs_review=(val_conf < self._confidence_threshold or parsed_value is None)
            ))

        return results

    def recognize(self, image: np.ndarray, instrument_id: str, sample_id: str,
                  instrument_config: Dict[str, Any]) -> OCRBatchResult:
        batch = OCRBatchResult(
            sample_id=sample_id,
            instrument_id=instrument_id
        )

        for attempt in range(self._max_retry):
            try:
                result_cfg = instrument_config.get("result_region", {})
                elements = instrument_config.get("elements", [])
                layout = result_cfg.get("elements_layout", "table")

                preprocessed = self.preprocess_image(image)

                timestamp = time.strftime("%Y%m%d_%H%M%S")
                pp_filename = f"ocr_pp_{instrument_id}_{sample_id}_{timestamp}.png"
                pp_path = self._audit_dir / pp_filename
                cv2.imwrite(str(pp_path), preprocessed)
                batch.preprocessed_image_path = str(pp_path)

                if layout == "table":
                    ocr_results = self._parse_table_layout(preprocessed, result_cfg, elements)
                elif layout == "grid":
                    ocr_results = self._parse_grid_layout(preprocessed, result_cfg, elements)
                elif layout == "list":
                    ocr_results = self._parse_list_layout(preprocessed, result_cfg, elements)
                elif layout == "dual":
                    ocr_results = self._parse_dual_layout(preprocessed, result_cfg, elements)
                else:
                    batch.error_message = f"未知布局类型: {layout}"
                    ocr_results = []

                batch.results = ocr_results
                batch.success = len(ocr_results) > 0 and all(
                    not r.needs_review for r in ocr_results if r.value is not None
                )

                review_count = sum(1 for r in ocr_results if r.needs_review)
                if batch.success:
                    logger.success(f"[{instrument_id}] 样品 {sample_id} OCR 识别成功, {len(ocr_results)} 项元素")
                else:
                    logger.warning(
                        f"[{instrument_id}] 样品 {sample_id} OCR 需人工复核: {review_count}/{len(ocr_results)} 项"
                    )

                return batch

            except Exception as e:
                logger.warning(f"[{instrument_id}] OCR 识别第{attempt+1}次尝试失败: {e}")
                batch.error_message = str(e)
                wait_time = (self._backoff_base ** attempt)
                time.sleep(wait_time)

        logger.error(f"[{instrument_id}] 样品 {sample_id} OCR 识别最终失败")
        batch.success = False
        return batch
