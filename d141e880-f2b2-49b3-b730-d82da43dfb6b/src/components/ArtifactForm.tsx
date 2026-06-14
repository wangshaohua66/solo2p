import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, InputNumber, Select, Button, message, Switch, Space, Card, Tag } from 'antd';
import { Plus, Save, X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useSiteStore } from '@/stores/siteStore';
import { useArtifactStore } from '@/stores/artifactStore';
import { validateArtifact } from '@/validation/schemas';
import { ARTIFACT_CATEGORIES, CONDITION_OPTIONS, PERIOD_OPTIONS, getCategoryLabel } from '@/constants';
import type { ArtifactFormData, Artifact } from '@/types';

interface ArtifactFormProps {
  gridId?: string;
  stratumId?: string;
  onSuccess?: (artifact: Artifact) => void;
  onCancel?: () => void;
  isQuickRegister?: boolean;
  grid?: any;
  site?: any;
  strata?: any;
  editingArtifact?: Artifact | null;
}

const ArtifactForm: React.FC<ArtifactFormProps> = ({
  gridId: propGridId,
  stratumId: propStratumId,
  onSuccess,
  onCancel,
  isQuickRegister = false,
}) => {
  const [form] = Form.useForm<ArtifactFormData>();
  const [batchMode, setBatchMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [recentArtifacts, setRecentArtifacts] = useState<Artifact[]>([]);

  const storeGridId = useSiteStore((state) => state.selectedGridId);
  const activeGridId = propGridId || storeGridId;
  const storeStratumId = useArtifactStore((state) => state.selectedStratumId);
  const activeStratumId = propStratumId || storeStratumId;
  
  const getGridById = useSiteStore((state) => state.getGridById);
  const getStratumById = useArtifactStore((state) => state.getStratumById);
  const getStrataByGrid = useArtifactStore((state) => state.getStrataByGrid);
  const updateGridArtifactCount = useSiteStore((state) => state.updateGridArtifactCount);
  const addArtifact = useArtifactStore((state) => state.addArtifact);
  const getArtifactsByStratum = useArtifactStore((state) => state.getArtifactsByStratum);

  const grid = getGridById(activeGridId || '');
  const stratum = getStratumById(activeStratumId || '');
  const strata = getStrataByGrid(activeGridId || '');

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(!isQuickRegister);

  useEffect(() => {
    if (activeStratumId) {
      const artifacts = getArtifactsByStratum(activeStratumId).slice(-5).reverse();
      setRecentArtifacts(artifacts);
    }
  }, [activeStratumId, getArtifactsByStratum]);

  const subcategoryOptions = selectedCategory
    ? ARTIFACT_CATEGORIES.find((c) => c.value === selectedCategory)?.children || []
    : [];

  const handleValuesChange = useCallback(
    (changedValues: Partial<ArtifactFormData>) => {
      if ('category' in changedValues) {
        setSelectedCategory(changedValues.category || '');
        form.setFieldsValue({ subcategory: '' });
      }
      setErrors({});
    },
    [form]
  );

  const handleSubmit = async (values: ArtifactFormData) => {
    if (!activeGridId || !activeStratumId) {
      message.error('请先选择探方和地层');
      return;
    }

    const siteId = grid?.siteId || activeGridId.split('_grid_')[0];
    
    const validation = validateArtifact(values);
    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        newErrors[path] = issue.message;
      });
      setErrors(newErrors);
      message.error('请检查表单填写是否正确');
      return;
    }

    setSubmitting(true);
    
    try {
      const artifact = addArtifact({
        ...values,
        gridId: activeGridId,
        stratumId: activeStratumId,
        siteId,
      });

      if (artifact) {
        updateGridArtifactCount(activeGridId, values.quantity);
        message.success(`遗物"${values.name}"登记成功`);
        
        if (batchMode) {
          form.resetFields(['name', 'quantity', 'depth', 'offsetX', 'offsetY', 'notes']);
          setRecentArtifacts((prev) => [artifact, ...prev].slice(0, 5));
        } else {
          form.resetFields();
          onSuccess?.(artifact);
        }
      }
    } catch (error) {
      console.error('Failed to add artifact:', error);
      message.error('登记失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setErrors({});
    setSelectedCategory('');
    onCancel?.();
  };

  const handleQuickFill = (artifact: Artifact) => {
    form.setFieldsValue({
      category: artifact.category,
      subcategory: artifact.subcategory,
      condition: artifact.condition,
      period: artifact.period,
    });
    setSelectedCategory(artifact.category);
    message.success('已填充类别信息');
  };

  if (!activeGridId) {
    return (
      <div className="p-6 text-center text-stone-500">
        <AlertCircle className="mx-auto mb-2" size={32} />
        <p>请先从左侧画布选择一个探方</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-stone-200 bg-stone-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-stone-800">遗物登记</h3>
          <Space size="small">
            <span className="text-sm text-stone-500">批量录入</span>
            <Switch
              size="small"
              checked={batchMode}
              onChange={setBatchMode}
            />
          </Space>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {grid && (
            <Tag color="gold">
              探方: T{grid.row + 1}{String.fromCharCode(65 + grid.col)}
            </Tag>
          )}
          {stratum && (
            <Tag color="geekblue">
              地层: {stratum.name} ({stratum.period})
            </Tag>
          )}
          {strata.length > 0 && !stratum && (
            <span className="text-amber-600 text-xs">请先在剖面图中选择地层</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {strata.length > 0 && !stratum && (
          <Card size="small" className="mb-4 border-amber-300 bg-amber-50">
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-2">选择地层：</p>
              <div className="flex flex-wrap gap-2">
                {strata.map((s) => (
                  <Tag
                    key={s.id}
                    color={s.id === activeStratumId ? 'geekblue' : 'default'}
                    className="cursor-pointer hover:opacity-80"
                    onClick={() => useArtifactStore.getState().setSelectedStratum(s.id)}
                  >
                    {s.name} - {s.period}
                  </Tag>
                ))}
              </div>
            </div>
          </Card>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={handleValuesChange}
          initialValues={{
            quantity: 1,
            depth: stratum ? (stratum.depthTop + stratum.thickness / 2) : 0,
            offsetX: 2.5,
            offsetY: 2.5,
          }}
          size="small"
        >
          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="name"
              label="遗物名称"
              validateStatus={errors.name ? 'error' : ''}
              help={errors.name}
              className="col-span-2"
            >
              <Input placeholder="如：陶鼎残件" maxLength={50} showCount />
            </Form.Item>

            <Form.Item
              name="category"
              label="类别"
              validateStatus={errors.category ? 'error' : ''}
              help={errors.category}
            >
              <Select
                placeholder="选择类别"
                onChange={(val) => setSelectedCategory(val)}
                options={ARTIFACT_CATEGORIES.map((c) => ({
                  value: c.value,
                  label: c.label,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="subcategory"
              label="子类"
              validateStatus={errors.subcategory ? 'error' : ''}
              help={errors.subcategory}
            >
              <Select
                placeholder="选择子类"
                disabled={!selectedCategory}
                options={subcategoryOptions.map((c) => ({
                  value: c.value,
                  label: c.label,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="quantity"
              label="数量"
              validateStatus={errors.quantity ? 'error' : ''}
              help={errors.quantity}
            >
              <InputNumber min={1} max={999} className="w-full" />
            </Form.Item>

            <Form.Item
              name="condition"
              label="保存状况"
              validateStatus={errors.condition ? 'error' : ''}
              help={errors.condition}
            >
              <Select
                placeholder="选择状况"
                options={CONDITION_OPTIONS.map((c) => ({
                  value: c.value,
                  label: c.label,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="depth"
              label="出土深度(m)"
              validateStatus={errors.depth ? 'error' : ''}
              help={errors.depth}
            >
              <InputNumber min={0} max={10} step={0.01} className="w-full" />
            </Form.Item>

            <Form.Item
              name="period"
              label="年代推断"
              validateStatus={errors.period ? 'error' : ''}
              help={errors.period}
              className="col-span-2"
            >
              <Select
                placeholder="选择年代"
                allowClear
                options={PERIOD_OPTIONS.map((p) => ({
                  value: p.value,
                  label: p.label,
                }))}
              />
            </Form.Item>

            {isExpanded && (
              <>
                <div className="col-span-2 pt-2 mb-2 border-t border-stone-200">
                  <h4 className="text-sm font-medium text-stone-600 mb-2">坐标偏移</h4>
                </div>

                <Form.Item
                  name="offsetX"
                  label="X轴偏移(m)"
                  validateStatus={errors.offsetX ? 'error' : ''}
                  help={errors.offsetX}
                >
                  <InputNumber min={0} max={5} step={0.01} className="w-full" />
                </Form.Item>

                <Form.Item
                  name="offsetY"
                  label="Y轴偏移(m)"
                  validateStatus={errors.offsetY ? 'error' : ''}
                  help={errors.offsetY}
                >
                  <InputNumber min={0} max={5} step={0.01} className="w-full" />
                </Form.Item>

                <Form.Item
                  name="notes"
                  label="备注"
                  className="col-span-2"
                >
                  <Input.TextArea
                    rows={3}
                    placeholder="记录出土位置、伴生遗物、保存情况等"
                    maxLength={500}
                    showCount
                  />
                </Form.Item>
              </>
            )}
          </div>

          <div className="flex justify-center mt-2">
            <Button
              type="text"
              size="small"
              icon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-stone-500"
            >
              {isExpanded ? '收起高级选项' : '展开高级选项'}
            </Button>
          </div>

          <div className="flex gap-3 mt-4 pt-4 border-t border-stone-200">
            <Button
              type="primary"
              htmlType="submit"
              icon={<Save size={16} />}
              loading={submitting}
              disabled={!activeStratumId}
              block
            >
              {batchMode ? '保存并继续' : '保存'}
            </Button>
            {!isQuickRegister && (
              <Button icon={<X size={16} />} onClick={handleCancel}>
                取消
              </Button>
            )}
          </div>
        </Form>

        {recentArtifacts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-stone-200">
            <h4 className="text-sm font-medium text-stone-600 mb-3">最近录入</h4>
            <div className="space-y-2">
              {recentArtifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-center justify-between p-2 bg-stone-50 rounded cursor-pointer hover:bg-stone-100 transition-colors"
                  onClick={() => handleQuickFill(artifact)}
                >
                  <div>
                    <span className="font-medium text-stone-700">{artifact.name}</span>
                    <span className="text-xs text-stone-500 ml-2">
                      {getCategoryLabel(artifact.category)} / {artifact.quantity}件
                    </span>
                  </div>
                  <Tag color="default" className="text-xs">
                    {artifact.period || '待鉴定'}
                  </Tag>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ArtifactForm);
