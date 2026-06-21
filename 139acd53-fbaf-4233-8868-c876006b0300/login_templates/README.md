# Login Image Templates Directory

此目录存放各供应商网页登录界面的图像识别模板，用于OpenCV模板匹配。

## 命名规范

模板文件名格式: `{供应商ID}_{元素名称}_{编号}.png`

元素名称:
- `username` - 用户名输入框
- `password` - 密码输入框
- `loginbtn` - 登录按钮
- `search` - 搜索框
- `searchbtn` - 搜索按钮
- `nextpage` - 下一页按钮
- `captcha` - 验证码输入框

## 供应商清单

### SUP001 - 华芯电子 (web)
```
SUP001_username_1.png
SUP001_username_2.png (备选)
SUP001_password_1.png
SUP001_loginbtn_1.png
SUP001_loginbtn_2.png (备选)
SUP001_search_1.png
SUP001_searchbtn_1.png
SUP001_nextpage_1.png
```

### SUP002 - 盛达科技 (web)
```
SUP002_username_1.png
SUP002_password_1.png
SUP002_loginbtn_1.png
SUP002_search_1.png
SUP002_searchbtn_1.png
SUP002_nextpage_1.png
SUP002_captcha_1.png
```

### SUP003 ~ SUP006 (web类供应商)
按SUP001/SUP002的格式替换ID前缀即可。

## 制作步骤

1. 打开供应商登录页，调整浏览器窗口到固定尺寸（建议1440x900）
2. 使用截图工具截取目标区域（适当留白，不要裁剪过紧）
3. 保存为PNG格式，保持原始分辨率
4. 建议提供至少2个备选模板（不同状态/位置）以提高匹配成功率
5. 测试匹配置信度建议阈值在0.80~0.92之间

## 图像要求

- 格式: PNG (无损压缩，无alpha通道优先)
- 尺寸: 宽度建议100~400px，按实际元素大小
- 颜色: 保持原样，无需二值化预处理
- 内容: 含周边少量空白上下文以避免误匹配
