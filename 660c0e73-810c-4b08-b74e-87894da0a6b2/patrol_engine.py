from __future__ import annotations

import os
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import cv2
import numpy as np
from loguru import logger

from alert_manager import AlertEvent, AlertManager
from data_store import DataStore
from image_analyzer import AnalysisResult, GaugeType, ImageAnalyzer
from screen_capture import CaptureRegion, ScreenCapture


@dataclass
class PatrolPointState:
    point_id: str
    last_patrol_time: float = 0.0
    last_result: Optional[AnalysisResult] = None
    last_duration_ms: float = 0.0
    total_patrols: int = 0
    total_anomalies: int = 0
    error_count: int = 0


@dataclass
class PatrolStats:
    total_points: int = 0
    completed_points: int = 0
    failed_points: int = 0
    anomalies_detected: int = 0
    alerts_fired: int = 0
    round_start_time: float = 0.0
    round_duration_ms: float = 0.0
    current_point_id: str = ""


class ImageCacheManager:
    def __init__(self, cache_dir: str, max_images: int = 1000):
        self.cache_dir = cache_dir
        self.max_images = max_images
        self._cache_queue: deque[str] = deque()
        os.makedirs(cache_dir, exist_ok=True)

    def save_image(self, point_id: str, image: np.ndarray) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"{point_id}_{timestamp}.png"
        filepath = os.path.join(self.cache_dir, filename)
        cv2.imwrite(filepath, image)
        self._cache_queue.append(filepath)

        while len(self._cache_queue) > self.max_images:
            oldest = self._cache_queue.popleft()
            try:
                if os.path.exists(oldest):
                    os.remove(oldest)
            except OSError:
                pass

        return filepath

    def cleanup(self):
        while len(self._cache_queue) > self.max_images:
            oldest = self._cache_queue.popleft()
            try:
                if os.path.exists(oldest):
                    os.remove(oldest)
            except OSError:
                pass


