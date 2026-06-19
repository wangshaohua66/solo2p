from django.db import models
from decimal import Decimal


class WorkLog(models.Model):
    WORK_TYPE_CHOICES = [
        ('consultation', '法律咨询'),
        ('meeting', '客户会见'),
        ('research', '法律研究'),
        ('drafting', '文书起草'),
        ('reviewing', '文件审阅'),
        ('negotiation', '谈判协商'),
        ('trial', '开庭审理'),
        ('evidence', '证据整理'),
        ('filing', '立案/归档'),
        ('execution', '执行事务'),
        ('travel', '出差交通'),
        ('communication', '电话/邮件沟通'),
        ('conference', '案件研讨'),
        ('training', '培训学习'),
        ('admin', '行政事务'),
        ('other', '其他工作'),
    ]
    BILLABLE_CHOICES = [
        ('billable', '可计费'),
        ('non_billable', '不计费'),
        ('no_charge', '优惠免费'),
        ('contingency', '风险代理计时'),
    ]
    APPROVAL_STATUS = [
        ('draft', '草稿'),
        ('submitted', '已提交'),
        ('approved', '已确认'),
        ('rejected', '已驳回'),
        ('adjusted', '已调整'),
    ]

    work_date = models.DateField(verbose_name='工作日期')
    start_time = models.TimeField(verbose_name='开始时间')
    end_time = models.TimeField(verbose_name='结束时间')
    duration = models.DecimalField(max_digits=6, decimal_places=2, verbose_name='工时(小时)')
    overtime_duration = models.DecimalField(max_digits=6, decimal_places=2, default=0, verbose_name='加班工时')
    weekend_duration = models.DecimalField(max_digits=6, decimal_places=2, default=0, verbose_name='周末工时')
    holiday_duration = models.DecimalField(max_digits=6, decimal_places=2, default=0, verbose_name='节假日工时')
    work_type = models.CharField(max_length=30, choices=WORK_TYPE_CHOICES, verbose_name='工作类型')
    work_content = models.TextField(verbose_name='工作内容描述')
    case = models.ForeignKey(
        'cases.Case',
        on_delete=models.CASCADE,
        related_name='work_logs',
        verbose_name='关联案件'
    )
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='work_logs',
        verbose_name='关联客户'
    )
    contract = models.ForeignKey(
        'clients.Contract',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_logs',
        verbose_name='关联合同'
    )
    worker = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='work_logs',
        verbose_name='工作人员'
    )
    participants = models.ManyToManyField(
        'users.User',
        related_name='joined_work_logs',
        verbose_name='参与人员',
        blank=True
    )
    billable_status = models.CharField(max_length=20, choices=BILLABLE_CHOICES, default='billable', verbose_name='计费状态')
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='适用小时费率(元)')
    overtime_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.5'), verbose_name='加班倍率')
    weekend_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('2.0'), verbose_name='周末倍率')
    holiday_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('3.0'), verbose_name='节假日倍率')
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('100.00'), verbose_name='折扣率(%)')
    billable_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='应计费金额(元)')
    actual_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='实际计费金额(元)')
    location = models.CharField(max_length=200, verbose_name='工作地点', blank=True)
    travel_expense = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='差旅费(元)')
    other_expense = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='其他费用(元)')
    expense_voucher = models.FileField(upload_to='work_logs/expenses/', blank=True, verbose_name='费用凭证')
    remark = models.TextField(blank=True, verbose_name='备注')
    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS, default='draft', verbose_name='确认状态')
    approved_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='approved_work_logs',
        null=True,
        blank=True,
        verbose_name='确认人'
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='确认时间')
    approval_note = models.TextField(blank=True, verbose_name='确认意见')
    billed = models.BooleanField(default=False, verbose_name='已开票')
    invoice_no = models.CharField(max_length=50, blank=True, verbose_name='发票号')
    settlement_ref = models.CharField(max_length=50, blank=True, verbose_name='结算单号')
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='created_work_logs',
        verbose_name='录入人'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='录入时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'billing_work_log'
        verbose_name = '工时记录'
        verbose_name_plural = verbose_name
        ordering = ['-work_date', '-created_at']
        indexes = [
            models.Index(fields=['case', 'work_date']),
            models.Index(fields=['worker', 'work_date']),
            models.Index(fields=['approval_status', 'billed']),
        ]

    def __str__(self):
        return f'{self.work_date} {self.worker.get_full_name()} {self.get_work_type_display()}'

    def calculate_amount(self):
        normal = Decimal(str(self.duration)) - self.overtime_duration - self.weekend_duration - self.holiday_duration
        if normal < 0:
            normal = Decimal(str(self.duration))
        rate = Decimal(str(self.hourly_rate if self.hourly_rate > 0 else self.worker.hourly_rate))
        discount = self.discount_percent / Decimal('100')
        self.billable_amount = (
            (normal * rate)
            + (self.overtime_duration * rate * self.overtime_rate)
            + (self.weekend_duration * rate * self.weekend_rate)
            + (self.holiday_duration * rate * self.holiday_rate)
        )
        if self.billable_status == 'non_billable':
            self.actual_amount = 0
        elif self.billable_status == 'no_charge':
            self.actual_amount = 0
        else:
            self.actual_amount = self.billable_amount * discount
        return self.actual_amount

    def save(self, *args, **kwargs):
        if self.start_time and self.end_time:
            import datetime as dt
            start = dt.datetime.combine(dt.date.today(), self.start_time)
            end = dt.datetime.combine(dt.date.today(), self.end_time)
            if end < start:
                end += dt.timedelta(days=1)
            self.duration = Decimal(str((end - start).total_seconds() / 3600))
        if self.billable_status != 'non_billable':
            self.calculate_amount()
        super().save(*args, **kwargs)


