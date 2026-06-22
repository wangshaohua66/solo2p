from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)


TREATMENT_INTERVALS = {
    '常规检查': {'days': 180, 'description': '每6个月常规检查'},
    '洁牙': {'days': 180, 'description': '每6个月洁牙'},
    '补牙': {'days': 365, 'description': '补牙后1年复查'},
    '根管治疗': {'days': 90, 'description': '根管治疗后3个月复查'},
    '拔牙': {'days': 7, 'description': '拔牙后1周拆线复查'},
    '牙周治疗': {'days': 90, 'description': '牙周治疗后3个月复查'},
    '正畸治疗': {'days': 30, 'description': '正畸每月复诊'},
    '正畸保持期': {'days': 180, 'description': '保持期每6个月复查'},
    '种植牙一期': {'days': 180, 'description': '种植一期后6个月二期手术'},
    '种植牙二期': {'days': 14, 'description': '二期后2周取模'},
    '种植牙修复': {'days': 180, 'description': '修复后6个月复查'},
    '儿童牙科': {'days': 90, 'description': '儿童每3个月复查'},
    '正畸初诊': {'days': 14, 'description': '初诊后2周出方案'},
    '种植初诊': {'days': 7, 'description': '初诊后1周出方案'},
    '修复治疗': {'days': 365, 'description': '修复后1年复查'},
    '其他': {'days': 180, 'description': '默认6个月后复查'},
}


def calculate_next_visit(treatment_type, last_visit_date=None, custom_days=None):
    """
    根据治疗类型和上次就诊日期计算下次复诊日期
    
    Args:
        treatment_type: 治疗类型
        last_visit_date: 上次就诊日期，默认今天
        custom_days: 自定义间隔天数（优先使用）
    
    Returns:
        dict: {
            'next_date': date, 下次复诊日期
            'days': int, 间隔天数
            'description': str, 描述
            'treatment_type': str, 治疗类型
        }
    """
    if last_visit_date is None:
        last_visit_date = date.today()
    elif isinstance(last_visit_date, str):
        last_visit_date = date.fromisoformat(last_visit_date)

    if custom_days:
        interval_days = custom_days
        description = f'自定义间隔 {custom_days} 天'
    else:
        treatment_info = TREATMENT_INTERVALS.get(treatment_type, TREATMENT_INTERVALS['其他'])
        interval_days = treatment_info['days']
        description = treatment_info['description']

    next_date = last_visit_date + timedelta(days=interval_days)

    while next_date.weekday() >= 5:
        next_date += timedelta(days=1)

    return {
        'next_date': next_date,
        'days': interval_days,
        'description': description,
        'treatment_type': treatment_type,
    }


def get_treatment_types():
    """获取所有治疗类型及间隔信息"""
    return [
        {
            'type': t,
            'days': info['days'],
            'description': info['description'],
        }
        for t, info in TREATMENT_INTERVALS.items()
    ]


def calculate_treatment_cycle(start_date, treatment_type):
    """
    计算整个治疗周期的复诊计划
    
    Args:
        start_date: 开始日期
        treatment_type: 治疗类型
    
    Returns:
        list: 复诊计划列表
    """
    if isinstance(start_date, str):
        start_date = date.fromisoformat(start_date)
    
    plans = []
    current_date = start_date
    
    if treatment_type == '正畸治疗':
        total_months = 24
        for i in range(1, total_months + 1):
            visit_date = start_date + timedelta(days=i * 30)
            while visit_date.weekday() >= 5:
                visit_date += timedelta(days=1)
            plans.append({
                'visit_number': i,
                'date': visit_date,
                'type': '复诊',
                'description': f'第{i}次复诊',
            })
    
    elif treatment_type == '种植牙一期':
        plans.extend([
            {'visit_number': 1, 'date': start_date + timedelta(days=7), 'type': '复查', 'description': '术后1周拆线复查'},
            {'visit_number': 2, 'date': start_date + timedelta(days=30), 'type': '复查', 'description': '术后1个月骨结合检查'},
            {'visit_number': 3, 'date': start_date + timedelta(days=90), 'type': '复查', 'description': '术后3个月骨结合检查'},
            {'visit_number': 4, 'date': start_date + timedelta(days=180), 'type': '二期手术', 'description': '二期手术（愈合基台）'},
            {'visit_number': 5, 'date': start_date + timedelta(days=194), 'type': '取模', 'description': '取模制作牙冠'},
            {'visit_number': 6, 'date': start_date + timedelta(days=208), 'type': '戴牙', 'description': '戴牙冠'},
            {'visit_number': 7, 'date': start_date + timedelta(days=365), 'type': '复查', 'description': '术后1年复查'},
        ])
    
    elif treatment_type == '根管治疗':
        plans.extend([
            {'visit_number': 1, 'date': start_date + timedelta(days=7), 'type': '复诊', 'description': '术后1周复查'},
            {'visit_number': 2, 'date': start_date + timedelta(days=30), 'type': '复查', 'description': '术后1个月复查'},
            {'visit_number': 3, 'date': start_date + timedelta(days=90), 'type': '复查', 'description': '术后3个月复查'},
            {'visit_number': 4, 'date': start_date + timedelta(days=180), 'type': '复查', 'description': '术后6个月复查'},
            {'visit_number': 5, 'date': start_date + timedelta(days=365), 'type': '复查', 'description': '术后1年复查'},
        ])
    
    else:
        result = calculate_next_visit(treatment_type, start_date)
        plans.append({
            'visit_number': 1,
            'date': result['next_date'],
            'type': '复诊',
            'description': result['description'],
        })
    
    for plan in plans:
        visit_date = plan['date']
        while visit_date.weekday() >= 5:
            visit_date += timedelta(days=1)
        plan['date'] = visit_date
    
    return plans


def is_visit_due(next_visit_date, remind_days_before=1):
    """
    判断是否即将到复诊时间
    
    Args:
        next_visit_date: 下次复诊日期
        remind_days_before: 提前提醒天数
    
    Returns:
        bool: 是否需要提醒
    """
    if isinstance(next_visit_date, str):
        next_visit_date = date.fromisoformat(next_visit_date)
    
    today = date.today()
    days_until = (next_visit_date - today).days
    
    return 0 <= days_until <= remind_days_before


def get_days_until_visit(next_visit_date):
    """
    获取距离下次复诊的天数
    
    Args:
        next_visit_date: 下次复诊日期
    
    Returns:
        int: 天数（负数表示已过期）
    """
    if isinstance(next_visit_date, str):
        next_visit_date = date.fromisoformat(next_visit_date)
    
    today = date.today()
    return (next_visit_date - today).days


def generate_reminder_message(patient_name, doctor_name, visit_date, visit_type='复诊'):
    """
    生成复诊提醒消息
    
    Args:
        patient_name: 患者姓名
        doctor_name: 医生姓名
        visit_date: 复诊日期
        visit_type: 就诊类型
    
    Returns:
        str: 提醒消息
    """
    if isinstance(visit_date, str):
        visit_date = date.fromisoformat(visit_date)
    
    days_until = get_days_until_visit(visit_date)
    
    if days_until == 0:
        day_text = '今天'
    elif days_until == 1:
        day_text = '明天'
    else:
        day_text = f'{days_until}天后'
    
    return (
        f'【复诊提醒】{patient_name}您好，'
        f'您预约的{doctor_name}医生{visit_type}时间为{visit_date.strftime("%Y年%m月%d日")}（{day_text}），'
        f'请准时就诊。如需改约请提前24小时联系。'
    )
