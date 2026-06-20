"""
image_analyzer.py
================================================================================
损伤图像识别与特征提取模块

职责:
  1. 图像预处理: 去噪 / 增强 / 透视矫正 / 统一分辨率与色彩空间, 支持 JPG/PNG/BMP 批量
  2. 损伤部位识别: 模板匹配 + 轮廓检测, 定位受损区域, 标注边界框,
     区分前后保险杠、车门、引擎盖、翼子板等 12 个车身部位
  3. 输出损伤区域 ROI 与特征向量, 供 damage_classifier 使用

依赖: OpenCV 4.8+, Pillow 10.0+, numpy
"""

import os
from dataclasses import dataclass, field
from typing import List, Optional

import cv2
import numpy as np
import yaml
from PIL import Image

from exception_handler import ImageReadFailure, retry_on_exception
from logger import AppLogger, get_logger

log = get_logger("image_analyzer")


# ==============================================================================
# 数据结构
# ==============================================================================
@dataclass
class DamageRegion:
    """单个损伤区域。"""
    bbox: tuple                   # (x, y, w, h) 边界框, 像素坐标
    contour: np.ndarray          # 损伤轮廓点集
    body_part: str                # 所属车身部位
    roi: np.ndarray               # 损伤区域图像 (BGR)
    area_ratio: float = 0.0       # 相对部位 ROI 的面积占比
    features: dict = field(default_factory=dict)  # 纹理/几何特征, 供分类器使用


@dataclass
class AnalysisResult:
    """单张图片的分析结果。"""
    image_path: str
    preprocessed: Optional[np.ndarray] = None     # 预处理后的图像
    body_part_detected: str = "unknown"            # 整图判定的主车身部位
    damage_regions: List[DamageRegion] = field(default_factory=list)
    annotated_image: Optional[np.ndarray] = None  # 标注后的图像 (用于截图留存)
    success: bool = False
    error: str = ""


