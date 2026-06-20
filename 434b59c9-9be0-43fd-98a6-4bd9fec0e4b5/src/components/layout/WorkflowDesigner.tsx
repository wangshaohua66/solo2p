import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { WorkflowTemplate, WorkflowStep } from '@/types';
import {
  Dna,
  AlertTriangle,
  FlaskConical,
  Activity,
  GitBranch,
  Plus,
  Save,
  Trash2,
  Play,
  GripVertical,
  ChevronRight,
  X,
  Workflow,
  Copy,
  FileDown,
} from 'lucide-react';
import { Modal, Input, Button, Tag, Empty, Dropdown, message } from 'antd';

const STEP_TEMPLATES: Omit<WorkflowStep, 'id'>[] = [
  { name: '序列导入与解析', type: 'import', icon: 'Dna', order: 0 },
  { name: '序列可视化标注', type: 'sequence', icon: 'Dna', order: 0 },
  { name: '突变位点检测', type: 'mutation', icon: 'AlertTriangle', order: 0 },
  { name: '突变致病性注释', type: 'annotation', icon: 'AlertTriangle', order: 0 },
  { name: '引物设计与优化', type: 'primer', icon: 'FlaskConical', order: 0 },
  { name: '测序质量评估', type: 'quality', icon: 'Activity', order: 0 },
  { name: '结果导出报告', type: 'export', icon: 'FileDown', order: 0 },
];

const ICON_MAP: Record<string, any> = {
  Dna,
  AlertTriangle,
  FlaskConical,
  Activity,
  FileDown,
};

const TYPE_COLORS: Record<string, string> = {
  import: '#58a6ff',
  sequence: '#3fb950',
  mutation: '#ff00aa',
  annotation: '#a371f7',
  primer: '#d29922',
  quality: '#58a6ff',
  export: '#f85149',
};

interface WorkflowDesignerProps {
  open: boolean;
  onClose: () => void;
}

