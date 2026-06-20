import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Card, Tag, Tooltip, Button, Space, Popover, Select, Switch, Statistic, Row, Col, Modal, Form, Input, InputNumber, message, Dropdown, MenuProps } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, ReloadOutlined, InfoCircleOutlined, FireOutlined, EnvironmentOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, ScissorOutlined, AimOutlined, DragOutlined, CloseOutlined } from '@ant-design/icons';
import type { Booth, HeatmapData, Venue } from '../../types';
import { formatCurrency } from '../../utils/exportUtils';

const { Option } = Select;

interface BoothMapProps {
  booths: Booth[];
  venue?: Venue;
  heatmapData?: HeatmapData[];
  loading?: boolean;
  editable?: boolean;
  onBoothClick?: (booth: Booth) => void;
  onBoothAllocate?: (booth: Booth) => void;
  onBoothCreate?: (booth: Partial<Booth>) => void;
  onBoothUpdate?: (id: string, booth: Partial<Booth>) => void;
  onBoothDelete?: (id: string) => void;
}

type EditorMode = 'none' | 'select' | 'create' | 'resize' | 'move';

const statusColors: Record<string, { fill: string; stroke: string; label: string }> = {
  available: { fill: '#dcfce7', stroke: '#22c55e', label: '可用' },
  reserved: { fill: '#fef9c3', stroke: '#eab308', label: '预订' },
  sold: { fill: '#dbeafe', stroke: '#3b82f6', label: '已售' },
  occupied: { fill: '#fecaca', stroke: '#ef4444', label: '占用' },
  maintenance: { fill: '#e5e7eb', stroke: '#6b7280', label: '维护' },
};

const zoneColors: Record<string, string> = {
  A: '#fef2f2',
  B: '#fef9c3',
  C: '#dcfce7',
  D: '#dbeafe',
  E: '#f3e8ff',
};

const getHeatmapColor = (value: number, max: number): string => {
  const ratio = Math.min(value / max, 1);
  if (ratio < 0.2) return '#dcfce7';
  if (ratio < 0.4) return '#fef9c3';
  if (ratio < 0.6) return '#fcd34d';
  if (ratio < 0.8) return '#f97316';
  return '#ef4444';
};

