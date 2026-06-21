from typing import Dict, List, Optional, Tuple
from collections import defaultdict
from datetime import datetime
from config import ConfigManager
from logger import LoggerManager


class AnomalyDetectionResult:
    def __init__(self):
        self.normal_records: List[Dict] = []
        self.anomaly_records: List[Dict] = []
        self.anomaly_details: List[Dict] = []
        self.water_level_anomalies: int = 0
        self.flow_anomalies: int = 0


class AnomalyDetector:
    def __init__(self, config: ConfigManager, logger: LoggerManager):
        self.config = config
        self.logger = logger
        self._load_thresholds()
        self._station_last_values: Dict[str, Dict] = defaultdict(dict)

    def _load_thresholds(self):
        self.water_level_jump = self.config.get_threshold("water_level_jump")
        self.flow_surge = self.config.get_threshold("flow_surge")

    def set_thresholds(self, water_level_jump: Optional[float] = None,
                       flow_surge: Optional[float] = None):
        if water_level_jump is not None:
            self.water_level_jump = water_level_jump
            self.config.set_threshold("water_level_jump", water_level_jump)
        if flow_surge is not None:
            self.flow_surge = flow_surge
            self.config.set_threshold("flow_surge", flow_surge)

    def set_station_last_value(self, station_code: str, water_level: float,
                               flow: float, obs_time: str):
        self._station_last_values[station_code] = {
            "water_level": water_level,
            "flow": flow,
            "obs_time": obs_time
        }

    def detect_anomalies(self, records: List[Dict],
                         filename: str = "") -> AnomalyDetectionResult:
        result = AnomalyDetectionResult()
        sorted_records = self._sort_records_by_time(records)

        for record in sorted_records:
            station_code = record["site_code"]
            obs_time = record["obs_time"]
            water_level = float(record["water_level"])
            flow = float(record["flow"])

            last_value = self._station_last_values.get(station_code)
            is_anomaly = False
            anomaly_types = []

            if last_value:
                wl_anomaly, wl_diff = self._check_water_level_anomaly(
                    water_level, last_value["water_level"], station_code
                )
                if wl_anomaly:
                    is_anomaly = True
                    anomaly_types.append("water_level_jump")
                    result.water_level_anomalies += 1
                    self.logger.log_anomaly(
                        filename, station_code, obs_time,
                        "水位跳变", water_level, last_value["water_level"],
                        self.water_level_jump
                    )

                flow_anomaly, flow_diff = self._check_flow_anomaly(
                    flow, last_value["flow"], station_code
                )
                if flow_anomaly:
                    is_anomaly = True
                    anomaly_types.append("flow_surge")
                    result.flow_anomalies += 1
                    self.logger.log_anomaly(
                        filename, station_code, obs_time,
                        "流量突变", flow, last_value["flow"],
                        self.flow_surge
                    )

                result.anomaly_details.append({
                    "station_code": station_code,
                    "obs_time": obs_time,
                    "anomaly_types": anomaly_types,
                    "water_level": water_level,
                    "prev_water_level": last_value["water_level"],
                    "water_level_diff": wl_diff if wl_anomaly else 0,
                    "flow": flow,
                    "prev_flow": last_value["flow"],
                    "flow_diff": flow_diff if flow_anomaly else 0
                })

            processed_record = record.copy()
            if is_anomaly:
                processed_record["is_anomaly"] = 1
                processed_record["anomaly_types"] = ",".join(anomaly_types)
                result.anomaly_records.append(processed_record)
            else:
                processed_record["is_anomaly"] = 0
                processed_record["anomaly_types"] = ""
                result.normal_records.append(processed_record)

            self.set_station_last_value(station_code, water_level, flow, obs_time)

        return result

    def _sort_records_by_time(self, records: List[Dict]) -> List[Dict]:
        def get_time_key(record: Dict):
            return datetime.strptime(record["obs_time"], "%Y-%m-%d %H:%M")

        return sorted(records, key=get_time_key)

    def _check_water_level_anomaly(self, current: float, previous: float,
                                   station_code: str) -> Tuple[bool, float]:
        if previous is None:
            return False, 0.0
        diff = abs(current - previous)
        return diff > self.water_level_jump, diff

    def _check_flow_anomaly(self, current: float, previous: float,
                            station_code: str) -> Tuple[bool, float]:
        if previous is None:
            return False, 0.0
        diff = abs(current - previous)
        return diff > self.flow_surge, diff

    def get_anomaly_report(self, result: AnomalyDetectionResult) -> Dict:
        total = len(result.normal_records) + len(result.anomaly_records)
        anomaly_rate = len(result.anomaly_records) / total if total > 0 else 0
        return {
            "total_records": total,
            "anomaly_count": len(result.anomaly_records),
            "water_level_anomalies": result.water_level_anomalies,
            "flow_anomalies": result.flow_anomalies,
            "anomaly_rate": anomaly_rate,
            "details": result.anomaly_details
        }
