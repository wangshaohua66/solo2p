from django.db import models
from django.core.validators import RegexValidator


class Client(models.Model):
    CLIENT_TYPE_CHOICES = [
        ('individual', '个人客户'),
        ('company', '企业客户'),
        ('government', '政府机构'),
        ('organization', '社会组织'),
    ]
    VIP_LEVEL_CHOICES = [
        ('normal', '普通'),
        ('silver', '白银'),
        ('gold', '黄金'),
        ('platinum', '铂金'),
        ('diamond', '钻石'),
    ]
    ID_TYPE_CHOICES = [
        ('id_card', '身份证'),
        ('passport', '护照'),
        ('business_license', '营业执照'),
        ('unified_code', '统一社会信用代码'),
        ('other', '其他'),
    ]

    client_no = models.CharField(max_length=30, unique=True, verbose_name='客户编号')
    client_name = models.CharField(max_length=200, verbose_name='客户姓名/名称')
    client_type = models.CharField(max_length=20, choices=CLIENT_TYPE_CHOICES, verbose_name='客户类型')
    vip_level = models.CharField(max_length=20, choices=VIP_LEVEL_CHOICES, default='normal', verbose_name='会员等级')
    id_type = models.CharField(max_length=20, choices=ID_TYPE_CHOICES, verbose_name='证件类型', blank=True)
    id_no = models.CharField(max_length=50, verbose_name='证件号码', blank=True, db_index=True)
    is_company = models.BooleanField(default=False, verbose_name='是否企业')
    legal_representative = models.CharField(max_length=50, verbose_name='法定代表人', blank=True)
    industry = models.CharField(max_length=100, verbose_name='所属行业', blank=True)
    registered_capital = models.DecimalField(max_digits=18, decimal_places=2, default=0, verbose_name='注册资本(万元)')
    established_date = models.DateField(blank=True, null=True, verbose_name='成立日期')
    phone = models.CharField(
        max_length=20,
        validators=[RegexValidator(r'^1[3-9]\d{9}$', '手机号格式错误')],
        verbose_name='联系电话',
        blank=True
    )
    email = models.EmailField(verbose_name='电子邮箱', blank=True)
    address = models.CharField(max_length=300, verbose_name='通讯地址', blank=True)
    website = models.URLField(verbose_name='企业官网', blank=True)
    wechat = models.CharField(max_length=50, verbose_name='微信号', blank=True)
    emergency_contact = models.CharField(max_length=50, verbose_name='紧急联系人', blank=True)
    emergency_phone = models.CharField(max_length=20, verbose_name='紧急联系电话', blank=True)
    contact_person = models.CharField(max_length=50, verbose_name='主要联系人', blank=True)
    contact_position = models.CharField(max_length=50, verbose_name='联系人职务', blank=True)
    account_manager = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='managed_clients',
        verbose_name='客户经理',
        blank=True,
        null=True
    )
    billing_address = models.CharField(max_length=300, verbose_name='开票地址', blank=True)
    tax_no = models.CharField(max_length=50, verbose_name='税号', blank=True)
    bank_name = models.CharField(max_length=100, verbose_name='开户银行', blank=True)
    bank_account = models.CharField(max_length=50, verbose_name='银行账号', blank=True)
    total_case_count = models.IntegerField(default=0, verbose_name='历史案件数')
    total_fee_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='累计律师费(元)')
    unpaid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='待收金额(元)')
    credit_rating = models.IntegerField(default=80, verbose_name='信用评分')
    credit_limit = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='信用额度(元)')
    source = models.CharField(max_length=100, verbose_name='客户来源', blank=True)
    intro_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='introduced',
        verbose_name='介绍人'
    )
    portal_enabled = models.BooleanField(default=False, verbose_name='开通客户门户')
    portal_username = models.CharField(max_length=50, unique=True, null=True, blank=True, verbose_name='门户账号')
    portal_password = models.CharField(max_length=128, blank=True, verbose_name='门户密码(加密)')
    portal_last_login = models.DateTimeField(null=True, blank=True, verbose_name='门户最后登录')
    remark = models.TextField(blank=True, verbose_name='备注')
    is_active = models.BooleanField(default=True, verbose_name='是否有效')
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='created_clients',
        verbose_name='创建人'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'client_client'
        verbose_name = '客户'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['client_type', 'vip_level']),
            models.Index(fields=['client_no']),
        ]

    def __str__(self):
        return f'{self.client_no} {self.client_name}'

    def save(self, *args, **kwargs):
        if not self.client_no:
            from django.utils import timezone
            prefix = 'C' if self.client_type == 'individual' else 'E'
            year = timezone.now().year
            count = Client.objects.filter(created_at__year=year).count() + 1
            self.client_no = f'{prefix}{year}{count:06d}'
        super().save(*args, **kwargs)


