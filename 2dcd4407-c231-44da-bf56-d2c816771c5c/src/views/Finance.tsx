import { useState, useEffect } from 'react';
import { Card, Button, Space, Row, Col, Statistic, Modal, Form, Input, Select, DatePicker, InputNumber, message } from 'antd';
import { PlusOutlined, ReloadOutlined, ExportOutlined, DollarOutlined, FileSearchOutlined } from '@ant-design/icons';
import FinanceTable from '../components/FinanceTable';
import { useFinanceStore } from '../stores/financeStore';
import type { FinanceRecord, MergeSettleRequest } from '../types';
import { formatCurrency } from '../utils/exportUtils';

const { Option } = Select;

const FinancePage: React.FC = () => {
  const { records, deposits, loading, total, fetchRecords, fetchDeposits, addRecord, confirmRecord, refundDeposit, exportRecords, mergeSettle } = useFinanceStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [mergeForm] = Form.useForm();

  useEffect(() => {
    fetchRecords();
    fetchDeposits();
  }, [fetchRecords, fetchDeposits]);

  const handleAddRecord = async (values: any) => {
    try {
      const newRecord: Partial<FinanceRecord> = {
        ...values,
        amount: values.amount,
        recordedAt: values.recordedAt?.format('YYYY-MM-DD HH:mm:ss'),
        status: 'pending',
      };
      await addRecord(newRecord as FinanceRecord);
      message.success('记录已添加');
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('添加失败，请重试');
    }
  };

  const handleConfirm = async (recordId: string) => {
    Modal.confirm({
      title: '确认到账',
      content: '确定该款项已到账吗？',
      onOk: async () => {
        await confirmRecord(recordId);
        message.success('已确认到账');
      },
    });
  };

  const handleRefund = async (depositId: string, amount: number, reason = '正常退还') => {
    Modal.confirm({
      title: '押金退还确认',
      content: `确定退还押金 ¥${amount.toLocaleString()} 吗？`,
      onOk: async () => {
        await refundDeposit(depositId, amount, reason);
        message.success('押金退还成功');
      },
    });
  };

  const handleMergeSettle = async (values: MergeSettleRequest) => {
    try {
      const result = await mergeSettle({ scheduleIds: values.scheduleIds, includeDeposit: values.includeDeposit });
      Modal.info({
        title: '合并结算结果',
        width: 500,
        content: (
          <div className="space-y-3">
            <Row gutter={16}>
              <Col span={12}>
                <div className="text-gray-500 text-sm">总收入</div>
                <div className="font-medium text-green-600">{formatCurrency(result.incomeAmount)}</div>
              </Col>
              <Col span={12}>
                <div className="text-gray-500 text-sm">总支出</div>
                <div className="font-medium text-red-600">{formatCurrency(result.expenseAmount)}</div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <div className="text-gray-500 text-sm">押金</div>
                <div className="font-medium text-blue-600">{formatCurrency(result.depositAmount)}</div>
              </Col>
              <Col span={12}>
                <div className="text-gray-500 text-sm text-lg">结算净额</div>
                <div className="font-bold text-xl text-blue-600">{formatCurrency(result.totalAmount)}</div>
              </Col>
            </Row>
            <div className="text-gray-500 text-sm mt-2">包含 {result.records.length} 条记录</div>
          </div>
        ),
      });
      setMergeModalVisible(false);
      mergeForm.resetFields();
    } catch (error) {
      message.error('合并结算失败');
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportRecords('xlsx');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `财务报表_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="财务结算"
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchRecords(); fetchDeposits(); }}>刷新</Button>
            <Button icon={<FileSearchOutlined />} onClick={() => setMergeModalVisible(true)}>合并结算</Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>导出报表</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              新增记录
            </Button>
          </Space>
        }
      >
        <FinanceTable
          records={records}
          deposits={deposits}
          loading={loading}
          total={total}
          onConfirm={handleConfirm}
          onRefund={handleRefund}
        />
      </Card>

      <Modal
        title="新增收支记录"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleAddRecord}>
          <Form.Item
            name="type"
            label="收支类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="请选择类型">
              <Option value="income">收入</Option>
              <Option value="expense">支出</Option>
              <Option value="deposit">押金</Option>
              <Option value="refund">退款</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="contractName"
            label="关联合同/项目"
            rules={[{ required: true, message: '请输入关联项目' }]}
          >
            <Input placeholder="请输入关联合同或项目名称" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              prefix={<DollarOutlined />}
              min={0}
              precision={2}
              placeholder="请输入金额"
            />
          </Form.Item>
          <Form.Item
            name="paymentMethod"
            label="支付方式"
            rules={[{ required: true, message: '请选择支付方式' }]}
          >
            <Select placeholder="请选择支付方式">
              <Option value="bank_transfer">银行转账</Option>
              <Option value="alipay">支付宝</Option>
              <Option value="wechat">微信支付</Option>
              <Option value="cash">现金</Option>
              <Option value="check">支票</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="recordedAt"
            label="记录日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="invoiceNo" label="发票号码">
            <Input placeholder="请输入发票号码（可选）" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注（可选）" />
          </Form.Item>
          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认添加</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="多展会合并结算"
        open={mergeModalVisible}
        onCancel={() => setMergeModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={mergeForm} layout="vertical" onFinish={handleMergeSettle}>
          <Form.Item
            name="scheduleIds"
            label="选择展会"
            rules={[{ required: true, message: '请选择要结算的展会' }]}
          >
            <Select mode="multiple" placeholder="请选择需要合并结算的展会" style={{ width: '100%' }}>
              {Array.from(new Set(records.map(r => r.scheduleId))).map(id => {
                const record = records.find(r => r.scheduleId === id);
                return (
                  <Option key={id} value={id}>
                    {record?.scheduleName || id}
                  </Option>
                );
              })}
            </Select>
          </Form.Item>
          <Form.Item
            name="includeDeposit"
            label="包含押金"
            valuePropName="checked"
          >
            <Select>
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setMergeModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">生成结算单</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FinancePage;
