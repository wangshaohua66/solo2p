from django.db import models


class Notification(models.Model):
    CHANNEL_CHOICES = [
        ('in_app', '站内消息'),
        ('sms', '短信推送'),
        ('app_push', 'APP推送'),
        ('email', '邮件通知'),
    ]
    LEVEL_CHOICES = [
        ('info', '普通'),
        ('warning', '警告'),
        ('urgent', '紧急'),
        ('critical', '严重'),
    ]
    CATEGORY_CHOICES = [
        ('case_status', '案件状态变更'),
        ('limitation_warning', '诉讼时效预警'),
        ('trial_reminder', '庭审提醒'),
        ('evidence_alert', '证据风险'),
        ('billing_reminder', '费用提醒'),
        ('system', '系统通知'),
        ('approval', '审批通知'),
        ('other', '其他'),
    ]
    STATUS_CHOICES = [
        ('pending', '待发送'),
        ('sent', '已发送'),
        ('delivered', '已送达'),
        ('read', '已读'),
        ('failed', '发送失败'),
    ]

    recipient = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name='接收人'
    )
    title = models.CharField(max_length=200, verbose_name='消息标题')
    content = models.TextField(verbose_name='消息内容')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='system', verbose_name='消息分类')
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='info', verbose_name='紧急程度')
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='in_app', verbose_name='推送渠道')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='发送状态')
    related_case = models.ForeignKey(
        'cases.Case',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        verbose_name='关联案件'
    )
    related_trial = models.ForeignKey(
        'cases.Trial',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
        verbose_name='关联庭审'
    )
    extra_data = models.JSONField(default=dict, blank=True, verbose_name='附加数据')
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name='发送时间')
    read_at = models.DateTimeField(null=True, blank=True, verbose_name='阅读时间')
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_notifications',
        verbose_name='发送人'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'sys_notification'
        verbose_name = '消息通知'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'status']),
            models.Index(fields=['category', 'created_at']),
        ]

    def __str__(self):
        return f'{self.title} -> {self.recipient.username}'

    def mark_read(self):
        from django.utils import timezone
        if not self.read_at:
            self.read_at = timezone.now()
            self.status = 'read'
            self.save(update_fields=['read_at', 'status'])
