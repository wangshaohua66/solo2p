import { useState } from 'react'
import { Form, Input, Button, Card, Tabs, message } from 'antd'
import { UserOutlined, LockOutlined, SafetyOutlined, ShopOutlined, UserAddOutlined } from '@ant-design/icons'
import { useDispatch } from 'react-redux'
import { setToken, setUserInfo } from '@/store/slices/authSlice'
import { UserRole } from '@/types'
import { mockLogin } from '@/mock/auth'
import './Login.css'

const Login = () => {
  const dispatch = useDispatch()
  const [loading, setLoading] = useState(false)
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.JOBSEEKER)

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const result: any = await mockLogin(values.username, values.password, activeRole)
      dispatch(setToken(result.token))
      dispatch(setUserInfo(result.userInfo))
      message.success('登录成功')
    } catch (error: any) {
      message.error(error.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const roleTabs = [
    {
      key: UserRole.JOBSEEKER,
      label: (
        <span>
          <UserAddOutlined /> 求职者
        </span>
      )
    },
    {
      key: UserRole.ENTERPRISE,
      label: (
        <span>
          <ShopOutlined /> 企业
        </span>
      )
    },
    {
      key: UserRole.ADMIN,
      label: (
        <span>
          <SafetyOutlined /> 管理员
        </span>
      )
    }
  ]

  return (
    <div className="login-container">
      <div className="login-header">
        <h1>区域人才市场服务平台</h1>
        <p>连接人才与机遇，共创美好未来</p>
      </div>
      <Card className="login-card">
        <Tabs
          activeKey={activeRole}
          onChange={(key) => setActiveRole(key as UserRole)}
          items={roleTabs}
          centered
        />
        <Form
          name="login-form"
          initialValues={{ username: 'user', password: '123456' }}
          onFinish={handleLogin}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
          <div className="login-tips">
            提示：选择角色后，任意用户名/密码均可登录（演示环境）
          </div>
        </Form>
      </Card>
      <div className="login-footer">
        <p>© 2024 区域人才市场服务平台 | 8个县区人才服务中心联合运营</p>
      </div>
    </div>
  )
}

export default Login
