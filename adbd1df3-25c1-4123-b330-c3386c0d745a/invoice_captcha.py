import os
import re
import time
import logging
import numpy as np
from typing import Optional, Tuple, List
from PIL import Image, ImageFilter, ImageEnhance

try:
    import pytesseract
except ImportError:
    pytesseract = None

try:
    import cv2
except ImportError:
    cv2 = None

from retry_handler import RetryConfig, RetryHandler, retry


logger = logging.getLogger(__name__)


class CaptchaError(Exception):
    pass


class CaptchaRecognitionError(CaptchaError):
    pass


class CaptchaManualFallbackRequired(CaptchaError):
    pass


class CaptchaPreprocessor:
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.denoise_strength = self.config.get("denoise_strength", 3)
        self.threshold = self.config.get("threshold", 180)
        self.target_size = self.config.get("target_size", (120, 40))

    def preprocess(self, image: Image.Image) -> Image.Image:
        if cv2 is None:
            return self._preprocess_pil(image)
        return self._preprocess_cv2(image)

    def _preprocess_pil(self, image: Image.Image) -> Image.Image:
        image = image.convert("L")
        if self.target_size:
            image = image.resize(self.target_size, Image.LANCZOS)
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.8)
        image = image.filter(ImageFilter.MedianFilter(size=self.denoise_strength))
        image = image.point(lambda p: p > self.threshold and 255 or 0, mode="1")
        return image

    def _preprocess_cv2(self, image: Image.Image) -> Image.Image:
        img_array = np.array(image.convert("RGB"))
        img_cv2 = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img_cv2, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, self.target_size, interpolation=cv2.INTER_CUBIC)
        gray = cv2.fastNlMeansDenoising(gray, None, self.denoise_strength, 7, 21)
        _, binary = cv2.threshold(gray, self.threshold, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        kernel = np.ones((2, 2), np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)
        coords = cv2.findNonZero(binary)
        if coords is not None:
            x, y, w, h = cv2.boundingRect(coords)
            binary = binary[y:y + h, x:x + w]
            binary = cv2.copyMakeBorder(binary, 5, 5, 5, 5, cv2.BORDER_CONSTANT, value=255)
        result = Image.fromarray(binary)
        return result

    def remove_lines(self, image: Image.Image) -> Image.Image:
        if cv2 is None:
            return image
        img_array = np.array(image.convert("L"))
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
        detected_lines = cv2.morphologyEx(img_array, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
        cnts = cv2.findContours(detected_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = cnts[0] if len(cnts) == 2 else cnts[1]
        for c in cnts:
            cv2.drawContours(img_array, [c], -1, (255, 255, 255), 2)
        detected_lines = cv2.morphologyEx(img_array, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
        cnts = cv2.findContours(detected_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = cnts[0] if len(cnts) == 2 else cnts[1]
        for c in cnts:
            cv2.drawContours(img_array, [c], -1, (255, 255, 255), 2)
        return Image.fromarray(img_array)


class CaptchaRecognizer:
    def __init__(
        self,
        tesseract_cmd: Optional[str] = None,
        language: str = "eng",
        psm: int = 8,
        oem: int = 3,
        config: Optional[dict] = None,
    ):
        if pytesseract is None:
            raise ImportError("pytesseract is required for CaptchaRecognizer")

        self.language = language
        self.psm = psm
        self.oem = oem
        self.config = config or {}
        self.preprocessor = CaptchaPreprocessor(self.config.get("preprocessing", {}))

        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

        self.max_retry = self.config.get("max_retry", 3)
        self.manual_fallback = self.config.get("manual_fallback", True)
        self.min_length = self.config.get("min_length", 4)
        self.max_length = self.config.get("max_length", 6)
        self.allowed_chars = self.config.get("allowed_chars", "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        self.confidence_threshold = self.config.get("confidence_threshold", 70)

    def _get_tesseract_config(self) -> str:
        config = f"--oem {self.oem} --psm {self.psm}"
        config += f' -c tessedit_char_whitelist={self.allowed_chars}'
        return config

    def recognize(self, image: Image.Image, preprocess: bool = True) -> Tuple[str, float]:
        start_time = time.time()
        try:
            if preprocess:
                processed_image = self.preprocessor.preprocess(image)
            else:
                processed_image = image

            config = self._get_tesseract_config()
            result = pytesseract.image_to_data(
                processed_image,
                lang=self.language,
                config=config,
                output_type=pytesseract.Output.DICT,
            )

            text, confidence = self._extract_best_result(result)
            text = self._sanitize_result(text)
            duration = time.time() - start_time

            if self._is_valid_result(text, confidence):
                logger.info(
                    f"Captcha recognized: {text} (confidence: {confidence:.1f}%)",
                    extra={
                        "operation": "captcha_recognition",
                        "status": "success",
                        "duration": duration,
                        "result": text,
                        "confidence": confidence,
                    },
                )
                return text, confidence
            else:
                raise CaptchaRecognitionError(
                    f"Invalid captcha result: '{text}' (confidence: {confidence:.1f}%)"
                )

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Captcha recognition failed: {str(e)}",
                extra={
                    "operation": "captcha_recognition",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise

    def _extract_best_result(self, ocr_result: dict) -> Tuple[str, float]:
        texts = ocr_result.get("text", [])
        confidences = ocr_result.get("conf", [])

        valid_results = []
        for i, (text, conf) in enumerate(zip(texts, confidences)):
            text = text.strip()
            if text and conf != -1:
                valid_results.append((text, float(conf)))

        if not valid_results:
            return "", 0.0

        valid_results.sort(key=lambda x: x[1], reverse=True)
        combined_text = "".join([t for t, _ in valid_results])
        avg_confidence = sum([c for _, c in valid_results]) / len(valid_results)

        return combined_text, avg_confidence

    def _sanitize_result(self, text: str) -> str:
        text = text.strip().upper()
        text = re.sub(r'\s+', '', text)
        translation_table = str.maketrans({
            'O': '0',
            'I': '1',
            'L': '1',
            'Z': '2',
            'S': '5',
            'B': '8',
        })
        text = text.translate(translation_table)
        text = ''.join([c for c in text if c in self.allowed_chars])
        return text

    def _is_valid_result(self, text: str, confidence: float) -> bool:
        if not text:
            return False
        if len(text) < self.min_length or len(text) > self.max_length:
            return False
        if confidence < self.confidence_threshold:
            return False
        if not re.match(f'^[{re.escape(self.allowed_chars)}]+$', text):
            return False
        return True

    @retry(
        max_attempts=3,
        base_delay=1.0,
        backoff_factor=1.5,
        retry_on=["CaptchaRecognitionError"],
        operation_name="captcha_recognition_with_retry",
    )
    def recognize_with_retry(self, image: Image.Image) -> Tuple[str, float]:
        return self.recognize(image)

    def recognize_with_fallback(self, image: Image.Image) -> Tuple[str, float]:
        try:
            return self.recognize_with_retry(image)
        except Exception as e:
            if self.manual_fallback:
                logger.warning(
                    "Automatic captcha recognition failed, requesting manual intervention",
                    extra={
                        "operation": "captcha_manual_fallback",
                        "status": "triggered",
                        "duration": 0.0,
                        "error": str(e),
                    },
                )
                raise CaptchaManualFallbackRequired(
                    "Automatic captcha recognition failed, manual input required"
                ) from e
            raise

    @classmethod
    def from_yaml_config(cls, config: dict) -> "CaptchaRecognizer":
        captcha_config = config.get("captcha", {})
        ocr_config = config.get("ocr", {})
        return cls(
            tesseract_cmd=ocr_config.get("tesseract_cmd"),
            language=captcha_config.get("tesseract_language", "eng"),
            psm=captcha_config.get("psm", 8),
            oem=captcha_config.get("oem", 3),
            config={
                "max_retry": captcha_config.get("max_retry", 3),
                "manual_fallback": captcha_config.get("manual_fallback", True),
                "preprocessing": config.get("image_preprocessing", {}),
            },
        )


class CaptchaSolver:
    def __init__(self, recognizer: CaptchaRecognizer, retry_config: Optional[RetryConfig] = None):
        self.recognizer = recognizer
        self.retry_config = retry_config or RetryConfig(max_attempts=3, base_delay=1.0)

    def solve(self, image: Image.Image) -> str:
        start_time = time.time()
        handler = RetryHandler(self.retry_config, "captcha_solving")

        def try_solve():
            text, confidence = self.recognizer.recognize(image)
            return text

        try:
            result = handler.execute(try_solve)
            duration = time.time() - start_time
            logger.info(
                f"Captcha solved successfully: {result}",
                extra={
                    "operation": "captcha_solve",
                    "status": "success",
                    "duration": duration,
                    "result": result,
                    "attempts": handler.attempts,
                },
            )
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Captcha solving failed after {handler.attempts} attempts",
                extra={
                    "operation": "captcha_solve",
                    "status": "failed",
                    "duration": duration,
                    "attempts": handler.attempts,
                    "error": str(e),
                },
            )
            if self.recognizer.manual_fallback:
                raise CaptchaManualFallbackRequired("Captcha solving failed, manual input required") from e
            raise CaptchaRecognitionError("Captcha solving failed") from e

    def solve_from_file(self, image_path: str) -> str:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Captcha image not found: {image_path}")
        image = Image.open(image_path)
        return self.solve(image)
