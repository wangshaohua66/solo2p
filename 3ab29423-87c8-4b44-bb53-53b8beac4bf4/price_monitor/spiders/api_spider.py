from typing import List, Dict

from ..utils import (
    logger,
    http_request,
    safe_float,
    extract_json_path,
    Color,
    color_text,
)


class ApiSpider:
    """采集统一门户动态JSON接口的爬虫"""

    spider_type = "api"

    def __init__(self):
        self.name = "ApiSpider"

    def crawl(self, market_info: Dict) -> List[Dict]:
        market_id = market_info["id"]
        market_name = market_info.get("name", market_id)
        url = market_info["url"]
        method = market_info.get("method", "GET").upper()
        params = market_info.get("params", {}) or {}
        headers = market_info.get("headers", {}) or {}
        data_path = market_info.get("data_path", "data.items")
        field_mapping = market_info.get("field_mapping", {})

        logger.info(color_text(f"[API] 开始采集 {market_name} ({market_id})", Color.CYAN))

        try:
            resp = http_request(
                url,
                method=method,
                params=params if method == "GET" else None,
                data=params if method == "POST" else None,
                headers=headers,
            )
            json_data = resp.json()
        except Exception as e:
            logger.error(color_text(f"[API] {market_name} 接口请求失败: {e}", Color.RED))
            raise

        try:
            items = extract_json_path(json_data, data_path)
            if not items or not isinstance(items, list):
                logger.warning(f"[API] {market_name} 未获取到有效数据列表，path={data_path}")
                return []

            raw_records = self._normalize(items, field_mapping)
            logger.info(
                color_text(
                    f"[API] {market_name} 解析完成，共{len(raw_records)}条原始记录",
                    Color.GREEN,
                )
            )
            return raw_records
        except Exception as e:
            logger.error(color_text(f"[API] {market_name} 解析失败: {e}", Color.RED))
            raise

    def _validate_fields(self, item: Dict, field_mapping: Dict) -> bool:
        missing = []
        for src_key in field_mapping:
            if src_key not in item or item[src_key] in (None, ""):
                missing.append(src_key)
        if missing:
            logger.debug(f"字段缺失 {missing}，原始: {item}")
            return False
        return True

    def _normalize(self, items: List[Dict], field_mapping: Dict) -> List[Dict]:
        records = []
        for item in items:
            if not isinstance(item, dict):
                continue
            try:
                record = {}
                for src_key, target_key in field_mapping.items():
                    val = item.get(src_key)
                    record[target_key] = val
                if "category_name" not in record or not str(record["category_name"]).strip():
                    continue
                for price_key in ("max_price", "min_price", "avg_price"):
                    if price_key in record:
                        record[price_key] = safe_float(record[price_key])
                if record.get("avg_price", 0) <= 0 and record.get("max_price", 0) <= 0:
                    continue
                records.append(record)
            except Exception as e:
                logger.debug(f"单条记录归一化失败: {e}, item={item}")
                continue
        return records
