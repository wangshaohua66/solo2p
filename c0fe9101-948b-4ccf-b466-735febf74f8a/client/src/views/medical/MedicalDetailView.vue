<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <el-button text @click="router.back()"><el-icon><ArrowLeft /></el-icon> 返回列表</el-button>
        <h2 class="page-title" style="margin-top:8px">病历详情 #{{ recordId }}</h2>
      </div>
      <div class="actions">
        <el-button @click="printRecord"><el-icon><Printer /></el-icon>打印</el-button>
        <el-button type="warning" v-if="userStore.isDoctor" @click="showReferral"><el-icon><Switch /></el-icon>转诊</el-button>
        <el-button type="primary" @click="editMode = !editMode"><el-icon><Edit /></el-icon>{{ editMode ? '取消编辑' : '编辑' }}</el-button>
      </div>
    </div>
    <el-row :gutter="16">
      <el-col :xs="24" :md="16">
        <el-card shadow="never" style="margin-bottom:16px">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">就诊信息</span>
              <el-tag :type="record?.visit_type === 'emergency' ? 'danger' : undefined" size="small">{{ VISIT_TYPE_LABELS[record?.visit_type || 'outpatient'] }}</el-tag>
            </div>
          </template>
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="院区">{{ record?.hospital_name }}</el-descriptions-item>
            <el-descriptions-item label="科室">{{ record?.department }}</el-descriptions-item>
            <el-descriptions-item label="医生">{{ record?.doctor_name }}</el-descriptions-item>
            <el-descriptions-item label="就诊时间">{{ formatDateTime(record?.visit_date) }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="record?.status === 'completed' ? 'success' : 'primary'" size="small">
                {{ record?.status === 'in_progress' ? '进行中' : record?.status === 'completed' ? '已完成' : '已转诊' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="关联转诊" v-if="record?.referral_from_id">
              <el-button link type="primary" @click="router.push(`/medical/${record.referral_from_id}`)">查看原病历</el-button>
            </el-descriptions-item>
          </el-descriptions>
          <el-divider />
          <el-form label-width="100px" v-if="record">
            <el-form-item label="体征">
              <span style="color:var(--text-secondary)">体温：</span>
              <el-input-number v-if="editMode" v-model="record.temperature" :precision="1" :min="35" :max="45" size="small" />
              <span v-else style="font-weight:500">{{ record.temperature || '-' }} ℃</span>
              <span style="margin:0 16px;color:var(--text-secondary)">心率：</span>
              <el-input-number v-if="editMode" v-model="record.heart_rate" size="small" style="width:110px" />
              <span v-else style="font-weight:500">{{ record.heart_rate || '-' }} 次/分</span>
              <span style="margin:0 16px;color:var(--text-secondary)">呼吸：</span>
              <el-input-number v-if="editMode" v-model="record.respiratory_rate" size="small" style="width:110px" />
              <span v-else style="font-weight:500">{{ record.respiratory_rate || '-' }} 次/分</span>
            </el-form-item>
            <el-form-item label="主诉">
              <el-input v-if="editMode" v-model="record.chief_complaint" type="textarea" :rows="2" />
              <div v-else style="white-space:pre-wrap">{{ record.chief_complaint || '-' }}</div>
            </el-form-item>
            <el-form-item label="现病史">
              <el-input v-if="editMode" v-model="record.present_illness" type="textarea" :rows="2" />
              <div v-else style="white-space:pre-wrap">{{ record.present_illness || '-' }}</div>
            </el-form-item>
            <el-form-item label="既往史">
              <el-input v-if="editMode" v-model="record.past_history" type="textarea" :rows="2" />
              <div v-else style="white-space:pre-wrap">{{ record.past_history || '-' }}</div>
            </el-form-item>
            <el-form-item label="体格检查">
              <el-input v-if="editMode" v-model="record.physical_exam" type="textarea" :rows="2" />
              <div v-else style="white-space:pre-wrap">{{ record.physical_exam || '-' }}</div>
            </el-form-item>
            <el-form-item label="诊断">
              <el-input v-if="editMode" v-model="record.diagnosis" type="textarea" :rows="2" />
              <div v-else style="white-space:pre-wrap;color:var(--primary-color);font-weight:500">{{ record.diagnosis || '-' }}</div>
            </el-form-item>
            <el-form-item label="治疗方案">
              <el-input v-if="editMode" v-model="record.treatment_plan" type="textarea" :rows="2" />
              <div v-else style="white-space:pre-wrap">{{ record.treatment_plan || '-' }}</div>
            </el-form-item>
            <el-form-item v-if="editMode">
              <el-button type="primary" @click="saveEdit"><el-icon><Check /></el-icon>保存修改</el-button>
            </el-form-item>
          </el-form>
        </el-card>
        <el-card shadow="never" style="margin-bottom:16px">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">处方 ({{ record?.prescriptions?.length || 0 }})</span>
              <el-button type="primary" size="small" v-if="userStore.isDoctor && !editMode" @click="openPrescDialog">
                <el-icon><Plus /></el-icon>开处方
              </el-button>
            </div>
          </template>
          <el-empty v-if="!record?.prescriptions?.length" description="暂无处方" />
          <div v-for="p in record?.prescriptions" :key="p.id" class="prescription-card">
            <div class="presc-head">
              <span style="font-weight:600">处方 #{{ p.id }}</span>
              <el-tag :type="prescStatusType(p.status)" size="small">{{ PRESC_STATUS_LABELS[p.status] }}</el-tag>
              <el-tag v-if="p.has_controlled" type="danger" size="small" effect="dark">含管制药</el-tag>
              <span class="presc-meta">开方：{{ p.prescribed_by_name || '-' }} · {{ formatDateTime(p.created_at) }}</span>
            </div>
            <el-table :data="p.items" size="small" style="margin:12px 0">
              <el-table-column prop="medicine_name" label="药品名称" />
              <el-table-column prop="medicine_spec" label="规格" width="110" />
              <el-table-column prop="dosage" label="用法用量" min-width="150" />
              <el-table-column prop="quantity" label="数量" width="70" align="right" />
              <el-table-column label="单价" width="90" align="right">
                <template #default="{row}">¥{{ Number(row.unit_price || 0).toFixed(2) }}</template>
              </el-table-column>
              <el-table-column label="小计" width="100" align="right">
                <template #default="{row}"><strong style="color:var(--danger-color)">¥{{ Number(row.subtotal || 0).toFixed(2) }}</strong></template>
              </el-table-column>
            </el-table>
            <div class="presc-footer">
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <el-tag size="small" effect="plain">一审：{{ p.first_approver_name || '待审核' }}</el-tag>
                <el-tag size="small" effect="plain">二审：{{ p.second_approver_name || (p.has_controlled ? '待审核' : '无需') }}</el-tag>
              </div>
              <div>合计：<strong style="color:var(--danger-color);font-size:16px">¥{{ Number(p.total_amount || 0).toFixed(2) }}</strong></div>
            </div>
          </div>
        </el-card>
        <el-card shadow="never" style="margin-bottom:16px">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">检验结果 ({{ record?.lab_results?.length || 0 }})</span>
              <el-button type="primary" size="small" v-if="userStore.isDoctor"><el-icon><Plus /></el-icon>申请检验</el-button>
            </div>
          </template>
          <el-empty v-if="!record?.lab_results?.length" description="暂无检验" />
          <div v-for="lr in record?.lab_results" :key="lr.id" class="lab-card">
            <div class="lab-head">
              <span style="font-weight:600">{{ lr.category || '检验' }}#{{ lr.id }}</span>
              <el-tag :type="lr.status === 'completed' ? 'success' : lr.status === 'pending' ? 'warning' : 'info'" size="small">
                {{ LAB_STATUS_LABELS[lr.status] }}
              </el-tag>
              <el-tag v-if="lr.has_abnormal" type="danger" size="small" effect="dark">异常</el-tag>
              <span class="lab-meta">申请医生：{{ lr.requesting_doctor_name || '-' }} · 技师：{{ lr.technician_name || '-' }}</span>
              <span style="color:var(--text-secondary);font-size:12px;margin-left:auto">{{ formatDateTime(lr.submitted_at || lr.created_at) }}</span>
            </div>
            <el-table :data="lr.items" size="small" style="margin-top:12px" max-height="300">
              <el-table-column prop="test_name" label="项目" width="140" />
              <el-table-column label="结果" width="160">
                <template #default="{row}">
                  <span :class="row.is_abnormal ? (row.abnormal_type === 'high' ? 'text-abnormal-high' : 'text-abnormal-low') : ''">
                    <strong>{{ row.result_value ?? row.result_text ?? '-' }}</strong>
                    <span v-if="row.unit" style="margin-left:2px">{{ row.unit }}</span>
                    <el-icon v-if="row.abnormal_type === 'high'" style="color:#F56C6C"><Top /></el-icon>
                    <el-icon v-else-if="row.abnormal_type === 'low'" style="color:#E6A23C"><Bottom /></el-icon>
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="参考区间">
                <template #default="{row}">
                  {{ row.reference_text || (row.reference_min != null && row.reference_max != null
                    ? `${row.reference_min} ~ ${row.reference_max}${row.unit ? ' ' + row.unit : ''}`
                    : '-') }}
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" show-overflow-tooltip />
            </el-table>
            <div v-if="lr.overall_conclusion" style="margin-top:12px;padding:10px;background:#fdf6ec;border-radius:4px">
              <strong>检验结论：</strong>{{ lr.overall_conclusion }}
            </div>
          </div>
        </el-card>
        <el-card shadow="never">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">影像/附件 ({{ record?.attachments?.length || 0 }})</span>
              <el-upload action="#" :auto-upload="false" :show-file-list="false" :on-change="onUpload">
                <el-button type="primary" size="small"><el-icon><Upload /></el-icon>上传附件</el-button>
              </el-upload>
            </div>
          </template>
          <el-empty v-if="!record?.attachments?.length" description="暂无附件" />
          <div v-else class="attachments-grid">
            <div v-for="a in record?.attachments" :key="a.id" class="attachment-item" :title="a.file_name">
              <div class="attach-img">
                <el-icon v-if="!isImage(a.file_name)" :size="48" color="#909399"><Document /></el-icon>
                <el-image v-else :src="a.file_path" fit="cover" lazy :preview-src-list="a.file_path ? [a.file_path] : []" style="width:100%;height:100%" />
              </div>
              <div class="attach-name">{{ a.file_name }}</div>
              <el-tag size="small" effect="plain">{{ a.file_type }}</el-tag>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" style="margin-bottom:16px">
          <template #header><span style="font-weight:600">宠物信息</span></template>
          <div class="pet-info-card" @click="goPet">
            <el-avatar :size="64" style="background:linear-gradient(135deg,#409EFF,#67C23A);font-size:26px">
              {{ record?.pet_name?.charAt(0) || 'P' }}
            </el-avatar>
            <div class="pet-meta">
              <h3>{{ record?.pet_name }}</h3>
              <div style="color:var(--text-secondary);font-size:13px">{{ record?.owner_name }} · {{ petOwnerPhone }}</div>
            </div>
          </div>
          <el-divider style="margin:16px 0" />
          <div style="display:flex;flex-direction:column;gap:8px">
            <el-button type="primary" @click="goPet"><el-icon><View /></el-icon>查看完整档案</el-button>
            <el-button @click="router.push(`/pets/${record?.pet_id}`)"><el-icon><Clock /></el-icon>历史就诊</el-button>
            <el-button type="success" v-if="userStore.isDoctor || userStore.isNurse"><el-icon><HomeFilled /></el-icon>安排住院</el-button>
          </div>
        </el-card>
        <el-card shadow="never">
          <template #header><span style="font-weight:600">同宠物历史病历</span></template>
          <el-timeline v-if="relatedRecords.length">
            <el-timeline-item
              v-for="r in relatedRecords.slice(0, 6)"
              :key="r.id"
              :timestamp="formatDate(r.visit_date)"
              :color="r.id === recordId ? '#409EFF' : ''"
            >
              <div style="cursor:pointer" @click="router.push(`/medical/${r.id}`)">
                <div><strong>{{ r.department }}</strong> · {{ VISIT_TYPE_LABELS[r.visit_type] }}</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">
                  {{ r.diagnosis || r.chief_complaint || '无' }}
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无更多记录" :image-size="60" />
        </el-card>
      </el-col>
    </el-row>
    <el-dialog v-model="referralDialog" title="发起转诊" width="520px">
      <el-form label-width="100px">
        <el-form-item label="目标院区" required>
          <el-select v-model="referralForm.hospital_id" style="width:100%" placeholder="选择院区">
            <el-option v-for="h in userStore.hospitals" :key="h.id" :label="h.name" :value="h.id">
              {{ h.name }}<el-tag v-if="h.type==='emergency_24h'" size="small" type="danger" style="margin-left:8px">24H急诊</el-tag>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="接诊医生">
          <el-select v-model="referralForm.doctor_id" style="width:100%" placeholder="可选" clearable>
            <el-option label="暂不指定" :value="''" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="referralDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmReferral">确认转诊</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="prescDialog" title="开处方" width="720px">
      <el-form label-width="100px">
        <el-form-item label="药品明细">
          <div style="width:100%">
            <el-table :data="prescForm.items" border size="small" style="margin-bottom:10px">
              <el-table-column label="药品" min-width="220">
                <template #default="{row}">
                  <el-select v-model="row.medicine_id" filterable placeholder="选择药品" style="width:100%">
                    <el-option v-for="m in medicines" :key="m.id" :label="`${m.name} ${m.spec || ''}`" :value="m.id" :disabled="m.stock_quantity <= 0">
                      <span>{{ m.name }} <span style="color:var(--text-secondary);font-size:12px">{{ m.spec || '' }}</span></span>
                      <el-tag v-if="m.is_controlled" type="danger" size="small" style="margin-left:8px">管制</el-tag>
                      <span style="float:right;color:#F56C6C;font-size:12px">库存{{ m.stock_quantity }}</span>
                    </el-option>
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="用法用量" width="160">
                <template #default="{row}"><el-input v-model="row.dosage" placeholder="如：每日2次" /></template>
              </el-table-column>
              <el-table-column label="数量" width="100">
                <template #default="{row}"><el-input-number v-model="row.quantity" :min="1" style="width:100%" /></template>
              </el-table-column>
              <el-table-column label="操作" width="60">
                <template #default="{$index}"><el-button link type="danger" @click="prescForm.items.splice($index, 1)">删</el-button></template>
              </el-table-column>
            </el-table>
            <el-button size="small" @click="prescForm.items.push({ medicine_id: null, dosage: '', quantity: 1 })">
              <el-icon><Plus /></el-icon>添加药品
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="prescForm.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="prescDialog = false">取消</el-button>
        <el-button type="primary" @click="submitPresc">提交处方</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, Printer, Switch, Edit, Check, Top, Bottom, Upload, View, Clock, HomeFilled, Document, Plus
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores'
import { medicalApi, pharmacyApi } from '@/api'
import {
  VISIT_TYPE_LABELS, PRESC_STATUS_LABELS, LAB_STATUS_LABELS,
  type MedicalRecord, type Medicine, type PrescStatus
} from '@/types'
import { formatDateTime, formatDate } from '@/utils'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const recordId = Number(route.params.recordId)
const editMode = ref(false)
const record = ref<MedicalRecord | null>(null)
const relatedRecords = ref<any[]>([])
const medicines = ref<Medicine[]>([])
const petOwnerPhone = ref('')

const referralDialog = ref(false)
const referralForm = reactive({ hospital_id: null as number | null, doctor_id: null as number | null })

const prescDialog = ref(false)
const prescForm = reactive({
  items: [{ medicine_id: null as number | null, dosage: '', quantity: 1 }] as any[],
  remark: ''
})

function prescStatusType(s: PrescStatus) {
  return s === 'dispensed' ? 'success' : s === 'cancelled' ? 'info' : s === 'second_approved' ? 'primary' : 'warning' as const
}
function isImage(name: string) {
  return /\.(png|jpe?g|gif|bmp|webp)$/i.test(name)
}

async function loadRecord() {
  try {
    const res = await medicalApi.getRecord(recordId)
    if (res.code === 200) {
      record.value = res.data
      if (res.data.pet_id) {
        try {
          const petRes = await medicalApi.getPetRecords(res.data.pet_id, { per_page: 10 })
          relatedRecords.value = petRes.data?.items || []
        } catch (e: any) {
          relatedRecords.value = []
        }
      }
    }
  } catch (e: any) {
    record.value = null
    relatedRecords.value = []
    ElMessage.error(e.message || '加载病历失败')
  }
  if (!medicines.value.length) loadMedicines()
}

async function loadMedicines() {
  try {
    const res = await pharmacyApi.getMedicines({ per_page: 200 })
    if (res.code === 200) medicines.value = res.data.items
  } catch (e: any) {
    medicines.value = []
    ElMessage.error(e.message || '加载药品列表失败')
  }
}

async function saveEdit() {
  try {
    const res = await medicalApi.updateRecord(recordId, record.value as any)
    if (res.code === 200) { record.value = res.data; editMode.value = false; ElMessage.success('已保存') }
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  }
}

function printRecord() { ElMessage.success('正在打印病历...') }
function showReferral() { referralDialog.value = true }
async function confirmReferral() {
  if (!referralForm.hospital_id) { ElMessage.warning('请选择院区'); return }
  try {
    const res = await medicalApi.createReferral(recordId, { target_hospital_id: referralForm.hospital_id!, target_doctor_id: referralForm.doctor_id || undefined })
    if (res.code === 200) { ElMessage.success('转诊成功'); router.push(`/medical/${res.data.id}`) }
  } catch (e: any) {
    if (e.code === 409 || e.message?.includes('409') || e.message?.includes('重复')) {
      ElMessage.error('该病历已存在转诊记录，请勿重复发起')
    } else {
      ElMessage.error(e.message || '转诊失败')
    }
  }
}

function goPet() { if (record.value?.pet_id) router.push(`/pets/${record.value.pet_id}`) }
function openPrescDialog() { prescDialog.value = true }
async function submitPresc() {
  if (!prescForm.items.some(x => x.medicine_id)) { ElMessage.warning('请选择药品'); return }
  try {
    const res = await pharmacyApi.createPrescription({ medical_record_id: recordId, hospital_id: userStore.currentHospital?.id || 1, items: prescForm.items, remark: prescForm.remark })
    if (res.code === 200) { ElMessage.success('处方已提交'); prescDialog.value = false; loadRecord() }
  } catch (e: any) {
    ElMessage.error(e.message || '处方提交失败')
  }
}

function onUpload(f: any) { ElMessage.success(`文件 ${f.name} 已上传`) }

onMounted(() => {
  loadRecord()
  petOwnerPhone.value = '138****5678'
})
</script>

<style scoped lang="scss">
.prescription-card, .lab-card {
  padding: 14px;
  margin-bottom: 12px;
  background: var(--bg-color);
  border-radius: var(--radius-base);
  border: 1px solid var(--border-light);
  transition: all 0.2s;
  &:hover { border-color: var(--primary-color); }
}
.presc-head, .lab-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
  .presc-meta, .lab-meta { color: var(--text-secondary); margin-left: 8px; font-size: 12px; }
}
.presc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px dashed var(--border-light);
  margin-top: 8px;
}
.attachments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}
.attachment-item {
  text-align: center;
  .attach-img {
    width: 100%;
    aspect-ratio: 1;
    background: var(--bg-color);
    border-radius: var(--radius-small);
    @include flex-center;
    overflow: hidden;
    border: 1px solid var(--border-light);
  }
  .attach-name {
    font-size: 12px;
    margin: 6px 0 4px;
    @include ellipsis;
  }
}
.pet-info-card {
  display: flex;
  gap: 14px;
  align-items: center;
  cursor: pointer;
  padding: 8px;
  border-radius: var(--radius-small);
  transition: background 0.2s;
  &:hover { background: var(--bg-color); }
  h3 { margin: 0 0 4px; }
}
</style>
