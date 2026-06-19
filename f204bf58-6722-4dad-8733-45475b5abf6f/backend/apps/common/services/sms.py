import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _send_sms_aliyun(phone: str, template_code: str, template_param: dict, sign_name: str = None) -> bool:
    try:
        from aliyunsdkcore.client import AcsClient
        from aliyunsdkcore.request import CommonRequest
        from aliyunsdkcore.acs_exception.exceptions import ClientException, ServerException
        import json
    except ImportError as e:
        logger.warning(f'[SMS] 阿里云SDK未安装，使用Mock模式: {e}')
        return None

    cfg = settings.SMS_CONFIG.get('aliyun', {})
    ak = cfg.get('access_key_id', '')
    sk = cfg.get('access_key_secret', '')
    if not ak or not sk:
        logger.warning('[SMS] 阿里云AK/SK未配置，使用Mock模式')
        return None

    sign_name = sign_name or cfg.get('sign_name', '精诚律师事务所')

    try:
        client = AcsClient(ak, sk, 'cn-hangzhou')
        req = CommonRequest()
        req.set_accept_format('json')
        req.set_domain('dysmsapi.aliyuncs.com')
        req.set_method('POST')
        req.set_protocol_type('https')
        req.set_version('2017-05-25')
        req.set_action_name('SendSms')
        req.add_query_param('PhoneNumbers', phone)
        req.add_query_param('SignName', sign_name)
        req.add_query_param('TemplateCode', template_code)
        req.add_query_param('TemplateParam', json.dumps(template_param, ensure_ascii=False))
        resp = client.do_action_with_exception(req)
        result = json.loads(resp.decode('utf-8'))
        if result.get('Code') == 'OK':
            logger.info(f'[SMS] 阿里云发送成功: {phone} [{template_code}] BizId={result.get("BizId")}')
            return True
        else:
            logger.error(f'[SMS] 阿里云发送失败: {result.get("Code")} - {result.get("Message")}')
            return False
    except (ClientException, ServerException) as e:
        logger.error(f'[SMS] 阿里云SDK异常: {e.error_code} - {e.error_msg}')
        return False
    except Exception as e:
        logger.error(f'[SMS] 阿里云发送异常: {e}', exc_info=True)
        return False


def send_sms(phone: str, content: str = None, template_type: str = 'notification', **template_params) -> bool:
    if not settings.SMS_CONFIG.get('enabled', False):
        logger.info(f'[SMS Mock] 发送短信到 {phone}: {content[:60] if content else template_params}...')
        return True

    provider = settings.SMS_CONFIG.get('provider', 'aliyun')
    tpl_cfg = settings.SMS_CONFIG.get(provider, {}).get('templates', {})
    template_code = tpl_cfg.get(template_type, tpl_cfg.get('notification', ''))

    if template_type == 'verification':
        params = template_params or {'code': '123456'}
    elif template_type == 'trial_reminder':
        params = {
            'case_name': template_params.get('case_name', '案件'),
            'time': template_params.get('time', ''),
            'location': template_params.get('location', ''),
        }
    elif template_type == 'limitation_warning':
        params = {
            'case_name': template_params.get('case_name', '案件'),
            'days': str(template_params.get('days', 0)),
        }
    else:
        params = template_params or {'content': content or ''}

    if provider == 'aliyun':
        result = _send_sms_aliyun(phone, template_code, params)
        if result is not None:
            return result

    logger.info(f'[SMS Mock Fallback] 发送短信到 {phone}: {content[:60] if content else template_params}...')
    return True
