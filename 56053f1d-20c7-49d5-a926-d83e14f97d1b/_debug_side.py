import sys, cv2, numpy as np
sys.path.insert(0, '.')
from image_analyzer import ImageAnalyzer

analyzer = ImageAnalyzer()
parts = ["front_door_left_00", "rear_door_left_00", "front_door_right_00", "rear_door_right_00",
         "front_door_left_03", "rear_door_left_03", "rear_door_right_05", "rear_door_left_07",
         "rear_door_left_09", "rear_door_right_00"]

for name in parts:
    subdir = name.rsplit("_", 1)[0]
    path = f"./data/benchmark_body_parts/{subdir}/{name}.jpg"
    img = cv2.imread(path)
    if img is None:
        print(f"{name}: NOT FOUND"); continue
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    ratio = w/h

    q_top = int(h * 0.25)
    top_band = gray[:q_top, :]
    tw = top_band.shape[1]
    tl_mean = float(np.mean(top_band[:, :tw//2]))
    tr_mean = float(np.mean(top_band[:, tw//2:]))
    top_bias = (tr_mean - tl_mean) / max(tl_mean + tr_mean, 1)

    h_top = int(h*2/3)
    upper = gray[:h_top, :]
    uh, uw = upper.shape
    half = uw // 2
    left = upper[:, :half]
    right = cv2.flip(upper[:, uw-half:], 1)
    res = cv2.matchTemplate(left, right, cv2.TM_CCOEFF_NORMED)
    symmetry = float(res[0][0])

    edges = cv2.Canny(gray, 50, 150)
    eh, ew = edges.shape
    # 用局部 3x3 cell 的质心 (匹配 image_analyzer 逻辑)
    cell_h = eh // 3
    cell_w = ew // 3
    x0, x1 = jz * cell_w, (jz + 1) * cell_w
    y0, y1 = iz * cell_h, (iz + 1) * cell_h
    local_cell = edges[y0:y1, x0:x1]
    M_local = cv2.moments(local_cell)
    if M_local["m00"] > 1:
        lx = M_local["m10"] / M_local["m00"]
        ly = M_local["m01"] / M_local["m00"]
        gx = x0 + lx
        gy = y0 + ly
        nx_bias = gx / ew
        ny_bias = gy / eh
    else:
        nx_bias, ny_bias = nx, ny
    print(f"   MOMENTS(local cell jz={jz} iz={iz}): gx={gx:.0f} gy={gy:.0f} → nx_bias={nx_bias:.3f} ny_bias={ny_bias:.3f}")

    cell_h = eh // 3
    cell_w = ew // 3
    cells = np.zeros((3, 3), dtype=np.float64)
    for i in range(3):
        for j in range(3):
            roi = edges[j*cell_h:(j+1)*cell_h, i*cell_w:(i+1)*cell_w]
            cells[j, i] = cv2.countNonZero(roi) / float(cell_h * cell_w)
    jz, iz = np.unravel_index(np.argmax(cells), cells.shape)
    nx = (iz + 0.5) / 3.0
    ny = (jz + 0.5) / 3.0
    hzone = ["left","center","right"][iz]
    vzone = ["top","middle","bottom"][jz]

    SYMMETRY_SIDE_CUTOFF = 0.86
    ls_raw = (
        (max(0, 1.0 - abs(ratio - 1.80) / 0.90) * 0.25) +
        (min(max(0.92 - symmetry, 0.0) / 0.30, 1.0) * 0.25) +
        (min(max(-top_bias, 0.0) / 0.20, 1.0) * 0.40)
    )
    left_side_score = ls_raw * (0.05 if symmetry >= SYMMETRY_SIDE_CUTOFF else 1.0)
    rs_raw = (
        (max(0, 1.0 - abs(ratio - 1.80) / 0.90) * 0.25) +
        (min(max(0.92 - symmetry, 0.0) / 0.30, 1.0) * 0.25) +
        (min(max(top_bias, 0.0) / 0.20, 1.0) * 0.40)
    )
    right_side_score = rs_raw * (0.05 if symmetry >= SYMMETRY_SIDE_CUTOFF else 1.0)

    view, conf = analyzer._classify_view(img)
    pred = analyzer.detect_body_part(img)

    if view == "left_side":
        bias_3x3 = "front_half" if nx >= 0.5 else "rear_half"
        bias_mom = "front_half" if nx_bias >= 0.5 else "rear_half"
    elif view == "right_side":
        bias_3x3 = "front_half" if nx < 0.5 else "rear_half"
        bias_mom = "front_half" if nx_bias < 0.5 else "rear_half"
    else:
        bias_3x3 = bias_mom = "n/a"

    print(f"{name:25s} ratio={ratio:.3f} sym={symmetry:.3f} top_bias={top_bias:+.4f}")
    print(f"   VIEW={view:11s}({conf:.3f})  ls_raw={ls_raw:.3f} ls={left_side_score:.3f}  rs_raw={rs_raw:.3f} rs={right_side_score:.3f}")
    print(f"   3x3: iz={iz} jz={jz} nx={nx:.2f} ny={ny:.2f} → hz={hzone} vz={vzone} bias_3x3={bias_3x3} bias_mom={bias_mom}")
    print(f"   PRED={pred}")
    print()
