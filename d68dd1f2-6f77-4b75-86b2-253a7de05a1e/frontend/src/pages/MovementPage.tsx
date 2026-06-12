import React, { useState, useEffect } from 'react';
import {
  Card, Input, Select, Row, Col, Tag, Typography, Button, Space, List,
  Empty, Divider, Descriptions, Drawer, Tabs, Alert, Progress, Avatar,
  Collapse, Steps, message, Badge
} from 'antd';
import {
  SearchOutlined, ClockCircleOutlined, ThunderboltOutlined,
  AlertOutlined, ToolOutlined, DatabaseOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { movementApi } from '@/api';
import type { Movement } from '@/types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const MovementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [keyword, setKeyword] = useState('');
  const [brand, setBrand] = useState<string | undefined>();
  const [brands, setBrands] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Movement | null>(null);

  useEffect(() => { loadBrands(); }, []);
  useEffect(() => { loadList(); }, [page, keyword, brand]);

  const loadBrands = async () => {
    try { setBrands(await movementApi.allBrands()); } catch {}
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await movementApi.list({ keyword, brand, page, pageSize });
      setList(res.data); setTotal(res.total);
    } finally { setLoading(false); }
  };

  const openDetail = async (m: Movement) => {
    setSelected(m);
    setDetailOpen(true);
    try {
      if (!m.serviceSteps) {
        setSelected(await movementApi.get(m.id));
      }
    } catch {}
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <Title level={4} style={{ margin: 0 }}>
            <DatabaseOutlined /> 机芯知识库
            <Tag color="purple" style={{ marginLeft: 8, fontSize: 14 }}>收录 {total} 款机芯</Tag>
          </Title>
          <Space>
            <Select
              style={{ width: 200 }}
              placeholder="筛选品牌"
              allowClear
              value={brand}
              onChange={v => { setBrand(v); setPage(1); }}
              showSearch
            >
              {brands.map(b => <Option key={b} value={b}>{b}</Option>)}
            </Select>
            <Input
              style={{ width: 280 }}
              placeholder="搜索机芯型号/编号/口径"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={() => { setPage(1); loadList(); }}
              allowClear
            />
          </Space>
        </div>

        {loading && list.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}><Progress type="circle" percent={30} /></div>
        ) : list.length === 0 ? (
          <Empty description="未找到匹配的机芯" />
        ) : (
          <Row gutter={[16, 16]}>
            {list.map(m => (
              <Col xs={24} sm={12} lg={8} xl={6} key={m.id}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => openDetail(m)}
                  style={{ cursor: 'pointer', borderLeft: `4px solid #722ed1` }}
                  bodyStyle={{ padding: 16 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>{m.brand}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#722ed1' }}>{m.code}</div>
                    </div>
                    <Avatar size={36} style={{ backgroundColor: '#722ed1', fontWeight: 700 }}>
                      {m.jewelCount}
                    </Avatar>
                  </div>
                  <div style={{ fontSize: 13, color: '#595959', marginBottom: 8 }}>{m.caliber}</div>
                  <Row gutter={[8, 8]}>
                    <Col span={12}>
                      <Space size={4} style={{ fontSize: 12, color: '#8c8c8c' }}>
                        <ThunderboltOutlined /> {m.frequency}bph
                      </Space>
                    </Col>
                    <Col span={12}>
                      <Space size={4} style={{ fontSize: 12, color: '#8c8c8c' }}>
                        <ClockCircleOutlined /> {m.powerReserveHours}h
                      </Space>
                    </Col>
                    <Col span={24}>
                      <Space size={4} style={{ fontSize: 12, color: '#8c8c8c' }}>
                        <ToolOutlined /> 标准工时 {m.standardLaborHours}h
                      </Space>
                    </Col>
                  </Row>
                  {m.commonFailures && m.commonFailures.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      {m.commonFailures.slice(0, 2).map((f, i) => (
                        <Tag key={i} color="orange" style={{ fontSize: 11, marginBottom: 4 }}>{f}</Tag>
                      ))}
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Space>
            <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
            <Tag>第 {page} 页</Tag>
            <Button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total}>下一页</Button>
          </Space>
        </div>
      </Card>

      <Drawer
        title={selected ? `${selected.brand} ${selected.code}` : ''}
        width={640}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        extra={<Button type="primary">应用到工单</Button>}
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card size="small" style={{ borderLeft: '4px solid #722ed1' }}>
              <Row align="middle" gutter={16}>
                <Col flex="auto">
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>{selected.brand}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#722ed1' }}>{selected.code}</div>
                  <div style={{ fontSize: 14, color: '#595959', marginTop: 4 }}>{selected.caliber}</div>
                </Col>
                <Col>
                  <Avatar size={72} style={{ backgroundColor: '#722ed1', fontSize: 24, fontWeight: 700 }}>
                    {selected.jewelCount}💎
                  </Avatar>
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>宝石轴承</div>
                </Col>
              </Row>
              <Divider style={{ margin: '16px 0' }} />
              <Row gutter={[16, 16]}>
                <Col xs={12}>
                  <Card size="small" style={{ textAlign: 'center', background: '#f9f0ff' }}>
                    <ThunderboltOutlined style={{ fontSize: 24, color: '#722ed1' }} />
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{selected.frequency}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>振荡频率 (bph)</div>
                  </Card>
                </Col>
                <Col xs={12}>
                  <Card size="small" style={{ textAlign: 'center', background: '#e6fffb' }}>
                    <ClockCircleOutlined style={{ fontSize: 24, color: '#13c2c2' }} />
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{selected.powerReserveHours}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>动力储存 (小时)</div>
                  </Card>
                </Col>
              </Row>
            </Card>

            <Card size="small" title={<Space><InfoCircleOutlined /> 出厂标准参数</Space>}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="标准振幅">{selected.standardAmplitude}°</Descriptions.Item>
                <Descriptions.Item label="标准日差">{selected.standardRate} s/d</Descriptions.Item>
                <Descriptions.Item label="标准工时">{selected.standardLaborHours} 小时</Descriptions.Item>
                <Descriptions.Item label="建议工费">¥{(selected.standardLaborHours * 300).toLocaleString()}</Descriptions.Item>
              </Descriptions>
            </Card>

            {selected.serviceSteps && selected.serviceSteps.length > 0 && (
              <Card size="small" title={<Space><Steps /> 标准保养流程</Space>}>
                <Steps
                  direction="vertical"
                  size="small"
                  current={selected.serviceSteps.length}
                  items={selected.serviceSteps.map((step, i) => ({
                    title: <span style={{ fontWeight: 500 }}>步骤 {i + 1}</span>,
                    description: <span style={{ color: '#595959' }}>{step}</span>,
                    status: 'finish' as const
                  }))}
                />
              </Card>
            )}

            {selected.commonFailures && selected.commonFailures.length > 0 && (
              <Card size="small" title={<Space><AlertOutlined style={{ color: '#fa8c16' }} /> 常见故障与维修建议</Space>}>
                <List
                  size="small"
                  dataSource={selected.commonFailures}
                  renderItem={item => (
                    <List.Item>
                      <Badge color="orange" />
                      <span style={{ marginLeft: 8 }}>{item}</span>
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {selected.recommendedParts && selected.recommendedParts.length > 0 && (
              <Card size="small" title={<Space><ToolOutlined /> 易损件建议库存</Space>}>
                <Row gutter={[8, 8]}>
                  {selected.recommendedParts.map((p, i) => (
                    <Col key={i}>
                      <Tag color="purple" style={{ padding: '6px 12px', fontSize: 13 }}>{p}</Tag>
                    </Col>
                  ))}
                </Row>
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </Space>
  );
};

export default MovementPage;
