import logging
import os
from io import BytesIO
from pathlib import Path
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _hex_to_rgb(hex_color: str) -> tuple:
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join(c * 2 for c in hex_color)
    return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))


def add_image_watermark(image_path: str, text: str, opacity: float = 0.3,
                        position: str = 'diagonal', font_size: int = 36,
                        color: str = '#888888') -> str:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as e:
        logger.error(f'[Watermark] Pillow未安装: {e}')
        raise RuntimeError('Pillow未安装') from e

    rgb_color = _hex_to_rgb(color)

    img = Image.open(image_path).convert('RGBA')
    width, height = img.size

    txt_layer = Image.new('RGBA', img.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(txt_layer)

    font_paths = [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Medium.ttc',
        '/System/Library/Fonts/Hiragino Sans GB.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
        '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
        'C:/Windows/Fonts/msyh.ttc',
    ]
    font = None
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, font_size)
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    alpha = int(255 * opacity)
    fill = (*rgb_color, alpha)

    if position == 'diagonal':
        center_x = width / 2
        center_y = height / 2
        import math
        diagonal = math.sqrt(width ** 2 + height ** 2)
        repeat = int(diagonal / (text_width + 50)) + 1
        for i in range(-repeat, repeat + 1):
            for j in range(-repeat, repeat + 1):
                x = center_x + i * (text_width + 100)
                y = center_y + j * (text_height + 80)
                draw.text((x, y), text, font=font, fill=fill)
    elif position == 'tile':
        spacing_x = text_width + 60
        spacing_y = text_height + 40
        for y in range(0, height, spacing_y):
            for x in range(0, width, spacing_x):
                draw.text((x, y), text, font=font, fill=fill)
    elif position == 'center':
        x = (width - text_width) / 2
        y = (height - text_height) / 2
        draw.text((x, y), text, font=font, fill=fill)
    elif position == 'bottom_right':
        margin = 20
        x = width - text_width - margin
        y = height - text_height - margin
        draw.text((x, y), text, font=font, fill=fill)
    elif position == 'top_left':
        margin = 20
        x = margin
        y = margin
        draw.text((x, y), text, font=font, fill=fill)
    elif position == 'top_right':
        margin = 20
        x = width - text_width - margin
        y = margin
        draw.text((x, y), text, font=font, fill=fill)
    elif position == 'bottom_left':
        margin = 20
        x = margin
        y = height - text_height - margin
        draw.text((x, y), text, font=font, fill=fill)

    result = Image.alpha_composite(img, txt_layer).convert('RGB')
    p = Path(image_path)
    new_path = p.parent / f'{p.stem}_wm{p.suffix}'
    new_path_str = str(new_path)
    result.save(new_path_str, quality=90)
    logger.info(f'[Watermark] 图片水印已添加: {new_path_str}')
    return new_path_str


