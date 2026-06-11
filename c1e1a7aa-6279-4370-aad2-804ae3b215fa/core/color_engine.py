import math
import numpy as np
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
from PIL import Image
from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn
from utils.logger import get_logger
from core.ink_model import CIELAB, RGB, RecipeComponent

logger = get_logger()

D65_X = 95.047
D65_Y = 100.000
D65_Z = 108.883


def _require_cielab(obj, func_name: str = "function") -> None:
    if not isinstance(obj, CIELAB):
        raise TypeError(
            f"{func_name} expects a CIELAB object, got {type(obj).__name__}. "
            f"Use CIELAB(l=..., a=..., b=...) to construct one."
        )


def _require_rgb(obj, func_name: str = "function") -> None:
    if not isinstance(obj, RGB):
        raise TypeError(
            f"{func_name} expects an RGB object, got {type(obj).__name__}. "
            f"Use RGB(r=..., g=..., b=...) to construct one."
        )


def self_check() -> Dict[str, Any]:
    results = {
        "color_roundtrip": False,
        "delta_e_identity": False,
        "paper_white_sanity": False,
        "errors": [],
    }

    try:
        test_lab = CIELAB(l=50.0, a=25.0, b=-30.0)
        rgb = cielab_to_rgb(test_lab)
        back = rgb_to_cielab(rgb)
        de = delta_e2000(test_lab, back)
        results["color_roundtrip"] = de < 2.0
        results["roundtrip_delta_e"] = round(de, 4)
    except Exception as e:
        results["errors"].append(f"color_roundtrip: {e}")

    try:
        lab = CIELAB(l=60.0, a=10.0, b=20.0)
        de = delta_e2000(lab, lab)
        results["delta_e_identity"] = abs(de) < 0.001
    except Exception as e:
        results["errors"].append(f"delta_e_identity: {e}")

    try:
        base = CIELAB(l=50.0, a=0.0, b=0.0)
        pw_95 = CIELAB(l=95.0, a=0.0, b=0.0)
        pw_75 = CIELAB(l=75.0, a=0.0, b=0.0)
        adj_95 = paper_white_adjustment(base, pw_95)
        adj_75 = paper_white_adjustment(base, pw_75)
        results["paper_white_sanity"] = adj_95.l > adj_75.l
    except Exception as e:
        results["errors"].append(f"paper_white_sanity: {e}")

    results["all_passed"] = (
        results["color_roundtrip"]
        and results["delta_e_identity"]
        and results["paper_white_sanity"]
        and not results["errors"]
    )
    return results


def _f(t: float) -> float:
    delta = 6.0 / 29.0
    if t > delta**3:
        return t ** (1.0 / 3.0)
    else:
        return t / (3 * delta**2) + 4.0 / 29.0


def _f_inv(t: float) -> float:
    delta = 6.0 / 29.0
    if t > delta:
        return t**3
    else:
        return 3 * delta**2 * (t - 4.0 / 29.0)


def rgb_to_xyz(rgb: RGB) -> Tuple[float, float, float]:
    r = rgb.r / 255.0
    g = rgb.g / 255.0
    b = rgb.b / 255.0

    r = _srgb_gamma(r)
    g = _srgb_gamma(g)
    b = _srgb_gamma(b)

    x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041

    return x * 100, y * 100, z * 100


def _srgb_gamma(c: float) -> float:
    if c <= 0.04045:
        return c / 12.92
    else:
        return ((c + 0.055) / 1.055) ** 2.4


def _srgb_gamma_inv(c: float) -> float:
    if c <= 0.0031308:
        return c * 12.92
    else:
        return 1.055 * (c ** (1.0 / 2.4)) - 0.055


def xyz_to_rgb(x: float, y: float, z: float) -> RGB:
    x /= 100.0
    y /= 100.0
    z /= 100.0

    r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
    g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560
    b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252

    r = _srgb_gamma_inv(r)
    g = _srgb_gamma_inv(g)
    b = _srgb_gamma_inv(b)

    r = max(0, min(255, int(round(r * 255))))
    g = max(0, min(255, int(round(g * 255))))
    b = max(0, min(255, int(round(b * 255))))

    return RGB(r=r, g=g, b=b)


