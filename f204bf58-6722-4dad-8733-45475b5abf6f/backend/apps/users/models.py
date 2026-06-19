from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', '管理员'),
        ('partner', '合伙人'),
        ('lawyer', '执业律师'),
        ('assistant', '律师助理'),
        ('client', '客户'),
    ]
    phone = models.CharField(
        max_length=11,
        validators=[RegexValidator(r'^1[3-9]\d{9}$', '手机号格式错误')],
        verbose_name='手机号',
        blank=True,
        null=True
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='assistant', verbose_name='角色')
    id_card = models.CharField(max_length=18, verbose_name='身份证号', blank=True, null=True)
    license_no = models.CharField(max_length=20, verbose_name='执业证号', blank=True, null=True)
    department = models.CharField(max_length=100, verbose_name='所属部门', blank=True, null=True)
    position = models.CharField(max_length=50, verbose_name='职位', blank=True, null=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='小时费率(元)')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, verbose_name='头像')
    status = models.BooleanField(default=True, verbose_name='在职状态')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'sys_user'
        verbose_name = '用户'
        verbose_name_plural = verbose_name
        ordering = ['-id']

    def __str__(self):
        return f'{self.get_full_name() or self.username} ({self.get_role_display()})'