export function WorkflowDesigner({ open, onClose }: WorkflowDesignerProps) {
  const templates = useProjectStore((s) => s.templates);
  const { saveTemplate, deleteTemplate, addToast } = useProjectStore();

  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const handleAddStep = (step: Omit<WorkflowStep, 'id'>) => {
    const newStep: WorkflowStep = {
      ...step,
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      order: steps.length,
    };
    setSteps([...steps, newStep]);
  };

  const handleRemoveStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...steps];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setSteps(next);
  };

  const handleMoveDown = (idx: number) => {
    if (idx >= steps.length - 1) return;
    const next = [...steps];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setSteps(next);
  };

  const handleSave = () => {
    if (!templateName.trim()) {
      addToast('warning', '请输入流程名称');
      return;
    }
    if (steps.length === 0) {
      addToast('warning', '请至少添加一个步骤');
      return;
    }
    saveTemplate({
      name: templateName.trim(),
      steps: steps.map((s, i) => ({ ...s, order: i })),
    });
    addToast('success', `流程模板「${templateName.trim()}」已保存`);
    setTemplateName('');
  };

  const handleLoadTemplate = (t: WorkflowTemplate) => {
    setSteps([...t.steps]);
    setTemplateName(t.name);
    setSelectedTemplate(t.id);
  };

  const handleRun = () => {
    if (steps.length === 0) {
      addToast('warning', '请先添加分析步骤');
      return;
    }
    addToast('success', `已启动流程：${steps.length} 个步骤，将按顺序执行`);
    onClose();
  };

  const handleClear = () => {
    setSteps([]);
    setTemplateName('');
    setSelectedTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    Modal.confirm({
      title: '删除模板',
      content: '确定删除此流程模板？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      styles: {
        content: { background: '#161b22', border: '1px solid #30363d' },
        header: { color: '#c9d1d9' },
      },
      onOk: () => {
        deleteTemplate(id);
        if (selectedTemplate === id) {
          setSelectedTemplate(null);
        }
        addToast('success', '模板已删除');
      },
    });
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={960}
      footer={null}
      title={
        <div className="flex items-center gap-2">
          <Workflow className="w-5 h-5 text-bio-purple" />
          <span>分析流程设计器</span>
          <span className="ml-2 text-xs text-bio-text-secondary font-normal">
            拖拽组合分析步骤，保存为可复用模板
          </span>
        </div>
      }
      styles={{
        content: { background: '#0d1117', border: '1px solid #30363d', padding: 0 },
        header: { background: '#161b22', borderBottom: '1px solid #30363d', color: '#c9d1d9', padding: '16px 24px' },
        body: { padding: 0 },
      }}
      closeIcon={<X className="w-4 h-4 text-bio-text-secondary" />}
    >
      <div className="flex h-[560px]">
        <div className="w-56 border-r border-bio-border bg-bio-bg flex flex-col">
          <div className="p-3 border-b border-bio-border">
            <div className="text-xs font-medium text-bio-text mb-2">可选步骤</div>
            <div className="space-y-1">
              {STEP_TEMPLATES.map((st, i) => {
                const Icon = ICON_MAP[st.icon] ?? Dna;
                return (
                  <button
                    key={i}
                    onClick={() => handleAddStep(st)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-xs hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text transition-colors group"
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: TYPE_COLORS[st.type] }} />
                    <span className="flex-1">{st.name}</span>
                    <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-bio-blue" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-3 border-b border-bio-border flex-1 overflow-auto">
            <div className="text-xs font-medium text-bio-text mb-2 flex items-center gap-1.5">
              <GitBranch className="w-3 h-3" />
              已保存模板 ({templates.length})
            </div>
            {templates.length === 0 ? (
              <div className="text-[10px] text-bio-text-secondary italic py-4">暂无模板</div>
            ) : (
              <div className="space-y-1">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleLoadTemplate(t)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer transition-colors ${selectedTemplate === t.id ? 'bg-bio-blue/15 text-bio-blue' : 'text-bio-text-secondary hover:bg-bio-panel hover:text-bio-text'}`}
                  >
                    <Copy className="w-3 h-3" />
                    <span className="flex-1 text-xs truncate">{t.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(t.id);
                      }}
                      className="opacity-0 hover:opacity-100 p-0.5 rounded hover:bg-mut-pathogenic/20 hover:text-mut-pathogenic"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-bio-border">
            <Input
              size="small"
              placeholder="流程名称，如：肿瘤基因检测标准流程"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              style={{ maxWidth: 320 }}
              prefix={<Save className="w-3.5 h-3.5 text-bio-text-secondary" />}
            />
            <div className="ml-auto flex items-center gap-2">
              <Button size="small" onClick={handleClear}>清空</Button>
              <Button size="small" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSave}>
                保存模板
              </Button>
              <Button size="small" type="primary" icon={<Play className="w-3.5 h-3.5" />} onClick={handleRun}>
                运行流程
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {steps.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-bio-border rounded-lg">
                <div className="w-12 h-12 rounded-full bg-bio-panel flex items-center justify-center mb-3">
                  <Workflow className="w-6 h-6 text-bio-text-secondary" />
                </div>
                <div className="text-sm text-bio-text-secondary mb-1">暂无步骤</div>
                <div className="text-xs text-bio-text-secondary">
                  从左侧选择步骤添加，或加载已保存模板
                </div>
              </div>
            ) : (
              <div className="space-y-0">
                {steps.map((s, idx) => {
                  const Icon = ICON_MAP[s.icon] ?? Dna;
                  const color = TYPE_COLORS[s.type] ?? '#58a6ff';
                  return (
                    <div key={s.id} className="flex items-center gap-2">
                      <div
                        className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bio-panel border transition-all ${draggingIndex === idx ? 'border-bio-blue opacity-60' : 'border-bio-border hover:border-bio-border/80'}`}
                      >
                        <div className="text-bio-text-secondary cursor-grab hover:text-bio-text">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center"
                          style={{ background: `${color}15`, color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-bio-text font-medium">
                            <span className="text-bio-text-secondary mr-1.5">{idx + 1}.</span>
                            {s.name}
                          </div>
                          <div className="text-[10px] text-bio-text-secondary">
                            类型: <Tag color={s.type} style={{ border: 'none', margin: 0, fontSize: 9 }}>{s.type}</Tag>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            className="p-1 rounded hover:bg-bio-bg text-bio-text-secondary hover:text-bio-text disabled:opacity-30 disabled:hover:text-bio-text-secondary"
                          >
                            <ChevronRight className="w-3.5 h-3.5 -rotate-90" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx >= steps.length - 1}
                            className="p-1 rounded hover:bg-bio-bg text-bio-text-secondary hover:text-bio-text disabled:opacity-30 disabled:hover:text-bio-text-secondary"
                          >
                            <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                          </button>
                          <button
                            onClick={() => handleRemoveStep(s.id)}
                            className="p-1 rounded hover:bg-mut-pathogenic/10 text-bio-text-secondary hover:text-mut-pathogenic"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {idx < steps.length - 1 && (
                        <div className="flex justify-center py-1">
                          <div className="w-0.5 h-4 bg-bio-border" />
                        </div>
                      )}
                      {idx < steps.length - 1 && null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
