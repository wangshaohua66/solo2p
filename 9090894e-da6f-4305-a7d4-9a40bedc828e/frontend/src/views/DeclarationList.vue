<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  Plus,
  Search as SearchIcon,
  Refresh,
  Upload,
  Download,
  Delete,
  Edit,
  View,
  Warning,
  Document
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useDeclarationStore } from '@/stores/declarationStore'
import StatusTag from '@/components/StatusTag.vue'
import type { Declaration, DeclarationStatus, DeclarationItem, DeclarationFilter } from '@/types'

const router = useRouter()
const store = useDeclarationStore()

const filterFormRef = ref<FormInstance>()
const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const withdrawDialogVisible = ref(false)
const withdrawReason = ref('')
const currentWithdrawId = ref('')
const currentDetail = ref<Declaration | null>(null)
const activeTab = ref<'list' | 'form'>('list')
const formStep = ref(0)

const formRules: FormRules = {
  title: [{ required: true, message: '请输入申报单标题', trigger: 'blur' }],
  platform: [{ required: true, message: '请选择销售平台', trigger: 'change' }],
  declareType: [{ required: true, message: '请选择申报类型', trigger: 'change' }]
}

const newDeclaration = reactive<Partial<Declaration>>({
  title: '',
  platform: '',
  declareType: 'normal',
  enterpriseName: '杭州跨境贸易有限公司',
  items: [],
  attachments: [],
  remark: ''
})

const newItem = reactive<Partial<DeclarationItem>>({
  productName: '',
  hsCode: '',
  specification: '',
  quantity: 1,
  unit: '件',
  unitPrice: 0,
  currency: 'USD',
  totalAmount: 0,
  country: 'US',
  declareElements: {}
})

const declareElementDialogVisible = ref(false)
const currentEditItemIndex = ref<number | null>(null)
const declareElementForm = reactive<Record<string, string>>({})

const MAX_FILE_SIZE = 20 * 1024 * 1024

const declareElementFields = [
  { key: 'brand', label: '品牌类型', required: true, placeholder: '如：自有品牌、无品牌、境内品牌、境外品牌' },
  { key: 'outwardProcess', label: '是否含出口加工', required: false, placeholder: '是/否' },
  { key: 'material', label: '成分含量', required: true, placeholder: '如：棉100%、不锈钢70%+塑料30%' },
  { key: 'usage', label: '用途', required: true, placeholder: '如：家用、办公、工业用、儿童玩具' },
  { key: 'specificationModel', label: '规格型号', required: true, placeholder: '详细规格、型号、尺寸、功率等' },
  { key: 'productionProcess', label: '加工工艺', required: false, placeholder: '如：注塑、缝制、压铸、电镀' },
  { key: 'packingType', label: '包装规格', required: true, placeholder: '如：12个/箱、独立包装' },
  { key: 'originCountry', label: '原产国', required: true, placeholder: '如：中国、越南' },
  { key: 'standard', label: '执行标准', required: false, placeholder: '如：GB/ISO/CE等标准编号' },
  { key: 'otherFeatures', label: '其他特征', required: false, placeholder: '其他需要说明的商品特征' }
]

const editingDeclareElements = reactive<Record<string, string>>({})

