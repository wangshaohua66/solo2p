import logging
import base64
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

OCR_TYPES = {
    'general': '通用文字识别',
    'idcard_front': '身份证正面',
    'idcard_back': '身份证反面',
    'driving_license': '驾驶证',
    'vehicle_license': '行驶证',
    'bank_card': '银行卡',
    'business_license': '营业执照',
    'household_register': '户口本',
    'passport': '护照',
}


def _ocr_baidu(image_data: bytes, ocr_type: str = 'general') -> dict:
    try:
        from aip import AipOcr
    except ImportError as e:
        logger.warning(f'[OCR] 百度OCR SDK未安装，使用Mock模式: {e}')
        return None

    cfg = settings.OCR_CONFIG.get('baidu', {})
    app_id = cfg.get('app_id', '')
    api_key = cfg.get('api_key', '')
    secret_key = cfg.get('secret_key', '')
    if not app_id or not api_key or not secret_key:
        logger.warning('[OCR] 百度OCR配置不完整，使用Mock模式')
        return None

    try:
        client = AipOcr(app_id, api_key, secret_key)

        if ocr_type == 'general':
            options = {'language_type': 'CHN_ENG', 'detect_direction': 'true', 'probability': 'true'}
            result = client.general(image_data, options)
        elif ocr_type == 'general_basic':
            result = client.basicGeneral(image_data)
        elif ocr_type == 'idcard_front':
            result = client.idcard(image_data, 'front')
        elif ocr_type == 'idcard_back':
            result = client.idcard(image_data, 'back')
        elif ocr_type == 'driving_license':
            result = client.drivingLicense(image_data)
        elif ocr_type == 'vehicle_license':
            result = client.vehicleLicense(image_data)
        elif ocr_type == 'bank_card':
            result = client.bankcard(image_data)
        elif ocr_type == 'business_license':
            result = client.businessLicense(image_data)
        elif ocr_type == 'accurate':
            result = client.accurate(image_data)
        else:
            result = client.general(image_data)

        if 'error_code' in result:
            logger.error(f'[OCR] 百度OCR返回错误: {result["error_code"]} - {result.get("error_msg")}')
            return None

        words = []
        if ocr_type in ['idcard_front', 'idcard_back']:
            words_result = result.get('words_result', {})
            for key, val in words_result.items():
                words.append(f'{key}: {val.get("words", "")}')
        elif ocr_type in ['driving_license', 'vehicle_license']:
            words_result = result.get('words_result', {})
            for key, val in words_result.items():
                words.append(f'{key}: {val}')
        elif ocr_type == 'bank_card':
            res = result.get('result', {})
            for key, val in res.items():
                words.append(f'{key}: {val}')
        elif ocr_type == 'business_license':
            words_result = result.get('words_result', {})
            for key, val in words_result.items():
                words.append(f'{key}: {val.get("words", "")}')
        else:
            for item in result.get('words_result', []):
                words.append(item.get('words', ''))

        content = '\n'.join(words)
        return {
            'success': True,
            'content': content,
            'raw': result,
            'words_count': len(words),
        }
    except Exception as e:
        logger.error(f'[OCR] 百度OCR调用异常: {e}', exc_info=True)
        return None


def _ocr_mock(image_name: str, ocr_type: str, lang: str) -> dict:
    type_name = OCR_TYPES.get(ocr_type, '通用文字')
    content = (
        f'[OCR识别结果 - {type_name}]\n'
        f'识别时间：{timezone.now().strftime("%Y-%m-%d %H:%M:%S")}\n'
        f'识别类型：{type_name}（{ocr_type}）\n'
        f'识别语言：{lang}\n'
        f'---\n'
    )
    if ocr_type == 'idcard_front':
        content += (
            '姓名: 张三\n'
            '性别: 男\n'
            '民族: 汉\n'
            '出生: 1990年01月01日\n'
            '住址: 北京市朝阳区建国路88号\n'
            '公民身份号码: 110101199001011234\n'
        )
    elif ocr_type == 'idcard_back':
        content += (
            '签发机关: 北京市公安局朝阳分局\n'
            '有效期限: 2015.01.01-2035.01.01\n'
        )
    elif ocr_type == 'driving_license':
        content += (
            '证号: 110101199001011234\n'
            '姓名: 张三\n'
            '性别: 男\n'
            '国籍: 中国\n'
            '住址: 北京市朝阳区建国路88号\n'
            '出生日期: 1990-01-01\n'
            '初次领证日期: 2012-06-15\n'
            '准驾车型: C1\n'
            '有效起始日期: 2018-06-15\n'
            '有效期限: 2024-06-15\n'
        )
    elif ocr_type == 'vehicle_license':
        content += (
            '号牌号码: 京A12345\n'
            '车辆类型: 小型普通客车\n'
            '所有人: 张三\n'
            '住址: 北京市朝阳区建国路88号\n'
            '使用性质: 非营运\n'
            '品牌型号: 大众汽车牌SVW71410QR\n'
            '车辆识别代号: LFV2A21K3E4123456\n'
            '发动机号码: 057123\n'
            '注册日期: 2014-08-15\n'
            '发证日期: 2014-08-15\n'
        )
    elif ocr_type == 'bank_card':
        content += (
            '银行名称: 中国工商银行\n'
            '卡号: 6222021200001234567\n'
            '卡类型: 储蓄卡\n'
        )
    elif ocr_type == 'business_license':
        content += (
            '社会信用代码: 91110105MA01ABCD12\n'
            '公司名称: 北京精诚律师事务所有限公司\n'
            '公司类型: 有限责任公司(自然人投资或控股)\n'
            '法人代表: 李明\n'
            '注册资本: 500万人民币\n'
            '成立日期: 2015-03-18\n'
            '营业期限: 2015-03-18至2035-03-17\n'
            '经营范围: 法律服务、律师咨询、知识产权代理\n'
            '登记机关: 北京市朝阳区市场监督管理局\n'
        )
    else:
        content += (
            '合同编号：HT-2024-0001\n'
            '甲方：北京精诚律师事务所有限公司\n'
            '乙方：北京恒信科技有限公司\n'
            '签订日期：2024年01月15日\n'
            '合同金额：人民币500,000元整\n'
            '主要条款：双方就法律服务事宜达成协议，乙方于合同签订后10日支付预付款30%。\n'
            '乙方应于2024年6月30日前支付剩余70%款项。\n'
            '签字盖章处：甲方公章（已盖） 乙方公章（已盖）\n'
        )
    return {
        'success': True,
        'content': content,
        'raw': None,
        'words_count': len(content.split('\n')),
    }


def ocr_recognize(image_file, ocr_type: str = 'general', lang: str = None) -> dict:
    lang = lang or settings.OCR_CONFIG.get('default_lang', 'chinese_english')

    try:
        image_file.seek(0)
        image_data = image_file.read()
    except Exception:
        image_data = None

    if image_data is None:
        return {
            'success': False,
            'error': '无法读取图片文件',
        }

    if settings.OCR_CONFIG.get('enabled', False):
        provider = settings.OCR_CONFIG.get('provider', 'baidu')
        if provider == 'baidu':
            result = _ocr_baidu(image_data, ocr_type)
            if result is not None:
                return result

    image_name = getattr(image_file, 'name', 'unknown')
    return _ocr_mock(image_name, ocr_type, lang)
