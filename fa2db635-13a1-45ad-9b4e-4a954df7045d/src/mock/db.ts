import * as data from './data'
import type {
  Store,
  Staff,
  Venue,
  Prop,
  Wedding,
  Package,
  Addon,
  ScheduleTask,
  Contract,
  FollowTask,
  FinanceDetail,
  SupplierOrder,
} from '@/types'

const KEY = 'wedding_suite_db_v1'

export interface DB {
  stores: Store[]
  staff: Staff[]
  venues: Venue[]
  props: Prop[]
  packages: Package[]
  addons: Addon[]
  weddings: Wedding[]
  scheduleTasks: ScheduleTask[]
  contracts: Contract[]
  followTasks: FollowTask[]
  finance: FinanceDetail[]
  supplierOrders: SupplierOrder[]
  seq: Record<string, number>
}

function fresh(): DB {
  return {
    stores: data.seedStores,
    staff: data.seedStaff,
    venues: data.seedVenues,
    props: data.seedProps,
    packages: data.seedPackages,
    addons: data.seedAddons,
    weddings: data.seedWeddings,
    scheduleTasks: data.seedScheduleTasks,
    contracts: data.seedContracts,
    followTasks: data.seedFollowTasks,
    finance: data.seedFinance,
    supplierOrders: data.seedSupplierOrders,
    seq: {},
  }
}

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const db = fresh()
      saveDB(db)
      return db
    }
    return JSON.parse(raw) as DB
  } catch {
    const db = fresh()
    saveDB(db)
    return db
  }
}

export function saveDB(db: DB): void {
  localStorage.setItem(KEY, JSON.stringify(db))
}

export function resetDB(): DB {
  const db = fresh()
  saveDB(db)
  return db
}

export function nextId(db: DB, table: string): number {
  db.seq[table] = (db.seq[table] || 0) + 1
  return db.seq[table]
}

export function asResourceList(db: DB) {
  return [
    ...db.staff.map((s) => ({ id: s.id, type: 'STAFF' as const, name: s.name, storeId: s.storeId, meta: s.role })),
    ...db.venues.map((v) => ({ id: v.id, type: 'VENUE' as const, name: v.name, storeId: v.storeId, meta: `容量${v.capacity}桌` })),
    ...db.props.map((p) => ({ id: p.id, type: 'PROP' as const, name: p.name, storeId: p.storeId, meta: `库存${p.stock}` })),
  ]
}
