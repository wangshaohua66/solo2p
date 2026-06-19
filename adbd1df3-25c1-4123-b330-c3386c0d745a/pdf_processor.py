import os
import io
import time
import logging
from typing import Optional, List, Tuple, Dict, Any
from PIL import Image

try:
    import fitz
except ImportError:
    fitz = None

from retry_handler import RetryConfig, RetryHandler


logger = logging.getLogger(__name__)


class PDFProcessingError(Exception):
    pass


class PDFInfo:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.page_count: int = 0
        self.page_width: float = 0.0
        self.page_height: float = 0.0
        self.has_text: bool = False
        self.text_chars: int = 0
        self.file_size: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "page_count": self.page_count,
            "page_width": self.page_width,
            "page_height": self.page_height,
            "has_text": self.has_text,
            "text_chars": self.text_chars,
            "file_size": self.file_size,
        }


class PDFPage:
    def __init__(self, page_number: int, image: Image.Image, text: str = ""):
        self.page_number = page_number
        self.image = image
        self.text = text
        self.width = image.width
        self.height = image.height

    def __repr__(self) -> str:
        return f"PDFPage(page={self.page_number}, size={self.width}x{self.height}, text_len={len(self.text)})"


class PDFProcessor:
    def __init__(self, config: Optional[Dict] = None, retry_config: Optional[RetryConfig] = None):
        if fitz is None:
            raise ImportError("PyMuPDF (fitz) is required for PDFProcessor. Install with: pip install PyMuPDF")

        self.config = config or {}
        pdf_config = self.config.get("pdf_processing", {})

        self.dpi = pdf_config.get("dpi", 300)
        self.image_format = pdf_config.get("image_format", "PNG")
        self.zoom_factor = pdf_config.get("zoom_factor", 2.0)
        self.extract_text = pdf_config.get("extract_text", True)
        self.max_pages = pdf_config.get("max_pages", 10)
        self.prefer_text_layer = pdf_config.get("prefer_text_layer", True)
        self.rotation = pdf_config.get("rotation", 0)
        self.color_mode = pdf_config.get("color_mode", "rgb")

        self.retry_config = retry_config or RetryConfig(
            max_attempts=3,
            base_delay=1.0,
            retry_on=["PDFProcessingError"],
        )

    def get_info(self, pdf_path: str) -> PDFInfo:
        start_time = time.time()
        handler = RetryHandler(self.retry_config, "pdf_get_info")

        def try_get_info():
            return self._get_info_internal(pdf_path)

        try:
            result = handler.execute(try_get_info)
            result.file_size = os.path.getsize(pdf_path)
            duration = time.time() - start_time
            logger.info(
                f"PDF info retrieved: {os.path.basename(pdf_path)} ({result.page_count} pages)",
                extra={
                    "operation": "pdf_get_info",
                    "status": "success",
                    "duration": duration,
                    "page_count": result.page_count,
                    "has_text": result.has_text,
                    "file_size": result.file_size,
                },
            )
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to get PDF info for {pdf_path}: {str(e)}",
                extra={
                    "operation": "pdf_get_info",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise PDFProcessingError(f"Failed to get PDF info: {str(e)}") from e

    def _get_info_internal(self, pdf_path: str) -> PDFInfo:
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        info = PDFInfo(pdf_path)

        try:
            doc = fitz.open(pdf_path)
            info.page_count = len(doc)

            if info.page_count > 0:
                page = doc[0]
                rect = page.rect
                info.page_width = rect.width
                info.page_height = rect.height

                if self.extract_text:
                    text = page.get_text()
                    info.text_chars = len(text.strip())
                    info.has_text = info.text_chars > 50

            doc.close()
            return info
        except Exception as e:
            raise PDFProcessingError(f"Failed to read PDF: {str(e)}") from e

    def render_page(
        self,
        pdf_path: str,
        page_number: int = 0,
        dpi: Optional[int] = None,
        zoom: Optional[float] = None,
    ) -> Image.Image:
        start_time = time.time()
        dpi = dpi or self.dpi
        zoom = zoom or self.zoom_factor

        def try_render():
            return self._render_page_internal(pdf_path, page_number, dpi, zoom)

        handler = RetryHandler(self.retry_config, f"pdf_render_page_{page_number}")

        try:
            result = handler.execute(try_render)
            duration = time.time() - start_time
            logger.info(
                f"PDF page {page_number} rendered: {result.width}x{result.height}",
                extra={
                    "operation": "pdf_render_page",
                    "status": "success",
                    "duration": duration,
                    "page": page_number,
                    "size": (result.width, result.height),
                    "dpi": dpi,
                },
            )
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to render PDF page {page_number}: {str(e)}",
                extra={
                    "operation": "pdf_render_page",
                    "status": "failed",
                    "duration": duration,
                    "page": page_number,
                    "error": str(e),
                },
            )
            raise PDFProcessingError(f"Failed to render page {page_number}: {str(e)}") from e

    def _render_page_internal(
        self,
        pdf_path: str,
        page_number: int,
        dpi: int,
        zoom: float,
    ) -> Image.Image:
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        try:
            doc = fitz.open(pdf_path)

            if page_number < 0 or page_number >= len(doc):
                raise ValueError(f"Page number {page_number} out of range (0-{len(doc)-1})")

            page = doc[page_number]

            if self.rotation:
                page.set_rotation(self.rotation)

            zoom_matrix = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=zoom_matrix, alpha=False)

            if self.color_mode == "grayscale":
                pix = fitz.Pixmap(fitz.csGRAY, pix)

            img_data = pix.tobytes(self.image_format)
            image = Image.open(io.BytesIO(img_data))
            image.load()

            pix = None
            doc.close()

            return image
        except Exception as e:
            raise PDFProcessingError(f"Failed to render PDF page: {str(e)}") from e

    def render_all_pages(
        self,
        pdf_path: str,
        max_pages: Optional[int] = None,
    ) -> List[Image.Image]:
        start_time = time.time()
        max_pages = max_pages or self.max_pages

        info = self.get_info(pdf_path)
        num_pages = min(info.page_count, max_pages)

        images = []
        for i in range(num_pages):
            try:
                img = self.render_page(pdf_path, i)
                images.append(img)
            except Exception as e:
                logger.warning(
                    f"Failed to render page {i}, skipping: {str(e)}",
                    extra={
                        "operation": "pdf_render_all",
                        "status": "warning",
                        "duration": 0.0,
                        "page": i,
                        "error": str(e),
                    },
                )

        duration = time.time() - start_time
        logger.info(
            f"Rendered {len(images)}/{info.page_count} pages from {os.path.basename(pdf_path)}",
            extra={
                "operation": "pdf_render_all",
                "status": "success",
                "duration": duration,
                "rendered_count": len(images),
                "total_pages": info.page_count,
            },
        )

        return images

    def extract_text_page(self, pdf_path: str, page_number: int = 0) -> str:
        start_time = time.time()

        def try_extract():
            return self._extract_text_internal(pdf_path, page_number)

        handler = RetryHandler(self.retry_config, f"pdf_extract_text_{page_number}")

        try:
            result = handler.execute(try_extract)
            duration = time.time() - start_time
            logger.info(
                f"Extracted {len(result)} chars from page {page_number}",
                extra={
                    "operation": "pdf_extract_text",
                    "status": "success",
                    "duration": duration,
                    "page": page_number,
                    "char_count": len(result),
                },
            )
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to extract text from page {page_number}: {str(e)}",
                extra={
                    "operation": "pdf_extract_text",
                    "status": "failed",
                    "duration": duration,
                    "page": page_number,
                    "error": str(e),
                },
            )
            raise PDFProcessingError(f"Failed to extract text: {str(e)}") from e

    def _extract_text_internal(self, pdf_path: str, page_number: int) -> str:
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        try:
            doc = fitz.open(pdf_path)

            if page_number < 0 or page_number >= len(doc):
                raise ValueError(f"Page number {page_number} out of range")

            page = doc[page_number]
            text = page.get_text()

            doc.close()
            return text.strip()
        except Exception as e:
            raise PDFProcessingError(f"Failed to extract text: {str(e)}") from e

    def extract_all_text(self, pdf_path: str, max_pages: Optional[int] = None) -> str:
        start_time = time.time()
        max_pages = max_pages or self.max_pages

        info = self.get_info(pdf_path)
        num_pages = min(info.page_count, max_pages)

        all_text = []
        for i in range(num_pages):
            try:
                text = self.extract_text_page(pdf_path, i)
                if text:
                    all_text.append(f"--- Page {i + 1} ---\n{text}")
            except Exception as e:
                logger.warning(
                    f"Failed to extract text from page {i}: {str(e)}",
                    extra={
                        "operation": "pdf_extract_all_text",
                        "status": "warning",
                        "duration": 0.0,
                        "page": i,
                        "error": str(e),
                    },
                )

        result = "\n\n".join(all_text)
        duration = time.time() - start_time

        logger.info(
            f"Extracted {len(result)} chars from {num_pages} pages",
            extra={
                "operation": "pdf_extract_all_text",
                "status": "success",
                "duration": duration,
                "pages": num_pages,
                "char_count": len(result),
            },
        )

        return result

    def get_page_with_text(
        self,
        pdf_path: str,
        page_number: int = 0,
    ) -> PDFPage:
        start_time = time.time()

        image = self.render_page(pdf_path, page_number)

        text = ""
        if self.extract_text:
            try:
                text = self.extract_text_page(pdf_path, page_number)
            except Exception:
                text = ""

        page = PDFPage(page_number, image, text)
        duration = time.time() - start_time

        logger.debug(
            f"Page {page_number} processed with text: {len(text) > 0}",
            extra={
                "operation": "pdf_get_page_with_text",
                "status": "success",
                "duration": duration,
                "page": page_number,
                "has_text": len(text) > 0,
            },
        )

        return page

    def get_all_pages_with_text(
        self,
        pdf_path: str,
        max_pages: Optional[int] = None,
    ) -> List[PDFPage]:
        start_time = time.time()
        max_pages = max_pages or self.max_pages

        info = self.get_info(pdf_path)
        num_pages = min(info.page_count, max_pages)

        pages = []
        for i in range(num_pages):
            try:
                page = self.get_page_with_text(pdf_path, i)
                pages.append(page)
            except Exception as e:
                logger.warning(
                    f"Failed to process page {i}: {str(e)}",
                    extra={
                        "operation": "pdf_get_all_pages",
                        "status": "warning",
                        "duration": 0.0,
                        "page": i,
                        "error": str(e),
                    },
                )

        duration = time.time() - start_time
        logger.info(
            f"Processed {len(pages)}/{num_pages} pages with text",
            extra={
                "operation": "pdf_get_all_pages",
                "status": "success",
                "duration": duration,
                "processed_count": len(pages),
                "total_pages": num_pages,
            },
        )

        return pages

    def is_searchable_pdf(self, pdf_path: str, threshold: int = 50) -> bool:
        info = self.get_info(pdf_path)
        return info.has_text and info.text_chars > threshold

    def get_best_text_source(
        self,
        pdf_path: str,
        page_number: int = 0,
    ) -> Tuple[str, str]:
        """
        获取最佳文本来源。
        如果PDF有文本层，优先使用文本层；否则返回空字符串，需要OCR。

        Returns:
            (text, source): 文本内容和来源类型 ("text_layer" | "needs_ocr")
        """
        if self.prefer_text_layer and self.extract_text:
            try:
                text = self.extract_text_page(pdf_path, page_number)
                if len(text.strip()) > 50:
                    return text, "text_layer"
            except Exception as e:
                logger.debug(
                    f"Text layer extraction failed, will use OCR: {str(e)}",
                    extra={
                        "operation": "pdf_best_text_source",
                        "status": "fallback_ocr",
                        "duration": 0.0,
                        "error": str(e),
                    },
                )

        return "", "needs_ocr"

    def convert_to_images(
        self,
        pdf_path: str,
        output_dir: str,
        max_pages: Optional[int] = None,
        prefix: str = "page_",
    ) -> List[str]:
        start_time = time.time()
        max_pages = max_pages or self.max_pages

        os.makedirs(output_dir, exist_ok=True)

        info = self.get_info(pdf_path)
        num_pages = min(info.page_count, max_pages)

        output_paths = []
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]

        for i in range(num_pages):
            try:
                image = self.render_page(pdf_path, i)
                output_path = os.path.join(
                    output_dir,
                    f"{base_name}_{prefix}{i + 1:03d}.{self.image_format.lower()}",
                )
                image.save(output_path, self.image_format)
                output_paths.append(output_path)
            except Exception as e:
                logger.warning(
                    f"Failed to convert page {i}: {str(e)}",
                    extra={
                        "operation": "pdf_convert_images",
                        "status": "warning",
                        "duration": 0.0,
                        "page": i,
                        "error": str(e),
                    },
                )

        duration = time.time() - start_time
        logger.info(
            f"Converted {len(output_paths)}/{num_pages} pages to images in {output_dir}",
            extra={
                "operation": "pdf_convert_images",
                "status": "success",
                "duration": duration,
                "converted_count": len(output_paths),
                "output_dir": output_dir,
            },
        )

        return output_paths

    @classmethod
    def from_yaml_config(cls, config: Dict) -> "PDFProcessor":
        retry_config = RetryConfig.from_yaml_config(config.get("retry", {}))
        return cls(config=config, retry_config=retry_config)


