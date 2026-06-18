import { db } from '../dexie';
import type { OperationLog, ActionType, EntityType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export const createOperationLog = async (
  actionType: ActionType,
  entityType: EntityType,
  entityId: string | null,
  details: Record<string, unknown> = {},
): Promise<OperationLog> => {
  const log: OperationLog = {
    id: uuidv4(),
    actionType,
    entityType,
    entityId,
    details,
    timestamp: new Date().toISOString(),
  };

  await db.operationLogs.add(log);
  return log;
};

export const logOperation = (
  actionType: ActionType,
  entityType: EntityType,
  entityId: string | null,
  details: Record<string, unknown> = {},
): Promise<OperationLog> => {
  return createOperationLog(actionType, entityType, entityId, details);
};

export const getOperationLogs = async (
  page: number = 1,
  pageSize: number = 20,
  actionType?: ActionType,
  entityType?: EntityType,
): Promise<{ logs: OperationLog[]; total: number }> => {
  let query = db.operationLogs.orderBy('timestamp').reverse();

  if (actionType) {
    query = query.filter((log) => log.actionType === actionType);
  }
  if (entityType) {
    query = query.filter((log) => log.entityType === entityType);
  }

  const total = await query.count();
  const offset = (page - 1) * pageSize;
  const logs = await query.offset(offset).limit(pageSize).toArray();

  return { logs, total };
};

export const getOperationLogsByEntity = async (
  entityType: EntityType,
  entityId: string,
): Promise<OperationLog[]> => {
  return db.operationLogs
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .reverse()
    .sortBy('timestamp');
};

export const clearOperationLogs = async (): Promise<void> => {
  await db.operationLogs.clear();
};

export const exportOperationLogs = async (): Promise<string> => {
  const logs = await db.operationLogs.orderBy('timestamp').toArray();
  return JSON.stringify(logs, null, 2);
};

export const withOperationLog = async <T>(
  actionType: ActionType,
  entityType: EntityType,
  entityId: string | null,
  operation: () => Promise<T>,
  details: Record<string, unknown> = {},
): Promise<T> => {
  try {
    const result = await operation();
    await createOperationLog(actionType, entityType, entityId, { ...details, success: true });
    return result;
  } catch (error) {
    await createOperationLog(actionType, entityType, entityId, {
      ...details,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
