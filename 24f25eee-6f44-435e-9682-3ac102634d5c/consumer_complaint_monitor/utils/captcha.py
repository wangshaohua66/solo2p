import base64
import hashlib
import time
from typing import Optional
from pathlib import Path

import requests as req
from loguru import logger

from config.settings import Settings


class CaptchaSolver:
    RUOKUAI_UPLOAD_URL = "http://api.ruokuai.com/create.json"
    RUOKUAI_REPORT_URL = "http://api.ruokuai.com/reporterror.json"

    def __init__(self, settings: Optional[Settings] = None):
        self._settings = settings or Settings()
        captcha_cfg = self._settings.get("captcha", {})
        self._provider = captcha_cfg.get("provider", "ruokuai")
        self._username = captcha_cfg.get("username", "")
        self._password = captcha_cfg.get("password", "")
        self._api_url = captcha_cfg.get("api_url", self.RUOKUAI_UPLOAD_URL)
        self._soft_id = captcha_cfg.get("soft_id", "12345")
        self._timeout = captcha_cfg.get("timeout", 60)
        self._stats = {
            "total": 0,
            "success": 0,
            "fail": 0,
        }

    def solve(self, image_bytes: bytes, captcha_type: int = 3040) -> Optional[str]:
        self._stats["total"] += 1

        if not self._username or not self._password:
            logger.warning("Captcha solver not configured (missing username/password)")
            self._stats["fail"] += 1
            return None

        if self._provider == "ruokuai":
            return self._solve_ruokuai(image_bytes, captcha_type)
        else:
            logger.warning(f"Unknown captcha provider: {self._provider}")
            self._stats["fail"] += 1
            return None

    def _solve_ruokuai(self, image_bytes: bytes, captcha_type: int = 3040) -> Optional[str]:
        try:
            image_base64 = base64.b64encode(image_bytes).decode()

            timestamp = int(time.time())
            param_str = f"{self._username}{timestamp}{self._password}"
            sign = hashlib.md5(param_str.encode()).hexdigest()

            data = {
                "username": self._username,
                "password": self._password,
                "typeid": captcha_type,
                "timeout": self._timeout,
                "softid": self._soft_id,
                "image": image_base64,
                "sign": sign,
            }

            resp = req.post(self._api_url, data=data, timeout=self._timeout + 10)
            result = resp.json()

            if "Result" in result:
                code = result["Result"].strip()
                self._stats["success"] += 1
                logger.info(f"Captcha solved successfully: {code} (id={result.get('Id', '')})")
                return code
            elif "Error" in result:
                logger.error(f"Ruokuai error: {result['Error']}")
                self._stats["fail"] += 1
                return None
            else:
                logger.error(f"Unexpected captcha response: {result}")
                self._stats["fail"] += 1
                return None

        except Exception as e:
            logger.error(f"Captcha solve exception: {e}")
            self._stats["fail"] += 1
            return None

    def report_error(self, captcha_id: str):
        try:
            data = {
                "username": self._username,
                "password": self._password,
                "softid": self._soft_id,
                "id": captcha_id,
            }
            req.post(self.RUOKUAI_REPORT_URL, data=data, timeout=10)
            logger.info(f"Reported captcha error for id={captcha_id}")
        except Exception as e:
            logger.debug(f"Failed to report captcha error: {e}")

    @property
    def success_rate(self) -> float:
        if self._stats["total"] == 0:
            return 0.0
        return self._stats["success"] / self._stats["total"]

    @property
    def stats(self) -> dict:
        return dict(self._stats)