const BoothMap: React.FC<BoothMapProps> = ({
  booths,
  venue,
  heatmapData = [],
  loading,
  editable = false,
  onBoothClick,
  onBoothAllocate,
  onBoothCreate,
  onBoothUpdate,
  onBoothDelete,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterZone, setFilterZone] = useState<string>('all');

  const [editorMode, setEditorMode] = useState<EditorMode>('none');
  const [editingBooth, setEditingBooth] = useState<Booth | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [createStartPoint, setCreateStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [draggingBooth, setDraggingBooth] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizingBooth, setResizingBooth] = useState<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null);

  const [form] = Form.useForm();

  const currencyFormatter = (value: number | string) => formatCurrency(Number(value));

  const heatmapMap = useMemo(() => {
    const map = new Map<string, HeatmapData>();
    heatmapData.forEach(h => map.set(h.boothId, h));
    return map;
  }, [heatmapData]);

  const maxVisitorCount = useMemo(() => {
    if (heatmapData.length === 0) return 1;
    return Math.max(...heatmapData.map(h => h.visitorCount));
  }, [heatmapData]);

  const filteredBooths = useMemo(() => {
    return booths.filter(booth => {
      if (filterStatus !== 'all' && booth.status !== filterStatus) return false;
      if (filterZone !== 'all' && booth.zone !== filterZone) return false;
      return true;
    });
  }, [booths, filterStatus, filterZone]);

  const mapBounds = useMemo(() => {
    if (filteredBooths.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 800, width: 1000, height: 800 };
    }
    const xs = filteredBooths.map(b => b.positionX + b.width);
    const ys = filteredBooths.map(b => b.positionY + b.height);
    const maxX = Math.max(...xs) + 50;
    const maxY = Math.max(...ys) + 50;
    return { minX: 0, minY: 0, maxX, maxY, width: maxX, height: maxY };
  }, [filteredBooths]);

  const statistics = useMemo(() => {
    const total = booths.length;
    const available = booths.filter(b => b.status === 'available').length;
    const sold = booths.filter(b => b.status === 'sold' || b.status === 'occupied').length;
    const reserved = booths.filter(b => b.status === 'reserved').length;
    const totalArea = booths.reduce((sum, b) => sum + b.area, 0);
    const totalValue = booths.reduce((sum, b) => sum + (b.customPrice || b.basePrice), 0);
    return { total, available, sold, reserved, totalArea, totalValue };
  }, [booths]);

  const handleZoomIn = () => setScale(s => Math.min(s * 1.2, 3));
  const handleZoomOut = () => setScale(s => Math.max(s / 1.2, 0.3));
  const handleReset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const getSVGCoords = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = (clientX - rect.left - translate.x) / scale;
    const svgY = (clientY - rect.top - translate.y) / scale;
    const { width, height } = mapBounds;
    const viewBoxW = rect.width / scale;
    const viewBoxH = rect.height / scale;
    return {
      x: svgX * (width / viewBoxW),
      y: svgY * (height / viewBoxH),
    };
  }, [translate, scale, mapBounds]);

  const roundToGrid = (val: number, grid: number = 5) => Math.round(val / grid) * grid;

  const openEditModal = (booth: Booth) => {
    setEditingBooth(booth);
    form.setFieldsValue({
      boothNo: booth.boothNo,
      zone: booth.zone,
      positionX: booth.positionX,
      positionY: booth.positionY,
      width: booth.width,
      height: booth.height,
      area: booth.area,
      basePrice: booth.basePrice,
      facilities: booth.facilities.join(', '),
      description: booth.description,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingBooth && onBoothUpdate) {
        const updated: Partial<Booth> = {
          ...values,
          facilities: (values.facilities as string).split(',').map(s => s.trim()).filter(Boolean),
          area: values.area || ((values.width / 100) * (values.height / 100)),
        };
        onBoothUpdate(editingBooth.id, updated);
        message.success('展位信息更新成功');
      }
      setEditModalOpen(false);
      setEditingBooth(null);
    } catch (e) {
      // validation error
    }
  };

  const handleDeleteBooth = () => {
    if (!selectedBooth) return;
    Modal.confirm({
      title: '删除展位',
      content: `确定删除展位 ${selectedBooth.boothNo} 吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        onBoothDelete?.(selectedBooth.id);
        setSelectedBooth(null);
        message.success('展位已删除');
      },
    });
  };

  const editorMenu: MenuProps['items'] = [
    {
      key: 'select',
      icon: <AimOutlined />,
      label: '选择/查看',
      onClick: () => setEditorMode('select'),
    },
    {
      key: 'create',
      icon: <PlusOutlined />,
      label: '绘制展位',
      onClick: () => setEditorMode('create'),
    },
    {
      key: 'move',
      icon: <DragOutlined />,
      label: '移动展位',
      onClick: () => setEditorMode('move'),
    },
    {
      key: 'resize',
      icon: <ScissorOutlined />,
      label: '调整大小',
      onClick: () => setEditorMode('resize'),
    },
  ];

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editable && editorMode === 'create') {
      const coords = getSVGCoords(e.clientX, e.clientY);
      setCreateStartPoint({ x: roundToGrid(coords.x), y: roundToGrid(coords.y) });
      setCreateDraft({ x: roundToGrid(coords.x), y: roundToGrid(coords.y), width: 0, height: 0 });
      return;
    }

    if (editable && editorMode === 'none' && e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    }
    if (!editable && e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (editable && editorMode === 'create' && createStartPoint && createDraft) {
      const coords = getSVGCoords(e.clientX, e.clientY);
      const x = Math.min(createStartPoint.x, coords.x);
      const y = Math.min(createStartPoint.y, coords.y);
      const width = Math.abs(coords.x - createStartPoint.x);
      const height = Math.abs(coords.y - createStartPoint.y);
      setCreateDraft({
        x: roundToGrid(x),
        y: roundToGrid(y),
        width: roundToGrid(Math.max(width, 10)),
        height: roundToGrid(Math.max(height, 10)),
      });
      return;
    }

    if (editable && editorMode === 'move' && draggingBooth) {
      const coords = getSVGCoords(e.clientX, e.clientY);
      const dx = roundToGrid(coords.x - draggingBooth.startX);
      const dy = roundToGrid(coords.y - draggingBooth.startY);
      onBoothUpdate?.(draggingBooth.id, {
        positionX: Math.max(0, draggingBooth.origX + dx),
        positionY: Math.max(0, draggingBooth.origY + dy),
      });
      return;
    }

    if (editable && editorMode === 'resize' && resizingBooth) {
      const coords = getSVGCoords(e.clientX, e.clientY);
      const dw = roundToGrid(coords.x - resizingBooth.startX);
      const dh = roundToGrid(coords.y - resizingBooth.startY);
      onBoothUpdate?.(resizingBooth.id, {
        width: Math.max(20, resizingBooth.origW + dw),
        height: Math.max(20, resizingBooth.origH + dh),
      });
      return;
    }

    if (isDragging) {
      setTranslate({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, editable, editorMode, createStartPoint, createDraft, getSVGCoords, draggingBooth, resizingBooth, onBoothUpdate]);

  const handleMouseUp = () => {
    if (editable && editorMode === 'create' && createDraft && createDraft.width > 15 && createDraft.height > 15) {
      Modal.confirm({
        title: '创建展位',
        content: `将在 (${createDraft.x}, ${createDraft.y}) 创建 ${createDraft.width}×${createDraft.height} 的展位，是否继续？`,
        okText: '确定',
        cancelText: '取消',
        onOk: () => {
          const boothNo = `NEW-${Date.now().toString().slice(-4)}`;
          const area = (createDraft.width / 100) * (createDraft.height / 100);
          onBoothCreate?.({
            boothNo,
            zone: 'A',
            positionX: createDraft.x,
            positionY: createDraft.y,
            width: createDraft.width,
            height: createDraft.height,
            area,
            basePrice: Math.round(area * 1500),
            status: 'available',
            facilities: [],
          });
          message.success('展位创建成功，请在属性编辑中完善信息');
          setEditorMode('select');
        },
      });
    }
    setIsDragging(false);
    setCreateStartPoint(null);
    setCreateDraft(null);
    setDraggingBooth(null);
    setResizingBooth(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.max(0.3, Math.min(3, s * delta)));
  };

  const handleBoothClick = (booth: Booth, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editable && editorMode === 'move') {
      const coords = getSVGCoords(e.clientX, e.clientY);
      setDraggingBooth({
        id: booth.id,
        startX: coords.x,
        startY: coords.y,
        origX: booth.positionX,
        origY: booth.positionY,
      });
      return;
    }
    if (editable && editorMode === 'resize') {
      const coords = getSVGCoords(e.clientX, e.clientY);
      setResizingBooth({
        id: booth.id,
        startX: coords.x,
        startY: coords.y,
        origW: booth.width,
        origH: booth.height,
      });
      return;
    }
    setSelectedBooth(booth);
    onBoothClick?.(booth);
  };

  const renderBoothDetail = (booth: Booth) => {
    const heatmap = heatmapMap.get(booth.id);
    return (
      <div className="w-72">
        <div className="mb-3 pb-2 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">展位 {booth.boothNo}</span>
            <Tag color={statusColors[booth.status].stroke}>
              {statusColors[booth.status].label}
            </Tag>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">所属区域</span>
            <span className="font-medium">{booth.zone}区</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">展位面积</span>
            <span className="font-medium">{booth.area} ㎡</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">基础价格</span>
            <span className="font-medium">{formatCurrency(booth.basePrice)}</span>
          </div>
          {booth.customPrice && (
            <div className="flex justify-between">
              <span className="text-gray-500">成交价格</span>
              <span className="font-medium text-blue-600">{formatCurrency(booth.customPrice)}</span>
            </div>
          )}
          {booth.exhibitorName && (
            <div className="flex justify-between">
              <span className="text-gray-500">参展商</span>
              <span className="font-medium">{booth.exhibitorName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">配套设施</span>
            <span className="font-medium">{booth.facilities.join('、')}</span>
          </div>
          {heatmap && (
            <>
              <div className="my-2 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1 text-orange-500 mb-2">
                  <FireOutlined /> 客流热力数据
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">访客数量</span>
                  <span className="font-medium">{heatmap.visitorCount} 人</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">平均停留</span>
                  <span className="font-medium">{heatmap.avgStayTime} 分钟</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">高峰时段</span>
                  <span className="font-medium">{heatmap.peakHour}</span>
                </div>
              </div>
            </>
          )}
        </div>
        {booth.status === 'available' && onBoothAllocate && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <Button type="primary" size="small" block onClick={() => onBoothAllocate(booth)}>
              分配展位
            </Button>
          </div>
        )}
        {editable && onBoothUpdate && (
          <div className="mt-3 flex gap-2">
            <Button icon={<EditOutlined />} size="small" block onClick={() => openEditModal(booth)}>
              编辑
            </Button>
            <Button icon={<DeleteOutlined />} size="small" danger block onClick={handleDeleteBooth}>
              删除
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card
      loading={loading}
      title={
        <Space>
          <EnvironmentOutlined className="text-blue-500" />
          <span>{venue?.name || '展位分布图'}</span>
          {venue && <Tag color="blue">{venue.area} ㎡</Tag>}
        </Space>
      }
      extra={
        <Space wrap>
          {editable && (
            <>
              <Dropdown menu={{ items: editorMenu }}>
                <Button type={editorMode !== 'none' ? 'primary' : 'default'} icon={<EditOutlined />}>
                  编辑模式: {editorMode === 'none' ? '关闭' : (editorMenu.find(i => i && 'key' in i && i.key === editorMode) as { label: React.ReactNode } | undefined)?.label as string || '选择'}
                </Button>
              </Dropdown>
              {editorMode !== 'none' && (
                <Button icon={<CloseOutlined />} onClick={() => setEditorMode('none')}>
                  退出编辑
                </Button>
              )}
            </>
          )}
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            size="small"
            style={{ width: 100 }}
          >
            <Option value="all">全部状态</Option>
            <Option value="available">可用</Option>
            <Option value="reserved">预订</Option>
            <Option value="sold">已售</Option>
            <Option value="occupied">占用</Option>
            <Option value="maintenance">维护</Option>
          </Select>
          <Select
            value={filterZone}
            onChange={setFilterZone}
            size="small"
            style={{ width: 100 }}
          >
            <Option value="all">全部区域</Option>
            <Option value="A">A区</Option>
            <Option value="B">B区</Option>
            <Option value="C">C区</Option>
            <Option value="D">D区</Option>
            <Option value="E">E区</Option>
          </Select>
          <Space.Compact size="small">
            <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
            <Button onClick={handleReset}>{Math.round(scale * 100)}%</Button>
            <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
          </Space.Compact>
          <Space size="small">
            <span className="text-sm text-gray-500">热力图</span>
            <Switch size="small" checked={showHeatmap} onChange={setShowHeatmap} />
          </Space>
        </Space>
      }
    >
      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={12} sm={8} md={4}>
          <Statistic title="总展位" value={statistics.total} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Statistic title="可用" value={statistics.available} valueStyle={{ color: '#22c55e' }} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Statistic title="已售/占用" value={statistics.sold} valueStyle={{ color: '#3b82f6' }} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Statistic title="预订中" value={statistics.reserved} valueStyle={{ color: '#eab308' }} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Statistic title="总面积" value={statistics.totalArea} suffix="㎡" />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Statistic title="总价值" value={statistics.totalValue} formatter={currencyFormatter} />
        </Col>
      </Row>

      <div className="flex gap-4 mb-4 flex-wrap">
        {Object.entries(statusColors).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border-2"
              style={{ backgroundColor: value.fill, borderColor: value.stroke }}
            />
            <span className="text-sm text-gray-600">{value.label}</span>
          </div>
        ))}
      </div>

      <div
        className={`relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 ${
          isDragging ? 'cursor-grabbing' :
          editorMode === 'create' ? 'cursor-crosshair' :
          editorMode === 'move' ? 'cursor-move' :
          editorMode === 'resize' ? 'cursor-nwse-resize' :
          'cursor-grab'
        }`}
        style={{ height: '600px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${mapBounds.width} ${mapBounds.height}`}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {['A', 'B', 'C', 'D', 'E'].map(zone => {
            const zoneBooths = filteredBooths.filter(b => b.zone === zone);
            if (zoneBooths.length === 0) return null;
            const minX = Math.min(...zoneBooths.map(b => b.positionX)) - 10;
            const minY = Math.min(...zoneBooths.map(b => b.positionY)) - 10;
            const maxX = Math.max(...zoneBooths.map(b => b.positionX + b.width)) + 10;
            const maxY = Math.max(...zoneBooths.map(b => b.positionY + b.height)) + 10;
            return (
              <g key={zone}>
                <rect
                  x={minX}
                  y={minY}
                  width={maxX - minX}
                  height={maxY - minY}
                  fill={zoneColors[zone]}
                  fillOpacity={0.3}
                  stroke={zoneColors[zone]}
                  strokeWidth={2}
                  strokeDasharray="5,5"
                  rx={4}
                />
                <text
                  x={minX + 8}
                  y={minY + 24}
                  fontSize="16"
                  fontWeight="bold"
                  fill="#6b7280"
                >
                  {zone}区
                </text>
              </g>
            );
          })}

          {filteredBooths.map(booth => {
            const statusConfig = statusColors[booth.status];
            const heatmap = heatmapMap.get(booth.id);
            const fill = showHeatmap && heatmap
              ? getHeatmapColor(heatmap.visitorCount, maxVisitorCount)
              : statusConfig.fill;
            const isSelected = selectedBooth?.id === booth.id;

            return (
              <g key={booth.id}>
                <Tooltip
                  title={
                    <div className="text-left">
                      <div className="font-semibold">展位 {booth.boothNo}</div>
                      <div>状态: {statusConfig.label}</div>
                      <div>面积: {booth.area}㎡</div>
                      <div>价格: {formatCurrency(booth.customPrice || booth.basePrice)}</div>
                      {booth.exhibitorName && <div>参展商: {booth.exhibitorName}</div>}
                    </div>
                  }
                >
                  <rect
                    x={booth.positionX}
                    y={booth.positionY}
                    width={booth.width}
                    height={booth.height}
                    fill={fill}
                    stroke={isSelected ? '#165DFF' : statusConfig.stroke}
                    strokeWidth={isSelected ? 3 : 2}
                    rx={4}
                    className={`transition-all duration-150 hover:opacity-80 ${editorMode === 'move' || editorMode === 'resize' ? 'cursor-move' : 'cursor-pointer'}`}
                    style={{ filter: isSelected ? 'drop-shadow(0 2px 8px rgba(22, 93, 255, 0.4))' : undefined }}
                    onClick={(e) => handleBoothClick(booth, e)}
                  />
                </Tooltip>
                <text
                  x={booth.positionX + booth.width / 2}
                  y={booth.positionY + booth.height / 2 - 5}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#374151"
                  className="pointer-events-none select-none"
                >
                  {booth.boothNo}
                </text>
                {booth.exhibitorName && (
                  <text
                    x={booth.positionX + booth.width / 2}
                    y={booth.positionY + booth.height / 2 + 10}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#6b7280"
                    className="pointer-events-none select-none"
                  >
                    {booth.exhibitorName.length > 6
                      ? booth.exhibitorName.slice(0, 6) + '...'
                      : booth.exhibitorName}
                  </text>
                )}
                {showHeatmap && heatmap && (
                  <text
                    x={booth.positionX + booth.width / 2}
                    y={booth.positionY + booth.height - 5}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#991b1b"
                    className="pointer-events-none select-none"
                  >
                    {heatmap.visitorCount}人
                  </text>
                )}
              </g>
            );
          })}

          {createDraft && createDraft.width > 5 && createDraft.height > 5 && (
            <g>
              <rect
                x={createDraft.x}
                y={createDraft.y}
                width={createDraft.width}
                height={createDraft.height}
                fill="rgba(22, 93, 255, 0.15)"
                stroke="#165DFF"
                strokeWidth={2}
                strokeDasharray="8,4"
                rx={4}
              />
              <text
                x={createDraft.x + createDraft.width / 2}
                y={createDraft.y + createDraft.height / 2}
                textAnchor="middle"
                fontSize="12"
                fill="#165DFF"
                fontWeight="600"
                className="pointer-events-none select-none"
              >
                {createDraft.width}×{createDraft.height}
              </text>
            </g>
          )}

          {editable && editorMode !== 'none' && (
            <text
              x={10}
              y={24}
              fontSize="13"
              fill="#165DFF"
              fontWeight="600"
              className="pointer-events-none select-none"
            >
              编辑模式：{(editorMenu.find(i => i && 'key' in i && i.key === editorMode) as { label: React.ReactNode } | undefined)?.label as string || ''}
              {editorMode === 'create' && ' - 在画布上拖拽绘制展位'}
              {editorMode === 'move' && ' - 点击并拖动展位移动位置'}
              {editorMode === 'resize' && ' - 点击展位右下角拖动调整大小'}
            </text>
          )}
        </svg>

        {filteredBooths.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <InfoCircleOutlined className="text-4xl mb-2" />
              <p>暂无展位数据</p>
            </div>
          </div>
        )}
      </div>

      {selectedBooth && (
        <Popover
          open={!!selectedBooth}
          onOpenChange={(open) => !open && setSelectedBooth(null)}
          content={renderBoothDetail(selectedBooth)}
          trigger="click"
          placement="right"
        >
          <div className="hidden" />
        </Popover>
      )}

      <Modal
        title={`编辑展位 - ${editingBooth?.boothNo || ''}`}
        open={editModalOpen}
        onOk={handleEditSubmit}
        onCancel={() => { setEditModalOpen(false); setEditingBooth(null); }}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="展位编号"
                name="boothNo"
                rules={[{ required: true, message: '请输入展位编号' }]}
              >
                <Input placeholder="如 A01" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="所属区域"
                name="zone"
                rules={[{ required: true, message: '请选择区域' }]}
              >
                <Select>
                  <Option value="A">A区</Option>
                  <Option value="B">B区</Option>
                  <Option value="C">C区</Option>
                  <Option value="D">D区</Option>
                  <Option value="E">E区</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="X坐标"
                name="positionX"
                rules={[{ required: true, message: '请输入X坐标' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Y坐标"
                name="positionY"
                rules={[{ required: true, message: '请输入Y坐标' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="宽度(px)"
                name="width"
                rules={[{ required: true, message: '请输入宽度' }]}
              >
                <InputNumber min={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="高度(px)"
                name="height"
                rules={[{ required: true, message: '请输入高度' }]}
              >
                <InputNumber min={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="面积(㎡)" name="area">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="基础价格(元)"
                name="basePrice"
                rules={[{ required: true, message: '请输入基础价格' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="配套设施（逗号分隔）" name="facilities">
            <Input placeholder="如: 电源,网络,照明" />
          </Form.Item>
          <Form.Item label="备注说明" name="description">
            <Input.TextArea rows={3} placeholder="展位说明、特殊要求等" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default BoothMap;
