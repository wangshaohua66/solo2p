import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from django.conf import settings
from apps.common.services import send_sms, send_app_push, ocr_recognize, add_watermark, OCR_TYPES
from apps.users.models import User

print('=' * 60)
print('服务集成测试（配置为空时优雅降级到Mock）')
print('=' * 60)
print(f'\n配置状态：')
print(f'  短信服务: enabled={settings.SMS_CONFIG.get("enabled")}, provider={settings.SMS_CONFIG.get("provider")}')
print(f'  OCR服务:  enabled={settings.OCR_CONFIG.get("enabled")}, provider={settings.OCR_CONFIG.get("provider")}')
print(f'  推送服务: enabled={settings.PUSH_CONFIG.get("enabled")}, provider={settings.PUSH_CONFIG.get("provider")}')

admin = User.objects.filter(username='admin').first()

print(f'\n{"-" * 60}')
print('测试1: 短信发送（验证码类）')
print('-' * 60)
result = send_sms('13800138000', template_type='verification', code='123456')
print(f'  结果: {result} (True=发送成功/Mock)')

print(f'\n{"-" * 60}')
print('测试2: 短信发送（庭审通知类）')
print('-' * 60)
result = send_sms('13800138000', template_type='trial_reminder',
                  case_name='张三诉李四合同纠纷案',
                  time='2026-06-20 09:30',
                  location='朝阳区法院第三法庭')
print(f'  结果: {result}')

print(f'\n{"-" * 60}')
print('测试3: APP推送')
print('-' * 60)
result = send_app_push(admin, '您有新的案件预警需要处理',
                       title='案件预警通知',
                       extras={'case_id': 1, 'type': 'limitation_warning'})
print(f'  结果: {result}')

print(f'\n{"-" * 60}')
print('测试4: OCR识别 - 通用文字')
print('-' * 60)
img_path = '/tmp/test_ocr.png'
img = Image.new('RGB', (400, 100), color=(255, 255, 255))
draw = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', 24)
except Exception:
    font = ImageFont.load_default()
draw.text((10, 10), '合同编号: HT-2024-0001', fill=(0, 0, 0), font=font)
draw.text((10, 40), '甲方: 北京精诚律师事务所', fill=(0, 0, 0), font=font)
img.save(img_path)
print(f'  测试图片已生成: {img_path}')

with open(img_path, 'rb') as f:
    class MockFile:
        def __init__(self, fileobj, name):
            self._file = fileobj
            self.name = name
        def read(self):
            return self._file.read()
        def seek(self, pos):
            return self._file.seek(pos)
    mock_file = MockFile(f, 'test_contract.png')
    result = ocr_recognize(mock_file, ocr_type='general', lang='chinese_english')
print(f'  成功: {result.get("success")}')
print(f'  行数: {result.get("words_count")}')
print(f'  内容预览:\n{result.get("content", "")[:300]}')

print(f'\n{"-" * 60}')
print('测试5: OCR识别 - 身份证正面')
print('-' * 60)
with open(img_path, 'rb') as f:
    mock_file = MockFile(f, 'id_card_front.jpg')
    result = ocr_recognize(mock_file, ocr_type='idcard_front')
print(f'  成功: {result.get("success")}')
print(f'  内容预览:\n{result.get("content", "")[:300]}')

print(f'\n{"-" * 60}')
print('测试6: OCR识别 - 驾驶证')
print('-' * 60)
with open(img_path, 'rb') as f:
    mock_file = MockFile(f, 'driving_license.jpg')
    result = ocr_recognize(mock_file, ocr_type='driving_license')
print(f'  成功: {result.get("success")}')
print(f'  内容预览:\n{result.get("content", "")[:300]}')

print(f'\n{"-" * 60}')
print('测试7: OCR识别 - 营业执照')
print('-' * 60)
with open(img_path, 'rb') as f:
    mock_file = MockFile(f, 'business_license.jpg')
    result = ocr_recognize(mock_file, ocr_type='business_license')
print(f'  成功: {result.get("success")}')
print(f'  内容预览:\n{result.get("content", "")[:300]}')

print(f'\n{"-" * 60}')
print('测试8: 图片水印 - 斜角铺底')
print('-' * 60)
img_path2 = '/tmp/test_wm_src.png'
img2 = Image.new('RGB', (800, 600), color=(240, 248, 255))
img2.save(img_path2)
result = add_watermark(img_path2, '机密 - 精诚律师事务所 - 仅供本案使用',
                       opacity=0.3, position='diagonal', font_size=36, color='#888888')
print(f'  成功: {result.get("success")}')
print(f'  输出文件: {result.get("file_path")}')
print(f'  文件存在: {os.path.exists(result.get("file_path", ""))}')

print(f'\n{"-" * 60}')
print('测试9: 图片水印 - 右下角')
print('-' * 60)
result = add_watermark(img_path2, '精诚律师事务所',
                       opacity=0.5, position='bottom_right', font_size=24, color='#ff0000')
print(f'  成功: {result.get("success")}')
print(f'  输出文件: {result.get("file_path")}')

print(f'\n{"-" * 60}')
print('测试10: PDF水印 - 斜角铺底')
print('-' * 60)
from reportlab.pdfgen import canvas
pdf_path = '/tmp/test_wm_src.pdf'
c = canvas.Canvas(pdf_path, pagesize=(595, 842))
c.setFont('Helvetica', 20)
c.drawString(100, 750, 'Test Document - Page 1')
c.drawString(100, 720, 'This is a test PDF for watermark.')
c.showPage()
c.drawString(100, 750, 'Test Document - Page 2')
c.showPage()
c.save()
print(f'  测试PDF已生成: {pdf_path}')
result = add_watermark(pdf_path, '机密 - 仅供内部使用',
                       opacity=0.25, position='diagonal', font_size=40, color='#666666')
print(f'  成功: {result.get("success")}')
print(f'  输出文件: {result.get("file_path")}')
print(f'  文件存在: {os.path.exists(result.get("file_path", ""))}')

print(f'\n{"=" * 60}')
print('所有测试完成！支持的OCR识别类型:')
for k, v in OCR_TYPES.items():
    print(f'  {k}: {v}')
print('=' * 60)
