import type { ServiceItem } from './billing'

export enum RemainsStatus {
  PENDING_PICKUP = 'pending_pickup',
  PICKING_UP = 'picking_up',
  ARRIVED = 'arrived',
  REFRIGERATING = 'refrigerating',
  COSMETIC = 'cosmetic',
  READY_FOR_FAREWELL = 'ready_farewell',
  IN_FAREWELL = 'in_farewell',
  READY_FOR_CREMATION = 'ready_cremation',
  CREMATING = 'cremating',
  CREMATED = 'cremated',
  ASH_STORED = 'ash_stored',
  BURIED = 'buried',
  COMPLETED = 'completed'
}

export interface StatusRecord {
  status: RemainsStatus
  time: string
  operatorId: string
  operatorName: string
  remark?: string
}

export interface Remains {
  id: string
  code: string
  name: string
  gender: 'male' | 'female'
  age: number
  idNumber: string
  causeOfDeath: string
  deathTime: string
  pickupAddress: string
  funeralHomeId: string
  funeralHomeName: string
  arriveTime?: string
  currentStatus: RemainsStatus
  family: {
    name: string
    relation: string
    phone: string
  }
  services: ServiceItem[]
  statusHistory: StatusRecord[]
  createTime: string
  operatorId: string
  location?: {
    building: string
    room: string
    shelfNo?: string
  }
  cremationNo?: string
  urnNo?: string
  qrCodeUrl?: string
}

export interface RemainsRegisterForm {
  name: string
  gender: 'male' | 'female'
  age: number
  idNumber: string
  causeOfDeath: string
  deathTime: string
  pickupAddress: string
  appointmentTime?: string
  funeralHomeId: string
  familyName: string
  familyRelation: string
  familyPhone: string
  serviceIds: string[]
  remark?: string
}
