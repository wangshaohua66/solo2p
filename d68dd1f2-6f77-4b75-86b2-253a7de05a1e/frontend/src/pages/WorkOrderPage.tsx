import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Row, Col, Descriptions, Tag, Button, Space, Typography,
  Timeline, Table, Form, InputNumber, Input, Select, Modal, message,
  Tabs, Image, Upload, Progress, Tooltip, Divider, Badge, Empty,
  Steps, Avatar, Alert, QRCode, Rate, List
} from 'antd';
import {
  ArrowLeftOutlined, ClockCircleOutlined, UserOutlined, CalendarOutlined,
  EditOutlined, PrinterOutlined, QrcodeOutlined, SafetyCertificateOutlined,
  CameraOutlined, PlusOutlined, MinusOutlined, ShoppingOutlined,
  ScanOutlined, SendOutlined, ReloadOutlined, SaveOutlined,
  ExclamationCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { workOrderApi, partsApi } from '@/api';
import type {
  WorkOrder, WorkOrderStatus, Part, PartUsage, ServiceItem
} from '@/types';
import { STATUS_COLOR, STATUS_LABEL, STATUS_FLOW } from '@/types';
import { validateInspection, compressImage, statusTransitionAllowed } from '@/utils';
import ScannerModal from '@/components/ScannerModal';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const WorkOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<WorkOrderStatus | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [partSearchText, setPartSearchText] = useState('');
  const [partOptions, setPartOptions] = useState<Part[]>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [partQuantity, setPartQuantity] = useState(1);
  const [partBatchNumber, setPartBatchNumber] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrInfo, setQrInfo] = useState<{ url: string; token: string } | null>(null);
  const [inspectionForm] = Form.useForm();
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [editInspection, setEditInspection] = useState(false);

  useEffect(() => { loadOrder(); }, [orderId]);
  useEffect(() => {
    if (order) {
      setServiceItems(order.serviceItems || []);
      inspectionForm.setFieldsValue(order.inspection || {});
    }
  }, [order]);

  const loadOrder = async () => {
    setLoading(true);
    try { setOrder(await workOrderApi.get(orderId)); }
    catch { message.error('加载工单失败'); }
    finally { setLoading(false); }
  };

  const abnormalInspection = useMemo(() => {
    if (!order?.inspection) return [];
    return validateInspection(order.inspection, order.movement);
  }, [order]);

  const currentStatusIndex = order ? STATUS_FLOW.indexOf(order.status) : -1;

  const handleStatusChangeClick = (status: WorkOrderStatus) => {
    setTargetStatus(status); setStatusNote(''); setStatusModalOpen(true);
  };

  const handleConfirmStatus = async () => {
    if (!targetStatus) return;
    try {
      const updated = await workOrderApi.changeStatus(orderId, targetStatus, statusNote);
      setOrder(updated);
      message.success(`状态已变更为：${STATUS_LABEL[targetStatus]}`);
      setStatusModalOpen(false); setTargetStatus(null);
    } catch (e: any) { message.error(e.message || '状态变更失败'); }
  };

  const handleSearchParts = async (value: string) => {
    setPartSearchText(value);
    if (value.length >= 1) {
      const res = await partsApi.list({ keyword: value, pageSize: 20 });
      setPartOptions(res.data);
    }
  };

  const handleScanPartSuccess = async (code: string) => {
    setShowScanner(false);
    try {
      setSelectedPart(await partsApi.getByBarcode(code));
      message.success(`已识别配件`);
    } catch { message.error('未找到该配件'); }
  };

  const handleAddPart = async () => {
    if (!selectedPart || partQuantity <= 0) { message.warning('请选择配件'); return; }
    try {
      await workOrderApi.addPartUsage(orderId, {
        partId: selectedPart.id, quantity: partQuantity, batchNumber: partBatchNumber
      });
      await loadOrder();
      message.success(`已出库 ${selectedPart.name} x${partQuantity}`);
      setPartModalOpen(false); setSelectedPart(null); setPartQuantity(1);
    } catch (e: any) { message.error(e.message || '出库失败'); }
  };

  const handleRemovePart = async (usageId: number) => {
    try { await workOrderApi.removePartUsage(orderId, usageId); await loadOrder(); message.success('已移除'); }
    catch { message.error('移除失败'); }
  };

  const handleSaveInspection = async () => {
    try {
      const values = await inspectionForm.validateFields();
      await workOrderApi.saveInspection(orderId, values);
      await loadOrder(); setEditInspection(false);
      message.success('检测数据已保存');
    } catch {}
  };

  const handleImageUpload = async (file: File, type: 'intake' | 'during' | 'after') => {
    try {
      const compressed = await compressImage(file, { maxSizeMB: 3, quality: 0.8 });
      message.loading({ content: '上传中...', key: 'up' });
      await workOrderApi.uploadImage(orderId, type, compressed);
      message.success({ content: '上传成功', key: 'up' });
      await loadOrder();
    } catch { message.error({ content: '上传失败', key: 'up' }); }
  };

  const handleGenerateQR = async () => {
    if (!order) return;
    try { setQrInfo(await workOrderApi.generateQrToken(order.orderNumber)); setQrModalOpen(true); }
    catch { message.error('生成失败'); }
  };

  const handleSendReportEmail = async () => {
    if (!order?.customer?.email) { message.warning('请设置客户邮箱'); return; }
    try { await workOrderApi.sendReportEmail(orderId); message.success('报告已发送'); }
    catch { message.error('发送失败'); }
  };

  const addServiceItem = () => setServiceItems([...serviceItems, { workOrderId: orderId, type: 'labor', name: '', quantity: 1, unitPrice: 0 }]);
  const updateServiceItem = (idx: number, field: string, value: any) => {
    const next = [...serviceItems]; (next[idx] as any)[field] = value; setServiceItems(next);
  };
  const removeServiceItem = (idx: number) => setServiceItems(serviceItems.filter((_, i) => i !== idx));
  const calculateServiceTotal = () => serviceItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  if (loading) return <Card style={{ padding: 100, textAlign: 'center' }}><Progress type="circle" percent={30} /></Card>;
  if (!order) return <Card><Empty description="工单不存在" /><div style={{ textAlign: 'center' }}><Button onClick={() => navigate('/work-orders')}>返回</Button></div></Card>;

  const groupedImages = {
    intake: order.images?.filter(i => i.type === 'intake') || [],
    during: order.images?.filter(i => i.type === 'during') || [],
    after: order.images?.filter(i => i.type === 'after') || []
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <Space size="middle">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/work-orders')} />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                {order.orderNumber}
                {order.repeatVisit && <Tag color="gold" style={{ marginLeft: 8 }}><ClockCircleOutlined /> 返店</Tag>}
                {order.priority !== 'normal' && <Tag color={order.priority === 'express' ? 'red' : 'orange'} style={{ marginLeft: 8 }}>{order.priority === 'express' ? '特快' : '加急'}</Tag>}
              </Title>
              <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>创建于 {new Date(order.createdAt).toLocaleString('zh-CN')}</Paragraph>
            </div>
          </Space>
          <Space wrap>
            <Tag color={STATUS_COLOR[order.status]} style={{ borderRadius: 4, padding: '4px 12px', fontSize: 13 }}>{STATUS_LABEL[order.status]}</Tag>
            <Button icon={<QrcodeOutlined />} onClick={handleGenerateQR}>取件码</Button>
            <Button icon={<PrinterOutlined />} onClick={() => navigate(`/report/${orderId}`)}>服务报告</Button>
            <Button icon={<EditOutlined />}>编辑</Button>
          </Space>
        </div>
        <Steps size="small" current={currentStatusIndex} items={STATUS_FLOW.map((s, i) => ({
          title: (
            <Tooltip title={STATUS_LABEL[s]}>
              <span
                style={{
                  color: i <= currentStatusIndex ? '#fff' : undefined,
                  cursor: i > currentStatusIndex ? 'pointer' : 'default'
                }}
                onClick={() => { if (i > currentStatusIndex) handleStatusChangeClick(s); }}
              >{STATUS_LABEL[s]}</span>
            </Tooltip>
          ),
          status: i < currentStatusIndex ? 'finish' : i === currentStatusIndex ? 'process' : 'wait',
          styles: { title: { minWidth: 80, fontSize: 12, whiteSpace: 'nowrap' } }
        }))} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="客户信息" size="small">
            <Descriptions column={1} size="small" labelStyle={{ width: 80 }}>
              <Descriptions.Item label="姓名"><Space><Avatar size={28} style={{ backgroundColor: '#1677ff' }} icon={<UserOutlined />} />{order.customer?.name}</Space></Descriptions.Item>
              <Descriptions.Item label="电话">{order.customer?.phone}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{order.customer?.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="累计工单">{order.customer?.totalOrders || 1} 次</Descriptions.Item>
            </Descriptions>
            {order.customer?.email && <Button icon={<SendOutlined />} size="small" style={{ marginTop: 8 }} onClick={handleSendReportEmail} type="dashed" block>发送服务报告</Button>}
          </Card>

          <Card title="手表信息" size="small" style={{ marginTop: 16 }}>
            <Descriptions column={1} size="small" labelStyle={{ width: 90 }}>
              <Descriptions.Item label="品牌型号"><strong>{order.brand} {order.model}</strong></Descriptions.Item>
              <Descriptions.Item label="表壳序列号">{order.caseSerialNumber}</Descriptions.Item>
              <Descriptions.Item label="机芯型号">
                {order.movementCode || '-'}
                {order.movement && (
                  <Tooltip title={<div><div>频率：{order.movement.frequency}bph</div><div>宝石：{order.movement.jewelCount}钻</div><div>动储：{order.movement.powerReserveHours}h</div></div>}>
                    <InfoCircleOutlined style={{ color: '#1677ff', marginLeft: 4 }} />
                  </Tooltip>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="机芯序列号">{order.movementSerialNumber || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="时间与进度" size="small" style={{ marginTop: 16 }}>
            <Descriptions column={1} size="small" labelStyle={{ width: 100 }}>
              <Descriptions.Item label="进店日期"><Space><CalendarOutlined />{dayjs(order.intakeDate).format('YYYY-MM-DD HH:mm')}</Space></Descriptions.Item>
              <Descriptions.Item label="预计交付">{order.estimatedDeliveryDate ? dayjs(order.estimatedDeliveryDate).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              <Descriptions.Item label="实际交付">{order.actualDeliveryDate ? dayjs(order.actualDeliveryDate).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              <Descriptions.Item label="维修周期">
                {order.actualDeliveryDate
                  ? `${dayjs(order.actualDeliveryDate).diff(order.intakeDate, 'day')} 天`
                  : `已进行 ${dayjs().diff(order.intakeDate, 'day')} 天`}
              </Descriptions.Item>
              <Descriptions.Item label="分配技工">{order.assignedTechnicianName || <Tag color="default">未分配</Tag>}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="费用明细" size="small" style={{ marginTop: 16 }}>
            <Descriptions column={1} size="small" labelStyle={{ width: 100 }}>
              <Descriptions.Item label="工时费">¥{order.laborPrice.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="配件费">¥{order.partsPrice.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="附加费">¥{calculateServiceTotal().toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="预收押金"><span style={{ color: '#52c41a' }}>¥{order.deposit.toFixed(2)}</span></Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>应收总金额</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#fa8c16' }}>¥{order.totalPrice.toFixed(2)}</span>
            </div>
            {order.deposit < order.totalPrice && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                <span style={{ color: '#8c8c8c' }}>待收余款</span>
                <span style={{ color: '#fa541c', fontWeight: 600 }}>¥{(order.totalPrice - order.deposit).toFixed(2)}</span>
              </div>
            )}
          </Card>

          <Card title={<Space><SafetyCertificateOutlined /> 质保信息</Space>} size="small" style={{ marginTop: 16 }}>
            {order.warranty ? (
              <>
                <Descriptions column={1} size="small" labelStyle={{ width: 80 }}>
                  <Descriptions.Item label="期限">{order.warranty.months} 个月</Descriptions.Item>
                  <Descriptions.Item label="起始">{dayjs(order.warranty.startDate).format('YYYY-MM-DD')}</Descriptions.Item>
                  <Descriptions.Item label="到期">{dayjs(order.warranty.endDate).format('YYYY-MM-DD')}</Descriptions.Item>
                </Descriptions>
                <Progress percent={Math.min(Math.round(((dayjs().valueOf() - dayjs(order.warranty.startDate).valueOf()) /
                  (dayjs(order.warranty.endDate).valueOf() - dayjs(order.warranty.startDate).valueOf())) * 100), 100)}
                  status={dayjs().isAfter(order.warranty.endDate) ? 'exception' : 'active'}
                  showInfo={false} style={{ marginTop: 12 }} />
                <div style={{ marginTop: 4, fontSize: 12, color: dayjs(order.warranty.endDate).diff(dayjs(), 'day') <= 60 ? '#fa541c' : '#8c8c8c', textAlign: 'center' }}>
                  剩余 {Math.max(dayjs(order.warranty.endDate).diff(dayjs(), 'day'), 0)} 天
                </div>
              </>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未启用质保" style={{ padding: '12px 0' }} />}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card tabList={[
            { key: 'timeline', label: '维修时间轴' },
            { key: 'inspection', label: '检测数据' },
            { key: 'parts', label: '配件清单' },
            { key: 'images', label: '图片记录' },
            { key: 'quote', label: '报价与收费' }
          ]} activeTabKey={activeTab} onTabChange={setActiveTab} bodyStyle={{ paddingTop: 16 }}>

            {activeTab === 'timeline' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text strong>关键事件记录</Text>
                  <Button type="primary" size="small"
                    onClick={() => handleStatusChangeClick(STATUS_FLOW[currentStatusIndex + 1] || order.status)}
                    disabled={currentStatusIndex >= STATUS_FLOW.length - 1}>
                    <PlusOutlined /> 更新状态
                  </Button>
                </div>
                {order.logs && order.logs.length > 0 ? (
                  <Timeline mode="left" items={order.logs.map(log => {
                    const match = STATUS_FLOW.find(s => log.action.includes(STATUS_LABEL[s]));
                    return {
                      color: match ? STATUS_COLOR[match] : 'blue',
                      label: dayjs(log.createdAt).format('YYYY-MM-DD HH:mm'),
                      children: (
                        <div>
                          <Text strong>{log.action}</Text>
                          {log.operatorName && <Tag color="blue" style={{ marginLeft: 8, fontSize: 12 }}>{log.operatorName}</Tag>}
                          {log.detail && <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0, whiteSpace: 'pre-wrap' }}>{log.detail}</Paragraph>}
                        </div>
                      )
                    };
                  })} />
                ) : <Empty description="暂无操作记录" />}
              </div>
            )}

            {activeTab === 'inspection' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text strong>机芯检测数据表</Text>
                  {!editInspection ? (
                    <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => setEditInspection(true)}>
                      {order.inspection ? '编辑检测数据' : '录入检测数据'}
                    </Button>
                  ) : <Space><Button size="small" onClick={() => setEditInspection(false)}>取消</Button><Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleSaveInspection}>保存</Button></Space>}
                </div>
                {abnormalInspection.length > 0 && (
                  <Alert type="warning" showIcon icon={<ExclamationCircleOutlined />}
                    message={`检测到 ${abnormalInspection.length} 项异常指标`}
                    description={<ul style={{ margin: 0, paddingLeft: 20 }}>
                      {abnormalInspection.map((a, i) => <li key={i}><span style={{ color: '#fa541c', fontWeight: 600 }}>{a.field}：</span>实际 {a.actual}，标准 {a.standard}</li>)}
                    </ul>} style={{ marginBottom: 16 }} />
                )}
                <Form form={inspectionForm} layout="vertical" disabled={!editInspection}>
                  <Row gutter={16}>
                    <Col xs={12} sm={8}><Form.Item name="frequency" label={<span>振频 (bph){order.movement && <Tag color="default" style={{ marginLeft: 4 }}>标准 {order.movement.frequency}</Tag>}</span>}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                    <Col xs={12} sm={8}><Form.Item name="amplitude" label={<span>振幅 (°){order.movement?.standardAmplitude && <Tag color="default" style={{ marginLeft: 4 }}>标准 {order.movement.standardAmplitude}</Tag>}</span>}><Input placeholder="如：280" /></Form.Item></Col>
                    <Col xs={12} sm={8}><Form.Item name="rate" label={<span>日差 (s/d){order.movement?.standardRate && <Tag color="default" style={{ marginLeft: 4 }}>标准 {order.movement.standardRate}</Tag>}</span>}><Input placeholder="如：+5" /></Form.Item></Col>
                    <Col xs={12} sm={8}><Form.Item name="beatError" label="位差 (ms)"><Input placeholder="如：0.1" /></Form.Item></Col>
                    <Col xs={12} sm={8}><Form.Item name="powerReserve" label={<span>动力储存 (h){order.movement?.powerReserveHours && <Tag color="default" style={{ marginLeft: 4 }}>标准 {order.movement.powerReserveHours}</Tag>}</span>}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                    <Col xs={12} sm={8}><Form.Item name="waterResistance" label="防水等级"><Select placeholder="选择防水等级" options={[
                      { label: '未测试', value: '未测试' }, { label: '30米生活防水', value: '30米生活防水' },
                      { label: '50米', value: '50米' }, { label: '100米', value: '100米' },
                      { label: '200米潜水', value: '200米潜水' }, { label: '300米专业潜水', value: '300米专业潜水' },
                      { label: '测试不通过', value: '测试不通过' }
                    ]} /></Form.Item></Col>
                    <Col xs={12} sm={8}><Form.Item name="dialCondition" label="表盘状况"><Select options={[
                      { label: '全新无暇', value: '全新无暇' }, { label: '轻微使用痕迹', value: '轻微使用痕迹' },
                      { label: '明显使用痕迹', value: '明显使用痕迹' }, { label: '划痕/变形', value: '划痕/变形' },
                      { label: '严重损坏', value: '严重损坏' }
                    ]} /></Form.Item></Col>
                    <Col xs={12} sm={8}><Form.Item name="caseCondition" label="表壳状况"><Select options={[
                      { label: '全新无暇', value: '全新无暇' }, { label: '轻微使用痕迹', value: '轻微使用痕迹' },
                      { label: '明显使用痕迹', value: '明显使用痕迹' }, { label: '划痕/磕碰', value: '划痕/磕碰' },
                      { label: '严重变形', value: '严重变形' }
                    ]} /></Form.Item></Col>
                    <Col xs={12} sm={8}><Form.Item name="bandCondition" label="表带状况"><Select options={[
                      { label: '全新', value: '全新' }, { label: '轻微磨损', value: '轻微磨损' },
                      { label: '明显磨损', value: '明显磨损' }, { label: '扣具损坏', value: '扣具损坏' },
                      { label: '断裂风险', value: '断裂风险' }
                    ]} /></Form.Item></Col>
                    <Col xs={12} sm={8}><Form.Item name="crownFunction" label="表冠功能"><Rate allowHalf count={5} /></Form.Item></Col>
                    <Col xs={12} sm={8}><Form.Item name="dateFunction" label="日历功能"><Rate allowHalf count={5} /></Form.Item></Col>
                    <Col xs={12} sm={8}><Form.Item name="chronographFunction" label="计时功能"><Rate allowHalf count={5} /></Form.Item></Col>
                    <Col span={24}><Form.Item name="notes" label="检测备注"><TextArea rows={3} /></Form.Item></Col>
                  </Row>
                </Form>
              </div>
            )}

            {activeTab === 'parts' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Space><Text strong>使用配件清单</Text>{order.partUsages?.length && <Tag color="blue">{order.partUsages.length} 项</Tag>}</Space>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setPartModalOpen(true)}>扫码出库配件</Button>
                </div>
                <Table size="small" dataSource={order.partUsages || []} rowKey="id" pagination={false} columns={[
                  { title: '配件', dataIndex: ['part', 'name'], render: (_, r: PartUsage) => <div><div style={{ fontWeight: 500 }}>{r.part?.name}</div><div style={{ fontSize: 12, color: '#8c8c8c' }}>SKU: {r.part?.sku}{r.batchNumber && ` | 批次: ${r.batchNumber}`}</div></div> },
                  { title: '数量', dataIndex: 'quantity', width: 80, align: 'center' },
                  { title: '单价', dataIndex: 'unitPrice', width: 100, render: (v: number) => `¥${v.toFixed(2)}` },
                  { title: '小计', width: 100, render: (_, r: PartUsage) => <span style={{ fontWeight: 600 }}>¥{(r.unitPrice * r.quantity).toFixed(2)}</span> },
                  { title: '出库时间', dataIndex: 'usedAt', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
                  { title: '', width: 60, render: (_, r: PartUsage) => <Button type="text" danger size="small" icon={<MinusOutlined />} onClick={() => handleRemovePart(r.id)} /> }
                ]} />
                {(!order.partUsages || order.partUsages.length === 0) && <Empty description="暂无配件记录" style={{ padding: 24 }} />}
              </div>
            )}

            {activeTab === 'images' && (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {(['intake', 'during', 'after'] as const).map(type => (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text strong>
                        {type === 'intake' ? '📸 进店时照片' : type === 'during' ? '🔧 维修过程照片' : '✅ 完工照片'}
                        <Tag color="default" style={{ marginLeft: 8 }}>{groupedImages[type].length} 张</Tag>
                      </Text>
                      <Upload multiple accept="image/*" beforeUpload={f => { handleImageUpload(f, type); return false; }} showUploadList={false}>
                        <Button size="small" icon={<CameraOutlined />}>
                          上传{type === 'intake' ? '进店' : type === 'during' ? '过程' : '完工'}图
                        </Button>
                      </Upload>
                    </div>
                    {groupedImages[type].length > 0 ? (
                      <Row gutter={[12, 12]}>
                        <Image.PreviewGroup>
                          {groupedImages[type].map(img => (
                            <Col xs={12} sm={8} md={6} key={img.id}>
                              <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
                                <Image width="100%" height={160} style={{ objectFit: 'cover' }} src={img.url} />
                                {img.caption && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 8px', fontSize: 12 }}>{img.caption}</div>}
                              </div>
                            </Col>
                          ))}
                        </Image.PreviewGroup>
                      </Row>
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                  </div>
                ))}
              </Space>
            )}

            {activeTab === 'quote' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text strong>服务收费项目</Text>
                  <Space><Button icon={<ReloadOutlined />}>重新计算报价</Button><Button type="primary" icon={<PlusOutlined />} onClick={addServiceItem}>添加项目</Button></Space>
                </div>
                <Table size="small" dataSource={serviceItems} pagination={false} rowKey={(r, i) => i as number} columns={[
                  { title: '类型', dataIndex: 'type', width: 100, render: (v, _, i) => <Select size="small" value={v} onChange={val => updateServiceItem(i, 'type', val)} options={[{ label: '工时', value: 'labor' }, { label: '配件', value: 'part' }, { label: '其他', value: 'other' }]} /> },
                  { title: '项目名称', dataIndex: 'name', render: (v, _, i) => <Input size="small" value={v} onChange={e => updateServiceItem(i, 'name', e.target.value)} placeholder="如：机芯保养" /> },
                  { title: '数量', dataIndex: 'quantity', width: 100, render: (v, _, i) => <InputNumber size="small" min={1} value={v} onChange={val => updateServiceItem(i, 'quantity', val || 1)} style={{ width: '100%' }} /> },
                  { title: '单价', dataIndex: 'unitPrice', width: 120, render: (v, _, i) => <InputNumber size="small" min={0} prefix="¥" value={v} onChange={val => updateServiceItem(i, 'unitPrice', val || 0)} style={{ width: '100%' }} /> },
                  { title: '小计', width: 100, render: (_, r) => <Text strong>¥{(r.unitPrice * r.quantity).toFixed(2)}</Text> },
                  { title: '', width: 40, render: (_, __, i) => <Button type="text" danger size="small" icon={<MinusOutlined />} onClick={() => removeServiceItem(i)} /> }
                ]} />
                <Divider />
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16, background: '#fafafa', borderRadius: 6 }}>
                  <Space direction="vertical" size="small" style={{ minWidth: 220 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><Text type="secondary">工时费</Text><Text>¥{order.laborPrice.toFixed(2)}</Text></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><Text type="secondary">配件费</Text><Text>¥{order.partsPrice.toFixed(2)}</Text></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><Text type="secondary">附加服务</Text><Text>¥{calculateServiceTotal().toFixed(2)}</Text></div>
                    <Divider style={{ margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong style={{ fontSize: 15 }}>应收总额</Text>
                      <Text strong style={{ fontSize: 18, color: '#fa8c16' }}>¥{(order.laborPrice + order.partsPrice + calculateServiceTotal()).toFixed(2)}</Text>
                    </div>
                  </Space>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal title="状态变更确认" open={statusModalOpen} onCancel={() => { setStatusModalOpen(false); setTargetStatus(null); }} onOk={handleConfirmStatus} okText="确认变更">
        {targetStatus && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message={<Space>当前状态<Tag color={STATUS_COLOR[order.status]}>{STATUS_LABEL[order.status]}</Tag>→目标状态<Tag color={STATUS_COLOR[targetStatus]}>{STATUS_LABEL[targetStatus]}</Tag></Space>} />
            <div><Text strong>操作备注：</Text><TextArea rows={3} value={statusNote} onChange={e => setStatusNote(e.target.value)} style={{ marginTop: 8 }} placeholder="输入状态变更原因..." /></div>
          </Space>
        )}
      </Modal>

      <Modal title="配件扫码出库" open={partModalOpen} onCancel={() => { setPartModalOpen(false); setSelectedPart(null); setPartQuantity(1); setPartSearchText(''); }} width={600}
        footer={<Space><Button onClick={() => setShowScanner(true)} icon={<ScanOutlined />}>扫码识别</Button><Button type="primary" onClick={handleAddPart} disabled={!selectedPart} icon={<ShoppingOutlined />}>确认出库</Button></Space>}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>搜索配件</Text>
            <Select showSearch allowClear style={{ width: '100%', marginTop: 8 }} placeholder="输入 SKU、名称"
              value={selectedPart?.id || undefined} filterOption={false}
              onSearch={handleSearchParts}
              onSelect={val => { const p = partOptions.find(x => x.id === val); if (p) setSelectedPart(p); }}
              onClear={() => setSelectedPart(null)} size="large"
              options={partOptions.map(p => ({ label: <div><div><Text strong>{p.name}</Text><Tag color="default" style={{ marginLeft: 8 }}>SKU: {p.sku}</Tag></div><div style={{ fontSize: 12, color: '#8c8c8c' }}>库存: {p.stock}{p.location && ` | 位置: ${p.location}`} | ¥{p.unitPrice.toFixed(2)}</div></div>, value: p.id }))} />
          </div>
          {selectedPart && (
            <Card size="small" type="inner" title="配件信息" style={{ background: '#fafafa' }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="名称" span={2}>{selectedPart.name}</Descriptions.Item>
                <Descriptions.Item label="SKU">{selectedPart.sku}</Descriptions.Item>
                <Descriptions.Item label="单价">¥{selectedPart.unitPrice.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="库存">
                  <span style={{ color: selectedPart.stock <= selectedPart.reorderLevel ? '#fa541c' : '#52c41a', fontWeight: 600 }}>{selectedPart.stock} 件</span>
                  {selectedPart.stock <= selectedPart.reorderLevel && <Tag color="red" style={{ marginLeft: 8 }}>库存预警</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="位置">{selectedPart.location || '-'}</Descriptions.Item>
              </Descriptions>
              <Divider style={{ margin: '12px 0' }} />
              <Row gutter={16}>
                <Col xs={12}><Text strong>出库数量：</Text><InputNumber min={1} max={selectedPart.stock} value={partQuantity} onChange={v => setPartQuantity(v || 1)} style={{ marginTop: 8, width: '100%' }} /></Col>
                <Col xs={12}><Text strong>批次号：</Text><Input value={partBatchNumber} onChange={e => setPartBatchNumber(e.target.value)} placeholder="（可选）" style={{ marginTop: 8 }} /></Col>
              </Row>
              <Alert type="success" showIcon style={{ marginTop: 12 }} message={`出库小计：¥${(selectedPart.unitPrice * partQuantity).toFixed(2)}`} />
            </Card>
          )}
        </Space>
      </Modal>

      <Modal title="客户取件码" open={qrModalOpen} onCancel={() => setQrModalOpen(false)} footer={null} centered>
        {qrInfo && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ display: 'inline-block', padding: 24, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
              <QRCode value={qrInfo.url} size={200} />
            </div>
            <Paragraph type="secondary" style={{ marginTop: 16 }}>扫描二维码可查看取件信息</Paragraph>
            <Input value={qrInfo.url} readOnly style={{ marginTop: 8 }} />
          </div>
        )}
      </Modal>

      <ScannerModal open={showScanner} onCancel={() => setShowScanner(false)} onSuccess={handleScanPartSuccess} />
    </Space>
  );
};

export default WorkOrderPage;
