from __future__ import annotations

import os
import platform
import subprocess
import threading
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Optional

from loguru import logger

from image_analyzer import AlarmLightState, AnalysisResult, GaugeType


@dataclass
class AlertEvent:
    point_id: str
    point_name: str
    alert_type: str
    alert_level: str
    current_value: str
    threshold_value: str
    message: str
    timestamp: str


class AlertManager:
    def __init__(self, config: dict):
        self.dedup_window = config.get("dedup_window_sec", 300)
        self.sound_enabled = config.get("sound_enabled", True)
        self.sound_file = config.get("sound_file", "")
        self.popup_duration = config.get("popup_duration_sec", 10)
        self.notification_title = config.get(
            "notification_title", "化工厂巡检告警",
        )
        self._last_alert_time: dict[str, float] = defaultdict(float)
        self._callbacks: list[Callable[[AlertEvent], None]] = []
        self._sound_available = False

        if self.sound_enabled and self.sound_file and os.path.exists(self.sound_file):
            self._sound_available = True
        elif self.sound_enabled:
            self._sound_available = True

    def register_callback(self, callback: Callable[[AlertEvent], None]):
        self._callbacks.append(callback)

    def check_threshold(
        self,
        result: AnalysisResult,
        point_config: dict,
    ) -> list[AlertEvent]:
        alerts = []
        point_id = result.point_id
        point_name = point_config.get("name", point_id)
        threshold = point_config.get("threshold", {})
        now = datetime.now().isoformat()

        if result.gauge_type in (GaugeType.DIGITAL, GaugeType.POINTER):
            value = None
            if result.gauge_type == GaugeType.DIGITAL and result.digital_result:
                value = result.digital_result.value
            elif result.gauge_type == GaugeType.POINTER and result.pointer_result:
                value = result.pointer_result.value

            if value is not None and threshold:
                hh = threshold.get("high_high")
                ll = threshold.get("low_low")
                high = threshold.get("high")
                low = threshold.get("low")

                if hh is not None and value >= hh:
                    alerts.append(AlertEvent(
                        point_id=point_id,
                        point_name=point_name,
                        alert_type="high_high",
                        alert_level="critical",
                        current_value=str(value),
                        threshold_value=str(hh),
                        message=(
                            f"{point_name} 读数 {value} 超过高高限 {hh}"
                        ),
                        timestamp=now,
                    ))
                elif high is not None and value >= high:
                    alerts.append(AlertEvent(
                        point_id=point_id,
                        point_name=point_name,
                        alert_type="high",
                        alert_level="warning",
                        current_value=str(value),
                        threshold_value=str(high),
                        message=(
                            f"{point_name} 读数 {value} 超过高限 {high}"
                        ),
                        timestamp=now,
                    ))

                if ll is not None and value <= ll:
                    alerts.append(AlertEvent(
                        point_id=point_id,
                        point_name=point_name,
                        alert_type="low_low",
                        alert_level="critical",
                        current_value=str(value),
                        threshold_value=str(ll),
                        message=(
                            f"{point_name} 读数 {value} 低于低低限 {ll}"
                        ),
                        timestamp=now,
                    ))
                elif low is not None and value <= low:
                    alerts.append(AlertEvent(
                        point_id=point_id,
                        point_name=point_name,
                        alert_type="low",
                        alert_level="warning",
                        current_value=str(value),
                        threshold_value=str(low),
                        message=(
                            f"{point_name} 读数 {value} 低于低限 {low}"
                        ),
                        timestamp=now,
                    ))

        elif result.gauge_type == GaugeType.ALARM_LIGHTS:
            for alarm_result in result.alarm_results:
                if alarm_result.state == AlarmLightState.RED:
                    alerts.append(AlertEvent(
                        point_id=point_id,
                        point_name=point_name,
                        alert_type="alarm_red",
                        alert_level="critical",
                        current_value=alarm_result.state.value,
                        threshold_value="RED",
                        message=(
                            f"{point_name} - {alarm_result.label} 报警灯红色"
                        ),
                        timestamp=now,
                    ))
                elif alarm_result.state == AlarmLightState.YELLOW:
                    alerts.append(AlertEvent(
                        point_id=point_id,
                        point_name=point_name,
                        alert_type="alarm_yellow",
                        alert_level="warning",
                        current_value=alarm_result.state.value,
                        threshold_value="GREEN",
                        message=(
                            f"{point_name} - {alarm_result.label} 报警灯黄色"
                        ),
                        timestamp=now,
                    ))

        if result.error:
            alerts.append(AlertEvent(
                point_id=point_id,
                point_name=point_name,
                alert_type="recognition_error",
                alert_level="warning",
                current_value="N/A",
                threshold_value="N/A",
                message=f"{point_name} 图像识别失败: {result.error}",
                timestamp=now,
            ))

        return alerts

    def fire_alerts(self, alerts: list[AlertEvent]) -> list[AlertEvent]:
        fired = []
        for alert in alerts:
            dedup_key = f"{alert.point_id}:{alert.alert_type}"
            last_time = self._last_alert_time[dedup_key]
            now = time.time()

            if now - last_time < self.dedup_window:
                logger.debug(
                    f"Alert deduped: {dedup_key} "
                    f"(last {self.dedup_window - (now - last_time):.0f}s ago)"
                )
                continue

            self._last_alert_time[dedup_key] = now
            fired.append(alert)

            logger.warning(
                f"ALERT [{alert.alert_level.upper()}] {alert.message}"
            )

            self._send_desktop_notification(alert)
            self._play_alert_sound()

            for callback in self._callbacks:
                try:
                    callback(alert)
                except Exception as e:
                    logger.error(f"Alert callback error: {e}")

        return fired

    def _send_desktop_notification(self, alert: AlertEvent):
        system = platform.system()
        try:
            if system == "Darwin":
                self._notify_macos(alert)
            elif system == "Linux":
                self._notify_linux(alert)
            elif system == "Windows":
                self._notify_windows(alert)
            else:
                logger.warning(f"Unsupported OS for notifications: {system}")
        except Exception as e:
            logger.error(f"Desktop notification failed: {e}")

    def _notify_macos(self, alert: AlertEvent):
        title = f"{self.notification_title} [{alert.alert_level.upper()}]"
        body = alert.message
        script = (
            f'display notification "{body}" with title "{title}" '
            f'sound name "Submarine"'
        )
        subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, timeout=5,
        )

    def _notify_linux(self, alert: AlertEvent):
        title = f"{self.notification_title} [{alert.alert_level.upper()}]"
        body = alert.message
        urgency = "critical" if alert.alert_level == "critical" else "normal"
        subprocess.run(
            [
                "notify-send",
                "-u", urgency,
                "-t", str(self.popup_duration * 1000),
                title, body,
            ],
            capture_output=True, timeout=5,
        )

    def _notify_windows(self, alert: AlertEvent):
        try:
            from ctypes import windll
            title = f"{self.notification_title} [{alert.alert_level.upper()}]"
            windll.user32.MessageBoxTimeoutW(
                0, alert.message, title, 0x40, 0,
                self.popup_duration * 1000,
            )
        except Exception:
            pass

    def _play_alert_sound(self):
        if not self.sound_enabled:
            return
        try:
            if self._sound_available and self.sound_file and os.path.exists(self.sound_file):
                threading.Thread(
                    target=lambda: subprocess.run(
                        ["afplay", self.sound_file],
                        capture_output=True, timeout=5,
                    ),
                    daemon=True,
                ).start()
            else:
                system = platform.system()
                if system == "Darwin":
                    subprocess.run(
                        ["osascript", "-e", 'beep 2'],
                        capture_output=True, timeout=3,
                    )
                elif system == "Linux":
                    subprocess.run(
                        ["aplay", "-q", "/usr/share/sounds/alert.wav"],
                        capture_output=True, timeout=3,
                    )
        except Exception as e:
            logger.debug(f"Sound alert failed: {e}")