class PDFInvoiceExtractor:
    def __init__(self, pdf_processor: PDFProcessor):
        self.pdf_processor = pdf_processor

    def extract_invoice_data(
        self,
        pdf_path: str,
    ) -> Dict[str, Any]:
        start_time = time.time()
        logger.info(
            f"Extracting invoice data from PDF: {os.path.basename(pdf_path)}",
            extra={
                "operation": "pdf_extract_invoice",
                "status": "start",
                "duration": 0.0,
                "file": pdf_path,
            },
        )

        result = {
            "file_path": pdf_path,
            "source": "pdf",
            "text_source": "unknown",
            "pages": [],
            "images": [],
            "full_text": "",
        }

        try:
            info = self.pdf_processor.get_info(pdf_path)
            result["page_count"] = info.page_count
            result["is_searchable"] = info.has_text

            pages = self.pdf_processor.get_all_pages_with_text(pdf_path)
            result["pages"] = [
                {
                    "page_number": p.page_number,
                    "width": p.width,
                    "height": p.height,
                    "text_length": len(p.text),
                }
                for p in pages
            ]

            all_text_parts = []
            all_images = []

            for page in pages:
                text, source = self.pdf_processor.get_best_text_source(
                    pdf_path, page.page_number
                )
                if text:
                    all_text_parts.append(text)
                else:
                    all_images.append(page.image)

            result["full_text"] = "\n\n".join(all_text_parts)
            result["images"] = all_images
            result["text_source"] = "text_layer" if all_text_parts else "ocr_needed"
            result["text_page_count"] = len(all_text_parts)
            result["ocr_page_count"] = len(all_images)

            duration = time.time() - start_time
            logger.info(
                f"Invoice data extracted: {result['text_source']}",
                extra={
                    "operation": "pdf_extract_invoice",
                    "status": "success",
                    "duration": duration,
                    "text_source": result["text_source"],
                    "text_pages": result["text_page_count"],
                    "ocr_pages": result["ocr_page_count"],
                },
            )

            return result

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to extract invoice data: {str(e)}",
                extra={
                    "operation": "pdf_extract_invoice",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise
