from django.db import models
from django.core.exceptions import ValidationError
from datetime import datetime, timedelta
from decimal import Decimal


class Case(models.Model):
    CASE_TYPE_CHOICES = [
        ('civil', '民商事诉讼'),
        ('criminal', '刑事辩护'),
        ('administrative', '行政诉讼'),
        ('non_litigation', '非诉业务'),
    ]

    STATUS_CHOICES = [
        ('consulting', '咨询登记'),
        ('conflict_check', '利益冲突审查'),
        ('filing', '正式立案'),
        ('assigned', '律师分配'),
        ('handling', '办理中'),
        ('trial', '庭审阶段'),
        ('execution', '执行阶段'),
        ('closing', '结案归档'),
        ('closed', '已结案'),
        ('suspended', '中止'),
    ]

    BILLING_TYPE_CHOICES = [
        ('hourly', '计时收费'),
        ('fixed', '固定收费'),
        ('contingency', '风险代理'),
    ]

    CASE_LEVEL_MAP = {
        'civil': 365 * 3,
        'criminal': 365 * 1,
        'administrative': 365 * 1,
        'personal_injury': 365 * 1,
        'labor': 365 * 1,
        'non_litigation': 365 * 2,
    }

    case_no = models.CharField(max_length=50, unique=True, verbose_name='案件编号')
    case_name = models.CharField(max_length=200, verbose_name='案件名称')
    case_type = models.CharField(max_length=30, choices=CASE_TYPE_CHOICES, verbose_name='案件类型')
    case_subtype = models.CharField(max_length=50, blank=True, verbose_name='案件子类型')
    cause = models.CharField(max_length=200, verbose_name='案由')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='consulting', verbose_name='案件状态')
    billing_type = models.CharField(max_length=30, choices=BILLING_TYPE_CHOICES, default='fixed', verbose_name='收费模式')
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='标的金额(元)')
    fee_agreed = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='约定律师费(元)')
    retention_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name='风险比例(%)')
    accept_date = models.DateField(verbose_name='受理日期')
    limit_date = models.DateField(verbose_name='诉讼时效截止日', blank=True, null=True)
    filing_date = models.DateField(blank=True, null=True, verbose_name='立案日期')
    close_date = models.DateField(blank=True, null=True, verbose_name='结案日期')
    lead_lawyer = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='led_cases',
        verbose_name='主办律师',
        blank=True,
        null=True
    )
    assistant = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        related_name='assisted_cases',
        verbose_name='律师助理',
        blank=True,
        null=True
    )
    lawyers = models.ManyToManyField(
        'users.User',
        related_name='cases',
        verbose_name='参与律师',
        blank=True
    )
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.PROTECT,
        related_name='cases',
        verbose_name='委托客户'
    )
    court = models.CharField(max_length=200, blank=True, verbose_name='受理法院')
    judge = models.CharField(max_length=50, blank=True, verbose_name='承办法官')
    judge_phone = models.CharField(max_length=20, blank=True, verbose_name='法官联系方式')
    case_summary = models.TextField(blank=True, verbose_name='案情摘要')
    claim = models.TextField(blank=True, verbose_name='诉讼请求')
    defense = models.TextField(blank=True, verbose_name='答辩要点')
    risk_level = models.CharField(
        max_length=10,
        choices=[('low', '低'), ('medium', '中'), ('high', '高')],
        default='medium',
        verbose_name='风险等级'
    )
    priority = models.CharField(
        max_length=10,
        choices=[('normal', '普通'), ('urgent', '加急'), ('critical', '特急')],
        default='normal',
        verbose_name='优先级'
    )
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='created_cases',
        verbose_name='创建人'
    )
    conflict_checked = models.BooleanField(default=False, verbose_name='利益冲突审查通过')
    conflict_note = models.TextField(blank=True, verbose_name='冲突审查说明')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'case_case'
        verbose_name = '案件'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'case_type']),
            models.Index(fields=['limit_date']),
            models.Index(fields=['lead_lawyer']),
            models.Index(fields=['accept_date']),
        ]

    def __str__(self):
        return f'{self.case_no} {self.case_name}'

    def clean(self):
        if not self.case_no:
            from django.utils import timezone
            year = timezone.now().year
            type_map = {
                'civil': '民', 'criminal': '刑',
                'administrative': '行', 'non_litigation': '非'
            }
            prefix = type_map.get(self.case_type, '案')
            count = Case.objects.filter(accept_date__year=year, case_type=self.case_type).count() + 1
            self.case_no = f'({year}){prefix}字第{count:04d}号'

    def save(self, *args, **kwargs):
        if self.accept_date and not self.limit_date:
            days = self.CASE_LEVEL_MAP.get(self.case_subtype, self.CASE_LEVEL_MAP.get(self.case_type, 365 * 3))
            self.limit_date = self.accept_date + timedelta(days=days)
        self.full_clean()
        super().save(*args, **kwargs)

    def get_limit_warning_level(self):
        if not self.limit_date:
            return None
        today = datetime.now().date()
        days_left = (self.limit_date - today).days
        if days_left < 0:
            return 'expired'
        elif days_left <= 3:
            return 'critical'
        elif days_left <= 7:
            return 'urgent'
        elif days_left <= 15:
            return 'warning'
        elif days_left <= 30:
            return 'notice'
        return 'normal'

    def get_days_left(self):
        if not self.limit_date:
            return None
        return (self.limit_date - datetime.now().date()).days


