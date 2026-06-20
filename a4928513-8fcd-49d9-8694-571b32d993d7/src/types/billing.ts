export type ServiceCategory =
  | 'transport'
  | 'refrigeration'
  | 'cosmetic'
  | 'farewell'
  | 'cremation'
  | 'urn'
  | 'burial'
  | 'cemetery'
  | 'memorial'
  | 'other'

export type SubsidyType = 'government_basic' | 'government_special' | 'charity' | 'funeral_discount'

export interface ServiceItem {
  id: string
  code: string
  name: string
  category: ServiceCategory
  unit: string
  price: number
  quantity: number
  discountRate: number
  subsidyType?: SubsidyType
  subsidyAmount?: number
  subsidyInfo?: string
  finalPrice: number
  description?: string
  isMandatory: boolean
  isGovernmentPrice: boolean
}

export type PaymentMethod = 'cash' | 'wechat' | 'alipay' | 'bank' | 'card' | 'mixed'
export type InvoiceType = 'none' | 'paper' | 'electronic'
export type BillStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'write_off'

export interface BillPaymentRecord {
  id: string
  billId: string
  amount: number
  method: PaymentMethod
  transactionId?: string
  operatorId: string
  operatorName: string
  time: string
  remark?: string
}

export interface Bill {
  id: string
  billNo: string
  remainsId: string
  remainsName: string
  customerName: string
  customerPhone: string
  items: ServiceItem[]
  subtotal: number
  subsidyTotal: number
  discountTotal: number
  waiverAmount: number
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
  paymentMethod?: PaymentMethod
  paymentRecords: BillPaymentRecord[]
  invoiceType: InvoiceType
  invoiceTitle?: string
  invoiceTaxNo?: string
  invoiceUrl?: string
  invoiceNo?: string
  status: BillStatus
  createTime: string
  paidTime?: string
  operatorId: string
  operatorName: string
  auditStatus: 'pending' | 'audited' | 'rejected'
  auditorId?: string
  auditorName?: string
  auditTime?: string
  auditRemark?: string
  remark?: string
  subsidyProofs?: {
    type: SubsidyType
    documentNo: string
    documentUrl?: string
  }[]
}

export interface PriceStandard {
  id: string
  code: string
  name: string
  category: ServiceCategory
  unit: string
  price: number
  governmentGuidePrice?: number
  isGovernmentPrice: boolean
  subsidyType?: SubsidyType
  subsidyAmount?: number
  effectiveDate: string
  expireDate?: string
  description?: string
  status: 'active' | 'inactive'
}

export interface SubsidyPolicy {
  id: string
  name: string
  type: SubsidyType
  conditions: string
  amount: number
  percent?: number
  maxAmount?: number
  documents: string[]
  effectiveDate: string
  expireDate?: string
  status: 'active' | 'inactive'
}
