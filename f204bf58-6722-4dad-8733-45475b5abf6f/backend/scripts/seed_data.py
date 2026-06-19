
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from apps.users.models import User
from apps.clients.models import Client
from apps.cases.models import Case, Party, Trial, Evidence
from apps.billing.models import WorkLog
from apps.documents.models import DocumentTemplate
from apps.clients.models import Contract
from datetime import date, timedelta, datetime, time
from decimal import Decimal
from django.utils import timezone

User.objects.filter(username='admin').delete()
admin = User.objects.create_superuser(
    username='admin',
    email='admin@lawfirm.com',
    password='Admin@123',
    first_name='系统',
    last_name='管理员',
    role='admin',
    phone='13800000000',
    department='行政部',
    status=True
)
print(f'✅ 管理员创建成功: admin / Admin@123')

partner = User.objects.create_user(
    username='partner01',
    password='Law@1234',
    first_name='张',
    last_name='明',
    role='partner',
    phone='13800000001',
    email='zhangming@lawfirm.com',
    department='民商法律部',
    position='高级合伙人',
    license_no='1101201510123456',
    hourly_rate=Decimal('1500'),
    status=True
)
lawyer1 = User.objects.create_user(
    username='lawyer01',
    password='Law@1234',
    first_name='李',
    last_name='建国',
    role='lawyer',
    phone='13800000010',
    email='lijianguo@lawfirm.com',
    department='民商法律部',
    position='专职律师',
    license_no='1101201810987654',
    hourly_rate=Decimal('800'),
    status=True
)
lawyer2 = User.objects.create_user(
    username='lawyer02',
    password='Law@1234',
    first_name='王',
    last_name='丽',
    role='lawyer',
    phone='13800000011',
    email='wangli@lawfirm.com',
    department='刑事法律部',
    position='专职律师',
    license_no='1101201811111222',
    hourly_rate=Decimal('1000'),
    status=True
)
assistant = User.objects.create_user(
    username='assist01',
    password='Law@1234',
    first_name='陈',
    last_name='小',
    role='assistant',
    phone='13800000020',
    email='chenxiao@lawfirm.com',
    department='民商法律部',
    position='律师助理',
    hourly_rate=Decimal('300'),
    status=True
)
print(f'✅ 创建5个用户: admin/partner01/lawyer01/lawyer02/assist01 (密码: Admin@123 / Law@1234)')

client1 = Client.objects.create(
    client_no='C20240001',
    client_name='北京恒信科技有限公司',
    client_type='company',
    vip_level='gold',
    id_type='unified_code',
    id_no='91110108MA00ABCD12',
    contact_person='赵总',
    phone='13900000001',
    email='zhaotong@hengxin.com',
    address='北京市海淀区中关村大街1号',
    legal_representative='赵通',
    industry='互联网科技',
    total_case_count=15,
    total_fee_amount=Decimal('850000'),
    unpaid_amount=Decimal('128500'),
    account_manager=partner,
    created_by=admin,
    remark='常年法律顾问单位，关系良好'
)
client2 = Client.objects.create(
    client_no='C20240002',
    client_name='刘伟',
    client_type='individual',
    vip_level='normal',
    id_type='id_card',
    id_no='110101198808081234',
    phone='13900000002',
    email='liuwei@example.com',
    address='北京市朝阳区望京SOHO T3',
    total_case_count=1,
    total_fee_amount=Decimal('25000'),
    unpaid_amount=Decimal('5000'),
    account_manager=lawyer1,
    created_by=admin,
)
print(f'✅ 创建2个客户')

