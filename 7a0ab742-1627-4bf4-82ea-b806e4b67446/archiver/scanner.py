import os
import math
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum

try:
    from PIL import Image, ImageStat, ImageFilter
except ImportError:
    Image = None
    ImageStat = None
    ImageFilter = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None


class QualitySeverity(str, Enum):
    PASS = "pass"
    WARNING = "warning"
    FAIL = "fail"


@dataclass
class ImageQualityResult:
    file_path: str
    page: int = 1
    dpi: float = 0
    color_mode: str = ""
    width: int = 0
    height: int = 0
    file_size: int = 0
    tilt_degrees: float = 0
    blank_page: bool = False
    content_ratio: float = 0
    issues: List[Dict[str, Any]] = field(default_factory=list)
    overall: QualitySeverity = QualitySeverity.PASS

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "page": self.page,
            "dpi": self.dpi,
            "color_mode": self.color_mode,
            "width": self.width,
            "height": self.height,
            "file_size": self.file_size,
            "tilt_degrees": round(self.tilt_degrees, 2),
            "blank_page": self.blank_page,
            "content_ratio": round(self.content_ratio, 4),
            "issues": self.issues,
            "overall": self.overall.value,
        }


@dataclass
class ScannerConfig:
    min_dpi: int = 300
    max_tilt_degrees: float = 5.0
    blank_page_threshold: float = 0.05
    color_modes: List[str] = field(default_factory=lambda: ["1", "L", "RGB", "CMYK"])


