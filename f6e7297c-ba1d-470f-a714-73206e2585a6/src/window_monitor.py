import time
import json
import logging
import threading
from typing import Dict, Any, List, Optional, Tuple

import pyautogui

from .screen_capture import ScreenCapture
from .notifier import Notifier

logger = logging.getLogger(__name__)


class WindowMonitor:
    def __init__(self, config: Dict[str, Any],
                 screen_capture: ScreenCapture,
                 notifier: Optional[Notifier] = None):
        self.config = config
        self.screen_capture = screen_capture
        self.notifier = notifier
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

        monitor_cfg = config.get("window_monitor", {})
        self.enabled = monitor_cfg.get("enabled", True)
        self.check_interval = monitor_cfg.get("check_interval_seconds", 10)
        self.offset_threshold = monitor_cfg.get("offset_threshold_pixels", 20)
        self.auto_recalibrate = monitor_cfg.get("auto_recalibrate", True)
        self.notify_on_recalibrate = monitor_cfg.get("notify_on_recalibrate", True)
        self.target_systems: List[str] = monitor_cfg.get("systems", ["yard", "dispatch", "customs"])

        self._baseline_positions: Dict[str, Dict[str, int]] = {}
        self._drift_history: Dict[str, List[Tuple[float, float, float]]] = {}
        self._recalibrate_count = 0
        self._lock = threading.Lock()

        self._capture_baseline()

    def _get_window_position(self, system_name: str) -> Optional[Dict[str, int]]:
        sys_cfg = self.config.get("systems", {}).get(system_name, {})
        window_title = sys_cfg.get("window_title", "")
        if not window_title:
            return None

        try:
            for win in pyautogui.getAllWindows():
                if win.title and window_title in win.title:
                    return {
                        "x": int(win.left),
                        "y": int(win.top),
                        "width": int(win.width),
                        "height": int(win.height),
                    }
            logger.debug(f"未找到窗口 [{system_name}]: {window_title}")
        except Exception as e:
            logger.debug(f"获取窗口位置失败 [{system_name}]: {e}")
        return None

    def _capture_baseline(self) -> None:
        with self._lock:
            self._baseline_positions.clear()
            for sys_name in self.target_systems:
                pos = self._get_window_position(sys_name)
                if pos:
                    self._baseline_positions[sys_name] = pos
                    self._drift_history[sys_name] = []
                    logger.debug(
                        f"窗口基线 [{sys_name}]: ({pos['x']},{pos['y']}) "
                        f"{pos['width']}x{pos['height']}"
                    )
                else:
                    calib = self.screen_capture.calibration.get(sys_name, {})
                    if calib and "x" in calib:
                        self._baseline_positions[sys_name] = {
                            "x": int(calib.get("x", 0)),
                            "y": int(calib.get("y", 0)),
                            "width": int(calib.get("width", 0)),
                            "height": int(calib.get("height", 0)),
                        }
                        logger.debug(f"窗口基线 [{sys_name}]: 从校准数据加载")

            if self._baseline_positions:
                logger.info(
                    f"窗口监控基线已建立: {list(self._baseline_positions.keys())}, "
                    f"阈值={self.offset_threshold}px, 检查间隔={self.check_interval}s"
                )
            else:
                logger.warning("未找到任何目标窗口，窗口监控基线为空")

    def _check_drift(self) -> List[str]:
        drifted_systems: List[str] = []

        with self._lock:
            for sys_name in self.target_systems:
                baseline = self._baseline_positions.get(sys_name)
                if not baseline:
                    continue

                current = self._get_window_position(sys_name)
                if not current:
                    continue

                dx = abs(current["x"] - baseline["x"])
                dy = abs(current["y"] - baseline["y"])
                dw = abs(current["width"] - baseline["width"])
                dh = abs(current["height"] - baseline["height"])

                history = self._drift_history.setdefault(sys_name, [])
                history.append((time.time(), dx + dy + dw + dh, max(dx, dy, dw, dh)))
                if len(history) > 30:
                    history.pop(0)

                drift = max(dx, dy, dw, dh)
                if drift > self.offset_threshold:
                    drifted_systems.append(sys_name)
                    logger.warning(
                        f"窗口位置偏移 [{sys_name}]: 基线({baseline['x']},{baseline['y']}) "
                        f"当前({current['x']},{current['y']}) "
                        f"最大偏移={drift}px > 阈值={self.offset_threshold}px"
                    )

        return drifted_systems

    def _perform_recalibrate(self, drifted_systems: List[str]) -> bool:
        if not self.auto_recalibrate:
            return False

        logger.info(f"开始对以下系统重新校准: {drifted_systems}")
        self._recalibrate_count += 1

        try:
            success = self.screen_capture.auto_calibrate()
            if success:
                self._capture_baseline()
                msg = (
                    f"窗口位置已自动重新校准（第{self._recalibrate_count}次）. "
                    f"偏移系统: {', '.join(drifted_systems)}. "
                    f"新基线: {json.dumps(self._baseline_positions, ensure_ascii=False)}"
                )
                logger.info(msg)

                if self.notify_on_recalibrate and self.notifier:
                    self.notifier.send_async(
                        level="WARNING",
                        message=msg,
                        extra={
                            "recalibrate_count": self._recalibrate_count,
                            "drifted_systems": drifted_systems,
                            "new_positions": self._baseline_positions,
                        }
                    )
                return True
            else:
                logger.error("重新校准失败")
                return False
        except Exception as e:
            logger.error(f"重新校准异常: {e}", exc_info=True)
            return False

    def start(self) -> threading.Thread:
        if not self.enabled:
            logger.info("窗口监控已在配置中禁用")
            return self._thread or threading.Thread(target=lambda: None)

        self._stop_event.clear()

        def _worker():
            logger.info(
                f"窗口监控线程已启动: 检查={self.check_interval}s, "
                f"阈值={self.offset_threshold}px, 自动校准={'ON' if self.auto_recalibrate else 'OFF'}"
            )
            while not self._stop_event.is_set():
                try:
                    drifted = self._check_drift()
                    if drifted and self.auto_recalibrate:
                        self._perform_recalibrate(drifted)
                except Exception as e:
                    logger.error(f"窗口监控循环异常: {e}", exc_info=True)
                self._stop_event.wait(self.check_interval)
            logger.info("窗口监控线程已停止")

        self._thread = threading.Thread(target=_worker, name="window_monitor", daemon=True)
        self._thread.start()
        return self._thread

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def force_recalibrate(self) -> bool:
        drifted = self._check_drift() or self.target_systems
        return self._perform_recalibrate(drifted)

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "enabled": self.enabled,
                "check_interval": self.check_interval,
                "offset_threshold": self.offset_threshold,
                "auto_recalibrate": self.auto_recalibrate,
                "recalibrate_count": self._recalibrate_count,
                "baseline_positions": self._baseline_positions,
                "target_systems": self.target_systems,
                "is_running": self._thread is not None and self._thread.is_alive(),
            }
