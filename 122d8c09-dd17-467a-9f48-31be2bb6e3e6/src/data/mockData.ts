import type { TaskNode, Dependency, Resource } from '@/types';
import { addDays, today } from '@/utils/dateUtils';

const T = today();

export const mockResources: Resource[] = [
  { id: 'r1', name: '张伟', pool: 'product', capacityPerDay: 8 },
  { id: 'r2', name: '李娜', pool: 'product', capacityPerDay: 8 },
  { id: 'r3', name: '王芳', pool: 'design', capacityPerDay: 8 },
  { id: 'r4', name: '刘洋', pool: 'design', capacityPerDay: 8 },
  { id: 'r5', name: '陈强', pool: 'development', capacityPerDay: 8 },
  { id: 'r6', name: '杨磊', pool: 'development', capacityPerDay: 8 },
  { id: 'r7', name: '赵敏', pool: 'development', capacityPerDay: 8 },
  { id: 'r8', name: '孙丽', pool: 'testing', capacityPerDay: 8 },
  { id: 'r9', name: '周杰', pool: 'testing', capacityPerDay: 8 },
  { id: 'r10', name: '吴昊', pool: 'development', capacityPerDay: 8 },
];

function makeTask(
  id: string,
  parentId: string | null,
  level: 1 | 2 | 3,
  name: string,
  startOffset: number,
  days: number,
  progress: number,
  status: TaskNode['status'],
  assigneeId: string | null,
  order: number,
  isMilestone = false
): TaskNode {
  return {
    id,
    parentId,
    level,
    name,
    startDate: addDays(T, startOffset),
    endDate: addDays(T, startOffset + days),
    progress,
    status,
    assigneeId,
    isMilestone,
    order,
    collapsed: false,
  };
}

export const mockTasks: Record<string, TaskNode> = {
  p1: makeTask('p1', null, 1, '客户管理系统 v2.0', -5, 60, 35, 'in-progress', null, 0),
  p1_s1: makeTask('p1_s1', 'p1', 2, 'Sprint 1: 需求与设计', -5, 20, 100, 'completed', null, 0),
  p1_s2: makeTask('p1_s2', 'p1', 2, 'Sprint 2: 核心开发', 10, 25, 40, 'in-progress', null, 1),
  p1_s3: makeTask('p1_s3', 'p1', 2, 'Sprint 3: 测试与上线', 30, 20, 0, 'not-started', null, 2),
  p1_t1: makeTask('p1_t1', 'p1_s1', 3, '用户调研', -5, 5, 100, 'completed', 'r1', 0),
  p1_t2: makeTask('p1_t2', 'p1_s1', 3, 'PRD 撰写', 0, 7, 100, 'completed', 'r2', 1),
  p1_t3: makeTask('p1_t3', 'p1_s1', 3, 'UI 原型设计', 3, 10, 100, 'completed', 'r3', 2),
  p1_t4: makeTask('p1_t4', 'p1_s1', 3, '设计评审', 10, 2, 100, 'completed', 'r3', 3, true),
  p1_t5: makeTask('p1_t5', 'p1_s2', 3, '数据库设计', 10, 5, 100, 'completed', 'r5', 0),
  p1_t6: makeTask('p1_t6', 'p1_s2', 3, '客户模块后端', 13, 12, 70, 'in-progress', 'r5', 1),
  p1_t7: makeTask('p1_t7', 'p1_s2', 3, '权限模块后端', 15, 10, 50, 'in-progress', 'r6', 2),
  p1_t8: makeTask('p1_t8', 'p1_s2', 3, '前端页面开发', 18, 14, 30, 'in-progress', 'r7', 3),
  p1_t9: makeTask('p1_t9', 'p1_s2', 3, '前后端联调', 28, 7, 0, 'not-started', 'r7', 4),
  p1_t10: makeTask('p1_t10', 'p1_s3', 3, '集成测试', 30, 8, 0, 'not-started', 'r8', 0),
  p1_t11: makeTask('p1_t11', 'p1_s3', 3, '性能压测', 35, 5, 0, 'not-started', 'r9', 1),
  p1_t12: makeTask('p1_t12', 'p1_s3', 3, 'UAT 验收', 40, 6, 0, 'not-started', 'r1', 2),
  p1_t13: makeTask('p1_t13', 'p1_s3', 3, '正式上线', 46, 2, 0, 'not-started', 'r10', 3, true),

  p2: makeTask('p2', null, 1, '数据中台建设', 0, 75, 20, 'in-progress', null, 1),
  p2_s1: makeTask('p2_s1', 'p2', 2, '阶段一: 数据接入', 0, 25, 60, 'in-progress', null, 0),
  p2_s2: makeTask('p2_s2', 'p2', 2, '阶段二: 数仓建模', 20, 30, 0, 'not-started', null, 1),
  p2_t1: makeTask('p2_t1', 'p2_s1', 3, '数据源梳理', 0, 5, 100, 'completed', 'r2', 0),
  p2_t2: makeTask('p2_t2', 'p2_s1', 3, 'ETL 开发', 3, 15, 40, 'in-progress', 'r6', 1),
  p2_t3: makeTask('p2_t3', 'p2_s1', 3, '数据质量校验', 15, 8, 0, 'not-started', 'r8', 2),
  p2_t4: makeTask('p2_t4', 'p2_s2', 3, '维度模型设计', 20, 10, 0, 'not-started', 'r5', 0),
  p2_t5: makeTask('p2_t5', 'p2_s2', 3, '指标体系建设', 28, 12, 0, 'not-started', 'r1', 1),
  p2_t6: makeTask('p2_t6', 'p2_s2', 3, '报表开发', 38, 10, 0, 'not-started', 'r7', 2),

  p3: makeTask('p3', null, 1, '移动端 App 重构', -10, 50, 55, 'in-progress', null, 2),
  p3_s1: makeTask('p3_s1', 'p3', 2, '架构设计与技术选型', -10, 15, 100, 'completed', null, 0),
  p3_s2: makeTask('p3_s2', 'p3', 2, '核心模块重构', 2, 25, 50, 'in-progress', null, 1),
  p3_s3: makeTask('p3_s3', 'p3', 2, '性能优化与发布', 25, 15, 0, 'not-started', null, 2),
  p3_t1: makeTask('p3_t1', 'p3_s1', 3, '技术选型评审', -10, 5, 100, 'completed', 'r5', 0),
  p3_t2: makeTask('p3_t2', 'p3_s1', 3, '架构设计文档', -6, 8, 100, 'completed', 'r6', 1),
  p3_t3: makeTask('p3_t3', 'p3_s2', 3, '用户模块重构', 2, 12, 70, 'in-progress', 'r7', 0),
  p3_t4: makeTask('p3_t4', 'p3_s2', 3, '首页重构', 10, 10, 40, 'in-progress', 'r10', 1),
  p3_t5: makeTask('p3_t5', 'p3_s2', 3, '支付模块重构', 18, 8, 0, 'not-started', 'r6', 2),
  p3_t6: makeTask('p3_t6', 'p3_s3', 3, '启动性能优化', 25, 7, 0, 'not-started', 'r10', 0),
  p3_t7: makeTask('p3_t7', 'p3_s3', 3, '内存泄漏治理', 30, 5, 0, 'not-started', 'r5', 1),
  p3_t8: makeTask('p3_t8', 'p3_s3', 3, 'App Store 发布', 35, 3, 0, 'not-started', 'r2', 2, true),
};

