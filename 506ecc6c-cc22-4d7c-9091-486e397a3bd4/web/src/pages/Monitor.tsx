import React, { useEffect, useMemo, useState } from 'react';
import {
  Row, Col, Card, List, Tag, Button, Progress, Space, Typography, Drawer, Modal,
  Form, Select, App as AntdApp, Empty, Statistic, Descriptions, Divider, Tooltip, Badge,
} from 'antd';
import {
  PlayCircleOutlined, ScanOutlined, FileTextOutlined, ExclamationCircleOutlined,
  ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined, LinkOutlined,
  SoundOutlined, AudioOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchPiracies, setPiracyFilter, setCurrentPiracy, updatePiracyStatus, setRightsLetter, pushNotification } from '@/store/appSlice';
import { monitorAPI, workAPI, wsManager, WSPiracyAlert, WSCrawlProgress, WSAlert, WSMessage } from '@/api';
import { PiracyRecord, PiracyStatus, PiracyStatusNames, Work } from '@/types';

const { Title, Text } = Typography;

const statusConfig: Record<PiracyStatus, { color: string; icon: React.ReactNode }> = {
  suspected: { color: '#FA8C16', icon: <ExclamationCircleOutlined /> },
  confirmed: { color: '#FF4D4F', icon: <ThunderboltOutlined /> },
  processing: { color: '#1890FF', icon: <FileTextOutlined /> },
  resolved: { color: '#52C41A', icon: <CheckCircleOutlined /> },
  dismissed: { color: '#8B7A4A', icon: <CloseCircleOutlined /> },
};

