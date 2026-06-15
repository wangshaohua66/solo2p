"""
生成模板占位图脚本
生成所有 config.yaml 中引用的模板图片的占位版本。
实际使用时请用真实系统的截图替换这些占位模板。

用法:
    python generate_templates.py
"""

import os
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("Pillow 未安装，无法生成模板图片")


def _get_font(size: int = 14):
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
    ]
    for fp in candidates:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                continue
    return ImageFont.load_default()


def make_container_icon(path: str) -> None:
    img = Image.new("RGB", (80, 60), color=(52, 152, 219))
    draw = ImageDraw.Draw(img)
    draw.rectangle([2, 2, 77, 57], outline=(255, 255, 255), width=2)
    draw.rectangle([5, 8, 75, 38], fill=(41, 128, 185))
    draw.line([(40, 40), (40, 56)], fill=(255, 255, 255), width=2)
    draw.rectangle([30, 50, 50, 58], fill=(149, 165, 166))
    font = _get_font(10)
    draw.text((6, 40), "CNTR", fill=(255, 255, 255), font=font)
    img.save(path)


def make_empty_cell(path: str) -> None:
    img = Image.new("RGB", (80, 60), color=(44, 62, 80))
    draw = ImageDraw.Draw(img)
    draw.rectangle([1, 1, 78, 58], outline=(100, 120, 140), width=1)
    draw.line([(0, 30), (80, 30)], fill=(80, 100, 120), width=1)
    draw.line([(40, 0), (40, 60)], fill=(80, 100, 120), width=1)
    img.save(path)


def make_popup_button(path: str, label: str, bg_color, fg_color=(255, 255, 255)) -> None:
    w, h = 100, 36
    img = Image.new("RGB", (w, h), color=(245, 245, 245))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([2, 2, w - 3, h - 3], radius=4, fill=bg_color, outline=(200, 200, 200))
    font = _get_font(13)
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((w - tw) / 2, (h - th) / 2 - 2), label, fill=fg_color, font=font)
    img.save(path)


def make_popup_error(path: str) -> None:
    img = Image.new("RGB", (320, 120), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 319, 32], fill=(231, 76, 60))
    font_b = _get_font(12)
    draw.text((12, 9), "错误 - Error", fill=(255, 255, 255), font=font_b)
    font = _get_font(11)
    draw.text((16, 48), "操作失败，请检查输入后重试。", fill=(60, 60, 60), font=font)
    draw.rounded_rectangle([110, 80, 210, 110], radius=4, fill=(231, 76, 60))
    font_s = _get_font(12)
    bbox = draw.textbbox((0, 0), "确定", font=font_s)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((160 - tw / 2, 95 - th / 2 - 1), "确定", fill=(255, 255, 255), font=font_s)
    img.save(path)


def make_success_marker(path: str, label: str, color=(46, 204, 113)) -> None:
    img = Image.new("RGB", (160, 32), color=(240, 250, 245))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, 159, 31], radius=4, fill=color)
    font = _get_font(12)
    bbox = draw.textbbox((0, 0), f"✓ {label}", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((160 - tw) / 2, (32 - th) / 2 - 1), f"✓ {label}", fill=(255, 255, 255), font=font)
    img.save(path)


def main():
    if not HAS_PIL:
        print("请先安装 Pillow: pip install Pillow")
        return

    templates_dir = Path("templates")
    templates_dir.mkdir(exist_ok=True)

    templates = {
        "container_icon.png": lambda p: make_container_icon(p),
        "yard_empty_cell.png": lambda p: make_empty_cell(p),
        "popup_error.png": lambda p: make_popup_error(p),
        "popup_confirm.png": lambda p: make_popup_button(p, "确认", (46, 204, 113)),
        "popup_cancel.png": lambda p: make_popup_button(p, "取消", (149, 165, 166)),
        "popup_ok.png": lambda p: make_popup_button(p, "OK", (52, 152, 219)),
        "dispatch_success.png": lambda p: make_success_marker(p, "调度成功", (46, 204, 113)),
        "customs_success.png": lambda p: make_success_marker(p, "申报成功", (52, 152, 219)),
    }

    count = 0
    for fname, maker in templates.items():
        fpath = str(templates_dir / fname)
        try:
            maker(fpath)
            print(f"  ✓ 生成: {fpath}")
            count += 1
        except Exception as e:
            print(f"  ✗ 失败: {fname} - {e}")

    print(f"\n共生成 {count} 个模板占位图到 {templates_dir}/")
    print("⚠️  注意: 这些是占位图，实际使用前请用真实系统截图替换。")


if __name__ == "__main__":
    main()