def xyz_to_cielab(x: float, y: float, z: float) -> CIELAB:
    fx = _f(x / D65_X)
    fy = _f(y / D65_Y)
    fz = _f(z / D65_Z)

    l = 116 * fy - 16
    a = 500 * (fx - fy)
    b = 200 * (fy - fz)

    return CIELAB(l=l, a=a, b=b)


def cielab_to_xyz(lab: CIELAB) -> Tuple[float, float, float]:
    _require_cielab(lab, "cielab_to_xyz")
    fy = (lab.l + 16) / 116.0
    fx = lab.a / 500.0 + fy
    fz = fy - lab.b / 200.0

    x = D65_X * _f_inv(fx)
    y = D65_Y * _f_inv(fy)
    z = D65_Z * _f_inv(fz)

    return x, y, z


def rgb_to_cielab(rgb: RGB) -> CIELAB:
    _require_rgb(rgb, "rgb_to_cielab")
    x, y, z = rgb_to_xyz(rgb)
    return xyz_to_cielab(x, y, z)


def cielab_to_rgb(lab: CIELAB) -> RGB:
    _require_cielab(lab, "cielab_to_rgb")
    x, y, z = cielab_to_xyz(lab)
    return xyz_to_rgb(x, y, z)


def delta_e2000(lab1: CIELAB, lab2: CIELAB) -> float:
    _require_cielab(lab1, "delta_e2000(lab1)")
    _require_cielab(lab2, "delta_e2000(lab2)")
    l1, a1, b1 = lab1.to_tuple()
    l2, a2, b2 = lab2.to_tuple()

    c1 = math.sqrt(a1**2 + b1**2)
    c2 = math.sqrt(a2**2 + b2**2)
    c_bar = (c1 + c2) / 2.0

    g = 0.5 * (1 - math.sqrt(c_bar**7 / (c_bar**7 + 25**7)))

    a1_prime = (1 + g) * a1
    a2_prime = (1 + g) * a2

    c1_prime = math.sqrt(a1_prime**2 + b1**2)
    c2_prime = math.sqrt(a2_prime**2 + b2**2)
    c_bar_prime = (c1_prime + c2_prime) / 2.0

    h1_prime = math.atan2(b1, a1_prime)
    if h1_prime < 0:
        h1_prime += 2 * math.pi
    h2_prime = math.atan2(b2, a2_prime)
    if h2_prime < 0:
        h2_prime += 2 * math.pi

    delta_l_prime = l2 - l1
    delta_c_prime = c2_prime - c1_prime

    delta_h_prime = 0.0
    if c1_prime * c2_prime > 0:
        dh = h2_prime - h1_prime
        if abs(dh) <= math.pi:
            delta_h_prime = dh
        elif dh > math.pi:
            delta_h_prime = dh - 2 * math.pi
        else:
            delta_h_prime = dh + 2 * math.pi

    delta_h_prime = 2 * math.sqrt(c1_prime * c2_prime) * math.sin(delta_h_prime / 2.0)

    l_bar_prime = (l1 + l2) / 2.0
    c_bar_prime_val = (c1_prime + c2_prime) / 2.0

    h_bar_prime = h1_prime + h2_prime
    if c1_prime * c2_prime > 0:
        if abs(h1_prime - h2_prime) <= math.pi:
            h_bar_prime = (h1_prime + h2_prime) / 2.0
        else:
            if h1_prime + h2_prime < 2 * math.pi:
                h_bar_prime = (h1_prime + h2_prime + 2 * math.pi) / 2.0
            else:
                h_bar_prime = (h1_prime + h2_prime - 2 * math.pi) / 2.0

    t = (
        1
        - 0.17 * math.cos(h_bar_prime - math.pi / 6)
        + 0.24 * math.cos(2 * h_bar_prime)
        + 0.32 * math.cos(3 * h_bar_prime + math.pi / 30)
        - 0.20 * math.cos(4 * h_bar_prime - 63 * math.pi / 180)
    )

    delta_theta = 30 * math.pi / 180 * math.exp(-((h_bar_prime - 275 * math.pi / 180) / (25 * math.pi / 180)) ** 2)
    r_c = 2 * math.sqrt(c_bar_prime_val**7 / (c_bar_prime_val**7 + 25**7))
    s_l = 1 + (0.015 * (l_bar_prime - 50) ** 2) / math.sqrt(20 + (l_bar_prime - 50) ** 2)
    s_c = 1 + 0.045 * c_bar_prime_val
    s_h = 1 + 0.015 * c_bar_prime_val * t
    r_t = -r_c * math.sin(2 * delta_theta)

    k_l = 1.0
    k_c = 1.0
    k_h = 1.0

    delta_e = math.sqrt(
        (delta_l_prime / (k_l * s_l)) ** 2
        + (delta_c_prime / (k_c * s_c)) ** 2
        + (delta_h_prime / (k_h * s_h)) ** 2
        + r_t * (delta_c_prime / (k_c * s_c)) * (delta_h_prime / (k_h * s_h))
    )

    return round(delta_e, 4)


