import { Router, type Request, type Response } from 'express'
import { mockData } from '../data/mockData.js'
import { findSubstitute, findSubstitutesForLine, applySubstitute } from '../services/substituteMatcher.js'

const router = Router()

const MAX_PAGE_SIZE = 200

router.get('/', (req: Request, res: Response): void => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 20))
  const status = req.query.status as string | undefined
  const lineId = req.query.lineId as string | undefined
  const licenseType = req.query.licenseType as string | undefined

  let filtered = [...mockData.drivers]
  if (status) filtered = filtered.filter(d => d.status === status)
  if (lineId) filtered = filtered.filter(d => d.lineId === lineId)
  if (licenseType) filtered = filtered.filter(d => d.licenseType === licenseType)

  const total = filtered.length
  const items = filtered.slice((page - 1) * pageSize, page * pageSize)

  res.json({ success: true, data: { items, total, page, pageSize } })
})

router.get('/:driverId', (req: Request, res: Response): void => {
  const driver = mockData.drivers.find(d => d.id === req.params.driverId)
  if (!driver) {
    res.status(404).json({ success: false, error: '司机不存在' })
    return
  }
  res.json({ success: true, data: driver })
})

router.post('/', (req: Request, res: Response): void => {
  const { name, employeeId, licenseType, lineId, phone } = req.body
  if (!name || !employeeId || !licenseType) {
    res.status(400).json({ success: false, error: '缺少必要参数' })
    return
  }

  const driver = {
    id: `drv_${Date.now()}`,
    name,
    employeeId,
    licenseType,
    status: 'active' as const,
    lineId: lineId || undefined,
    dailyWorkMinutes: 0,
    phone: phone || undefined,
  }
  mockData.drivers.push(driver)

  res.status(201).json({ success: true, data: driver })
})

router.put('/:driverId', (req: Request, res: Response): void => {
  const driver = mockData.drivers.find(d => d.id === req.params.driverId)
  if (!driver) {
    res.status(404).json({ success: false, error: '司机不存在' })
    return
  }

  const { name, licenseType, status, lineId, phone, dailyWorkMinutes } = req.body
  if (name) driver.name = name
  if (licenseType) driver.licenseType = licenseType
  if (status) driver.status = status
  if (lineId !== undefined) driver.lineId = lineId
  if (phone !== undefined) driver.phone = phone
  if (dailyWorkMinutes !== undefined) driver.dailyWorkMinutes = dailyWorkMinutes

  res.json({ success: true, data: driver })
})

router.put('/:driverId/leave', (req: Request, res: Response): void => {
  const driver = mockData.drivers.find(d => d.id === req.params.driverId)
  if (!driver) {
    res.status(404).json({ success: false, error: '司机不存在' })
    return
  }

  driver.status = 'leave'
  const substituteResult = findSubstitute(driver.id)

  res.json({
    success: true,
    data: {
      driver,
      substituteSuggestion: substituteResult,
    },
  })
})

router.post('/:driverId/substitute', (req: Request, res: Response): void => {
  const { substituteDriverId } = req.body
  if (!substituteDriverId) {
    res.status(400).json({ success: false, error: '缺少替班司机ID' })
    return
  }

  const success = applySubstitute(req.params.driverId, substituteDriverId)
  if (!success) {
    res.status(400).json({ success: false, error: '替班匹配失败' })
    return
  }

  res.json({ success: true, data: { message: '替班成功' } })
})

router.get('/line/:lineId/substitutes', (req: Request, res: Response): void => {
  const results = findSubstitutesForLine(req.params.lineId)
  res.json({ success: true, data: results })
})

export default router
