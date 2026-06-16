export interface LoginRequest {
  username: string;
  password: string;
  captcha?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: any;
}

export interface IncidentReportRequest {
  type: number;
  title: string;
  description: string;
  location: string;
  locationPoint: { lng: number; lat: number };
  regionCode: string;
  occurredAt: string;
  sourceType: string;
  sourceDetail?: string;
  weatherCondition?: string;
  terrainCondition?: string;
  affectedArea?: number;
  affectedPopulation?: number;
  casualties?: number;
  injured?: number;
  missing?: number;
  trapped?: number;
  estimatedLoss?: number;
  attachments?: string[];
}

export interface DispatchGenerateRequest {
  incidentId: number;
  title?: string;
  strategy?: string;
  teamIds?: number[];
  taskDescription?: string;
  dangerWarning?: string;
}
