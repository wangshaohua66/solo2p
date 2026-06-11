from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone

from ..scrapers.base import RawBeerItem, SourcePlatform

LIMITED_KEYWORDS = {
    "limited", "limited edition", "limited release", "exclusive",
    "taproom only", "taproom exclusive", "brewery only", "cellar reserve",
    "anniversary", "barrel aged", "special release", "one-off", "one off",
    "rare", "small batch", "reserve", "seasonal limited", "collab",
    "collaboration", "single batch", "limited run", "flash release",
}

STYLE_ALIASES: dict[str, str] = {
    "ipa": "India Pale Ale",
    "dipa": "Double IPA",
    "iipa": "Imperial IPA",
    "imperial ipa": "Double IPA",
    "neipa": "New England IPA",
    "hazy ipa": "New England IPA",
    "juice ipa": "New England IPA",
    "milk stout": "Sweet Stout",
    "oatmeal stout": "Oatmeal Stout",
    "ris": "Russian Imperial Stout",
    "imperial stout": "Russian Imperial Stout",
    "porter": "Robust Porter",
    "brown porter": "Brown Porter",
    "saison": "Saison",
    "farmhouse ale": "Saison",
    "gose": "Gose",
    "berliner": "Berliner Weisse",
    "berliner weisse": "Berliner Weisse",
    "wit": "Witbier",
    "witbier": "Witbier",
    "belgian blonde": "Belgian Blond Ale",
    "pale ale": "American Pale Ale",
    "apa": "American Pale Ale",
    "pils": "German Pilsner",
    "pilsner": "German Pilsner",
    "czech pilsner": "Czech Pilsner",
    "bock": "Bock",
    "doppelbock": "Doppelbock",
    "maibock": "Maibock",
    "hefe": "Hefeweizen",
    "hefeweizen": "Hefeweizen",
    "weizen": "Weizen",
    "kolsch": "Kölsch",
    "kölsch": "Kölsch",
    "scotch ale": "Scotch Ale",
    "wee heavy": "Scotch Ale",
    "barleywine": "Barleywine",
    "barley wine": "Barleywine",
    "old ale": "Old Ale",
    "eisbock": "Eisbock",
    "biere de garde": "Bière de Garde",
    "lambic": "Lambic",
    "gueuze": "Gueuze",
    "flanders red": "Flanders Red Ale",
    "oud bruin": "Oud Bruin",
    "sour": "American Wild Ale",
    "wild ale": "American Wild Ale",
    "brett": "Brett Beer",
    "cream ale": "Cream Ale",
    "blonde": "Blonde Ale",
    "golden": "Golden Ale",
    "amber": "American Amber Ale",
    "red ale": "Irish Red Ale",
    "irish red": "Irish Red Ale",
    "esb": "Extra Special Bitter",
    "epa": "English Pale Ale",
    "english pale": "English Pale Ale",
    "bitter": "English Bitter",
    "mild": "English Mild",
    "tripel": "Tripel",
    "dubbel": "Dubbel",
    "quad": "Quadrupel",
    "quadrupel": "Quadrupel",
    "abbey": "Belgian Abbey Ale",
    "patersbier": "Patersbier",
    "raging bitch": "Belgian IPA",
    "belgian ipa": "Belgian IPA",
    "black ipa": "Black IPA",
    "cipa": "Cascadian Dark Ale",
    "cascadian dark": "Cascadian Dark Ale",
}


