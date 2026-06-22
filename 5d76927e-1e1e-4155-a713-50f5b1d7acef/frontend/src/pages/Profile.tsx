import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Avatar,
  Typography,
  Form,
  Input,
  Button,
  Tag,
  message,
  Spin,
  Descriptions,
  Divider,
} from 'antd'
import { UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined } from '@ant-design/icons'
import { authApi } from '@/api/auth'
import { User, UserRoleMap } from '@/types'

const { Title } = Typography

const Profile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await authApi.getCurrentUser()
        setUser(res.data || null)
        if (res.data) {
          form.setFieldsValue(res.data)
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [form])

  const handleSubmit = async (values: Partial<User>) => {
    try {
      const res = await authApi.updateCurrentUser(values)
      if (res.code === 200) {
        message.success('个人信息更新成功')
        setUser(res.data || null)
        setEditing(false)
      } else {
        message.error(res.message || '更新失败')
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!user) {
    return <div style={{ textAlign: 'center', padding: 64 }}>请先登录</div>
  }

  return (
    <div>
      <Title level={2} style={{ color: '#c8a96e', marginBottom: 24 }}>
        <UserOutlined /> 个人中心
      </Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Avatar
              size={120}
              src={user.avatar}
              icon={<UserOutlined />}
              style={{
                backgroundColor: '#c8a96e',
                border: '4px solid #0f3460',
                marginBottom: 16,
              }}
            />
            <Title level={3} style={{ color: '#e8e8e8', marginBottom: 8 }}>
              {user.realName || user.username}
            </Title>
            <div style={{ marginBottom: 16 }}>
              {user.roles?.map((role) => (
                <Tag key={role} color="gold" style={{ margin: 4 }}>
                  {UserRoleMap[role]}
                </Tag>
              ))}
            </div>
            <Divider />
            <Descriptions column={1} size="small">
              <Descriptions.Item label={<MailOutlined />} labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                {user.email}
              </Descriptions.Item>
              {user.phone && (
                <Descriptions.Item label={<PhoneOutlined />} labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                  {user.phone}
                </Descriptions.Item>
              )}
              {user.organization && (
                <Descriptions.Item label={<HomeOutlined />} labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                  {user.organization}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card
            title={<span style={{ color: '#c8a96e' }}>个人信息</span>}
            style={{ borderRadius: 12 }}
            extra={
              !editing ? (
                <Button type="primary" onClick={() => setEditing(true)}>
                  编辑
                </Button>
              ) : (
                <Button onClick={() => setEditing(false)}>
                  取消
                </Button>
              )
            }
          >
            {editing ? (
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={user}
              >
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="用户名" name="username">
                      <Input disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="真实姓名"
                      name="realName"
                      rules={[{ required: true, message: '请输入真实姓名' }]}
                    >
                      <Input placeholder="请输入真实姓名" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="邮箱"
                      name="email"
                      rules={[
                        { required: true, message: '请输入邮箱' },
                        { type: 'email', message: '请输入正确的邮箱格式' },
                      ]}
                    >
                      <Input placeholder="请输入邮箱" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="手机号"
                      name="phone"
                      rules={[
                        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' },
                      ]}
                    >
                      <Input placeholder="请输入手机号" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="所属机构"
                  name="organization"
                >
                  <Input placeholder="请输入所属机构/学校" />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                  <Button type="primary" htmlType="submit">
                    保存修改
                  </Button>
                </Form.Item>
              </Form>
            ) : (
              <Descriptions column={2} bordered size="middle">
                <Descriptions.Item label="用户名" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                  {user.username}
                </Descriptions.Item>
                <Descriptions.Item label="真实姓名" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                  {user.realName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="邮箱" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                  {user.email}
                </Descriptions.Item>
                <Descriptions.Item label="手机号" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                  {user.phone || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="所属机构" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                  {user.organization || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="注册时间" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                  {new Date(user.createdAt).toLocaleString()}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Profile
