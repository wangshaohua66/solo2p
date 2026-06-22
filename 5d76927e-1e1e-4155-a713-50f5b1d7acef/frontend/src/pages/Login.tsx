import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form, Input, Button, Typography, Checkbox, message, Card } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { authApi } from '@/api/auth'

const { Title, Text } = Typography

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const res = await authApi.login(values.username, values.password)
      if (res.code === 200) {
        message.success('登录成功')
        navigate('/')
      } else {
        message.error(res.message || '登录失败')
      }
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ borderRadius: 12, border: '1px solid #2d3a4f' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2} className="gradient-text" style={{ marginBottom: 8 }}>
          欢迎登录
        </Title>
        <Text style={{ color: '#a0a0a0' }}>非遗数字化保护综合服务平台</Text>
      </div>

      <Form
        form={form}
        name="login"
        onFinish={handleLogin}
        size="large"
        initialValues={{ remember: true }}
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input
            prefix={<UserOutlined style={{ color: '#c8a96e' }} />}
            placeholder="请输入用户名"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#c8a96e' }} />}
            placeholder="请输入密码"
          />
        </Form.Item>

        <Form.Item>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>记住我</Checkbox>
            </Form.Item>
            <a href="#" style={{ color: '#c8a96e' }}>忘记密码？</a>
          </div>
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登 录
          </Button>
        </Form.Item>

        <div style={{ textAlign: 'center' }}>
          <Text style={{ color: '#a0a0a0' }}>还没有账号？</Text>
          <Link to="/auth/register" style={{ color: '#c8a96e', marginLeft: 4 }}>
            立即注册
          </Link>
        </div>
      </Form>

      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid #2d3a4f',
          textAlign: 'center',
          fontSize: 12,
          color: '#707070',
        }}
      >
        测试账号: admin / admin123（管理员）
        <br />
        public / public123（普通用户）
      </div>
    </Card>
  )
}

export default Login