def _clean_text(text: str | None) -> str | None:
    if not text:
        return None
    text = unicodedata.normalize("NFKD", text)
    text = re.sub(r"[\u200b\ufeff\u00ad]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text if text else None


def normalize_beer_name(name: str) -> str:
    if not name:
        return ""
    name = _clean_text(name) or ""
    name = re.sub(r"\s*[-–—]\s*(v\d+|batch\s*\d+|#\d+)", r" \1", name, flags=re.I)
    return name


def normalize_brewery_name(name: str) -> str:
    if not name:
        return ""
    name = _clean_text(name) or ""
    suffixes = r"\b(brewing\s*co\.?|brewery|brewing|beer\s*co\.?|beer\s*works|craft\s*brewery|brewing\s*company)\b"
    stripped = re.sub(suffixes, "", name, flags=re.I).strip()
    return stripped if stripped else name


def normalize_style(style: str | None) -> str | None:
    if not style:
        return None
    style = _clean_text(style)
    if not style:
        return None
    key = style.lower().strip()
    return STYLE_ALIASES.get(key, style)


def parse_abv(raw: str | float | None) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    match = re.search(r"(\d+\.?\d*)\s*%", str(raw))
    return float(match.group(1)) if match else None


def parse_ibu(raw: str | int | None) -> int | None:
    if raw is None:
        return None
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        return int(raw)
    match = re.search(r"(\d+)", str(raw))
    return int(match.group(1)) if match else None


def parse_price(raw: str | float | None) -> tuple[float | None, str]:
    if raw is None:
        return None, "USD"
    if isinstance(raw, (int, float)):
        return float(raw), "USD"
    text = str(raw).strip()
    currency_match = re.search(r"[€£¥]", text)
    currency = "USD"
    if currency_match:
        cur = currency_match.group()
        currency_map = {"€": "EUR", "£": "GBP", "¥": "JPY"}
        currency = currency_map.get(cur, "USD")
    num_match = re.search(r"(\d+\.?\d*)", text)
    return (float(num_match.group(1)), currency) if num_match else (None, "USD")


def parse_release_date(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = _clean_text(raw)
    if not raw:
        return None
    formats = [
        "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y",
        "%b %d, %Y", "%d %B %Y", "%d %b %Y", "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def detect_limited_tags(text: str | None, is_limited_flag: bool = False) -> tuple[bool, list[str]]:
    tags: list[str] = []
    if not text and not is_limited_flag:
        return False, tags
    if is_limited_flag:
        tags.append("flagged_limited")
    if text:
        lower = text.lower()
        for kw in LIMITED_KEYWORDS:
            if kw in lower:
                tags.append(kw)
    return bool(tags), tags


def generate_fingerprint(brewery_name: str, beer_name: str, batch_name: str | None = None) -> str:
    parts = [normalize_brewery_name(brewery_name).lower(), normalize_beer_name(beer_name).lower()]
    if batch_name:
        parts.append(_clean_text(batch_name) or "")
        parts[-1] = parts[-1].lower()
    combined = "|||".join(parts)
    return re.sub(r"\s+", "", combined)


def normalize_beer(item: RawBeerItem) -> dict:
    is_limited, limited_tags = detect_limited_tags(
        " ".join(filter(None, [item.description, item.batch_name])),
        item.is_limited,
    )
    price, currency = parse_price(item.price)
    return {
        "source": item.source.value,
        "source_url": item.source_url,
        "brewery_name": normalize_brewery_name(item.brewery_name),
        "brewery_name_raw": _clean_text(item.brewery_name),
        "beer_name": normalize_beer_name(item.beer_name),
        "beer_name_raw": _clean_text(item.beer_name),
        "batch_name": _clean_text(item.batch_name),
        "style": normalize_style(item.style),
        "abv": parse_abv(item.abv),
        "ibu": parse_ibu(item.ibu),
        "release_date": parse_release_date(item.release_date),
        "price": price,
        "currency": currency,
        "is_limited": is_limited,
        "limited_tags": ",".join(limited_tags),
        "description": _clean_text(item.description),
        "image_url": item.image_url,
        "screenshot_path": item.screenshot_path,
        "availability_raw": item.availability_raw,
        "fingerprint": generate_fingerprint(item.brewery_name, item.beer_name, item.batch_name),
        "scraped_at": item.scraped_at or datetime.now(timezone.utc).isoformat(),
    }


def normalize_brewery(name: str) -> dict:
    return {
        "name": normalize_brewery_name(name),
        "name_raw": _clean_text(name),
    }


def normalize_batch(batch_name: str | None, brewery_name: str, beer_name: str) -> dict | None:
    if not batch_name:
        return None
    cleaned = _clean_text(batch_name)
    if not cleaned:
        return None
    return {
        "batch_name": cleaned,
        "fingerprint": generate_fingerprint(brewery_name, beer_name, batch_name),
    }
