import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Button, Space, Row, Col, Descriptions, Tag, Divider, Typography,
  Table, message, Progress, QRCode, Alert, List, Image, Empty, Modal, Input
} from 'antd';
import {
  PrinterOutlined, DownloadOutlined, SendOutlined, ReloadOutlined,
  ArrowLeftOutlined, CheckCircleOutlined, FileTextOutlined,
  SafetyCertificateOutlined, CameraOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import dayjs from 'dayjs';
import { workOrderApi } from '@/api';
import type { WorkOrder } from '@/types';
import { STATUS_COLOR, STATUS_LABEL } from '@/types';

const { Title, Text, Paragraph } = Typography;

const ReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const reportRef = useRef<HTMLDivElement>(null);

  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  useEffect(() => { loadOrder(); }, [id]);

  const loadOrder = async () => {
    setLoading(true);
    try { setOrder(await workOrderApi.get(Number(id))); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const handleGeneratePDF = async () => {
    if (!order || !reportRef.current) return;
    setGenerating(true);
    message.loading({ content: '正在生成 PDF...', key: 'pdf' });

    try {
      const element = reportRef.current;
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(element, {
        scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff'
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      let heightLeft = imgHeight;
      let position = 0;

      const imgData = canvas.toDataURL('image/webp', 0.92);
      pdf.addImage(imgData, 'WEBP', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'WEBP', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${order.orderNumber}-服务报告.pdf`);
      message.success({ content: 'PDF 生成成功', key: 'pdf' });
    } catch (e) {
      console.error(e);
      message.error({ content: '生成失败，请重试', key: 'pdf' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!order) return;
    const email = emailInput || order.customer?.email;
    if (!email) { message.warning('请输入收件邮箱'); return; }
    setSending(true);
    try {
      await workOrderApi.sendReportEmail(order.id, email);
      message.success('报告已发送至 ' + email);
      setEmailModalOpen(false);
      setEmailInput('');
    } catch {
      message.error('发送失败');
    } finally { setSending(false); }
  };

  if (loading) return <Card style={{ textAlign: 'center', padding: 60 }}><Progress type="circle" percent={40} /></Card>;
  if (!order) return <Card><Empty description="工单不存在" /><div style={{ textAlign: 'center' }}><Button onClick={() => navigate('/work-orders')}>返回</Button></div></Card>;

  const partTotal = order.partUsages?.reduce((s, p) => s + p.unitPrice * p.quantity, 0) || 0;
  const imagesBefore = order.images?.filter(i => i.type === 'intake') || [];
  const imagesAfter = order.images?.filter(i => i.type === 'after') || [];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space size="middle">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/work-orders/${order.id}`)}>返回工单</Button>
            <Title level={4} style={{ margin: 0 }}><FileTextOutlined /> 服务报告预览
              <Tag color={STATUS_COLOR[order.status]} style={{ marginLeft: 8 }}>{STATUS_LABEL[order.status]}</Tag>
            </Title>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadOrder}>刷新数据</Button>
            <Button icon={<SendOutlined />} onClick={() => { setEmailInput(order.customer?.email || ''); setEmailModalOpen(true); }}>邮件发送</Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>打印</Button>
            <Button type="primary" icon={<DownloadOutlined />} loading={generating} onClick={handleGeneratePDF}>
              下载 PDF
            </Button>
          </Space>
        </div>
      </Card>

      <div ref={reportRef} style={{ background: '#fff', padding: 0 }}>
        <div className="report-content" style={{ maxWidth: 800, margin: '0 auto', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="report-header">
            <Row align="middle" justify="space-between">
              <Col>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 40 }}>⌚</div>
                  <div>
                    <Title level={2} style={{ margin: 0, color: '#1677ff' }}>钟表匠工作室</Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>MASTER HOROLOGER WORKSHOP · 专业腕表保养与维修</Text>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 8 }}>
                  地址：上海市黄浦区南京西路 1266 号恒隆广场 L2-28A &nbsp;|&nbsp; 电话：400-888-9999 &nbsp;|&nbsp; 邮箱：service@horologer.cn
                </div>
              </Col>
              <Col style={{ textAlign: 'right' }}>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6, display: 'inline-block', textAlign: 'center' }}>
                  <QRCode value={`https://app.horologer.cn/verify/${order.orderNumber}`} size={80} />
                  <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 4 }}>扫码验证真伪</div>
                </div>
              </Col>
            </Row>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Title level={3} style={{ margin: 0, letterSpacing: 2 }}>
              — 维 修 服 务 报 告 —
            </Title>
            <Tag color="blue" style={{ marginTop: 8, padding: '4px 16px', fontSize: 14 }}>
              工单号：{order.orderNumber}
            </Tag>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              报告编号：SR-{dayjs(order.intakeDate).format('YYYYMM')}-{String(order.id).padStart(6, '0')}
              &nbsp;&nbsp;生成时间：{dayjs().format('YYYY-MM-DD HH:mm')}
            </div>
          </div>

          <div className="report-section">
            <div className="report-section-title">客户信息</div>
            <Descriptions column={2} bordered size="small" labelStyle={{ width: 100, background: '#fafafa', fontWeight: 500 }}>
              <Descriptions.Item label="客户姓名">{order.customer?.name}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{order.customer?.phone}</Descriptions.Item>
              <Descriptions.Item label="邮箱地址">{order.customer?.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="历史工单">{order.customer?.totalOrders || 1} 次</Descriptions.Item>
            </Descriptions>
          </div>

          <div className="report-section">
            <div className="report-section-title">腕表信息</div>
            <Descriptions column={2} bordered size="small" labelStyle={{ width: 100, background: '#fafafa', fontWeight: 500 }}>
              <Descriptions.Item label="品牌"><strong>{order.brand}</strong></Descriptions.Item>
              <Descriptions.Item label="型号"><strong>{order.model}</strong></Descriptions.Item>
              <Descriptions.Item label="表壳序列号">{order.caseSerialNumber}</Descriptions.Item>
              <Descriptions.Item label="机芯型号">{order.movementCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="机芯序列号">{order.movementSerialNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={STATUS_COLOR[order.status]}>{STATUS_LABEL[order.status]}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </div>

          <div className="report-section">
            <div className="report-section-title">服务周期</div>
            <Descriptions column={2} bordered size="small" labelStyle={{ width: 100, background: '#fafafa', fontWeight: 500 }}>
              <Descriptions.Item label="进店日期">{dayjs(order.intakeDate).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="预计交付">
                {order.estimatedDeliveryDate ? dayjs(order.estimatedDeliveryDate).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="完成日期">
                {order.actualDeliveryDate ? dayjs(order.actualDeliveryDate).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="维修周期">
                {order.actualDeliveryDate
                  ? `${dayjs(order.actualDeliveryDate).diff(order.intakeDate, 'day')} 个工作日`
                  : `已进行 ${dayjs().diff(order.intakeDate, 'day')} 天`}
              </Descriptions.Item>
            </Descriptions>
          </div>

          <div className="report-section">
            <div className="report-section-title">故障描述与服务内容</div>
            <Card size="small" style={{ background: '#fafafa' }}>
              <div style={{ marginBottom: 12 }}>
                <Text strong>客户反馈：</Text>
                <Paragraph style={{ margin: '4px 0 0' }}>{order.problemDescription || '无'}</Paragraph>
              </div>
              {order.customerNotes && (
                <div>
                  <Text strong>特殊要求：</Text>
                  <Paragraph style={{ margin: '4px 0 0' }}>{order.customerNotes}</Paragraph>
                </div>
              )}
            </Card>
          </div>

          {order.inspection && (
            <div className="report-section">
              <div className="report-section-title">机芯检测数据</div>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>振频</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{order.inspection.frequency || '-'}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>bph</div>
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>振幅</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{order.inspection.amplitude || '-'}°</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>升角</div>
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>日差</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: parseFloat(order.inspection.rate || '999') > 10 ? '#fa541c' : '#52c41a' }}>
                      {order.inspection.rate || '-'}
                    </div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>秒/天</div>
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>位差</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{order.inspection.beatError || '-'}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>毫秒</div>
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>动力储存</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{order.inspection.powerReserve || '-'}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>小时</div>
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>防水测试</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{order.inspection.waterResistance || '-'}</div>
                  </Card>
                </Col>
              </Row>
              {order.inspection.notes && (
                <Alert type="info" showIcon message="检测备注" description={order.inspection.notes} style={{ marginTop: 16 }} />
              )}
            </div>
          )}

          {order.partUsages && order.partUsages.length > 0 && (
            <div className="report-section">
              <div className="report-section-title">更换配件清单</div>
              <Table
                size="small"
                dataSource={order.partUsages}
                pagination={false}
                rowKey="id"
                bordered
                columns={[
                  { title: '序号', width: 60, render: (_: any, __: any, i: number) => i + 1 },
                  { title: '配件名称', dataIndex: ['part', 'name'] },
                  { title: 'SKU', dataIndex: ['part', 'sku'], width: 120, render: v => <Text code style={{ fontSize: 11 }}>{v}</Text> },
                  { title: '数量', dataIndex: 'quantity', width: 70, align: 'center' },
                  { title: '单价(¥)', dataIndex: 'unitPrice', width: 90, align: 'right' },
                  { title: '小计(¥)', width: 100, align: 'right', render: (_: any, r: any) => (r.unitPrice * r.quantity).toFixed(2) },
                  { title: '批次号', dataIndex: 'batchNumber', width: 100, render: v => v || '-' }
                ]}
              />
            </div>
          )}

          <div className="report-section">
            <div className="report-section-title">费用明细</div>
            <Table
              size="small"
              pagination={false}
              bordered
              dataSource={[
                { item: '工时服务费（机芯保养/维修）', qty: 1, price: order.laborPrice },
                ...(order.partUsages?.map(p => ({ item: `配件：${p.part?.name}`, qty: p.quantity, price: p.unitPrice })) || []),
                ...(order.serviceItems?.filter(s => s.type !== 'part').map(s => ({
                  item: `${s.type === 'labor' ? '工时' : '其他'}：${s.name}`, qty: s.quantity, price: s.unitPrice
                })) || [])
              ]}
              rowKey={(r, i) => i as number}
              columns={[
                { title: '项目', dataIndex: 'item' },
                { title: '数量', dataIndex: 'qty', width: 70, align: 'center' },
                { title: '单价(¥)', dataIndex: 'price', width: 100, align: 'right', render: v => v.toFixed(2) },
                { title: '金额(¥)', width: 110, align: 'right', render: (_: any, r: any) => (r.qty * r.price).toFixed(2) }
              ]}
              summary={pageData => {
                const subtotal = pageData.reduce((s, r: any) => s + r.qty * r.price, 0);
                return (
                  <>
                    <Table.Summary.Row>
                      <Table.Summary.Cell colSpan={3} index={0} align="right"><strong>应收总额</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#fa8c16' }}>¥{subtotal.toFixed(2)}</span>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                    {order.deposit > 0 && (
                      <Table.Summary.Row style={{ background: '#f6ffed' }}>
                        <Table.Summary.Cell colSpan={3} index={0} align="right"><strong style={{ color: '#389e0d' }}>已收押金</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <span style={{ color: '#389e0d', fontWeight: 600 }}>-¥{order.deposit.toFixed(2)}</span>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    )}
                    {order.deposit < subtotal && (
                      <Table.Summary.Row style={{ background: '#fff7e6' }}>
                        <Table.Summary.Cell colSpan={3} index={0} align="right"><strong style={{ color: '#d46b08' }}>取件时应付</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#fa541c' }}>¥{(subtotal - order.deposit).toFixed(2)}</span>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    )}
                  </>
                );
              }}
            />
          </div>

          {(imagesBefore.length > 0 || imagesAfter.length > 0) && (
            <div className="report-section">
              <div className="report-section-title">维修前后对比图</div>
              <Row gutter={16}>
                <Col xs={12}>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8, textAlign: 'center' }}>
                    <CameraOutlined /> 维修前
                  </div>
                  {imagesBefore.length > 0 ? (
                    <Image.PreviewGroup>
                      <Row gutter={[8, 8]}>
                        {imagesBefore.slice(0, 4).map(img => (
                          <Col xs={12} key={img.id}>
                            <Image width="100%" height={120} style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #eee' }} src={img.url} />
                          </Col>
                        ))}
                      </Row>
                    </Image.PreviewGroup>
                  ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无照片" />}
                </Col>
                <Col xs={12}>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8, textAlign: 'center' }}>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} /> 维修后
                  </div>
                  {imagesAfter.length > 0 ? (
                    <Image.PreviewGroup>
                      <Row gutter={[8, 8]}>
                        {imagesAfter.slice(0, 4).map(img => (
                          <Col xs={12} key={img.id}>
                            <Image width="100%" height={120} style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #eee' }} src={img.url} />
                          </Col>
                        ))}
                      </Row>
                    </Image.PreviewGroup>
                  ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无照片" />}
                </Col>
              </Row>
            </div>
          )}

          {order.warranty && (
            <div className="report-section">
              <div className="report-section-title">质保条款</div>
              <Card size="small" style={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e6fffb 100%)', border: '1px solid #91caff' }}>
                <Row align="middle" gutter={[16, 16]}>
                  <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
                    <SafetyCertificateOutlined style={{ fontSize: 64, color: '#1677ff' }} />
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#1677ff', marginTop: 4 }}>{order.warranty.months}</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>个月官方质保</div>
                  </Col>
                  <Col xs={24} sm={18}>
                    <Paragraph style={{ margin: 0, lineHeight: 1.8, fontSize: 13 }}>
                      <Text strong>质保期：</Text>自 {dayjs(order.warranty.startDate).format('YYYY年MM月DD日')} 至 {dayjs(order.warranty.endDate).format('YYYY年MM月DD日')}<br />
                      <Text strong>质保范围：</Text>本次维修涉及的机芯零件与人工服务，非人为损坏（如进水、摔碰、自行开盖等）均在质保范围内。<br />
                      <Text strong>质保服务：</Text>质保期内凭此报告及工单编号可享免费返修服务，到期前60天将通过短信和邮件提醒保养。
                    </Paragraph>
                  </Col>
                </Row>
              </Card>
            </div>
          )}

          <div className="report-section">
            <div className="report-section-title">签署确认</div>
            <Row gutter={32}>
              <Col xs={12} style={{ textAlign: 'center' }}>
                <div style={{ height: 60, borderBottom: '1px dashed #bfbfbf', marginBottom: 8, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>客户签名 / Customer Signature</Text>
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>日期：____________</div>
              </Col>
              <Col xs={12} style={{ textAlign: 'center' }}>
                <div style={{ height: 60, borderBottom: '1px dashed #bfbfbf', marginBottom: 8, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>制表师签名 / Watchmaker Signature</Text>
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>日期：{dayjs().format('YYYY-MM-DD')}</div>
              </Col>
            </Row>
          </div>

          <Divider />
          <div style={{ textAlign: 'center', fontSize: 11, color: '#bfbfbf', lineHeight: 1.8 }}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} /> 本报告由钟表匠工作室系统自动生成，数据真实有效<br />
            报告编号可扫描二维码或访问官网 www.horologer.cn 在线验证真伪<br />
            © {dayjs().format('YYYY')} 钟表匠工作室 · 匠心传承 · 制表艺术
          </div>
        </div>
      </div>

      <Modal
        title="发送服务报告邮件"
        open={emailModalOpen}
        onCancel={() => setEmailModalOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setEmailModalOpen(false)}>取消</Button>
            <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={handleSendEmail}>
              发送邮件
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert type="info" showIcon message="将发送 PDF 附件报告" description="收件人将收到包含完整服务报告的 PDF 邮件，请确认邮箱地址正确。" />
          <div>
            <Text strong>收件邮箱：</Text>
            <Input
              placeholder="email@example.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              style={{ marginTop: 8 }}
              prefix={<SendOutlined />}
            />
          </div>
        </Space>
      </Modal>
    </Space>
  );
};

export default ReportPage;