class Contract(models.Model):
    CONTRACT_TYPE_CHOICES = [
        ('retainer', '常年法律顾问合同'),
        ('engagement', '诉讼委托合同'),
        ('non_litigation', '非诉委托合同'),
        ('criminal', '刑事辩护合同'),
        ('labor', '劳动仲裁合同'),
        ('other', '其他合同'),
    ]
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('reviewing', '审批中'),
        ('signed', '已签署'),
        ('effective', '履行中'),
        ('expired', '已到期'),
        ('terminated', '已解除'),
    ]
    PAYMENT_TYPE_CHOICES = [
        ('lump_sum', '一次性支付'),
        ('installment', '分期支付'),
        ('hourly', '按小时计费'),
        ('contingency', '风险代理'),
        ('mixed', '混合模式'),
    ]

    contract_no = models.CharField(max_length=50, unique=True, verbose_name='合同编号')
    contract_name = models.CharField(max_length=200, verbose_name='合同名称')
    contract_type = models.CharField(max_length=30, choices=CONTRACT_TYPE_CHOICES, verbose_name='合同类型')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='合同状态')
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='contracts', verbose_name='委托方(客户)')
    client_signer = models.CharField(max_length=50, verbose_name='客户签约人', blank=True)
    firm_signer = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='signed_contracts',
        verbose_name='律所签约人'
    )
    case = models.ForeignKey(
        'cases.Case',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contracts',
        verbose_name='关联案件'
    )
    scope = models.TextField(verbose_name='服务范围/事项', blank=True)
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, verbose_name='付款方式')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='合同总金额(元)')
    deposit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='定金金额(元)')
    retainer_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='律师费金额(元)')
    contingency_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name='风险比例(%)')
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='已付金额(元)')
    unpaid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='未付金额(元)')
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='小时费率(元)')
    included_hours = models.DecimalField(max_digits=8, decimal_places=1, default=0, verbose_name='包含工时(小时)')
    effective_date = models.DateField(verbose_name='生效日期')
    expire_date = models.DateField(verbose_name='到期日期')
    sign_date = models.DateField(blank=True, null=True, verbose_name='签署日期')
    file = models.FileField(upload_to='contracts/', blank=True, verbose_name='合同文件')
    template_used = models.ForeignKey(
        'documents.DocumentTemplate',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contracts',
        verbose_name='使用模板'
    )
    auto_renew = models.BooleanField(default=False, verbose_name='自动续约')
    renewal_period = models.IntegerField(default=12, verbose_name='续约周期(月)')
    approval_status = models.CharField(
        max_length=20,
        choices=[('pending', '待审批'), ('approved', '已通过'), ('rejected', '已驳回')],
        default='pending',
        verbose_name='审批状态'
    )
    approved_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='approved_contracts',
        null=True,
        blank=True,
        verbose_name='审批人'
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='审批时间')
    approval_note = models.TextField(blank=True, verbose_name='审批意见')
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='created_contracts',
        verbose_name='创建人'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'client_contract'
        verbose_name = '委托合同'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.contract_no} {self.contract_name}'

    def save(self, *args, **kwargs):
        if not self.contract_no:
            from django.utils import timezone
            prefix_map = {
                'retainer': 'GL', 'engagement': 'SS', 'non_litigation': 'FS',
                'criminal': 'XB', 'labor': 'LD', 'other': 'QT'
            }
            prefix = prefix_map.get(self.contract_type, 'HT')
            year = timezone.now().year
            count = Contract.objects.filter(created_at__year=year).count() + 1
            self.contract_no = f'{prefix}{year}{count:06d}'
        super().save(*args, **kwargs)


class PaymentPlan(models.Model):
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='payment_plans', verbose_name='合同')
    installment_no = models.IntegerField(verbose_name='期次')
    due_date = models.DateField(verbose_name='应付日期')
    amount = models.DecimalField(max_digits=15, decimal_places=2, verbose_name='应付金额(元)')
    actual_date = models.DateField(null=True, blank=True, verbose_name='实付日期')
    actual_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='实付金额(元)')
    status = models.CharField(
        max_length=20,
        choices=[('pending', '待支付'), ('partial', '部分支付'), ('paid', '已支付'), ('overdue', '已逾期')],
        default='pending',
        verbose_name='状态'
    )
    payment_method = models.CharField(
        max_length=20,
        choices=[('bank', '银行转账'), ('cash', '现金'), ('check', '支票'), ('online', '在线支付'), ('other', '其他')],
        blank=True,
        verbose_name='付款方式'
    )
    voucher_no = models.CharField(max_length=100, blank=True, verbose_name='凭证号')
    invoice_no = models.CharField(max_length=50, blank=True, verbose_name='发票号')
    remark = models.TextField(blank=True, verbose_name='备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'client_payment_plan'
        verbose_name = '付款计划'
        verbose_name_plural = verbose_name
        ordering = ['installment_no']
        unique_together = ['contract', 'installment_no']
