#!/usr/bin/env python3
"""HAMLOG - Amateur Radio Logging Tool

A fast, terminal-based QSO logger with DXCC/WAS/WAZ award tracking
and propagation prediction.

Usage:
    hamlog qso add [options]
    hamlog qso search [options]
    hamlog qso export [options]
    hamlog qso import <file>
    hamlog award status [--band <band>]
    hamlog propagation [--band <band>]
    hamlog contest
    hamlog config [show|set]
"""

import argparse
import csv
import datetime
import io
import logging
import os
import re
import sqlite3
import subprocess
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

VERSION = "1.0.0"

BANDS = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "2m", "70cm"]
MODES = ["SSB", "CW", "FT8", "FT4", "RTTY", "PSK31", "JT65", "JT9", "JS8", "OLIVIA", "DOMINO", "HELL", "SSTV", "FM", "AM"]

BAND_FREQ_RANGES = {
    "160m": (1.8, 2.0), "80m": (3.5, 4.0), "60m": (5.0, 5.5),
    "40m": (7.0, 7.3), "30m": (10.1, 10.15), "20m": (14.0, 14.35),
    "17m": (18.068, 18.168), "15m": (21.0, 21.45), "12m": (24.89, 24.99),
    "10m": (28.0, 29.7), "6m": (50.0, 54.0), "2m": (144.0, 148.0),
    "70cm": (420.0, 450.0),
}

CALLSIGN_RE = re.compile(r'^[A-Z0-9]{1,3}[0-9][A-Z0-9]{1,4}$')
GRID_RE = re.compile(r'^[A-Ra-r]{2}[0-9]{2}([A-Xa-x]{2})?$')
logger = logging.getLogger("hamlog")


class _ConfigManager:
    def __init__(self):
        self._cached_config: Optional[Dict[str, Any]] = None
        self._cached_mtime: Optional[float] = None

    @property
    def _config_dir(self) -> Path:
        return Path(os.environ.get("HAMLOG_DATA_DIR", str(Path.home() / ".hamlog")))

    @property
    def _yaml_path(self) -> Path:
        return self._config_dir / "config.yaml"

    @property
    def _ini_path(self) -> Path:
        return self._config_dir / "config.ini"

    def _current_mtime(self) -> Optional[float]:
        for p in (self._yaml_path, self._ini_path):
            if p.exists():
                return p.stat().st_mtime
        return None

    def _needs_reload(self) -> bool:
        if self._cached_config is None:
            return True
        current = self._current_mtime()
        if current is None and self._cached_mtime is None:
            return False
        if current is None or self._cached_mtime is None:
            return True
        return current != self._cached_mtime

    def get_config(self) -> Dict[str, Any]:
        if self._needs_reload():
            self._cached_config = self._load_config()
            self._cached_mtime = self._current_mtime()
        return self._cached_config

    def _load_config(self) -> Dict[str, Any]:
        config = _deep_merge({}, DEFAULT_CONFIG)
        yaml_config = _load_yaml_config(self._yaml_path)
        if yaml_config is not None:
            config = _deep_merge(config, yaml_config)
        else:
            ini_config = _load_ini_config(self._ini_path)
            config = _deep_merge(config, ini_config)
        config = _apply_env_overrides(config)
        return config


_config_manager = _ConfigManager()


def _get_config_dir() -> Path:
    return Path(os.environ.get("HAMLOG_DATA_DIR", str(Path.home() / ".hamlog")))


CONFIG_DIR = _get_config_dir()
CONFIG_FILE = CONFIG_DIR / "config.yaml"
CONFIG_FILE_INI = CONFIG_DIR / "config.ini"

DEFAULT_CONFIG: Dict[str, Any] = {
    "operator": {"callsign": "", "name": "", "grid": "", "qth": "", "latitude": 0.0, "longitude": 0.0, "tx_pwr": 100.0, "rig": "", "antenna": ""},
    "preferences": {"units": "metric", "date_format": "%Y-%m-%d", "time_format": "%H:%M", "default_band": "20m", "default_mode": "SSB", "contest_mode": False},
    "logging": {"level": "INFO", "file": str(Path.home() / ".hamlog" / "hamlog.log")},
    "propagation": {"cache_ttl": 3600, "hamqsl_url": "https://www.hamqsl.com/solarxml.php"},
}


def _load_yaml_config(path: Path) -> Optional[Dict[str, Any]]:
    try:
        import yaml
        if path.exists():
            with open(path, "r") as f:
                return yaml.safe_load(f) or {}
    except ImportError:
        pass
    except Exception as e:
        logger.warning("Failed to load YAML config: %s", e)
    return None


def _load_ini_config(path: Path) -> Dict[str, Any]:
    import configparser
    config = {}
    if path.exists():
        parser = configparser.ConfigParser()
        parser.read(str(path))
        for section in parser.sections():
            config[section] = dict(parser[section])
    return config


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _apply_env_overrides(config: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in os.environ.items():
        if not key.startswith("HAMLOG_"):
            continue
        parts = key[len("HAMLOG_"):].lower().split("_", 1)
        if len(parts) == 2:
            section, option = parts
            if section in config and isinstance(config[section], dict):
                current = config[section].get(option)
                if isinstance(current, bool):
                    config[section][option] = value.lower() in ("true", "1", "yes")
                elif isinstance(current, int):
                    try: config[section][option] = int(value)
                    except ValueError: pass
                elif isinstance(current, float):
                    try: config[section][option] = float(value)
                    except ValueError: pass
                else:
                    config[section][option] = value
    return config


def get_config() -> Dict[str, Any]:
    return _config_manager.get_config()


def save_config(config: Dict[str, Any]) -> None:
    config_dir = _config_manager._config_dir
    yaml_path = _config_manager._yaml_path
    ini_path = _config_manager._ini_path
    config_dir.mkdir(parents=True, exist_ok=True)
    try:
        import yaml
        with open(yaml_path, "w") as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False)
        logger.info("Config saved to %s", yaml_path)
        return
    except ImportError:
        pass
    except Exception as e:
        logger.warning("Failed to save YAML config: %s", e)
    import configparser
    parser = configparser.ConfigParser()
    for section, values in config.items():
        if isinstance(values, dict):
            parser[section] = {k: str(v) for k, v in values.items()}
        else:
            parser[section] = {"value": str(values)}
    with open(ini_path, "w") as f:
        parser.write(f)
    logger.info("Config saved to %s", ini_path)


def generate_default_config() -> None:
    yaml_path = _config_manager._yaml_path
    ini_path = _config_manager._ini_path
    if yaml_path.exists() or ini_path.exists():
        return
    template = _deep_merge({}, DEFAULT_CONFIG)
    template["operator"]["callsign"] = "YOURCALL"
    template["operator"]["name"] = "Your Name"
    template["operator"]["grid"] = "AB12cd"
    template["operator"]["qth"] = "Your City"
    save_config(template)
    logger.info("Default config template generated")


def get_config_path() -> Path:
    yaml_path = _config_manager._yaml_path
    ini_path = _config_manager._ini_path
    if yaml_path.exists():
        return yaml_path
    return ini_path


DB_FILENAME = "hamlog.db"
SCHEMA_VERSION = 3


def get_db_path() -> Path:
    base_dir = Path(os.environ.get("HAMLOG_DATA_DIR", str(Path.home() / ".hamlog")))
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir / DB_FILENAME


def _regexp_match(pattern: str, string: str) -> bool:
    if string is None:
        return False
    try:
        return re.search(pattern, string) is not None
    except re.error:
        return False


