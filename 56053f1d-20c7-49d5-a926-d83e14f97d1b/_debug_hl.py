import sys, cv2, numpy as np
sys.path.insert(0, '.')
from image_analyzer import ImageAnalyzer

analyzer = ImageAnalyzer()
img = cv2.imread("./data/benchmark_body_parts/headlight/headlight_00.jpg")

view, view_conf = analyzer._classify_view(img)
print(f"view={view} conf={view_conf}")

h, w = img.shape[:2]
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
edge_map = cv2.Canny(gray, 50, 180)
H, W = edge_map.shape[:2]
xs = np.linspace(0, W, 4, dtype=int)
ys = np.linspace(0, H, 4, dtype=int)
counts = np.zeros((3, 3), dtype=np.float64)
for i in range(3):
    for j in range(3):
        patch = edge_map[ys[i]:ys[i + 1], xs[j]:xs[j + 1]]
        area = max(patch.size, 1)
        counts[i, j] = float(np.count_nonzero(patch)) / area
iz, jz = np.unravel_index(np.argmax(counts), counts.shape)
nx = (jz + 0.5) / 3.0
ny = (iz + 0.5) / 3.0
print(f"3x3 max: iz={iz} jz={jz} nx={nx:.2f} ny={ny:.2f}")
print(f"counts=\n{counts}")

hzone = "left" if nx<0.33 else ("right" if nx>0.67 else "center")
vzone = "top" if ny<0.33 else ("bottom" if ny>0.67 else "middle")
print(f"hzone={hzone} vzone={vzone}")

lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
L = lab[:, :, 0]
bottom_left_L = float(L[int(0.6 * h):, :int(0.3 * w)].max())
bottom_right_L = float(L[int(0.6 * h):, int(0.7 * w):].max())
base_L = float(L.mean())
bl_contrast = bottom_left_L - base_L
br_contrast = bottom_right_L - base_L
print(f"bl_con={bl_contrast:.1f} br_con={br_contrast:.1f} base={base_L:.1f}")
has_bright_contrast = (bl_contrast > 40) or (br_contrast > 40)
print(f"has_bright_contrast={has_bright_contrast}")

if has_bright_contrast:
    if bl_contrast - br_contrast > 15:
        headlight_hzone_override = "left"
    elif br_contrast - bl_contrast > 15:
        headlight_hzone_override = "right"
    else:
        headlight_hzone_override = hzone
else:
    headlight_hzone_override = hzone
print(f"headlight_hzone_override={headlight_hzone_override}")

for part, rule in analyzer._part_rules.items():
    s = 0.0
    if view in rule["views"]:
        s += 0.4 * max(view_conf, 0.3)
    effective_hzone = (headlight_hzone_override
                       if rule.get("need_bright_contrast", False)
                       else hzone)
    if effective_hzone in rule.get("hzones", set()):
        s += 0.25
    if vzone in rule.get("vzones", set()):
        s += 0.25
    if "bias" in rule:
        if view == "left_side":
            bias = "front_half" if nx >= 0.5 else "rear_half"
        elif view == "right_side":
            bias = "front_half" if nx < 0.5 else "rear_half"
        else:
            bias = "front_half" if nx < 0.5 else "rear_half"
        if bias == rule["bias"]:
            s += 0.1
        else:
            s -= 0.05
    if rule.get("need_bright_contrast", False):
        if has_bright_contrast and (effective_hzone in ("left", "right")):
            s += 0.1
        else:
            s -= 0.2
    s = round(max(0.0, s), 4)
    print(f"  {part:22s}: {s:.4f}")
