const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '省级血液中心采供血管理系统 API',
      version: '1.0.0',
      description: `
省级血液中心采供血管理系统后端API接口文档

### 业务范围
- 献血者全周期管理（登记、初筛、采血、屏蔽）
- 血液检测与成分制备（ELISA检测、成分分离）
- 库存管理（水位监控、效期预警、报废）
- 用血申请与交叉配血（申请、配血、优先级调度）
- 配送调度与冷链追溯
- 统计报表与监管上报

### 技术栈
- Node.js 18+、Express 4.18+、better-sqlite3 9.x
- GraphQL (apollo-server-express 3.x)
- Swagger/OpenAPI 3.0
- Winston 3.x 日志

### 数据流向
献血者登记 → 初筛合格 → 采血袋入库 → 检验检测 → 成分制备 → 成品入库 → 医院申请 → 交叉配血 → 出库配送 → 医院确认接收

### 性能约束
- 单次库存查询 ≤ 80ms
- 交叉配血计算 ≤ 200ms
- 并发支持: 100并发
- 效期扫描 ≤ 3s

### 用户角色
| 角色 | 说明 |
|------|------|
| nurse | 采血护士 |
| technician | 检验技师 |
| preparator | 成分制备员 |
| inventory | 库存管理员 |
| dispatcher | 配送调度员 |
| hospital | 医院输血科 |

### 认证方式
使用Header传递用户ID: X-User-ID: 1
或Bearer Token: Authorization: Bearer {token}
      `,
      contact: {
        name: '血液中心信息科'
      }
    },
    servers: [
      {
        url: '/',
        description: '本地开发服务器'
      }
    ],
    components: {
      securitySchemes: {
        UserIdAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-User-ID'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer'
        }
      },
      schemas: {
        Donor: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            donor_card_no: { type: 'string' },
            id_card_no: { type: 'string' },
            name: { type: 'string' },
            gender: { type: 'string', enum: ['男', '女'] },
            birth_date: { type: 'string', format: 'date' },
            blood_type_abo: { type: 'string', enum: ['A', 'B', 'AB', 'O'] },
            blood_type_rh: { type: 'string', enum: ['+', '-'] },
            donation_count: { type: 'integer' },
            last_donation_date: { type: 'string' },
            created_at: { type: 'string' }
          }
        },
        BloodRequest: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            request_no: { type: 'string' },
            hospital_id: { type: 'integer' },
            patient_blood_type_abo: { type: 'string' },
            patient_blood_type_rh: { type: 'string' },
            component_type: { type: 'string' },
            quantity: { type: 'integer' },
            urgency: { type: 'string', enum: ['常规', '紧急', '急诊'] },
            status: { type: 'string' },
            priority_score: { type: 'integer' },
            created_at: { type: 'string' }
          }
        },
        InventorySummary: {
          type: 'object',
          properties: {
            blood_type_abo: { type: 'string' },
            blood_type_full: { type: 'string' },
            component_type: { type: 'string' },
            available_quantity: { type: 'integer' },
            min_quantity: { type: 'integer' },
            warning_quantity: { type: 'integer' },
            stock_status: { type: 'string', enum: ['正常', '预警', '低于安全库存'] },
            stock_shortfall: { type: 'integer' }
          }
        },
        MatchingResult: {
          type: 'object',
          properties: {
            matched_count: { type: 'integer' },
            requested_count: { type: 'integer' },
            is_fully_matched: { type: 'boolean' },
            duration_ms: { type: 'integer' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/restRoutes.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs;
