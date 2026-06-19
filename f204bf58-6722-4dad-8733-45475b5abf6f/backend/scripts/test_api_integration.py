import requests
import json

BASE_URL = 'http://localhost:8000/api'

r = requests.post(f'{BASE_URL}/auth/login/', json={'username': 'admin', 'password': 'Admin@123'})
token = r.json()['data']['access']
headers = {'Authorization': f'Bearer {token}'}

print('=' * 70)
print('API集成测试 - 4个真实服务API验证')
print('=' * 70)

print(f'\n{"-" * 70}')
print('测试1: 通知消息列表（后端Notification API）')
print('-' * 70)
r = requests.get(f'{BASE_URL}/notifications/?page_size=5', headers=headers)
data = r.json()
print(f'  code: {data.get("code")}')
for n in data.get('data', {}).get('results', [])[:3]:
    print(f'  - [{n["category"]}] {n["title"]} | 未读: {n["status"] != "read"}')

print(f'\n{"-" * 70}')
print('测试2: 证据OCR识别 API（无文件时应返回400错误）')
print('-' * 70)
r = requests.get(f'{BASE_URL}/cases/evidences/?page_size=1', headers=headers)
evid = r.json()['data']['results'][0]['id']
print(f'  选取证据ID: {evid}')
print(f'  证据有文件: {bool(r.json()["data"]["results"][0].get("file"))}')
r = requests.post(f'{BASE_URL}/cases/evidences/{evid}/ocr_recognize/',
    json={'ocr_type': 'idcard_front', 'lang': 'chinese_english'},
    headers=headers
)
data = r.json()
print(f'  code: {data.get("code")} (预期400，因为无文件)')
print(f'  message: {data.get("message")}')

print(f'\n{"-" * 70}')
print('测试3: 证据添加水印 API（无文件时应返回400错误）')
print('-' * 70)
r = requests.post(f'{BASE_URL}/cases/evidences/{evid}/add_watermark/',
    json={'text': '机密-精诚律师事务所', 'opacity': 0.3, 'position': 'diagonal',
          'font_size': 36, 'color': '#888888'},
    headers=headers
)
data = r.json()
print(f'  code: {data.get("code")} (预期400，因为无文件)')
print(f'  message: {data.get("message")}')

print(f'\n{"-" * 70}')
print('测试4: 通知测试推送 API（多渠道）')
print('-' * 70)
r = requests.post(f'{BASE_URL}/notifications/test_push/',
    json={'channels': ['in_app', 'sms', 'app_push']},
    headers=headers
)
data = r.json()
print(f'  code: {data.get("code")}')
print(f'  message: {data.get("message")}')
print(f'  status: {data.get("data", {}).get("status")}')

print(f'\n{"=" * 70}')
print('所有API测试完成！')
print('=' * 70)
