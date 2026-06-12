import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Upload,
  message,
  Steps,
  Divider,
  Row,
  Col,
  InputNumber,
  Alert,
  Tag,
  Modal,
  Typography,
  Space,
  Tooltip,
  Badge,
  Radio,
  QRCode
} from 'antd';
import {
  InboxOutlined,
  UserOutlined,
  CameraOutlined,
  QrcodeOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { workOrderApi, customerApi, movementApi } from '@/api';
import type { Customer, Movement, WorkOrder } from '@/types';
import { STATUS_LABEL } from '@/types';
import { compressImage } from '@/utils';
import ScannerModal from '@/components/ScannerModal';

const { Dragger } = Upload;
const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;

const IntakePage: React.FC<{ qrToken?: string }> = ({ qrToken }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [repeatInfo, setRepeatInfo] = useState<any>(null);
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [movementOptions, setMovementOptions] = useState<Movement[]>([]);
  const [images, setImages] = useState<{ type: 'intake' | 'during' | 'after'; file: File; url: string; caption?: string }[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [movementDetail, setMovementDetail] = useState<Movement | null>(null);
  const [newOrderId, setNewOrderId] = useState<number | null>(null);
  const [qrInfo, setQrInfo] = useState<{ url: string; token: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMovements();
  }, []);

  const loadMovements = async () => {
    try {
      const res = await movementApi.list({ pageSize: 50 });
      setMovementOptions(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCustomerSearch = async (value: string) => {
    setCustomerSearchText(value);
    if (value.length >= 1) {
      try {
        const res = await customerApi.list({ keyword: value, pageSize: 10 });
        setCustomerOptions(res.data);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const checkRepeatVisit = async () => {
    const values = form.getFieldsValue();
    if (values.caseSerialNumber && values.customerName) {
      try {
        const result = await workOrderApi.checkRepeatVisit(
          values.caseSerialNumber,
          values.customerName
        );
        setRepeatInfo(result);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleMovementChange = async (code: string) => {
    if (code) {
      try {
        const movement = movementOptions.find((m) => m.code === code);
        if (movement) {
          setMovementDetail(movement);
        } else {
          const m = await movementApi.getByCode(code);
          setMovementDetail(m);
        }
      } catch (e) {
        setMovementDetail(null);
      }
    } else {
      setMovementDetail(null);
    }
  };

  const handleImageUpload = async (fileList: any[]) => {
    const processed = [];
    for (const f of fileList) {
      if (!f.url) {
        try {
          const compressed = await compressImage(f.originFileObj || f, {
            maxSizeMB: 3,
            quality: 0.8
          });
          processed.push({
            type: 'intake' as const,
            file: compressed,
            url: URL.createObjectURL(compressed),
            caption: f.name
          });
        } catch (e) {
          message.error(`图片 ${f.name} 处理失败`);
        }
      }
    }
    setImages((prev) => [...prev, ...processed]);
  };

  const handleScanSuccess = (result: string) => {
    setShowScanner(false);
    form.setFieldsValue({ caseSerialNumber: result });
    message.success(`已扫描：${result}`);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload: any = {
        brand: values.brand,
        model: values.model,
        caseSerialNumber: values.caseSerialNumber,
        movementSerialNumber: values.movementSerialNumber,
        movementCode: values.movementCode,
        intakeDate: values.intakeDate?.toISOString(),
        estimatedDeliveryDate: values.estimatedDeliveryDate?.toISOString(),
        problemDescription: values.problemDescription,
        customerNotes: values.customerNotes,
        warrantyMonths: values.warrantyMonths || 12,
        priority: values.priority || 'normal',
        laborPrice: movementDetail ? movementDetail.standardLaborHours * 300 : 0,
        partsPrice: 0,
        totalPrice: movementDetail ? movementDetail.standardLaborHours * 300 : 0,
        deposit: values.deposit || 0,
        customer: {
          name: values.customerName,
          phone: values.customerPhone,
          email: values.customerEmail
        }
      };

      const order = await workOrderApi.create(payload);
      setNewOrderId(order.id);

      for (const img of images) {
        try {
          await workOrderApi.uploadImage(order.id, img.type, img.file);
        } catch (e) {
          console.error('上传图片失败', e);
        }
      }

      try {
        const qr = await workOrderApi.generateQrToken(order.orderNumber);
        setQrInfo(qr);
      } catch (e) {
        console.error(e);
      }

      message.success('工单创建成功！');
      setStep(3);
    } catch (error: any) {
      if (error.errorFields) {
        message.warning('请完善所有必填项');
      } else {
        message.error('创建失败：' + (error.message || '请稍后重试'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles = ['客户信息', '手表信息', '拍照上传', '完成'];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Steps
          current={step}
          items={stepTitles.map((title) => ({ title }))}
          style={{ marginBottom: 32 }}
          size="default"
        />

        {step === 0 && (
          <Form form={form} layout="vertical" size="large">
            <Row gutter={24}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="customerName"
                  label="客户姓名"
                  rules={[{ required: true, message: '请输入客户姓名' }]}
                >
                  <Select
                    showSearch
                    allowClear
                    placeholder="输入姓名或手机号搜索"
                    filterOption={false}
                    onSearch={handleCustomerSearch}
                    onSelect={(val) => {
                      const customer = customerOptions.find((c) => c.name === val) ||
                        customerOptions.find((c) => c.phone === val);
                      if (customer) {
                        form.setFieldsValue({
                          customerName: customer.name,
                          customerPhone: customer.phone,
                          customerEmail: customer.email
                        });
                      }
                    }}
                    notFoundContent={
                      customerSearchText.length > 0 ? (
                        <div style={{ padding: 12 }}>
                          <Text type="secondary">未找到客户，将创建新客户</Text>
                        </div>
                      ) : null
                    }
                  >
                    {customerOptions.map((c) => (
                      <Select.Option key={c.id} value={c.name}>
                        {c.name} - {c.phone}
                        {c.email ? ` (${c.email})` : ''}
                        <Tag color="blue" style={{ marginLeft: 8 }}>
                          {c.totalOrders}单
                        </Tag>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="customerPhone"
                  label="联系电话"
                  rules={[{ required: true, message: '请输入手机号' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="手机号" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="customerEmail" label="邮箱（用于发送报告）">
                  <Input placeholder="email@example.com" />
                </Form.Item>
              </Col>
            </Row>
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" onClick={() => setStep(1)}>
                下一步
              </Button>
            </div>
          </Form>
        )}

        {step === 1 && (
          <Form form={form} layout="vertical" size="large">
            {repeatInfo?.isRepeat && (
              <Alert
                type="warning"
                showIcon
                closable
                message={
                  <Space>
                    <SafetyCertificateOutlined />
                    检测到该表 6 个月内有 {repeatInfo.previousOrders.length} 次维修记录
                    <Button
                      type="link"
                      onClick={() =>
                        navigate(`/work-orders/${repeatInfo.previousOrders[0].id}`)
                      }
                    >
                      查看上次工单
                    </Button>
                  </Space>
                }
                style={{ marginBottom: 24 }}
              />
            )}

            <Row gutter={24}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="brand"
                  label="品牌"
                  rules={[{ required: true, message: '请输入品牌' }]}
                >
                  <Select
                    showSearch
                    allowClear
                    placeholder="如：劳力士、欧米茄、浪琴"
                    options={[
                      { label: '劳力士 Rolex', value: '劳力士' },
                      { label: '欧米茄 Omega', value: '欧米茄' },
                      { label: '浪琴 Longines', value: '浪琴' },
                      { label: '百达翡丽 Patek Philippe', value: '百达翡丽' },
                      { label: '江诗丹顿 Vacheron Constantin', value: '江诗丹顿' },
                      { label: '积家 Jaeger-LeCoultre', value: '积家' },
                      { label: 'IWC 万国', value: 'IWC' },
                      { label: '卡地亚 Cartier', value: '卡地亚' },
                      { label: '帝舵 Tudor', value: '帝舵' },
                      { label: '天梭 Tissot', value: '天梭' },
                      { label: '美度 Mido', value: '美度' },
                      { label: '汉米尔顿 Hamilton', value: '汉米尔顿' },
                      { label: '其他', value: '其他' }
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="model"
                  label="型号"
                  rules={[{ required: true, message: '请输入型号' }]}
                >
                  <Input placeholder="如：Submariner 116610LN" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="caseSerialNumber"
                  label="表壳序列号"
                  rules={[{ required: true, message: '请输入序列号' }]}
                  extra={<Button
                    size="small"
                    type="dashed"
                    icon={<QrcodeOutlined />}
                    onClick={() => setShowScanner(true)}
                  >
                    扫码录入
                  </Button>}
                >
                  <Input
                    placeholder="表壳背面刻印的序列号"
                    onBlur={checkRepeatVisit}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item name="movementCode" label="机芯型号">
                  <Select
                    showSearch
                    allowClear
                    placeholder="选择或搜索机芯"
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
                      (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    onChange={handleMovementChange}
                    options={movementOptions.map((m) => ({
                      label: `${m.brand} ${m.code} - ${m.caliber}`,
                      value: m.code
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="movementSerialNumber" label="机芯序列号">
                  <Input placeholder="（可选）" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="priority" label="优先级">
                  <Radio.Group
                    optionType="button"
                    buttonStyle="solid"
                    options={[
                      { label: '普通', value: 'normal' },
                      { label: '加急', value: 'urgent' },
                      { label: '特快', value: 'express' }
                    ]}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="intakeDate"
                  label="进店日期"
                  rules={[{ required: true, message: '请选择日期' }]}
                  initialValue={dayjs()}
                >
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="estimatedDeliveryDate" label="预计交付日期">
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="warrantyMonths"
                  label="质保期（月）"
                  initialValue={12}
                >
                  <Select
                    options={[
                      { label: '12个月', value: 12 },
                      { label: '24个月', value: 24 }
                    ]}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={24}>
                <Form.Item
                  name="problemDescription"
                  label="故障描述"
                  rules={[{ required: true, message: '请描述故障情况' }]}
                >
                  <TextArea
                    rows={3}
                    placeholder="详细描述客户反映的问题：如走时不准、偷停、进水、日历不跳、自动陀异响等..."
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="customerNotes" label="客户特殊要求">
                  <TextArea
                    rows={2}
                    placeholder="如：保留原包装、更换蓝宝石镜面、不要抛光表壳等"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="deposit" label="预收押金（元）" initialValue={0}>
                  <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
                </Form.Item>
              </Col>
            </Row>

            {movementDetail && (
              <Alert
                type="info"
                showIcon
                message={
                  <Space>
                    <ClockCircleOutlined />
                    <strong>{movementDetail.brand} {movementDetail.code}</strong>
                    频率：{movementDetail.frequency}bph
                    宝石数：{movementDetail.jewelCount}钻
                    动力储存：{movementDetail.powerReserveHours}h
                    标准工时：{movementDetail.standardLaborHours}h
                  </Space>
                }
                description={
                  <>
                    <div style={{ marginTop: 8 }}>
                      <Text strong>常见故障：</Text>
                      {movementDetail.commonFailures.join('、')}
                    </div>
                    <div>
                      <Text strong>标准日差：</Text>
                      {movementDetail.standardRate}s/d
                      <Text strong style={{ marginLeft: 16 }}>标准振幅：</Text>
                      {movementDetail.standardAmplitude}°
                    </div>
                  </>
                }
                style={{ marginTop: 16 }}
              />
            )}

            <Divider />
            <Space>
              <Button onClick={() => setStep(0)}>上一步</Button>
              <Button type="primary" onClick={() => setStep(2)}>
                下一步
              </Button>
            </Space>
          </Form>
        )}

        {step === 2 && (
          <div>
            <Alert
              type="info"
              showIcon
              message="拍照要求"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>表盘正面（正常走时状态）</li>
                  <li>表壳侧颜（含表冠和计时按钮）</li>
                  <li>表壳背面（序列号位置）</li>
                  <li>表带状况（含扣具）</li>
                  <li>有损伤的部位特写</li>
                </ul>
              }
              style={{ marginBottom: 24 }}
            />

            <Dragger
              multiple
              listType="picture-card"
              accept="image/*"
              beforeUpload={() => false}
              onChange={({ fileList }) => {
                handleImageUpload(fileList);
              }}
              showUploadList={false}
              style={{ marginBottom: 24 }}
            >
              <p className="ant-upload-drag-icon">
                <CameraOutlined style={{ fontSize: 48, color: '#1677ff' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽照片到此处上传</p>
              <p className="ant-upload-hint">
                支持 JPG、PNG、WEBP 格式，每张自动压缩至 3MB 以内
              </p>
            </Dragger>

            <div className="image-upload-container">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid #d9d9d9'
                  }}
                >
                  <img
                    src={img.url}
                    alt=""
                    style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4
                    }}
                  >
                    <Button
                      size="small"
                      danger
                      type="primary"
                      onClick={() =>
                        setImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Divider />
            <Space>
              <Button onClick={() => setStep(1)}>上一步</Button>
              <Button
                type="primary"
                icon={submitting ? undefined : <SaveOutlined />}
                loading={submitting}
                onClick={handleSubmit}
              >
                {submitting ? '正在创建工单...' : '创建工单'}
              </Button>
            </Space>
          </div>
        )}

        {step === 3 && newOrderId !== null && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ marginBottom: 24 }}>
              <CheckCircleOutlined
                style={{ fontSize: 64, color: '#52c41a' }}
              />
            </div>
            <Title level={3} style={{ color: '#52c41a', marginBottom: 8 }}>
              工单创建成功！
            </Title>
            <Paragraph type="secondary">
              工单号已生成，可使用二维码打印贴纸贴于表袋上
            </Paragraph>

            {qrInfo && (
              <div
                style={{
                  display: 'inline-block',
                  padding: 24,
                  background: '#fff',
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  marginTop: 16,
                  marginBottom: 24
                }}
              >
                <QRCode value={qrInfo.url} size={160} />
                <div style={{ marginTop: 12, fontSize: 12, color: '#8c8c8c' }}>
                  扫码查看取件信息
                </div>
              </div>
            )}

            <Space size="middle">
              <Button
                type="primary"
                icon={<InboxOutlined />}
                onClick={() => {
                  setStep(0);
                  form.resetFields();
                  setImages([]);
                  setRepeatInfo(null);
                  setMovementDetail(null);
                  setQrInfo(null);
                  setNewOrderId(null);
                }}
              >
                继续登记新工单
              </Button>
              <Button
                icon={<EyeOutlined />}
                onClick={() => navigate(`/work-orders/${newOrderId}`)}
              >
                查看工单详情
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => navigate('/work-orders')}
              >
                工单列表
              </Button>
            </Space>
          </div>
        )}
      </Card>

      <ScannerModal
        open={showScanner}
        onCancel={() => setShowScanner(false)}
        onSuccess={handleScanSuccess}
      />
    </Space>
  );
};

export default IntakePage;
