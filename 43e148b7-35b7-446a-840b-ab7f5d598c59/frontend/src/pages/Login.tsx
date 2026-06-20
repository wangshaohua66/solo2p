import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { userApi } from '@/api/user'
import { useAppStore } from '@/store'
import { useState } from 'react'

interface LoginForm {
  username: string
  password: string
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUser = useAppStore((state) => state.setUser)
  const setToken = useAppStore((state) => state.setToken)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true)
    try {
      const res = await userApi.login(values.username, values.password)
      setToken(res.data.token)
      setUser(res.data.user)
      message.success('登录成功')
      const from = (location.state as any)?.from?.pathname || '/projects'
      navigate(from, { replace: true })
    } catch (err: any) {
      if (err.code === 'ERR_NETWORK' || err.message?.includes('网络')) {
        const mockUser = {
          id: 1,
          username: values.username,
          name: values.username === 'admin' ? '系统管理员' : values.username === 'pm' ? '张经理' : '李设计师',
          role: values.username === 'admin' ? 'ADMIN' as const : values.username === 'pm' ? 'PROJECT_MANAGER' as const : 'DESIGNER' as const,
          email: 'test@example.com',
          phone: '13800138000',
        }
        setToken('mock-token')
        setUser(mockUser)
        message.success('演示模式登录成功')
        navigate('/projects', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>建筑设计院协同管理系统</h1>
          <p style={{ color: '#666' }}>Design Collaboration Platform</p>
        </div>
        <Form
          name="login"
          initialValues={{ username: 'admin', password: '123456' }}
          onFinish={handleSubmit}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
            >
              登 录
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
            演示账号：admin / 123456 | pm / 123456 | designer / 123456
          </div>
        </Form>
      </Card>
    </div>
  )
}
