import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  CalendarOutlined,
  FileTextOutlined,
  DollarOutlined,
  AppstoreOutlined,
  TeamOutlined,
  UserOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePermission } from '../../utils/permissionUtils';
import { useState } from 'react';
import type { MenuProps } from 'antd';

const { Sider } = Layout;

const iconMap: Record<string, React.ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  CalendarOutlined: <CalendarOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  DollarOutlined: <DollarOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  TeamOutlined: <TeamOutlined />,
  UserOutlined: <UserOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  SettingOutlined: <SettingOutlined />,
};

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onCollapse }) => {
  const { menus } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = location.pathname === '/' ? 'dashboard' : location.pathname.replace('/', '');

  const menuItems: MenuProps['items'] = menus.map(menu => ({
    key: menu.key,
    icon: iconMap[menu.icon],
    label: menu.label,
    onClick: () => navigate(menu.path),
  }));

  return (
    <Sider
      width={240}
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      theme="dark"
      className="shadow-sm"
      trigger={null}
      breakpoint="lg"
      collapsedWidth="64"
    >
      <div className="h-16 flex items-center justify-center border-b border-gray-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">会</span>
            </div>
            <span className="font-semibold text-white">会展中心</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">会</span>
          </div>
        )}
      </div>

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        className="border-none mt-2"
        style={{ height: 'calc(100vh - 64px)' }}
      />
    </Sider>
  );
};

export default Sidebar;