class Party(models.Model):
    PARTY_TYPE_CHOICES = [
        ('plaintiff', '原告/申请人'),
        ('defendant', '被告/被申请人'),
        ('third_party', '第三人'),
        ('appellant', '上诉人'),
        ('appellee', '被上诉人'),
        ('applicant', '申请人'),
        ('respondent', '被申请人'),
    ]
    ID_TYPE_CHOICES = [
        ('id_card', '身份证'),
        ('passport', '护照'),
        ('business_license', '营业执照'),
        ('unified_code', '统一社会信用代码'),
        ('other', '其他'),
    ]

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='parties', verbose_name='案件')
    party_type = models.CharField(max_length=20, choices=PARTY_TYPE_CHOICES, verbose_name='当事人类型')
    name = models.CharField(max_length=200, verbose_name='姓名/名称')
    is_company = models.BooleanField(default=False, verbose_name='是否为企业')
    id_type = models.CharField(max_length=20, choices=ID_TYPE_CHOICES, verbose_name='证件类型', blank=True)
    id_no = models.CharField(max_length=50, verbose_name='证件号码', blank=True)
    legal_representative = models.CharField(max_length=50, verbose_name='法定代表人', blank=True)
    phone = models.CharField(max_length=20, verbose_name='联系电话', blank=True)
    email = models.EmailField(blank=True, verbose_name='电子邮箱')
    address = models.CharField(max_length=300, verbose_name='送达地址', blank=True)
    is_represented = models.BooleanField(default=False, verbose_name='是否为我方代理')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'case_party'
        verbose_name = '当事人'
        verbose_name_plural = verbose_name
        ordering = ['id']

    def __str__(self):
        return f'{self.get_party_type_display()}: {self.name}'


class CaseProgress(models.Model):
    STATUS_TRANSITIONS = {
        'consulting': ['conflict_check'],
        'conflict_check': ['filing', 'consulting'],
        'filing': ['assigned'],
        'assigned': ['handling', 'filing'],
        'handling': ['trial', 'closing', 'suspended'],
        'trial': ['execution', 'closing', 'handling'],
        'execution': ['closing'],
        'closing': ['closed'],
        'closed': [],
        'suspended': ['handling'],
    }

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='progress_logs', verbose_name='案件')
    from_status = models.CharField(max_length=30, verbose_name='原状态', blank=True)
    to_status = models.CharField(max_length=30, choices=Case.STATUS_CHOICES, verbose_name='目标状态')
    operator = models.ForeignKey('users.User', on_delete=models.PROTECT, verbose_name='操作人')
    operation_type = models.CharField(max_length=20, choices=[('update', '状态更新'), ('approve', '审批通过'), ('reject', '审批驳回'), ('comment', '备注')], default='update')
    description = models.TextField(verbose_name='操作说明', blank=True)
    approval_required = models.BooleanField(default=False, verbose_name='需审批')
    approved_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='approved_progress', null=True, blank=True, verbose_name='审批人')
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='审批时间')
    is_approved = models.BooleanField(default=True, verbose_name='已通过')
    attachment = models.FileField(upload_to='case_progress/', blank=True, verbose_name='附件')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='操作时间')

    class Meta:
        db_table = 'case_progress'
        verbose_name = '案件进展'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.case.case_no} - {self.get_to_status_display()}'


