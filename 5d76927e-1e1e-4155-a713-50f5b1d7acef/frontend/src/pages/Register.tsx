import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form, Input, Button, Typography, message, Card } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, IdcardOutlined } from '@ant-design/icons'
import { authApi } from '@/api/auth'

const { Title, Text } = Typography

const Register: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const handleRegister = async (values: any) => {
    setLoading(true)
    try {
      const res = await authApi.register(values)
      if (res.code === 200) {
        message.success('注册成功，请登录')
        navigate('/auth/login')
      } else {
        message.error(res.message || '注册失败')
      }
    } catch (error) {
      console.error('Register failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ borderRadius: 12, border: '1px solid #2d3a4f' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2} className="gradient-text" style={{ marginBottom: 8 }}>
          用户注册
        </Title>
        <Text style={{ color: '#a0a0a0' }}>加入非遗数字化保护平台</Text>
      </div>

      <Form
        form={form}
        name="register"
        onFinish={handleRegister}
        size="large"
      >
        <Form.Item
          name="username"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' },
          ]}
        >
          <Input
            prefix={<UserOutlined style={{ color: '#c8a96e' }} />}
            placeholder="请输入用户名"
          />
        </Form.Item>

        <Form.Item
          name="realName"
        >
          <Input
            prefix={<IdcardOutlined style={{ color: '#c8a96e' }} />}
            placeholder="请输入真实姓名（选填）"
          />
        </Form.Item>

        <Form.Item
          name="email"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入正确的邮箱格式' },
          ]}
        >
          <Input
            prefix={<MailOutlined style={{ color: '#c8a96e' }} />}
            placeholder="请输入邮箱"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#c8a96e' }} />}
            placeholder="请输入密码"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#c8a96e' }} />}
            placeholder="请确认密码"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button type="primary" htmlType="submit" block loading={loading}>
            注 册
          </Button>
        </Form.Item>

        <div style={{ textAlign: 'center' }}>
          <Text style={{ color: '#a0a0a0' }}>已有账号？</Text>
          <Link to="/auth/login" style={{ color: '#c8a96e', marginLeft: 4 }}>
            立即登录
          </Link>
        </div>
      </Form>
    </Card>
  )
}

export default Register
