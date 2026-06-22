import { useState } from 'react'
import { Form, Input, Select, Tabs, Button, message, Tooltip } from 'antd'
import { AudioOutlined, AudioMutedOutlined } from '@ant-design/icons'
import type { FormInstance } from 'antd'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import './MedicalRecordForm.scss'

const { TextArea } = Input
const { Option } = Select

interface Props {
  form: FormInstance
}

const speechFields = [
  { key: 'chiefComplaint', label: '主诉' },
  { key: 'presentIllness', label: '现病史' },
  { key: 'pastHistory', label: '既往史' },
  { key: 'diagnosis', label: '诊断' },
  { key: 'treatmentPlan', label: '治疗方案' },
  { key: 'prescription', label: '处方' },
]

function MedicalRecordForm({ form }: Props) {
  const [activeField, setActiveField] = useState<string | null>(null)

  const handleSpeechResult = (text: string) => {
    if (activeField) {
      const currentValue = form.getFieldValue(activeField) || ''
      form.setFieldsValue({ [activeField]: currentValue + text })
    }
  }

  const {
    isListening,
    startListening,
    stopListening,
    isSupported,
    error,
  } = useSpeechRecognition(handleSpeechResult, {
    lang: 'zh-CN',
    continuous: true,
    interimResults: true,
  })

  const toggleListening = (fieldKey: string) => {
    if (!isSupported) {
      message.warning('您的浏览器不支持语音识别功能')
      return
    }

    if (isListening && activeField === fieldKey) {
      stopListening()
      setActiveField(null)
    } else {
      setActiveField(fieldKey)
      startListening()
      message.info(`已开始语音录入：${speechFields.find(f => f.key === fieldKey)?.label}`)
    }
  }

  const renderVoiceTextArea = (fieldKey: string, rows = 3, placeholder = '') => {
    const fieldLabel = speechFields.find(f => f.key === fieldKey)?.label || ''
    const isActive = isListening && activeField === fieldKey

    return (
      <div className={`voice-textarea ${isActive ? 'active' : ''}`}>
        <TextArea rows={rows} placeholder={placeholder} />
        <Tooltip title={isActive ? '停止录音' : `语音录入${fieldLabel}`}>
          <Button
            type={isActive ? 'primary' : 'default'}
            shape="circle"
            icon={isActive ? <AudioMutedOutlined /> : <AudioOutlined />}
            className={`voice-btn ${isActive ? 'recording' : ''}`}
            onClick={() => toggleListening(fieldKey)}
          />
        </Tooltip>
        {isActive && (
          <div className="recording-indicator">
            <span className="pulse-dot" />
            录音中...
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="medical-record-form">
      <Form form={form} layout="vertical">
        <Tabs
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: (
                <div className="form-section">
                  <div className="form-row">
                    <Form.Item name="patientName" label="患者姓名" className="form-item-half">
                      <Input placeholder="请输入患者姓名" />
                    </Form.Item>
                    <Form.Item name="gender" label="性别" className="form-item-half">
                      <Select placeholder="请选择">
                        <Option value="male">男</Option>
                        <Option value="female">女</Option>
                      </Select>
                    </Form.Item>
                  </div>
                  <div className="form-row">
                    <Form.Item name="age" label="年龄" className="form-item-half">
                      <Input type="number" placeholder="请输入年龄" />
                    </Form.Item>
                    <Form.Item name="phone" label="联系电话" className="form-item-half">
                      <Input placeholder="请输入手机号" />
                    </Form.Item>
                  </div>
                  <Form.Item name="allergy" label="过敏史">
                    <Select
                      mode="tags"
                      placeholder="请输入或选择过敏药物"
                      style={{ width: '100%' }}
                    >
                      <Option value="青霉素">青霉素</Option>
                      <Option value="头孢">头孢</Option>
                      <Option value="磺胺类">磺胺类</Option>
                    </Select>
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'complaint',
              label: '主诉病史',
              children: (
                <div className="form-section">
                  <Form.Item name="chiefComplaint" label="主诉" rules={[{ required: true }]}>
                    {renderVoiceTextArea('chiefComplaint', 2, '患者主要症状和就诊目的')}
                  </Form.Item>
                  <Form.Item name="presentIllness" label="现病史">
                    {renderVoiceTextArea('presentIllness', 3, '疾病的发生、发展、诊治经过')}
                  </Form.Item>
                  <Form.Item name="pastHistory" label="既往史">
                    {renderVoiceTextArea('pastHistory', 2, '既往健康状况、疾病史、手术史')}
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'diagnosis',
              label: '诊断治疗',
              children: (
                <div className="form-section">
                  <Form.Item name="diagnosis" label="诊断" rules={[{ required: true }]}>
                    {renderVoiceTextArea('diagnosis', 2, '临床诊断结论')}
                  </Form.Item>
                  <Form.Item name="treatmentPlan" label="治疗方案">
                    {renderVoiceTextArea('treatmentPlan', 4, '详细治疗计划和步骤')}
                  </Form.Item>
                  <Form.Item name="nextVisit" label="下次复诊">
                    <Input placeholder="建议复诊时间" />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'prescription',
              label: '处方',
              children: (
                <div className="form-section">
                  <Form.Item name="prescription" label="开具处方">
                    {renderVoiceTextArea('prescription', 6, '药品名称、剂量、用法、用量')}
                  </Form.Item>
                  <Form.Item name="prescriptionNote" label="用药说明">
                    <TextArea rows={2} placeholder="用药注意事项" />
                  </Form.Item>
                </div>
              ),
            },
          ]}
        />
      </Form>
      {error && <div className="speech-error">语音识别错误：{error}</div>}
    </div>
  )
}

export default MedicalRecordForm
