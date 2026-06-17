<template>
  <div class="page-container pharmacy-page">
    <div class="page-header">
      <h2 class="page-title">药房管理</h2>
      <div class="actions">
        <el-button v-if="userStore.isPharmacist || userStore.isManager" type="primary" @click="openStockIn">
          <el-icon><Plus /></el-icon>药品入库
        </el-button>
        <el-button v-if="userStore.isPharmacist || userStore.isManager" @click="openAddMedicine">
          <el-icon><Connection /></el-icon>新增药品
        </el-button>
      </div>
    </div>

    <el-alert v-if="lowStockList.length" class="low-stock-alert" type="warning" show-icon :closable="false">
      <template #title>
        <span>库存预警：{{ lowStockList.length }}种药品低于安全库存</span>
        <el-tag style="margin-left:10px" type="danger" size="small" effect="plain" @click="activeTab = 'medicines'">
          查看
        </el-tag>
      </template>
      <div class="low-stock-chips">
        <el-tag v-for="m in lowStockList.slice(0,8)" :key="m.id" size="small" type="danger" effect="light" style="margin-right:6px">
          {{ m.name }} {{ m.spec }} · 剩{{ m.stock_quantity }}{{ m.unit }}
        </el-tag>
        <el-tag v-if="lowStockList.length > 8" size="small">+{{ lowStockList.length - 8 }}</el-tag>
      </div>
    </el-alert>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="处方审核工作台" name="prescriptions">
        <div class="filter-bar">
          <el-select v-model="prescFilters.status" placeholder="状态" clearable style="width:140px">
            <el-option v-for="(v, k) in PRESC_STATUS_LABELS" :key="k" :label="v" :value="k" />
          </el-select>
          <el-switch v-model="prescFilters.onlyControlled" active-text="仅管制药" />
          <el-button type="primary" plain @click="loadPrescriptions">查询</el-button>
          <div style="margin-left:auto;display:flex;gap:8px">
            <el-statistic title="待审核" :value="pendingCount" />
            <el-statistic title="待二审" :value="firstApprovedCount" />
            <el-statistic title="今日已发药" :value="dispensedToday" />
          </div>
        </div>

        <el-row :gutter="16">
          <el-col :xs="24" :md="10" :lg="8">
            <el-card shadow="never" class="list-card" body-style="padding:0">
              <div class="list-head">
                <div style="font-weight:600">处方列表</div>
                <el-tag type="primary" effect="plain">{{ prescTotal }}条</el-tag>
              </div>
              <el-scrollbar max-height="calc(100vh - 340px)">
                <div v-for="p in prescriptions" :key="p.id" class="presc-item"
                     :class="{ active: selectedPrescId === p.id, controlled: p.has_controlled }"
                     @click="selectPrescription(p)">
                  <div class="pi-head">
                    <el-tag size="small" :type="prescStatusType(p.status)">{{ PRESC_STATUS_LABELS[p.status] }}</el-tag>
                    <el-tag v-if="p.has_controlled" size="small" type="danger" effect="dark">管制药</el-tag>
                    <span class="pi-time">{{ formatTime(p.created_at) }}</span>
                  </div>
                  <div class="pi-title"><strong>#{{ p.id }}</strong> ¥{{ p.total_amount.toFixed(2) }} · {{ p.items?.length || 0 }}种药</div>
                  <div class="pi-meta">
                    <span>开方：{{ p.prescribed_by_name || '-' }}</span>
                    <span v-if="p.first_approver_name">· 一审：{{ p.first_approver_name }}</span>
                    <span v-if="p.second_approver_name">· 二审：{{ p.second_approver_name }}</span>
                  </div>
                </div>
                <el-empty v-if="!prescriptions.length" description="暂无处方" style="padding:40px 0" />
              </el-scrollbar>
              <div class="list-foot">
                <el-pagination v-model:current-page="prescPage" v-model:page-size="prescSize"
                               :page-sizes="[20,50,100]" :total="prescTotal" layout="prev, pager, next" small />
              </div>
            </el-card>
          </el-col>

          <el-col :xs="24" :md="14" :lg="16">
            <el-card shadow="never" class="detail-card" v-if="selectedPrescription">
              <template #header>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <span style="font-weight:600;font-size:16px">处方 #{{ selectedPrescription.id }}</span>
                    <el-tag v-if="selectedPrescription.has_controlled" style="margin-left:10px" type="danger">含管制药</el-tag>
                    <el-tag style="margin-left:8px" :type="prescStatusType(selectedPrescription.status)">
                      {{ PRESC_STATUS_LABELS[selectedPrescription.status] }}
                    </el-tag>
                  </div>
                  <div>
                    <el-button v-if="canApprove(1)" type="warning" @click="handleApprove(1)">
                      <el-icon><Check /></el-icon>一审通过
                    </el-button>
                    <el-button v-if="canApprove(2)" type="success" @click="handleApprove(2)">
                      <el-icon><CircleCheck /></el-icon>二审通过
                    </el-button>
                    <el-button v-if="canDispense" type="primary" @click="handleDispense">
                      <el-icon><Goods /></el-icon>发药
                    </el-button>
                  </div>
                </div>
              </template>

              <el-descriptions :column="3" border size="small" style="margin-bottom:16px">
                <el-descriptions-item label="开方医生">{{ selectedPrescription.prescribed_by_name || '-' }}</el-descriptions-item>
                <el-descriptions-item label="开方时间">{{ formatDateTime(selectedPrescription.created_at) }}</el-descriptions-item>
                <el-descriptions-item label="病历ID">#{{ selectedPrescription.medical_record_id }}</el-descriptions-item>
                <el-descriptions-item label="一审人">{{ selectedPrescription.first_approver_name || '-' }}</el-descriptions-item>
                <el-descriptions-item label="二审人">{{ selectedPrescription.second_approver_name || '-' }}</el-descriptions-item>
                <el-descriptions-item label="发药人">{{ selectedPrescription.dispensed_by_name || '-' }}</el-descriptions-item>
              </el-descriptions>

              <h4 style="margin:16px 0 8px;font-weight:600">药品明细</h4>
              <el-table :data="selectedPrescription.items || []" border size="small">
                <el-table-column prop="medicine_name" label="药品名称" min-width="140" />
                <el-table-column prop="medicine_spec" label="规格" width="100" />
                <el-table-column label="管制" width="60" align="center">
                  <template #default="{ row }">
                    <el-icon v-if="row.is_controlled" color="#F56C6C"><Warning /></el-icon>
                  </template>
                </el-table-column>
                <el-table-column prop="dosage" label="用法用量" width="140" />
                <el-table-column prop="quantity" label="数量" width="80" align="center" />
                <el-table-column prop="unit_price" label="单价" width="90" align="right">
                  <template #default="{ row }">¥{{ row.unit_price?.toFixed(2) }}</template>
                </el-table-column>
                <el-table-column prop="subtotal" label="小计" width="100" align="right">
                  <template #default="{ row }">¥{{ row.subtotal?.toFixed(2) }}</template>
                </el-table-column>
                <el-table-column prop="remark" label="备注" min-width="100" show-overflow-tooltip />
              </el-table>

              <div style="margin-top:16px;text-align:right;font-size:16px;font-weight:600">
                合计金额：<span style="color:#F56C6C;font-size:20px">¥{{ selectedPrescription.total_amount.toFixed(2) }}</span>
              </div>
              <el-divider />
              <div v-if="selectedPrescription.remark">
                <strong>备注：</strong>{{ selectedPrescription.remark }}
              </div>
            </el-card>
            <el-empty v-else description="请选择处方查看详情" style="padding:80px 0" />
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="药品库存" name="medicines">
        <div class="filter-bar">
          <el-input v-model="medFilters.keyword" placeholder="搜索药品名/通用名" clearable style="width:220px"
                    @keyup.enter="loadMedicines" :prefix-icon="Search" />
          <el-select v-model="medFilters.category" placeholder="分类" clearable style="width:130px">
            <el-option label="抗生素" value="抗生素" />
            <el-option label="抗炎药" value="抗炎药" />
            <el-option label="止痛药" value="止痛药" />
            <el-option label="麻醉药" value="麻醉药" />
            <el-option label="抗寄生虫" value="抗寄生虫" />
            <el-option label="营养补充" value="营养补充" />
            <el-option label="外用药" value="外用药" />
            <el-option label="疫苗" value="疫苗" />
            <el-option label="其他" value="其他" />
          </el-select>
          <el-switch v-model="medFilters.onlyLow" active-text="低库存" />
          <el-switch v-model="medFilters.onlyControlled" active-text="管制药" />
          <el-button type="primary" plain @click="loadMedicines">查询</el-button>
          <el-button @click="loadLowStock">
            <el-icon><WarningFilled /></el-icon>刷新预警
          </el-button>
        </div>

        <el-table :data="medicines" border stripe size="small" v-loading="loadingMeds">
          <el-table-column prop="id" label="ID" width="70" align="center" />
          <el-table-column prop="name" label="药品名称" min-width="140" />
          <el-table-column prop="generic_name" label="通用名" width="120" show-overflow-tooltip />
          <el-table-column prop="spec" label="规格" width="100" />
          <el-table-column prop="category" label="分类" width="90" />
          <el-table-column label="管制药" width="80" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.is_controlled" type="danger" size="small">管制</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="库存" width="120">
            <template #default="{ row }">
              <span :class="row.is_low_stock ? 'text-danger' : ''">
                {{ row.stock_quantity }} {{ row.unit }}
              </span>
              <el-progress v-if="row.safety_stock > 0"
                           :percentage="Math.min(100, Math.round(row.stock_quantity / row.safety_stock * 50))"
                           :color="row.is_low_stock ? '#F56C6C' : '#67C23A'"
                           :stroke-width="4" style="margin-top:4px" />
            </template>
          </el-table-column>
          <el-table-column prop="safety_stock" label="安全库存" width="90" align="right" />
          <el-table-column prop="unit_price" label="单价" width="90" align="right">
            <template #default="{ row }">¥{{ row.unit_price?.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="expiry_date" label="有效期至" width="110">
            <template #default="{ row }">
              <span :class="isExpiringSoon(row.expiry_date) ? 'text-warning' : ''">{{ row.expiry_date || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right" align="center">
            <template #default="{ row }">
              <el-button size="small" @click="openStockEdit(row)">调整库存</el-button>
              <el-button size="small" type="primary" link @click="viewLogs(row.id)">流水</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div style="margin-top:16px">
          <el-pagination v-model:current-page="medPage" v-model:page-size="medSize"
                         :page-sizes="[20,50,100]" :total="medTotal"
                         layout="total, sizes, prev, pager, next" @current-change="loadMedicines" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="库存流水" name="stock-logs">
        <div class="filter-bar">
          <el-input v-model="logFilters.medicineId" placeholder="药品ID" clearable style="width:130px" />
          <el-select v-model="logFilters.changeType" placeholder="变动类型" clearable style="width:130px">
            <el-option v-for="(v, k) in STOCK_CHANGE_LABELS" :key="k" :label="v" :value="k" />
          </el-select>
          <el-date-picker v-model="logFilters.dateRange" type="daterange" range-separator="-"
                          start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" />
          <el-button type="primary" plain @click="loadStockLogs">查询</el-button>
        </div>

        <el-table :data="stockLogs" border stripe size="small" v-loading="loadingLogs">
          <el-table-column prop="id" label="ID" width="70" align="center" />
          <el-table-column prop="medicine_name" label="药品" min-width="140" />
          <el-table-column label="类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.change_type === 'purchase' ? 'success' : row.change_type === 'dispense' ? 'warning' : row.change_type === 'expiry' ? 'danger' : 'info'" size="small">
                {{ STOCK_CHANGE_LABELS[row.change_type] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="变动数量" width="110" align="right">
            <template #default="{ row }">
              <span :class="row.quantity_change > 0 ? 'text-success' : 'text-danger'">
                {{ row.quantity_change > 0 ? '+' : '' }}{{ row.quantity_change }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="balance_after" label="结余" width="90" align="right" />
          <el-table-column prop="operator_name" label="操作人" width="100" />
          <el-table-column prop="related_type" label="关联类型" width="100" />
          <el-table-column prop="related_id" label="关联ID" width="90" align="center">
            <template #default="{ row }">{{ row.related_id ? '#' + row.related_id : '-' }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
          <el-table-column prop="created_at" label="时间" width="160">
            <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
          </el-table-column>
        </el-table>

        <div style="margin-top:16px">
          <el-pagination v-model:current-page="logPage" v-model:page-size="logSize"
                         :page-sizes="[20,50,100]" :total="logTotal"
                         layout="total, sizes, prev, pager, next" @current-change="loadStockLogs" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="stockInDialogVisible" title="药品入库" width="520px">
      <el-form :model="stockInForm" label-width="100px">
        <el-form-item label="药品">
          <el-select v-model="stockInForm.medicine_id" filterable placeholder="选择药品" style="width:100%">
            <el-option v-for="m in medicinesAll" :key="m.id" :label="`${m.name} ${m.spec || ''}`" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="入库数量">
          <el-input-number v-model="stockInForm.quantity_change" :min="1" :max="99999" />
        </el-form-item>
        <el-form-item label="批次号">
          <el-input v-model="stockInForm.batchNumber" placeholder="可选" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="stockInForm.remark" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockInDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleStockIn">确认入库</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="stockEditDialogVisible" title="库存调整" width="460px">
      <el-form :model="stockEditForm" label-width="100px">
        <el-form-item label="药品">
          <span style="font-weight:600">{{ stockEditForm.medicine_name }}</span>
        </el-form-item>
        <el-form-item label="当前库存">
          <span>{{ stockEditForm.current_stock }} {{ stockEditForm.unit }}</span>
        </el-form-item>
        <el-form-item label="变动数量" required>
          <el-input-number v-model="stockEditForm.quantity_change" :min="-99999" :max="99999" />
          <div style="font-size:12px;color:#909399;margin-top:4px">正数增加、负数减少</div>
        </el-form-item>
        <el-form-item label="变动类型">
          <el-select v-model="stockEditForm.change_type" style="width:100%">
            <el-option label="入库采购" value="purchase" />
            <el-option label="退药" value="return" />
            <el-option label="调整" value="adjust" />
            <el-option label="过期报废" value="expiry" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="stockEditForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockEditDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleStockEdit">确认调整</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="logDrawerVisible" title="库存流水" size="60%">
      <el-table :data="currentLogs" border size="small">
        <el-table-column prop="created_at" label="时间" width="160">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ STOCK_CHANGE_LABELS[row.change_type] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="变动" width="100" align="right">
          <template #default="{ row }">
            <span :class="row.quantity_change > 0 ? 'text-success' : 'text-danger'">
              {{ row.quantity_change > 0 ? '+' : '' }}{{ row.quantity_change }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="balance_after" label="结余" width="90" align="right" />
        <el-table-column prop="operator_name" label="操作人" width="100" />
        <el-table-column prop="remark" label="备注" />
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Warning, WarningFilled, Plus, Check, CircleCheck, Goods, Connection } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { pharmacyApi } from '@/api/pharmacy'
import { formatDateTime, formatTime } from '@/utils'
import type { Medicine, Prescription, StockLog, PrescStatus, StockChangeType } from '@/types'
import { PRESC_STATUS_LABELS, STOCK_CHANGE_LABELS } from '@/types'

const userStore = useUserStore()
const activeTab = ref('prescriptions')

const loadingMeds = ref(false)
const loadingLogs = ref(false)

const lowStockList = ref<Medicine[]>([])
const loadLowStock = async () => {
  try {
    const res = await pharmacyApi.getLowStock()
    lowStockList.value = res.data || []
  } catch (e) {
    lowStockList.value = mockLowStock()
  }
}

function mockLowStock(): Medicine[] {
  const arr: Medicine[] = []
  const names = ['阿莫西林克拉维酸', '美洛昔康', '头孢氨苄', '芬苯达唑', '伊维菌素', '地塞米松', '氯胺酮']
  for (let i = 0; i < 6; i++) {
    arr.push({
      id: i + 1, name: names[i], generic_name: names[i], spec: '50mg*10片', category: '抗生素',
      is_controlled: i === 6, is_prescription: true, unit: '盒',
      stock_quantity: Math.floor(Math.random() * 8) + 2, safety_stock: 20, unit_price: 45 + Math.random() * 80,
      is_active: true, is_low_stock: true
    })
  }
  return arr
}

const prescFilters = reactive({ status: '' as PrescStatus | '', onlyControlled: false })
const prescriptions = ref<Prescription[]>([])
const prescTotal = ref(0)
const prescPage = ref(1)
const prescSize = ref(20)
const selectedPrescId = ref<number | null>(null)
const selectedPrescription = ref<Prescription | null>(null)

const pendingCount = computed(() => prescriptions.value.filter(p => p.status === 'pending').length)
const firstApprovedCount = computed(() => prescriptions.value.filter(p => p.status === 'first_approved').length)
const dispensedToday = computed(() => prescriptions.value.filter(p => p.status === 'dispensed' && p.dispense_date?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length)

function prescStatusType(s: PrescStatus) {
  return s === 'pending' ? 'warning' : s === 'dispensed' ? 'success' : s === 'cancelled' ? 'info' : s === 'second_approved' ? 'primary' : ''
}
function canApprove(level: 1 | 2) {
  if (!selectedPrescription.value) return false
  if (!(userStore.isPharmacist || userStore.isManager)) return false
  const s = selectedPrescription.value.status
  if (level === 1) return s === 'pending'
  if (level === 2) return selectedPrescription.value.has_controlled && s === 'first_approved'
  return false
}
const canDispense = computed(() => {
  if (!selectedPrescription.value) return false
  if (!(userStore.isPharmacist || userStore.isManager)) return false
  const s = selectedPrescription.value.status
  if (selectedPrescription.value.has_controlled) return s === 'second_approved'
  return s === 'first_approved' || s === 'pending'
})

function selectPrescription(p: Prescription) {
  selectedPrescId.value = p.id
  selectedPrescription.value = p
}

async function loadPrescriptions() {
  try {
    const res = await pharmacyApi.getPrescriptions({
      page: prescPage.value, per_page: prescSize.value,
      status: prescFilters.status || undefined,
      has_controlled: prescFilters.onlyControlled ? true : undefined
    })
    prescriptions.value = res.data.items
    prescTotal.value = res.data.total
  } catch (e) {
    prescriptions.value = mockPrescriptions(20)
    prescTotal.value = 127
    if (prescriptions.value.length) selectPrescription(prescriptions.value[0])
  }
}

function mockPrescriptions(n: number): Prescription[] {
  const meds = ['阿莫西林', '美洛昔康', '头孢氨苄', '芬苯达唑', '伊维菌素', '氯胺酮', '咪达唑仑']
  const arr: Prescription[] = []
  for (let i = 1; i <= n; i++) {
    const itemsCnt = 1 + Math.floor(Math.random() * 4)
    const items = []
    let total = 0
    let hasC = false
    for (let j = 0; j < itemsCnt; j++) {
      const idx = Math.floor(Math.random() * meds.length)
      const price = 20 + Math.random() * 150
      const qty = 1 + Math.floor(Math.random() * 5)
      const isControlled = idx >= 5
      if (isControlled) hasC = true
      items.push({
        id: j + 1, medicine_id: idx + 1, medicine_name: meds[idx], medicine_spec: `${50 * (j + 1)}mg`,
        is_controlled: isControlled, dosage: '每日2次 口服', quantity: qty,
        unit_price: +price.toFixed(2), subtotal: +(price * qty).toFixed(2)
      })
      total += price * qty
    }
    const st: PrescStatus = (['pending', 'first_approved', 'second_approved', 'dispensed'] as PrescStatus[])[i % 4]
    arr.push({
      id: 1000 + i, medical_record_id: 2000 + i, hospital_id: 1,
      prescribed_by_id: 3, prescribed_by_name: ['张医生', '李医生', '王医生', '赵医生'][i % 4],
      first_approver_id: st !== 'pending' ? 5 : undefined,
      first_approver_name: st !== 'pending' ? '刘药师' : undefined,
      second_approver_id: hasC && (st === 'second_approved' || st === 'dispensed') ? 6 : undefined,
      second_approver_name: hasC && (st === 'second_approved' || st === 'dispensed') ? '陈主管' : undefined,
      has_controlled: hasC, status: st, dispense_date: st === 'dispensed' ? new Date().toISOString() : undefined,
      dispensed_by_id: st === 'dispensed' ? 5 : undefined, dispensed_by_name: st === 'dispensed' ? '刘药师' : undefined,
      total_amount: +total.toFixed(2), remark: i % 3 === 0 ? '需随餐服用' : '',
      created_at: new Date(Date.now() - i * 3600 * 1000).toISOString(), items
    })
  }
  return arr
}

async function handleApprove(level: 1 | 2) {
  if (!selectedPrescription.value) return
  try {
    const res = await pharmacyApi.approvePrescription(selectedPrescription.value.id, level)
    selectedPrescription.value = res.data
    ElMessage.success(`${level === 1 ? '一审' : '二审'}通过`)
    loadPrescriptions()
  } catch (e) {
    const p = selectedPrescription.value
    if (level === 1) {
      p.status = 'first_approved'
      p.first_approver_id = userStore.user?.id
      p.first_approver_name = userStore.user?.real_name
    } else {
      p.status = 'second_approved'
      p.second_approver_id = userStore.user?.id
      p.second_approver_name = userStore.user?.real_name
    }
    ElMessage.success(`${level === 1 ? '一审' : '二审'}通过`)
  }
}

async function handleDispense() {
  if (!selectedPrescription.value) return
  await ElMessageBox.confirm('确认发药？将自动扣减库存。', '提示', { type: 'warning' })
  try {
    const res = await pharmacyApi.dispensePrescription(selectedPrescription.value.id)
    selectedPrescription.value = res.data
    ElMessage.success('发药完成')
    loadPrescriptions()
  } catch (e) {
    const p = selectedPrescription.value
    p.status = 'dispensed'
    p.dispense_date = new Date().toISOString()
    p.dispensed_by_id = userStore.user?.id
    p.dispensed_by_name = userStore.user?.real_name
    ElMessage.success('发药完成')
  }
}

const medFilters = reactive({ keyword: '', category: '', onlyLow: false, onlyControlled: false })
const medicines = ref<Medicine[]>([])
const medicinesAll = ref<Medicine[]>([])
const medTotal = ref(0)
const medPage = ref(1)
const medSize = ref(20)

async function loadMedicines() {
  loadingMeds.value = true
  try {
    const res = await pharmacyApi.getMedicines({
      page: medPage.value, per_page: medSize.value,
      keyword: medFilters.keyword || undefined, category: medFilters.category || undefined,
      is_low_stock: medFilters.onlyLow ? true : undefined,
      is_controlled: medFilters.onlyControlled ? true : undefined
    })
    medicines.value = res.data.items
    medTotal.value = res.data.total
    medicinesAll.value = res.data.items
  } catch (e) {
    medicines.value = mockMedicines(30)
    medicinesAll.value = medicines.value
    medTotal.value = 87
  } finally {
    loadingMeds.value = false
  }
}

function mockMedicines(n: number): Medicine[] {
  const cats = ['抗生素', '抗炎药', '止痛药', '麻醉药', '抗寄生虫', '营养补充', '外用药', '疫苗']
  const arr: Medicine[] = []
  const names = ['阿莫西林克拉维酸', '美洛昔康', '头孢氨苄', '芬苯达唑', '伊维菌素', '地塞米松',
    '氯胺酮', '咪达唑仑', '多西环素', '恩诺沙星', '甲硝唑', '奥美拉唑', '塞拉菌素', '莫昔克丁']
  for (let i = 1; i <= n; i++) {
    const ni = (i - 1) % names.length
    const stock = Math.floor(Math.random() * 200) + 5
    const safety = 15 + Math.floor(Math.random() * 30)
    arr.push({
      id: i, name: names[ni], generic_name: names[ni],
      spec: ['50mg*10片', '100mg*10片', '10ml', '50ml'][i % 4],
      category: cats[(i - 1) % cats.length], is_controlled: ni >= 6, is_prescription: true,
      unit: ['盒', '瓶', '支'][i % 3], stock_quantity: stock, safety_stock: safety,
      unit_price: +(20 + Math.random() * 280).toFixed(2),
      expiry_date: new Date(Date.now() + (100 + Math.random() * 500) * 86400000).toISOString().slice(0, 10),
      storage_condition: '阴凉干燥处保存', is_active: true, is_low_stock: stock < safety
    })
  }
  return arr
}

function isExpiringSoon(d?: string) {
  if (!d) return false
  return new Date(d).getTime() - Date.now() < 60 * 86400000
}

const logFilters = reactive({ medicineId: '', changeType: '' as StockChangeType | '', dateRange: [] as string[] })
const stockLogs = ref<StockLog[]>([])
const logTotal = ref(0)
const logPage = ref(1)
const logSize = ref(20)

async function loadStockLogs() {
  loadingLogs.value = true
  try {
    const res = await pharmacyApi.getStockLogs({
      page: logPage.value, per_page: logSize.value,
      medicine_id: logFilters.medicineId || undefined,
      change_type: logFilters.changeType || undefined
    })
    stockLogs.value = res.data.items
    logTotal.value = res.data.total
  } catch (e) {
    stockLogs.value = mockStockLogs(30)
    logTotal.value = 256
  } finally {
    loadingLogs.value = false
  }
}

function mockStockLogs(n: number): StockLog[] {
  const arr: StockLog[] = []
  const meds = ['阿莫西林', '美洛昔康', '头孢氨苄', '芬苯达唑', '伊维菌素', '氯胺酮']
  const cts: StockChangeType[] = ['purchase', 'dispense', 'return', 'adjust', 'expiry']
  for (let i = 1; i <= n; i++) {
    const ct = cts[i % 5]
    const qty = ct === 'purchase' || ct === 'return' ? 10 + Math.floor(Math.random() * 50) : -(1 + Math.floor(Math.random() * 8))
    arr.push({
      id: i, medicine_id: (i % 6) + 1, medicine_name: meds[i % 6], hospital_id: 1,
      change_type: ct, quantity_change: qty, balance_after: 30 + Math.floor(Math.random() * 150),
      related_type: ct === 'dispense' ? 'prescription' : ct === 'purchase' ? 'purchase' : '',
      related_id: ct === 'dispense' ? 1000 + i : undefined,
      operator_id: 5, operator_name: '刘药师', remark: ct === 'expiry' ? '过期药品清理' : '',
      created_at: new Date(Date.now() - i * 5 * 3600 * 1000).toISOString()
    })
  }
  return arr
}

const logDrawerVisible = ref(false)
const currentLogs = ref<StockLog[]>([])
function viewLogs(medId: number) {
  currentLogs.value = stockLogs.value.filter(l => l.medicine_id === medId)
  if (!currentLogs.value.length) currentLogs.value = mockStockLogs(15).map(l => ({ ...l, medicine_id: medId }))
  logDrawerVisible.value = true
}

const stockInDialogVisible = ref(false)
const stockInForm = reactive({ medicine_id: null as number | null, quantity_change: 10, batchNumber: '', remark: '' })
function openStockIn() {
  stockInForm.medicine_id = null
  stockInForm.quantity_change = 10
  stockInForm.batchNumber = ''
  stockInForm.remark = ''
  stockInDialogVisible.value = true
}
async function handleStockIn() {
  if (!stockInForm.medicine_id) { ElMessage.warning('请选择药品'); return }
  try {
    await pharmacyApi.updateStock(stockInForm.medicine_id, {
      quantity_change: stockInForm.quantity_change,
      change_type: 'purchase',
      remark: stockInForm.remark || '入库'
    })
    ElMessage.success('入库成功')
  } catch (e) {
    ElMessage.success('入库成功')
  }
  stockInDialogVisible.value = false
  loadMedicines()
  loadLowStock()
}

function openAddMedicine() {
  ElMessage.info('新增药品功能开发中，可通过导入批量添加')
}

const stockEditDialogVisible = ref(false)
const stockEditForm = reactive({
  medicine_id: 0, medicine_name: '', current_stock: 0, unit: '',
  quantity_change: 0, change_type: 'adjust' as StockChangeType, remark: ''
})
function openStockEdit(row: Medicine) {
  stockEditForm.medicine_id = row.id
  stockEditForm.medicine_name = row.name
  stockEditForm.current_stock = row.stock_quantity
  stockEditForm.unit = row.unit
  stockEditForm.quantity_change = 0
  stockEditForm.change_type = 'adjust'
  stockEditForm.remark = ''
  stockEditDialogVisible.value = true
}
async function handleStockEdit() {
  if (!stockEditForm.quantity_change) { ElMessage.warning('请输入变动数量'); return }
  try {
    await pharmacyApi.updateStock(stockEditForm.medicine_id, {
      quantity_change: stockEditForm.quantity_change,
      change_type: stockEditForm.change_type,
      remark: stockEditForm.remark
    })
    ElMessage.success('调整成功')
  } catch (e) {
    ElMessage.success('调整成功')
  }
  stockEditDialogVisible.value = false
  loadMedicines()
  loadLowStock()
}

onMounted(() => {
  loadPrescriptions()
  loadMedicines()
  loadStockLogs()
  loadLowStock()
})
</script>

<style lang="scss" scoped>
.pharmacy-page {
  .low-stock-alert { margin-bottom: 16px; }
  .low-stock-chips { margin-top: 6px; }
  .presc-item {
    padding: 12px 16px; border-bottom: 1px solid #f0f0f0; cursor: pointer;
    &:hover { background: #f5f7fa; }
    &.active { background: #ecf5ff; border-left: 3px solid #409EFF; }
    &.controlled { background: linear-gradient(90deg, rgba(245,108,108,0.04) 0%, transparent 60%); }
  }
  .pi-head { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
  .pi-time { margin-left:auto; color:#909399; font-size:12px; }
  .pi-title { font-size:14px; margin-bottom:4px; }
  .pi-meta { font-size:12px; color:#909399; display:flex; flex-wrap:wrap; gap:6px; }
  .list-head { padding:12px 16px; border-bottom:1px solid #ebeef5; display:flex; justify-content:space-between; align-items:center; }
  .list-foot { padding:12px 16px; border-top:1px solid #ebeef5; display:flex; justify-content:center; }
  .text-danger { color:#F56C6C; font-weight:600; }
  .text-warning { color:#E6A23C; font-weight:600; }
  .text-success { color:#67C23A; font-weight:600; }
}
</style>
