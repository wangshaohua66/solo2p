import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import type {
  ApiResponse,
  Disorder,
  WorkOrder,
  TrackPoint,
  TeamRecommendation,
  CoverageStats,
  AcceptanceRecord,
  PaginationParams,
  PaginatedResponse,
  RoadSection
} from '@/types';
import { DisorderType, Severity, WorkOrderStatus } from '@/types';

const service: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000
});

service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

service.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<any>>) => {
    const res = response.data;
    if (res.code && res.code >= 400) {
      console.error(`API Error: ${res.message}`);
      return Promise.reject(new Error(res.message || 'Error'));
    }
    return res as any;
  },
  (error) => {
    console.error(`Request Error: ${error.message}`);
    return Promise.reject(error);
  }
);

function extractData<T>(res: any): T {
  return res.data;
}

export interface ReportDisorderParams {
  type: DisorderType;
  severity: Severity;
  location: { lat: number; lng: number; address?: string; mileage?: string; roadSectionId?: string };
  roadSectionId: string;
  description?: string;
  images?: string[];
  reporterId: string;
}

export async function reportDisorder(params: ReportDisorderParams): Promise<Disorder> {
  const res = await service.post<any>('/disorder/report', params);
  return extractData<Disorder>(res);
}

export interface GetDisorderListParams extends PaginationParams {
  status?: string;
  type?: DisorderType;
  severity?: Severity;
  roadSectionId?: string;
}

export async function getDisorderList(
  params: GetDisorderListParams = {}
): Promise<PaginatedResponse<Disorder>> {
  const res = await service.get<any>('/disorder/list', { params });
  return extractData<PaginatedResponse<Disorder>>(res);
}

export async function getDisorderDetail(id: string): Promise<Disorder> {
  const res = await service.get<any>(`/disorder/${id}`);
  return extractData<Disorder>(res);
}

export interface GradeDisorderParams {
  severity: Severity;
  graderId: string;
}

export async function gradeDisorder(id: string, params: GradeDisorderParams): Promise<Disorder> {
  const res = await service.put<any>(`/disorder/${id}/grade`, params);
  return extractData<Disorder>(res);
}

export interface GetWorkOrderListParams extends PaginationParams {
  status?: WorkOrderStatus;
  teamId?: string;
  assigneeId?: string;
}

export async function getWorkOrders(
  params: GetWorkOrderListParams = {}
): Promise<PaginatedResponse<WorkOrder>> {
  const res = await service.get<any>('/workorder/list', { params });
  return extractData<PaginatedResponse<WorkOrder>>(res);
}

export interface CreateWorkOrderParams {
  disorderId: string;
  teamId: string;
  assigneeId: string;
  deadline: string;
  remark?: string;
}

export async function createWorkOrder(params: CreateWorkOrderParams): Promise<WorkOrder> {
  const res = await service.post<any>('/workorder/create', params);
  return extractData<WorkOrder>(res);
}

export async function updateWorkOrderStatus(
  id: string,
  status: WorkOrderStatus
): Promise<WorkOrder> {
  const res = await service.put<any>(`/workorder/${id}/status`, {
    status
  });
  return extractData<WorkOrder>(res);
}

export async function updateWorkOrderProgress(
  id: string,
  progress: number
): Promise<WorkOrder> {
  const res = await service.put<any>(`/workorder/${id}/progress`, {
    progress
  });
  return extractData<WorkOrder>(res);
}

export interface SubmitAcceptanceParams {
  workOrderId: string;
  inspectorId: string;
  passed: boolean;
  comment?: string;
  images?: string[];
}

export async function submitAcceptance(params: SubmitAcceptanceParams): Promise<AcceptanceRecord> {
  const res = await service.post<any>(
    `/workorder/${params.workOrderId}/acceptance`,
    params
  );
  return extractData<AcceptanceRecord>(res);
}

export async function getTeamRecommendations(disorderId: string): Promise<TeamRecommendation[]> {
  const res = await service.get<any>('/workorder/recommend', {
    params: { disorderId }
  });
  return extractData<TeamRecommendation[]>(res);
}

export interface ReportTrackParams {
  patrolId?: string;
  userId: string;
  lat: number;
  lng: number;
  speed?: number;
}

export async function reportTrack(point: ReportTrackParams): Promise<TrackPoint> {
  const res = await service.post<any>('/patrol/track', point);
  return extractData<TrackPoint>(res);
}

export interface GetPatrolTracksParams {
  patrolId: string;
}

export async function getPatrolTracks(params: GetPatrolTracksParams): Promise<TrackPoint[]> {
  const res = await service.get<any>(`/patrol/tracks/${params.patrolId}`);
  const data = extractData<{ patrolId: string; points: TrackPoint[] }>(res);
  return data?.points || [];
}

export interface CoverageResponse {
  coveredSectionIds: string[];
  totalLength: number;
  coveredLength: number;
  coverageRate: number;
  todayStats: CoverageStats;
  history: CoverageStats[];
}

export interface GetCoverageParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  roadSectionId?: string;
}

export async function getCoverage(params: GetCoverageParams = {}): Promise<CoverageResponse> {
  const res = await service.get<any>('/patrol/coverage', { params });
  return extractData<CoverageResponse>(res);
}

export interface StatsOverview {
  totalDisorders: number;
  pendingDisorders: number;
  processingDisorders: number;
  completedDisorders: number;
  totalWorkOrders: number;
  todayCoverage: number;
  weekCoverage: number;
  avgRepairHours: number;
}

export async function getStatsOverview(): Promise<StatsOverview> {
  const res = await service.get<any>('/stats/overview');
  return extractData<StatsOverview>(res);
}

export interface GetStatsTrendParams {
  startDate?: string;
  endDate?: string;
  type?: 'disorder' | 'work-order' | 'coverage';
  days?: number;
}

export interface StatsTrendPoint {
  date: string;
  discovered: number;
  repaired: number;
}

export async function getStatsTrend(params: GetStatsTrendParams = {}): Promise<StatsTrendPoint[]> {
  const res = await service.get<any>('/stats/trend', { params });
  return extractData<StatsTrendPoint[]>(res);
}

export default service;
