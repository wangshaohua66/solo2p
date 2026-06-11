import { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  Drawer,
  Descriptions,
  Badge,
  Tabs,
  List,
  Alert,
  InputNumber,
} from 'antd';
import {
  Package,
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  Search,
  Plus,
  ShoppingCart,
  Eye,
  Clock,
} from 'lucide-react';
import type { Batch, BatchStatus, InventoryWarning } from '@/types';
import { mockBatches, mockSuppliers, mockWarnings } from '@/mocks';
import { useInventoryStore } from '@/stores/useInventoryStore';

const STATUS_TAG: Record<BatchStatus, { color: string; label: string }> = {
  IN_STOCK: { color: 'green', label: '在库' },
  CHECKED_OUT: { color: 'blue', label: '已出库' },
  EXPIRED: { color: 'red', label: '已过期' },
};

function isExpiringSoon(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  const diff = new Date(expiryDate).getTime() - Date.now();
  return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
}

function isExpired(batch: Batch): boolean {
  return (
    batch.status === 'EXPIRED' ||
    (batch.expiryDate !== null && new Date(batch.expiryDate).getTime() < Date.now())
  );
}

function getRowStyle(record: Batch): React.CSSProperties {
  if (isExpired(record)) return { backgroundColor: '#fff1f0' };
  if (isExpiringSoon(record.expiryDate)) return { backgroundColor: '#fff7e6' };
  return {};
}

