import request from '@/utils/request';
import {
  IncidentArchive,
  IncidentReviewReport,
  IncidentHistoryCase,
  IncidentCaseComparison,
  PageResult,
} from '@/types';

export interface ArchiveIncidentRequest {
  incidentId: number;
  archiveType: string;
  archiveRemark?: string;
}

export interface GenerateReviewRequest {
  incidentId: number;
  archiveId: number;
  title: string;
  reportType?: string;
  existingProblems?: string;
  improvementMeasures?: string;
  lessonsLearned?: string;
}

export interface CaseComparisonRequest {
  sourceIncidentId: number;
  targetCaseId: number;
  comparisonMetrics?: string[];
}

export interface HistoryCaseQueryRequest {
  incidentType?: number;
  incidentLevel?: number;
  regionCode?: string;
  isClassic?: boolean;
  tags?: string;
  keyword?: string;
  pageNum?: number;
  pageSize?: number;
}

export const archiveIncident = (data: ArchiveIncidentRequest): Promise<IncidentArchive> => {
  return request.post('/incident/review/archive', data);
};

export const getArchiveById = (id: number): Promise<IncidentArchive> => {
  return request.get(`/incident/review/archive/${id}`);
};

export const getArchivesByIncidentId = (incidentId: number): Promise<IncidentArchive[]> => {
  return request.get(`/incident/review/archive/incident/${incidentId}`);
};

export const generateReviewReport = (data: GenerateReviewRequest): Promise<IncidentReviewReport> => {
  return request.post('/incident/review/report/generate', data);
};

export const getReviewReportById = (id: number): Promise<IncidentReviewReport> => {
  return request.get(`/incident/review/report/${id}`);
};

export const getReviewReportsByIncidentId = (incidentId: number): Promise<IncidentReviewReport[]> => {
  return request.get(`/incident/review/report/incident/${incidentId}`);
};

export const approveReviewReport = (id: number, reviewRemark?: string): Promise<IncidentReviewReport> => {
  return request.put(`/incident/review/report/${id}/approve`, null, { params: { reviewRemark } });
};

export const getHistoryCaseById = (id: number): Promise<IncidentHistoryCase> => {
  return request.get(`/incident/review/case/${id}`);
};

export const queryHistoryCases = (data: HistoryCaseQueryRequest): Promise<PageResult<IncidentHistoryCase>> => {
  return request.post('/incident/review/case/query', data);
};

export const getClassicCases = (): Promise<IncidentHistoryCase[]> => {
  return request.get('/incident/review/case/classic');
};

export const findSimilarCases = (incidentId: number, limit: number = 5): Promise<IncidentHistoryCase[]> => {
  return request.get(`/incident/review/case/similar/${incidentId}`, { params: { limit } });
};

export const compareWithCase = (data: CaseComparisonRequest): Promise<IncidentCaseComparison> => {
  return request.post('/incident/review/comparison', data);
};

export const getComparisonsByIncidentId = (sourceIncidentId: number): Promise<IncidentCaseComparison[]> => {
  return request.get(`/incident/review/comparison/incident/${sourceIncidentId}`);
};

export const generateTimelineAnalysis = (incidentId: number): Promise<any> => {
  return request.get(`/incident/review/timeline/${incidentId}`);
};

export const calculateEfficiencyMetrics = (incidentId: number): Promise<any> => {
  return request.get(`/incident/review/efficiency/${incidentId}`);
};

export const triggerAutoArchive = (): Promise<void> => {
  return request.post('/incident/review/auto-archive');
};
