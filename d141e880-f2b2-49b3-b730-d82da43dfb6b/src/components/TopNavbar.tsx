import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Layout,
  Menu,
  Input,
  Dropdown,
  Avatar,
  Badge,
  Button,
  Space,
  Tooltip,
  Modal,
  message,
} from 'antd';
import {
  Search,
  Menu as MenuIcon,
  Bell,
  Download,
  Upload,
  Settings,
  LogOut,
  User,
  Database,
  FileJson,
  Trash2,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSiteStore } from '@/stores/siteStore';
import { useArtifactStore } from '@/stores/artifactStore';
import { exportData, importData, clearStorage, checkStorageSize } from '@/utils/storage';
import type { MenuProps } from 'antd';

const { Header } = Layout;
const { Search: SearchInput } = Input;

interface TopNavbarProps {
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

const TopNavbar: React.FC<TopNavbarProps> = ({ onToggleSidebar, sidebarCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useSiteStore((state) => state.currentUser);
  const sites = useSiteStore((state) => state.sites);
  const artifacts = useArtifactStore((state) => state.artifacts);
  const searchArtifacts = useArtifactStore((state) => state.searchArtifacts);
  const setCurrentSite = useSiteStore((state) => state.setCurrentSite);
  const hydrate = useSiteStore((state) => state.hydrate);

  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [storageModalVisible, setStorageModalVisible] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 5, percentage: 0 });
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const info = checkStorageSize();
    setStorageInfo(info);
  }, [sites.length, artifacts.length]);

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      label: '总览看板',
    },
    {
      key: '/workbench',
      label: '发掘工作台',
    },
    {
      key: '/strata',
      label: '地层对比',
    },
    {
      key: '/statistics',
      label: '遗物统计',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (!value.trim()) {
        setSearchResults([]);
        setSearchVisible(false);
        return;
      }

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        const startTime = performance.now();
        const results = searchArtifacts({ keyword: value });
        const duration = performance.now() - startTime;

        if (duration > 300) {
          console.warn(`搜索耗时 ${duration.toFixed(2)}ms，超过300ms阈值`);
        }

        const siteResults = sites.filter(
          (s) =>
            s.name.toLowerCase().includes(value.toLowerCase()) ||
            s.location.toLowerCase().includes(value.toLowerCase())
        );

        setSearchResults([
          ...siteResults.map((s) => ({ ...s, _type: 'site' })),
          ...results.map((a) => ({ ...a, _type: 'artifact' })),
        ]);
        setSearchVisible(true);
      }, 150);
    },
    [searchArtifacts, sites]
  );

  const handleResultClick = (result: any) => {
    if (result._type === 'site') {
      setCurrentSite(result.id);
      navigate('/workbench');
    } else {
      setCurrentSite(result.siteId);
      navigate('/workbench');
    }
    setSearchVisible(false);
    setSearchValue('');
  };

  const handleExport = () => {
    try {
      const data = exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `考古数据_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('数据导出成功');
    } catch (error) {
      message.error('数据导出失败：' + (error as Error).message);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      Modal.confirm({
        title: '确认导入数据',
        content: '导入将覆盖当前所有数据，是否继续？',
        okText: '确认导入',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: () => {
          importData(data);
          hydrate?.();
          message.success('数据导入成功');
        },
      });
    } catch (error) {
      message.error('文件解析失败：' + (error as Error).message);
    }
    e.target.value = '';
  };

  const handleClearData = () => {
    Modal.confirm({
      title: '确认清空数据',
      content: '此操作将删除所有本地数据，且无法恢复。是否继续？',
      okText: '确认清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        clearStorage();
        window.location.reload();
      },
    });
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <User size={16} />,
      label: '个人信息',
    },
    {
      key: 'storage',
      icon: <Database size={16} />,
      label: '存储管理',
      onClick: () => setStorageModalVisible(true),
    },
    {
      type: 'divider',
    },
    {
      key: 'export',
      icon: <Download size={16} />,
      label: '导出数据',
      onClick: handleExport,
    },
    {
      key: 'import',
      icon: <Upload size={16} />,
      label: '导入数据',
      onClick: handleImportClick,
    },
    {
      key: 'clear',
      icon: <Trash2 size={16} />,
      label: '清空数据',
      danger: true,
      onClick: handleClearData,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogOut size={16} />,
      label: '退出登录',
    },
  ];

  return (
    <Header
      className="flex items-center justify-between px-4 border-b border-stone-200"
      style={{
        background: '#fff',
        height: 56,
        lineHeight: '56px',
        padding: '0 16px',
      }}
    >
      <div className="flex items-center gap-4">
        {onToggleSidebar && (
          <Tooltip title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>
            <Button
              type="text"
              icon={<MenuIcon size={20} />}
              onClick={onToggleSidebar}
              className="md:hidden"
            />
          </Tooltip>
        )}

        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#8B4513' }}
          >
            <FileJson size={18} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold text-stone-800 m-0 hidden sm:block">
            考古发掘管理系统
          </h1>
        </div>

        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-none bg-transparent hidden md:flex"
          style={{ minWidth: 400 }}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block" style={{ width: 320 }}>
          <SearchInput
            placeholder="全局搜索遗物、工地..."
            allowClear
            size="middle"
            prefix={<Search size={16} className="text-stone-400" />}
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchValue && setSearchVisible(true)}
            onBlur={() => setTimeout(() => setSearchVisible(false), 200)}
          />
          {searchVisible && searchResults.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-stone-200 z-50 max-h-80 overflow-y-auto"
              style={{ width: '100%' }}
            >
              {searchResults.slice(0, 10).map((result, index) => (
                <div
                  key={`${result._type}-${result.id}-${index}`}
                  className="px-3 py-2 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-b-0"
                  onMouseDown={() => handleResultClick(result)}
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      color={result._type === 'site' ? '#1890ff' : '#8B4513'}
                      text={result._type === 'site' ? '工地' : '遗物'}
                    />
                    <span className="text-sm text-stone-800 flex-1 truncate">
                      {result.name || result.title}
                    </span>
                  </div>
                  {result._type === 'artifact' && (
                    <div className="text-xs text-stone-500 mt-1 pl-5">
                      {result.category} · {sites.find((s) => s.id === result.siteId)?.name}
                    </div>
                  )}
                </div>
              ))}
              {searchResults.length > 10 && (
                <div className="px-3 py-2 text-center text-xs text-stone-400">
                  还有 {searchResults.length - 10} 条结果
                </div>
              )}
            </div>
          )}
        </div>

        <Space size="small">
          <Tooltip title="导出数据">
            <Button
              type="text"
              icon={<Download size={18} />}
              onClick={handleExport}
              className="hidden sm:inline-flex"
            />
          </Tooltip>

          <Tooltip title="通知">
            <Badge count={3} size="small">
              <Button type="text" icon={<Bell size={18} />} />
            </Badge>
          </Tooltip>

          <Tooltip title="设置">
            <Button type="text" icon={<Settings size={18} />} />
          </Tooltip>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 px-2 py-1 rounded">
              <Avatar
                size={32}
                style={{ backgroundColor: '#8B4513' }}
                icon={<User size={18} />}
              />
              <span className="text-sm text-stone-700 hidden md:inline">
                {currentUser?.name || '用户'}
              </span>
            </div>
          </Dropdown>
        </Space>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Modal
        title="存储管理"
        open={storageModalVisible}
        onCancel={() => setStorageModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setStorageModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-stone-600">存储空间使用</span>
              <span className="text-stone-800">
                {storageInfo.used.toFixed(2)} MB / {storageInfo.total} MB
              </span>
            </div>
            <div className="h-3 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${storageInfo.percentage}%`,
                  backgroundColor:
                    storageInfo.percentage > 90
                      ? '#ef4444'
                      : storageInfo.percentage > 70
                      ? '#eab308'
                      : '#22c55e',
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-stone-50 rounded-lg">
              <div className="text-stone-500">工地数量</div>
              <div className="text-xl font-semibold text-stone-800">{sites.length}</div>
            </div>
            <div className="p-3 bg-stone-50 rounded-lg">
              <div className="text-stone-500">遗物数量</div>
              <div className="text-xl font-semibold text-stone-800">{artifacts.length}</div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Button block icon={<Download size={16} />} onClick={handleExport}>
              导出全部数据
            </Button>
            <Button block icon={<Upload size={16} />} onClick={handleImportClick}>
              导入数据
            </Button>
            <Button
              block
              danger
              icon={<Trash2 size={16} />}
              onClick={handleClearData}
            >
              清空所有数据
            </Button>
          </div>
        </div>
      </Modal>
    </Header>
  );
};

export default TopNavbar;
