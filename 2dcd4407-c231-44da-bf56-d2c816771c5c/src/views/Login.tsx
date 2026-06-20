import { useState } from 'react';
import { Form, Input, Button, Card, Select, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { useUserStore } from '../stores/userStore';
import { generateMockUser } from '../utils/mockData';
import type { UserRole } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;

const roleLabels: Record<UserRole, string> = {
  admin: '系统管理员',
  operator: '场馆运营',
  organizer: '主办方',
  exhibitor: '参展商',
  builder: '搭建商',
  provider: '服务商',
  visitor: '观众',
};

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const login = useUserStore(state => state.login);

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockUser = generateMockUser();
      const user = {
        ...mockUser,
        role: selectedRole,
        realName: roleLabels[selectedRole],
        permissions: {
          schedule: ['admin', 'operator', 'organizer'].includes(selectedRole),
          contract: ['admin', 'operator', 'organizer'].includes(selectedRole),
          finance: ['admin', 'operator'].includes(selectedRole),
          booth: ['admin', 'operator', 'organizer', 'exhibitor'].includes(selectedRole),
          provider: ['admin', 'operator', 'provider'].includes(selectedRole),
          visitor: ['admin', 'operator', 'visitor'].includes(selectedRole),
          analytics: ['admin', 'operator'].includes(selectedRole),
          system: ['admin'].includes(selectedRole),
        } as Record<string, boolean>,
      };
      login('mock-token-' + Date.now(), 'mock-refresh-token', user);
      message.success(`欢迎，${user.realName}！`);
    } catch (error) {
      message.error('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200 rounded-full opacity-20 blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md shadow-2xl border-0 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4 shadow-lg">
            <UserOutlined className="text-3xl text-white" />
          </div>
          <Title level={3} className="!mb-1 !text-gray-800">
            会展中心智慧运营系统
          </Title>
          <Text type="secondary">Exhibition Center Smart Operations</Text>
        </div>

        <Form
          name="login"
          initialValues={{ username: 'admin', password: '123456', role: 'admin' }}
          onFinish={handleLogin}
          size="large"
        >
          <Form.Item
            name="role"
            rules={[{ required: true, message: '请选择登录角色' }]}
          >
            <Select
              prefix={<UserSwitchOutlined className="text-gray-400" />}
              placeholder="选择登录角色"
              onChange={(value: UserRole) => setSelectedRole(value)}
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <Option key={value} value={value}>
                  {label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined className="text-gray-400" />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item className="!mb-2">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="h-11 text-base font-medium"
            >
              登 录
            </Button>
          </Form.Item>

          <div className="text-center text-xs text-gray-400">
            演示账号: admin / 123456 (任意密码均可登录)
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
