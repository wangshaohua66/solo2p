import Router from '@koa/router';
import { v4 as uuidv4 } from 'uuid';
import {
  mockDisorders,
  mockWorkOrders,
  mockRoadSections,
  mockConstructionTeams
} from '@/mock/data';
import { Disorder, WorkOrder, DisorderStatus, WorkOrderStatus, AcceptanceRecord } from '@/types';
import { redisClient } from '@/redis/client';
import { publish, CHANNEL_NOTIFY_DISORDER, CHANNEL_NOTIFY_WORKORDER } from '@/redis/pubsub';
import { calculatePriorityScore, recommendTeams } from '@/service/scheduler';
import {
  validateReportDisorder,
  validateGradeDisorder,
  validateCreateWorkOrder,
  validateUpdateStatus,
  validateUpdateProgress,
  validateSubmitAcceptance
} from '@/validator/disorder';

const router = new Router();

const inMemoryDisorders: Disorder[] = [...mockDisorders];
const inMemoryWorkOrders: WorkOrder[] = [...mockWorkOrders];
const inMemoryAcceptanceRecords: AcceptanceRecord[] = [];

router.post('/api/disorder/report', validateReportDisorder, async (ctx) => {
  const body = ctx.request.body as any;

  const now = new Date().toISOString();
  const newDisorder: Disorder = {
    id: `dis-${uuidv4().slice(0, 8)}`,
    type: body.type,
    severity: body.severity,
    description: body.description,
    location: body.location,
    images: body.images || [],
    reporterId: body.reporterId,
    reporterName: body.reporterName,
    status: 'reported',
    createdAt: now,
    updatedAt: now
  };

  const roadSection = mockRoadSections.find(r => r.id === body.location.roadSectionId);
  const priorityScore = calculatePriorityScore(newDisorder, roadSection);

  inMemoryDisorders.unshift(newDisorder);

  await redisClient.set(`disorder:${newDisorder.id}`, JSON.stringify(newDisorder), 86400);
  await redisClient.hset('disorder:scores', newDisorder.id, String(priorityScore));

  await publish(CHANNEL_NOTIFY_DISORDER, {
    type: 'new',
    data: newDisorder,
    priorityScore,
    isUrgent: priorityScore >= 80,
    timestamp: now
  });

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: '病害上报成功',
    data: {
      ...newDisorder,
      priorityScore,
      isUrgent: priorityScore >= 80
    },
    timestamp: Date.now()
  };
});

router.get('/api/workorder/list', async (ctx) => {
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '50', 10);
  const status = ctx.query.status as string;
  const teamId = ctx.query.teamId as string;
  const assigneeId = ctx.query.assigneeId as string;

  let filtered = [...inMemoryWorkOrders];

  if (status) {
    filtered = filtered.filter(w => w.status === status);
  }
  if (teamId) {
    filtered = filtered.filter(w => w.teamId === teamId);
  }
  if (assigneeId) {
    filtered = filtered.filter(w => w.assigneeId === assigneeId);
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize);

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: 'success',
    data: {
      list,
      total,
      page,
      pageSize
    },
    timestamp: Date.now()
  };
});

router.get('/api/disorder/list', async (ctx) => {
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '10', 10);
  const type = ctx.query.type as string;
  const status = ctx.query.status as string;

  let filtered = [...inMemoryDisorders];

  if (type) {
    filtered = filtered.filter(d => d.type === type);
  }
  if (status) {
    filtered = filtered.filter(d => d.status === status);
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize);

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: 'success',
    data: {
      list,
      total,
      page,
      pageSize
    },
    timestamp: Date.now()
  };
});

