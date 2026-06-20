<template>
  <div class="register-page">
    <div class="page-header">
      <div class="header-title">
        <el-button text @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <div>
          <h2 class="title-text">遗体登记</h2>
          <p class="title-desc">请如实填写逝者及家属信息，带 <span class="required">*</span> 为必填项</p>
        </div>
      </div>
    </div>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="110px"
      label-position="right"
      class="register-form"
    >
      <div class="form-section">
        <div class="section-header">
          <el-icon><User /></el-icon>
          <span class="section-name">逝者基本信息</span>
        </div>
        <div class="section-body">
          <el-form-item label="姓名" prop="name">
            <el-input v-model="form.name" placeholder="请输入逝者姓名" maxlength="20" show-word-limit />
          </el-form-item>
          <el-form-item label="性别" prop="gender">
            <el-radio-group v-model="form.gender">
              <el-radio value="male">
                <el-icon><Male /></el-icon>
                男
              </el-radio>
              <el-radio value="female">
                <el-icon><Female /></el-icon>
                女
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="年龄" prop="age">
            <el-input-number
              v-model="form.age"
              :min="0"
              :max="150"
              :step="1"
              controls-position="right"
              class="w-full"
            />
          </el-form-item>
          <el-form-item label="身份证号" prop="idNumber">
            <el-input
              v-model="form.idNumber"
              placeholder="请输入18位身份证号"
              maxlength="18"
            />
          </el-form-item>
          <el-form-item label="死亡原因" prop="causeOfDeath">
            <el-select v-model="form.causeOfDeath" placeholder="请选择死亡原因" class="w-full">
              <el-option label="疾病身故" value="疾病身故" />
              <el-option label="意外身故" value="意外身故" />
              <el-option label="自然死亡" value="自然死亡" />
              <el-option label="交通事故" value="交通事故" />
              <el-option label="刑事案件" value="刑事案件" />
              <el-option label="其他" value="其他" />
            </el-select>
          </el-form-item>
          <el-form-item label="死亡时间" prop="deathTime">
            <el-date-picker
              v-model="form.deathTime"
              type="datetime"
              placeholder="选择死亡时间"
              value-format="YYYY-MM-DD HH:mm"
              class="w-full"
            />
          </el-form-item>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <el-icon><Van /></el-icon>
          <span class="section-name">接运信息</span>
        </div>
        <div class="section-body">
          <el-form-item label="接运地址" prop="pickupAddress">
            <el-input
              v-model="form.pickupAddress"
              type="textarea"
              :rows="2"
              placeholder="请输入详细接运地址（含门牌号）"
              maxlength="200"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="预约接运" prop="appointmentTime">
            <el-date-picker
              v-model="form.appointmentTime"
              type="datetime"
              placeholder="选择接运时间（不选则尽快安排）"
              value-format="YYYY-MM-DD HH:mm"
              class="w-full"
            />
          </el-form-item>
          <el-form-item label="所属殡仪馆" prop="funeralHomeId">
            <el-select v-model="form.funeralHomeId" placeholder="请选择殡仪馆" class="w-full">
              <el-option label="第一殡仪馆" value="fh1" />
              <el-option label="第二殡仪馆" value="fh2" />
              <el-option label="第三殡仪馆" value="fh3" />
            </el-select>
          </el-form-item>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <el-icon><Avatar /></el-icon>
          <span class="section-name">家属信息</span>
        </div>
        <div class="section-body">
          <el-form-item label="家属姓名" prop="familyName">
            <el-input v-model="form.familyName" placeholder="请输入家属姓名" maxlength="20" />
          </el-form-item>
          <el-form-item label="与逝者关系" prop="familyRelation">
            <el-select v-model="form.familyRelation" placeholder="请选择关系" class="w-full">
              <el-option label="配偶" value="配偶" />
              <el-option label="子女" value="子女" />
              <el-option label="父母" value="父母" />
              <el-option label="兄弟姐妹" value="兄弟姐妹" />
              <el-option label="其他亲属" value="其他亲属" />
              <el-option label="监护人" value="监护人" />
              <el-option label="单位经办人" value="单位经办人" />
            </el-select>
          </el-form-item>
          <el-form-item label="联系电话" prop="familyPhone">
            <el-input v-model="form.familyPhone" placeholder="请输入手机号码" maxlength="11">
              <template #prefix>
                <span class="phone-prefix">+86</span>
              </template>
            </el-input>
          </el-form-item>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <el-icon><Service /></el-icon>
          <span class="section-name">服务预选</span>
          <span class="section-tip">（可后续在详情中添加或修改）</span>
        </div>
        <div class="section-body">
          <el-form-item label="预选服务">
            <el-checkbox-group v-model="form.serviceIds">
              <el-checkbox value="svc001" border>灵车接运</el-checkbox>
              <el-checkbox value="svc002" border>冷藏存放</el-checkbox>
              <el-checkbox value="svc003" border>整容化妆</el-checkbox>
              <el-checkbox value="svc004" border>告别仪式</el-checkbox>
              <el-checkbox value="svc005" border>火化服务</el-checkbox>
              <el-checkbox value="svc006" border>骨灰盒</el-checkbox>
              <el-checkbox value="svc007" border>安葬服务</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <el-icon><EditPen /></el-icon>
          <span class="section-name">备注</span>
        </div>
        <div class="section-body">
          <el-form-item label="特殊说明" prop="remark">
            <el-input
              v-model="form.remark"
              type="textarea"
              :rows="4"
              placeholder="如有宗教仪式需求、特殊情况说明等，请在此填写..."
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </div>
      </div>

      <div class="form-actions">
        <el-button type="primary" size="large" :loading="submitting" @click="handleSubmit">
          <el-icon><Check /></el-icon>
          保存并提交
        </el-button>
        <el-button size="large" @click="handleReset">
          <el-icon><Refresh /></el-icon>
          重置表单
        </el-button>
        <el-button size="large" @click="handleSaveDraft">
          <el-icon><Document /></el-icon>
          保存草稿
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  ArrowLeft,
  User,
  Male,
  Female,
  Van,
  Avatar,
  Service,
  EditPen,
  Check,
  Refresh,
  Document
} from '@element-plus/icons-vue'
import type { RemainsRegisterForm } from '@/types/remains'

