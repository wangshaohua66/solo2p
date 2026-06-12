# Carbon Management Platform (CMP)

> 企业级碳排放管理 SaaS 后端服务 — 面向年能耗 **5000 吨标煤以上**工业制造企业碳管理岗，覆盖 CBAM 过渡期报告、全国碳市场配额核查、ISSB S2 披露全场景。

---

## 一、系统架构

```
                          ┌──────────────────────────────────────────────────────┐
                          │              Spring Cloud Gateway (8080)             │
                          │  ├─ JWT Bearer 鉴权                                  │
                          │  ├─ X-Tenant-Id / X-User 注入                        │
                          │  ├─ 按租户 Redis RequestRateLimiter 限流             │
                          │  └─ SpringDoc 聚合 /v3/api-docs/swagger-config       │
                          └───────────────────────────┬──────────────────────────┘
                                                      │
     ┌──────────────┬───────────────┬────────────────┼──────────────────┬───────────────┬──────────────────┐
     │              │               │                │                  │               │                  │
     ▼              ▼               ▼                ▼                  ▼               ▼                  ▼
 emission      factor-lib     calculation       quota-compli-      verification     ccer-service   [公共]
 source        service        engine          ance              service          (8086)         common-lib
 service       (8082)         (8083)          service           (8085)                          AOP 审计
 (8081)        IPCC/环保部/    ISO 14064-1 /    (8084)            证据链 /        立项-审定-    统一异常
 Scope1/2/3    CBAM/GHG       GHG Protocol/     配额管理/          核查包PDF/       核证-签发     统一响应
 5000 排放源   多版本因子      CBAM 并行核算     CCER 抵消 /        CSRC/ISSB S2/   转让-注销     Webhook
 22 活动数据   双向追溯        差异定位          三级预警           CDP 披露模板    签发履约     JWT 工具
 Excel 导入                                                                                    多租户路由
```

**基础中间件**

| 组件 | 版本 | 用途 |
|---|---|---|
| **Nacos** (v2.3.2) | standalone | 服务注册发现 + 配置中心（namespace=carbon-dev） |
| **MongoDB 6.0** | 副本集 rs0 单节点 | 业务数据按租户分库（carbon_{tenantId}），历史数据 TTL，多文档事务 |
| **Redis 7** | 单机持久化 | 双级缓存 Caffeine + Redis，因子库命中 >95%，限流计数器 |
| **Spring Cloud 2022** | 2022.0.5 | Gateway + OpenFeign + LoadBalancer |
| **SpringDoc OpenAPI** | 2.5.0 | 在线文档 + 多服务聚合 |

---

## 二、模块清单

| 模块 | 端口 | 关键职责 |
|---|---|---|
| **`api-gateway`** | 8080 | 统一入口、JWT 鉴权、租户路由、限流、CORS、Swagger 聚合 |
| **`emission-source-service`** | 8081 | 5000 排放源档案 + 22 类活动数据 Excel 导入、量纲/TJ 换算、线性插值留痕 |
| **`factor-library-service`** | 8082 | IPCC 2006/2019 + 环保部 + CBAM + GHG Protocol 多库多版本，期间自动匹配，变更双向追溯 |
| **`calculation-engine-service`** | 8083 | 三标准策略模式并行核算，DiffAnalyzer 逐源逐气体定位差异（因子/GWP/公式边界） |
| **`quota-compliance-service`** | 8084 | 年度配额分配 + 12 月滚动台账，缺口 5%/10%/20% 钉钉/飞书分级预警，CCER <5% 抵消校验 |
| **`verification-service`** | 8085 | 证据链挂接（凭证/监测/台账/检测报告），核查包 PDF（iText）+ 扫码签注，CSRC/ISSB S2/CDP 模板填充 + SHA256 签名 |
| **`ccer-service`** | 8086 | 15 类方法学 CCER 项目，状态机 DRAFT→SUBMITTED→RECORDED→VALIDATION_PASSED→IMPLEMENTING→VERIFICATION_SUBMITTED→ISSUED，签发量扣 2% 缓冲储备，转让/注销，签发回调履约 |
| **`common-lib`** | — | `R<T>` 统一响应、`GlobalExceptionHandler` 错误结构、`@AuditLog` AOP、`JwtTokenProvider`、`WebhookNotifier`、`TenantRoutingMongoDatabaseFactory` 多租户分库 |

