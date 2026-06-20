import type { Bill, PriceStandard, SubsidyPolicy, ServiceItem } from '@/types/billing'
import { dayjs } from '@/utils/date'

export const mockPriceStandards: PriceStandard[] = [
  { id: 'PS001', code: 'TR001', name: '市内遗体接运', category: 'transport', unit: '次', price: 500, governmentGuidePrice: 480, isGovernmentPrice: true, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS002', code: 'TR002', name: '郊区遗体接运', category: 'transport', unit: '次', price: 800, governmentGuidePrice: 780, isGovernmentPrice: true, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS003', code: 'RF001', name: '冷藏防腐(3天内)', category: 'refrigeration', unit: '天', price: 150, governmentGuidePrice: 150, isGovernmentPrice: true, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS004', code: 'RF002', name: '冷藏防腐(超3天)', category: 'refrigeration', unit: '天', price: 200, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS005', code: 'CM001', name: '整容化妆(标准)', category: 'cosmetic', unit: '次', price: 800, governmentGuidePrice: 680, isGovernmentPrice: true, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS006', code: 'CM002', name: '修复型整容', category: 'cosmetic', unit: '次', price: 3000, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS007', code: 'FW001', name: '追思厅(小)', category: 'farewell', unit: '小时', price: 500, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS008', code: 'FW002', name: '追思厅(中)', category: 'farewell', unit: '小时', price: 900, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS009', code: 'FW003', name: '追思厅(大)', category: 'farewell', unit: '小时', price: 1500, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS010', code: 'CR001', name: '火化(普通炉)', category: 'cremation', unit: '次', price: 380, governmentGuidePrice: 380, isGovernmentPrice: true, subsidyType: 'government_basic', subsidyAmount: 380, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS011', code: 'CR002', name: '火化(豪华炉)', category: 'cremation', unit: '次', price: 1280, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS012', code: 'CR003', name: '捡灰服务', category: 'cremation', unit: '次', price: 200, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS013', code: 'GH001', name: '骨灰盒(标准)', category: 'urn', unit: '个', price: 880, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS014', code: 'GH002', name: '骨灰盒(红木)', category: 'urn', unit: '个', price: 3880, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS015', code: 'AZ001', name: '安葬服务', category: 'burial', unit: '次', price: 500, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS016', code: 'AZ002', name: '刻碑服务', category: 'burial', unit: '次', price: 800, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS017', code: 'MU001', name: '标准型墓位', category: 'cemetery', unit: '座', price: 38800, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS018', code: 'MU002', name: '双穴型墓位', category: 'cemetery', unit: '座', price: 58800, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS019', code: 'MU003', name: '豪华型墓位', category: 'cemetery', unit: '座', price: 128800, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' },
  { id: 'PS020', code: 'QT001', name: '骨灰袋', category: 'other', unit: '个', price: 50, isGovernmentPrice: false, effectiveDate: '2024-01-01', status: 'active' }
]

export const mockSubsidyPolicies: SubsidyPolicy[] = [
  {
    id: 'SP001',
    name: '殡葬基本服务惠民补贴',
    type: 'government_basic',
    conditions: '本市户籍居民、在本市死亡并火化的人员',
    amount: 1880,
    documents: ['死亡证明', '户籍证明', '火化证'],
    effectiveDate: '2024-01-01',
    status: 'active'
  },
  {
    id: 'SP002',
    name: '特困人员殡葬费用减免',
    type: 'government_special',
    conditions: '低保对象、特困人员、重点优抚对象',
    percent: 1,
    maxAmount: 5000,
    documents: ['低保证/特困证', '优抚证', '身份证', '死亡证明'],
    effectiveDate: '2024-01-01',
    status: 'active'
  },
  {
    id: 'SP003',
    name: '慈善总会困难群众帮扶',
    type: 'charity',
    conditions: '家庭经济困难且无力承担殡葬基本费用的群众',
    amount: 3000,
    maxAmount: 5000,
    documents: ['困难证明', '社区/街道推荐信', '身份材料'],
    effectiveDate: '2024-01-01',
    status: 'active'
  }
]

function buildServiceItems(idx: number): ServiceItem[] {
  const picks = mockPriceStandards.filter(() => Math.random() > 0.35).slice(0, 5 + (idx % 3))
  return picks.map((ps, i) => {
    const qty = ps.category === 'refrigeration' ? 1 + (idx + i) % 5 : 1
    const discount = Math.random() > 0.7 ? [0.95, 0.9, 0.85][i % 3] : 1
    const subtotal = ps.price * qty * discount
    const hasSubsidy = !!ps.subsidyType && Math.random() > 0.4
    const subsidy = hasSubsidy ? (ps.subsidyAmount || Math.floor(subtotal * 0.3)) : 0
    return {
      id: `SI-${idx}-${i}`,
      code: ps.code,
      name: ps.name,
      category: ps.category,
      unit: ps.unit,
      price: ps.price,
      quantity: qty,
      discountRate: discount,
      subsidyType: hasSubsidy ? ps.subsidyType : undefined,
      subsidyAmount: subsidy,
      subsidyInfo: hasSubsidy ? mockSubsidyPolicies.find((p) => p.type === ps.subsidyType)?.name : undefined,
      finalPrice: Math.max(0, subtotal - subsidy),
      isMandatory: ps.category === 'transport' || ps.category === 'cremation',
      isGovernmentPrice: ps.isGovernmentPrice
    }
  })
}

export function generateMockBills(count = 12): Bill[] {
  const names = ['张伟', '李桂英', '王建国', '陈秀兰', '刘志强', '赵美玲', '孙德福', '周丽华', '吴明辉', '郑玉兰', '冯国强', '蒋秀芳']
  const methods: Bill['paymentMethod'][] = ['wechat', 'alipay', 'cash', 'bank', 'mixed', 'card']
  const statuses: Bill['status'][] = ['paid', 'paid', 'paid', 'unpaid', 'partial', 'paid']

  return Array.from({ length: count }).map((_, idx) => {
    const items = buildServiceItems(idx)
    const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity * it.discountRate, 0)
    const subsidyTotal = items.reduce((sum, it) => sum + (it.subsidyAmount || 0), 0)
    const discountTotal = items.reduce((sum, it) => sum + it.price * it.quantity * (1 - it.discountRate), 0)
    const total = subtotal - subsidyTotal - discountTotal
    const status = statuses[idx % statuses.length]
    const paidRatio = status === 'paid' ? 1 : status === 'partial' ? 0.5 : 0
    const paid = total * paidRatio

    return {
      id: `BILL${dayjs().format('YYYYMM')}${String(idx + 1).padStart(4, '0')}`,
      billNo: `DZ${dayjs().format('YYYYMMDD')}${String(idx + 1).padStart(4, '0')}`,
      remainsId: `R2026${String(1000 + idx).padStart(5, '0')}`,
      remainsName: names[idx % names.length],
      customerName: `家属${names[idx % names.length].replace(/.$/, '')}`,
      customerPhone: `139${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
      items,
      subtotal: Math.round(subtotal),
      subsidyTotal: Math.round(subsidyTotal),
      discountTotal: Math.round(discountTotal),
      waiverAmount: 0,
      totalAmount: Math.round(total),
      paidAmount: Math.round(paid),
      unpaidAmount: Math.round(total - paid),
      paymentMethod: status !== 'unpaid' ? methods[idx % methods.length] : undefined,
      paymentRecords: status !== 'unpaid' ? [{
        id: `PR-${idx}-1`,
        billId: `BILL${dayjs().format('YYYYMM')}${String(idx + 1).padStart(4, '0')}`,
        amount: Math.round(paid),
        method: methods[idx % methods.length],
        transactionId: `TX${Date.now()}${idx}`,
        operatorId: 'OP001',
        operatorName: '殡仪员张三',
        time: dayjs().subtract(idx, 'day').format('YYYY-MM-DD HH:mm')
      }] : [],
      invoiceType: Math.random() > 0.2 ? 'electronic' : 'none',
      invoiceTitle: idx % 2 === 0 ? '个人' : `上海市某某${['公司', '单位', '机关'][idx % 3]}`,
      invoiceTaxNo: idx % 2 !== 0 ? `91310000MA${String(idx).padStart(10, '0')}` : undefined,
      invoiceUrl: Math.random() > 0.3 ? `/invoices/INV${dayjs().format('YYYYMM')}${String(idx + 1).padStart(6, '0')}.pdf` : undefined,
      invoiceNo: Math.random() > 0.3 ? `INV${dayjs().format('YYYYMMDD')}${String(idx + 1).padStart(6, '0')}` : undefined,
      status,
      createTime: dayjs().subtract(idx, 'day').format('YYYY-MM-DD HH:mm'),
      paidTime: status !== 'unpaid' ? dayjs().subtract(idx, 'day').add(1, 'hour').format('YYYY-MM-DD HH:mm') : undefined,
      operatorId: 'OP001',
      operatorName: '殡仪员张三',
      auditStatus: Math.random() > 0.1 ? 'audited' : 'pending',
      auditorId: Math.random() > 0.1 ? 'AU001' : undefined,
      auditorName: Math.random() > 0.1 ? '财务李四' : undefined,
      auditTime: Math.random() > 0.1 ? dayjs().subtract(idx, 'day').add(2, 'hour').format('YYYY-MM-DD HH:mm') : undefined,
      subsidyProofs: subsidyTotal > 0 ? [{
        type: 'government_basic',
        documentNo: `HM${dayjs().format('YYYY')}${String(idx).padStart(6, '0')}`
      }] : undefined
    }
  })
}

export const mockBills: Bill[] = generateMockBills()