const router = useRouter()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const defaultForm: RemainsRegisterForm = {
  name: '',
  gender: 'male',
  age: 0,
  idNumber: '',
  causeOfDeath: '',
  deathTime: '',
  pickupAddress: '',
  appointmentTime: '',
  funeralHomeId: '',
  familyName: '',
  familyRelation: '',
  familyPhone: '',
  serviceIds: [],
  remark: ''
}

const form = reactive<RemainsRegisterForm>({ ...defaultForm })

const idCardValidator = (_rule: unknown, value: string, callback: (e?: Error) => void) => {
  if (!value) {
    callback(new Error('请输入身份证号'))
    return
  }
  const reg = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/
  if (!reg.test(value)) {
    callback(new Error('身份证号格式不正确'))
    return
  }
  callback()
}

const phoneValidator = (_rule: unknown, value: string, callback: (e?: Error) => void) => {
  if (!value) {
    callback(new Error('请输入联系电话'))
    return
  }
  const reg = /^1[3-9]\d{9}$/
  if (!reg.test(value)) {
    callback(new Error('手机号码格式不正确'))
    return
  }
  callback()
}

const rules: FormRules = {
  name: [{ required: true, message: '请输入逝者姓名', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  age: [
    { required: true, message: '请输入年龄', trigger: 'blur' },
    { type: 'number', min: 0, max: 150, message: '年龄范围 0-150', trigger: 'blur' }
  ],
  idNumber: [{ required: true, validator: idCardValidator, trigger: 'blur' }],
  causeOfDeath: [{ required: true, message: '请选择死亡原因', trigger: 'change' }],
  deathTime: [{ required: true, message: '请选择死亡时间', trigger: 'change' }],
  pickupAddress: [{ required: true, message: '请输入接运地址', trigger: 'blur' }],
  funeralHomeId: [{ required: true, message: '请选择所属殡仪馆', trigger: 'change' }],
  familyName: [{ required: true, message: '请输入家属姓名', trigger: 'blur' }],
  familyRelation: [{ required: true, message: '请选择与逝者关系', trigger: 'change' }],
  familyPhone: [{ required: true, validator: phoneValidator, trigger: 'blur' }]
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    ElMessageBox.confirm(
      `确认提交逝者「${form.name}」的登记信息吗？提交后将自动创建档案并进入业务流程。`,
      '提交确认',
      {
        confirmButtonText: '确认提交',
        cancelButtonText: '再检查一下',
        type: 'warning'
      }
    )
      .then(() => {
        setTimeout(() => {
          submitting.value = false
          ElMessage.success({
            message: '登记成功！档案编号：YT20260620001',
            duration: 3000,
            showClose: true
          })
          setTimeout(() => {
            router.push('/remains/list')
          }, 1500)
        }, 800)
      })
      .catch(() => {
        submitting.value = false
      })
  } catch {
    ElMessage.warning('请完善表单必填项')
  }
}

function handleReset() {
  ElMessageBox.confirm('确定要重置整个表单吗？已填写内容将被清空。', '重置确认', {
    confirmButtonText: '确定重置',
    cancelButtonText: '取消',
    type: 'info'
  })
    .then(() => {
      Object.assign(form, { ...defaultForm, serviceIds: [] })
      formRef.value?.clearValidate()
      ElMessage.info('表单已重置')
    })
    .catch(() => {})
}

function handleSaveDraft() {
  ElMessage.success({
    message: '草稿已保存，可在「待办-草稿箱」中继续编辑',
    duration: 2500
  })
}
</script>

<style lang="scss" scoped>
.register-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  padding: 16px 24px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 16px;

  > div {
    flex: 1;
  }
}

