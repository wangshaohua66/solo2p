export type UserRole = 'manager' | 'recorder' | 'researcher';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export type SiteStatus = 'planning' | 'excavating' | 'completed';

export interface Site {
  id: string;
  name: string;
  location: string;
  managerId: string;
  startDate: string;
  endDate: string;
  status: SiteStatus;
  gridRows: number;
  gridCols: number;
  description?: string;
}

export type GridStatus = 'unexcavated' | 'excavating' | 'completed';

export interface Grid {
  id: string;
  siteId: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  status: GridStatus;
  recorderId: string;
  artifactCount: number;
}

export interface Stratum {
  id: string;
  siteId: string;
  gridId: string;
  layer: number;
  layerIndex: number;
  name: string;
  soilType: string;
  soilColor: string;
  thickness: number;
  depthFrom: number;
  depthTo: number;
  depthTop: number;
  depthBottom: number;
  period: string;
  description: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type ArtifactCondition = '完好' | '较好' | '一般' | '残损' | '严重残损';

export interface Artifact {
  id: string;
  stratumId: string;
  gridId: string;
  siteId: string;
  name: string;
  category: string;
  subcategory: string;
  quantity: number;
  condition: ArtifactCondition;
  depth: number;
  offsetX: number;
  offsetY: number;
  period: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactFormData {
  name: string;
  category: string;
  subcategory?: string;
  quantity: number;
  condition: ArtifactCondition;
  depth: number;
  offsetX: number;
  offsetY: number;
  period?: string;
  notes?: string;
}

export interface SearchFilters {
  keyword?: string;
  category?: string;
  period?: string;
  siteId?: string;
  gridId?: string;
  condition?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

export interface ArtifactCategory {
  value: string;
  label: string;
  children: { value: string; label: string }[];
}

export interface AppState {
  sites: Site[];
  grids: Grid[];
  strata: Stratum[];
  artifacts: Artifact[];
  users: User[];
  currentSiteId: string | null;
  selectedGridId: string | null;
}

export interface ComparisonConfig {
  siteIds: string[];
  alignBy: 'period' | 'depth' | 'layer';
}

export interface ComparisonResult {
  siteId: string;
  siteName: string;
  strata: Stratum[];
  alignmentOffsets: Record<string, number>;
  consistencyScore: number;
  differences: string[];
}

export interface AlignedStratum {
  period: string;
  layer?: number;
  sites: Record<string, Stratum | null>;
  thickness: number;
  consistency: number;
}

export interface StratumDifference {
  period: string;
  type: 'missing' | 'thickness' | 'soil' | 'period';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface SyncResult {
  comparisonResult: {
    results: ComparisonResult[];
    overallConsistency: number;
    alignedStrataComparison: AlignedStratum[];
    periodOrder: string[];
  };
  alignedStrata: AlignedStratum[];
  consistencyScore: number;
  differences: StratumDifference[];
}
