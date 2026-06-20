import { useState } from 'react';
import { Table, Card, Tag, Space, Button, Input, Select, DatePicker, Statistic, Row, Col, Modal, Form, InputNumber, message } from 'antd';
import { SearchOutlined, DownloadOutlined, PlusOutlined, CheckOutlined, FundOutlined, ExportOutlined } from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import type { FinanceRecord, DepositRecord } from '../../types';
import { formatCurrency } from '../../utils/exportUtils';
import { formatDate } from '../../utils/dateUtils';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface FinanceTableProps {
  records: FinanceRecord[];
  deposits?: DepositRecord[];
  loading?: boolean;
  total: number;
  onConfirm?: (id: string) => void;
  onRefund?: (id: string, amount: number, reason: string) => void;
  onAdd?: (data: Partial<FinanceRecord>) => void;
  onExport?: () => void;
  rowSelection?: TableRowSelection<FinanceRecord>;
  showRowSelection?: boolean;
}

const typeLabels: Record<string, string> = {
  income: '收入',
  expense: '支出',
  deposit: '押金',
  refund: '退款',
};

const typeColors: Record<string, string> = {
  income: 'green',
  expense: 'red',
  deposit: 'orange',
  refund: 'blue',
};

const statusLabels: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  cancelled: '已取消',
};

const statusColors: Record<string, string> = {
  pending: 'processing',
  confirmed: 'success',
  cancelled: 'default',
};

const methodLabels: Record<string, string> = {
  bank_transfer: '银行转账',
  alipay: '支付宝',
  wechat: '微信支付',
  cash: '现金',
  check: '支票',
};

