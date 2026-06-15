import os
import time
import logging
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field

import cv2
import numpy as np

from .screen_capture import ScreenCapture

logger = logging.getLogger(__name__)


@dataclass
class MatchResult:
    x: int
    y: int
    width: int
    height: int
    confidence: float
    grid_row: int = -1
    grid_col: int = -1
    status: str = "unknown"
    status_label: str = "未知"

    @property
    def center(self) -> Tuple[int, int]:
        return self.x + self.width // 2, self.y + self.height // 2


@dataclass
class YardGrid:
    rows: int = 0
    cols: int = 0
    cell_width: int = 80
    cell_height: int = 60
    origin_x: int = 0
    origin_y: int = 0
    containers: List[MatchResult] = field(default_factory=list)


class TemplateMatcher:
    def __init__(self, config: Dict[str, Any], screen_capture: ScreenCapture):
        self.config = config
        self.screen_capture = screen_capture
        self.templates: Dict[str, np.ndarray] = {}
        self._loaded_templates: bool = False
        self._match_method = cv2.TM_CCOEFF_NORMED
        self._timeout_ms = config.get("performance", {}).get("template_match_timeout_ms", 200)

    def load_templates(self) -> bool:
        templates_cfg = self.config.get("templates", {})
        success_count = 0

        for name, rel_path in templates_cfg.items():
            if not os.path.exists(rel_path):
                logger.debug(f"模板文件不存在，跳过: {rel_path}")
                continue
            try:
                img = cv2.imread(rel_path, cv2.IMREAD_COLOR)
                if img is not None:
                    self.templates[name] = img
                    success_count += 1
                    logger.debug(f"已加载模板 [{name}]: {rel_path} ({img.shape[1]}x{img.shape[0]})")
                else:
                    logger.warning(f"模板读取失败: {rel_path}")
            except Exception as e:
                logger.error(f"加载模板异常 [{name}]: {e}")

        self._loaded_templates = success_count > 0
        logger.info(f"模板加载完成，成功 {success_count}/{len(templates_cfg)} 个")
        return self._loaded_templates

    def match_template(self, frame: np.ndarray, template_name: str,
                       threshold: float = 0.75,
                       max_results: int = 0) -> List[MatchResult]:
        if template_name not in self.templates:
            return []

        template = self.templates[template_name]
        th, tw = template.shape[:2]
        fh, fw = frame.shape[:2]
        if fh < th or fw < tw:
            return []

        try:
            tpl_gray = ScreenCapture.preprocess_template(template)
            frm_gray = ScreenCapture.preprocess_template(frame)

            start = time.time()
            result = cv2.matchTemplate(frm_gray, tpl_gray, self._match_method)
            elapsed_ms = (time.time() - start) * 1000

            if elapsed_ms > self._timeout_ms:
                logger.warning(f"模板匹配耗时 {elapsed_ms:.1f}ms 超过阈值 {self._timeout_ms}ms")

            locations = np.where(result >= threshold)
            matches: List[MatchResult] = []

            if max_results == 1:
                if len(locations[0]) > 0:
                    idx = np.argmax(result[locations])
                    pt_y, pt_x = locations[0][idx], locations[1][idx]
                    conf = float(result[pt_y, pt_x])
                    matches.append(MatchResult(
                        x=int(pt_x), y=int(pt_y), width=tw, height=th, confidence=conf
                    ))
            else:
                raw_matches = []
                for pt in zip(*locations[::-1]):
                    conf = float(result[pt[1], pt[0]])
                    raw_matches.append((int(pt[0]), int(pt[1]), conf))

                raw_matches.sort(key=lambda m: m[2], reverse=True)
                matches = self._non_max_suppression(raw_matches, tw, th, overlap_thresh=0.3)

                if max_results > 0 and len(matches) > max_results:
                    matches = matches[:max_results]

            return matches

        except Exception as e:
            logger.error(f"模板匹配失败 [{template_name}]: {e}")
            return []

    def _non_max_suppression(self, raw_matches: List[Tuple[int, int, float]],
                             tw: int, th: int,
                             overlap_thresh: float = 0.3) -> List[MatchResult]:
        if not raw_matches:
            return []

        boxes = []
        for x, y, c in raw_matches:
            boxes.append([x, y, x + tw, y + th, c])
        boxes = np.array(boxes, dtype=np.float32)

        if len(boxes) == 0:
            return []

        x1, y1, x2, y2, scores = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3], boxes[:, 4]
        order = scores.argsort()[::-1]

        areas = (x2 - x1 + 1) * (y2 - y1 + 1)
        keep: List[int] = []

        while order.size > 0:
            i = order[0]
            keep.append(int(i))

            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])

            w = np.maximum(0.0, xx2 - xx1 + 1)
            h = np.maximum(0.0, yy2 - yy1 + 1)
            inter = w * h

            iou = inter / (areas[i] + areas[order[1:]] - inter)
            inds = np.where(iou <= overlap_thresh)[0]
            order = order[inds + 1]

        results = []
        for idx in keep:
            bx, by, c = int(raw_matches[idx][0]), int(raw_matches[idx][1]), raw_matches[idx][2]
            results.append(MatchResult(x=bx, y=by, width=tw, height=th, confidence=float(c)))

        return results

    def classify_container_status(self, frame: np.ndarray,
                                  container: MatchResult) -> Tuple[str, str]:
        status_config = self.config.get("systems", {}).get("yard", {}).get("status_colors", {})
        if not status_config:
            return "unknown", "未知"

        x, y, w, h = container.x, container.y, container.width, container.height
        margin_x = int(w * 0.2)
        margin_y = int(h * 0.2)
        roi_x = x + margin_x
        roi_y = y + margin_y
        roi_w = w - 2 * margin_x
        roi_h = h - 2 * margin_y

        roi = ScreenCapture.crop_region(frame, roi_x, roi_y, roi_w, roi_h)
        if roi is None or roi.size == 0:
            return "unknown", "未知"

        try:
            hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

            best_status = "unknown"
            best_label = "未知"
            best_pixel_ratio = 0.0

            for status_key, status_val in status_config.items():
                lower = np.array(status_val["hsv_lower"], dtype=np.uint8)
                upper = np.array(status_val["hsv_upper"], dtype=np.uint8)

                if status_key == "frozen":
                    lower = np.array([0, 0, 150], dtype=np.uint8)
                    upper = np.array([180, 50, 220], dtype=np.uint8)

                mask = cv2.inRange(hsv, lower, upper)
                pixel_count = cv2.countNonZero(mask)
                total_pixels = hsv.shape[0] * hsv.shape[1]
                ratio = pixel_count / max(total_pixels, 1)

                if ratio > best_pixel_ratio and ratio > 0.15:
                    best_pixel_ratio = ratio
                    best_status = status_key
                    best_label = status_val.get("label", status_key)

            if best_pixel_ratio > 0:
                logger.debug(f"箱态分类: {best_label} (置信度 {best_pixel_ratio:.2%})")
            return best_status, best_label

        except Exception as e:
            logger.error(f"箱态分类失败: {e}")
            return "unknown", "未知"

    def analyze_yard_grid_fallback(self, frame: Optional[np.ndarray] = None) -> YardGrid:
        yard_cfg = self.config.get("systems", {}).get("yard", {})
        grid_region = yard_cfg.get("grid_region", {})
        cell_size = yard_cfg.get("cell_size", {"width": 80, "height": 60})
        status_config = yard_cfg.get("status_colors", {})

        if frame is None:
            frame = self.screen_capture.capture_region(grid_region, system_name="yard")

        if frame is None:
            logger.error("[降级模式] 获取堆场画面失败")
            return YardGrid()

        fh, fw = frame.shape[:2]
        cell_w, cell_h = cell_size.get("width", 80), cell_size.get("height", 60)
        cols = max(1, fw // cell_w)
        rows = max(1, fh // cell_h)

        yard_grid = YardGrid(
            rows=rows, cols=cols,
            cell_width=cell_w, cell_height=cell_h,
            origin_x=grid_region.get("x", 0),
            origin_y=grid_region.get("y", 0)
        )

        try:
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        except Exception as e:
            logger.error(f"[降级模式] HSV转换失败: {e}")
            return yard_grid

        margin_x = int(cell_w * 0.15)
        margin_y = int(cell_h * 0.15)
        detection_threshold = 0.25
        color_threshold = 0.08

        found_count = 0
        for row in range(rows):
            for col in range(cols):
                x = col * cell_w + margin_x
                y = row * cell_h + margin_y
                w = cell_w - 2 * margin_x
                h = cell_h - 2 * margin_y

                roi = ScreenCapture.crop_region(hsv, x, y, w, h)
                if roi is None or roi.size == 0:
                    continue

                try:
                    saturation = roi[:, :, 1]
                    non_gray_pixels = cv2.countNonZero(cv2.inRange(saturation, 30, 255))
                    total_pixels = roi.shape[0] * roi.shape[1]
                    fill_ratio = non_gray_pixels / max(total_pixels, 1)

                    if fill_ratio < detection_threshold:
                        continue

                    best_status = "unknown"
                    best_label = "未知"
                    best_ratio = 0.0

                    for status_key, status_val in status_config.items():
                        lower = np.array(status_val["hsv_lower"], dtype=np.uint8)
                        upper = np.array(status_val["hsv_upper"], dtype=np.uint8)

                        if status_key == "frozen":
                            lower = np.array([0, 0, 150], dtype=np.uint8)
                            upper = np.array([180, 50, 220], dtype=np.uint8)

                        mask = cv2.inRange(roi, lower, upper)
                        count = cv2.countNonZero(mask)
                        ratio = count / max(total_pixels, 1)

                        if ratio > best_ratio and ratio > color_threshold:
                            best_ratio = ratio
                            best_status = status_key
                            best_label = status_val.get("label", status_key)

                    if best_ratio > color_threshold or fill_ratio > 0.5:
                        cnt = MatchResult(
                            x=col * cell_w,
                            y=row * cell_h,
                            width=cell_w,
                            height=cell_h,
                            confidence=round(min(fill_ratio, best_ratio + 0.2), 3),
                            grid_row=row,
                            grid_col=col,
                            status=best_status,
                            status_label=best_label
                        )
                        yard_grid.containers.append(cnt)
                        found_count += 1

                except Exception as e:
                    logger.debug(f"[降级模式] 单元格({row},{col})处理失败: {e}")
                    continue

        yard_grid.containers.sort(key=lambda c: (c.grid_row, c.grid_col))
        logger.info(
            f"[降级模式] 堆场网格分析完成: {rows}行x{cols}列, "
            f"检测到 {len(yard_grid.containers)} 个集装箱 (填充阈值={detection_threshold})"
        )
        return yard_grid

    def analyze_yard_grid(self, frame: Optional[np.ndarray] = None) -> YardGrid:
        yard_cfg = self.config.get("systems", {}).get("yard", {})
        grid_region = yard_cfg.get("grid_region", {})
        cell_size = yard_cfg.get("cell_size", {"width": 80, "height": 60})

        if frame is None:
            frame = self.screen_capture.capture_region(grid_region, system_name="yard")

        if frame is None:
            logger.error("获取堆场画面失败")
            return YardGrid()

        fh, fw = frame.shape[:2]
        cell_w, cell_h = cell_size.get("width", 80), cell_size.get("height", 60)
        cols = max(1, fw // cell_w)
        rows = max(1, fh // cell_h)

        yard_grid = YardGrid(
            rows=rows, cols=cols,
            cell_width=cell_w, cell_height=cell_h,
            origin_x=grid_region.get("x", 0),
            origin_y=grid_region.get("y", 0)
        )

        use_template = self._loaded_templates and "container_icon" in self.templates
        tpl_matches = []

        if use_template:
            tpl_matches = self.match_template(frame, "container_icon", threshold=0.6, max_results=0)

        if use_template and len(tpl_matches) > 0:
            source = "模板匹配"
            containers = tpl_matches
        else:
            if not use_template:
                logger.warning("container_icon 模板缺失，启用网格坐标降级识别方案")
            else:
                logger.warning("模板匹配未检出集装箱，启用网格坐标降级识别方案")
            fallback_grid = self.analyze_yard_grid_fallback(frame)
            source = "网格降级"
            containers = fallback_grid.containers
            yard_grid.rows = fallback_grid.rows
            yard_grid.cols = fallback_grid.cols

        for cnt in containers:
            col = cnt.center[0] // cell_w
            row = cnt.center[1] // cell_h
            cnt.grid_row = int(row)
            cnt.grid_col = int(col)

            if source == "模板匹配":
                status_key, status_label = self.classify_container_status(frame, cnt)
                cnt.status = status_key
                cnt.status_label = status_label

            yard_grid.containers.append(cnt)

        yard_grid.containers.sort(key=lambda c: (c.grid_row, c.grid_col))
        logger.info(
            f"堆场网格分析完成 [{source}]: {rows}行x{cols}列, "
            f"检测到 {len(yard_grid.containers)} 个集装箱"
        )

        return yard_grid

    def detect_popups(self, frame: Optional[np.ndarray] = None) -> List[Dict[str, Any]]:
        if frame is None:
            frame = self.screen_capture.capture_full_screen()
        if frame is None:
            return []

        popup_types = ["popup_error", "popup_confirm", "popup_cancel", "popup_ok"]
        found_popups = []

        for popup_type in popup_types:
            matches = self.match_template(frame, popup_type, threshold=0.8, max_results=1)
            if matches:
                m = matches[0]
                found_popups.append({
                    "type": popup_type,
                    "x": m.x, "y": m.y,
                    "width": m.width, "height": m.height,
                    "center": m.center,
                    "confidence": m.confidence
                })
                logger.info(f"检测到弹窗: {popup_type} @ ({m.x},{m.y}) 置信度={m.confidence:.3f}")

        return found_popups

    def detect_success_marker(self, system_name: str, frame: Optional[np.ndarray] = None) -> bool:
        template_key = f"{system_name}_success"
        if template_key not in self.templates:
            return True

        if frame is None:
            sys_cfg = self.config.get("systems", {}).get(system_name, {})
            result_region = sys_cfg.get("input_fields", {}).get("result_region", {})
            if result_region:
                frame = self.screen_capture.capture_region(result_region, system_name=system_name)

        if frame is None:
            return False

        matches = self.match_template(frame, template_key, threshold=0.75, max_results=1)
        return len(matches) > 0

    def get_container_crop_region(self, container: MatchResult, system_name: str = "yard") -> Dict[str, int]:
        yard_cfg = self.config.get("systems", {}).get(system_name, {})
        num_region = yard_cfg.get("container_number_region", {
            "offset_x": 5, "offset_y": 5, "width": 70, "height": 20
        })

        abs_x, abs_y = self.screen_capture.get_absolute_click_point(
            system_name, container.x, container.y
        )

        return {
            "x": abs_x + num_region.get("offset_x", 5),
            "y": abs_y + num_region.get("offset_y", 5),
            "width": num_region.get("width", 70),
            "height": num_region.get("height", 20),
        }
