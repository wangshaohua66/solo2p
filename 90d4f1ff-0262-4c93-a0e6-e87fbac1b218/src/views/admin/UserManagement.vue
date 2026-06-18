<template>
  <div class="page-container">
    <div class="card">
      <div class="card-title">用户管理</div>
      <el-table :data="mockUsers" stripe style="width: 100%">
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column prop="nickname" label="昵称" width="140" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column label="角色" width="140">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" effect="light" size="small">
              {{ roleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="会员等级" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.memberLevel" type="warning">Lv.{{ row.memberLevel }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="余额" width="120">
          <template #default="{ row }">¥{{ (row.balance || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default>
            <el-button type="primary" size="small" link>编辑</el-button>
            <el-button type="warning" size="small" link>重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const roleLabel = (r: string) => ({
  SuperAdmin: '超级管理员',
  ParkOperator: '园区运营',
  ParkingAdmin: '停车场管理员',
  ChargingOps: '充电桩运维',
  CarOwner: '车主'
}[r] || r)

const roleTagType = (r: string) => ({
  SuperAdmin: 'danger',
  ParkOperator: 'warning',
  ParkingAdmin: 'primary',
  ChargingOps: 'success',
  CarOwner: 'info'
}[r] || 'info') as 'danger' | 'warning' | 'primary' | 'success' | 'info'

const mockUsers = ref([
  { id: '1', username: 'admin', nickname: '超级管理员', phone: '13800000001', email: 'admin@park.com', role: 'SuperAdmin', balance: 0 },
  { id: '2', username: 'operator', nickname: '园区运营', phone: '13800000002', email: 'op@park.com', role: 'ParkOperator', balance: 0 },
  { id: '3', username: 'parking', nickname: '停车管理员', phone: '13800000003', email: 'parking@park.com', role: 'ParkingAdmin', balance: 0 },
  { id: '4', username: 'charging', nickname: '充电桩运维', phone: '13800000004', email: 'charging@park.com', role: 'ChargingOps', balance: 0 },
  { id: '5', username: 'owner', nickname: '张先生', phone: '13800000005', email: 'owner@park.com', role: 'CarOwner', memberLevel: 2, balance: 280.50 },
  { id: '6', username: 'owner2', nickname: '李女士', phone: '13800000006', email: 'owner2@park.com', role: 'CarOwner', memberLevel: 1, balance: 150.00 }
])
</script>