class Database:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or get_db_path()
        self._conn: Optional[sqlite3.Connection] = None
        self._ensure_directory()

    def _ensure_directory(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.row_factory = sqlite3.Row
            self._conn.create_function("REGEXP", 2, _regexp_match)
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA synchronous=NORMAL")
            self._conn.execute("PRAGMA cache_size=-4096")
            self._conn.execute("PRAGMA temp_store=MEMORY")
            self._conn.execute("PRAGMA foreign_keys=ON")
        return self._conn

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False

    def init_schema(self):
        current_version = self._get_schema_version()
        if current_version < SCHEMA_VERSION:
            self._migrate(current_version)
            self.conn.commit()
            self.conn.execute("ANALYZE")
        logger.debug("Schema initialized at version %d", SCHEMA_VERSION)

    def _get_schema_version(self) -> int:
        cursor = self.conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
        if cursor.fetchone() is None:
            return 0
        cursor = self.conn.execute("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1")
        row = cursor.fetchone()
        return row["version"] if row else 0

    def _migrate(self, from_version: int):
        migrations = {1: self._migrate_v1, 2: self._migrate_v2, 3: self._migrate_v3}
        for version in range(from_version + 1, SCHEMA_VERSION + 1):
            logger.info("Migrating schema to version %d", version)
            migrations[version]()
            self.conn.execute("INSERT INTO schema_version (version, applied_at) VALUES (?, datetime('now'))", (version,))

    def _migrate_v1(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS qsos (
                id INTEGER PRIMARY KEY AUTOINCREMENT, callsign TEXT NOT NULL, qso_date TEXT NOT NULL,
                qso_time TEXT NOT NULL, band TEXT NOT NULL, mode TEXT NOT NULL, freq REAL,
                rst_sent TEXT, rst_rcvd TEXT, grid TEXT, name TEXT, qth TEXT, state TEXT,
                cq_zone INTEGER, ituzone INTEGER, dxcc INTEGER, country TEXT, operator TEXT,
                station_callsign TEXT, my_grid TEXT, tx_pwr REAL, rig TEXT, antenna TEXT,
                comment TEXT, notes TEXT, contest_id TEXT, srx INTEGER, srx_string TEXT,
                stx INTEGER, stx_string TEXT, qsl_rcvd TEXT DEFAULT 'N', qsl_sent TEXT DEFAULT 'N',
                lotw_rcvd TEXT DEFAULT 'N', lotw_sent TEXT DEFAULT 'N',
                created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_qso_unique ON qsos(callsign, qso_date, qso_time, band, mode);
            CREATE INDEX IF NOT EXISTS idx_qso_callsign ON qsos(callsign);
            CREATE INDEX IF NOT EXISTS idx_qso_date ON qsos(qso_date);
            CREATE INDEX IF NOT EXISTS idx_qso_band_mode ON qsos(band, mode);
            CREATE INDEX IF NOT EXISTS idx_qso_band_mode_date ON qsos(band, mode, qso_date DESC, qso_time DESC);
            CREATE INDEX IF NOT EXISTS idx_qso_dxcc ON qsos(dxcc);
            CREATE INDEX IF NOT EXISTS idx_qso_state ON qsos(state);
            CREATE INDEX IF NOT EXISTS idx_qso_cq_zone ON qsos(cq_zone);
        """)

    def _migrate_v2(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS propagation_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT, cache_date TEXT NOT NULL UNIQUE,
                sfi REAL, a_index INTEGER, k_index REAL, ssn INTEGER,
                solar_wind_speed REAL, x_ray REAL, flux_line TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS dxcc_entities (
                id INTEGER PRIMARY KEY, name TEXT NOT NULL, prefix TEXT,
                continent TEXT, ituzone INTEGER, cq_zone INTEGER, deleted INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS us_states (abbreviation TEXT PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS cq_zones (zone INTEGER PRIMARY KEY, name TEXT);
        """)

    def _migrate_v3(self):
        self.conn.executescript("""
            ALTER TABLE qsos ADD COLUMN freq_rx REAL;
            ALTER TABLE qsos ADD COLUMN band_rx TEXT;
            ALTER TABLE qsos ADD COLUMN a_index INTEGER;
            ALTER TABLE qsos ADD COLUMN cont TEXT;
            ALTER TABLE qsos ADD COLUMN qrzcom_qso_upload_date TEXT;
            ALTER TABLE qsos ADD COLUMN qsl_rcvd_date TEXT;
            ALTER TABLE qsos ADD COLUMN qsl_sent_date TEXT;
            ALTER TABLE qsos ADD COLUMN lotw_rcvd_date TEXT;
            ALTER TABLE qsos ADD COLUMN lotw_sent_date TEXT;
            CREATE INDEX IF NOT EXISTS idx_qso_covering ON qsos(callsign, qso_date, band, mode, dxcc, state, cq_zone);
        """)

    def execute(self, sql: str, params: Tuple = ()) -> sqlite3.Cursor:
        return self.conn.execute(sql, params)

    def executemany(self, sql: str, seq_of_params: List[Tuple]) -> sqlite3.Cursor:
        return self.conn.executemany(sql, seq_of_params)

    def query_one(self, sql: str, params: Tuple = ()) -> Optional[sqlite3.Row]:
        return self.conn.execute(sql, params).fetchone()

    def query_all(self, sql: str, params: Tuple = ()) -> List[sqlite3.Row]:
        return self.conn.execute(sql, params).fetchall()

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()


@dataclass
class DXCCEntity:
    entity_id: int
    name: str
    prefix: str
    continent: str
    cq_zone: int
    ituzone: int
    flag: str = ""
    deleted: bool = False


_DXCC_RAW: List[Tuple] = [
    (1,"United States of America","K","NA",4,8,"US",False),
    (2,"Hawaii","KH6","OC",31,46,"US",False),
    (3,"Alaska","KL7","NA",1,28,"US",False),
    (4,"Puerto Rico","KP4","NA",8,18,"PR",False),
    (5,"US Virgin Islands","KP2","NA",8,18,"VI",False),
    (6,"American Samoa","KH8","OC",31,45,"AS",False),
    (7,"Guam","KH2","OC",29,46,"GU",False),
    (8,"Northern Mariana Islands","KH0","OC",29,46,"MP",False),
    (9,"Midway Island","KH4","OC",31,47,"UM",False),
    (10,"Johnston Atoll","KH3","OC",31,47,"UM",False),
    (11,"Baker & Howland Islands","KH1","OC",31,46,"UM",False),
    (12,"Navassa Island","KZ5","NA",8,18,"UM",False),
    (13,"Guantanamo Bay","KG4","NA",8,18,"US",False),
    (20,"Canada","VE","NA",5,2,"CA",False),
    (30,"Mexico","XE","NA",6,9,"MX",False),
    (40,"Cuba","CO","NA",8,18,"CU",False),
    (41,"Bahamas","C6","NA",8,18,"BS",False),
    (42,"Jamaica","6Y","NA",8,18,"JM",False),
    (43,"Haiti","HH","NA",8,18,"HT",False),
    (44,"Dominican Republic","HI","NA",8,18,"DO",False),
    (45,"Belize","V3","NA",6,18,"BZ",False),
    (46,"Guatemala","TG","NA",6,18,"GT",False),
    (47,"Honduras","HQ","NA",7,18,"HN",False),
    (48,"El Salvador","YS","NA",6,18,"SV",False),
    (49,"Nicaragua","YN","NA",7,18,"NI",False),
    (50,"Costa Rica","TI","NA",7,18,"CR",False),
    (51,"Panama","HP","NA",9,19,"PA",False),
    (60,"Antigua & Barbuda","V2","NA",8,18,"AG",False),
    (61,"St. Kitts & Nevis","V4","NA",8,18,"KN",False),
    (62,"Montserrat","M0","NA",8,18,"MS",False),
    (63,"Guadeloupe","FG","NA",8,18,"GP",False),
    (64,"Dominica","J7","NA",8,18,"DM",False),
    (65,"Martinique","FM","NA",8,18,"MQ",False),
    (66,"St. Lucia","J6","NA",9,18,"LC",False),
    (67,"St. Vincent","J8","NA",9,18,"VC",False),
    (68,"Barbados","8P","NA",9,19,"BB",False),
    (69,"Grenada","J3","NA",9,19,"GD",False),
    (70,"Trinidad & Tobago","9Y","SA",9,19,"TT",False),
    (71,"Aruba","P4","SA",9,19,"AW",False),
    (72,"Curacao","PJ2","SA",9,19,"CW",False),
    (73,"Bonaire","PJ4","SA",9,19,"BQ",False),
    (100,"Colombia","HK","SA",12,25,"CO",False),
    (101,"Venezuela","YV","SA",11,28,"VE",False),
    (102,"Guyana","8R","SA",9,19,"GY",False),
    (103,"Suriname","PZ","SA",9,19,"SR",False),
    (104,"French Guiana","FY","SA",9,19,"GF",False),
    (105,"Ecuador","HC","SA",12,24,"EC",False),
    (106,"Peru","OA","SA",14,25,"PE",False),
    (107,"Brazil","PY","SA",16,27,"BR",False),
    (108,"Bolivia","CP","SA",14,26,"BO",False),
    (109,"Paraguay","ZP","SA",13,26,"PY",False),
    (110,"Chile","CE","SA",15,24,"CL",False),
    (111,"Argentina","LU","SA",13,26,"AR",False),
    (112,"Uruguay","CX","SA",13,27,"UY",False),
    (120,"Falkland Islands","VP8","SA",15,27,"FK",False),
    (121,"South Georgia Island","VP8","SA",15,27,"GS",False),
    (200,"Iceland","TF","EU",14,28,"IS",False),
    (201,"Greenland","OX","NA",2,28,"GL",False),
    (202,"Faroe Islands","OY","EU",14,28,"FO",False),
    (203,"Svalbard","JW","EU",14,28,"SJ",False),
    (204,"Jan Mayen","JX","EU",14,28,"SJ",False),
    (205,"Norway","LA","EU",14,28,"NO",False),
    (206,"Sweden","SM","EU",14,28,"SE",False),
    (207,"Finland","OH","EU",15,28,"FI",False),
    (208,"Denmark","OZ","EU",14,28,"DK",False),
    (209,"United Kingdom","G","EU",14,27,"GB",False),
    (210,"England","G","EU",14,27,"GB",False),
    (211,"Scotland","GM","EU",14,28,"GB",False),
    (212,"Wales","GW","EU",14,27,"GB",False),
    (213,"Northern Ireland","GI","EU",14,27,"GB",False),
    (214,"Ireland","EI","EU",14,27,"IE",False),
    (215,"Isle of Man","GD","EU",14,27,"IM",False),
    (216,"Jersey","GJ","EU",14,27,"JE",False),
    (217,"Guernsey","GU","EU",14,27,"GG",False),
    (220,"France","F","EU",14,27,"FR",False),
    (221,"Monaco","3A","EU",14,27,"MC",False),
    (222,"Belgium","ON","EU",14,27,"BE",False),
    (223,"Luxembourg","LX","EU",14,27,"LU",False),
    (224,"Netherlands","PA","EU",14,27,"NL",False),
    (225,"Germany","DL","EU",14,28,"DE",False),
    (226,"Switzerland","HB","EU",14,28,"CH",False),
    (227,"Liechtenstein","HB0","EU",14,28,"LI",False),
    (228,"Austria","OE","EU",15,28,"AT",False),
    (230,"Spain","EA","EU",14,27,"ES",False),
    (231,"Portugal","CT","EU",14,27,"PT",False),
    (232,"Andorra","C3","EU",14,27,"AD",False),
    (233,"Gibraltar","ZB","EU",14,27,"GI",False),
    (234,"Azores","CU","EU",14,27,"PT",False),
    (235,"Madeira","CT3","EU",14,27,"PT",False),
    (236,"Canary Islands","EA8","EU",14,27,"IC",False),
    (240,"Italy","I","EU",15,28,"IT",False),
    (241,"San Marino","T7","EU",15,28,"SM",False),
    (242,"Vatican City","HV","EU",15,28,"VA",False),
    (243,"Malta","9H","EU",15,28,"MT",False),
    (244,"Corsica","TK","EU",15,28,"FR",False),
    (245,"Sardinia","IS0","EU",15,28,"IT",False),
    (246,"Sicily","IT9","EU",16,28,"IT",False),
    (250,"Poland","SP","EU",15,28,"PL",False),
    (251,"Czech Republic","OK","EU",15,28,"CZ",False),
    (252,"Slovakia","OM","EU",15,28,"SK",False),
    (253,"Hungary","HA","EU",15,28,"HU",False),
    (254,"Romania","YO","EU",16,28,"RO",False),
    (255,"Bulgaria","LZ","EU",16,28,"BG",False),
    (256,"Greece","SV","EU",16,28,"GR",False),
    (257,"Cyprus","5B","EU",16,29,"CY",False),
    (258,"Crete","SV9","EU",16,28,"GR",False),
    (260,"Croatia","9A","EU",15,28,"HR",False),
    (261,"Slovenia","S5","EU",15,28,"SI",False),
    (262,"Bosnia-Herzegovina","E7","EU",15,28,"BA",False),
    (263,"Serbia","YU","EU",15,28,"RS",False),
    (264,"Montenegro","4O","EU",15,28,"ME",False),
    (265,"North Macedonia","Z3","EU",16,28,"MK",False),
    (266,"Albania","ZA","EU",16,28,"AL",False),
    (268,"Turkey","TA","EU",17,28,"TR",False),
    (270,"Estonia","ES","EU",15,29,"EE",False),
    (271,"Latvia","YL","EU",15,29,"LV",False),
    (272,"Lithuania","LY","EU",15,29,"LT",False),
    (273,"Belarus","EW","EU",15,29,"BY",False),
    (274,"Ukraine","UR","EU",16,29,"UA",False),
    (275,"Moldova","ER","EU",16,29,"MD",False),
    (276,"Russia","UA","EU",16,29,"RU",False),
    (277,"Kaliningrad","UA2","EU",15,28,"RU",False),
    (278,"Georgia","4L","EU",17,29,"GE",False),
    (279,"Armenia","EK","AS",18,29,"AM",False),
    (280,"Azerbaijan","4J","AS",18,29,"AZ",False),
    (281,"Kazakhstan","UN","AS",17,29,"KZ",False),
    (282,"Uzbekistan","UK","AS",18,30,"UZ",False),
    (283,"Turkmenistan","EZ","AS",18,30,"TM",False),
    (284,"Kyrgyzstan","EX","AS",18,30,"KG",False),
    (285,"Tajikistan","EY","AS",18,30,"TJ",False),
    (286,"Mongolia","JT","AS",23,43,"MN",False),
    (287,"Afghanistan","YA","AS",21,39,"AF",False),
    (300,"Israel","4X","AS",20,39,"IL",False),
    (301,"Palestine","E4","AS",20,39,"PS",False),
    (302,"Jordan","JY","AS",20,39,"JO",False),
    (303,"Lebanon","OD","AS",20,39,"LB",False),
    (304,"Syria","YK","AS",20,39,"SY",False),
    (305,"Iraq","YI","AS",19,39,"IQ",False),
    (306,"Iran","EP","AS",19,39,"IR",False),
    (307,"Saudi Arabia","HZ","AS",21,39,"SA",False),
    (308,"Kuwait","9K","AS",21,39,"KW",False),
    (309,"Bahrain","A9","AS",21,39,"BH",False),
    (310,"Qatar","A7","AS",21,39,"QA",False),
    (311,"United Arab Emirates","A6","AS",21,39,"AE",False),
    (312,"Oman","A4","AS",21,39,"OM",False),
    (313,"Yemen","7O","AS",21,39,"YE",False),
    (320,"Egypt","SU","AF",17,38,"EG",False),
    (321,"Libya","5A","AF",17,38,"LY",False),
    (322,"Tunisia","3V","AF",17,38,"TN",False),
    (323,"Algeria","7X","AF",17,38,"DZ",False),
    (324,"Morocco","CN","AF",17,38,"MA",False),
    (325,"Western Sahara","S0","AF",16,38,"EH",False),
    (326,"Mauritania","5T","AF",16,38,"MR",False),
    (327,"Senegal","6W","AF",15,38,"SN",False),
    (328,"Gambia","C5","AF",15,38,"GM",False),
    (329,"Cape Verde","D4","AF",15,38,"CV",False),
    (330,"Guinea-Bissau","J5","AF",15,38,"GW",False),
    (331,"Guinea","3X","AF",15,38,"GN",False),
    (332,"Sierra Leone","9L","AF",15,38,"SL",False),
    (333,"Liberia","EL","AF",15,38,"LR",False),
    (334,"Ivory Coast","TU","AF",15,38,"CI",False),
    (335,"Ghana","9G","AF",15,38,"GH",False),
    (336,"Togo","5V","AF",15,38,"TG",False),
    (337,"Benin","TY","AF",15,38,"BJ",False),
    (338,"Nigeria","5N","AF",16,38,"NG",False),
    (339,"Niger","5U","AF",16,38,"NE",False),
    (340,"Chad","TT","AF",17,38,"TD",False),
    (341,"Sudan","ST","AF",17,39,"SD",False),
    (342,"South Sudan","Z8","AF",17,39,"SS",False),
    (343,"Central African Republic","TL","AF",17,38,"CF",False),
    (344,"Cameroon","TJ","AF",16,38,"CM",False),
    (345,"Equatorial Guinea","3C","AF",16,38,"GQ",False),
    (346,"Gabon","TR","AF",16,38,"GA",False),
    (347,"Congo (Republic)","TN","AF",16,38,"CG",False),
    (348,"Congo (DRC)","9Q","AF",17,38,"CD",False),
    (349,"Uganda","5X","AF",17,38,"UG",False),
    (350,"Kenya","5Z","AF",18,38,"KE",False),
    (351,"Tanzania","5H","AF",18,38,"TZ",False),
    (352,"Rwanda","9X","AF",17,38,"RW",False),
    (353,"Burundi","9U","AF",17,38,"BI",False),
    (354,"Ethiopia","ET","AF",18,38,"ET",False),
    (355,"Somalia","T5","AF",18,38,"SO",False),
    (356,"Djibouti","J2","AF",18,39,"DJ",False),
    (357,"Eritrea","E3","AF",18,39,"ER",False),
    (360,"Angola","D2","AF",16,39,"AO",False),
    (361,"Zambia","9J","AF",17,39,"ZM",False),
    (362,"Malawi","7Q","AF",17,39,"MW",False),
    (363,"Mozambique","C9","AF",18,39,"MZ",False),
    (364,"Zimbabwe","Z2","AF",17,39,"ZW",False),
    (365,"Botswana","A2","AF",17,39,"BW",False),
    (366,"Namibia","V5","AF",16,39,"NA",False),
    (367,"South Africa","ZS","AF",16,39,"ZA",False),
    (368,"Lesotho","7P","AF",16,39,"LS",False),
    (369,"Eswatini","3DA","AF",17,39,"SZ",False),
    (370,"Madagascar","5R","AF",19,39,"MG",False),
    (371,"Comoros","D6","AF",18,39,"KM",False),
    (372,"Mauritius","3B8","AF",19,39,"MU",False),
    (373,"Seychelles","S7","AF",19,39,"SC",False),
    (374,"Reunion","FR","AF",19,39,"RE",False),
    (375,"Mayotte","FH","AF",19,39,"YT",False),
    (376,"St. Helena","ZD7","AF",16,38,"SH",False),
    (377,"Ascension Island","ZD8","AF",16,38,"AC",False),
    (378,"Tristan da Cunha","ZD9","AF",15,38,"TA",False),
    (379,"Bouvet Island","3Y","AF",15,38,"BV",False),
    (400,"Pakistan","AP","AS",21,39,"PK",False),
    (401,"India","VU","AS",22,39,"IN",False),
    (402,"Sri Lanka","4S","AS",22,39,"LK",False),
    (403,"Nepal","9N","AS",22,39,"NP",False),
    (404,"Bhutan","A5","AS",22,39,"BT",False),
    (405,"Bangladesh","S2","AS",23,39,"BD",False),
    (406,"Myanmar","XZ","AS",26,41,"MM",False),
    (407,"Thailand","HS","AS",26,41,"TH",False),
    (408,"Laos","XW","AS",26,41,"LA",False),
    (409,"Vietnam","XV","AS",26,41,"VN",False),
    (410,"Cambodia","XU","AS",26,41,"KH",False),
    (411,"Malaysia","9M","AS",26,40,"MY",False),
    (412,"Singapore","9V","AS",26,40,"SG",False),
    (413,"Brunei","V8","AS",28,40,"BN",False),
    (414,"Philippines","DU","AS",27,42,"PH",False),
    (415,"Indonesia","YB","AS",28,40,"ID",False),
    (416,"Timor-Leste","4W","OC",28,40,"TL",False),
    (420,"China","BY","AS",24,44,"CN",False),
    (421,"Hong Kong","VR","AS",24,44,"HK",False),
    (422,"Macao","XX9","AS",24,44,"MO",False),
    (423,"Taiwan","BV","AS",24,44,"TW",False),
    (424,"South Korea","HL","AS",25,44,"KR",False),
    (425,"North Korea","P5","AS",25,44,"KP",False),
    (426,"Japan","JA","AS",25,45,"JP",False),
    (427,"Okinawa","JR6","AS",25,45,"JP",False),
    (428,"Iwo Jima","JD1","OC",25,46,"JP",False),
    (429,"Minami-Tori-Shima","JD1","OC",25,47,"JP",False),
    (430,"Ogasawara","JD1","OC",25,46,"JP",False),
    (440,"Papua New Guinea","P2","OC",29,42,"PG",False),
    (441,"Solomon Islands","H4","OC",30,42,"SB",False),
    (442,"Vanuatu","YJ","OC",30,44,"VU",False),
    (443,"New Caledonia","FK","OC",30,44,"NC",False),
    (444,"Fiji","3D2","OC",30,44,"FJ",False),
    (445,"Tonga","A3","OC",30,45,"TO",False),
    (446,"Samoa","5W","OC",31,45,"WS",False),
    (447,"Niue","ZK2","OC",32,46,"NU",False),
    (448,"Cook Islands","E5","OC",32,46,"CK",False),
    (449,"French Polynesia","FO","OC",31,46,"PF",False),
    (450,"Austral Islands","FO","OC",31,46,"PF",False),
    (451,"Marquesas Islands","FO","OC",31,46,"PF",False),
    (452,"Tuvalu","T2","OC",30,45,"TV",False),
    (453,"Kiribati","T3","OC",30,43,"KI",False),
    (454,"Marshall Islands","V7","OC",28,43,"MH",False),
    (455,"Micronesia","V6","OC",28,43,"FM",False),
    (456,"Palau","T8","OC",28,43,"PW",False),
    (457,"Nauru","C2","OC",28,43,"NR",False),
    (458,"Wake Island","K9","OC",31,46,"UM",False),
    (459,"Jarvis Island","K9","OC",31,47,"UM",False),
    (460,"Palmyra Atoll","K5P","OC",31,47,"UM",False),
    (461,"Kingman Reef","K5K","OC",31,47,"UM",False),
    (462,"Tokelau","ZK3","OC",30,45,"TK",False),
    (463,"Wallis & Futuna","FW","OC",30,45,"WF",False),
    (464,"American Samoa","KH8","OC",31,45,"AS",False),
    (465,"Australia","VK","OC",29,44,"AU",False),
    (466,"Norfolk Island","VK9N","OC",32,46,"NF",False),
    (467,"Lord Howe Island","VK9L","OC",30,44,"AU",False),
    (468,"Cocos (Keeling) Islands","VK9C","OC",29,44,"CC",False),
    (469,"Christmas Island","VK9X","OC",29,44,"CX",False),
    (470,"New Zealand","ZL","OC",32,46,"NZ",False),
    (471,"Chatham Islands","ZL7","OC",32,46,"NZ",False),
    (472,"Auckland Islands","ZL7","OC",32,44,"NZ",False),
    (473,"Campbell Island","ZL9","OC",32,44,"NZ",False),
    (474,"Kermadec Islands","ZL8","OC",32,46,"NZ",False),
    (480,"Antarctica","CE0","AN",13,24,"AQ",False),
    (481,"South Shetland Islands","CE0","SA",13,24,"AQ",False),
    (482,"South Orkney Islands","VP8","SA",14,24,"AQ",False),
    (483,"South Sandwich Islands","3Y0","SA",15,27,"AQ",False),
    (484,"Peter I Island","3Y0P","AN",13,25,"AQ",False),
    (485,"Heard Island","VK0","OC",32,44,"HM",False),
    (486,"Macquarie Island","VK0M","OC",32,44,"AU",False),
    (487,"Juan Fernandez Islands","CE0Z","SA",15,24,"CL",False),
    (488,"Easter Island","CE0","SA",15,24,"CL",False),
    (489,"Galapagos Islands","HC8","SA",12,24,"EC",False),
    (490,"Malpelo Island","HK0","SA",12,25,"CO",False),
    (491,"San Andres & Providencia","HK1","SA",11,25,"CO",False),
    (492,"St. Pierre & Miquelon","FP","NA",5,27,"PM",False),
    (493,"Bermuda","VP9","NA",5,27,"BM",False),
    (494,"Turks & Caicos Islands","VP5","NA",8,18,"TC",False),
    (495,"Anguilla","VP2E","NA",8,18,"AI",False),
    (496,"British Virgin Islands","VP2V","NA",8,18,"VG",False),
    (497,"Cayman Islands","ZF","NA",8,18,"KY",False),
    (498,"Montserrat","M0","NA",8,18,"MS",False),
    (499,"Saint Barthelemy","FJ","NA",8,18,"BL",False),
    (500,"Saint Martin","FS","NA",8,18,"MF",False),
    (501,"Saba","PJ6","NA",8,18,"SX",False),
    (502,"Sint Eustatius","PJ5","NA",8,18,"SX",False),
    (503,"Saint Kitts & Nevis","V4","NA",8,18,"KN",False),
    (504,"Antigua & Barbuda","V2","NA",8,18,"AG",False),
    (505,"Barbuda","V2","NA",8,18,"AG",False),
    (506,"Redonda","V2","NA",8,18,"AG",False),
    (507,"Grenada","J3","NA",9,19,"GD",False),
    (508,"Carriacou","J3","NA",9,19,"GD",False),
    (509,"Union Island","J8","NA",9,18,"VC",False),
    (510,"Canouan","J8","NA",9,18,"VC",False),
    (511,"Bequia","J8","NA",9,18,"VC",False),
    (512,"Mustique","J8","NA",9,18,"VC",False),
    (513,"Petite Martinique","J3","NA",9,19,"GD",False),
    (514,"Tobago","9Y","SA",9,19,"TT",False),
    (515,"Little Tobago","9Y","SA",9,19,"TT",False),
    (516,"Goat Island","9Y","SA",9,19,"TT",False),
    (520,"Sri Lanka","4S","AS",22,39,"LK",False),
    (521,"Maldives","8Q","AS",22,39,"MV",False),
    (522,"British Indian Ocean Terr.","VQ9","AF",19,39,"IO",False),
    (523,"Diego Garcia","VQ9","AF",19,39,"IO",False),
    (524,"Andaman & Nicobar Islands","VU","AS",23,39,"IN",False),
    (525,"Lakshadweep Islands","VU","AS",22,39,"IN",False),
    (15,"Desecheo Island","KP5","NA",8,18,"US",False),
    (22,"Saint Paul Island","CY9","NA",5,27,"CA",False),
    (23,"Sable Island","CY0","NA",5,27,"CA",False),
    (76,"Swan Islands","HR0","NA",7,18,"HN",False),
    (77,"Clipperton Island","FO0","NA",10,19,"FR",False),
    (85,"Dodecanese","SV5","EU",16,28,"GR",False),
    (86,"Mount Athos","SV0","EU",16,28,"GR",False),
    (90,"European Russia","UA1","EU",16,29,"RU",False),
    (91,"Asiatic Russia","UA0","AS",18,29,"RU",False),
    (141,"Bear Island","JW","EU",14,28,"SJ",False),
    (160,"Sao Tome & Principe","S9","AF",16,38,"ST",False),
    (161,"Annobon Island","3C0","AF",16,38,"GQ",False),
    (162,"Fernando de Noronha","PY0F","SA",13,26,"BR",False),
    (163,"Trindade & Martim Vaz","PY0T","SA",15,26,"BR",False),
    (164,"Saint Peter & Paul Rocks","PY0S","SA",13,26,"BR",False),
    (168,"Central Kiribati","T31","OC",31,45,"KI",False),
    (169,"Eastern Kiribati","T32","OC",31,46,"KI",False),
    (170,"Southern Kiribati","T33","OC",31,45,"KI",False),
    (178,"Rotuma","3D2","OC",32,45,"FJ",False),
    (237,"Balearic Islands","EA6","EU",14,27,"ES",False),
    (290,"United Nations HQ","4U1","NA",5,27,"US",False),
    (419,"Scarborough Reef","BS7","AS",26,42,"CN",False),
    (533,"Edge Island","JW","EU",14,28,"NO",False),
    (542,"Crozet Island","FT8","AF",19,39,"FR",False),
    (543,"Kerguelen Island","FT8","AF",19,39,"FR",False),
    (544,"Amsterdam & St. Paul Is.","FT8","AF",19,39,"FR",False),
    (546,"Pratas Island","BV9","AS",24,44,"TW",False),
    (547,"Paracel Islands","XS9","AS",24,44,"CN",False),
    (548,"Macclesfield Bank","XS9","AS",24,44,"CN",False),
    (550,"Spratly Islands","9M0","AS",26,42,"MY",False),
    (600,"4U1VIC","4U1","EU",14,28,"AT",False),
]

DXCC_ENTITIES: List[DXCCEntity] = [
    DXCCEntity(entity_id=t[0], name=t[1], prefix=t[2], continent=t[3], cq_zone=t[4], ituzone=t[5], flag=t[6], deleted=t[7])
    for t in _DXCC_RAW
]

_DXCC_RARITY: Dict[int, int] = {}
for _e in DXCC_ENTITIES:
    score = 0
    if _e.deleted:
        score += 500
    if _e.continent == "OC":
        score += 150
    if _e.continent == "AF":
        score += 80
    if _e.continent == "AN":
        score += 300
    remote_islands = {
        242:400, 243:400, 250:350, 251:350, 152:300, 153:300, 154:300,
        155:300, 156:300, 157:300, 158:300, 159:300, 160:300,
        62:200, 64:200, 83:200, 84:200, 85:200, 86:200, 87:200,
        88:200, 89:200, 90:200, 91:200, 92:200, 93:200,
        505:350, 506:350, 507:350, 508:350, 509:350, 510:350, 511:350,
        461:300, 462:300, 463:300, 464:300, 465:300, 466:300, 467:300,
        468:300, 469:300,
        317:250, 318:250, 319:250, 320:250, 321:250, 322:250, 323:250,
        324:250, 325:250, 326:250, 327:250, 328:250, 329:250, 330:250,
        331:250, 332:250, 333:250, 334:250, 335:250, 336:250, 337:250,
        338:250, 339:250, 340:250, 341:250, 342:250, 343:250, 344:250,
        345:250, 346:250, 347:250, 348:250, 349:250, 350:250, 351:250,
        352:250, 353:250, 354:250, 355:250, 356:250, 357:250, 358:250,
        359:250, 360:250, 361:250, 362:250, 363:250, 364:250, 365:250,
        366:250, 367:250, 368:250, 369:250,
        120:150, 121:200,
        11:180, 9:180, 10:180, 12:150,
    }
    score += remote_islands.get(_e.entity_id, 0)
    if _e.cq_zone in (22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40):
        score += 50
    _DXCC_RARITY[_e.entity_id] = score

US_STATES: Dict[str, str] = {
    "AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California",
    "CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia",
    "HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas",
    "KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts",
    "MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana",
    "NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico",
    "NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma",
    "OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina",
    "SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont",
    "VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming",
    "DC":"District of Columbia",
}

CQ_ZONES = list(range(1, 41))


def get_dxcc_entity(entity_id: int) -> Optional[DXCCEntity]:
    for entity in DXCC_ENTITIES:
        if entity.entity_id == entity_id:
            return entity
    return None


def get_dxcc_by_prefix(prefix: str) -> Optional[DXCCEntity]:
    prefix_upper = prefix.upper()
    best_match = None
    best_len = 0
    for entity in DXCC_ENTITIES:
        if prefix_upper.startswith(entity.prefix.upper()):
            if len(entity.prefix) > best_len:
                best_match = entity
                best_len = len(entity.prefix)
    return best_match


def get_all_dxcc_entities() -> List[DXCCEntity]:
    return DXCC_ENTITIES


def get_us_states() -> Dict[str, str]:
    return US_STATES


def get_cq_zones() -> List[int]:
    return CQ_ZONES


def get_continent_name(code: str) -> str:
    names = {"NA":"North America","SA":"South America","EU":"Europe","AF":"Africa","AS":"Asia","OC":"Oceania","AN":"Antarctica"}
    return names.get(code, code)


def truncate_entity_name(name: str, max_width: int = 30) -> str:
    try:
        term_width = os.get_terminal_size().columns
        available = max(20, term_width - 30)
        max_width = min(max_width, available)
    except OSError:
        pass
    if len(name) <= max_width:
        return name
    return name[:max_width - 1] + "~"


@dataclass
class QSO:
    callsign: str
    qso_date: str
    qso_time: str
    band: str
    mode: str
    freq: Optional[float] = None
    rst_sent: Optional[str] = None
    rst_rcvd: Optional[str] = None
    grid: Optional[str] = None
    name: Optional[str] = None
    qth: Optional[str] = None
    state: Optional[str] = None
    cq_zone: Optional[int] = None
    ituzone: Optional[int] = None
    dxcc: Optional[int] = None
    country: Optional[str] = None
    operator: Optional[str] = None
    station_callsign: Optional[str] = None
    my_grid: Optional[str] = None
    tx_pwr: Optional[float] = None
    rig: Optional[str] = None
    antenna: Optional[str] = None
    comment: Optional[str] = None
    notes: Optional[str] = None
    contest_id: Optional[str] = None
    srx: Optional[int] = None
    srx_string: Optional[str] = None
    stx: Optional[int] = None
    stx_string: Optional[str] = None
    qsl_rcvd: str = "N"
    qsl_sent: str = "N"
    lotw_rcvd: str = "N"
    lotw_sent: str = "N"
    freq_rx: Optional[float] = None
    band_rx: Optional[str] = None
    a_index: Optional[int] = None
    cont: Optional[str] = None
    qrzcom_qso_upload_date: Optional[str] = None
    qsl_rcvd_date: Optional[str] = None
    qsl_sent_date: Optional[str] = None
    lotw_rcvd_date: Optional[str] = None
    lotw_sent_date: Optional[str] = None
    id: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    def validate(self) -> List[str]:
        errors = []
        if not self.callsign:
            errors.append("callsign is required")
        else:
            self.callsign = normalize_callsign(self.callsign)
            if not CALLSIGN_RE.match(self.callsign):
                errors.append(f"invalid callsign format: {self.callsign}")
        if not self.qso_date:
            errors.append("qso_date is required")
        elif not re.match(r'^\d{8}$', self.qso_date):
            errors.append("qso_date must be YYYYMMDD format")
        if not self.qso_time:
            errors.append("qso_time is required")
        elif not re.match(r'^\d{4}$', self.qso_time) and not re.match(r'^\d{6}$', self.qso_time):
            errors.append("qso_time must be HHMM or HHMMSS format")
        if not self.band:
            errors.append("band is required")
        elif self.band not in BANDS:
            errors.append(f"invalid band: {self.band}. Valid: {', '.join(BANDS)}")
        if not self.mode:
            errors.append("mode is required")
        else:
            self.mode = self.mode.upper()
            if self.mode not in MODES:
                errors.append(f"invalid mode: {self.mode}. Valid: {', '.join(MODES)}")
        if self.freq is not None and self.band:
            low, high = BAND_FREQ_RANGES.get(self.band, (0, float('inf')))
            if self.freq < low or self.freq > high:
                errors.append(f"frequency {self.freq} MHz out of {self.band} band range ({low}-{high})")
        if self.grid:
            self.grid = self.grid.upper()
            if not GRID_RE.match(self.grid):
                errors.append(f"invalid grid square: {self.grid}")
        if self.my_grid:
            self.my_grid = self.my_grid.upper()
            if not GRID_RE.match(self.my_grid):
                errors.append(f"invalid my_grid: {self.my_grid}")
        if self.state:
            self.state = self.state.upper()
        return errors

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        return {k: v for k, v in result.items() if v is not None}


def normalize_callsign(callsign: str) -> str:
    cs = callsign.strip().upper()
    cs = re.sub(r'^[A-Z0-9]+/', '', cs)
    cs = re.sub(r'/[A-Z0-9]+$', '', cs)
    return cs


def freq_to_band(freq_mhz: float) -> Optional[str]:
    for band, (low, high) in BAND_FREQ_RANGES.items():
        if low <= freq_mhz <= high:
            return band
    return None


def now_utc_datetime() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def format_date(dt: datetime.datetime) -> str:
    return dt.strftime("%Y%m%d")


def format_time(dt: datetime.datetime) -> str:
    return dt.strftime("%H%M")


class QSOMANAGER:
    def __init__(self, db: Database):
        self.db = db

    def add(self, qso: QSO) -> int:
        errors = qso.validate()
        if errors:
            raise ValueError("Validation failed: " + "; ".join(errors))
        try:
            _insert_cols = """callsign, qso_date, qso_time, band, mode, freq,
                rst_sent, rst_rcvd, grid, name, qth, state,
                cq_zone, ituzone, dxcc, country, operator,
                station_callsign, my_grid, tx_pwr, rig, antenna,
                comment, notes, contest_id, srx, srx_string,
                stx, stx_string, qsl_rcvd, qsl_sent,
                lotw_rcvd, lotw_sent,
                freq_rx, band_rx, a_index, cont,
                qrzcom_qso_upload_date, qsl_rcvd_date, qsl_sent_date,
                lotw_rcvd_date, lotw_sent_date"""
            assert len(_insert_cols.split(",")) == 42, f"column count {len(_insert_cols.split(','))}"
            cursor = self.db.execute("""
                INSERT INTO qsos (
                    callsign, qso_date, qso_time, band, mode, freq,
                    rst_sent, rst_rcvd, grid, name, qth, state,
                    cq_zone, ituzone, dxcc, country, operator,
                    station_callsign, my_grid, tx_pwr, rig, antenna,
                    comment, notes, contest_id, srx, srx_string,
                    stx, stx_string, qsl_rcvd, qsl_sent,
                    lotw_rcvd, lotw_sent,
                    freq_rx, band_rx, a_index, cont,
                    qrzcom_qso_upload_date, qsl_rcvd_date, qsl_sent_date,
                    lotw_rcvd_date, lotw_sent_date
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            """, (
                qso.callsign, qso.qso_date, qso.qso_time, qso.band, qso.mode,
                qso.freq, qso.rst_sent, qso.rst_rcvd, qso.grid, qso.name,
                qso.qth, qso.state, qso.cq_zone, qso.ituzone, qso.dxcc,
                qso.country, qso.operator, qso.station_callsign, qso.my_grid,
                qso.tx_pwr, qso.rig, qso.antenna, qso.comment, qso.notes,
                qso.contest_id, qso.srx, qso.srx_string, qso.stx,
                qso.stx_string, qso.qsl_rcvd, qso.qsl_sent,
                qso.lotw_rcvd, qso.lotw_sent,
                qso.freq_rx, qso.band_rx, qso.a_index, qso.cont,
                qso.qrzcom_qso_upload_date, qso.qsl_rcvd_date, qso.qsl_sent_date,
                qso.lotw_rcvd_date, qso.lotw_sent_date,
            ))
            self.db.commit()
            qso_id = cursor.lastrowid
            logger.info("Added QSO #%d: %s on %s %s", qso_id, qso.callsign, qso.band, qso.mode)
            return qso_id
        except Exception as e:
            self.db.rollback()
            if "UNIQUE constraint failed" in str(e):
                raise ValueError(f"Duplicate QSO: {qso.callsign} {qso.qso_date} {qso.qso_time} {qso.band} {qso.mode}")
            raise

    def add_batch(self, qsos: List[QSO]) -> Tuple[int, int]:
        success = 0
        skipped = 0
        for qso in qsos:
            try:
                self.add(qso)
                success += 1
            except ValueError as e:
                if "Duplicate" in str(e):
                    skipped += 1
                    logger.debug("Skipped duplicate: %s", e)
                else:
                    raise
        return success, skipped

    def get(self, qso_id: int) -> Optional[QSO]:
        row = self.db.query_one("SELECT * FROM qsos WHERE id = ?", (qso_id,))
        return _row_to_qso(row) if row else None

    def delete(self, qso_id: int) -> bool:
        cursor = self.db.execute("DELETE FROM qsos WHERE id = ?", (qso_id,))
        self.db.commit()
        deleted = cursor.rowcount > 0
        if deleted:
            logger.info("Deleted QSO #%d", qso_id)
        return deleted

    def update(self, qso_id: int, updates: Dict[str, Any]) -> bool:
        if not updates:
            return False
        fields = []
        values = []
        for key, value in updates.items():
            if key == "id":
                continue
            fields.append(f"{key} = ?")
            values.append(value)
        values.append(qso_id)
        fields.append("updated_at = datetime('now')")
        sql = f"UPDATE qsos SET {', '.join(fields)} WHERE id = ?"
        cursor = self.db.execute(sql, values)
        self.db.commit()
        updated = cursor.rowcount > 0
        if updated:
            logger.info("Updated QSO #%d", qso_id)
        return updated

    def search(self, callsign=None, callsign_regex=None, date_from=None, date_to=None,
               bands=None, modes=None, dxcc=None, state=None, cq_zone=None,
               lotw_qsl=None, limit=1000, offset=0,
               order_by="qso_date DESC, qso_time DESC") -> List[QSO]:
        where_clauses = []
        params: List[Any] = []
        if callsign:
            if "%" in callsign or "_" in callsign:
                where_clauses.append("callsign LIKE ?")
                params.append(callsign.upper())
            else:
                where_clauses.append("callsign = ?")
                params.append(callsign.upper())
        if callsign_regex:
            where_clauses.append("callsign REGEXP ?")
            params.append(callsign_regex)
        if date_from:
            where_clauses.append("qso_date >= ?")
            params.append(date_from)
        if date_to:
            where_clauses.append("qso_date <= ?")
            params.append(date_to)
        if bands:
            placeholders = ", ".join("?" * len(bands))
            where_clauses.append(f"band IN ({placeholders})")
            params.extend(bands)
        if modes:
            placeholders = ", ".join("?" * len(modes))
            where_clauses.append(f"mode IN ({placeholders})")
            params.extend(m.upper() for m in modes)
        if dxcc:
            where_clauses.append("dxcc = ?")
            params.append(dxcc)
        if state:
            where_clauses.append("state = ?")
            params.append(state.upper())
        if cq_zone:
            where_clauses.append("cq_zone = ?")
            params.append(cq_zone)
        if lotw_qsl == "lotw":
            where_clauses.append("lotw_rcvd = 'Y'")
        elif lotw_qsl == "qsl":
            where_clauses.append("qsl_rcvd = 'Y'")
        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses)
        if callsign and not callsign_regex and not bands and not modes:
            effective_order = order_by
        elif bands or modes:
            effective_order = "id DESC"
        else:
            effective_order = order_by
        sql = f"SELECT * FROM qsos{where_sql} ORDER BY {effective_order} LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = self.db.query_all(sql, tuple(params))
        return [_row_to_qso(row) for row in rows]

    def count(self, callsign=None, date_from=None, date_to=None, bands=None, modes=None) -> int:
        where_clauses = []
        params: List[Any] = []
        if callsign:
            where_clauses.append("callsign = ?")
            params.append(callsign.upper())
        if date_from:
            where_clauses.append("qso_date >= ?")
            params.append(date_from)
        if date_to:
            where_clauses.append("qso_date <= ?")
            params.append(date_to)
        if bands:
            placeholders = ", ".join("?" * len(bands))
            where_clauses.append(f"band IN ({placeholders})")
            params.extend(bands)
        if modes:
            placeholders = ", ".join("?" * len(modes))
            where_clauses.append(f"mode IN ({placeholders})")
            params.extend(m.upper() for m in modes)
        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses)
        row = self.db.query_one(f"SELECT COUNT(*) as cnt FROM qsos{where_sql}", tuple(params))
        return row["cnt"] if row else 0

    def unique_callsigns(self, band=None, mode=None) -> List[str]:
        where = []
        params = []
        if band:
            where.append("band = ?")
            params.append(band)
        if mode:
            where.append("mode = ?")
            params.append(mode.upper())
        where_sql = ""
        if where:
            where_sql = " WHERE " + " AND ".join(where)
        rows = self.db.query_all(f"SELECT DISTINCT callsign FROM qsos{where_sql} ORDER BY callsign", tuple(params))
        return [row["callsign"] for row in rows]

    def get_by_unique_key(self, callsign, qso_date, qso_time, band, mode) -> Optional[QSO]:
        row = self.db.query_one(
            "SELECT * FROM qsos WHERE callsign = ? AND qso_date = ? AND qso_time = ? AND band = ? AND mode = ?",
            (callsign.upper(), qso_date, qso_time, band, mode.upper())
        )
        return _row_to_qso(row) if row else None


