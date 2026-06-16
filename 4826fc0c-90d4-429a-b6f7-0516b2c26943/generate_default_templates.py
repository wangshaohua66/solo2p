import os
import zlib
import struct
from pathlib import Path


def create_png(width, height, pixels, filepath):
    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = zlib.crc32(chunk) & 0xffffffff
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', crc)

    signature = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr = png_chunk(b'IHDR', ihdr_data)

    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'
        for x in range(width):
            r, g, b = pixels[y][x]
            raw_data += bytes([r, g, b])

    compressed = zlib.compress(raw_data)
    idat = png_chunk(b'IDAT', compressed)
    iend = png_chunk(b'IEND', b'')

    with open(filepath, 'wb') as f:
        f.write(signature + ihdr + idat + iend)


def create_solid_png(width, height, color, filepath):
    pixels = [[color for _ in range(width)] for _ in range(height)]
    create_png(width, height, pixels, filepath)


def create_button_template(filepath, text="OK", bg_color=(240, 240, 240),
                           border_color=(100, 100, 100), text_color=(0, 0, 0)):
    w, h = 100, 32
    pixels = [[bg_color for _ in range(w)] for _ in range(h)]

    for x in range(w):
        pixels[0][x] = border_color
        pixels[h-1][x] = border_color
    for y in range(h):
        pixels[y][0] = border_color
        pixels[y][w-1] = border_color

    create_png(w, h, pixels, filepath)


def create_dialog_template(filepath, title="Error", bg_color=(255, 255, 255),
                           border_color=(150, 150, 150), title_bg=(200, 200, 200)):
    w, h = 250, 150
    pixels = [[bg_color for _ in range(w)] for _ in range(h)]

    for x in range(w):
        pixels[0][x] = border_color
        pixels[h-1][x] = border_color
        for y in range(30):
            pixels[y][x] = title_bg
    for y in range(h):
        pixels[y][0] = border_color
        pixels[y][w-1] = border_color

    create_png(w, h, pixels, filepath)


def create_window_template(filepath):
    w, h = 400, 300
    bg = (245, 245, 245)
    title_bg = (70, 130, 180)
    border = (100, 100, 100)

    pixels = [[bg for _ in range(w)] for _ in range(h)]

    for x in range(w):
        pixels[0][x] = border
        pixels[h-1][x] = border
        for y in range(35):
            pixels[y][x] = title_bg
    for y in range(h):
        pixels[y][0] = border
        pixels[y][w-1] = border

    create_png(w, h, pixels, filepath)


def create_digit_template(digit, filepath):
    patterns = {
        '0': [" ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### "],
        '1': ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
        '2': [" ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####"],
        '3': ["#####", "    #", "   # ", "    #", "    #", "#   #", " ### "],
        '4': ["   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "],
        '5': ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
        '6': ["  ## ", " #   ", "#    ", "#### ", "#   #", "#   #", " ### "],
        '7': ["#####", "    #", "   # ", "  #  ", " #   ", " #   ", " #   "],
        '8': [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "],
        '9': [" ### ", "#   #", "#   #", " ####", "    #", "   # ", " ##  "],
    }

    pattern = patterns.get(digit, patterns['0'])
    scale = 4
    w = len(pattern[0]) * scale
    h = len(pattern) * scale

    pixels = [[(255, 255, 255) for _ in range(w)] for _ in range(h)]

    for y, row in enumerate(pattern):
        for x, ch in enumerate(row):
            if ch == '#':
                for dy in range(scale):
                    for dx in range(scale):
                        px = x * scale + dx
                        py = y * scale + dy
                        if px < w and py < h:
                            pixels[py][px] = (0, 0, 0)

    create_png(w, h, pixels, filepath)


def generate_default_templates():
    base_dir = Path(__file__).parent / "templates"
    digits_dir = base_dir / "digits"
    digits_dir.mkdir(parents=True, exist_ok=True)

    print("生成数字模板...")
    for d in "0123456789":
        filepath = digits_dir / f"{d}.png"
        create_digit_template(d, str(filepath))
        print(f"  {filepath}")

    print("\n生成对话框模板...")
    dialogs = [
        ("dialog_error.png", "错误"),
        ("dialog_warning.png", "警告"),
        ("dialog_confirm.png", "确认"),
    ]
    for name, _ in dialogs:
        filepath = base_dir / name
        create_dialog_template(str(filepath))
        print(f"  {filepath}")

    print("\n生成窗口模板...")
    filepath = base_dir / "window_default.png"
    create_window_template(str(filepath))
    print(f"  {filepath}")

    print("\n生成按钮模板...")
    filepath = base_dir / "button_default.png"
    create_button_template(str(filepath))
    print(f"  {filepath}")

    print("\n生成字段模板...")
    filepath = base_dir / "field_default.png"
    create_solid_png(80, 24, (255, 255, 255), str(filepath))
    print(f"  {filepath}")

    print("\n默认模板生成完成！")


if __name__ == "__main__":
    generate_default_templates()
