import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Row, Col, Table, Tag, Button, Input, Select, Space, Modal, Drawer,
  Form, Upload, Timeline, Tree, Progress, App as AntdApp, Divider, Badge, Descriptions, List, Typography,
  Statistic,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, UploadOutlined, ReloadOutlined,
  FileTextOutlined, LinkOutlined, HistoryOutlined, PlayCircleOutlined,
  DiffOutlined, CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchWorks, fetchWorkDetail, fetchArtists, setFilter, updateWorkStatus as updateStatusAction, setCurrentWork } from '@/store/workSlice';
import {
  Work, WorkStatus, WorkType, Brand, WorkStatusNames, WorkTypeNames,
  BrandNames, RoleNames, ContributorRole, AuthType, AuthStatus,
} from '@/types';
import { workAPI } from '@/api';
import { DataNode } from 'antd/es/tree';

const { Text, Title } = Typography;

const statusColors: Record<WorkStatus, string> = {
  demo: '#8B7A4A',
  arranging: '#1890FF',
  mixing: '#722ED1',
  mastering: '#EB2F96',
  reviewing: '#FA8C16',
  released: '#52C41A',
};

const authTypeColors: Record<AuthType, string> = {
  original: '#52C41A',
  adapt: '#1890FF',
  sample: '#722ED1',
  cover: '#FA8C16',
  remix: '#EB2F96',
};

const authStatusColors: Record<AuthStatus, string> = {
  pending: '#FA8C16',
  approved: '#52C41A',
  rejected: '#FF4D4F',
  expired: '#8B7A4A',
};

const WorkContributorsBadge: React.FC<{ contributors?: any[] }> = ({ contributors }) => {
  if (!contributors || contributors.length === 0) return <Text type="secondary">-</Text>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {contributors.slice(0, 3).map((c) => (
        <Tag key={c.id} color="geekblue" style={{ margin: 0 }}>
          {RoleNames[c.role as ContributorRole]}·{c.artist_name}
        </Tag>
      ))}
      {contributors.length > 3 && (
        <Tag style={{ margin: 0 }}>+{contributors.length - 3}</Tag>
      )}
    </div>
  );
};

const FormatDuration: React.FC<{ seconds: number }> = ({ seconds }) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return <span>{m}:{s.toString().padStart(2, '0')}</span>;
};

