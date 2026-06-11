import api from '@/api/index';
import type { Batch, PageResult, InventoryWarning } from '@/types';

export async function listBatches(
  params?: Record<string, unknown>,
): Promise<PageResult<Batch>> {
  const { data } = await api.get<Batch[]>('/inventories/batches', { params });
  const list = data as Batch[];
  return {
    content: list,
    totalElements: list.length,
    totalPages: 1,
    size: list.length,
    number: 0,
  };
}

export async function getBatch(id: number): Promise<Batch> {
  const { data } = await api.get<Batch>(`/inventories/batches/${id}`);
  return data;
}

export async function createBatch(
  data: Partial<Batch>,
): Promise<Batch> {
  const resp = await api.post<Batch>('/inventories/batches', data);
  return resp.data;
}

export async function updateBatch(
  id: number,
  data: Partial<Batch>,
): Promise<Batch> {
  const resp = await api.put<Batch>(`/inventories/batches/${id}`, data);
  return resp.data;
}

export async function checkoutBatch(
  id: number,
  data: { quantity: number; operatorId?: number; note?: string },
): Promise<Batch> {
  const resp = await api.post<Batch>(`/inventories/batches/${id}/checkout`, {
    quantity: data.quantity,
  });
  return resp.data;
}

export async function fifoCheckout(
  materialName: string,
  quantity: number,
): Promise<Batch> {
  const resp = await api.post<Batch>('/inventories/batches/checkout-fifo', {
    materialName,
    quantity,
  });
  return resp.data;
}

export async function listWarnings(): Promise<InventoryWarning[]> {
  const { data } = await api.get<Batch[]>('/inventories/warnings');
  return (data as Batch[]).map((b) => ({
    id: b.id,
    type: 'EXPIRY',
    materialName: b.materialName,
    batchId: b.id,
    batchNo: b.batchNo,
    message: `批次 ${b.batchNo} 即将过期`,
    createdAt: b.createdAt,
  })) as InventoryWarning[];
}
