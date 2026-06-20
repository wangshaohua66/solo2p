import { useState } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useProjectStore } from '@/stores/projectStore';
import { Tag, X, Edit3, Trash2 } from 'lucide-react';
import { Input, Modal, Form, ColorPicker, Button } from 'antd';

interface AnnotationLayerProps {
  charWidth: number;
  viewportStart: number;
  paddingLeft: number;
  width: number;
}

const PRESET_COLORS = [
  '#ff00aa', '#ff7b00', '#00ffcc', '#a371f7',
  '#58a6ff', '#3fb950', '#d29922', '#f85149',
];

export function AnnotationLayer({ charWidth, viewportStart, paddingLeft, width }: AnnotationLayerProps) {
  const annotations = useAnalysisStore((s) => s.annotations);
  const addAnnotation = useAnalysisStore((s) => s.addAnnotation);
  const updateAnnotation = useAnalysisStore((s) => s.updateAnnotation);
  const removeAnnotation = useAnalysisStore((s) => s.removeAnnotation);
  const selection = useAnalysisStore((s) => s.selection);
  const setSelection = useAnalysisStore((s) => s.setSelection);
  const { addToast } = useAnalysisStore as unknown as { addToast: (t: string, m: string) => void };

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const openCreate = () => {
    if (!selection || selection.start === selection.end) {
      (useProjectStore.getState() as any).addToast?.('warning', '请先选择序列区域');
      return;
    }
    setEditingId(null);
    form.setFieldsValue({
      label: '',
      color: PRESET_COLORS[0],
      note: '',
    });
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    const ann = annotations.find((a) => a.id === id);
    if (!ann) return;
    setEditingId(id);
    form.setFieldsValue({
      label: ann.label,
      color: ann.color,
      note: ann.note ?? '',
    });
    setShowModal(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const color = typeof values.color === 'string' ? values.color : values.color.toHexString?.() ?? '#ff00aa';
      if (editingId) {
        updateAnnotation(editingId, { label: values.label, color, note: values.note });
      } else if (selection) {
        addAnnotation({
          start: selection.start,
          end: selection.end,
          label: values.label,
          color,
          note: values.note,
        });
        setSelection(null);
      }
      setShowModal(false);
    } catch {}
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '删除注释',
      content: '确定要删除此注释吗？',
      okButtonProps: { danger: true },
      onOk: () => removeAnnotation(id),
    });
  };

  return (
    <div className="relative w-full h-8">
      <svg className="w-full h-full" viewBox={`0 0 ${width} 32`} preserveAspectRatio="none">
        {annotations.map((a) => {
          const relStart = Math.max(0, a.start - viewportStart);
          const relEnd = a.end - viewportStart;
          if (relEnd < 0 || relStart * charWidth > width) return null;

          const x = paddingLeft + relStart * charWidth;
          const w = Math.max(8, (relEnd - relStart) * charWidth);
          const clipX = Math.max(0, x);
          const clipW = Math.min(w, width - clipX);

          return (
            <g key={a.id}>
              <rect
                x={clipX}
                y={6}
                width={clipW}
                height={18}
                rx={3}
                fill={a.color}
                opacity={0.25}
                stroke={a.color}
                strokeWidth={1}
                style={{ cursor: 'pointer' }}
                onClick={() => openEdit(a.id)}
              />
              {clipW > 40 && (
                <text
                  x={clipX + 6}
                  y={20}
                  fontSize={10}
                  fill="#fff"
                  fontFamily="Inter, sans-serif"
                  fontWeight={500}
                  style={{ pointerEvents: 'none' }}
                >
                  {a.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <button
        onClick={openCreate}
        className="absolute right-2 top-1 p-1.5 rounded hover:bg-bio-blue/20 text-bio-blue transition-colors"
        title="添加注释"
      >
        <Tag className="w-4 h-4" />
      </button>

      <Modal
        title={editingId ? '编辑注释' : '添加注释'}
        open={showModal}
        onOk={handleOk}
        onCancel={() => setShowModal(false)}
        okText={editingId ? '保存' : '添加'}
        styles={{
          content: { background: '#161b22', border: '1px solid #30363d' },
          header: { color: '#c9d1d9' },
        }}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            label="标签名称"
            name="label"
            rules={[{ required: true, message: '请输入标签' }]}
          >
            <Input placeholder="如：外显子1、启动子区域" />
          </Form.Item>
          <Form.Item label="颜色" name="color">
            <ColorPicker
              presets={[{ label: '预设', colors: PRESET_COLORS }]}
              showText
            />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={3} placeholder="可选的详细说明" />
          </Form.Item>
        </Form>
      </Modal>

      {annotations.length > 0 && (
        <div className="absolute left-2 top-10 w-64 bg-bio-panel border border-bio-border rounded-md shadow-lg p-2 space-y-1 max-h-48 overflow-auto z-10">
          {annotations.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bio-bg/60 transition-colors group"
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: a.color }} />
              <span className="text-xs flex-1 truncate text-bio-text">{a.label}</span>
              <span className="text-[10px] text-bio-text-secondary">
                {a.start}-{a.end}
              </span>
              <button
                onClick={() => openEdit(a.id)}
                className="opacity-0 group-hover:opacity-100 text-bio-text-secondary hover:text-bio-blue transition-all"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleDelete(a.id)}
                className="opacity-0 group-hover:opacity-100 text-bio-text-secondary hover:text-bio-red transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
