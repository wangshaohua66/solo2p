export type WorkOrderStatus =
  | 'draft'
  | 'pending_quote'
  | 'quoted'
  | 'in_repair'
  | 'pending_qa'
  | 'ready_for_pickup'
  | 'delivered'
  | 'warranty'
  | 'archived';

export const STATUS_FLOW: WorkOrderStatus[] = [
  'draft',
  'pending_quote',
  'quoted',
  'in_repair',
  'pending_qa',
  'ready_for_pickup',
  'delivered',
  'warranty',
  'archived'
];

export const STATUS_LABEL: Record<WorkOrderStatus, string> = {
  draft: '草稿',
  pending_quote: '待报价',
  quoted: '已报价',
  in_repair: '维修中',
  pending_qa: '待质检',
  ready_for_pickup: '待取件',
  delivered: '已交付',
  warranty: '质保中',
  archived: '已归档'
};

export const STATUS_COLOR: Record<WorkOrderStatus, string> = {
  draft: '#bfbfbf',
  pending_quote: '#faad14',
  quoted: '#1890ff',
  in_repair: '#722ed1',
  pending_qa: '#fa8c16',
  ready_for_pickup: '#52c41a',
  delivered: '#13c2c2',
  warranty: '#2f54eb',
  archived: '#8c8c8c'
};

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  createdAt: string;
  totalOrders: number;
}

export interface Movement {
  id: number;
  code: string;
  brand: string;
  caliber: string;
  frequency: number;
  jewelCount: number;
  powerReserveHours: number;
  standardAmplitude: string;
  standardRate: string;
  serviceSteps: string[];
  commonFailures: string[];
  standardLaborHours: number;
  recommendedParts: string[];
}

export interface PartCategory {
  id: number;
  name: string;
  code: string;
  parentId?: number;
}

export interface Part {
  id: number;
  sku: string;
  name: string;
  categoryId: number;
  category?: PartCategory;
  brand?: string;
  movementCode?: string;
  unitPrice: number;
  stock: number;
  reorderLevel: number;
  location?: string;
  barcode?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartUsage {
  id: number;
  workOrderId: number;
  partId: number;
  part?: Part;
  quantity: number;
  unitPrice: number;
  batchNumber?: string;
  usedAt: string;
  technicianId?: number;
}

export interface InspectionData {
  id?: number;
  workOrderId: number;
  frequency?: number;
  amplitude?: string;
  rate?: string;
  beatError?: string;
  powerReserve?: number;
  waterResistance?: string;
  dialCondition?: string;
  caseCondition?: string;
  bandCondition?: string;
  crownFunction?: string;
  pushersFunction?: string;
  dateFunction?: string;
  chronographFunction?: string;
  notes?: string;
  createdAt: string;
}

export interface WorkOrderImage {
  id: number;
  workOrderId: number;
  type: 'intake' | 'during' | 'after';
  url: string;
  caption?: string;
  uploadedAt: string;
}

export interface WorkOrderLog {
  id: number;
  workOrderId: number;
  action: string;
  detail?: string;
  operatorId?: number;
  operatorName?: string;
  createdAt: string;
}

export interface Warranty {
  id: number;
  workOrderId: number;
  customerId: number;
  startDate: string;
  endDate: string;
  months: number;
  terms: string;
  status: 'active' | 'expired' | 'claimed';
  notifiedAt?: string;
}

export interface ServiceItem {
  id?: number;
  workOrderId: number;
  type: 'labor' | 'part' | 'other';
  name: string;
  quantity: number;
  unitPrice: number;
  description?: string;
}

export interface WorkOrder {
  id: number;
  orderNumber: string;
  customerId: number;
  customer?: Customer;
  brand: string;
  model: string;
  caseSerialNumber: string;
  movementSerialNumber?: string;
  movementCode?: string;
  movement?: Movement;
  status: WorkOrderStatus;
  intakeDate: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  problemDescription: string;
  customerNotes?: string;
  internalNotes?: string;
  assignedTechnicianId?: number;
  assignedTechnicianName?: string;
  laborPrice: number;
  partsPrice: number;
  totalPrice: number;
  deposit: number;
  warrantyMonths: number;
  priority: 'normal' | 'urgent' | 'express';
  repeatVisit: boolean;
  previousOrderId?: number;
  images?: WorkOrderImage[];
  inspection?: InspectionData;
  partUsages?: PartUsage[];
  serviceItems?: ServiceItem[];
  logs?: WorkOrderLog[];
  warranty?: Warranty;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderListFilter {
  status?: WorkOrderStatus[];
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  technicianId?: number;
  priority?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: number;
  username: string;
  realName: string;
  role: 'admin' | 'technician' | 'reception' | 'manager';
  email?: string;
  phone?: string;
}

export interface DashboardStats {
  thisWeekOrders: number;
  pendingPickup: number;
  avgRepairDays: number;
  lowStockParts: number;
  revenueByServiceType: Array<{ name: string; value: number }>;
  ordersByStatus: Array<{ name: string; value: number; color: string }>;
  weeklyOrders: Array<{ date: string; count: number }>;
  topTechnicians: Array<{ name: string; count: number; avgDays: number }>;
}

export interface ServiceReportPDF {
  order: WorkOrder;
  generatedAt: string;
  reportNumber: string;
}
