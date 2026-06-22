import json
import re
from datetime import date, datetime


def json_response(data=None, message='success', code=200):
    return {
        'code': code,
        'message': message,
        'data': data,
    }


def validate_phone(phone):
    pattern = r'^1[3-9]\d{9}$'
    return re.match(pattern, phone) is not None


def validate_id_card(id_card):
    if len(id_card) not in (15, 18):
        return False
    if len(id_card) == 18:
        pattern = r'^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$'
        return re.match(pattern, id_card) is not None
    return True


def parse_date(date_str):
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return None


def format_date(d, fmt='%Y-%m-%d'):
    if d is None:
        return None
    if isinstance(d, str):
        return d
    return d.strftime(fmt)


def serialize_model(model, include=None, exclude=None):
    if model is None:
        return None
    if hasattr(model, 'to_dict'):
        return model.to_dict()
    return None


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)