class PatrolEngine:
    def __init__(self, config: dict):
        self.config = config
        self.global_config = config.get("global", {})
        self.schedule_config = config.get("schedule", {})
        self.screens = config.get("screens", [])
        self.alert_config = config.get("alert", {})

        self.screen_capture = ScreenCapture()
        self.image_analyzer = ImageAnalyzer()
        self.data_store = DataStore(
            db_path=self.global_config.get("db_path", "./data/patrol.db"),
            export_dir=self.global_config.get("excel_export_dir", "./exports"),
        )
        self.alert_manager = AlertManager(self.alert_config)

        self._image_cache = ImageCacheManager(
            cache_dir=self.global_config.get(
                "image_cache_dir", "./image_cache",
            ),
            max_images=self.global_config.get("image_cache_max", 1000),
        )

        self._point_states: dict[str, PatrolPointState] = {}
        self._running = False
        self._stats = PatrolStats(total_points=len(self.screens))

        for screen in self.screens:
            pid = screen["id"]
            self._point_states[pid] = PatrolPointState(point_id=pid)

        self.alert_manager.register_callback(self._on_alert)

    def _on_alert(self, alert: AlertEvent):
        self.data_store.save_alert_event(
            point_id=alert.point_id,
            point_name=alert.point_name,
            alert_type=alert.alert_type,
            alert_level=alert.alert_level,
            current_value=alert.current_value,
            threshold_value=alert.threshold_value,
            message=alert.message,
            timestamp=alert.timestamp,
        )
        self._stats.alerts_fired += 1

    def patrol_point(self, point_config: dict) -> Optional[AnalysisResult]:
        point_id = point_config["id"]
        state = self._point_states.get(point_id)
        if state is None:
            state = PatrolPointState(point_id=point_id)
            self._point_states[point_id] = state

        self._stats.current_point_id = point_id
        start_time = time.time()

        try:
            region_config = point_config["capture_region"]
            region = CaptureRegion(
                x=region_config["x"],
                y=region_config["y"],
                width=region_config["width"],
                height=region_config["height"],
            )

            image = self.screen_capture.capture_region(
                region=region,
                window_title=point_config.get("window_title"),
                template_path=point_config.get("template_image"),
                monitor_index=point_config.get("monitor_index", 0),
            )

            if image is None:
                logger.error(f"Capture failed for {point_id}")
                result = AnalysisResult(
                    point_id=point_id,
                    gauge_type=GaugeType(point_config["type"]),
                    timestamp=datetime.now().isoformat(),
                    error="Screenshot capture failed",
                )
                state.error_count += 1
                self._stats.failed_points += 1
                self._process_result(result, point_config)
                return result

            cache_path = self._image_cache.save_image(point_id, image)
            logger.debug(f"Cached image: {cache_path}")

            gauge_type = GaugeType(point_config["type"])
            result = self.image_analyzer.analyze(
                point_id=point_id,
                gauge_type=gauge_type,
                image=image,
                config=point_config,
            )

            elapsed_ms = (time.time() - start_time) * 1000
            result.timestamp = datetime.now().isoformat()

            state.last_patrol_time = time.time()
            state.last_result = result
            state.last_duration_ms = elapsed_ms
            state.total_patrols += 1

            self._stats.completed_points += 1

            self._process_result(result, point_config)

            logger.info(
                f"Patrol {point_id}: "
                f"value={self._format_value(result, gauge_type)} "
                f"({elapsed_ms:.0f}ms)"
            )

            return result

        except Exception as e:
            logger.error(f"Patrol point {point_id} error: {e}")
            state.error_count += 1
            self._stats.failed_points += 1

            result = AnalysisResult(
                point_id=point_id,
                gauge_type=GaugeType(point_config["type"]),
                timestamp=datetime.now().isoformat(),
                error=str(e),
            )
            self._process_result(result, point_config)
            return result

    def _process_result(
        self, result: AnalysisResult, point_config: dict,
    ):
        alerts = self.alert_manager.check_threshold(result, point_config)
        if alerts:
            fired = self.alert_manager.fire_alerts(alerts)
            if fired:
                self._point_states[result.point_id].total_anomalies += 1
                self._stats.anomalies_detected += 1

        self.data_store.save_patrol_record(result, point_config)

    def patrol_round(self) -> list[AnalysisResult]:
        self._stats = PatrolStats(total_points=len(self.screens))
        self._stats.round_start_time = time.time()

        logger.info(
            f"=== Starting patrol round ({len(self.screens)} points) ==="
        )

        results = []
        for screen_config in self.screens:
            if not self._running:
                logger.info("Patrol round interrupted")
                break

            result = self.patrol_point(screen_config)
            if result:
                results.append(result)

            per_point_timeout = self.schedule_config.get(
                "per_point_timeout_sec", 2,
            )
            time.sleep(min(0.1, per_point_timeout * 0.05))

        self._stats.round_duration_ms = (
            (time.time() - self._stats.round_start_time) * 1000
        )
        logger.info(
            f"=== Patrol round completed: "
            f"{self._stats.completed_points}/{self._stats.total_points} "
            f"points, {self._stats.anomalies_detected} anomalies, "
            f"{self._stats.round_duration_ms:.0f}ms ==="
        )

        return results

    def run(self):
        self._running = True
        default_interval = self.schedule_config.get(
            "default_interval_sec", 900,
        )
        round_timeout = self.schedule_config.get("round_timeout_sec", 120)

        logger.info(
            f"Patrol engine started: {len(self.screens)} points, "
            f"interval={default_interval}s"
        )

        next_patrol_times: dict[str, float] = {
            s["id"]: 0.0 for s in self.screens
        }

        while self._running:
            round_start = time.time()

            for screen_config in self.screens:
                if not self._running:
                    break

                point_id = screen_config["id"]
                interval = screen_config.get(
                    "interval_sec", default_interval,
                )
                next_time = next_patrol_times.get(point_id, 0.0)

                if time.time() >= next_time:
                    self.patrol_point(screen_config)
                    next_patrol_times[point_id] = time.time() + interval

            elapsed = time.time() - round_start
            if elapsed < round_timeout:
                sleep_time = min(1.0, round_timeout - elapsed)
                for _ in range(int(sleep_time * 10)):
                    if not self._running:
                        break
                    time.sleep(0.1)
            else:
                time.sleep(0.1)

            self._periodic_maintenance()

    def stop(self):
        self._running = False
        logger.info("Patrol engine stopping...")

    def _periodic_maintenance(self):
        now = datetime.now()
        if now.minute == 0 and now.second < 15:
            retention = self.global_config.get("log_retention_days", 90)
            self.data_store.cleanup_old_records(retention)
            self._image_cache.cleanup()

    def get_stats(self) -> dict:
        stats = {
            "running": self._running,
            "total_points": self._stats.total_points,
            "current_point": self._stats.current_point_id,
            "round_duration_ms": self._stats.round_duration_ms,
        }
        for pid, state in self._point_states.items():
            stats[f"point_{pid}_last"] = (
                datetime.fromtimestamp(state.last_patrol_time).isoformat()
                if state.last_patrol_time > 0 else "never"
            )
            stats[f"point_{pid}_patrols"] = state.total_patrols
            stats[f"point_{pid}_anomalies"] = state.total_anomalies
        return stats

    def get_point_states(self) -> dict[str, PatrolPointState]:
        return dict(self._point_states)

    @staticmethod
    def _format_value(result: AnalysisResult, gauge_type: GaugeType) -> str:
        if gauge_type == GaugeType.DIGITAL and result.digital_result:
            v = result.digital_result.value
            return f"{v}" if v is not None else "N/A"
        if gauge_type == GaugeType.POINTER and result.pointer_result:
            v = result.pointer_result.value
            return f"{v}" if v is not None else "N/A"
        if gauge_type == GaugeType.ALARM_LIGHTS and result.alarm_results:
            states = [f"{ar.label}={ar.state.value}" for ar in result.alarm_results]
            return " | ".join(states)
        return "N/A"