class Trial(models.Model):
    TRIAL_TYPE_CHOICES = [
        ('first_instance', '一审开庭'),
        ('second_instance', '二审开庭'),
        ('retrial', '再审开庭'),
        ('hearing', '听证'),
        ('mediation', '调解'),
        ('arbitration', '仲裁开庭'),
        ('meeting', '庭前会议'),
    ]
    RESULT_CHOICES = [
        ('pending', '待开庭'),
        ('ongoing', '进行中'),
        ('completed', '已完成'),
        ('postponed', '已延期'),
        ('cancelled', '已取消'),
    ]

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='trials', verbose_name='案件')
    trial_no = models.CharField(max_length=50, verbose_name='庭审编号', blank=True)
    trial_type = models.CharField(max_length=30, choices=TRIAL_TYPE_CHOICES, verbose_name='庭审类型')
    trial_round = models.IntegerField(default=1, verbose_name='第几次开庭')
    start_time = models.DateTimeField(verbose_name='开庭时间')
    end_time = models.DateTimeField(verbose_name='结束时间', blank=True, null=True)
    duration = models.DecimalField(max_digits=5, decimal_places=1, default=0, verbose_name='时长(小时)')
    location = models.CharField(max_length=200, verbose_name='开庭地点')
    courtroom = models.CharField(max_length=100, verbose_name='法庭', blank=True)
    judge = models.CharField(max_length=50, verbose_name='审判长/主审法官', blank=True)
    judges_panel = models.JSONField(default=list, verbose_name='合议庭成员', blank=True)
    clerk = models.CharField(max_length=50, verbose_name='书记员', blank=True)
    prosecutor = models.CharField(max_length=100, verbose_name='公诉人/检察官', blank=True)
    presiding_lawyer = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='presiding_trials',
        verbose_name='出庭主办律师'
    )
    attending_lawyers = models.ManyToManyField(
        'users.User',
        related_name='attending_trials',
        verbose_name='出庭律师',
        blank=True
    )
    appearance_requisition = models.FileField(upload_to='trials/', blank=True, verbose_name='出庭函')
    result = models.CharField(max_length=20, choices=RESULT_CHOICES, default='pending', verbose_name='庭审状态')
    judgment_result = models.TextField(blank=True, verbose_name='判决结果')
    notes = models.TextField(blank=True, verbose_name='庭审记录/备注')
    has_conflict = models.BooleanField(default=False, verbose_name='存在时间冲突')
    conflict_info = models.JSONField(default=dict, verbose_name='冲突详情', blank=True)
    created_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='created_trials', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'case_trial'
        verbose_name = '庭审日程'
        verbose_name_plural = verbose_name
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['start_time']),
            models.Index(fields=['presiding_lawyer', 'result']),
        ]

    def __str__(self):
        return f'{self.case.case_no} {self.get_trial_type_display()} {self.start_time}'

    def save(self, *args, **kwargs):
        if self.start_time and self.end_time:
            self.duration = Decimal(str((self.end_time - self.start_time).total_seconds() / 3600))
        if not self.trial_no:
            self.trial_no = f'T{self.case.id}-{self.trial_round:02d}'
        self.check_conflicts()
        super().save(*args, **kwargs)

    def check_conflicts(self):
        conflicting = Trial.objects.filter(
            presiding_lawyer=self.presiding_lawyer,
            start_time__lt=self.end_time if self.end_time else self.start_time,
            end_time__gt=self.start_time,
            result__in=['pending', 'ongoing']
        ).exclude(pk=self.pk if self.pk else 0)
        if conflicting.exists():
            self.has_conflict = True
            self.conflict_info = {
                'count': conflicting.count(),
                'trials': [
                    {'id': t.id, 'case_no': t.case.case_no, 'case_name': t.case.case_name,
                     'start_time': t.start_time.isoformat(), 'end_time': t.end_time.isoformat() if t.end_time else None}
                    for t in conflicting
                ]
            }
        else:
            self.has_conflict = False
            self.conflict_info = {}