def _row_to_qso(row) -> QSO:
    if row is None:
        return None
    r = dict(row) if not isinstance(row, dict) else row
    return QSO(
        id=r.get("id"), callsign=r.get("callsign",""), qso_date=r.get("qso_date",""),
        qso_time=r.get("qso_time",""), band=r.get("band",""), mode=r.get("mode",""),
        freq=r.get("freq"), rst_sent=r.get("rst_sent"), rst_rcvd=r.get("rst_rcvd"),
        grid=r.get("grid"), name=r.get("name"), qth=r.get("qth"), state=r.get("state"),
        cq_zone=r.get("cq_zone"), ituzone=r.get("ituzone"), dxcc=r.get("dxcc"),
        country=r.get("country"), operator=r.get("operator"),
        station_callsign=r.get("station_callsign"), my_grid=r.get("my_grid"),
        tx_pwr=r.get("tx_pwr"), rig=r.get("rig"), antenna=r.get("antenna"),
        comment=r.get("comment"), notes=r.get("notes"), contest_id=r.get("contest_id"),
        srx=r.get("srx"), srx_string=r.get("srx_string"), stx=r.get("stx"),
        stx_string=r.get("stx_string"), qsl_rcvd=r.get("qsl_rcvd") or "N",
        qsl_sent=r.get("qsl_sent") or "N", lotw_rcvd=r.get("lotw_rcvd") or "N",
        lotw_sent=r.get("lotw_sent") or "N",
        freq_rx=r.get("freq_rx"), band_rx=r.get("band_rx"), a_index=r.get("a_index"),
        cont=r.get("cont"), qrzcom_qso_upload_date=r.get("qrzcom_qso_upload_date"),
        qsl_rcvd_date=r.get("qsl_rcvd_date"), qsl_sent_date=r.get("qsl_sent_date"),
        lotw_rcvd_date=r.get("lotw_rcvd_date"), lotw_sent_date=r.get("lotw_sent_date"),
        created_at=r.get("created_at"), updated_at=r.get("updated_at"),
    )


