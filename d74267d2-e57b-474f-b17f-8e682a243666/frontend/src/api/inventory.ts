import request from '@/utils/request';
import { Warehouse, InventoryStock, AllocationRouteResult, PageResult } from '@/types';

export const getWarehouseList = (params: any): Promise<PageResult<Warehouse>> => {
  return request.get('/inventory/warehouses', { params });
};

export const getWarehouseDetail = (id: number): Promise<Warehouse> => {
  return request.get(`/inventory/warehouses/${id}`);
};

export const getInventoryList = (params: any): Promise<PageResult<InventoryStock>> => {
  return request.get('/inventory/stocks', { params });
};

export const getInventoryByWarehouse = (warehouseId: number): Promise<InventoryStock[]> => {
  return request.get(`/inventory/stocks/warehouse/${warehouseId}`);
};

export const findAvailableStockNearby = (lng: number, lat: number, materialId: number, quantity: number): Promise<InventoryStock[]> => {
  return request.get('/inventory/stocks/nearby', { params: { lng, lat, materialId, quantity } });
};

export const calculateOptimalRoute = (data: any): Promise<AllocationRouteResult> => {
  return request.post('/inventory/allocations/calculate-route', data);
};

export const lockStocks = (data: any): Promise<number[]> => {
  return request.post('/inventory/stocks/lock', data);
};

export const unlockStock = (lockId: number, reason: string): Promise<void> => {
  return request.post(`/inventory/stocks/lock/${lockId}/unlock`, { reason });
};

export const confirmAllocation = (lockId: number): Promise<void> => {
  return request.post(`/inventory/stocks/lock/${lockId}/confirm`);
};

export const getStockLocks = (params: any): Promise<PageResult<any>> => {
  return request.get('/inventory/stocks/locks', { params });
};

export const getAllocations = (params: any): Promise<PageResult<any>> => {
  return request.get('/inventory/allocations', { params });
};
