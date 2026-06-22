import math


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    使用 Haversine 公式计算两点之间的距离（单位：公里）
    
    Args:
        lat1: 点1纬度
        lon1: 点1经度
        lat2: 点2纬度
        lon2: 点2经度
    
    Returns:
        距离（公里），保留2位小数
    """
    R = 6371.0

    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance = R * c
    return round(distance, 2)


def format_distance(distance_km: float) -> str:
    """
    格式化距离显示
    
    Args:
        distance_km: 距离（公里）
    
    Returns:
        格式化后的距离字符串
    """
    if distance_km < 1:
        return f"{int(distance_km * 1000)}米"
    elif distance_km < 10:
        return f"{distance_km:.1f}公里"
    else:
        return f"{int(distance_km)}公里"


def get_nearby_items(items: list, user_lat: float, user_lng: float,
                   get_lat_fn=None, get_lng_fn=None, max_distance=None) -> list:
    """
    获取附近的项目并按距离排序
    
    Args:
        items: 项目列表
        user_lat: 用户纬度
        user_lng: 用户经度
        get_lat_fn: 获取项目纬度的函数
        get_lng_fn: 获取项目经度的函数
        max_distance: 最大距离（公里），None表示不限制
    
    Returns:
        按距离排序的项目列表，每个项目增加 distance 字段
    """
    if get_lat_fn is None:
        get_lat_fn = lambda x: getattr(x, 'latitude', None)
    if get_lng_fn is None:
        get_lng_fn = lambda x: getattr(x, 'longitude', None)

    result = []
    for item in items:
        lat = get_lat_fn(item)
        lng = get_lng_fn(item)
        if lat is None or lng is None:
            continue

        distance = calculate_distance(user_lat, user_lng, lat, lng)
        if max_distance is not None and distance > max_distance:
            continue

        if hasattr(item, 'to_dict'):
            item_dict = item.to_dict()
        else:
            item_dict = dict(item) if isinstance(item, dict) else {}
        item_dict['distance'] = distance
        result.append(item_dict)

    result.sort(key=lambda x: x['distance'])
    return result