ADIF_FIELD_MAP = {
    "call": "callsign", "qso_date": "qso_date", "time_on": "qso_time",
    "band": "band", "mode": "mode", "freq": "freq",
    "rst_sent": "rst_sent", "rst_rcvd": "rst_rcvd",
    "gridsquare": "grid", "my_gridsquare": "my_grid",
    "name": "name", "qth": "qth", "state": "state",
    "cq_zone": "cq_zone", "ituzone": "ituzone", "dxcc": "dxcc",
    "country": "country", "operator": "operator",
    "station_callsign": "station_callsign", "tx_pwr": "tx_pwr",
    "rig": "rig", "antenna": "antenna", "comment": "comment",
    "notes": "notes", "contest_id": "contest_id",
    "srx": "srx", "srx_string": "srx_string",
    "stx": "stx", "stx_string": "stx_string",
    "qsl_rcvd": "qsl_rcvd", "qsl_sent": "qsl_sent",
    "qslrdate": "qsl_rcvd_date", "qslsdate": "qsl_sent_date",
    "lotw_qsl_rcvd": "lotw_rcvd", "lotw_qsl_sent": "lotw_sent",
    "lotw_qslrdate": "lotw_rcvd_date", "lotw_qslsdate": "lotw_sent_date",
    "qrzcom_qso_upload_date": "qrzcom_qso_upload_date",
    "freq_rx": "freq_rx", "band_rx": "band_rx",
    "a_index": "a_index", "cont": "cont",
    "app_qrzlog_logid": "qrz_log_id",
}