---

## 三、核心数据流向

```
排放源档案
    │
    ▼
活动数据（燃料/电力/热力/原料/运输 22 类） ──► 量纲校验/NCV换算/线性插值留痕
    │
    ▼
因子库（IPCC 2006/2019、生态环境部、CBAM、GHG Protocol）
    │  按活动期间自动匹配版本，因子变更双向追溯
    ▼
 ┌──────────────────────────────────────────────────────────┐
 │              Calculation Engine 三标准并行               │
 │   ┌──────────┐   ┌──────────────┐   ┌──────────────┐    │
 │   │ ISO 14064 │   │ GHG Protocol │   │    CBAM       │    │
 │   │  Scope1/2 │   │  市场法位置  │   │  隐含碳 CO2e  │    │
 │   └────┬─────┘   └──────┬───────┘   └──────┬───────┘    │
 │        └─────────────── DiffAnalyzer ◄─────┘            │
 │                   逐源逐气体 delta 定位                   │
 └──────────────────────────────┬───────────────────────────┘
                                ▼
                        配额履约台账（12 月滚动）
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
               缺口预警                CCER 签发转入抵消
         5% 部门 / 10% 企业 / 20% 集团          │
         钉钉 markdown / 飞书 interactive       ▼
                                ┌──────────────┴──────────────┐
                                ▼                             ▼
                         证据链归档                  CSRC / ISSB S2 / CDP
                     (凭证/监测/台账/检测报告)        披露模板自动填充+签名
                                │
                                ▼
                        核查包 PDF + 扫码签注
```

---

## 四、快速启动

### 4.1 本地开发（无 Docker，依赖本地中间件）

#### 先决条件
- JDK **17+** (推荐 Eclipse Temurin 17)
- Maven **3.9+**
- MongoDB **6.0** 副本集 `rs0`（必须！多文档事务依赖副本集）
- Redis **7.0+**
- Nacos **2.3+** 单机

```bash
# 1. 编译打包
mvn -DskipTests clean package

# 2. 启动顺序（等待前一个 healthy 再启下一个）
# Nacos
cd <nacos_home> && bin/startup.sh -m standalone
# MongoDB (replSet 单节点)
mongod --replSet rs0 --port 27017 &
mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
# Redis
redis-server &

# 3. 依次启动各微服务
cd api-gateway && mvn spring-boot:run &          # 8080
cd emission-source-service && mvn spring-boot:run &   # 8081
cd factor-library-service && mvn spring-boot:run &    # 8082
cd calculation-engine-service && mvn spring-boot:run & # 8083
cd quota-compliance-service && mvn spring-boot:run &   # 8084
cd verification-service && mvn spring-boot:run &       # 8085
cd ccer-service && mvn spring-boot:run &               # 8086
```

### 4.2 Docker Compose 一键全栈

```bash
# 1. 先本地 Maven 打包（容器只 COPY jar）
mvn -DskipTests clean package && chmod +x scripts/mongo-init.sh

# 2. 一键启动（含 Nacos / Mongo RS / Redis / 8 服务）
docker compose up -d --build

# 3. 健康观察
docker compose ps
docker compose logs -f api-gateway

# 4. 停止
docker compose down
```

默认账号密码（仅开发）：
- **Nacos**: http://localhost:8848/nacos  `nacos / nacos`
- **Mongo**: `admin / carbon!Mongo2024` 副本集 `rs0`
- **Redis**: 无密码
- **JWT 登录**（网关 `/api/auth/login`）：见 `AuthController.java` — 账号 `carbon_admin / carbon2024`（Demo 用）

### 4.3 访问入口

