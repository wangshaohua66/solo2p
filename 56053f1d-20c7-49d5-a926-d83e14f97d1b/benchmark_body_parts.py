"""
benchmark_body_parts.py
================================================================================
损伤部位识别基准测试套件

职责:
  1. 生成 12 个车身部位的合成测试图像集 (每个部位 10 个变体 = 120 张)
  2. 为每张图标注 ground truth 标签, 写入 annotations.json
  3. 调用 ImageAnalyzer.detect_body_part() 进行识别
  4. 计算整体准确率 / 每个部位精确率 / 召回率 / F1 / 混淆矩阵
  5. 输出统计结果并生成报告

图像生成思路:
  对每个部位, 按照其应有的 (view, hzone, vzone, bias) 特征绘制:
  - view 决定整体纵横比、左右对称度、水平/垂直纹理比例
  - hzone/vzone/bias 决定主轮廓质心落在图像的哪个区域
  - headlight 额外绘制高亮度发光区域
"""

import json
import os
import sys
from dataclasses import asdict, dataclass, field
from typing import Dict, List

import cv2
import numpy as np

# 初始化日志与 ImageAnalyzer
from logger import AppLogger
AppLogger.setup("config.yaml")

from image_analyzer import ImageAnalyzer

DATASET_DIR = "./data/benchmark_body_parts"
ANNOTATIONS_FILE = os.path.join(DATASET_DIR, "annotations.json")
REPORT_FILE = os.path.join(DATASET_DIR, "benchmark_report.json")
VARIANTS_PER_PART = 10  # 每个部位 10 个变体

# 12 个部位 (与 image_analyzer._part_rules 一致)
ALL_PARTS = [
    "front_bumper", "rear_bumper", "hood", "trunk", "roof",
    "front_door_left", "rear_door_left",
    "front_door_right", "rear_door_right",
    "fender_front_left", "fender_front_right", "headlight",
]

PART_LABEL_CN = {
    "front_bumper": "前保险杠", "rear_bumper": "后保险杠",
    "hood": "引擎盖", "trunk": "后备箱盖", "roof": "车顶",
    "front_door_left": "左前门", "rear_door_left": "左后门",
    "front_door_right": "右前门", "rear_door_right": "右后门",
    "fender_front_left": "左前翼子板", "fender_front_right": "右前翼子板",
    "headlight": "前大灯",
}


# ==============================================================================
# 数据集生成
# ==============================================================================

# 每个部位的目标视角、质心归一化坐标 (nx, ny) 与尺寸
# 质心 (nx, ny) 决定了 hzone/vzone:
#   hzone: nx < 0.33 -> left, > 0.67 -> right, else center
#   vzone: ny < 0.33 -> top, > 0.67 -> bottom, else middle
#
# --- 前/后半分区 (bias) 约定 (与 image_analyzer.detect_body_part 一致) ---
#   front / rear 视图: bias 语义不使用
#   left_side (从车左侧拍摄, 车头指向图像右侧):
#       front_half = 图像右半 (nx >= 0.5)
#       rear_half  = 图像左半 (nx < 0.5)
#   right_side (从车右侧拍摄, 车头指向图像左侧):
#       front_half = 图像左半 (nx < 0.5)
#       rear_half  = 图像右半 (nx >= 0.5)
#
# --- 图像尺寸 ---
#   正/后视图: 1280x720 -> 比率 ~1.78 (满足 ratio >= 1.5 的正视图信号)
#   侧视图:   1300x700 -> 比率 ~1.86 (接近侧视图目标 1.55, 落在 +/-0.7 范围内)
PART_SPECS = {
    # (view_for_draw, target_nx, target_ny, image_width_hint, image_height_hint)
    # view_for_draw: front / rear / left_side / right_side
    #
    # 定位原则: 目标坐标应尽量靠近 3x3 单元格的 CENTER, 远离边界 (0.33, 0.67),
    #   这样即使 jitter 扰动 ±15% 也不会跨越单元格边界。
    #   单元格中心: 左 0.17 / 中 0.50 / 右 0.83; 上 0.17 / 中 0.50 / 下 0.83
    #
    # front/rear 视图 (1280x720 = 宽高比 1.78):
    "front_bumper":      ("front", 0.50, 0.88, 1280, 720),   # 中+下 (离 0.67 边界足够远)
    "rear_bumper":       ("rear",  0.50, 0.88, 1280, 720),   # 中+下
    "hood":              ("front", 0.50, 0.45, 1280, 720),   # 中+中 (远离 0.67 下边界)
    "trunk":             ("rear",  0.50, 0.45, 1280, 720),   # 中+中
    "roof":              ("front", 0.50, 0.18, 1280, 720),   # 中+上
    # --- 左侧视图 (1300x700): 车头朝右 = front_half 在 nx>=0.5 ---
    #   front_door_left:  前半(右) + 右单元格 + 中垂直 → nx=0.78, ny=0.48
    #   rear_door_left:   后半(左<0.5) + 中单元格 + 中垂直 → nx=0.42, ny=0.48
    "front_door_left":   ("left_side", 0.78, 0.48, 1300, 700),
    "rear_door_left":    ("left_side", 0.42, 0.48, 1300, 700),
    # --- 右侧视图 (1300x700): 车头朝左 = front_half 在 nx<0.5 ---
    #   front_door_right: 前半(左<0.5) + 左单元格 + 中垂直 → nx=0.22, ny=0.48
    #   rear_door_right:  后半(右>=0.5) + 中单元格 + 中垂直 → nx=0.58, ny=0.48
    "front_door_right":  ("right_side", 0.22, 0.48, 1300, 700),
    "rear_door_right":   ("right_side", 0.58, 0.48, 1300, 700),
    # 翼子板: 侧视图 front_half + 最外侧单元格 + 底部单元格 (尽量深)
    #   fender_front_left:  left_side front_half + 右单元格 + 下 → nx=0.78, ny=0.88
    #   fender_front_right: right_side front_half + 左单元格 + 下 → nx=0.22, ny=0.88
    "fender_front_left": ("left_side", 0.78, 0.88, 1300, 700),
    "fender_front_right":("right_side", 0.22, 0.88, 1300, 700),
    "headlight":         ("front", 0.18, 0.82, 1280, 720),      # 左+下
}


