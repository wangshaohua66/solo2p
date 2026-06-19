<template>
  <div class="user-profile">
    <div class="page-header">
      <h2 class="page-title">个人中心</h2>
    </div>
    <el-row :gutter="16">
      <el-col :span="8">
        <div class="card profile-card">
          <div class="avatar-area">
            <el-avatar :size="88" :style="{ background: user?.role ? roleBg(user.role) : '#718096', color: '#fff', fontSize: '32px', fontWeight: 600 }">
              {{ user?.full_name?.charAt(0) }}
            </el-avatar>
            <h3 style="margin:12px 0 6px;font-size:18px;color:#2d3748">{{ user?.full_name }}</h3>
            <el-tag :type="roleTag(user?.role || '')" size="small" effect="dark">{{ user?.role_display }}</el-tag>
          </div>
          <el-descriptions :column="1" size="small" style="margin-top:20px">
            <el-descriptions-item label="工号">{{ user?.employee_no }}</el-descriptions-item>
            <el-descriptions-item label="执业证号">{{ user?.license_no || '-' }}</el-descriptions-item>
            <el-descriptions-item label="部门">{{ user?.department || '-' }}</el-descriptions-item>
            <el-descriptions-item label="专业方向">{{ user?.specialty || '-' }}</el-descriptions-item>
            <el-descriptions-item label="小时费率">{{ user?.hourly_rate ? `¥${user.hourly_rate}/h` : '-' }}</el-descriptions-item>
            <el-descriptions-item label="入职日期">{{ user?.hire_date || '-' }}</el-descriptions-item>
          </el-descriptions>
          <div class="stats-row" style="margin-top:20px;padding-top:20px;border-top:1px solid #edf2f7">
            <div class="stat-item">
              <div class="stat-val" style="color:#4299e1">{{ stat.cases || 0 }}</div>
              <div class="stat-lab">主办案件</div>
            </div>
            <div class="stat-item">
              <div class="stat-val" style="color:#38a169">{{ stat.hours || 0 }}</div>
              <div class="stat-lab">本月工时</div>
            </div>
            <div class="stat-item">
              <div class="stat-val" style="color:#805ad5">{{ stat.docs || 0 }}</div>
              <div class="stat-lab">生成文书</div>
            </div>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <h3 style="margin:0 0 16px;font-size:15px;color:#2d3748;padding-bottom:12px;border-bottom:1px solid #edf2f7">快捷入口</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <el-tag size="large" style="padding:8px 14px;cursor:pointer" @click="$router.push('/calendar')">📅 我的庭审</el-tag>
            <el-tag size="large" style="padding:8px 14px;cursor:pointer" @click="$router.push('/evidence')">📁 我的证据</el-tag>
            <el-tag size="large" style="padding:8px 14px;cursor:pointer" @click="$router.push('/billing')">⏰ 我的工时</el-tag>
            <el-tag size="large" style="padding:8px 14px;cursor:pointer" @click="$router.push('/templates')">📝 文书模板</el-tag>
          </div>
        </div>
      </el-col>
      <el-col :span="16">
        <div class="card">
          <el-tabs v-model="activeTab">
            <el-tab-pane label="基本信息" name="info">
              <el-form :model="form" label-width="100px" style="max-width:560px">
                <el-row :gutter="12">
                  <el-col :span="12"><el-form-item label="姓名"><el-input v-model="form.full_name" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="账号"><el-input v-model="form.username" disabled /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="手机"><el-input v-model="form.phone" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="部门">
                    <el-select v-model="form.department" style="width:100%"><el-option v-for="d in depts" :key="d" :label="d" :value="d" /></el-select>
                  </el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="专业"><el-input v-model="form.specialty" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="执业证号"><el-input v-model="form.license_no" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="QQ/微信"><el-input v-model="form.wechat" /></el-form-item></el-col>
                  <el-col :span="24"><el-form-item label="办公地址"><el-input v-model="form.office_address" /></el-form-item></el-col>
                  <el-col :span="24"><el-form-item label="个人简介"><el-input v-model="form.bio" type="textarea" :rows="4" /></el-form-item></el-col>
                </el-row>
                <el-button type="primary" @click="saveProfile">保存修改</el-button>
              </el-form>
            </el-tab-pane>
            <el-tab-pane label="修改密码" name="pwd">
              <el-form :model="pwdForm" label-width="120px" style="max-width:460px">
                <el-form-item label="原密码"><el-input v-model="pwdForm.old_password" show-password /></el-form-item>
                <el-form-item label="新密码"><el-input v-model="pwdForm.new_password" show-password /></el-form-item>
                <el-form-item label="确认密码"><el-input v-model="pwdForm.confirm_password" show-password /></el-form-item>
                <el-button type="primary" @click="changePwd">提交</el-button>
              </el-form>
            </el-tab-pane>
            <el-tab-pane label="审批记录" name="approval">
              <el-empty description="暂无审批记录" />
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { userApi } from '@/api/modules'

const userStore = useUserStore()
const user = ref<any>(userStore.user)
const activeTab = ref('info')
const depts = ['民商法律部', '刑事法律部', '行政法律部', '非诉业务部', '劳动法律部', '知识产权部', '婚姻家事部']
const stat = reactive({ cases: 0, hours: 0, docs: 0 })

const defaultForm = () => ({
  full_name: user.value?.full_name, username: user.value?.username,
  phone: user.value?.phone, email: user.value?.email,
  department: user.value?.department, specialty: user.value?.specialty,
  license_no: user.value?.license_no, wechat: user.value?.wechat,
  office_address: user.value?.office_address, bio: user.value?.bio,
})
const form = reactive<any>(defaultForm())
const pwdForm = reactive({ old_password: '', new_password: '', confirm_password: '' })

function roleBg(r: string) {
  return ({ admin: '#e53e3e', partner: '#d69e2e', lawyer: '#4299e1', assistant: '#718096', client: '#38a169' } as any)[r] || '#718096'
}
function roleTag(r: string) {
  return ({ admin: 'danger', partner: 'warning', lawyer: 'primary', assistant: 'info', client: 'success' } as any)[r] || ''
}

async function saveProfile() {
  try {
    const r = await userApi.updateProfile(form) as any
    ElMessage.success('保存成功')
    Object.assign(userStore.user || {}, form)
    userStore.saveUser(r.data || userStore.user)
  } catch (e: any) { ElMessage.error(e.message) }
}

async function changePwd() {
  if (!pwdForm.old_password || !pwdForm.new_password) return ElMessage.warning('请填写密码')
  if (pwdForm.new_password !== pwdForm.confirm_password) return ElMessage.warning('两次密码不一致')
  if (pwdForm.new_password.length < 8) return ElMessage.warning('密码至少8位')
  try {
    await userApi.changePassword(pwdForm)
    ElMessage.success('修改成功，请重新登录')
    pwdForm.old_password = pwdForm.new_password = pwdForm.confirm_password = ''
    userStore.logout()
  } catch (e: any) { ElMessage.error(e.message) }
}

onMounted(async () => {
  try {
    const r = await userApi.profile() as any
    user.value = r.data
    Object.assign(form, r.data || {})
    Object.assign(userStore.user || {}, r.data || {})
  } catch {}
})
</script>

<style lang="scss" scoped>
.user-profile {
  .profile-card { text-align: center; }
  .avatar-area {
    padding: 10px 0;
  }
  .stats-row {
    display: flex;
    justify-content: space-around;
    .stat-item { text-align: center; }
    .stat-val { font-size: 22px; font-weight: 600; }
    .stat-lab { color: #718096; font-size: 12px; margin-top: 4px; }
  }
}
</style>
