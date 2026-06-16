<template>
  <div class="page-container">
    <div class="card">
      <div class="card-title">违停举报</div>
      <el-form :model="form" label-width="100px" style="max-width: 600px;">
        <el-form-item label="车牌号" required>
          <el-input v-model="form.plateNumber" placeholder="请输入车牌号" maxlength="10" />
        </el-form-item>
        <el-form-item label="位置" required>
          <el-input v-model="form.location" placeholder="请输入具体位置（如：A区停车场B1-012车位）" />
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="请简要描述" maxlength="50" />
        </el-form-item>
        <el-form-item label="详细描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="请详细描述违停情况"
          />
        </el-form-item>
        <el-form-item label="现场照片">
          <el-upload
            v-model:file-list="fileList"
            list-type="picture-card"
            :auto-upload="false"
            :limit="5"
            accept="image/*"
          >
            <el-icon><Plus /></el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Promotion" @click="submitReport">提交举报</el-button>
          <el-button>重置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Promotion } from '@element-plus/icons-vue'
import { useAdminStore } from '@/stores/admin'

const adminStore = useAdminStore()

const form = reactive({
  plateNumber: '',
  location: '',
  title: '',
  description: ''
})

const fileList = ref<any[]>([])

const submitReport = async () => {
  if (!form.plateNumber || !form.location || !form.title) {
    ElMessage.warning('请填写必填项')
    return
  }
  await adminStore.createWorkOrder({
    type: 'IllegalParking',
    ...form,
    photos: fileList.value.map(f => f.url || f.name)
  })
  ElMessage.success('举报提交成功，我们会尽快处理')
}
</script>
