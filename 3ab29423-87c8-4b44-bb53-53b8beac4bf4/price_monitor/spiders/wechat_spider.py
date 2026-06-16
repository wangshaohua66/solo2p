import re
from typing import List, Dict
from io import BytesIO

from bs4 import BeautifulSoup

from ..utils import (
    logger,
    http_request,
    download_file,
    safe_float,
    preprocess_image_for_ocr,
    Color,
    color_text,
)


class WechatSpider:
    """采集微信公众号推文图片表格的爬虫"""

    spider_type = "wechat"

    def __init__(self):
        self.name = "WechatSpider"
        self._ocr_available = False
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            self._ocr_available = True
        except Exception as e:
            logger.warning(f"tesseract OCR不可用，微信图片采集将受限: {e}")

    def crawl(self, market_info: Dict) -> List[Dict]:
        market_id = market_info["id"]
        market_name = market_info.get("name", market_id)
        url = market_info["url"]
        article_pattern = market_info.get("article_pattern", "")
        ocr_region = market_info.get("ocr_region")
        table_header = market_info.get("table_header", [])

        logger.info(color_text(f"[WeChat] 开始采集 {market_name} ({market_id})", Color.CYAN))

        article_url = url
        if not self._is_article_url(url):
            try:
                article_url = self._find_latest_article(url, article_pattern)
                if not article_url:
                    raise RuntimeError("未找到包含价格表格的最新推文")
                logger.info(f"[WeChat] 找到最新推文: {article_url}")
            except Exception as e:
                logger.error(color_text(f"[WeChat] {market_name} 推文查找失败: {e}", Color.RED))
                raise

        try:
            resp = http_request(article_url)
            html = resp.text
            soup = BeautifulSoup(html, "lxml")
        except Exception as e:
            logger.error(color_text(f"[WeChat] {market_name} 推文页面请求失败: {e}", Color.RED))
            raise

        try:
            image_urls = self._extract_table_images(soup, article_pattern)
            if not image_urls:
                logger.warning(f"[WeChat] {market_name} 未找到价格图片")
                return []

            all_records = []
            for idx, img_url in enumerate(image_urls):
                try:
                    img_bytes = download_file(img_url).read()
                    processed_img = preprocess_image_for_ocr(
                        img_bytes,
                        region=ocr_region,
                        upscale=2,
                        denoise=True,
                    )
                    ocr_text = self._run_ocr(processed_img)
                    records = self._parse_ocr_table(ocr_text, table_header)
                    if records:
                        logger.info(f"[WeChat] 图片{idx+1}解析出{len(records)}条记录")
                        all_records.extend(records)
                except Exception as e:
                    logger.warning(f"[WeChat] 第{idx+1}张图片处理失败: {e}")
                    continue

            logger.info(
                color_text(
                    f"[WeChat] {market_name} 解析完成，共{len(all_records)}条原始记录",
                    Color.GREEN,
                )
            )
            return all_records

        except Exception as e:
            logger.error(color_text(f"[WeChat] {market_name} 解析失败: {e}", Color.RED))
            raise

    def _is_article_url(self, url: str) -> bool:
        return "mp.weixin.qq.com/s" in url

    def _find_latest_article(self, list_url: str, pattern: str) -> str:
        try:
            resp = http_request(list_url)
            soup = BeautifulSoup(resp.text, "lxml")
            links = soup.find_all("a", href=True)
            for a in links:
                href = a.get("href", "")
                text = a.get_text(strip=True)
                if pattern and pattern in text and "mp.weixin.qq.com/s" in href:
                    return href
                if "mp.weixin.qq.com/s" in href:
                    return href
        except Exception as e:
            logger.debug(f"查找推文链接异常: {e}")
        return ""

    def _extract_table_images(self, soup: BeautifulSoup, pattern: str) -> List[str]:
        urls = []
        content = soup.find(id="js_content") or soup.find(class_="rich_media_content")
        if not content:
            content = soup
        imgs = content.find_all("img")
        for img in imgs:
            src = img.get("data-src") or img.get("src") or ""
            if src.startswith("//"):
                src = "https:" + src
            if src:
                urls.append(src)
        return urls

    def _run_ocr(self, processed_img) -> str:
        if processed_img is None:
            return ""
        if not self._ocr_available:
            return ""
        try:
            import pytesseract
            text = pytesseract.image_to_string(
                processed_img,
                lang="chi_sim+eng",
                config="--psm 6 --oem 3",
            )
            return text
        except Exception as e:
            logger.warning(f"OCR识别失败: {e}")
            return ""

    def _parse_ocr_table(self, ocr_text: str, expected_header: List[str]) -> List[Dict]:
        records = []
        if not ocr_text.strip():
            return []

        lines = [re.sub(r"\s+", " ", line.strip()) for line in ocr_text.split("\n") if line.strip()]
        if not lines:
            return []

        header_idx = -1
        for i, line in enumerate(lines):
            if any(h in line for h in expected_header):
                header_idx = i
                break

        data_start = header_idx + 1 if header_idx >= 0 else 0

        for line in lines[data_start:]:
            try:
                record = self._parse_ocr_line(line, expected_header)
                if record and str(record.get("category_name", "")).strip():
                    for price_key in ("max_price", "min_price", "avg_price"):
                        if price_key in record:
                            record[price_key] = safe_float(record[price_key])
                    if record.get("avg_price", 0) > 0 or record.get("max_price", 0) > 0:
                        records.append(record)
            except Exception as e:
                logger.debug(f"OCR行解析失败: {e}, line={line}")
                continue

        return records

    def _parse_ocr_line(self, line: str, header: List[str]) -> Dict:
        parts = re.split(r"[\s|,，、/\\]+", line)
        parts = [p for p in parts if p]
        if len(parts) < 2:
            return {}

        record = {}
        field_keys = ["category_name", "max_price", "min_price", "avg_price"]
        price_idx = 0
        name_parts = []

        for p in parts:
            is_price = bool(re.search(r"\d+\.?\d*", p))
            if is_price and price_idx < 3 and name_parts:
                record[field_keys[price_idx + 1]] = p
                price_idx += 1
            elif not name_parts or (not is_price and price_idx == 0):
                name_parts.append(p)

        if name_parts:
            record["category_name"] = "".join(name_parts)

        if "avg_price" not in record and "max_price" in record and "min_price" in record:
            mx = safe_float(record["max_price"])
            mn = safe_float(record["min_price"])
            if mx > 0 and mn > 0:
                record["avg_price"] = round((mx + mn) / 2, 2)

        return record
