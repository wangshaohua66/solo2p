import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Tag, Button, Select, Space, Drawer, Modal, Form, DatePicker,
  Row, Col, Statistic, Tabs, List, Typography, App as AntdApp, Descriptions, Divider, Radio, Progress,
  Input as AntInput,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined,
  SendOutlined, FileDoneOutlined, SearchOutlined, SwapOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import ReactECharts from 'echarts-for-react';
import type { ColumnsType } from 'antd/es/table';
import type { EChartsOption } from 'echarts';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchSettlements, fetchSettlementDetail, setFilter, setCurrentSettlement,
  generateSettlement, updateSettlementStatus as updateSettleStatus, compareSettlements,
} from '@/store/royaltySlice';
import { fetchArtists } from '@/store/workSlice';
import { royaltyAPI } from '@/api';
import {
  Settlement, SettlementStatus, SettlementPeriod, Brand, Platform,
  SettlementStatusNames, PeriodNames, BrandNames, PlatformNames, RoleNames,
  ContributorRole,
} from '@/types';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const statusColors: Record<SettlementStatus, string> = {
  draft: '#8B7A4A',
  pending: '#FA8C16',
  approved: '#1890FF',
  paid: '#52C41A',
  rejected: '#FF4D4F',
};

const Royalty: React.FC = () => {
  const dispatch = useAppDispatch();
  const { settlements, total, loading, filter, currentSettlement, comparison } = useAppSelector((s) => s.royalty);
  const { artists } = useAppSelector((s) => s.work);
  const { user } = useAppSelector((s) => s.app);
  const { message, modal } = AntdApp.useApp();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [genForm] = Form.useForm();
  const [compareForm] = Form.useForm();

  useEffect(() => {
    dispatch(fetchSettlements());
    if (artists.length === 0) dispatch(fetchArtists(undefined));
  }, [dispatch, filter.page, filter.page_size, filter.artist_id, filter.status, filter.brand]);

  useEffect(() => {
    if (detailId) {
      dispatch(fetchSettlementDetail(detailId));
    }
  }, [detailId, dispatch]);

  const handleRowClick = (r: Settlement) => {
    setDetailId(r.id);
    dispatch(setCurrentSettlement(r));
    setView('detail');
    setDrawerOpen(true);
  };

  const columns: ColumnsType<Settlement> = [
    {
      title: '艺人',
      dataIndex: 'artist_name',
      key: 'artist',
      width: 160,
      render: (n, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#FFD700' }}>{n}</div>
          <div style={{ fontSize: 11, color: '#8B7A4A' }}>
            {BrandNames[r.brand]} · {PeriodNames[r.period]}
          </div>
        </div>
      ),
    },
    {
      title: '结算周期',
      key: 'period',
      width: 200,
      render: (_, r) => (
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          <div>{dayjs(r.period_start).format('YYYY-MM-DD')} ~ {dayjs(r.period_end).format('YYYY-MM-DD')}</div>
          <div style={{ color: '#8B7A4A' }}>创建: {dayjs(r.created_at).format('YYYY-MM-DD')}</div>
        </div>
      ),
      sorter: (a, b) => dayjs(a.period_start).valueOf() - dayjs(b.period_start).valueOf(),
    },
    {
      title: '总收入',
      dataIndex: 'total_revenue',
      key: 'total',
      width: 140,
      render: (v: number) => (
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#FFD700', fontFamily: 'DIN' }}>
            ¥{v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: '#8B7A4A' }}>
            覆盖 {Object.keys(currentSettlement?.work_breakdown || {}).length} 首作品
          </div>
        </div>
      ),
      align: 'right' as const,
      sorter: (a, b) => a.total_revenue - b.total_revenue,
    },
    {
      title: '平台构成',
      key: 'platforms',
      width: 260,
      render: (_, r) => (
        <PlatformStackBar breakdown={r.platform_breakdown} />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: SettlementStatus) => (
        <Tag color={statusColors[s]} style={{ padding: '2px 10px', fontSize: 12 }}>
          {SettlementStatusNames[s]}
        </Tag>
      ),
      filters: Object.keys(SettlementStatusNames).map((k) => ({
        text: SettlementStatusNames[k as SettlementStatus], value: k,
      })),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" type="link" onClick={() => handleRowClick(r)}>详情</Button>
          {(r.status === 'draft' || r.status === 'rejected') && user?.role !== 'artist' && (
            <Button size="small" type="link" onClick={() => onAction(r, 'submit')}>提交审核</Button>
          )}
          {r.status === 'pending' && (user?.role === 'admin' || user?.role === 'finance') && (
            <>
              <Button size="small" type="link" onClick={() => onAction(r, 'approve')}>通过</Button>
              <Button size="small" type="link" danger onClick={() => onAction(r, 'reject')}>驳回</Button>
            </>
          )}
          {r.status === 'approved' && (user?.role === 'admin' || user?.role === 'finance') && (
            <Button size="small" type="link" onClick={() => onAction(r, 'paid')}>标记发放</Button>
          )}
        </Space>
      ),
    },
  ];

  const onAction = (r: Settlement, action: string) => {
    const label = {
      submit: '提交审核',
      approve: '审核通过',
      reject: '驳回',
      paid: '标记已发放',
    }[action] || action;

    if (action === 'reject') {
      modal.confirm({
        title: `驳回结算单 — ${r.artist_name}`,
        content: (
          <Form>
            <Form.Item label="驳回原因" name="remark" rules={[{ required: true }]}>
              <Input.TextArea rows={3} placeholder="请说明驳回原因，艺人将收到通知" />
            </Form.Item>
          </Form>
        ),
        onOk: async () => {
          try {
            await royaltyAPI.updateSettlementStatus(r.id, 'reject', 'rejected by admin');
            dispatch(updateSettleStatus({ id: r.id, status: 'rejected' }));
            message.success('已驳回');
            dispatch(fetchSettlements());
          } catch (e) { message.error('操作失败'); return Promise.reject(); }
        },
      });
      return;
    }

    modal.confirm({
      title: `确认${label} — ${r.artist_name}`,
      content: (
        <div>
          结算金额 <Text strong style={{ color: '#FFD700' }}>¥{r.total_revenue.toLocaleString()}</Text>
        </div>
      ),
      onOk: async () => {
        try {
          await royaltyAPI.updateSettlementStatus(r.id, action);
          dispatch(updateSettleStatus({
            id: r.id,
            status: action === 'submit' ? 'pending'
              : action === 'approve' ? 'approved'
              : action === 'paid' ? 'paid'
              : (r.status as any),
          }));
          message.success(`${label}成功`);
          dispatch(fetchSettlements());
        } catch (e) { message.error('操作失败'); return Promise.reject(); }
      },
    });
  };

  const handleGenerate = async () => {
    const values = await genForm.validateFields();
    setGenerateModalOpen(false);
    try {
      const result = await dispatch(generateSettlement({
        artist_id: values.artist_id,
        period: values.period,
        ref_date: values.ref_date ? dayjs(values.ref_date).format('YYYY-MM-DD') : undefined,
      })).unwrap();
      message.success('结算单已生成');
      setDetailId(result.id);
      setView('detail');
      setDrawerOpen(true);
    } catch (e: any) {
      message.error(e?.message || '生成失败');
    }
  };

  const handleCompare = async () => {
    const values = await compareForm.validateFields();
    try {
      await dispatch(compareSettlements(values.ids)).unwrap();
      message.success('对比完成');
    } catch (e) {
      message.error('对比失败');
    }
  };

  const paginationConfig = useMemo(() => ({
    current: filter.page,
    pageSize: filter.page_size,
    total,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50'],
    showTotal: (t: number, r: [number, number]) => `${r[0]}-${r[1]} 共 ${t} 条`,
    onChange: (page: number, page_size: number) => dispatch(setFilter({ page, page_size })),
  }), [filter, total, dispatch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <div className="stat-card">
            <div className="stat-label">本期总收入</div>
            <div className="stat-value">
              ¥{settlements.reduce((s, r) => s + (['approved', 'paid'].includes(r.status) ? r.total_revenue : 0), 0).toLocaleString()}
            </div>
            <div className="stat-delta delta-up">
              <CheckCircleOutlined /> 已审核/已发放 {settlements.filter((r) => ['approved', 'paid'].includes(r.status)).length} 单
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div className="stat-card">
            <div className="stat-label">待处理</div>
            <div className="stat-value">
              {settlements.filter((r) => ['draft', 'pending'].includes(r.status)).length}
            </div>
            <div className="stat-delta" style={{ color: '#FA8C16' }}>
              <ClockCircleOutlined /> 待审核: {settlements.filter((r) => r.status === 'pending').length}
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div className="stat-card">
            <div className="stat-label">已发放金额</div>
            <div className="stat-value">
              ¥{settlements.filter((r) => r.status === 'paid').reduce((s, r) => s + r.total_revenue, 0).toLocaleString()}
            </div>
            <div className="stat-delta delta-up">
              <FileDoneOutlined /> 共 {settlements.filter((r) => r.status === 'paid').length} 单已完成
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div className="stat-card">
            <div className="stat-label">涉及艺人</div>
            <div className="stat-value">
              {new Set(settlements.map((r) => r.artist_id)).size}
            </div>
            <div className="stat-delta delta-up">
              <SendOutlined /> 本期累计作品 {settlements.reduce((s, r) => s + Object.keys(r.work_breakdown || {}).length, 0)} 首次
            </div>
          </div>
        </Col>
      </Row>

      <Card className="gold-card" styles={{ body: { padding: '16px 20px' } }}>
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} sm={12} md={4}>
            <Select
              allowClear
              placeholder="子品牌"
              style={{ width: '100%' }}
              value={filter.brand || undefined}
              onChange={(v) => dispatch(setFilter({ brand: (v || '') as Brand, page: 1 }))}
              options={Object.keys(BrandNames).map((k) => ({ value: k, label: BrandNames[k as Brand] }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              allowClear
              placeholder="艺人"
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              value={filter.artist_id || undefined}
              onChange={(v) => dispatch(setFilter({ artist_id: v || '', page: 1 }))}
              options={artists.map((a) => ({ value: a.id, label: `${a.name} - ${BrandNames[a.brand]}` }))}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              allowClear
              placeholder="状态"
              style={{ width: '100%' }}
              value={filter.status || undefined}
              onChange={(v) => dispatch(setFilter({ status: (v || '') as SettlementStatus, page: 1 }))}
              options={Object.keys(SettlementStatusNames).map((k) => ({
                value: k, label: SettlementStatusNames[k as SettlementStatus],
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={10}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button icon={<SwapOutlined />} onClick={() => setCompareModalOpen(true)}>
                对比结算
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => dispatch(fetchSettlements())}>
                刷新
              </Button>
              {(user?.role === 'admin' || user?.role === 'finance') && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { genForm.resetFields(); setGenerateModalOpen(true); }}>
                  生成结算单
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="gold-card" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={settlements}
          loading={loading}
          pagination={paginationConfig}
          scroll={{ x: 1100 }}
          onRow={(r) => ({
            onClick: () => handleRowClick(r),
            style: { cursor: 'pointer' },
          })}
          className="table-to-card"
        />
      </Card>

      <Drawer
        title={
          <Space>
            <Button type="text" onClick={() => { setView('list'); setDrawerOpen(false); }} style={{ color: '#D4AF37' }}>← 返回列表</Button>
            <span className="gold-gradient-text" style={{ fontSize: 18, fontWeight: 700 }}>
              {currentSettlement?.artist_name} 结算详情
            </span>
            <Tag color={statusColors[currentSettlement?.status || 'draft']} style={{ marginLeft: 8 }}>
              {SettlementStatusNames[currentSettlement?.status || 'draft']}
            </Tag>
          </Space>
        }
        placement="right"
        width={900}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {currentSettlement && (
          <SettlementDetailView settlement={currentSettlement} />
        )}
      </Drawer>

      <Modal
        title={<span className="gold-gradient-text" style={{ fontSize: 18, fontWeight: 700 }}>生成结算单</span>}
        open={generateModalOpen}
        onCancel={() => setGenerateModalOpen(false)}
        onOk={handleGenerate}
        okText="开始生成"
        width={520}
      >
        <Form form={genForm} layout="vertical">
          <Form.Item label="结算艺人" name="artist_id" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择艺人"
              options={artists.map((a) => ({ value: a.id, label: `${a.name} - ${BrandNames[a.brand]}` }))}
            />
          </Form.Item>
          <Form.Item label="结算周期类型" name="period" rules={[{ required: true }]} initialValue="monthly">
            <Radio.Group optionType="button" buttonStyle="solid" options={[
              { label: '月度', value: 'monthly' },
              { label: '季度', value: 'quarterly' },
              { label: '年度', value: 'yearly' },
            ]} />
          </Form.Item>
          <Form.Item label="参考日期（用于计算哪一期）" name="ref_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="结算引擎将汇总该艺人周期内全部作品的6平台播放收入，按创作角色拆分分成，生成可审核结算单。"
          />
        </Form>
      </Modal>

      <Modal
        title={<span className="gold-gradient-text" style={{ fontSize: 18, fontWeight: 700 }}>结算单差异对比</span>}
        open={compareModalOpen}
        onCancel={() => setCompareModalOpen(false)}
        onOk={handleCompare}
        okText="生成对比"
        width={560}
      >
        <Form form={compareForm} layout="vertical">
          <Form.Item label="选择要对比的结算单（至少2个）" name="ids" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              placeholder="选择结算单"
              options={settlements.map((s) => ({
                value: s.id,
                label: `${s.artist_name} - ${dayjs(s.period_start).format('YY-MM')} ${PeriodNames[s.period]} (¥${s.total_revenue.toFixed(0)})`,
              }))}
              maxTagCount="responsive"
            />
          </Form.Item>
          {comparison && (
            <Card size="small" title="对比结果（以第一个为基准）" style={{ background: '#151208' }}>
              <Descriptions column={1} size="small" bordered>
                {Object.entries(comparison.diff_map || {}).map(([id, diff]) => (
                  <Descriptions.Item key={id} label={`${settlements.find((s) => s.id === id)?.artist_name || id}`}>
                    <span style={{ color: diff >= 0 ? '#52C41A' : '#FF4D4F', fontWeight: 600 }}>
                      {diff >= 0 ? '+' : ''}¥{diff.toFixed(2)}
                    </span>
                    <div style={{ fontSize: 11, color: '#8B7A4A', marginTop: 4 }}>
                      总额: ¥{(comparison.total_revenue as any)[id]?.toFixed(2)}
                    </div>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          )}
        </Form>
      </Modal>
    </div>
  );
};

const PlatformStackBar: React.FC<{ breakdown: Record<string, number> }> = ({ breakdown }) => {
  const platforms = Object.keys(breakdown) as Platform[];
  const total = platforms.reduce((s, p) => s + (breakdown[p] || 0), 0);
  if (total <= 0) return <Text type="secondary">—</Text>;

  const colors: Record<Platform, string> = {
    netease: '#C20C0C',
    qqmusic: '#31C27C',
    kugou: '#0066CC',
    kuwo: '#FFB800',
    spotify: '#1DB954',
    apple_music: '#FA243C',
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          height: 16,
          borderRadius: 4,
          overflow: 'hidden',
          background: '#151208',
        }}
      >
        {platforms.map((p) => {
          const ratio = (breakdown[p] || 0) / total;
          if (ratio < 0.01) return null;
          return (
            <div
              key={p}
              title={`${PlatformNames[p]}: ¥${(breakdown[p] || 0).toFixed(2)} (${(ratio * 100).toFixed(1)}%)`}
              style={{
                width: `${ratio * 100}%`,
                background: colors[p],
                minWidth: 2,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

const SettlementDetailView: React.FC<{ settlement: Settlement }> = ({ settlement }) => {
  const platforms = Object.keys(settlement.platform_breakdown || {}) as Platform[];

  const roleBreakdown = useMemo(() => {
    const m: Record<ContributorRole, number> = {
      performer: 0, composer: 0, lyricist: 0, arranger: 0, producer: 0,
    };
    (settlement.details || []).forEach((d) => {
      m[d.contributor_role] = (m[d.contributor_role] || 0) + d.contributor_share;
    });
    return m;
  }, [settlement]);

  const stackedBarOption = useMemo<EChartsOption>(() => {
    const roleList = Object.keys(roleBreakdown) as ContributorRole[];
    const works = Array.from(new Set((settlement.details || []).slice(0, 40).map((d) => d.work_title))).slice(0, 8);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#1A170E',
        borderColor: '#3B3218',
        textStyle: { color: '#E8D8A0' },
      },
      legend: {
        data: roleList.map((r) => RoleNames[r]),
        textStyle: { color: '#B8A06A' },
        top: 0,
      },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: {
        type: 'category',
        data: works,
        axisLabel: { color: '#8B7A4A', rotate: 15, fontSize: 11 },
        axisLine: { lineStyle: { color: '#3B3218' } },
      },
      yAxis: {
        type: 'value',
        name: '分成(¥)',
        nameTextStyle: { color: '#8B7A4A' },
        axisLabel: { color: '#8B7A4A', formatter: (v: number) => v.toFixed(0) },
        splitLine: { lineStyle: { color: '#2A2312' } },
      },
      series: roleList.map((role) => ({
        name: RoleNames[role],
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        itemStyle: {
          color: {
            performer: '#FFD700', composer: '#D4AF37', lyricist: '#B8860B',
            arranger: '#722ED1', producer: '#1890FF',
          }[role],
          borderRadius: role === 'producer' ? [4, 4, 0, 0] : [0, 0, 0, 0],
        },
        data: works.map((w) => {
          const v = (settlement.details || [])
            .filter((d) => d.work_title === w && d.contributor_role === role)
            .reduce((s, d) => s + d.contributor_share, 0);
          return Number(v.toFixed(2));
        }),
      })),
    } as EChartsOption;
  }, [settlement, roleBreakdown]);

  const platformPieOption = useMemo<EChartsOption>(() => {
    const colors = ['#C20C0C', '#31C27C', '#0066CC', '#FFB800', '#1DB954', '#FA243C'];
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1A170E',
        borderColor: '#3B3218',
        textStyle: { color: '#E8D8A0' },
        formatter: '{b}: ¥{c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { color: '#B8A06A' },
      },
      series: [{
        type: 'pie',
        radius: ['45%', '72%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#151208', borderWidth: 2 },
        label: { show: false },
        data: platforms.map((p, i) => ({
          value: Number((settlement.platform_breakdown[p] || 0).toFixed(2)),
          name: PlatformNames[p],
          itemStyle: { color: colors[i % colors.length] },
        })).filter((d) => d.value > 0),
      }],
    };
  }, [settlement, platforms]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small" className="gold-card">
            <Descriptions column={4} size="small" bordered labelStyle={{ background: '#1A170E', color: '#8B7A4A', width: 100 }}>
              <Descriptions.Item label="结算艺人">{settlement.artist_name}</Descriptions.Item>
              <Descriptions.Item label="厂牌">{BrandNames[settlement.brand]}</Descriptions.Item>
              <Descriptions.Item label="周期类型">{PeriodNames[settlement.period]}</Descriptions.Item>
              <Descriptions.Item label="生成时间">{dayjs(settlement.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="结算周期" span={2}>
                {dayjs(settlement.period_start).format('YYYY-MM-DD')} ~ {dayjs(settlement.period_end).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="总收入" span={2}>
                <span style={{ color: '#FFD700', fontWeight: 700, fontSize: 20, fontFamily: 'DIN' }}>
                  ¥{settlement.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={24} lg={14}>
          <Card size="small" title={<span style={{ color: '#FFD700' }}>各作品 × 角色分成明细（堆叠柱状图）</span>} className="gold-card">
            <ReactECharts option={stackedBarOption} style={{ height: 320 }} notMerge lazyUpdate />
          </Card>
        </Col>

        <Col span={24} lg={10}>
          <Card size="small" title={<span style={{ color: '#FFD700' }}>平台收入构成</span>} className="gold-card">
            <ReactECharts option={platformPieOption} style={{ height: 320 }} notMerge lazyUpdate />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={<span style={{ color: '#FFD700' }}>创作角色分成汇总</span>} className="gold-card">
        <Row gutter={[16, 16]}>
          {(Object.keys(roleBreakdown) as ContributorRole[]).map((role) => {
            const ratio = settlement.total_revenue > 0 ? roleBreakdown[role] / settlement.total_revenue : 0;
            return (
              <Col xs={24} sm={12} md={8} lg={8} xl={4} key={role}>
                <div style={{ padding: '12px 16px', background: '#151208', borderRadius: 8, border: '1px solid #2A2312' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Tag color="blue">{RoleNames[role]}</Tag>
                    <span style={{ color: '#FFD700', fontWeight: 700, fontFamily: 'DIN' }}>
                      ¥{roleBreakdown[role].toFixed(2)}
                    </span>
                  </div>
                  <Progress
                    percent={Number((ratio * 100).toFixed(1))}
                    showInfo
                    strokeColor={{ from: '#D4AF37', to: '#FFD700' }}
                    trailColor="#231F12"
                    size="small"
                  />
                </div>
              </Col>
            );
          })}
        </Row>
      </Card>

      <Card
        size="small"
        title={<span style={{ color: '#FFD700' }}>逐作品/逐人分成明细</span>}
        className="gold-card"
        extra={<Text type="secondary">共 {(settlement.details || []).length} 条明细，精度至 0.01 元</Text>}
      >
        <Table
          size="small"
          rowKey={(r) => `${r.work_id}_${r.contributor_id}_${r.platform}`}
          dataSource={settlement.details || []}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 900 }}
          className="table-to-card"
          columns={[
            { title: '作品', dataIndex: 'work_title', key: 'work', width: 180 },
            { title: '平台', dataIndex: 'platform', key: 'p', width: 120, render: (p: Platform) => PlatformNames[p] },
            {
              title: '创作人', key: 'c', width: 140,
              render: (_, r) => (
                <Space>
                  <Tag color="blue">{RoleNames[r.contributor_role]}</Tag>
                  <span>{r.contributor_name}</span>
                </Space>
              ),
            },
            {
              title: '作品平台收入', dataIndex: 'platform_revenue', key: 'pr', width: 120, align: 'right',
              render: (v: number) => <span style={{ fontFamily: 'DIN' }}>¥{v.toFixed(2)}</span>,
            },
            {
              title: '分成比例', dataIndex: 'share_rate', key: 'sr', width: 100, align: 'right',
              render: (v: number, r) => (
                <Space direction="vertical" size={0} align="end">
                  <span>{(v * 100).toFixed(1)}%</span>
                  <Tag color="geekblue" style={{ fontSize: 10 }}>
                    {{ fixed: '固定比例', tiered: '阶梯递增', guarantee: '保底+分成' } as any}[r.rule_type]
                  </Tag>
                </Space>
              ),
            },
            {
              title: '该人分成', dataIndex: 'contributor_share', key: 'share', width: 120, align: 'right',
              render: (v: number) => (
                <span style={{ color: '#FFD700', fontWeight: 700, fontFamily: 'DIN' }}>¥{v.toFixed(2)}</span>
              ),
            },
          ]}
        />
      </Card>

      {settlement.remark && (
        <Card size="small" className="gold-card">
          <Text type="secondary">备注：</Text>
          <span style={{ marginLeft: 8 }}>{settlement.remark}</span>
        </Card>
      )}
    </div>
  );
};

const Alert: React.FC<{ type: 'info' | 'success' | 'warning' | 'error'; showIcon?: boolean; message: React.ReactNode }> = (props) => {
  const colors: Record<string, { bg: string; border: string; color: string; icon: string }> = {
    info: { bg: 'rgba(24,144,255,0.08)', border: 'rgba(24,144,255,0.3)', color: '#1890FF', icon: 'ℹ' },
    success: { bg: 'rgba(82,196,26,0.08)', border: 'rgba(82,196,26,0.3)', color: '#52C41A', icon: '✓' },
    warning: { bg: 'rgba(250,140,22,0.08)', border: 'rgba(250,140,22,0.3)', color: '#FA8C16', icon: '⚠' },
    error: { bg: 'rgba(255,77,79,0.08)', border: 'rgba(255,77,79,0.3)', color: '#FF4D4F', icon: '✕' },
  };
  const c = colors[props.type];
  return (
    <div style={{
      padding: '10px 14px', background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 8, color: c.color, fontSize: 13, lineHeight: 1.7,
    }}>
      {props.showIcon && <span style={{ marginRight: 8, fontSize: 16 }}>{c.icon}</span>}
      {props.message}
    </div>
  );
};

const Input = { TextArea: (props: any) => {
  return <AntInput.TextArea {...props} />;
} };

export default Royalty;