class Invoice(models.Model):
    INVOICE_TYPE_CHOICES = [
        ('vat_special', '增值税专用发票'),
        ('vat_general', '增值税普通发票'),
        ('electronic_special', '电子专用发票'),
        ('electronic_general', '电子普通发票'),
    ]
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('issued', '已开具'),
        ('sent', '已寄出'),
        ('received', '客户已收'),
        ('red_flushed', '已红冲'),
        ('cancelled', '已作废'),
    ]

    invoice_no = models.CharField(max_length=50, unique=True, verbose_name='发票号')
    invoice_code = models.CharField(max_length=50, blank=True, verbose_name='发票代码')
    invoice_type = models.CharField(max_length=30, choices=INVOICE_TYPE_CHOICES, verbose_name='发票类型')
    issue_date = models.DateField(auto_now_add=True, verbose_name='开票日期')
    client = models.ForeignKey('clients.Client', on_delete=models.PROTECT, related_name='invoices', verbose_name='购买方(客户)')
    buyer_name = models.CharField(max_length=200, verbose_name='购买方名称')
    buyer_tax_no = models.CharField(max_length=50, verbose_name='购买方税号')
    buyer_address = models.CharField(max_length=300, blank=True, verbose_name='购买方地址')
    buyer_phone = models.CharField(max_length=20, blank=True, verbose_name='购买方电话')
    buyer_bank = models.CharField(max_length=100, blank=True, verbose_name='购买方开户行')
    buyer_bank_account = models.CharField(max_length=50, blank=True, verbose_name='购买方账号')
    seller_name = models.CharField(max_length=200, default='[律所名称]', verbose_name='销售方名称')
    seller_tax_no = models.CharField(max_length=50, verbose_name='销售方税号')
    seller_address = models.CharField(max_length=300, verbose_name='销售方地址')
    seller_phone = models.CharField(max_length=20, verbose_name='销售方电话')
    seller_bank = models.CharField(max_length=100, verbose_name='销售方开户行')
    seller_bank_account = models.CharField(max_length=50, verbose_name='销售方账号')
    items = models.JSONField(default=list, verbose_name='开票项目明细')
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='价税合计(元)')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('6.00'), verbose_name='税率(%)')
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='税额(元)')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='合计金额(元)')
    related_case = models.ForeignKey(
        'cases.Case',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices',
        verbose_name='关联案件'
    )
    related_contract = models.ForeignKey(
        'clients.Contract',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices',
        verbose_name='关联合同'
    )
    work_logs = models.ManyToManyField(WorkLog, related_name='invoices', verbose_name='关联工时', blank=True)
    settlement = models.ForeignKey(
        'Settlement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices',
        verbose_name='关联结算单'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='发票状态')
    delivery_method = models.CharField(
        max_length=20,
        choices=[('email', '电子发送'), ('express', '快递邮寄'), ('pickup', '自取'), ('other', '其他')],
        default='email',
        verbose_name='交付方式'
    )
    sent_date = models.DateField(null=True, blank=True, verbose_name='寄出/发送日期')
    courier_company = models.CharField(max_length=50, blank=True, verbose_name='快递公司')
    tracking_no = models.CharField(max_length=50, blank=True, verbose_name='快递单号')
    receiver_email = models.EmailField(blank=True, verbose_name='接收邮箱')
    received_date = models.DateField(null=True, blank=True, verbose_name='收票日期')
    note = models.TextField(blank=True, verbose_name='备注')
    red_flushed_invoice = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, verbose_name='红冲原发票')
    file = models.FileField(upload_to='invoices/', blank=True, verbose_name='发票文件')
    created_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='created_invoices', verbose_name='开票人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'billing_invoice'
        verbose_name = '发票'
        verbose_name_plural = verbose_name
        ordering = ['-issue_date']