REVERSE_FIELD_MAP = {v: k for k, v in ADIF_FIELD_MAP.items()}

EXPORT_FIELDS = [
    "call", "qso_date", "time_on", "band", "mode", "freq",
    "rst_sent", "rst_rcvd", "gridsquare", "my_gridsquare",
    "name", "qth", "state", "cq_zone", "ituzone", "dxcc", "country",
    "operator", "station_callsign", "tx_pwr", "rig", "antenna",
    "comment", "notes", "contest_id", "srx", "srx_string",
    "stx", "stx_string", "qsl_rcvd", "qsl_sent",
    "lotw_qsl_rcvd", "lotw_qsl_sent", "qrzcom_qso_upload_date",
    "freq_rx", "band_rx", "a_index", "cont",
    "qslrdate", "qslsdate", "lotw_qslrdate", "lotw_qslsdate",
]


def parse_adif(data: str) -> Tuple[Dict[str, str], List[Dict[str, Any]]]:
    header: Dict[str, str] = {}
    records: List[Dict[str, Any]] = []
    in_header = True
    current_record: Dict[str, Any] = {}
    field_pattern = re.compile(r'<(\w+)(?::(\d+))?(?::\w+)?>\s*', re.IGNORECASE)
    pos = 0
    while pos < len(data):
        match = field_pattern.search(data, pos)
        if not match:
            break
        field_name = match.group(1).lower()
        field_length = match.group(2)
        tag_end = match.end()
        if field_name == "eoh":
            in_header = False
            pos = tag_end
            continue
        if field_name == "eor":
            if not in_header and current_record:
                records.append(current_record)
                current_record = {}
            pos = tag_end
            continue
        if field_length:
            length = int(field_length)
            value = data[tag_end:tag_end + length]
            pos = tag_end + length
        else:
            value = ""
            pos = tag_end
        value = value.strip()
        if in_header:
            header[field_name] = value
        else:
            current_record[field_name] = value
    if current_record and not in_header:
        records.append(current_record)
    logger.debug("Parsed %d QSO records from ADIF", len(records))
    return header, records


def adif_record_to_qso(record: Dict[str, Any]) -> QSO:
    mapped: Dict[str, Any] = {}
    for adif_field, value in record.items():
        adif_field_lower = adif_field.lower()
        if adif_field_lower in ADIF_FIELD_MAP:
            qso_field = ADIF_FIELD_MAP[adif_field_lower]
            mapped[qso_field] = value
    for int_field in ("dxcc", "cq_zone", "ituzone", "srx", "stx", "a_index"):
        if int_field in mapped and mapped[int_field]:
            try: mapped[int_field] = int(mapped[int_field])
            except (ValueError, TypeError): pass
    for float_field in ("freq", "tx_pwr", "freq_rx"):
        if float_field in mapped and mapped[float_field]:
            try: mapped[float_field] = float(mapped[float_field])
            except (ValueError, TypeError): pass
    if "freq" in mapped and mapped["freq"] and "band" not in mapped:
        band = freq_to_band(mapped["freq"])
        if band:
            mapped["band"] = band
    if "time_on" in mapped:
        mapped["qso_time"] = mapped.pop("time_on")
    qso = QSO(
        callsign=mapped.get("callsign", ""), qso_date=mapped.get("qso_date", ""),
        qso_time=mapped.get("qso_time", ""), band=mapped.get("band", ""),
        mode=mapped.get("mode", ""),
    )
    for key, value in mapped.items():
        if hasattr(qso, key) and key not in ("callsign", "qso_date", "qso_time", "band", "mode"):
            setattr(qso, key, value)
    return qso


def qso_to_adif(qso: QSO) -> str:
    fields = []
    for adif_field in EXPORT_FIELDS:
        qso_field = ADIF_FIELD_MAP.get(adif_field)
        if not qso_field:
            continue
        value = getattr(qso, qso_field, None)
        if value is None or value == "":
            continue
        value_str = str(value)
        fields.append(f"<{adif_field}:{len(value_str)}>{value_str}")
    fields.append("<eor>")
    return "\n".join(fields)


def generate_adif_header(program_id="HAMLOG", program_version=VERSION) -> str:
    header_fields = [
        ("adif_ver", "3.1.4"),
        ("programid", program_id),
        ("programversion", program_version),
        ("created_timestamp", datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d %H%M%S")),
    ]
    lines = []
    for f, v in header_fields:
        lines.append(f"<{f}:{len(v)}>{v}")
    lines.append("<eoh>")
    return "\n".join(lines)


def export_adif(qsos: List[QSO], program_id="HAMLOG", program_version=VERSION) -> str:
    parts = [generate_adif_header(program_id, program_version), ""]
    for qso in qsos:
        parts.append(qso_to_adif(qso))
        parts.append("")
    return "\n".join(parts)


def parse_adif_file(filepath: str) -> List[QSO]:
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        data = f.read()
    _, records = parse_adif(data)
    qsos = []
    for record in records:
        try:
            qso = adif_record_to_qso(record)
            qsos.append(qso)
        except Exception as e:
            logger.warning("Failed to parse ADIF record: %s", e)
    logger.info("Parsed %d QSOs from %s", len(qsos), filepath)
    return qsos


def export_csv(qsos: List[QSO]) -> str:
    fieldnames = [
        "callsign", "qso_date", "qso_time", "band", "mode", "freq",
        "rst_sent", "rst_rcvd", "grid", "name", "qth", "state",
        "dxcc", "country", "cq_zone", "comment",
    ]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for qso in qsos:
        writer.writerow(qso.to_dict())
    return output.getvalue()


CONTINENTS = ["NA", "SA", "EU", "AF", "AS", "OC", "AN"]


@dataclass
class AwardProgress:
    name: str
    worked: int
    total: int
    percentage: float
    missing: List[str]


class AwardManager:
    def __init__(self, db: Database):
        self.db = db

    def dxcc_status(self, band=None, mode=None) -> AwardProgress:
        where_clauses = []
        params: List = []
        if band:
            where_clauses.append("band = ?")
            params.append(band)
        if mode:
            where_clauses.append("mode = ?")
            params.append(mode.upper())
        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses) + " AND dxcc IS NOT NULL"
        else:
            where_sql = " WHERE dxcc IS NOT NULL"
        rows = self.db.query_all(f"SELECT DISTINCT dxcc, country FROM qsos{where_sql}", tuple(params))
        worked_ids = set()
        for row in rows:
            worked_ids.add(row["dxcc"])
        all_entities = get_all_dxcc_entities()
        total_active = len([e for e in all_entities if not e.deleted])
        missing_entities = [
            e for e in all_entities if not e.deleted and e.entity_id not in worked_ids
        ]
        missing_entities.sort(key=lambda e: (-_DXCC_RARITY.get(e.entity_id, 0), e.name))
        missing_names = [truncate_entity_name(e.name) for e in missing_entities]
        return AwardProgress(
            name="DXCC", worked=len(worked_ids), total=total_active,
            percentage=round(len(worked_ids) / total_active * 100, 1) if total_active > 0 else 0,
            missing=missing_names,
        )

    def _qso_count_for_dxcc(self, dxcc_id: int) -> int:
        row = self.db.query_one(
            "SELECT COUNT(*) as cnt FROM qsos WHERE dxcc = ?", (dxcc_id,)
        )
        return row["cnt"] if row else 0

    def dxcc_by_continent(self, band=None) -> Dict[str, Tuple[int, int]]:
        all_entities = get_all_dxcc_entities()
        result: Dict[str, Tuple[int, int]] = {}
        for cont in CONTINENTS:
            cont_entities = [e for e in all_entities if e.continent == cont and not e.deleted]
            total = len(cont_entities)
            worked = 0
            if cont_entities:
                ids = [e.entity_id for e in cont_entities]
                placeholders = ", ".join("?" * len(ids))
                where_extra = ""
                params = list(ids)
                if band:
                    where_extra = " AND band = ?"
                    params.append(band)
                row = self.db.query_one(
                    f"SELECT COUNT(DISTINCT dxcc) as cnt FROM qsos WHERE dxcc IN ({placeholders}){where_extra}",
                    tuple(params)
                )
                worked = row["cnt"] if row else 0
            result[cont] = (worked, total)
        return result

    def was_status(self, band=None, mode=None) -> AwardProgress:
        states = get_us_states()
        total = len(states)
        where_clauses = ["state IS NOT NULL", "state != ''"]
        params: List = []
        if band:
            where_clauses.append("band = ?")
            params.append(band)
        if mode:
            where_clauses.append("mode = ?")
            params.append(mode.upper())
        where_sql = " WHERE " + " AND ".join(where_clauses)
        rows = self.db.query_all(f"SELECT DISTINCT state FROM qsos{where_sql}", tuple(params))
        worked_states = set(row["state"].upper() for row in rows if row["state"])
        all_state_codes = set(states.keys())
        worked = len(worked_states & all_state_codes)
        missing_codes = sorted(all_state_codes - worked_states)
        missing_names = [f"{code} - {states[code]}" for code in missing_codes]
        return AwardProgress(name="WAS (Worked All States)", worked=worked, total=total,
                             percentage=round(worked / total * 100, 1) if total > 0 else 0,
                             missing=missing_names)

    def waz_status(self, band=None, mode=None) -> AwardProgress:
        cq_zones = get_cq_zones()
        total = len(cq_zones)
        where_clauses = ["cq_zone IS NOT NULL"]
        params: List = []
        if band:
            where_clauses.append("band = ?")
            params.append(band)
        if mode:
            where_clauses.append("mode = ?")
            params.append(mode.upper())
        where_sql = " WHERE " + " AND ".join(where_clauses)
        rows = self.db.query_all(f"SELECT DISTINCT cq_zone FROM qsos{where_sql}", tuple(params))
        worked_zones = set(row["cq_zone"] for row in rows if row["cq_zone"])
        all_zones_set = set(cq_zones)
        worked = len(worked_zones & all_zones_set)
        missing_zones = sorted(all_zones_set - worked_zones)
        missing_strs = [f"Zone {z}" for z in missing_zones]
        return AwardProgress(name="WAZ (Worked All Zones)", worked=worked, total=total,
                             percentage=round(worked / total * 100, 1) if total > 0 else 0,
                             missing=missing_strs)

    def yearly_summary(self) -> List[Dict]:
        rows = self.db.query_all("""
            SELECT substr(qso_date, 1, 4) as year, COUNT(*) as qso_count,
                   COUNT(DISTINCT callsign) as unique_calls, COUNT(DISTINCT dxcc) as dxcc_count
            FROM qsos WHERE qso_date IS NOT NULL GROUP BY substr(qso_date, 1, 4) ORDER BY year DESC
        """)
        return [dict(row) for row in rows]

    def band_summary(self) -> List[Dict]:
        rows = self.db.query_all("""
            SELECT band, COUNT(*) as qso_count, COUNT(DISTINCT callsign) as unique_calls,
                   COUNT(DISTINCT dxcc) as dxcc_count
            FROM qsos WHERE band IS NOT NULL GROUP BY band ORDER BY qso_count DESC
        """)
        return [dict(row) for row in rows]

    def mode_summary(self) -> List[Dict]:
        rows = self.db.query_all("""
            SELECT mode, COUNT(*) as qso_count, COUNT(DISTINCT callsign) as unique_calls
            FROM qsos WHERE mode IS NOT NULL GROUP BY mode ORDER BY qso_count DESC
        """)
        return [dict(row) for row in rows]

    def lotw_status(self) -> Tuple[int, int]:
        total_row = self.db.query_one("SELECT COUNT(*) as cnt FROM qsos")
        confirmed_row = self.db.query_one("SELECT COUNT(*) as cnt FROM qsos WHERE lotw_rcvd = 'Y'")
        total = total_row["cnt"] if total_row else 0
        confirmed = confirmed_row["cnt"] if confirmed_row else 0
        return confirmed, total


HAMQSL_URL = "https://www.hamqsl.com/solarxml.php"
CACHE_TTL = 3600
PROP_BANDS = ["160m", "80m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m"]
PROPAGATION_LEVELS = [
    (0, 20, "Very Poor"), (21, 40, "Poor"), (41, 60, "Fair"),
    (61, 80, "Good"), (81, 90, "Very Good"), (91, 100, "Excellent"),
]


