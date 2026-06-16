import time
import re
from typing import List, Dict
from io import BytesIO

import requests
from bs4 import BeautifulSoup

from ..utils import (
    logger,
    safe_float,
    http_request,
    download_file,
    Color,
    color_text,
    preprocess_image_for_ocr,
)


class LoginSpider:
    """采集需登录态页面的爬虫（支持Cookie维持、验证码重试）"""

    spider_type = "login"

    def __init__(self):
        self.name = "LoginSpider"

    def crawl(self, market_info: Dict) -> List[Dict]:
        market_id = market_info["id"]
        market_name = market_info.get("name", market_id)
        login_url = market_info["url"]
        data_url = market_info.get("data_url", login_url)
        login_method = market_info.get("login_method", "POST")
        username_field = market_info.get("username_field", "username")
        password_field = market_info.get("password_field", "password")
        captcha_required = market_info.get("captcha_required", False)
        captcha_url = market_info.get("captcha_url")
        credentials = market_info.get("credentials", {})
        table_selector = market_info.get("table_selector", "table")
        row_selector = market_info.get("row_selector", "tbody tr")
        column_mapping = market_info.get("column_mapping", {})

        logger.info(color_text(f"[LOGIN] 开始采集 {market_name} ({market_id})", Color.CYAN))

        session = requests.Session()

        try:
            self._do_login(
                session,
                login_url,
                login_method,
                username_field,
                password_field,
                credentials,
                captcha_required,
                captcha_url,
            )
            logger.info(f"[LOGIN] {market_name} 登录成功")
        except Exception as e:
            logger.error(color_text(f"[LOGIN] {market_name} 登录失败: {e}", Color.RED))
            raise

        try:
            resp = http_request(data_url, session=session)
            resp.encoding = market_info.get("encoding", "utf-8")
            html = resp.text
        except Exception as e:
            logger.error(color_text(f"[LOGIN] {market_name} 数据页请求失败: {e}", Color.RED))
            raise

        try:
            raw_records = self._parse_html(
                html, table_selector, row_selector, column_mapping
            )
            logger.info(
                color_text(
                    f"[LOGIN] {market_name} 解析完成，共{len(raw_records)}条原始记录",
                    Color.GREEN,
                )
            )
            return raw_records
        except Exception as e:
            logger.error(color_text(f"[LOGIN] {market_name} 解析失败: {e}", Color.RED))
            raise

    def _do_login(
        self,
        session: requests.Session,
        login_url: str,
        login_method: str,
        username_field: str,
        password_field: str,
        credentials: Dict,
        captcha_required: bool,
        captcha_url: str = None,
    ):
        username = credentials.get("username", "")
        password = credentials.get("password", "")
        if not username or not password or "YOUR_" in username or "YOUR_" in password:
            raise ValueError("登录凭证未配置")

        payload = {
            username_field: username,
            password_field: password,
        }

        if captcha_required and captcha_url:
            captcha_code = self._solve_captcha(session, captcha_url)
            if captcha_code:
                payload["captcha"] = captcha_code

        for attempt in range(3):
            try:
                resp = session.request(
                    login_method,
                    login_url,
                    data=payload,
                    timeout=15,
                    allow_redirects=True,
                )
                text = resp.text
                if self._check_login_success(text, session):
                    return True
                if attempt < 2 and captcha_required and captcha_url:
                    logger.warning(f"[LOGIN] 登录可能失败，尝试刷新验证码重试 ({attempt+1}/3)")
                    payload["captcha"] = self._solve_captcha(session, captcha_url) or ""
                    time.sleep(1)
                    continue
                if attempt == 2:
                    logger.warning(f"[LOGIN] 登录响应检测未通过，仍尝试继续请求")
                    return True
            except requests.RequestException as e:
                if attempt == 2:
                    raise
                time.sleep(2)
        return False

    def _check_login_success(self, html_text: str, session: requests.Session) -> bool:
        if not session.cookies:
            return False
        fail_keywords = ["登录失败", "用户名或密码错误", "验证码错误", "请先登录"]
        for kw in fail_keywords:
            if kw in html_text:
                return False
        return True

    def _solve_captcha(self, session: requests.Session, captcha_url: str) -> str:
        try:
            captcha_bytes = download_file(captcha_url, session=session).read()
            processed = preprocess_image_for_ocr(captcha_bytes, upscale=3, denoise=True)
            if processed is None:
                return ""
            import pytesseract
            code = pytesseract.image_to_string(
                processed,
                config="--psm 8 --oem 3 -c tessedit_char_whitelist=0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
            ).strip()
            return re.sub(r"[^0-9a-zA-Z]", "", code)
        except Exception as e:
            logger.debug(f"验证码识别失败: {e}")
            return ""

    def _parse_html(
        self,
        html: str,
        table_selector: str,
        row_selector: str,
        column_mapping: Dict,
    ) -> List[Dict]:
        records = []
        soup = BeautifulSoup(html, "lxml")

        try:
            table = soup.select_one(table_selector)
        except Exception:
            table = soup.find("table")

        if table is None:
            logger.warning("未找到HTML表格元素")
            return []

        headers = []
        try:
            thead = table.find("thead")
            if thead:
                ths = thead.find_all(["th", "td"])
                headers = [t.get_text(strip=True) for t in ths if t.get_text(strip=True)]
        except Exception:
            pass
        if not headers:
            try:
                first_tr = table.find("tr")
                if first_tr:
                    ths = first_tr.find_all(["th", "td"])
                    headers = [t.get_text(strip=True) for t in ths if t.get_text(strip=True)]
            except Exception:
                pass

        try:
            rows = table.select(row_selector)
        except Exception:
            rows = table.find_all("tr")

        for row in rows:
            try:
                tds = row.find_all(["td", "th"])
                cells = [td.get_text(strip=True) for td in tds if td.get_text(strip=True)]
                if not cells or len(cells) < len(column_mapping):
                    continue

                record = {}
                mapped_cells = {}
                if headers:
                    for idx, header in enumerate(headers):
                        if idx < len(cells):
                            mapped_cells[header] = cells[idx]

                if mapped_cells:
                    for source_key, target_key in column_mapping.items():
                        if source_key in mapped_cells:
                            record[target_key] = mapped_cells[source_key]
                else:
                    keys = list(column_mapping.values())
                    for idx, key in enumerate(keys):
                        if idx < len(cells):
                            record[key] = cells[idx]

                if "category_name" not in record or not str(record["category_name"]).strip():
                    continue
                for price_key in ("max_price", "min_price", "avg_price"):
                    if price_key in record:
                        record[price_key] = safe_float(record[price_key])
                if record.get("avg_price", 0) > 0 or record.get("max_price", 0) > 0:
                    records.append(record)
            except Exception as e:
                logger.debug(f"解析单行失败: {e}")
                continue

        return records
