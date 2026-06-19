import os
import time
import logging
import numpy as np
from typing import Optional, Tuple, List, Dict, Any
from PIL import Image, ImageEnhance

try:
    import cv2
except ImportError:
    cv2 = None

from retry_handler import RetryConfig, RetryHandler


logger = logging.getLogger(__name__)


class ElementNotFoundException(Exception):
    pass


class ImageProcessingError(Exception):
    pass


class MatchResult:
    def __init__(
        self,
        template_name: str,
        position: Tuple[int, int],
        confidence: float,
        size: Tuple[int, int],
        center: Tuple[int, int],
    ):
        self.template_name = template_name
        self.position = position
        self.confidence = confidence
        self.size = size
        self.center = center

    def __repr__(self) -> str:
        return (
            f"MatchResult(template='{self.template_name}', "
            f"position={self.position}, confidence={self.confidence:.3f}, "
            f"center={self.center})"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "template_name": self.template_name,
            "position": self.position,
            "confidence": self.confidence,
            "size": self.size,
            "center": self.center,
        }


class ImagePreprocessor:
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.max_rotation_angle = self.config.get("max_rotation_angle", 15)
        self.contrast_factor = self.config.get("contrast_factor", 1.5)
        self.brightness_factor = self.config.get("brightness_factor", 1.0)
        self.sharpen_factor = self.config.get("sharpen_factor", 1.2)
        self.deskew = self.config.get("deskew", True)
        self.grayscale = self.config.get("grayscale", True)
        self.threshold = self.config.get("threshold", 180)

    def preprocess_invoice(self, image: Image.Image) -> Image.Image:
        if cv2 is None:
            return self._preprocess_pil(image)
        return self._preprocess_cv2(image)

    def _preprocess_pil(self, image: Image.Image) -> Image.Image:
        if self.grayscale:
            image = image.convert("L")
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(self.contrast_factor)
        enhancer = ImageEnhance.Brightness(image)
        image = enhancer.enhance(self.brightness_factor)
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(self.sharpen_factor)
        return image

    def _preprocess_cv2(self, image: Image.Image) -> Image.Image:
        img_array = np.array(image.convert("RGB"))
        img = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

        if self.deskew:
            img = self._deskew_image(img)

        if self.grayscale:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        img = cv2.convertScaleAbs(img, alpha=self.contrast_factor, beta=0)
        img = cv2.addWeighted(img, self.brightness_factor, np.zeros(img.shape, img.dtype), 0)

        kernel = np.array([[-1, -1, -1], [-1, 9, -1]], dtype=np.float32)
        kernel_sum = kernel.sum()
        if kernel_sum != 0:
            kernel = kernel / kernel_sum * self.sharpen_factor
        img = cv2.filter2D(img, -1, kernel)

        if self.grayscale and self.threshold > 0:
            _, img = cv2.threshold(img, self.threshold, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

        return Image.fromarray(img)

    def _deskew_image(self, image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.bitwise_not(gray)
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
        coords = np.column_stack(np.where(thresh > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        if abs(angle) > self.max_rotation_angle:
            return image
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        return rotated

    def auto_rotate(self, image: Image.Image) -> Image.Image:
        if cv2 is None:
            return image
        img_array = np.array(image.convert("RGB"))
        img = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        for angle in [90, 180, 270]:
            rotated = self._rotate_image(img, angle)
            if self._is_orientation_correct(rotated):
                return Image.fromarray(cv2.cvtColor(rotated, cv2.COLOR_BGR2RGB))
        return image

    def _rotate_image(self, image: np.ndarray, angle: int) -> np.ndarray:
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        if angle in [90, 270]:
            new_w, new_h = h, w
        else:
            new_w, new_h = w, h
        M[0, 2] += (new_w - w) / 2
        M[1, 2] += (new_h - h) / 2
        rotated = cv2.warpAffine(image, M, (new_w, new_h), flags=cv2.INTER_CUBIC)
        return rotated

    def _is_orientation_correct(self, image: np.ndarray) -> bool:
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100, minLineLength=100, maxLineGap=10)
            if lines is None:
                return False
            angles = []
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi
                angles.append(abs(angle))
            avg_angle = np.mean(angles) if angles else 90
            return avg_angle < 45 or avg_angle > 135
        except Exception:
            return True

    def crop_to_content(self, image: Image.Image, padding: int = 10) -> Image.Image:
        if cv2 is None:
            return image
        img_array = np.array(image.convert("RGB"))
        img = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        coords = cv2.findNonZero(thresh)
        if coords is None:
            return image
        x, y, w, h = cv2.boundingRect(coords)
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = min(img.shape[1] - x, w + 2 * padding)
        h = min(img.shape[0] - y, h + 2 * padding)
        cropped = img[y:y + h, x:x + w]
        return Image.fromarray(cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB))

    def enhance_text(self, image: Image.Image) -> Image.Image:
        if cv2 is None:
            return image
        img_array = np.array(image.convert("RGB"))
        img = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        return Image.fromarray(enhanced)

    @classmethod
    def from_yaml_config(cls, config: Dict) -> "ImagePreprocessor":
        return cls(config.get("image_preprocessing", {}))


class TemplateMatcher:
    def __init__(
        self,
        threshold: float = 0.85,
        config: Optional[Dict] = None,
    ):
        if cv2 is None:
            raise ImportError("opencv-python is required for TemplateMatcher")

        self.threshold = threshold
        self.config = config or {}
        self.templates: Dict[str, np.ndarray] = {}
        self.template_sizes: Dict[str, Tuple[int, int]] = {}
        self.search_region = self.config.get("search_region", {
            "top": 0, "left": 0, "width": 1920, "height": 1080
        })

    def load_template(self, name: str, template_path: str) -> None:
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template not found: {template_path}")
        template = cv2.imread(template_path, cv2.IMREAD_GRAYSCALE)
        if template is None:
            raise ValueError(f"Failed to load template: {template_path}")
        self.templates[name] = template
        self.template_sizes[name] = (template.shape[1], template.shape[0])
        logger.info(
            f"Loaded template: {name} ({template_path})",
            extra={
                "operation": "load_template",
                "status": "success",
                "duration": 0.0,
                "template_name": name,
                "template_size": self.template_sizes[name],
            },
        )

    def load_templates(self, template_paths: Dict[str, str]) -> None:
        for name, path in template_paths.items():
            try:
                self.load_template(name, path)
            except Exception as e:
                logger.warning(
                    f"Failed to load template {name}: {str(e)}",
                    extra={
                        "operation": "load_templates",
                        "status": "warning",
                        "duration": 0.0,
                        "template_name": name,
                        "error": str(e),
                    },
                )

    def match(
        self,
        screenshot: Image.Image,
        template_name: str,
        threshold: Optional[float] = None,
        region: Optional[Tuple[int, int, int, int]] = None,
    ) -> MatchResult:
        start_time = time.time()
        threshold = threshold or self.threshold

        if template_name not in self.templates:
            raise ElementNotFoundException(f"Template not loaded: {template_name}")

        try:
            screen_array = np.array(screenshot.convert("RGB"))
            screen_gray = cv2.cvtColor(screen_array, cv2.COLOR_RGB2GRAY)

            if region is None:
                region = (
                    self.search_region["left"],
                    self.search_region["top"],
                    self.search_region["width"],
                    self.search_region["height"],
                )
            x, y, w, h = region
            search_area = screen_gray[y:y + h, x:x + w]

            template = self.templates[template_name]
            template_h, template_w = template.shape[:2]

            if search_area.shape[0] < template_h or search_area.shape[1] < template_w:
                raise ElementNotFoundException(
                    f"Search area smaller than template for {template_name}"
                )

            result = cv2.matchTemplate(search_area, template, cv2.TM_CCOEFF_NORMED)
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

            if max_val < threshold:
                raise ElementNotFoundException(
                    f"No match found for {template_name} (confidence: {max_val:.3f} < {threshold})"
                )

            match_x = x + max_loc[0]
            match_y = y + max_loc[1]
            center_x = match_x + template_w // 2
            center_y = match_y + template_h // 2

            match_result = MatchResult(
                template_name=template_name,
                position=(match_x, match_y),
                confidence=max_val,
                size=(template_w, template_h),
                center=(center_x, center_y),
            )

            duration = time.time() - start_time
            logger.info(
                f"Match found for {template_name} at {match_result.center} (confidence: {max_val:.3f})",
                extra={
                    "operation": "template_match",
                    "status": "success",
                    "duration": duration,
                    "template_name": template_name,
                    "confidence": max_val,
                    "position": match_result.center,
                },
            )
            return match_result

        except ElementNotFoundException:
            raise
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Template matching failed for {template_name}: {str(e)}",
                extra={
                    "operation": "template_match",
                    "status": "failed",
                    "duration": duration,
                    "template_name": template_name,
                    "error": str(e),
                },
            )
            raise ElementNotFoundException(f"Template matching failed: {str(e)}") from e

    def match_multiscale(
        self,
        screenshot: Image.Image,
        template_name: str,
        threshold: Optional[float] = None,
        scales: Optional[List[float]] = None,
    ) -> MatchResult:
        scales = scales or [0.8, 0.9, 1.0, 1.1, 1.2]
        best_result = None
        best_confidence = 0.0

        for scale in scales:
            try:
                scaled_template = self._scale_template(template_name, scale)
                if scaled_template is None:
                    continue
                result = self._match_with_template(screenshot, template_name, scaled_template, threshold)
                if result.confidence > best_confidence:
                    best_confidence = result.confidence
                    best_result = result
            except ElementNotFoundException:
                continue

        if best_result is None:
            raise ElementNotFoundException(f"No match found for {template_name} at any scale")

        return best_result

    def _scale_template(self, template_name: str, scale: float) -> Optional[np.ndarray]:
        if template_name not in self.templates:
            return None
        template = self.templates[template_name]
        new_width = int(template.shape[1] * scale)
        new_height = int(template.shape[0] * scale)
        if new_width < 10 or new_height < 10:
            return None
        return cv2.resize(template, (new_width, new_height), interpolation=cv2.INTER_AREA)

    def _match_with_template(
        self,
        screenshot: Image.Image,
        template_name: str,
        template: np.ndarray,
        threshold: float,
    ) -> MatchResult:
        screen_array = np.array(screenshot.convert("RGB"))
        screen_gray = cv2.cvtColor(screen_array, cv2.COLOR_RGB2GRAY)

        template_h, template_w = template.shape[:2]
        result = cv2.matchTemplate(screen_gray, template, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

        if max_val < threshold:
            raise ElementNotFoundException(
                f"No match found for {template_name} (confidence: {max_val:.3f})"
            )

        center_x = max_loc[0] + template_w // 2
        center_y = max_loc[1] + template_h // 2

        return MatchResult(
            template_name=template_name,
            position=(max_loc[0], max_loc[1]),
            confidence=max_val,
            size=(template_w, template_h),
            center=(center_x, center_y),
        )

    def find_all_matches(
        self,
        screenshot: Image.Image,
        template_name: str,
        threshold: Optional[float] = None,
        max_matches: int = 10,
    ) -> List[MatchResult]:
        threshold = threshold or self.threshold

        if template_name not in self.templates:
            raise ElementNotFoundException(f"Template not loaded: {template_name}")

        screen_array = np.array(screenshot.convert("RGB"))
        screen_gray = cv2.cvtColor(screen_array, cv2.COLOR_RGB2GRAY)

        template = self.templates[template_name]
        template_h, template_w = template.shape[:2]

        result = cv2.matchTemplate(screen_gray, template, cv2.TM_CCOEFF_NORMED)

        locations = np.where(result >= threshold)
        matches = []
        seen = set()

        for pt in zip(*locations[::-1]):
            if len(matches) >= max_matches:
                break
            key = (pt[0] // 10, pt[1] // 10)
            if key in seen:
                continue
            seen.add(key)

            confidence = result[pt[1], pt[0]]
            center_x = pt[0] + template_w // 2
            center_y = pt[1] + template_h // 2

            matches.append(MatchResult(
                template_name=template_name,
                position=(pt[0], pt[1]),
                confidence=float(confidence),
                size=(template_w, template_h),
                center=(center_x, center_y),
            ))

        matches.sort(key=lambda m: m.confidence, reverse=True)
        return matches

    @classmethod
    def from_yaml_config(cls, config: Dict) -> "TemplateMatcher":
        opencv_config = config.get("opencv", {})
        return cls(
            threshold=opencv_config.get("template_matching_threshold", 0.85),
            config=opencv_config,
        )


class ElementDetector:
    def __init__(
        self,
        template_matcher: TemplateMatcher,
        retry_config: Optional[RetryConfig] = None,
    ):
        self.template_matcher = template_matcher
        self.retry_config = retry_config or RetryConfig(
            max_attempts=3,
            base_delay=1.0,
            retry_on=["ElementNotFoundException"],
        )

    def detect(
        self,
        screenshot: Image.Image,
        template_name: str,
        threshold: Optional[float] = None,
        use_multiscale: bool = False,
    ) -> MatchResult:
        start_time = time.time()
        handler = RetryHandler(self.retry_config, f"detect_{template_name}")

        def try_detect():
            if use_multiscale:
                return self.template_matcher.match_multiscale(
                    screenshot, template_name, threshold
                )
            return self.template_matcher.match(screenshot, template_name, threshold)

        try:
            result = handler.execute(try_detect)
            duration = time.time() - start_time
            logger.info(
                f"Element {template_name} detected successfully",
                extra={
                    "operation": f"detect_{template_name}",
                    "status": "success",
                    "duration": duration,
                    "attempts": handler.attempts,
                    "result": result.to_dict(),
                },
            )
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to detect element {template_name} after {handler.attempts} attempts",
                extra={
                    "operation": f"detect_{template_name}",
                    "status": "failed",
                    "duration": duration,
                    "attempts": handler.attempts,
                    "error": str(e),
                },
            )
            raise ElementNotFoundException(f"Failed to detect {template_name}: {str(e)}") from e

    def detect_all(
        self,
        screenshot: Image.Image,
        template_names: List[str],
        threshold: Optional[float] = None,
    ) -> Dict[str, Optional[MatchResult]]:
        results = {}
        for name in template_names:
            try:
                results[name] = self.detect(screenshot, name, threshold)
            except ElementNotFoundException:
                results[name] = None
        return results

    def verify_element(
        self,
        screenshot: Image.Image,
        template_name: str,
        threshold: Optional[float] = None,
    ) -> bool:
        try:
            self.template_matcher.match(screenshot, template_name, threshold)
            return True
        except ElementNotFoundException:
            return False
