import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Card, Tag, Tooltip, Button, Space, Popover, Select, Switch, Statistic, Row, Col } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, ReloadOutlined, InfoCircleOutlined, FireOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { Booth, HeatmapData, Venue } from '../../types';
import { formatCurrency } from '../../utils/exportUtils';

const { Option } = Select;

interface BoothMapProps {
  booths: Booth[];
  venue?: Venue;
  heatmapData?: HeatmapData[];
  loading?: boolean;
  onBoothClick?: (booth: Booth) => void;
  onBoothAllocate?: (booth: Booth) => void;
}

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
  onBoothClick,
  onBoothAllocate,
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setTranslate({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.max(0.3, Math.min(3, s * delta)));
  };

  const handleBoothClick = (booth: Booth) => {
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
        className={`relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
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
                    className="cursor-pointer transition-all duration-150 hover:opacity-80"
                    style={{ filter: isSelected ? 'drop-shadow(0 2px 8px rgba(22, 93, 255, 0.4))' : undefined }}
                    onClick={() => handleBoothClick(booth)}
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
    </Card>
  );
};

export default BoothMap;
