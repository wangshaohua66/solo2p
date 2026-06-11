import api from '@/api/index';
import type { Kiln, MaintenanceOrder, MaintenanceType } from '@/types';

export async function listKilns(): Promise<Kiln[]> {
  const { data } = await api.get<Kiln[]>('/equipments/kilns');
  return data;
}

export async function getKilnDetail(id: number): Promise<Kiln> {
  const { data } = await api.get<Kiln>(`/equipments/kilns/${id}`);
  return data;
}

export async function createKiln(data: Partial<Kiln>): Promise<Kiln> {
  const resp = await api.post<Kiln>('/equipments/kilns', data);
  return resp.data;
}

export async function updateKiln(id: number, data: Partial<Kiln>): Promise<Kiln> {
  const resp = await api.put<Kiln>(`/equipments/kilns/${id}`, data);
  return resp.data;
}

export async function deleteKiln(id: number): Promise<void> {
  await api.delete(`/equipments/kilns/${id}`);
}

export async function healthCheckKiln(id: number): Promise<Kiln> {
  const resp = await api.post<Kiln>(`/equipments/kilns/${id}/health-check`);
  return resp.data;
}

export async function createMaintenanceOrder(
  id: number,
  data: {
    type: MaintenanceType;
    description: string;
    scheduledDate: string;
  },
): Promise<MaintenanceOrder> {
  const resp = await api.post<MaintenanceOrder>(
    `/equipments/kilns/${id}/maintenance`,
    data,
  );
  return resp.data;
}

export async function listMaintenanceHistory(
  id: number,
): Promise<MaintenanceOrder[]> {
  const { data } = await api.get<MaintenanceOrder[]>(
    `/equipments/kilns/${id}/maintenance`,
  );
  return data;
}

export async function startMaintenance(id: number): Promise<MaintenanceOrder> {
  const resp = await api.post<MaintenanceOrder>(
    `/equipments/kilns/maintenance/${id}/start`,
  );
  return resp.data;
}

export async function completeMaintenance(id: number): Promise<MaintenanceOrder> {
  const resp = await api.post<MaintenanceOrder>(
    `/equipments/kilns/maintenance/${id}/complete`,
  );
  return resp.data;
}
