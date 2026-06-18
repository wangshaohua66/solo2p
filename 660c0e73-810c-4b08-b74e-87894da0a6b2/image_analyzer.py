from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import cv2
import numpy as np
from loguru import logger


class GaugeType(str, Enum):
    DIGITAL = "digital_gauge"
    POINTER = "pointer_gauge"
    ALARM_LIGHTS = "alarm_lights"


class AlarmLightState(str, Enum):
    RED = "red"
    YELLOW = "yellow"
    GREEN = "green"
    OFF = "off"


@dataclass
class DigitalGaugeResult:
    value: Optional[float]
    raw_text: str
    confidence: float


@dataclass
class PointerGaugeResult:
    value: Optional[float]
    angle: float
    confidence: float


@dataclass
class AlarmLightResult:
    index: int
    label: str
    state: AlarmLightState
    confidence: float


@dataclass
class AnalysisResult:
    point_id: str
    gauge_type: GaugeType
    digital_result: Optional[DigitalGaugeResult] = None
    pointer_result: Optional[PointerGaugeResult] = None
    alarm_results: list[AlarmLightResult] = field(default_factory=list)
    timestamp: Optional[str] = None
    error: Optional[str] = None


class DigitalGaugeRecognizer:
    def __init__(self):
        self._digit_templates: dict[int, np.ndarray] = {}

    def _preprocess(self, image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        _, binary = cv2.threshold(
            enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
        return cleaned

    def _perspective_correct(self, image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        contours, _ = cv2.findContours(
            edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            return image

        largest = max(contours, key=cv2.contourArea)
        peri = cv2.arcLength(largest, True)
        approx = cv2.approxPolyDP(largest, 0.02 * peri, True)

        if len(approx) == 4:
            pts = approx.reshape(4, 2).astype(np.float32)
            rect = self._order_points(pts)
            (tl, tr, br, bl) = rect
            width_top = np.linalg.norm(tr - tl)
            width_bottom = np.linalg.norm(br - bl)
            max_w = max(int(width_top), int(width_bottom))
            height_left = np.linalg.norm(bl - tl)
            height_right = np.linalg.norm(br - tr)
            max_h = max(int(height_left), int(height_right))
            if max_w > 0 and max_h > 0:
                dst = np.array([
                    [0, 0], [max_w - 1, 0],
                    [max_w - 1, max_h - 1], [0, max_h - 1],
                ], dtype=np.float32)
                M = cv2.getPerspectiveTransform(rect, dst)
                return cv2.warpPerspective(
                    image, M, (max_w, max_h),
                    flags=cv2.INTER_LINEAR,
                )
        return image

    @staticmethod
    def _order_points(pts: np.ndarray) -> np.ndarray:
        rect = np.zeros((4, 2), dtype=np.float32)
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]
        rect[2] = pts[np.argmax(s)]
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]
        rect[3] = pts[np.argmax(diff)]
        return rect

    def recognize(self, image: np.ndarray) -> DigitalGaugeResult:
        try:
            corrected = self._perspective_correct(image)
            binary = self._preprocess(corrected)
            text, conf = self._ocr_digits(binary)
            value = self._parse_value(text)
            return DigitalGaugeResult(
                value=value, raw_text=text, confidence=conf,
            )
        except Exception as e:
            logger.error(f"Digital gauge recognition failed: {e}")
            return DigitalGaugeResult(
                value=None, raw_text="", confidence=0.0,
            )

    def _ocr_digits(self, binary: np.ndarray) -> tuple[str, float]:
        contours, _ = cv2.findContours(
            255 - binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            return "", 0.0

        digit_regions = []
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            area = cv2.contourArea(cnt)
            if area < 50 or w < 5 or h < 10:
                continue
            aspect = h / max(w, 1)
            if 0.5 < aspect < 5.0:
                digit_regions.append((x, y, w, h, cnt))

        digit_regions.sort(key=lambda r: r[0])

        if not digit_regions:
            return "", 0.0

        result_chars = []
        total_conf = 0.0
        for x, y, w, h, cnt in digit_regions:
            digit_roi = binary[y:y+h, x:x+w]
            digit, conf = self._match_digit(digit_roi)
            if digit is not None:
                result_chars.append(digit)
                total_conf += conf
            else:
                result_chars.append("?")

        avg_conf = total_conf / max(len(result_chars), 1)
        return "".join(result_chars), avg_conf

    def _match_digit(self, roi: np.ndarray) -> tuple[Optional[str], float]:
        h, w = roi.shape
        if h == 0 or w == 0:
            return None, 0.0

        white_pixels = cv2.countNonZero(roi)
        total_pixels = h * w
        fill_ratio = white_pixels / total_pixels if total_pixels > 0 else 0

        if fill_ratio < 0.05:
            return None, 0.0

        h_half = h // 2
        w_third = max(w // 3, 1)

        top = roi[:h_half, :]
        bottom = roi[h_half:, :]
        left = roi[:, :w_third]
        center = roi[:, w_third:w - w_third] if w > w_third * 2 else roi[:, w_third:]
        right = roi[:, w - w_third:]

        top_fill = cv2.countNonZero(top) / max(top.size, 1)
        bottom_fill = cv2.countNonZero(bottom) / max(bottom.size, 1)
        left_fill = cv2.countNonZero(left) / max(left.size, 1)
        center_fill = cv2.countNonZero(center) / max(center.size, 1)
        right_fill = cv2.countNonZero(right) / max(right.size, 1)

        segments = [
            top_fill > 0.4,
            center_fill > 0.4,
            bottom_fill > 0.4,
            left_fill > 0.4,
            right_fill > 0.4,
        ]

        digit = self._decode_segments(segments, fill_ratio)
        confidence = 0.6 + 0.1 * sum(
            1 for s in segments if s in (True, False)
        )
        return digit, min(confidence, 0.99)

    @staticmethod
    def _decode_segments(
        segments: list[bool], fill_ratio: float,
    ) -> Optional[str]:
        top, center, bottom, left, right = segments

        if fill_ratio > 0.7:
            return "8"

        if top and bottom and left and right and not center:
            return "0"
        if not top and not center and not bottom and right:
            return "1"
        if top and center and bottom and not left and right:
            return "3"
        if not top and center and bottom and left and right:
            return "4"
        if top and center and bottom and left and not right:
            return "6"
        if top and not center and not bottom and left and right:
            return "11"
        if top and center and bottom and not left and not right:
            return "2" if not left else "3"
        if top and center and not bottom and not left and right:
            return "7"
        if top and center and bottom and left and right:
            return "9" if not bottom else "8"
        if top and not center and bottom and left and not right:
            return "5" if not center else "6"
        if not top and center and bottom and left and not right:
            return "6"

        return None

    @staticmethod
    def _parse_value(text: str) -> Optional[float]:
        cleaned = text.replace("?", "").replace(" ", "").replace("O", "0")
        if not cleaned:
            return None
        cleaned = cleaned.replace(",", ".")
        try:
            return float(cleaned)
        except ValueError:
            try:
                import re
                match = re.search(r'[\d.]+', cleaned)
                if match:
                    return float(match.group())
            except (ValueError, AttributeError):
                pass
        return None


class PointerGaugeRecognizer:
    def recognize(
        self,
        image: np.ndarray,
        config: dict,
    ) -> PointerGaugeResult:
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            edges = cv2.Canny(blurred, 50, 150)

            h, w = image.shape[:2]
            cx = int(w * config.get("center_x_ratio", 0.5))
            cy = int(h * config.get("center_y_ratio", 0.6))
            radius = int(min(w, h) * config.get("radius_ratio", 0.35))

            mask = np.zeros(edges.shape, dtype=np.uint8)
            cv2.circle(mask, (cx, cy), radius, 255, -1)
            masked_edges = cv2.bitwise_and(edges, edges, mask=mask)

            lines = cv2.HoughLinesP(
                masked_edges, 1, np.pi / 180,
                threshold=30,
                minLineLength=radius * 0.3,
                maxLineGap=10,
            )

            if lines is None:
                return PointerGaugeResult(
                    value=None, angle=0.0, confidence=0.0,
                )

            best_line = None
            best_length = 0
            for line in lines:
                x1, y1, x2, y2 = line[0]
                d1 = math.hypot(x1 - cx, y1 - cy)
                d2 = math.hypot(x2 - cx, y2 - cy)
                length = math.hypot(x2 - x1, y2 - y1)

                is_radial = (
                    (d1 < radius * 0.3 and d2 > radius * 0.5)
                    or (d2 < radius * 0.3 and d1 > radius * 0.5)
                    or (d1 > radius * 0.4 and d2 > radius * 0.4
                        and length > radius * 0.4)
                )

                tick_aspect = abs(x2 - x1) / max(abs(y2 - y1), 1)
                is_tick = tick_aspect > 8 or tick_aspect < 0.12

                if is_radial and not is_tick and length > best_length:
                    best_length = length
                    best_line = line[0]

            if best_line is None:
                return PointerGaugeResult(
                    value=None, angle=0.0, confidence=0.0,
                )

            x1, y1, x2, y2 = best_line
            d1 = math.hypot(x1 - cx, y1 - cy)
            d2 = math.hypot(x2 - cx, y2 - cy)
            if d1 > d2:
                tip_x, tip_y = x1, y1
            else:
                tip_x, tip_y = x2, y2

            angle = math.degrees(
                math.atan2(-(tip_y - cy), tip_x - cx)
            )
            angle = (angle + 360) % 360

            min_val = config.get("min_value", 0.0)
            max_val = config.get("max_value", 100.0)
            start_angle = config.get("start_angle", 225)
            end_angle = config.get("end_angle", -45)

            sweep = (end_angle - start_angle) % 360
            pointer_offset = (angle - start_angle) % 360
            value_ratio = pointer_offset / sweep if sweep > 0 else 0.0
            value = min_val + value_ratio * (max_val - min_val)

            confidence = min(0.5 + best_length / max(radius, 1) * 0.3, 0.95)

            return PointerGaugeResult(
                value=round(value, 2), angle=round(angle, 1),
                confidence=confidence,
            )
        except Exception as e:
            logger.error(f"Pointer gauge recognition failed: {e}")
            return PointerGaugeResult(value=None, angle=0.0, confidence=0.0)


class AlarmLightDetector:
    def __init__(self, config: dict):
        self.num_lights = config.get("num_lights", 4)
        self.light_width = config.get("light_width", 60)
        self.light_height = config.get("light_height", 60)
        self.gap = config.get("gap", 10)
        self.labels = config.get("labels", [])

        self.red_lower = np.array(config.get("red_hsv_range", {}).get("lower", [0, 100, 100]))
        self.red_upper = np.array(config.get("red_hsv_range", {}).get("upper", [10, 255, 255]))
        self.red_lower2 = np.array([170, 100, 100])
        self.red_upper2 = np.array([180, 255, 255])

        self.yellow_lower = np.array(config.get("yellow_hsv_range", {}).get("lower", [20, 100, 100]))
        self.yellow_upper = np.array(config.get("yellow_hsv_range", {}).get("upper", [35, 255, 255]))

        self.green_lower = np.array(config.get("green_hsv_range", {}).get("lower", [35, 50, 50]))
        self.green_upper = np.array(config.get("green_hsv_range", {}).get("upper", [85, 255, 255]))

    def detect(self, image: np.ndarray) -> list[AlarmLightResult]:
        results = []
        h, w = image.shape[:2]
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        for i in range(self.num_lights):
            x_start = i * (self.light_width + self.gap)
            x_end = x_start + self.light_width
            y_start = (h - self.light_height) // 2
            y_end = y_start + self.light_height

            if x_end > w or y_end > h:
                label = self.labels[i] if i < len(self.labels) else f"Light_{i}"
                results.append(AlarmLightResult(
                    index=i, label=label,
                    state=AlarmLightState.OFF, confidence=0.0,
                ))
                continue

            roi = hsv[y_start:y_end, x_start:x_end]
            state, conf = self._classify_light(roi)
            label = self.labels[i] if i < len(self.labels) else f"Light_{i}"
            results.append(AlarmLightResult(
                index=i, label=label, state=state, confidence=conf,
            ))

        return results

    def _classify_light(
        self, hsv_roi: np.ndarray,
    ) -> tuple[AlarmLightState, float]:
        total_pixels = hsv_roi.shape[0] * hsv_roi.shape[1]
        if total_pixels == 0:
            return AlarmLightState.OFF, 0.0

        red_mask1 = cv2.inRange(hsv_roi, self.red_lower, self.red_upper)
        red_mask2 = cv2.inRange(hsv_roi, self.red_lower2, self.red_upper2)
        red_mask = cv2.bitwise_or(red_mask1, red_mask2)
        red_ratio = cv2.countNonZero(red_mask) / total_pixels

        yellow_mask = cv2.inRange(hsv_roi, self.yellow_lower, self.yellow_upper)
        yellow_ratio = cv2.countNonZero(yellow_mask) / total_pixels

        green_mask = cv2.inRange(hsv_roi, self.green_lower, self.green_upper)
        green_ratio = cv2.countNonZero(green_mask) / total_pixels

        threshold = 0.15

        if red_ratio >= threshold and red_ratio >= yellow_ratio and red_ratio >= green_ratio:
            return AlarmLightState.RED, min(red_ratio * 3, 0.99)
        if yellow_ratio >= threshold and yellow_ratio >= green_ratio:
            return AlarmLightState.YELLOW, min(yellow_ratio * 3, 0.99)
        if green_ratio >= threshold:
            return AlarmLightState.GREEN, min(green_ratio * 3, 0.99)

        return AlarmLightState.OFF, 0.5


class ImageAnalyzer:
    def __init__(self):
        self.digital_recognizer = DigitalGaugeRecognizer()
        self.pointer_recognizer = PointerGaugeRecognizer()
        self._alarm_detectors: dict[str, AlarmLightDetector] = {}

    def analyze(
        self,
        point_id: str,
        gauge_type: GaugeType,
        image: np.ndarray,
        config: dict,
    ) -> AnalysisResult:
        from datetime import datetime

        result = AnalysisResult(
            point_id=point_id,
            gauge_type=gauge_type,
            timestamp=datetime.now().isoformat(),
        )

        try:
            if gauge_type == GaugeType.DIGITAL:
                digital_result = self.digital_recognizer.recognize(image)
                result.digital_result = digital_result

            elif gauge_type == GaugeType.POINTER:
                pointer_config = config.get("pointer_gauge_config", {})
                pointer_result = self.pointer_recognizer.recognize(
                    image, pointer_config,
                )
                result.pointer_result = pointer_result

            elif gauge_type == GaugeType.ALARM_LIGHTS:
                alarm_config = config.get("alarm_lights_config", {})
                detector = self._alarm_detectors.get(point_id)
                if detector is None:
                    detector = AlarmLightDetector(alarm_config)
                    self._alarm_detectors[point_id] = detector
                result.alarm_results = detector.detect(image)

        except Exception as e:
            result.error = str(e)
            logger.error(f"Image analysis failed for {point_id}: {e}")

        return result

    def get_value(self, result: AnalysisResult) -> Optional[float]:
        if result.gauge_type == GaugeType.DIGITAL and result.digital_result:
            return result.digital_result.value
        if result.gauge_type == GaugeType.POINTER and result.pointer_result:
            return result.pointer_result.value
        return None

    def get_alarm_states(
        self, result: AnalysisResult,
    ) -> list[AlarmLightResult]:
        if result.gauge_type == GaugeType.ALARM_LIGHTS:
            return result.alarm_results
        return []
