import sys, cv2, numpy as np
sys.path.insert(0, '.')
from image_analyzer import ImageAnalyzer

analyzer = ImageAnalyzer()

def debug_view(path):
    print(f"\n=== {path} ===")
    img = cv2.imread(path)
    if img is None:
        print("  NOT FOUND!"); return
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    ratio = w / h

    h_top = int(h * 2 / 3)
    upper = gray[:h_top, :]
    uh, uw = upper.shape
    half = uw // 2
    left = upper[:, :half]
    right = cv2.flip(upper[:, uw - half:], 1)
    res = cv2.matchTemplate(left, right, cv2.TM_CCOEFF_NORMED)
    symmetry = float(res[0][0])

    sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    dx_mean = np.mean(np.abs(sobel_x)) + 1e-6
    dy_mean = np.mean(np.abs(sobel_y)) + 1e-6
    hv_ratio = dx_mean / dy_mean

    h3 = h // 3
    top_slice = gray[:h3, :]
    mid_slice = gray[h3:2*h3, :]
    bot_slice = gray[2*h3:, :]
    t_mean = float(np.mean(top_slice))
    mid_mean = float(np.mean(mid_slice))
    bot_mean = float(np.mean(bot_slice))
    t_std = float(np.std(top_slice))
    mb_mean = (mid_mean + bot_mean) / 2.0
    front_darkness = (t_mean - mb_mean) / max(t_mean, 1)
    rear_brightness = 1.0 - abs(t_mean - mb_mean) / 120.0

    canny = cv2.Canny(gray, 50, 150)
    left_edges = cv2.countNonZero(canny[:, :w//2])
    right_edges = cv2.countNonZero(canny[:, w//2:])
    total_e = max(left_edges + right_edges, 1)
    edge_bias = (right_edges - left_edges) / total_e

    print(f"  ratio={ratio:.3f}  sym={symmetry:.3f}  hv={hv_ratio:.3f}")
    print(f"  t_mean={t_mean:.1f}  mid={mid_mean:.1f}  bot={bot_mean:.1f}")
    print(f"  t_std={t_std:.2f}  front_darkness={front_darkness:.4f}  rear_br={rear_brightness:.3f}")
    print(f"  edge_bias={edge_bias:.4f}")

    view, conf = analyzer._classify_view(img)
    print(f"  CLASSIFIED: view={view} conf={conf:.4f}")

    SYMMETRY_SIDE_CUTOFF = 0.86
    f_raw = (
        (min(max((ratio - 1.5) / 0.4, 0.0), 1.0) * 0.15) +
        (min(max((symmetry - 0.84) / 0.10, 0.0), 1.0) * 0.25) +
        (min(front_darkness / 0.06, 1.0) * 0.45) +
        (0.15 if hv_ratio > 0.85 else hv_ratio / 0.85 * 0.15)
    )
    f = f_raw * (0.1 if symmetry < SYMMETRY_SIDE_CUTOFF else 1.0)
    r_raw = (
        (min(max((ratio - 1.5) / 0.4, 0.0), 1.0) * 0.15) +
        (min(max((symmetry - 0.84) / 0.10, 0.0), 1.0) * 0.25) +
        (max(0, 1.0 - t_std / 40.0) * 0.20) +
        (min(rear_brightness, 1.0) * 0.25) +
        (0.15 if hv_ratio > 0.85 else 0.0)
    )
    r = r_raw * (0.05 if front_darkness > 0.06 else 1.0) * (0.1 if symmetry < SYMMETRY_SIDE_CUTOFF else 1.0)
    ls_raw = (
        (max(0, 1.0 - abs(ratio - 1.80) / 0.90) * 0.20) +
        (min(max(0.92 - symmetry, 0.0) / 0.30, 1.0) * 0.20) +
        (min(max(edge_bias + 0.02, 0) / 0.20, 1.0) * 0.40) +
        (0.20 if hv_ratio > 0.95 else 0.0)
    )
    ls = ls_raw * (0.05 if symmetry >= SYMMETRY_SIDE_CUTOFF else 1.0)
    rs_raw = (
        (max(0, 1.0 - abs(ratio - 1.80) / 0.90) * 0.20) +
        (min(max(0.92 - symmetry, 0.0) / 0.30, 1.0) * 0.20) +
        (min(max(-edge_bias + 0.02, 0) / 0.20, 1.0) * 0.40) +
        (0.20 if hv_ratio > 0.95 else 0.0)
    )
    rs = rs_raw * (0.05 if symmetry >= SYMMETRY_SIDE_CUTOFF else 1.0)

    print(f"  SCORES: front={f:.4f} (raw={f_raw:.4f}) rear={r:.4f} (raw={r_raw:.4f})")
    print(f"          left_side={ls:.4f} (raw={ls_raw:.4f}) right_side={rs:.4f} (raw={rs_raw:.4f})")

for name in ["front_bumper_00", "hood_00", "rear_bumper_00", "trunk_00", "roof_00",
             "headlight_00", "front_door_left_00", "rear_door_left_00",
             "front_door_right_00", "rear_door_right_00",
             "fender_front_left_00", "fender_front_right_00"]:
    # 去掉 _NN 后缀得到子目录名
    subdir = name.rsplit("_", 1)[0]
    debug_view(f"./data/benchmark_body_parts/{subdir}/{name}.jpg")
