<template>
  <div class="client-manage">
    <div class="page-header">
      <div>
        <h2 class="page-title">客户管理</h2>
        <p style="color:#718096;font-size:13px;margin-top:4px">
          共 {{ total }} 位客户
        </p>
      </div>
      <el-button type="primary" @click="showForm = true">
        <el-icon><Plus /></el-icon> 新增客户
      </el-button>
    </div>
    <div class="card">
      <div class="filter-bar">
        <el-input v-model="search" placeholder="搜索名称/编号/电话..." style="width:240px" :prefix-icon="Search" clearable @change="loadData" />
        <el-select v-model="filterType" placeholder="客户类型" clearable style="width:140px" @change="loadData">
          <el-option label="个人客户" value="individual" />
          <el-option label="企业客户" value="company" />
          <el-option label="政府机构" value="government" />
          <el-option label="社会组织" value="organization" />
        </el-select>
        <el-select v-model="filterVip" placeholder="会员等级" clearable style="width:120px" @change="loadData">
          <el-option label="普通" value="normal" />
          <el-option label="白银" value="silver" />
          <el-option label="黄金" value="gold" />
          <el-option label="铂金" value="platinum" />
          <el-option label="钻石" value="diamond" />
        </el-select>
      </div>
      <el-table :data="clients" v-loading="loading">
        <el-table-column prop="client_no" label="客户编号" width="130" fixed="left" />
        <el-table-column label="客户信息" min-width="200">
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:10px">
              <el-avatar :size="36" :style="{ background: vipBg(row.vip_level), color: '#fff' }">
                {{ row.client_name?.charAt(0) }}
              </el-avatar>
              <div>
                <div style="font-weight:500;color:#2d3748">
                  {{ row.client_name }}
                  <el-tag size="small" effect="dark" v-if="row.vip_level !== 'normal'" :type="vipTag(row.vip_level)" style="margin-left:6px">
                    {{ row.vip_level_display }}
                  </el-tag>
                </div>
                <div style="color:#718096;font-size:12px;margin-top:2px">
                  {{ row.contact_person || row.client_type_display }} · {{ row.phone || '无电话' }}
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" width="180" show-overflow-tooltip />
        <el-table-column label="案件数" width="80" align="right" prop="total_case_count" />
        <el-table-column label="累计律师费" width="130" align="right">
          <template #default="{ row }">¥{{ (row.total_fee_amount || 0).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="待收金额" width="130" align="right">
          <template #default="{ row }">
            <span :style="{ color: row.unpaid_amount > 0 ? '#e53e3e' : '#38a169' }">
              ¥{{ (row.unpaid_amount || 0).toLocaleString() }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="客户经理" width="110">
          <template #default="{ row }">{{ row.account_manager_info?.full_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="客户门户" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.portal_enabled"
              :disabled="!canManagePortal"
              @change="(v:boolean)=>togglePortal(row, v)"
              size="small"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="edit(row)">编辑</el-button>
            <el-button link size="small" @click="viewCase(row)">案件</el-button>
            <el-button type="success" link size="small" @click="goBilling(row)">结算</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </div>

    <el-dialog v-model="showForm" :title="isEdit ? '编辑客户' : '新增客户'" width="640px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="110px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="客户类型" prop="client_type">
              <el-select v-model="form.client_type" style="width:100%">
                <el-option label="个人客户" value="individual" />
                <el-option label="企业客户" value="company" />
                <el-option label="政府机构" value="government" />
                <el-option label="社会组织" value="organization" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="会员等级" prop="vip_level">
              <el-select v-model="form.vip_level" style="width:100%">
                <el-option label="普通" value="normal" />
                <el-option label="白银" value="silver" />
                <el-option label="黄金" value="gold" />
                <el-option label="铂金" value="platinum" />
                <el-option label="钻石" value="diamond" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户名称" prop="client_name">
              <el-input v-model="form.client_name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="证件号码" prop="id_no">
              <el-input v-model="form.id_no" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人/法人" prop="contact_person">
              <el-input v-model="form.contact_person" placeholder="个人填联系人，企业填法人" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="form.phone" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电子邮箱">
              <el-input v-model="form.email" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户经理">
              <el-select v-model="form.account_manager" clearable filterable style="width:100%">
                <el-option v-for="u in userList" :key="u.id" :label="u.full_name" :value="u.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="通讯地址">
              <el-input v-model="form.address" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="税号">
              <el-input v-model="form.tax_no" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户来源">
              <el-input v-model="form.source" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { clientApi, userApi } from '@/api/modules'
import { useUserStore } from '@/stores/user'
import type { Client } from '@/types'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const clients = ref<Client[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const search = ref('')
const filterType = ref('')
const filterVip = ref('')
const userList = ref<any[]>([])

const showForm = ref(false)
const isEdit = ref(false)
const currentClient = ref<Client | null>(null)
const canManagePortal = computed(() => userStore.isPartner)

const defaultForm = () => ({
  client_name: '', client_type: 'individual', vip_level: 'normal',
  id_type: 'id_card', id_no: '', is_company: false,
  contact_person: '', phone: '', email: '', address: '',
  account_manager: null as number | null, tax_no: '', source: '',
  remark: '', contact_position: '', legal_representative: '',
  industry: '', bank_name: '', bank_account: '', wechat: '',
  emergency_contact: '', emergency_phone: ''
})
const form = reactive<any>(defaultForm())
const rules: FormRules = {
  client_name: [{ required: true, message: '请输入客户名称' }],
  client_type: [{ required: true, message: '请选择客户类型' }],
}

function vipBg(l: string) {
  return ({ normal: '#718096', silver: '#a0aec0', gold: '#d69e2e', platinum: '#4299e1', diamond: '#805ad5' } as any)[l] || '#718096'
}
function vipTag(l: string) {
  return ({ normal: 'info', silver: 'info', gold: 'warning', platinum: 'primary', diamond: 'success' } as any)[l] || 'info'
}

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, page_size: pageSize.value }
    if (search.value) params.search = search.value
    if (filterType.value) params.client_type = filterType.value
    if (filterVip.value) params.vip_level = filterVip.value
    const r = await clientApi.list(params) as any
    clients.value = r.data?.results || []
    total.value = r.data?.count || 0
  } finally { loading.value = false }
}