const mockDeclarations: Declaration[] = reactive([
  {
    id: '1',
    declareNo: 'CB202406150001',
    title: '6月亚马逊美国站电子产品出口申报',
    enterpriseName: '杭州跨境贸易有限公司',
    platform: 'amazon',
    status: 'customs_passed',
    declareType: 'normal',
    items: [
      { id: 'i1', productName: '蓝牙耳机', hsCode: '85171210', specification: 'TWS无线 黑色', quantity: 500, unit: '件', unitPrice: 25, currency: 'USD', totalAmount: 12500, country: 'US', declareElements: {} },
      { id: 'i2', productName: '智能手表', hsCode: '85171210', specification: '心率监测 GPS', quantity: 200, unit: '件', unitPrice: 80, currency: 'USD', totalAmount: 16000, country: 'US', declareElements: {} }
    ],
    attachments: [{ id: 'a1', name: '发票.pdf', url: '/files/invoice1.pdf', size: 245000, uploadedAt: '2024-06-15 10:30:00' }],
    totalAmount: 28500,
    taxRefundAmount: 3705,
    statusHistory: [
      { status: 'draft', time: '2024-06-15 09:00:00', operator: '张申报员' },
      { status: 'submitted', time: '2024-06-15 10:00:00', operator: '张申报员' },
      { status: 'reviewing', time: '2024-06-15 10:30:00', operator: '李审核员' },
      { status: 'approved', time: '2024-06-15 11:00:00', operator: '李审核员' },
      { status: 'customs_processing', time: '2024-06-15 14:00:00', operator: '系统' },
      { status: 'customs_passed', time: '2024-06-15 16:30:00', operator: '系统' }
    ],
    remark: '常规电子消费品出口',
    submitter: '张申报员',
    reviewer: '李审核员',
    createdAt: '2024-06-15 09:00:00',
    updatedAt: '2024-06-15 16:30:00',
    submittedAt: '2024-06-15 10:00:00',
    reviewedAt: '2024-06-15 11:00:00',
    customsPassedAt: '2024-06-15 16:30:00'
  },
  {
    id: '2',
    declareNo: 'CB202406150002',
    title: '6月速卖通俄罗斯服装出口申报',
    enterpriseName: '杭州跨境贸易有限公司',
    platform: 'aliexpress',
    status: 'tax_processing',
    declareType: 'normal',
    items: [
      { id: 'i3', productName: '棉质T恤', hsCode: '61091000', specification: 'M码 白色 印花', quantity: 1000, unit: '件', unitPrice: 5, currency: 'USD', totalAmount: 5000, country: 'RU', declareElements: {} }
    ],
    attachments: [],
    totalAmount: 5000,
    taxRefundAmount: 650,
    statusHistory: [
      { status: 'draft', time: '2024-06-15 11:00:00', operator: '张申报员' },
      { status: 'submitted', time: '2024-06-15 12:00:00', operator: '张申报员' },
      { status: 'approved', time: '2024-06-15 13:00:00', operator: '李审核员' },
      { status: 'customs_passed', time: '2024-06-15 15:00:00', operator: '系统' },
      { status: 'tax_processing', time: '2024-06-15 17:00:00', operator: '系统' }
    ],
    remark: '',
    submitter: '张申报员',
    reviewer: '李审核员',
    createdAt: '2024-06-15 11:00:00',
    updatedAt: '2024-06-15 17:00:00',
    submittedAt: '2024-06-15 12:00:00',
    reviewedAt: '2024-06-15 13:00:00'
  },
  {
    id: '3',
    declareNo: 'CB202406140003',
    title: '6月eBay欧洲站玩具出口申报',
    enterpriseName: '杭州跨境贸易有限公司',
    platform: 'ebay',
    status: 'reviewing',
    declareType: 'express',
    items: [
      { id: 'i4', productName: '积木玩具', hsCode: '95030031', specification: '益智积木 200PCS', quantity: 300, unit: '套', unitPrice: 15, currency: 'USD', totalAmount: 4500, country: 'DE', declareElements: {} }
    ],
    attachments: [{ id: 'a2', name: '装箱单.xlsx', url: '/files/packing2.xlsx', size: 125000, uploadedAt: '2024-06-14 15:20:00' }],
    totalAmount: 4500,
    taxRefundAmount: 585,
    statusHistory: [
      { status: 'draft', time: '2024-06-14 14:00:00', operator: '张申报员' },
      { status: 'submitted', time: '2024-06-14 15:00:00', operator: '张申报员' },
      { status: 'reviewing', time: '2024-06-14 15:30:00', operator: '李审核员' }
    ],
    remark: '加急处理，客户催单',
    submitter: '张申报员',
    reviewer: '李审核员',
    createdAt: '2024-06-14 14:00:00',
    updatedAt: '2024-06-14 15:30:00',
    submittedAt: '2024-06-14 15:00:00'
  },
  {
    id: '4',
    declareNo: 'CB202406140004',
    title: '6月Wish家居用品出口申报',
    enterpriseName: '杭州跨境贸易有限公司',
    platform: 'wish',
    status: 'rejected',
    declareType: 'normal',
    items: [
      { id: 'i5', productName: 'LED台灯', hsCode: '94052000', specification: 'USB充电 护眼', quantity: 150, unit: '件', unitPrice: 18, currency: 'USD', totalAmount: 2700, country: 'FR', declareElements: {} }
    ],
    attachments: [],
    totalAmount: 2700,
    taxRefundAmount: 351,
    statusHistory: [
      { status: 'draft', time: '2024-06-14 09:00:00', operator: '张申报员' },
      { status: 'submitted', time: '2024-06-14 10:00:00', operator: '张申报员' },
      { status: 'rejected', time: '2024-06-14 11:30:00', operator: '李审核员', remark: 'HS编码归类错误，请核对后重新提交' }
    ],
    remark: '',
    submitter: '张申报员',
    reviewer: '李审核员',
    createdAt: '2024-06-14 09:00:00',
    updatedAt: '2024-06-14 11:30:00',
    submittedAt: '2024-06-14 10:00:00'
  },
  {
    id: '5',
    declareNo: 'CB202406130005',
    title: '6月亚马逊美妆产品出口申报',
    enterpriseName: '杭州跨境贸易有限公司',
    platform: 'amazon',
    status: 'customs_exception',
    declareType: 'normal',
    items: [
      { id: 'i6', productName: '口红套装', hsCode: '33041000', specification: '6色套装', quantity: 400, unit: '套', unitPrice: 30, currency: 'USD', totalAmount: 12000, country: 'US', declareElements: {} }
    ],
    attachments: [{ id: 'a3', name: '质检报告.pdf', url: '/files/qa3.pdf', size: 890000, uploadedAt: '2024-06-13 11:00:00' }],
    totalAmount: 12000,
    taxRefundAmount: 1560,
    statusHistory: [
      { status: 'draft', time: '2024-06-13 09:00:00', operator: '张申报员' },
      { status: 'submitted', time: '2024-06-13 10:00:00', operator: '张申报员' },
      { status: 'approved', time: '2024-06-13 11:00:00', operator: '李审核员' },
      { status: 'customs_exception', time: '2024-06-13 15:00:00', operator: '系统', remark: '需要提供化妆品备案凭证' }
    ],
    remark: '美妆产品需特殊备案',
    submitter: '张申报员',
    reviewer: '李审核员',
    createdAt: '2024-06-13 09:00:00',
    updatedAt: '2024-06-13 15:00:00',
    submittedAt: '2024-06-13 10:00:00'
  },
  {
    id: '6',
    declareNo: 'CB202406130006',
    title: '6月跨境电商综合申报',
    enterpriseName: '杭州跨境贸易有限公司',
    platform: 'amazon',
    status: 'draft',
    declareType: 'bonded',
    items: [
      { id: 'i7', productName: '无线充电器', hsCode: '85044099', specification: 'Qi标准 15W', quantity: 800, unit: '件', unitPrice: 12, currency: 'USD', totalAmount: 9600, country: 'US', declareElements: {} }
    ],
    attachments: [],
    totalAmount: 9600,
    taxRefundAmount: 1248,
    statusHistory: [
      { status: 'draft', time: '2024-06-13 16:00:00', operator: '张申报员' }
    ],
    remark: '',
    submitter: '',
    createdAt: '2024-06-13 16:00:00',
    updatedAt: '2024-06-13 16:00:00'
  }
])

