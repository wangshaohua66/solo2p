import logging
from django.utils import timezone
from .models import Notification
from apps.common.services import send_sms as real_send_sms, send_app_push as real_send_app_push

logger = logging.getLogger(__name__)


def send_sms(phone: str, content: str) -> bool:
    return real_send_sms(phone, content=content, template_type='notification')


def send_app_push(user, content: str, extra: dict | None = None) -> bool:
    title = None
    if extra:
        title = extra.get('push_title')
    return real_send_app_push(user, content, title=title, extras=extra)


def send_email(email: str, title: str, content: str) -> bool:
    logger.info(f'[Email Mock] 发送邮件到 {email} 主题: {title}')
    return True


def create_notification(
    recipient,
    title: str,
    content: str,
    category: str = 'system',
    level: str = 'info',
    channel: str = 'in_app',
    related_case=None,
    related_trial=None,
    extra_data: dict | None = None,
    created_by=None,
    push_channels: list | None = None,
) -> Notification:
    notif = Notification.objects.create(
        recipient=recipient,
        title=title,
        content=content,
        category=category,
        level=level,
        channel=channel,
        related_case=related_case,
        related_trial=related_trial,
        extra_data=extra_data or {},
        created_by=created_by,
    )

    all_channels = push_channels or [channel]
    success = True
    for ch in all_channels:
        if ch == 'sms':
            phone = getattr(recipient, 'phone', '') or ''
            if phone:
                ok = send_sms(phone, content)
                success = success and ok
        elif ch == 'app_push':
            ok = send_app_push(recipient, content, extra_data)
            success = success and ok
        elif ch == 'email':
            email = getattr(recipient, 'email', '') or ''
            if email:
                ok = send_email(email, title, content)
                success = success and ok

    notif.status = 'sent' if success else 'failed'
    notif.sent_at = timezone.now()
    notif.save(update_fields=['status', 'sent_at'])
    return notif


def push_case_limitation_warning(case, days_left: int, level: str = 'warning'):
    if not case.lead_lawyer:
        return
    lead = case.lead_lawyer
    if days_left <= 0:
        title = '⚠️ 诉讼时效已过期'
        content = f'案件[{case.case_no} {case.case_name}]诉讼时效已过期，请立即处理！'
    elif days_left <= 3:
        title = '🔴 诉讼时效临近（3天内）'
        content = f'案件[{case.case_no} {case.case_name}]距诉讼时效截止还剩{days_left}天，紧急处理！'
    elif days_left <= 7:
        title = '🟠 诉讼时效临近（7天内）'
        content = f'案件[{case.case_no} {case.case_name}]距诉讼时效截止还剩{days_left}天。'
    elif days_left <= 15:
        title = '🟡 诉讼时效提醒（15天内）'
        content = f'案件[{case.case_no} {case.case_name}]距诉讼时效截止还剩{days_left}天。'
    else:
        title = '🔵 诉讼时效提醒'
        content = f'案件[{case.case_no} {case.case_name}]距诉讼时效截止还剩{days_left}天。'

    notif_level = 'critical' if days_left <= 0 else ('urgent' if days_left <= 7 else ('warning' if days_left <= 30 else 'info'))
    create_notification(
        recipient=lead,
        title=title,
        content=content,
        category='limitation_warning',
        level=notif_level,
        channel='in_app',
        related_case=case,
        push_channels=['in_app', 'app_push', 'sms'] if days_left <= 7 else ['in_app', 'app_push'],
        extra_data={'days_left': days_left, 'limitation_date': str(case.limitation_date) if case.limitation_date else None},
    )


def push_trial_reminder(trial, hours_before: int = 24):
    if trial.presiding_lawyer:
        user = trial.presiding_lawyer
        case_name = trial.case.case_name if trial.case else '未知案件'
        case_no = trial.case.case_no if trial.case else ''
        time_str = trial.start_time.strftime('%Y-%m-%d %H:%M') if trial.start_time else ''
        create_notification(
            recipient=user,
            title=f'📅 庭审提醒：{case_no}',
            content=f'您担任主办律师的案件[{case_name}]将于{time_str}在{trial.location or "指定地点"}开庭，请准时参加。',
            category='trial_reminder',
            level='urgent',
            channel='in_app',
            related_case=trial.case,
            related_trial=trial,
            push_channels=['in_app', 'app_push', 'sms'],
            extra_data={'hours_before': hours_before},
        )
