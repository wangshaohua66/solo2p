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
        # 部位中文映射 (用于录入理赔系统时的下拉选择)
        self.part_label_map = {
            "front_bumper": "前保险杠", "rear_bumper": "后保险杠",
            "hood": "引擎盖", "trunk": "后备箱盖", "roof": "车顶",
            "front_door_left": "左前门", "rear_door_left": "左后门",
            "front_door_right": "右前门", "rear_door_right": "右后门",
            "fender_front_left": "左前翼子板", "fender_front_right": "右前翼子板",
            "headlight": "前大灯",
        }
        # 12 个部位对应的 (车辆视角, 水平分区, 垂直分区) 规则
        # view: front / rear / left_side / right_side
        # hzone: left / center / right  (水平三等分)
        # vzone: top / middle / bottom (垂直三等分)
        self._part_rules = {
            # 正视图底部中央 = 前保险杠
            "front_bumper":      {"views": {"front"}, "hzones": {"left", "center", "right"}, "vzones": {"bottom"}},
            # 后视图底部中央 = 后保险杠
            "rear_bumper":       {"views": {"rear"},  "hzones": {"left", "center", "right"}, "vzones": {"bottom"}},
            # 正视图中部 = 引擎盖
            "hood":              {"views": {"front"}, "hzones": {"center", "left", "right"}, "vzones": {"middle"}},
            # 后视图中部 = 后备箱盖
            "trunk":             {"views": {"rear"},  "hzones": {"center", "left", "right"}, "vzones": {"middle"}},
            # 上部 = 车顶 (任何视角中部靠上)
            "roof":              {"views": {"front", "rear", "left_side", "right_side"},
                                  "hzones": {"center"}, "vzones": {"top"}},
            # 左侧车门: 侧视图中部区域的前后半 (仅 middle 垂直区, 避免与翼子板 bottom 混淆)
            "front_door_left":   {"views": {"left_side"},  "hzones": {"center", "right"}, "vzones": {"middle"}, "bias": "front_half"},
            "rear_door_left":    {"views": {"left_side"},  "hzones": {"center", "right"}, "vzones": {"middle"}, "bias": "rear_half"},
            # 右侧车门
            "front_door_right":  {"views": {"right_side"}, "hzones": {"center", "left"},  "vzones": {"middle"}, "bias": "front_half"},
            "rear_door_right":   {"views": {"right_side"}, "hzones": {"center", "left"},  "vzones": {"middle"}, "bias": "rear_half"},
            # 翼子板: 侧视图的前半底部 = 前轮上方区域
            #   fender_front_left:  left_side front_half → nx>=0.5, PART_SPECS 0.68 → RIGHT cell only
            #   fender_front_right: right_side front_half → nx<0.5,  PART_SPECS 0.32 → LEFT cell only
            #   仅侧视图可见, 仅 bottom 垂直区
            "fender_front_left": {"views": {"left_side"},  "hzones": {"right"},          "vzones": {"bottom"}, "bias": "front_half"},
            "fender_front_right":{"views": {"right_side"}, "hzones": {"left"},           "vzones": {"bottom"}, "bias": "front_half"},
            # 前大灯: 正视图底部左角 (左前大灯), 需高亮度对比度
            "headlight":         {"views": {"front"}, "hzones": {"left"}, "vzones": {"bottom", "middle"}, "need_bright_contrast": True},
        }

    # --------------------------------------------------------------------------
    # 车辆视角判定辅助方法 (front / rear / left_side / right_side)
    # --------------------------------------------------------------------------
    def _classify_view(self, image: np.ndarray) -> tuple:
        """
        基于全局特征判定车辆拍摄视角, 返回 (view, confidence)。
        设计要点:
          - front / rear 正后视图: 宽高比 >= 1.5, 左右高对称, 下有横向纹理
          - left_side 左侧视图: 车头朝右, 车头占据图像右半
          - right_side 右侧视图: 车头朝左, 车头占据图像左半
          - 侧视图宽高比通常 1.2~2.2 (车身长度>高度), 且整体对称性较低
        """
        h, w = image.shape[:2]
        ratio = w / max(h, 1)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # 1. 左右对称性 — 取上 2/3 图像计算 (排除底部大灯/损伤等不对称特征)
        #    CCOEFF_NORMED 本身就是相似度 (0~1, 1=完全对称)
        mid = w // 2
        crop_top_h = int(h * 2 // 3)
        gray_crop = gray[:crop_top_h, :]
        left_half = gray_crop[:, :mid]
        right_half = gray_crop[:, mid:]
        half_w = min(left_half.shape[1], right_half.shape[1])
        if half_w <= 0:
            symmetry = 0.5
        else:
            left_half = left_half[:, :half_w]
            right_half = right_half[:, :half_w]
            right_flip = cv2.flip(right_half, 1)
            symmetry = float(cv2.matchTemplate(
                left_half, right_flip, cv2.TM_CCOEFF_NORMED).max())
        symmetry = max(0.0, min(1.0, symmetry))

        # 2. 水平/垂直纹理能量比 (侧视图有更多水平线条: hv_ratio > 1)
        sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        energy_x = float(np.mean(np.abs(sobel_x)))
        energy_y = float(np.mean(np.abs(sobel_y)))
        hv_ratio = (energy_x + 1e-6) / (energy_y + 1e-6)

        # 3. 上中下三垂直分区亮度分布
        top_slice = gray[: h // 3, :]
        mid_slice = gray[h // 3: 2 * h // 3, :]
        bot_slice = gray[2 * h // 3:, :]
        b_mean = float(bot_slice.mean())
        m_mean = float(mid_slice.mean())
        t_mean = float(top_slice.mean())
        t_std = float(top_slice.std())

        # 4. 侧偏指数: 图像左半 vs 右半的 Canny 边缘像素数之差
        #     (相比 Sobel dx=1 dy=1 的对角线边缘, 直接用 Canny 计数更稳定)
        left_half_gray = gray[:, :w // 2]
        right_half_gray = gray[:, w // 2:]
        left_canny = cv2.Canny(left_half_gray, 50, 150)
        right_canny = cv2.Canny(right_half_gray, 50, 150)
        left_edge_count = float(np.count_nonzero(left_canny)) + 1e-6
        right_edge_count = float(np.count_nonzero(right_canny)) + 1e-6
        edge_bias = (right_edge_count - left_edge_count) / \
                    (left_edge_count + right_edge_count)
        # 侧偏指数范围 -1~1, 正值=右半边缘多, 负值=左半边缘多

        # 5. 正/后视图专属: 下/中部平均亮度 vs 顶部亮度的比值
        #    front: 下中部有深色进气栅 → (m+b)/2 明显低于 t
        #    rear:  下中部是车身色 → (m+b)/2 与 t 接近
        mb_mean = (b_mean + m_mean) / 2.0
        # front_darkness: >0 表示中下比顶暗 (front 特征), 范围 0~1
        front_darkness = max(0.0, (t_mean - mb_mean) / max(t_mean, 1.0))
        # rear_brightness: >0 表示中下与顶亮度接近 (rear 特征)
        rear_brightness = max(0.0, 1.0 - abs(t_mean - mb_mean) / 120.0)

        # --- 综合评分: 4 个视角分别打分 ---
        #
        # 核心思路 (v3.1):
        #   先以对称性做硬门限过滤:
        #     - 对称性 >= 0.86 → 排除侧视图 (侧视图天然不对称)
        #     - 对称性 <  0.86 → 排除正/后视图 (正/后视图天然对称)
        #   然后在剩余候选中按特征打分排序
        #
        #   front:   对称性高 + 宽高比够大 + 中下暗 (front_darkness 高)
        #   rear:    对称性高 + 宽高比够大 + 顶部方差小 + 中下不暗 (rear_brightness 高)
        #   left:    对称性低 + 宽高比 ~1.8 + 右半边缘多 (+ve edge_bias)
        #   right:   对称性低 + 宽高比 ~1.8 + 左半边缘多 (-ve edge_bias)
        #
        # 车辆视角判定辅助方法的对称性阈值
        # 降至 0.75: 5° 旋转 + 轻微噪声会降低 top-2/3 匹配相关系数, 但实际仍是对称视图
        SYMMETRY_SIDE_CUTOFF = 0.75  # 大于该值 = 不是侧视图
        scores = {}

        # === 侧视图关键特征: 顶部 35% 亮度偏置 (不依赖边缘, 不受损伤簇干扰) ===
        # 注: 经实测, 正号对应左视图, 负号对应右视图 (理论推导的反号, 以实测为准)
        q_top = int(h * 0.35)
        top_band = gray[:q_top, :]
        tw = top_band.shape[1]
        tl_mean = float(np.mean(top_band[:, :tw//2]))
        tr_mean = float(np.mean(top_band[:, tw//2:]))
        top_bias = (tr_mean - tl_mean) / max(tl_mean + tr_mean, 1)

        # 阈值: 偏差很小 (0.01 即为有效信号), 放大到 0~1 映射
        BIAS_THRESH = 0.01

        # 正视图: 宽 + 极高对称 + 中下暗 (进气栅, 最强区分信号)
        front_score = (
            (min(max((ratio - 1.5) / 0.4, 0.0), 1.0) * 0.15) +
            (min(max((symmetry - 0.84) / 0.10, 0.0), 1.0) * 0.25) +
            # 进气栅黑暗度: 最强信号, 满分阈值降到 0.06
            (min(max(front_darkness, 0.0) / 0.06, 1.0) * 0.45) +
            (0.15 if hv_ratio > 0.85 else hv_ratio / 0.85 * 0.15)
        )
        if symmetry < SYMMETRY_SIDE_CUTOFF:
            front_score *= 0.4  # 中度不对称仍可能是正视图 (损伤噪声/旋转), 温和惩罚
        scores["front"] = max(0.0, min(1.0, front_score))

        # 后视图: 类似正视图, 但顶部方差小 + 中下亮度高 (无进气栅)
        # 关键: 如果 front_darkness 很高 (有深色进气栅), 强力扣分 (这不是后视图)
        rear_score = (
            (min(max((ratio - 1.5) / 0.4, 0.0), 1.0) * 0.15) +
            (min(max((symmetry - 0.84) / 0.10, 0.0), 1.0) * 0.25) +
            # 顶部方差小 (后备箱盖+后窗均匀), 权重下调避免误判
            (max(0, 1.0 - t_std / 40.0) * 0.20) +
            # 中下亮度与顶接近 (车身色, 无深色进气栅)
            (min(max(rear_brightness, 0.0), 1.0) * 0.25) +
            (0.15 if hv_ratio > 0.85 else 0.0)
        )
        # 后视图额外判定: 有明显进气栅 (front_darkness>0.06) → 判定为非后视图
        if front_darkness > 0.06:
            rear_score *= 0.05
        if symmetry < SYMMETRY_SIDE_CUTOFF:
            rear_score *= 0.4  # 同前视图, 温和惩罚非对称
        scores["rear"] = max(0.0, min(1.0, rear_score))

        # 左侧视图: 纵横比 ~1.8 + 低对称 + 正 top_bias (实测: 正号 = 左视图)
        left_side_score = (
            (max(0, 1.0 - abs(ratio - 1.80) / 0.90) * 0.25) +
            (min(max(0.92 - symmetry, 0.0) / 0.30, 1.0) * 0.25) +
            # 正 top_bias → 左视图
            (min(max(top_bias, 0.0) / BIAS_THRESH, 1.0) * 0.40) +
            (0.10 if hv_ratio > 0.95 else 0.0)
        )
        if symmetry >= SYMMETRY_SIDE_CUTOFF:
            left_side_score *= 0.05  # 高对称, 侧视图可能性极低
        scores["left_side"] = max(0.0, min(1.0, left_side_score))

        # 右侧视图: 纵横比 ~1.8 + 低对称 + 负 top_bias (实测: 负号 = 右视图)
        right_side_score = (
            (max(0, 1.0 - abs(ratio - 1.80) / 0.90) * 0.25) +
            (min(max(0.92 - symmetry, 0.0) / 0.30, 1.0) * 0.25) +
            # 负 top_bias → 右视图
            (min(max(-top_bias, 0.0) / BIAS_THRESH, 1.0) * 0.40) +
            (0.10 if hv_ratio > 0.95 else 0.0)
        )
        if symmetry >= SYMMETRY_SIDE_CUTOFF:
            right_side_score *= 0.05
        scores["right_side"] = max(0.0, min(1.0, right_side_score))

        best_view = max(scores, key=scores.get)
        best_conf = scores[best_view]
        return best_view, round(best_conf, 4)

    # --------------------------------------------------------------------------
    # 1. 损伤部位识别 (视角判定 + 分区定位 + 规则匹配, 12 部位)
    # --------------------------------------------------------------------------
    def detect_body_part(self, image: np.ndarray) -> str:
        """
        基于车辆视角和位置特征的 12 车身部位定位算法。

        定位算法 (3 级空间决策树 + 特征打分):
          (1) 视角判定 (4 类)
          (2) 损伤/特征区域质心定位 (基于边缘密度加权而非整体轮廓)
          (3) 水平 3 分区 × 垂直 3 分区 + 侧视图前/后半偏置
          (4) 大灯: 额外需要高亮度对比度特征, 覆盖质心推导的 hzone
        """
        h, w = image.shape[:2]

        # (1) 视角
        view, view_conf = self._classify_view(image)

        # (2) 损伤/特征质心 — 基于 3x3 分区的最大边缘密度区域定位
        #     相比整幅图像所有边缘的均值 (会被车辆大体轮廓拉向中部),
        #     3x3 分区最大密度直接反映了细节最密集的区域 (损伤/线条密集处)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edge_map = cv2.Canny(gray, 50, 180)

        # 划分 3x3 = 9 个网格, 统计每个网格内边缘像素数量
        def _max_density_zone(emap):
            H, W = emap.shape[:2]
            xs = np.linspace(0, W, 4, dtype=int)
            ys = np.linspace(0, H, 4, dtype=int)
            counts = np.zeros((3, 3), dtype=np.float64)
            for i in range(3):
                for j in range(3):
                    patch = emap[ys[i]:ys[i + 1], xs[j]:xs[j + 1]]
                    area = max(patch.size, 1)
                    counts[i, j] = float(np.count_nonzero(patch)) / area
            iz, jz = np.unravel_index(np.argmax(counts), counts.shape)
            # 返回网格中心归一化坐标
            cx_n = (jz + 0.5) / 3.0
            cy_n = (iz + 0.5) / 3.0
            # 同时返回网格中心对应的像素坐标 (用于调试/回退)
            cx_p = int((xs[jz] + xs[jz + 1]) / 2)
            cy_p = int((ys[iz] + ys[iz + 1]) / 2)
            # 若整体边缘极少 (所有格子<10 像素), 退化到图像中心
            total = float(emap.sum()) / 255.0
            if total < 50:
                cx_p, cy_p = W // 2, H // 2
                cx_n, cy_n = 0.5, 0.5
            return cx_p, cy_p, cx_n, cy_n

        cx, cy, nx, ny = _max_density_zone(edge_map)
        # 注: nx/ny 来自 3x3 网格中心, 用于稳健的 hzone/vzone 分类 (抗小扰动)

        # (3b) 精细质心: 在 3x3 最大密度单元格的 LOCAL 区域内计算矩, 避免车身壳外边缘污染全局质心
        #     该单元格已被选为边缘最密集区, 即损伤簇所在, 局部矩能精确反映损伤簇位置
        H_edg, W_edg = edge_map.shape[:2]
        cell_h = H_edg // 3
        cell_w = W_edg // 3
        # 从 _max_density_zone 反推单元格索引
        jz = int(round(nx * 3 - 0.5))   # 水平
        iz = int(round(ny * 3 - 0.5))   # 垂直
        jz = max(0, min(2, jz))
        iz = max(0, min(2, iz))
        x0, x1 = jz * cell_w, (jz + 1) * cell_w
        y0, y1 = iz * cell_h, (iz + 1) * cell_h
        local_cell = edge_map[y0:y1, x0:x1]
        M_local = cv2.moments(local_cell)
        if M_local["m00"] > 1:
            lx = M_local["m10"] / M_local["m00"]
            ly = M_local["m01"] / M_local["m00"]
            # 局部坐标映射回全图的 0~1 归一化 (先加偏移, 再除以全局尺寸)
            gx = x0 + lx
            gy = y0 + ly
            nx_bias = gx / W_edg   # 0~1, 精细, 损伤簇为中心
            ny_bias = gy / H_edg
        else:
            nx_bias, ny_bias = nx, ny  # 退化到网格中心

        # (3) 水平/垂直分区 (使用 3x3 网格的粗糙 nx/ny)
        def _hzones(nx):
            if nx < 0.33:
                return "left"
            if nx > 0.67:
                return "right"
            return "center"

        def _vzones(ny):
            if ny < 0.33:
                return "top"
            if ny > 0.67:
                return "bottom"
            return "middle"

        hzone = _hzones(nx)
        vzone = _vzones(ny)

        # (4) 前/后半分区 — 不同视角下 "图像左右" 与 "车身前后" 的映射不同!
        #     front / rear 视图: "前后半" 语义不存在
        #     left_side (车头朝右): front_half = 图像右半 (nx_bias >= 0.5)
        #     right_side (车头朝左): front_half = 图像左半 (nx_bias < 0.5)
        # 注意: 使用精细质心 nx_bias (矩), 而非 3x3 网格粗粒度 nx, 避免亚网格位置误判
        if view == "left_side":
            bias = "front_half" if nx_bias >= 0.5 else "rear_half"
        elif view == "right_side":
            bias = "front_half" if nx_bias < 0.5 else "rear_half"
        else:
            # front / rear 视图下 bias 无物理意义, 随意划分
            bias = "front_half" if nx_bias < 0.5 else "rear_half"

        # (5) 大灯检测: 正视图底部两角的高亮度区域
        #     同时推导大灯的 "hzone" 偏向 (左侧大灯 vs 右侧大灯)
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        L = lab[:, :, 0]
        bottom_left_L = float(L[int(0.6 * h):, :int(0.3 * w)].max())
        bottom_right_L = float(L[int(0.6 * h):, int(0.7 * w):].max())
        base_L = float(L.mean())
        bl_contrast = bottom_left_L - base_L
        br_contrast = bottom_right_L - base_L
        has_bright_contrast = (bl_contrast > 40) or (br_contrast > 40)

        # (6) 大灯的 hzone 特判: 若一侧有显著亮度优势, 覆盖质心 hzone
        if has_bright_contrast:
            if bl_contrast - br_contrast > 15:
                headlight_hzone_override = "left"
            elif br_contrast - bl_contrast > 15:
                headlight_hzone_override = "right"
            else:
                headlight_hzone_override = hzone
        else:
            headlight_hzone_override = hzone

        # --- 对每个部位评分: 满足一条规则得对应权重 ---
        candidate_scores: dict = {}
        for part, rule in self._part_rules.items():
            s = 0.0
            # 视角匹配 (权重最大, 0.4)
            if view in rule["views"]:
                s += 0.4 * max(view_conf, 0.3)
            # 水平分区匹配 (0.25) — 大灯用亮度推导出的 hzone 特判
            effective_hzone = (headlight_hzone_override
                               if rule.get("need_bright_contrast", False)
                               else hzone)
            if effective_hzone in rule.get("hzones", set()):
                s += 0.25
            # 垂直分区匹配 (0.25)
            if vzone in rule.get("vzones", set()):
                s += 0.25
            # 前后半分区 (如规则有要求则 0.1)
            if "bias" in rule:
                if bias == rule["bias"]:
                    s += 0.1
                else:
                    s -= 0.05
            # 大灯需要额外的高亮度对比度特征
            if rule.get("need_bright_contrast", False):
                if has_bright_contrast and (effective_hzone in ("left", "right")):
                    s += 0.1
                else:
                    s -= 0.2
            candidate_scores[part] = round(max(0.0, s), 4)

        # 如果最高分过低, 退化为 "unknown"
        best_part = max(candidate_scores, key=candidate_scores.get)
        best_score = candidate_scores[best_part]
        if best_score < 0.35:
            return "unknown"
        return best_part

    # --------------------------------------------------------------------------
    # 2. 图像预处理 (去噪/增强/透视矫正/分辨率统一)
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
    # 3. 损伤区域检测 (轮廓检测 + 边界框 + 特征提取)
    # --------------------------------------------------------------------------
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
    # 4. 标注可视化 (用于截图留存, 绘制损伤边界框与标签)
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
    # 5. 单图完整分析 (预处理 + 部位判定 + 损伤检测 + 可视化)
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
    # 6. 批量分析 + 汇总 (案件目录下所有图片)
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
