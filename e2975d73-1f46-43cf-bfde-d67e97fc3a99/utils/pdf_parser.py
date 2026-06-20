import os
import re
from io import StringIO
from typing import Optional, Dict, Any
from pdfminer.high_level import extract_text
from pdfminer.layout import LAParams
from pdfminer.pdfparser import PDFParser
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.converter import TextConverter
from config.settings import DOWNLOAD_DIR, OCR_ENABLED, OCR_LANG
from utils.logger import logger, log_error_with_context

try:
    from PIL import Image
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False


class PDFParser:
    def __init__(self, ocr_enabled: bool = OCR_ENABLED):
        self.ocr_enabled = ocr_enabled and OCR_AVAILABLE
        self.ocr_lang = OCR_LANG
        self.download_dir = DOWNLOAD_DIR

    def parse(self, file_path: str) -> Dict[str, Any]:
        result = {
            'success': False,
            'text': '',
            'metadata': {},
            'pages': 0,
            'ocr_used': False,
            'error': None
        }

        if not os.path.exists(file_path):
            result['error'] = f"File not found: {file_path}"
            logger.error(result['error'])
            return result

        try:
            metadata = self._extract_metadata(file_path)
            result['metadata'] = metadata
            result['pages'] = metadata.get('pages', 0)

            text = self._extract_text(file_path)

            if len(text.strip()) < 100 and self.ocr_enabled:
                logger.info(f"Text extraction returned little content, trying OCR for {file_path}")
                ocr_text = self._ocr_pdf(file_path)
                if ocr_text and len(ocr_text.strip()) > len(text.strip()):
                    text = ocr_text
                    result['ocr_used'] = True

            result['text'] = self._clean_text(text)
            result['success'] = True
            logger.info(f"Successfully parsed PDF: {file_path}, pages: {result['pages']}, length: {len(result['text'])}")

        except Exception as e:
            log_error_with_context(logger, e, f"Failed to parse PDF: {file_path}")
            result['error'] = str(e)

        return result

    def _extract_text(self, file_path: str) -> str:
        try:
            laparams = LAParams(
                line_margin=0.5,
                word_margin=0.1,
                char_margin=2.0,
                boxes_flow=0.5,
                detect_vertical=True,
                all_texts=True
            )
            text = extract_text(file_path, laparams=laparams)
            return text
        except Exception as e:
            log_error_with_context(logger, e, f"Text extraction failed for {file_path}")
            return self._extract_text_fallback(file_path)

    def _extract_text_fallback(self, file_path: str) -> str:
        try:
            output_string = StringIO()
            with open(file_path, 'rb') as f:
                parser = PDFParser(f)
                doc = PDFDocument(parser)
                rsrcmgr = PDFResourceManager()
                device = TextConverter(rsrcmgr, output_string, laparams=LAParams())
                interpreter = PDFPageInterpreter(rsrcmgr, device)
                for page in PDFPage.create_pages(doc):
                    interpreter.process_page(page)
                device.close()
                return output_string.getvalue()
        except Exception as e:
            log_error_with_context(logger, e, f"Fallback text extraction failed for {file_path}")
            return ''

    def _extract_metadata(self, file_path: str) -> Dict[str, Any]:
        metadata = {}
        try:
            with open(file_path, 'rb') as f:
                parser = PDFParser(f)
                doc = PDFDocument(parser)

                if doc.info:
                    info = doc.info[0]
                    for key, value in info.items():
                        try:
                            if isinstance(value, bytes):
                                metadata[key.decode('utf-8', errors='ignore')] = value.decode('utf-8', errors='ignore')
                            else:
                                metadata[key] = str(value)
                        except:
                            pass

                page_count = 0
                for _ in PDFPage.create_pages(doc):
                    page_count += 1
                metadata['pages'] = page_count

        except Exception as e:
            log_error_with_context(logger, e, f"Failed to extract metadata from {file_path}")
            metadata['pages'] = 0

        return metadata

    def _ocr_pdf(self, file_path: str) -> str:
        if not OCR_AVAILABLE:
            logger.warning("OCR libraries not available, skipping OCR")
            return ''

        try:
            logger.info(f"Starting OCR processing for {file_path}")
            all_text = []

            from pdf2image import convert_from_path
            images = convert_from_path(file_path, dpi=300)

            for i, image in enumerate(images):
                try:
                    text = pytesseract.image_to_string(image, lang=self.ocr_lang)
                    all_text.append(f"\n--- Page {i + 1} ---\n{text}")
                    logger.info(f"OCR page {i + 1}/{len(images)} completed")
                except Exception as e:
                    log_error_with_context(logger, e, f"OCR failed for page {i + 1}")

            return '\n'.join(all_text)

        except Exception as e:
            log_error_with_context(logger, e, f"OCR processing failed for {file_path}")
            return ''

    def _clean_text(self, text: str) -> str:
        if not text:
            return ''

        text = text.replace('\x00', '')
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'[^\x00-\x7F\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+', ' ', text)
        text = text.strip()

        return text

    def extract_title(self, text: str, fallback: str = '') -> str:
        if not text:
            return fallback

        lines = text.split('\n')
        for line in lines[:20]:
            line = line.strip()
            if 5 < len(line) < 100:
                if not re.match(r'^[0-9\s\.\-]+$', line):
                    return line

        return fallback

    def extract_keywords(self, text: str) -> list:
        if not text:
            return []

        keywords = []
        patterns = [
            r'主题词[：:]\s*(.+?)(?:\n|$)',
            r'关键词[：:]\s*(.+?)(?:\n|$)',
            r'关键字[：:]\s*(.+?)(?:\n|$)',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                raw = match.group(1)
                keywords.extend([k.strip() for k in re.split(r'[,，、;；\s]+', raw) if k.strip()])

        return list(set(keywords))


pdf_parser = PDFParser()


def parse_pdf(file_path: str) -> Dict[str, Any]:
    return pdf_parser.parse(file_path)
