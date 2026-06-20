import cv2, numpy as np
from image_analyzer import ImageAnalyzer
a = ImageAnalyzer("config.yaml")

samples = [
    "./data/benchmark_body_parts/front_bumper/front_bumper_00.jpg",
    "./data/benchmark_body_parts/hood/hood_00.jpg",
    "./data/benchmark_body_parts/roof/roof_00.jpg",
    "./data/benchmark_body_parts/front_door_left/front_door_left_00.jpg",
    "./data/benchmark_body_parts/rear_door_left/rear_door_left_00.jpg",
    "./data/benchmark_body_parts/fender_front_left/fender_front_left_00.jpg",
    "./data/benchmark_body_parts/headlight/headlight_00.jpg",
    "./data/benchmark_body_parts/front_door_right/front_door_right_00.jpg",
    "./data/benchmark_body_parts/rear_bumper/rear_bumper_00.jpg",
    "./data/benchmark_body_parts/trunk/trunk_00.jpg",
    "./data/benchmark_body_parts/fender_front_right/fender_front_right_00.jpg",
    "./data/benchmark_body_parts/rear_door_right/rear_door_right_00.jpg",
]

def max_density_ny_nx(emap):
    H, W = emap.shape[:2]
    xs = np.linspace(0, W, 4, dtype=int)
    ys = np.linspace(0, H, 4, dtype=int)
    counts = np.zeros((3, 3), dtype=np.float64)
    for i in range(3):
        for j in range(3):
            patch = emap[ys[i]:ys[i+1], xs[j]:xs[j+1]]
            area = max(patch.size, 1)
            counts[i, j] = float(np.count_nonzero(patch)) / area
    iz, jz = np.unravel_index(np.argmax(counts), counts.shape)
    return (jz + 0.5)/3.0, (iz + 0.5)/3.0, counts

for fp in samples:
    img = cv2.imread(fp)
    h, w = img.shape[:2]
    ratio = w / max(h, 1)
    view, conf = a._classify_view(img)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    e = cv2.Canny(gray, 50, 180)
    nx, ny, counts = max_density_ny_nx(e)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0]
    bl_c = float(L[int(0.6 * h):, :int(0.3 * w)].max()) - float(L.mean())
    br_c = float(L[int(0.6 * h):, int(0.7 * w):].max()) - float(L.mean())
    mid = w // 2
    lh = gray[:, :mid]; rh = gray[:, mid:]
    if lh.shape[1] != rh.shape[1]:
        mw = min(lh.shape[1], rh.shape[1])
        lh = lh[:, :mw]; rh = rh[:, :mw]
    sym = float(cv2.matchTemplate(lh, cv2.flip(rh, 1), cv2.TM_CCOEFF_NORMED).max())
    name = fp.split("/")[-1]
    pred = a.detect_body_part(img)
    # bias 判定 (与 image_analyzer 一致)
    if view == "left_side":
        bias = "front_half" if nx >= 0.5 else "rear_half"
    elif view == "right_side":
        bias = "front_half" if nx < 0.5 else "rear_half"
    else:
        bias = "front_half" if nx < 0.5 else "rear_half"
    hz = "left" if nx<0.33 else ("right" if nx>0.67 else "center")
    vz = "top" if ny<0.33 else ("bottom" if ny>0.67 else "middle")
    print(f"{name:<40} sz={w}x{h} r={ratio:.2f} sym={sym:.2f} v={view}({conf}) "
          f"nx={nx:.2f}({hz}) ny={ny:.2f}({vz}) bias={bias} "
          f"bl={bl_c:.0f} br={br_c:.0f} => PRED={pred}")
