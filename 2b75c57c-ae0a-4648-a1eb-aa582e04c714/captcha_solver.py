import base64
import io
import time
from dataclasses import dataclass
from typing import Optional, Tuple

import requests
from PIL import Image

from config import load_config, AppConfig
from logger import get_logger
from notifier import Notifier


logger = get_logger("captcha")

try:
    import ddddocr
    _HAS_DDDDOCR = True
except ImportError:
    _HAS_DDDDOCR = False

try:
    import pytesseract
    _HAS_PYTESSERACT = True
except ImportError:
    _HAS_PYTESSERACT = False


@dataclass
class CaptchaConfig:
    use_ddddocr: bool = True
    use_tesseract: bool = False
    use_api: bool = False
    api_url: str = ""
    api_key: str = ""
    api_type: str = ""
    max_retries: int = 3
    confidence_threshold: float = 0.5


class CaptchaSolver:
    def __init__(self, config: Optional[AppConfig] = None):
        self.config = config or load_config()
        self.captcha_cfg = self._load_captcha_config()
        self._ocr = None
        self._notifier = None
        self.fail_count = 0
        self.total_count = 0

    def _load_captcha_config(self) -> CaptchaConfig:
        cfg = CaptchaConfig()
        captcha_section = getattr(self.config, "captcha", None)
        if captcha_section:
            cfg.use_ddddocr = getattr(captcha_section, "use_ddddocr", True)
            cfg.use_tesseract = getattr(captcha_section, "use_tesseract", False)
            cfg.use_api = getattr(captcha_section, "use_api", False)
            cfg.api_url = getattr(captcha_section, "api_url", "")
            cfg.api_key = getattr(captcha_section, "api_key", "")
            cfg.api_type = getattr(captcha_section, "api_type", "chaojiying")
            cfg.max_retries = getattr(captcha_section, "max_retries", 3)
            cfg.confidence_threshold = getattr(captcha_section, "confidence_threshold", 0.5)
        return cfg

    def _init_ddddocr(self):
        if self._ocr is None and _HAS_DDDDOCR and self.captcha_cfg.use_ddddocr:
            try:
                self._ocr = ddddocr.DdddOcr(show_ad=False)
                logger.info("ddddocr 初始化成功")
            except Exception as e:
                logger.warning(f"ddddocr 初始化失败: {e}")
                self._ocr = None
        return self._ocr

    def _get_notifier(self) -> Notifier:
        if self._notifier is None:
            self._notifier = Notifier(self.config)
        return self._notifier

    def solve_image(self, image_bytes: bytes, site_name: str = "") -> Tuple[str, float]:
        self.total_count += 1
        confidence = 0.0
        result = ""

        if self.captcha_cfg.use_ddddocr and _HAS_DDDDOCR:
            result, confidence = self._solve_with_ddddocr(image_bytes)
            if result and confidence >= self.captcha_cfg.confidence_threshold:
                logger.debug(f"[ddddocr] 识别成功: {result} (置信度: {confidence:.2f})")
                return result, confidence

        if self.captcha_cfg.use_tesseract and _HAS_PYTESSERACT and (not result or confidence < self.captcha_cfg.confidence_threshold):
            tess_result, tess_conf = self._solve_with_tesseract(image_bytes)
            if tess_result and tess_conf > confidence:
                result, confidence = tess_result, tess_conf
                logger.debug(f"[tesseract] 识别成功: {result} (置信度: {confidence:.2f})")

        if self.captcha_cfg.use_api and (not result or confidence < self.captcha_cfg.confidence_threshold):
            try:
                result, confidence = self._solve_with_api(image_bytes)
                logger.debug(f"[打码平台] 识别: {result} (置信度: {confidence:.2f})")
            except Exception as e:
                logger.warning(f"打码平台调用失败: {e}")

        if not result:
            self.fail_count += 1
            if self.fail_count >= 5 and site_name:
                self._alert_failure(site_name)
            logger.warning(f"验证码识别失败 (累计失败 {self.fail_count}/{self.total_count})")
            return "", 0.0

        return result, confidence

    def _solve_with_ddddocr(self, image_bytes: bytes) -> Tuple[str, float]:
        ocr = self._init_ddddocr()
        if ocr is None:
            return "", 0.0
        try:
            result = ocr.classification(image_bytes)
            if result and isinstance(result, str):
                confidence = min(len(result) / 6.0, 1.0) * 0.8
                return result.strip(), confidence
            return "", 0.0
        except Exception as e:
            logger.warning(f"ddddocr 识别异常: {e}")
            return "", 0.0

    def _solve_with_tesseract(self, image_bytes: bytes) -> Tuple[str, float]:
        if not _HAS_PYTESSERACT:
            return "", 0.0
        try:
            img = Image.open(io.BytesIO(image_bytes))
            text = pytesseract.image_to_string(img, config="--psm 7 -c tessedit_char_whitelist=0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
            text = text.strip()
            if text and len(text) >= 3:
                conf = min(len(text) / 6.0, 1.0) * 0.6
                return text, conf
            return "", 0.0
        except Exception as e:
            logger.warning(f"tesseract 识别异常: {e}")
            return "", 0.0

    def _solve_with_api(self, image_bytes: bytes) -> Tuple[str, float]:
        if not (self.captcha_cfg.api_url and self.captcha_cfg.api_key):
            return "", 0.0

        api_type = self.captcha_cfg.api_type
        if api_type == "chaojiying":
            return self._chaojiying(image_bytes)
        elif api_type == "ttshitu":
            return self._ttshitu(image_bytes)
        else:
            return self._generic_api(image_bytes)

    def _chaojiying(self, image_bytes: bytes) -> Tuple[str, float]:
        try:
            b64 = base64.b64encode(image_bytes).decode()
            payload = {
                "user": self.captcha_cfg.api_key.split(":")[0] if ":" in self.captcha_cfg.api_key else "",
                "pass": self.captcha_cfg.api_key.split(":")[1] if ":" in self.captcha_cfg.api_key else self.captcha_cfg.api_key,
                "softid": "900000",
                "codetype": "1004",
                "file_base64": b64,
            }
            r = requests.post(self.captcha_cfg.api_url, data=payload, timeout=30)
            data = r.json()
            if data.get("err_no") == 0:
                return data.get("pic_str", ""), 0.95
            logger.warning(f"超级鹰返回错误: {data}")
            return "", 0.0
        except Exception as e:
            logger.warning(f"超级鹰调用异常: {e}")
            return "", 0.0

    def _ttshitu(self, image_bytes: bytes) -> Tuple[str, float]:
        try:
            b64 = base64.b64encode(image_bytes).decode()
            payload = {"image": b64, "type": "3"}
            headers = {"Authorization": f"Bearer {self.captcha_cfg.api_key}"}
            r = requests.post(self.captcha_cfg.api_url, json=payload, headers=headers, timeout=30)
            data = r.json()
            if data.get("code") == 0:
                return data.get("data", {}).get("result", ""), 0.9
            return "", 0.0
        except Exception as e:
            logger.warning(f"图鉴API调用异常: {e}")
            return "", 0.0

    def _generic_api(self, image_bytes: bytes) -> Tuple[str, float]:
        try:
            b64 = base64.b64encode(image_bytes).decode()
            payload = {"image": b64}
            r = requests.post(self.captcha_cfg.api_url, json=payload, timeout=30)
            data = r.json()
            if data.get("code") == 0 or data.get("status") == "ok":
                return data.get("result", data.get("data", "")), 0.8
            return "", 0.0
        except Exception as e:
            logger.warning(f"通用打码API调用异常: {e}")
            return "", 0.0

    def get_captcha_from_element(self, element) -> Optional[bytes]:
        if element is None:
            return None
        try:
            src = element.get_attribute("src")
            if src and src.startswith("data:image"):
                b64_data = src.split(",")[1]
                return base64.b64decode(b64_data)
            if src:
                try:
                    png = element.screenshot_as_png
                    if png:
                        return png
                except Exception:
                    pass
            return element.screenshot_as_png
        except Exception as e:
            logger.warning(f"获取验证码图片失败: {e}")
            return None

    def _alert_failure(self, site_name: str) -> None:
        try:
            notifier = self._get_notifier()
            subject = f"验证码识别持续失败告警: {site_name}"
            body = (
                f"站点 {site_name} 验证码识别连续失败 {self.fail_count} 次，"
                f"累计尝试 {self.total_count} 次。\n"
                f"请检查：\n"
                f"1. 验证码类型是否变化\n"
                f"2. 打码平台余额是否充足\n"
                f"3. 站点是否升级了反爬机制\n"
                f"时间: {time.strftime('%Y-%m-%d %H:%M:%S')}"
            )
            notifier.send_alert(subject, body)
            logger.warning(f"验证码失败告警已发送: {site_name}")
        except Exception as e:
            logger.error(f"发送验证码告警失败: {e}")

    def reset_fail_counter(self) -> None:
        self.fail_count = 0

    def get_stats(self) -> dict:
        return {
            "total": self.total_count,
            "failed": self.fail_count,
            "success": self.total_count - self.fail_count,
            "success_rate": (
                (self.total_count - self.fail_count) / self.total_count
                if self.total_count > 0 else 0.0
            ),
        }