export default function InventoryPage() {
  const store = useInventoryStore();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<BatchStatus | undefined>();
  const [expiryFilter, setExpiryFilter] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutBatch, setCheckoutBatch] = useState<Batch | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailBatch, setDetailBatch] = useState<Batch | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const [addForm] = Form.useForm();
  const [checkoutForm] = Form.useForm();

  const batches = store.batches.length > 0 ? store.batches : mockBatches;
  const warnings: InventoryWarning[] = store.warnings.length > 0 ? store.warnings : mockWarnings;

  const expiringCount = useMemo(
    () => batches.filter((b) => isExpiringSoon(b.expiryDate) && !isExpired(b)).length,
    [batches],
  );
  const lowStockCount = useMemo(() => batches.filter((b) => b.quantity <= 10).length, [batches]);
  const inStockCount = useMemo(() => batches.filter((b) => b.status === 'IN_STOCK').length, [batches]);

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (searchText && !b.materialName.toLowerCase().includes(searchText.toLowerCase()) && !b.batchNo.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (statusFilter && b.status !== statusFilter) return false;
      if (expiryFilter && !isExpiringSoon(b.expiryDate)) return false;
      return true;
    });
  }, [batches, searchText, statusFilter, expiryFilter]);

  const handleCheckout = (batch: Batch) => {
    setCheckoutBatch(batch);
    checkoutForm.setFieldsValue({ quantity: 1 });
    setCheckoutModalOpen(true);
  };

  const handleCheckoutSubmit = () => {
    checkoutForm.validateFields().then((values) => {
      if (checkoutBatch) {
        store.checkoutBatch(checkoutBatch.id, {
          quantity: values.quantity,
          operatorId: 1,
          note: values.note,
        });
      }
      setCheckoutModalOpen(false);
      checkoutForm.resetFields();
    });
  };

  const handleDetail = (batch: Batch) => {
    setDetailBatch(batch);
    setDetailDrawerOpen(true);
  };

  const handleAddSubmit = () => {
    addForm.validateFields().then((values) => {
      const composition: Record<string, number> = {};
      (values.oxideComposition || []).forEach(
        (item: { key: string; value: number }) => {
          if (item.key && item.value !== undefined) {
            composition[item.key] = item.value;
          }
        },
      );
      store.createBatch({
        ...values,
        oxideComposition: composition,
        supplierName: mockSuppliers.find((s) => s.id === values.supplierId)?.name ?? '',
        status: 'IN_STOCK',
      });
      setAddModalOpen(false);
      addForm.resetFields();
    });
  };

  const columns = [
    { title: '批号', dataIndex: 'batchNo', key: 'batchNo', width: 140 },
    { title: '原料名称', dataIndex: 'materialName', key: 'materialName', width: 180 },
    { title: '供应商', dataIndex: 'supplierName', key: 'supplierName', width: 180 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
    {
      title: '保质期',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      width: 120,
      render: (val: string | null) => val ?? '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: BatchStatus, record: Batch) => (
        <Space>
          <Tag color={STATUS_TAG[status].color}>{STATUS_TAG[status].label}</Tag>
          {isExpiringSoon(record.expiryDate) && !isExpired(record) && (
            <Tag color="orange">临期</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Batch) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<ShoppingCart size={14} />}
            disabled={record.status !== 'IN_STOCK'}
            onClick={() => handleCheckout(record)}
          >
            出库
          </Button>
          <Button
            type="link"
            size="small"
            icon={<Eye size={14} />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'inventory', label: '库存管理' },
          {
            key: 'warnings',
            label: (
              <Badge count={warnings.length} size="small" offset={[6, -2]}>
                预警中心
              </Badge>
            ),
          },
        ]}
      />

      {activeTab === 'inventory' && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总批次数"
                  value={batches.length}
                  prefix={<Package size={20} color="#3B6FA0" />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="在库"
                  value={inStockCount}
                  prefix={<CheckCircle size={20} color="#52c41a" />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="临期预警"
                  value={expiringCount}
                  prefix={<AlertTriangle size={20} color="#E8602C" />}
                  valueStyle={{ color: '#E8602C' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="低库存"
                  value={lowStockCount}
                  prefix={<TrendingDown size={20} color="#faad14" />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          <Card style={{ marginBottom: 16 }}>
            <Space wrap>
              <Input
                placeholder="搜索原料名称/批号"
                prefix={<Search size={14} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 240 }}
                allowClear
              />
              <Select
                placeholder="状态筛选"
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
                style={{ width: 140 }}
                options={Object.entries(STATUS_TAG).map(([key, val]) => ({
                  value: key,
                  label: val.label,
                }))}
              />
              <Select
                placeholder="临期筛选"
                value={expiryFilter ? 'yes' : undefined}
                onChange={(v) => setExpiryFilter(v === 'yes')}
                allowClear
                style={{ width: 140 }}
                options={[{ value: 'yes', label: '30天内到期' }]}
              />
              <Button
                type="primary"
                icon={<Plus size={14} />}
                onClick={() => setAddModalOpen(true)}
                style={{ marginLeft: 'auto' }}
              >
                新增批次
              </Button>
            </Space>
          </Card>

          <Card>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={filteredBatches}
              rowClassName={() => ''}
              onRow={(record) => ({
                style: getRowStyle(record),
              })}
              pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
            />
          </Card>
        </>
      )}

      {activeTab === 'warnings' && (
        <Card>
          <List
            dataSource={warnings}
            renderItem={(item: InventoryWarning) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <AlertTriangle
                      size={20}
                      color={item.type === 'EXPIRED' ? '#ff4d4f' : '#E8602C'}
                    />
                  }
                  title={
                    <Space>
                      <span>
                        {item.batchNo} - {item.materialName}
                      </span>
                      <Tag color={item.type === 'EXPIRED' ? 'red' : 'orange'}>
                        {item.type === 'EXPIRY_SOON' ? '临期预警' : item.type === 'EXPIRED' ? '已过期' : '低库存'}
                      </Tag>
                    </Space>
                  }
                  description={item.message}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      <Drawer
        title="批次详情"
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={520}
      >
        {detailBatch && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="批号">{detailBatch.batchNo}</Descriptions.Item>
              <Descriptions.Item label="原料名称">{detailBatch.materialName}</Descriptions.Item>
              <Descriptions.Item label="供应商">{detailBatch.supplierName}</Descriptions.Item>
              <Descriptions.Item label="数量">
                {detailBatch.quantity} {detailBatch.unit}
              </Descriptions.Item>
              <Descriptions.Item label="保质期">{detailBatch.expiryDate ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_TAG[detailBatch.status].color}>
                  {STATUS_TAG[detailBatch.status].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="入库日期">{detailBatch.createdAt}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 12 }}>氧化物组成</h4>
              <Table
                size="small"
                pagination={false}
                dataSource={Object.entries(detailBatch.oxideComposition).map(([key, value]) => ({
                  key,
                  oxide: key,
                  percentage: value,
                }))}
                columns={[
                  { title: '氧化物', dataIndex: 'oxide', key: 'oxide' },
                  { title: '含量 (%)', dataIndex: 'percentage', key: 'percentage' },
                ]}
              />
            </div>

            {detailBatch.spectralData && (
              <div style={{ marginTop: 24 }}>
                <h4 style={{ marginBottom: 12 }}>光谱数据</h4>
                <Alert type="info" message={detailBatch.spectralData} />
              </div>
            )}
          </>
        )}
      </Drawer>

      <Modal
        title="出库确认"
        open={checkoutModalOpen}
        onOk={handleCheckoutSubmit}
        onCancel={() => {
          setCheckoutModalOpen(false);
          checkoutForm.resetFields();
        }}
        okText="确认出库"
      >
        {checkoutBatch && (
          <>
            <Alert
              type="info"
              showIcon
              icon={<Clock size={16} />}
              message="FIFO 推荐"
              description={`推荐优先出库批次 ${checkoutBatch.batchNo}，入库日期：${checkoutBatch.createdAt}`}
              style={{ marginBottom: 16 }}
            />
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="原料">{checkoutBatch.materialName}</Descriptions.Item>
              <Descriptions.Item label="当前库存">
                {checkoutBatch.quantity} {checkoutBatch.unit}
              </Descriptions.Item>
            </Descriptions>
            <Form form={checkoutForm} layout="vertical">
              <Form.Item
                name="quantity"
                label="出库数量"
                rules={[{ required: true, message: '请输入出库数量' }]}
              >
                <InputNumber
                  min={1}
                  max={checkoutBatch.quantity}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item name="scheduleId" label="关联排程（可选）">
                <Select allowClear placeholder="选择排程" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="note" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Modal
        title="新增批次"
        open={addModalOpen}
        onOk={handleAddSubmit}
        onCancel={() => {
          setAddModalOpen(false);
          addForm.resetFields();
        }}
        okText="确认添加"
        width={600}
      >
        <Form form={addForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="batchNo"
                label="批号"
                rules={[{ required: true, message: '请输入批号' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="supplierId"
                label="供应商"
                rules={[{ required: true, message: '请选择供应商' }]}
              >
                <Select
                  options={mockSuppliers.map((s) => ({ value: s.id, label: s.name }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="materialName"
                label="原料名称"
                rules={[{ required: true, message: '请输入原料名称' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="quantity"
                label="数量"
                rules={[{ required: true, message: '请输入数量' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="unit"
                label="单位"
                rules={[{ required: true, message: '请输入单位' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="expiryDate" label="保质期">
            <Input type="date" />
          </Form.Item>
          <Form.Item label="氧化物组成">
            <Form.List name="oxideComposition">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item {...restField} name={[name, 'key']} rules={[{ required: true, message: '氧化物' }]}>
                        <Input placeholder="氧化物" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'value']} rules={[{ required: true, message: '含量' }]}>
                        <InputNumber placeholder="含量 (%)" min={0} max={100} step={0.1} />
                      </Form.Item>
                      <Button type="link" danger onClick={() => remove(name)}>
                        删除
                      </Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<Plus size={14} />}>
                    添加氧化物
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
