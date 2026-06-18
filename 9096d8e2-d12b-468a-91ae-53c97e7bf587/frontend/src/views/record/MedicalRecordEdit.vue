<template>
  <div class="record-edit">
    <div class="edit-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h2>急救病历录入</h2>
        <el-tag v-if="isViewMode" type="success">已锁定</el-tag>
      </div>
      <div class="header-right">
        <el-button @click="saveRecord" :disabled="isViewMode">
          <el-icon><Save /></el-icon>
          保存
        </el-button>
        <el-button type="primary" @click="submitRecord" :disabled="isViewMode || isLocked">
          <el-icon><Check /></el-icon>
          提交锁定
        </el-button>
      </div>
    </div>

    <el-steps :active="activeStep" class="record-steps" finish-status="success">
      <el-step title="患者信息" />
      <el-step title="生命体征" />
      <el-step title="处置措施" />
      <el-step title="用药记录" />
      <el-step title="交接信息" />
      <el-step title="电子签名" />
    </el-steps>

    <div class="edit-content">
      <el-form
        ref="recordFormRef"
        :model="recordForm"
        :rules="formRules"
        label-width="100px"
        class="record-form"
      >
        <div v-show="activeStep === 0" class="step-content">
          <el-card class="form-card">
            <template #header>
              <div class="card-header">
                <span>基本信息</span>
                <el-tag size="small" type="info">事件号: {{ recordForm.dispatchEventId }}</el-tag>
              </div>
            </template>
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="患者姓名" prop="patientName">
                  <el-input v-model="recordForm.patientName" :disabled="isViewMode" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="性别" prop="gender">
                  <el-radio-group v-model="recordForm.gender" :disabled="isViewMode">
                    <el-radio value="MALE">男</el-radio>
                    <el-radio value="FEMALE">女</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="年龄" prop="age">
                  <el-input-number v-model="recordForm.age" :min="0" :max="150" :disabled="isViewMode" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="联系电话">
                  <el-input v-model="recordForm.patientPhone" :disabled="isViewMode" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="身份证号">
                  <el-input v-model="recordForm.idCard" :disabled="isViewMode" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="血型">
                  <el-select v-model="recordForm.bloodType" :disabled="isViewMode" style="width: 100%">
                    <el-option label="A型" value="A" />
                    <el-option label="B型" value="B" />
                    <el-option label="AB型" value="AB" />
                    <el-option label="O型" value="O" />
                    <el-option label="不详" value="UNKNOWN" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
          </el-card>

          <el-card class="form-card">
            <template #header>
              <span>病情信息</span>
            </template>
            <el-row :gutter="20">
              <el-col :span="24">
                <el-form-item label="过敏史">
                  <el-input v-model="recordForm.allergies" :disabled="isViewMode" />
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="主诉" prop="chiefComplaint">
                  <div class="speech-input-wrapper">
                    <el-input
                      v-model="recordForm.chiefComplaint"
                      type="textarea"
                      :rows="2"
                      :disabled="isViewMode"
                      placeholder="例如：胸痛、呼吸困难、意识不清等"
                    />
                    <SpeechInputButton
                      v-model="recordForm.chiefComplaint"
                      field-context="chiefComplaint"
                      size="small"
                      :disabled="isViewMode"
                      class="speech-btn"
                    />
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="现病史">
                  <div class="speech-input-wrapper">
                    <el-input
                      v-model="recordForm.historyOfPresentIllness"
                      type="textarea"
                      :rows="3"
                      :disabled="isViewMode"
                    />
                    <SpeechInputButton
                      v-model="recordForm.historyOfPresentIllness"
                      field-context="historyOfPresentIllness"
                      size="small"
                      :disabled="isViewMode"
                      class="speech-btn"
                    />
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="既往史">
                  <div class="speech-input-wrapper">
                    <el-input
                      v-model="recordForm.pastMedicalHistory"
                      type="textarea"
                      :rows="3"
                      :disabled="isViewMode"
                    />
                    <SpeechInputButton
                      v-model="recordForm.pastMedicalHistory"
                      field-context="pastMedicalHistory"
                      size="small"
                      :disabled="isViewMode"
                      class="speech-btn"
                    />
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="初步诊断" prop="preliminaryDiagnosis">
                  <div class="speech-input-wrapper">
                    <el-input
                      v-model="recordForm.preliminaryDiagnosis"
                      type="textarea"
                      :rows="2"
                      :disabled="isViewMode"
                      placeholder="请输入初步诊断结果"
                    />
                    <SpeechInputButton
                      v-model="recordForm.preliminaryDiagnosis"
                      field-context="preliminaryDiagnosis"
                      size="small"
                      :disabled="isViewMode"
                      class="speech-btn"
                    />
                  </div>
                </el-form-item>
              </el-col>
            </el-row>
          </el-card>
        </div>

        <div v-show="activeStep === 1" class="step-content">
          <el-card class="form-card">
            <template #header>
              <div class="card-header">
                <span>生命体征</span>
                <el-button size="small" type="primary" :icon="Plus" @click="addVitalSign" :disabled="isViewMode">
                  添加
                </el-button>
              </div>
            </template>
            <el-table :data="recordForm.vitalSigns" border>
              <el-table-column label="类型" width="150">
                <template #default="{ row, $index }">
                  <el-select v-model="row.type" :disabled="isViewMode" style="width: 100%">
                    <el-option label="体温" value="TEMPERATURE" />
                    <el-option label="脉搏" value="PULSE" />
                    <el-option label="呼吸" value="RESPIRATION" />
                    <el-option label="血压(收缩)" value="BLOOD_PRESSURE_SYS" />
                    <el-option label="血压(舒张)" value="BLOOD_PRESSURE_DIA" />
                    <el-option label="血氧饱和度" value="SPO2" />
                    <el-option label="血糖" value="BLOOD_SUGAR" />
                    <el-option label="意识状态" value="CONSCIOUSNESS" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="数值">
                <template #default="{ row, $index }">
                  <el-input-number v-model="row.value" :step="0.1" :disabled="isViewMode" style="width: 100%" />
                </template>
              </el-table-column>
              <el-table-column label="单位" width="100">
                <template #default="{ row, $index }">
                  <el-input v-model="row.unit" :disabled="isViewMode" />
                </template>
              </el-table-column>
              <el-table-column label="测量时间" width="180">
                <template #default="{ row, $index }">
                  <el-date-picker
                    v-model="row.measuredAt"
                    type="datetime"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    :disabled="isViewMode"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" v-if="!isViewMode">
                <template #default="{ $index }">
                  <el-button type="danger" size="small" link @click="removeVitalSign($index)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </div>

        <div v-show="activeStep === 2" class="step-content">
          <el-card class="form-card">
            <template #header>
              <div class="card-header">
                <span>处置措施</span>
                <el-button size="small" type="primary" :icon="Plus" @click="addTreatment" :disabled="isViewMode">
                  添加
                </el-button>
              </div>
            </template>
            <el-table :data="recordForm.treatments" border>
              <el-table-column label="类型" width="150">
                <template #default="{ row }">
                  <el-select v-model="row.type" :disabled="isViewMode" style="width: 100%">
                    <el-option label="心肺复苏(CPR)" value="CPR" />
                    <el-option label="气管插管" value="INTUBATION" />
                    <el-option label="吸氧" value="OXYGEN" />
                    <el-option label="心电监护" value="ECG_MONITOR" />
                    <el-option label="止血包扎" value="HEMOSTASIS" />
                    <el-option label="骨折固定" value="FRACTURE_FIX" />
                    <el-option label="静脉输液" value="IV_FLUID" />
                    <el-option label="其他" value="OTHER" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="描述">
                <template #default="{ row }">
                  <el-input v-model="row.description" :disabled="isViewMode" />
                </template>
              </el-table-column>
              <el-table-column label="开始时间" width="180">
                <template #default="{ row }">
                  <el-date-picker
                    v-model="row.startTime"
                    type="datetime"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    :disabled="isViewMode"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
              <el-table-column label="结束时间" width="180">
                <template #default="{ row }">
                  <el-date-picker
                    v-model="row.endTime"
                    type="datetime"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    :disabled="isViewMode"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" v-if="!isViewMode">
                <template #default="{ $index }">
                  <el-button type="danger" size="small" link @click="removeTreatment($index)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </div>

        <div v-show="activeStep === 3" class="step-content">
          <el-card class="form-card">
            <template #header>
              <div class="card-header">
                <span>用药记录</span>
                <el-button size="small" type="primary" :icon="Plus" @click="addMedication" :disabled="isViewMode">
                  添加
                </el-button>
              </div>
            </template>
            <el-table :data="recordForm.medications" border>
              <el-table-column label="药品名称">
                <template #default="{ row }">
                  <el-input v-model="row.name" :disabled="isViewMode" placeholder="如：肾上腺素、多巴胺等" />
                </template>
              </el-table-column>
              <el-table-column label="剂量" width="120">
                <template #default="{ row }">
                  <el-input v-model="row.dosage" :disabled="isViewMode" placeholder="如：1mg" />
                </template>
              </el-table-column>
              <el-table-column label="给药途径" width="120">
                <template #default="{ row }">
                  <el-select v-model="row.route" :disabled="isViewMode" style="width: 100%">
                    <el-option label="静脉推注" value="IV_PUSH" />
                    <el-option label="静脉滴注" value="IV_DRIP" />
                    <el-option label="肌肉注射" value="IM" />
                    <el-option label="皮下注射" value="SC" />
                    <el-option label="口服" value="ORAL" />
                    <el-option label="吸入" value="INHALATION" />
                    <el-option label="其他" value="OTHER" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="给药时间" width="180">
                <template #default="{ row }">
                  <el-date-picker
                    v-model="row.administeredAt"
                    type="datetime"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    :disabled="isViewMode"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" v-if="!isViewMode">
                <template #default="{ $index }">
                  <el-button type="danger" size="small" link @click="removeMedication($index)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </div>

        <div v-show="activeStep === 4" class="step-content">
          <el-card class="form-card">
            <template #header>
              <span>交接信息</span>
            </template>
            <el-row :gutter="20">
              <el-col :span="24">
                <el-form-item label="处置结果">
                  <el-select v-model="recordForm.disposition" :disabled="isViewMode" style="width: 100%">
                    <el-option label="现场处置后离开" value="TREATED_AND_RELEASED" />
                    <el-option label="转运至医院" value="TRANSPORTED" />
                    <el-option label="拒绝转运" value="REFUSED_TRANSPORT" />
                    <el-option label="现场死亡" value="DECEASED" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="交接科室">
                  <el-input v-model="recordForm.handoverTo" :disabled="isViewMode" placeholder="如：急诊科、ICU等" />
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="交接备注">
                  <div class="speech-input-wrapper">
                    <el-input
                      v-model="recordForm.handoverNotes"
                      type="textarea"
                      :rows="4"
                      :disabled="isViewMode"
                      placeholder="交接时需要特别说明的事项"
                    />
                    <SpeechInputButton
                      v-model="recordForm.handoverNotes"
                      field-context="handoverNotes"
                      size="small"
                      :disabled="isViewMode"
                      class="speech-btn"
                    />
                  </div>
                </el-form-item>
              </el-col>
            </el-row>
          </el-card>

          <el-card class="form-card validation-card">
            <template #header>
              <div class="card-header">
                <span>病历完整性校验</span>
                <el-tag :type="validationPassed ? 'success' : 'danger'">
                  {{ validationPassed ? '通过' : '未通过' }}
                </el-tag>
              </div>
            </template>
            <div class="validation-list">
              <div
                v-for="(item, index) in validationItems"
                :key="index"
                class="validation-item"
                :class="{ passed: item.passed }"
              >
                <el-icon :class="item.passed ? 'icon-success' : 'icon-error'">
                  <component :is="item.passed ? 'Check' : 'Close'" />
                </el-icon>
                <span>{{ item.message }}</span>
              </div>
            </div>
          </el-card>
        </div>

        <div v-show="activeStep === 5" class="step-content">
          <el-card class="form-card">
            <template #header>
              <div class="card-header">
                <span>医师电子签名</span>
                <el-tag v-if="recordForm.signature" type="success">已签名</el-tag>
                <el-tag v-else type="warning">未签名</el-tag>
              </div>
            </template>
            <div class="signature-section">
              <div class="signature-main">
                <SignaturePad
                  v-model="recordForm.signature"
                  :disabled="isViewMode"
                  :show-signer-info="true"
                  :require-signer="true"
                  :show-footer="true"
                  @change="onSignatureChange"
                  @confirm="onSignatureConfirm"
                  @clear="onSignatureClear"
                />
              </div>
              <div class="signature-preview" v-if="recordForm.signature">
                <div class="preview-title">签名预览</div>
                <div class="preview-box">
                  <img :src="recordForm.signature" alt="签名" />
                </div>
                <div class="preview-meta">
                  <div v-if="recordForm.signerName">
                    <span class="meta-label">签名人:</span>
                    <span class="meta-value">{{ recordForm.signerName }}</span>
                  </div>
                  <div v-if="recordForm.signedAt">
                    <span class="meta-label">签名时间:</span>
                    <span class="meta-value">{{ recordForm.signedAt }}</span>
                  </div>
                </div>
              </div>
            </div>
          </el-card>

          <el-card class="form-card">
            <template #header>
              <div class="card-header">
                <span>提交锁定前校验</span>
                <el-tag :type="canSubmit ? 'success' : 'danger'">
                  {{ canSubmit ? '可提交' : '检查未通过' }}
                </el-tag>
              </div>
            </template>
            <div class="validation-list">
              <div
                v-for="(item, index) in submissionValidation"
                :key="index"
                class="validation-item"
                :class="{ passed: item.passed }"
              >
                <el-icon :class="item.passed ? 'icon-success' : 'icon-error'">
                  <component :is="item.passed ? 'Check' : 'Close'" />
                </el-icon>
                <span>{{ item.message }}</span>
              </div>
            </div>
            <div class="submit-hint">
              <el-alert
                title="提交后病历将被锁定，无法再修改"
                type="warning"
                :closable="false"
                show-icon
              />
            </div>
          </el-card>
        </div>
      </el-form>
    </div>

    <div class="edit-footer">
      <el-button @click="prevStep" :disabled="activeStep === 0">
        上一步
      </el-button>
      <el-button type="primary" @click="nextStep" v-if="activeStep < 5">
        下一步
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  getRecord,
  createRecord,
  updateRecord,
  lockRecord
} from '@/api/medicalRecord'
import type {
  MedicalRecordDetail,
  MedicalRecordCreateRequest,
  MedicalRecordUpdateRequest,
  VitalSign,
  Treatment,
  Medication
} from '@/types/medicalRecord'
import { ArrowLeft, Save, Check, Plus, Microphone, EditPen } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import SpeechInputButton from '@/components/SpeechInputButton.vue'
import SignaturePad from '@/components/SignaturePad.vue'

