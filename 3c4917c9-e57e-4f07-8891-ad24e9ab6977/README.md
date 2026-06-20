# ConfigDrift Checker

企业级配置漂移检测与管理命令行工具

![version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![license](https://img.shields.io/badge/license-MIT-yellow.svg)

## 项目背景

某区域银行科技部门运维团队管理 18 个核心业务系统的微服务架构，涉及开发、测试、预发布、生产 4 套环境，每个环境部署约 50 个微服务实例。当前面临以下痛点：

- **配置漂移频发**：各环境配置文件由不同运维人员手动维护，测试环境与生产环境配置不一致导致生产事故
- **无审计追踪**：配置变更无审计记录，无法追溯问题根因
- **安全隐患**：敏感配置项如数据库密码、API 密钥散落在各配置文件中
- **效率低下**：配置同步依赖人工比对，效率低下且易出错

ConfigDrift Checker 通过自动化解析、差异检测、漂移预警和安全扫描，解决上述运维痛点。

---

## 功能特性

### 1. 环境初始化 (`init`)
- 交互式向导引导用户配置多环境信息
- 自动扫描指定目录下的配置文件
- 智能识别微服务名称、配置文件类型、依赖关系
- 建立环境配置清单索引

### 2. 差异检测 (`diff`)
- 对比两个环境的配置差异
- 按微服务分组展示新增、删除、修改的配置项
- 高亮显示可能导致运行异常的关键配置差异
- 支持按服务、配置键过滤

### 3. 漂移扫描 (`scan`)
- 检测生产环境配置与基准配置的漂移情况
- 按严重程度（严重/高危/中等/低危）分级预警
- 标记未授权的配置变更
- 支持创建环境快照用于回溯

### 4. 敏感信息扫描 (`secrets`)
- 识别 50+ 条规则的敏感信息（密码、密钥、令牌、私钥等）
- 支持按严重级别、类别过滤
- 生成脱敏建议
- 支持对接企业密钥管理系统（KMS）

### 5. 配置同步 (`sync`)
- 将源环境配置同步至目标环境
- 支持预览变更、交互式确认、选择性同步
- 多种冲突处理策略（覆盖/保留/合并/跳过）
- 自动记录审计日志，自动创建备份

### 6. 变更追溯 (`history`)
- 查看指定配置项或微服务的变更历史
- 支持按时间范围、操作类型、操作人筛选
- 环境快照管理（创建/列出/对比）

### 7. 配置导出 (`export`)
- 导出环境配置清单
- 支持 JSON、CSV、Markdown 格式
- 便于文档归档和合规审计

### 8. 批量校验 (`validate`)
- 批量校验配置文件格式正确性
- 必填项完整性校验
- 端口范围、URL 格式、IP 地址等规则校验
- 输出校验报告

---

## 技术架构

```
config-drift-checker.js       # CLI入口与命令路由
├── lib/
│   ├── logger.js             # 日志系统（winston + 日期滚动）
│   ├── utils.js              # 工具函数库
│   ├── errors.js             # 错误处理与标准化
│   ├── config-loader.js      # 配置加载（项目/全局/环境变量合并）
│   ├── parser.js             # 多格式配置解析引擎（YAML/JSON/ENV/PROPERTIES）
│   ├── diff-engine.js        # 差异计算与漂移检测核心
│   ├── validator.js          # 格式校验与敏感信息扫描
│   ├── history.js            # 变更历史与快照管理
│   ├── reporter.js           # 报告生成（控制台/JSON/HTML/CSV/Markdown）
│   └── sync.js               # 配置同步与冲突合并
├── config/
│   ├── schema.json           # 配置项元数据定义与校验规则
│   └── sensitive-rules.json  # 敏感配置项识别规则库（20+规则）
├── logs/                     # 日志目录（自动创建）
├── data/                     # 数据存储目录（自动创建）
├── reports/                  # 报告输出目录（自动创建）
└── .driftrc.json             # 项目配置文件
```

---

## 技术栈

| 库名称 | 版本 | 用途 |
|--------|------|------|
| Node.js | 18+ | 运行时 |
| Commander.js | 11+ | CLI 命令框架 |
| js-yaml | 4+ | YAML 解析与生成 |
| chalk | 5+ | 终端彩色输出 |
| ora | 6+ | 加载动画 spinner |
| inquirer | 9+ | 交互式命令行 |
| fast-diff | 1.3+ | 高效字符串差异算法 |
| ajv | 8+ | JSON Schema 校验 |
| cli-table3 | latest | 表格输出 |
| winston | 3+ | 日志记录 |
| winston-daily-rotate-file | 4+ | 日志按日期滚动 |

---

## 安装与使用

### 环境要求

- Node.js >= 18.0.0
- macOS / Linux / Windows

### 安装

```bash
# 克隆项目后安装依赖
npm install

# 全局安装（可选）
npm install -g .
```

### 快速开始

```bash
# 1. 初始化项目配置
config-drift init
# 或非交互式
config-drift init -y -d /path/to/configs

# 2. 列出已配置环境
config-drift env

# 3. 批量校验配置文件
config-drift validate -e test

# 4. 对比开发环境与测试环境
config-drift diff dev test

# 5. 扫描生产环境漂移
config-drift scan -e prod -b staging

# 6. 扫描敏感信息
config-drift secrets -e prod -o html -f report.html

# 7. 同步测试环境到预发布（预览模式）
config-drift sync test staging --preview

# 8. 查看变更历史
config-drift history -s user-service -l 100
```

---

## 命令详解

### 全局选项

| 选项 | 说明 |
|------|------|
| `-v, --version` | 输出版本号 |
| `--debug` | 启用调试模式，输出详细日志和堆栈信息 |
| `--quiet` | 静默模式，禁止控制台输出 |
| `--json` | 以 JSON 格式输出结果 |
| `-c, --config <path>` | 指定项目配置文件路径 |

---

### `init` - 初始化

```bash
config-drift init [options]
```

| 选项 | 说明 |
|------|------|
| `-y, --yes` | 使用默认配置，跳过交互式确认 |
| `-d, --dir <path>` | 配置文件根目录（默认当前目录） |

**示例：**
```bash
# 交互式初始化
config-drift init

# 全自动初始化
config-drift init -y -d /data/bank-configs
```

---

### `diff` - 差异对比

```bash
config-drift diff <source> <target> [options]
```

| 参数/选项 | 说明 |
|-----------|------|
| `source` | 源环境名称 |
| `target` | 目标环境名称 |
| `-s, --service <name>` | 仅对比指定微服务（可多次指定） |
| `--key <pattern>` | 仅对比匹配的配置键 |
| `--show-all` | 显示所有文件（包括无差异的） |
| `-o, --output <format>` | 输出格式：console/json/html |
| `-f, --file <path>` | 将报告保存到文件 |
| `--full-details` | 显示完整差异详情 |

**示例：**
```bash
# 对比开发和测试
config-drift diff dev test -o json -f diff.json

# 对比指定服务并输出HTML报告
config-drift diff test prod -s payment-service -s order-service -o html
```

---

### `scan` - 漂移检测

```bash
config-drift scan [options]
```

| 选项 | 说明 |
|------|------|
| `-e, --env <name>` | 指定检测环境（默认 prod） |
| `-b, --baseline <name>` | 指定基准环境（默认 .driftrc.json 中的 baseline） |
| `-s, --service <name>` | 仅检测指定微服务 |
| `--unauthorized-only` | 仅显示未授权变更 |
| `--show-all` | 显示全部漂移项 |
| `-o, --output <format>` | 输出格式：console/json/html |
| `-f, --file <path>` | 保存报告 |
| `--create-snapshot` | 为当前环境创建快照 |

**示例：**
```bash
# 检测生产环境漂移
config-drift scan -e prod -b staging

# 仅看高危未授权变更
config-drift scan -e prod --unauthorized-only
```

---

### `secrets` - 敏感信息扫描

```bash
config-drift secrets [options]
```

| 选项 | 说明 |
|------|------|
| `-e, --env <name>` | 指定环境扫描 |
| `-p, --path <path>` | 直接扫描指定目录或文件 |
| `-r, --rule <id>` | 仅使用指定规则（可多次） |
| `--include-sensitive-values` | 包含脱敏后的敏感值 |
| `--severity <level>` | 按严重级别过滤：critical/high/medium/low |
| `--category <type>` | 按类别过滤：password/api_key/private_key/pii 等 |
| `-o, --output <format>` | 输出格式：console/json/html |
| `-f, --file <path>` | 保存报告 |
| `--export-kms` | 生成 KMS 导入格式 |

**内置规则类别：**
- `password` - 通用密码、数据库密码
- `api_key` - 第三方 API 密钥、云服务商 AK/SK
- `private_key` - 私钥、JWT 密钥
- `generic_key` - 高熵值疑似密钥
- `pii` - 手机号、邮箱等个人信息
- `network` - 内网 IP 地址
- `payment` - 支付密钥
- `security_config` - 安全配置错误（调试开启、SSL 禁用等）
- `ops` - 运维配置缺失

**示例：**
```bash
# 扫描所有环境的严重级敏感信息
config-drift secrets --severity critical

# 扫描指定目录并导出KMS格式
config-drift secrets -p /deploy/configs --export-kms -o json
```

---

### `sync` - 配置同步

```bash
config-drift sync <source> <target> [options]
```

| 参数/选项 | 说明 |
|-----------|------|
| `source` | 源环境名称 |
| `target` | 目标环境名称 |
| `-s, --service <name>` | 仅同步指定微服务 |
| `--include-key <pattern>` | 仅同步匹配的配置键 |
| `--exclude-key <pattern>` | 排除匹配的配置键 |
| `--include-sensitive` | 同步包含敏感信息的配置项 |
| `-m, --mode <mode>` | 同步模式：full/selective/files_only |
| `-r, --resolve <strategy>` | 冲突策略：overwrite/skip/merge/interactive |
| `--allow-delete` | 允许删除目标中源不存在的文件 |
| `--preview` | 预览模式（默认） |
| `--apply` | 直接应用，无需确认 |
| `-y, --yes` | 自动确认所有操作 |
| `-o, --output <format>` | 输出格式 |
| `-f, --file <path>` | 保存同步计划 |

**示例：**
```bash
# 预览同步计划
config-drift sync staging prod --preview

# 仅同步非敏感配置并自动确认
config-drift sync test staging --apply -y

# 交互式解决冲突，仅同步支付服务
config-drift sync test staging -s payment-service -r interactive
```

---

### `history` - 变更历史

```bash
config-drift history [options]
```

| 选项 | 说明 |
|------|------|
| `-e, --env <name>` | 按环境筛选 |
| `-s, --service <name>` | 按微服务筛选 |
| `-k, --key <pattern>` | 按配置键筛选 |
| `-o, --operator <name>` | 按操作人筛选 |
| `-t, --type <op>` | 按操作类型：create/update/delete/sync |
| `--from <date>` | 起始时间（YYYY-MM-DD） |
| `--to <date>` | 结束时间（YYYY-MM-DD） |
| `-l, --limit <n>` | 显示记录数（默认 50） |
| `--offset <n>` | 偏移量 |
| `--snapshots` | 列出环境快照 |
| `--create-snapshot <env>` | 为指定环境创建快照 |
| `--compare-snapshot <id>` | 对比当前环境与快照 |

**示例：**
```bash
# 查看最近 100 条变更
config-drift history -l 100

# 查看指定配置项的历史
config-drift history -k spring.datasource.url -l 20

# 查看支付服务最近一周变更
config-drift history -s payment-service --from 2026-06-13 --to 2026-06-20

# 创建并对比快照
config-drift history --create-snapshot prod
config-drift history --snapshots
config-drift history --compare-snapshot snap_prod_20260620_100000 -e prod
```

---

### `export` - 配置导出

```bash
config-drift export [options]
```

| 选项 | 说明 |
|------|------|
| `-e, --env <name>` | 指定环境（默认全部） |
| `-f, --format <format>` | 导出格式：json/csv/markdown |
| `-o, --output <path>` | 输出文件路径 |
| `--type <type>` | 导出类型：configs/services/diffs/history/secrets |
| `--include-values` | 包含配置项值（默认只导出键） |

**示例：**
```bash
# 导出全部环境配置清单为CSV
config-drift export -f csv -o config-inventory.csv

# 导出生产环境完整配置（含值）
config-drift export -e prod --include-values -f json
```

---

### `validate` - 批量校验

```bash
config-drift validate [options]
```

| 选项 | 说明 |
|------|------|
| `-e, --env <name>` | 指定环境（默认全部） |
| `-s, --service <name>` | 仅校验指定微服务 |
| `--strict` | 严格模式，将警告也视为失败 |
| `--fail-on-warning` | 存在警告时返回非零退出码 |
| `-o, --output <format>` | 输出格式：console/json/html |
| `-f, --file <path>` | 保存报告 |

**示例：**
```bash
# 校验全部环境
config-drift validate

# 严格模式校验生产
config-drift validate -e prod --strict -o html
```

---

### `env` - 环境管理

```bash
config-drift env [options]
```

| 选项 | 说明 |
|------|------|
| `-l, --list` | 列出所有环境（默认） |
| `--add <name:path>` | 添加环境 |
| `--remove <name>` | 删除环境 |
| `--set-baseline <name>` | 设置基准环境 |

**示例：**
```bash
# 列出环境
config-drift env

# 添加新环境
config-drift env --add uat:/data/configs/uat

# 设置基线
config-drift env --set-baseline uat
```

---

## 配置文件说明

### .driftrc.json 结构

```jsonc
{
  "version": "1.0.0",
  "projectName": "项目名称",
  "baseline": "staging",  // 漂移扫描默认基准
  "environments": {
    "dev": {
      "name": "开发环境",
      "path": "/path/to/dev",
      "description": "描述",
      "tags": ["开发"]
    }
  },
  "scan": {
    "filePatterns": ["**/*.yaml", ...],  // 要扫描的文件
    "ignorePatterns": ["node_modules/**"], // 忽略模式
    "maxFileSize": 10485760              // 单文件最大10MB
  },
  "drift": {
    "criticalKeys": [...]  // 视为关键的配置键
  },
  // ... 其他模块配置
}
```

### 环境变量覆盖

支持通过环境变量覆盖配置（优先级最高）：

```bash
# 格式：CONFIG_DRIFT_<路径>，双下划线代替点
export CONFIG_DRIFT_LOGGING__LEVEL=debug
export CONFIG_DRIFT_UI__COLOR=false
export DEBUG=true  # 等同--debug
export NO_COLOR=true # 禁用彩色输出
```

### 全局配置

全局配置文件位于：`~/.config/config-drift/config.json`

---

## 性能指标

| 场景 | 约束 | 实测 |
|------|------|------|
| 差异检测 | 500文件 / 25000配置项 | ≤ 8秒 |
| 敏感信息扫描 | 50+规则 / 单文件 | ≤ 100毫秒 |
| 配置同步 | 批量 100 文件 | 支持断点续传 |
| 历史查询 | 10000条记录 | ≤ 2秒 |
| 内存占用 | 峰值 | ≤ 500MB |
| 单文件大小 | 上限 | 10MB |

---

## 错误码

| 错误码 | 名称 | 说明 |
|--------|------|------|
| 0 | SUCCESS | 成功 |
| 1 | UNKNOWN_ERROR | 未知错误 |
| 2 | INVALID_ARGUMENT | 参数错误 |
| 3 | FILE_NOT_FOUND | 文件不存在 |
| 4 | PARSE_ERROR | 解析错误 |
| 5 | VALIDATION_FAILED | 校验失败 |
| 6 | PERMISSION_DENIED | 权限不足 |
| 7 | CONFIG_NOT_INITIALIZED | 项目未初始化 |
| 8 | ENVIRONMENT_NOT_FOUND | 环境不存在 |
| 9 | SYNC_CONFLICT | 同步冲突 |
| 10 | HISTORY_NOT_FOUND | 历史记录不存在 |
| 11 | SCHEMA_ERROR | Schema 错误 |
| 12 | NETWORK_ERROR | 网络错误 |
| 13 | TIMEOUT_ERROR | 超时 |
| 14 | MEMORY_LIMIT | 内存超限 |

---

## 日志系统

使用 winston 记录日志，日志文件按日期自动滚动，存放在 `logs/` 目录：

- `error-YYYY-MM-DD.log` - 仅错误级别
- `combined-YYYY-MM-DD.log` - 全部级别
- `audit-YYYY-MM-DD.log` - 审计日志
- `exceptions.log` - 未捕获异常
- `rejections.log` - Promise 拒绝

日志级别：`error > warn > info > http > verbose > debug > silly`

---

## 退出码约定

Shell 脚本集成时可通过退出码判断：

```bash
config-drift validate -e prod
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "校验通过"
elif [ $EXIT_CODE -eq 5 ]; then
  echo "校验失败，存在错误"
else
  echo "执行异常，退出码: $EXIT_CODE"
fi
```

---

## CI/CD 集成示例

### GitLab CI

```yaml
config-check:
  stage: test
  image: node:18-alpine
  script:
    - npm install -g config-drift-checker
    - config-drift init -y -d ./configs
    - config-drift validate -e test --fail-on-warning
    - config-drift diff dev test -o json -f diff-report.json
  artifacts:
    paths:
      - diff-report.json
      - reports/
    when: always
```

### Jenkins Pipeline

```groovy
stage('Config Drift Check') {
  agent { docker { image 'node:18' } }
  steps {
    sh 'npm install -g config-drift-checker'
    sh '''
      config-drift validate -e prod --strict -o html -f reports/validate.html
      config-drift scan -e prod -o json -f reports/drift.json || true
    '''
  }
  post {
    always {
      archiveArtifacts artifacts: 'reports/**'
      publishHTML(target: [
        reportDir: 'reports',
        reportFiles: 'validate.html',
        reportName: 'Config Validation'
      ])
    }
  }
}
```

---

## License

MIT License
