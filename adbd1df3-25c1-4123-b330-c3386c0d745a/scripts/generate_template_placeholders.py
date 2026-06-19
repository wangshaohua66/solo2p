"""
生成模板占位图片脚本

使用方法: python scripts/generate_template_placeholders.py

注意: 这些是占位图片，仅用于确保代码能正常加载。
实际使用时请替换为真实的用友U8界面截图。
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont


TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


TEMPLATE_SPECS = [
    ("login_username_field.png", "用户名", (100, 32)),
    ("login_password_field.png", "密码", (100, 32)),
    ("login_captcha_field.png", "验证码", (100, 32)),
    ("login_captcha_image.png", "1234", (120, 40)),
    ("login_button.png", "登 录", (80, 36)),
    ("login_error_hint.png", "登录失败", (140, 28)),
    ("expense_module.png", "报销管理", (80, 60)),
    ("new_button.png", "新 增", (70, 32)),
    ("invoice_code_field.png", "发票代码", (100, 28)),
    ("invoice_number_field.png", "发票号码", (100, 28)),
    ("tax_id_field.png", "纳税人识别号", (120, 28)),
    ("amount_field.png", "金 额", (80, 28)),
    ("date_field.png", "开票日期", (100, 28)),
    ("seller_field.png", "销售方名称", (120, 28)),
    ("save_button.png", "保 存", (70, 32)),
    ("submit_button.png", "提 交", (70, 32)),
    ("success_toast.png", "保存成功", (140, 32)),
    ("error_dialog.png", "错误提示", (160, 90)),
]


def get_font(size: int = 14) -> ImageFont.ImageFont:
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def create_placeholder(filename: str, text: str, size: tuple, output_dir: str):
    width, height = size
    image = Image.new("RGB", (width, height), color=(240, 240, 240))
    draw = ImageDraw.Draw(image)

    draw.rectangle([0, 0, width - 1, height - 1], outline=(180, 180, 180), width=1)

    font = get_font(min(14, height // 2))
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
    except Exception:
        text_width = len(text) * 10
        text_height = 14

    x = (width - text_width) // 2
    y = (height - text_height) // 2

    draw.text((x, y), text, fill=(80, 80, 80), font=font)

    output_path = os.path.join(output_dir, filename)
    image.save(output_path, "PNG")
    print(f"  ✓ {filename} ({width}x{height})")


def main():
    os.makedirs(TEMPLATE_DIR, exist_ok=True)

    print("生成模板占位图片...")
    print(f"输出目录: {TEMPLATE_DIR}")
    print()

    count = 0
    for filename, text, size in TEMPLATE_SPECS:
        create_placeholder(filename, text, size, TEMPLATE_DIR)
        count += 1

    print()
    print(f"完成! 共生成 {count} 个模板占位文件")
    print()
    print("注意: 这些是占位图片，请替换为真实的用友U8界面截图后再使用。")
    print("详细说明请查看 templates/README.md")


if __name__ == "__main__":
    main()
