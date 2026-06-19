from django.db import models


class DocumentTemplate(models.Model):
    CATEGORY_CHOICES = [
        ('civil_complaint', '起诉状类'),
        ('civil_defense', '答辩状类'),
        ('civil_agent', '代理词类'),
        ('criminal_defense', '辩护词类'),
        ('criminal_complaint', '控告举报类'),
        ('appellate', '上诉状类'),
        ('application', '申请书类'),
        ('evidence', '证据类文书'),
        ('contract', '合同类模板'),
        ('legal_opinion', '法律意见书'),
        ('lawyer_letter', '律师函'),
        ('power_of_attorney', '授权委托书'),
        ('firm_internal', '律所内部文书'),
        ('other', '其他文书'),
    ]
    COURT_LEVEL = [
        ('all', '通用'),
        ('grassroots', '基层法院'),
        ('intermediate', '中级法院'),
        ('high', '高级法院'),
        ('supreme', '最高院'),
        ('arbitration', '仲裁机构'),
    ]

    template_code = models.CharField(max_length=50, unique=True, verbose_name='模板编号')
    template_name = models.CharField(max_length=200, verbose_name='模板名称')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, verbose_name='模板分类')
    subcategory = models.CharField(max_length=100, verbose_name='子分类', blank=True)
    applicable_court = models.CharField(max_length=20, choices=COURT_LEVEL, default='all', verbose_name='适用法院层级')
    case_type = models.CharField(
        max_length=30,
        choices=[
            ('all', '通用'), ('civil', '民商事'), ('criminal', '刑事'),
            ('administrative', '行政'), ('labor', '劳动'), ('commercial', '商事'),
            ('family', '婚姻家事'), ('ip', '知识产权'), ('execution', '执行'),
            ('non_litigation', '非诉业务'),
        ],
        default='all',
        verbose_name='适用案件类型'
    )
    description = models.TextField(blank=True, verbose_name='模板说明')
    usage_instructions = models.TextField(blank=True, verbose_name='使用说明')
    content = models.TextField(verbose_name='模板内容(Django模板语法)')
    file = models.FileField(upload_to='templates/', blank=True, verbose_name='模板文件')
    file_type = models.CharField(
        max_length=10,
        choices=[('txt', '文本'), ('html', 'HTML'), ('docx', 'Word'), ('md', 'Markdown')],
        default='html',
        verbose_name='文件格式'
    )
    version = models.CharField(max_length=20, default='1.0', verbose_name='版本号')
    is_published = models.BooleanField(default=True, verbose_name='已发布')
    is_system = models.BooleanField(default=False, verbose_name='系统内置')
    required_fields = models.JSONField(default=list, verbose_name='必填字段列表')
    available_fields = models.JSONField(default=list, verbose_name='可用占位符列表')
    example_data = models.JSONField(default=dict, blank=True, verbose_name='示例数据')
    tags = models.JSONField(default=list, verbose_name='标签', blank=True)
    use_count = models.IntegerField(default=0, verbose_name='使用次数')
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0, verbose_name='评分')
    rating_count = models.IntegerField(default=0, verbose_name='评分人数')
    owner = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='owned_templates',
        verbose_name='创建人'
    )
    share_scope = models.CharField(
        max_length=20,
        choices=[('private', '仅自己'), ('department', '部门内'), ('firm', '全所'), ('public', '公开')],
        default='firm',
        verbose_name='共享范围'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'doc_template'
        verbose_name = '文书模板'
        verbose_name_plural = verbose_name
        ordering = ['category', '-created_at']
        indexes = [
            models.Index(fields=['category', 'case_type']),
            models.Index(fields=['template_code']),
        ]

    def __str__(self):
        return f'{self.template_code} {self.template_name}'

    def save(self, *args, **kwargs):
        if not self.template_code:
            from django.utils import timezone
            prefix = self.category[:2].upper()
            count = DocumentTemplate.objects.filter(created_at__year=timezone.now().year).count() + 1
            self.template_code = f'TPL-{prefix}-{count:05d}'
        super().save(*args, **kwargs)


class GeneratedDocument(models.Model):
    STATUS_CHOICES = [
        ('generated', '已生成'),
        ('reviewing', '审核中'),
        ('approved', '已审核'),
        ('signed', '已签章'),
        ('sent', '已发送'),
        ('archived', '已归档'),
    ]

    template = models.ForeignKey(
        DocumentTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_docs',
        verbose_name='使用模板'
    )
    doc_title = models.CharField(max_length=200, verbose_name='文书标题')
    doc_type = models.CharField(max_length=50, verbose_name='文书类型')
    case = models.ForeignKey(
        'cases.Case',
        on_delete=models.CASCADE,
        related_name='documents',
        null=True,
        blank=True,
        verbose_name='关联案件'
    )
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='documents',
        null=True,
        blank=True,
        verbose_name='关联客户'
    )
    content = models.TextField(verbose_name='文书内容')
    html_content = models.TextField(blank=True, verbose_name='HTML格式内容')
    file = models.FileField(upload_to='generated_docs/%Y/%m/', blank=True, verbose_name='生成文件')
    file_name = models.CharField(max_length=255, blank=True, verbose_name='文件名')
    file_size = models.BigIntegerField(default=0, verbose_name='文件大小')
    filled_data = models.JSONField(default=dict, verbose_name='填充数据')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='generated', verbose_name='状态')
    version = models.IntegerField(default=1, verbose_name='版本号')
    parent_doc = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children', verbose_name='父文档')
    is_final = models.BooleanField(default=False, verbose_name='终稿标记')
    shared_to_client = models.BooleanField(default=False, verbose_name='已共享给客户')
    sent_to_email = models.EmailField(blank=True, verbose_name='发送至邮箱')
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name='发送时间')
    reviewed_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='reviewed_docs',
        null=True,
        blank=True,
        verbose_name='审核人'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='审核时间')
    review_note = models.TextField(blank=True, verbose_name='审核意见')
    signed_by = models.CharField(max_length=200, blank=True, verbose_name='签章人')
    signed_at = models.DateTimeField(null=True, blank=True, verbose_name='签章时间')
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='created_docs',
        verbose_name='创建人'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'doc_generated'
        verbose_name = '已生成文书'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.doc_title} ({self.get_status_display()})'
