import scrapy
import os
import re
from urllib.parse import urlparse, urljoin
from datetime import datetime
from scrapy.http import Request
from items.policy_item import AttachmentItem
from config.settings import DOWNLOAD_DIR, OCR_ENABLED
from utils.logger import logger, log_error_with_context
from utils.pdf_parser import pdf_parser
from utils.docx_parser import docx_parser
from utils.db import db


class AttachmentSpider(scrapy.Spider):
    name = 'attachment_spider'
    custom_settings = {
        'DOWNLOAD_DELAY': 3,
        'RANDOMIZE_DOWNLOAD_DELAY': True,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 2,
        'DOWNLOAD_MAXSIZE': 50 * 1024 * 1024,
    }

    def __init__(self, policy_urls=None, attachment_urls=None, 
                 parse_documents=True, ocr_enabled=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.policy_urls = self._parse_urls(policy_urls)
        self.attachment_urls = self._parse_urls(attachment_urls)
        self.parse_documents = parse_documents
        self.ocr_enabled = ocr_enabled if ocr_enabled is not None else OCR_ENABLED
        self.stats = {
            'total_attachments': 0,
            'downloaded': 0,
            'parsed': 0,
            'failed': 0,
            'pdf_count': 0,
            'docx_count': 0,
            'ocr_count': 0,
        }

    def _parse_urls(self, urls_param):
        if not urls_param:
            return []
        if isinstance(urls_param, str):
            return [u.strip() for u in urls_param.split(',') if u.strip()]
        return urls_param

    def start_requests(self):
        logger.info(f"Starting attachment spider with OCR enabled: {self.ocr_enabled}")

        urls_to_process = []

        if self.policy_urls:
            for policy_url in self.policy_urls:
                policy = db.get_policy_by_url(policy_url)
                if policy:
                    attachments = policy.get('attachments', [])
                    for att in attachments:
                        if att.get('url') and not att.get('parsed'):
                            urls_to_process.append((att['url'], policy_url))

        if self.attachment_urls:
            for url in self.attachment_urls:
                urls_to_process.append((url, None))

        if not urls_to_process:
            logger.info("No attachments to process")
            return

        self.stats['total_attachments'] = len(urls_to_process)
        logger.info(f"Found {len(urls_to_process)} attachments to process")

        for url, policy_url in urls_to_process:
            yield Request(
                url,
                callback=self.parse_attachment,
                meta={
                    'policy_url': policy_url,
                    'original_url': url,
                },
                errback=self.errback_handler,
                dont_filter=True
            )

    def parse_attachment(self, response):
        url = response.meta.get('original_url', response.url)
        policy_url = response.meta.get('policy_url')

        try:
            content_type = response.headers.get('Content-Type', b'').decode('utf-8', errors='ignore')
            content_disposition = response.headers.get('Content-Disposition', b'').decode('utf-8', errors='ignore')

            filename = self._extract_filename(response, url, content_disposition)
            file_type = self._detect_file_type(filename, content_type)

            logger.info(f"Processing attachment: {filename} ({file_type})")
            logger.info(f"Content-Type: {content_type}, Size: {len(response.body)} bytes")

            if file_type not in ['pdf', 'doc', 'docx']:
                logger.warning(f"Unsupported file type: {file_type} for {url}")
                return

            file_path = self._save_attachment(response, filename, file_type)

            attachment_item = AttachmentItem()
            attachment_item['policy_url'] = policy_url
            attachment_item['url'] = url
            attachment_item['filename'] = filename
            attachment_item['file_type'] = file_type
            attachment_item['file_path'] = file_path
            attachment_item['downloaded'] = True
            attachment_item['parsed'] = False

            self.stats['downloaded'] += 1

            if self.parse_documents:
                parse_result = self._parse_document(file_path, file_type)
                attachment_item['content_text'] = parse_result.get('text', '')
                attachment_item['ocr_result'] = parse_result.get('ocr_used', False)
                attachment_item['parsed'] = parse_result.get('success', False)
                attachment_item['error'] = parse_result.get('error')

                if parse_result.get('success'):
                    self.stats['parsed'] += 1
                    if file_type == 'pdf':
                        self.stats['pdf_count'] += 1
                    elif file_type in ['doc', 'docx']:
                        self.stats['docx_count'] += 1
                    if parse_result.get('ocr_used'):
                        self.stats['ocr_count'] += 1

                    if policy_url:
                        self._update_policy_with_attachment(policy_url, attachment_item)

                elif parse_result.get('error'):
                    self.stats['failed'] += 1
                    logger.error(f"Failed to parse {filename}: {parse_result['error']}")

            yield attachment_item

        except Exception as e:
            log_error_with_context(logger, e, f"Error processing attachment: {url}")
            self.stats['failed'] += 1

    def _extract_filename(self, response, url, content_disposition):
        filename = None

        if content_disposition:
            match = re.search(r'filename[*]?=["\']?([^"\';]+)["\']?', content_disposition, re.IGNORECASE)
            if match:
                filename = match.group(1)
                if 'UTF-8' in filename.upper():
                    filename = filename.replace("UTF-8''", '')
                filename = filename.strip()

        if not filename:
            parsed = urlparse(url)
            filename = os.path.basename(parsed.path)

        if not filename or '.' not in filename:
            ext = self._get_extension_from_content_type(
                response.headers.get('Content-Type', b'').decode('utf-8', errors='ignore')
            )
            filename = f"attachment_{datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"

        filename = re.sub(r'[^\w\-\.\u4e00-\u9fff]', '_', filename)
        return filename

    def _detect_file_type(self, filename, content_type):
        ext = os.path.splitext(filename)[1].lower()

        if ext == '.pdf' or 'pdf' in content_type.lower():
            return 'pdf'
        elif ext == '.docx' or 'msword' in content_type.lower() or 'officedocument' in content_type.lower():
            if ext == '.doc':
                return 'doc'
            return 'docx'
        elif ext == '.doc':
            return 'doc'

        return 'other'

    def _get_extension_from_content_type(self, content_type):
        content_type = content_type.lower()
        if 'pdf' in content_type:
            return '.pdf'
        elif 'msword' in content_type or 'officedocument.wordprocessingml' in content_type:
            return '.docx'
        else:
            return '.bin'

    def _save_attachment(self, response, filename, file_type):
        type_dir = os.path.join(DOWNLOAD_DIR, file_type)
        os.makedirs(type_dir, exist_ok=True)

        base, ext = os.path.splitext(filename)
        if not ext:
            ext = f'.{file_type}' if file_type != 'other' else '.bin'

        safe_filename = f"{base}_{datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"
        file_path = os.path.join(type_dir, safe_filename)

        with open(file_path, 'wb') as f:
            f.write(response.body)

        logger.info(f"Saved attachment to: {file_path}")
        return file_path

    def _parse_document(self, file_path, file_type):
        result = {'success': False, 'text': '', 'ocr_used': False, 'error': None}

        try:
            if not os.path.exists(file_path):
                result['error'] = f"File not found: {file_path}"
                return result

            if file_type == 'pdf':
                parser = pdf_parser
                if self.ocr_enabled:
                    parser.ocr_enabled = True
                parse_result = parser.parse(file_path)
                result['success'] = parse_result['success']
                result['text'] = parse_result['text']
                result['ocr_used'] = parse_result.get('ocr_used', False)
                if not parse_result['success']:
                    result['error'] = parse_result.get('error', 'Unknown PDF parsing error')

            elif file_type in ['doc', 'docx']:
                parse_result = docx_parser.parse(file_path)
                result['success'] = parse_result['success']
                result['text'] = parse_result['text']
                if not parse_result['success']:
                    result['error'] = parse_result.get('error', 'Unknown DOCX parsing error')

            else:
                result['error'] = f"Unsupported file type for parsing: {file_type}"

        except Exception as e:
            log_error_with_context(logger, e, f"Error parsing document: {file_path}")
            result['error'] = str(e)

        return result

    def _update_policy_with_attachment(self, policy_url, attachment_item):
        try:
            policy = db.get_policy_by_url(policy_url)
            if not policy:
                logger.warning(f"Policy not found for URL: {policy_url}")
                return

            attachments = policy.get('attachments', [])
            updated = False

            for i, att in enumerate(attachments):
                if att.get('url') == attachment_item['url']:
                    attachments[i] = {
                        **att,
                        'content_text': attachment_item.get('content_text', ''),
                        'ocr_result': attachment_item.get('ocr_result', False),
                        'parsed': attachment_item.get('parsed', False),
                        'error': attachment_item.get('error'),
                        'file_path': attachment_item.get('file_path', ''),
                    }
                    updated = True
                    break

            if not updated:
                attachments.append({
                    'url': attachment_item['url'],
                    'filename': attachment_item['filename'],
                    'file_type': attachment_item['file_type'],
                    'file_path': attachment_item.get('file_path', ''),
                    'content_text': attachment_item.get('content_text', ''),
                    'ocr_result': attachment_item.get('ocr_result', False),
                    'parsed': attachment_item.get('parsed', False),
                    'downloaded': attachment_item.get('downloaded', True),
                    'error': attachment_item.get('error'),
                })

            policy['attachments'] = attachments

            if attachment_item.get('content_text'):
                policy['content'] = (policy.get('content', '') + '\n\n' + 
                                    attachment_item['content_text']).strip()

            db.insert_policy(policy)
            logger.info(f"Updated policy {policy_url} with attachment content")

        except Exception as e:
            log_error_with_context(logger, e, f"Error updating policy with attachment: {policy_url}")

    def errback_handler(self, failure):
        request = failure.request
        url = request.meta.get('original_url', request.url)
        self.stats['failed'] += 1

        logger.error(f"Failed to download attachment: {url}")
        logger.error(f"Error: {failure.value}")

        retry_count = request.meta.get('retry_count', 0)
        if retry_count < 2:
            new_request = request.copy()
            new_request.meta['retry_count'] = retry_count + 1
            new_request.dont_filter = True
            logger.info(f"Retrying attachment download {url} (attempt {retry_count + 2}/2)")
            return new_request

    def close(self, reason):
        logger.info("=" * 60)
        logger.info("ATTACHMENT PROCESSING STATISTICS")
        logger.info("=" * 60)
        for key, value in self.stats.items():
            logger.info(f"{key:25s}: {value}")
        logger.info("=" * 60)
        success_rate = (self.stats['parsed'] / self.stats['total_attachments'] * 100 
                       if self.stats['total_attachments'] > 0 else 0)
        logger.info(f"Success rate: {success_rate:.1f}%")
        logger.info(f"Processing completed with reason: {reason}")