today = date.today()
case1 = Case.objects.create(
    case_no='2024MS0001',
    case_name='北京恒信科技与伟达贸易合同纠纷案',
    case_type='civil',
    billing_type='fixed',
    fee_agreed=Decimal('50000'),
    priority='urgent',
    risk_level='medium',
    cause='买卖合同纠纷',
    amount=Decimal('1580000'),
    court='北京市朝阳区人民法院',
    judge='李明',
    judge_phone='010-12345678',
    accept_date=today - timedelta(days=30),
    filing_date=today - timedelta(days=20),
    status='handling',
    client=client1,
    lead_lawyer=lawyer1,
    assistant=assistant,
    created_by=admin,
    conflict_checked=True,
    case_summary='恒信科技向伟达贸易供应服务器设备，收货后伟达贸易以质量问题为由拖欠货款158万元。多次协商未果，准备起诉。',
    claim='1. 请求判决被告支付货款1,580,000元；\n2. 请求判决被告支付违约金及逾期利息；\n3. 诉讼费用由被告承担。',
)
Party.objects.create(case=case1, party_type='plaintiff', name='北京恒信科技有限公司', is_represented=True, id_type='unified_code', id_no='91110108MA00ABCD12', phone='13900000001')
Party.objects.create(case=case1, party_type='defendant', name='北京伟达贸易有限公司', is_represented=False, id_type='unified_code', id_no='91110105MA12345678')
Trial.objects.create(
    case=case1,
    trial_type='first_instance',
    trial_round=1,
    start_time=timezone.make_aware(datetime(today.year, today.month, today.day + 5, 9, 30)),
    duration=Decimal('3'),
    location='北京市朝阳区人民法院',
    courtroom='第七法庭',
    presiding_lawyer=lawyer1,
    notes='证据交换',
    created_by=admin,
)
for i, name in enumerate(['购销合同原件', '送货单签收记录', '银行转账凭证', '微信聊天记录', '律师函及送达凭证']):
    Evidence.objects.create(
        case=case1,
        evidence_name=name,
        evidence_type='document' if i < 3 else 'electronic',
        source='原告提供',
        prove_content='证明合同关系及欠款事实',
        page_count=i*3+5,
        storage_status='in_store',
        is_original=True,
        uploaded_by=admin,
        description='已与原件核对无误'
    )

case2 = Case.objects.create(
    case_no='2024XF0001',
    case_name='刘伟故意伤害刑事辩护案',
    case_type='criminal',
    billing_type='fixed',
    fee_agreed=Decimal('30000'),
    priority='critical',
    risk_level='high',
    cause='故意伤害罪（轻伤一级）',
    court='北京市东城区人民法院',
    judge='张法官',
    accept_date=today - timedelta(days=15),
    status='trial',
    client=client2,
    lead_lawyer=lawyer2,
    created_by=admin,
    conflict_checked=True,
    case_summary='被告人刘伟因琐事与他人发生冲突，致对方轻伤一级，已被取保候审，现审查起诉阶段。',
    defense='被告人具有自首情节，系初犯，积极赔偿已获得被害人谅解，请求法院从轻处罚并适用缓刑。',
)
Party.objects.create(case=case2, party_type='defendant', name='刘伟', is_represented=True, id_type='id_card', id_no='110101198808081234', phone='13900000002')
Party.objects.create(case=case2, party_type='victim', name='受害人孙某', is_represented=False)
Trial.objects.create(
    case=case2,
    trial_type='first_instance',
    trial_round=1,
    start_time=timezone.make_aware(datetime(today.year, today.month, today.day + 2, 14, 0)),
    duration=Decimal('2.5'),
    location='北京市东城区人民法院',
    courtroom='刑事第三法庭',
    presiding_lawyer=lawyer2,
    notes='公开开庭审理',
    created_by=admin,
)

case3 = Case.objects.create(
    case_no='2024MS0002',
    case_name='恒信科技劳动争议系列案（5件）',
    case_type='civil',
    billing_type='hourly',
    fee_agreed=Decimal('0'),
    priority='normal',
    risk_level='low',
    cause='违法解除劳动合同赔偿金纠纷',
    amount=Decimal('450000'),
    accept_date=today - timedelta(days=5),
    status='assigned',
    client=client1,
    lead_lawyer=lawyer1,
    assistant=assistant,
    created_by=admin,
    conflict_checked=True,
)

case4 = Case.objects.create(
    case_no='2024XZ0001',
    case_name='恒信科技行政复议及诉讼案',
    case_type='administrative',
    billing_type='fixed',
    fee_agreed=Decimal('80000'),
    priority='urgent',
    risk_level='medium',
    cause='工商行政处罚50万元不服',
    amount=Decimal('500000'),
    accept_date=today - timedelta(days=10),
    limit_date=today + timedelta(days=50),
    status='handling',
    client=client1,
    lead_lawyer=partner,
    created_by=admin,
    conflict_checked=True,
)

