import csv
import os
import sqlite3
import chardet
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from config import ConfigManager
from logger import LoggerManager
from validator import DataValidator
from deduplicator import DataDeduplicator
from anomaly_detector import AnomalyDetector


class BatchStatus:
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"


class ImportResult:
    def __init__(self, filename: str):
        self.filename = filename
        self.total_records: int = 0
        self.valid_records: int = 0
        self.invalid_records: int = 0
        self.imported_records: int = 0
        self.duplicate_skipped: int = 0
        self.duplicate_overwritten: int = 0
        self.duplicate_marked: int = 0
        self.anomaly_marked: int = 0
        self.failed_records: int = 0
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.status: str = BatchStatus.PENDING
        self.error_records: List[Dict] = []


class DataImporter:
    CREATE_TABLE_SQL = """
    CREATE TABLE IF NOT EXISTS hydro_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_code TEXT NOT NULL,
        obs_time TEXT NOT NULL,
        water_level REAL NOT NULL,
        flow REAL NOT NULL,
        rainfall REAL NOT NULL,
        is_duplicate INTEGER DEFAULT 0,
        is_anomaly INTEGER DEFAULT 0,
        anomaly_types TEXT,
        import_time TEXT,
        source_file TEXT,
        UNIQUE(site_code, obs_time)
    );
    CREATE INDEX IF NOT EXISTS idx_hydro_site_time ON hydro_data(site_code, obs_time);
    CREATE INDEX IF NOT EXISTS idx_hydro_time ON hydro_data(obs_time);
    CREATE INDEX IF NOT EXISTS idx_hydro_site ON hydro_data(site_code);
    """

    CREATE_PROGRESS_TABLE_SQL = """
    CREATE TABLE IF NOT EXISTS import_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        total_records INTEGER DEFAULT 0,
        imported_records INTEGER DEFAULT 0,
        duplicate_skipped INTEGER DEFAULT 0,
        duplicate_overwritten INTEGER DEFAULT 0,
        duplicate_marked INTEGER DEFAULT 0,
        anomaly_marked INTEGER DEFAULT 0,
        failed_records INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_progress_filename ON import_progress(filename);
    CREATE INDEX IF NOT EXISTS idx_progress_status ON import_progress(status);
    """

    def __init__(self, config: ConfigManager, logger: LoggerManager):
        self.config = config
        self.logger = logger
        self.validator = DataValidator(config, logger)
        self.deduplicator = DataDeduplicator(config, logger)
        self.anomaly_detector = AnomalyDetector(config, logger)
        self.db_path = config.get_db_path()
        self._init_database()

    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.executescript(self.CREATE_TABLE_SQL)
        cursor.executescript(self.CREATE_PROGRESS_TABLE_SQL)
        conn.commit()
        conn.close()
        self.logger.info(f"数据库初始化完成: {self.db_path}")

    def _detect_encoding(self, file_path: str) -> str:
        with open(file_path, 'rb') as f:
            raw_data = f.read()
        result = chardet.detect(raw_data)
        encoding = result.get('encoding', 'utf-8')
        confidence = result.get('confidence', 0)
        self.logger.debug(f"文件编码检测: {encoding} (置信度: {confidence:.2f})", file=file_path)
        return encoding

    def _read_csv_file(self, file_path: str) -> List[Dict]:
        encoding = self._detect_encoding(file_path)
        records = []

        try:
            with open(file_path, 'r', encoding=encoding) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    records.append({k.strip(): v.strip() for k, v in row.items() if k})
        except UnicodeDecodeError:
            for alt_encoding in ['utf-8-sig', 'gbk', 'gb2312', 'gb18030']:
                try:
                    with open(file_path, 'r', encoding=alt_encoding) as f:
                        reader = csv.DictReader(f)
                        records = [{k.strip(): v.strip() for k, v in row.items() if k}
                                   for row in reader]
                    self.logger.info(f"使用备用编码 {alt_encoding} 成功读取文件", file=file_path)
                    break
                except UnicodeDecodeError:
                    continue

        self.logger.info(f"读取CSV文件: {len(records)} 条记录", file=file_path)
        return records

    def _get_existing_keys(self, records: List[Dict]) -> set:
        if not records:
            return set()

        placeholders = ",".join(["?"] * len(records))
        key_values = []
        for record in records:
            key_values.extend([record["site_code"], record["obs_time"]])

        sql = f"""
        SELECT site_code, obs_time FROM hydro_data
        WHERE (site_code, obs_time) IN ({','.join(['(?,?)'] * len(records))})
        """

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(sql, key_values)
        existing = set(cursor.fetchall())
        conn.close()
        return existing

    def _insert_records(self, records: List[Dict], source_file: str) -> int:
        if not records:
            return 0

        import_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        values = []

        for record in records:
            values.append((
                record["site_code"],
                record["obs_time"],
                float(record["water_level"]),
                float(record["flow"]),
                float(record["rainfall"]),
                record.get("is_duplicate", 0),
                record.get("is_anomaly", 0),
                record.get("anomaly_types", ""),
                import_time,
                source_file
            ))

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        strategy = self.deduplicator.strategy
        if strategy == "overwrite":
            sql = """
            INSERT OR REPLACE INTO hydro_data
            (site_code, obs_time, water_level, flow, rainfall,
             is_duplicate, is_anomaly, anomaly_types, import_time, source_file)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
        else:
            sql = """
            INSERT OR IGNORE INTO hydro_data
            (site_code, obs_time, water_level, flow, rainfall,
             is_duplicate, is_anomaly, anomaly_types, import_time, source_file)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """

        try:
            cursor.executemany(sql, values)
            conn.commit()
            inserted = cursor.rowcount
            conn.close()
            return inserted
        except sqlite3.Error as e:
            conn.close()
            raise e

    def _update_progress(self, result: ImportResult):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        if result.start_time and result.end_time:
            sql = """
            INSERT INTO import_progress
            (filename, total_records, imported_records, duplicate_skipped,
             duplicate_overwritten, duplicate_marked, anomaly_marked,
             failed_records, status, start_time, end_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            cursor.execute(sql, (
                result.filename,
                result.total_records,
                result.imported_records,
                result.duplicate_skipped,
                result.duplicate_overwritten,
                result.duplicate_marked,
                result.anomaly_marked,
                result.failed_records,
                result.status,
                result.start_time.strftime("%Y-%m-%d %H:%M:%S"),
                result.end_time.strftime("%Y-%m-%d %H:%M:%S")
            ))
        else:
            sql = """
            UPDATE import_progress SET status = ?, imported_records = ?
            WHERE filename = ? AND status = ?
            """
            cursor.execute(sql, (
                result.status,
                result.imported_records,
                result.filename,
                BatchStatus.PROCESSING
            ))

        conn.commit()
        conn.close()

    def _write_error_records(self, error_records: List[Dict], output_path: str):
        if not error_records:
            return

        fieldnames = ["line", "site_code", "obs_time", "water_level",
                      "flow", "rainfall", "error"]
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for err in error_records:
                row = {
                    "line": err.get("line", ""),
                    "site_code": err.get("record", {}).get("site_code", ""),
                    "obs_time": err.get("record", {}).get("obs_time", ""),
                    "water_level": err.get("record", {}).get("water_level", ""),
                    "flow": err.get("record", {}).get("flow", ""),
                    "rainfall": err.get("record", {}).get("rainfall", ""),
                    "error": err.get("error", "")
                }
                writer.writerow(row)

        self.logger.info(f"错误记录已写入: {output_path}")

    def import_file(self, file_path: str, error_output: Optional[str] = None) -> ImportResult:
        filename = os.path.basename(file_path)
        result = ImportResult(filename)
        result.start_time = datetime.now()
        result.status = BatchStatus.PROCESSING
        self.logger.log_file_start(filename)

        try:
            records = self._read_csv_file(file_path)
            result.total_records = len(records)

            valid_records, invalid_records = self.validator.validate_batch(records, filename)
            result.valid_records = len(valid_records)
            result.invalid_records = len(invalid_records)
            result.error_records.extend(invalid_records)

            existing_keys = self._get_existing_keys(valid_records)
            dedup_result = self.deduplicator.deduplicate_batch(
                valid_records, existing_keys, filename
            )
            result.duplicate_skipped = dedup_result.skipped_count
            result.duplicate_overwritten = dedup_result.overwritten_count
            result.duplicate_marked = dedup_result.marked_count

            anomaly_result = self.anomaly_detector.detect_anomalies(
                dedup_result.unique_records, filename
            )
            result.anomaly_marked = len(anomaly_result.anomaly_records)

            all_records = anomaly_result.normal_records + anomaly_result.anomaly_records
            imported = self._insert_records(all_records, filename)
            result.imported_records = imported

            result.status = BatchStatus.SUCCESS
            self.logger.log_file_end(
                filename, result.imported_records, result.invalid_records,
                result.duplicate_skipped + result.duplicate_marked,
                result.anomaly_marked
            )

        except Exception as e:
            result.status = BatchStatus.FAILED
            result.failed_records = result.total_records
            self.logger.error(f"文件处理失败: {e}", file=filename)

        finally:
            result.end_time = datetime.now()
            self._update_progress(result)

            if error_output and result.error_records:
                err_file = error_output or f"error_{filename}"
                self._write_error_records(result.error_records, err_file)

        return result

    def import_directory(self, dir_path: str, error_output_dir: str = "errors") -> List[ImportResult]:
        if not os.path.isdir(dir_path):
            raise ValueError(f"目录不存在: {dir_path}")

        os.makedirs(error_output_dir, exist_ok=True)
        results = []
        csv_files = sorted([
            f for f in os.listdir(dir_path)
            if f.lower().endswith('.csv')
        ])

        self.logger.info(f"开始批量导入目录: {dir_path}，共 {len(csv_files)} 个文件")

        for idx, filename in enumerate(csv_files, 1):
            file_path = os.path.join(dir_path, filename)
            error_file = os.path.join(error_output_dir, f"error_{filename}")
            self.logger.info(f"处理进度: {idx}/{len(csv_files)} - {filename}")

            try:
                result = self.import_file(file_path, error_file)
                results.append(result)
            except Exception as e:
                self.logger.error(f"处理文件 {filename} 时发生异常: {e}")

        return results

    def query_progress(self, start_date: Optional[str] = None,
                       end_date: Optional[str] = None,
                       status: Optional[str] = None) -> List[Dict]:
        sql = "SELECT * FROM import_progress WHERE 1=1"
        params = []

        if start_date:
            sql += " AND start_time >= ?"
            params.append(start_date)
        if end_date:
            sql += " AND start_time <= ?"
            params.append(end_date + " 23:59:59")
        if status:
            sql += " AND status = ?"
            params.append(status)

        sql += " ORDER BY start_time DESC"

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return rows

    def generate_report(self, start_date: Optional[str] = None,
                        end_date: Optional[str] = None) -> List[Dict]:
        sql = """
        SELECT
            site_code,
            COUNT(*) as total_records,
            SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END) as duplicate_count,
            SUM(CASE WHEN is_anomaly = 1 THEN 1 ELSE 0 END) as anomaly_count
        FROM hydro_data
        WHERE 1=1
        """
        params = []

        if start_date:
            sql += " AND obs_time >= ?"
            params.append(start_date)
        if end_date:
            sql += " AND obs_time <= ?"
            params.append(end_date + " 23:59")

        sql += " GROUP BY site_code ORDER BY site_code"

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = []
        for row in cursor.fetchall():
            d = dict(row)
            total = d["total_records"]
            d["duplicate_rate"] = d["duplicate_count"] / total if total > 0 else 0
            d["anomaly_rate"] = d["anomaly_count"] / total if total > 0 else 0
            rows.append(d)
        conn.close()
        return rows

    def export_report(self, output_path: str, start_date: Optional[str] = None,
                      end_date: Optional[str] = None):
        report_data = self.generate_report(start_date, end_date)

        fieldnames = ["site_code", "total_records", "duplicate_count",
                      "anomaly_count", "duplicate_rate", "anomaly_rate"]

        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in report_data:
                writer.writerow({
                    "site_code": row["site_code"],
                    "total_records": row["total_records"],
                    "duplicate_count": row["duplicate_count"],
                    "anomaly_count": row["anomaly_count"],
                    "duplicate_rate": f"{row['duplicate_rate']:.4f}",
                    "anomaly_rate": f"{row['anomaly_rate']:.4f}"
                })

        self.logger.info(f"报表已导出: {output_path}，共 {len(report_data)} 个站点")
        return output_path
