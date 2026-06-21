<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Setting,
  User,
  Lock,
  Bell,
  DataLine,
  UploadFilled
} from '@element-plus/icons-vue'

const activeTab = ref('user')

const userForm = ref({
  username: 'declarant001',
  name: '张申报员',
  email: 'zhang@company.com',
  phone: '138****8888',
  enterpriseName: '杭州跨境贸易有限公司',
  role: '企业申报员'
})

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const notifyForm = ref({
  emailNotice: true,
  smsNotice: false,
  exceptionNotice: true,
  reviewNotice: true,
  taxNotice: true
})

const systemSettings = ref({
  pageSize: 20,
  defaultPlatform: 'amazon',
  autoSaveDraft: true,
  autoSaveInterval: 5,
  dateFormat: 'YYYY-MM-DD HH:mm:ss'
})

function saveUser() {
  ElMessage.success('个人信息已保存')
}

function savePassword() {
  if (!passwordForm.value.oldPassword) {
    ElMessage.warning('请输入原密码')
    return
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  ElMessage.success('密码修改成功')
  passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
}

function saveNotify() {
  ElMessage.success('通知设置已保存')
}

function saveSystem() {
  ElMessage.success('系统设置已保存')
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">
        <el-icon style="margin-right: 8px"><Setting /></el-icon>
        系统设置
      </div>
    </div>

    <div class="card" style="min-height: calc(100vh - 140px)">
      <el-tabs v-model="activeTab" tab-position="left" style="min-height: 500px">
        <el-tab-pane label="个人信息" name="user">
          <template #label>
            <span style="display: flex; align-items: center; gap: 6px">
              <el-icon><User /></el-icon>个人信息
            </span>
          </template>
          <div style="max-width: 560px">
            <el-form :model="userForm" label-width="100px" label-position="right">
              <el-form-item label="用户名">
                <el-input v-model="userForm.username" disabled />
              </el-form-item>
              <el-form-item label="姓名">
                <el-input v-model="userForm.name" />
              </el-form-item>
              <el-form-item label="邮箱">
                <el-input v-model="userForm.email" />
              </el-form-item>
              <el-form-item label="手机号">
                <el-input v-model="userForm.phone" />
              </el-form-item>
              <el-form-item label="企业名称">
                <el-input v-model="userForm.enterpriseName" disabled />
              </el-form-item>
              <el-form-item label="角色">
                <el-input v-model="userForm.role" disabled />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveUser">保存修改</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="修改密码" name="password">
          <template #label>
            <span style="display: flex; align-items: center; gap: 6px">
              <el-icon><Lock /></el-icon>修改密码
            </span>
          </template>
          <div style="max-width: 480px">
            <el-form :model="passwordForm" label-width="100px" label-position="right">
              <el-form-item label="原密码">
                <el-input v-model="passwordForm.oldPassword" type="password" show-password />
              </el-form-item>
              <el-form-item label="新密码">
                <el-input v-model="passwordForm.newPassword" type="password" show-password />
              </el-form-item>
              <el-form-item label="确认密码">
                <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="savePassword">确认修改</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="通知设置" name="notify">
          <template #label>
            <span style="display: flex; align-items: center; gap: 6px">
              <el-icon><Bell /></el-icon>通知设置
            </span>
          </template>
          <div style="max-width: 560px">
            <el-form :model="notifyForm" label-position="right" label-width="160px">
              <el-form-item label="邮件通知">
                <el-switch v-model="notifyForm.emailNotice" />
              </el-form-item>
              <el-form-item label="短信通知">
                <el-switch v-model="notifyForm.smsNotice" />
              </el-form-item>
              <el-form-item label="通关异常提醒">
                <el-switch v-model="notifyForm.exceptionNotice" />
                <span style="color: #909399; margin-left: 10px; font-size: 13px">
                  出现通关异常时第一时间提醒
                </span>
              </el-form-item>
              <el-form-item label="审核结果通知">
                <el-switch v-model="notifyForm.reviewNotice" />
              </el-form-item>
              <el-form-item label="退税进度通知">
                <el-switch v-model="notifyForm.taxNotice" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveNotify">保存设置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="通用设置" name="system">
          <template #label>
            <span style="display: flex; align-items: center; gap: 6px">
              <el-icon><DataLine /></el-icon>通用设置
            </span>
          </template>
          <div style="max-width: 560px">
            <el-form :model="systemSettings" label-position="right" label-width="160px">
              <el-form-item label="列表默认分页">
                <el-select v-model="systemSettings.pageSize">
                  <el-option :label="10" :value="10" />
                  <el-option :label="20" :value="20" />
                  <el-option :label="50" :value="50" />
                  <el-option :label="100" :value="100" />
                </el-select>
              </el-form-item>
              <el-form-item label="默认销售平台">
                <el-select v-model="systemSettings.defaultPlatform">
                  <el-option label="亚马逊" value="amazon" />
                  <el-option label="eBay" value="ebay" />
                  <el-option label="速卖通" value="aliexpress" />
                  <el-option label="Wish" value="wish" />
                </el-select>
              </el-form-item>
              <el-form-item label="自动保存草稿">
                <el-switch v-model="systemSettings.autoSaveDraft" />
              </el-form-item>
              <el-form-item label="自动保存间隔(分钟)">
                <el-input-number v-model="systemSettings.autoSaveInterval" :min="1" :max="30" />
              </el-form-item>
              <el-form-item label="日期时间格式">
                <el-select v-model="systemSettings.dateFormat">
                  <el-option label="YYYY-MM-DD HH:mm:ss" value="YYYY-MM-DD HH:mm:ss" />
                  <el-option label="YYYY/MM/DD HH:mm:ss" value="YYYY/MM/DD HH:mm:ss" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveSystem">保存设置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="操作日志" name="log">
          <template #label>
            <span style="display: flex; align-items: center; gap: 6px">
              <el-icon><UploadFilled /></el-icon>操作日志
            </span>
          </template>
          <el-table :data="[
            { time: '2024-06-22 14:30:00', action: '提交申报单', target: 'CB202406220003', ip: '192.168.1.101' },
            { time: '2024-06-22 10:15:00', action: '修改申报单', target: 'CB202406220001', ip: '192.168.1.101' },
            { time: '2024-06-21 16:45:00', action: '收藏HS编码', target: '85171210', ip: '192.168.1.101' },
            { time: '2024-06-21 14:20:00', action: '退税计算', target: '批量5条', ip: '192.168.1.101' }
          ]" border stripe>
            <el-table-column prop="time" label="操作时间" width="180" />
            <el-table-column prop="action" label="操作类型" width="140" />
            <el-table-column prop="target" label="操作对象" />
            <el-table-column prop="ip" label="IP地址" width="160" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
  height: 100%;
  overflow: auto;
}

.page-header {
  margin-bottom: 16px;

  .page-title {
    font-size: $font-size-xl;
    font-weight: 600;
    display: flex;
    align-items: center;
  }
}
</style>
