<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Reading,
  Search as SearchIcon,
  Star,
  StarFilled,
  Document,
  Collection,
  Refresh
} from '@element-plus/icons-vue'
import type { Policy } from '@/types'

const keyword = ref('')
const filterCategory = ref('')
const detailVisible = ref(false)
const currentPolicy = ref<Policy | null>(null)

const categories = [
  { label: '全部分类', value: '' },
  { label: '出口退税', value: 'tax' },
  { label: '海关监管', value: 'customs' },
  { label: '外汇管理', value: 'foreign_exchange' }
]

const policies: Policy[] = reactive([
  {
    id: '1',
    title: '关于2024年部分产品出口退税率调整的通知',
    category: 'tax',
    source: '财政部 税务总局',
    issuedDate: '2024-01-05',
    effectiveDate: '2024-01-01',
    content: '各省、自治区、直辖市、计划单列市财政厅（局），国家税务总局各省、自治区、直辖市、计划单列市税务局：\n\n为贯彻落实党中央、国务院决策部署，进一步完善出口退税政策，促进外贸稳定发展，经国务院批准，现就2024年部分产品出口退税率调整事项通知如下：\n\n一、将玩具类产品出口退税率由13%提高至15%，涉及税号95030010至95030090。\n\n二、将部分纺织品出口退税率由11%提高至13%，涉及税号61章、62章相关品目。\n\n三、本通知自2024年1月1日起执行。',
    summary: '玩具类产品退税率提高至15%，部分纺织品退税率提高至13%',
    tags: ['出口退税', '退税率调整', '2024'],
    isFavorite: true
  },
  {
    id: '2',
    title: '海关总署关于跨境电子商务出口退运商品监管措施的公告',
    category: 'customs',
    source: '海关总署',
    issuedDate: '2023-12-20',
    effectiveDate: '2024-01-01',
    content: '为进一步优化营商环境，促进跨境电子商务健康发展，现就跨境电子商务出口退运商品监管措施公告如下：\n\n一、对跨境电子商务出口商品，自出口之日起1年内原状复运进境的，不征收进口关税和进口环节增值税、消费税。\n\n二、企业应在退运商品进境前，向原出口地海关办理退运手续。',
    summary: '跨境电商出口退运商品1年内原状复运进境免征进口税',
    tags: ['海关监管', '跨境电商', '退运'],
    isFavorite: false
  },
  {
    id: '3',
    title: '国家外汇管理局关于进一步促进跨境贸易投资便利化的通知',
    category: 'foreign_exchange',
    source: '国家外汇管理局',
    issuedDate: '2023-11-15',
    effectiveDate: '2024-01-01',
    content: '为深入贯彻落实党中央、国务院关于稳外贸稳外资的决策部署，持续优化外汇营商环境，现就进一步促进跨境贸易投资便利化通知如下：\n\n一、扩大贸易外汇收支便利化试点范围。\n\n二、取消特殊退汇业务登记。',
    summary: '扩大贸易外汇收支便利化试点，取消特殊退汇登记',
    tags: ['外汇管理', '贸易便利化'],
    isFavorite: true
  },
  {
    id: '4',
    title: '关于完善出口退税分类管理有关事项的公告',
    category: 'tax',
    source: '国家税务总局',
    issuedDate: '2023-09-28',
    effectiveDate: '2023-11-01',
    content: '为深入贯彻落实国务院关于加快出口退税进度的决定，持续优化出口退税分类管理，现就有关事项公告如下...',
    summary: '优化出口退税分类管理，加快退税进度',
    tags: ['出口退税', '分类管理'],
    isFavorite: false
  },
  {
    id: '5',
    title: '海关总署关于公布海关行政审批事项的公告',
    category: 'customs',
    source: '海关总署',
    issuedDate: '2023-08-10',
    effectiveDate: '2023-09-01',
    content: '为贯彻落实国务院关于深化“放管服”改革的决策部署，现公布海关行政审批事项清单...',
    summary: '公布海关行政审批事项清单，推进简政放权',
    tags: ['海关监管', '行政审批'],
    isFavorite: false
  }
])

const filteredPolicies = computed(() => {
  return policies.filter(p => {
    if (filterCategory.value && p.category !== filterCategory.value) return false
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!p.title.toLowerCase().includes(kw) && !p.summary.toLowerCase().includes(kw)
        && !p.tags.some(t => t.toLowerCase().includes(kw))) return false
    }
    return true
  })
})

function toggleFav(p: Policy) {
  p.isFavorite = !p.isFavorite
  ElMessage.success(p.isFavorite ? '已加入收藏' : '已取消收藏')
}

function viewDetail(p: Policy) {
  currentPolicy.value = p
  detailVisible.value = true
}

function getCategoryName(cat: string) {
  return categories.find(c => c.value === cat)?.label || cat
}

