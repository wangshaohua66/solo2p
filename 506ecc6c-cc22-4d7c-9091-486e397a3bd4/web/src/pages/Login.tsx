import React, { useState } from 'react';
import { Form, Input, Button, Card, Select, Typography, App as AntdApp } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { login } from '@/store/appSlice';
import { UserRole, UserRoleNames } from '@/types';

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const { authLoading } = useAppSelector((s) => s.app);

  const roleOptions = [
    { value: 'admin', label: `${UserRoleNames.admin} - 全功能` },
    { value: 'finance', label: `${UserRoleNames.finance} - 财务权限` },
    { value: 'copyright', label: `${UserRoleNames.copyright} - 版权权限` },
    { value: 'producer', label: `${UserRoleNames.producer} - 制作权限` },
    { value: 'artist', label: `${UserRoleNames.artist} - 艺人视角` },
  ];

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await dispatch(login(values)).unwrap();
      message.success('登录成功，欢迎回来！');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      message.error(err?.response?.data?.message || '登录失败，请检查凭证');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (role: UserRole) => {
    setLoading(true);
    try {
      await dispatch(login({ username: role, password: '' })).unwrap();
      message.success(`以 ${UserRoleNames[role]} 身份登录`);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      message.error('快捷登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `
          radial-gradient(ellipse at top left, rgba(212,175,55,0.08) 0%, transparent 50%),
          radial-gradient(ellipse at bottom right, rgba(139,105,20,0.08) 0%, transparent 50%),
          #0F0D06
        `,
        padding: 24,
      }}
    >
      <Card
        className="gold-card"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 8,
        }}
        styles={{ body: { padding: 40 } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ marginBottom: 16 }}>
            <span
              className="gold-gradient-text"
              style={{ fontSize: 40, fontWeight: 900, letterSpacing: 4 }}
            >
              LabelOps
            </span>
          </div>
          <Title level={4} style={{ color: '#E8D8A0', marginBottom: 8, fontWeight: 400 }}>
            独立厂牌音乐管理平台
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            作品全生命周期 · 版权链追溯 · 版税智能结算 · 盗版监控
          </Text>
        </div>

        <Form name="login" layout="vertical" onFinish={onFinish} initialValues={{ username: 'admin', password: 'admin' }}>
          <Form.Item
            label="账户名"
            name="username"
            rules={[{ required: true, message: '请输入账户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#D4AF37' }} />}
              placeholder="admin / finance / copyright / producer / artist"
              size="large"
              style={{ background: '#1A170E' }}
            />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#D4AF37' }} />}
              placeholder="任意密码即可（演示环境）"
              size="large"
              style={{ background: '#1A170E' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading || authLoading}
              block
              size="large"
              style={{
                height: 46,
                background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)',
                border: 'none',
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              登 录
            </Button>
          </Form.Item>

          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>快捷登录（按角色体验）</Text>
          </div>

          <Select
            size="large"
            placeholder="选择角色快速登录"
            options={roleOptions}
            style={{ width: '100%', marginBottom: 16 }}
            onSelect={(val) => quickLogin(val as UserRole)}
            optionLabelProp="label"
          />

          <div
            style={{
              marginTop: 32,
              padding: '12px 16px',
              background: '#1A170E',
              borderRadius: 8,
              border: '1px solid #2A2312',
              fontSize: 12,
              color: '#8B7A4A',
              lineHeight: 1.7,
            }}
          >
            <div>🎵 当前管理：45 组艺人 · 1,200 首作品 · 年发行 30 张专辑 + 200 首单曲</div>
            <div>📊 接入 6 家主流平台：网易云 / QQ音乐 / 酷狗 / 酷我 / Spotify / Apple Music</div>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
