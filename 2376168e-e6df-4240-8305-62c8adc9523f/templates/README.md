# 清算系统模板与示例数据说明

## 📁 目录结构

```
templates/
├── csv_tpl.yaml           # CSV格式解析模板（推荐，简单易读）
├── fixed_tpl.yaml         # 定宽文本格式解析模板（历史机构使用）
└── xml_tpl.yaml           # XML格式解析模板（支持标准XPath）

configs/
├── config.yaml            # 主配置文件（机构/规则/清算参数）
├── sample_inst01.csv      # 机构1 CSV出款流水示例
├── sample_inst02.xml      # 机构2 XML入款流水示例
├── inst01_out.csv         # 出款测试数据（6笔，含RefNo用于关联）
├── inst02_in.csv          # 入款测试数据（6笔，含跨机构4方）
└── sample_fixed.txt       # 定宽文本示例（283字节/行，见fixed_tpl.yaml）
```

---

## 📋 解析模板格式详解

### 通用字段（所有模板共用）

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `format` | string | 文件格式标识 | `csv` / `fixed` / `xml` |
| `encoding` | string | 文件编码 | `UTF-8` / `GBK` / `GB18030` |
| `has_header` | bool | 是否有表头行（仅CSV/Fixed生效） | `true` |
| `separator` | string | 列分隔符（仅CSV生效） | `,` / `|` / `\t` |
| `record_xpath` | string | 记录XPath（仅XML生效） | `/ClearingData/RecordList/Record` |
| `fields` | array | 字段映射定义（必填） | 见下方Fields |

### Fields 字段映射

每个字段定义支持以下属性：

| 属性 | 说明 | 示例 |
|------|------|------|
| `name` | 目标字段名（对应ClearFlow属性） | `biz_no` |
| `source` | 源字段定位规则 | CSV=列名/col序号，Fixed=忽略(按start)，XML=XPath表达式 |
| `type` | 类型校验：`string`/`decimal`/`date`/`int` | `decimal` |
| `format` | 日期格式（type=date时） | `2006-01-02` |
| `start` | 起始位置（仅Fixed生效，从0计数） | `0` |
| `length` | 字段长度（仅Fixed生效，按Rune计） | `32` |
| `default` | 缺失时默认值 | `CNY` |
| `required` | 是否必填：true/false | `true` |

---

## 📗 CSV模板示例

```yaml
# templates/csv_tpl.yaml
format: csv
encoding: UTF-8
has_header: true
separator: ","
fields:
  - name: biz_no           # 业务流水号，唯一标识
    source: 交易流水号
    type: string
    required: true
  - name: biz_type         # 业务类型: TRANSFER/GUARANTEE/PAWN/LEASE
    source: 业务类型
    type: string
    default: TRANSFER
  - name: src_inst_id      # 出款机构ID
    source: 源机构号
    type: string
    default: INST001
  - name: dst_inst_id      # 入款机构ID
    source: 目标机构号
    type: string
  - name: amount           # 交易金额（支持千分位）
    source: 交易金额
    type: decimal
    required: true
  - name: direction        # 方向：OUT=出款，IN=入款
    source: 借贷方向
    type: string
    default: OUT
  - name: ref_no           # 关联参考号（双向对账关联键）
    source: 业务参考号
    type: string
```

**CSV 数据示例（表头行+数据行）**：

```csv
交易流水号,业务类型,业务日期,源机构号,目标机构号,交易金额,币种,借贷方向,付款账号,付款户名,收款账号,收款户名,摘要,业务参考号
BIZ2026062200001,TRANSFER,2026-06-22,INST001,INST002,25000.00,CNY,OUT,110023000001,某某小额贷款公司,110023000002,某某融资担保公司,跨机构转账,REF20260622A001
```

---

## 📘 定宽文本模板示例

```yaml
# templates/fixed_tpl.yaml
format: fixed
encoding: GBK
has_header: false
fields:
  # start从0开始，按rune截取
  - { name: biz_no,     start: 0,   length: 32, type: string, required: true }
  - { name: biz_type,   start: 32,  length: 16, type: string, default: TRANSFER }
  - { name: biz_date,   start: 48,  length: 10, type: date,   format: "2006-01-02" }
  - { name: src_inst_id,start: 58,  length: 16, type: string }
  - { name: dst_inst_id,start: 74,  length: 16, type: string }
  - { name: amount,     start: 90,  length: 24, type: decimal }
  - { name: currency,   start: 114, length: 5,  type: string, default: CNY }
  - { name: direction,  start: 119, length: 4,  type: string }
  - { name: payer_account, start: 123, length: 32 }
  - { name: payer_name,    start: 155, length: 64 }
  - { name: payee_account, start: 219, length: 32 }
  - { name: payee_name,    start: 251, length: 32 }
```

