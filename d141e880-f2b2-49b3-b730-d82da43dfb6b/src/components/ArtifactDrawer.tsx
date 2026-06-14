import React, { useState, useMemo, useCallback } from 'react';
import { Drawer, Tabs, List, Tag, Space, Button, Empty, Descriptions, Divider, message } from 'antd';
import { Plus, Edit, Trash2, MapPin, Calendar, Package, Info, X } from 'lucide-react';
import { useArtifactStore } from '@/stores/artifactStore';
import { useSiteStore } from '@/stores/siteStore';
import ArtifactForm from './ArtifactForm';
import { LAYOUT_CONFIG } from '@/constants';
import type { Artifact, Grid } from '@/types';

const { TabPane } = Tabs;

interface ArtifactDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedGrid?: Grid | null;
  placement?: 'right' | 'bottom';
}

const ArtifactDrawer: React.FC<ArtifactDrawerProps> = ({
  open,
  onClose,
  selectedGrid,
  placement = 'right',
}) => {
  const artifacts = useArtifactStore((state) => state.artifacts);
  const strata = useArtifactStore((state) => state.strata);
  const addArtifact = useArtifactStore((state) => state.addArtifact);
  const updateArtifact = useArtifactStore((state) => state.updateArtifact);
  const deleteArtifact = useArtifactStore((state) => state.deleteArtifact);
  const sites = useSiteStore((state) => state.sites);
  const updateGridArtifactCount = useSiteStore((state) => state.updateGridArtifactCount);

  const [activeTab, setActiveTab] = useState('list');
  const [editingArtifact, setEditingArtifact] = useState<Artifact | null>(null);
  const [viewingArtifact, setViewingArtifact] = useState<Artifact | null>(null);

  const gridArtifacts = useMemo(() => {
    if (!selectedGrid) return [];
    return artifacts.filter(
      (a) => a.siteId === selectedGrid.siteId && a.gridId === selectedGrid.id
    );
  }, [artifacts, selectedGrid]);

  const currentSite = useMemo(() => {
    if (!selectedGrid) return null;
    return sites.find((s) => s.id === selectedGrid.siteId);
  }, [sites, selectedGrid]);

  const getStratumLabel = useCallback(
    (stratumId: string) => {
      const stratum = strata.find((s) => s.id === stratumId);
      return stratum ? `${stratum.layer}层 - ${stratum.soilType}` : '未知地层';
    },
    [strata]
  );

  const handleAddSuccess = () => {
    message.success('遗物登记成功');
    if (selectedGrid) {
      const count = gridArtifacts.length + 1;
      updateGridArtifactCount(selectedGrid.id, count);
    }
    setActiveTab('list');
  };

  const handleUpdateSuccess = () => {
    message.success('遗物更新成功');
    setEditingArtifact(null);
    setActiveTab('list');
  };

  const handleDelete = (artifactId: string) => {
    if (!selectedGrid) return;
    deleteArtifact(artifactId);
    const newCount = Math.max(0, gridArtifacts.length - 1);
    updateGridArtifactCount(selectedGrid.id, newCount);
    message.success('遗物删除成功');
  };

  const handleViewArtifact = (artifact: Artifact) => {
    setViewingArtifact(artifact);
    setActiveTab('detail');
  };

  const handleEditArtifact = (artifact: Artifact) => {
    setEditingArtifact(artifact);
    setActiveTab('form');
  };

  const handleNewArtifact = () => {
    setEditingArtifact(null);
    setViewingArtifact(null);
    setActiveTab('form');
  };

  const renderArtifactList = () => {
    if (!selectedGrid) {
      return (
        <Empty
          description="请先在左侧选择一个探方"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          className="mt-16"
        />
      );
    }

    if (gridArtifacts.length === 0) {
      return (
        <div className="text-center py-12">
          <Package size={48} className="text-stone-300 mx-auto mb-4" />
          <p className="text-stone-500 mb-4">该探方暂无登记遗物</p>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleNewArtifact}
            style={{ backgroundColor: '#8B4513', borderColor: '#8B4513' }}
          >
            登记第一件遗物
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-stone-500">
            共 {gridArtifacts.length} 件遗物
          </span>
          <Button
            type="primary"
            size="small"
            icon={<Plus size={14} />}
            onClick={handleNewArtifact}
            style={{ backgroundColor: '#8B4513', borderColor: '#8B4513' }}
          >
            新增
          </Button>
        </div>
        <List
          dataSource={gridArtifacts}
          renderItem={(artifact) => (
            <List.Item
              className="rounded-lg border border-stone-200 hover:border-amber-300 transition-all cursor-pointer"
              style={{ padding: '12px', marginBottom: '8px' }}
              onClick={() => handleViewArtifact(artifact)}
              actions={[
                <Button
                  key="edit"
                  type="text"
                  size="small"
                  icon={<Edit size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditArtifact(artifact);
                  }}
                />,
                <Button
                  key="delete"
                  type="text"
                  size="small"
                  danger
                  icon={<Trash2 size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(artifact.id);
                  }}
                />,
              ]}
            >
              <List.Item.Meta
                title={
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-800">{artifact.name}</span>
                    <Tag color="#8B4513" style={{ margin: 0, fontSize: '10px' }}>
                      {artifact.category}
                    </Tag>
                    {artifact.subcategory && (
                      <Tag color="default" style={{ margin: 0, fontSize: '10px' }}>
                        {artifact.subcategory}
                      </Tag>
                    )}
                  </div>
                }
                description={
                  <div className="text-xs text-stone-500 space-y-1 mt-1">
                    <div className="flex items-center gap-2">
                      <MapPin size={12} />
                      <span>{getStratumLabel(artifact.stratumId)}</span>
                      <span>·</span>
                      <span>深度 {artifact.depth}m</span>
                    </div>
                    {artifact.period && (
                      <div className="flex items-center gap-2">
                        <Calendar size={12} />
                        <span>{artifact.period}</span>
                      </div>
                    )}
                    {artifact.quantity > 1 && (
                      <div className="flex items-center gap-2">
                        <Package size={12} />
                        <span>共 {artifact.quantity} 件</span>
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </div>
    );
  };

  const renderDetail = () => {
    if (!viewingArtifact) {
      return (
        <Empty
          description="选择一件遗物查看详情"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          className="mt-16"
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-800 m-0">
            {viewingArtifact.name}
          </h3>
          <Space>
            <Button
              size="small"
              icon={<Edit size={14} />}
              onClick={() => handleEditArtifact(viewingArtifact)}
            >
              编辑
            </Button>
            <Button
              size="small"
              icon={<X size={14} />}
              onClick={() => setViewingArtifact(null)}
            >
              关闭
            </Button>
          </Space>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="遗物名称">{viewingArtifact.name}</Descriptions.Item>
          <Descriptions.Item label="类别">
            <Tag color="#8B4513">{viewingArtifact.category}</Tag>
            {viewingArtifact.subcategory && (
              <Tag color="default" className="ml-1">
                {viewingArtifact.subcategory}
              </Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="数量">{viewingArtifact.quantity} 件</Descriptions.Item>
          <Descriptions.Item label="保存状况">
            <Tag
              color={
                viewingArtifact.condition === '完好'
                  ? 'green'
                  : viewingArtifact.condition === '残损'
                  ? 'orange'
                  : 'red'
              }
            >
              {viewingArtifact.condition}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="出土地层">
            {getStratumLabel(viewingArtifact.stratumId)}
          </Descriptions.Item>
          <Descriptions.Item label="出土深度">{viewingArtifact.depth} 米</Descriptions.Item>
          <Descriptions.Item label="坐标偏移">
            X: {viewingArtifact.offsetX}m, Y: {viewingArtifact.offsetY}m
          </Descriptions.Item>
          <Descriptions.Item label="年代推断">{viewingArtifact.period || '未推断'}</Descriptions.Item>
          {viewingArtifact.notes && (
            <Descriptions.Item label="备注">
              <div className="whitespace-pre-wrap text-stone-600">
                {viewingArtifact.notes}
              </div>
            </Descriptions.Item>
          )}
        </Descriptions>

        <div className="pt-4">
          <div className="flex items-center gap-2 text-xs text-stone-400 mb-2">
            <Info size={12} />
            <span>关联信息</span>
          </div>
          <div className="text-sm text-stone-600 space-y-1">
            <div>
              所属工地：{sites.find((s) => s.id === viewingArtifact.siteId)?.name}
            </div>
            <div>
              所属探方：
              {selectedGrid
                ? `T${selectedGrid.row + 1}${String.fromCharCode(65 + selectedGrid.col)}`
                : '未知'}
            </div>
            <div>
              登记时间：
              {new Date(viewingArtifact.createdAt).toLocaleString('zh-CN')}
            </div>
            {viewingArtifact.updatedAt !== viewingArtifact.createdAt && (
              <div>
                更新时间：
                {new Date(viewingArtifact.updatedAt).toLocaleString('zh-CN')}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderForm = () => {
    if (!selectedGrid) {
      return (
        <Empty
          description="请先选择探方再登记遗物"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          className="mt-16"
        />
      );
    }

    return (
      <ArtifactForm
        grid={selectedGrid}
        site={currentSite}
        editingArtifact={editingArtifact}
        onSuccess={editingArtifact ? handleUpdateSuccess : handleAddSuccess}
        strata={strata.filter((s) => s.siteId === selectedGrid.siteId)}
      />
    );
  };

  const title = selectedGrid ? (
    <div>
      <span className="font-medium">探方 </span>
      <Tag color="#8B4513" style={{ fontSize: '12px' }}>
        T{selectedGrid.row + 1}
        {String.fromCharCode(65 + selectedGrid.col)}
      </Tag>
      <span className="text-stone-500 text-sm ml-2">
        {currentSite?.name}
      </span>
    </div>
  ) : (
    '遗物登记'
  );

  const drawerWidth = placement === 'right' ? LAYOUT_CONFIG.rightDrawerWidth : undefined;

  return (
    <Drawer
      title={title}
      placement={placement}
      open={open}
      onClose={onClose}
      width={drawerWidth}
      height={placement === 'bottom' ? '60%' : undefined}
      extra={
        selectedGrid && (
          <Space>
            <Tag color="green" style={{ margin: 0 }}>
              已登记 {gridArtifacts.length} 件
            </Tag>
          </Space>
        )
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: '遗物列表',
            children: renderArtifactList(),
          },
          {
            key: 'form',
            label: editingArtifact ? '编辑遗物' : '登记遗物',
            children: renderForm(),
          },
          {
            key: 'detail',
            label: '详情',
            children: renderDetail(),
          },
        ]}
      />
    </Drawer>
  );
};

export default ArtifactDrawer;