const platforms = [
  { label: '亚马逊', value: 'amazon' },
  { label: 'eBay', value: 'ebay' },
  { label: '速卖通', value: 'aliexpress' },
  { label: 'Wish', value: 'wish' },
  { label: 'Shopee', value: 'shopee' },
  { label: 'Lazada', value: 'lazada' }
]

const declareTypes = [
  { label: '普通申报', value: 'normal' },
  { label: '快件申报', value: 'express' },
  { label: '保税申报', value: 'bonded' }
]

const statusOptions: { label: string; value: DeclarationStatus | '' }[] = [
  { label: '全部状态', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已提交', value: 'submitted' },
  { label: '审核中', value: 'reviewing' },
  { label: '审核通过', value: 'approved' },
  { label: '审核驳回', value: 'rejected' },
  { label: '通关处理中', value: 'customs_processing' },
  { label: '通关完成', value: 'customs_passed' },
  { label: '通关异常', value: 'customs_exception' },
  { label: '退税处理中', value: 'tax_processing' },
  { label: '退税完成', value: 'tax_completed' },
  { label: '已撤回', value: 'withdrawn' }
]

const currencies = [
  { label: '美元 USD', value: 'USD' },
  { label: '欧元 EUR', value: 'EUR' },
  { label: '人民币 CNY', value: 'CNY' },
  { label: '英镑 GBP', value: 'GBP' },
  { label: '日元 JPY', value: 'JPY' }
]

const countries = [
  { label: '美国', value: 'US' },
  { label: '德国', value: 'DE' },
  { label: '英国', value: 'GB' },
  { label: '法国', value: 'FR' },
  { label: '俄罗斯', value: 'RU' },
  { label: '日本', value: 'JP' },
  { label: '澳大利亚', value: 'AU' },
  { label: '加拿大', value: 'CA' }
]

const filteredDeclarations = computed(() => {
  let result = [...mockDeclarations]
  const f = store.filter

  if (f.keyword) {
    const kw = f.keyword.toLowerCase()
    result = result.filter(d =>
      d.declareNo.toLowerCase().includes(kw) ||
      d.title.toLowerCase().includes(kw) ||
      d.enterpriseName.toLowerCase().includes(kw)
    )
  }
  if (f.status) {
    result = result.filter(d => d.status === f.status)
  }
  if (f.platform) {
    result = result.filter(d => d.platform === f.platform)
  }
  if (f.declareType) {
    result = result.filter(d => d.declareType === f.declareType)
  }
  return result
})

const displayedDeclarations = computed(() => {
  const start = (store.pagination.page - 1) * store.pagination.pageSize
  const end = start + store.pagination.pageSize
  return filteredDeclarations.value.slice(start, end)
})

watch(
  () => store.filter,
  () => {
    store.pagination.page = 1
  },
  { deep: true }
)

watch(
  () => filteredDeclarations.value.length,
  (len) => {
    store.pagination.total = len
  },
  { immediate: true }
)

onMounted(() => {
  store.pagination.total = filteredDeclarations.value.length
})

function handleSearch() {
  store.pagination.page = 1
  ElMessage.success('筛选完成')
}

function handleReset() {
  store.resetFilter()
  store.pagination.page = 1
  ElMessage.info('已重置筛选条件')
}

function handleRefresh() {
  store.pagination.page = 1
  ElMessage.success('数据已刷新')
}

function handleCreate() {
  Object.assign(newDeclaration, {
    title: '',
    platform: '',
    declareType: 'normal',
    enterpriseName: '杭州跨境贸易有限公司',
    items: [],
    attachments: [],
    remark: ''
  })
  formStep.value = 0
  createDialogVisible.value = true
}

function handleEdit(row: Declaration) {
  if (row.status !== 'draft' && row.status !== 'rejected') {
    ElMessage.warning('该状态下的申报单不可编辑')
    return
  }
  router.push(`/declarations/${row.id}`)
}

function handleView(row: Declaration) {
  currentDetail.value = row
  detailDialogVisible.value = true
}

async function handleDelete(row: Declaration) {
  if (row.status !== 'draft') {
    ElMessage.warning('只能删除草稿状态的申报单')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除申报单 ${row.declareNo} 吗？此操作不可撤销。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })
    const idx = mockDeclarations.findIndex(d => d.id === row.id)
    if (idx !== -1) mockDeclarations.splice(idx, 1)
    store.clearSelection()
    ElMessage.success('删除成功')
  } catch {
  }
}