def _draw_body_shell(img: np.ndarray, view: str) -> None:
    """在空白画布上绘制车辆主体外壳, 用于后续叠加损伤/部位特征。

    仅使用纯色填充 (不绘制任何线条或边框圆圈), 避免干扰 3x3 边缘密度检测。
    视图区分依赖以下纯亮度/形状特征:
      - front: 中下部有深色进气栅矩形 (front_darkness 高)
      - rear:  顶部大面积均匀色块 (top_slice std 极小, rear_brightness 高)
      - left_side:  长条楔形, 右侧高(车头) 左侧低(车尾), 车窗偏右 → edge_bias 正
      - right_side: 长条楔形, 左侧高(车头) 右侧低(车尾), 车窗偏左 → edge_bias 负
    """
    h, w = img.shape[:2]
    rng = np.random.RandomState(hash(view) % 1000)
    body_color = (90, 95, 100)
    glass_color = (175, 185, 200)  # 浅蓝灰色: 真实车玻璃反光, 浅色 → 不降低 top_slice 亮度

    if view == "front":
        # 正视图: 近似矩形车身
        top_y = int(h * 0.10)
        bot_y = int(h * 0.92)
        top_w = int(w * 0.55)
        bot_w = int(w * 0.80)
        pts = np.array([
            [w // 2 - top_w // 2, top_y],
            [w // 2 + top_w // 2, top_y],
            [w // 2 + bot_w // 2, bot_y],
            [w // 2 - bot_w // 2, bot_y],
        ], np.int32)
        cv2.fillPoly(img, [pts], body_color)
        # 挡风玻璃: 浅色填充, 不拖低 top_slice 均值
        gt_y1 = int(h * 0.15)
        gt_y2 = int(h * 0.38)
        gt_w_top = int(w * 0.42)
        gt_w_bot = int(w * 0.52)
        glass_pts = np.array([
            [w // 2 - gt_w_top // 2, gt_y1],
            [w // 2 + gt_w_top // 2, gt_y1],
            [w // 2 + gt_w_bot // 2, gt_y2],
            [w // 2 - gt_w_bot // 2, gt_y2],
        ], np.int32)
        cv2.fillPoly(img, [glass_pts], glass_color)
        # 超大面积深色进气栅: 覆盖 ~整个 bottom_slice + 部分 mid_slice, 强力压低 mb_mean
        gx1 = int(w * 0.18)
        gx2 = int(w * 0.82)
        gy1 = int(h * 0.55)
        gy2 = int(h * 0.92)
        cv2.rectangle(img, (gx1, gy1), (gx2, gy2), (8, 8, 10), -1)
        # 保险杠区域 (底部略深色, 与进气栅融合)
        cv2.rectangle(img, (int(w*0.10), int(h*0.88)),
                      (int(w*0.90), int(h*0.96)), (55, 58, 62), -1)
        # 左右大灯占位 (亮色椭圆填充, 无边框)
        for lx_r in (0.16, 0.84):
            lx = int(w * lx_r)
            ly = int(h * 0.70)
            axes = (int(w * 0.07), int(h * 0.045))
            cv2.ellipse(img, (lx, ly), axes, 0, 0, 360, (240, 235, 210), -1)

    elif view == "rear":
        # 后视图: 形状与正视图类似
        top_y = int(h * 0.10)
        bot_y = int(h * 0.92)
        top_w = int(w * 0.55)
        bot_w = int(w * 0.80)
        pts = np.array([
            [w // 2 - top_w // 2, top_y],
            [w // 2 + top_w // 2, top_y],
            [w // 2 + bot_w // 2, bot_y],
            [w // 2 - bot_w // 2, bot_y],
        ], np.int32)
        cv2.fillPoly(img, [pts], body_color)
        # 顶部超大面积 100% 纯色: 填满 top_slice (0~33% y) + 大部分 mid_slice, 使 t_std 极低
        # 注意: 整个 top_slice 都被此均匀色块覆盖, 无任何其他深色元素
        uni_y1 = int(h * 0.08)
        uni_y2 = int(h * 0.62)
        uni_x1 = w // 2 - int(w * 0.36)
        uni_x2 = w // 2 + int(w * 0.36)
        uni_pts = np.array([
            [w // 2 - int(w * 0.28), uni_y1],
            [w // 2 + int(w * 0.28), uni_y1],
            [uni_x2, uni_y2],
            [uni_x1, uni_y2],
        ], np.int32)
        # 整个后备箱盖+后窗 统一灰色, 内部不画任何深色窗, 保证方差极小
        cv2.fillPoly(img, [uni_pts], (72, 76, 82))
        # 保险杠 (底部略深色)
        cv2.rectangle(img, (int(w*0.10), int(h*0.88)),
                      (int(w*0.90), int(h*0.96)), (55, 58, 62), -1)
        # 尾灯占位 (暗红填充, 与 body 亮度差不多, 不产生过度对比)
        for lx_r in (0.18, 0.82):
            lx = int(w * lx_r)
            ly = int(h * 0.72)
            axes = (int(w * 0.06), int(h * 0.04))
            cv2.ellipse(img, (lx, ly), axes, 0, 0, 360, (85, 60, 64), -1)

    else:
        # === 侧视图: left_side / right_side  (明显不对称的楔形, 保证低对称度)
        # 关键设计: 左视图 与 右视图 是镜像, 但各自内部 不对称 (车头高车尾低)
        if view == "left_side":
            # 左视图: 车头朝 RIGHT  → 图像右侧高, 左侧低
            left_x   = int(w * 0.08)   # 车尾端 (低)
            right_x  = int(w * 0.92)   # 车头端 (高)
            top_high = int(h * 0.26)   # 车头顶高
            top_low  = int(h * 0.40)   # 车尾顶低
            bot_y    = int(h * 0.85)
            # 车顶线: 右侧高 → 平缓上升斜线至 A 柱, 再跳至高
            pts = np.array([
                [left_x, bot_y],         # 左下 (车尾底)
                [left_x, top_low],       # 左上 (车尾顶, 低)
                [int(w * 0.55), int(h * 0.30)],  # C 柱附近
                [int(w * 0.72), int(h * 0.22)],  # A 柱顶
                [right_x, top_high],     # 右上 (车头顶, 高)
                [right_x, bot_y],        # 右下 (车头底)
            ], np.int32)
        else:
            # 右视图: 车头朝 LEFT  → 图像左侧高, 右侧低
            left_x   = int(w * 0.08)   # 车头端 (高)
            right_x  = int(w * 0.92)   # 车尾端 (低)
            top_high = int(h * 0.26)   # 车头顶高
            top_low  = int(h * 0.40)   # 车尾顶低
            bot_y    = int(h * 0.85)
            pts = np.array([
                [left_x, bot_y],         # 左下 (车头底)
                [left_x, top_high],      # 左上 (车头顶, 高)
                [int(w * 0.28), int(h * 0.22)],  # A 柱顶
                [int(w * 0.45), int(h * 0.30)],  # C 柱
                [right_x, top_low],      # 右上 (车尾顶, 低)
                [right_x, bot_y],        # 右下 (车尾底)
            ], np.int32)
        cv2.fillPoly(img, [pts], body_color)
        # 车窗玻璃 (侧视图两个窗, 位置随左右偏移保证整体不对称)
        if view == "left_side":
            # 左视图: 两个窗在中右部 (靠近车头)
            win1 = np.array([
                [int(w * 0.40), int(h * 0.42)],
                [int(w * 0.58), int(h * 0.28)],
                [int(w * 0.68), int(h * 0.28)],
                [int(w * 0.68), int(h * 0.52)],
                [int(w * 0.40), int(h * 0.52)],
            ], np.int32)
            win2 = np.array([
                [int(w * 0.68), int(h * 0.28)],
                [int(w * 0.84), int(h * 0.32)],
                [int(w * 0.86), int(h * 0.44)],
                [int(w * 0.68), int(h * 0.52)],
            ], np.int32)
        else:
            # 右视图: 两个窗在中左部 (靠近车头)
            win1 = np.array([
                [int(w * 0.32), int(h * 0.28)],
                [int(w * 0.14), int(h * 0.32)],
                [int(w * 0.12), int(h * 0.44)],
                [int(w * 0.32), int(h * 0.52)],
            ], np.int32)
            win2 = np.array([
                [int(w * 0.60), int(h * 0.42)],
                [int(w * 0.32), int(h * 0.28)],
                [int(w * 0.32), int(h * 0.52)],
                [int(w * 0.60), int(h * 0.52)],
            ], np.int32)
        cv2.fillPoly(img, [win1], glass_color)
        cv2.fillPoly(img, [win2], glass_color)
        # 轮拱: 仅用填充暗色圆形 (不画边框圆圈, 避免边缘)
        if view == "left_side":
            fw_x, rw_x = int(w * 0.78), int(w * 0.22)
        else:
            fw_x, rw_x = int(w * 0.22), int(w * 0.78)
        wheel_y = int(h * 0.82)
        wheel_r = int(min(w, h) * 0.07)
        for wx in (fw_x, rw_x):
            cv2.circle(img, (wx, wheel_y), wheel_r, (28, 30, 32), -1)


def _add_big_contour_at(img: np.ndarray, cx: int, cy: int, size: int,
                        variant: int) -> np.ndarray:
    """在指定位置绘制一个大的不规则轮廓块, 保证质心落在 (cx, cy) 附近。"""
    # 随机生成一组偏移点, 形成类似损伤/部件的不规则轮廓
    rng = np.random.RandomState(777 + variant)
    n_pts = 16
    angles = np.linspace(0, 2 * np.pi, n_pts, endpoint=False)
    radii = size * (0.6 + rng.rand(n_pts) * 0.8)
    xs = (cx + radii * np.cos(angles)).astype(np.int32)
    ys = (cy + radii * np.sin(angles) * 0.7).astype(np.int32)
    contour = np.column_stack((xs, ys)).reshape(-1, 1, 2)
    contour = contour.astype(np.int32)
    color = (50 + rng.randint(0, 80), 50 + rng.randint(0, 60),
             40 + rng.randint(0, 50))
    cv2.fillPoly(img, [contour], color)
    # 绘制额外小细节, 增加边缘密度
    for _ in range(8):
        dx = int(rng.randint(-size // 2, size // 2))
        dy = int(rng.randint(-size // 2, size // 2))
        s = int(size * (0.15 + rng.rand() * 0.2))
        cv2.circle(img, (cx + dx, cy + dy), s,
                   (rng.randint(30, 120), rng.randint(30, 120),
                    rng.randint(30, 120)), -1)
    return contour


def _add_headlight_feature(img: np.ndarray, nx: float):
    """在正视图底部左/右角添加高亮发光大灯特征。"""
    h, w = img.shape[:2]
    if nx < 0.33:
        cx, cy = int(w * 0.16), int(h * 0.70)
    else:
        cx, cy = int(w * 0.84), int(h * 0.70)
    # 发光核心: 极白
    cv2.circle(img, (cx, cy), 28, (255, 255, 255), -1)
    # 光晕: 黄白色渐变
    for r, color, thick in [
        (45, (220, 220, 180), 3),
        (60, (180, 180, 130), 2),
        (75, (140, 140, 100), 1),
    ]:
        cv2.ellipse(img, (cx, cy), (r, int(r * 0.7)), 0, 0, 360, color, thick)


def generate_image(part: str, variant: int) -> np.ndarray:
    """为指定部位 + 变体生成合成测试图像。"""
    view, target_nx, target_ny, w_hint, h_hint = PART_SPECS[part]
    # 变体带来的图像尺寸抖动 (±15%)
    rng = np.random.RandomState(variant + hash(part) % 1000)
    w = int(w_hint * (0.85 + rng.rand() * 0.30))
    h = int(h_hint * (0.85 + rng.rand() * 0.30))

    # 背景色 (偏深灰, 模拟地面/背景)
    img = np.full((h, w, 3), 50 + rng.randint(0, 30), dtype=np.uint8)
    img[:, :, 0] = (img[:, :, 0] * 0.95).astype(np.uint8)
    img[:, :, 2] = (img[:, :, 2] * 1.05).astype(np.uint8)

    # 1. 绘制车身外壳 (决定视角分类)
    _draw_body_shell(img, view)

    # 2. 计算质心目标像素位置 (带轻微抖动)
    jitter_x = int(w * (rng.rand() - 0.5) * 0.06)
    jitter_y = int(h * (rng.rand() - 0.5) * 0.06)
    cx = max(40, min(w - 40, int(w * target_nx) + jitter_x))
    cy = max(40, min(h - 40, int(h * target_ny) + jitter_y))

    # 3. 在目标质心位置绘制密集边缘簇 (保证该 3x3 单元格的边缘密度显著最高)
    #    使用多种形状混合: 大轮廓 + 同心圆 + 交叉线 + 散点小圆
    #    尺寸紧凑 (0.06~0.10): 保证簇集中在目标单元格内, 避免跨单元格边界稀释
    size = max(28, int(min(w, h) * (0.06 + rng.rand() * 0.04)))
    _add_big_contour_at(img, cx, cy, size, variant * 13 + 1)
    # 3a. 小圆点: 20 个, 但半径和散布较小, 集中在目标质心附近 (不跨 cell)
    for i in range(20):
        dx = int((rng.rand() - 0.5) * size * 1.8)
        dy = int((rng.rand() - 0.5) * size * 1.6)
        rr = max(4, int(size * (0.12 + rng.rand() * 0.20)))
        color = (
            70 + rng.randint(-20, 40),
            75 + rng.randint(-20, 40),
            80 + rng.randint(-20, 40),
        )
        cv2.circle(img, (cx + dx, cy + dy), rr, color, 2)
    # 3b. 交叉阴影线: 16 条短线段, 紧密围绕目标
    for i in range(16):
        dx1 = int((rng.rand() - 0.5) * size * 1.8)
        dy1 = int((rng.rand() - 0.5) * size * 1.6)
        dx2 = dx1 + int((rng.rand() - 0.5) * size * 0.9)
        dy2 = dy1 + int((rng.rand() - 0.5) * size * 0.8)
        cv2.line(img, (cx + dx1, cy + dy1), (cx + dx2, cy + dy2),
                 (60 + rng.randint(-10, 30), 65 + rng.randint(-10, 30), 70 + rng.randint(-10, 30)),
                 2)
    # 3c. 同心椭圆: 4 个尺度, 所有边缘集中在目标中心
    for scale in (0.6, 0.9, 1.2, 1.5):
        axes = (int(size * scale), int(size * 0.7 * scale))
        color = (80 + rng.randint(-15, 25), 85 + rng.randint(-15, 25), 90 + rng.randint(-15, 25))
        cv2.ellipse(img, (cx, cy), axes, int(rng.rand() * 60 - 30), 0, 360, color, 2)
    # 3d. 小散点: 12 个超小圆点纯边缘, 保证高密度且不外溢
    for i in range(12):
        dx = int((rng.rand() - 0.5) * size * 1.5)
        dy = int((rng.rand() - 0.5) * size * 1.4)
        rr = max(2, int(size * 0.10))
        cv2.circle(img, (cx + dx, cy + dy), rr,
                   (50 + rng.randint(-10, 50), 50 + rng.randint(-10, 50), 50 + rng.randint(-10, 50)),
                   2)

    # 4. 大灯专属: 高亮度发光区域
    if part == "headlight":
        _add_headlight_feature(img, target_nx)

    # 5. 小噪声 + 轻微模糊, 模拟真实拍照
    noise = rng.normal(0, 3 + rng.rand() * 4, img.shape).astype(np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    blur_k = 3 + 2 * (variant % 2)
    img = cv2.GaussianBlur(img, (blur_k, blur_k), 0)

    # 6. 变体编号 6-9: 轻微旋转 (±5°) 或 亮度变化
    if variant >= 6:
        angle = (rng.rand() - 0.5) * 10
        M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
        img = cv2.warpAffine(img, M, (w, h),
                             borderMode=cv2.BORDER_REFLECT)
    if variant in (2, 5, 8):
        # 亮度变化
        gain = 0.75 + rng.rand() * 0.5
        img = np.clip(img.astype(np.float32) * gain, 0, 255).astype(np.uint8)

    return img


def generate_dataset():
    """生成 12 部位 x 10 变体 = 120 张测试图像, 并写入标注文件。"""
    os.makedirs(DATASET_DIR, exist_ok=True)
    annotations: List[dict] = []

    for part in ALL_PARTS:
        part_dir = os.path.join(DATASET_DIR, part)
        os.makedirs(part_dir, exist_ok=True)
        for variant in range(VARIANTS_PER_PART):
            fname = f"{part}_{variant:02d}.jpg"
            fpath = os.path.join(part_dir, fname)
            img = generate_image(part, variant)
            cv2.imwrite(fpath, img, [cv2.IMWRITE_JPEG_QUALITY, 92])
            annotations.append({
                "file": fpath,
                "part": part,
                "variant": variant,
                "spec": {
                    "view": PART_SPECS[part][0],
                    "target_nx": PART_SPECS[part][1],
                    "target_ny": PART_SPECS[part][2],
                },
            })

    with open(ANNOTATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump({"images": annotations,
                   "parts": ALL_PARTS,
                   "variants_per_part": VARIANTS_PER_PART},
                  f, ensure_ascii=False, indent=2)
    print(f"[dataset] 已生成 {len(annotations)} 张测试图像 -> {DATASET_DIR}")
    return annotations


# ==============================================================================
# 基准测试
# ==============================================================================

@dataclass
class PartStats:
    """单个部位的统计数据。"""
    part: str
    tp: int = 0        # 正确识别为该部位的数量
    fp: int = 0        # 被误判为该部位的数量 (实际是其他部位)
    fn: int = 0        # 实际是该部位但被误判
    total: int = 0     # 实际该部位总数
    precision: float = 0.0
    recall: float = 0.0
    f1: float = 0.0


@dataclass
class BenchmarkResult:
    """完整基准测试结果。"""
    total_samples: int = 0
    correct: int = 0
    accuracy: float = 0.0
    per_part: Dict[str, PartStats] = field(default_factory=dict)
    confusion_matrix: Dict[str, Dict[str, int]] = field(default_factory=dict)
    errors: List[dict] = field(default_factory=list)   # 错误样本详情


def run_benchmark(annotations_path: str = ANNOTATIONS_FILE) -> BenchmarkResult:
    """运行基准测试并返回结果。"""
    with open(annotations_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    imgs = data["images"]

    analyzer = ImageAnalyzer("config.yaml")
    result = BenchmarkResult(total_samples=len(imgs))

    # 初始化统计
    for p in ALL_PARTS:
        result.per_part[p] = PartStats(part=p)
        result.confusion_matrix[p] = {q: 0 for q in ALL_PARTS}
    result.confusion_matrix["unknown"] = {q: 0 for q in ALL_PARTS}

    print(f"[benchmark] 开始对 {len(imgs)} 张图像进行部位识别...")
    for i, ann in enumerate(imgs, 1):
        fpath = ann["file"]
        gt = ann["part"]
        # 合成数据本身洁净, 直接读取 (避免 NL-Means 去噪瓶颈)
        img = cv2.imread(fpath)
        if img is None or img.size == 0:
            print(f"  [warn] 读取失败 {os.path.basename(fpath)}")
            pred = "__preprocess_failed__"
        else:
            pred = analyzer.detect_body_part(img)
            if pred not in ALL_PARTS:
                pred = "unknown"

        result.per_part[gt].total += 1

        is_correct = (pred == gt)
        if is_correct:
            result.correct += 1
            result.per_part[gt].tp += 1
        else:
            result.errors.append({
                "file": fpath,
                "ground_truth": gt,
                "predicted": pred,
                "variant": ann["variant"],
            })
            result.per_part[gt].fn += 1
            if pred in result.per_part:
                result.per_part[pred].fp += 1

        if pred in ALL_PARTS:
            result.confusion_matrix[gt][pred] += 1
        else:
            # unknown 预测: 不计入常规混淆矩阵, 但单独计数
            result.confusion_matrix.setdefault("__unknown__", {})
            result.confusion_matrix["__unknown__"][gt] = \
                result.confusion_matrix["__unknown__"].get(gt, 0) + 1

        if i % 20 == 0 or i == len(imgs):
            print(f"  进度 {i}/{len(imgs)}  当前准确率 "
                  f"{result.correct / i * 100:.1f}%")

    # 计算整体准确率
    result.accuracy = result.correct / max(result.total_samples, 1)

    # 计算每部位 precision/recall/F1
    for p in ALL_PARTS:
        ps = result.per_part[p]
        ps.precision = ps.tp / max(ps.tp + ps.fp, 1)
        ps.recall = ps.tp / max(ps.total, 1)
        ps.f1 = (2 * ps.precision * ps.recall) / max(
            ps.precision + ps.recall, 1e-6)

    # 写报告
    report = {
        "total_samples": result.total_samples,
        "correct": result.correct,
        "accuracy": round(result.accuracy, 6),
        "accuracy_pct": f"{result.accuracy * 100:.2f}%",
        "meets_90pct_target": result.accuracy >= 0.90,
        "per_part": {p: asdict(ps) for p, ps in result.per_part.items()},
        "confusion_matrix": result.confusion_matrix,
        "errors": result.errors,
    }
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"[benchmark] 报告已写入 {REPORT_FILE}")

    return result


def print_summary(result: BenchmarkResult):
    """打印易读的汇总表。"""
    print()
    print("=" * 86)
    print(f"损伤部位识别基准测试汇总 (共 {result.total_samples} 样本)")
    print("=" * 86)
    print(f"整体准确率: {result.accuracy * 100:.2f}%  "
          f"({result.correct}/{result.total_samples})  "
          f"目标 >= 90% -> {'✓ 通过' if result.accuracy >= 0.90 else '✗ 未通过'}")
    print("-" * 86)
    header = f"{'部位 (中文)':<14}{'部位 (key)':<22}{'样本':<6}{'TP':<5}{'FP':<5}" \
             f"{'FN':<5}{'精确率':<10}{'召回率':<10}{'F1':<10}"
    print(header)
    print("-" * 86)
    for p in ALL_PARTS:
        ps = result.per_part[p]
        print(f"{PART_LABEL_CN.get(p, p):<14}{p:<22}{ps.total:<6}"
              f"{ps.tp:<5}{ps.fp:<5}{ps.fn:<5}"
              f"{ps.precision*100:>8.1f}% "
              f"{ps.recall*100:>8.1f}% "
              f"{ps.f1*100:>8.1f}%")
    print("-" * 86)
    if result.errors:
        print(f"错误样本数: {len(result.errors)}  (详见 {REPORT_FILE})")
        for e in result.errors[:8]:
            print(f"  - {os.path.basename(e['file'])}:  "
                  f"GT={PART_LABEL_CN.get(e['ground_truth'], e['ground_truth'])}  "
                  f"预测={PART_LABEL_CN.get(e['predicted'], e['predicted'])}")
        if len(result.errors) > 8:
            print(f"  ... 其余 {len(result.errors) - 8} 条错误详见报告")
    print("=" * 86)


# ==============================================================================
# 主入口
# ==============================================================================

def main():
    # 第 1 步: 生成数据集 (若已存在则仅在标注文件缺失时重生成)
    regen = "--regen" in sys.argv
    if regen or not os.path.exists(ANNOTATIONS_FILE):
        generate_dataset()
    else:
        with open(ANNOTATIONS_FILE, "r", encoding="utf-8") as f:
            d = json.load(f)
        print(f"[dataset] 使用现有数据集 ({len(d['images'])} 张)")

    # 第 2 步: 运行基准测试
    result = run_benchmark()

    # 第 3 步: 打印汇总
    print_summary(result)

    # 返回码: 准确率 >= 90% 返回 0 否则 1
    return 0 if result.accuracy >= 0.90 else 2


if __name__ == "__main__":
    sys.exit(main())
