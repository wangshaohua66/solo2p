import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Select, Space, Drawer, Form, DatePicker,
  Row, Col, Statistic, Tree, Typography, Descriptions, Input, App as AntdApp,
} from 'antd';
import {
  ReloadOutlined, SearchOutlined, FileTextOutlined,
  SafetyCertificateOutlined, LinkOutlined, CopyrightOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useAppDispatch, useAppSelector } from '@/store';
import { authLinkAPI } from '@/api';
import type { AuthLink, Brand, Work, AuthType } from '@/types';
import { BrandNames, AuthTypeNames, AuthStatusNames } from '@/types';

const { Title, Text } = Typography;
const { Option } = Select;

interface AuthLinkWithWork extends AuthLink {
  work_title: string;
  work_brand: Brand;
  work_isrc: string;
}

const Copyright: React.FC = () => {
  const { message } = AntdApp.useApp();
  const dispatch = useAppDispatch();
  const { artists } = useAppSelector((s) => s.work);
  const { user } = useAppSelector((s) => s.app);

  const [list, setList] = useState<AuthLinkWithWork[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentLink, setCurrentLink] = useState<AuthLinkWithWork | null>(null);
  const [filter, setFilter] = useState({
    page: 1,
    page_size: 20,
    brand: '' as Brand | '',
    auth_type: '' as AuthType | '',
    keyword: '',
  });

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await authLinkAPI.list({
        page: filter.page,
        page_size: filter.page_size,
        brand: filter.brand || undefined,
        auth_type: filter.auth_type || undefined,
        keyword: filter.keyword || undefined,
      });
      const data = (res.data as any);
      setList(data.data || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [filter.page, filter.page_size, filter.brand, filter.auth_type, filter.keyword]);

  const getAuthTypeColor = (type: AuthType) => {
    switch (type) {
      case 'original': return 'gold';
      case 'adapt': return 'blue';
      case 'sample': return 'red';
      case 'cover': return 'green';
      case 'remix': return 'purple';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      case 'expired': return 'default';
      default: return 'default';
    }
  };

  const stats = [
    { label: '总授权链数', value: total, icon: <LinkOutlined />, color: '#D4AF37' },
    { label: '原创作品', value: list.filter(l => l.auth_type === 'original').length, icon: <SafetyCertificateOutlined />, color: '#52c41a' },
    { label: '改编授权', value: list.filter(l => l.auth_type === 'adapt').length, icon: <FileTextOutlined />, color: '#1890ff' },
    { label: '采样授权', value: list.filter(l => l.auth_type === 'sample').length, icon: <CopyrightOutlined />, color: '#ff4d4f' },
  ];

  const trendChart = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['原创', '改编', '采样', '翻唱', '混音'], top: 0, textStyle: { color: '#D4AF37' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月'],
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { color: '#aaa' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { color: '#aaa' },
      splitLine: { lineStyle: { color: '#222' } },
    },
    series: [
      { name: '原创', type: 'bar', stack: 'total', data: [12, 15, 18, 14, 20, 22], itemStyle: { color: '#D4AF37' } },
      { name: '改编', type: 'bar', stack: 'total', data: [5, 8, 6, 10, 7, 9], itemStyle: { color: '#1890ff' } },
      { name: '采样', type: 'bar', stack: 'total', data: [3, 4, 5, 6, 5, 7], itemStyle: { color: '#ff4d4f' } },
      { name: '翻唱', type: 'bar', stack: 'total', data: [8, 10, 12, 9, 11, 14], itemStyle: { color: '#52c41a' } },
      { name: '混音', type: 'bar', stack: 'total', data: [2, 3, 4, 3, 5, 6], itemStyle: { color: '#722ed1' } },
    ],
  };

  const treeData = currentLink ? [{
    title: (
      <Space>
        <SafetyCertificateOutlined style={{ color: '#D4AF37' }} />
        <span>{currentLink.work_title}</span>
        <Tag color="gold">ISRC: {currentLink.work_isrc}</Tag>
      </Space>
    ),
    key: currentLink.work_id,
    children: currentLink.parent_work_id ? [{
      title: (
        <Space>
          <LinkOutlined style={{ color: '#1890ff' }} />
          <span>上游作品: {currentLink.parent_title}</span>
          <Tag color={getAuthTypeColor(currentLink.auth_type)}>
            {AuthTypeNames[currentLink.auth_type]}
          </Tag>
        </Space>
      ),
      key: currentLink.parent_work_id,
    }] : [],
  }] : [];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        {stats.map((s, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card className="stat-card" style={{ borderLeft: `4px solid ${s.color}` }}>
              <Statistic
                title={<span style={{ color: '#aaa' }}>{s.label}</span>}
                value={s.value}
                valueStyle={{ color: s.color }}
                prefix={React.cloneElement(s.icon, { style: { color: s.color } })}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        className="gold-card"
        style={{ marginTop: 16 }}
        title={
          <Space>
            <CopyrightOutlined style={{ color: '#D4AF37' }} />
            <span>版权链追溯</span>
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="品牌"
              allowClear
              style={{ width: 120 }}
              value={filter.brand || undefined}
              onChange={(v) => setFilter({ ...filter, brand: v || '', page: 1 })}
            >
              {Object.entries(BrandNames).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
            <Select
              placeholder="授权类型"
              allowClear
              style={{ width: 140 }}
              value={filter.auth_type || undefined}
              onChange={(v) => setFilter({ ...filter, auth_type: v || '', page: 1 })}
            >
              {Object.entries(AuthTypeNames).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
            <Input.Search
              placeholder="搜索作品名/ISRC"
              allowClear
              style={{ width: 240 }}
              onSearch={(v) => setFilter({ ...filter, keyword: v, page: 1 })}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchList}>刷新</Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          columns={[
            { title: '作品名', dataIndex: 'work_title', key: 'work_title', width: 180 },
            { title: '品牌', dataIndex: 'work_brand', key: 'work_brand', width: 100, render: (v: Brand) => <Tag color="gold">{BrandNames[v]}</Tag> },
            { title: 'ISRC', dataIndex: 'work_isrc', key: 'work_isrc', width: 140 },
            { title: '授权类型', dataIndex: 'auth_type', key: 'auth_type', width: 100, render: (v: AuthType) => <Tag color={getAuthTypeColor(v)}>{AuthTypeNames[v]}</Tag> },
            { title: '授权状态', dataIndex: 'auth_status', key: 'auth_status', width: 100, render: (v: string) => <Tag color={getStatusColor(v)}>{AuthStatusNames[v as keyof typeof AuthStatusNames] || v}</Tag> },
            { title: '上游作品', dataIndex: 'parent_title', key: 'parent_title', width: 160, render: (v) => v || '-' },
            { title: '授权方式', dataIndex: 'license_type', key: 'license_type', width: 100, render: (v) => v || '-' },
            { title: '授权日期', dataIndex: 'auth_date', key: 'auth_date', width: 120, render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
            { title: '到期日期', dataIndex: 'expire_date', key: 'expire_date', width: 120, render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '永久' },
            { title: '费用(元)', dataIndex: 'fee', key: 'fee', width: 100, render: (v) => v ? `¥${v.toFixed(2)}` : '-' },
            {
              title: '操作', key: 'action', width: 100,
              render: (_, record) => (
                <Button type="link" size="small" onClick={() => {
                  setCurrentLink(record as AuthLinkWithWork);
                  setDetailVisible(true);
                }}>
                  查看详情
                </Button>
              ),
            },
          ]}
          pagination={{
            current: filter.page,
            pageSize: filter.page_size,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (page, pageSize) => setFilter({ ...filter, page, page_size: pageSize }),
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card className="gold-card" title={<Space><FileTextOutlined style={{ color: '#D4AF37' }} /><span>授权类型月度分布</span></Space>}>
            <ReactECharts option={trendChart} notMerge lazyUpdate style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="gold-card" title={<Space><SafetyCertificateOutlined style={{ color: '#D4AF37' }} /><span>授权状态概览</span></Space>}>
            <Row gutter={[16, 16]} style={{ padding: 16 }}>
              <Col span={12}>
                <Card size="small" style={{ background: 'rgba(82, 196, 26, 0.1)', border: '1px solid #52c41a' }}>
                  <Statistic
                    title={<span style={{ color: '#aaa' }}>已授权</span>}
                    value={list.filter(l => l.auth_status === 'approved').length}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ background: 'rgba(250, 173, 20, 0.1)', border: '1px solid #faad14' }}>
                  <Statistic
                    title={<span style={{ color: '#aaa' }}>待审核</span>}
                    value={list.filter(l => l.auth_status === 'pending').length}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ background: 'rgba(255, 77, 79, 0.1)', border: '1px solid #ff4d4f' }}>
                  <Statistic
                    title={<span style={{ color: '#aaa' }}>已拒绝</span>}
                    value={list.filter(l => l.auth_status === 'rejected').length}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ background: 'rgba(140, 140, 140, 0.1)', border: '1px solid #8c8c8c' }}>
                  <Statistic
                    title={<span style={{ color: '#aaa' }}>已过期</span>}
                    value={list.filter(l => l.auth_status === 'expired' || (l.expire_date && dayjs(l.expire_date).isBefore(dayjs()))).length}
                    valueStyle={{ color: '#8c8c8c' }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Drawer
        title={
          <Space>
            <LinkOutlined style={{ color: '#D4AF37' }} />
            <span>授权链详情</span>
          </Space>
        }
        width={720}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentLink && (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="作品名">{currentLink.work_title}</Descriptions.Item>
              <Descriptions.Item label="品牌">{BrandNames[currentLink.work_brand]}</Descriptions.Item>
              <Descriptions.Item label="ISRC">{currentLink.work_isrc}</Descriptions.Item>
              <Descriptions.Item label="授权类型">
                <Tag color={getAuthTypeColor(currentLink.auth_type)}>
                  {AuthTypeNames[currentLink.auth_type]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="授权状态">
                <Tag color={getStatusColor(currentLink.auth_status)}>
                  {AuthStatusNames[currentLink.auth_status as keyof typeof AuthStatusNames] || currentLink.auth_status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="授权方式">{currentLink.license_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="上游作品">{currentLink.parent_title || '-'}</Descriptions.Item>
              <Descriptions.Item label="授权费用">{currentLink.fee ? `¥${currentLink.fee.toFixed(2)}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="授权日期">{currentLink.auth_date ? dayjs(currentLink.auth_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
              <Descriptions.Item label="到期日期">{currentLink.expire_date ? dayjs(currentLink.expire_date).format('YYYY-MM-DD') : '永久'}</Descriptions.Item>
              <Descriptions.Item label="授权文档" span={2}>
                {currentLink.auth_doc_url ? (
                  <a href={currentLink.auth_doc_url} target="_blank" rel="noreferrer">{currentLink.auth_doc_url}</a>
                ) : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Card
              size="small"
              className="gold-card"
              title={<Space><LinkOutlined style={{ color: '#D4AF37' }} /><span>授权关系树</span></Space>}
            >
              {currentLink.parent_work_id ? (
                <Tree
                  showLine
                  defaultExpandAll
                  treeData={treeData}
                />
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>
                  <SafetyCertificateOutlined style={{ fontSize: 48, color: '#D4AF37' }} />
                  <div style={{ marginTop: 8 }}>原始创作 - 无上游授权</div>
                </div>
              )}
            </Card>

            {currentLink.note && (
              <Card size="small" style={{ marginTop: 16 }} title="备注">
                <Text type="secondary">{currentLink.note}</Text>
              </Card>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Copyright;