const Monitor: React.FC = () => {
  const dispatch = useAppDispatch();
  const { piracies, piraciesTotal, piraciesLoading, piracyFilter, currentPiracy, rightsLetter } = useAppSelector((s) => s.app);
  const { message, modal } = AntdApp.useApp();

  const [detailOpen, setDetailOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [letterModalOpen, setLetterModalOpen] = useState(false);
  const [works, setWorks] = useState<Work[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [waveformSeed1, setWaveformSeed1] = useState('');
  const [waveformSeed2, setWaveformSeed2] = useState('');
  const [selectedPiracy, setSelectedPiracy] = useState<PiracyRecord | null>(null);
  const [crawlProgressList, setCrawlProgressList] = useState<Record<string, { platform: string; progress: number; status: string; error_msg?: string }>>({});

  useEffect(() => {
    dispatch(fetchPiracies());
    workAPI.list({ page_size: 200 }).then((res) => setWorks(res.data.data || []));
  }, [dispatch, piracyFilter.page, piracyFilter.page_size, piracyFilter.status, piracyFilter.work_id]);

  useEffect(() => {
    const unsub = wsManager.subscribe((msg: WSMessage) => {
      switch (msg.type) {
        case 'piracy_alert': {
          const p = msg.payload as WSPiracyAlert;
          dispatch(pushNotification({
            id: `piracy-${p.piracy_id}-${Date.now()}`,
            type: 'error',
            message: `[盗版告警] ${p.work_title} 在 ${p.platform} 发现疑似侵权: ${p.suspect_name} (匹配度 ${(p.match_score * 100).toFixed(1)}%)`,
          }));
          dispatch(fetchPiracies());
          break;
        }
        case 'crawl_progress': {
          const cp = msg.payload as WSCrawlProgress;
          setCrawlProgressList((prev) => ({
            ...prev,
            [cp.task_id || cp.platform]: {
              platform: cp.platform,
              progress: cp.progress,
              status: cp.status,
              error_msg: cp.error_msg,
            },
          }));
          if (cp.status === 'success' || cp.status === 'failed') {
            setTimeout(() => {
              setCrawlProgressList((prev) => {
                const { [cp.task_id || cp.platform]: _, ...rest } = prev;
                return rest;
              });
            }, 3000);
          }
          if (cp.status === 'failed' && cp.error_msg) {
            dispatch(pushNotification({
              id: `crawl-err-${cp.platform}-${Date.now()}`,
              type: 'warning',
              message: `[采集失败] ${cp.platform}: ${cp.error_msg}`,
            }));
          }
          if (cp.status === 'success') {
            dispatch(fetchPiracies());
          }
          break;
        }
        case 'alert': {
          const a = msg.payload as WSAlert;
          dispatch(pushNotification({
            id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: a.level,
            message: `[${a.title}] ${a.message}`,
          }));
          break;
        }
      }
    });
    return () => { unsub(); };
  }, [dispatch]);

  useEffect(() => {
    if (currentPiracy) {
      setWaveformSeed1(currentPiracy.work_fingerprint || 'work');
      setWaveformSeed2(currentPiracy.suspect_fingerprint || 'suspect');
    }
  }, [currentPiracy]);

  const handleRowClick = (r: PiracyRecord) => {
    setSelectedPiracy(r);
    dispatch(setCurrentPiracy(r));
    setDetailOpen(true);
  };

  const handleScan = async (work_id?: string, threshold?: number) => {
    setScanLoading(true);
    try {
      const res = await monitorAPI.scanPiracy(work_id || undefined, threshold || 0.8);
      const count = res.data?.count || res.data?.total_detected || 0;
      message.success(`扫描完成，发现 ${count} 条疑似侵权`);
      dispatch(fetchPiracies());
      setScanModalOpen(false);
    } catch (e) {
      message.error('扫描失败');
    } finally {
      setScanLoading(false);
    }
  };

  const handleGenerateLetter = async (templateType: string = 'cease_desist') => {
    if (!selectedPiracy) return;
    try {
      const res = await monitorAPI.resolvePiracy(selectedPiracy.id, 'generate_letter');
      dispatch(setRightsLetter(res.data?.letter || res.data));
      dispatch(updatePiracyStatus({ id: selectedPiracy.id, status: 'processing' }));
      setLetterModalOpen(true);
      message.success('维权函已生成');
      dispatch(fetchPiracies());
    } catch (e: any) {
      message.error(e?.response?.data?.message || '生成失败');
    }
  };

  const handleResolve = (dismissed: boolean) => {
    if (!selectedPiracy) return;
    modal.confirm({
      title: dismissed ? '确认标记为误报？' : '确认已完成维权？',
      onOk: async () => {
        try {
          await monitorAPI.resolvePiracy(selectedPiracy.id, 'resolve', dismissed);
          dispatch(updatePiracyStatus({ id: selectedPiracy.id, status: dismissed ? 'dismissed' : 'resolved' }));
          message.success(dismissed ? '已标记为误报' : '维权完成');
          dispatch(fetchPiracies());
          setDetailOpen(false);
        } catch (e) {
          message.error('操作失败');
          return Promise.reject();
        }
      },
    });
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    piracies.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [piracies]);

  const trendOption = useMemo<EChartsOption>(() => {
    const byDay: Record<string, Record<PiracyStatus, number>> = {};
    piracies.forEach((p) => {
      const d = dayjs(p.discovered_at).format('MM-DD');
      if (!byDay[d]) byDay[d] = { suspected: 0, confirmed: 0, processing: 0, resolved: 0, dismissed: 0 };
      byDay[d][p.status] += 1;
    });
    const days = Object.keys(byDay).sort();
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1A170E', borderColor: '#3B3218', textStyle: { color: '#E8D8A0' } },
      legend: {
        data: ['疑似', '确认', '维权中', '已处理', '误报'],
        textStyle: { color: '#B8A06A' }, top: 0,
      },
      grid: { left: 40, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: days,
        axisLabel: { color: '#8B7A4A' },
        axisLine: { lineStyle: { color: '#3B3218' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#8B7A4A' },
        splitLine: { lineStyle: { color: '#2A2312' } },
      },
      series: (['suspected', 'confirmed', 'processing', 'resolved', 'dismissed'] as PiracyStatus[]).map((s) => ({
        name: PiracyStatusNames[s],
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        itemStyle: { color: statusConfig[s].color },
        data: days.map((d) => byDay[d][s] || 0),
      })),
    };
  }, [piracies]);

  const platformOption = useMemo<EChartsOption>(() => {
    const byPlatform: Record<string, number> = {};
    piracies.forEach((p) => { byPlatform[p.suspect_platform] = (byPlatform[p.suspect_platform] || 0) + 1; });
    const colors = ['#C20C0C', '#FE2C55', '#FF7A00', '#FF0000', '#FE2C55', '#07C160', '#E6162D'];
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', backgroundColor: '#1A170E', borderColor: '#3B3218', textStyle: { color: '#E8D8A0' } },
      series: [{
        type: 'pie', radius: ['45%', '70%'],
        itemStyle: { borderRadius: 6, borderColor: '#151208', borderWidth: 2 },
        label: { color: '#B8A06A', formatter: '{b}\n{c}件 ({d}%)' },
        data: Object.entries(byPlatform).map(([n, v], i) => ({ name: n, value: v, itemStyle: { color: colors[i % colors.length] } })),
      }],
    };
  }, [piracies]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Object.keys(crawlProgressList).length > 0 && (
        <Card size="small" className="gold-card" title={<Space><ThunderboltOutlined style={{ color: '#D4AF37' }} /><span>平台采集进度</span></Space>}>
          <Row gutter={[16, 12]}>
            {Object.values(crawlProgressList).map((cp, i) => (
              <Col xs={24} sm={12} md={8} key={i}>
                <div style={{ padding: '8px 12px', background: '#1A170E', borderRadius: 6, border: '1px solid #2A2312' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Space>
                      <SoundOutlined style={{ color: '#D4AF37' }} />
                      <span style={{ fontWeight: 600 }}>{cp.platform}</span>
                    </Space>
                    <Tag color={cp.status === 'success' ? 'success' : cp.status === 'failed' ? 'error' : 'processing'}>
                      {cp.status === 'success' ? '完成' : cp.status === 'failed' ? '失败' : cp.status === 'running' ? '采集中' : cp.status}
                    </Tag>
                  </div>
                  <Progress
                    percent={Math.round(cp.progress * 100)}
                    size="small"
                    showInfo
                    strokeColor={cp.status === 'failed' ? '#FF4D4F' : cp.status === 'success' ? '#52C41A' : '#D4AF37'}
                  />
                  {cp.error_msg && <div style={{ marginTop: 4, fontSize: 12, color: '#FF4D4F' }}>{cp.error_msg}</div>}
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={4}>
          <div className="stat-card">
            <div className="stat-label">监控记录总数</div>
            <div className="stat-value">{piraciesTotal}</div>
            <div className="stat-delta delta-up">覆盖全部 1,200 首作品指纹</div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <div className="stat-card">
            <div className="stat-label" style={{ color: '#FF4D4F' }}>确认侵权</div>
            <div className="stat-value" style={{ color: '#FF4D4F' }}>{statusCounts.confirmed || 0}</div>
            <div className="stat-delta" style={{ color: '#FF4D4F' }}>
              <ThunderboltOutlined /> 需要立即处理
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <div className="stat-card">
            <div className="stat-label" style={{ color: '#1890FF' }}>维权中</div>
            <div className="stat-value" style={{ color: '#1890FF' }}>{statusCounts.processing || 0}</div>
            <div className="stat-delta">
              <FileTextOutlined /> 已发送维权函
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <div className="stat-card">
            <div className="stat-label" style={{ color: '#52C41A' }}>已处理</div>
            <div className="stat-value" style={{ color: '#52C41A' }}>
              {(statusCounts.resolved || 0) + (statusCounts.dismissed || 0)}
            </div>
            <div className="stat-delta delta-up">
              处理率 {piraciesTotal > 0 ? ((((statusCounts.resolved || 0) + (statusCounts.dismissed || 0)) / piraciesTotal) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </Col>
        <Col xs={24} sm={24} md={8}>
          <div
            className="gold-card"
            style={{
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #2A2010 0%, #151208 100%)',
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: '#8B7A4A', marginBottom: 8 }}>快速操作</div>
              <Title level={4} style={{ margin: 0, color: '#FFD700' }}>盗版指纹监控</Title>
            </div>
            <Space wrap>
              <Button type="primary" icon={<ScanOutlined />} size="large" loading={scanLoading} onClick={() => setScanModalOpen(true)}>
                启动全库扫描
              </Button>
              <Select
                allowClear
                showSearch
                style={{ minWidth: 220 }}
                placeholder="选择作品快速扫描"
                onChange={(id) => handleScan(id, 0.8)}
                optionFilterProp="label"
                options={works.map((w) => ({ value: w.id, label: `${w.title} - ISRC ${w.isrc}` }))}
              />
            </Space>
            <div style={{ fontSize: 11, color: '#8B7A4A' }}>
              <SoundOutlined /> 基于音频指纹，单作品匹配 &lt; 10秒；阈值 80% 以上视为疑似
            </div>
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" className="gold-card" title={<span style={{ color: '#FFD700' }}>侵权记录趋势（按发现日期）</span>}>
            <ReactECharts option={trendOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" className="gold-card" title={<span style={{ color: '#FFD700' }}>侵权内容平台分布</span>}>
            <ReactECharts option={platformOption} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={detailOpen ? 10 : 24}>
          <Card
            size="small"
            className="gold-card"
            title={<span style={{ color: '#FFD700' }}>疑似侵权列表</span>}
            extra={
              <Space size="small" wrap>
                <Select
                  allowClear
                  size="small"
                  style={{ width: 140 }}
                  placeholder="筛选状态"
                  value={piracyFilter.status || undefined}
                  onChange={(v) => dispatch(setPiracyFilter({ status: (v || '') as PiracyStatus, page: 1 }))}
                  options={Object.keys(PiracyStatusNames).map((k) => ({
                    value: k, label: PiracyStatusNames[k as PiracyStatus],
                  }))}
                />
                <Select
                  allowClear
                  showSearch
                  size="small"
                  style={{ width: 200 }}
                  placeholder="按作品筛选"
                  value={piracyFilter.work_id || undefined}
                  onChange={(v) => dispatch(setPiracyFilter({ work_id: v || '', page: 1 }))}
                  options={works.map((w) => ({ value: w.id, label: w.title }))}
                />
              </Space>
            }
            styles={{ body: { padding: 0 } }}
          >
            {piracies.length === 0 ? (
              <Empty description="暂无侵权记录" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
            ) : (
              <List
                loading={piraciesLoading}
                dataSource={piracies}
                pagination={{
                  current: piracyFilter.page,
                  pageSize: piracyFilter.page_size,
                  total: piraciesTotal,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  onChange: (p, ps) => dispatch(setPiracyFilter({ page: p, page_size: ps })),
                  showTotal: (t) => `共 ${t} 条`,
                  style: { padding: '12px 16px' },
                }}
                renderItem={(item) => {
                  const cfg = statusConfig[item.status];
                  const isSelected = selectedPiracy?.id === item.id;
                  return (
                    <List.Item
                      onClick={() => handleRowClick(item)}
                      style={{
                        padding: '14px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #2A2312',
                        background: isSelected ? 'rgba(212,175,55,0.06)' : 'transparent',
                        borderLeft: isSelected ? `3px solid ${cfg.color}` : '3px solid transparent',
                        transition: 'background 0.2s',
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <div
                            style={{
                              width: 48, height: 48, borderRadius: 10,
                              background: `${cfg.color}22`,
                              color: cfg.color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 22,
                            }}
                          >
                            {cfg.icon}
                          </div>
                        }
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <Space size="small" wrap>
                              <Text strong style={{ color: '#E8D8A0', fontSize: 14 }}>
                                {item.suspect_title}
                              </Text>
                              <Badge color={cfg.color} text={<span style={{ fontSize: 11 }}>{PiracyStatusNames[item.status]}</span>} />
                            </Space>
                            <Tooltip title={`匹配度 ${(item.match_score * 100).toFixed(2)}%`}>
                              <Progress
                                type="dashboard"
                                size={56}
                                percent={Number((item.match_score * 100).toFixed(0))}
                                strokeColor={item.match_score >= item.match_threshold ? '#FF4D4F' : '#FA8C16'}
                                trailColor="#231F12"
                                format={(p) => <span style={{ fontSize: 10, color: '#B8A06A' }}>{p}%</span>}
                              />
                            </Tooltip>
                          </div>
                        }
                        description={
                          <Space direction="vertical" size={4} style={{ marginTop: 4 }}>
                            <Space size="small" wrap style={{ fontSize: 12 }}>
                              <Tag color="geekblue" style={{ margin: 0 }}>{item.suspect_platform}</Tag>
                              <Text type="secondary">发布人: {item.suspect_artist}</Text>
                              <Text type="secondary">原始作品: 《{item.work_title}》</Text>
                            </Space>
                            <div style={{ fontSize: 11, color: '#8B7A4A' }}>
                              发现于 {dayjs(item.discovered_at).format('YYYY-MM-DD HH:mm')}
                              {item.note && ` · ${item.note}`}
                            </div>
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={14} style={{ display: detailOpen ? 'block' : 'none' }} className="hide-on-mobile">
          {selectedPiracy && <PiracyDetail
            piracy={selectedPiracy}
            seed1={waveformSeed1}
            seed2={waveformSeed2}
            onClose={() => setDetailOpen(false)}
            onGenerateLetter={handleGenerateLetter}
            onResolve={handleResolve}
          />}
        </Col>
      </Row>

      <Modal
        title={<span className="gold-gradient-text" style={{ fontSize: 18, fontWeight: 700 }}>启动盗版扫描</span>}
        open={scanModalOpen}
        onCancel={() => setScanModalOpen(false)}
        footer={null}
        width={520}
      >
        <Form layout="vertical">
          <Alert
            type="info"
            showIcon
            message={
              <div style={{ lineHeight: 1.7 }}>
                <div>🎯 全库扫描：对 1,200 首作品逐一在主流平台进行指纹比对（预计几分钟）</div>
                <div>🎯 单作品扫描：仅针对指定作品（预计 &lt; 10 秒）</div>
                <div>⚠ 阈值建议：0.75（宽松）~ 0.9（严格），默认 0.8</div>
              </div>
            }
          />
          <Divider />
          <Form.Item label="目标作品（留空=全库）">
            <Select
              allowClear
              showSearch
              style={{ width: '100%' }}
              placeholder="选择作品（可选）"
              optionFilterProp="label"
              options={works.map((w) => ({ value: w.id, label: `${w.title} - ISRC ${w.isrc}` }))}
              id="scan-work-select"
            />
          </Form.Item>
          <Form.Item label="匹配阈值（默认 0.8）" initialValue={0.8}>
            <Space style={{ width: '100%' }}>
              <Progress percent={80} />
            </Space>
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setScanModalOpen(false)}>取消</Button>
            <Button type="primary" icon={<ScanOutlined />} loading={scanLoading} onClick={() => {
              const sel = document.getElementById('scan-work-select');
              const val = sel?.getAttribute('data-value') || '';
              handleScan(val || undefined, 0.8);
            }}>开始扫描</Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={<span className="gold-gradient-text" style={{ fontSize: 18, fontWeight: 700 }}>维权函模板</span>}
        open={letterModalOpen}
        onCancel={() => setLetterModalOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setLetterModalOpen(false)}>关闭</Button>
            <Button type="primary" icon={<FileTextOutlined />} onClick={() => {
              if (rightsLetter?.content) {
                navigator.clipboard?.writeText(rightsLetter.content);
                message.success('已复制到剪贴板');
              }
            }}>复制全文</Button>
            <Button type="primary" onClick={() => {
              if (rightsLetter?.content) {
                const blob = new Blob([rightsLetter.content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `维权函_${rightsLetter?.work_title || ''}_${Date.now()}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }
            }}>下载 .txt</Button>
          </Space>
        }
        width={720}
      >
        {rightsLetter ? (
          <div
            style={{
              padding: 24,
              background: '#1A170E',
              border: '1px solid #3B3218',
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.8,
              fontSize: 14,
              color: '#E8D8A0',
              fontFamily: '"Songti SC", serif',
              maxHeight: 480,
              overflow: 'auto',
            }}
          >
            {rightsLetter.content}
          </div>
        ) : (
          <Empty description="暂无内容" />
        )}
      </Modal>
    </div>
  );
};

const PiracyDetail: React.FC<{
  piracy: PiracyRecord;
  seed1: string;
  seed2: string;
  onClose: () => void;
  onGenerateLetter: (tpl?: string) => void;
  onResolve: (dismissed: boolean) => void;
}> = ({ piracy, seed1, seed2, onClose, onGenerateLetter, onResolve }) => {
  const cfg = statusConfig[piracy.status];
  return (
    <Card
      size="small"
      className="gold-card"
      title={
        <Space>
          <span style={{ color: cfg.color, fontSize: 18 }}>{cfg.icon}</span>
          <span style={{ color: '#FFD700', fontWeight: 600 }}>{piracy.suspect_title}</span>
          <Badge color={cfg.color} text={PiracyStatusNames[piracy.status]} />
        </Space>
      }
      extra={<Button size="small" type="text" onClick={onClose} style={{ color: '#D4AF37' }}>收起面板</Button>}
      style={{ height: '100%' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Descriptions
          column={2}
          size="small"
          bordered
          labelStyle={{ width: 100, background: '#1A170E', color: '#8B7A4A' }}
        >
          <Descriptions.Item label="侵权平台">{piracy.suspect_platform}</Descriptions.Item>
          <Descriptions.Item label="发布者">{piracy.suspect_artist}</Descriptions.Item>
          <Descriptions.Item label="侵权链接" span={2}>
            <a href={piracy.suspect_url} target="_blank" rel="noreferrer" style={{ color: '#D4AF37' }}>
              {piracy.suspect_url} <LinkOutlined />
            </a>
          </Descriptions.Item>
          <Descriptions.Item label="对应原作">《{piracy.work_title}》</Descriptions.Item>
          <Descriptions.Item label="发现时间">{dayjs(piracy.discovered_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
        </Descriptions>

        <Card size="small" title={<Space><AudioOutlined /> <span style={{ color: '#FFD700' }}>音频波形对比与匹配度</span></Space>} className="gold-card">
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Tag color="#52C41A">原始作品：《{piracy.work_title}》</Tag>
              <PlayCircleOutlined style={{ fontSize: 20, color: '#52C41A', cursor: 'pointer' }} />
            </div>
            <WaveformVisualizer seed={seed1} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Tag color={cfg.color}>涉嫌侵权：{piracy.suspect_title}</Tag>
              <PlayCircleOutlined style={{ fontSize: 20, color: cfg.color, cursor: 'pointer' }} />
            </div>
            <WaveformVisualizer seed={seed2} />
          </div>
          <div
            style={{
              padding: '16px 20px',
              background: piracy.match_score >= piracy.match_threshold
                ? 'rgba(255,77,79,0.08)'
                : 'rgba(82,196,26,0.08)',
              border: `1px solid ${piracy.match_score >= piracy.match_threshold ? 'rgba(255,77,79,0.3)' : 'rgba(82,196,26,0.3)'}`,
              borderRadius: 10,
            }}
          >
            <Row gutter={16} align="middle">
              <Col flex="auto">
                <Progress
                  percent={Number((piracy.match_score * 100).toFixed(1))}
                  strokeColor={piracy.match_score >= piracy.match_threshold
                    ? { from: '#FF4D4F', to: '#FF7875' }
                    : { from: '#52C41A', to: '#95DE64' }}
                  trailColor="#231F12"
                />
              </Col>
              <Col flex="120px" style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 28,
                  fontWeight: 800,
                  fontFamily: 'DIN',
                  color: piracy.match_score >= piracy.match_threshold ? '#FF4D4F' : '#52C41A',
                }}>
                  {(piracy.match_score * 100).toFixed(2)}%
                </div>
                <div style={{ fontSize: 11, color: '#8B7A4A' }}>
                  阈值 {(piracy.match_threshold * 100).toFixed(0)}%
                </div>
              </Col>
            </Row>
            <div style={{ marginTop: 8, fontSize: 12, color: '#B8A06A' }}>
              {piracy.note}
            </div>
          </div>
        </Card>

        <Card size="small" title={<Space><ThunderboltOutlined /> <span style={{ color: '#FFD700' }}>处置操作</span></Space>} className="gold-card">
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <div style={{ fontSize: 12, color: '#8B7A4A' }}>选择维权函模板并一键生成（支持复制/下载）</div>
            <Space wrap>
              <Button type="primary" icon={<FileTextOutlined />} onClick={() => onGenerateLetter('cease_desist')}>
                停止侵权函（Cease &amp; Desist）
              </Button>
              <Button icon={<FileTextOutlined />} onClick={() => onGenerateLetter('license_offer')}>
                授权邀约
              </Button>
              <Button icon={<FileTextOutlined />} onClick={() => onGenerateLetter('standard')}>
                DMCA 标准通知
              </Button>
            </Space>
            <Divider style={{ margin: '12px 0' }} />
            <Space wrap>
              <Button icon={<CheckCircleOutlined />} onClick={() => onResolve(false)} style={{ borderColor: '#52C41A', color: '#52C41A' }}>
                已完成维权，标记解决
              </Button>
              <Button danger icon={<CloseCircleOutlined />} onClick={() => onResolve(true)}>
                标记为误报（驳回）
              </Button>
            </Space>
          </Space>
        </Card>
      </div>
    </Card>
  );
};

const WaveformVisualizer: React.FC<{ seed: string; height?: number }> = ({ seed, height = 80 }) => {
  const bars = 120;
  const values = useMemo(() => {
    const arr: number[] = [];
    let s = 0;
    for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    for (let i = 0; i < bars; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      const base = 0.15 + ((s % 1000) / 1000) * 0.6;
      const env = Math.sin((i / bars) * Math.PI) ** 0.5;
      arr.push(Math.min(1, base * 0.6 + env * base * 0.6));
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
        gap: 1,
        border: '1px solid #2A2312',
      }}
    >
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${v * 100}%`,
            background: `linear-gradient(180deg, rgba(212,175,55,${0.4 + v * 0.6}) 0%, #8B6914 100%)`,
            borderRadius: 1,
            minHeight: 2,
          }}
        />
      ))}
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
      padding: '12px 16px', background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 8, color: c.color, fontSize: 13, lineHeight: 1.7,
    }}>
      {props.showIcon && <span style={{ marginRight: 8, fontSize: 16 }}>{c.icon}</span>}
      {props.message}
    </div>
  );
};

export default Monitor;