async function handleSubmit(row: Declaration) {
  if (row.status !== 'draft') {
    ElMessage.warning('只有草稿状态可以提交')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要提交申报单 ${row.declareNo} 吗？提交后将进入审核流程，不可修改。`, '提交确认', {
      type: 'info',
      confirmButtonText: '确认提交',
      cancelButtonText: '取消'
    })
    row.status = 'submitted'
    row.submittedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
    row.statusHistory.push({
      status: 'submitted',
      time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      operator: '张申报员'
    })
    ElMessage.success('提交成功')
  } catch {
  }
}

async function handleBatchSubmit() {
  if (store.selectedCount === 0) {
    ElMessage.warning('请先选择要提交的申报单')
    return
  }
  const validIds = store.selectedIds.filter(id => {
    const d = mockDeclarations.find(x => x.id === id)
    return d && d.status === 'draft'
  })
  if (validIds.length === 0) {
    ElMessage.warning('所选申报单中没有草稿状态的记录')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要批量提交 ${validIds.length} 条申报单吗？`, '批量提交确认', {
      type: 'info'
    })
    validIds.forEach(id => {
      const d = mockDeclarations.find(x => x.id === id)
      if (d) {
        d.status = 'submitted'
        d.submittedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
        d.statusHistory.push({
          status: 'submitted',
          time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          operator: '张申报员'
        })
      }
    })
    store.clearSelection()
    ElMessage.success(`成功提交 ${validIds.length} 条申报单`)
  } catch {
  }
}

function handleWithdraw(row: Declaration) {
  if (row.status === 'draft' || row.status === 'withdrawn') {
    ElMessage.warning('该状态不可撤回')
    return
  }
  currentWithdrawId.value = row.id
  withdrawReason.value = ''
  withdrawDialogVisible.value = true
}

async function confirmWithdraw() {
  if (!withdrawReason.value.trim()) {
    ElMessage.warning('请填写撤回原因')
    return
  }
  const d = mockDeclarations.find(x => x.id === currentWithdrawId.value)
  if (d) {
    d.status = 'withdrawn'
    d.statusHistory.push({
      status: 'withdrawn',
      time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      operator: '张申报员',
      remark: withdrawReason.value
    })
    ElMessage.success('撤回成功')
  }
  withdrawDialogVisible.value = false
}

function addItem() {
  if (!newItem.productName || !newItem.hsCode) {
    ElMessage.warning('请填写商品名称和HS编码')
    return
  }
  newItem.totalAmount = (newItem.quantity || 0) * (newItem.unitPrice || 0)
  newDeclaration.items!.push({
    id: `i${Date.now()}`,
    productName: newItem.productName,
    hsCode: newItem.hsCode,
    specification: newItem.specification || '',
    quantity: newItem.quantity || 1,
    unit: newItem.unit || '件',
    unitPrice: newItem.unitPrice || 0,
    currency: newItem.currency || 'USD',
    totalAmount: newItem.totalAmount,
    country: newItem.country || 'US',
    declareElements: {}
  })
  Object.assign(newItem, {
    productName: '',
    hsCode: '',
    specification: '',
    quantity: 1,
    unit: '件',
    unitPrice: 0,
    currency: 'USD',
    totalAmount: 0,
    country: 'US'
  })
}

function removeItem(idx: number) {
  newDeclaration.items!.splice(idx, 1)
}

function openDeclareElements(idx: number) {
  currentEditItemIndex.value = idx
  const item = newDeclaration.items![idx]
  Object.assign(editingDeclareElements, item.declareElements || {})
  declareElementDialogVisible.value = true
}

