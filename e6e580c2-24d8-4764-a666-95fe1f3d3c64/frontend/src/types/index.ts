export interface Result<T = any> {
  code: number
  message: string
  data: T
}

export interface PageResult<T = any> {
  total: number
  records: T[]
  pageNum: number
  pageSize: number
}

export interface Community {
  id?: number
  name: string
  address: string
  leaderId?: number
  residentCount: number
  status: number
  createTime?: string
  updateTime?: string
}

export interface GroupLeader {
  id?: number
  name: string
  phone: string
  communityId?: number
  idCard?: string
  commissionRate: number
  totalCommission?: number
  availableCommission?: number
  status: number
}

export interface Supplier {
  id?: number
  name: string
  contactPerson: string
  phone: string
  address: string
  businessLicense?: string
  settlementCycle: number
  totalSettlement?: number
  status: number
}

export interface ProductCategory {
  id?: number
  name: string
  parentId: number
  sortOrder: number
  status: number
  children?: ProductCategory[]
}

export interface Product {
  id?: number
  name: string
  categoryId?: number
  supplierId?: number
  description?: string
  imageUrl?: string
  purchasePrice: number
  sellingPrice: number
  unit: string
  totalStock: number
  soldCount?: number
  status: number
  auditStatus: number
  auditRemark?: string
  sortOrder?: number
  createTime?: string
  categoryName?: string
  supplierName?: string
}

export interface ProductCommunityStock {
  id?: number
  productId: number
  communityId: number
  stock: number
  lockedStock?: number
  soldCount?: number
  price: number
  communityName?: string
}

export interface Order {
  id?: number
  orderNo: string
  userId: number
  communityId: number
  leaderId?: number
  totalAmount: number
  discountAmount: number
  payAmount: number
  status: number
  payStatus: number
  payTime?: string
  deliveryStatus: number
  deliveryTaskId?: number
  pickupCode?: string
  remark?: string
  cancelReason?: string
  createTime?: string
  updateTime?: string
  userName?: string
  communityName?: string
  leaderName?: string
}

export interface OrderItem {
  id?: number
  orderId: number
  orderNo: string
  productId: number
  productName: string
  productImage?: string
  price: number
  quantity: number
  totalPrice: number
  communityId: number
}

export interface DeliveryTask {
  id?: number
  taskNo: string
  deliveryDate: string
  vehicleNo?: string
  driverName?: string
  driverPhone?: string
  totalOrders: number
  totalAmount: number
  status: number
  startTime?: string
  endTime?: string
  remark?: string
  createTime?: string
}

export interface DeliveryDetail {
  id?: number
  taskId: number
  orderId: number
  orderNo: string
  communityId: number
  communityName: string
  sortOrder: number
  status: number
  arriveTime?: string
  confirmTime?: string
}

export interface Settlement {
  id?: number
  settlementNo: string
  type: number
  targetId: number
  targetName: string
  startDate: string
  endDate: string
  totalAmount: number
  orderCount: number
  commissionAmount?: number
  platformProfit?: number
  settleAmount: number
  status: number
  settleTime?: string
  remark?: string
  createTime?: string
}

export interface SettlementItem {
  id?: number
  settlementId: number
  orderId: number
  orderNo: string
  productId?: number
  productName: string
  amount: number
  commission?: number
  profit?: number
}

export interface ResidentUser {
  id?: number
  username: string
  phone: string
  nickname?: string
  avatar?: string
  communityId?: number
  level: number
  points: number
  totalAmount: number
  orderCount: number
  status: number
  createTime?: string
}
