<template>
  <div class="remains-list-page">
    <div class="search-panel">
      <div class="search-form">
        <div class="form-item">
          <el-input
            v-model="store.searchKeyword"
            placeholder="搜索姓名、编号、家属、电话..."
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>

        <div class="form-item">
          <el-select
            v-model="store.filterStatus"
            placeholder="状态筛选"
            clearable
            class="w-full"
          >
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <div class="status-option">
                <span class="status-dot" :style="{ backgroundColor: item.color }"></span>
                <span>{{ item.label }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <div class="form-item">
          <el-select
            v-model="store.filterFuneralHome"
            placeholder="殡仪馆"
            clearable
            class="w-full"
          >
            <el-option label="第一殡仪馆" value="fh1" />
            <el-option label="第二殡仪馆" value="fh2" />
            <el-option label="第三殡仪馆" value="fh3" />
          </el-select>
        </div>

        <div class="form-item date-range">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            class="w-full"
          />
        </div>

        <div class="form-actions">
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
          <el-button type="success" @click="handleRegister">
            <el-icon><Plus /></el-icon>
            新建登记
          </el-button>
        </div>
      </div>
    </div>

    <div class="list-header">
      <div class="list-info">
        共 <span class="info-highlight">{{ store.total }}</span> 条记录，当前筛选 
        <span class="info-highlight">{{ store.filteredList.length }}</span> 条
      </div>
      <div class="list-stats">
        <span class="stat-chip">
          今日新增 <b>{{ store.stats.today }}</b>
        </span>
        <span class="stat-chip pending">
          待处理 <b>{{ store.stats.pending }}</b>
        </span>
        <span class="stat-chip done">
          已火化 <b>{{ store.stats.cremated }}</b>
        </span>
      </div>
    </div>

    <div class="remains-grid">
      <RemainsCard
        v-for="item in store.pagedList"
        :key="item.id"
        :data="item"
        @view="handleViewDetail"
        @update-status="handleUpdateStatus"
        @settlement="handleSettlement"
      />
    </div>

    <div v-if="store.pagedList.length === 0" class="empty-state">
      <el-empty description="暂无符合条件的遗体档案" />
    </div>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="store.currentPage"
        v-model:page-size="store.pageSize"
        :page-sizes="[8, 12, 16, 24]"
        :total="store.total"
        layout="total, sizes, prev, pager, next, jumper"
        background
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { useRemainsStore } from '@/stores/remains'
import { remainsStatusMap } from '@/utils/status'
import RemainsCard from '@/components/remains/RemainsCard.vue'

const store = useRemainsStore()
const router = useRouter()

const dateRange = ref<string[]>([])

const statusOptions = Object.values(remainsStatusMap)

function handleSearch() {
  store.currentPage = 1
  ElMessage.success(`搜索完成，共 ${store.filteredList.length} 条结果`)
}

function handleReset() {
  store.resetFilters()
  dateRange.value = []
  ElMessage.info('筛选条件已重置')
}

function handleRegister() {
  router.push('/remains/register')
}

function handleViewDetail(id: string) {
  router.push(`/remains/detail/${id}`)
}

function handleUpdateStatus() {
  ElMessageBox.prompt('请输入新的状态备注（可选）', '更新状态', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    inputPlaceholder: '可输入状态变更原因...',
    inputType: 'textarea',
    type: 'warning'
  })
    .then(() => {
      ElMessage.success('状态更新成功')
    })
    .catch(() => {})
}

function handleSettlement(id: string) {
  router.push({ path: '/remains/settlement', query: { remainsId: id } })
}
</script>

<style lang="scss" scoped>
.remains-list-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-panel {
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  padding: 20px;
}

.search-form {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.form-item {
  flex: 1;
  min-width: 200px;

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-date-editor) {
    background: $color-funeral-dark;
    box-shadow: none;
    border: 1px solid $color-funeral-border;
    border-radius: $radius-sm;
    transition: border-color 0.2s;

    &:hover,
    &.is-focus,
    &.is-focused {
      border-color: $color-funeral-gold;
    }
  }

  :deep(.el-input__inner),
  :deep(.el-select__placeholder),
  :deep(.el-date-editor .el-input__inner) {
    color: $color-funeral-text-secondary;
  }

  &.date-range {
    min-width: 320px;
    flex: 1.4;
  }
}

.form-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;

  :deep(.el-button) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.list-info {
  font-size: 14px;
  color: $color-funeral-text-secondary;

  .info-highlight {
    color: $color-funeral-gold;
    font-weight: 600;
    margin: 0 4px;
  }
}

.list-stats {
  display: flex;
  gap: 10px;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 20px;
  background: rgba($color-funeral-gold, 0.1);
  color: $color-funeral-gold;
  font-size: 13px;
  border: 1px solid rgba($color-funeral-gold, 0.25);

  b {
    font-weight: 600;
  }

  &.pending {
    background: rgba(250, 140, 22, 0.1);
    color: #FA8C16;
    border-color: rgba(250, 140, 22, 0.25);
  }

  &.done {
    background: rgba(82, 196, 26, 0.1);
    color: #52C41A;
    border-color: rgba(82, 196, 26, 0.25);
  }
}

.remains-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (max-width: 1600px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.status-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.empty-state {
  padding: 60px 0;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 20px 0 8px;

  :deep(.el-pagination) {
    --el-pagination-bg-color: $color-funeral-card;
    --el-pagination-text-color: $color-funeral-text-secondary;
    --el-pagination-hover-color: $color-funeral-gold;
    --el-pagination-button-color: $color-funeral-card;
    --el-pagination-button-bg-color: $color-funeral-dark;
    --el-pagination-button-disabled-color: $color-funeral-text-muted;
    --el-pagination-button-disabled-bg-color: $color-funeral-dark;

    .btn-prev,
    .btn-next,
    .el-pager li {
      background: $color-funeral-dark !important;
      border: 1px solid $color-funeral-border !important;
      box-shadow: none !important;

      &:hover {
        color: $color-funeral-gold !important;
        border-color: $color-funeral-gold !important;
      }

      &.is-active {
        background: linear-gradient(135deg, $color-funeral-gold 0%, $color-funeral-gold-dark 100%) !important;
        color: #fff !important;
        border-color: $color-funeral-gold !important;
      }
    }

    .el-pagination__total,
    .el-pagination__jump {
      color: $color-funeral-text-secondary !important;
    }

    .el-pagination__sizes :deep(.el-select__wrapper) {
      background: $color-funeral-dark;
      border: 1px solid $color-funeral-border;
      box-shadow: none;
    }
  }
}
</style>