def kubelka_munk_mix(inks: List[Tuple[CIELAB, float]]) -> CIELAB:
    total_ratio = sum(r for _, r in inks)
    if abs(total_ratio - 1.0) > 0.01:
        logger.warning(f"Kubelka-Munk: ratios sum to {total_ratio:.3f}, not 1.0")

    xyz_sum = [0.0, 0.0, 0.0]
    for lab, ratio in inks:
        x, y, z = cielab_to_xyz(lab)
        k_s_ratio = _xyz_to_ks(x, y, z)
        weighted_ks = [k * ratio for k in k_s_ratio]
        xyz_sum[0] += weighted_ks[0]
        xyz_sum[1] += weighted_ks[1]
        xyz_sum[2] += weighted_ks[2]

    result_xyz = _ks_to_xyz(xyz_sum[0], xyz_sum[1], xyz_sum[2])
    return xyz_to_cielab(result_xyz[0], result_xyz[1], result_xyz[2])


def _xyz_to_ks(x: float, y: float, z: float) -> List[float]:
    r_inf = [x / D65_X, y / D65_Y, z / D65_Z]
    ks = []
    for r in r_inf:
        r = max(0.001, min(0.999, r))
        k_s = (1 - r) ** 2 / (2 * r)
        ks.append(k_s)
    return ks


def _ks_to_xyz(kx: float, ky: float, kz: float) -> Tuple[float, float, float]:
    ks = [kx, ky, kz]
    xyz = []
    for k in ks:
        discriminant = k * (k + 2)
        r_inf = 1 + k - math.sqrt(discriminant)
        xyz.append(r_inf)
    return xyz[0] * D65_X, xyz[1] * D65_Y, xyz[2] * D65_Z


def simple_linear_mix(inks: List[Tuple[CIELAB, float]]) -> CIELAB:
    total_l = 0.0
    total_a = 0.0
    total_b = 0.0
    total_ratio = 0.0

    for lab, ratio in inks:
        total_l += lab.l * ratio
        total_a += lab.a * ratio
        total_b += lab.b * ratio
        total_ratio += ratio

    if total_ratio > 0:
        total_l /= total_ratio
        total_a /= total_ratio
        total_b /= total_ratio

    return CIELAB(l=total_l, a=total_a, b=total_b)


def mix_colors(inks: List[Tuple[CIELAB, float]], use_kubelka_munk: bool = True) -> CIELAB:
    if use_kubelka_munk:
        try:
            return kubelka_munk_mix(inks)
        except Exception as e:
            logger.warning(f"Kubelka-Munk failed, falling back to linear mix: {e}")
    return simple_linear_mix(inks)


