<template>
  <div class="settings-page">
    <el-tabs v-model="activeTab" class="settings-tabs" type="card">
      <el-tab-pane label="用户管理" name="user">
        <template #label>
          <span class="tab-label"><el-icon><User /></el-icon>用户管理</span>
        </template>
        <div class="tab-content">
          <div class="tab-toolbar">
            <el-input
              v-model="userSearch"
              placeholder="搜索姓名 / 账号 / 手机"
              :prefix-icon="Search"
              class="search-input"
              clearable
            />
            <div class="toolbar-right">
              <el-select v-model="userRoleFilter" placeholder="角色筛选" clearable class="filter-select">
                <el-option v-for="(label, code) in roleMap" :key="code" :label="label" :value="code" />
              </el-select>
              <el-button type="primary" :icon="Plus" class="action-btn" @click="openUserDialog()">新增用户</el-button>
            </div>
          </div>

          <div class="panel">
            <el-table :data="filteredUsers" border stripe class="data-table">
              <el-table-column prop="name" label="姓名" width="110">
                <template #default="{ row }">
                  <div class="user-cell">
                    <div class="user-avatar">{{ row.name.charAt(0) }}</div>
                    <span>{{ row.name }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="username" label="账号" width="140">
                <template #default="{ row }">
                  <span class="mono-text">{{ row.username }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="role" label="角色" width="140">
                <template #default="{ row }">
                  <el-tag size="small" effect="plain" class="role-tag" :class="row.role">
                    {{ roleMap[row.role] || row.role }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="department" label="部门" width="140" />
              <el-table-column prop="phone" label="手机" width="140">
                <template #default="{ row }">
                  <span class="mono-text">{{ row.phone }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.status === 'active'" type="success" size="small">在职</el-tag>
                  <el-tag v-else type="info" size="small">停用</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="lastLoginTime" label="最近登录" width="170">
                <template #default="{ row }">
                  <span v-if="row.lastLoginTime" class="mono-text">{{ row.lastLoginTime }}</span>
                  <span v-else class="text-muted">未登录</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="220" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="openUserDialog(row)">编辑</el-button>
                  <el-button
                    :type="row.status === 'active' ? 'warning' : 'success'"
                    link
                    size="small"
                    @click="toggleUserStatus(row)"
                  >
                    {{ row.status === 'active' ? '停用' : '启用' }}
                  </el-button>
                  <el-button type="primary" link size="small" @click="resetPassword(row)">重置密码</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="table-pagination">
              <el-pagination
                v-model:current-page="userPage.page"
                v-model:page-size="userPage.pageSize"
                :page-sizes="[10, 20, 50]"
                :total="filteredUsers.length"
                layout="total, sizes, prev, pager, next, jumper"
                background
              />
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="角色权限" name="role">
        <template #label>
          <span class="tab-label"><el-icon><Lock /></el-icon>角色权限</span>
        </template>
        <div class="tab-content role-content">
          <div class="role-sidebar panel">
            <div class="sidebar-header">
              <span class="sidebar-title">角色列表</span>
              <el-button type="primary" link :icon="Plus" size="small" @click="addRole">新增角色</el-button>
            </div>
            <div class="role-list">
              <div
                v-for="role in roles"
                :key="role.id"
                class="role-item"
                :class="{ active: selectedRoleId === role.id }"
                @click="selectRole(role.id)"
              >
                <div class="role-item-name">
                  <el-icon><UserFilled /></el-icon>
                  {{ role.name }}
                </div>
                <div class="role-item-desc">{{ role.description }}</div>
                <div class="role-item-meta">
                  <span class="perm-count">{{ role.permissions.length }} 权限</span>
                  <el-tag v-if="role.status === 'active'" type="success" size="small" effect="plain">启用</el-tag>
                  <el-tag v-else type="info" size="small" effect="plain">停用</el-tag>
                </div>
              </div>
            </div>
          </div>

          <div class="role-main panel">
            <div v-if="selectedRole" class="perm-editor">
              <div class="perm-header">
                <div>
                  <h3 class="perm-title">{{ selectedRole.name }} - 权限配置</h3>
                  <div class="perm-desc">{{ selectedRole.description }}</div>
                </div>
                <div class="perm-actions">
                  <el-button @click="resetRolePerm">重置</el-button>
                  <el-button type="primary" @click="saveRolePerm" class="save-btn">
                    <el-icon><Check /></el-icon>
                    保存配置
                  </el-button>
                </div>
              </div>

              <div class="perm-toolbar">
                <el-checkbox v-model="permSelectAll" :indeterminate="permIndeterminate" @change="handlePermSelectAll">
                  全选 / 全不选
                </el-checkbox>
                <div class="quick-actions">
                  <el-button size="small" link @click="checkByModule('business')">全选业务</el-button>
                  <el-button size="small" link @click="checkByModule('dispatch')">全选调度</el-button>
                  <el-button size="small" link @click="checkByModule('cemetery')">全选墓园</el-button>
                  <el-button size="small" link @click="checkByModule('report')">全选报表</el-button>
                  <el-button size="small" link @click="checkByModule('system')">全选系统</el-button>
                </div>
              </div>

              <el-tree
                ref="permTreeRef"
                :data="permissionTree"
                show-checkbox
                node-key="code"
                :default-checked-keys="selectedRole.permissions.filter(p => p !== 'all')"
                :props="{ label: 'name', children: 'children' }"
                class="perm-tree"
                @check="handlePermCheck"
              >
                <template #default="{ node, data }">
                  <span class="tree-node">
                    <el-icon v-if="data.type === 'module'" class="module-icon"><FolderOpened /></el-icon>
                    <el-icon v-else-if="data.type === 'menu'" class="menu-icon"><Menu /></el-icon>
                    <el-icon v-else class="action-icon"><Operation /></el-icon>
                    <span class="node-label">{{ node.label }}</span>
                    <el-tag v-if="data.type === 'action'" size="small" type="info" effect="plain" class="action-tag">操作</el-tag>
                  </span>
                </template>
              </el-tree>
            </div>
            <el-empty v-else description="请选择角色配置权限" class="empty-perm" />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="服务项目" name="service">
        <template #label>
          <span class="tab-label"><el-icon><Goods /></el-icon>服务项目</span>
        </template>
        <div class="tab-content">
          <el-tabs v-model="serviceCategory" class="service-category-tabs">
            <el-tab-pane label="接运服务" name="transport" />
            <el-tab-pane label="冷藏服务" name="refrigeration" />
            <el-tab-pane label="整容服务" name="cosmetic" />
            <el-tab-pane label="告别服务" name="farewell" />
            <el-tab-pane label="火化服务" name="cremation" />
            <el-tab-pane label="其他服务" name="other" />
          </el-tabs>

          <div class="panel">
            <div class="service-toolbar">
              <span class="total-tip">共 <b class="gold">{{ filteredServices.length }}</b> 个服务项目</span>
              <div class="toolbar-right">
                <el-switch v-model="showOnlyActive" active-text="仅显示启用" />
                <el-button type="primary" :icon="Plus" size="default" @click="openServiceDialog()">新增项目</el-button>
              </div>
            </div>
            <el-table :data="filteredServices" border stripe class="data-table">
              <el-table-column prop="code" label="编码" width="110">
                <template #default="{ row }">
                  <span class="mono-text">{{ row.code }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="name" label="项目名称" min-width="200">
                <template #default="{ row }">
                  <div class="svc-name-cell">
                    {{ row.name }}
                    <el-tag
                      v-if="row.isGovernmentPrice"
                      type="success"
                      size="small"
                      effect="plain"
                    >政府定价</el-tag>
                    <el-tag
                      v-if="row.subsidyType"
                      type="warning"
                      size="small"
                      effect="plain"
                    >可补贴</el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="unit" label="单位" width="80" align="center" />
              <el-table-column prop="price" label="价格(元)" width="120" align="right">
                <template #default="{ row }">
                  <span class="money-text fw6">¥{{ row.price.toLocaleString() }}</span>
                </template>
              </el-table-column>
              <el-table-column label="政府指导价" width="120" align="right">
                <template #default="{ row }">
                  <span v-if="row.governmentGuidePrice" class="gov-price">¥{{ row.governmentGuidePrice.toLocaleString() }}</span>
                  <span v-else class="text-muted">-</span>
                </template>
              </el-table-column>
              <el-table-column label="补贴" width="100" align="right">
                <template #default="{ row }">
                  <span v-if="row.subsidyAmount" class="subsidy-text">¥{{ row.subsidyAmount }}</span>
                  <span v-else class="text-muted">-</span>
                </template>
              </el-table-column>
              <el-table-column label="生效日期" width="140">
                <template #default="{ row }">
                  <span class="mono-text">{{ row.effectiveDate }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100" align="center">
                <template #default="{ row }">
                  <el-switch
                    v-model="row.status"
                    active-value="active"
                    inactive-value="inactive"
                    inline-prompt
                    active-text="启用"
                    inactive-text="停用"
                    @change="onServiceStatusChange(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="160" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="openServiceDialog(row)">编辑价格</el-button>
                  <el-button type="primary" link size="small" @click="viewHistory(row)">调价历史</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="价格标准" name="price">
        <template #label>
          <span class="tab-label"><el-icon><Money /></el-icon>价格标准</span>
        </template>
        <div class="tab-content">
          <div class="price-header panel">
            <div class="price-summary">
              <div class="summary-card">
                <div class="summary-label">服务项目总数</div>
                <div class="summary-value gold-text">{{ priceStandards.length }}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">政府定价项目</div>
                <div class="summary-value">{{ priceStandards.filter(p => p.isGovernmentPrice).length }}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">市场价项目</div>
                <div class="summary-value">{{ priceStandards.filter(p => !p.isGovernmentPrice).length }}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">可补贴项目</div>
                <div class="summary-value success-text">{{ priceStandards.filter(p => p.subsidyType).length }}</div>
              </div>
            </div>
            <div class="price-tip">
              <el-icon><InfoFilled /></el-icon>
              <span>政府指导价项目需在物价局备案，市场价项目可根据实际情况浮动调整</span>
            </div>
          </div>

          <div class="panel">
            <div class="panel-inner-toolbar">
              <el-input
                v-model="priceSearch"
                placeholder="搜索项目名称 / 编码"
                :prefix-icon="Search"
                class="search-input"
                clearable
              />
              <div class="toolbar-right">
                <el-button :icon="Refresh" @click="loadPrices">刷新</el-button>
                <el-button type="primary" :icon="Plus" @click="openPriceDialog()">新增标准</el-button>
                <el-button :icon="Upload" @click="importPrices">批量导入</el-button>
                <el-button :icon="Download" @click="exportPrices">导出</el-button>
              </div>
            </div>
            <el-table :data="filteredPrices" border stripe class="data-table">
              <el-table-column prop="category" label="分类" width="110">
                <template #default="{ row }">{{ serviceCategoryMap[row.category] || row.category }}</template>
              </el-table-column>
              <el-table-column prop="code" label="编码" width="110">
                <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
              </el-table-column>
              <el-table-column prop="name" label="项目名称" min-width="200">
                <template #default="{ row }">
                  <div class="svc-name-cell">
                    {{ row.name }}
                    <el-tag
                      v-if="row.isGovernmentPrice"
                      type="success"
                      size="small"
                      effect="plain"
                    >政府定价</el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="unit" label="单位" width="80" align="center" />
              <el-table-column label="政府指导价(元)" width="140" align="right">
                <template #default="{ row }">
                  <span v-if="row.governmentGuidePrice" class="gov-price">¥{{ row.governmentGuidePrice.toLocaleString() }}</span>
                  <span v-else class="text-muted">-</span>
                </template>
              </el-table-column>
              <el-table-column prop="price" label="当前市场价(元)" width="140" align="right">
                <template #default="{ row }">
                  <span class="money-text fw6">¥{{ row.price.toLocaleString() }}</span>
                </template>
              </el-table-column>
              <el-table-column label="偏离度" width="100" align="center">
                <template #default="{ row }">
                  <span
                    v-if="row.governmentGuidePrice"
                    :class="getDeviationClass(row)"
                  >
                    {{ getDeviation(row) }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </template>
              </el-table-column>
              <el-table-column label="补贴" width="90" align="right">
                <template #default="{ row }">
                  <span v-if="row.subsidyAmount" class="subsidy-text">¥{{ row.subsidyAmount }}</span>
                  <span v-else class="text-muted">-</span>
                </template>
              </el-table-column>
              <el-table-column label="有效期" width="160">
                <template #default="{ row }">
                  <span class="mono-text">
                    {{ row.effectiveDate }}
                    {{ row.expireDate ? ' ~ ' + row.expireDate : ' 起' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="90" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.status === 'active'" type="success" size="small">启用</el-tag>
                  <el-tag v-else type="info" size="small">停用</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="180" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="openPriceDialog(row)">编辑</el-button>
                  <el-button type="primary" link size="small" @click="comparePrice(row)">对比分析</el-button>
                  <el-button type="danger" link size="small" @click="deletePrice(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="通知配置" name="notice">
        <template #label>
          <span class="tab-label"><el-icon><Bell /></el-icon>通知配置</span>
        </template>
        <div class="tab-content">
          <div class="notice-tabs-bar">
            <div
              v-for="t in noticeTypeTabs"
              :key="t.type"
              class="notice-type-tab"
              :class="{ active: noticeType === t.type }"
              @click="noticeType = t.type"
            >
              <el-icon class="tab-type-icon" :class="t.type"><component :is="t.icon" /></el-icon>
              <span class="tab-type-label">{{ t.label }}</span>
              <span class="tab-type-count">
                {{ templates.filter(nt => nt.type === t.type).length }} 模板
              </span>
            </div>
          </div>

          <div class="panel">
            <div class="notice-toolbar">
              <span class="total-tip">
                已启用 <b class="success">{{ templates.filter(t => t.enabled && t.type === noticeType).length }}</b> /
                共 <b>{{ templates.filter(t => t.type === noticeType).length }}</b> 个模板
              </span>
              <el-button type="primary" :icon="Plus" @click="openNoticeDialog()">新增模板</el-button>
            </div>
            <div class="template-list">
              <div
                v-for="tpl in templates.filter(t => t.type === noticeType)"
                :key="tpl.id"
                class="template-card"
              >
                <div class="template-header">
                  <div class="template-title-row">
                    <h4 class="template-title">{{ tpl.sceneLabel }}</h4>
                    <el-switch
                      v-model="tpl.enabled"
                      inline-prompt
                      active-text="启用"
                      inactive-text="停用"
                      @change="onTplToggle(tpl)"
                    />
                  </div>
                  <div class="template-code">
                    <el-tag size="small" type="warning" effect="plain">{{ tpl.scene }}</el-tag>
                    <span class="update-time">更新于 {{ tpl.updateTime }}</span>
                  </div>
                </div>
                <div class="template-body">
                  <div class="tpl-field">
                    <span class="tpl-label">标题：</span>
                    <span class="tpl-value">{{ tpl.title }}</span>
                  </div>
                  <div class="tpl-field content-field">
                    <span class="tpl-label">内容：</span>
                    <div class="tpl-value content-text">{{ tpl.content }}</div>
                  </div>
                  <div class="tpl-field variables-field">
                    <span class="tpl-label">变量：</span>
                    <div class="tpl-tags">
                      <el-tag
                        v-for="v in tpl.variables"
                        :key="v"
                        size="small"
                        effect="dark"
                        type="info"
                        class="var-tag"
                      >{{ '{' + v + '}' }}</el-tag>
                    </div>
                  </div>
                </div>
                <div class="template-footer">
                  <el-button type="primary" link size="small" :icon="View" @click="previewTpl(tpl)">预览</el-button>
                  <el-button type="primary" link size="small" :icon="Edit" @click="openNoticeDialog(tpl)">编辑</el-button>
                  <el-button type="primary" link size="small" :icon="CopyDocument" @click="copyTpl(tpl)">复制</el-button>
                  <el-button type="primary" link size="small" :icon="Switch" @click="testSend(tpl)">发送测试</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="userDialogVisible"
      :title="editingUser ? '编辑用户' : '新增用户'"
      width="520px"
    >
      <el-form ref="userFormRef" :model="userForm" :rules="userRules" label-width="90px" class="dialog-form">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="userForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="账号" prop="username">
          <el-input v-model="userForm.username" placeholder="请输入登录账号" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="userForm.role" placeholder="选择角色" class="w-full">
            <el-option v-for="(label, code) in roleMap" :key="code" :label="label" :value="code" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门" prop="department">
          <el-input v-model="userForm.department" placeholder="请输入部门" />
        </el-form-item>
        <el-form-item label="手机" prop="phone">
          <el-input v-model="userForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="userForm.email" placeholder="请输入邮箱(选填)" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="userForm.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="userForm.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitUser">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import {
  Search,
  Plus,
  User,
  Lock,
  UserFilled,
  Check,
  FolderOpened,
  Menu,
  Operation,
  Goods,
  Money,
  InfoFilled,
  Bell,
  Edit,
  View,
  CopyDocument,
  Switch as SwitchIcon,
  Refresh,
  Upload,
  Download,
  ChatDotRound,
  Message,
  Promotion
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { mockUsers, mockRoles, mockPermissionTree, mockNotificationTemplates } from '@/mock/settings'
import { mockPriceStandards } from '@/mock/billing'
import { roleMap, serviceCategoryMap } from '@/utils/status'
import type { SystemUser, Role, PermissionNode, NotificationTemplate } from '@/types/settings'
import type { PriceStandard } from '@/types/billing'

const activeTab = ref('user')

const userSearch = ref('')
const userRoleFilter = ref('')
const users = ref<SystemUser[]>([...mockUsers])
const userPage = reactive({ page: 1, pageSize: 10 })

const filteredUsers = computed(() =>
  users.value.filter((u) => {
    if (userSearch.value) {
      const kw = userSearch.value.toLowerCase()
      if (!u.name.includes(userSearch.value) && !u.username.toLowerCase().includes(kw) && !u.phone.includes(kw)) {
        return false
      }
    }
    if (userRoleFilter.value && u.role !== userRoleFilter.value) return false
    return true
  })
)

const userDialogVisible = ref(false)
const editingUser = ref<SystemUser | null>(null)
const userForm = reactive<Partial<SystemUser>>({
  name: '',
  username: '',
  role: 'funeral_attendant',
  department: '',
  phone: '',
  email: '',
  status: 'active',
  remark: ''
})
const userFormRef = ref<FormInstance>()
const userRules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  department: [{ required: true, message: '请输入部门', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ]
}

function openUserDialog(row?: SystemUser) {
  editingUser.value = row || null
  if (row) {
    Object.assign(userForm, row)
  } else {
    Object.assign(userForm, {
      name: '',
      username: '',
      role: 'funeral_attendant',
      department: '',
      phone: '',
      email: '',
      status: 'active',
      remark: ''
    })
  }
  userDialogVisible.value = true
}

function submitUser() {
  userFormRef.value?.validate((ok) => {
    if (!ok) return
    if (editingUser.value) {
      const idx = users.value.findIndex((u) => u.id === editingUser.value!.id)
      if (idx >= 0) {
        users.value[idx] = { ...users.value[idx], ...userForm } as SystemUser
      }
      ElMessage.success('用户信息已更新')
    } else {
      const newUser: SystemUser = {
        id: `U${String(Date.now()).slice(-6)}`,
        name: userForm.name!,
        username: userForm.username!,
        role: userForm.role as any,
        department: userForm.department!,
        phone: userForm.phone!,
        email: userForm.email,
        status: userForm.status as any,
        createTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
        remark: userForm.remark
      }
      users.value.unshift(newUser)
      ElMessage.success('用户已新增')
    }
    userDialogVisible.value = false
  })
}

function toggleUserStatus(row: SystemUser) {
  const action = row.status === 'active' ? '停用' : '启用'
  ElMessageBox.confirm(`确定要${action}用户 "${row.name}" 吗？`, '确认操作', {
    type: 'warning'
  }).then(() => {
    row.status = row.status === 'active' ? 'inactive' : 'active'
    ElMessage.success(`已${action}用户`)
  }).catch(() => {})
}

function resetPassword(row: SystemUser) {
  ElMessageBox.confirm(`确定要重置 "${row.name}" 的密码为默认密码 (Abc123456) 吗？`, '重置密码', {
    type: 'warning'
  }).then(() => {
    ElMessage.success('密码已重置，短信已通知用户')
  }).catch(() => {})
}

const roles = ref<Role[]>([...mockRoles])
const selectedRoleId = ref<string>(roles.value[0]?.id || '')
const selectedRole = computed(() => roles.value.find((r) => r.id === selectedRoleId.value) || null)
const permissionTree = ref<PermissionNode[]>(mockPermissionTree)
const permTreeRef = ref<any>()
const permSelectAll = ref(false)
const permIndeterminate = ref(false)

function selectRole(id: string) {
  selectedRoleId.value = id
  nextTick(() => {
    const role = selectedRole.value
    if (role) {
      const allCodes = getAllLeafCodes(permissionTree.value)
      permSelectAll.value = role.permissions.includes('all') || role.permissions.length >= allCodes.length
      permIndeterminate.value = !permSelectAll.value && role.permissions.length > 0
    }
  })
}

function getAllLeafCodes(nodes: PermissionNode[]): string[] {
  const result: string[] = []
  function walk(arr: PermissionNode[]) {
    for (const n of arr) {
      if (n.children && n.children.length) walk(n.children)
      else result.push(n.code)
    }
  }
  walk(nodes)
  return result
}

function addRole() {
  ElMessageBox.prompt('请输入角色名称', '新增角色', {
    confirmButtonText: '确定',
    inputPlaceholder: '角色名称',
    inputValidator: (v) => v && v.trim().length > 0 || '请输入角色名称'
  }).then(({ value }) => {
    const nr: Role = {
      id: `R${String(Date.now()).slice(-6)}`,
      code: `custom_${Date.now()}`,
      name: value,
      description: '自定义角色',
      permissions: [],
      createTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
      status: 'active'
    }
    roles.value.push(nr)
    selectedRoleId.value = nr.id
    ElMessage.success('角色已创建')
  }).catch(() => {})
}

function handlePermSelectAll(val: boolean) {
  if (val) {
    permTreeRef.value?.setCheckedKeys(getAllLeafCodes(permissionTree.value))
    permIndeterminate.value = false
  } else {
    permTreeRef.value?.setCheckedKeys([])
    permIndeterminate.value = false
  }
}

function checkByModule(module: string) {
  const codes: string[] = []
  function walk(nodes: PermissionNode[]) {
    for (const n of nodes) {
      if (n.module === module) {
        codes.push(n.code)
        if (n.children) walk(n.children)
      } else if (n.children) {
        walk(n.children)
      }
    }
  }
  walk(permissionTree.value)
  const current = permTreeRef.value?.getCheckedKeys(false) || []
  const merged = Array.from(new Set([...current, ...codes.filter((c) => c.includes(':'))]))
  permTreeRef.value?.setCheckedKeys(merged)
}

function handlePermCheck() {
  nextTick(() => {
    const checked = permTreeRef.value?.getCheckedKeys(false)?.length || 0
    const all = getAllLeafCodes(permissionTree.value).length
    permSelectAll.value = checked === all
    permIndeterminate.value = checked > 0 && checked < all
  })
}

function resetRolePerm() {
  const role = selectedRole.value
  if (!role) return
  ElMessageBox.confirm('确定要重置为该角色的默认权限配置吗？', '确认', { type: 'warning' })
    .then(() => {
      permTreeRef.value?.setCheckedKeys(role.permissions.includes('all') ? getAllLeafCodes(permissionTree.value) : role.permissions.filter(p => p !== 'all'))
      ElMessage.success('已重置')
    })
    .catch(() => {})
}

function saveRolePerm() {
  const checkedKeys = permTreeRef.value?.getCheckedKeys(false) || []
  const halfKeys = permTreeRef.value?.getHalfCheckedKeys() || []
  if (selectedRole.value) {
    selectedRole.value.permissions = [...halfKeys, ...checkedKeys]
  }
  ElMessage.success('权限配置已保存')
}

const serviceCategory = ref('transport')
const showOnlyActive = ref(false)
const priceStandards = ref<PriceStandard[]>([...mockPriceStandards])

const filteredServices = computed(() =>
  priceStandards.value.filter((s) => {
    if (s.category !== serviceCategory.value
      && !(serviceCategory.value === 'other'
        && ['urn', 'burial', 'cemetery', 'memorial', 'other'].includes(s.category))) {
      return false
    }
    if (showOnlyActive.value && s.status !== 'active') return false
    return true
  })
)

function onServiceStatusChange(row: PriceStandard) {
  ElMessage.success(`${row.name} 已${row.status === 'active' ? '启用' : '停用'}`)
}

function openServiceDialog(row?: PriceStandard) {
  ElMessage.info(row ? `编辑服务：${row.name}` : '新增服务项目')
}

function viewHistory(row: PriceStandard) {
  ElMessage.info(`查看 ${row.name} 调价历史`)
}

const priceSearch = ref('')

const filteredPrices = computed(() =>
  priceStandards.value.filter((p) => {
    if (!priceSearch.value) return true
    const kw = priceSearch.value.toLowerCase()
    return p.name.includes(priceSearch.value) || p.code.toLowerCase().includes(kw)
  })
)

function loadPrices() { ElMessage.success('价格标准已刷新') }

function openPriceDialog(row?: PriceStandard) {
  ElMessage.info(row ? `编辑价格：${row.name}` : '新增价格标准')
}

function importPrices() { ElMessage.info('批量导入价格标准') }
function exportPrices() { ElMessage.success('价格标准已导出') }
function comparePrice(row: PriceStandard) { ElMessage.info(`对比分析：${row.name}`) }

function deletePrice(row: PriceStandard) {
  ElMessageBox.confirm(`确定要删除价格标准 "${row.name}" 吗？`, '删除确认', { type: 'warning' })
    .then(() => {
      const idx = priceStandards.value.findIndex((p) => p.id === row.id)
      if (idx >= 0) priceStandards.value.splice(idx, 1)
      ElMessage.success('已删除')
    })
    .catch(() => {})
}

function getDeviation(row: PriceStandard): string {
  if (!row.governmentGuidePrice) return '-'
  const d = ((row.price - row.governmentGuidePrice) / row.governmentGuidePrice * 100).toFixed(1)
  return `${Number(d) > 0 ? '+' : ''}${d}%`
}
function getDeviationClass(row: PriceStandard) {
  if (!row.governmentGuidePrice) return ''
  const ratio = row.price / row.governmentGuidePrice
  if (ratio > 1.5) return 'dev-high'
  if (ratio > 1.1) return 'dev-warn'
  if (ratio < 0.9) return 'dev-low'
  return 'dev-ok'
}

const noticeType = ref<'sms' | 'wechat' | 'email'>('sms')
const noticeTypeTabs = [
  { type: 'sms' as const, label: '短信通知', icon: 'Message', count: 0 },
  { type: 'wechat' as const, label: '微信通知', icon: 'ChatDotRound', count: 0 },
  { type: 'email' as const, label: '邮件通知', icon: 'Promotion', count: 0 }
]
const templates = ref<NotificationTemplate[]>([...mockNotificationTemplates])

function onTplToggle(tpl: NotificationTemplate) {
  ElMessage.success(`模板 "${tpl.sceneLabel}" 已${tpl.enabled ? '启用' : '停用'}`)
}
function openNoticeDialog(tpl?: NotificationTemplate) {
  ElMessage.info(tpl ? `编辑模板：${tpl.sceneLabel}` : '新增通知模板')
}
function previewTpl(tpl: NotificationTemplate) { ElMessage.info(`预览模板：${tpl.sceneLabel}`) }
function copyTpl(tpl: NotificationTemplate) {
  const newTpl: NotificationTemplate = {
    ...tpl,
    id: `NT${Date.now()}`,
    sceneLabel: tpl.sceneLabel + ' (副本)',
    enabled: false,
    updateTime: new Date().toISOString().slice(0, 16).replace('T', ' ')
  }
  templates.value.push(newTpl)
  ElMessage.success('模板已复制')
}
function testSend(tpl: NotificationTemplate) {
  ElMessageBox.prompt('请输入测试手机号/邮箱', `发送测试 - ${tpl.sceneLabel}`, {
    inputPlaceholder: tpl.type === 'email' ? 'example@mail.com' : '13800000000'
  }).then(() => {
    ElMessage.success('测试消息已发送')
  }).catch(() => {})
}

onMounted(() => {
  nextTick(() => {
    selectRole(selectedRoleId.value)
  })
})
</script>

<style lang="scss" scoped>
.settings-page {
  padding: 0;
}

:deep(.settings-tabs) {
  --el-tabs-header-background: transparent;
  --el-tabs-item-width: auto;

  .el-tabs__header {
    margin-bottom: 16px !important;
    border: none !important;
  }

  .el-tabs__nav {
    border: none !important;
    gap: 6px;
  }

  .el-tabs__item {
    border: 1px solid $color-funeral-border !important;
    border-radius: $radius-md $radius-md 0 0;
    background: $color-funeral-card !important;
    padding: 0 20px !important;
    height: 44px !important;
    line-height: 44px !important;
    margin-right: 0 !important;
    font-size: 14px !important;
  }

  .el-tabs__item.is-active {
    background: linear-gradient(180deg, rgba($color-funeral-gold, 0.12), transparent) !important;
    border-color: $color-funeral-gold !important;
    border-bottom-color: $color-funeral-card !important;
    color: $color-funeral-gold !important;
    font-weight: 600;
  }
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  :deep(.el-icon) {
    width: 16px;
    height: 16px;
    color: inherit;
  }
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tab-toolbar,
.panel-inner-toolbar,
.service-toolbar,
.notice-toolbar,
.price-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 10px;
  align-items: center;
}

.search-input {
  width: 280px;
}

.filter-select {
  width: 160px;
}

.action-btn {
  background: linear-gradient(135deg, $color-funeral-gold, $color-funeral-gold-dark);
  border: none;
  color: #1A1A1F;
  font-weight: 600;
  &:hover { box-shadow: $shadow-gold-glow; }
}

.panel {
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  overflow: hidden;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, $color-funeral-gold, $color-funeral-gold-dark);
  color: #1A1A1F;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}

.mono-text {
  font-family: 'SF Mono', Monaco, monospace;
}

.gold-text {
  color: $color-funeral-gold;
  font-weight: 700;
  font-size: 22px;
}

.success-text {
  color: $color-status-success;
  font-weight: 700;
  font-size: 22px;
}

.text-muted {
  color: $color-funeral-text-muted;
}

.money-text {
  font-family: 'SF Mono', Monaco, monospace;
}

.fw6 { font-weight: 600; }

.gold {
  color: $color-funeral-gold;
}

.success {
  color: $color-status-success;
}

.role-tag {
  &.admin { color: #EB2F96; border-color: rgba(235,47,150,0.5); background: rgba(235,47,150,0.1); }
  &.funeral_attendant { color: #1890FF; border-color: rgba(24,144,255,0.5); background: rgba(24,144,255,0.1); }
  &.embalmer { color: #722ED1; border-color: rgba(114,46,209,0.5); background: rgba(114,46,209,0.1); }
  &.cremator { color: #FA541C; border-color: rgba(250,84,28,0.5); background: rgba(250,84,28,0.1); }
  &.ritualist { color: #C41A1A; border-color: rgba(196,26,26,0.5); background: rgba(196,26,26,0.1); }
  &.cemetery_manager { color: #13C2C2; border-color: rgba(19,194,194,0.5); background: rgba(19,194,194,0.1); }
}

.data-table {
  :deep(.el-table__header th) {
    background: $color-funeral-deepest !important;
  }
}

.table-pagination {
  padding: 12px 20px;
  border-top: 1px solid $color-funeral-border;
  display: flex;
  justify-content: flex-end;
}

.role-content {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
}

.role-sidebar {
  padding: 0;
  display: flex;
  flex-direction: column;
  max-height: 700px;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid $color-funeral-border;
  background: rgba(255,255,255,0.02);
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: $color-funeral-text-primary;
}

.role-list {
  flex: 1;
  overflow-y: auto;
  @include scrollbar-custom;
  padding: 8px;
}

.role-item {
  padding: 12px;
  border-radius: $radius-sm;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 6px;

  &:hover {
    background: rgba(255,255,255,0.03);
    border-color: $color-funeral-border;
  }

  &.active {
    background: linear-gradient(135deg, rgba($color-funeral-gold, 0.12), rgba($color-funeral-gold, 0.04));
    border-color: rgba($color-funeral-gold, 0.5);

    .role-item-name {
      color: $color-funeral-gold;
    }
  }
}

.role-item-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  margin-bottom: 4px;

  :deep(.el-icon) { width: 14px; height: 14px; color: $color-funeral-gold; }
}

.role-item-desc {
  font-size: 12px;
  color: $color-funeral-text-muted;
  line-height: 1.4;
  margin-bottom: 8px;
}

.role-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.perm-count {
  color: $color-funeral-text-secondary;
}

.role-main {
  padding: 0;
  max-height: 700px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.perm-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.perm-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid $color-funeral-border;
  background: rgba(255,255,255,0.02);
}

.perm-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: $color-funeral-gold;
}

.perm-desc {
  font-size: 12px;
  color: $color-funeral-text-muted;
}

.perm-actions {
  display: flex;
  gap: 10px;
}

.save-btn {
  background: linear-gradient(135deg, $color-funeral-gold, $color-funeral-gold-dark);
  border: none;
  color: #1A1A1F;
  font-weight: 600;
}

.perm-toolbar {
  padding: 12px 20px;
  border-bottom: 1px dashed $color-funeral-border;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.quick-actions {
  display: flex;
  gap: 4px;
}

.perm-tree {
  flex: 1;
  padding: 12px 20px 20px;
  overflow-y: auto;
  @include scrollbar-custom;
  background: rgba(0,0,0,0.12);
}

.tree-node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.module-icon { color: #C9A86C; }
.menu-icon { color: #1890FF; }
.action-icon { color: #52C41A; }

.node-label {
  font-size: 13px;
}

.action-tag {
  margin-left: 4px;
  padding: 0 4px !important;
  height: 16px !important;
  line-height: 14px !important;
  font-size: 10px !important;
  --el-tag-bg-color: rgba($color-funeral-gold, 0.15) !important;
  --el-tag-text-color: $color-funeral-gold !important;
  --el-tag-border-color: rgba($color-funeral-gold, 0.4) !important;
}

.empty-perm {
  padding: 80px 0;
}

:deep(.el-tree) {
  --el-tree-bg-color: transparent;
  --el-tree-node-hover-bg-color: rgba($color-funeral-gold, 0.06);
  --el-tree-node-content-bg-color: transparent;
  --el-tree-text-color: $color-funeral-text-primary;
  --el-tree-node-selected-bg-color: rgba($color-funeral-gold, 0.12);
}

.service-category-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 12px;
  }

  :deep(.el-tabs__item) {
    padding: 0 18px !important;
    height: 38px !important;
    line-height: 38px !important;
    font-size: 13px !important;
  }
}

.total-tip {
  font-size: 13px;
  color: $color-funeral-text-secondary;
}

.svc-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.gov-price {
  color: #52C41A;
  font-family: 'SF Mono', Monaco, monospace;
  font-weight: 600;
}

.subsidy-text {
  color: $color-status-success;
  font-weight: 600;
}

.price-header {
  padding: 16px 20px;
}

.price-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 14px;
}

.summary-card {
  padding: 14px 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid $color-funeral-border;
  border-radius: $radius-sm;
}

.summary-label {
  font-size: 12px;
  color: $color-funeral-text-muted;
  margin-bottom: 6px;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: $color-funeral-text-primary;
  font-family: 'SF Mono', Monaco, monospace;
}

.price-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(24,144,255,0.08);
  border: 1px solid rgba(24,144,255,0.25);
  border-radius: $radius-sm;
  font-size: 12px;
  color: $color-funeral-text-secondary;
  line-height: 1.5;

  :deep(.el-icon) {
    color: #1890FF;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }
}

.dev-ok { color: $color-status-success; font-weight: 600; }
.dev-warn { color: $color-status-warning; font-weight: 600; }
.dev-high { color: $color-status-error; font-weight: 700; }
.dev-low { color: #1890FF; font-weight: 600; }

.notice-tabs-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.notice-type-tab {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    border-color: $color-funeral-gold-dark;
  }

  &.active {
    background: linear-gradient(135deg, rgba($color-funeral-gold, 0.1), transparent);
    border-color: $color-funeral-gold;
    box-shadow: $shadow-card-hover;

    .tab-type-icon {
      background: linear-gradient(135deg, $color-funeral-gold, $color-funeral-gold-dark);
      color: #1A1A1F !important;
    }
  }
}

.tab-type-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(255,255,255,0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-funeral-gold;
  transition: all 0.3s;
  flex-shrink: 0;

  :deep(.el-icon) { width: 22px; height: 22px; }

  &.sms { color: #1890FF; }
  &.wechat { color: #07C160; }
  &.email { color: #EB2F96; }
}

.tab-type-label {
  font-size: 15px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  margin-bottom: 2px;
}

.tab-type-count {
  font-size: 12px;
  color: $color-funeral-text-muted;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 20px 20px;
}

.template-card {
  padding: 16px 18px;
  background: rgba(255,255,255,0.02);
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  transition: all 0.2s;

  &:hover {
    border-color: rgba($color-funeral-gold, 0.5);
    background: rgba($color-funeral-gold, 0.04);
  }
}

.template-header {
  padding-bottom: 12px;
  border-bottom: 1px dashed $color-funeral-border;
  margin-bottom: 12px;
}

.template-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.template-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: $color-funeral-gold;
}

.template-code {
  display: flex;
  align-items: center;
  gap: 10px;
}

.update-time {
  font-size: 11px;
  color: $color-funeral-text-muted;
  font-family: 'SF Mono', Monaco, monospace;
}

.template-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.tpl-field {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.tpl-label {
  flex-shrink: 0;
  font-size: 12px;
  color: $color-funeral-text-muted;
  padding-top: 2px;
}

.tpl-value {
  flex: 1;
  font-size: 13px;
  color: $color-funeral-text-primary;
  line-height: 1.6;
}

.content-text {
  padding: 8px 12px;
  background: rgba(0,0,0,0.2);
  border-radius: $radius-sm;
  white-space: pre-wrap;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
}

.tpl-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.var-tag {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px !important;
}

.template-footer {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  padding-top: 12px;
  border-top: 1px solid $color-funeral-border;
}

.dialog-form {
  padding-top: 8px;

  :deep(.el-select) { width: 100%; }
}

@media (max-width: 1200px) {
  .role-content { grid-template-columns: 1fr; }
  .price-summary { grid-template-columns: repeat(2, 1fr); }
  .notice-tabs-bar { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .big-stats-row, .price-summary { grid-template-columns: 1fr 1fr; }
  .alert-cards-row { grid-template-columns: 1fr; }
}
</style>