const Works: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, total, loading, filter, currentWork, artists } = useAppSelector((s) => s.work);
  const { message, modal } = AntdApp.useApp();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'versions' | 'auth'>('info');
  const [form] = Form.useForm();
  const [authForm] = Form.useForm();

  const [versionA, setVersionA] = useState<string | null>(null);
  const [versionB, setVersionB] = useState<string | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareResult, setCompareResult] = useState<any>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchWorks());
    dispatch(fetchArtists(undefined));
  }, [dispatch, filter.page, filter.page_size, filter.brand, filter.status, filter.type, filter.keyword]);

  const handleRowClick = async (record: Work) => {
    await dispatch(fetchWorkDetail(record.id));
    setDetailTab('info');
    setVersionA(null);
    setVersionB(null);
    setCompareResult(null);
    setDrawerOpen(true);
  };

  const handleCompareVersions = async () => {
    if (!versionA || !versionB || !currentWork) {
      message.warning('请选择两个版本进行对比');
      return;
    }
    if (versionA === versionB) {
      message.warning('请选择两个不同的版本');
      return;
    }
    setCompareLoading(true);
    try {
      const res = await workAPI.compareVersions(currentWork.id, versionA, versionB);
      setCompareResult((res.data as any).data || res.data);
      setCompareModalOpen(true);
    } catch (e: any) {
      message.error('版本对比失败');
    } finally {
      setCompareLoading(false);
    }
  };

  const columns: ColumnsType<Work> = [
    {
      title: '作品',
      dataIndex: 'title',
      key: 'title',
      width: 220,
      fixed: 'left' as const,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#FFD700', fontSize: 14 }}>
            <PlayCircleOutlined style={{ color: '#D4AF37', marginRight: 8 }} />
            {r.title}
          </div>
          <div style={{ fontSize: 11, color: '#8B7A4A', marginTop: 2 }}>
            {r.isrc} · ISWC {r.iswc}
          </div>
        </div>
      ),
    },
    {
      title: '厂牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 100,
      render: (b: Brand) => <Tag color="gold">{BrandNames[b]}</Tag>,
      filters: Object.keys(BrandNames).map((k) => ({ text: BrandNames[k as Brand], value: k })),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (t: WorkType) => WorkTypeNames[t],
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: WorkStatus) => (
        <Badge color={statusColors[s]} text={<span style={{ fontSize: 12 }}>{WorkStatusNames[s]}</span>} />
      ),
      filters: Object.keys(WorkStatusNames).map((k) => ({ text: WorkStatusNames[k as WorkStatus], value: k })),
    },
    {
      title: '创作人员',
      dataIndex: 'contributors',
      key: 'contributors',
      width: 260,
      render: (c) => <WorkContributorsBadge contributors={c} />,
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (s) => <FormatDuration seconds={s} />,
    },
    {
      title: '授权链',
      dataIndex: 'auth_chain',
      key: 'auth',
      width: 100,
      render: (c) => (
        c && c.length > 0 ? (
          <Space>
            <LinkOutlined style={{ color: '#1890FF' }} />
            <Tag color={c.some((l: any) => l.auth_status !== 'approved') ? 'orange' : 'green'}>
              {c.length} 项
            </Tag>
          </Space>
        ) : <Tag>原创</Tag>
      ),
    },
    {
      title: '版本数',
      key: 'versions',
      width: 80,
      render: (_, r) => (
        <Space>
          <HistoryOutlined />
          <span>{r.versions?.length || 0}</span>
        </Space>
      ),
    },
    {
      title: '发行/更新',
      dataIndex: 'updated_at',
      key: 'updated',
      width: 160,
      render: (_, r) => (
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          <div>更新 {dayjs(r.updated_at).format('YY-MM-DD')}</div>
          {r.release_date && (
            <div style={{ color: '#52C41A' }}>发行 {dayjs(r.release_date).format('YY-MM-DD')}</div>
          )}
        </div>
      ),
      sorter: (a, b) => dayjs(a.updated_at).valueOf() - dayjs(b.updated_at).valueOf(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_, r) => (
        <Space size="small">
          <Button
            size="small"
            type="link"
            onClick={(e) => { e.stopPropagation(); openStatusModal(r); }}
          >
            推进状态
          </Button>
          <Button
            size="small"
            type="link"
            onClick={(e) => { e.stopPropagation(); dispatch(setCurrentWork(r)); setUploadModalOpen(true); }}
          >
            上传版本
          </Button>
          <Button
            size="small"
            type="link"
            onClick={(e) => { e.stopPropagation(); handleRowClick(r); }}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  const openStatusModal = (record: Work) => {
    const transitions: Record<WorkStatus, WorkStatus[]> = {
      demo: ['arranging'],
      arranging: ['mixing', 'demo'],
      mixing: ['mastering', 'arranging'],
      mastering: ['reviewing', 'mixing'],
      reviewing: ['released', 'mastering'],
      released: [],
    };
    const options = [record.status, ...(transitions[record.status] || [])];
    modal.confirm({
      title: `推进状态 — ${record.title}`,
      content: (
        <div>
          <div style={{ marginBottom: 12 }}>当前状态：
            <Badge color={statusColors[record.status]} style={{ marginLeft: 8 }} />
            <span style={{ marginLeft: 4 }}>{WorkStatusNames[record.status]}</span>
          </div>
          <Form form={form} layout="vertical">
            <Form.Item name="status" label="目标状态" rules={[{ required: true }]} initialValue={record.status}>
              <Select options={options.map((o) => ({ value: o, label: WorkStatusNames[o as WorkStatus] }))} />
            </Form.Item>
            <Form.Item name="note" label="变更备注">
              <Input.TextArea rows={2} placeholder="说明变更原因（可选）" />
            </Form.Item>
          </Form>
        </div>
      ),
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        const values = await form.validateFields();
        try {
          await workAPI.updateStatus(record.id, values.status, values.note);
          dispatch(updateStatusAction({ id: record.id, status: values.status }));
          message.success('状态已更新');
          dispatch(fetchWorks());
        } catch (e: any) {
          message.error(e?.response?.data?.message || '更新失败');
          return Promise.reject();
        }
      },
    });
  };

  const handleCreateWork = async () => {
    const values = await form.validateFields();
    try {
      await workAPI.create(values);
      message.success('作品已创建');
      setCreateModalOpen(false);
      form.resetFields();
      dispatch(fetchWorks());
    } catch (e: any) {
      message.error(e?.response?.data?.message || '创建失败');
      return Promise.reject();
    }
  };

  const handleUploadVersion = (options: any) => {
    const { file, onSuccess, onError } = options;
    if (!currentWork) {
      onError?.(new Error('no work selected'));
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('version', form.getFieldValue('version') || '');
    formData.append('note', form.getFieldValue('note') || '');
    workAPI.uploadVersion(currentWork.id, formData)
      .then(() => { onSuccess?.('ok'); dispatch(fetchWorkDetail(currentWork.id)); message.success('版本上传成功'); })
      .catch((err) => { onError?.(err); message.error('上传失败'); });
  };

  const handleCreateAuth = async () => {
    if (!currentWork) return;
    const values = await authForm.validateFields();
    try {
      await workAPI.createAuthLink(currentWork.id, values);
      message.success('授权链已添加');
      setAuthModalOpen(false);
      authForm.resetFields();
      dispatch(fetchWorkDetail(currentWork.id));
    } catch (e: any) {
      message.error(e?.response?.data?.message || '添加失败');
      return Promise.reject();
    }
  };

  const authTreeData = useMemo<DataNode[]>(() => {
    if (!currentWork) return [];
    const children: DataNode[] = (currentWork.auth_chain || []).map((link, i) => ({
      key: `link-${i}`,
      icon: <LinkOutlined />,
      title: (
        <div className="auth-tree-node" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Tag color={authTypeColors[link.auth_type]}>
            {({ original: '原创', adapt: '改编', sample: '采样', cover: '翻唱', remix: 'Remix' } as any)[link.auth_type]}
          </Tag>
          <Text strong>{link.parent_title}</Text>
          <Tag color={authStatusColors[link.auth_status]}>
            {({ pending: '待审核', approved: '已授权', rejected: '被拒绝', expired: '已过期' } as any)[link.auth_status]}
          </Tag>
          {link.fee > 0 && <Text type="secondary">授权费 ¥{link.fee.toLocaleString()}</Text>}
        </div>
      ),
    }));
    return [{
      key: 'root',
      title: (
        <div className="auth-tree-node" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Tag color="#52C41A">当前作品</Tag>
          <Text strong style={{ color: '#FFD700' }}>{currentWork.title}</Text>
        </div>
      ),
      children,
    }];
  }, [currentWork]);

  const paginationConfig = useMemo<TableProps<Work>['pagination']>(() => ({
    current: filter.page,
    pageSize: filter.page_size,
    total,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    showTotal: (t, range) => `${range[0]}-${range[1]} 共 ${t} 条`,
    onChange: (page, pageSize) => dispatch(setFilter({ page, page_size: pageSize })),
  }), [filter.page, filter.page_size, total, dispatch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card className="gold-card" styles={{ body: { padding: '16px 20px' } }}>
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} sm={12} md={6} lg={4}>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="子品牌"
              value={filter.brand || undefined}
              onChange={(v) => dispatch(setFilter({ brand: (v || '') as Brand, page: 1 }))}
              options={Object.keys(BrandNames).map((k) => ({ value: k, label: BrandNames[k as Brand] }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="制作状态"
              value={filter.status || undefined}
              onChange={(v) => dispatch(setFilter({ status: (v || '') as WorkStatus, page: 1 }))}
              options={Object.keys(WorkStatusNames).map((k) => ({ value: k, label: WorkStatusNames[k as WorkStatus] }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="作品类型"
              value={filter.type || undefined}
              onChange={(v) => dispatch(setFilter({ type: (v || '') as WorkType, page: 1 }))}
              options={Object.keys(WorkTypeNames).map((k) => ({ value: k, label: WorkTypeNames[k as WorkType] }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={8}>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#D4AF37' }} />}
              placeholder="搜索作品标题 / 艺人"
              value={filter.keyword}
              onChange={(e) => dispatch(setFilter({ keyword: e.target.value, page: 1 }))}
              onPressEnter={() => dispatch(fetchWorks())}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={24} md={24} lg={4}>
            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button icon={<ReloadOutlined />} onClick={() => dispatch(fetchWorks())}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateModalOpen(true); }}>
                登记作品
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="gold-card" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          pagination={paginationConfig}
          scroll={{ x: 1300 }}
          onRow={(r) => ({
            onClick: () => handleRowClick(r),
            style: { cursor: 'pointer' },
          })}
          className="table-to-card"
        />
      </Card>

      <Drawer
        title={
          <div>
            <span className="gold-gradient-text" style={{ fontSize: 20, fontWeight: 700 }}>{currentWork?.title}</span>
            <Tag color={statusColors[currentWork?.status || 'demo']} style={{ marginLeft: 12 }}>
              {WorkStatusNames[currentWork?.status || 'demo']}
            </Tag>
          </div>
        }
        placement="right"
        width={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => { dispatch(setCurrentWork(currentWork)); setAuthModalOpen(true); }} icon={<LinkOutlined />}>
              添加授权
            </Button>
            <Button onClick={() => { dispatch(setCurrentWork(currentWork)); setUploadModalOpen(true); }} icon={<UploadOutlined />}>
              上传版本
            </Button>
          </Space>
        }
      >
        {currentWork && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #2A2312', paddingBottom: 12 }}>
              {(['info', 'versions', 'auth'] as const).map((tab) => (
                <Button
                  key={tab}
                  type={detailTab === tab ? 'primary' : 'default'}
                  onClick={() => setDetailTab(tab)}
                  icon={tab === 'info' ? <FileTextOutlined /> : tab === 'versions' ? <HistoryOutlined /> : <LinkOutlined />}
                >
                  {tab === 'info' ? '作品信息' : tab === 'versions' ? `版本时间线 (${currentWork.versions?.length || 0})` : `授权链 (${currentWork.auth_chain?.length || 0})`}
                </Button>
              ))}
            </div>

            {detailTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Descriptions
                  column={2}
                  bordered
                  labelStyle={{ width: 110, background: '#1A170E', color: '#8B7A4A' }}
                  size="small"
                >
                  <Descriptions.Item label="ISRC">{currentWork.isrc}</Descriptions.Item>
                  <Descriptions.Item label="ISWC">{currentWork.iswc}</Descriptions.Item>
                  <Descriptions.Item label="厂牌">{BrandNames[currentWork.brand]}</Descriptions.Item>
                  <Descriptions.Item label="类型">{WorkTypeNames[currentWork.type]}</Descriptions.Item>
                  <Descriptions.Item label="风格">{currentWork.genre}</Descriptions.Item>
                  <Descriptions.Item label="时长"><FormatDuration seconds={currentWork.duration} /></Descriptions.Item>
                  <Descriptions.Item label="创作时间">{dayjs(currentWork.created_at).format('YYYY-MM-DD')}</Descriptions.Item>
                  <Descriptions.Item label="发行时间">
                    {currentWork.release_date ? dayjs(currentWork.release_date).format('YYYY-MM-DD') : '—'}
                  </Descriptions.Item>
                </Descriptions>

                <Card size="small" title={<span style={{ color: '#FFD700' }}>创作人员与分成</span>} className="gold-card">
                  <List
                    size="small"
                    dataSource={currentWork.contributors || []}
                    renderItem={(c) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%',
                              background: 'linear-gradient(135deg,#D4AF37,#8B6914)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#151208', fontWeight: 700,
                            }}>
                              {c.artist_name.charAt(0)}
                            </div>
                          }
                          title={<span style={{ color: '#E8D8A0' }}>{c.artist_name}</span>}
                          description={
                            <Space>
                              <Tag color="blue">{RoleNames[c.role]}</Tag>
                              <Text type="secondary">规则ID: {c.royalty_rule_id}</Text>
                            </Space>
                          }
                        />
                        <div style={{ color: '#FFD700', fontWeight: 600 }}>
                          默认 {(
                            { performer: 35, composer: 25, lyricist: 20, arranger: 12, producer: 8 } as any
                          )[c.role]}%
                        </div>
                      </List.Item>
                    )}
                  />
                </Card>
              </div>
            )}

            {detailTab === 'versions' && (
              <div>
                <Card size="small" className="gold-card" style={{ marginBottom: 16 }}
                  title={<Space><DiffOutlined style={{ color: '#D4AF37' }} /><span>版本对比</span></Space>}
                  extra={
                    <Space>
                      <Tag color="red">A版</Tag>
                      <Select
                        placeholder="选择版本A"
                        style={{ width: 180 }}
                        value={versionA || undefined}
                        onChange={(v) => setVersionA(v)}
                      >
                        {(currentWork.versions || []).map((v) => (
                          <Select.Option key={v.id} value={v.id}>版本 {v.version} - {dayjs(v.created_at).format('MM-DD HH:mm')}</Select.Option>
                        ))}
                      </Select>
                      <Tag color="blue">B版</Tag>
                      <Select
                        placeholder="选择版本B"
                        style={{ width: 180 }}
                        value={versionB || undefined}
                        onChange={(v) => setVersionB(v)}
                      >
                        {(currentWork.versions || []).map((v) => (
                          <Select.Option key={v.id} value={v.id}>版本 {v.version} - {dayjs(v.created_at).format('MM-DD HH:mm')}</Select.Option>
                        ))}
                      </Select>
                      <Button
                        type="primary"
                        icon={<DiffOutlined />}
                        loading={compareLoading}
                        onClick={handleCompareVersions}
                        disabled={!versionA || !versionB}
                      >
                        对比差异
                      </Button>
                      {(versionA || versionB) && (
                        <Button icon={<CloseOutlined />} onClick={() => { setVersionA(null); setVersionB(null); }}>
                          清空
                        </Button>
                      )}
                    </Space>
                  }
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    选择两个版本，点击"对比差异"查看元数据、音频属性的详细差异对比
                  </Text>
                </Card>
                <Timeline
                  className="version-timeline"
                  mode="left"
                  items={(currentWork.versions || []).map((v) => ({
                    color: statusColors[v.status],
                    label: <Text type="secondary">{dayjs(v.created_at).format('YYYY-MM-DD HH:mm')}</Text>,
                    children: (
                      <div style={{ padding: '8px 12px', background: '#1A170E', borderRadius: 8, border: '1px solid #2A2312' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Space>
                            <span style={{ fontWeight: 600, fontSize: 15, color: '#FFD700' }}>版本 {v.version}</span>
                            <Badge color={statusColors[v.status]} />
                            <span style={{ fontSize: 12 }}>{WorkStatusNames[v.status]}</span>
                            {versionA === v.id && <Tag color="red">A版</Tag>}
                            {versionB === v.id && <Tag color="blue">B版</Tag>}
                          </Space>
                          <Space>
                            <Button
                              size="small"
                              type={versionA === v.id ? 'primary' : 'default'}
                              onClick={() => setVersionA(v.id)}
                            >
                              设为A
                            </Button>
                            <Button
                              size="small"
                              type={versionB === v.id ? 'primary' : 'default'}
                              onClick={() => setVersionB(v.id)}
                            >
                              设为B
                            </Button>
                            <Button type="link" icon={<PlayCircleOutlined />}>试听</Button>
                          </Space>
                        </div>
                        <WaveformVisualizer seed={v.audio_fingerprint} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#8B7A4A' }}>
                          <span>{(v.file_size / 1024 / 1024).toFixed(1)} MB</span>
                          <span>指纹: {v.audio_fingerprint.slice(0, 16)}...</span>
                        </div>
                        {v.note && <div style={{ marginTop: 6, padding: '6px 8px', background: '#231F12', borderRadius: 4, fontSize: 12 }}>📝 {v.note}</div>}
                      </div>
                    ),
                  }))}
                />
              </div>
            )}

            {detailTab === 'auth' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Card size="small" title={<span style={{ color: '#FFD700' }}>授权链溯源（树形）</span>} className="gold-card">
                  <Tree showLine showIcon defaultExpandAll treeData={authTreeData} />
                </Card>
                <Card size="small" title={<span style={{ color: '#FFD700' }}>授权链校验结果</span>} className="gold-card">
                  {(currentWork.auth_chain || []).every((l) => l.auth_status === 'approved') || (currentWork.auth_chain?.length || 0) === 0 ? (
                    <div style={{ padding: 16, background: 'rgba(82,196,26,0.08)', borderRadius: 8, border: '1px solid rgba(82,196,26,0.25)' }}>
                      <Space>
                        <div style={{ color: '#52C41A', fontSize: 32 }}>✓</div>
                        <div>
                          <div style={{ color: '#52C41A', fontWeight: 600, fontSize: 16 }}>
                            {(currentWork.auth_chain?.length || 0) === 0 ? '原创作品，无需授权' : '全部授权项已完成'}
                          </div>
                          <div style={{ color: '#8B7A4A', fontSize: 12, marginTop: 4 }}>可合法发行，无版权风险</div>
                        </div>
                      </Space>
                    </div>
                  ) : (
                    <div style={{ padding: 16, background: 'rgba(250,140,22,0.08)', borderRadius: 8, border: '1px solid rgba(250,140,22,0.25)' }}>
                      <Space align="start">
                        <div style={{ color: '#FA8C16', fontSize: 32 }}>⚠</div>
                        <div>
                          <div style={{ color: '#FA8C16', fontWeight: 600, fontSize: 16 }}>存在未完成的授权项</div>
                          <div style={{ color: '#8B7A4A', fontSize: 12, marginTop: 4 }}>
                            建议完成全部授权后再发行：
                            {(currentWork.auth_chain || [])
                              .filter((l) => l.auth_status !== 'approved')
                              .map((l) => ` ${l.parent_title}(${l.auth_status})`)
                              .join('，')}
                          </div>
                        </div>
                      </Space>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </Drawer>

      <Modal
        title={<span className="gold-gradient-text" style={{ fontSize: 18, fontWeight: 700 }}>登记新作品</span>}
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateWork}
        okText="确认创建"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="title" label="作品标题" rules={[{ required: true, message: '请输入标题' }]}>
                <Input placeholder="例如：午夜星河" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="type" label="类型" rules={[{ required: true }]} initialValue="single">
                <Select options={Object.keys(WorkTypeNames).map((k) => ({ value: k, label: WorkTypeNames[k as WorkType] }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="brand" label="归属子品牌" rules={[{ required: true }]} initialValue="brand_a">
                <Select options={Object.keys(BrandNames).map((k) => ({ value: k, label: BrandNames[k as Brand] }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="genre" label="音乐风格">
                <Input placeholder="如：民谣 / 摇滚 / 电子" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="isrc" label="ISRC 编码">
                <Input placeholder="CN-A01-24-00001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="iswc" label="ISWC 编码">
                <Input placeholder="T-000.00000-0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="创作人员"
            name="contributors"
            rules={[{ required: true, message: '至少指定一位创作人员' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择创作人员（支持多选）"
              optionLabelProp="label"
              options={artists.map((a) => ({
                value: JSON.stringify({ artist_id: a.id, artist_name: a.name }),
                label: `${a.name} - ${BrandNames[a.brand]}`,
              }))}
              style={{ width: '100%' }}
              onChange={(vals) => {
                const parsed = vals.map((v: string) => {
                  try { const o = JSON.parse(v); return { artist_id: o.artist_id, artist_name: o.artist_name }; }
                  catch { return { artist_id: v, artist_name: v }; }
                });
                form.setFieldsValue({ contributors: parsed });
              }}
              labelInValue
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span className="gold-gradient-text" style={{ fontSize: 18, fontWeight: 700 }}>上传新版本</span>}
        open={uploadModalOpen}
        onCancel={() => setUploadModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="版本号" name="version" initialValue={`v${(currentWork?.versions?.length || 0) + 1}.0`}>
            <Input placeholder="v1.0 / v1.1 / 母带版 ..." />
          </Form.Item>
          <Form.Item label="音频文件" name="file" rules={[{ required: true }]}>
            <Upload
              customRequest={handleUploadVersion}
              maxCount={1}
              accept="audio/*"
            >
              <Button icon={<UploadOutlined />} block>
                点击选择 WAV / FLAC / MP3 文件
              </Button>
            </Upload>
          </Form.Item>
          <Form.Item label="版本说明" name="note">
            <Input.TextArea rows={3} placeholder="本次迭代做了哪些调整（如：调整低频、更新人声、母带处理）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span className="gold-gradient-text" style={{ fontSize: 18, fontWeight: 700 }}>添加授权链节点</span>}
        open={authModalOpen}
        onCancel={() => setAuthModalOpen(false)}
        onOk={handleCreateAuth}
        okText="确认添加"
      >
        <Form form={authForm} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="auth_type" label="授权类型" rules={[{ required: true }]} initialValue="cover">
                <Select options={[
                  { value: 'cover', label: '翻唱 Cover' },
                  { value: 'adapt', label: '改编 Adapt' },
                  { value: 'sample', label: '采样 Sample' },
                  { value: 'remix', label: 'Remix 再创作' },
                  { value: 'original', label: '原始引用' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="license_type" label="授权方式" initialValue="标准授权">
                <Select options={['标准授权', '独家授权', '分成授权', '一次性买断', '免费授权'].map((o) => ({ value: o, label: o }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="parent_title" label="被引用作品名称" rules={[{ required: true }]}>
            <Input placeholder="原作品标题" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="fee" label="授权费用 (¥)" initialValue={0}>
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="auth_doc_url" label="授权文件链接">
                <Input placeholder="扫描件 / 合同 PDF URL" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <DiffOutlined style={{ color: '#D4AF37' }} />
            <span className="gold-gradient-text" style={{ fontSize: 18, fontWeight: 700 }}>版本差异对比</span>
          </Space>
        }
        open={compareModalOpen}
        onCancel={() => setCompareModalOpen(false)}
        width={960}
        footer={[
          <Button key="close" onClick={() => setCompareModalOpen(false)}>关闭</Button>,
        ]}
      >
        {compareResult && (
          <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card size="small" style={{ border: '2px solid #ff4d4f', background: 'rgba(255,77,79,0.05)' }}>
                  <Statistic
                    title={<Space><Tag color="red">A版</Tag><span style={{ color: '#aaa' }}>版本号</span></Space>}
                    value={compareResult.version_a?.version || '-'}
                    valueStyle={{ color: '#ff4d4f' }}
                    suffix={<span style={{ fontSize: 12, color: '#8B7A4A' }}>{dayjs(compareResult.version_a?.created_at).format('YYYY-MM-DD HH:mm')}</span>}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ border: '2px solid #1890ff', background: 'rgba(24,144,255,0.05)' }}>
                  <Statistic
                    title={<Space><Tag color="blue">B版</Tag><span style={{ color: '#aaa' }}>版本号</span></Space>}
                    value={compareResult.version_b?.version || '-'}
                    valueStyle={{ color: '#1890ff' }}
                    suffix={<span style={{ fontSize: 12, color: '#8B7A4A' }}>{dayjs(compareResult.version_b?.created_at).format('YYYY-MM-DD HH:mm')}</span>}
                  />
                </Card>
              </Col>
            </Row>

            <Divider orientation="left" style={{ borderColor: '#3B3218', color: '#D4AF37' }}>
              <Space>
                <DiffOutlined />
                <span>差异详情</span>
                <Tag color="gold">
                  {(compareResult.diffs || []).filter((d: any) => d.changed).length} 处差异
                </Tag>
              </Space>
            </Divider>

            <Table
              size="small"
              dataSource={compareResult.diffs || []}
              pagination={false}
              rowKey="field"
              columns={[
                {
                  title: '字段',
                  dataIndex: 'field',
                  key: 'field',
                  width: 140,
                  render: (v: string, record: any) => (
                    <Space>
                      {record.changed && <span style={{ color: '#D4AF37' }}>●</span>}
                      <span style={{ color: record.changed ? '#FFD700' : '#8B7A4A', fontWeight: record.changed ? 600 : 400 }}>{v}</span>
                    </Space>
                  ),
                },
                {
                  title: 'A版',
                  dataIndex: 'value_a',
                  key: 'value_a',
                  width: 280,
                  render: (v: any, record: any) => (
                    <div style={{
                      padding: '4px 8px',
                      background: record.changed ? 'rgba(255,77,79,0.08)' : 'transparent',
                      borderRadius: 4,
                      border: record.changed ? '1px solid rgba(255,77,79,0.2)' : 'none',
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}>
                      {v === null || v === undefined ? '-' : String(v)}
                    </div>
                  ),
                },
                {
                  title: 'B版',
                  dataIndex: 'value_b',
                  key: 'value_b',
                  width: 280,
                  render: (v: any, record: any) => (
                    <div style={{
                      padding: '4px 8px',
                      background: record.changed ? 'rgba(24,144,255,0.08)' : 'transparent',
                      borderRadius: 4,
                      border: record.changed ? '1px solid rgba(24,144,255,0.2)' : 'none',
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}>
                      {v === null || v === undefined ? '-' : String(v)}
                    </div>
                  ),
                },
                {
                  title: '状态',
                  dataIndex: 'changed',
                  key: 'changed',
                  width: 100,
                  render: (changed: boolean) => (
                    changed ? <Tag color="red">已变更</Tag> : <Tag color="default">未变更</Tag>
                  ),
                },
              ]}
              scroll={{ y: 360 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

const WaveformVisualizer: React.FC<{ seed: string; height?: number }> = ({ seed, height = 80 }) => {
  const bars = 96;
  const values = useMemo(() => {
    const arr: number[] = [];
    let s = 0;
    for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    for (let i = 0; i < bars; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      const base = 0.2 + ((s % 1000) / 1000) * 0.6;
      const env = Math.sin((i / bars) * Math.PI);
      arr.push(Math.min(1, base * 0.7 + env * base * 0.5));
    }
    return arr;
  }, [seed]);

  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        background: '#151208',
        borderRadius: 8,
        padding: '8px 4px',
        gap: 2,
        border: '1px solid #2A2312',
      }}
    >
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${v * 100}%`,
            background: `linear-gradient(180deg, #FFD700 ${(1 - v) * 60}%, #D4AF37 100%)`,
            borderRadius: 1,
            opacity: 0.85,
            minHeight: 2,
          }}
        />
      ))}
    </div>
  );
};

export default Works;
