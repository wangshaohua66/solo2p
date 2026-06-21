import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Row,
  Col,
  message,
} from 'antd';
import { PlusSquare } from 'lucide-react';
import type { MaintenanceTask, MaintenanceCategory, VoltageLevel, EquipmentType, UserLevel } from '@/types';
import { usePlanStore } from '@/store/planStore';
import { useEquipmentStore } from '@/store/equipmentStore';
import dayjs, { Dayjs } from 'dayjs';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface PlanFormProps {
  open: boolean;
  onClose: () => void;
  editingTask?: MaintenanceTask | null;
}

const CATEGORY_OPTIONS: { label: string; value: MaintenanceCategory }[] = [
  { label: '一次设备停电检修', value: 'primary_outage' },
  { label: '二次设备校验', value: 'secondary_calibration' },
  { label: '线路走廊砍伐', value: 'corridor_clearing' },
  { label: '技改工程施工', value: 'technical_reform' },
];

const USER_LEVEL_OPTIONS: { label: string; value: UserLevel }[] = [
  { label: 'A级（重要用户）', value: 'A' },
  { label: 'B级（一般用户）', value: 'B' },
  { label: 'C级（普通用户）', value: 'C' },
];

const PlanForm = ({ open, onClose, editingTask }: PlanFormProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const createTask = usePlanStore((s) => s.createTask);
  const updateTask = usePlanStore((s) => s.updateTask);
  const { substations, lines, equipments } = useEquipmentStore();

  useEffect(() => {
    if (open) {
      if (editingTask) {
        form.setFieldsValue({
          title: editingTask.title,
          category: editingTask.category,
          timeRange: [dayjs(editingTask.startTime), dayjs(editingTask.endTime)],
          applicant: editingTask.applicant,
          department: editingTask.department,
          workContent: editingTask.workContent,
          affectedUserLevel: editingTask.affectedUserLevel,
          loadTransferPlan: editingTask.loadTransferPlan || '',
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          category: 'primary_outage',
          applicant: '当前用户',
          department: '检修一工区',
        });
      }
    }
  }, [open, editingTask, form]);

  const handleOk = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const [start, end] = values.timeRange as [Dayjs, Dayjs];
      const duration = Math.max(1, Math.round((end.valueOf() - start.valueOf()) / (60 * 60 * 100)) / 10);

      const payload = {
        title: values.title,
        category: values.category as MaintenanceCategory,
        startTime: start.valueOf(),
        endTime: end.valueOf(),
        outageDurationH: duration,
        applicant: values.applicant,
        department: values.department,
        workContent: values.workContent || '',
        affectedUserLevel: values.affectedUserLevel as UserLevel,
        loadTransferPlan: values.loadTransferPlan || undefined,
      };

      if (editingTask) {
        updateTask(editingTask.id, payload);
        message.success('任务更新成功');
      } else {
        await createTask(payload);
        message.success('任务创建成功');
      }

      onClose();
    } catch {
      // 校验失败
    } finally {
      setLoading(false);
    }
  };

  const stationOptions = substations.map((s) => ({
    label: `${s.name}（${s.voltageLevel}）`,
    value: s.id,
  }));

  const lineOptions = lines.map((l) => ({
    label: `${l.name}（${l.voltageLevel}）`,
    value: l.id,
  }));

  const equipOptions = equipments.map((e) => ({
    label: `${e.name}`,
    value: e.id,
  }));

  return (
    <Modal
      title={
        <span className="inline-flex items-center gap-2">
          <PlusSquare size={18} className="text-dispatch-600" />
          {editingTask ? '编辑检修任务' : '新建检修任务'}
        </span>
      }
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={loading}
      okText={editingTask ? '保存修改' : '创建任务'}
      cancelText="取消"
      width={720}
      maskClosable={false}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        className="!mt-4"
        requiredMark="optional"
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label="任务名称"
              name="title"
              rules={[{ required: true, message: '请输入任务名称' }]}
            >
              <Input placeholder="例如：江北变1号主变压器例行检修" size="large" allowClear />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="检修类型"
              name="category"
              rules={[{ required: true, message: '请选择检修类型' }]}
            >
              <Select size="large" options={CATEGORY_OPTIONS} placeholder="请选择检修类型" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="检修时间"
              name="timeRange"
              rules={[{ required: true, message: '请选择检修时间范围' }]}
            >
              <RangePicker
                size="large"
                showTime={{ defaultValue: [dayjs('08:00', 'HH:mm'), dayjs('18:00', 'HH:mm')] }}
                style={{ width: '100%' }}
                placeholder={['开始时间', '结束时间']}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="所属变电站" name="stationId">
              <Select
                size="large"
                options={stationOptions}
                placeholder="请选择变电站"
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="设备" name="equipmentId">
              <Select
                size="large"
                options={equipOptions}
                placeholder="请选择设备"
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="线路" name="lineId">
              <Select
                size="large"
                options={lineOptions}
                placeholder="请选择线路"
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="申请人" name="applicant">
              <Input size="large" placeholder="申请人姓名" allowClear />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="所属部门" name="department">
              <Input size="large" placeholder="所属部门" allowClear />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="影响用户等级" name="affectedUserLevel">
              <Select size="large" options={USER_LEVEL_OPTIONS} placeholder="请选择" allowClear />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item label="工作内容描述" name="workContent">
              <TextArea
                rows={3}
                placeholder="请详细描述检修工作的具体内容和范围..."
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item label="负荷转移方案" name="loadTransferPlan">
              <TextArea
                rows={2}
                placeholder="如涉及停电，请描述负荷转移的具体方案（选填）..."
                maxLength={300}
                showCount
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default PlanForm;