function saveDeclareElements() {
  if (currentEditItemIndex.value !== null && newDeclaration.items) {
    newDeclaration.items[currentEditItemIndex.value].declareElements = { ...editingDeclareElements }
    ElMessage.success('申报要素已保存')
  }
  declareElementDialogVisible.value = false
}

function getDeclareElementsSummary(elements: Record<string, string>) {
  const entries = Object.entries(elements).filter(([, v]) => v)
  if (entries.length === 0) return '未填写'
  return entries.map(([k, v]) => v).filter(Boolean).slice(0, 3).join('、')
}

const declareElementsFilledCount = computed(() => {
  return Object.values(editingDeclareElements).filter(v => v && v.trim()).length
})

const declareElementsRequiredCount = computed(() => {
  return declareElementFields.filter(f => f.required).length
})

function handleFileUpload(file: any) {
  if (file.size > MAX_FILE_SIZE) {
    ElMessage.error(`文件大小不能超过 20MB，当前文件大小 ${(file.size / 1024 / 1024).toFixed(2)}MB`)
    return false
  }

  const newAtt = {
    id: `a${Date.now()}`,
    name: file.name,
    url: URL.createObjectURL(file.raw || file),
    size: file.size,
    uploadedAt: new Date().toLocaleString('zh-CN')
  }
  newDeclaration.attachments!.push(newAtt as any)
  ElMessage.success('文件上传成功')
  return false
}

function handleFileExceed() {
  ElMessage.error('文件大小超过 20MB 限制')
}

