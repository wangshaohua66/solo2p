<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Calendar, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { equipment as equipmentApi } from '@/api'
import type { Equipment } from '@/types'

const route = useRoute()
const router = useRouter()

const detail = ref<(Equipment & { currentUser?: string; nextFreeTime?: string }) | null>(null)
const loading = ref(false)

const equipmentId = computed(() => Number(route.params.id))

const statusMap: Record<string, { text: string; type: string }> = {
  available: { text: '可用', type: 'success' },
  maintenance: { text: '维修中', type: 'warning' },
  scrapped: { text: '已报废', type: 'danger' }
}

const statusInfo = computed(() => {
  if (!detail.value) return { text: '未知', type: 'info' as const }
  return statusMap[detail.value.status] || { text: detail.value.status, type: 'info' as const }
})

async function loadDetail() {
  loading.value = true
  try {
    const data = await equipmentApi.getDetail(equipmentId.value)
    detail.value = data
  } catch (err) {
    console.error('加载设备详情失败:', err)
    ElMessage.error('加载设备详情失败')
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.back()
}

function goToBooking() {
  router.push({ path: '/booking', query: { equipmentId: equipmentId.value } })
}

onMounted(() => {
  loadDetail()
})
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="flex items-center gap-4 mb-6">
      <el-button :icon="ArrowLeft" text @click="goBack">返回列表</el-button>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
          {{ detail?.name || '加载中...' }}
          <el-tag v-if="detail" :type="statusInfo.type" effect="light">
            {{ statusInfo.text }}
          </el-tag>
        </h1>
        <p class="text-gray-500 mt-1">{{ detail?.model || '' }} · {{ detail?.category || '' }}</p>
      </div>
      <div class="ml-auto flex gap-2">
        <el-button :icon="Refresh" @click="loadDetail" :loading="loading">刷新</el-button>
        <el-button :icon="Calendar" type="primary" @click="goToBooking">预约此设备</el-button>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="24" :md="16">
        <el-card class="mb-4">
          <template #header>
            <span class="font-semibold">基本信息</span>
          </template>
          <el-descriptions v-if="detail" :column="2" border>
            <el-descriptions-item label="设备编号">{{ detail.code }}</el-descriptions-item>
            <el-descriptions-item label="设备名称">{{ detail.name }}</el-descriptions-item>
            <el-descriptions-item label="设备型号">{{ detail.model }}</el-descriptions-item>
            <el-descriptions-item label="设备类别">{{ detail.category }}</el-descriptions-item>
            <el-descriptions-item label="所属中心">{{ detail.centerName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="存放位置">{{ detail.location || '-' }}</el-descriptions-item>
            <el-descriptions-item label="小时费率">
              <span class="text-orange-600 font-semibold">¥{{ detail.hourlyRate }}/小时</span>
            </el-descriptions-item>
            <el-descriptions-item label="设备状态">
              <el-tag :type="statusInfo.type" effect="light">{{ statusInfo.text }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="当前使用">{{ detail.currentUser || '空闲' }}</el-descriptions-item>
            <el-descriptions-item label="规格参数" :span="2">
              <pre class="text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap">{{ detail.specs ? JSON.stringify(detail.specs, null, 2) : '-' }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="备注说明" :span="2">{{ detail.description || '-' }}</el-descriptions-item>
          </el-descriptions>
          <el-empty v-else description="暂无数据" />
        </el-card>
      </el-col>

      <el-col :span="24" :md="8">
        <el-card class="mb-4">
          <template #header>
            <span class="font-semibold">下一个空闲时段</span>
          </template>
          <div v-if="detail" class="text-center py-4">
            <div class="text-3xl font-bold text-blue-600 mb-2">
              {{ detail.nextFreeTime ? dayjs(detail.nextFreeTime).format('MM-DD HH:mm') : '立即可用' }}
            </div>
            <p class="text-gray-500 text-sm">{{ detail.nextFreeTime ? '之后可预约' : '当前无预约，随时可用' }}</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
