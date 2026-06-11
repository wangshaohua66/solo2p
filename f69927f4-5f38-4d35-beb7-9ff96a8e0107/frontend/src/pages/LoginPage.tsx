import { useState } from 'react';
import { Flame, User, Lock } from 'lucide-react';
import { Button, Card, Form, Input, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      navigate('/schedule');
    } catch {
      message.error('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #F7F5F2 0%, #EDE8E2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
          border: 'none',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Flame size={48} color="#E8602C" style={{ marginBottom: 8 }} />
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#2D2D2D' }}>
            玻璃工坊
          </h1>
          <p style={{ margin: '8px 0 0', color: '#8C8C8C', fontSize: 14 }}>
            窑炉调度管理系统
          </p>
        </div>

        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<User size={16} color="#8C8C8C" />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<Lock size={16} color="#8C8C8C" />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                background: '#E8602C',
                borderColor: '#E8602C',
                height: 44,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
