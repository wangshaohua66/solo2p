# 模板图片说明

本目录存放用友U8系统界面元素的模板截图，用于OpenCV模板匹配定位界面元素。

## 模板制作方法

1. 打开用友U8系统，进入对应界面
2. 使用截图工具截取目标元素的清晰图片
3. 保存为PNG格式，文件名与下方列表一致
4. 建议截取时包含足够的特征信息，但不要包含过多背景

## 模板列表

### 登录界面

| 文件名 | 说明 | 建议尺寸 |
|--------|------|---------|
| login_username_field.png | 用户名输入框标签 | 80x30 |
| login_password_field.png | 密码输入框标签 | 80x30 |
| login_captcha_field.png | 验证码输入框标签 | 80x30 |
| login_captcha_image.png | 验证码图片 | 120x40 |
| login_button.png | 登录按钮 | 80x35 |
| login_error_hint.png | 登录错误提示 | 120x25 |

### 系统主界面

| 文件名 | 说明 | 建议尺寸 |
|--------|------|---------|
| expense_module.png | 报销模块入口图标/文字 | 60x60 |
| new_button.png | 新增单据按钮 | 60x30 |

### 报销单据界面

| 文件名 | 说明 | 建议尺寸 |
|--------|------|---------|
| invoice_code_field.png | 发票代码字段标签 | 80x25 |
| invoice_number_field.png | 发票号码字段标签 | 80x25 |
| tax_id_field.png | 纳税人识别号字段标签 | 100x25 |
| amount_field.png | 金额字段标签 | 60x25 |
| date_field.png | 开票日期字段标签 | 80x25 |
| seller_field.png | 销售方名称字段标签 | 100x25 |
| save_button.png | 保存按钮 | 60x30 |
| submit_button.png | 提交按钮 | 60x30 |

### 状态提示

| 文件名 | 说明 | 建议尺寸 |
|--------|------|---------|
| success_toast.png | 保存成功提示 | 120x30 |
| error_dialog.png | 错误对话框 | 150x80 |

## 注意事项

1. 模板图片需要与实际运行环境的分辨率、DPI一致
2. 建议在目标系统上直接截取模板图片
3. 模板匹配阈值可在config.yaml中调整（opencv.template_matching_threshold）
4. 如果界面有多种配色方案，可制作多套模板，命名时加上后缀（如 _light.png / _dark.png）
