import { useEffect } from 'react'
import { Form, Input, Button, Card, Typography, message, Checkbox } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { login } from '@/store/authSlice'
import { UserRole } from '@/types'

const { Title, Text } = Typography

export default function Login() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      await dispatch(login(values)).unwrap()
      message.success('登录成功')
      navigate('/')
    } catch (error: any) {
      message.error(error?.message || '登录失败')
    }
  }

  const quickLogin = (role: UserRole) => {
    const accounts: Record<UserRole, { username: string; password: string }> = {
      [UserRole.VENUE_ADMIN]: { username: 'admin', password: 'admin123' },
      [UserRole.ORGANIZER]: { username: 'organizer', password: 'organizer123' },
      [UserRole.FINANCE]: { username: 'finance', password: 'finance123' },
      [UserRole.AUDIENCE]: { username: 'audience', password: 'audience123' }
    }
    const acc = accounts[role]
    dispatch(login(acc))
    navigate('/')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 16
      }}
    >
      <Card
        style={{ width: 400, maxWidth: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            演艺票务管理系统
          </Title>
          <Text type="secondary">专业演出场馆票务运营平台</Text>
        </div>

        <Form name="login" onFinish={onFinish} size="large" layout="vertical">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Checkbox>记住我</Checkbox>
              <a>忘记密码？</a>
            </div>
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div
          style={{
            paddingTop: 16,
            borderTop: '1px solid #f0f0f0'
          }}
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
            演示账号快速登录：
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button size="small" onClick={() => quickLogin(UserRole.VENUE_ADMIN)}>
              场馆管理员
            </Button>
            <Button size="small" onClick={() => quickLogin(UserRole.ORGANIZER)}>
              演出主办方
            </Button>
            <Button size="small" onClick={() => quickLogin(UserRole.FINANCE)}>
              财务人员
            </Button>
            <Button size="small" onClick={() => quickLogin(UserRole.AUDIENCE)}>
              观众
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
