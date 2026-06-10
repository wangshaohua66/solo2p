<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { glazeRecipeApi } from '@/api/glaze'
import type { GlazeRecipe } from '@/types'
import GlazeRecipeEditor from '@/components/GlazeRecipe/GlazeRecipeEditor.vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()

const recipe = ref<GlazeRecipe | null>(null)
const loading = ref(false)

const fetchRecipe = async (id: string) => {
  loading.value = true
  try {
    const response: any = await glazeRecipeApi.getRecipe(id)
    recipe.value = response.data || response
  } catch (error) {
    console.error('Failed to fetch recipe:', error)
    ElMessage.error('加载配方失败')
  } finally {
    loading.value = false
  }
}

const handleSave = (recipeData: Partial<GlazeRecipe>) => {
  ElMessage.success('配方已保存')
  console.log('Save recipe:', recipeData)
}

const handleClone = () => {
  ElMessage.info('克隆配方功能开发中...')
}

const handleCreateVersion = () => {
  ElMessage.info('创建新版本功能开发中...')
}

const handleArchive = () => {
  ElMessage.info('归档配方功能开发中...')
}

const handleBack = () => {
  router.push('/glaze-recipes')
}

onMounted(() => {
  const id = route.params.id as string
  if (id) {
    fetchRecipe(id)
  }
  
  if (!recipe.value) {
    recipe.value = {
      id: '1',
      name: '基础透明釉',
      code: 'G-T-001',
      version: 3,
      isArchived: false,
      firingType: 'glaze',
      temperatureMin: 1220,
      temperatureMax: 1260,
      atmosphere: '氧化焰',
      description: '经典透明釉配方，适用于各类坯体，光泽度高，透明度好。',
      ingredients: [
        { name: '长石', percentage: 45, note: '' },
        { name: '石英', percentage: 25, note: '' },
        { name: '高岭土', percentage: 15, note: '' },
        { name: '石灰石', percentage: 10, note: '' },
        { name: '锌白', percentage: 5, note: '' }
      ],
      createdBy: 'admin',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z'
    }
  }
})
</script>

<template>
  <div class="recipe-detail-page">
    <div class="page-header">
      <el-button :icon="ArrowLeft" text @click="handleBack">
        返回列表
      </el-button>
    </div>
    
    <div class="editor-container" v-loading="loading">
      <GlazeRecipeEditor 
        :recipe="recipe"
        @save="handleSave"
        @clone="handleClone"
        @create-version="handleCreateVersion"
        @archive="handleArchive"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.recipe-detail-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.page-header {
  flex-shrink: 0;
}

.editor-container {
  flex: 1;
  background: white;
  border-radius: $border-radius-md;
  padding: 24px;
  box-shadow: $shadow-sm;
  overflow: auto;
}
</style>
