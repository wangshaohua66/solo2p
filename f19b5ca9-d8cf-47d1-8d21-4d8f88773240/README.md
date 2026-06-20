# 医疗废物集中处置全流程追溯平台

区域医疗废物集中处置中心统一追溯平台 —— 覆盖产废机构、收运车队、处置中心、监管部门四方，实现从产生、转运、处置到监管的闭环管理。

## 技术栈

| 组件 | 版本 |
|------|------|
| Java | 17 |
| Spring Boot | 3.2.5 |
| Spring Cloud | 2023.0.1 (Leyton) |
| Spring Cloud Alibaba | 2023.0.1.0 |
| Nacos | 注册中心 / 配置中心 |
| Spring Cloud Gateway | 网关 |
| MongoDB | 7.0 (主存储) |
| Redis | 7.x (缓存、分布式序列、事件队列) |
| Spring Security OAuth2 + JWT | 认证鉴权 |
| Swagger / SpringDoc | 3.0 (OpenAPI) |
| Logback | 日志框架 (审计日志保留3年) |

## 模块结构 (9 模块)

```
medical-waste-platform/
├── pom.xml                     # 父 POM：依赖管理、Lombok注解处理器、打包插件
├── mw-common/                  # 公共模块：响应封装、异常、审计、安全、枚举、校验、BaseDocument、Logback
├── mw-gateway/                 # API 网关 (端口 8080)：路由、JWT 鉴权、CORS、Swagger 聚合
├── mw-auth/                    # 认证服务 (端口 8081)：OAuth2/JWT、登录/注册/刷新、5 类角色 RBAC
├── mw-registration/            # 废物登记服务 (端口 8082)：批量登记、资质校验、追溯码、电子联单 PDF
├── mw-scheduling/              # 转运调度服务 (端口 8083)：贪心日收运路线、紧急插单、人工调整
├── mw-tracking/                # 车辆轨迹服务 (端口 8084)：GPS 时序写入、ETA、偏离检测、历史回放
├── mw-disposal/                # 处置流程服务 (端口 8085)：温压曲线、灭菌时长、排放监测、达标判定
├── mw-supervision/             # 监管预警服务 (端口 8086)：48h超时/5%差异/2km偏离/处置不达标、省平台推送
└── mw-trace/                   # 溯源查询服务 (端口 8087)：全流程时间轴、6个月聚合统计、Excel 导出
```

## 数据流

```
医疗机构 API 提交废物登记
   → mw-registration：校验资质→生成追溯码(MW-xx)→批量写入 MongoDB→推送待收运队列 queue:pending_transfer
   → mw-scheduling：Redis 消费队列 + Feign 刷新车辆位置 → 贪心算法规划路线 → 派单 (dispatch_order)
   → 司机 APP 确认收运 → mw-tracking：车载 GPS (30s/条, 1000条/s) → 写入时序集合 + Redis 缓存 → 偏离检测
   → 到达处置中心 → 称重核验 → mw-disposal：入炉批次号关联 → 温/压曲线 + 灭菌时长 + 排放数据 → 自动达标判定
   → mw-supervision：定时扫描 + Redis 事件消费 queue:alert_events → 生成预警 → 推送省固废平台
   → mw-trace：二维码 / 联单号 → 全流程时间轴聚合 + 6 个月统计报表 + Excel 导出
```

## 角色权限

| 角色 | 说明 | 典型接口 |
|------|------|----------|
| ROLE_PRODUCER | 产废机构 (280家) | 批量登记、图片上传、查看联单 |
| ROLE_TRANSPORTER | 收运车队 | 确认派单、上报 GPS、收运完成 |
| ROLE_DISPOSER | 处置中心 | 创建处置批次、记录工艺参数、关联排放数据 |
| ROLE_REGULATOR | 监管部门 | 查询预警、查看统计报表、导出 Excel |
| ROLE_ADMIN | 平台管理员 | 配置预警规则、配置机构白名单、管理用户 |

## 核心业务编码规则

| 编码 | 格式 | 生成方式 |
|------|------|----------|
| 追溯码 | `MW-{机构后4位}-{类别前缀}-{yyyyMMdd}-{6位序列}` | Redis `INCR` 按日自增，2天过期 |
| 电子联单号 | `LD-{yyyyMMdd}-{8位序列}` | Redis 按日自增 |
| 派单号 | `DO-{yyyyMMdd}-{6位序列}` | Redis 按日自增 |
| 处置批次号 | `DS-{yyyyMMdd}-{6位序列}` | Redis 按日自增 |

