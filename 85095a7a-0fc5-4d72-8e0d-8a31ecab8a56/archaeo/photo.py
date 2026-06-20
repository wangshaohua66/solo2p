import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image, ExifTags
from PIL.ExifTags import TAGS, GPSTAGS

from .config import load_config
from .logger import get_logger
from .models import Artifact, ArtifactPhoto
from . import db

logger = get_logger(__name__)


def get_exif_data(image_path: Path) -> dict:
    exif_data = {}
    try:
        img = Image.open(image_path)
        exif_raw = img._getexif()
        if exif_raw:
            for tag_id, value in exif_raw.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag == "GPSInfo":
                    gps_data = {}
                    for gps_tag_id, gps_value in value.items():
                        gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                        gps_data[gps_tag] = gps_value
                    exif_data[tag] = gps_data
                else:
                    exif_data[tag] = value
    except Exception as e:
        logger.warning(f"读取EXIF数据失败 {image_path}: {e}")
    return exif_data


def get_gps_coordinates(exif_data: dict) -> Tuple[Optional[float], Optional[float]]:
    gps_info = exif_data.get("GPSInfo", {})
    if not gps_info:
        return None, None

    def _convert_to_degrees(value) -> float:
        d, m, s = value
        return d + (m / 60.0) + (s / 3600.0)

    lat = None
    lon = None

    try:
        gps_latitude = gps_info.get("GPSLatitude")
        gps_latitude_ref = gps_info.get("GPSLatitudeRef")
        gps_longitude = gps_info.get("GPSLongitude")
        gps_longitude_ref = gps_info.get("GPSLongitudeRef")

        if gps_latitude and gps_latitude_ref and gps_longitude and gps_longitude_ref:
            lat = _convert_to_degrees(gps_latitude)
            if gps_latitude_ref != "N":
                lat = -lat
            lon = _convert_to_degrees(gps_longitude)
            if gps_longitude_ref != "E":
                lon = -lon
    except Exception as e:
        logger.warning(f"解析GPS坐标失败: {e}")

    return lat, lon


def get_photo_datetime(exif_data: dict) -> Optional[datetime]:
    date_str = exif_data.get("DateTimeOriginal") or exif_data.get("DateTime")
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
    except (ValueError, TypeError):
        return None


def generate_thumbnail(image_path: Path, output_dir: Path, size: Optional[Tuple[int, int]] = None) -> Optional[Path]:
    config = load_config()
    if size is None:
        size = tuple(config.photo.thumbnail_size)
    suffix = config.photo.thumbnail_suffix

    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        thumb_path = output_dir / f"{image_path.stem}{suffix}{image_path.suffix}"

        with Image.open(image_path) as img:
            img.thumbnail(size)
            img.save(thumb_path, "JPEG", quality=85)

        return thumb_path
    except Exception as e:
        logger.warning(f"生成缩略图失败 {image_path}: {e}")
        return None


def batch_generate_thumbnails(photo_dir: Path, output_dir: Optional[Path] = None) -> List[Path]:
    if output_dir is None:
        output_dir = photo_dir / "thumbnails"

    thumbnails = []
    photo_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif"}

    for photo_path in photo_dir.iterdir():
        if photo_path.suffix.lower() in photo_extensions:
            thumb_path = generate_thumbnail(photo_path, output_dir)
            if thumb_path:
                thumbnails.append(thumb_path)

    logger.info(f"生成 {len(thumbnails)} 张缩略图")
    return thumbnails


def batch_rename_photos(photo_dir: Path, prefix: str, start_index: int = 1) -> List[Tuple[Path, Path]]:
    photo_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif"}
    renamed = []
    index = start_index

    photos = sorted([p for p in photo_dir.iterdir() if p.suffix.lower() in photo_extensions])

    for photo_path in photos:
        new_name = f"{prefix}_{index:04d}{photo_path.suffix.lower()}"
        new_path = photo_path.parent / new_name
        if new_path != photo_path:
            if not new_path.exists():
                photo_path.rename(new_path)
                renamed.append((photo_path, new_path))
        index += 1

    logger.info(f"重命名 {len(renamed)} 张照片")
    return renamed


def match_photos_to_artifacts(project_id: int, photo_dir: Path) -> Tuple[List[ArtifactPhoto], List[ArtifactPhoto]]:
    project = db.get_project(project_id)
    if not project:
        raise ValueError(f"项目 {project_id} 不存在")

    site_code = project.site_code or project.code
    artifacts = db.list_artifacts(project_id=project_id, limit=50000)
    artifact_map = {a.code: a for a in artifacts}

    trench_map = {}
    trenches = db.list_trenches(project_id=project_id, limit=5000)
    for t in trenches:
        trench_map[t.code] = t

    photo_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif"}
    matched: List[ArtifactPhoto] = []
    unmatched: List[ArtifactPhoto] = []

    photo_paths = sorted([p for p in photo_dir.iterdir() if p.suffix.lower() in photo_extensions])

    for photo_path in photo_paths:
        exif_data = get_exif_data(photo_path)
        photo_time = get_photo_datetime(exif_data)
        lat, lon = get_gps_coordinates(exif_data)

        photo = ArtifactPhoto(
            file_path=str(photo_path),
            file_name=photo_path.name,
            photo_time=photo_time,
            gps_latitude=lat,
            gps_longitude=lon,
        )

        matched_artifact = _find_matching_artifact(photo, artifact_map, site_code, trench_map)
        if matched_artifact:
            photo.artifact_id = matched_artifact.id
            photo.is_matched = True
            saved_photo = db.create_artifact_photo(photo)
            matched.append(saved_photo)

            if matched_artifact.photo_count == 0:
                matched_artifact.photo_count = 1
            else:
                matched_artifact.photo_count += 1
            db.update_artifact(matched_artifact)
        else:
            photo.needs_review = True
            saved_photo = db.create_artifact_photo(photo)
            unmatched.append(saved_photo)

    logger.info(f"匹配完成: {len(matched)} 张匹配, {len(unmatched)} 张待确认")
    return matched, unmatched


