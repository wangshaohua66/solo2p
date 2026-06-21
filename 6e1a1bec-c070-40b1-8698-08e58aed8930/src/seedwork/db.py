import json
import os
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Generator, Optional

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Boolean,
    create_engine,
    func,
)
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

from .logger import get_logger

logger = get_logger()
Base = declarative_base()


def load_config(config_path: Optional[str] = None) -> dict:
    if config_path is None:
        config_path = os.path.join(
            os.path.dirname(__file__), "config.json"
        )
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    network = Column(String(10), nullable=False)
    station = Column(String(20), nullable=False)
    location = Column(String(10), nullable=False, default="00")
    channels = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation = Column(Float, nullable=False)
    sample_rate = Column(Float, nullable=False, default=100.0)
    sensor_type = Column(String(50))
    ftp_host = Column(String(255))
    ftp_port = Column(Integer, default=21)
    ftp_user = Column(String(100))
    ftp_password = Column(String(255))
    ftp_path = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_network_station", "network", "station", unique=True),
    )

    def get_channels_list(self) -> list[str]:
        return self.channels.split(",") if self.channels else []


class DownloadRecord(Base):
    __tablename__ = "download_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_hash = Column(String(64))
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    sample_rate = Column(Float)
    is_valid = Column(Boolean, default=True)
    download_time = Column(DateTime, default=datetime.utcnow)
    retry_count = Column(Integer, default=0)

    station = relationship("Station", backref="downloads")

    __table_args__ = (
        Index("idx_station_time", "station_id", "start_time"),
        Index("idx_filename", "filename"),
    )


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(50), unique=True, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    detection_algorithm = Column(String(50))
    trigger_value = Column(Float)
    is_candidate = Column(Boolean, default=True)
    is_reviewed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    picks = relationship("Pick", backref="event", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_event_time", "start_time"),
        Index("idx_candidate", "is_candidate"),
    )


class Pick(Base):
    __tablename__ = "picks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=False)
    phase = Column(String(10), nullable=False)
    arrival_time = Column(DateTime, nullable=False)
    uncertainty = Column(Float)
    snr = Column(Float)
    amplitude = Column(Float)
    period = Column(Float)
    algorithm = Column(String(50))
    is_automatic = Column(Boolean, default=True)
    is_reviewed = Column(Boolean, default=False)
    reviewer = Column(String(100))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    station = relationship("Station", backref="picks")

    __table_args__ = (
        Index("idx_event_phase", "event_id", "phase"),
        Index("idx_station_arrival", "station_id", "arrival_time"),
    )


class CatalogEntry(Base):
    __tablename__ = "catalog"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    origin_time = Column(DateTime, nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    depth = Column(Float)
    latitude_uncertainty = Column(Float)
    longitude_uncertainty = Column(Float)
    depth_uncertainty = Column(Float)
    magnitude = Column(Float)
    magnitude_type = Column(String(10), default="ML")
    magnitude_uncertainty = Column(Float)
    num_stations = Column(Integer)
    azimuth_gap = Column(Float)
    location_method = Column(String(50))
    status = Column(String(20), default="preliminary")
    analyst = Column(String(100))
    comments = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    event = relationship("Event", backref="catalog_entries")
    versions = relationship("CatalogVersion", backref="catalog_entry")

    __table_args__ = (
        Index("idx_origin_time", "origin_time"),
        Index("idx_magnitude", "magnitude"),
    )


class CatalogVersion(Base):
    __tablename__ = "catalog_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    catalog_id = Column(Integer, ForeignKey("catalog.id"), nullable=False)
    version = Column(Integer, nullable=False)
    origin_time = Column(DateTime)
    latitude = Column(Float)
    longitude = Column(Float)
    depth = Column(Float)
    magnitude = Column(Float)
    magnitude_type = Column(String(10))
    status = Column(String(20))
    analyst = Column(String(100))
    comments = Column(Text)
    change_description = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_catalog_version", "catalog_id", "version", unique=True),
    )


class QualityMetric(Base):
    __tablename__ = "quality_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    continuity_rate = Column(Float)
    snr_db = Column(Float)
    clock_bias_ms = Column(Float)
    dc_offset = Column(Float)
    num_gaps = Column(Integer)
    total_gap_duration = Column(Float)
    max_gap_duration = Column(Float)
    has_alert = Column(Boolean, default=False)
    alert_message = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)

    station = relationship("Station", backref="quality_metrics")

    __table_args__ = (
        Index("idx_station_date", "station_id", "date", unique=True),
        Index("idx_alert", "has_alert"),
    )


class Database:
    _instance = None
    _engine = None
    _SessionLocal = None

    def __new__(cls, db_path: Optional[str] = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            if db_path is None:
                config = load_config()
                db_path = config.get("database", {}).get("path", "./data/seedwork.db")
            cls._instance._init_db(db_path)
        return cls._instance

    def _init_db(self, db_path: str):
        db_path = str(Path(db_path).expanduser().resolve())
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

        self._engine = create_engine(
            f"sqlite:///{db_path}",
            echo=False,
            pool_pre_ping=True,
            connect_args={"check_same_thread": False}
        )
        self._SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self._engine
        )
        Base.metadata.create_all(bind=self._engine)
        logger.info(f"[green]Database initialized at:[/green] {db_path}")

    @classmethod
    def get_engine(cls):
        if cls._instance is None:
            cls()
        return cls._instance._engine

    @classmethod
    @contextmanager
    def get_session(cls) -> Generator[Session, None, None]:
        if cls._instance is None:
            cls()
        session = cls._instance._SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_count(self, table) -> int:
        with self.get_session() as session:
            return session.query(func.count(table.id)).scalar()


def get_db(db_path: Optional[str] = None) -> Database:
    return Database(db_path)