function getCategoryColor(cat: string) {
  return cat === 'tax' ? 'warning' : cat === 'customs' ? 'primary' : 'success'
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">
        <el-icon style="margin-right: 8px"><Reading /></el-icon>
        政策法规库
      </div>
      <div style="display: flex; gap: 10px">
        <el-button :icon="StarFilled">我的收藏</el-button>
        <el-button :icon="Refresh">刷新</el-button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <el-input
          v-model="keyword"
          placeholder="搜索政策标题、内容或标签"
          :prefix-icon="SearchIcon"
          clearable
          style="width: 360px"
          size="default"
          @keyup.enter="() => {}"
        />
        <el-radio-group v-model="filterCategory">
          <el-radio-button v-for="c in categories" :key="c.value" :value="c.value">
            {{ c.label }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <div v-if="filteredPolicies.length === 0" class="empty">
        <el-empty description="暂无匹配的政策" />
      </div>

      <div v-else class="policy-list">
        <div
          v-for="p in filteredPolicies"
          :key="p.id"
          class="policy-item card-item"
        >
          <div class="policy-header">
            <div style="display: flex; align-items: center; gap: 10px">
              <el-tag :type="getCategoryColor(p.category)" size="small">{{ getCategoryName(p.category) }}</el-tag>
              <span class="policy-title" @click="viewDetail(p)">{{ p.title }}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px">
              <el-button link size="small" @click="viewDetail(p)">
                <el-icon style="margin-right: 4px"><Document /></el-icon>查看原文
              </el-button>
              <el-button link size="small" @click="toggleFav(p)">
                <el-icon :color="p.isFavorite ? '#faad14' : '#909399'">
                  <component :is="p.isFavorite ? StarFilled : Star" />
                </el-icon>
                {{ p.isFavorite ? '已收藏' : '收藏' }}
              </el-button>
            </div>
          </div>
          <div class="policy-summary">{{ p.summary }}</div>
          <div class="policy-meta">
            <span>发布机关：{{ p.source }}</span>
            <span>发文日期：{{ p.issuedDate }}</span>
            <span>生效日期：{{ p.effectiveDate }}</span>
            <div class="policy-tags">
              <el-tag v-for="t in p.tags" :key="t" type="info" size="small" effect="plain">
                {{ t }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="detailVisible" title="政策详情" width="780px" top="6vh">
      <template v-if="currentPolicy">
        <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
          <el-tag :type="getCategoryColor(currentPolicy.category)">
            {{ getCategoryName(currentPolicy.category) }}
          </el-tag>
          <h3 style="margin: 0; font-size: 18px; flex: 1">{{ currentPolicy.title }}</h3>
          <el-button size="small" @click="toggleFav(currentPolicy)">
            <el-icon :color="currentPolicy.isFavorite ? '#faad14' : '#909399'">
              <component :is="currentPolicy.isFavorite ? StarFilled : Star" />
            </el-icon>
            {{ currentPolicy.isFavorite ? '已收藏' : '收藏' }}
          </el-button>
        </div>

        <el-descriptions :column="2" size="small" border style="margin-bottom: 16px">
          <el-descriptions-item label="发布机关">{{ currentPolicy.source }}</el-descriptions-item>
          <el-descriptions-item label="生效日期">{{ currentPolicy.effectiveDate }}</el-descriptions-item>
          <el-descriptions-item label="发文日期">{{ currentPolicy.issuedDate }}</el-descriptions-item>
          <el-descriptions-item label="相关标签">
            <el-tag v-for="t in currentPolicy.tags" :key="t" type="info" size="small" style="margin-right: 6px">
              {{ t }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div style="margin-bottom: 12px; font-weight: 600">政策摘要</div>
        <div class="summary-box">{{ currentPolicy.summary }}</div>

        <div style="margin: 16px 0 12px; font-weight: 600">政策原文</div>
        <div class="content-box" style="white-space: pre-wrap">{{ currentPolicy.content }}</div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
  height: 100%;
  overflow: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .page-title {
    font-size: $font-size-xl;
    font-weight: 600;
    display: flex;
    align-items: center;
  }
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid $border-light;
  flex-wrap: wrap;
}

.policy-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-item {
  padding: 16px 20px;
  background: $bg-color;
  border-radius: $border-radius-md;
  border: 1px solid transparent;
  transition: all 0.2s;

  &:hover {
    border-color: $primary-color;
    background: #fff;
    box-shadow: $shadow-base;
  }
}

.policy-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.policy-title {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
  cursor: pointer;

  &:hover {
    color: $primary-color;
  }
}

.policy-summary {
  color: $text-regular;
  font-size: 14px;
  margin-bottom: 10px;
  line-height: 1.6;
}

.policy-meta {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 13px;
  color: $text-secondary;
  flex-wrap: wrap;
}

.policy-tags {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.empty {
  padding: 60px 0;
}

.summary-box {
  padding: 12px 16px;
  background: #fdf6ec;
  border-left: 4px solid #faad14;
  border-radius: 0 $border-radius-sm $border-radius-sm 0;
  color: #b88230;
  line-height: 1.6;
}

.content-box {
  padding: 16px 20px;
  background: #fafafa;
  border-radius: $border-radius-md;
  line-height: 1.8;
  color: $text-regular;
  max-height: 300px;
  overflow-y: auto;
}
</style>