class ImageQualityScanner:
    def __init__(self, config: Optional[ScannerConfig] = None, logger=None):
        self.config = config or ScannerConfig()
        self.logger = logger

    def scan_file(self, file_path: str) -> List[ImageQualityResult]:
        ext = Path(file_path).suffix.lower()

        if ext in [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".gif"]:
            return [self._scan_image_file(file_path)]
        elif ext == ".pdf":
            return self._scan_pdf_file(file_path)
        else:
            result = ImageQualityResult(
                file_path=file_path,
                overall=QualitySeverity.FAIL,
            )
            result.issues.append({
                "type": "unsupported_format",
                "message": f"不支持的文件格式: {ext}",
                "severity": "error",
            })
            return [result]

    def scan_directory(self, dir_path: str) -> List[ImageQualityResult]:
        results = []
        dir_path = Path(dir_path)

        image_extensions = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".gif", ".pdf"}

        for file_path in sorted(dir_path.rglob("*")):
            if file_path.is_file() and file_path.suffix.lower() in image_extensions:
                file_results = self.scan_file(str(file_path))
                results.extend(file_results)

        if self.logger:
            self.logger.info(
                f"扫描目录完成: {dir_path}, 共 {len(results)} 页",
                operation_type="scan_directory",
                obj=str(dir_path),
            )

        return results

    def _scan_image_file(self, file_path: str) -> ImageQualityResult:
        result = ImageQualityResult(file_path=file_path)

        if Image is None:
            result.overall = QualitySeverity.FAIL
            result.issues.append({
                "type": "missing_dependency",
                "message": "需要安装 Pillow 库进行图像质量检测",
                "severity": "error",
            })
            return result

        try:
            path = Path(file_path)
            result.file_size = path.stat().st_size

            with Image.open(file_path) as img:
                result.width, result.height = img.size
                result.color_mode = img.mode

                dpi = img.info.get("dpi", (0, 0))
                if dpi and dpi[0] > 0:
                    result.dpi = float(dpi[0])
                else:
                    result.dpi = self._estimate_dpi(img)

                self._check_dpi(result)
                self._check_color_mode(result)
                self._check_tilt(img, result)
                self._check_blank_page(img, result)

            self._determine_overall(result)

        except Exception as e:
            result.overall = QualitySeverity.FAIL
            result.issues.append({
                "type": "read_error",
                "message": f"无法读取图像文件: {str(e)}",
                "severity": "error",
            })

        if self.logger:
            self.logger.info(
                f"图像质检: {file_path}, 结果: {result.overall.value}",
                operation_type="scan_image",
                obj=file_path,
            )

        return result

    def _scan_pdf_file(self, file_path: str) -> List[ImageQualityResult]:
        results = []

        if pdfplumber is None:
            result = ImageQualityResult(
                file_path=file_path,
                overall=QualitySeverity.FAIL,
            )
            result.issues.append({
                "type": "missing_dependency",
                "message": "需要安装 pdfplumber 库进行PDF质量检测",
                "severity": "error",
            })
            return [result]

        try:
            path = Path(file_path)
            file_size = path.stat().st_size

            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    result = ImageQualityResult(
                        file_path=file_path,
                        page=i + 1,
                        file_size=file_size,
                    )

                    if page.width and page.height:
                        result.width = int(page.width * 2.83465)
                        result.height = int(page.height * 2.83465)

                    text = page.extract_text() or ""
                    if len(text.strip()) < 50:
                        result.blank_page = True
                        result.content_ratio = 0.0
                        result.issues.append({
                            "type": "blank_page",
                            "message": "页面内容过少，可能为空白页",
                            "severity": "warning",
                        })
                    else:
                        result.content_ratio = min(1.0, len(text) / 2000.0)

                    result.color_mode = "RGB"
                    result.dpi = 72

                    if result.dpi < self.config.min_dpi:
                        result.issues.append({
                            "type": "low_dpi",
                            "message": f"分辨率较低: {result.dpi} dpi (最低要求 {self.config.min_dpi} dpi)",
                            "severity": "warning",
                        })

                    self._determine_overall(result)
                    results.append(result)

        except Exception as e:
            result = ImageQualityResult(
                file_path=file_path,
                overall=QualitySeverity.FAIL,
            )
            result.issues.append({
                "type": "read_error",
                "message": f"无法读取PDF文件: {str(e)}",
                "severity": "error",
            })
            results.append(result)

        if self.logger:
            self.logger.info(
                f"PDF质检: {file_path}, 共 {len(results)} 页",
                operation_type="scan_pdf",
                obj=file_path,
            )

        return results

    def _estimate_dpi(self, img) -> float:
        width, height = img.size
        standard_a4_width_px = 2480
        standard_a4_height_px = 3508

        if width > height:
            width, height = height, width

        dpi_by_width = (width / standard_a4_width_px) * 300
        dpi_by_height = (height / standard_a4_height_px) * 300

        return max(72, (dpi_by_width + dpi_by_height) / 2)

    def _check_dpi(self, result: ImageQualityResult):
        if result.dpi < self.config.min_dpi:
            result.issues.append({
                "type": "low_dpi",
                "message": f"分辨率不足: {result.dpi:.0f} dpi (最低要求 {self.config.min_dpi} dpi)",
                "severity": "error",
            })

    def _check_color_mode(self, result: ImageQualityResult):
        color_names = {
            "1": "黑白",
            "L": "灰度",
            "P": "调色板",
            "RGB": "彩色",
            "RGBA": "彩色(透明)",
            "CMYK": "CMYK",
            "YCbCr": "YCbCr",
            "LAB": "LAB",
            "HSV": "HSV",
            "I": "32位整型",
            "F": "32位浮点",
        }
        result.color_mode = color_names.get(result.color_mode, result.color_mode)

    def _check_tilt(self, img, result: ImageQualityResult):
        try:
            gray_img = img.convert("L")
            edges = gray_img.filter(ImageFilter.FIND_EDGES)
            edge_pixels = edges.load()

            width, height = gray_img.size
            angles = []

            step = max(1, min(width, height) // 50)
            for y in range(0, height, step):
                edge_x = []
                for x in range(width):
                    if edge_pixels[x, y] > 128:
                        edge_x.append(x)
                if len(edge_x) >= 2:
                    angles.append(0)

            tilt = 0.0
            for angle in angles:
                if abs(angle) > abs(tilt):
                    tilt = angle

            result.tilt_degrees = abs(tilt)

            if result.tilt_degrees > self.config.max_tilt_degrees:
                result.issues.append({
                    "type": "tilt",
                    "message": f"图像倾斜度过大: {result.tilt_degrees:.2f}° (阈值 {self.config.max_tilt_degrees}°)",
                    "severity": "warning",
                })

        except Exception:
            result.tilt_degrees = 0.0

    def _check_blank_page(self, img, result: ImageQualityResult):
        try:
            gray_img = img.convert("L")
            stat = ImageStat.Stat(gray_img)
            mean_brightness = stat.mean[0]

            threshold = 240
            total_pixels = gray_img.size[0] * gray_img.size[1]
            white_pixels = 0

            histogram = gray_img.histogram()
            for i in range(threshold, 256):
                if i < len(histogram):
                    white_pixels += histogram[i]

            content_ratio = 1.0 - (white_pixels / total_pixels) if total_pixels > 0 else 0
            result.content_ratio = content_ratio

            if content_ratio < self.config.blank_page_threshold:
                result.blank_page = True
                result.issues.append({
                    "type": "blank_page",
                    "message": f"可能为空白页，内容占比: {content_ratio*100:.2f}% (阈值 {self.config.blank_page_threshold*100}%)",
                    "severity": "warning",
                })

        except Exception:
            result.content_ratio = 0
            result.blank_page = False

    def _determine_overall(self, result: ImageQualityResult):
        has_error = any(issue.get("severity") == "error" for issue in result.issues)
        has_warning = any(issue.get("severity") == "warning" for issue in result.issues)

        if has_error:
            result.overall = QualitySeverity.FAIL
        elif has_warning:
            result.overall = QualitySeverity.WARNING
        else:
            result.overall = QualitySeverity.PASS

    def get_summary(self, results: List[ImageQualityResult]) -> Dict[str, Any]:
        total = len(results)
        passed = len([r for r in results if r.overall == QualitySeverity.PASS])
        warnings = len([r for r in results if r.overall == QualitySeverity.WARNING])
        failed = len([r for r in results if r.overall == QualitySeverity.FAIL])

        avg_dpi = sum(r.dpi for r in results) / total if total > 0 else 0
        blank_pages = sum(1 for r in results if r.blank_page)

        issue_types = {}
        for result in results:
            for issue in result.issues:
                issue_type = issue.get("type", "unknown")
                issue_types[issue_type] = issue_types.get(issue_type, 0) + 1

        return {
            "total_pages": total,
            "passed": passed,
            "warnings": warnings,
            "failed": failed,
            "pass_rate": round(passed / total * 100, 2) if total > 0 else 0,
            "average_dpi": round(avg_dpi, 2),
            "blank_pages": blank_pages,
            "issue_types": issue_types,
        }
