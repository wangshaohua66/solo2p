import os
import re
import time
import logging
from typing import Optional, Tuple, Dict, Any, List
from dataclasses import dataclass

import cv2
import numpy as np

try:
    import pytesseract
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

from .screen_capture import ScreenCapture
from .template_matcher import MatchResult

logger = logging.getLogger(__name__)

CONTAINER_PATTERN = re.compile(r'^[A-Z]{4}\d{7}$')


@dataclass
class OcrResult:
    raw_text: str
    container_number: str
    is_valid: bool
    confidence: float
    check_digit_valid: bool
    corrected_from: Optional[str] = None
    processing_time_ms: float = 0.0


class TextExtractor:
    def __init__(self, config: Dict[str, Any], screen_capture: ScreenCapture):
        self.config = config
        self.screen_capture = screen_capture
        self.ocr_cfg = config.get("ocr", {})
        self.check_digit_cfg = config.get("container_check_digit", {})
        self._char_values: Dict[str, int] = {}
        self._init_tesseract()
        self._init_check_digit_table()

    def _init_tesseract(self) -> None:
        if not HAS_TESSERACT:
            logger.warning("pytesseract 未安装，OCR 功能不可用")
            return

        tesseract_cmd = self.ocr_cfg.get("tesseract_cmd", "")
        if tesseract_cmd and os.path.exists(tesseract_cmd):
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
            logger.debug(f"Tesseract 命令路径: {tesseract_cmd}")

        try:
            version = pytesseract.get_tesseract_version()
            logger.info(f"Tesseract 版本: {version}")
        except Exception as e:
            logger.warning(f"无法获取 Tesseract 版本: {e}")

    def _init_check_digit_table(self) -> None:
        default_values = {
            'A': 10, 'B': 12, 'C': 13, 'D': 14, 'E': 15, 'F': 16, 'G': 17, 'H': 18,
            'I': 19, 'J': 20, 'K': 21, 'L': 23, 'M': 24, 'N': 25, 'O': 26, 'P': 27,
            'Q': 28, 'R': 29, 'S': 30, 'T': 31, 'U': 32, 'V': 34, 'W': 35, 'X': 36,
            'Y': 37, 'Z': 38,
        }
        cfg_values = self.check_digit_cfg.get("character_values", {})
        self._char_values = cfg_values if cfg_values else default_values
        for ch in "0123456789":
            self._char_values[ch] = int(ch)

    def calculate_check_digit(self, first_10_chars: str) -> Optional[int]:
        if len(first_10_chars) != 10:
            return None

        total = 0
        for i, ch in enumerate(first_10_chars.upper()):
            val = self._char_values.get(ch)
            if val is None:
                return None
            total += val * (2 ** i)

        check = total % 11
        if check == 10:
            check = 0
        return check

    def validate_container_number(self, container_no: str) -> Tuple[bool, bool, Optional[int]]:
        if not container_no or len(container_no) != 11:
            return False, False, None

        formatted = container_no.upper().strip()
        pattern_match = bool(CONTAINER_PATTERN.match(formatted))

        first_10 = formatted[:10]
        actual_check = int(formatted[10]) if formatted[10].isdigit() else -1
        expected_check = self.calculate_check_digit(first_10)

        check_valid = expected_check is not None and actual_check == expected_check

        return pattern_match, check_valid, expected_check

    def _ocr_similar_chars(self) -> Dict[str, List[str]]:
        return {
            '0': ['O', 'Q', 'D'],
            '1': ['I', 'L', 'T'],
            '2': ['Z', '7'],
            '3': ['8', '5'],
            '4': ['A', '9'],
            '5': ['S', '3', '8'],
            '6': ['G', '8'],
            '7': ['2', 'Z', 'T'],
            '8': ['B', '3', '5', '6'],
            '9': ['4', 'A', 'G', 'P'],
            'A': ['4', '8', '9', 'R'],
            'B': ['8', '3', 'R'],
            'D': ['0', 'O', 'Q'],
            'G': ['6', '9', 'C'],
            'I': ['1', 'L', 'T'],
            'L': ['1', 'I', 'T'],
            'O': ['0', 'D', 'Q'],
            'P': ['9', 'R'],
            'Q': ['0', 'D', 'O'],
            'R': ['A', 'B', 'P'],
            'S': ['5', '3'],
            'T': ['1', '7', 'I', 'L'],
            'Z': ['2', '7'],
        }

    def autocorrect_container_number(self, raw: str) -> Tuple[str, bool]:
        if not raw:
            return raw, False

        cleaned = re.sub(r'[^A-Za-z0-9]', '', raw.upper())
        if len(cleaned) < 4:
            return cleaned, False

        if len(cleaned) == 11:
            pattern_ok, check_ok, _ = self.validate_container_number(cleaned)
            if pattern_ok and check_ok:
                return cleaned, False

        similar = self._ocr_similar_chars()

        prefix = list(cleaned[:4])
        for i in range(4):
            if prefix[i].isdigit():
                ch = prefix[i]
                alternatives = similar.get(ch, [ch])
                for alt in alternatives:
                    if alt.isalpha():
                        prefix[i] = alt
                        break

        suffix = list(cleaned[4:])
        for i in range(len(suffix)):
            if suffix[i].isalpha():
                ch = suffix[i]
                alternatives = similar.get(ch, [ch])
                for alt in alternatives:
                    if alt.isdigit():
                        suffix[i] = alt
                        break

        candidate = (''.join(prefix) + ''.join(suffix))[:11]

        if len(candidate) == 10:
            expected = self.calculate_check_digit(candidate)
            if expected is not None:
                candidate = candidate + str(expected)

        if len(candidate) == 11:
            pattern_ok, check_ok, expected = self.validate_container_number(candidate)
            if pattern_ok and not check_ok and expected is not None:
                chars = list(candidate)
                chars[10] = str(expected)
                candidate = ''.join(chars)
                check_ok = True

            return candidate, (candidate != cleaned)

        return candidate, (candidate != cleaned)

    def extract_text_from_image(self, image: np.ndarray,
                                with_details: bool = False) -> OcrResult:
        if not HAS_TESSERACT:
            return OcrResult("", "", False, 0.0, False)

        start_time = time.time()

        if image is None or image.size == 0:
            return OcrResult("", "", False, 0.0, False,
                             processing_time_ms=(time.time() - start_time) * 1000)

        pp_cfg = self.ocr_cfg.get("preprocess", {})
        processed = ScreenCapture.preprocess_ocr(
            image,
            threshold=pp_cfg.get("binary_threshold", 180),
            blur_kernel=pp_cfg.get("gaussian_blur_kernel", 3),
            denoise=pp_cfg.get("denoise_strength", 10)
        )

        if processed is None:
            return OcrResult("", "", False, 0.0, False,
                             processing_time_ms=(time.time() - start_time) * 1000)

        psm = self.ocr_cfg.get("psm_mode", 7)
        lang = self.ocr_cfg.get("lang", "eng")
        min_conf = self.ocr_cfg.get("min_confidence", 70)

        config = f'--psm {psm} -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

        raw_text = ""
        avg_confidence = 0.0

        variants = [processed]
        if len(processed.shape) == 2:
            h, w = processed.shape[:2]
            if h < 80:
                scale = 3
                variants.append(cv2.resize(processed, (w * scale, h * scale), interpolation=cv2.INTER_CUBIC))
            inverted = cv2.bitwise_not(processed)
            variants.append(inverted)

        for variant in variants:
            try:
                data = pytesseract.image_to_data(
                    variant, lang=lang, config=config,
                    output_type=pytesseract.Output.DICT
                )
                texts = []
                confidences = []
                for i, text in enumerate(data.get("text", [])):
                    t = text.strip()
                    if t:
                        conf = float(data.get("conf", [0])[i])
                        if conf > 0:
                            texts.append(t)
                            confidences.append(conf)
                if texts:
                    raw_text = "".join(texts)
                    avg_confidence = sum(confidences) / max(len(confidences), 1)
                    if avg_confidence >= min_conf:
                        break
            except Exception as e:
                logger.debug(f"OCR 变体识别失败: {e}")
                continue

        if not raw_text:
            try:
                raw_text = pytesseract.image_to_string(
                    processed, lang=lang, config=config
                ).strip()
                avg_confidence = float(min_conf) if raw_text else 0.0
            except Exception as e:
                logger.error(f"OCR 基础识别失败: {e}")
                raw_text = ""

        corrected, was_corrected = self.autocorrect_container_number(raw_text)
        pattern_ok, check_valid, _ = self.validate_container_number(corrected)
        is_valid = pattern_ok and check_valid

        elapsed_ms = (time.time() - start_time) * 1000

        result = OcrResult(
            raw_text=raw_text,
            container_number=corrected,
            is_valid=is_valid,
            confidence=avg_confidence,
            check_digit_valid=check_valid,
            corrected_from=raw_text if was_corrected else None,
            processing_time_ms=elapsed_ms
        )

        if was_corrected:
            logger.info(f"箱号自动纠错: {raw_text} -> {corrected}")
        if is_valid:
            logger.debug(f"OCR 成功: {corrected} 置信度={avg_confidence:.1f} 耗时={elapsed_ms:.1f}ms")
        else:
            logger.warning(f"OCR 结果无效: raw='{raw_text}' corrected='{corrected}'")

        return result

    def extract_container_number(self, container: MatchResult,
                                 system_name: str = "yard",
                                 frame: Optional[np.ndarray] = None) -> OcrResult:
        if frame is None:
            self.screen_capture.activate_window(system_name)
            time.sleep(0.2)

        crop_region_dict = {
            "x": container.x + 5,
            "y": container.y + 5,
            "width": container.width - 10,
            "height": max(20, container.height // 3),
        }

        if frame is not None:
            num_img = ScreenCapture.crop_region(
                frame,
                crop_region_dict["x"], crop_region_dict["y"],
                crop_region_dict["width"], crop_region_dict["height"]
            )
        else:
            abs_region = self.screen_capture.get_system_absolute_region(system_name, crop_region_dict)
            num_img = self.screen_capture.capture_region(abs_region)

        if num_img is None:
            logger.error("获取箱号区域图像失败")
            return OcrResult("", "", False, 0.0, False)

        self.screen_capture.save_screenshot(num_img, prefix="num_region", subdir="ocr_debug")

        return self.extract_text_from_image(num_img)

    def read_field_value(self, region: Dict[str, int], system_name: str,
                         field_type: str = "text") -> str:
        abs_region = self.screen_capture.get_system_absolute_region(system_name, region)
        frame = self.screen_capture.capture_region(abs_region)
        if frame is None:
            return ""

        if field_type == "date":
            processed = ScreenCapture.preprocess_ocr(frame, threshold=150, blur_kernel=1, denoise=5)
        else:
            processed = frame

        if not HAS_TESSERACT:
            return ""

        try:
            config = f'--psm 7'
            text = pytesseract.image_to_string(processed, lang='eng+chi_sim', config=config)
            return text.strip()
        except Exception as e:
            logger.error(f"回读字段失败: {e}")
            return ""