## 性能关键点

| 指标 | 方案 |
|------|------|
| 废物登记峰值 2万条/天, <200ms | MongoDB `BulkOperations.bulkWrite` 批量插入 + Redis 追溯码生成 |
| GPS 并发写入 1000条/s | MongoDB 无序批量插入 + 最新位置 Redis `SETEX` 热缓存 |
| 年度 5000 万条 MongoDB 数据 | 字段索引 (orgId, traceCode, manifestNo, storageTime, ts) + 聚合管道 $match 前置 |
| 6 个月数据聚合 <3s | 原生 MongoDB 聚合管道 (`$dateToString` 分组 + `$lookup` 关联合并) |
| 可用性 99.5% | Nacos 注册发现 + Gateway 负载均衡 + Feign Client 重试 |

## 预警规则与阈值

| 预警类型 | 默认阈值 | 级别 |
|----------|---------|------|
| 暂存超时 | 48 小时 | WARNING |
| 重量差异 | >5% | WARNING |
| 轨迹偏离 | >2 公里 (Haversine) | WARNING |
| 处置不达标 | 最高温度<下限 或 灭菌时长<最小值 或 排放不合格 | URGENT |

## 构建与运行

前置依赖：

- JDK 17+ (推荐 17.0.19 LTS)
- Maven 3.9+
- MongoDB 7.0
- Redis 7.x
- Nacos 2.3+

### 构建

```bash
# 全部 9 个模块构建 + 安装到本地仓库
export JAVA_HOME=/path/to/jdk17
mvn -T 1C clean install -DskipTests
```

### 运行 (Jar 方式)

建议启动顺序：Nacos → MongoDB → Redis → 各微服务 (mw-common 是依赖，无需启动)

```bash
# 1. API 网关 (8080)
java -jar mw-gateway/target/mw-gateway-1.0.0.jar

# 2. 认证服务 (8081)
java -jar mw-auth/target/mw-auth-1.0.0.jar

# 3. 废物登记 (8082)
java -jar mw-registration/target/mw-registration-1.0.0.jar

# 4. 转运调度 (8083)
java -jar mw-scheduling/target/mw-scheduling-1.0.0.jar

# 5. 车辆轨迹 (8084)
java -jar mw-tracking/target/mw-tracking-1.0.0.jar

# 6. 处置流程 (8085)
java -jar mw-disposal/target/mw-disposal-1.0.0.jar

# 7. 监管预警 (8086)
java -jar mw-supervision/target/mw-supervision-1.0.0.jar

# 8. 溯源查询 (8087)
java -jar mw-trace/target/mw-trace-1.0.0.jar
```

### 环境变量配置

所有服务均支持环境变量覆盖，无需修改 `application.yml`：

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `MW_MONGO_URI` | MongoDB 连接 URI | `mongodb://127.0.0.1:27017/mw_platform` |
| `MW_REDIS_HOST` | Redis 主机 | `127.0.0.1` |
| `MW_REDIS_PORT` | Redis 端口 | `6379` |
| `MW_REDIS_PASSWORD` | Redis 密码 | (空) |
| `MW_NACOS_ADDR` | Nacos 地址 | `127.0.0.1:8848` |
| `MW_NACOS_NAMESPACE` | Nacos 命名空间 | `public` |
| `MW_JWT_SECRET` | JWT 签名密钥 (生产必须修改!) | `mw-medical-waste-secret-key-2024-trace-platform` |
| `MW_PROVINCIAL_PUSH_URL` | 省固废监管平台 API URL | (空) |
| `LOG_HOME` | 日志根目录 | `./logs` |

## Swagger 访问

| 服务 | OpenAPI JSON | Swagger UI |
|------|-------------|-----------|
| 网关聚合 | 通过 Gateway 转发 | `http://127.0.0.1:8080/swagger-ui.html` |
| 直连 | `/v3/api-docs` | `/swagger-ui.html` (各端口) |

## 审计与合规

- **AOP 审计切面**：`@Auditable(action=..., module=..., description=...)` 注解自动记录 — 操作人、操作时间、操作类型、变更前后数据、业务主键、请求 URI、IP。
- **审计日志存储**：MongoDB `audit_log` 集合 + 滚动文件 `*-audit.log`，保留 3 年以上。
- **电子联单操作日志**：作废 / 补录 / 变更均写入 `electronic_manifest.operateLogs`。
- **预警处理闭环**：`PENDING → CONFIRMED → RESOLVED`，含确认人、确认时间、处理反馈。
