import request from '@/utils/request';
import { DispatchPlan, RescueTeam, DispatchGenerateRequest, PageResult } from '@/types';

export const getDispatchPlans = (params: any): Promise<PageResult<DispatchPlan>> => {
  return request.get('/dispatch/dispatches', { params });
};

export const getDispatchPlanDetail = (id: number): Promise<DispatchPlan> => {
  return request.get(`/dispatch/dispatches/${id}`);
};

export const generateDispatchPlan = (data: DispatchGenerateRequest): Promise<DispatchPlan> => {
  return request.post('/dispatch/dispatches/generate', data);
};

export const approveDispatchPlan = (id: number, action: number, opinion?: string): Promise<DispatchPlan> => {
  return request.post(`/auth/approvals/process`, { businessId: id, businessType: 'DISPATCH', action, opinion });
};

export const cancelDispatchPlan = (id: number, reason: string): Promise<void> => {
  return request.post(`/dispatch/dispatches/${id}/cancel`, { reason });
};

export const getAvailableTeams = (lng: number, lat: number, incidentId: number): Promise<RescueTeam[]> => {
  return request.get('/dispatch/teams/available', { params: { lng, lat, incidentId } });
};

export const getTeamList = (params: any): Promise<PageResult<RescueTeam>> => {
  return request.get('/dispatch/teams', { params });
};

export const getTeamDetail = (id: number): Promise<RescueTeam> => {
  return request.get(`/dispatch/teams/${id}`);
};

export const reassignTeam = (assignmentId: number, newTeamId: number, reason?: string) => {
  return request.post(`/dispatch/assignments/${assignmentId}/reassign`, { newTeamId, reason });
};

export const checkDispatchConflicts = (incidentId: number, teamIds: number[]): Promise<any> => {
  return request.post('/dispatch/dispatches/check-conflicts', { incidentId, teamIds });
};
