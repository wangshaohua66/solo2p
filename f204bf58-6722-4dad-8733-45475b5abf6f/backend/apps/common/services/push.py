import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _send_jpush_alias(alias: str, title: str, content: str, extras: dict = None) -> bool:
    try:
        import jpush
        from jpush import common
    except ImportError as e:
        logger.warning(f'[Push] 极光推送SDK未安装，使用Mock模式: {e}')
        return None

    cfg = settings.PUSH_CONFIG.get('jpush', {})
    app_key = cfg.get('app_key', '')
    master_secret = cfg.get('master_secret', '')
    if not app_key or not master_secret:
        logger.warning('[Push] 极光推送AppKey/MasterSecret未配置，使用Mock模式')
        return None

    production = cfg.get('production', False)

    try:
        _jpush = jpush.JPush(app_key, master_secret)
        _jpush.set_logging("WARNING")
        push = _jpush.create_push()
        push.audience = jpush.alias(alias)
        push.notification = jpush.notification(
            alert=content,
            android=jpush.android(
                alert=content,
                title=title,
                builder_id=1,
                extras=extras or {},
            ),
            ios=jpush.ios(
                alert=content,
                sound='default',
                badge='+1',
                extras=extras or {},
            )
        )
        push.message = jpush.message(
            msg_content=content,
            title=title,
            content_type='text',
            extras=extras or {},
        )
        push.options = {
            'time_to_live': 86400,
            'apns_production': production,
        }
        push.platform = jpush.all_
        resp = push.send()
        if resp.status_code == 200:
            logger.info(f'[Push] 极光推送成功: alias={alias} msg_id={resp.payload.get("msg_id")}')
            return True
        else:
            logger.error(f'[Push] 极光推送失败: HTTP {resp.status_code} - {resp.payload}')
            return False
    except common.JPushFailure as e:
        logger.error(f'[Push] 极光推送失败: {e.response.status_code} - {e.response.payload}')
        return False
    except Exception as e:
        logger.error(f'[Push] 极光推送异常: {e}', exc_info=True)
        return False


def send_app_push(user, content: str, title: str = None, extras: dict = None) -> bool:
    if not settings.PUSH_CONFIG.get('enabled', False):
        logger.info(f'[APP Push Mock] 推送给 {user.username}: {content[:60]}...')
        return True

    provider = settings.PUSH_CONFIG.get('provider', 'jpush')
    alias = user.username
    push_title = title or '律所案件管理系统'

    if provider == 'jpush':
        result = _send_jpush_alias(alias, push_title, content, extras)
        if result is not None:
            return result

    logger.info(f'[APP Push Mock Fallback] 推送给 {user.username}: {content[:60]}...')
    return True