case5 = Case.objects.create(
    case_no='2024MS0003',
    case_name='某交通事故人身损害赔偿案',
    case_type='civil',
    billing_type='contingency',
    fee_agreed=Decimal('0'),
    retention_rate=Decimal('15'),
    priority='urgent',
    risk_level='high',
    cause='交通事故八级伤残索赔',
    amount=Decimal('680000'),
    court='北京市西城区人民法院',
    accept_date=today - timedelta(days=350),
    limit_date=today + timedelta(days=15),
    status='filing',
    client=client2,
    lead_lawyer=lawyer1,
    created_by=admin,
    conflict_checked=True,
)

Contract.objects.create(
    contract_no='HT20240101',
    contract_name='诉讼委托代理合同（恒信科技合同纠纷案）',
    contract_type='engagement',
    client=client1,
    case=case1,
    firm_signer=partner,
    total_amount=Decimal('50000'),
    paid_amount=Decimal('25000'),
    unpaid_amount=Decimal('25000'),
    effective_date=today - timedelta(days=30),
    expire_date=today + timedelta(days=180),
    payment_type='installment',
    status='effective',
    approval_status='approved',
    approved_by=admin,
    created_by=admin,
)

for i, (log_type, hours, desc, st, et) in enumerate([
    ('research', Decimal('3'), '检索整理相关法律法规及裁判文书', time(9, 30), time(12, 30)),
    ('conference', Decimal('1.5'), '主办律师团队案情讨论会', time(14, 0), time(15, 30)),
    ('drafting', Decimal('4'), '起草民事起诉状及证据清单', time(9, 0), time(13, 0)),
    ('communication', Decimal('2'), '与客户沟通确认诉讼策略，电话3次', time(15, 0), time(17, 0)),
    ('trial', Decimal('3.5'), '准备证据材料、质证意见、庭审提纲', time(9, 0), time(12, 30)),
]):
    WorkLog.objects.create(
        work_date=today - timedelta(days=i*2+1),
        start_time=st,
        end_time=et,
        duration=hours,
        work_type=log_type,
        work_content=desc,
        case=case1,
        client=client1,
        worker=lawyer1,
        hourly_rate=Decimal('800'),
        billable_status='billable',
        approval_status='approved',
        approved_by=partner,
        approved_at=timezone.now(),
        created_by=admin,
    )

for cat, name, desc in [
    ('civil_complaint', '民事起诉状', '适用于一般民事纠纷一审起诉'),
    ('civil_defense', '民事答辩状', '被告方应诉答辩使用'),
    ('civil_agent', '民事代理词', '律师庭审后提交代理意见'),
    ('criminal_defense', '刑事辩护词', '刑事案件被告人辩护词'),
    ('appellate', '民事上诉状', '不服一审判决上诉使用'),
    ('application', '执行申请书', '申请强制执行使用'),
    ('evidence', '证据清单模板', '庭审证据清单及目录'),
    ('contract', '委托代理合同', '事务所标准委托合同'),
    ('legal_opinion', '法律意见书', '专项问题法律咨询意见'),
    ('lawyer_letter', '律师函模板', '正式律师函催告/警告'),
    ('power_of_attorney', '授权委托书', '签署给律师的授权文件'),
    ('firm_internal', '案件结案报告', '事务所内部结案归档报告'),
]:
    DocumentTemplate.objects.create(
        template_code=f'TPL-{cat.upper()}-001',
        template_name=name,
        category=cat,
        case_type='all',
        description=desc,
        version='1.0',
        is_published=True,
        is_system=True,
        use_count=150 + hash(cat) % 300,
        rating=Decimal('4.7'),
        rating_count=42,
        owner=admin,
        content=f'<h1>{name}</h1><p>[模板说明] {desc}</p><p>模板文件已配置，可从案件详情一键生成。</p>',
        usage_instructions='请在案件管理中关联案件后使用，系统将自动填充当事人、案号等字段。',
    )

print(f'✅ 创建5个案件（含民商/刑事/行政/劳动/人身损害5大类）')
print(f'✅ 创建5条工时记录、9份当事人、6份证据、3次庭审安排')
print(f'✅ 创建12份法律文书模板')
print('\n' + '='*70)
print('🎉 演示数据初始化完成！系统可投入测试使用。')
print('='*70)
