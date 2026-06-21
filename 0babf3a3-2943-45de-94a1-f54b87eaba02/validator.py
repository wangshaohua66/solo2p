import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from config import ConfigManager
from logger import LoggerManager


class ValidationResult:
    def __init__(self, is_valid: bool, error_message: str = ""):
        self.is_valid = is_valid
        self.error_message = error_message


class DataValidator:
    TIME_FORMAT_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$')
    REQUIRED_FIELDS = ["site_code", "obs_time", "water_level", "flow", "rainfall"]

    def __init__(self, config: ConfigManager, logger: LoggerManager):
        self.config = config
        self.logger = logger
        self.valid_stations = set(config.get_valid_stations())
        self._load_thresholds()

    def _load_thresholds(self):
        self.wl_min = self.config.get_threshold("water_level_min")
        self.wl_max = self.config.get_threshold("water_level_max")
        self.flow_min = self.config.get_threshold("flow_min")
        self.flow_max = self.config.get_threshold("flow_max")
        self.rain_min = self.config.get_threshold("rainfall_min")
        self.rain_max = self.config.get_threshold("rainfall_max")

    def validate_record(self, record: Dict, filename: str, line_num: int) -> ValidationResult:
        for field in self.REQUIRED_FIELDS:
            if field not in record or record[field] is None or str(record[field]).strip() == "":
                return ValidationResult(False, f"缺少必填字段: {field}")

        station_result = self._validate_station_code(record["site_code"])
        if not station_result.is_valid:
            self.logger.log_validation_error(filename, line_num, record, station_result.error_message)
            return station_result

        time_result = self._validate_time_format(record["obs_time"])
        if not time_result.is_valid:
            self.logger.log_validation_error(filename, line_num, record, time_result.error_message)
            return time_result

        try:
            water_level = float(record["water_level"])
        except (ValueError, TypeError):
            msg = f"水位数转换失败: {record['water_level']}"
            self.logger.log_validation_error(filename, line_num, record, msg)
            return ValidationResult(False, msg)

        wl_result = self._validate_water_level(water_level)
        if not wl_result.is_valid:
            self.logger.log_validation_error(filename, line_num, record, wl_result.error_message)
            return wl_result

        try:
            flow = float(record["flow"])
        except (ValueError, TypeError):
            msg = f"流量值转换失败: {record['flow']}"
            self.logger.log_validation_error(filename, line_num, record, msg)
            return ValidationResult(False, msg)

        flow_result = self._validate_flow(flow)
        if not flow_result.is_valid:
            self.logger.log_validation_error(filename, line_num, record, flow_result.error_message)
            return flow_result

        try:
            rainfall = float(record["rainfall"])
        except (ValueError, TypeError):
            msg = f"降雨量值转换失败: {record['rainfall']}"
            self.logger.log_validation_error(filename, line_num, record, msg)
            return ValidationResult(False, msg)

        rain_result = self._validate_rainfall(rainfall)
        if not rain_result.is_valid:
            self.logger.log_validation_error(filename, line_num, record, rain_result.error_message)
            return rain_result

        return ValidationResult(True)

    def _validate_station_code(self, station_code: str) -> ValidationResult:
        if not station_code:
            return ValidationResult(False, "站点编码为空")
        if station_code not in self.valid_stations:
            return ValidationResult(False, f"无效站点编码: {station_code}")
        return ValidationResult(True)

    def _validate_time_format(self, obs_time: str) -> ValidationResult:
        if not obs_time:
            return ValidationResult(False, "观测时间为空")

        if not self.TIME_FORMAT_PATTERN.match(obs_time):
            return ValidationResult(False, f"时间格式错误: {obs_time}，应为 YYYY-MM-DD HH:MM")

        try:
            datetime.strptime(obs_time, "%Y-%m-%d %H:%M")
        except ValueError as e:
            return ValidationResult(False, f"时间解析失败: {obs_time}，错误: {e}")

        return ValidationResult(True)

    def _validate_water_level(self, value: float) -> ValidationResult:
        if value < self.wl_min or value > self.wl_max:
            return ValidationResult(
                False,
                f"水位值超出范围: {value}，有效范围 [{self.wl_min}, {self.wl_max}] 米"
            )
        return ValidationResult(True)

    def _validate_flow(self, value: float) -> ValidationResult:
        if value < self.flow_min or value > self.flow_max:
            return ValidationResult(
                False,
                f"流量值超出范围: {value}，有效范围 [{self.flow_min}, {self.flow_max}] 立方米/秒"
            )
        return ValidationResult(True)

    def _validate_rainfall(self, value: float) -> ValidationResult:
        if value < self.rain_min or value > self.rain_max:
            return ValidationResult(
                False,
                f"降雨量超出范围: {value}，有效范围 [{self.rain_min}, {self.rain_max}] 毫米"
            )
        return ValidationResult(True)

    def validate_batch(self, records: List[Dict], filename: str) -> Tuple[List[Dict], List[Dict]]:
        valid_records = []
        invalid_records = []

        for idx, record in enumerate(records, start=2):
            result = self.validate_record(record, filename, idx)
            if result.is_valid:
                valid_records.append(record)
            else:
                invalid_records.append({
                    "line": idx,
                    "record": record,
                    "error": result.error_message
                })

        return valid_records, invalid_records

    def reload_stations(self):
        self.config.reload()
        self.valid_stations = set(self.config.get_valid_stations())