def add_pdf_watermark(pdf_path: str, text: str, opacity: float = 0.3,
                      position: str = 'diagonal', font_size: int = 36,
                      color: str = '#888888') -> str:
    try:
        from pypdf import PdfReader, PdfWriter
        from reportlab.pdfgen import canvas
        from reportlab.lib.colors import Color
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except ImportError as e:
        logger.error(f'[Watermark] pypdf或reportlab未安装: {e}')
        raise RuntimeError('pypdf或reportlab未安装') from e

    rgb_color = _hex_to_rgb(color)
    fill_color = Color(rgb_color[0] / 255, rgb_color[1] / 255, rgb_color[2] / 255, alpha=opacity)

    reader = PdfReader(pdf_path)
    writer = PdfWriter()

    font_paths = [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Medium.ttc',
        '/System/Library/Fonts/Hiragino Sans GB.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
        '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
        'C:/Windows/Fonts/msyh.ttc',
        'C:/Windows/Fonts/simhei.ttf',
    ]
    font_name = 'Helvetica'
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                registered_name = f'CustomFont_{abs(hash(fp)) % 100000}'
                pdfmetrics.registerFont(TTFont(registered_name, fp))
                font_name = registered_name
                break
            except Exception:
                continue

    for page_num, page in enumerate(reader.pages):
        box = page.mediabox
        page_width = float(box.width)
        page_height = float(box.height)

        packet = BytesIO()
        can = canvas.Canvas(packet, pagesize=(page_width, page_height))
        can.setFillColor(fill_color)
        try:
            can.setFont(font_name, font_size)
        except Exception:
            font_name = 'Helvetica'
            can.setFont(font_name, font_size)

        try:
            text_width = can.stringWidth(text, font_name, font_size)
        except Exception:
            text_width = font_size * len(text) * 0.6

        import math
        if position == 'diagonal':
            center_x = page_width / 2
            center_y = page_height / 2
            diagonal = math.sqrt(page_width ** 2 + page_height ** 2)
            repeat = int(diagonal / (text_width + 100)) + 1
            can.saveState()
            can.translate(center_x, center_y)
            can.rotate(45)
            for i in range(-repeat, repeat + 1):
                for j in range(-repeat, repeat + 1):
                    x = i * (text_width + 120)
                    y = j * (font_size + 80)
                    can.drawString(x, y, text)
            can.restoreState()
        elif position == 'tile':
            spacing_x = text_width + 60
            spacing_y = font_size + 40
            for y in range(0, int(page_height), spacing_y):
                for x in range(0, int(page_width), spacing_x):
                    can.drawString(x, y, text)
        elif position == 'center':
            x = (page_width - text_width) / 2
            y = page_height / 2
            can.drawString(x, y, text)
        elif position == 'bottom_right':
            margin = 30
            x = page_width - text_width - margin
            y = margin
            can.drawString(x, y, text)
        elif position == 'top_left':
            margin = 30
            x = margin
            y = page_height - margin - font_size
            can.drawString(x, y, text)
        elif position == 'top_right':
            margin = 30
            x = page_width - text_width - margin
            y = page_height - margin - font_size
            can.drawString(x, y, text)
        elif position == 'bottom_left':
            margin = 30
            x = margin
            y = margin
            can.drawString(x, y, text)

        can.save()
        packet.seek(0)

        overlay = PdfReader(packet)
        page.merge_page(overlay.pages[0])
        writer.add_page(page)

    p = Path(pdf_path)
    new_path = p.parent / f'{p.stem}_wm.pdf'
    new_path_str = str(new_path)
    with open(new_path_str, 'wb') as f:
        writer.write(f)

    logger.info(f'[Watermark] PDF水印已添加: {new_path_str}')
    return new_path_str


def add_watermark(file_path: str, text: str, opacity: float = None,
                  position: str = None, font_size: int = None,
                  color: str = None) -> dict:
    cfg = settings.WATERMARK_CONFIG
    opacity = opacity if opacity is not None else cfg.get('default_opacity', 0.3)
    position = position or cfg.get('default_position', 'diagonal')
    font_size = font_size or cfg.get('default_font_size', 36)
    color = color or cfg.get('default_color', '#888888')

    ext = Path(file_path).suffix.lower()

    try:
        if ext in ('.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.webp'):
            result_path = add_image_watermark(
                file_path, text, opacity, position, font_size, color
            )
        elif ext == '.pdf':
            result_path = add_pdf_watermark(
                file_path, text, opacity, position, font_size, color
            )
        else:
            return {
                'success': False,
                'error': f'不支持的文件格式: {ext}',
            }
    except Exception as e:
        logger.error(f'[Watermark] 添加水印失败: {e}', exc_info=True)
        return {
            'success': False,
            'error': str(e),
        }

    return {
        'success': True,
        'file_path': result_path,
        'file_url': result_path.replace(str(settings.MEDIA_ROOT), settings.MEDIA_URL),
        'text': text,
        'opacity': opacity,
        'position': position,
        'font_size': font_size,
        'color': color,
        'applied_at': timezone.now().isoformat(),
    }
