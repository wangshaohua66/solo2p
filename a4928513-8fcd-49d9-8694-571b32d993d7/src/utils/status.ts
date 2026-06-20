import { RemainsStatus } from '@/types/remains'
import type { DictItem } from '@/types/common'

export const remainsStatusMap: Record<RemainsStatus, DictItem> = {
  [RemainsStatus.PENDING_PICKUP]: {
    value: RemainsStatus.PENDING_PICKUP,
    label: '待接运',
    color: '#FA8C16'
  },
  [RemainsStatus.PICKING_UP]: {
    value: RemainsStatus.PICKING_UP,
    label: '接运中',
    color: '#1890FF'
  },
  [RemainsStatus.ARRIVED]: {
    value: RemainsStatus.ARRIVED,
    label: '已到馆',
    color: '#13C2C2'
  },
  [RemainsStatus.REFRIGERATING]: {
    value: RemainsStatus.REFRIGERATING,
    label: '冷藏中',
    color: '#1890FF'
  },
  [RemainsStatus.COSMETIC]: {
    value: RemainsStatus.COSMETIC,
    label: '整容中',
    color: '#722ED1'
  },
  [RemainsStatus.READY_FOR_FAREWELL]: {
    value: RemainsStatus.READY_FOR_FAREWELL,
    label: '待告别',
    color: '#2F54EB'
  },
  [RemainsStatus.IN_FAREWELL]: {
    value: RemainsStatus.IN_FAREWELL,
    label: '告别中',
    color: '#2F54EB'
  },
  [RemainsStatus.READY_FOR_CREMATION]: {
    value: RemainsStatus.READY_FOR_CREMATION,
    label: '待火化',
    color: '#EB2F96'
  },
  [RemainsStatus.CREMATING]: {
    value: RemainsStatus.CREMATING,
    label: '火化中',
    color: '#FA541C'
  },
  [RemainsStatus.CREMATED]: {
    value: RemainsStatus.CREMATED,
    label: '已火化',
    color: '#52C41A'
  },
  [RemainsStatus.ASH_STORED]: {
    value: RemainsStatus.ASH_STORED,
    label: '骨灰已寄存',
    color: '#52C41A'
  },
  [RemainsStatus.BURIED]: {
    value: RemainsStatus.BURIED,
    label: '已安葬',
    color: '#52C41A'
  },
  [RemainsStatus.COMPLETED]: {
    value: RemainsStatus.COMPLETED,
    label: '流程完结',
    color: '#8C8C8C'
  }
}

export function getRemainsStatusInfo(status: RemainsStatus): DictItem {
  return remainsStatusMap[status] || { value: status, label: '未知状态', color: '#8C8C8C' }
}

export const remainsStatusFlow: RemainsStatus[] = [
  RemainsStatus.PENDING_PICKUP,
  RemainsStatus.PICKING_UP,
  RemainsStatus.ARRIVED,
  RemainsStatus.REFRIGERATING,
  RemainsStatus.COSMETIC,
  RemainsStatus.READY_FOR_FAREWELL,
  RemainsStatus.IN_FAREWELL,
  RemainsStatus.READY_FOR_CREMATION,
  RemainsStatus.CREMATING,
  RemainsStatus.CREMATED
]

export const plotStatusMap: Record<string, DictItem> = {
  for_sale: { value: 'for_sale', label: '在售', color: '#52C41A' },
  sold: { value: 'sold', label: '已售', color: '#1890FF' },
  reserved: { value: 'reserved', label: '预留', color: '#FA8C16' },
  occupied: { value: 'occupied', label: '已安葬', color: '#8C8C8C' },
  maintenance: { value: 'maintenance', label: '维护中', color: '#FF4D4F' }
}

export const bookingStatusMap: Record<string, DictItem> = {
  pending: { value: 'pending', label: '待确认', color: '#FA8C16' },
  confirmed: { value: 'confirmed', label: '已确认', color: '#1890FF' },
  completed: { value: 'completed', label: '已完成', color: '#52C41A' },
  cancelled: { value: 'cancelled', label: '已取消', color: '#8C8C8C' }
}

export const missionStatusMap: Record<string, DictItem> = {
  pending: { value: 'pending', label: '待分配', color: '#FA8C16' },
  assigned: { value: 'assigned', label: '已派车', color: '#1890FF' },
  picking: { value: 'picking', label: '接运中', color: '#13C2C2' },
  arrived: { value: 'arrived', label: '已到馆', color: '#722ED1' },
  completed: { value: 'completed', label: '已完成', color: '#52C41A' },
  cancelled: { value: 'cancelled', label: '已取消', color: '#8C8C8C' },
  urgent: { value: 'urgent', label: '紧急', color: '#FF4D4F' }
}

export const memorialSlotStatusMap: Record<string, DictItem> = {
  available: { value: 'available', label: '可预约', color: '#52C41A' },
  limited: { value: 'limited', label: '紧张', color: '#FA8C16' },
  full: { value: 'full', label: '已满', color: '#FF4D4F' },
  closed: { value: 'closed', label: '关闭', color: '#8C8C8C' }
}

export const billStatusMap: Record<string, DictItem> = {
  unpaid: { value: 'unpaid', label: '待支付', color: '#FF4D4F' },
  partial: { value: 'partial', label: '部分支付', color: '#FA8C16' },
  paid: { value: 'paid', label: '已支付', color: '#52C41A' },
  refunded: { value: 'refunded', label: '已退款', color: '#1890FF' },
  write_off: { value: 'write_off', label: '已核销', color: '#8C8C8C' }
}

export const paymentMethodMap: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  bank: '银行转账',
  card: '银行卡',
  mixed: '混合支付'
}

export const serviceCategoryMap: Record<string, string> = {
  transport: '接运服务',
  refrigeration: '冷藏服务',
  cosmetic: '整容服务',
  farewell: '告别服务',
  cremation: '火化服务',
  urn: '骨灰盒',
  burial: '安葬服务',
  cemetery: '墓位销售',
  memorial: '祭扫服务',
  other: '其他服务'
}

export const vehicleTypeMap: Record<string, string> = {
  hearse: '灵车',
  family_car: '家属车'
}

export const plotTypeMap: Record<string, string> = {
  standard: '标准型',
  double: '双穴型',
  premium: '豪华型',
  family: '家族型',
  ashes_wall: '骨灰墙'
}

export const roleMap: Record<string, string> = {
  admin: '系统管理员',
  funeral_attendant: '殡仪服务员',
  embalmer: '防腐整容师',
  cremator: '火化工',
  ritualist: '礼仪师',
  cemetery_manager: '墓园管理员',
  family: '家属'
}
