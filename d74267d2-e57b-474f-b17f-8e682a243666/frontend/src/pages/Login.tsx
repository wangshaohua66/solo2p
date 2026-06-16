import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Spin } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { login } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { LoginRequest } from '@/types/api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const setAuth = useAuthStore((state) => state.login);

  const handleSubmit = async (values: LoginRequest) => {
    setLoading(true);
    try {
      const response = await login(values);
      setAuth(response.accessToken, response.user);
      message.success('登录成功');
      navigate('/', { replace: true });
    } catch (error: any) {
      message.error(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0e1a 0%, #1e293b 50%, #0f172a 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: `
              radial-gradient(circle at 20% 30%, rgba(24, 144, 255, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(82, 196, 26, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, rgba(250, 140, 22, 0.08) 0%, transparent 60%)
            `,
            animation: 'pulse 8s ease-in-out infinite',
          }}
        />
      </div>

      <Card
        style={{
          width: 420,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid #1e293b',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(20px)',
          zIndex: 1,
        }}
        bodyStyle={{ padding: '40px 32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: '0 auto 16px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(24, 144, 255, 0.3)',
            }}
          >
            <SafetyOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <h1
            style={{
              color: '#fff',
              fontSize: 24,
              fontWeight: 600,
              margin: 0,
              marginBottom: 8,
            }}
          >
            省级应急管理指挥系统
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.45)', margin: 0, fontSize: 13 }}>
            Emergency Management Command System
          </p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
          initialValues={{ username: 'admin', password: '123456' }}
        >
          <Form.Item
            name="username"
            label={<span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>用户名</span>}
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'rgba(255, 255, 255, 0.45)' }} />}
              placeholder="请输入用户名"
              style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid #1e293b',
                color: '#fff',
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>密码</span>}
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'rgba(255, 255, 255, 0.45)' }} />}
              placeholder="请输入密码"
              style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid #1e293b',
                color: '#fff',
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{
                height: 44,
                fontSize: 16,
                fontWeight: 500,
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
              }}
            >
              {loading ? <Spin size="small" /> : '登 录'}
            </Button>
          </Form.Item>
        </Form>

        <div
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid #1e293b',
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.35)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '4px 0' }}>默认账户：admin / 123456</p>
          <p style={{ margin: '4px 0' }}>© 2024 省级应急管理厅 版权所有</p>
        </div>
      </Card>
    </div>
  );
};

export default Login;
