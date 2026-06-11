import type { Batch, PageResult, InventoryWarning } from '@/types';
import { mockBatches, mockWarnings } from '@/mocks';
import { delay } from '@/api/index';

export async function listBatches(
  params?: Record<string, unknown>,
): Promise<PageResult<Batch>> {
  await delay(300);
  return Promise.resolve({
    content: mockBatches,
    totalElements: mockBatches.length,
    totalPages: 1,
    size: 20,
    number: 0,
  });
}

export async function createBatch(
  data: Partial<Batch>,
): Promise<Batch> {
  await delay(300);
  const newBatch: Batch = {
    id: Date.now(),
    batchNo: `MOCK-${Date.now()}`,
    supplierId: data.supplierId ?? 0,
    supplierName: data.supplierName ?? '',
    materialName: data.materialName ?? '',
    quantity: data.quantity ?? 0,
    unit: data.unit ?? 'kg',
    expiryDate: data.expiryDate ?? null,
    oxideComposition: data.oxideComposition ?? {},
    spectralData: data.spectralData,
    status: 'IN_STOCK',
    createdAt: new Date().toISOString(),
  };
  return Promise.resolve(newBatch);
}

export async function updateBatch(
  id: number,
  data: Partial<Batch>,
): Promise<Batch> {
  await delay(300);
  const existing = mockBatches.find((b) => b.id === id);
  return Promise.resolve({
    ...(existing ?? mockBatches[0]),
    ...data,
    id,
  } as Batch);
}

export async function checkoutBatch(
  id: number,
  data: { quantity: number; operatorId: number; note?: string },
): Promise<Batch> {
  await delay(300);
  const existing = mockBatches.find((b) => b.id === id);
  return Promise.resolve({
    ...(existing ?? mockBatches[0]),
    id,
    status: 'CHECKED_OUT',
  } as Batch);
}

export async function listWarnings(): Promise<InventoryWarning[]> {
  await delay(300);
  return Promise.resolve(mockWarnings);
}