router.get('/api/disorder/:id', async (ctx) => {
  const { id } = ctx.params;
  const disorder = inMemoryDisorders.find(d => d.id === id);

  if (!disorder) {
    ctx.status = 404;
    ctx.body = {
      code: 404,
      message: '病害不存在',
      timestamp: Date.now()
    };
    return;
  }

  const workOrder = inMemoryWorkOrders.find(w => w.id === disorder.workOrderId);
  const roadSection = mockRoadSections.find(r => r.id === disorder.location.roadSectionId);
  const priorityScore = calculatePriorityScore(disorder, roadSection);

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: 'success',
    data: {
      ...disorder,
      workOrder,
      priorityScore,
      isUrgent: priorityScore >= 80
    },
    timestamp: Date.now()
  };
});

router.put('/api/disorder/:id/grade', validateGradeDisorder, async (ctx) => {
  const { id } = ctx.params;
  const body = ctx.request.body as any;

  const disorderIndex = inMemoryDisorders.findIndex(d => d.id === id);
  if (disorderIndex === -1) {
    ctx.status = 404;
    ctx.body = {
      code: 404,
      message: '病害不存在',
      timestamp: Date.now()
    };
    return;
  }

  const now = new Date().toISOString();
  inMemoryDisorders[disorderIndex] = {
    ...inMemoryDisorders[disorderIndex],
    severity: body.severity,
    status: 'graded',
    gradedBy: body.gradedBy,
    gradedAt: now,
    updatedAt: now
  };

  const roadSection = mockRoadSections.find(r => r.id === inMemoryDisorders[disorderIndex].location.roadSectionId);
  const priorityScore = calculatePriorityScore(inMemoryDisorders[disorderIndex], roadSection);

  await redisClient.set(`disorder:${id}`, JSON.stringify(inMemoryDisorders[disorderIndex]), 86400);
  await redisClient.hset('disorder:scores', id, String(priorityScore));

  await publish(CHANNEL_NOTIFY_DISORDER, {
    type: 'graded',
    data: inMemoryDisorders[disorderIndex],
    priorityScore,
    isUrgent: priorityScore >= 80,
    timestamp: now
  });

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: '病害等级审核成功',
    data: {
      ...inMemoryDisorders[disorderIndex],
      priorityScore,
      isUrgent: priorityScore >= 80
    },
    timestamp: Date.now()
  };
});

router.get('/api/workorder/recommend', async (ctx) => {
  const disorderId = ctx.query.disorderId as string;

  if (!disorderId) {
    ctx.status = 400;
    ctx.body = {
      code: 400,
      message: '缺少disorderId参数',
      timestamp: Date.now()
    };
    return;
  }

  const disorder = inMemoryDisorders.find(d => d.id === disorderId);
  if (!disorder) {
    ctx.status = 404;
    ctx.body = {
      code: 404,
      message: '病害不存在',
      timestamp: Date.now()
    };
    return;
  }

  const recommendations = recommendTeams(disorder, mockConstructionTeams, inMemoryWorkOrders);

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: 'success',
    data: recommendations,
    timestamp: Date.now()
  };
});

router.post('/api/workorder/create', validateCreateWorkOrder, async (ctx) => {
  const body = ctx.request.body as any;

  const disorder = inMemoryDisorders.find(d => d.id === body.disorderId);
  if (!disorder) {
    ctx.status = 404;
    ctx.body = {
      code: 404,
      message: '病害不存在',
      timestamp: Date.now()
    };
    return;
  }

  const now = new Date().toISOString();
  const newWorkOrder: WorkOrder = {
    id: `wo-${uuidv4().slice(0, 8)}`,
    disorderId: body.disorderId,
    title: body.title,
    description: body.description,
    teamId: body.teamId,
    teamName: body.teamName,
    assigneeId: body.assigneeId,
    assigneeName: body.assigneeName,
    status: 'assigned',
    priority: body.priority,
    estimatedHours: body.estimatedHours,
    materials: body.materials || [],
    createdAt: now,
    updatedAt: now,
    deadline: body.deadline
  };

  inMemoryWorkOrders.unshift(newWorkOrder);

  const disorderIndex = inMemoryDisorders.findIndex(d => d.id === body.disorderId);
  if (disorderIndex !== -1) {
    inMemoryDisorders[disorderIndex] = {
      ...inMemoryDisorders[disorderIndex],
      status: 'assigned',
      workOrderId: newWorkOrder.id,
      updatedAt: now
    };
    await redisClient.set(`disorder:${body.disorderId}`, JSON.stringify(inMemoryDisorders[disorderIndex]), 86400);
  }

  await redisClient.set(`workorder:${newWorkOrder.id}`, JSON.stringify(newWorkOrder), 86400);

  await publish(CHANNEL_NOTIFY_WORKORDER, {
    type: 'created',
    data: newWorkOrder,
    disorder: inMemoryDisorders[disorderIndex],
    timestamp: now
  });

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: '工单创建成功',
    data: newWorkOrder,
    timestamp: Date.now()
  };
});

