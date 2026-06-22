import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import './Login.scss'

function Login() {
  const navigate = useNavigate()

  const onFinish = (values: { username: string; password: string }) => {
    if (values.username && values.password) {
      localStorage.setItem('token', 'mock-token')
      localStorage.setItem('role', 'doctor')
      message.success('登录成功')
      navigate('/dashboard')
    } else {
      message.error('请输入用户名和密码')
    }
  }

  return (
    <div className="login-container">
      <Card className="login-card" title="口腔医疗集团管理系统">
        <Form
          name="login"
          onFinish={onFinish}
          size="large"
          initialValues={{ username: 'admin', password: '123456' }}
        >
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
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default Login