class Settlement(models.Model):
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('reviewing', '审核中'),
        ('approved', '已批准'),
        ('invoicing', '开票中'),
        ('completed', '已完成'),
        ('partial_paid', '部分到账'),
        ('paid', '全额到账'),
        ('overdue', '已逾期'),
    ]

    settlement_no = models.CharField(max_length=50, unique=True, verbose_name='结算单号')
    client = models.ForeignKey('clients.Client', on_delete=models.PROTECT, related_name='settlements', verbose_name='客户')
    case = models.ForeignKey(
        'cases.Case',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settlements',
        verbose_name='关联案件'
    )
    contract = models.ForeignKey(
        'clients.Contract',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settlements',
        verbose_name='关联合同'
    )
    period_start = models.DateField(verbose_name='结算周期开始')
    period_end = models.DateField(verbose_name='结算周期结束')
    summary = models.TextField(blank=True, verbose_name='结算说明')
    work_logs = models.ManyToManyField(WorkLog, related_name='settlements', verbose_name='结算工时明细', blank=True)
    total_hours = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='总工时')
    service_fee = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='律师费合计(元)')
    travel_expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='差旅费合计(元)')
    other_expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='其他费用(元)')
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='小计(元)')
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='优惠减免(元)')
    settlement_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='结算金额(元)')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('6.00'), verbose_name='税率(%)')
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='税额(元)')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='价税合计(元)')
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='已到账金额(元)')
    unpaid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='未到账金额(元)')
    due_date = models.DateField(verbose_name='付款截止日')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='结算状态')
    approval_status = models.CharField(
        max_length=20,
        choices=[('pending', '待审批'), ('approved', '已通过'), ('rejected', '已驳回')],
        default='pending',
        verbose_name='审批状态'
    )
    approved_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='approved_settlements',
        null=True,
        blank=True,
        verbose_name='审批人'
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='审批时间')
    approval_note = models.TextField(blank=True, verbose_name='审批意见')
    file = models.FileField(upload_to='settlements/', blank=True, verbose_name='结算单附件')
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='created_settlements',
        verbose_name='制单人'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'billing_settlement'
        verbose_name = '结算单'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.settlement_no} {self.client.client_name}'

    def save(self, *args, **kwargs):
        if not self.settlement_no:
            from django.utils import timezone
            year = timezone.now().year
            month = timezone.now().month
            count = Settlement.objects.filter(created_at__year=year, created_at__month=month).count() + 1
            self.settlement_no = f'SM{year}{month:02d}{count:05d}'
        if self.settlement_amount and not self.paid_amount:
            self.unpaid_amount = self.settlement_amount
        super().save(*args, **kwargs)