router.put('/api/workorder/:id/status', validateUpdateStatus, async (ctx) => {
  const { id } = ctx.params;
  const body = ctx.request.body as any;

  const workOrderIndex = inMemoryWorkOrders.findIndex(w => w.id === id);
  if (workOrderIndex === -1) {
    ctx.status = 404;
    ctx.body = {
      code: 404,
      message: '工单不存在',
      timestamp: Date.now()
    };
    return;
  }

  const now = new Date().toISOString();
  const prevStatus = inMemoryWorkOrders[workOrderIndex].status;
  inMemoryWorkOrders[workOrderIndex] = {
    ...inMemoryWorkOrders[workOrderIndex],
    status: body.status as WorkOrderStatus,
    updatedAt: now
  };

  const disorderStatusMap: Record<string, DisorderStatus> = {
    assigned: 'assigned',
    repairing: 'repairing',
    accepting: 'accepting',
    closed: 'closed',
    rejected: 'graded'
  };

  const disorderIndex = inMemoryDisorders.findIndex(d => d.id === inMemoryWorkOrders[workOrderIndex].disorderId);
  if (disorderIndex !== -1 && disorderStatusMap[body.status]) {
    inMemoryDisorders[disorderIndex] = {
      ...inMemoryDisorders[disorderIndex],
      status: disorderStatusMap[body.status],
      updatedAt: now
    };
    await redisClient.set(`disorder:${inMemoryDisorders[disorderIndex].id}`, JSON.stringify(inMemoryDisorders[disorderIndex]), 86400);
  }

  await redisClient.set(`workorder:${id}`, JSON.stringify(inMemoryWorkOrders[workOrderIndex]), 86400);

  await publish(CHANNEL_NOTIFY_WORKORDER, {
    type: 'status_changed',
    data: inMemoryWorkOrders[workOrderIndex],
    prevStatus,
    newStatus: body.status,
    operatorId: body.operatorId,
    operatorName: body.operatorName,
    remark: body.remark,
    timestamp: now
  });

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: '工单状态更新成功',
    data: inMemoryWorkOrders[workOrderIndex],
    timestamp: Date.now()
  };
});