.title-text {
  font-size: 20px;
  font-weight: 700;
  color: $color-funeral-text-primary;
  margin: 0 0 4px;
  letter-spacing: 1px;
}

.title-desc {
  font-size: 13px;
  color: $color-funeral-text-secondary;
  margin: 0;

  .required {
    color: $color-status-error;
    font-weight: 600;
  }
}

.register-form {
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  padding: 8px 24px 24px;
}

.form-section {
  padding: 16px 0;

  & + & {
    border-top: 1px dashed $color-funeral-border;
  }
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0 16px;

  :deep(.el-icon) {
    width: 18px;
    height: 18px;
    color: $color-funeral-gold;
  }
}

.section-name {
  font-size: 15px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  position: relative;
  padding-left: 14px;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 16px;
    border-radius: 2px;
    background: linear-gradient(180deg, $color-funeral-gold 0%, $color-funeral-gold-dark 100%);
  }
}

.section-tip {
  font-size: 12px;
  color: $color-funeral-text-muted;
  font-style: italic;
}

.section-body {
  padding-left: 28px;
}

.phone-prefix {
  color: $color-funeral-text-muted;
  font-size: 13px;
  padding-right: 8px;
  border-right: 1px solid $color-funeral-border;
}

.form-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 24px 0 8px;
  border-top: 1px solid $color-funeral-border;
  margin-top: 8px;

  :deep(.el-button) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 160px;
  }
}

:deep(.el-form-item__label) {
  color: $color-funeral-text-secondary;
  font-size: 14px;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper),
:deep(.el-textarea__inner),
:deep(.el-date-editor.el-input__wrapper) {
  background: $color-funeral-dark;
  box-shadow: none;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-sm;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover,
  &.is-focus,
  &.is-focused {
    border-color: $color-funeral-gold;
    box-shadow: 0 0 0 3px rgba($color-funeral-gold, 0.12);
  }
}

:deep(.el-input__inner),
:deep(.el-textarea__inner) {
  color: $color-funeral-text-primary;
}

:deep(.el-input__wrapper.is-error),
:deep(.el-select__wrapper.is-error),
:deep(.el-textarea__inner.is-error) {
  border-color: $color-status-error;
}

:deep(.el-radio__label) {
  color: $color-funeral-text-secondary;
}

:deep(.el-radio__inner) {
  background: $color-funeral-dark;
  border-color: $color-funeral-border;
}

:deep(.el-radio__input.is-checked .el-radio__inner) {
  background: $color-funeral-gold;
  border-color: $color-funeral-gold;
}

:deep(.el-radio__input.is-checked + .el-radio__label) {
  color: $color-funeral-gold;
}

:deep(.el-checkbox__inner) {
  background: $color-funeral-dark;
  border-color: $color-funeral-border;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background: $color-funeral-gold;
  border-color: $color-funeral-gold;
}

:deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: $color-funeral-gold;
}

:deep(.el-checkbox-button__inner) {
  background: $color-funeral-dark;
  border-color: $color-funeral-border;
  color: $color-funeral-text-secondary;
  box-shadow: none;
}

:deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  background: linear-gradient(135deg, $color-funeral-gold 0%, $color-funeral-gold-dark 100%);
  border-color: $color-funeral-gold;
  color: #fff;
  box-shadow: none;
}

:deep(.el-checkbox-button.is-bordered.is-checked) {
  border-color: $color-funeral-gold;
}

:deep(.el-input-number) {
  width: 100%;

  .el-input__wrapper {
    border: 1px solid $color-funeral-border;
    box-shadow: none;
    background: $color-funeral-dark;
    border-radius: $radius-sm;
  }

  .el-input-number__decrease,
  .el-input-number__increase {
    background: $color-funeral-card;
    border-color: $color-funeral-border;
    color: $color-funeral-text-secondary;

    &:hover {
      color: $color-funeral-gold;
    }

    &.is-disabled {
      color: $color-funeral-text-muted;
    }
  }
}
</style>
