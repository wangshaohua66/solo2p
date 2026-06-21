<script setup lang="ts">
import { computed } from 'vue'
import type { DeclarationStatus } from '@/types'

interface Props {
  status: DeclarationStatus | string
  size?: 'small' | 'default' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default'
})

const statusConfig: Record<string, { label: string; type: 'info' | 'success' | 'warning' | 'danger' | 'primary' }> = {
  draft: { label: '草稿', type: 'info' },
  submitted: { label: '已提交', type: 'primary' },
  reviewing: { label: '审核中', type: 'primary' },
  approved: { label: '审核通过', type: 'success' },
  rejected: { label: '审核驳回', type: 'danger' },
  customs_processing: { label: '通关处理中', type: 'warning' },
  customs_passed: { label: '通关完成', type: 'success' },
  customs_exception: { label: '通关异常', type: 'danger' },
  tax_processing: { label: '退税处理中', type: 'warning' },
  tax_completed: { label: '退税完成', type: 'success' },
  withdrawn: { label: '已撤回', type: 'info' },
  pending: { label: '待处理', type: 'warning' },
  processing: { label: '处理中', type: 'primary' },
  resolved: { label: '已解决', type: 'success' }
}

const config = computed(() => statusConfig[props.status] || { label: props.status, type: 'info' })
</script>

<template>
  <el-tag :type="config.type" :size="size" effect="light" round>
    {{ config.label }}
  </el-tag>
</template>