def _find_matching_artifact(photo: ArtifactPhoto, artifact_map: dict, site_code: str, trench_map: dict) -> Optional[Artifact]:
    file_stem = Path(photo.file_name).stem

    matched = _match_by_filename_pattern(file_stem, artifact_map, site_code, trench_map)
    if matched:
        return matched

    matched = _match_by_exif_time(photo, artifact_map)
    if matched:
        return matched

    return None


def _match_by_filename_pattern(file_stem: str, artifact_map: dict, site_code: str, trench_map: dict) -> Optional[Artifact]:
    import re

    pattern = re.compile(
        rf"^{re.escape(site_code)}-(\w+)-(\w+)-(\d+)",
        re.IGNORECASE
    )
    match = pattern.search(file_stem)
    if match:
        trench_code = match.group(1)
        layer = match.group(2)
        seq_str = match.group(3)

        candidate_code = f"{site_code}-{trench_code}-{layer}-{int(seq_str):04d}"
        if candidate_code in artifact_map:
            return artifact_map[candidate_code]

    for code in artifact_map:
        if code.lower() in file_stem.lower():
            return artifact_map[code]

    return None


def _match_by_exif_time(photo: ArtifactPhoto, artifact_map: dict, time_window_minutes: int = 30) -> Optional[Artifact]:
    if not photo.photo_time or not artifact_map:
        return None

    photo_time = photo.photo_time
    best_match = None
    min_diff = float('inf')

    for artifact in artifact_map.values():
        if not artifact.discovered_date:
            continue

        from datetime import datetime, date
        artifact_date = artifact.discovered_date
        if isinstance(artifact_date, date) and not isinstance(artifact_date, datetime):
            artifact_dt = datetime.combine(artifact_date, datetime.min.time())
        else:
            artifact_dt = artifact_date

        diff = abs((photo_time - artifact_dt).total_seconds() / 60.0)

        if diff <= time_window_minutes and diff < min_diff:
            min_diff = diff
            best_match = artifact

    return best_match


def write_gps_to_exif(image_path: Path, latitude: float, longitude: float) -> bool:
    try:
        from PIL import Image
        from piexif import TAGS, GPSIFD, ImageIFD, ExifIFD, dump, load
        img = Image.open(image_path)
        try:
            exif_dict = load(img.info["exif"]) if "exif" in img.info else {"0th": {}, "Exif": {}, "GPS": {}, "1st": {}, "thumbnail": None}
        except Exception:
            exif_dict = {"0th": {}, "Exif": {}, "GPS": {}, "1st": {}, "thumbnail": None}

        def _deg_to_dms(deg: float) -> tuple:
            d = int(deg)
            m = int((deg - d) * 60)
            s = round((deg - d - m / 60) * 3600 * 100)
            return (d, 1), (m, 1), (s, 100)

        lat_dms = _deg_to_dms(abs(latitude))
        lon_dms = _deg_to_dms(abs(longitude))

        exif_dict["GPS"][GPSIFD.GPSLatitudeRef] = "N" if latitude >= 0 else "S"
        exif_dict["GPS"][GPSIFD.GPSLatitude] = lat_dms
        exif_dict["GPS"][GPSIFD.GPSLongitudeRef] = "E" if longitude >= 0 else "W"
        exif_dict["GPS"][GPSIFD.GPSLongitude] = lon_dms

        exif_bytes = dump(exif_dict)
        img.save(image_path, exif=exif_bytes)
        return True
    except ImportError:
        logger.warning("piexif 未安装，无法写入EXIF GPS数据")
        return False
    except Exception as e:
        logger.warning(f"写入GPS坐标失败 {image_path}: {e}")
        return False


def get_photo_info(image_path: Path) -> dict:
    exif_data = get_exif_data(image_path)
    lat, lon = get_gps_coordinates(exif_data)
    photo_time = get_photo_datetime(exif_data)

    img = Image.open(image_path)

    return {
        "path": str(image_path),
        "name": image_path.name,
        "size": image_path.stat().st_size,
        "width": img.width,
        "height": img.height,
        "format": img.format,
        "photo_time": photo_time,
        "gps_latitude": lat,
        "gps_longitude": lon,
        "camera_make": exif_data.get("Make", ""),
        "camera_model": exif_data.get("Model", ""),
    }
