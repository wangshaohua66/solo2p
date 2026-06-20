export type Nucleotide = 'A' | 'T' | 'C' | 'G' | 'N';

export interface SequenceData {
  id: string;
  name: string;
  sequence: string;
  format: 'FASTA' | 'GenBank';
  length: number;
  description?: string;
  features?: SequenceFeature[];
}

export interface SequenceFeature {
  type: string;
  start: number;
  end: number;
  label?: string;
}

export interface Viewport {
  start: number;
  end: number;
  zoom: number;
  offset: number;
}

export interface Selection {
  start: number;
  end: number;
}

export type Pathogenicity = 'pathogenic' | 'likely-pathogenic' | 'uncertain' | 'benign' | 'likely-benign';

export type MutationType = 'SNP' | 'Ins' | 'Del' | 'Indel';

export interface Mutation {
  id: string;
  position: number;
  refBase: string;
  altBase: string;
  type: MutationType;
  pathogenicity: Pathogenicity;
  doi?: string;
  note?: string;
  validated: boolean;
  gene?: string;
  alleleFrequency?: number;
}

export type PrimerDirection = 'forward' | 'reverse';

export interface Primer {
  id: string;
  name: string;
  direction: PrimerDirection;
  sequence: string;
  start: number;
  end: number;
  length: number;
  tm: number;
  gcContent: number;
  productSize?: number;
  hairpinTm?: number;
  selfDimerTm?: number;
  penalty: number;
  passFilter: boolean;
  warnings?: string[];
}

export interface PerBaseQualityStat {
  position: number;
  median: number;
  q25: number;
  q75: number;
  min: number;
  max: number;
}

export interface GCBin {
  gc: number;
  count: number;
}

export interface LengthBin {
  length: number;
  count: number;
}

export interface QualityData {
  perBaseQuality: PerBaseQualityStat[];
  gcContent: number[];
  gcDistribution: GCBin[];
  lengthDistribution: LengthBin[];
  meanQuality: number;
  meanGcContent: number;
  meanReadLength: number;
  totalReads: number;
  lowQualityRegions: Array<{ start: number; end: number; meanQ: number }>;
}

export interface Annotation {
  id: string;
  start: number;
  end: number;
  label: string;
  color: string;
  note?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sequenceFileFormat?: 'FASTA' | 'GenBank';
  sequenceLength?: number;
  sequenceData?: SequenceData;
  mutations: Mutation[];
  primers: Primer[];
  annotations: Annotation[];
  qualityData?: QualityData;
  data?: Record<string, unknown>;
}

export type StepType = 'import' | 'sequence' | 'alignment' | 'mutation' | 'annotation' | 'primer' | 'quality' | 'export';

export interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  icon: string;
  order: number;
  config?: Record<string, unknown>;
  label?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  steps: WorkflowStep[];
}

export type ActiveTab = 'sequence' | 'mutation' | 'primer' | 'quality';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface PrimerConfigParams {
  productSizeMin: number;
  productSizeMax: number;
  tmMin: number;
  tmMax: number;
  gcMin: number;
  gcMax: number;
  primerLengthMin: number;
  primerLengthMax: number;
  qualityThreshold: number;
  checkHairpin: boolean;
  checkDimer: boolean;
  checkThreePrimeSpecificity: boolean;
  naConcentration: number;
  primerConcentration: number;
}
