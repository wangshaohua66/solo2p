import koaSwagger from 'koa2-swagger-ui';
import { Context, Next } from 'koa';

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: '公路病害管理系统 API',
    version: '1.0.0',
    description: '公路病害巡查、上报、派单、维修、验收全流程管理接口文档'
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: '本地开发服务器'
    }
  ],
  tags: [
    { name: '病害管理', description: '病害上报、查询、审核' },
    { name: '工单管理', description: '工单创建、状态更新、进度跟踪、验收' },
    { name: '巡查管理', description: '轨迹上报、覆盖率统计' },
    { name: '统计分析', description: '数据概览、趋势分析' }
  ],
  paths: {
    '/api/disorder/report': {
      post: {
        tags: ['病害管理'],
        summary: '病害上报',
        description: '巡查人员上报发现的道路病害',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReportDisorderRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: '上报成功',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponseDisorder' }
              }
            }
          },
          '400': {
            description: '参数错误',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponseError' }
              }
            }
          }
        }
      }
    },
    '/api/disorder/list': {
      get: {
        tags: ['病害管理'],
        summary: '查询病害列表',
        description: '支持分页、类型、状态筛选',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: '页码' },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 10 }, description: '每页数量' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['crack', 'pothole', 'bridge_jump', 'rutting', 'other'] }, description: '病害类型' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['reported', 'graded', 'assigned', 'repairing', 'accepting', 'closed'] }, description: '病害状态' }
        ],
        responses: {
          '200': {
            description: '查询成功',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponseDisorderList' }
              }
            }
          }
        }
      }
    },
    '/api/disorder/{id}': {
      get: {
        tags: ['病害管理'],
        summary: '获取病害详情',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: '病害ID' }
        ],
        responses: {
          '200': { description: '成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseDisorder' } } } },
          '404': { description: '病害不存在', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseError' } } } }
        }
      }
    },
    '/api/disorder/{id}/grade': {
      put: {
        tags: ['病害管理'],
        summary: '审核病害等级',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: '病害ID' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GradeDisorderRequest' }
            }
          }
        },
        responses: {
          '200': { description: '审核成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseDisorder' } } } }
        }
      }
    },
    '/api/workorder/recommend': {
      get: {
        tags: ['工单管理'],
        summary: '获取施工队推荐列表',
        parameters: [
          { name: 'disorderId', in: 'query', required: true, schema: { type: 'string' }, description: '病害ID' }
        ],
        responses: {
          '200': { description: '成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseTeamList' } } } }
        }
      }
    },
    '/api/workorder/create': {
      post: {
        tags: ['工单管理'],
        summary: '创建工单',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWorkOrderRequest' }
            }
          }
        },
        responses: {
          '200': { description: '创建成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseWorkOrder' } } } }
        }
      }
    },
    '/api/workorder/{id}/status': {
      put: {
        tags: ['工单管理'],
        summary: '更新工单状态',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: '工单ID' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateStatusRequest' }
            }
          }
        },
        responses: {
          '200': { description: '更新成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseWorkOrder' } } } }
        }
      }
    },
    '/api/workorder/{id}/progress': {
      put: {
        tags: ['工单管理'],
        summary: '更新修复进度',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: '工单ID' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateProgressRequest' }
            }
          }
        },
        responses: {
          '200': { description: '更新成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseWorkOrder' } } } }
        }
      }
    },
    '/api/workorder/{id}/acceptance': {
      post: {
        tags: ['工单管理'],
        summary: '提交验收结果',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: '工单ID' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SubmitAcceptanceRequest' }
            }
          }
        },
        responses: {
          '200': { description: '提交成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseWorkOrder' } } } }
        }
      }
    },
    '/api/patrol/track': {
      post: {
        tags: ['巡查管理'],
        summary: '上报轨迹点',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReportTrackRequest' }
            }
          }
        },
        responses: {
          '200': { description: '上报成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseTrackPoint' } } } }
        }
      }
    },
    '/api/patrol/tracks/{patrolId}': {
      get: {
        tags: ['巡查管理'],
        summary: '获取单次巡查轨迹',
        parameters: [
          { name: 'patrolId', in: 'path', required: true, schema: { type: 'string' }, description: '巡查ID' }
        ],
        responses: {
          '200': { description: '成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseTrackList' } } } }
        }
      }
    },
    '/api/patrol/coverage': {
      get: {
        tags: ['巡查管理'],
        summary: '获取巡查覆盖率统计',
        responses: {
          '200': { description: '成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseCoverage' } } } }
        }
      }
    },
    '/api/stats/overview': {
      get: {
        tags: ['统计分析'],
        summary: '获取统计概览',
        description: '病害总数、修复率、平均修复时长、覆盖率',
        responses: {
          '200': { description: '成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseOverview' } } } }
        }
      }
    },
    '/api/stats/trend': {
      get: {
        tags: ['统计分析'],
        summary: '获取趋势数据',
        description: '近7天/30天病害发现量、修复量',
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', default: 7 }, description: '天数（7或30）' }
        ],
        responses: {
          '200': { description: '成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseTrend' } } } }
        }
      }
    }
  },
  components: {
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          code: { type: 'number', example: 200 },
          message: { type: 'string', example: 'success' },
          data: { type: 'object' },
          timestamp: { type: 'number', example: 1718000000000 }
        },
        required: ['code', 'message', 'timestamp']
      },
      ApiResponseError: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              code: { type: 'number', example: 400 },
              message: { type: 'string', example: '参数错误' },
              data: {
                type: 'object',
                properties: {
                  details: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: { type: 'string' },
                        message: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        ]
      },
      Location: {
        type: 'object',
        properties: {
          lat: { type: 'number', example: 39.9042 },
          lng: { type: 'number', example: 116.4074 },
          address: { type: 'string', example: '北京市东城区长安街' },
          roadSectionId: { type: 'string', example: 'road-001' },
          mileage: { type: 'string', example: 'K12+500' }
        },
        required: ['lat', 'lng']
      },
      Disorder: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['crack', 'pothole', 'bridge_jump', 'rutting', 'other'] },
          severity: { type: 'string', enum: ['mild', 'moderate', 'severe', 'critical'] },
          description: { type: 'string' },
          location: { $ref: '#/components/schemas/Location' },
          images: { type: 'array', items: { type: 'string' } },
          reporterId: { type: 'string' },
          reporterName: { type: 'string' },
          status: { type: 'string', enum: ['reported', 'graded', 'assigned', 'repairing', 'accepting', 'closed'] },
          workOrderId: { type: 'string' },
          gradedBy: { type: 'string' },
          gradedAt: { type: 'string' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' }
        }
      },
      ApiResponseDisorder: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/Disorder' }
            }
          }
        ]
      },
      ApiResponseDisorderList: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  list: { type: 'array', items: { $ref: '#/components/schemas/Disorder' } },
                  total: { type: 'number' },
                  page: { type: 'number' },
                  pageSize: { type: 'number' }
                }
              }
            }
          }
        ]
      },
      ReportDisorderRequest: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['crack', 'pothole', 'bridge_jump', 'rutting', 'other'] },
          severity: { type: 'string', enum: ['mild', 'moderate', 'severe', 'critical'] },
          description: { type: 'string' },
          location: { $ref: '#/components/schemas/Location' },
          images: { type: 'array', items: { type: 'string' } },
          reporterId: { type: 'string' },
          reporterName: { type: 'string' }
        },
        required: ['type', 'severity', 'description', 'location', 'reporterId', 'reporterName']
      },
      GradeDisorderRequest: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['mild', 'moderate', 'severe', 'critical'] },
          gradedBy: { type: 'string' },
          gradedName: { type: 'string' }
        },
        required: ['severity', 'gradedBy']
      },
      WorkOrder: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          disorderId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          teamId: { type: 'string' },
          teamName: { type: 'string' },
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'assigned', 'repairing', 'accepting', 'closed', 'rejected'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          estimatedHours: { type: 'number' },
          actualHours: { type: 'number' },
          materials: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' }
              }
            }
          },
          repairImages: { type: 'array', items: { type: 'string' } },
          repairDescription: { type: 'string' },
          acceptanceResult: { type: 'string', enum: ['pass', 'fail'] },
          acceptanceRemark: { type: 'string' },
          acceptedBy: { type: 'string' },
          acceptedAt: { type: 'string' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
          deadline: { type: 'string' }
        }
      },
      ApiResponseWorkOrder: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/WorkOrder' }
            }
          }
        ]
      },
      CreateWorkOrderRequest: {
        type: 'object',
        properties: {
          disorderId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          teamId: { type: 'string' },
          teamName: { type: 'string' },
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          estimatedHours: { type: 'number' },
          materials: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' }
              }
            }
          },
          deadline: { type: 'string' }
        },
        required: ['disorderId', 'title', 'description', 'teamId', 'teamName', 'assigneeId', 'assigneeName', 'priority']
      },
      UpdateStatusRequest: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'assigned', 'repairing', 'accepting', 'closed', 'rejected'] },
          operatorId: { type: 'string' },
          operatorName: { type: 'string' },
          remark: { type: 'string' }
        },
        required: ['status', 'operatorId']
      },
      UpdateProgressRequest: {
        type: 'object',
        properties: {
          progress: { type: 'number', minimum: 0, maximum: 100 },
          repairDescription: { type: 'string' },
          repairImages: { type: 'array', items: { type: 'string' } },
          actualHours: { type: 'number' },
          operatorId: { type: 'string' },
          operatorName: { type: 'string' }
        },
        required: ['progress', 'operatorId']
      },
      SubmitAcceptanceRequest: {
        type: 'object',
        properties: {
          result: { type: 'string', enum: ['pass', 'fail'] },
          remark: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } },
          acceptorId: { type: 'string' },
          acceptorName: { type: 'string' }
        },
        required: ['result', 'remark', 'acceptorId', 'acceptorName']
      },
      TeamRecommendation: {
        type: 'object',
        properties: {
          teamId: { type: 'string' },
          teamName: { type: 'string' },
          matchScore: { type: 'number' },
          reason: { type: 'string' },
          estimatedDuration: { type: 'number' }
        }
      },
      ApiResponseTeamList: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/TeamRecommendation' }
              }
            }
          }
        ]
      },
      TrackPoint: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          inspectorId: { type: 'string' },
          inspectorName: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          timestamp: { type: 'string' },
          speed: { type: 'number' },
          accuracy: { type: 'number' }
        }
      },
      ApiResponseTrackPoint: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/TrackPoint' }
            }
          }
        ]
      },
      ApiResponseTrackList: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  patrolId: { type: 'string' },
                  points: { type: 'array', items: { $ref: '#/components/schemas/TrackPoint' } }
                }
              }
            }
          }
        ]
      },
      ReportTrackRequest: {
        type: 'object',
        properties: {
          patrolId: { type: 'string' },
          inspectorId: { type: 'string' },
          inspectorName: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          timestamp: { type: 'string' },
          speed: { type: 'number' },
          accuracy: { type: 'number' }
        },
        required: ['patrolId', 'inspectorId', 'inspectorName', 'lat', 'lng']
      },
      CoverageStats: {
        type: 'object',
        properties: {
          coveredSectionIds: { type: 'array', items: { type: 'string' } },
          totalLength: { type: 'number' },
          coveredLength: { type: 'number' },
          coverageRate: { type: 'number' }
        }
      },
      ApiResponseCoverage: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/CoverageStats' }
            }
          }
        ]
      },
      OverviewStats: {
        type: 'object',
        properties: {
          totalDisorders: { type: 'number' },
          repairedCount: { type: 'number' },
          repairRate: { type: 'number' },
          avgRepairHours: { type: 'number' },
          coverageRate: { type: 'number' }
        }
      },
      ApiResponseOverview: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/OverviewStats' }
            }
          }
        ]
      },
      TrendData: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          discovered: { type: 'number' },
          repaired: { type: 'number' }
        }
      },
      ApiResponseTrend: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/TrendData' }
              }
            }
          }
        ]
      }
    }
  }
};

export function getSwaggerJson() {
  return swaggerSpec;
}

export function swaggerMiddleware() {
  return koaSwagger({
    routePrefix: '/api-docs',
    swaggerOptions: {
      spec: swaggerSpec
    },
    exposeSpec: true,
    specPrefix: '/swagger.json'
  });
}

export async function swaggerJsonHandler(ctx: Context, next: Next) {
  if (ctx.path === '/swagger.json' && ctx.method === 'GET') {
    ctx.body = swaggerSpec;
    ctx.status = 200;
    return;
  }
  await next();
}
