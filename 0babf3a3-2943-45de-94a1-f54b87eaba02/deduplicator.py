from typing import Dict, List, Tuple, Optional
from collections import defaultdict
from config import ConfigManager
from logger import LoggerManager


class DeduplicationResult:
    def __init__(self):
        self.unique_records: List[Dict] = []
        self.duplicate_records: List[Dict] = []
        self.marked_records: List[Dict] = []
        self.overwritten_records: List[Dict] = []
        self.skipped_count: int = 0
        self.overwritten_count: int = 0
        self.marked_count: int = 0
        self.duplicate_details: List[Dict] = []


class DataDeduplicator:
    def __init__(self, config: ConfigManager, logger: LoggerManager):
        self.config = config
        self.logger = logger
        self.strategy = config.get_dedup_strategy()

    def set_strategy(self, strategy: str):
        if strategy not in ["skip", "overwrite", "mark"]:
            raise ValueError(f"无效策略: {strategy}")
        self.strategy = strategy

    @staticmethod
    def _get_duplicate_key(record: Dict) -> Tuple[str, str]:
        return (record["site_code"], record["obs_time"])

    def find_duplicates_in_batch(self, records: List[Dict]) -> Dict[Tuple[str, str], List[int]]:
        key_indices = defaultdict(list)
        for idx, record in enumerate(records):
            key = self._get_duplicate_key(record)
            key_indices[key].append(idx)
        return {k: v for k, v in key_indices.items() if len(v) > 1}

    def deduplicate_batch(self, records: List[Dict],
                          existing_keys: Optional[set] = None,
                          filename: str = "") -> DeduplicationResult:
        result = DeduplicationResult()
        existing_keys = existing_keys or set()
        seen_keys = set()
        batch_duplicates = self.find_duplicates_in_batch(records)

        for idx, record in enumerate(records):
            key = self._get_duplicate_key(record)

            if key in batch_duplicates and idx != batch_duplicates[key][0]:
                self._handle_duplicate(record, key, result, filename, "batch_internal")
                continue

            if key in existing_keys:
                self._handle_duplicate(record, key, result, filename, "existing_db")
                continue

            if key in seen_keys:
                self._handle_duplicate(record, key, result, filename, "batch_seen")
                continue

            seen_keys.add(key)
            result.unique_records.append(record)

        return result

    def _handle_duplicate(self, record: Dict, key: Tuple[str, str],
                          result: DeduplicationResult, filename: str, source: str):
        station_code, obs_time = key

        if self.strategy == "skip":
            result.skipped_count += 1
            result.duplicate_records.append(record)
            self.logger.log_duplicate(filename, station_code, obs_time, "跳过")

        elif self.strategy == "overwrite":
            result.overwritten_count += 1
            result.overwritten_records.append(record)
            result.unique_records.append(record)
            self.logger.log_duplicate(filename, station_code, obs_time, "覆盖")

        elif self.strategy == "mark":
            result.marked_count += 1
            marked_record = record.copy()
            marked_record["is_duplicate"] = 1
            result.marked_records.append(marked_record)
            result.unique_records.append(marked_record)
            self.logger.log_duplicate(filename, station_code, obs_time, "标记")

        result.duplicate_details.append({
            "station_code": station_code,
            "obs_time": obs_time,
            "source": source,
            "strategy": self.strategy
        })

    def generate_report(self, result: DeduplicationResult) -> Dict:
        total_duplicates = result.skipped_count + result.overwritten_count + result.marked_count
        return {
            "total_duplicates": total_duplicates,
            "skipped_count": result.skipped_count,
            "overwritten_count": result.overwritten_count,
            "marked_count": result.marked_count,
            "unique_count": len(result.unique_records),
            "duplicate_rate": total_duplicates / (len(result.unique_records) + total_duplicates)
            if (len(result.unique_records) + total_duplicates) > 0 else 0,
            "details": result.duplicate_details
        }
