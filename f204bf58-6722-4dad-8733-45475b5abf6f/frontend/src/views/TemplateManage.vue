<template>
  <div class="template-manage">
    <div class="page-header">
      <div>
        <h2 class="page-title">法律文书模板</h2>
        <p style="color:#718096;font-size:13px;margin-top:4px">内置80余种常用文书模板，支持案件信息自动填充</p>
      </div>
      <el-button type="primary" @click="showCreate = true">
        <el-icon><Plus /></el-icon> 新建模板
      </el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="6">
        <div class="card category-card">
          <h3 style="margin:0 0 12px;font-size:15px;color:#2d3748">分类导航</h3>
          <el-menu
            :default-active="activeCat"
            @select="activeCat = $event"
            background-color="transparent"
          >
            <el-menu-item index="all">
              <el-icon><Collection /></el-icon> 全部模板
              <el-badge :value="totalCount" class="cat-count" />
            </el-menu-item>
            <el-menu-item v-for="c in categories" :key="c.category" :index="c.category">
              <el-icon><component :is="catIcon(c.category)" /></el-icon>
              {{ c.label }}
              <el-badge :value="c.count" class="cat-count" type="primary" />
            </el-menu-item>
          </el-menu>
        </div>
      </el-col>
      <el-col :span="18">
        <div class="card">
          <div class="filter-bar" style="margin-bottom:16px">
            <el-input v-model="search" placeholder="搜索模板..." style="width:260px" :prefix-icon="Search" clearable />
            <el-select v-model="filterCaseType" placeholder="适用案件类型" clearable style="width:140px">
              <el-option label="通用" value="all" />
              <el-option label="民商事" value="civil" />
              <el-option label="刑事" value="criminal" />
              <el-option label="行政" value="administrative" />
              <el-option label="劳动" value="labor" />
              <el-option label="非诉" value="non_litigation" />
            </el-select>
            <el-switch v-model="onlySystem" active-text="系统内置" style="margin-left:8px" />
          </div>
          <el-row :gutter="12">
            <el-col :span="8" v-for="t in filteredTemplates" :key="t.id">
              <div class="tpl-card" @click="openTpl(t)">
                <div class="tpl-icon" :class="t.category">
                  <el-icon :size="28"><component :is="catIcon(t.category)" /></el-icon>
                </div>
                <div class="tpl-body">
                  <h4>{{ t.template_name }}</h4>
                  <div class="tpl-meta">
                    <el-tag size="small" effect="plain">{{ catLabel(t.category) }}</el-tag>
                    <span style="color:#a0aec0;margin-left:8px;font-size:12px">
                      <el-icon><View /></el-icon> {{ t.use_count }}
                    </span>
                    <el-rate v-if="t.rating > 0" :model-value="t.rating" disabled size="small" style="margin-left:8px" />
                  </div>
                </div>
                <div class="tpl-actions" @click.stop>
                  <el-button type="primary" size="small" link @click="genDoc(t)">
                    <el-icon><DocumentAdd /></el-icon> 使用
                  </el-button>
                </div>
              </div>
            </el-col>
          </el-row>
          <el-empty v-if="filteredTemplates.length === 0" description="暂无模板" style="padding:40px 0" />
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="showDetail" :title="current?.template_name" width="720px">
      <div v-if="current" class="tpl-detail">
        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item label="模板编号">{{ current.template_code }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ catLabel(current.category) }}</el-descriptions-item>
          <el-descriptions-item label="适用案件">
            {{ ({all:'通用', civil:'民商事', criminal:'刑事', administrative:'行政', labor:'劳动', ip:'知产', non_litigation:'非诉'} as any)[current.case_type] || current.case_type }}
          </el-descriptions-item>
          <el-descriptions-item label="使用次数">{{ current.use_count }}</el-descriptions-item>
          <el-descriptions-item label="版本">{{ current.version }}</el-descriptions-item>
          <el-descriptions-item label="创建者">{{ (current as any).owner_info?.full_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="使用说明" :span="2">{{ current.usage_instructions || '无' }}</el-descriptions-item>
        </el-descriptions>
        <h4 style="margin:16px 0 8px;color:#2d3748">模板预览</h4>
        <div class="preview-box" v-html="current.content"></div>
      </div>
      <template #footer>
        <el-select v-model="selectCase" placeholder="选择案件(可选)" filterable style="width:260px;margin-right:8px">
          <el-option v-for="c in caseList" :key="c.id" :label="`${c.case_no} ${c.case_name}`" :value="c.id" />
        </el-select>
        <el-button @click="showDetail = false">关闭</el-button>
        <el-button type="primary" @click="genDoc(current)">生成文档</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showGenForm" title="生成法律文书" width="520px">
      <el-form :model="genForm" label-width="100px">
        <el-form-item label="模板">
          <el-tag>{{ curGenTpl?.template_name }}</el-tag>
        </el-form-item>
        <el-form-item label="关联案件">
          <el-select v-model="genForm.case_id" filterable style="width:100%" @change="autoFillDocTitle">
            <el-option v-for="c in caseList" :key="c.id" :label="`${c.case_no} ${c.case_name}`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="文档标题">
          <el-input v-model="genForm.doc_title" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGenForm = false">取消</el-button>
        <el-button type="primary" @click="submitGen">确认生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  Plus, Search, Collection, View, DocumentAdd,
  Document, Tickets, Money, UserFilled, EditPen, Notebook
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { templateApi, caseApi, docApi } from '@/api/modules'
import type { DocumentTemplate } from '@/types'

const categories = [
  { category: 'civil_complaint', label: '起诉状类', count: 0 },
  { category: 'civil_defense', label: '答辩状类', count: 0 },
  { category: 'civil_agent', label: '代理词类', count: 0 },
  { category: 'criminal_defense', label: '辩护词类', count: 0 },
  { category: 'appellate', label: '上诉状类', count: 0 },
  { category: 'application', label: '申请书类', count: 0 },
  { category: 'evidence', label: '证据类文书', count: 0 },
  { category: 'contract', label: '合同类模板', count: 0 },
  { category: 'legal_opinion', label: '法律意见书', count: 0 },
  { category: 'lawyer_letter', label: '律师函', count: 0 },
  { category: 'power_of_attorney', label: '授权委托书', count: 0 },
  { category: 'firm_internal', label: '内部文书', count: 0 },
]

const templates = ref<DocumentTemplate[]>([])
const activeCat = ref('all')
const search = ref('')
const filterCaseType = ref('')
const onlySystem = ref(false)
const showCreate = ref(false)
const showDetail = ref(false)
const showGenForm = ref(false)
const current = ref<DocumentTemplate | null>(null)
const curGenTpl = ref<DocumentTemplate | null>(null)
const selectCase = ref<number | null>(null)
const caseList = ref<any[]>([])
const genForm = reactive({ template_id: 0, case_id: null as number | null, doc_title: '', custom_fields: {} })

const totalCount = computed(() => templates.value.length)
const filteredTemplates = computed(() => {
  let list = templates.value
  if (activeCat.value !== 'all') list = list.filter(t => t.category === activeCat.value)
  if (search.value) list = list.filter(t => t.template_name.includes(search.value) || (t.description || '').includes(search.value))
  if (filterCaseType.value) list = list.filter(t => t.case_type === filterCaseType.value || t.case_type === 'all')
  if (onlySystem.value) list = list.filter(t => t.is_system)
  return list
})

function catLabel(k: string) { return (categories.find(c => c.category === k) || { label: k }).label }
function catIcon(k: string) {
  const map: any = {
    civil_complaint: EditPen, civil_defense: Document, civil_agent: Tickets,
    criminal_defense: UserFilled, appellate: EditPen, application: Document,
    evidence: Collection, contract: Notebook, legal_opinion: View,
    lawyer_letter: Money, power_of_attorney: EditPen, firm_internal: Document
  }
  return map[k] || Document
}

async function loadTemplates() {
  const r = await templateApi.list({ page_size: 200 }) as any
  templates.value = r.data?.results || []
  categories.forEach(c => {
    c.count = templates.value.filter(t => t.category === c.category).length
  })
}

function openTpl(t: DocumentTemplate) {
  current.value = t
  showDetail.value = true
}

function autoFillDocTitle() {
  if (genForm.case_id && curGenTpl.value) {
    const c = caseList.value.find(x => x.id === genForm.case_id)
    if (c) genForm.doc_title = `${curGenTpl.value.template_name}-${c.case_no}`
  }
}

function genDoc(t: DocumentTemplate) {
  curGenTpl.value = t
  genForm.template_id = t.id
  genForm.case_id = selectCase.value
  if (selectCase.value) autoFillDocTitle()
  showDetail.value = false
  showGenForm.value = true
}

async function submitGen() {
  if (!genForm.template_id) return
  try {
    const r = await templateApi.generate(genForm as any) as any
    ElMessage.success('文档生成成功')
    showGenForm.value = false
    if (r.data?.file_url) window.open(r.data.file_url)
    else ElMessage.info('文档已生成，请到"已生成文书"中查看')
  } catch (e: any) { ElMessage.error(e.message) }
}

onMounted(async () => {
  await loadTemplates()
  const r = await caseApi.list({ page_size: 100 }) as any
  caseList.value = r.data?.results || []
})
</script>

<style lang="scss" scoped>
.template-manage {
  .card {
    background: #fff;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .category-card {
    .cat-count { margin-left: auto; }
    :deep(.el-menu) { border: none; padding: 0; }
    :deep(.el-menu-item) {
      display: flex; align-items: center; border-radius: 6px; margin-bottom: 4px;
      padding: 0 12px; height: 40px; line-height: 40px;
    }
    :deep(.el-menu-item.is-active) { background: #ebf8ff; color: #1e3a5f; }
  }
  .tpl-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 12px;
    transition: all 0.2s;
    cursor: pointer;
    display: flex;
    gap: 12px;
    &:hover { border-color: #4299e1; background: #f7fafc; box-shadow: 0 2px 8px rgba(66,153,225,0.15); }
    .tpl-icon {
      width: 48px; height: 48px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      color: #fff;
      &.civil_complaint { background: linear-gradient(135deg,#4299e1,#2b6cb0); }
      &.civil_defense { background: linear-gradient(135deg,#38a169,#2f855a); }
      &.civil_agent { background: linear-gradient(135deg,#805ad5,#6b46c1); }
      &.criminal_defense { background: linear-gradient(135deg,#e53e3e,#c53030); }
      &.appellate { background: linear-gradient(135deg,#d69e2e,#b7791f); }
      &.application { background: linear-gradient(135deg,#319795,#2c7a7b); }
      &.evidence { background: linear-gradient(135deg,#ed8936,#dd6b20); }
      &.contract { background: linear-gradient(135deg,#2c5282,#1e3a5f); }
      &.legal_opinion { background: linear-gradient(135deg,#4fd1c5,#38b2ac); }
      &.lawyer_letter { background: linear-gradient(135deg,#e53e3e,#9b2c2c); }
      &.power_of_attorney { background: linear-gradient(135deg,#667eea,#764ba2); }
      &.firm_internal { background: linear-gradient(135deg,#718096,#4a5568); }
    }
    .tpl-body {
      flex: 1; min-width: 0;
      h4 {
        margin: 0 0 6px;
        font-size: 14px; color: #2d3748; font-weight: 500;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .tpl-meta { display: flex; align-items: center; font-size: 12px; }
    }
  }
  .tpl-detail {
    .preview-box {
      max-height: 400px;
      overflow: auto;
      padding: 20px;
      background: #fafafa;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      line-height: 1.8;
    }
  }
}
</style>
