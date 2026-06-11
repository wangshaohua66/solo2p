"""ADIF v3.1.4 format support for HAMLOG.

ADIF (Amateur Data Interchange Format) parser and serializer.
Supports import from ADIF files and export for LoTW / QRZ.com upload.

ADIF spec: http://www.adif.org/314/ADIF_314_spec_314.htm
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from .qso import QSO, freq_to_band

logger = logging.getLogger(__name__)

ADIF_FIELD_MAP = {
    "call": "callsign",
    "qso_date": "qso_date",
    "qso_time": "qso_time",
    "band": "band",
    "mode": "mode",
    "freq": "freq",
    "rst_sent": "rst_sent",
    "rst_rcvd": "rst_rcvd",
    "gridsquare": "grid",
    "my_gridsquare": "my_grid",
    "name": "name",
    "qth": "qth",
    "state": "state",
    "cq_zone": "cq_zone",
    "ituzone": "ituzone",
    "dxcc": "dxcc",
    "country": "country",
    "operator": "operator",
    "station_callsign": "station_callsign",
    "tx_pwr": "tx_pwr",
    "rig": "rig",
    "antenna": "antenna",
    "comment": "comment",
    "notes": "notes",
    "contest_id": "contest_id",
    "srx": "srx",
    "srx_string": "srx_string",
    "stx": "stx",
    "stx_string": "stx_string",
    "qsl_rcvd": "qsl_rcvd",
    "qsl_sent": "qsl_sent",
    "qslrdate": "qsl_rcvd_date",
    "qslsdate": "qsl_sent_date",
    "lotw_qsl_rcvd": "lotw_rcvd",
    "lotw_qsl_sent": "lotw_sent",
    "lotw_qslrdate": "lotw_rcvd_date",
    "lotw_qslsdate": "lotw_sent_date",
    "qrzcom_qso_upload_date": "qrzcom_qso_upload_date",
    "app_qrzlog_logid": "qrz_log_id",
}

REVERSE_FIELD_MAP = {v: k for k, v in ADIF_FIELD_MAP.items()}

EXPORT_FIELDS = [
    "call", "qso_date", "qso_time", "band", "mode", "freq",
    "rst_sent", "rst_rcvd", "gridsquare", "my_gridsquare",
    "name", "qth", "state", "cq_zone", "ituzone", "dxcc", "country",
    "operator", "station_callsign", "tx_pwr", "rig", "antenna",
    "comment", "notes", "contest_id", "srx", "srx_string",
    "stx", "stx_string", "qsl_rcvd", "qsl_sent",
    "lotw_qsl_rcvd", "lotw_qsl_sent", "qrzcom_qso_upload_date",
]


def parse_adif(data: str) -> Tuple[Dict[str, str], List[Dict[str, Any]]]:
    """Parse ADIF format data.

    Returns (header_dict, list_of_qso_dicts).

    ADIF format:
        <field:length>value
        <eor> marks end of record
        <eoh> marks end of header
    """
    header: Dict[str, str] = {}
    records: List[Dict[str, Any]] = []
    in_header = True
    current_record: Dict[str, Any] = {}

    field_pattern = re.compile(r'<(\w+)(?::(\d+))?(?::\w+)?>\s*', re.IGNORECASE)

    pos = 0
    while pos < len(data):
        match = field_pattern.search(data, pos)
        if not match:
            break

        field_name = match.group(1).lower()
        field_length = match.group(2)
        tag_end = match.end()

        if field_name == "eoh":
            in_header = False
            pos = tag_end
            continue

        if field_name == "eor":
            if not in_header and current_record:
                records.append(current_record)
                current_record = {}
            pos = tag_end
            continue

        if field_length:
            length = int(field_length)
            value = data[tag_end:tag_end + length]
            pos = tag_end + length
        else:
            value = ""
            pos = tag_end

        value = value.strip()

        if in_header:
            header[field_name] = value
        else:
            current_record[field_name] = value

    if current_record and not in_header:
        records.append(current_record)

    logger.debug("Parsed %d QSO records from ADIF", len(records))
    return header, records


def adif_record_to_qso(record: Dict[str, Any]) -> QSO:
    """Convert an ADIF record dict to a QSO object."""
    mapped: Dict[str, Any] = {}

    for adif_field, value in record.items():
        adif_field_lower = adif_field.lower()
        if adif_field_lower in ADIF_FIELD_MAP:
            qso_field = ADIF_FIELD_MAP[adif_field_lower]
            mapped[qso_field] = value

    if "freq" in mapped and mapped["freq"]:
        try:
            mapped["freq"] = float(mapped["freq"])
        except (ValueError, TypeError):
            pass

    if "dxcc" in mapped and mapped["dxcc"]:
        try:
            mapped["dxcc"] = int(mapped["dxcc"])
        except (ValueError, TypeError):
            pass

    if "cq_zone" in mapped and mapped["cq_zone"]:
        try:
            mapped["cq_zone"] = int(mapped["cq_zone"])
        except (ValueError, TypeError):
            pass

    if "ituzone" in mapped and mapped["ituzone"]:
        try:
            mapped["ituzone"] = int(mapped["ituzone"])
        except (ValueError, TypeError):
            pass

    if "tx_pwr" in mapped and mapped["tx_pwr"]:
        try:
            mapped["tx_pwr"] = float(mapped["tx_pwr"])
        except (ValueError, TypeError):
            pass

    if "srx" in mapped and mapped["srx"]:
        try:
            mapped["srx"] = int(mapped["srx"])
        except (ValueError, TypeError):
            pass

    if "stx" in mapped and mapped["stx"]:
        try:
            mapped["stx"] = int(mapped["stx"])
        except (ValueError, TypeError):
            pass

    if "freq" in mapped and mapped["freq"] and "band" not in mapped:
        band = freq_to_band(mapped["freq"])
        if band:
            mapped["band"] = band

    qso = QSO(
        callsign=mapped.get("callsign", ""),
        qso_date=mapped.get("qso_date", ""),
        qso_time=mapped.get("qso_time", ""),
        band=mapped.get("band", ""),
        mode=mapped.get("mode", ""),
    )

    for key, value in mapped.items():
        if hasattr(qso, key) and key not in ("callsign", "qso_date", "qso_time", "band", "mode"):
            setattr(qso, key, value)

    return qso


def qso_to_adif(qso: QSO) -> str:
    """Convert a QSO object to an ADIF record string."""
    fields = []

    for adif_field in EXPORT_FIELDS:
        qso_field = ADIF_FIELD_MAP.get(adif_field)
        if not qso_field:
            continue

        value = getattr(qso, qso_field, None)
        if value is None or value == "":
            continue

        value_str = str(value)
        length = len(value_str)
        fields.append(f"<{adif_field}:{length}>{value_str}")

    fields.append("<eor>")
    return "\n".join(fields)


def generate_adif_header(program_id: str = "HAMLOG", program_version: str = "1.0") -> str:
    """Generate ADIF file header."""
    header_fields = [
        ("adif_ver", "3.1.4"),
        ("programid", program_id),
        ("programversion", program_version),
        ("created_timestamp", datetime.utcnow().strftime("%Y%m%d %H%M%S")),
    ]

    lines = []
    for field, value in header_fields:
        lines.append(f"<{field}:{len(value)}>{value}")
    lines.append("<eoh>")
    return "\n".join(lines)


def export_adif(qsos: List[QSO], program_id: str = "HAMLOG", program_version: str = "1.0") -> str:
    """Export a list of QSOs to ADIF format string."""
    parts = [generate_adif_header(program_id, program_version), ""]
    for qso in qsos:
        parts.append(qso_to_adif(qso))
        parts.append("")
    return "\n".join(parts)


def parse_adif_file(filepath: str) -> List[QSO]:
    """Parse an ADIF file and return list of QSO objects."""
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        data = f.read()

    _, records = parse_adif(data)
    qsos = []
    for record in records:
        try:
            qso = adif_record_to_qso(record)
            qsos.append(qso)
        except Exception as e:
            logger.warning("Failed to parse ADIF record: %s", e)
            continue

    logger.info("Parsed %d QSOs from %s", len(qsos), filepath)
    return qsos


def export_csv(qsos: List[QSO]) -> str:
    """Export QSOs to CSV format."""
    import csv
    import io

    fieldnames = [
        "callsign", "qso_date", "qso_time", "band", "mode", "freq",
        "rst_sent", "rst_rcvd", "grid", "name", "qth", "state",
        "dxcc", "country", "cq_zone", "comment",
    ]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()

    for qso in qsos:
        writer.writerow(qso.to_dict())

    return output.getvalue()
