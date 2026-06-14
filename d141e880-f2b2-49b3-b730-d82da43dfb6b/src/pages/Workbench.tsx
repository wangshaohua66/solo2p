import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Empty, Tag, Space, Tooltip, Button, Drawer, message } from 'antd';
import { useMediaQuery } from 'react-responsive';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import SiteList from '@/components/SiteList';
import GridCanvas from '@/components/GridCanvas';
import StrataChart from '@/components/StrataChart';
import ArtifactDrawer from '@/components/ArtifactDrawer';
import { useSiteStore } from '@/stores/siteStore';
import { useArtifactStore } from '@/stores/artifactStore';
import { LAYOUT_CONFIG } from '@/constants';
import { getSiteStatusLabel } from '@/utils/color';
import type { Site, Grid, Stratum } from '@/types';

const { Content, Sider } = Layout;

const Workbench: React.FC = () => {
  const navigate = useNavigate();
  const currentSite = useSiteStore((state) => state.currentSite);
  const selectedGridId = useSiteStore((state) => state.selectedGridId);
  const sites = useSiteStore((state) => state.sites);
  const setCurrentSite = useSiteStore((state) => state.setCurrentSite);
  const setSelectedGrid = useSiteStore((state) => state.setSelectedGrid);
  const grids = useSiteStore((state) => state.grids);
  const addStratum = useArtifactStore((state) => state.addStratum);
  const updateStratum = useArtifactStore((state) => state.updateStratum);
  const deleteStratum = useArtifactStore((state) => state.deleteStratum);
  const strata = useArtifactStore((state) => state.strata);
  const getGridsBySite = useSiteStore((state) => state.getGridsBySite);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickRegisterGrid, setQuickRegisterGrid] = useState<Grid | null>(null);

  const isSmallScreen = useMediaQuery({ maxWidth: 1366 });
  const isMobile = useMediaQuery({ maxWidth: 768 });

  const selectedGrid = useMemo(() => {
    return grids.find((g) => g.id === selectedGridId) || null;
  }, [grids, selectedGridId]);

  const currentSiteStrata = useMemo(() => {
    if (!currentSite) return [];
    return strata.filter((s) => s.siteId === currentSite.id);
  }, [strata, currentSite]);

  const currentSiteGrids = useMemo(() => {
    if (!currentSite) return [];
    return getGridsBySite(currentSite.id);
  }, [currentSite, getGridsBySite]);

  useEffect(() => {
    if (sites.length > 0 && !currentSite) {
      const firstExcavating = sites.find((s) => s.status === 'excavating');
      if (firstExcavating) {
        setCurrentSite(firstExcavating.id);
      } else {
        setCurrentSite(sites[0].id);
      }
    }
  }, [sites, currentSite, setCurrentSite]);

  useEffect(() => {
    if (selectedGridId) {
      setDrawerOpen(true);
    }
  }, [selectedGridId]);

  const handleSiteSelect = (site: Site) => {
    setCurrentSite(site.id);
    setSelectedGrid(null);
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  };

  const handleGridSelect = (grid: Grid | null) => {
    if (grid) {
      setSelectedGrid(grid.id);
      setDrawerOpen(true);
    } else {
      setSelectedGrid(null);
    }
  };

  const handleQuickRegister = (grid: Grid) => {
    setQuickRegisterGrid(grid);
    setSelectedGrid(grid.id);
    setDrawerOpen(true);
  };

  const handleAddStratum = () => {
    if (!currentSite) {
      message.warning('请先选择工地');
      return;
    }
    const currentDepth = currentSiteStrata.reduce((sum, s) => sum + s.thickness, 0);
    const newStratum: Omit<Stratum, 'id'> = {
      siteId: currentSite.id,
      gridId: selectedGrid?.id || '',
      layer: currentSiteStrata.length + 1,
      layerIndex: currentSiteStrata.length,
      name: `第${currentSiteStrata.length + 1}层`,
      soilType: '黄褐色土',
      soilColor: '#D4B896',
      thickness: 0.3,
      depthFrom: currentDepth,
      depthTo: currentDepth + 0.3,
      depthTop: currentDepth,
      depthBottom: currentDepth + 0.3,
      period: '',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addStratum(newStratum);
    message.success('地层添加成功');
  };

  const handleUpdateStratum = (stratumId: string, updates: Partial<any>) => {
    updateStratum(stratumId, updates);
  };

  const handleDeleteStratum = (stratumId: string) => {
    deleteStratum(stratumId);
    message.success('地层删除成功');
  };

  if (sites.length === 0) {
    return (
      <Layout className="h-screen">
        <Content className="flex items-center justify-center bg-stone-50">
          <Empty
            description={
              <div>
                <p className="text-stone-600 mb-4">暂无发掘工地数据</p>
                <Button
                  type="primary"
                  onClick={() => navigate('/dashboard')}
                  style={{ backgroundColor: '#8B4513', borderColor: '#8B4513' }}
                >
                  前往总览创建工地
                </Button>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Content>
      </Layout>
    );
  }

  const drawerPlacement = isSmallScreen ? 'bottom' : 'right';

  return (
    <Layout className="h-screen overflow-hidden">
      {!isMobile && !sidebarCollapsed && (
        <Sider
          width={LAYOUT_CONFIG.leftPanelWidth}
          className="bg-stone-100 border-r border-stone-200"
          trigger={null}
          collapsible
          collapsed={sidebarCollapsed}
        >
          <SiteList
            onSiteSelect={handleSiteSelect}
            currentSiteId={currentSite?.id}
          />
        </Sider>
      )}

      {isMobile && (
        <Drawer
          placement="left"
          open={!sidebarCollapsed}
          onClose={() => setSidebarCollapsed(true)}
          width={LAYOUT_CONFIG.leftPanelWidth}
          bodyStyle={{ padding: 0 }}
          headerStyle={{ display: 'none' }}
        >
          <SiteList
            onSiteSelect={(site) => {
              handleSiteSelect(site);
              setSidebarCollapsed(true);
            }}
            currentSiteId={currentSite?.id}
          />
        </Drawer>
      )}

      <Layout className="flex flex-col">
        {currentSite && (
          <div className="px-4 py-2 bg-white border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isMobile && (
                <Button
                  type="text"
                  icon={<ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />}
                  onClick={() => setSidebarCollapsed(false)}
                />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-stone-800 m-0">
                    {currentSite.name}
                  </h2>
                  <Tag
                    color={
                      currentSite.status === 'excavating'
                        ? 'green'
                        : currentSite.status === 'planning'
                        ? 'blue'
                        : 'default'
                    }
                    style={{ margin: 0, fontSize: '11px' }}
                  >
                    {getSiteStatusLabel(currentSite.status)}
                  </Tag>
                  {new Date(currentSite.endDate) < new Date() &&
                    currentSite.status !== 'completed' && (
                      <Tooltip title="已逾期">
                        <AlertTriangle size={14} className="text-red-500" />
                      </Tooltip>
                    )}
                </div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {currentSite.location} · {currentSiteGrids.length} 个探方 ·{' '}
                  {currentSiteStrata.length} 层地层
                </div>
              </div>
            </div>
            <Space>
              <Tooltip title="添加地层">
                <Button size="small" onClick={handleAddStratum}>
                  + 地层
                </Button>
              </Tooltip>
              <Tooltip title="完成探方">
                <Button size="small" type="primary"
                  style={{ backgroundColor: '#8B4513', borderColor: '#8B4513' }}
                >
                  完成探方
                </Button>
              </Tooltip>
            </Space>
          </div>
        )}

        <Content className="flex-1 flex flex-col overflow-hidden bg-stone-50">
          {currentSite ? (
            <>
              <div className="flex-1 overflow-hidden" style={{ height: '60%' }}>
                <GridCanvas
                  site={currentSite}
                  grids={currentSiteGrids}
                  selectedGridId={selectedGridId}
                  onGridSelect={handleGridSelect}
                  onQuickRegister={handleQuickRegister}
                />
              </div>
              <div className="h-0.5 bg-stone-200" />
              <div className="flex-1 overflow-hidden" style={{ height: '40%' }}>
                <StrataChart
                  strata={currentSiteStrata}
                  siteId={currentSite.id}
                  onUpdateStratum={handleUpdateStratum}
                  onDeleteStratum={handleDeleteStratum}
                  onAddStratum={handleAddStratum}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Empty description="请从左侧选择一个工地开始工作" />
            </div>
          )}
        </Content>
      </Layout>

      <ArtifactDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedGrid={quickRegisterGrid || selectedGrid}
        placement={drawerPlacement}
      />
    </Layout>
  );
};

export default Workbench;