class Evidence(models.Model):
    EVIDENCE_TYPE_CHOICES = [
        ('document', '书证'),
        ('physical', '物证'),
        ('audio', '视听资料'),
        ('witness', '证人证言'),
        ('statement', '当事人陈述'),
        ('expertise', '鉴定意见'),
        ('inspection', '勘验笔录'),
        ('electronic', '电子数据'),
    ]
    STORAGE_STATUS_CHOICES = [
        ('in_store', '已入库'),
        ('borrowed', '已借出'),
        ('returned', '已归还'),
        ('lost', '遗失'),
        ('destroyed', '已销毁'),
    ]

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='evidences', verbose_name='案件')
    evidence_no = models.CharField(max_length=50, unique=True, verbose_name='证据编号')
    evidence_name = models.CharField(max_length=200, verbose_name='证据名称')
    evidence_type = models.CharField(max_length=20, choices=EVIDENCE_TYPE_CHOICES, verbose_name='证据类型')
    category = models.CharField(max_length=50, verbose_name='证据分类', blank=True)
    exhibit_list_no = models.CharField(max_length=50, verbose_name='证据清单编号', blank=True)
    is_original = models.BooleanField(default=True, verbose_name='是否原件')
    original_count = models.IntegerField(default=1, verbose_name='原件份数')
    copy_count = models.IntegerField(default=0, verbose_name='复印件份数')
    page_count = models.IntegerField(default=0, verbose_name='页数')
    description = models.TextField(blank=True, verbose_name='证据说明')
    prove_content = models.TextField(blank=True, verbose_name='证明内容')
    source = models.CharField(max_length=200, verbose_name='证据来源', blank=True)
    obtained_date = models.DateField(verbose_name='取得日期', blank=True, null=True)
    file = models.FileField(upload_to='evidence/%Y/%m/', verbose_name='文件', blank=True)
    file_name = models.CharField(max_length=255, blank=True, verbose_name='原文件名')
    file_size = models.BigIntegerField(default=0, verbose_name='文件大小(字节)')
    file_type = models.CharField(max_length=50, blank=True, verbose_name='文件类型')
    thumbnail = models.ImageField(upload_to='evidence/thumbnails/', blank=True, verbose_name='缩略图')
    ocr_content = models.TextField(blank=True, verbose_name='OCR识别内容')
    has_ocr = models.BooleanField(default=False, verbose_name='已OCR识别')
    has_watermark = models.BooleanField(default=False, verbose_name='已加水印')
    watermark_info = models.JSONField(default=dict, blank=True, verbose_name='水印配置')
    is_encrypted = models.BooleanField(default=False, verbose_name='已加密')
    version = models.IntegerField(default=1, verbose_name='版本号')
    parent_evidence = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children', verbose_name='父版本')
    storage_status = models.CharField(max_length=20, choices=STORAGE_STATUS_CHOICES, default='in_store', verbose_name='保管状态')
    storage_location = models.CharField(max_length=200, blank=True, verbose_name='存放位置')
    barcode = models.CharField(max_length=50, unique=True, verbose_name='条形码', blank=True, null=True)
    borrower = models.ForeignKey('users.User', on_delete=models.PROTECT, null=True, blank=True, related_name='borrowed_evidences', verbose_name='借用人')
    borrowed_at = models.DateTimeField(null=True, blank=True, verbose_name='借出时间')
    expected_return_at = models.DateTimeField(null=True, blank=True, verbose_name='预计归还时间')
    returned_at = models.DateTimeField(null=True, blank=True, verbose_name='实际归还时间')
    uploaded_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='uploaded_evidences', verbose_name='上传人')
    keywords = models.JSONField(default=list, verbose_name='关键词标签', blank=True)
    relevance_score = models.IntegerField(default=0, verbose_name='关联性评分')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'case_evidence'
        verbose_name = '证据材料'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['case', 'evidence_type']),
            models.Index(fields=['storage_status']),
            models.Index(fields=['barcode']),
        ]

    def __str__(self):
        return f'{self.evidence_no} {self.evidence_name}'

    def save(self, *args, **kwargs):
        if not self.evidence_no:
            import hashlib
            self.evidence_no = f'EV{self.case_id}-{hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:8].upper()}'
        if self.storage_status == 'lost' and self.pk:
            EvidenceAlert.objects.get_or_create(
                evidence=self,
                alert_type='lost',
                defaults={'level': 'critical', 'message': f'证据[{self.evidence_name}]已标记遗失'}
            )
        super().save(*args, **kwargs)


class EvidenceFlow(models.Model):
    ACTION_CHOICES = [
        ('upload', '上传'),
        ('borrow', '借出'),
        ('return', '归还'),
        ('transfer', '移交'),
        ('review', '审核'),
        ('modify', '修改'),
        ('download', '下载'),
        ('view', '查看'),
    ]

    evidence = models.ForeignKey(Evidence, on_delete=models.CASCADE, related_name='flow_logs', verbose_name='证据')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, verbose_name='操作类型')
    operator = models.ForeignKey('users.User', on_delete=models.PROTECT, verbose_name='操作人')
    from_person = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='outgoing_evidence', null=True, blank=True, verbose_name='从谁')
    to_person = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='incoming_evidence', null=True, blank=True, verbose_name='给谁')
    location = models.CharField(max_length=200, verbose_name='地点', blank=True)
    remark = models.CharField(max_length=300, verbose_name='备注', blank=True)
    scan_code = models.CharField(max_length=50, verbose_name='扫码记录', blank=True)
    device_info = models.JSONField(default=dict, blank=True, verbose_name='设备信息')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='操作时间')

    class Meta:
        db_table = 'case_evidence_flow'
        verbose_name = '证据流转记录'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']


class EvidenceAlert(models.Model):
    LEVEL_CHOICES = [('info', '提示'), ('warning', '警告'), ('danger', '危险'), ('critical', '严重')]

    evidence = models.ForeignKey(Evidence, on_delete=models.CASCADE, related_name='alerts', verbose_name='证据')
    alert_type = models.CharField(max_length=30, verbose_name='预警类型')
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='warning', verbose_name='预警级别')
    message = models.TextField(verbose_name='预警消息')
    is_read = models.BooleanField(default=False, verbose_name='已读')
    handled_by = models.ForeignKey('users.User', on_delete=models.PROTECT, null=True, blank=True, verbose_name='处理人')
    handled_at = models.DateTimeField(null=True, blank=True, verbose_name='处理时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'case_evidence_alert'
        verbose_name = '证据预警'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