const route = useRoute()
const router = useRouter()

const recordFormRef = ref<FormInstance>()
const activeStep = ref(0)
const isViewMode = ref(false)
const isLocked = ref(false)
const recordId = ref<number | null>(null)

const recordForm = reactive<MedicalRecordCreateRequest & { id?: number }>({
  id: undefined,
  dispatchEventId: 0,
  patientName: '',
  gender: 'MALE',
  age: 0,
  patientPhone: '',
  idCard: '',
  bloodType: '',
  allergies: '',
  chiefComplaint: '',
  historyOfPresentIllness: '',
  pastMedicalHistory: '',
  preliminaryDiagnosis: '',
  vitalSigns: [] as VitalSign[],
  treatments: [] as Treatment[],
  medications: [] as Medication[],
  disposition: '',
  handoverTo: '',
  handoverNotes: '',
  signature: '',
  signerName: '',
  signedAt: ''
})

const formRules: FormRules = {
  patientName: [{ required: true, message: '请输入患者姓名', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  age: [{ required: true, message: '请输入年龄', trigger: 'blur' }],
  chiefComplaint: [{ required: true, message: '请输入主诉', trigger: 'blur' }],
  preliminaryDiagnosis: [{ required: true, message: '请输入初步诊断', trigger: 'blur' }]
}

const validationItems = computed(() => [
  {
    passed: !!recordForm.patientName,
    message: '患者姓名已填写'
  },
  {
    passed: !!recordForm.chiefComplaint,
    message: '主诉已填写'
  },
  {
    passed: !!recordForm.preliminaryDiagnosis,
    message: '初步诊断已填写'
  },
  {
    passed: recordForm.vitalSigns.length > 0,
    message: '至少记录一项生命体征'
  },
  {
    passed: recordForm.vitalSigns.every(v => v.type && v.value > 0 && v.unit),
    message: '生命体征数据完整'
  }
])

const validationPassed = computed(() => validationItems.value.every(v => v.passed))

function addVitalSign() {
  recordForm.vitalSigns.push({
    type: '',
    value: 0,
    unit: '',
    measuredAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
  })
}

function removeVitalSign(index: number) {
  recordForm.vitalSigns.splice(index, 1)
}

function addTreatment() {
  recordForm.treatments.push({
    type: '',
    description: '',
    startTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    endTime: '',
    notes: ''
  })
}

function removeTreatment(index: number) {
  recordForm.treatments.splice(index, 1)
}

function addMedication() {
  recordForm.medications.push({
    name: '',
    dosage: '',
    route: '',
    administeredAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    administeredBy: ''
  })
}

function removeMedication(index: number) {
  recordForm.medications.splice(index, 1)
}

function nextStep() {
  if (activeStep.value < 5) {
    activeStep.value++
  }
}

function prevStep() {
  if (activeStep.value > 0) {
    activeStep.value--
  }
}

const submissionValidation = computed(() => [
  {
    passed: !!recordForm.patientName,
    message: '患者姓名已填写'
  },
  {
    passed: !!recordForm.chiefComplaint,
    message: '主诉已填写'
  },
  {
    passed: !!recordForm.preliminaryDiagnosis,
    message: '初步诊断已填写'
  },
  {
    passed: recordForm.vitalSigns.length > 0,
    message: '至少记录一项生命体征'
  },
  {
    passed: recordForm.vitalSigns.every(v => v.type && v.value > 0 && v.unit),
    message: '生命体征数据完整'
  },
  {
    passed: !!recordForm.disposition,
    message: '处置结果已选择'
  },
  {
    passed: !!recordForm.signature,
    message: '医师已完成电子签名'
  },
  {
    passed: !!recordForm.signerName,
    message: '签名人姓名已填写'
  }
])

const canSubmit = computed(() => submissionValidation.value.every(v => v.passed))

function onSignatureChange(data: { dataUrl: string; signerName?: string; signedAt?: string }) {
  recordForm.signature = data.dataUrl
  if (data.signerName) recordForm.signerName = data.signerName
  if (data.signedAt) recordForm.signedAt = data.signedAt
}

function onSignatureConfirm(data: { dataUrl: string; signerName?: string; signedAt?: string }) {
  recordForm.signature = data.dataUrl
  if (data.signerName) recordForm.signerName = data.signerName
  if (data.signedAt) recordForm.signedAt = data.signedAt
  ElMessage.success('签名确认成功')
}

function onSignatureClear() {
  recordForm.signature = ''
  recordForm.signerName = ''
  recordForm.signedAt = ''
}

function goBack() {
  router.push('/record')
}

async function saveRecord() {
  if (!recordFormRef.value) return
  await recordFormRef.value.validate(async (valid) => {
    if (!valid) return

    try {
      const request: MedicalRecordUpdateRequest = {
        patientName: recordForm.patientName,
        gender: recordForm.gender,
        age: recordForm.age,
        patientPhone: recordForm.patientPhone,
        idCard: recordForm.idCard,
        bloodType: recordForm.bloodType,
        allergies: recordForm.allergies,
        chiefComplaint: recordForm.chiefComplaint,
        historyOfPresentIllness: recordForm.historyOfPresentIllness,
        pastMedicalHistory: recordForm.pastMedicalHistory,
        preliminaryDiagnosis: recordForm.preliminaryDiagnosis,
        vitalSigns: recordForm.vitalSigns,
        treatments: recordForm.treatments,
        medications: recordForm.medications,
        disposition: recordForm.disposition,
        handoverTo: recordForm.handoverTo,
        handoverNotes: recordForm.handoverNotes,
        signature: recordForm.signature,
        signerName: recordForm.signerName,
        signedAt: recordForm.signedAt
      }

      if (recordId.value) {
        await updateRecord(recordId.value, request)
        ElMessage.success('保存成功')
      } else {
        const result = await createRecord(recordForm as MedicalRecordCreateRequest)
        recordId.value = result.id
        ElMessage.success('保存成功')
      }
    } catch (error) {
      console.error('Save failed:', error)
    }
  })
}

async function submitRecord() {
  if (!canSubmit.value) {
    const failedItems = submissionValidation.value.filter(v => !v.passed).map(v => v.message)
    ElMessage.error('提交前请完成所有必要项：\n' + failedItems.join('\n'))
    return
  }

  if (!recordForm.signature) {
    ElMessage.error('请先完成电子签名后再提交')
    activeStep.value = 5
    return
  }

  await ElMessageBox.confirm(
    `确认提交并锁定病历吗？\n签名人：${recordForm.signerName}\n签名时间：${recordForm.signedAt}\n提交后将无法修改。`,
    '病历提交确认',
    {
      confirmButtonText: '确定提交',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )

  try {
    if (!recordId.value) {
      await saveRecord()
    } else {
      const request: MedicalRecordUpdateRequest = {
        signature: recordForm.signature,
        signerName: recordForm.signerName,
        signedAt: recordForm.signedAt
      }
      await updateRecord(recordId.value, request)
    }

    if (recordId.value) {
      await lockRecord(recordId.value)
      isLocked.value = true
      ElMessage.success('病历已提交锁定')
      setTimeout(() => {
        router.push('/record')
      }, 1500)
    }
  } catch (error) {
    console.error('Submit failed:', error)
  }
}

async function loadRecord() {
  const id = route.params.id as string
  if (!id) return

  try {
    const record: MedicalRecordDetail = await getRecord(parseInt(id))
    recordId.value = record.id
    isLocked.value = record.isLocked
    isViewMode.value = route.query.view === 'true' || record.isLocked

    Object.assign(recordForm, {
      id: record.id,
      dispatchEventId: record.dispatchEventId,
      patientName: record.patientName,
      gender: record.gender,
      age: record.age,
      patientPhone: record.patientPhone || '',
      idCard: record.idCard || '',
      bloodType: record.bloodType || '',
      allergies: record.allergies || '',
      chiefComplaint: record.chiefComplaint,
      historyOfPresentIllness: record.historyOfPresentIllness || '',
      pastMedicalHistory: record.pastMedicalHistory || '',
      preliminaryDiagnosis: record.preliminaryDiagnosis,
      vitalSigns: record.vitalSigns || [],
      treatments: record.treatments || [],
      medications: record.medications || [],
      disposition: record.disposition || '',
      handoverTo: record.handoverTo || '',
      handoverNotes: record.handoverNotes || '',
      signature: record.signature || '',
      signerName: record.signerName || '',
      signedAt: record.signedAt || ''
    })
  } catch (error) {
    console.error('Failed to load record:', error)
  }
}

onMounted(() => {
  loadRecord()
})
</script>

<style scoped lang="scss">
.record-edit {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
  overflow: hidden;
}

.edit-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #111827;
    }
  }

  .header-right {
    display: flex;
    gap: 12px;
  }
}

