import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Table, Input, Select, Button, Tag, Space, Row, Col, Modal, Form,
  InputNumber, Radio, Empty, Drawer, Descriptions, Badge, Progress, Tooltip,
  List, Divider, Typography, Alert, message, Segmented, Avatar, theme
} from 'antd';
import {
  ShoppingOutlined, SearchOutlined, PlusOutlined, ReloadOutlined,
  EditOutlined, ScanOutlined, InboxOutlined, WarningOutlined,
  EnvironmentOutlined, BarcodeOutlined, InfoCircleOutlined, ExportOutlined,
  FilterOutlined, AppstoreOutlined, UnorderedListOutlined
} from '@ant-design/icons';
import { partsApi } from '@/api';
import type { Part, PartCategory } from '@/types';
import ScannerModal from '@/components/ScannerModal';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PartsPage: React.FC = () => {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Part[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState<'table' | 'shelf'>('table');
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [categories, setCategories] = useState<PartCategory[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [createForm] = Form.useForm();
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockForm] = Form.useForm();

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadList(); }, [page, pageSize, keyword, categoryId, lowStockOnly]);

  const loadCategories = async () => {
    try { setCategories(await partsApi.categories()); } catch {}
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await partsApi.list({
        keyword, categoryId, lowStock: lowStockOnly, page, pageSize
      });
      setList(res.data); setTotal(res.total);
    } finally { setLoading(false); }
  };

  const handleScanSuccess = async (code: string) => {
    setShowScanner(false);
    try {
      const part = await partsApi.getByBarcode(code);
      setSelectedPart(part); setDetailDrawerOpen(true);
      message.success(`已找到配件：${part.name}`);
    } catch { message.error('未找到该配件'); }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await partsApi.create(values);
      message.success('配件创建成功');
      setCreateModalOpen(false); createForm.resetFields();
      loadList();
    } catch {}
  };

  const handleRestock = async () => {
    if (!selectedPart) return;
    try {
      const values = await restockForm.validateFields();
      await partsApi.restock(selectedPart.id, values);
      message.success('入库成功');
      setRestockModalOpen(false); restockForm.resetFields();
      loadList();
    } catch {}
  };

  const stockLevelColor = (part: Part) => {
    if (part.stock === 0) return '#ff4d4f';
    if (part.stock <= part.reorderLevel) return '#fa8c16';
    if (part.stock <= part.reorderLevel * 2) return '#faad14';
    return '#52c41a';
  };

  const locationGrid = useMemo(() => {
    const grid: Record<string, Part[]> = {};
    list.forEach(p => {
      const loc = p.location || '未分类';
      if (!grid[loc]) grid[loc] = [];
      grid[loc].push(p);
    });
    return grid;
  }, [list]);

  const shelfColors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
  ];

  const columns = [
    {
      title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>
    },
    {
      title: '配件名称', dataIndex: 'name', key: 'name',
      render: (v: string, r: Part) => (
        <a onClick={() => { setSelectedPart(r); setDetailDrawerOpen(true); }} style={{ fontWeight: 500 }}>{v}</a>
      )
    },
    {
      title: '分类', dataIndex: ['category', 'name'], key: 'category', width: 100,
      render: (v) => v ? <Tag color="blue">{v}</Tag> : '-'
    },
    {
      title: '适用机芯', dataIndex: 'movementCode', key: 'movementCode', width: 120,
      render: (v) => v || '-'
    },
    {
      title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 100,
      render: (v: number) => <span style={{ fontWeight: 600 }}>¥{v.toFixed(2)}</span>
    },
    {
      title: '库存', dataIndex: 'stock', key: 'stock', width: 140,
      render: (v: number, r: Part) => (
        <Space direction="vertical" size={0} style={{ width: 100 }}>
          <Space size={4}>
            <Badge color={stockLevelColor(r)} />
            <span style={{ fontWeight: 600 }}>{v}</span>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>/ 预警 {r.reorderLevel}</span>
          </Space>
          <Progress percent={Math.min(Math.round((v / Math.max(r.reorderLevel * 3, 1)) * 100), 100)}
            showInfo={false} size="small"
            strokeColor={stockLevelColor(r)} />
        </Space>
      )
    },
    {
      title: '货位', dataIndex: 'location', key: 'location', width: 100,
      render: (v) => v ? <Space size={4}><EnvironmentOutlined />{v}</Space> : <Tag color="default">未设置</Tag>
    },
    {
      title: '操作', key: 'action', width: 140, fixed: 'right' as const,
      render: (_: any, r: Part) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EditOutlined />}>编辑</Button>
          <Button size="small" type="link" onClick={() => { setSelectedPart(r); setRestockModalOpen(true); }}>+入库</Button>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <Space size="middle">
            <Title level={4} style={{ margin: 0 }}><ShoppingOutlined /> 配件库存管理 <Tag color="blue" style={{ fontSize: 14 }}>共 {total}</Tag></Title>
            {lowStockOnly && <Tag color="red" icon={<WarningOutlined />}>低库存模式</Tag>}
          </Space>
          <Space>
            <Segmented
              value={viewMode}
              onChange={v => setViewMode(v as any)}
              options={[
                { label: <Space><UnorderedListOutlined />表格</Space>, value: 'table' },
                { label: <Space><AppstoreOutlined />货架</Space>, value: 'shelf' }
              ]}
            />
            <Button icon={<ScanOutlined />} onClick={() => setShowScanner(true)}>扫码查找</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>新增配件</Button>
          </Space>
        </div>

        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              size="large"
              placeholder="搜索 SKU / 名称 / 品牌"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={loadList}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              size="large"
              style={{ width: '100%' }}
              placeholder="分类"
              allowClear
              value={categoryId}
              onChange={v => { setCategoryId(v); setPage(1); }}
            >
              {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Button
              size="large"
              block
              type={lowStockOnly ? 'primary' : 'default'}
              icon={<WarningOutlined />}
              onClick={() => { setLowStockOnly(!lowStockOnly); setPage(1); }}
              danger={lowStockOnly}
            >
              {lowStockOnly ? '仅显示预警' : '全部库存'}
            </Button>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Button size="large" block icon={<ReloadOutlined />} onClick={loadList}>刷新</Button>
          </Col>
          <Col xs={24} md={6}>
            <Button size="large" block icon={<ExportOutlined />} type="dashed">导出清单</Button>
          </Col>
        </Row>
      </Card>

      {viewMode === 'table' ? (
        <Card bodyStyle={{ padding: 0 }}>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={list}
            columns={columns}
            pagination={{
              current: page, pageSize, total, showSizeChanger: true, showQuickJumper: true,
              showTotal: t => `共 ${t} 条`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); }
            }}
            scroll={{ x: 1000 }}
          />
        </Card>
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {Object.keys(locationGrid).length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 60 }}><Empty description="暂无库存数据" /></Card>
          ) : Object.entries(locationGrid).map(([loc, parts], idx) => (
            <Card
              key={loc}
              size="small"
              title={<Space size="middle"><EnvironmentOutlined style={{ fontSize: 16 }} /><strong>{loc}</strong><Tag>{parts.length} 件</Tag></Space>}
              style={{ overflow: 'hidden' }}
            >
              <div className="part-shelf-view">
                {parts.map(p => (
                  <div
                    key={p.id}
                    className="part-shelf-card"
                    onClick={() => { setSelectedPart(p); setDetailDrawerOpen(true); }}
                    style={{
                      background: shelfColors[idx % shelfColors.length],
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.92)' }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <Text code style={{ fontSize: 11, color: '#8c8c8c' }}>{p.sku}</Text>
                        <Badge color={stockLevelColor(p)} />
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#262626', lineHeight: 1.3, minHeight: 36 }}>{p.name}</div>
                      {p.movementCode && <Tag color="default" style={{ marginBottom: 8, fontSize: 11 }}>{p.movementCode}</Tag>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: token.colorPrimary }}>{p.stock}</div>
                          <div style={{ fontSize: 10, color: '#8c8c8c' }}>库存 / 预警{p.reorderLevel}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#fa8c16' }}>¥{p.unitPrice.toFixed(0)}</div>
                          <div style={{ fontSize: 10, color: '#8c8c8c' }}>单价</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </Space>
      )}

      <Modal
        title="新增配件"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        okText="创建"
        width={680}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="sku" label="SKU 编号" rules={[{ required: true, message: '必填' }]}>
                <Input placeholder="如：MB-SW-200-001" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="配件名称" rules={[{ required: true, message: '必填' }]}>
                <Input placeholder="如：ETA 2824-2 主发条" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="categoryId" label="分类" rules={[{ required: true, message: '必填' }]}>
                <Select placeholder="选择分类">
                  {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="unitPrice" label="单价(元)" rules={[{ required: true, message: '必填' }]}>
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} prefix="¥" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="movementCode" label="适用机芯">
                <Input placeholder="如：ETA 2824-2" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="stock" label="初始库存" initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="reorderLevel" label="预警阈值" initialValue={5}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="location" label="存放位置">
                <Input placeholder="如：A-01-03" prefix={<EnvironmentOutlined />} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="barcode" label="条码">
                <Input prefix={<BarcodeOutlined />} placeholder="扫码或输入" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="brand" label="品牌/产地">
                <Input placeholder="如：Swiss Made" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="description" label="描述">
                <TextArea rows={2} placeholder="配件详细说明..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={`入库: ${selectedPart?.name || ''}`}
        open={restockModalOpen}
        onCancel={() => setRestockModalOpen(false)}
        onOk={handleRestock}
        okText="确认入库"
        destroyOnClose
      >
        <Form form={restockForm} layout="vertical">
          <Form.Item name="quantity" label="入库数量" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={12}>
              <Form.Item name="supplier" label="供应商">
                <Input placeholder="（可选）" />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item name="cost" label="采购成本(元)">
                <InputNumber min={0} step={0.01} prefix="¥" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title={selectedPart?.name}
        width={480}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => { setRestockModalOpen(true); }} icon={<InboxOutlined />} type="primary">快速入库</Button>
            <Button icon={<EditOutlined />}>编辑</Button>
          </Space>
        }
      >
        {selectedPart && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card size="small" type="inner" title="基本信息">
              <Descriptions column={1} size="small" labelStyle={{ width: 100 }}>
                <Descriptions.Item label="SKU"><Text code>{selectedPart.sku}</Text></Descriptions.Item>
                <Descriptions.Item label="分类">{selectedPart.category?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="品牌">{selectedPart.brand || '-'}</Descriptions.Item>
                <Descriptions.Item label="适用机芯">{selectedPart.movementCode || '-'}</Descriptions.Item>
                <Descriptions.Item label="单价"><span style={{ color: '#fa8c16', fontWeight: 600 }}>¥{selectedPart.unitPrice.toFixed(2)}</span></Descriptions.Item>
              </Descriptions>
            </Card>
            <Card size="small" type="inner" title="库存状态"
              style={selectedPart.stock <= selectedPart.reorderLevel ? { borderLeft: `4px solid ${stockLevelColor(selectedPart)}` } : {}}>
              {selectedPart.stock <= selectedPart.reorderLevel && (
                <Alert type="warning" showIcon message="库存低于预警阈值，请及时补货" style={{ marginBottom: 12 }} />
              )}
              <Row gutter={16}>
                <Col span={8} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 700, color: stockLevelColor(selectedPart) }}>{selectedPart.stock}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>当前库存</div>
                </Col>
                <Col span={8} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{selectedPart.reorderLevel}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>预警阈值</div>
                </Col>
                <Col span={8} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#8c8c8c' }}>{selectedPart.location || '-'}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}><EnvironmentOutlined /> 存放位置</div>
                </Col>
              </Row>
              <Progress
                percent={Math.min(Math.round((selectedPart.stock / Math.max(selectedPart.reorderLevel * 3, 1)) * 100), 100)}
                strokeColor={stockLevelColor(selectedPart)}
                style={{ marginTop: 16 }}
              />
            </Card>
            {selectedPart.barcode && (
              <Card size="small" type="inner" title="条码信息">
                <Space>
                  <BarcodeOutlined style={{ fontSize: 18 }} />
                  <Text code style={{ fontSize: 14 }}>{selectedPart.barcode}</Text>
                </Space>
              </Card>
            )}
            {selectedPart.description && (
              <Card size="small" type="inner" title="备注描述">
                <Paragraph style={{ margin: 0 }}>{selectedPart.description}</Paragraph>
              </Card>
            )}
            <Card size="small" type="inner" title="变动记录">
              <List
                size="small"
                dataSource={[
                  { time: '2024-01-15 14:30', type: 'out', qty: -2, note: '工单 WO202401150001 出库' },
                  { time: '2024-01-12 09:15', type: 'in', qty: 20, note: '采购入库' },
                  { time: '2024-01-08 16:20', type: 'out', qty: -1, note: '工单 WO202401080003 出库' }
                ]}
                renderItem={item => (
                  <List.Item>
                    <Space size="middle" style={{ width: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.time}</Text>
                      <Tag color={item.type === 'in' ? 'green' : 'orange'}>
                        {item.type === 'in' ? '入库' : '出库'} {item.qty > 0 ? '+' : ''}{item.qty}
                      </Tag>
                      <span style={{ flex: 1, fontSize: 13 }}>{item.note}</span>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        )}
      </Drawer>

      <ScannerModal open={showScanner} onCancel={() => setShowScanner(false)} onSuccess={handleScanSuccess} />
    </Space>
  );
};

export default PartsPage;