def extract_dominant_colors(
    image_path: str, num_colors: int = 5, show_progress: bool = True
) -> List[Tuple[CIELAB, float]]:
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")
    if path.stat().st_size > 5 * 1024 * 1024:
        raise ValueError(f"Image too large ({path.stat().st_size} bytes). Max 5MB.")

    logger.info(f"Extracting dominant colors from {image_path}")

    with Image.open(image_path) as img:
        img = img.convert("RGB")
        img.thumbnail((128, 128))
        pixels = np.array(img).reshape(-1, 3)

    n_samples = len(pixels)
    if n_samples < num_colors:
        num_colors = n_samples

    progress = None
    task_id = None
    if show_progress:
        progress = Progress(
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
        )
        progress.start()
        task_id = progress.add_task("Extracting colors...", total=100)

    try:
        centroids, labels = _kmeans(pixels, num_colors, progress, task_id)
    finally:
        if progress is not None and task_id is not None:
            progress.update(task_id, completed=100)
            progress.stop()

    counts = np.bincount(labels, minlength=num_colors)
    total = len(labels)

    results = []
    for i in range(num_colors):
        rgb = RGB(
            r=int(centroids[i][0]),
            g=int(centroids[i][1]),
            b=int(centroids[i][2]),
        )
        lab = rgb_to_cielab(rgb)
        proportion = counts[i] / total
        results.append((lab, proportion))

    results.sort(key=lambda x: x[1], reverse=True)
    return results


def _kmeans(
    pixels: np.ndarray,
    k: int,
    progress=None,
    task_id=None,
    max_iter: int = 20,
    tol: float = 1e-4,
) -> Tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(42)
    indices = rng.choice(len(pixels), size=k, replace=False)
    centroids = pixels[indices].astype(np.float64)

    for iteration in range(max_iter):
        distances = _compute_distances(pixels, centroids)
        labels = np.argmin(distances, axis=1)

        new_centroids = np.zeros_like(centroids)
        for i in range(k):
            if np.sum(labels == i) > 0:
                new_centroids[i] = pixels[labels == i].mean(axis=0)
            else:
                new_centroids[i] = centroids[i]

        shift = np.linalg.norm(new_centroids - centroids)
        centroids = new_centroids

        if progress is not None and task_id is not None:
            progress.update(task_id, completed=((iteration + 1) / max_iter) * 90)

        if shift < tol:
            break

    distances = _compute_distances(pixels, centroids)
    labels = np.argmin(distances, axis=1)

    return centroids, labels


def _compute_distances(pixels: np.ndarray, centroids: np.ndarray) -> np.ndarray:
    pixels_norm = pixels[:, np.newaxis, :].astype(np.float64)
    centroids_norm = centroids[np.newaxis, :, :].astype(np.float64)
    diff = pixels_norm - centroids_norm
    return np.sum(diff**2, axis=2)


def find_best_mix(
    target: CIELAB,
    available_inks: List[Dict[str, Any]],
    max_inks: int = 5,
    delta_e_threshold: float = 3.0,
) -> Tuple[List[RecipeComponent], CIELAB, float]:
    logger.info(f"Searching for best mix for target L*={target.l:.1f} a*={target.a:.1f} b*={target.b:.1f}")

    if len(available_inks) == 0:
        raise ValueError("No available inks for mixing")

    if max_inks < 2:
        max_inks = 2

    best_components: List[RecipeComponent] = []
    best_result = target
    best_delta = float("inf")

    inks_lab = []
    for ink in available_inks:
        lab = CIELAB(l=ink["l"], a=ink["a"], b=ink["b"])
        inks_lab.append((ink["id"], ink.get("full_name", f"Ink #{ink['id']}"), lab))

    single_ink_scores = []
    for ink_id, full_name, lab in inks_lab:
        de = delta_e2000(target, lab)
        single_ink_scores.append((de, ink_id, full_name, lab))
    single_ink_scores.sort(key=lambda x: x[0])

    if single_ink_scores[0][0] <= delta_e_threshold:
        de, ink_id, full_name, lab = single_ink_scores[0]
        component = RecipeComponent(
            ink_id=ink_id,
            ink_name=full_name,
            volume_ratio=1.0,
            volume_ml=None,
        )
        logger.info(f"Single ink match found: ΔE={de:.2f}")
        return [component], lab, de

    for num_components in range(2, min(max_inks + 1, len(inks_lab) + 1)):
        result = _greedy_search(
            target, inks_lab, num_components, delta_e_threshold
        )
        if result is not None:
            components, predicted, delta = result
            if delta < best_delta:
                best_components = components
                best_result = predicted
                best_delta = delta
                if delta <= delta_e_threshold:
                    break

    if best_delta == float("inf"):
        logger.info("Falling back to best single ink approximation")
        de, ink_id, full_name, lab = single_ink_scores[0]
        best_components = [
            RecipeComponent(ink_id=ink_id, ink_name=full_name, volume_ratio=1.0)
        ]
        best_result = lab
        best_delta = de

    logger.info(f"Best mix found with {len(best_components)} inks, ΔE={best_delta:.2f}")
    return best_components, best_result, best_delta