router.put('/api/workorder/:id/progress', validateUpdateProgress, async (ctx) => {
  const { id } = ctx.params;
  const body = ctx.request.body as any;

  const workOrderIndex = inMemoryWorkOrders.findIndex(w => w.id === id);
  if (workOrderIndex === -1) {
    ctx.status = 404;
    ctx.body = {
      code: 404,
      message: '工单不存在',
      timestamp: Date.now()
    };
    return;
  }

  const now = new Date().toISOString();
  inMemoryWorkOrders[workOrderIndex] = {
    ...inMemoryWorkOrders[workOrderIndex],
    repairDescription: body.repairDescription || inMemoryWorkOrders[workOrderIndex].repairDescription,
    repairImages: body.repairImages || inMemoryWorkOrders[workOrderIndex].repairImages,
    actualHours: body.actualHours ?? inMemoryWorkOrders[workOrderIndex].actualHours,
    updatedAt: now
  };

  if (body.progress >= 100) {
    inMemoryWorkOrders[workOrderIndex].status = 'accepting';
    const disorderIndex = inMemoryDisorders.findIndex(d => d.id === inMemoryWorkOrders[workOrderIndex].disorderId);
    if (disorderIndex !== -1) {
      inMemoryDisorders[disorderIndex] = {
        ...inMemoryDisorders[disorderIndex],
        status: 'accepting',
        updatedAt: now
      };
      await redisClient.set(`disorder:${inMemoryDisorders[disorderIndex].id}`, JSON.stringify(inMemoryDisorders[disorderIndex]), 86400);
    }
  }

  await redisClient.set(`workorder:${id}`, JSON.stringify(inMemoryWorkOrders[workOrderIndex]), 86400);

  await publish(CHANNEL_NOTIFY_WORKORDER, {
    type: 'progress_updated',
    data: inMemoryWorkOrders[workOrderIndex],
    progress: body.progress,
    timestamp: now
  });

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: '修复进度更新成功',
    data: inMemoryWorkOrders[workOrderIndex],
    timestamp: Date.now()
  };
});

router.post('/api/workorder/:id/acceptance', validateSubmitAcceptance, async (ctx) => {
  const { id } = ctx.params;
  const body = ctx.request.body as any;

  const workOrderIndex = inMemoryWorkOrders.findIndex(w => w.id === id);
  if (workOrderIndex === -1) {
    ctx.status = 404;
    ctx.body = {
      code: 404,
      message: '工单不存在',
      timestamp: Date.now()
    };
    return;
  }

  const now = new Date().toISOString();
  inMemoryWorkOrders[workOrderIndex] = {
    ...inMemoryWorkOrders[workOrderIndex],
    acceptanceResult: body.result,
    acceptanceRemark: body.remark,
    acceptedBy: body.acceptorId,
    acceptedAt: now,
    status: body.result === 'pass' ? 'closed' : 'rejected',
    updatedAt: now
  };

  const disorderIndex = inMemoryDisorders.findIndex(d => d.id === inMemoryWorkOrders[workOrderIndex].disorderId);
  if (disorderIndex !== -1) {
    inMemoryDisorders[disorderIndex] = {
      ...inMemoryDisorders[disorderIndex],
      status: body.result === 'pass' ? 'closed' : 'graded',
      updatedAt: now
    };
    await redisClient.set(`disorder:${inMemoryDisorders[disorderIndex].id}`, JSON.stringify(inMemoryDisorders[disorderIndex]), 86400);
  }

  const acceptanceRecord: AcceptanceRecord = {
    id: `ar-${uuidv4().slice(0, 8)}`,
    workOrderId: id,
    disorderId: inMemoryWorkOrders[workOrderIndex].disorderId,
    acceptorId: body.acceptorId,
    acceptorName: body.acceptorName,
    result: body.result,
    remark: body.remark,
    images: body.images || [],
    createdAt: now
  };
  inMemoryAcceptanceRecords.push(acceptanceRecord);

  await redisClient.set(`workorder:${id}`, JSON.stringify(inMemoryWorkOrders[workOrderIndex]), 86400);
  await redisClient.set(`acceptance:${acceptanceRecord.id}`, JSON.stringify(acceptanceRecord), 86400);

  await publish(CHANNEL_NOTIFY_WORKORDER, {
    type: 'acceptance_submitted',
    data: inMemoryWorkOrders[workOrderIndex],
    acceptance: acceptanceRecord,
    timestamp: now
  });

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: '验收结果提交成功',
    data: inMemoryWorkOrders[workOrderIndex],
    timestamp: Date.now()
  };
});

export default router;
export { inMemoryDisorders, inMemoryWorkOrders, inMemoryAcceptanceRecords };
