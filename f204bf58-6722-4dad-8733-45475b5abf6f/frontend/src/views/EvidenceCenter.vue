<template>
  <div class="evidence-center">
    <div class="page-header">
      <div>
        <h2 class="page-title">证据中心</h2>
        <p style="color:#718096;font-size:13px;margin-top:4px">
          共 {{ evidenceStore.total }} 份证据，
          <span v-if="borrowedCount > 0" style="color:#d69e2e">{{ borrowedCount }} 份借出中</span>
          <span v-if="lostCount > 0" style="color:#e53e3e;margin-left:12px">{{ lostCount }} 份遗失</span>
        </p>
      </div>
      <div class="header-actions">
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :multiple="true"
          :limit="20"
          :max-size="100 * 1024"
          drag
          :on-change="handleFileChange"
          :show-file-list="true"
          style="width:220px"
        >
          <el-button type="primary" @click.stop="showUpload = true">
            <el-icon><Upload /></el-icon> 批量上传
          </el-button>
        </el-upload>
        <el-button type="success" @click="scanBorrow">
          <el-icon><Cpu /></el-icon> 扫码借还
        </el-button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <el-input v-model="search" placeholder="搜索证据名称、编号..." style="width:220px" :prefix-icon="Search" clearable />
        <el-select v-model="filterCase" placeholder="关联案件" clearable filterable style="width:200px">
          <el-option v-for="c in caseList" :key="c.id" :label="`${c.case_no} ${c.case_name}`" :value="c.id" />
        </el-select>
        <el-select v-model="filterType" placeholder="证据类型" clearable style="width:130px">
          <el-option label="书证" value="document" />
          <el-option label="物证" value="physical" />
          <el-option label="视听资料" value="audio" />
          <el-option label="证人证言" value="witness" />
          <el-option label="电子数据" value="electronic" />
          <el-option label="鉴定意见" value="expertise" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="保管状态" clearable style="width:130px">
          <el-option label="已入库" value="in_store" />
          <el-option label="已借出" value="borrowed" />
          <el-option label="已归还" value="returned" />
          <el-option label="已遗失" value="lost" />
        </el-select>
        <el-switch v-model="onlyOriginal" active-text="仅原件" style="margin-left:8px" />
        <el-button-group>
          <el-button @click="viewMode = 'masonry'" :type="viewMode === 'masonry' ? 'primary' : ''">
            <el-icon><Picture /></el-icon>瀑布流
          </el-button>
          <el-button @click="viewMode = 'table'" :type="viewMode === 'table' ? 'primary' : ''">
            <el-icon><Grid /></el-icon>列表
          </el-button>
        </el-button-group>
      </div>

      <div class="masonry-container" v-if="viewMode === 'masonry' && !evidenceStore.loading">
        <div class="masonry-column" v-for="(col, ci) in columns" :key="ci">
          <div
            v-for="ev in col"
            :key="ev.id"
            class="evidence-card"
            :class="{ 'card-lost': ev.storage_status === 'lost', 'card-borrowed': ev.storage_status === 'borrowed' }"
            @click="openDetail(ev)"
          >
            <div class="card-preview">
              <img v-if="ev.thumbnail_url || isImage(ev)" :src="ev.thumbnail_url || ev.file_url" alt="" />
              <div v-else class="file-icon">
                <el-icon :size="48" :color="fileIconColor(ev)">
                  <component :is="fileIcon(ev)" />
                </el-icon>
                <p class="file-ext">{{ fileExt(ev)?.toUpperCase() }}</p>
              </div>
              <div class="card-badge" :class="ev.storage_status">
                {{ ev.storage_status_display }}
              </div>
              <div class="card-overlay" v-if="ev.ocr_content">
                <el-icon><Document /></el-icon>
                <span>OCR已识别</span>
              </div>
            </div>
            <div class="card-body">
              <h4 class="card-title" :title="ev.evidence_name">{{ ev.evidence_name }}</h4>
              <div class="card-meta">
                <span class="meta-item">
                  <el-icon><Collection /></el-icon>
                  {{ ev.evidence_type_display }}
                </span>
                <span class="meta-item" v-if="ev.is_original" style="color:#38a169">
                  <el-icon><Star /></el-icon>原件
                </span>
              </div>
              <div class="card-footer">
                <span style="color:#a0aec0;font-size:12px">{{ ev.evidence_no }}</span>
                <div class="card-actions" @click.stop>
                  <el-button size="small" type="primary" link @click.stop="openPreview(ev)">预览</el-button>
                  <el-dropdown trigger="click" @command="(c:any)=>handleAction(c, ev)">
                    <el-button size="small" link>更多<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="ocr">
                          <el-icon><Reading /></el-icon>{{ ev.has_ocr ? '重新OCR识别' : 'OCR文字识别' }}
                        </el-dropdown-item>
                        <el-dropdown-item command="watermark">
                          <el-icon><Stamp /></el-icon>{{ ev.has_watermark ? '重新添加水印' : '添加水印标注' }}
                        </el-dropdown-item>
                        <el-dropdown-item command="borrow" v-if="['in_store', 'returned'].includes(ev.storage_status)">
                          <el-icon><Download /></el-icon>借出登记
                        </el-dropdown-item>
                        <el-dropdown-item command="return" v-if="ev.storage_status === 'borrowed'">
                          <el-icon><Upload /></el-icon>归还登记
                        </el-dropdown-item>
                        <el-dropdown-item command="download" v-if="ev.file_url">
                          <el-icon><Download /></el-icon>下载文件
                        </el-dropdown-item>
                        <el-dropdown-item command="edit">
                          <el-icon><Edit /></el-icon>编辑
                        </el-dropdown-item>
                        <el-dropdown-item command="lost" style="color:#e53e3e">
                          <el-icon><Warning /></el-icon>标记遗失
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-if="evidenceStore.evidences.length === 0" description="暂无证据" style="grid-column:1/-1" />
      </div>

      <el-table :data="evidenceStore.evidences" v-else v-loading="evidenceStore.loading">
        <el-table-column prop="evidence_no" label="编号" width="160" />
        <el-table-column prop="evidence_name" label="证据名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="evidence_type_display" label="类型" width="100" />
        <el-table-column label="原件" width="70" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.is_original" color="#38a169"><CircleCheck /></el-icon>
          </template>
        </el-table-column>
        <el-table-column label="保管状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTag(row.storage_status)">
              {{ row.storage_status_display }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="page_count" label="页数" width="70" align="right" />
        <el-table-column label="借用人" width="100">
          <template #default="{ row }">{{ row.borrower_info?.full_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="上传人" width="100">
          <template #default="{ row }">{{ row.uploaded_by_info?.full_name }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="openPreview(row)">预览</el-button>
            <el-button size="small" type="primary" link @click="handleAction('ocr', row)" :loading="ocrLoading === row.id">OCR识别</el-button>
            <el-button size="small" link @click="handleAction('watermark', row)">加水印</el-button>
            <el-button size="small" link @click="handleAction('borrow', row)" v-if="['in_store', 'returned'].includes(row.storage_status)">借出</el-button>
            <el-button size="small" link @click="handleAction('return', row)" v-if="row.storage_status === 'borrowed'">归还</el-button>
            <el-button size="small" type="danger" link @click="handleAction('lost', row)" v-if="row.storage_status !== 'lost'">遗失</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="filterPage"
          v-model:page-size="filterPageSize"
          :page-sizes="[12, 24, 48, 100]"
          :total="evidenceStore.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadEvidences"
          @size-change="loadEvidences"
        />
      </div>
    </div>

    <el-dialog v-model="showUpload" title="批量上传证据" width="600px">
      <el-form label-width="100px">
        <el-form-item label="关联案件">
          <el-select v-model="uploadForm.case_id" filterable style="width:100%">
            <el-option v-for="c in caseList" :key="c.id" :label="`${c.case_no} ${c.case_name}`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="证据类型">
          <el-select v-model="uploadForm.evidence_type" style="width:100%">
            <el-option label="书证" value="document" />
            <el-option label="物证" value="physical" />
            <el-option label="视听资料" value="audio" />
            <el-option label="电子数据" value="electronic" />
            <el-option label="鉴定意见" value="expertise" />
          </el-select>
        </el-form-item>
        <el-form-item label="选择文件">
          <el-upload
            multiple
            :limit="20"
            :max-size="100 * 1024"
            drag
            :auto-upload="false"
            :on-change="(f)=>uploadForm.files = f"
            :file-list="uploadForm.files as any"
          >
            <el-icon style="font-size:48px;color:#a0aec0"><UploadFilled /></el-icon>
            <p>拖拽文件到此处或点击上传</p>
            <p style="color:#a0aec0;font-size:12px">支持单文件最大100MB，单次最多20个文件</p>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUpload = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">上传</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showDetail" :title="current?.evidence_name || '证据详情'" width="680px">
      <div v-if="current" class="detail-body">
        <div class="detail-preview" v-if="current.file_url">
          <img v-if="isImage(current)" :src="current.file_url" style="max-height:400px;max-width:100%" />
          <div v-else class="file-icon-large">
            <el-icon :size="64"><component :is="fileIcon(current)" /></el-icon>
            <p>{{ current.file_name || '文件预览' }}</p>
            <p style="color:#a0aec0;font-size:12px">{{ formatSize(current.file_size) }}</p>
            <el-button type="primary" link @click="downloadFile(current)">
              <el-icon><Download /></el-icon>下载查看
            </el-button>
          </div>
        </div>
        <el-descriptions :column="2" border size="small" style="margin-top:16px">
          <el-descriptions-item label="证据编号">{{ current.evidence_no }}</el-descriptions-item>
          <el-descriptions-item label="证据类型">{{ current.evidence_type_display }}</el-descriptions-item>
          <el-descriptions-item label="是否原件">
            <el-tag v-if="current.is_original" type="success">原件 × {{ current.original_count }}</el-tag>
            <span v-else>复印件 × {{ current.copy_count }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="保管状态">
            <el-tag :type="statusTag(current.storage_status)">{{ current.storage_status_display }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="存放位置" :span="2">{{ current.storage_location || '-' }}</el-descriptions-item>
          <el-descriptions-item label="借用人" v-if="current.storage_status === 'borrowed'">
            {{ current.borrower_info?.full_name }} · {{ formatTime(current.borrowed_at!) }}
          </el-descriptions-item>
          <el-descriptions-item label="预计归还" v-if="current.storage_status === 'borrowed'">
            {{ formatTime(current.expected_return_at!) }}
          </el-descriptions-item>
          <el-descriptions-item label="证明内容" :span="2">{{ current.prove_content || '-' }}</el-descriptions-item>
        </el-descriptions>
        <div class="flow-section">
          <h4 style="margin:16px 0 8px;color:#2d3748">流转轨迹</h4>
          <el-timeline v-if="current.flow_logs?.length">
            <el-timeline-item
              v-for="f in current.flow_logs"
              :key="f.id"
              :timestamp="formatTime(f.created_at)"
              placement="top"
            >
              <el-card shadow="never" style="background:#f7fafc;border:none">
                <p style="margin:0;font-size:13px">
                  <span style="font-weight:500">{{ f.operator_info?.full_name }}</span>
                  <el-tag size="small" style="margin-left:8px">{{ f.action_display }}</el-tag>
                  <span v-if="f.to_person" style="margin-left:8px">→ {{ f.to_person_info?.full_name }}</span>
                </p>
                <p v-if="f.remark" style="color:#718096;font-size:12px;margin:4px 0 0">{{ f.remark }}</p>
              </el-card>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无流转记录" :image-size="60" />
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="showBorrow" title="借出登记" width="420px">
      <el-form :model="borrowForm" label-width="90px">
        <el-form-item label="借用人">
          <el-select v-model="borrowForm.borrower" filterable style="width:100%">
            <el-option v-for="u in userList" :key="u.id" :label="u.full_name" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预计归还">
          <el-date-picker v-model="borrowForm.expected_return_at" type="datetime" style="width:100%" value-format="YYYY-MM-DDTHH:mm:ss" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="borrowForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBorrow = false">取消</el-button>
        <el-button type="primary" @click="submitBorrow">确认借出</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showScan" title="扫码借还" width="400px">
      <div class="scan-container">
        <el-icon :size="80" color="#4299e1"><Cpu /></el-icon>
        <p style="color:#718096;margin:16px 0">请扫描证据条形码/二维码</p>
        <el-input v-model="scanCode" placeholder="或手动输入编号" @keyup.enter="handleScanCode" />
        <el-button type="primary" style="margin-top:12px" @click="handleScanCode">识别</el-button>
      </div>
    </el-dialog>

    <el-dialog v-model="showWatermarkDialog" title="添加水印标注" width="480px">
      <el-form :model="watermarkForm" label-width="90px">
        <el-form-item label="水印文字">
          <el-input v-model="watermarkForm.text" maxlength="50" />
        </el-form-item>
        <el-form-item label="透明度">
          <el-slider v-model="watermarkForm.opacity" :min="0.1" :max="0.8" :step="0.05" />
        </el-form-item>
        <el-form-item label="字号">
          <el-input-number v-model="watermarkForm.font_size" :min="12" :max="120" />
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="watermarkForm.color" />
        </el-form-item>
        <el-form-item label="位置">
          <el-radio-group v-model="watermarkForm.position">
            <el-radio value="diagonal">斜角铺底</el-radio>
            <el-radio value="tile">平铺</el-radio>
            <el-radio value="center">居中</el-radio>
            <el-radio value="top_left">左上角</el-radio>
            <el-radio value="top_right">右上角</el-radio>
            <el-radio value="bottom_left">左下角</el-radio>
            <el-radio value="bottom_right">右下角</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="文件类型" v-if="current">
          <el-tag>{{ current.file_name }}</el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showWatermarkDialog = false">取消</el-button>
        <el-button type="primary" :loading="watermarkLoading" @click="doAddWatermark">确认添加</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showOcrDialog" title="OCR识别设置" width="500px">
      <el-alert
        title="选择识别类型以获得更精准的识别结果"
        type="info"
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-form label-width="100px">
        <el-form-item label="识别类型">
          <el-radio-group v-model="ocrForm.ocr_type">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <el-radio
                v-for="t in ocrTypes"
                :key="t.value"
                :value="t.value"
                style="margin-bottom: 12px"
              >
                <div style="line-height: 1.4">
                  <div style="font-weight: 600">{{ t.label }}</div>
                  <div style="font-size: 12px; color: #718096; font-weight: normal">{{ t.desc }}</div>
                </div>
              </el-radio>
            </div>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showOcrDialog = false">取消</el-button>
        <el-button type="primary" :loading="ocrLoading" @click="doOcrRecognize">开始识别</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import {
  Upload, Search, Picture, Grid, Document, ArrowDown, Edit, Warning,
  Download, Star, Cpu, UploadFilled, CircleCheck, Collection,
  Folder, Reading, Film, PictureFilled, Files, Stamp
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useEvidenceStore } from '@/stores/evidence'
import { userApi, caseApi, evidenceApi } from '@/api/modules'
import type { Evidence } from '@/types'
import dayjs from 'dayjs'

const evidenceStore = useEvidenceStore()
const current = ref<Evidence | null>(null)
const showDetail = ref(false)
const showUpload = ref(false)
const showBorrow = ref(false)
const showScan = ref(false)
const showWatermarkDialog = ref(false)
const showOcrDialog = ref(false)
const ocrLoading = ref<any>(null)
const watermarkLoading = ref(false)
const uploading = ref(false)
const viewMode = ref<'masonry' | 'table'>('masonry')

const ocrTypes = [
  { value: 'general', label: '通用文字识别', desc: '普通文档、合同、票据等' },
  { value: 'accurate', label: '高精度文字识别', desc: '密集文字、低清晰度图片' },
  { value: 'idcard_front', label: '身份证正面', desc: '姓名、性别、身份证号等' },
  { value: 'idcard_back', label: '身份证反面', desc: '签发机关、有效期等' },
  { value: 'driving_license', label: '驾驶证', desc: '准驾车型、有效期等' },
  { value: 'vehicle_license', label: '行驶证', desc: '车辆信息、年检信息等' },
  { value: 'bank_card', label: '银行卡', desc: '卡号、银行名称等' },
  { value: 'business_license', label: '营业执照', desc: '统一社会信用代码、法人等' },
  { value: 'passport', label: '护照', desc: '护照号、姓名、国籍等' },
]

const ocrForm = reactive({
  ocr_type: 'general',
  lang: 'chinese_english',
})

const watermarkForm = reactive({
  text: '机密 - 仅限办案使用',
  opacity: 0.3,
  position: 'diagonal',
  font_size: 36,
  color: '#888888',
})

const search = ref('')
const filterCase = ref<number | null>(null)
const filterType = ref('')
const filterStatus = ref('')
const onlyOriginal = ref(false)
const filterPage = ref(1)
const filterPageSize = ref(24)

const caseList = ref<any[]>([])
const userList = ref<any[]>([])

const uploadForm = reactive({
  case_id: null as number | null,
  evidence_type: 'document',
  files: [] as any[]
})

const borrowForm = reactive({
  borrower: null as number | null,
  expected_return_at: '',
  remark: ''
})
const scanCode = ref('')

const borrowedCount = computed(() => evidenceStore.evidences.filter(e => e.storage_status === 'borrowed').length)
const lostCount = computed(() => evidenceStore.evidences.filter(e => e.storage_status === 'lost').length)

const columns = computed(() => {
  const arr: Evidence[][] = [[], [], [], []]
  evidenceStore.evidences.forEach((e, i) => {
    arr[i % 4].push(e)
  })
  return arr
})

function statusTag(s: string) {
  return ({ in_store: 'success', borrowed: 'warning', returned: 'info', lost: 'danger', destroyed: 'danger' } as any)[s] || ''
}
function formatSize(b?: number) {
  if (!b) return '-'
  const kb = b / 1024
  if (kb < 1024) return kb.toFixed(1) + 'KB'
  return (kb / 1024).toFixed(2) + 'MB'
}
function formatTime(t: string) { return dayjs(t).format('YYYY-MM-DD HH:mm') }

function isImage(ev: Evidence) {
  const t = ev.file_type || ''
  const n = (ev.file_name || '').toLowerCase()
  return t.startsWith('image') || /\.(jpg|jpeg|png|gif|bmp|webp)$/.test(n)
}
function fileExt(ev: Evidence) {
  const n = ev.file_name || ''
  const idx = n.lastIndexOf('.')
  return idx > -1 ? n.slice(idx + 1) : 'file'
}
function fileIcon(ev: Evidence) {
  if (isImage(ev)) return PictureFilled
  const ext = fileExt(ev).toLowerCase()
  if (['pdf'].includes(ext)) return Reading
  if (['doc', 'docx'].includes(ext)) return Files
  if (['xls', 'xlsx'].includes(ext)) return Grid
  if (['mp4', 'avi', 'mov'].includes(ext)) return Film
  if (['zip', 'rar', '7z'].includes(ext)) return Folder
  return Document
}
function fileIconColor(ev: Evidence) {
  const ext = fileExt(ev).toLowerCase()
  if (['pdf'].includes(ext)) return '#e53e3e'
  if (['doc', 'docx'].includes(ext)) return '#3182ce'
  if (['xls', 'xlsx'].includes(ext)) return '#38a169'
  return '#718096'
}

async function loadEvidences() {
  const params: any = { page: filterPage.value, page_size: filterPageSize.value }
  if (search.value) params.search = search.value
  if (filterCase.value) params.case = filterCase.value
  if (filterType.value) params.evidence_type = filterType.value
  if (filterStatus.value) params.storage_status = filterStatus.value
  if (onlyOriginal.value) params.is_original = 'true'
  await evidenceStore.fetchEvidences(params)
}

const debounced = debounce(loadEvidences, 300)
watch([search, filterCase, filterType, filterStatus, onlyOriginal], () => {
  filterPage.value = 1
  debounced()
})

function debounce(fn: () => void, delay: number) {
  let t: any
  return () => { clearTimeout(t); t = setTimeout(fn, delay) }
}

function handleFileChange(f: any) { uploadForm.files.push(f) }

async function submitUpload() {
  if (!uploadForm.case_id || uploadForm.files.length === 0) {
    ElMessage.warning('请选择案件和文件')
    return
  }
  uploading.value = true
  const formData = new FormData()
  formData.append('case_id', String(uploadForm.case_id))
  formData.append('evidence_type', uploadForm.evidence_type)
  uploadForm.files.forEach((f: any) => {
    if (f.raw) formData.append('files', f.raw)
    else formData.append('files', f)
  })
  try {
    await evidenceStore.batchUpload(formData)
    ElMessage.success('上传完成')
    showUpload.value = false
    uploadForm.files = []
    await loadEvidences()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally { uploading.value = false }
}

function openDetail(ev: Evidence) {
  current.value = ev
  showDetail.value = true
  evidenceStore.fetchDetail(ev.id).then(r => { current.value = r })
  evidenceStore.returnEv
}
function openPreview(ev: Evidence) {
  openDetail(ev)
}

function handleAction(cmd: string, ev: Evidence) {
  if (cmd === 'borrow') {
    current.value = ev
    showBorrow.value = true
  } else if (cmd === 'return') {
    submitReturn(ev)
  } else if (cmd === 'download') {
    downloadFile(ev)
  } else if (cmd === 'edit') {
    ElMessage.info('编辑功能待实现')
  } else if (cmd === 'lost') {
    ElMessageBox.confirm('确定将该证据标记为遗失吗？将触发风险预警', '警告', { type: 'error' })
      .then(async () => {
        await evidenceStore.markLost(ev.id)
        ElMessage.success('已标记遗失，预警已触发')
        await loadEvidences()
      }).catch(() => {})
  } else if (cmd === 'ocr') {
    current.value = ev
    ocrForm.ocr_type = 'general'
    showOcrDialog.value = true
  } else if (cmd === 'watermark') {
    current.value = ev
    showWatermarkDialog.value = true
  }
}

async function doOcrRecognize() {
  if (!current.value) return
  ocrLoading.value = current.value.id
  showOcrDialog.value = false
  try {
    const res: any = await evidenceApi.ocrRecognize(current.value.id, ocrForm)
    const ev: any = current.value
    ev.ocr_content = res.data?.ocr_content || ''
    ev.has_ocr = true
    ev.ocr_info = res.data?.ocr_info || {}
    ElMessage.success(`OCR识别完成，共${res.data?.words_count || 0}行文字`)
  } catch (e: any) {
    ElMessage.error(e.message || '识别失败')
  } finally {
    ocrLoading.value = null
  }
}

async function doAddWatermark() {
  if (!current.value) return
  watermarkLoading.value = true
  try {
    const res: any = await evidenceApi.addWatermark(current.value.id, watermarkForm)
    const ev: any = current.value
    ev.has_watermark = true
    ev.watermark_info = res.data?.watermark_info || watermarkForm
    ElMessage.success('水印添加成功')
    showWatermarkDialog.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '添加水印失败')
  } finally {
    watermarkLoading.value = false
  }
}

async function submitBorrow() {
  if (!borrowForm.borrower || !current.value) return
  try {
    await evidenceStore.borrow(current.value.id, borrowForm)
    ElMessage.success('借出登记成功')
    showBorrow.value = false
    await loadEvidences()
  } catch (e: any) { ElMessage.error(e.message) }
}

async function submitReturn(ev: Evidence) {
  try {
    await evidenceStore.returnEv(ev.id)
    ElMessage.success('归还登记成功')
    await loadEvidences()
  } catch (e: any) { ElMessage.error(e.message) }
}

function downloadFile(ev: Evidence) {
  if (ev.file_url) window.open(ev.file_url)
}

function scanBorrow() { showScan.value = true }

async function handleScanCode() {
  if (!scanCode.value) return
  const ev = evidenceStore.evidences.find(e => e.evidence_no === scanCode.value || e.barcode === scanCode.value)
  if (ev) {
    showScan.value = false
    scanCode.value = ''
    if (['in_store', 'returned'].includes(ev.storage_status)) {
      current.value = ev
      showBorrow.value = true
    } else if (ev.storage_status === 'borrowed') {
      await submitReturn(ev)
    } else {
      ElMessage.info(`当前状态：${ev.storage_status_display}`)
    }
  } else {
    ElMessage.warning('未找到对应证据')
  }
}

onMounted(async () => {
  await Promise.all([
    loadEvidences(),
    caseApi.list({ page_size: 200 }).then(r => { caseList.value = (r as any).data?.results || [] }),
    userApi.simpleList().then(r => { userList.value = r.data })
  ])
})
</script>

<style lang="scss" scoped>
.evidence-center {
  .header-actions { display: flex; gap: 12px; align-items: center; }
  .masonry-container {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .masonry-column { display: flex; flex-direction: column; gap: 16px; }
  .evidence-card {
    background: #fff;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.1);
    }
    &.card-lost { border: 2px solid #e53e3e; animation: pulse-danger 1.5s infinite; }
    &.card-borrowed { border-top: 3px solid #d69e2e; }
    .card-preview {
      position: relative;
      background: #f7fafc;
      img { width: 100%; display: block; max-height: 200px; object-fit: cover; }
      .file-icon {
        min-height: 140px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px;
        .file-ext {
          font-weight: 600;
          margin-top: 8px;
          color: #4a5568;
          font-size: 13px;
        }
      }
      .card-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 11px;
        color: #fff;
        background: #718096;
        &.in_store { background: #38a169; }
        &.borrowed { background: #d69e2e; }
        &.returned { background: #4299e1; }
        &.lost { background: #e53e3e; }
      }
      .card-overlay {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(30,58,95,0.9);
        color: #fff;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
    .card-body { padding: 12px; }
    .card-title {
      margin: 0 0 8px;
      font-size: 14px;
      color: #2d3748;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .card-meta {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: wrap;
      .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #718096;
      }
    }
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
      border-top: 1px solid #edf2f7;
    }
    .card-actions { display: flex; gap: 4px; }
  }
  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
  .detail-body {
    .detail-preview {
      background: #f7fafc;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .file-icon-large {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: #718096;
    }
    .flow-section {
      :deep(.el-timeline-item__timestamp) { font-size: 12px; color: #a0aec0; }
    }
  }
  .scan-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 0;
  }
}
@keyframes pulse-danger { 50% { opacity: 0.6; } }
@media (max-width: 1200px) {
  .evidence-center .masonry-container { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 900px) {
  .evidence-center .masonry-container { grid-template-columns: repeat(2, 1fr); }
}
</style>