function removeAttachment(idx: number) {
  newDeclaration.attachments!.splice(idx, 1)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

async function confirmCreate(saveAsDraft = false) {
  if (!saveAsDraft) {
    await filterFormRef.value?.validate()
  }
  const totals = newDeclaration.items!.reduce(
    (acc, it) => ({
      amount: acc.amount + it.totalAmount,
      tax: acc.tax + it.totalAmount * 0.13
    }),
    { amount: 0, tax: 0 }
  )
  const newRecord: Declaration = {
    id: `${Date.now()}`,
    declareNo: store.generateDeclareNo(),
    title: newDeclaration.title!,
    enterpriseName: newDeclaration.enterpriseName!,
    platform: newDeclaration.platform!,
    status: saveAsDraft ? 'draft' : 'submitted',
    declareType: newDeclaration.declareType as any,
    items: newDeclaration.items!,
    attachments: newDeclaration.attachments!,
    totalAmount: totals.amount,
    taxRefundAmount: totals.tax,
    statusHistory: [{
      status: saveAsDraft ? 'draft' : 'submitted',
      time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      operator: '张申报员'
    }],
    remark: newDeclaration.remark || '',
    submitter: saveAsDraft ? '' : '张申报员',
    createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    submittedAt: saveAsDraft ? undefined : dayjs().format('YYYY-MM-DD HH:mm:ss')
  }
  mockDeclarations.unshift(newRecord)
  createDialogVisible.value = false
  ElMessage.success(saveAsDraft ? '草稿已保存' : '提交成功')
}

function handleCurrentChange(page: number) {
  store.pagination.page = page
}

function handleSizeChange(size: number) {
  store.pagination.pageSize = size
  store.pagination.page = 1
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">申报清单管理</div>
      <div style="display: flex; gap: 10px;">
        <el-button :icon="Refresh" @click="handleRefresh">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="handleCreate">新建申报单</el-button>
      </div>
    </div>

    <div class="card filter-card">
      <el-form :inline="true" :model="store.filter" label-position="right" label-width="80px">
        <el-form-item label="关键词">
          <el-input
            v-model="store.filter.keyword"
            placeholder="申报单号/标题/企业名称"
            clearable
            style="width: 240px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="store.filter.status" placeholder="全部状态" clearable style="width: 160px">
            <el-option
              v-for="opt in statusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="平台">
          <el-select v-model="store.filter.platform" placeholder="全部平台" clearable style="width: 140px">
            <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="申报类型">
          <el-select v-model="store.filter.declareType" placeholder="全部类型" clearable style="width: 140px">
            <el-option v-for="t in declareTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="申报日期">
          <el-date-picker
            v-model="store.filter.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 280px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="SearchIcon" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="card table-card">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <el-checkbox
            v-model="store.allSelected"
            :indeterminate="store.isSomeSelected"
            @change="store.toggleSelectAll"
          >
            全选
          </el-checkbox>
          <span class="selected-count" v-if="store.selectedCount > 0">
            已选 {{ store.selectedCount }} 项
          </span>
        </div>
        <div class="toolbar-right">
          <el-button :disabled="store.selectedCount === 0" @click="handleBatchSubmit">
            批量提交
          </el-button>
          <el-button :icon="Upload">批量导入</el-button>
          <el-button :icon="Download">导出Excel</el-button>
        </div>
      </div>

      <el-table
        :data="displayedDeclarations"
        stripe
        highlight-current-row
        style="width: 100%"
        @selection-change="(s: Declaration[]) => { store.selectedIds = s.map(x => x.id) }"
        empty-text="暂无申报数据"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column prop="declareNo" label="申报单号" width="170" sortable>
          <template #default="{ row }">
            <el-link type="primary" @click="handleView(row)">{{ row.declareNo }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
        <el-table-column prop="enterpriseName" label="企业名称" width="170" show-overflow-tooltip />
        <el-table-column label="平台" width="100">
          <template #default="{ row }">
            {{ platforms.find(p => p.value === row.platform)?.label || row.platform }}
          </template>
        </el-table-column>
        <el-table-column label="申报类型" width="100">
          <template #default="{ row }">
            {{ declareTypes.find(t => t.value === row.declareType)?.label || row.declareType }}
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="申报金额" width="120" sortable align="right">
          <template #default="{ row }">
            ${{ row.totalAmount.toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="taxRefundAmount" label="退税金额" width="120" sortable align="right">
          <template #default="{ row }">
            ¥{{ row.taxRefundAmount.toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" sortable />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="View" @click="handleView(row)">详情</el-button>
            <el-button
              link
              type="primary"
              :icon="Edit"
              :disabled="row.status !== 'draft' && row.status !== 'rejected'"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              link
              type="success"
              :disabled="row.status !== 'draft'"
              @click="handleSubmit(row)"
            >
              提交
            </el-button>
            <el-button
              link
              type="warning"
              :disabled="row.status === 'draft' || row.status === 'withdrawn'"
              @click="handleWithdraw(row)"
            >
              撤回
            </el-button>
            <el-button
              link
              type="danger"
              :icon="Delete"
              :disabled="row.status !== 'draft'"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="store.pagination.page"
          v-model:page-size="store.pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="store.pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <el-dialog
      v-model="createDialogVisible"
      title="新建申报单"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-steps :active="formStep" finish-status="success" align-center style="margin-bottom: 24px">
        <el-step title="基本信息" />
        <el-step title="商品明细" />
        <el-step title="确认提交" />
      </el-steps>

      <div v-show="formStep === 0">
        <el-form :model="newDeclaration" :rules="formRules" ref="filterFormRef" label-width="100px">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="申报标题" prop="title">
                <el-input v-model="newDeclaration.title" placeholder="请输入申报单标题" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="销售平台" prop="platform">
                <el-select v-model="newDeclaration.platform" placeholder="请选择" style="width: 100%">
                  <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="申报类型" prop="declareType">
                <el-select v-model="newDeclaration.declareType" placeholder="请选择" style="width: 100%">
                  <el-option v-for="t in declareTypes" :key="t.value" :label="t.label" :value="t.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="申报企业">
                <el-input v-model="newDeclaration.enterpriseName" disabled />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="备注">
                <el-input v-model="newDeclaration.remark" type="textarea" :rows="3" placeholder="选填" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </div>

      <div v-show="formStep === 1">
        <div class="step-section-title">商品信息</div>
        <div class="item-form-inline">
          <el-input v-model="newItem.productName" placeholder="商品名称" style="width: 180px" />
          <el-input v-model="newItem.hsCode" placeholder="HS编码" style="width: 140px" />
          <el-input v-model="newItem.specification" placeholder="规格型号" style="width: 160px" />
          <el-input-number v-model="newItem.quantity" :min="1" :controls="false" style="width: 100px" />
          <el-input v-model="newItem.unit" placeholder="单位" style="width: 80px" />
          <el-input-number
            v-model="newItem.unitPrice"
            :min="0"
            :precision="2"
            :controls="false"
            style="width: 120px"
          />
          <el-select v-model="newItem.currency" style="width: 100px">
            <el-option v-for="c in currencies" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
          <el-select v-model="newItem.country" style="width: 100px">
            <el-option v-for="c in countries" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
          <el-button type="primary" :icon="Plus" @click="addItem">添加</el-button>
        </div>

        <el-table :data="newDeclaration.items" style="margin-top: 16px" border>
          <el-table-column prop="productName" label="商品名称" min-width="120" />
          <el-table-column prop="hsCode" label="HS编码" width="120" />
          <el-table-column prop="specification" label="规格" width="120" />
          <el-table-column prop="quantity" label="数量" width="70" align="right" />
          <el-table-column prop="unit" label="单位" width="60" />
          <el-table-column prop="unitPrice" label="单价" width="90" align="right">
            <template #default="{ row }">${{ row.unitPrice }}</template>
          </el-table-column>
          <el-table-column prop="currency" label="币种" width="60" />
          <el-table-column prop="totalAmount" label="金额" width="100" align="right">
            <template #default="{ row }">${{ row.totalAmount.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="country" label="目的国" width="70" />
          <el-table-column label="申报要素" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <el-tooltip :content="getDeclareElementsSummary(row.declareElements)" placement="top">
                <span class="declare-ele-summary">
                  {{ getDeclareElementsSummary(row.declareElements) }}
                </span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ $index }">
              <el-button link type="primary" @click="openDeclareElements($index)">
                <el-icon style="margin-right: 2px"><Edit /></el-icon>
                申报要素
              </el-button>
              <el-button link type="danger" @click="removeItem($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="step-section-title" style="margin-top: 24px">附件上传</div>
        <el-upload
          class="upload-box"
          :auto-upload="false"
          :show-file-list="false"
          :before-upload="handleFileUpload"
          multiple
          drag
          :limit="10"
          :on-exceed="handleFileExceed"
        >
          <el-icon class="upload-icon"><Upload /></el-icon>
          <div class="upload-text">将文件拖到此处，或<em>点击上传</em></div>
          <template #tip>
            <div class="upload-tip">
              支持 PDF、Excel、Word、图片格式，单个文件不超过 20MB
            </div>
          </template>
        </el-upload>

        <div v-if="newDeclaration.attachments && newDeclaration.attachments.length > 0" class="attachment-list">
          <div v-for="(att, idx) in newDeclaration.attachments" :key="att.id" class="attachment-item">
            <el-icon class="att-icon"><Document /></el-icon>
            <div class="att-info">
              <div class="att-name">{{ att.name }}</div>
              <div class="att-meta">
                {{ formatFileSize(att.size) }} · {{ att.uploadedAt }}
              </div>
            </div>
            <el-button link type="danger" @click="removeAttachment(idx)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>

      <div v-show="formStep === 2">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="申报标题">{{ newDeclaration.title }}</el-descriptions-item>
          <el-descriptions-item label="销售平台">
            {{ platforms.find(p => p.value === newDeclaration.platform)?.label }}
          </el-descriptions-item>
          <el-descriptions-item label="申报类型">
            {{ declareTypes.find(t => t.value === newDeclaration.declareType)?.label }}
          </el-descriptions-item>
          <el-descriptions-item label="企业名称">{{ newDeclaration.enterpriseName }}</el-descriptions-item>
          <el-descriptions-item label="商品数量" :span="2">
            共 {{ newDeclaration.items?.length || 0 }} 项商品
          </el-descriptions-item>
          <el-descriptions-item label="总金额" :span="2">
            ${{ (newDeclaration.items || []).reduce((s, i) => s + i.totalAmount, 0).toLocaleString() }}
          </el-descriptions-item>
          <el-descriptions-item label="预计退税" :span="2">
            ¥{{ ((newDeclaration.items || []).reduce((s, i) => s + i.totalAmount, 0) * 0.13).toFixed(2) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <template #footer>
        <div v-if="formStep > 0">
          <el-button @click="formStep--">上一步</el-button>
        </div>
        <el-button v-if="formStep < 2" type="primary" @click="formStep++">下一步</el-button>
        <template v-else>
          <el-button @click="confirmCreate(true)">保存草稿</el-button>
          <el-button type="primary" @click="confirmCreate(false)">提交申报</el-button>
        </template>
      </template>
    </el-dialog>

    <el-dialog
      v-model="detailDialogVisible"
      title="申报单详情"
      width="820px"
    >
      <template v-if="currentDetail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="申报单号">{{ currentDetail.declareNo }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <StatusTag :status="currentDetail.status" />
          </el-descriptions-item>
          <el-descriptions-item label="标题">{{ currentDetail.title }}</el-descriptions-item>
          <el-descriptions-item label="企业名称">{{ currentDetail.enterpriseName }}</el-descriptions-item>
          <el-descriptions-item label="平台">
            {{ platforms.find(p => p.value === currentDetail.platform)?.label }}
          </el-descriptions-item>
          <el-descriptions-item label="申报类型">
            {{ declareTypes.find(t => t.value === currentDetail.declareType)?.label }}
          </el-descriptions-item>
          <el-descriptions-item label="申报金额">${{ currentDetail.totalAmount.toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="退税金额">¥{{ currentDetail.taxRefundAmount.toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="提交人">{{ currentDetail.submitter || '-' }}</el-descriptions-item>
          <el-descriptions-item label="审核人">{{ currentDetail.reviewer || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentDetail.createdAt }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ currentDetail.updatedAt }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-top: 20px; margin-bottom: 10px">商品明细</h4>
        <el-table :data="currentDetail.items" size="small" border>
          <el-table-column prop="productName" label="商品名称" />
          <el-table-column prop="hsCode" label="HS编码" width="110" />
          <el-table-column prop="specification" label="规格" width="140" />
          <el-table-column prop="quantity" label="数量" width="70" align="right" />
          <el-table-column prop="unit" label="单位" width="60" />
          <el-table-column prop="unitPrice" label="单价" width="80" align="right">
            <template #default="{ row }">${{ row.unitPrice }}</template>
          </el-table-column>
          <el-table-column prop="totalAmount" label="金额" width="100" align="right">
            <template #default="{ row }">${{ row.totalAmount.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="country" label="目的国" width="70" />
        </el-table>

        <h4 style="margin-top: 20px; margin-bottom: 10px">状态流转</h4>
        <el-timeline>
          <el-timeline-item
            v-for="(h, idx) in currentDetail.statusHistory"
            :key="idx"
            :timestamp="h.time"
            :type="idx === currentDetail.statusHistory.length - 1 ? 'primary' : 'info'"
          >
            <div style="display: flex; align-items: center; gap: 8px">
              <StatusTag :status="h.status" size="small" />
              <span>操作人：{{ h.operator }}</span>
            </div>
            <div v-if="h.remark" style="color: #909399; margin-top: 4px; font-size: 13px">
              {{ h.remark }}
            </div>
          </el-timeline-item>
        </el-timeline>
      </template>
    </el-dialog>

    <el-dialog v-model="withdrawDialogVisible" title="撤回申报" width="480px">
      <el-form label-position="top">
        <el-form-item label="撤回原因" required>
          <el-input
            v-model="withdrawReason"
            type="textarea"
            :rows="4"
            placeholder="请详细说明撤回原因"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="withdrawDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmWithdraw">确认撤回</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="declareElementDialogVisible"
      title="申报要素填写"
      width="680px"
      :close-on-click-modal="false"
    >
      <div class="declare-elements-header">
        <div class="de-title">
          请填写商品申报要素
          <el-tag type="info" size="small" style="margin-left: 8px">
            必填 {{ declareElementsRequiredCount }} 项 · 已填 {{ declareElementsFilledCount }} 项
          </el-tag>
        </div>
        <div class="de-tip">
          申报要素是海关归类和审价的重要依据，请如实准确填写
        </div>
      </div>

      <el-form label-position="top" class="declare-elements-form">
        <el-row :gutter="16">
          <el-col :span="12" v-for="field in declareElementFields" :key="field.key">
            <el-form-item :label="field.label + (field.required ? ' *' : '')">
              <el-input
                :model-value="editingDeclareElements[field.key]"
                @input="(val: string) => { editingDeclareElements[field.key] = val }"
                :placeholder="field.placeholder"
                type="text"
                clearable
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <div class="declare-elements-tip">
        <el-icon style="margin-right: 6px"><Warning /></el-icon>
        提示：申报要素信息将用于海关归类审价，请确保填写准确完整。带 <span style="color: #f56c6c">*</span> 为必填项。
      </div>

      <template #footer>
        <el-button @click="declareElementDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDeclareElements">保存申报要素</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.filter-card {
  margin-bottom: 16px;
}

.table-card {
  padding-top: 12px;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 16px;
  border-bottom: 1px solid $border-light;
  margin-bottom: 12px;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .selected-count {
    color: $primary-color;
    font-size: $font-size-sm;
  }

  .toolbar-right {
    display: flex;
    gap: 8px;
  }
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}

.item-form-inline {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.step-section-title {
  font-size: 15px;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 12px;
  padding-left: 10px;
  border-left: 3px solid $primary-color;
}

.declare-ele-summary {
  font-size: 12px;
  color: $text-regular;
  cursor: help;
}

.upload-box {
  border: 1px dashed $border-light;
  border-radius: $border-radius-md;
  padding: 30px;
  text-align: center;
  transition: all 0.3s;

  &:hover {
    border-color: $primary-color;
    background: #f0f9ff;
  }

  .upload-icon {
    font-size: 48px;
    color: #c0c4cc;
    margin-bottom: 10px;
  }

  .upload-text {
    font-size: 14px;
    color: $text-regular;
    margin-bottom: 6px;

    em {
      color: $primary-color;
      font-style: normal;
    }
  }

  .upload-tip {
    font-size: 12px;
    color: $text-secondary;
  }
}

.attachment-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .attachment-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #f5f7fa;
    border-radius: $border-radius-sm;
    border: 1px solid #ebeef5;
    transition: all 0.2s;

    &:hover {
      border-color: $primary-color;
      background: #fff;
    }

    .att-icon {
      font-size: 24px;
      color: $primary-color;
      flex-shrink: 0;
    }

    .att-info {
      flex: 1;
      min-width: 0;

      .att-name {
        font-size: 13px;
        color: $text-primary;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .att-meta {
        font-size: 12px;
        color: $text-secondary;
        margin-top: 2px;
      }
    }
  }
}

.declare-elements-header {
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid $border-light;

  .de-title {
    font-size: 15px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 6px;
  }

  .de-tip {
    font-size: 12px;
    color: $text-secondary;
  }
}

.declare-elements-form {
  :deep(.el-form-item) {
    margin-bottom: 14px;
  }
}

.declare-elements-tip {
  margin-top: 16px;
  padding: 10px 14px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: $border-radius-sm;
  font-size: 12px;
  color: #d48806;
  display: flex;
  align-items: flex-start;
}
</style>
