import { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Avatar,
  Divider,
  Tabs,
  message,
  Upload,
  Row,
  Col,
  Space
} from 'antd'
import {
  UserOutlined,
  SettingOutlined,
  BellOutlined,
  LockOutlined,
  CameraOutlined,
  MailOutlined,
  MobileOutlined
} from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { mockGetNotificationSettings, mockUpdateNotificationSettings } from '@/mock/message'
import './Index.css'

const { TabPane } = Tabs
const { Password } = Input

const Settings = () => {
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState<any>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const settings = await mockGetNotificationSettings()
    setNotificationSettings(settings)
  }

  const handleSaveProfile = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      message.success('个人信息已保存')
    } catch (error) {
      // validation error
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields()
      if (values.newPassword !== values.confirmPassword) {
        message.error('两次输入的密码不一致')
        return
      }
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      message.success('密码修改成功')
      passwordForm.resetFields()
    } catch (error) {
      // validation error
    } finally {
      setLoading(false)
    }
  }

  const handleToggleNotification = async (type: string, channel: string, value: boolean) => {
    const newSettings = {
      ...notificationSettings,
      [type]: {
        ...notificationSettings[type],
        [channel]: value
      }
    }
    setNotificationSettings(newSettings)
    await mockUpdateNotificationSettings(newSettings)
    message.success('设置已保存')
  }

  const uploadProps: UploadProps = {
    name: 'avatar',
    showUploadList: false,
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/')
      if (!isImage) {
        message.error('只能上传图片文件!')
        return false
      }
      message.success('头像上传成功')
      return false
    }
  }

  const notificationTypes = [
    { key: 'application', name: '投递通知', desc: '简历投递状态变更、企业查看等通知' },
    { key: 'interview', name: '面试通知', desc: '面试邀请、面试结果等通知' },
    { key: 'system', name: '系统通知', desc: '账号安全、系统公告等通知' },
    { key: 'marketing', name: '营销通知', desc: '活动推荐、优惠信息等通知' }
  ]

  const channels = [
    { key: 'inapp', name: '站内信', icon: <BellOutlined /> },
    { key: 'email', name: '邮件', icon: <MailOutlined /> },
    { key: 'sms', name: '短信', icon: <MobileOutlined /> }
  ]

  return (
    <div className="settings-page">
      <Card className="settings-header">
        <div className="user-profile">
          <div className="avatar-section">
            <Avatar size={72} icon={<UserOutlined />} className="user-avatar" />
            <Upload {...uploadProps}>
              <Button type="primary" size="small" icon={<CameraOutlined />} className="upload-btn">
                更换头像
              </Button>
            </Upload>
          </div>
          <div className="user-info">
            <h3 className="username">张管理员</h3>
            <p className="user-role">管理员 · 东城区人才服务中心</p>
          </div>
        </div>
      </Card>

      <Card className="settings-content">
        <Tabs defaultActiveKey="profile">
          <TabPane tab={<span><UserOutlined /> 个人信息</span>} key="profile">
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                name: '张管理员',
                phone: '13800138000',
                email: 'admin@talent.gov.cn',
                center: '东城区人才服务中心'
              }}
              style={{ maxWidth: 600 }}
            >
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="姓名"
                    name="name"
                    rules={[{ required: true, message: '请输入姓名' }]}
                  >
                    <Input placeholder="请输入姓名" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="手机号"
                    name="phone"
                    rules={[
                      { required: true, message: '请输入手机号' },
                      { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
                    ]}
                  >
                    <Input placeholder="请输入手机号" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="邮箱"
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入正确的邮箱' }
                    ]}
                  >
                    <Input placeholder="请输入邮箱" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="所属中心" name="center">
                    <Input disabled />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item>
                <Button type="primary" loading={loading} onClick={handleSaveProfile}>
                  保存修改
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab={<span><LockOutlined /> 密码设置</span>} key="password">
            <Form
              form={passwordForm}
              layout="vertical"
              style={{ maxWidth: 400 }}
            >
              <Form.Item
                label="当前密码"
                name="oldPassword"
                rules={[{ required: true, message: '请输入当前密码' }]}
              >
                <Password placeholder="请输入当前密码" />
              </Form.Item>
              <Form.Item
                label="新密码"
                name="newPassword"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '密码长度不能少于6位' }
                ]}
              >
                <Password placeholder="请输入新密码" />
              </Form.Item>
              <Form.Item
                label="确认新密码"
                name="confirmPassword"
                rules={[
                  { required: true, message: '请确认新密码' },
                  { min: 6, message: '密码长度不能少于6位' }
                ]}
              >
                <Password placeholder="请再次输入新密码" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" loading={loading} onClick={handleChangePassword}>
                  修改密码
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab={<span><BellOutlined /> 消息通知</span>} key="notification">
            <div className="notification-settings">
              <div className="notification-header">
                <div className="channel-legend">
                  {channels.map(ch => (
                    <span key={ch.key} className="legend-item">
                      {ch.icon} {ch.name}
                    </span>
                  ))}
                </div>
              </div>
              
              {notificationTypes.map(type => (
                <div key={type.key} className="notification-type">
                  <div className="type-info">
                    <h4>{type.name}</h4>
                    <p>{type.desc}</p>
                  </div>
                  <div className="channel-switches">
                    {channels.map(ch => (
                      <div key={ch.key} className="switch-item">
                        <Switch
                          checked={notificationSettings?.[type.key]?.[ch.key] || false}
                          onChange={(checked) => handleToggleNotification(type.key, ch.key, checked)}
                        />
                        <span>{ch.icon}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}

export default Settings