def _greedy_search(
    target: CIELAB,
    inks_lab: List[Tuple[int, str, CIELAB]],
    num_components: int,
    delta_e_threshold: float,
) -> Optional[Tuple[List[RecipeComponent], CIELAB, float]]:
    from itertools import combinations

    best_delta = float("inf")
    best_combo = None
    best_ratios = None
    best_result = None

    candidate_inks = inks_lab[: min(20, len(inks_lab))]

    for combo in combinations(candidate_inks, num_components):
        try:
            ratios, result, delta = _optimize_ratios(target, combo)
            if delta < best_delta:
                best_delta = delta
                best_combo = combo
                best_ratios = ratios
                best_result = result
                if delta <= delta_e_threshold:
                    break
        except Exception as e:
            logger.debug(f"Optimization failed for combo: {e}")
            continue

    if best_combo is None or best_ratios is None or best_result is None:
        return None

    components = []
    for (ink_id, full_name, _), ratio in zip(best_combo, best_ratios):
        if ratio > 0.01:
            components.append(
                RecipeComponent(
                    ink_id=ink_id,
                    ink_name=full_name,
                    volume_ratio=round(ratio, 4),
                )
            )

    total = sum(c.volume_ratio for c in components)
    for c in components:
        c.volume_ratio = round(c.volume_ratio / total, 4)

    return components, best_result, best_delta


def _optimize_ratios(
    target: CIELAB,
    inks: Tuple[Tuple[int, str, CIELAB], ...],
    steps: int = 20,
) -> Tuple[List[float], CIELAB, float]:
    n = len(inks)
    best_delta = float("inf")
    best_ratios = [1.0 / n] * n
    best_result = None

    if n == 2:
        for i in range(steps + 1):
            r1 = i / steps
            r2 = 1.0 - r1
            ratios = [r1, r2]
            mix_input = [(inks[j][2], ratios[j]) for j in range(n)]
            result = mix_colors(mix_input)
            delta = delta_e2000(target, result)
            if delta < best_delta:
                best_delta = delta
                best_ratios = ratios
                best_result = result
    else:
        for _ in range(steps * 5):
            ratios = np.random.dirichlet(np.ones(n))
            mix_input = [(inks[j][2], float(ratios[j])) for j in range(n)]
            result = mix_colors(mix_input)
            delta = delta_e2000(target, result)
            if delta < best_delta:
                best_delta = delta
                best_ratios = ratios.tolist()
                best_result = result

    if best_result is None:
        mix_input = [(inks[j][2], best_ratios[j]) for j in range(n)]
        best_result = mix_colors(mix_input)
        best_delta = delta_e2000(target, best_result)

    return best_ratios, best_result, best_delta


def paper_white_adjustment(
    color: CIELAB, paper_white: CIELAB, base_white: CIELAB = CIELAB(l=100, a=0, b=0)
) -> CIELAB:
    _require_cielab(color, "paper_white_adjustment(color)")
    _require_cielab(paper_white, "paper_white_adjustment(paper_white)")
    _require_cielab(base_white, "paper_white_adjustment(base_white)")
    l_shift = paper_white.l - base_white.l
    a_shift = paper_white.a - base_white.a
    b_shift = paper_white.b - base_white.b

    adjusted = CIELAB(
        l=max(0, min(100, color.l + l_shift * 0.3)),
        a=max(-128, min(127, color.a + a_shift * 0.5)),
        b=max(-128, min(127, color.b + b_shift * 0.5)),
    )

    shift = delta_e2000(color, adjusted)
    logger.debug(f"Paper white adjustment: ΔE={shift:.2f}")
    return adjusted
