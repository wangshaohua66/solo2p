import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Stage, Layer, Rect, Group, Text, Line, Image as KonvaImage } from 'react-konva';
import { Button, Input, Modal, Upload, message } from 'antd';
import { Plus, Edit3, Camera, Trash2, MoveVertical, Upload as UploadIcon } from 'lucide-react';
import { useSiteStore } from '@/stores/siteStore';
import { useArtifactStore } from '@/stores/artifactStore';
import { getSoilColor, getPeriodColor, getSoilColorWithOpacity } from '@/utils/color';
import { SOIL_TYPE_OPTIONS, SOIL_COLOR_OPTIONS, PERIOD_OPTIONS } from '@/constants';
import type { Stratum } from '@/types';
import useImage from 'use-image';
import Konva from 'konva';

const CHART_WIDTH = 300;
const CHART_HEIGHT = 400;
const DEPTH_SCALE = 80;

interface StrataChartProps {
  gridId?: string;
  onStratumSelect?: (stratum: Stratum) => void;
  strata?: Stratum[];
  siteId?: string;
  onUpdateStratum?: (stratumId: string, updates: Partial<Stratum>) => void;
  onDeleteStratum?: (stratumId: string) => void;
  onAddStratum?: () => void;
}

const StrataChart: React.FC<StrataChartProps> = ({ gridId: propGridId, onStratumSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [containerHeight, setContainerHeight] = useState(400);
  const [editingStratum, setEditingStratum] = useState<Stratum | null>(null);
  const [draggingStratumId, setDraggingStratumId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);

  const storeGridId = useSiteStore((state) => state.selectedGridId);
  const storeSiteId = useSiteStore((state) => state.currentSiteId);
  const activeGridId = propGridId || storeGridId;
  const currentSiteId = storeSiteId;
  const getGridById = useSiteStore((state) => state.getGridById);
  const getStrataByGrid = useArtifactStore((state) => state.getStrataByGrid);
  const addStratum = useArtifactStore((state) => state.addStratum);
  const updateStratum = useArtifactStore((state) => state.updateStratum);
  const deleteStratum = useArtifactStore((state) => state.deleteStratum);
  const setSelectedStratum = useArtifactStore((state) => state.setSelectedStratum);
  const selectedStratumId = useArtifactStore((state) => state.selectedStratumId);

  const grid = getGridById(activeGridId || '');
  const strata = getStrataByGrid(activeGridId || '');

  const [newStratum, setNewStratum] = useState({
    name: '',
    thickness: 0.3,
    soilType: SOIL_TYPE_OPTIONS[0].value,
    soilColor: SOIL_COLOR_OPTIONS[0].value,
    period: PERIOD_OPTIONS[0].value,
    description: '',
  });

  const [photo] = useImage(photoUrl || '', 'anonymous');

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.offsetHeight - 60);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  useEffect(() => {
    return () => {
      if (stageRef.current) {
        stageRef.current.destroy();
      }
    };
  }, []);

  const handleDragStart = (stratumId: string) => {
    setDraggingStratumId(stratumId);
  };

  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (!draggingStratumId) return;
    const newOffset = e.target.y();
    setDragOffset(Math.max(0, newOffset));
  }, [draggingStratumId]);

  const handleDragEnd = () => {
    if (draggingStratumId && dragOffset > 0) {
      const stratum = strata.find(s => s.id === draggingStratumId);
      if (stratum) {
        const newThickness = Math.max(0.01, Math.round(dragOffset / DEPTH_SCALE * 100) / 100);
        updateStratum(draggingStratumId, { thickness: newThickness });
        message.success(`地层厚度已更新为 ${newThickness.toFixed(2)} 米`);
      }
    }
    setDraggingStratumId(null);
    setDragOffset(0);
  };

  const handleStratumClick = (stratum: Stratum) => {
    if (draggingStratumId) return;
    setSelectedStratum(stratum.id);
    onStratumSelect?.(stratum);
  };

  const handleStratumDblClick = (stratum: Stratum) => {
    setEditingStratum(stratum);
  };

  const handleAddStratum = () => {
    if (!activeGridId) return;
    
    const maxDepth = strata.length > 0 ? Math.max(...strata.map(s => s.depthBottom)) : 0;
    const maxLayerIndex = strata.length > 0 ? Math.max(...strata.map(s => s.layerIndex)) : -1;

    addStratum({
      ...newStratum,
      siteId: currentSiteId || '',
      gridId: activeGridId,
      layer: maxLayerIndex + 2,
      layerIndex: maxLayerIndex + 1,
      depthFrom: maxDepth,
      depthTo: maxDepth + newStratum.thickness,
      depthTop: maxDepth,
      depthBottom: maxDepth + newStratum.thickness,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    setShowAddModal(false);
    setNewStratum({
      name: `第${strata.length + 1}层`,
      thickness: 0.3,
      soilType: SOIL_TYPE_OPTIONS[0].value,
      soilColor: SOIL_COLOR_OPTIONS[0].value,
      period: PERIOD_OPTIONS[0].value,
      description: '',
    });
    message.success('地层添加成功');
  };

  const handleUpdateStratum = () => {
    if (!editingStratum) return;
    updateStratum(editingStratum.id, editingStratum);
    setEditingStratum(null);
    message.success('地层信息已更新');
  };

  const handleDeleteStratum = (stratumId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除该地层将同时删除该层所有遗物记录，是否继续？',
      onOk: () => {
        deleteStratum(stratumId);
        message.success('地层已删除');
      },
    });
  };

  const handlePhotoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPhotoUrl(url);
      setShowPhotoUpload(false);
      message.success('剖面照片已加载');
    };
    reader.readAsDataURL(file);
    return false;
  };

  const renderStratum = (stratum: Stratum, index: number) => {
    const depthTop = strata.slice(0, index).reduce((sum, s) => sum + s.thickness, 0);
    const y = 50 + depthTop * DEPTH_SCALE;
    const height = stratum.thickness * DEPTH_SCALE;
    const fillColor = getSoilColor(stratum.soilColor);
    const isSelected = selectedStratumId === stratum.id;
    const isDragging = draggingStratumId === stratum.id;

    return (
      <Group key={stratum.id}>
        <Rect
          x={60}
          y={y}
          width={CHART_WIDTH - 80}
          height={height}
          fill={fillColor}
          opacity={isDragging ? 0.5 : 0.85}
          stroke={isSelected ? '#D4AF37' : '#8B4513'}
          strokeWidth={isSelected ? 3 : 1}
          shadowColor={isSelected ? '#D4AF37' : 'transparent'}
          shadowBlur={isSelected ? 8 : 0}
          cornerRadius={2}
          onClick={() => handleStratumClick(stratum)}
          onDblClick={() => handleStratumDblClick(stratum)}
          onTap={() => handleStratumClick(stratum)}
          onDblTap={() => handleStratumDblClick(stratum)}
        />

        <Rect
          x={60}
          y={y}
          width={CHART_WIDTH - 80}
          height={Math.min(30, height)}
          fill="rgba(255,255,255,0.3)"
        />

        <Text
          x={70}
          y={y + 5}
          text={stratum.name}
          fontSize={12}
          fontStyle="bold"
          fill="#2D2A26"
        />

        {height > 30 && (
          <>
            <Text
              x={70}
              y={y + 22}
              text={`${stratum.soilColor}${stratum.soilType}`}
              fontSize={10}
              fill="#5C4033"
            />
            <Text
              x={CHART_WIDTH - 100}
              y={y + 22}
              text={stratum.period}
              fontSize={10}
              fill={getPeriodColor(stratum.period)}
            />
          </>
        )}

        {height > 50 && (
          <Text
            x={70}
            y={y + height - 18}
            text={`${stratum.thickness.toFixed(2)}m`}
            fontSize={10}
            fill="#2D2A26"
          />
        )}

        <Rect
          x={CHART_WIDTH - 25}
          y={y + height - 5}
          width={10}
          height={10}
          fill={getPeriodColor(stratum.period)}
          cornerRadius={2}
        />

        <Group
          x={CHART_WIDTH - 20}
          y={y + height / 2 - 10}
          draggable
          onDragStart={() => handleDragStart(stratum.id)}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          cursor="ns-resize"
        >
          <Rect
          width={20}
          height={20}
          fill="rgba(139, 69, 19, 0.8)"
          cornerRadius={10}
        />
        <Text
          x={6}
          y={4}
          text="↕"
          fontSize={12}
          fill="#fff"
        />
      </Group>
      </Group>
    );
  };

  const totalDepth = useMemo(() => {
    return strata.reduce((sum, s) => sum + s.thickness, 0);
  }, [strata]);

  const renderDepthScale = () => {
    const marks = [];
    for (let i = 0; i <= Math.ceil(totalDepth) + 1; i++) {
      const y = 50 + i * DEPTH_SCALE;
      marks.push(
        <Group key={`depth-${i}`}>
          <Line
            points={[50, y, 55, y]}
            stroke="#8B7355"
            strokeWidth={1}
          />
          <Text
            x={10}
            y={y - 6}
            text={`${i}m`}
            fontSize={10}
            fill="#5C4033"
          />
        </Group>
      );
    }
    return marks;
  };

  if (!activeGridId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-stone-50 text-stone-500">
        请选择一个探方查看地层剖面
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-stone-50 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-12 bg-white border-b border-stone-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-stone-700">
            {grid ? `探方 T${grid.row + 1}${String.fromCharCode(65 + grid.col)} 地层剖面` : '地层剖面'}
          </span>
          <span className="text-sm text-stone-500">
            共 {strata.length} 层，总深度 {totalDepth.toFixed(2)}m
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={handlePhotoUpload}
          >
            <Button size="small" icon={<Camera size={14} />}>
              导入照片
            </Button>
          </Upload>
          <Button
            size="small"
            icon={<Plus size={14} />}
            onClick={() => setShowAddModal(true)}
            type="primary"
          >
            添加地层
          </Button>
        </div>
      </div>

      <div className="absolute top-12 left-0 right-0 bottom-0 overflow-auto">
        <Stage
          ref={stageRef}
          width={CHART_WIDTH}
          height={Math.max(containerHeight, 50 + totalDepth * DEPTH_SCALE + 50)}
          style={{ background: '#F5F2ED' }}
        >
          <Layer>
            {photo && (
              <KonvaImage
                image={photo}
                x={60}
                y={50}
                width={CHART_WIDTH - 80}
                height={totalDepth * DEPTH_SCALE}
                opacity={0.3}
              />
            )}

            {renderDepthScale()}

            <Line
              points={[55, 50, 55, 50 + totalDepth * DEPTH_SCALE]}
              stroke="#8B7355"
              strokeWidth={2}
            />

            {strata.map(renderStratum)}

            <Line
              points={[55, 50 + totalDepth * DEPTH_SCALE, CHART_WIDTH - 20, 50 + totalDepth * DEPTH_SCALE]}
              stroke="#8B7355"
              strokeWidth={2}
            />

            <Text
              x={CHART_WIDTH - 100}
              y={50 + totalDepth * DEPTH_SCALE + 10}
              text={`深度 ${totalDepth.toFixed(2)}m`}
              fontSize={11}
              fill="#5C4033"
            />
          </Layer>
        </Stage>
      </div>

      <Modal
        title={editingStratum ? '编辑地层信息' : '添加新地层'}
        open={showAddModal || !!editingStratum}
        onCancel={() => {
          setShowAddModal(false);
          setEditingStratum(null);
        }}
        onOk={editingStratum ? handleUpdateStratum : handleAddStratum}
        okText="确认"
        cancelText="取消"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              地层名称
            </label>
            <Input
              value={editingStratum ? editingStratum.name : newStratum.name}
              onChange={(e) => {
                if (editingStratum) {
                  setEditingStratum({ ...editingStratum, name: e.target.value });
                } else {
                  setNewStratum({ ...newStratum, name: e.target.value });
                }
              }}
              placeholder="如：第1层、耕土层"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                厚度（米）
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={editingStratum ? editingStratum.thickness : newStratum.thickness}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (editingStratum) {
                    setEditingStratum({ ...editingStratum, thickness: val });
                  } else {
                    setNewStratum({ ...newStratum, thickness: val });
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                年代
              </label>
              <select
                className="w-full h-9 px-3 border border-stone-300 rounded-md"
                value={editingStratum ? editingStratum.period : newStratum.period}
                onChange={(e) => {
                  if (editingStratum) {
                    setEditingStratum({ ...editingStratum, period: e.target.value });
                  } else {
                    setNewStratum({ ...newStratum, period: e.target.value });
                  }
                }}
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                土质
              </label>
              <select
                className="w-full h-9 px-3 border border-stone-300 rounded-md"
                value={editingStratum ? editingStratum.soilType : newStratum.soilType}
                onChange={(e) => {
                  if (editingStratum) {
                    setEditingStratum({ ...editingStratum, soilType: e.target.value });
                  } else {
                    setNewStratum({ ...newStratum, soilType: e.target.value });
                  }
                }}
              >
                {SOIL_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                土色
              </label>
              <select
                className="w-full h-9 px-3 border border-stone-300 rounded-md"
                value={editingStratum ? editingStratum.soilColor : newStratum.soilColor}
                onChange={(e) => {
                  if (editingStratum) {
                    setEditingStratum({ ...editingStratum, soilColor: e.target.value });
                  } else {
                    setNewStratum({ ...newStratum, soilColor: e.target.value });
                  }
                }}
              >
                {SOIL_COLOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              描述
            </label>
            <Input.TextArea
              rows={3}
              value={editingStratum ? editingStratum.description : newStratum.description}
              onChange={(e) => {
                if (editingStratum) {
                  setEditingStratum({ ...editingStratum, description: e.target.value });
                } else {
                  setNewStratum({ ...newStratum, description: e.target.value });
                }
              }}
              placeholder="描述土质、包含物、遗迹现象等"
            />
          </div>
          {editingStratum && (
            <div className="pt-2 border-t border-stone-200">
              <Button
                danger
                icon={<Trash2 size={14} />}
                onClick={() => handleDeleteStratum(editingStratum.id)}
              >
                删除此层
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {strata.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-stone-500">
            <p className="mb-2">暂无地层记录</p>
            <Button type="primary" onClick={() => setShowAddModal(true)}>
              添加第一层
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(StrataChart);
