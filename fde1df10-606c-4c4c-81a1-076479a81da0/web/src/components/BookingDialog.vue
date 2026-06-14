<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑档期' : '新建档期'"
    width="600px"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
    >
      <el-form-item label="场馆" prop="VenueID">
        <el-select v-model="formData.VenueID" placeholder="请选择场馆" style="width: 100%">
          <el-option
            v-for="venue in bookingStore.venues"
            :key="venue.ID"
            :label="venue.Name"
            :value="venue.ID"
            :disabled="venue.Status === 'maintenance'"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="演出标题" prop="Title">
        <el-input v-model="formData.Title" placeholder="请输入演出标题" />
      </el-form-item>
      <el-form-item label="描述" prop="Description">
        <el-input
          v-model="formData.Description"
          type="textarea"
          :rows="3"
          placeholder="请输入演出描述"
        />
      </el-form-item>
      <el-form-item label="开始时间" prop="StartTime">
        <el-date-picker
          v-model="formData.StartTime"
          type="datetime"
          placeholder="请选择开始时间"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="结束时间" prop="EndTime">
        <el-date-picker
          v-model="formData.EndTime"
          type="datetime"
          placeholder="请选择结束时间"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="类型" prop="Type">
        <el-select v-model="formData.Type" placeholder="请选择档期类型" style="width: 100%">
          <el-option label="演出" value="performance" />
          <el-option label="排练" value="rehearsal" />
          <el-option label="维护" value="maintenance" />
        </el-select>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="conflictInfo"
      :title="'档期冲突，以下时间段可能可用：'"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    >
      <div style="margin-top: 8px">
        <div v-for="(slot, idx) in conflictInfo.recommendedSlots" :key="idx" style="margin-bottom: 8px">
          <el-tag type="success" style="margin-right: 8px">
            {{ dayjs(slot.StartTime).format('MM-DD HH:mm') }} - {{ dayjs(slot.EndTime).format('HH:mm') }}
          </el-tag>
          <el-button size="small" type="primary" link @click="applyRecommendedSlot(slot)">
            使用此档期
          </el-button>
        </div>
        <div v-if="conflictInfo.conflicts?.length" style="margin-top: 12px">
          <div style="font-weight: 600; margin-bottom: 4px">冲突档期：</div>
          <div v-for="c in conflictInfo.conflicts" :key="c.ID" style="color: #f56c6c; font-size: 13px">
            {{ c.Title }}（{{ dayjs(c.StartTime).format('MM-DD HH:mm') }} - {{ dayjs(c.EndTime).format('HH:mm') }}）
          </div>
        </div>
      </div>
    </el-alert>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? '保存' : '提交' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import dayjs from 'dayjs'
import { useBookingStore } from '@/stores/booking'
import type { Booking, ConflictInfo } from '@/types'

const props = defineProps<{
  modelValue: boolean
  editData?: Booking | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const bookingStore = useBookingStore()

const dialogVisible = ref(props.modelValue)
const formRef = ref<FormInstance>()
const submitting = ref(false)
const conflictInfo = ref<ConflictInfo | null>(null)
const isEdit = ref(false)

const defaultFormData = () => ({
  VenueID: undefined as number | undefined,
  Title: '',
  Description: '',
  StartTime: '',
  EndTime: '',
  Type: 'performance' as Booking['Type']
})

const formData = reactive(defaultFormData())

const formRules: FormRules = {
  VenueID: [{ required: true, message: '请选择场馆', trigger: 'change' }],
  Title: [{ required: true, message: '请输入演出标题', trigger: 'blur' }],
  StartTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  EndTime: [
    { required: true, message: '请选择结束时间', trigger: 'change' },
    {
      validator: (_rule, value, callback) => {
        if (value && formData.StartTime && dayjs(value).isBefore(dayjs(formData.StartTime))) {
          callback(new Error('结束时间必须晚于开始时间'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ],
  Type: [{ required: true, message: '请选择档期类型', trigger: 'change' }]
}

watch(
  () => props.modelValue,
  (val) => {
    dialogVisible.value = val
    if (val) {
      conflictInfo.value = null
      if (props.editData) {
        isEdit.value = true
        Object.assign(formData, {
          VenueID: props.editData.VenueID,
          Title: props.editData.Title,
          Description: props.editData.Description,
          StartTime: props.editData.StartTime,
          EndTime: props.editData.EndTime,
          Type: props.editData.Type
        })
      } else {
        isEdit.value = false
        Object.assign(formData, defaultFormData())
      }
    }
  }
)

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

const applyRecommendedSlot = (slot: Booking) => {
  formData.StartTime = slot.StartTime
  formData.EndTime = slot.EndTime
  if (slot.VenueID) {
    formData.VenueID = slot.VenueID
  }
  conflictInfo.value = null
}

const handleClose = () => {
  dialogVisible.value = false
  formRef.value?.resetFields()
  Object.assign(formData, defaultFormData())
  conflictInfo.value = null
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      if (isEdit.value && props.editData) {
        await bookingStore.updateBooking(props.editData.ID, { ...formData })
        ElMessage.success('更新成功')
      } else {
        const result = await bookingStore.createBooking({ ...formData })
        if (result && (result as ConflictInfo).conflicts !== undefined) {
          conflictInfo.value = result as ConflictInfo
          ElMessage.warning('档期存在冲突，请选择其他时间或使用推荐档期')
          submitting.value = false
          return
        }
        ElMessage.success('提交成功')
      }
      emit('success')
      dialogVisible.value = false
    } catch (err: any) {
      if (err?.conflicts) {
        conflictInfo.value = err
        ElMessage.warning('档期存在冲突，请选择其他时间或使用推荐档期')
      }
    } finally {
      submitting.value = false
    }
  })
}
</script>
