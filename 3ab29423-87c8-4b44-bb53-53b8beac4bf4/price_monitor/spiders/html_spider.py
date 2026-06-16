from typing import List, Dict

from bs4 import BeautifulSoup
from scrapy import Selector

from ..utils import (
    logger,
    http_request,
    safe_float,
    Color,
    color_text,
)


class HtmlSpider:
    """采集自建网站HTML表格价格的爬虫"""

    spider_type = "html"

    def __init__(self):
        self.name = "HtmlSpider"

    def crawl(self, market_info: Dict) -> List[Dict]:
        market_id = market_info["id"]
        market_name = market_info.get("name", market_id)
        url = market_info["url"]
        encoding = market_info.get("encoding", "utf-8")
        table_selector = market_info.get("table_selector", "table")
        row_selector = market_info.get("row_selector", "tbody tr")
        column_mapping = market_info.get("column_mapping", {})

        logger.info(color_text(f"[HTML] 开始采集 {market_name} ({market_id})", Color.CYAN))

        try:
            resp = http_request(url)
            resp.encoding = encoding
            html = resp.text
        except Exception as e:
            logger.error(color_text(f"[HTML] {market_name} 页面请求失败: {e}", Color.RED))
            raise

        try:
            raw_records = self._parse_html(
                html, table_selector, row_selector, column_mapping
            )
            logger.info(
                color_text(
                    f"[HTML] {market_name} 解析完成，共{len(raw_records)}条原始记录",
                    Color.GREEN,
                )
            )
            return raw_records
        except Exception as e:
            logger.error(color_text(f"[HTML] {market_name} 解析失败: {e}", Color.RED))
            raise

    def _parse_html(
        self,
        html: str,
        table_selector: str,
        row_selector: str,
        column_mapping: Dict[str, str],
    ) -> List[Dict]:
        records = []

        try:
            sel = Selector(text=html)
        except Exception:
            sel = None

        headers = []
        rows_sel = []

        if sel is not None:
            try:
                table_sel = sel.css(table_selector)
                if table_sel:
                    headers = self._extract_headers(table_sel[0], column_mapping)
                    rows_sel = table_sel[0].css(row_selector)
            except Exception as e:
                logger.warning(f"Scrapy Selector解析异常，回退BeautifulSoup: {e}")

        if not rows_sel:
            soup = BeautifulSoup(html, "lxml")
            table = self._find_table(soup, table_selector)
            if table is None:
                logger.warning("未找到HTML表格元素")
                return []
            headers = self._extract_headers_bs4(table, column_mapping)
            rows_sel = self._find_rows_bs4(table, row_selector)

        if not headers and rows_sel:
            headers = list(column_mapping.values())[:4]

        for row in rows_sel:
            try:
                cells = self._extract_cells(row)
                if not cells or len(cells) < len(column_mapping):
                    continue
                record = self._build_record(cells, headers, column_mapping)
                if record and any(
                    v not in (None, "", 0.0)
                    for k, v in record.items()
                    if k != "category_name"
                ):
                    records.append(record)
            except Exception as e:
                logger.debug(f"解析单行失败: {e}")
                continue

        return records

    def _find_table(self, soup, table_selector: str):
        try:
            if "#" in table_selector:
                parts = table_selector.split("#")
                tag, tid = parts[0] or "table", parts[1]
                return soup.find(tag or "table", id=tid)
            elif "." in table_selector:
                tag, cls = table_selector.split(".")
                return soup.find(tag or "table", class_=cls)
            else:
                return soup.select_one(table_selector) or soup.find(table_selector)
        except Exception:
            return soup.find("table")

    def _find_rows_bs4(self, table, row_selector: str):
        try:
            return table.select(row_selector)
        except Exception:
            return table.find_all("tr")

    def _extract_headers(self, table_sel, column_mapping: Dict):
        headers = []
        try:
            th_list = table_sel.css("thead tr th::text, thead tr td::text").getall()
            if th_list:
                headers = [h.strip() for h in th_list if h.strip()]
        except Exception:
            pass
        if not headers:
            try:
                first_row = table_sel.css("tr")[0]
                td_list = first_row.css("th::text, td::text").getall()
                if td_list:
                    headers = [h.strip() for h in td_list if h.strip()]
            except Exception:
                pass
        return headers

    def _extract_headers_bs4(self, table, column_mapping: Dict):
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
        return headers

    def _extract_cells(self, row):
        cells = []
        try:
            if hasattr(row, "css"):
                texts = row.css("td::text, th::text").getall()
                cells = [t.strip() for t in texts if t.strip()]
            else:
                tds = row.find_all(["td", "th"])
                cells = [td.get_text(strip=True) for td in tds if td.get_text(strip=True)]
        except Exception:
            pass
        return cells

    def _build_record(self, cells: List[str], headers: List[str], column_mapping: Dict) -> Dict:
        if not cells:
            return {}

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

        if "category_name" not in record or not record["category_name"]:
            return {}

        for price_key in ("max_price", "min_price", "avg_price"):
            if price_key in record:
                record[price_key] = safe_float(record[price_key])

        return record
