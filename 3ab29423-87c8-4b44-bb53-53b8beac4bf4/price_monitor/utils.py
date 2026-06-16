import os
import sys
import logging
import hashlib
import time
import random
import functools
import datetime
import json
from io import BytesIO
from logging.handlers import TimedRotatingFileHandler

import yaml
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import requests
from requests.exceptions import RequestException
from PIL import Image, ImageFilter, ImageEnhance

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.yaml")

_config_cache = None
_config_mtime = None


def load_config(reload=False):
    global _config_cache, _config_mtime
    current_mtime = os.path.getmtime(CONFIG_PATH)
    if _config_cache is None or reload or current_mtime != _config_mtime:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            _config_cache = yaml.safe_load(f)
        _config_mtime = current_mtime
    return _config_cache


def init_logger(name="price_monitor", log_level=logging.INFO):
    config = load_config()
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), config["system"]["log_dir"])
    os.makedirs(log_dir, exist_ok=True)

    logger = logging.getLogger(name)
    logger.setLevel(log_level)
    logger.handlers.clear()

    fmt = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(fmt)
    console_handler.setLevel(log_level)
    logger.addHandler(console_handler)

    log_file = os.path.join(log_dir, f"{name}.log")
    file_handler = TimedRotatingFileHandler(
        log_file,
        when="midnight",
        interval=1,
        backupCount=config["system"]["log_retention_days"],
        encoding="utf-8",
    )
    file_handler.setFormatter(fmt)
    file_handler.setLevel(logging.DEBUG)
    logger.addHandler(file_handler)

    return logger


logger = init_logger()


def today_str(fmt="%Y-%m-%d"):
    tz = datetime.timezone(datetime.timedelta(hours=8))
    return datetime.datetime.now(tz).strftime(fmt)


def yesterday_str(fmt="%Y-%m-%d"):
    tz = datetime.timezone(datetime.timedelta(hours=8))
    return (datetime.datetime.now(tz) - datetime.timedelta(days=1)).strftime(fmt)


def date_days_ago(days, fmt="%Y-%m-%d"):
    tz = datetime.timezone(datetime.timedelta(hours=8))
    return (datetime.datetime.now(tz) - datetime.timedelta(days=days)).strftime(fmt)


def gen_fingerprint(market_id, category_id, date_str=None):
    if date_str is None:
        date_str = today_str()
    raw = f"{market_id}|{category_id}|{date_str}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def gen_unique_id(*parts):
    raw = "|".join(str(p) for p in parts) + f"|{time.time()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def safe_float(val, default=0.0):
    if val is None:
        return default
    try:
        if isinstance(val, (int, float)):
            return float(val)
        s = str(val).strip()
        if not s:
            return default
        s = s.replace(",", "").replace("，", "").replace("元", "").replace("/公斤", "").replace("/斤", "")
        if s.startswith("~") or s.startswith("-") and len(s) > 1 and s[1:].replace(".", "", 1).isdigit():
            pass
        s = s.replace("¥", "").replace("￥", "")
        return float(s)
    except (ValueError, TypeError):
        return default


def calc_change_pct(current, previous):
    if previous is None or previous == 0:
        return 0.0
    try:
        return round((float(current) - float(previous)) / float(previous) * 100, 2)
    except (ValueError, TypeError, ZeroDivisionError):
        return 0.0


def retry_request(
    max_attempts=3,
    wait_min=1,
    wait_max=10,
    timeout=None,
):
    config = load_config()
    if timeout is None:
        timeout = config["system"]["request_timeout"]

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs, _timeout=timeout)
                except RequestException as e:
                    last_exc = e
                    if attempt < max_attempts:
                        delay = min(wait_min * (2 ** (attempt - 1)) + random.uniform(0, 1), wait_max)
                        logger.warning(
                            f"请求失败 (第{attempt}/{max_attempts}次): {e}, {delay:.1f}秒后重试"
                        )
                        time.sleep(delay)
                    else:
                        logger.error(f"请求失败已达最大重试次数{max_attempts}: {e}")
            raise last_exc
        return wrapper
    return decorator


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(RequestException),
    reraise=True,
)
def http_request(url, method="GET", session=None, **kwargs):
    config = load_config()
    timeout = kwargs.pop("_timeout", config["system"]["request_timeout"])
    kwargs.setdefault("timeout", timeout)
    kwargs.setdefault("headers", {})
    kwargs["headers"].setdefault(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    )

    cli = session or requests
    resp = cli.request(method, url, **kwargs)
    resp.raise_for_status()
    return resp


def download_file(url, session=None, **kwargs):
    resp = http_request(url, session=session, stream=True, **kwargs)
    return BytesIO(resp.content)


def preprocess_image_for_ocr(image_bytes, region=None, upscale=2, denoise=True):
    try:
        img = Image.open(BytesIO(image_bytes)).convert("L")
    except Exception as e:
        logger.error(f"图片打开失败: {e}")
        return None

    if region and len(region) == 4:
        x1, y1, x2, y2 = region
        if x2 <= img.width and y2 <= img.height:
            img = img.crop((x1, y1, x2, y2))

    if upscale and upscale > 1:
        new_size = (img.width * upscale, img.height * upscale)
        img = img.resize(new_size, Image.LANCZOS)

    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.5)
    enhancer = ImageEnhance.Sharpness(img)
    img = enhancer.enhance(2.0)

    if denoise:
        img = img.filter(ImageFilter.MedianFilter(size=3))

    threshold = 180
    img = img.point(lambda p: 255 if p > threshold else 0)

    return img


def extract_json_path(data, path):
    keys = path.split(".")
    current = data
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        elif isinstance(current, list) and key.isdigit():
            idx = int(key)
            if 0 <= idx < len(current):
                current = current[idx]
            else:
                return None
        else:
            return None
    return current


def col_letter_to_index(letter):
    result = 0
    for ch in letter.upper():
        result = result * 26 + (ord(ch) - ord("A") + 1)
    return result - 1


def deep_get(d, keys, default=None):
    if not keys:
        return d
    if isinstance(d, dict):
        return deep_get(d.get(keys[0], default), keys[1:], default)
    return default


def chunk_list(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i:i + size]


class Color:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    UNDERLINE = "\033[4m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"


def color_text(text, color):
    return f"{color}{text}{Color.RESET}"


def pct_color(pct):
    if isinstance(pct, str):
        pct = safe_float(pct)
    if pct >= 15:
        return Color.RED
    elif pct >= 5:
        return Color.YELLOW
    elif pct <= -15:
        return Color.RED
    elif pct <= -5:
        return Color.YELLOW
    return Color.GREEN


def fmt_pct(pct):
    if isinstance(pct, str):
        pct = safe_float(pct)
    sign = "+" if pct > 0 else ""
    return f"{sign}{pct:.2f}%"


def text_bar(value, max_value, width=30):
    if max_value == 0:
        return " " * width
    ratio = max(0.0, min(1.0, value / max_value))
    filled = int(ratio * width)
    return "█" * filled + "░" * (width - filled)


def check_config_changed():
    global _config_mtime
    if _config_mtime is None:
        _config_mtime = os.path.getmtime(CONFIG_PATH)
        return False
    current = os.path.getmtime(CONFIG_PATH)
    if current != _config_mtime:
        logger.info("配置文件已变更，将重新加载")
        return True
    return False