| 服务 | URL |
|---|---|
| 网关统一入口 | http://localhost:8080/ |
| Swagger UI（网关聚合） | http://localhost:8080/swagger-ui.html |
| 各服务独立文档 | http://localhost:808x/swagger-ui.html |
| Nacos | http://localhost:8848/nacos |
| Mongo Express（可选另装） | 27017 |

---

## 五、统一规范

### 5.1 JSON 响应结构
```json
{
  "code": 200,
  "message": "ok",
  "traceId": "e3f7c8a1b2...",
  "data": { ... },
  "timestamp": 1715664000000
}
```
- 全局错误：`GlobalExceptionHandler` 返回 `{code, message, traceId, data, timestamp}`
- 错误码：`common-lib/.../ErrorCode.java`（40+ 业务错误，范围 `100000 ~ 900000`）

### 5.2 认证与多租户
- **鉴权**：`Authorization: Bearer <jwt>`
- **租户隔离**：
  - Web 层：`TenantContextFilter` 从 JWT 解析 `tenantId` → 写入 `UserContextHolder`（InheritableThreadLocal）
  - Mongo 层：`TenantRoutingMongoDatabaseFactory` 按 `tenantId` 路由到 `carbon_{tenantId}` 库
  - 限流：按 `X-Tenant-Id` Redis 令牌桶限流

### 5.3 审计日志
- 写操作（`@PostMapping / @PutMapping / @DeleteMapping`）加 `@AuditLog` 注解
- AOP 异步写入 `audit_logs` 集合，**TTL=365 天**自动清理

### 5.4 RESTful 命名
- 复数名词、嵌套表达关系：`/emission-sources/{id}/activity-data`
- 动作后缀表达状态流转：`/calculation-tasks/{id}/retry`，`/ccer-projects/{id}/submit`
- HTTP 方法语义：GET=查 / POST=创建 / PUT=全量更新 / PATCH=部分更新 / DELETE=删除

---

## 六、关键性能指标对标

| 指标 | 目标 | 实现手段 |
|---|---|---|
| 月度全量核算（5000 源） | P95 **< 8 min** | 16 线程并行核算（`@Async` + 自定义线程池），按标准×排放源并发，BulkOperations 写入 |
| 核算接口 | P99 **< 800 ms** | Redis+Caffeine 双级缓存因子，预批量 match，Nacos 软负载 |
| 因子查询 Redis 命中率 | **> 95%** | `FactorService` 先查 `factor:{matchKey}:{version}` 再 fallback 到 Mongo，LRU 2GB |
| SaaS 化 | **100 家**企业租户 | 按 `tenantId` 逻辑 + 物理分库，独立 `carbon_{tenantId}` 库，资源按租户限流配额 |
| 活动数据导入（100 万条） | 线性扩展 | POI 流式解析，1000 条 chunk BulkOperations，后台 @Async |

---

## 七、典型业务流程示例

### 7.1 月度核算
```bash
# 1. 登录
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"carbon_admin","password":"carbon2024"}'

# 2. 提交月度核算任务（ISO + GHG + CBAM 三标准并行）
curl -X POST http://localhost:8080/api/calculation-tasks \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"period":"2024-05","standards":["ISO14064","GHG_PROTOCOL","CBAM"]}'

# 3. 查询差异（逐源逐气体）
curl http://localhost:8080/api/calculations/diff?taskId=<taskId>&standards=ISO14064,CBAM
```

### 7.2 CCER 签发转入履约
```bash
# 1. 创建 A/R 造林项目
curl -X POST http://localhost:8080/api/ccer-projects -H 'Authorization: Bearer <token>' \
  -d '{
    "projectName":"大兴安岭5万亩碳汇林",
    "projectType":"AFFORESTATION_REFORESTATION",
    "methodologyCode":"CM-001-V01",
    "startDate":"2020-03-01",
    "creditingPeriodYears":20,
    "expectedAnnualReduction":85000,
    "location":"黑龙江省大兴安岭"
  }'
# 2. 提审定 / 核证（状态机自动流转） → 3. 签发（自动扣 2% 缓冲储备）
curl -X POST http://localhost:8080/api/ccer-projects/<projectId>/issuances \
  -H 'Authorization: Bearer <token>' \
  -d '{"verificationId":"<verificationId>"}'
# 3. 履约注销 → 自动扣减配额缺口
curl -X POST http://localhost:8080/api/ccer-issuances/<issuanceId>/retire \
  -H 'Authorization: Bearer <token>' \
  -d '{"tons":40000,"note":"2024年度履约抵消"}'
```

