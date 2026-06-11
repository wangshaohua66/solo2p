import type { Kiln, MaintenanceOrder, MaintenanceType } from '@/types';
import { mockKilns, mockMaintenanceOrders } from '@/mocks';
import { delay } from '@/api/index';

export async function listKilns(): Promise<Kiln[]> {
  await delay(300);
  return Promise.resolve(mockKilns);
}

export async function getKilnDetail(id: number): Promise<Kiln> {
  await delay(300);
  const existing = mockKilns.find((k) => k.id === id);
  return Promise.resolve(existing ?? mockKilns[0]);
}

export async function createMaintenanceOrder(
  id: number,
  data: {
    type: MaintenanceType;
    description: string;
    scheduledDate: string;
  },
): Promise<MaintenanceOrder> {
  await delay(300);
  const kiln = mockKilns.find((k) => k.id === id);
  const newOrder: MaintenanceOrder = {
    id: Date.now(),
    kilnId: id,
    kilnName: kiln?.name ?? '',
    type: data.type,
    description: data.description,
    status: 'PENDING',
    scheduledDate: data.scheduledDate,
    completedDate: null,
    createdAt: new Date().toISOString(),
  };
  return Promise.resolve(newOrder);
}

export async function listMaintenanceHistory(
  id: number,
): Promise<MaintenanceOrder[]> {
  await delay(300);
  return Promise.resolve(
    mockMaintenanceOrders.filter((o) => o.kilnId === id),
  );
}
