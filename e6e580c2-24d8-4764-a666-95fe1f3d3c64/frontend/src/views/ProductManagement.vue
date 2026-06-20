<template>
  <div class="page-container">
    <div class="card-box">
      <el-form :model="searchForm" inline @submit.prevent>
        <el-form-item label="商品名称">
          <el-input
            v-model="searchForm.name"
            placeholder="请输入商品名称"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="商品分类">
          <el-cascader
            v-model="searchForm.categoryId"
            :options="categoryOptions"
            :props="cascaderProps"
            placeholder="请选择分类"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="供应商">
          <el-select
            v-model="searchForm.supplierId"
            placeholder="请选择供应商"
            clearable
            filterable
            style="width: 180px"
          >
            <el-option v-for="s in supplierList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="商品状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="searchForm.auditStatus" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="item in auditStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="card-box">
      <div class="table-toolbar">
        <div>
          <el-button type="primary" :icon="Plus" @click="openAddDialog">新增商品</el-button>
          <el-button type="success" :icon="Upload" @click="importDialogVisible = true">批量导入</el-button>
          <el-button
            type="warning"
            :icon="Top"
            :disabled="!selectedRows.length"
            @click="handleBatchStatus(1)"
          >批量上架</el-button>
          <el-button
            :icon="Bottom"
            :disabled="!selectedRows.length"
            @click="handleBatchStatus(2)"
          >批量下架</el-button>
        </div>
        <el-tag type="info" effect="plain">共 {{ total }} 条</el-tag>
      </div>

      <el-table
        v-loading="loading"
        :data="tableData"
        border
        stripe
        highlight-current-row
        row-class-name="hover-row"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="45" />
        <el-table-column label="图片" width="80" align="center">
          <template #default="{ row }">
            <el-image
              :src="row.imageUrl"
              fit="cover"
              style="width: 50px; height: 50px; border-radius: 4px"
              :preview-src-list="row.imageUrl ? [row.imageUrl] : []"
              preview-teleported
            >
              <template #error>
                <div class="img-error">无图</div>
              </template>
            </el-image>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="分类" width="100" />
        <el-table-column prop="supplierName" label="供应商" width="130" show-overflow-tooltip />
        <el-table-column prop="purchasePrice" label="进价" width="90" sortable="custom" align="right">
          <template #default="{ row }">¥{{ row.purchasePrice }}</template>
        </el-table-column>
        <el-table-column prop="sellingPrice" label="售价" width="90" sortable="custom" align="right">
          <template #default="{ row }">¥{{ row.sellingPrice }}</template>
        </el-table-column>
        <el-table-column prop="totalStock" label="库存" width="90" sortable="custom" align="right" />
        <el-table-column prop="soldCount" label="已售" width="90" sortable="custom" align="right" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status).type" effect="dark">
              {{ statusTag(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="auditTag(row.auditStatus).type" effect="light">
              {{ auditTag(row.auditStatus).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" sortable="custom" />
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Edit" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="warning" :icon="Checked" @click="openAuditDialog(row)">审核</el-button>
            <el-button
              link
              :type="row.status === 1 ? 'danger' : 'success'"
              :icon="row.status === 1 ? Bottom : Top"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? '下架' : '上架' }}
            </el-button>
            <el-button link type="primary" :icon="Setting" @click="openStockDialog(row)">库存分配</el-button>
            <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.pageNum"
          v-model:page-size="pagination.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>
    </div>

    <el-dialog
      v-model="formDialogVisible"
      :title="isEdit ? '编辑商品' : '新增商品'"
      width="640px"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="90px" status-icon>
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="商品名称" prop="name">
              <el-input v-model="formData.name" placeholder="请输入商品名称" maxlength="50" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品分类" prop="categoryId">
              <el-cascader
                v-model="formData.categoryId"
                :options="categoryOptions"
                :props="cascaderProps"
                placeholder="请选择分类"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="供应商" prop="supplierId">
              <el-select v-model="formData.supplierId" placeholder="请选择供应商" filterable style="width: 100%">
                <el-option v-for="s in supplierList" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="商品描述" prop="description">
              <el-input
                v-model="formData.description"
                type="textarea"
                :rows="3"
                placeholder="请输入商品描述"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="图片URL" prop="imageUrl">
              <el-input v-model="formData.imageUrl" placeholder="请输入图片URL">
                <template #append>
                  <el-image
                    v-if="formData.imageUrl"
                    :src="formData.imageUrl"
                    style="width: 28px; height: 28px; border-radius: 3px"
                    fit="cover"
                  />
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="进价" prop="purchasePrice">
              <el-input-number v-model="formData.purchasePrice" :min="0" :precision="2" :step="0.5" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="售价" prop="sellingPrice">
              <el-input-number v-model="formData.sellingPrice" :min="0" :precision="2" :step="0.5" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位" prop="unit">
              <el-input v-model="formData.unit" placeholder="如：斤/个/箱" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="总库存" prop="totalStock">
              <el-input-number v-model="formData.totalStock" :min="0" :step="10" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序" prop="sortOrder">
              <el-input-number v-model="formData.sortOrder" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="批量导入商品" width="520px">
      <el-alert
        title="请上传 CSV 或 JSON 格式的商品数据文件，单次最多 500 条"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-upload
        drag
        :auto-upload="false"
        accept=".csv,.json"
        :limit="1"
        :on-change="handleFileChange"
        :on-remove="() => (importFile = null)"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">支持 .csv / .json 格式</div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" :disabled="!importFile" @click="handleImport">
          开始导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="auditDialogVisible" title="商品审核" width="520px">
      <el-descriptions
        v-if="currentProduct"
        :column="2"
        border
        size="small"
        style="margin-bottom: 16px"
      >
        <el-descriptions-item label="商品名称" :span="2">{{ currentProduct.name }}</el-descriptions-item>
        <el-descriptions-item label="分类">{{ currentProduct.categoryName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ currentProduct.supplierName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="进价">¥{{ currentProduct.purchasePrice }}</el-descriptions-item>
        <el-descriptions-item label="售价">¥{{ currentProduct.sellingPrice }}</el-descriptions-item>
        <el-descriptions-item label="总库存" :span="2">
          {{ currentProduct.totalStock }} {{ currentProduct.unit }}
        </el-descriptions-item>
      </el-descriptions>
      <el-form ref="auditFormRef" :model="auditForm" :rules="auditRules" label-width="90px">
        <el-form-item label="审核结果" prop="auditStatus">
          <el-radio-group v-model="auditForm.auditStatus">
            <el-radio :label="1">审核通过</el-radio>
            <el-radio :label="2">审核驳回</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审核备注" prop="auditRemark">
          <el-input
            v-model="auditForm.auditRemark"
            type="textarea"
            :rows="3"
            placeholder="请输入审核意见"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="auditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAuditSubmit">提交审核</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="stockDialogVisible" title="库存分配（按小区）" width="820px" top="6vh">
      <div class="stock-dialog-header">
        <span v-if="currentProduct" class="product-name">
          {{ currentProduct.name }}（总库存：{{ currentProduct.totalStock }}）
        </span>
        <div>
          <el-button type="primary" :icon="MagicStick" :loading="recommending" @click="handleRecommend">
            智能推荐
          </el-button>
          <el-button type="success" :loading="submitting" @click="handleSaveStock">保存分配</el-button>
        </div>
      </div>
      <el-table :data="stockList" border stripe size="small" max-height="480">
        <el-table-column type="index" label="#" width="50" align="center" />
        <el-table-column prop="communityName" label="小区名称" min-width="140" show-overflow-tooltip />
        <el-table-column label="库存数量" width="170">
          <template #default="{ row }">
            <el-input-number v-model="row.stock" :min="0" :step="5" size="small" style="width: 140px" />
          </template>
        </el-table-column>
        <el-table-column label="销售价格" width="170">
          <template #default="{ row }">
            <el-input-number
              v-model="row.price"
              :min="0"
              :precision="2"
              :step="0.5"
              size="small"
              style="width: 140px"
            />
          </template>
        </el-table-column>
        <el-table-column label="已售" width="80" align="right">
          <template #default="{ row }">{{ row.soldCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="(row.stock || 0) > 0 ? 'success' : 'info'">
              {{ (row.stock || 0) > 0 ? '可售' : '缺货' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <div class="stock-summary">
        合计分配库存：{{ totalAllocatedStock }} / {{ currentProduct?.totalStock || 0 }}
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  Search,
  Refresh,
  Plus,
  Upload,
  Top,
  Bottom,
  Edit,
  Checked,
  Setting,
  Delete,
  UploadFilled,
  MagicStick
} from '@element-plus/icons-vue'
import { productApi, categoryApi, stockApi, supplierApi } from '@/api/product'
import { communityApi } from '@/api/community'
import type { Product, ProductCategory, Supplier, ProductCommunityStock, Community } from '@/types'

const statusOptions = [
  { value: 1, label: '上架' },
  { value: 2, label: '下架' },
  { value: 3, label: '售罄' },
  { value: 4, label: '预售' }
]
const auditStatusOptions = [
  { value: 0, label: '待审核' },
  { value: 1, label: '审核通过' },
  { value: 2, label: '审核驳回' }
]

const cascaderProps = { checkStrictly: true, value: 'id', label: 'name', emitPath: false }

type TagType = 'success' | 'info' | 'danger' | 'warning'

const statusTag = (status: number): { label: string; type: TagType } => {
  const map: Record<number, { label: string; type: TagType }> = {
    1: { label: '上架', type: 'success' },
    2: { label: '下架', type: 'info' },
    3: { label: '售罄', type: 'danger' },
    4: { label: '预售', type: 'warning' }
  }
  return map[status] || { label: '未知', type: 'info' }
}
const auditTag = (auditStatus: number): { label: string; type: TagType } => {
  const map: Record<number, { label: string; type: TagType }> = {
    0: { label: '待审核', type: 'warning' },
    1: { label: '审核通过', type: 'success' },
    2: { label: '审核驳回', type: 'danger' }
  }
  return map[auditStatus] || { label: '未知', type: 'info' }
}

const loading = ref(false)
const submitting = ref(false)
const importing = ref(false)
const recommending = ref(false)
const tableData = ref<Product[]>([])
const total = ref(0)
const selectedRows = ref<Product[]>([])

const pagination = reactive({ pageNum: 1, pageSize: 10 })
const sortParams = reactive({ sortField: '', sortOrder: '' })

const searchForm = reactive({
  name: '',
  categoryId: undefined as number | undefined,
  supplierId: undefined as number | undefined,
  status: undefined as number | undefined,
  auditStatus: undefined as number | undefined
})

const categoryOptions = ref<ProductCategory[]>([])
const supplierList = ref<Supplier[]>([])
const communityList = ref<Community[]>([])

const formDialogVisible = ref(false)
const formRef = ref<FormInstance>()
const isEdit = ref(false)

function createEmptyForm(): Product {
  return {
    name: '',
    categoryId: undefined,
    supplierId: undefined,
    description: '',
    imageUrl: '',
    purchasePrice: 0,
    sellingPrice: 0,
    unit: '斤',
    totalStock: 0,
    status: 2,
    auditStatus: 0,
    sortOrder: 0
  }
}
const formData = reactive<Product>(createEmptyForm())

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入商品名称', trigger: 'blur' },
    { max: 50, message: '不超过50个字符', trigger: 'blur' }
  ],
  categoryId: [{ required: true, message: '请选择商品分类', trigger: 'change' }],
  supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  purchasePrice: [{ required: true, message: '请输入进价', trigger: 'blur' }],
  sellingPrice: [
    { required: true, message: '请输入售价', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value < formData.purchasePrice) {
          callback(new Error('售价不能低于进价'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  unit: [{ required: true, message: '请输入单位', trigger: 'blur' }],
  totalStock: [{ required: true, message: '请输入总库存', trigger: 'blur' }]
}

const importDialogVisible = ref(false)
const importFile = ref<any>(null)

const handleFileChange = (file: any) => {
  importFile.value = file
}

const auditDialogVisible = ref(false)
const auditFormRef = ref<FormInstance>()
const currentProduct = ref<Product | null>(null)
const auditForm = reactive({ auditStatus: 1, auditRemark: '' })
const auditRules: FormRules = {
  auditStatus: [{ required: true, message: '请选择审核结果', trigger: 'change' }],
  auditRemark: [
    {
      validator: (_rule, _value, callback) => {
        if (auditForm.auditStatus === 2 && !auditForm.auditRemark) {
          callback(new Error('驳回时需填写审核备注'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const stockDialogVisible = ref(false)
const stockList = ref<ProductCommunityStock[]>([])
const totalAllocatedStock = computed(() =>
  stockList.value.reduce((sum, item) => sum + (item.stock || 0), 0)
)

const loadList = async () => {
  loading.value = true
  try {
    const params: any = {
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      name: searchForm.name || undefined,
      categoryId: searchForm.categoryId || undefined,
      supplierId: searchForm.supplierId || undefined,
      status: searchForm.status,
      auditStatus: searchForm.auditStatus
    }
    if (sortParams.sortField) {
      params.sortField = sortParams.sortField
      params.sortOrder = sortParams.sortOrder
    }
    const res: any = await productApi.getPage(params)
    tableData.value = res.data.records || []
    total.value = res.data.total || 0
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  loadList()
}
const handleReset = () => {
  searchForm.name = ''
  searchForm.categoryId = undefined
  searchForm.supplierId = undefined
  searchForm.status = undefined
  searchForm.auditStatus = undefined
  handleSearch()
}

const handleSelectionChange = (rows: Product[]) => {
  selectedRows.value = rows
}
const handleSortChange = ({ prop, order }: { prop: string; order: string | null }) => {
  sortParams.sortField = order ? prop : ''
  sortParams.sortOrder = order === 'ascending' ? 'asc' : order === 'descending' ? 'desc' : ''
  loadList()
}

const loadCategoryTree = async () => {
  try {
    const res: any = await categoryApi.getTree()
    categoryOptions.value = res.data || []
  } catch (e) {
    console.error(e)
  }
}
const loadSuppliers = async () => {
  try {
    const res: any = await supplierApi.getList()
    supplierList.value = res.data || []
  } catch (e) {
    console.error(e)
  }
}
const loadCommunities = async () => {
  try {
    const res: any = await communityApi.getList()
    communityList.value = res.data || []
  } catch (e) {
    console.error(e)
  }
}

const resetForm = () => {
  Object.assign(formData, createEmptyForm())
  formRef.value?.clearValidate()
}

const openAddDialog = () => {
  isEdit.value = false
  resetForm()
  formDialogVisible.value = true
}
const openEditDialog = (row: Product) => {
  isEdit.value = true
  Object.assign(formData, createEmptyForm(), JSON.parse(JSON.stringify(row)))
  formDialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      if (isEdit.value) {
        await productApi.update(formData)
        ElMessage.success('更新成功')
      } else {
        await productApi.add(formData)
        ElMessage.success('新增成功')
      }
      formDialogVisible.value = false
      loadList()
    } catch (e) {
      console.error(e)
    } finally {
      submitting.value = false
    }
  })
}

const handleDelete = (row: Product) => {
  ElMessageBox.confirm(`确认删除商品「${row.name}」吗？`, '删除确认', { type: 'warning' })
    .then(async () => {
      try {
        await productApi.delete(row.id as number)
        ElMessage.success('删除成功')
        loadList()
      } catch (e) {
        console.error(e)
      }
    })
    .catch(() => {})
}

const handleToggleStatus = (row: Product) => {
  const next = row.status === 1 ? 2 : 1
  const action = next === 1 ? '上架' : '下架'
  ElMessageBox.confirm(`确认${action}商品「${row.name}」吗？`, `${action}确认`, { type: 'warning' })
    .then(async () => {
      try {
        await productApi.updateStatus(row.id as number, next)
        ElMessage.success(`${action}成功`)
        loadList()
      } catch (e) {
        console.error(e)
      }
    })
    .catch(() => {})
}

const handleBatchStatus = (status: number) => {
  if (!selectedRows.value.length) {
    ElMessage.warning('请先选择商品')
    return
  }
  const action = status === 1 ? '上架' : '下架'
  ElMessageBox.confirm(
    `确认批量${action}选中的 ${selectedRows.value.length} 个商品吗？`,
    `${action}确认`,
    { type: 'warning' }
  )
    .then(async () => {
      try {
        await Promise.all(
          selectedRows.value.map((item) => productApi.updateStatus(item.id as number, status))
        )
        ElMessage.success(`批量${action}成功`)
        loadList()
      } catch (e) {
        console.error(e)
      }
    })
    .catch(() => {})
}

const handleImport = async () => {
  if (!importFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  importing.value = true
  try {
    const file = importFile.value.raw as File
    const text = await file.text()
    let products: Product[] = []
    if (file.name.endsWith('.json')) {
      products = JSON.parse(text)
    } else if (file.name.endsWith('.csv')) {
      products = parseCsv(text)
    } else {
      ElMessage.error('不支持的文件格式')
      return
    }
    if (!products.length) {
      ElMessage.warning('文件中无有效数据')
      return
    }
    await productApi.batchAdd(products)
    ElMessage.success(`成功导入 ${products.length} 条商品`)
    importDialogVisible.value = false
    importFile.value = null
    loadList()
  } catch (e) {
    console.error(e)
  } finally {
    importing.value = false
  }
}

const parseCsv = (text: string): Product[] => {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = cols[i]
    })
    return {
      name: obj.name,
      categoryId: obj.categoryId ? Number(obj.categoryId) : undefined,
      supplierId: obj.supplierId ? Number(obj.supplierId) : undefined,
      description: obj.description || '',
      imageUrl: obj.imageUrl || '',
      purchasePrice: Number(obj.purchasePrice) || 0,
      sellingPrice: Number(obj.sellingPrice) || 0,
      unit: obj.unit || '斤',
      totalStock: Number(obj.totalStock) || 0,
      status: 2,
      auditStatus: 0
    } as Product
  })
}

const openAuditDialog = (row: Product) => {
  currentProduct.value = row
  auditForm.auditStatus = 1
  auditForm.auditRemark = ''
  auditDialogVisible.value = true
}
const handleAuditSubmit = async () => {
  if (!auditFormRef.value) return
  await auditFormRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      await productApi.audit(currentProduct.value!.id as number, {
        auditStatus: auditForm.auditStatus,
        auditRemark: auditForm.auditRemark
      })
      ElMessage.success('审核提交成功')
      auditDialogVisible.value = false
      loadList()
    } catch (e) {
      console.error(e)
    } finally {
      submitting.value = false
    }
  })
}

const openStockDialog = async (row: Product) => {
  currentProduct.value = row
  stockDialogVisible.value = true
  if (!communityList.value.length) {
    await loadCommunities()
  }
  try {
    const res: any = await stockApi.getByProduct(row.id as number)
    const existList: ProductCommunityStock[] = res.data || []
    stockList.value = communityList.value.map((c) => {
      const exist = existList.find((s) => s.communityId === c.id)
      return {
        productId: row.id as number,
        communityId: c.id as number,
        communityName: c.name,
        stock: exist?.stock || 0,
        soldCount: exist?.soldCount || 0,
        price: exist?.price ?? row.sellingPrice
      }
    })
  } catch (e) {
    console.error(e)
  }
}

const handleRecommend = async () => {
  if (!currentProduct.value) return
  recommending.value = true
  try {
    const res: any = await stockApi.recommend(currentProduct.value.id as number)
    const recommendList: ProductCommunityStock[] = res.data || []
    const map = new Map(recommendList.map((r) => [r.communityId, r]))
    stockList.value.forEach((item) => {
      const r = map.get(item.communityId)
      if (r) {
        item.stock = r.stock
        item.price = r.price ?? item.price
      }
    })
    ElMessage.success('智能推荐已应用')
  } catch (e) {
    console.error(e)
  } finally {
    recommending.value = false
  }
}

const handleSaveStock = async () => {
  submitting.value = true
  try {
    await stockApi.batchAllocate(stockList.value)
    ElMessage.success('库存分配保存成功')
    stockDialogVisible.value = false
    loadList()
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadCategoryTree()
  loadSuppliers()
  loadCommunities()
  loadList()
})
</script>

<style scoped>
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.img-error {
  width: 50px;
  height: 50px;
  line-height: 50px;
  text-align: center;
  background: #f5f7fa;
  color: #c0c4cc;
  font-size: 12px;
  border-radius: 4px;
}

.stock-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.stock-dialog-header .product-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.stock-summary {
  margin-top: 12px;
  text-align: right;
  font-size: 13px;
  color: var(--text-secondary);
}

:deep(.el-table .hover-row:hover > td) {
  background-color: var(--el-color-primary-light-9) !important;
}
</style>