**定宽每行总字节数**：32+16+10+16+16+24+5+4+32+64+32+32 = **283 字节**

---

## 📙 XML模板示例（XPath）

```yaml
# templates/xml_tpl.yaml
format: xml
encoding: UTF-8
record_xpath: /ClearingData/RecordList/Record    # 每条记录的根XPath
fields:
  - name: biz_no
    source: /BizNo                 # 相对record_xpath的子节点XPath
    type: string
  - name: biz_type
    source: /BizType
    type: string
    default: TRANSFER
  - name: biz_date
    source: /BizDate
    type: date
    format: "2006-01-02"
  - name: src_inst_id
    source: /SourceInst
  - name: dst_inst_id
    source: /DestInst
  - name: amount
    source: /Amount
    type: decimal
  - name: currency
    source: /Currency
    default: CNY
  - name: direction
    source: /Direction
  - name: payer_account
    source: /Payer/Account          # 支持嵌套XPath
  - name: payer_name
    source: /Payer/Name
  - name: payee_account
    source: /Payee/Account
  - name: payee_name
    source: /Payee/Name
  - name: summary
    source: /Summary
  - name: ref_no
    source: /RefNo
```

**XPath 高级用法**：
- 绝对路径：`/Root/Child/Field`（从XML根开始，配合record_xpath相对定位）
- 属性取值：`@attrName`（当前节点的属性值）
- 示例：`source: "@code"` 取节点code属性，`source: /Meta/@version`取子节点Meta的version属性

---

## 🧪 标准测试数据

### inst01_out.csv（机构1出款，共6笔）

| RefNo | 金额 | 业务 | 说明 |
|-------|------|------|------|
| REF20260622A001 | 25,000.00 | TRANSFER | 与inst02_in中REF001匹配，金额一致 |
| REF20260622A002 | 35,000.00 | GUARANTEE | 与inst02_in中REF002匹配，差0.01元→**容差调平** |
| REF20260622A003 | 22,000.00 | LEASE | 与inst02_in中REF003匹配，差0.01元→**容差调平** |
| REF20260622A004 | 30,000.00 | TRANSFER | 与inst02_in中REF004匹配（INST001→INST003） |
| REF20260622A005 | 18,000.00 | PAWN | 与inst02_in中REF005匹配（INST001→INST004） |
| - | 4,200.00 | PAWN | 典当赎当，无反向流水→**单向挂账** |

### inst02_in.csv（机构2/3/4入款，共6笔）

机构1出款的前5笔在本表均有对应入款流水，通过**同一RefNo**双向关联。
最后两笔（5+6）合计2笔挂账（inst01出款第6笔 + inst02入款第6笔）

---

## 🔧 匹配规则配置（config.yaml）

```yaml
match_rules:
  # 默认规则：所有机构/业务通用
  default:
    match_fields:
      biz_no: 40
      amount: 30
      currency: 15
      biz_date: 15
    match_threshold: 80        # 综合得分≥80判定匹配
    tolerance_mode: percent    # 容差模式：fixed/percent
    tolerance_value: 0.0005    # 0.05%相对误差
    tolerance_max: 10.00       # 单笔容差上限10元
    allow_unilateral: true     # 允许单向补录
    timeout_hours: 72

  # 单机构差异化：INST001使用百分比容差更宽松
  INST001:
    tolerance_mode: percent
    tolerance_value: 0.001     # 0.1%
    tolerance_max: 50.00

  # 按机构×业务类型差异化：GUARANTEE禁止单向补录
  INST001|GUARANTEE:
    allow_unilateral: false
    tolerance_mode: fixed
    tolerance_value: 0.01      # 担保代偿容差固定1分

  # TRANSFER业务超时更短
  "|TRANSFER":
    timeout_hours: 24
    allow_unilateral: false
```

---

## ⚡ 快速验证命令

```bash
# 1. 解析测试（CSV+XML对比）
clear parse -i configs/inst01_out.csv -t templates/csv_tpl.yaml --src INST001 -d 2026-06-22
clear parse -i configs/sample_inst02.xml -t templates/xml_tpl.yaml -f xml -d 2026-06-22

# 2. 全流程端到端测试
rm data/clear.db
clear parse -i configs/inst01_out.csv -t templates/csv_tpl.yaml --src INST001 -d 2026-06-22
clear parse -i configs/inst02_in.csv -t templates/csv_tpl.yaml -d 2026-06-22
clear reconcile -d 2026-06-22
clear settle -d 2026-06-22 --export
clear report -d 2026-06-22
clear audit -d 2026-06-22

# 3. 生成man手册
clear --man
man output/clear.8
```
