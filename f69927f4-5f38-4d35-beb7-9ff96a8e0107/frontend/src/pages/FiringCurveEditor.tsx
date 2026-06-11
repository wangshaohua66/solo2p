import { useState, useRef, useCallback } from 'react';
import {
  Input, Button, List, Tag, Checkbox, Space, Popconfirm, Tooltip,
  Table, Modal, Form, InputNumber, Select, message,
} from 'antd';
import { Plus, Trash2, Copy, Save, AlertTriangle, Search, FileText } from 'lucide-react';
import type { CurveSegment, FiringCurve, CurvePhase } from '@/types';
import { mockCurves } from '@/mocks';
import CurveCanvas, { calcSlope, getPointTemps, getPointTimes, PADDING, MAX_TEMP, MIN_TEMP, PHASE_COLORS } from '@/components/CurveCanvas';

export default function FiringCurveEditor() {
  const [curves, setCurves] = useState<FiringCurve[]>(mockCurves);
  const [selectedCurveId, setSelectedCurveId] = useState<number | null>(null);
  const [segments, setSegments] = useState<CurveSegment[]>([]);
  const [curveName, setCurveName] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null);
  const [editForm] = Form.useForm();
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; temp: number; time: number } | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredCurves = curves.filter((c) => c.name.toLowerCase().includes(searchText.toLowerCase()));
  const pointTemps = getPointTemps(segments);
  const pointTimes = getPointTimes(segments);
  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);

  const handleLoadCurve = (curve: FiringCurve) => {
    setSelectedCurveId(curve.id);
    setSegments(curve.segments.map((s) => ({ ...s })));
    setCurveName(curve.name);
    setIsTemplate(curve.isTemplate);
    setSelectedSegmentIndex(null);
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const canvasToData = useCallback(
    (canvasX: number, canvasY: number) => {
      const container = containerRef.current;
      if (!container) return { time: 0, temp: 0 };
      const w = container.clientWidth, h = container.clientHeight;
      const chartW = w - PADDING.left - PADDING.right;
      const chartH = h - PADDING.top - PADDING.bottom;
      const maxTime = Math.max(totalDuration * zoomLevel, 60);
      return {
        time: ((canvasX - PADDING.left) / chartW) * maxTime,
        temp: MIN_TEMP + ((h - PADDING.bottom - canvasY) / chartH) * (MAX_TEMP - MIN_TEMP),
      };
    },
    [totalDuration, zoomLevel]
  );

  const findNearestPoint = useCallback(
    (canvasX: number, canvasY: number): { index: number; dist: number } | null => {
      const container = containerRef.current;
      if (!container) return null;
      const w = container.clientWidth, h = container.clientHeight;
      const chartW = w - PADDING.left - PADDING.right;
      const chartH = h - PADDING.top - PADDING.bottom;
      const maxTime = Math.max(totalDuration * zoomLevel, 60);
      let nearest: { index: number; dist: number } | null = null;
      pointTemps.forEach((temp, i) => {
        const px = PADDING.left + (pointTimes[i] / maxTime) * chartW;
        const py = PADDING.top + chartH - ((temp - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)) * chartH;
        const dist = Math.sqrt((canvasX - px) ** 2 + (canvasY - py) ** 2);
        if (!nearest || dist < nearest.dist) nearest = { index: i, dist };
      });
      return nearest;
    },
    [pointTemps, pointTimes, totalDuration, zoomLevel]
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const { time, temp } = canvasToData(x, y);
    if (draggingIndex !== null && draggingIndex > 0) {
      const newTemp = Math.max(MIN_TEMP, Math.min(MAX_TEMP, temp));
      const segIdx = draggingIndex - 1;
      if (segIdx >= 0 && segIdx < segments.length) {
        const newSegments = [...segments];
        newSegments[segIdx] = { ...newSegments[segIdx], targetTemp: newTemp };
        const prevTime = pointTimes[draggingIndex - 1];
        let newDuration = time - prevTime;
        if (draggingIndex < pointTemps.length - 1) {
          newDuration = Math.min(newDuration, pointTimes[draggingIndex + 1] - prevTime - 1);
        }
        newSegments[segIdx] = { ...newSegments[segIdx], duration: Math.max(1, Math.round(newDuration)) };
        setSegments(newSegments);
      }
      setHoverInfo({ x, y, temp: newTemp, time });
      return;
    }
    const nearest = findNearestPoint(x, y);
    const canvas = e.currentTarget;
    if (nearest && nearest.dist < 15) {
      setHoverInfo({ x, y, temp: pointTemps[nearest.index], time: pointTimes[nearest.index] });
      canvas.style.cursor = 'grab';
    } else {
      setHoverInfo({ x, y, temp: Math.round(temp), time: Math.round(time) });
      canvas.style.cursor = 'crosshair';
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const nearest = findNearestPoint(x, y);
    if (nearest && nearest.dist < 15 && nearest.index > 0) {
      setDraggingIndex(nearest.index);
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = () => setDraggingIndex(null);
  const handleMouseLeave = () => { setHoverInfo(null); setDraggingIndex(null); };
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoomLevel((z) => Math.max(0.2, Math.min(5, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const nearest = findNearestPoint(x, y);
    if (nearest && nearest.dist < 15 && nearest.index > 0) {
      const seg = segments[nearest.index - 1];
      if (seg) { setEditingPointIndex(nearest.index); editForm.setFieldsValue(seg); setEditModalOpen(true); }
    }
  };

  const handleEditSubmit = () => {
    editForm.validateFields().then((values) => {
      if (editingPointIndex !== null && editingPointIndex > 0) {
        const newSegments = [...segments];
        newSegments[editingPointIndex - 1] = { ...newSegments[editingPointIndex - 1], ...values };
        setSegments(newSegments);
      }
      setEditModalOpen(false); setEditingPointIndex(null);
    });
  };

  const handleAddSegment = () => {
    const lastTemp = segments.length > 0 ? segments[segments.length - 1].targetTemp : 20;
    setSegments([...segments, { phase: 'HOLD', targetTemp: lastTemp, duration: 30, maxSlope: 0 }]);
  };
  const handleDeleteSegment = () => {
    if (selectedSegmentIndex !== null && segments.length > 1) {
      setSegments(segments.filter((_, i) => i !== selectedSegmentIndex));
      setSelectedSegmentIndex(null);
    }
  };

  const handleSave = () => { console.log('Saving:', { curveName, segments, isTemplate }); message.success('曲线已保存'); };
  const handleDelete = () => { console.log('Deleting:', selectedCurveId); message.success('曲线已删除'); };

  const handleCopy = () => {
    const newCurve: FiringCurve = {
      id: Date.now(), name: `${curveName} 副本`, isTemplate: false, createdBy: 1,
      segments: segments.map((s) => ({ ...s })),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setCurves([...curves, newCurve]);
    setSelectedCurveId(newCurve.id);
    setCurveName(newCurve.name);
    setIsTemplate(false);
    message.success('已复制为新曲线');
  };

  const handleNewCurve = () => {
    setSegments([{ phase: 'HEAT_UP', targetTemp: 500, duration: 60, maxSlope: 5 }]);
    setCurveName('新曲线'); setIsTemplate(false); setSelectedCurveId(null); setSelectedSegmentIndex(null);
  };

  const columns = [
    { title: '阶段', dataIndex: 'phase', key: 'phase', width: 50,
      render: (p: CurvePhase, _: unknown, i: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: PHASE_COLORS[p] }} />
          <span style={{ fontSize: 12 }}>{i + 1}</span>
        </div>
      )},
    { title: '温度(°C)', dataIndex: 'targetTemp', key: 'targetTemp', width: 70 },
    { title: '时长(min)', dataIndex: 'duration', key: 'duration', width: 60 },
    { title: '斜率', key: 'slope', width: 60,
      render: (_: unknown, r: CurveSegment, i: number) => {
        const prev = i === 0 ? 20 : segments[i - 1]?.targetTemp || 20;
        const slope = calcSlope(r, prev);
        const ex = r.phase !== 'HOLD' && slope > r.maxSlope;
        return (
          <span style={{ color: ex ? '#FF4D4F' : undefined, fontSize: 12 }}>
            {slope.toFixed(1)}
            {ex && <AlertTriangle size={11} style={{ marginLeft: 2, verticalAlign: 'middle' }} />}
          </span>
        );
      }},
    { title: '最大斜率', dataIndex: 'maxSlope', key: 'maxSlope', width: 60 },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: '#F7F5F2' }}>
      <div style={{ width: 280, background: '#fff', borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Input placeholder="搜索曲线" prefix={<Search size={14} />} value={searchText} onChange={(e) => setSearchText(e.target.value)} style={{ marginBottom: 12 }} />
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" icon={<Plus size={14} />} onClick={handleNewCurve} style={{ width: '100%', background: '#E8602C', borderColor: '#E8602C' }}>新建曲线</Button>
            <Button icon={<FileText size={14} />} style={{ width: '100%' }}>从模板加载</Button>
          </Space>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <List dataSource={filteredCurves} renderItem={(curve) => (
            <List.Item key={curve.id} onClick={() => handleLoadCurve(curve)}
              style={{ cursor: 'pointer', padding: '12px 16px',
                background: selectedCurveId === curve.id ? '#FFF2E8' : 'transparent',
                borderLeft: selectedCurveId === curve.id ? '3px solid #E8602C' : '3px solid transparent' }}>
              <List.Item.Meta
                title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#2D2D2D' }}>{curve.name}</span>
                  {curve.isTemplate && <Tag color="blue" style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>模板</Tag>}
                </div>}
                description={<span style={{ fontSize: 11, color: '#999' }}>{curve.createdAt.slice(0, 10)}</span>}
              />
            </List.Item>
          )} />
        </div>
      </div>

      <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }} onMouseLeave={handleMouseLeave}>
        <CurveCanvas segments={segments} selectedSegmentIndex={selectedSegmentIndex} zoomLevel={zoomLevel} hoverInfo={hoverInfo}
          onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick} onWheel={handleWheel} />
        {hoverInfo && (
          <div style={{ position: 'absolute', left: hoverInfo.x + 15, top: hoverInfo.y - 30,
            background: 'rgba(45,45,45,0.9)', color: '#fff', padding: '6px 10px',
            borderRadius: 4, fontSize: 12, pointerEvents: 'none', zIndex: 10 }}>
            <div>{Math.round(hoverInfo.temp)}°C</div>
            <div>{Math.round(hoverInfo.time)} min</div>
          </div>
        )}
      </div>

      <div style={{ width: 300, background: '#fff', borderLeft: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#2D2D2D', marginBottom: 12 }}>曲线属性</div>
          <Input value={curveName} onChange={(e) => setCurveName(e.target.value)} placeholder="曲线名称" style={{ marginBottom: 12 }} />
          <Checkbox checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)}>保存为模板</Checkbox>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#2D2D2D' }}>阶段列表</span>
            <Space>
              <Tooltip title="添加段"><Button size="small" icon={<Plus size={14} />} onClick={handleAddSegment} /></Tooltip>
              <Tooltip title="删除段">
                <Popconfirm title="确定删除此段？" onConfirm={handleDeleteSegment} disabled={selectedSegmentIndex === null || segments.length <= 1}>
                  <Button size="small" danger icon={<Trash2 size={14} />} disabled={selectedSegmentIndex === null || segments.length <= 1} />
                </Popconfirm>
              </Tooltip>
            </Space>
          </div>
          <Table size="small" dataSource={segments} columns={columns} rowKey={(_, i) => String(i)} pagination={false}
            onRow={(_, i) => ({ onClick: () => setSelectedSegmentIndex(i as number),
              style: { cursor: 'pointer', background: selectedSegmentIndex === i ? '#F0F7FF' : undefined } })}
            scroll={{ y: 300 }} />
        </div>
        <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" icon={<Save size={14} />} onClick={handleSave} style={{ width: '100%', background: '#E8602C', borderColor: '#E8602C' }}>保存</Button>
            <Button danger icon={<Trash2 size={14} />} onClick={handleDelete} disabled={selectedCurveId === null} style={{ width: '100%' }}>删除</Button>
            <Button icon={<Copy size={14} />} onClick={handleCopy} style={{ width: '100%' }}>复制为新曲线</Button>
          </Space>
        </div>
      </div>

      <Modal title="编辑控制点" open={editModalOpen} onOk={handleEditSubmit}
        onCancel={() => { setEditModalOpen(false); setEditingPointIndex(null); }}
        okText="确定" cancelText="取消">
        <Form form={editForm} layout="vertical">
          <Form.Item name="phase" label="阶段类型" rules={[{ required: true, message: '请选择阶段类型' }]}>
            <Select>
              <Select.Option value="HEAT_UP">升温</Select.Option>
              <Select.Option value="HOLD">保温</Select.Option>
              <Select.Option value="COOL_DOWN">降温</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="targetTemp" label="目标温度 (°C)" rules={[{ required: true, message: '请输入目标温度' }]}>
            <InputNumber min={MIN_TEMP} max={MAX_TEMP} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="duration" label="持续时间 (min)" rules={[{ required: true, message: '请输入持续时间' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxSlope" label="最大斜率 (°C/min)" rules={[{ required: true, message: '请输入最大斜率' }]}>
            <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