.record-steps {
  padding: 20px 40px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.edit-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 40px;

  .step-content {
    max-width: 1000px;
    margin: 0 auto;
  }
}

.form-card {
  margin-bottom: 20px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.validation-card {
  .validation-list {
    .validation-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      color: #6b7280;

      &.passed {
        color: #10b981;
      }

      .icon-success {
        color: #10b981;
      }

      .icon-error {
        color: #ef4444;
      }
    }
  }
}

.edit-footer {
  height: 60px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-shrink: 0;
}

.speech-input-wrapper {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;

  :deep(.el-textarea) {
    flex: 1;
  }

  .speech-btn {
    flex-shrink: 0;
    margin-top: 1px;
  }
}

.signature-section {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 24px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.signature-main {
  min-width: 0;
}

.signature-preview {
  width: 280px;
  padding: 16px;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 1px solid #bbf7d0;
  border-radius: 10px;

  .preview-title {
    font-size: 13px;
    font-weight: 600;
    color: #166534;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #bbf7d0;
    display: flex;
    align-items: center;
    gap: 6px;

    &::before {
      content: '';
      display: inline-block;
      width: 6px;
      height: 6px;
      background: #22c55e;
      border-radius: 50%;
    }
  }

  .preview-box {
    background: white;
    border: 1px dashed #86efac;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 12px;
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      max-width: 100%;
      max-height: 120px;
      display: block;
    }
  }

  .preview-meta {
    font-size: 12px;
    color: #14532d;

    .meta-label {
      color: #166534;
      font-weight: 500;
      margin-right: 6px;
    }

    .meta-value {
      color: #14532d;
    }

    div {
      padding: 4px 0;
    }
  }
}

.submit-hint {
  margin-top: 16px;
}
</style>