function edit(row: Client) {
  currentClient.value = row
  isEdit.value = true
  Object.assign(form, {
    client_name: row.client_name, client_type: row.client_type, vip_level: row.vip_level,
    id_no: row.id_no, contact_person: row.contact_person || row.legal_representative,
    phone: row.phone, email: row.email, address: row.address,
    account_manager: row.account_manager ? (row.account_manager as any).id || row.account_manager : null,
    tax_no: row.tax_no, source: row.source, remark: row.remark || ''
  })
  showForm.value = true
}

async function submitForm() {
  if (!formRef.value) return
  await formRef.value.validate()
  submitting.value = true
  try {
    if (isEdit.value && currentClient.value) {
      await clientApi.update(currentClient.value.id, form)
      ElMessage.success('更新成功')
    } else {
      await clientApi.create(form)
      ElMessage.success('创建成功')
    }
    showForm.value = false
    await loadData()
  } catch (e: any) { ElMessage.error(e.message) }
  finally { submitting.value = false }
}

async function togglePortal(row: Client, enabled: boolean) {
  if (enabled) {
    ElMessage.info('请联系管理员为该客户开通客户门户')
  } else {
    await clientApi.disablePortal(row.id)
    ElMessage.success('已关闭门户')
  }
  await loadData()
}

function viewCase(row: Client) { router.push(`/cases?client=${row.id}`) }
function goBilling(row: Client) { router.push(`/billing?client=${row.id}`) }

onMounted(async () => {
  await Promise.all([
    loadData(),
    userApi.lawyers().then(r => { userList.value = r.data })
  ])
})
</script>

<style lang="scss" scoped>
.client-manage {
  .pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