export const mockTaskOrder = ['p1', 'p2', 'p3'];

export const mockDependencies: Dependency[] = [
  { id: 'd1', fromTaskId: 'p1_t1', toTaskId: 'p1_t2', type: 'FS', lagDays: 0 },
  { id: 'd2', fromTaskId: 'p1_t2', toTaskId: 'p1_t3', type: 'FS', lagDays: 1 },
  { id: 'd3', fromTaskId: 'p1_t3', toTaskId: 'p1_t4', type: 'FS', lagDays: 0 },
  { id: 'd4', fromTaskId: 'p1_t4', toTaskId: 'p1_t5', type: 'FS', lagDays: 0 },
  { id: 'd5', fromTaskId: 'p1_t5', toTaskId: 'p1_t6', type: 'FS', lagDays: 0 },
  { id: 'd6', fromTaskId: 'p1_t5', toTaskId: 'p1_t7', type: 'FS', lagDays: 0 },
  { id: 'd7', fromTaskId: 'p1_t6', toTaskId: 'p1_t8', type: 'FS', lagDays: 2 },
  { id: 'd8', fromTaskId: 'p1_t7', toTaskId: 'p1_t8', type: 'FS', lagDays: 1 },
  { id: 'd9', fromTaskId: 'p1_t8', toTaskId: 'p1_t9', type: 'FS', lagDays: 0 },
  { id: 'd10', fromTaskId: 'p1_t9', toTaskId: 'p1_t10', type: 'FS', lagDays: 0 },
  { id: 'd11', fromTaskId: 'p1_t10', toTaskId: 'p1_t11', type: 'FS', lagDays: 2 },
  { id: 'd12', fromTaskId: 'p1_t11', toTaskId: 'p1_t12', type: 'FS', lagDays: 0 },
  { id: 'd13', fromTaskId: 'p1_t12', toTaskId: 'p1_t13', type: 'FS', lagDays: 0 },
  { id: 'd14', fromTaskId: 'p2_t1', toTaskId: 'p2_t2', type: 'FS', lagDays: 0 },
  { id: 'd15', fromTaskId: 'p2_t2', toTaskId: 'p2_t3', type: 'FS', lagDays: 0 },
  { id: 'd16', fromTaskId: 'p2_t3', toTaskId: 'p2_t4', type: 'FS', lagDays: 1 },
  { id: 'd17', fromTaskId: 'p2_t4', toTaskId: 'p2_t5', type: 'FS', lagDays: 0 },
  { id: 'd18', fromTaskId: 'p2_t5', toTaskId: 'p2_t6', type: 'FS', lagDays: 2 },
  { id: 'd19', fromTaskId: 'p3_t1', toTaskId: 'p3_t2', type: 'FS', lagDays: 0 },
  { id: 'd20', fromTaskId: 'p3_t2', toTaskId: 'p3_t3', type: 'FS', lagDays: 0 },
  { id: 'd21', fromTaskId: 'p3_t3', toTaskId: 'p3_t4', type: 'SS', lagDays: 3 },
  { id: 'd22', fromTaskId: 'p3_t4', toTaskId: 'p3_t5', type: 'FS', lagDays: 0 },
  { id: 'd23', fromTaskId: 'p3_t5', toTaskId: 'p3_t6', type: 'FS', lagDays: 0 },
  { id: 'd24', fromTaskId: 'p3_t6', toTaskId: 'p3_t7', type: 'SS', lagDays: 2 },
  { id: 'd25', fromTaskId: 'p3_t7', toTaskId: 'p3_t8', type: 'FS', lagDays: 1 },
];