const FinanceTable: React.FC<FinanceTableProps> = ({
  records,
  deposits = [],
  loading,
  total,
  onConfirm,
  onRefund,
  onAdd,
  onExport,
  rowSelection,
}) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState<DepositRecord | null>(null);
  const [form] = Form.useForm();
  
  const finalRowSelection: TableRowSelection<FinanceRecord> | undefined = rowSelection ?? {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  const summary = records.reduce(
    (acc, record) => {
      if (record.type === 'income') acc.income += record.amount;
      if (record.type === 'expense') acc.expense += record.amount;
      if (record.type === 'deposit') acc.deposit += record.amount;
      if (record.type === 'refund') acc.refund += record.amount;
      return acc;
    },
    { income: 0, expense: 0, deposit: 0, refund: 0 }
  );

  const expandedRowRender = (record: FinanceRecord) => (
    <div className="bg-gray-50 p-4 rounded-lg">
      <Row gutter={16}>
        <Col span={6}>
          <Statistic title="记录编号" value={record.id} />
        </Col>
        <Col span={6}>
          <Statistic title="关联合同" value={record.contractName || '-'} />
        </Col>
        <Col span={6}>
          <Statistic title="发票号" value={record.invoiceNo || '-'} />
        </Col>
        <Col span={6}>
          <Statistic
            title="发票日期"
            value={record.invoiceDate ? formatDate(record.invoiceDate) : '-'}
          />
        </Col>
        <Col span={6}>
          <Statistic title="操作人员" value={record.operatorName || '-'} />
        </Col>
        <Col span={6}>
          <Statistic
            title="确认时间"
            value={record.confirmedAt ? formatDate(record.confirmedAt) : '-'}
          />
        </Col>
        <Col span={12}>
          <Statistic title="备注" value={record.remark || '无'} />
        </Col>
      </Row>
    </div>
  );

  const columns: ColumnsType<FinanceRecord> = [
    {
      title: '日期',
      dataIndex: 'recordedAt',
      key: 'recordedAt',
      width: 120,
      render: (date: string) => formatDate(date),
      sorter: (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => <Tag color={typeColors[type]}>{typeLabels[type]}</Tag>,
      filters: Object.entries(typeLabels).map(([value, label]) => ({ text: label, value })),
      onFilter: (value, record) => record.type === value,
    },
    {
      title: '关联展会',
      dataIndex: 'scheduleName',
      key: 'scheduleName',
      ellipsis: true,
      width: 200,
    },
    {
      title: '项目名称',
      dataIndex: 'contractName',
      key: 'contractName',
      ellipsis: true,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (amount: number, record) => (
        <span className={`font-medium ${
          record.type === 'income' ? 'text-green-600' : 
          record.type === 'expense' ? 'text-red-600' :
          record.type === 'deposit' ? 'text-orange-600' : 'text-blue-600'
        }`}>
          {record.type === 'expense' || record.type === 'refund' ? '-' : '+'}
          {formatCurrency(amount)}
        </span>
      ),
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: '支付方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 100,
      render: (method: string) => methodLabels[method] || method,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => onConfirm?.(record.id)}
            >
              确认
            </Button>
          )}
          {record.type === 'deposit' && record.status === 'confirmed' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<FundOutlined />}
              onClick={() => {
                const deposit = deposits.find(d => d.contractId === record.contractId);
                setSelectedDeposit(deposit || null);
                setRefundModalOpen(true);
              }}
            >
              退还押金
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const handleRefund = async () => {
    try {
      const values = await form.validateFields();
      if (selectedDeposit) {
        onRefund?.(selectedDeposit.id, values.refundAmount, values.reason);
        setRefundModalOpen(false);
        message.success('押金退还申请已提交');
      }
    } catch (error) {
      // Validation error
    }
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      onAdd?.(values);
      setAddModalOpen(false);
      message.success('记录已添加');
    } catch (error) {
      // Validation error
    }
  };

  return (
    <Card
      loading={loading}
      className="shadow-sm"
      title={
        <div className="flex items-center justify-between w-full">
          <span className="font-semibold">财务明细</span>
          <Space>
            <Input
              placeholder="搜索展会/合同"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 200 }}
            />
            <Select placeholder="类型" allowClear style={{ width: 120 }}>
              {Object.entries(typeLabels).map(([value, label]) => (
                <Option key={value} value={value}>{label}</Option>
              ))}
            </Select>
            <RangePicker />
            <Button icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
              新增记录
            </Button>
            <Button icon={<ExportOutlined />} onClick={onExport}>
              导出
            </Button>
          </Space>
        </div>
      }
      extra={
        <Row gutter={16} className="pt-2">
          <Col span={6}>
            <Statistic
              title="总收入"
              value={summary.income}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总支出"
              value={summary.expense}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="押金池"
              value={summary.deposit}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="净利润"
              value={summary.income - summary.expense}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
        </Row>
      }
    >
      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        rowSelection={finalRowSelection}
        expandable={{ expandedRowRender }}
        pagination={{
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条记录`,
        }}
        scroll={{ x: 1200 }}
        size="small"
      />

      <Modal
        title="退还押金"
        open={refundModalOpen}
        onOk={handleRefund}
        onCancel={() => setRefundModalOpen(false)}
        okText="确认退还"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">
              可退还金额：
              <span className="font-medium text-green-600">
                {formatCurrency(selectedDeposit?.refundableAmount || 0)}
              </span>
            </div>
          </div>
          <Form.Item
            name="refundAmount"
            label="退还金额"
            rules={[
              { required: true, message: '请输入退还金额' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={selectedDeposit?.refundableAmount}
              prefix="¥"
              placeholder="请输入退还金额"
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="退还原因"
            rules={[{ required: true, message: '请输入退还原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入退还原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增财务记录"
        open={addModalOpen}
        onOk={handleAdd}
        onCancel={() => setAddModalOpen(false)}
        okText="确认添加"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="收支类型"
                rules={[{ required: true, message: '请选择类型' }]}
              >
                <Select placeholder="请选择类型">
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <Option key={value} value={value}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="金额"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  prefix="¥"
                  placeholder="请输入金额"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="paymentMethod"
                label="支付方式"
                rules={[{ required: true, message: '请选择支付方式' }]}
              >
                <Select placeholder="请选择支付方式">
                  {Object.entries(methodLabels).map(([value, label]) => (
                    <Option key={value} value={value}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="invoiceNo" label="发票号">
                <Input placeholder="请输入发票号" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Card>
  );
};

export default FinanceTable;