@dataclass
class SolarData:
    date: str
    sfi: float
    a_index: int
    k_index: float
    ssn: int
    solar_wind_speed: float
    x_ray: float
    flux_line: str


@dataclass
class BandPropagation:
    band: str
    day_rating: int
    night_rating: int
    best_direction: str
    description: str


def rating_to_level(rating: int) -> str:
    for low, high, level in PROPAGATION_LEVELS:
        if low <= rating <= high:
            return level
    return "Unknown"


class PropagationManager:
    def __init__(self, db: Database, cache_ttl: int = CACHE_TTL):
        self.db = db
        self.cache_ttl = cache_ttl

    def get_solar_data(self, force_refresh: bool = False) -> Optional[SolarData]:
        today = datetime.date.today().isoformat()
        if not force_refresh:
            cached = self._get_cached(today)
            if cached:
                return cached
        solar_data = self._fetch_hamqsl()
        if solar_data:
            self._cache_solar_data(solar_data)
            return solar_data
        return self._get_cached(today)

    def _get_cached(self, date_str: str) -> Optional[SolarData]:
        row = self.db.query_one("SELECT * FROM propagation_cache WHERE cache_date = ?", (date_str,))
        if row:
            return SolarData(
                date=row["cache_date"], sfi=row["sfi"] or 0, a_index=row["a_index"] or 0,
                k_index=row["k_index"] or 0, ssn=row["ssn"] or 0,
                solar_wind_speed=row["solar_wind_speed"] or 0, x_ray=row["x_ray"] or 0,
                flux_line=row["flux_line"] or "",
            )
        return None

    def _cache_solar_data(self, solar_data: SolarData):
        self.db.execute("""
            INSERT OR REPLACE INTO propagation_cache
            (cache_date, sfi, a_index, k_index, ssn, solar_wind_speed, x_ray, flux_line)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (solar_data.date, solar_data.sfi, solar_data.a_index, solar_data.k_index,
              solar_data.ssn, solar_data.solar_wind_speed, solar_data.x_ray, solar_data.flux_line))
        self.db.commit()

    def _fetch_hamqsl(self) -> Optional[SolarData]:
        try:
            req = urllib.request.Request(HAMQSL_URL, headers={"User-Agent": "HAMLOG/1.0"})
            with urllib.request.urlopen(req, timeout=10) as response:
                xml_data = response.read()
            root = ET.fromstring(xml_data)
            sfi = 0.0
            a_index = 0
            k_index = 0.0
            ssn = 0
            solar_wind = 0.0
            x_ray = 0.0
            flux_line = ""
            solar = root.find("solardata")
            if solar is not None:
                elem = solar.find("solarflux")
                if elem is not None and elem.text:
                    try: sfi = float(elem.text)
                    except ValueError: pass
                elem = solar.find("aindex")
                if elem is not None and elem.text:
                    try: a_index = int(elem.text)
                    except ValueError: pass
                elem = solar.find("kindex")
                if elem is not None and elem.text:
                    try: k_index = float(elem.text)
                    except ValueError: pass
                elem = solar.find("sunspots")
                if elem is not None and elem.text:
                    try: ssn = int(elem.text)
                    except ValueError: pass
                elem = solar.find("solarwind")
                if elem is not None and elem.text:
                    try: solar_wind = float(elem.text)
                    except ValueError: pass
                elem = solar.find("xray")
                if elem is not None and elem.text:
                    try: x_ray = float(elem.text)
                    except ValueError: pass
                flux_elem = solar.find("fluxline")
                if flux_elem is not None and flux_elem.text:
                    flux_line = flux_elem.text
            return SolarData(date=datetime.date.today().isoformat(), sfi=sfi, a_index=a_index,
                             k_index=k_index, ssn=ssn, solar_wind_speed=solar_wind,
                             x_ray=x_ray, flux_line=flux_line)
        except (urllib.error.URLError, ET.ParseError, OSError) as e:
            logger.error("Failed to fetch HamQSL data: %s", e)
            return None

    def calculate_band_propagation(self, solar_data: SolarData, my_lat: float = 40.0) -> List[BandPropagation]:
        sfi = solar_data.sfi
        a_index = solar_data.a_index
        k_index = solar_data.k_index
        conditions_factor = max(0, min(100, (sfi - 65) / 1.5))
        geomagnetic_factor = max(0, 100 - (a_index * 2 + k_index * 10))
        result = []
        for band in PROP_BANDS:
            day_rating = self._day_rating(band, sfi, conditions_factor, geomagnetic_factor)
            night_rating = self._night_rating(band, sfi, conditions_factor, geomagnetic_factor)
            best_dir = self._best_direction(band, solar_data)
            day_level = rating_to_level(day_rating)
            night_level = rating_to_level(night_rating)
            result.append(BandPropagation(band=band, day_rating=day_rating, night_rating=night_rating,
                                          best_direction=best_dir,
                                          description=f"Day: {day_level}, Night: {night_level}"))
        return result

    def _day_rating(self, band, sfi, cond_factor, geo_factor):
        band_factors = {
            "160m": max(0, 10 - sfi / 30), "80m": max(0, 20 - sfi / 20),
            "40m": max(10, 40 - sfi / 10), "30m": max(20, 50 + sfi / 10),
            "20m": max(30, 60 + sfi / 5), "17m": max(20, 50 + sfi / 4),
            "15m": max(10, 40 + sfi / 3), "12m": max(5, 30 + sfi / 2.5),
            "10m": max(0, 20 + sfi / 2), "6m": max(0, 10 + sfi / 1.5),
        }
        base = band_factors.get(band, 50)
        return max(0, min(100, int(base * (geo_factor / 100))))

    def _night_rating(self, band, sfi, cond_factor, geo_factor):
        band_factors = {
            "160m": 90, "80m": 85, "40m": 75, "30m": 60, "20m": 50,
            "17m": 30, "15m": 15, "12m": 10, "10m": 5, "6m": 0,
        }
        base = band_factors.get(band, 30)
        return max(0, min(100, int(base * (geo_factor / 100))))

    def _best_direction(self, band, solar_data):
        if solar_data.sfi > 150:
            if band in ("10m", "12m", "15m"): return "Long-path possible"
            if band in ("17m", "20m"): return "Worldwide"
        if band in ("160m", "80m", "40m"): return "Regional/Nighttime DX"
        elif band in ("30m", "20m"): return "Medium to Long distance"
        elif band in ("17m", "15m"): return "Long distance (daytime)"
        else: return "Sporadic E / F2 (high SFI)"

    def get_7day_trend(self) -> List[SolarData]:
        rows = self.db.query_all("SELECT * FROM propagation_cache ORDER BY cache_date DESC LIMIT 7")
        result = []
        for row in rows:
            result.append(SolarData(
                date=row["cache_date"], sfi=row["sfi"] or 0, a_index=row["a_index"] or 0,
                k_index=row["k_index"] or 0, ssn=row["ssn"] or 0,
                solar_wind_speed=row["solar_wind_speed"] or 0, x_ray=row["x_ray"] or 0,
                flux_line=row["flux_line"] or "",
            ))
        return result

    def get_suggested_band(self, current_utc_hour=None) -> str:
        solar = self.get_solar_data()
        if not solar: return "20m"
        if current_utc_hour is None:
            current_utc_hour = datetime.datetime.now(datetime.timezone.utc).hour
        is_daytime = 6 <= current_utc_hour <= 18
        if is_daytime:
            if solar.sfi > 150: return "15m"
            elif solar.sfi > 100: return "20m"
            else: return "40m"
        else:
            if solar.sfi > 120: return "20m"
            elif solar.sfi > 80: return "40m"
            else: return "80m"

    def get_band_switch_suggestions(self, current_band: str) -> List[str]:
        solar = self.get_solar_data()
        if not solar: return ["20m", "40m", "15m"]
        sfi = solar.sfi
        if sfi > 150: suggestions = ["10m", "12m", "15m", "17m", "20m"]
        elif sfi > 120: suggestions = ["15m", "17m", "20m", "30m", "40m"]
        elif sfi > 90: suggestions = ["20m", "30m", "40m", "17m", "15m"]
        elif sfi > 60: suggestions = ["40m", "30m", "20m", "80m", "160m"]
        else: suggestions = ["80m", "40m", "30m", "160m", "20m"]
        if current_band in suggestions:
            idx = suggestions.index(current_band)
        return suggestions


def setup_logging(verbose: bool = False):
    log_dir = Path(os.environ.get("HAMLOG_DATA_DIR", str(Path.home() / ".hamlog")))
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "hamlog.log"
    level = logging.DEBUG if verbose else logging.INFO
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(level)
    file_handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(file_handler)


def try_rich_import():
    try:
        from rich.console import Console
        from rich.table import Table
        from rich import box
        return Console(), Table, box
    except ImportError:
        return None, None, None


def print_info(msg: str):
    console, _, _ = try_rich_import()
    if console:
        console.print(f"[green]INFO:[/green] {msg}")
    else:
        print(f"INFO: {msg}")


def print_warning(msg: str):
    console, _, _ = try_rich_import()
    if console:
        console.print(f"[yellow]WARNING:[/yellow] {msg}")
    else:
        print(f"WARNING: {msg}")


def print_error(msg: str):
    console, _, _ = try_rich_import()
    if console:
        console.print(f"[red]ERROR:[/red] {msg}")
    else:
        print(f"ERROR: {msg}", file=sys.stderr)


def get_band_color(band: str) -> str:
    colors = {
        "160m": "dark_red", "80m": "red", "40m": "orange", "30m": "yellow",
        "20m": "yellow", "17m": "green", "15m": "green", "12m": "cyan",
        "10m": "cyan", "6m": "blue", "2m": "blue", "70cm": "magenta",
    }
    return colors.get(band, "white")


def get_prop_color(rating: int) -> str:
    if rating >= 80: return "green"
    elif rating >= 50: return "yellow"
    elif rating >= 30: return "orange"
    else: return "red"


def pager_output(text: str, threshold: int = 40):
    lines = text.count('\n') + 1
    if lines <= threshold:
        print(text)
        return
    try:
        proc = subprocess.Popen(["less", "-R", "-F"], stdin=subprocess.PIPE, text=True)
        proc.communicate(input=text)
    except Exception:
        print(text)


def maybe_pager(text: str, threshold: int = 40):
    lines = text.count('\n') + 1
    if lines <= threshold:
        print(text)
        return
    pager_output(text, threshold=0)


def cmd_qso_add(args, config, db):
    qso_mgr = QSOMANAGER(db)
    if args.batch:
        _cmd_qso_add_batch(args, config, db, qso_mgr)
        return
    if not args.callsign:
        print_error("Callsign is required (use -c/--callsign)")
        sys.exit(1)
    now = now_utc_datetime()
    qso_date = args.date or format_date(now)
    qso_time = args.time or format_time(now)
    qso = QSO(
        callsign=args.callsign, qso_date=qso_date, qso_time=qso_time,
        band=args.band or config["preferences"].get("default_band", "20m"),
        mode=args.mode or config["preferences"].get("default_mode", "SSB"),
        freq=args.freq, rst_sent=args.rst_sent, rst_rcvd=args.rst_rcvd,
        grid=args.grid, name=args.name, qth=args.qth, state=args.state,
        cq_zone=args.cq_zone, ituzone=args.ituzone, dxcc=args.dxcc,
        country=args.country, operator=config["operator"].get("callsign") or None,
        station_callsign=config["operator"].get("callsign") or None,
        my_grid=config["operator"].get("grid") or None,
        tx_pwr=config["operator"].get("tx_pwr") or None,
        rig=config["operator"].get("rig") or None,
        antenna=config["operator"].get("antenna") or None,
        comment=args.comment, notes=args.notes, contest_id=args.contest_id,
        srx=args.srx, srx_string=args.srx_string, stx=args.stx, stx_string=args.stx_string,
    )
    try:
        qso_id = qso_mgr.add(qso)
        print_info(f"Added QSO #{qso_id}: {qso.callsign} on {qso.band} {qso.mode} at {qso.qso_date} {qso.qso_time}Z")
    except ValueError as e:
        print_error(str(e))
        sys.exit(1)


def _cmd_qso_add_batch(args, config, db, qso_mgr):
    default_band = args.band or config["preferences"].get("default_band", "20m")
    default_mode = args.mode or config["preferences"].get("default_mode", "SSB")
    success = skipped = errors = 0
    for line in sys.stdin:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split(None, 3)
        if not parts:
            continue
        callsign = parts[0].upper()
        band = default_band
        mode = default_mode
        rst_rcvd = None
        if len(parts) >= 2:
            if parts[1].lower() in [b.lower() for b in BANDS]:
                band = parts[1].lower()
            elif parts[1].upper() in MODES:
                mode = parts[1].upper()
            else:
                rst_rcvd = parts[1]
        if len(parts) >= 3:
            if parts[2].upper() in MODES:
                mode = parts[2].upper()
            else:
                rst_rcvd = parts[2]
        if len(parts) >= 4:
            rst_rcvd = parts[3]
        now = now_utc_datetime()
        qso = QSO(callsign=callsign, qso_date=format_date(now), qso_time=format_time(now),
                   band=band, mode=mode, rst_sent=args.rst_sent or "59", rst_rcvd=rst_rcvd,
                   operator=config["operator"].get("callsign") or None,
                   station_callsign=config["operator"].get("callsign") or None,
                   my_grid=config["operator"].get("grid") or None)
        try:
            qso_mgr.add(qso)
            success += 1
            print_info(f"Added: {callsign} on {band} {mode}")
        except ValueError as e:
            if "Duplicate" in str(e):
                skipped += 1
                print_warning(f"Duplicate: {callsign}")
            else:
                errors += 1
                print_error(f"Error ({callsign}): {e}")
    print_info(f"Batch import complete: {success} added, {skipped} duplicates, {errors} errors")


def cmd_qso_search(args, config, db):
    qso_mgr = QSOMANAGER(db)
    bands = args.band if hasattr(args, 'band') and args.band else None
    modes = args.mode if hasattr(args, 'mode') and args.mode else None
    qsos = qso_mgr.search(
        callsign=args.callsign, callsign_regex=args.regex,
        date_from=args.date_from, date_to=args.date_to,
        bands=bands, modes=modes, dxcc=args.dxcc, state=args.state,
        cq_zone=args.cq_zone, limit=args.limit or 1000, offset=args.offset or 0,
    )
    if not qsos:
        print_info("No QSOs found.")
        return
    console, Table, box = try_rich_import()
    if console and Table:
        from io import StringIO
        from rich.console import Console as RichConsoleClass
        buf_io = StringIO()
        render_console = RichConsoleClass(file=buf_io, width=console.width, force_terminal=True)
        table = Table(title=f"QSO Search Results ({len(qsos)} found)", box=box.SIMPLE)
        table.add_column("Call", style="bold")
        table.add_column("Date")
        table.add_column("Time")
        table.add_column("Band")
        table.add_column("Mode")
        table.add_column("RST Rcvd")
        table.add_column("Grid")
        table.add_column("Country")
        for qso in qsos:
            band_color = get_band_color(qso.band)
            table.add_row(qso.callsign, qso.qso_date, qso.qso_time + "Z",
                          f"[{band_color}]{qso.band}[/{band_color}]", qso.mode,
                          qso.rst_rcvd or "", qso.grid or "", qso.country or "")
        render_console.print(table)
        maybe_pager(buf_io.getvalue().rstrip())
    else:
        buf = f"Found {len(qsos)} QSOs:\n"
        buf += f"{'Call':<12} {'Date':<10} {'Time':<7} {'Band':<6} {'Mode':<6} {'Grid':<7} {'Country'}\n"
        buf += "-" * 80 + "\n"
        for qso in qsos:
            buf += f"{qso.callsign:<12} {qso.qso_date:<10} {qso.qso_time + 'Z':<7} "
            buf += f"{qso.band:<6} {qso.mode:<6} {(qso.grid or ''):<7} {qso.country or ''}\n"
        maybe_pager(buf.rstrip())


def cmd_qso_export(args, config, db):
    qso_mgr = QSOMANAGER(db)
    bands = args.band.split(",") if args.band else None
    modes = args.mode.split(",") if args.mode else None
    qsos = qso_mgr.search(callsign=args.callsign, date_from=args.date_from,
                          date_to=args.date_to, bands=bands, modes=modes, limit=100000)
    if not qsos:
        print_info("No QSOs to export.")
        return
    if args.dedupe:
        seen = set()
        deduped = []
        for qso in qsos:
            if qso.callsign not in seen:
                seen.add(qso.callsign)
                deduped.append(qso)
        qsos = deduped
    fmt = args.format.lower()
    if fmt == "adif":
        output = export_adif(qsos)
    elif fmt == "csv":
        output = export_csv(qsos)
    else:
        print_error(f"Unknown format: {fmt}")
        sys.exit(1)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print_info(f"Exported {len(qsos)} QSOs to {args.output}")
    else:
        print(output)


def cmd_qso_import(args, config, db):
    qso_mgr = QSOMANAGER(db)
    if not os.path.exists(args.file):
        print_error(f"File not found: {args.file}")
        sys.exit(1)
    try:
        qsos = parse_adif_file(args.file)
    except Exception as e:
        print_error(f"Failed to parse ADIF file: {e}")
        sys.exit(1)
    success = skipped = errors = 0
    for qso in qsos:
        try:
            qso_mgr.add(qso)
            success += 1
        except ValueError as e:
            if "Duplicate" in str(e):
                skipped += 1
            else:
                errors += 1
                logger.warning("Import error: %s", e)
    print_info(f"Import complete: {success} added, {skipped} duplicates skipped, {errors} errors")


def cmd_award_status(args, config, db):
    award_mgr = AwardManager(db)
    band = args.band
    console, Table, box = try_rich_import()
    dxcc = award_mgr.dxcc_status(band=band)
    was = award_mgr.was_status(band=band)
    waz = award_mgr.waz_status(band=band)
    dxcc_by_cont = award_mgr.dxcc_by_continent(band=band)
    band_info = f" ({band})" if band else ""
    if console and Table:
        from io import StringIO
        from rich.console import Console as RichConsoleClass
        buf_io = StringIO()
        render_console = RichConsoleClass(file=buf_io, width=console.width, force_terminal=True)
        table = Table(title=f"Award Progress{band_info}", box=box.SIMPLE)
        table.add_column("Award")
        table.add_column("Worked", justify="right")
        table.add_column("Total", justify="right")
        table.add_column("Progress", justify="right")
        table.add_column("Status")
        for name, prog in [("DXCC", dxcc), ("WAS", was), ("WAZ (CQ Zones)", waz)]:
            color = "green" if prog.percentage >= 90 else "yellow" if prog.percentage >= 50 else "red"
            table.add_row(name, str(prog.worked), str(prog.total),
                          f"[{color}]{prog.percentage:.1f}%[/{color}]", f"{len(prog.missing)} missing")
        render_console.print(table)
        cont_table = Table(title="DXCC by Continent", box=box.SIMPLE)
        cont_table.add_column("Continent")
        cont_table.add_column("Worked", justify="right")
        cont_table.add_column("Total", justify="right")
        cont_table.add_column("%", justify="right")
        for cont, (worked, total) in dxcc_by_cont.items():
            pct = f"{worked/total*100:.1f}%" if total > 0 else "N/A"
            cont_table.add_row(get_continent_name(cont), str(worked), str(total), pct)
        render_console.print(cont_table)
        if args.show_missing and dxcc.missing:
            buf_io.write("\nMissing DXCC entities (sorted by rarity):\n")
            for i, name in enumerate(dxcc.missing, 1):
                buf_io.write(f"  {i:3d}. {name}\n")
        maybe_pager(buf_io.getvalue().rstrip())
    else:
        buf = f"Award Progress{band_info}\n"
        buf += "=" * 50 + "\n"
        buf += f"DXCC:    {dxcc.worked}/{dxcc.total} ({dxcc.percentage:.1f}%) - {len(dxcc.missing)} missing\n"
        buf += f"WAS:     {was.worked}/{was.total} ({was.percentage:.1f}%) - {len(was.missing)} missing\n"
        buf += f"WAZ:     {waz.worked}/{waz.total} ({waz.percentage:.1f}%) - {len(waz.missing)} missing\n"
        buf += "\nDXCC by Continent:\n"
        for cont, (worked, total) in dxcc_by_cont.items():
            pct = f"{worked/total*100:.1f}%" if total > 0 else "N/A"
            buf += f"  {get_continent_name(cont):<20} {worked:>3d}/{total:<3d} {pct}\n"
        if args.show_missing and dxcc.missing:
            buf += "\nMissing DXCC entities (sorted by rarity):\n"
            for i, name in enumerate(dxcc.missing, 1):
                buf += f"  {i:3d}. {name}\n"
        maybe_pager(buf.rstrip())


def cmd_propagation(args, config, db):
    prop_mgr = PropagationManager(db)
    print_info("Fetching solar data...")
    solar = prop_mgr.get_solar_data(force_refresh=getattr(args, 'refresh', False))
    if not solar:
        print_error("No solar data available.")
        sys.exit(1)
    console, Table, box = try_rich_import()
    if console and Table:
        table = Table(title="Solar Activity Indices", box=box.SIMPLE)
        table.add_column("Index")
        table.add_column("Value", justify="right")
        table.add_column("Status")
        sfi_status = "Excellent" if solar.sfi > 150 else "Good" if solar.sfi > 100 else "Fair" if solar.sfi > 70 else "Poor"
        sfi_color = "green" if solar.sfi > 100 else "yellow" if solar.sfi > 70 else "red"
        a_color = "green" if solar.a_index < 15 else "yellow" if solar.a_index < 30 else "red"
        k_color = "green" if solar.k_index < 3 else "yellow" if solar.k_index < 5 else "red"
        table.add_row("SFI (Solar Flux Index)", f"[{sfi_color}]{solar.sfi:.0f}[/{sfi_color}]", sfi_status)
        table.add_row("A-Index", f"[{a_color}]{solar.a_index}[/{a_color}]",
                       "Calm" if solar.a_index < 15 else "Active" if solar.a_index < 30 else "Stormy")
        table.add_row("K-Index", f"[{k_color}]{solar.k_index:.1f}[/{k_color}]",
                       "Calm" if solar.k_index < 3 else "Active" if solar.k_index < 5 else "Stormy")
        table.add_row("SSN (Sunspot Number)", str(solar.ssn), "")
        table.add_row("Solar Wind Speed", f"{solar.solar_wind_speed:.1f} km/s", "")
        console.print(table)
        band_props = prop_mgr.calculate_band_propagation(solar)
        if args.band:
            for bp in band_props:
                if bp.band == args.band:
                    band_table = Table(title=f"Propagation: {bp.band}", box=box.SIMPLE)
                    band_table.add_column("Time")
                    band_table.add_column("Rating", justify="right")
                    band_table.add_column("Level")
                    band_table.add_column("Best Direction")
                    for label, rating in [("Day", bp.day_rating), ("Night", bp.night_rating)]:
                        color = get_prop_color(rating)
                        band_table.add_row(label, f"[{color}]{rating}[/{color}]", rating_to_level(rating), bp.best_direction)
                    console.print(band_table)
                    break
        else:
            band_table = Table(title="Band Propagation Outlook", box=box.SIMPLE)
            band_table.add_column("Band")
            band_table.add_column("Day", justify="right")
            band_table.add_column("Night", justify="right")
            band_table.add_column("Best Direction")
            for bp in band_props:
                bc = get_band_color(bp.band)
                dc = get_prop_color(bp.day_rating)
                nc = get_prop_color(bp.night_rating)
                band_table.add_row(f"[{bc}]{bp.band}[/{bc}]",
                                   f"[{dc}]{bp.day_rating}[/{dc}]",
                                   f"[{nc}]{bp.night_rating}[/{nc}]", bp.best_direction)
            console.print(band_table)
        suggested = prop_mgr.get_suggested_band()
        print_info(f"Recommended band right now: {suggested}")
    else:
        print("Solar Activity Indices")
        print("=" * 50)
        print(f"SFI:  {solar.sfi:.0f}\nA-Index: {solar.a_index}\nK-Index: {solar.k_index:.1f}\nSSN:  {solar.ssn}\n")
        band_props = prop_mgr.calculate_band_propagation(solar)
        print(f"{'Band':<8} {'Day':>5} {'Night':>5}  Best Direction")
        print("-" * 50)
        for bp in band_props:
            print(f"{bp.band:<8} {bp.day_rating:>5d} {bp.night_rating:>5d}  {bp.best_direction}")
        print(f"\nRecommended band: {prop_mgr.get_suggested_band()}")
    trend = prop_mgr.get_7day_trend()
    if trend:
        print("\n7-Day Solar Trend:")
        print(f"{'Date':<12} {'SFI':>6} {'A':>4} {'K':>5} {'SSN':>5}")
        print("-" * 35)
        for s in reversed(trend):
            print(f"{s.date:<12} {s.sfi:>6.0f} {s.a_index:>4d} {s.k_index:>5.1f} {s.ssn:>5d}")


def cmd_contest(args, config, db):
    qso_mgr = QSOMANAGER(db)
    default_band = args.band or config["preferences"].get("default_band", "20m")
    default_mode = args.mode or config["preferences"].get("default_mode", "SSB")
    print("Contest Mode - Fast QSO Entry")
    print("=" * 50)
    print("Enter callsign to log QSO. Press Ctrl+D or 'q' to quit.")
    print()
    use_prompt = False
    try:
        from prompt_toolkit import prompt as pt_prompt
        from prompt_toolkit.completion import WordCompleter, merge_completers
        band_completer = WordCompleter(BANDS, sentence=True)
        mode_completer = WordCompleter(MODES, sentence=True)
        combined_completer = merge_completers(band_completer, mode_completer)
        use_prompt = True
    except ImportError:
        pass
    count = 0
    contest_session_date = format_date(now_utc_datetime())
    try:
        if use_prompt:
            from prompt_toolkit import PromptSession
            from prompt_toolkit.key_binding import KeyBindings

            session = PromptSession(completer=combined_completer)
            kb = KeyBindings()

            @kb.add('enter')
            def _(event):
                nonlocal count
                buf = event.app.current_buffer
                line = buf.text.strip()
                buf.text = ''
                if line.lower() in ('q', 'quit', 'exit'):
                    event.app.exit()
                    return
                if not line:
                    return
                parts = line.split()
                callsign = parts[0].upper()
                rst_rcvd = parts[1] if len(parts) > 1 else None
                now = now_utc_datetime()
                qso = QSO(callsign=callsign, qso_date=format_date(now), qso_time=format_time(now),
                           band=default_band, mode=default_mode, rst_rcvd=rst_rcvd,
                           rst_sent=args.rst_sent or "59",
                           operator=config["operator"].get("callsign") or None,
                           station_callsign=config["operator"].get("callsign") or None,
                           my_grid=config["operator"].get("grid") or None,
                           contest_id=args.contest_id)
                try:
                    qso_id = qso_mgr.add(qso)
                    count += 1
                    try:
                        event.app.print(f"[green]INFO:[/green] #{count} QSO logged: {callsign} (ID: {qso_id})")
                    except Exception:
                        event.app.output.write_raw(f"INFO: #{count} QSO logged: {callsign} (ID: {qso_id})\r\n")
                except ValueError as e:
                    msg = str(e)
                    if "Duplicate" in msg:
                        try:
                            event.app.print(f"[yellow]WARNING:[/yellow] Duplicate: {callsign}")
                        except Exception:
                            event.app.output.write_raw(f"WARNING: Duplicate: {callsign}\r\n")
                    else:
                        try:
                            event.app.print(f"[red]ERROR:[/red] {msg}")
                        except Exception:
                            event.app.output.write_raw(f"ERROR: {msg}\r\n")

            while True:
                try:
                    session.prompt(f"[{default_band} {default_mode}] Callsign: ", key_bindings=kb)
                except EOFError:
                    break
        else:
            while True:
                try:
                    line = input(f"[{default_band} {default_mode}] Callsign: ").strip()
                except EOFError:
                    break
                if line.lower() in ("q", "quit", "exit"):
                    break
                if not line:
                    continue
                parts = line.split()
                callsign = parts[0].upper()
                rst_rcvd = None
                if len(parts) > 1:
                    rst_rcvd = parts[1]
                now = now_utc_datetime()
                qso = QSO(callsign=callsign, qso_date=format_date(now), qso_time=format_time(now),
                           band=default_band, mode=default_mode, rst_rcvd=rst_rcvd,
                           rst_sent=args.rst_sent or "59",
                           operator=config["operator"].get("callsign") or None,
                           station_callsign=config["operator"].get("callsign") or None,
                           my_grid=config["operator"].get("grid") or None,
                           contest_id=args.contest_id)
                try:
                    qso_id = qso_mgr.add(qso)
                    count += 1
                    print_info(f"#{count} QSO logged: {callsign} (ID: {qso_id})")
                except ValueError as e:
                    if "Duplicate" in str(e):
                        print_warning(f"Duplicate: {callsign}")
                    else:
                        print_error(str(e))
    except KeyboardInterrupt:
        pass
    print()
    print_info(f"Contest session ended. {count} QSOs logged.")
    today_qsos = qso_mgr.search(date_from=contest_session_date, date_to=contest_session_date,
                                 order_by="qso_date ASC, qso_time ASC", limit=10000)
    if today_qsos:
        print(f"\nToday's QSOs ({len(today_qsos)} total, sorted by UTC ascending):")
        print(f"{'#':<4} {'Call':<12} {'Time':<7} {'Band':<6} {'Mode':<6} {'RST':<5}")
        print("-" * 45)
        for i, q in enumerate(today_qsos, 1):
            print(f"{i:<4} {q.callsign:<12} {q.qso_time+'Z':<7} {q.band:<6} {q.mode:<6} {q.rst_rcvd or '':<5}")


def cmd_config_show(args, config, db):
    console, Table, box = try_rich_import()
    config_path = get_config_path()
    if console and Table:
        table = Table(title=f"Configuration ({config_path})", box=box.SIMPLE)
        table.add_column("Section")
        table.add_column("Key")
        table.add_column("Value")
        for section, values in config.items():
            if isinstance(values, dict):
                first = True
                for key, value in values.items():
                    if first:
                        table.add_row(f"[bold]{section}[/bold]", key, str(value))
                        first = False
                    else:
                        table.add_row("", key, str(value))
        console.print(table)
    else:
        print(f"Configuration file: {config_path}\n")
        for section, values in config.items():
            if isinstance(values, dict):
                print(f"[{section}]")
                for key, value in values.items():
                    print(f"  {key} = {value}")
                print()


def cmd_config_set(args, config, db):
    keys = args.key.split(".")
    if len(keys) != 2:
        print_error("Key must be in format: section.key")
        sys.exit(1)
    section, option = keys
    if section not in config:
        print_error(f"Unknown section: {section}")
        sys.exit(1)
    if not isinstance(config[section], dict):
        print_error(f"Cannot set value in non-dict section: {section}")
        sys.exit(1)
    current = config[section].get(option)
    if isinstance(current, bool):
        config[section][option] = args.value.lower() in ("true", "1", "yes", "on")
    elif isinstance(current, int):
        try: config[section][option] = int(args.value)
        except ValueError: print_error("Value must be an integer"); sys.exit(1)
    elif isinstance(current, float):
        try: config[section][option] = float(args.value)
        except ValueError: print_error("Value must be a number"); sys.exit(1)
    else:
        config[section][option] = args.value
    save_config(config)
    print_info(f"Set {section}.{option} = {args.value}")


def cmd_stats(args, config, db):
    qso_mgr = QSOMANAGER(db)
    award_mgr = AwardManager(db)
    console, Table, box = try_rich_import()
    total = qso_mgr.count()
    unique_calls = len(qso_mgr.unique_callsigns())
    dxcc = award_mgr.dxcc_status()
    was = award_mgr.was_status()
    waz = award_mgr.waz_status()
    yearly = award_mgr.yearly_summary()
    band_summary = award_mgr.band_summary()
    if console and Table:
        table = Table(title="HAMLOG Statistics", box=box.SIMPLE)
        table.add_column("Metric")
        table.add_column("Value", justify="right")
        table.add_row("Total QSOs", str(total))
        table.add_row("Unique Callsigns", str(unique_calls))
        table.add_row("DXCC Entities", str(dxcc.worked))
        table.add_row("US States (WAS)", str(was.worked))
        table.add_row("CQ Zones (WAZ)", str(waz.worked))
        console.print(table)
        if yearly:
            yr_table = Table(title="Annual Summary", box=box.SIMPLE)
            yr_table.add_column("Year")
            yr_table.add_column("QSOs", justify="right")
            yr_table.add_column("Unique Calls", justify="right")
            yr_table.add_column("DXCC", justify="right")
            for yr in yearly:
                yr_table.add_row(yr["year"] or "Unknown", str(yr["qso_count"]),
                                 str(yr["unique_calls"]), str(yr["dxcc_count"]))
            console.print(yr_table)
        if band_summary:
            bd_table = Table(title="Band Summary", box=box.SIMPLE)
            bd_table.add_column("Band")
            bd_table.add_column("QSOs", justify="right")
            bd_table.add_column("DXCC", justify="right")
            for bs in band_summary:
                bc = get_band_color(bs["band"])
                bd_table.add_row(f"[{bc}]{bs['band']}[/{bc}]", str(bs["qso_count"]), str(bs["dxcc_count"]))
            console.print(bd_table)
    else:
        print("HAMLOG Statistics")
        print("=" * 50)
        print(f"Total QSOs:        {total}")
        print(f"Unique Callsigns:  {unique_calls}")
        print(f"DXCC Entities:     {dxcc.worked}/{dxcc.total}")
        print(f"US States:         {was.worked}/{was.total}")
        print(f"CQ Zones:          {waz.worked}/{waz.total}")
        if yearly:
            print("\nAnnual Summary:")
            print(f"{'Year':<8} {'QSOs':>6} {'Unique':>8} {'DXCC':>6}")
            print("-" * 35)
            for yr in yearly:
                print(f"{yr['year'] or 'Unknown':<8} {yr['qso_count']:>6} {yr['unique_calls']:>8} {yr['dxcc_count']:>6}")


def build_parser():
    parser = argparse.ArgumentParser(
        prog="hamlog",
        description="HAMLOG - Amateur Radio QSO Logging Tool v%s" % VERSION,
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose logging")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    qso_parser = subparsers.add_parser("qso", help="QSO management")
    qso_sub = qso_parser.add_subparsers(dest="qso_command", help="QSO subcommands")

    qso_add = qso_sub.add_parser("add", help="Add a new QSO")
    qso_add.add_argument("-c", "--callsign", help="Callsign of station worked")
    qso_add.add_argument("-f", "--freq", type=float, required=True,
                         help="Frequency in MHz (required)")
    qso_add.add_argument("-b", "--band", choices=BANDS, help="Band (auto-detected from freq if not set)")
    qso_add.add_argument("-m", "--mode", choices=MODES, help="Mode")
    qso_add.add_argument("--date", help="QSO date (YYYYMMDD, default: today)")
    qso_add.add_argument("--time", help="QSO time (HHMM, default: now)")
    qso_add.add_argument("--rst-sent", help="RST sent")
    qso_add.add_argument("--rst-rcvd", help="RST received")
    qso_add.add_argument("--grid", help="Maidenhead grid locator")
    qso_add.add_argument("--name", help="Operator name")
    qso_add.add_argument("--qth", help="QTH / location")
    qso_add.add_argument("--state", help="US state abbreviation")
    qso_add.add_argument("--cq-zone", type=int, help="CQ zone")
    qso_add.add_argument("--ituzone", type=int, help="ITU zone")
    qso_add.add_argument("--dxcc", type=int, help="DXCC entity ID")
    qso_add.add_argument("--country", help="Country name")
    qso_add.add_argument("--comment", help="Comment")
    qso_add.add_argument("--notes", help="Notes")
    qso_add.add_argument("--contest-id", help="Contest identifier")
    qso_add.add_argument("--srx", type=int, help="Serial number received")
    qso_add.add_argument("--srx-string", help="Serial string received")
    qso_add.add_argument("--stx", type=int, help="Serial number sent")
    qso_add.add_argument("--stx-string", help="Serial string sent")
    qso_add.add_argument("--batch", action="store_true",
                         help="Batch mode: read callsigns from stdin")

    qso_search = qso_sub.add_parser("search", help="Search QSOs")
    qso_search.add_argument("-c", "--callsign", help="Filter by callsign")
    qso_search.add_argument("-r", "--regex", help="Filter by callsign regex")
    qso_search.add_argument("-b", "--band", choices=BANDS, nargs='+',
                            help="Filter by band(s) (space-separated, multiple allowed)")
    qso_search.add_argument("-m", "--mode", choices=MODES, nargs='+',
                            help="Filter by mode(s) (space-separated, multiple allowed)")
    qso_search.add_argument("--date-from", help="Start date (YYYYMMDD)")
    qso_search.add_argument("--date-to", help="End date (YYYYMMDD)")
    qso_search.add_argument("--dxcc", type=int, help="Filter by DXCC entity ID")
    qso_search.add_argument("--state", help="Filter by US state")
    qso_search.add_argument("--cq-zone", type=int, help="Filter by CQ zone")
    qso_search.add_argument("--limit", type=int, default=1000, help="Max results (default: 1000)")
    qso_search.add_argument("--offset", type=int, default=0, help="Result offset")

    qso_export = qso_sub.add_parser("export", help="Export QSOs")
    qso_export.add_argument("-f", "--format", choices=["adif", "csv"], default="adif",
                            help="Export format (default: adif)")
    qso_export.add_argument("-o", "--output", help="Output file path")
    qso_export.add_argument("-c", "--callsign", help="Filter by callsign")
    qso_export.add_argument("-b", "--band", help="Filter by band(s, comma-separated)")
    qso_export.add_argument("-m", "--mode", help="Filter by mode(s, comma-separated)")
    qso_export.add_argument("--date-from", help="Start date (YYYYMMDD)")
    qso_export.add_argument("--date-to", help="End date (YYYYMMDD)")
    qso_export.add_argument("--dedupe", action="store_true",
                            help="Deduplicate by callsign (keep first)")

    qso_import = qso_sub.add_parser("import", help="Import QSOs from ADIF file")
    qso_import.add_argument("file", help="ADIF file to import")

    award_parser = subparsers.add_parser("award", help="Award progress tracking")
    award_parser.add_argument("-b", "--band", help="Filter by band")
    award_parser.add_argument("--show-missing", action="store_true", help="Show missing entities")

    prop_parser = subparsers.add_parser("propagation", help="Propagation forecast")
    prop_parser.add_argument("-b", "--band", help="Show propagation for specific band")
    prop_parser.add_argument("--refresh", action="store_true", help="Force refresh solar data")

    contest_parser = subparsers.add_parser("contest", help="Contest mode - fast QSO entry")
    contest_parser.add_argument("-b", "--band", help="Default band")
    contest_parser.add_argument("-m", "--mode", help="Default mode")
    contest_parser.add_argument("--rst-sent", default="59", help="Default RST sent (default: 59)")
    contest_parser.add_argument("--contest-id", help="Contest identifier")

    config_parser = subparsers.add_parser("config", help="Configuration management")
    config_sub = config_parser.add_subparsers(dest="config_command", help="Config subcommands")
    config_sub.add_parser("show", help="Show current configuration")
    config_set = config_sub.add_parser("set", help="Set a configuration value")
    config_set.add_argument("key", help="Config key in format: section.key")
    config_set.add_argument("value", help="Config value to set")

    subparsers.add_parser("stats", help="Show log statistics")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)
    setup_logging(getattr(args, 'verbose', False))
    generate_default_config()
    config = get_config()
    db = Database()
    db.init_schema()
    if args.command == "qso":
        if not args.qso_command:
            parser.parse_args(["qso", "--help"])
            sys.exit(0)
        if args.qso_command == "add":
            if not args.band and args.freq:
                args.band = freq_to_band(args.freq)
            cmd_qso_add(args, config, db)
        elif args.qso_command == "search":
            cmd_qso_search(args, config, db)
        elif args.qso_command == "export":
            cmd_qso_export(args, config, db)
        elif args.qso_command == "import":
            cmd_qso_import(args, config, db)
    elif args.command == "award":
        cmd_award_status(args, config, db)
    elif args.command == "propagation":
        cmd_propagation(args, config, db)
    elif args.command == "contest":
        cmd_contest(args, config, db)
    elif args.command == "config":
        if not args.config_command:
            cmd_config_show(args, config, db)
        elif args.config_command == "show":
            cmd_config_show(args, config, db)
        elif args.config_command == "set":
            cmd_config_set(args, config, db)
    elif args.command == "stats":
        cmd_stats(args, config, db)


if __name__ == "__main__":
    main()