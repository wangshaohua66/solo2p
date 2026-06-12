import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Button, message, Typography, Space, Alert, Tag,
  Row, Col, Avatar, Divider, Upload, Progress, Steps, Result, Statistic, Timeline
} from 'antd';
import {
  UserOutlined, PhoneOutlined, MailOutlined, CameraOutlined,
  SafetyCertificateOutlined, CheckCircleOutlined, ClockCircleOutlined,
  CarOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { publicApi } from '@/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

type AnyRecord = Record<string, any>;

const PublicIntakePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [form] = Form.useForm();
  const [images, setImages] = useState<any[]>([]);
  const [orderInfo, setOrderInfo] = useState<AnyRecord | null>(null);
  const [status, setStatus] = useState<'form' | 'submitting' | 'success'>('form');
  const [pickupCode, setPickupCode] = useState('');

  useEffect(() => {
    if (!token) return;

    const loadOrder = async () => {
      try {
        setInitLoading(true);
        const res = await publicApi.getIntake(token);
        if (res.valid && res.mode === 'existing' && res.order) {
          setOrderInfo(res.order as AnyRecord);
          setOrderInfo((prev: AnyRecord | null) => ({
            ...prev,
            statusLabel: res.statusLabel,
            statusDescription: res.statusDescription,
            totalPrice: res.priceInfo?.total ?? 0,
            deposit: res.priceInfo?.deposit ?? 0,
            balance: res.priceInfo?.balance ?? 0,
            isQuoted: res.priceInfo?.isQuoted ?? false,
            pickupCode: res.pickupCode,
            estimatedDate: res.estimatedDate,
            timeline: res.timeline
          }));
        } else {
          message.info(res.message || '无效的二维码，可继续使用自助登记');
        }
      } catch (e: any) {
        message.error(e.response?.data?.message || '加载失败，请刷新重试');
      } finally {
        setInitLoading(false);
      }
    };

    loadOrder();
  }, [token]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setStatus('submitting');
      setLoading(true);

      const payload = {
        ...values,
        caseSerialNumber: values.serial,
        customerName: values.name,
        customerPhone: values.phone,
        customerEmail: values.email,
        images: images.map((f: any) => ({
          base64: f.thumbUrl || f.url,
          fileName: f.name,
          type: 'intake'
        }))
      };

      const res = await publicApi.submitIntake(payload);
      message.success('登记提交成功！');
      setOrderInfo({
        orderNumber: res.orderNumber,
        brand: values.brand,
        model: values.model,
        totalPrice: 0,
        deposit: 0
      });
      setStatus('success');
      setStep(3);
    } catch (e: any) {
      message.error(e.response?.data?.message || '提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPickup = async () => {
    try {
      if (!pickupCode) {
        message.warning('请输入6位取件码');
        return;
      }
      setLoading(true);
      const res = await publicApi.confirmDelivery(token!, pickupCode);
      message.success(res.message);
      setOrderInfo((prev: AnyRecord | null) => ({ ...prev, status: 'delivered', warrantyInfo: res.warrantyInfo }));
    } catch (e: any) {
      message.error(e.response?.data?.error || '取件码不匹配，请重试');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['填写信息', '故障描述', '照片上传', '完成登记'];

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card style={{ maxWidth: 480, textAlign: 'center' }}>
          <Result status="warning" title="无效的链接" subTitle="请使用有效的工单二维码进行扫码登记" />
        </Card>
      </div>
    );
  }

  if (initLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card style={{ textAlign: 'center', minWidth: 320 }}>
          <Space direction="vertical" align="center" size="large">
            <div style={{ fontSize: 48 }}>⌚</div>
            <div>加载中，请稍候...</div>
            <Progress type="dashboard" percent={75} size={80} />
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', padding: 16 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⌚</div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>钟表匠工作室</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>在线自助登记 / 取件查询</div>
        </div>

        {orderInfo && orderInfo.status === 'ready_for_pickup' ? (
          <Card style={{ borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <Result
              status="success"
              icon={<CheckCircleOutlined style={{ fontSize: 64 }} />}
              title={
                <div>
                  <Tag color="green" style={{ fontSize: 16, padding: '6px 16px', marginBottom: 12 }}>✓ 维修已完成，恭候取件</Tag>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{orderInfo.orderNumber}</div>
                </div>
              }
              subTitle={
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#262626', marginBottom: 8 }}>
                    {orderInfo.brand} {orderInfo.model}
                  </div>
                  <Space direction="vertical" size="small" style={{ textAlign: 'left', width: '100%' }}>
                    <Alert type="info" showIcon message={
                      <Space>
                        <ClockCircleOutlined />
                        <span>预计可取时间：<strong>{dayjs(orderInfo.estimatedDate || orderInfo.deliveryDate).format('YYYY年MM月DD日')}</strong></span>
                      </Space>
                    } />
                    <Alert type="success" showIcon message={
                      <Space>
                        <SafetyCertificateOutlined />
                        <span>本次维修提供 <strong>{orderInfo.warrantyInfo?.months || 12} 个月质保服务</strong></span>
                      </Space>
                    } />
                  </Space>
                </div>
              }
            />
            <Divider />
            <Row gutter={[16, 16]}>
              <Col xs={12}>
                <Card size="small" style={{ background: '#f6ffed' }}>
                  <Statistic title="维修费用" value={orderInfo.totalPrice ?? orderInfo.priceInfo?.total} precision={2} prefix="¥" valueStyle={{ color: '#fa8c16' }} />
                </Card>
              </Col>
              <Col xs={12}>
                <Card size="small" style={{ background: '#e6fffb' }}>
                  <Statistic title="已付押金" value={orderInfo.deposit ?? orderInfo.priceInfo?.deposit} precision={2} prefix="¥" valueStyle={{ color: '#52c41a' }} />
                </Card>
              </Col>
            </Row>
            <Alert type="warning" showIcon style={{ marginTop: 16 }} message={
              <div>
                <Text strong style={{ color: '#d46b08' }}>取件时需支付余款：</Text>
                <Text strong style={{ color: '#fa541c', fontSize: 18, marginLeft: 8 }}>
                  ¥{((orderInfo.totalPrice ?? orderInfo.priceInfo?.total ?? 0) - (orderInfo.deposit ?? orderInfo.priceInfo?.deposit ?? 0)).toFixed(2)}
                </Text>
              </div>
            } />

            <Form layout="vertical" style={{ marginTop: 20 }}>
              <Form.Item label="请输入6位取件码">
                <Input.OTP length={6} value={pickupCode} onChange={setPickupCode} style={{ fontSize: 24, justifyContent: 'center' }} />
              </Form.Item>
            </Form>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Button type="primary" size="large" block style={{ height: 48 }} loading={loading} onClick={handleConfirmPickup}>
                {loading ? '确认中...' : <><CarOutlined /> 确认已取件</>}
              </Button>
              <Button size="large" block style={{ marginTop: 8, height: 48 }} ghost onClick={() => setOrderInfo({ ...orderInfo, status: 'show_service' })}>
                查看详细服务报告
              </Button>
            </div>

            {orderInfo.timeline && (
              <>
                <Divider />
                <Title level={5}>维修进度</Title>
                <Timeline
                  items={orderInfo.timeline.map((t: any) => ({
                    color: t.done ? 'green' : 'gray',
                    children: <span style={{ fontWeight: t.done ? 600 : 400, color: t.done ? undefined : '#8c8c8c' }}>{t.label}</span>
                  }))}
                />
              </>
            )}
          </Card>
        ) : orderInfo && orderInfo.statusLabel ? (
          <Card style={{ borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Tag color="blue" style={{ fontSize: 16, padding: '6px 16px', marginBottom: 12 }}>
                {orderInfo.statusLabel}
              </Tag>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{orderInfo.orderNumber}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#262626', marginBottom: 16 }}>
                {orderInfo.brand} {orderInfo.model}
              </div>
              <Alert type="info" showIcon message={orderInfo.statusDescription} style={{ textAlign: 'left' }} />
            </div>

            {orderInfo.estimatedDate && (
              <Alert
                type="info"
                showIcon
                message={
                  <Space>
                    <ClockCircleOutlined />
                    <span>预计完成时间：<strong>{dayjs(orderInfo.estimatedDate).format('YYYY年MM月DD日')}</strong></span>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            {orderInfo.isQuoted && orderInfo.priceInfo && (
              <>
                <Divider />
                <Title level={5}>报价信息</Title>
                <Row gutter={[16, 16]}>
                  <Col xs={8}>
                    <Card size="small" style={{ background: '#f0f5ff', textAlign: 'center' }}>
                      <Statistic title="总费用" value={orderInfo.priceInfo.total} precision={2} prefix="¥" valueStyle={{ fontSize: 18 }} />
                    </Card>
                  </Col>
                  <Col xs={8}>
                    <Card size="small" style={{ background: '#f6ffed', textAlign: 'center' }}>
                      <Statistic title="已付押金" value={orderInfo.priceInfo.deposit} precision={2} prefix="¥" valueStyle={{ fontSize: 18, color: '#52c41a' }} />
                    </Card>
                  </Col>
                  <Col xs={8}>
                    <Card size="small" style={{ background: '#fff7e6', textAlign: 'center' }}>
                      <Statistic title="待支付" value={orderInfo.priceInfo.balance} precision={2} prefix="¥" valueStyle={{ fontSize: 18, color: '#fa8c16' }} />
                    </Card>
                  </Col>
                </Row>
              </>
            )}

            {orderInfo.timeline && (
              <>
                <Divider />
                <Title level={5}>维修进度</Title>
                <Timeline
                  items={orderInfo.timeline.map((t: any) => ({
                    color: t.done ? 'green' : 'gray',
                    children: <span style={{ fontWeight: t.done ? 600 : 400, color: t.done ? undefined : '#8c8c8c' }}>{t.label}</span>
                  }))}
                />
              </>
            )}

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Button size="large" block style={{ height: 48 }} ghost onClick={() => window.location.reload()}>
                刷新最新状态
              </Button>
            </div>
          </Card>
        ) : (
          <Card style={{ borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <Steps
              current={step}
              size="small"
              items={steps.map(t => ({ title: t }))}
              style={{ marginBottom: 32 }}
            />

            {status === 'success' ? (
              <Result
                status="success"
                title="登记提交成功"
                subTitle="我们已收到您的登记信息，工程师将尽快为您检测并联系您确认维修方案。"
                extra={[
                  <Button type="primary" key="close">
                    关闭页面
                  </Button>
                ]}
              />
            ) : (
              <Form form={form} layout="vertical" size="large">
                {step === 0 && (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                      <Title level={5} style={{ marginBottom: 16 }}>
                        <UserOutlined /> 基本信息
                      </Title>
                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item name="name" label="您的姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                            <Input prefix={<UserOutlined />} placeholder="请输入您的姓名" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item name="phone" label="联系电话" rules={[{ required: true, message: '请输入手机号' }]}>
                            <Input prefix={<PhoneOutlined />} placeholder="便于工程师联系您" />
                          </Form.Item>
                        </Col>
                        <Col span={24}>
                          <Form.Item name="email" label="邮箱（接收服务报告）">
                            <Input prefix={<MailOutlined />} placeholder="（可选）报告将发送到此邮箱" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  </Space>
                )}

                {step === 1 && (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                      <Title level={5} style={{ marginBottom: 16 }}>
                        <ClockCircleOutlined /> 腕表信息与故障
                      </Title>
                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item name="brand" label="品牌" rules={[{ required: true, message: '必填' }]}>
                            <Input placeholder="如：劳力士" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item name="model" label="型号（如已知）">
                            <Input placeholder="如：Submariner" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item name="serial" label="序列号（如已知）">
                            <Input placeholder="表壳背后的编号" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item name="purchaseYear" label="购买年份（如已知）">
                            <Input placeholder="约哪一年购买" />
                          </Form.Item>
                        </Col>
                        <Col span={24}>
                          <Form.Item name="problem" label="故障描述" rules={[{ required: true, message: '请描述问题' }]}>
                            <TextArea
                              rows={4}
                              placeholder="详细描述遇到的问题：
例如：走时不准，每天快5分钟
例如：手表进水，玻璃内有雾气
例如：自动陀转动有异响
例如：日历不跳或跳不准..."
                            />
                          </Form.Item>
                        </Col>
                        <Col span={24}>
                          <Form.Item name="notes" label="其他备注/特殊要求">
                            <TextArea rows={2} placeholder="如：不要抛光表壳、保留原装零件、需要拍过程照片等" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  </Space>
                )}

                {step === 2 && (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Alert type="info" showIcon message="建议拍照角度" description={
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        <li>表盘正面（清晰可见刻度与指针）</li>
                        <li>表壳侧面与表冠位置</li>
                        <li>表壳背面（如有背透）</li>
                        <li>故障部位特写（如划痕、雾气等）</li>
                      </ul>
                    } style={{ marginBottom: 16 }} />
                    <Dragger
                      multiple
                      listType="picture-card"
                      accept="image/*"
                      beforeUpload={() => false}
                      onChange={({ fileList }) => setImages(fileList)}
                      showUploadList={{ showPreviewIcon: true }}
                      style={{ marginBottom: 16 }}
                    >
                      <div>
                        <CameraOutlined style={{ fontSize: 48, color: '#1677ff' }} />
                        <div style={{ marginTop: 8, fontWeight: 500 }}>点击拍照或选择照片</div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>最多可上传 9 张照片</div>
                      </div>
                    </Dragger>
                    {images.length > 0 && (
                      <Alert type="success" showIcon message={`已上传 ${images.length} 张照片`} />
                    )}
                  </Space>
                )}

                <Divider />
                <div style={{ display: 'flex', justifyContent: step === 0 ? 'flex-end' : 'space-between' }}>
                  {step > 0 && step < 3 && (
                    <Button size="large" onClick={() => setStep(s => s - 1)}>
                      上一步
                    </Button>
                  )}
                  {step < 2 && (
                    <Button type="primary" size="large" onClick={() => setStep(s => s + 1)}>
                      下一步
                    </Button>
                  )}
                  {step === 2 && (
                    <Button type="primary" size="large" icon={loading ? undefined : <CheckCircleOutlined />} loading={loading} onClick={handleSubmit}>
                      {loading ? '提交中...' : '提交登记'}
                    </Button>
                  )}
                </div>
              </Form>
            )}
          </Card>
        )}

        <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
          © {dayjs().format('YYYY')} 钟表匠工作室 · 专业腕表服务 · 客服热线 400-888-9999
        </div>
      </div>
    </div>
  );
};

export default PublicIntakePage;
