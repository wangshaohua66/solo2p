import { Layout, Avatar, Dropdown, Badge, Button } from 'antd';
import { BellOutlined, UserOutlined, LogoutOutlined, SettingOutlined, MessageOutlined } from '@ant-design/icons';
import { useUserStore } from '../../stores/userStore';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { generateMockAlerts } from '../../utils/mockData';
import type { SystemAlert } from '../../types';

const { Header: AntHeader } = Layout;

interface HeaderProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ collapsed, onCollapse }) => {
  const { user, logout } = useUserStore();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);

  useEffect(() => {
    setAlerts(generateMockAlerts());
  }, []);

  const unreadCount = alerts.filter(a => !a.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/system'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const notificationItems = alerts.map(alert => ({
    key: alert.id,
    label: (
      <div className="py-2">
        <div className="font-medium text-gray-800">{alert.title}</div>
        <div className="text-sm text-gray-500 mt-1">{alert.message}</div>
      </div>
    ),
  }));

  return (
    <AntHeader className="bg-white border-b border-gray-200 px-6 h-16 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Button
          type="text"
          icon={<span className="text-xl">☰</span>}
          onClick={() => onCollapse(!collapsed)}
          className="lg:hidden"
        />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">会</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800 m-0 leading-tight">
              国际会展中心运营管理系统
            </h1>
            <p className="text-xs text-gray-500 m-0">智慧运营 · 高效管理</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Dropdown
          menu={{ items: notificationItems }}
          placement="bottomRight"
          trigger={['click']}
          overlayClassName="w-80"
        >
          <Badge count={unreadCount} size="small">
            <Button
              type="text"
              icon={<BellOutlined className="text-xl" />}
              className="hover:bg-gray-100"
            />
          </Badge>
        </Dropdown>

        <Button
          type="text"
          icon={<MessageOutlined className="text-xl" />}
          className="hover:bg-gray-100"
        />

        <div className="w-px h-6 bg-gray-200 mx-2" />

        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
          <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors">
            <Avatar size={36} icon={<UserOutlined />} className="bg-blue-500">
              {user?.realName?.charAt(0)}
            </Avatar>
            <div className="hidden md:block">
              <div className="text-sm font-medium text-gray-800">{user?.realName}</div>
              <div className="text-xs text-gray-500">
                {user?.role === 'admin' ? '系统管理员' : 
                 user?.role === 'operator' ? '运营人员' :
                 user?.role === 'organizer' ? '主办方' :
                 user?.role === 'exhibitor' ? '参展商' :
                 user?.role === 'provider' ? '服务商' : '观众'}
              </div>
            </div>
          </div>
        </Dropdown>
      </div>
    </AntHeader>
  );
};

export default Header;