### 7.3 配置 webhook 预警
在 `quota-compliance-service` `application.yaml`：
```yaml
alert:
  level-thresholds: [5, 10, 20]
  recipients:
    DEPT:
      - type: dingtalk
        url: https://oapi.dingtalk.com/robot/send?access_token=xxx
    ENTERPRISE:
      - type: feishu
        url: https://open.feishu.cn/open-apis/bot/v2/hook/xxx
    GROUP:
      - type: feishu
        url: https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

---

## 八、披露模板支持

| 模板 | 覆盖章节 |
|---|---|
| **CSRC (证监会《上市公司年报环境信息披露指引》)** | Section A 主体信息、B 治理、C 战略、D 环境排放、E 气候风险与机遇 |
| **ISSB S2 (IFRS S2)** | Governance / Strategy (气候情景分析) / Risk Management / Metrics & Targets (Scope1-3, CDP 对齐) |
| **CDP Climate Change** | Module C1: Risk / C2: Target / C3: Emissions / C4: Energy |

全部模板支持 `DisclosureReportController#fillTemplate` 自动数据填充 + SHA256 数字签名，带全局唯一 `serialNumber` 与不可篡改 `fileHash`。

---

## 九、目录结构

```
carbon-management-platform/
├── pom.xml                              # 父 POM (8 子模块 + 统一版本)
├── docker-compose.yml                   # 一键全栈
├── Dockerfile.service                   # 服务通用 Dockerfile
├── scripts/mongo-init.sh                # Mongo RS 初始化
├── common-lib/                          # 公共基础库
├── api-gateway/                         # 网关 8080
├── emission-source-service/             # 排放源 8081
├── factor-library-service/              # 因子库 8082
├── calculation-engine-service/          # 核算引擎 8083
├── quota-compliance-service/            # 配额履约 8084
├── verification-service/                # 核查与披露 8085
└── ccer-service/                        # CCER 减排 8086
```

---

## 十、技术栈完整清单

```
Java 17 + Spring Boot 3.2.5 + Spring Cloud 2022.0.5
  ├─ Spring Cloud Alibaba 2022.0.0.0 (Nacos)
  ├─ Spring Cloud Gateway + Redis RateLimiter
  ├─ Spring Security + JJWT 0.12.x (HS256)
  ├─ Spring Data MongoDB 4.1 (多文档事务)
  ├─ Spring Data Redis + Caffeine (双级缓存)
  ├─ SpringDoc OpenAPI 2.5 (Swagger)
  ├─ OpenFeign (跨服务调用)
  ├─ Hutool 5.8 (工具)
  ├─ Apache POI 5.2 (Excel 导入)
  ├─ iTextPDF 8.0 (核查包生成)
  ├─ OkHttp 4.12 (Webhook)
  └─ Lombok / MapStruct (待接入)
中间件：MongoDB 6 RS / Redis 7 / Nacos 2.3
部署：Docker Compose + Temurin 17 Alpine
```

---

## 十一、后续扩展建议

1. **MapStruct**：Entity / DTO / VO 映射（当前少量手写）
2. **Debezium + Kafka Connect**：Mongo CDC → 数仓 ODS（已预留审计字段）
3. **Prometheus + Grafana**：监控 P95/P99 指标与 Mongo/Redis 集群状态
4. **Kubernetes HPA**：按核算队列深度自动扩缩容 calculation-engine
5. **PDF/A-3 合规格式**：核查包加嵌入 XMP 元数据符合欧盟 CBAM 报告要求

---

© 2024 Carbon Management Platform · For demo / 企业内部使用，请自行替换 JWT Secret 与 Mongo/Redis 密码。