# ==============================================================================
# 图像分析器
# ==============================================================================
class ImageAnalyzer:
    def __init__(self, config_path: str = "config.yaml"):
        with open(config_path, "r", encoding="utf-8") as f:
            self.cfg = yaml.safe_load(f)
        self.pre_cfg = self.cfg.get("image_preprocess", {})
        self.parts_cfg = self.cfg.get("body_parts", {})
        sys_cfg = self.cfg.get("system", {})
        self.supported_formats = [f.lower().lstrip(".")
                                  for f in sys_cfg.get("supported_formats",
                                                       ["jpg", "png", "bmp"])]
        self.template_dir = sys_cfg.get("template_dir", "./data/templates")
        os.makedirs(self.template_dir, exist_ok=True)
        # 预加载部位模板图像 (若存在)
        self._templates = self._load_templates()
        # 部位中文映射 (用于录入理赔系统时的下拉选择)
        self.part_label_map = {
            "front_bumper": "前保险杠", "rear_bumper": "后保险杠",
            "hood": "引擎盖", "trunk": "后备箱盖", "roof": "车顶",
            "front_door_left": "左前门", "rear_door_left": "左后门",
            "front_door_right": "右前门", "rear_door_right": "右后门",
            "fender_front_left": "左前翼子板", "fender_front_right": "右前翼子板",
            "headlight": "前大灯",
        }

    # --------------------------------------------------------------------------
    # 模板加载
    # --------------------------------------------------------------------------
    def _load_templates(self) -> dict:
        """加载 config.damage_types.template_key 指定的损伤模板图。"""
        templates = {}
        dmg_cfg = self.cfg.get("damage_types", {})
        for dtype, params in dmg_cfg.items():
            if not isinstance(params, dict):
                continue
            key = params.get("template_key")
            if not key:
                continue
            tpl_path = os.path.join(self.template_dir, f"{key}.png")
            if os.path.exists(tpl_path):
                tpl = cv2.imread(tpl_path, cv2.IMREAD_GRAYSCALE)
                if tpl is not None:
                    templates[dtype] = tpl
        return templates

    # --------------------------------------------------------------------------
    # 1. 图像预处理
    # --------------------------------------------------------------------------
    @retry_on_exception(exceptions=(Exception,),
                         max_retries=2, backoff_base=2, case_no_arg="case_no")
    def preprocess(self, image_path: str, case_no: str = "-") -> np.ndarray:
        """
        图像预处理流水线:
          读取 -> 缩放统一分辨率 -> 色彩空间统一 -> 去噪 -> CLAHE增强 -> 透视矫正
        """
        if not os.path.exists(image_path):
            raise ImageReadFailure(f"图像文件不存在: {image_path}", case_no)

        ext = os.path.splitext(image_path)[1].lower().lstrip(".")
        if ext not in self.supported_formats:
            raise ImageReadFailure(
                f"不支持的图像格式: {ext} (支持 {self.supported_formats})", case_no)

        # 读取: 用 PIL 兜底, 解决 OpenCV 对部分中文路径/损坏文件失败的问题
        try:
            pil_img = Image.open(image_path)
            pil_img = pil_img.convert("RGB")
            bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception as exc:
            raise ImageReadFailure(f"图像解码失败: {image_path} | {exc}", case_no)

        if bgr is None or bgr.size == 0:
            raise ImageReadFailure(f"图像内容为空: {image_path}", case_no)

        # 统一分辨率
        target_long = int(self.pre_cfg.get("target_long_side", 1280))
        bgr = self._resize_long_side(bgr, target_long)

        # 色彩空间统一为 BGR (已为 BGR, 这里仅校验)
        color_space = self.pre_cfg.get("color_space", "BGR").upper()
        if color_space != "BGR":
            bgr = self._convert_color(bgr, "BGR", color_space)

        # 去噪
        h = int(self.pre_cfg.get("denoise_strength", 10))
        if h > 0:
            bgr = cv2.fastNlMeansDenoisingColored(bgr, None, h, h, 7, 21)

        # CLAHE 对比度增强 (在 L 通道上做)
        bgr = self._clahe_enhance(bgr)

        # 透视矫正
        if self.pre_cfg.get("perspective_correct", True):
            bgr = self._perspective_correct(bgr)

        return bgr

    @staticmethod
    def _resize_long_side(img: np.ndarray, long_side: int) -> np.ndarray:
        h, w = img.shape[:2]
        if max(h, w) <= long_side:
            return img
        scale = long_side / max(h, w)
        return cv2.resize(img, (int(w * scale), int(h * scale)),
                          interpolation=cv2.INTER_AREA)

    def _clahe_enhance(self, bgr: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clip = float(self.pre_cfg.get("clahe_clip_limit", 2.0))
        grid = tuple(self.pre_cfg.get("clahe_tile_grid", [8, 8]))
        clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=grid)
        l = clahe.apply(l)
        merged = cv2.merge((l, a, b))
        return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)

    @staticmethod
    def _convert_color(img: np.ndarray, src: str, dst: str) -> np.ndarray:
        code_map = {
            ("BGR", "RGB"): cv2.COLOR_BGR2RGB,
            ("RGB", "BGR"): cv2.COLOR_RGB2BGR,
            ("BGR", "GRAY"): cv2.COLOR_BGR2GRAY,
        }
        code = code_map.get((src, dst))
        if code is None:
            return img
        return cv2.cvtColor(img, code)

    def _perspective_correct(self, bgr: np.ndarray) -> np.ndarray:
        """
        基于边缘检测的四点透视矫正:
          1. 灰度 + 高斯模糊 + Canny
          2. 寻找最大四边形轮廓
          3. 若找到则做透视变换, 否则返回原图
        """
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        t1 = int(self.pre_cfg.get("canny_threshold1", 50))
        t2 = int(self.pre_cfg.get("canny_threshold2", 150))
        edged = cv2.Canny(gray, t1, t2)

        contours, _ = cv2.findContours(edged, cv2.RETR_LIST,
                                        cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return bgr

        # 取面积最大的轮廓并尝试多边形逼近
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
        quad = None
        for c in contours:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) == 4 and cv2.contourArea(approx) > 10000:
                quad = approx.reshape(4, 2)
                break
        if quad is None:
            return bgr

        rect = self._order_points(quad)
        (tl, tr, br, bl) = rect
        width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
        height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
        if width < 50 or height < 50:
            return bgr
        dst = np.array([[0, 0], [width - 1, 0],
                        [width - 1, height - 1], [0, height - 1]],
                       dtype="float32")
        matrix = cv2.getPerspectiveTransform(rect.astype("float32"), dst)
        return cv2.warpPerspective(bgr, matrix, (width, height))

    @staticmethod
    def _order_points(pts: np.ndarray) -> np.ndarray:
        rect = np.zeros((4, 2), dtype="float32")
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]   # 左上
        rect[2] = pts[np.argmax(s)]   # 右下
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]  # 右上
        rect[3] = pts[np.argmax(diff)]  # 左下
        return rect

    # --------------------------------------------------------------------------
    # 2. 损伤部位识别 (模板匹配 + 轮廓检测)
    # --------------------------------------------------------------------------
    def detect_body_part(self, image: np.ndarray) -> str:
        """
        基于模板匹配判定整图所属车身部位。
        若无模板则退化为基于图像宽高比与区域特征的启发式判定。
        """
        best_part = "unknown"
        best_score = float(self.parts_cfg.get("template_match_threshold", 0.65))

        if self._templates:
            for dtype, tpl in self._templates.items():
                # 缩放模板到与原图同尺度后匹配
                th, tw = tpl.shape[:2]
                ih, iw = image.shape[:2]
                if th > ih or tw > iw:
                    scale = min(ih / th, iw / tw) * 0.8
                    tpl = cv2.resize(tpl, None, fx=scale, fy=scale)
                res = cv2.matchTemplate(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY),
                                         tpl, cv2.TM_CCOEFF_NORMED)
                _, max_val, _, _ = cv2.minMaxLoc(res)
                if max_val > best_score:
                    best_score = max_val
                    best_part = dtype
            return best_part

        # 启发式: 基于宽高比粗判部位类别
        h, w = image.shape[:2]
        ratio = w / max(h, 1)
        if ratio > 2.0:
            best_part = "front_bumper"
        elif ratio > 1.3:
            best_part = "door"
        else:
            best_part = "hood"
        return best_part

    def detect_damage_regions(self, image: np.ndarray,
                              body_part: str = "unknown") -> List[DamageRegion]:
        """
        基于轮廓检测定位受损区域, 标注边界框。
        返回 DamageRegion 列表。
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)

        # 自适应阈值 + 形态学闭运算凸显损伤
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL,
                                        cv2.CHAIN_APPROX_SIMPLE)
        min_area = int(self.parts_cfg.get("min_contour_area", 200))
        h, w = image.shape[:2]
        roi_area = max(h * w, 1)

        regions: List[DamageRegion] = []
        for c in contours:
            area = cv2.contourArea(c)
            if area < min_area:
                continue
            x, y, cw, ch = cv2.boundingRect(c)
            # 过滤过大的误检 (几乎占满全图)
            if cw * ch > 0.9 * roi_area:
                continue
            roi = image[y:y + ch, x:x + cw].copy()
            features = self._extract_features(c, roi)
            regions.append(DamageRegion(
                bbox=(x, y, cw, ch),
                contour=c,
                body_part=body_part,
                roi=roi,
                area_ratio=round(area / roi_area, 4),
                features=features,
            ))

        # 按面积降序排列
        regions.sort(key=lambda r: r.area_ratio, reverse=True)
        return regions

    def _extract_features(self, contour: np.ndarray,
                          roi: np.ndarray) -> dict:
        """提取损伤区域几何 + 纹理特征, 供分类器使用。"""
        area = cv2.contourArea(contour)
        x, y, w, h = cv2.boundingRect(contour)
        peri = cv2.arcLength(contour, True)
        # 几何特征
        aspect_ratio = w / max(h, 1)
        circularity = (4 * np.pi * area) / max(peri * peri, 1)
        hull = cv2.convexHull(contour)
        hull_area = cv2.contourArea(hull)
        solidity = area / max(hull_area, 1)
        # 纹理特征: 边缘密度 / 颜色方差 / 阴影梯度
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        edge_density = float(np.count_nonzero(edges)) / max(gray.size, 1)
        color_variance = float(np.std(roi) / 255.0)
        # 阴影梯度: 用 Sobel 计算梯度均值
        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        shadow_gradient = float(np.mean(np.sqrt(sobel_x ** 2 + sobel_y ** 2)) / 255.0)
        # 边缘锐度: Laplacian 方差
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var() / 10000.0)
        # 宽度占比
        width_ratio = w / max(gray.shape[1], 1)
        # 分叉数: 轮廓顶点数 (approxPolyDP)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        branch_count = len(approx)

        return {
            "area": area,
            "aspect_ratio": aspect_ratio,
            "circularity": circularity,
            "solidity": solidity,
            "edge_density": edge_density,
            "color_variance": color_variance,
            "shadow_gradient": shadow_gradient,
            "edge_sharpness": sharpness,
            "width_ratio": width_ratio,
            "branch_count": branch_count,
            "rect_w": w,
            "rect_h": h,
        }

    # --------------------------------------------------------------------------
    # 3. 标注可视化 (用于截图留存)
    # --------------------------------------------------------------------------
    def annotate(self, image: np.ndarray,
                 regions: List[DamageRegion]) -> np.ndarray:
        annotated = image.copy()
        for idx, r in enumerate(regions):
            x, y, w, h = r.bbox
            cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 0, 255), 2)
            label = f"#{idx + 1} {r.body_part} {r.area_ratio:.2%}"
            cv2.putText(annotated, label, (x, max(y - 5, 10)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        return annotated

    # --------------------------------------------------------------------------
    # 4. 单图完整分析
    # --------------------------------------------------------------------------
    def analyze_image(self, image_path: str, case_no: str = "-") -> AnalysisResult:
        result = AnalysisResult(image_path=image_path)
        try:
            pre = self.preprocess(image_path, case_no=case_no)
            result.preprocessed = pre
            result.body_part_detected = self.detect_body_part(pre)
            regions = self.detect_damage_regions(pre, result.body_part_detected)
            result.damage_regions = regions
            result.annotated_image = self.annotate(pre, regions)
            result.success = True
            log.info("图像分析完成 | case=%s img=%s part=%s regions=%d",
                     case_no, os.path.basename(image_path),
                     result.body_part_detected, len(regions))
        except ImageReadFailure as exc:
            result.error = str(exc)
            result.success = False
            log.warning("图像分析失败(跳过该图) | case=%s img=%s err=%s",
                        case_no, os.path.basename(image_path), exc)
            raise
        except Exception as exc:
            result.error = str(exc)
            result.success = False
            log.error("图像分析未知异常 | case=%s img=%s err=%s",
                      case_no, os.path.basename(image_path), exc, exc_info=True)
        return result

    # --------------------------------------------------------------------------
    # 5. 批量分析 (案件目录下所有图片)
    # --------------------------------------------------------------------------
    def analyze_case(self, case_dir: str, case_no: str = "-") -> List[AnalysisResult]:
        """分析案件目录下所有支持格式的图片。"""
        if not os.path.isdir(case_dir):
            raise ImageReadFailure(f"案件目录不存在: {case_dir}", case_no)

        image_files = []
        for fname in sorted(os.listdir(case_dir)):
            ext = os.path.splitext(fname)[1].lower().lstrip(".")
            if ext in self.supported_formats:
                image_files.append(os.path.join(case_dir, fname))

        if not image_files:
            log.warning("案件目录无可用图片 | case=%s dir=%s", case_no, case_dir)
            return []

        results: List[AnalysisResult] = []
        for img_path in image_files:
            try:
                res = self.analyze_image(img_path, case_no=case_no)
                results.append(res)
            except ImageReadFailure:
                # 单图失败不阻断整案, 跳过该图继续
                continue
        return results

    def aggregate_damage(self, results: List[AnalysisResult]) -> List[DamageRegion]:
        """汇总所有图片的损伤区域, 供分类器统一处理。"""
        all_regions: List[DamageRegion] = []
        for r in results:
            if r.success:
                all_regions.extend(r.damage_regions)
        return all_regions

    def save_annotated(self, result: AnalysisResult, case_no: str) -> Optional[str]:
        """保存标注图到截图目录。"""
        if result.annotated_image is None:
            return None
        return AppLogger.save_screenshot(result.annotated_image, case_no,
                                           "image_analysis")
