import React, { useMemo } from 'react';
import { List, Tag, Space, Button, Input, Badge, Tooltip, Collapse } from 'antd';
import { Search, Plus, MapPin, Users, Calendar, ChevronRight, AlertTriangle } from 'lucide-react';
import { useSiteStore } from '@/stores/siteStore';
import { useArtifactStore } from '@/stores/artifactStore';
import { getSiteStatusLabel, getSiteStatusColor } from '@/utils/color';
import { LAYOUT_CONFIG } from '@/constants';
import type { Site } from '@/types';

const { Search: SearchInput } = Input;
const { Panel } = Collapse;

interface SiteListProps {
  onSiteSelect?: (site: Site) => void;
  onAddSite?: () => void;
  currentSiteId?: string;
}

const SiteList: React.FC<SiteListProps> = ({ onSiteSelect, onAddSite, currentSiteId }) => {
  const sites = useSiteStore((state) => state.sites);
  const setCurrentSite = useSiteStore((state) => state.setCurrentSite);
  const getArtifactsBySite = useArtifactStore((state) => state.getArtifactsBySite);
  const getGridsBySite = useSiteStore((state) => state.getGridsBySite);
  const users = useSiteStore((state) => state.users);

  const [searchText, setSearchText] = React.useState('');

  const filteredSites = useMemo(() => {
    if (!searchText) return sites;
    const lower = searchText.toLowerCase();
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.location.toLowerCase().includes(lower) ||
        s.description?.toLowerCase().includes(lower)
    );
  }, [sites, searchText]);

  const groupedSites = useMemo(() => {
    return {
      excavating: filteredSites.filter((s) => s.status === 'excavating'),
      planning: filteredSites.filter((s) => s.status === 'planning'),
      completed: filteredSites.filter((s) => s.status === 'completed'),
    };
  }, [filteredSites]);

  const handleSiteClick = (site: Site) => {
    setCurrentSite(site.id);
    onSiteSelect?.(site);
  };

  const getManagerName = (managerId: string) => {
    return users.find((u) => u.id === managerId)?.name || '未分配';
  };

  const getSiteStats = (siteId: string) => {
    const grids = getGridsBySite(siteId);
    const artifacts = getArtifactsBySite(siteId);
    const completedGrids = grids.filter((g) => g.status === 'completed').length;
    const progress = grids.length > 0 ? Math.round((completedGrids / grids.length) * 100) : 0;
    return { gridCount: grids.length, artifactCount: artifacts.length, progress };
  };

  const isOverdue = (site: Site) => {
    return site.status !== 'completed' && new Date(site.endDate) < new Date();
  };

  const renderSiteItem = (site: Site) => {
    const stats = getSiteStats(site.id);
    const isActive = site.id === currentSiteId;
    const overdue = isOverdue(site);

    return (
      <List.Item
        key={site.id}
        onClick={() => handleSiteClick(site)}
        className={`cursor-pointer rounded-lg mb-2 transition-all duration-200 border-l-4 ${
          isActive
            ? 'bg-amber-50 border-amber-600'
            : 'bg-white hover:bg-stone-50 border-transparent'
        }`}
        style={{
          padding: '12px',
          margin: '4px 0',
          boxShadow: isActive ? '0 2px 8px rgba(139, 69, 19, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div className="w-full">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-medium text-stone-800 truncate">{site.name}</span>
              {overdue && (
                <Tooltip title="已逾期">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                </Tooltip>
              )}
            </div>
            <ChevronRight
              size={16}
              className={`flex-shrink-0 transition-colors ${
                isActive ? 'text-amber-600' : 'text-stone-400'
              }`}
            />
          </div>

          <div className="flex items-center gap-1 mb-2">
            <Tag
              color={getSiteStatusColor(site.status)}
              style={{ margin: 0, padding: '0 6px', fontSize: '11px' }}
            >
              {getSiteStatusLabel(site.status)}
            </Tag>
            <Badge
              count={stats.artifactCount}
              size="small"
              color="#8B4513"
              style={{ fontSize: '10px' }}
            />
          </div>

          <div className="space-y-1 text-xs text-stone-500">
            <div className="flex items-center gap-1">
              <MapPin size={12} />
              <span className="truncate">{site.location}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>{getManagerName(site.managerId)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={12} />
              <span>
                {new Date(site.startDate).toLocaleDateString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                })}
              </span>
            </div>
          </div>

          {stats.gridCount > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-stone-500 mb-1">
                <span>探方 {stats.gridCount} 个</span>
                <span>{stats.progress}%</span>
              </div>
              <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${stats.progress}%`,
                    backgroundColor:
                      overdue ? '#ef4444' : stats.progress >= 80 ? '#22c55e' : '#eab308',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </List.Item>
    );
  };

  return (
    <div
      className="h-full flex flex-col bg-stone-100 border-r border-stone-200"
      style={{ width: LAYOUT_CONFIG.leftPanelWidth }}
    >
      <div className="p-4 border-b border-stone-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-stone-800 m-0">发掘工地</h2>
          <Tooltip title="新建工地">
            <Button
              type="primary"
              icon={<Plus size={16} />}
              size="small"
              onClick={onAddSite}
              style={{ backgroundColor: '#8B4513', borderColor: '#8B4513' }}
            />
          </Tooltip>
        </div>
        <SearchInput
          placeholder="搜索工地名称、位置..."
          allowClear
          size="small"
          prefix={<Search size={14} className="text-stone-400" />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <Collapse
          ghost
          defaultActiveKey={['excavating', 'planning', 'completed']}
          className="site-collapse"
        >
          <Panel
            header={
              <Space>
                <span className="text-sm font-medium">进行中</span>
                <Tag color="green" style={{ margin: 0, fontSize: '10px' }}>
                  {groupedSites.excavating.length}
                </Tag>
              </Space>
            }
            key="excavating"
          >
            <List
              dataSource={groupedSites.excavating}
              renderItem={renderSiteItem}
              locale={{ emptyText: '暂无进行中的工地' }}
            />
          </Panel>

          <Panel
            header={
              <Space>
                <span className="text-sm font-medium">规划中</span>
                <Tag color="blue" style={{ margin: 0, fontSize: '10px' }}>
                  {groupedSites.planning.length}
                </Tag>
              </Space>
            }
            key="planning"
          >
            <List
              dataSource={groupedSites.planning}
              renderItem={renderSiteItem}
              locale={{ emptyText: '暂无规划中的工地' }}
            />
          </Panel>

          <Panel
            header={
              <Space>
                <span className="text-sm font-medium">已完成</span>
                <Tag color="default" style={{ margin: 0, fontSize: '10px' }}>
                  {groupedSites.completed.length}
                </Tag>
              </Space>
            }
            key="completed"
          >
            <List
              dataSource={groupedSites.completed}
              renderItem={renderSiteItem}
              locale={{ emptyText: '暂无已完成的工地' }}
            />
          </Panel>
        </Collapse>
      </div>

      <div className="p-3 border-t border-stone-200 bg-white text-xs text-stone-500">
        <div className="flex justify-between">
          <span>总工地数</span>
          <span className="font-medium text-stone-700">{sites.length}</span>
        </div>
      </div>
    </div>
  );
};

export default SiteList;
