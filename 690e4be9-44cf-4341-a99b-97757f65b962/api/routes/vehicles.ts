import { Router, type Request, type Response } from 'express'
import { mockData } from '../data/mockData.js'

const router = Router()

const MAX_PAGE_SIZE = 200

router.get('/', (req: Request, res: Response): void => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 20))
  const status = req.query.status as string | undefined
  const lineId = req.query.lineId as string | undefined

  let filtered = [...mockData.vehicles]
  if (status) filtered = filtered.filter(v => v.status === status)
  if (lineId) filtered = filtered.filter(v => v.lineId === lineId)

  const total = filtered.length
  const items = filtered.slice((page - 1) * pageSize, page * pageSize)

  res.json({ success: true, data: { items, total, page, pageSize } })
})

router.get('/:vehicleId', (req: Request, res: Response): void => {
  const vehicle = mockData.vehicles.find(v => v.id === req.params.vehicleId)
  if (!vehicle) {
    res.status(404).json({ success: false, error: '车辆不存在' })
    return
  }
  res.json({ success: true, data: vehicle })
})

router.post('/', (req: Request, res: Response): void => {
  const { plateNumber, model, capacity, lineId } = req.body
  if (!plateNumber || !model || !capacity) {
    res.status(400).json({ success: false, error: '缺少必要参数' })
    return
  }

  const vehicle = {
    id: `veh_${Date.now()}`,
    plateNumber,
    model,
    capacity,
    status: 'active' as const,
    lineId: lineId || undefined,
    totalMileage: 0,
  }
  mockData.vehicles.push(vehicle)

  res.status(201).json({ success: true, data: vehicle })
})

router.put('/:vehicleId', (req: Request, res: Response): void => {
  const vehicle = mockData.vehicles.find(v => v.id === req.params.vehicleId)
  if (!vehicle) {
    res.status(404).json({ success: false, error: '车辆不存在' })
    return
  }

  const { plateNumber, model, capacity, status, lineId, totalMileage } = req.body
  if (plateNumber) vehicle.plateNumber = plateNumber
  if (model) vehicle.model = model
  if (capacity) vehicle.capacity = capacity
  if (status) vehicle.status = status
  if (lineId !== undefined) vehicle.lineId = lineId
  if (totalMileage !== undefined) vehicle.totalMileage = totalMileage

  res.json({ success: true, data: vehicle })
})

router.delete('/:vehicleId', (req: Request, res: Response): void => {
  const idx = mockData.vehicles.findIndex(v => v.id === req.params.vehicleId)
  if (idx === -1) {
    res.status(404).json({ success: false, error: '车辆不存在' })
    return
  }
  const removed = mockData.vehicles.splice(idx, 1)[0]
  res.json({ success: true, data: removed })
})

router.get('/:vehicleId/maintenance', (req: Request, res: Response): void => {
  const records = mockData.maintenanceRecords.filter(r => r.vehicleId === req.params.vehicleId)
  res.json({ success: true, data: records })
})

router.post('/:vehicleId/maintenance', (req: Request, res: Response): void => {
  const vehicle = mockData.vehicles.find(v => v.id === req.params.vehicleId)
  if (!vehicle) {
    res.status(404).json({ success: false, error: '车辆不存在' })
    return
  }

  const { type, startDate, cost, description } = req.body
  const record = {
    id: `mnt_${Date.now()}`,
    vehicleId: vehicle.id,
    type: type || 'routine',
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate: undefined,
    nextDate: undefined,
    cost: cost || 0,
    description: description || '',
    status: 'pending',
  }
  mockData.maintenanceRecords.push(record)
  vehicle.status = 'maintenance'

  res.status(201).json({ success: true, data: record })
})

export default router
