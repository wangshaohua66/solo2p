import os
import hashlib
import json
from datetime import datetime
from loguru import logger

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("Pillow not available, screenshot functionality disabled")


class ForensicsManager:
    def __init__(self, screenshot_dir=None, html_dir=None):
        self.screenshot_dir = screenshot_dir or os.path.join("data", "screenshots")
        self.html_dir = html_dir or os.path.join("data", "html_archive")
        os.makedirs(self.screenshot_dir, exist_ok=True)
        os.makedirs(self.html_dir, exist_ok=True)
        self.forensics_log = []

    def capture_screenshot(self, url, html_content, work_id, platform_key):
        if not PIL_AVAILABLE:
            logger.warning(f"Pillow not available, skipping screenshot for {url}")
            return None, None

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = self._safe_filename(work_id, platform_key, timestamp)
        screenshot_path = os.path.join(self.screenshot_dir, f"{safe_name}.png")

        try:
            img = self._render_html_to_image(html_content, url)
            if img:
                draw = ImageDraw.Draw(img)
                try:
                    font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 16)
                except (OSError, IOError):
                    try:
                        font = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 16)
                    except (OSError, IOError):
                        font = ImageFont.load_default()

                watermark_text = f"取证时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | URL: {url[:80]}"
                draw.rectangle([(0, 0), (img.width, 30)], fill=(0, 0, 0, 180))
                draw.text((10, 5), watermark_text, fill=(255, 255, 255), font=font)

                img.save(screenshot_path, "PNG", quality=95)
                logger.debug(f"Screenshot saved: {screenshot_path}")
            else:
                self._create_placeholder_screenshot(screenshot_path, url, work_id)
        except Exception as e:
            logger.error(f"Screenshot capture failed for {url}: {e}")
            self._create_placeholder_screenshot(screenshot_path, url, work_id)

        return screenshot_path

    def archive_html(self, url, html_content, response_headers, work_id, platform_key):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = self._safe_filename(work_id, platform_key, timestamp)
        html_path = os.path.join(self.html_dir, f"{safe_name}.html")

        try:
            header_str = ""
            if response_headers:
                try:
                    headers = json.loads(response_headers) if isinstance(response_headers, str) else response_headers
                    header_str = "\n".join(f"{k}: {v}" for k, v in headers.items())
                except Exception:
                    header_str = str(response_headers)[:2000]

            archive_html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Archived: {url}</title></head>
<body>
<!--
FORENSICS METADATA
URL: {url}
Archived: {datetime.now().isoformat()}
WorkID: {work_id}
Platform: {platform_key}
Response Headers:
{header_str}
-->
<hr>
<div style="background:#f0f0f0;padding:5px;font-size:12px;">
<strong>Archived from:</strong> {url}<br>
<strong>Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br>
<strong>Work ID:</strong> {work_id}
</div>
<hr>
{html_content if html_content else '<p>Content not available</p>'}
</body></html>"""

            with open(html_path, "w", encoding="utf-8") as f:
                f.write(archive_html)

            logger.debug(f"HTML archived: {html_path}")
            return html_path
        except Exception as e:
            logger.error(f"HTML archive failed for {url}: {e}")
            return None

    def compute_hash(self, file_path):
        if not file_path or not os.path.exists(file_path):
            return None
        sha256 = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    sha256.update(chunk)
            return sha256.hexdigest()
        except Exception as e:
            logger.error(f"Hash computation failed for {file_path}: {e}")
            return None

    def compute_text_hash(self, text):
        if not text:
            return None
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def perform_forensics(self, work_id, platform_key, result_url, html_content, response_headers):
        screenshot_path = self.capture_screenshot(result_url, html_content, work_id, platform_key)
        html_path = self.archive_html(result_url, html_content, response_headers, work_id, platform_key)

        sha256_hash = self.compute_hash(screenshot_path) if screenshot_path else None
        html_sha256 = self.compute_hash(html_path) if html_path else None

        if not sha256_hash and html_content:
            sha256_hash = self.compute_text_hash(html_content)

        forensics_time = datetime.now().isoformat()
        forensics_status = "completed" if (screenshot_path or html_path) else "partial"

        record = {
            "work_id": work_id,
            "platform_key": platform_key,
            "result_url": result_url,
            "screenshot_path": screenshot_path or "",
            "html_archive_path": html_path or "",
            "sha256_hash": sha256_hash or "",
            "html_sha256": html_sha256 or "",
            "forensics_time": forensics_time,
            "forensics_status": forensics_status,
        }
        self.forensics_log.append(record)

        return record

    def _render_html_to_image(self, html_content, url):
        width = 1280
        height = 800
        img = Image.new("RGB", (width, height), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 14)
        except (OSError, IOError):
            font = ImageFont.load_default()

        y = 50
        draw.text((20, y), f"URL: {url}", fill=(0, 0, 200), font=font)
        y += 30
        draw.line([(0, y), (width, y)], fill=(200, 200, 200))
        y += 10

        text = html_content or ""
        import re
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()

        chars_per_line = 60
        max_lines = (height - y - 20) // 20

        for i in range(min(max_lines, len(text) // chars_per_line + 1)):
            line = text[i * chars_per_line:(i + 1) * chars_per_line]
            if not line:
                break
            draw.text((20, y), line, fill=(0, 0, 0), font=font)
            y += 20

        return img

    def _create_placeholder_screenshot(self, path, url, work_id):
        try:
            img = Image.new("RGB", (800, 400), color=(240, 240, 240))
            draw = ImageDraw.Draw(img)
            draw.text((20, 20), f"Screenshot Placeholder", fill=(100, 100, 100))
            draw.text((20, 50), f"URL: {url[:60]}", fill=(0, 0, 200))
            draw.text((20, 80), f"Work: {work_id}", fill=(0, 0, 0))
            draw.text((20, 110), f"Time: {datetime.now().isoformat()}", fill=(100, 100, 100))
            img.save(path, "PNG")
        except Exception as e:
            logger.error(f"Placeholder screenshot creation failed: {e}")

    @staticmethod
    def _safe_filename(work_id, platform_key, timestamp):
        name = f"{work_id}_{platform_key}_{timestamp}"
        return re.sub(r"[^\w\-.]", "_", name) if "re" in dir() else name


import re
