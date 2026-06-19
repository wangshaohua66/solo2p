import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import sys
sys.path.insert(0, sys_path)
django.setup()
from apps.users.models import User
from apps.cases.models import Case
from apps.clients.models import Client
from apps.billing.models import Settlement
from decimal import Decimal
from django.utils import timezone

client = Client.objects.first()
case = Case.objects.first()
admin = User.objects.get(username='admin')

settlements = [
    ('JS2026-0601', 15000, 15000, 'paid'),
    ('JS2026-0602', 28000, 8000, 'partial_paid'),
    ('JS2026-0603', 5600, 0, 'overdue'),
]
for no, amt, paid, status in settlements:
    s, created = Settlement.objects.get_or_create(
        settlement_no=no,
        defaults=dict(
            case=case,
            client=client,
            settlement_amount=Decimal(amt),
            paid_amount=Decimal(paid),
            unpaid_amount=Decimal(amt - paid),
            service_fee=Decimal(amt),
            subtotal=Decimal(amt),
            total_amount=Decimal(amt),
            period_start=timezone.now().date() - timezone.timedelta(days=30),
            period_end=timezone.now().date(),
            due_date=timezone.now().date() + timezone.timedelta(days=15),
            status=status,
            created_by=admin,
        )
    )
    print(no, 'created:', created)

print('结算单总数量:', Settlement.objects.count())

from apps.notifications.models import Notification
Notification.objects.all().delete()
lawyer = User.objects.filter(role='lawyer').first()
if lawyer:
    Notification.objects.create(
        recipient=lawyer, title='诉讼时效预警',
        content=f'案件[{case.case_name}]将于30天内过诉讼时效，请及时处理！',
        category='limitation_warning', level='urgent', channel='in_app',
        status='sent', related_case=case,
    )
    Notification.objects.create(
        recipient=lawyer, title='庭审提醒',
        content='明日上午9:30在朝阳区法院有开庭，请提前准备材料',
        category='trial_reminder', level='info', channel='in_app', status='sent',
    )
Notification.objects.create(
    recipient=admin, title='紧急：诉讼时效预警',
    content=f'案件[{case.case_name}]将于15天内过诉讼时效，请立即处理！',
    category='limitation_warning', level='urgent', channel='in_app',
    status='sent', related_case=case,
)
Notification.objects.create(
    recipient=admin, title='明日庭审提醒',
    content='明天上午09:30朝阳区法院第三法庭开庭，请提前准备证据原件、代理词和质证意见。',
    category='trial_reminder', level='warning', channel='in_app', status='sent',
)
Notification.objects.create(
    recipient=admin, title='费用到期提醒',
    content='客户恒信科技有一笔5600元律师费已逾期，请及时跟进催收。',
    category='billing_reminder', level='warning', channel='in_app', status='sent',
)
print('通知数量:', Notification.objects.count())
