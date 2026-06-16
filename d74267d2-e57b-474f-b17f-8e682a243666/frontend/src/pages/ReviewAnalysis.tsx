import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout,
  Menu,
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  Progress,
  Descriptions,
  List,
  Timeline,
  Empty,
  message,
  Tabs,
  Radio,
  InputNumber,
  Rate,
  Alert,
  Drawer,
  Tooltip,
  Divider,
  Avatar,
  Dropdown,
} from 'antd';
import {
  FileTextOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  BarChartOutlined,
  SearchOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RocketOutlined,
  TeamOutlined,
  InboxOutlined,
  LineChartOutlined,
  ComparisonOutlined,
  ThunderboltOutlined,
  BookOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  DashboardOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  Incident,
  IncidentArchive,
  IncidentReviewReport,
  IncidentHistoryCase,
  IncidentCaseComparison,
  IncidentStatus,
  IncidentLevel,
  IncidentType,
} from '@/types';
import {
  INCIDENT_STATUS_MAP,
  INCIDENT_STATUS_COLOR,
  INCIDENT_LEVEL_MAP,
  INCIDENT_LEVEL_COLOR,
  INCIDENT_TYPE_MAP,
} from '@/constants/dictionary';
import {
  getArchiveById,
  getArchivesByIncidentId,
  archiveIncident,
  generateReviewReport,
  getReviewReportById,
  getReviewReportsByIncidentId,
  approveReviewReport,
  getHistoryCaseById,
  queryHistoryCases,
  getClassicCases,
  findSimilarCases,
  compareWithCase,
  getComparisonsByIncidentId,
  generateTimelineAnalysis,
  calculateEfficiencyMetrics,
  ArchiveIncidentRequest,
  GenerateReviewRequest,
  HistoryCaseQueryRequest,
  CaseComparisonRequest,
} from '@/api/review';
import { getIncidentList } from '@/api/incident';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

enum MenuKey {
  ARCHIVE = 'archive',
  REVIEW = 'review',
  HISTORY = 'history',
  COMPARISON = 'comparison',
}

const ReviewAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [activeMenu, setActiveMenu] = useState<MenuKey>(MenuKey.ARCHIVE);
  const [loading, setLoading] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [archives, setArchives] = useState<IncidentArchive[]>([]);
  const [reviewReports, setReviewReports] = useState<IncidentReviewReport[]>([]);
  const [historyCases, setHistoryCases] = useState<IncidentHistoryCase[]>([]);
  const [comparisons, setComparisons] = useState<IncidentCaseComparison[]>([]);
  const [closedIncidents, setClosedIncidents] = useState<Incident[]>([]);
  const [classicCases, setClassicCases] = useState<IncidentHistoryCase[]>([]);
  const [similarCases, setSimilarCases] = useState<IncidentHistoryCase[]>([]);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCaseDetail, setShowCaseDetail] = useState(false);
  const [showReportDetail, setShowReportDetail] = useState(false);
  const [showTimelineDrawer, setShowTimelineDrawer] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const [currentArchive, setCurrentArchive] = useState<IncidentArchive | null>(null);
  const [currentReport, setCurrentReport] = useState<IncidentReviewReport | null>(null);
  const [currentCase, setCurrentCase] = useState<IncidentHistoryCase | null>(null);
  const [currentComparison, setCurrentComparison] = useState<IncidentCaseComparison | null>(null);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [efficiencyMetrics, setEfficiencyMetrics] = useState<any>(null);

  const [archiveForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [caseQueryForm] = Form.useForm();
  const [comparisonForm] = Form.useForm();

  const [casePagination, setCasePagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [timelineAnalysis, setTimelineAnalysis] = useState<any>(null);

  useEffect(() => {
    loadClosedIncidents();
    loadClassicCases();
  }, []);

  useEffect(() => {
    if (selectedIncident) {
      loadArchives(selectedIncident.id);
      loadReviewReports(selectedIncident.id);
      loadComparisons(selectedIncident.id);
      loadSimilarCases(selectedIncident.id);
    }
  }, [selectedIncident]);

  useEffect(() => {
    if (activeMenu === MenuKey.HISTORY) {
      handleCaseQuery();
    }
  }, [activeMenu]);

  const loadClosedIncidents = async () => {
    try {
      const result = await getIncidentList({ status: IncidentStatus.CLOSED, pageSize: 50 });
      setClosedIncidents(result.list || []);
    } catch (error) {
      message.error('加载已结案灾情列表失败');
    }
  };

  const loadClassicCases = async () => {
    try {
      const cases = await getClassicCases();
      setClassicCases(cases);
    } catch (error) {
      console.error('加载经典案例失败', error);
    }
  };

  const loadArchives = async (incidentId: number) => {
    try {
      const data = await getArchivesByIncidentId(incidentId);
      setArchives(data);
    } catch (error) {
      message.error('加载归档记录失败');
    }
  };

  const loadReviewReports = async (incidentId: number) => {
    try {
      const data = await getReviewReportsByIncidentId(incidentId);
      setReviewReports(data);
    } catch (error) {
      message.error('加载复盘报告失败');
    }
  };

  const loadComparisons = async (incidentId: number) => {
    try {
      const data = await getComparisonsByIncidentId(incidentId);
      setComparisons(data);
    } catch (error) {
      console.error('加载对比记录失败', error);
    }
  };

  const loadSimilarCases = async (incidentId: number) => {
    try {
      const data = await findSimilarCases(incidentId, 5);
      setSimilarCases(data);
    } catch (error) {
      console.error('加载相似案例失败', error);
    }
  };

  const handleCaseQuery = async (values?: HistoryCaseQueryRequest) => {
    setLoading(true);
    try {
      const queryData = values || caseQueryForm.getFieldsValue();
      const result = await queryHistoryCases({
        ...queryData,
        pageNum: casePagination.current,
        pageSize: casePagination.pageSize,
      });
      setHistoryCases(result.list || []);
      setCasePagination((prev) => ({ ...prev, total: result.total || 0 }));
    } catch (error) {
      message.error('查询历史案例失败');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (values: ArchiveIncidentRequest) => {
    if (!selectedIncident) return;
    setLoading(true);
    try {
      const archive = await archiveIncident({
        ...values,
        incidentId: selectedIncident.id,
      });
      message.success('灾情归档成功');
      setShowArchiveModal(false);
      archiveForm.resetFields();
      loadArchives(selectedIncident.id);
      setCurrentArchive(archive);
    } catch (error) {
      message.error('归档失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReview = async (values: GenerateReviewRequest) => {
    if (!selectedIncident || !currentArchive) return;
    setLoading(true);
    try {
      const report = await generateReviewReport({
        ...values,
        incidentId: selectedIncident.id,
        archiveId: currentArchive.id,
      });
      message.success('复盘报告生成成功');
      setShowReviewModal(false);
      reviewForm.resetFields();
      loadReviewReports(selectedIncident.id);
      setCurrentReport(report);
      setShowReportDetail(true);
    } catch (error) {
      message.error('生成复盘报告失败');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReport = async (report: IncidentReviewReport) => {
    Modal.confirm({
      title: '审核复盘报告',
      content: '审核通过后将自动生成历史案例，是否确认审核通过？',
      okText: '确认审核',
      cancelText: '取消',
      onOk: async () => {
        try {
          await approveReviewReport(report.id, '审核通过，数据完整');
          message.success('审核通过，已生成历史案例');
          loadReviewReports(selectedIncident!.id);
        } catch (error) {
          message.error('审核失败');
        }
      },
    });
  };

  const handleCompareWithCase = async (values: CaseComparisonRequest) => {
    if (!selectedIncident) return;
    setLoading(true);
    try {
      const comparison = await compareWithCase({
        ...values,
        sourceIncidentId: selectedIncident.id,
      });
      message.success('案例对比完成');
      setShowComparisonModal(false);
      comparisonForm.resetFields();
      loadComparisons(selectedIncident.id);
      setCurrentComparison(comparison);
    } catch (error) {
      message.error('案例对比失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTimeline = async () => {
    if (!selectedIncident) return;
    setLoading(true);
    try {
      const data = await generateTimelineAnalysis(selectedIncident.id);
      setTimelineData(data);
      setShowTimelineDrawer(true);
    } catch (error) {
      message.error('加载时间轴失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewEfficiency = async () => {
    if (!selectedIncident) return;
    setLoading(true);
    try {
      const data = await calculateEfficiencyMetrics(selectedIncident.id);
      setEfficiencyMetrics(data);
    } catch (error) {
      message.error('加载效率指标失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCaseDetail = async (caseItem: IncidentHistoryCase) => {
    setCurrentCase(caseItem);
    setShowCaseDetail(true);
  };

  const handleViewReportDetail = async (report: IncidentReviewReport) => {
    try {
      const detail = await getReviewReportById(report.id);
      setCurrentReport(detail);
      setShowReportDetail(true);
    } catch (error) {
      message.error('加载报告详情失败');
    }
  };

  const renderScoreColor = (score: number) => {
    if (score >= 85) return '#52c41a';
    if (score >= 70) return '#1890ff';
    if (score >= 60) return '#fa8c16';
    return '#ff4d4f';
  };

  const renderRatingStars = (rating: number) => {
    return <Rate disabled value={rating} />;
  };

  const renderArchivePanel = () => (
    <div>
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            灾情归档管理
          </Space>
        }
        extra={
          <Space>
            <Select
              style={{ width: 300 }}
              placeholder="请选择已结案的灾情"
              showSearch
              optionFilterProp="children"
              value={selectedIncident?.id}
              onChange={(id) => {
                const incident = closedIncidents.find((i) => i.id === id);
                setSelectedIncident(incident || null);
              }}
            >
              {closedIncidents.map((incident) => (
                <Option key={incident.id} value={incident.id}>
                  [{incident.incidentNo}] {incident.title}
                </Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!selectedIncident || archives.length > 0}
              onClick={() => setShowArchiveModal(true)}
            >
              归档灾情
            </Button>
          </Space>
        }
      >
        {!selectedIncident ? (
          <Empty description="请先选择已结案的灾情" />
        ) : archives.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <InboxOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }} />
            <p style={{ color: 'rgba(255,255,255,0.45)' }}>该灾情尚未归档</p>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowArchiveModal(true)}
              style={{ marginTop: 16 }}
            >
              立即归档
            </Button>
          </div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {archives.map((archive) => (
              <Card key={archive.id} size="small">
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic
                      title="归档编号"
                      value={archive.archiveNo}
                      valueStyle={{ fontSize: 14 }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="归档类型"
                      value={archive.archiveType === 'AUTO' ? '系统自动归档' : '人工归档'}
                      valueStyle={{ fontSize: 14 }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="归档时间"
                      value={dayjs(archive.archivedAt).format('YYYY-MM-DD HH:mm')}
                      valueStyle={{ fontSize: 14 }}
                    />
                  </Col>
                  <Col span={6}>
                    <Space direction="vertical">
                      <Button
                        type="primary"
                        size="small"
                        icon={<FileTextOutlined />}
                        disabled={reviewReports.length > 0}
                        onClick={() => {
                          setCurrentArchive(archive);
                          setShowReviewModal(true);
                        }}
                      >
                        生成复盘报告
                      </Button>
                      <Button
                        size="small"
                        icon={<LineChartOutlined />}
                        onClick={handleViewTimeline}
                      >
                        查看时间轴
                      </Button>
                    </Space>
                  </Col>
                </Row>
                {archive.archiveRemark && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1e293b' }}>
                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>归档备注：</span>
                    {archive.archiveRemark}
                  </div>
                )}
              </Card>
            ))}
          </Space>
        )}
      </Card>

      <Card
        title={
          <Space style={{ marginTop: 16 }}>
            <FileTextOutlined />
            复盘报告列表
          </Space>
        }
      >
        {reviewReports.length === 0 ? (
          <Empty description="暂无复盘报告" />
        ) : (
          <List
            dataSource={reviewReports}
            renderItem={(report) => (
              <List.Item
                key={report.id}
                actions={[
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewReportDetail(report)}
                  >
                    查看详情
                  </Button>,
                  report.status === 1 && (
                    <Button
                      type="link"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleApproveReport(report)}
                    >
                      审核通过
                    </Button>
                  ),
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {report.title}
                      <Tag color={report.status === 1 ? '#fa8c16' : '#52c41a'}>
                        {report.status === 1 ? '待审核' : '已审核'}
                      </Tag>
                      <Tag color="#1890ff">综合评分: {report.overallScore?.toFixed(1)}</Tag>
                    </Space>
                  }
                  description={
                    <Space size="large">
                      <span>报告编号: {report.reportNo}</span>
                      <span>响应时长: {report.responseDuration?.toFixed(2)}小时</span>
                      <span>调度方案: {report.dispatchCount}个</span>
                      <span>调用队伍: {report.teamCount}支</span>
                      <span>生成时间: {dayjs(report.generatedAt).format('MM-DD HH:mm')}</span>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {efficiencyMetrics && (
        <Card
          title={
            <Space style={{ marginTop: 16 }}>
              <BarChartOutlined />
              效率指标分析
            </Space>
          }
        >
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="响应时效评分"
                  value={efficiencyMetrics.timelinessScore?.toFixed(1)}
                  valueStyle={{ color: renderScoreColor(efficiencyMetrics.timelinessScore) }}
                  suffix="分"
                />
                <Progress
                  percent={efficiencyMetrics.timelinessScore}
                  strokeColor={renderScoreColor(efficiencyMetrics.timelinessScore)}
                  showInfo={false}
                  style={{ marginTop: 8 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="资源利用评分"
                  value={efficiencyMetrics.resourceScore?.toFixed(1)}
                  valueStyle={{ color: renderScoreColor(efficiencyMetrics.resourceScore) }}
                  suffix="分"
                />
                <Progress
                  percent={efficiencyMetrics.resourceScore}
                  strokeColor={renderScoreColor(efficiencyMetrics.resourceScore)}
                  showInfo={false}
                  style={{ marginTop: 8 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="处置效率评分"
                  value={efficiencyMetrics.efficiencyScore?.toFixed(1)}
                  valueStyle={{ color: renderScoreColor(efficiencyMetrics.efficiencyScore) }}
                  suffix="分"
                />
                <Progress
                  percent={efficiencyMetrics.efficiencyScore}
                  strokeColor={renderScoreColor(efficiencyMetrics.efficiencyScore)}
                  showInfo={false}
                  style={{ marginTop: 8 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="综合评分"
                  value={efficiencyMetrics.overallScore?.toFixed(1)}
                  valueStyle={{ color: renderScoreColor(efficiencyMetrics.overallScore), fontWeight: 'bold' }}
                  suffix="分"
                />
                <Progress
                  percent={efficiencyMetrics.overallScore}
                  strokeColor={renderScoreColor(efficiencyMetrics.overallScore)}
                  showInfo={false}
                  style={{ marginTop: 8 }}
                />
              </Card>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={6}>
              <Statistic
                prefix={<ThunderboltOutlined />}
                title="首次响应时间"
                value={efficiencyMetrics.responseDuration?.toFixed(2)}
                suffix="小时"
              />
            </Col>
            <Col span={6}>
              <Statistic
                prefix={<RocketOutlined />}
                title="调度方案数"
                value={efficiencyMetrics.dispatchCount}
                suffix="个"
              />
            </Col>
            <Col span={6}>
              <Statistic
                prefix={<TeamOutlined />}
                title="调用队伍数"
                value={efficiencyMetrics.teamCount}
                suffix="支"
              />
            </Col>
            <Col span={6}>
              <Statistic
                prefix={<InboxOutlined />}
                title="物资调拨数"
                value={efficiencyMetrics.materialCount}
                suffix="次"
              />
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );

  const renderHistoryPanel = () => (
    <div>
      <Card
        title={
          <Space>
            <HistoryOutlined />
            历史案例库
          </Space>
        }
        extra={
          <Button
            icon={<BarChartOutlined />}
            onClick={() => handleViewEfficiency()}
          >
            查看效率指标
          </Button>
        }
      >
        <Form form={caseQueryForm} layout="inline" onFinish={handleCaseQuery} style={{ marginBottom: 16 }}>
          <Form.Item name="incidentType" label="灾害类型">
            <Select placeholder="全部" style={{ width: 150 }} allowClear>
              {Object.entries(INCIDENT_TYPE_MAP).map(([code, name]) => (
                <Option key={code} value={parseInt(code)}>{name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="incidentLevel" label="灾害级别">
            <Select placeholder="全部" style={{ width: 150 }} allowClear>
              {Object.entries(INCIDENT_LEVEL_MAP).map(([code, name]) => (
                <Option key={code} value={parseInt(code)}>{name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="isClassic" label="经典案例">
            <Select placeholder="全部" style={{ width: 120 }} allowClear>
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
          <Form.Item name="keyword" label="关键词">
            <Input placeholder="搜索标题、描述" style={{ width: 200 }} allowClear />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                查询
              </Button>
              <Button
                onClick={() => {
                  caseQueryForm.resetFields();
                  handleCaseQuery();
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {classicCases.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <Divider orientation="left">
              <Space>
                <BookOutlined />
                经典案例推荐
              </Space>
            </Divider>
            <Row gutter={16}>
              {classicCases.slice(0, 4).map((caseItem) => (
                <Col span={6} key={caseItem.id}>
                  <Card
                    hoverable
                    size="small"
                    onClick={() => handleViewCaseDetail(caseItem)}
                    style={{
                      background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.1) 0%, rgba(24, 144, 255, 0.05) 100%)',
                      border: '1px solid rgba(24, 144, 255, 0.3)',
                    }}
                  >
                    <Tag color="#faad14" style={{ marginBottom: 8 }}>经典案例</Tag>
                    <div style={{ fontWeight: 500, marginBottom: 8, height: 44, overflow: 'hidden' }}>
                      {caseItem.caseTitle}
                    </div>
                    <Space size="small" wrap>
                      <Tag color={INCIDENT_LEVEL_COLOR[caseItem.incidentLevel]}>
                        {INCIDENT_LEVEL_MAP[caseItem.incidentLevel]}
                      </Tag>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                        {dayjs(caseItem.occurredAt).format('YYYY-MM-DD')}
                      </span>
                    </Space>
                    <div style={{ marginTop: 8 }}>
                      {renderRatingStars(caseItem.overallRating)}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}

        <Divider orientation="left">案例列表</Divider>
        <Table
          loading={loading}
          dataSource={historyCases}
          rowKey="id"
          pagination={{
            ...casePagination,
            onChange: (page, pageSize) => {
              setCasePagination((prev) => ({ ...prev, current: page, pageSize }));
              handleCaseQuery();
            },
          }}
          columns={[
            {
              title: '案例编号',
              dataIndex: 'caseNo',
              width: 140,
              render: (text) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
            },
            {
              title: '案例标题',
              dataIndex: 'caseTitle',
              width: 240,
              ellipsis: true,
              render: (text, record) => (
                <Space>
                  {record.isClassic && <Tag color="#faad14">经典</Tag>}
                  <a onClick={() => handleViewCaseDetail(record)}>{text}</a>
                </Space>
              ),
            },
            {
              title: '灾害类型',
              dataIndex: 'incidentType',
              width: 100,
              render: (type) => INCIDENT_TYPE_MAP[type] || '未知',
            },
            {
              title: '灾害级别',
              dataIndex: 'incidentLevel',
              width: 100,
              render: (level) => (
                <Tag color={INCIDENT_LEVEL_COLOR[level]}>{INCIDENT_LEVEL_MAP[level]}</Tag>
              ),
            },
            {
              title: '发生地点',
              dataIndex: 'location',
              width: 150,
              ellipsis: true,
            },
            {
              title: '受灾人数',
              dataIndex: 'affectedPopulation',
              width: 100,
              render: (val) => `${val || 0}人`,
            },
            {
              title: '处置时长',
              dataIndex: 'durationHours',
              width: 100,
              render: (val) => `${val?.toFixed(1) || 0}小时`,
            },
            {
              title: '综合评分',
              dataIndex: 'overallRating',
              width: 120,
              render: (rating) => renderRatingStars(rating),
            },
            {
              title: '发生时间',
              dataIndex: 'occurredAt',
              width: 160,
              render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm'),
            },
            {
              title: '操作',
              width: 120,
              render: (_, record) => (
                <Space>
                  <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewCaseDetail(record)}>
                    查看
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<ComparisonOutlined />}
                    disabled={!selectedIncident}
                    onClick={() => {
                      comparisonForm.setFieldsValue({ targetCaseId: record.id });
                      setShowComparisonModal(true);
                    }}
                  >
                    对比
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );

  const renderComparisonPanel = () => (
    <div>
      <Card
        title={
          <Space>
            <ComparisonOutlined />
            案例对比分析
          </Space>
        }
        extra={
          <Space>
            <Select
              style={{ width: 300 }}
              placeholder="选择当前灾情"
              showSearch
              optionFilterProp="children"
              value={selectedIncident?.id}
              onChange={(id) => {
                const incident = closedIncidents.find((i) => i.id === id);
                setSelectedIncident(incident || null);
              }}
            >
              {closedIncidents.map((incident) => (
                <Option key={incident.id} value={incident.id}>
                  [{incident.incidentNo}] {incident.title}
                </Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!selectedIncident}
              onClick={() => setShowComparisonModal(true)}
            >
              新建对比
            </Button>
          </Space>
        }
      >
        {similarCases.length > 0 && selectedIncident && (
          <Alert
            type="info"
            showIcon
            message={
              <Space>
                <ThunderboltOutlined />
                为当前灾情匹配到 {similarCases.length} 个相似历史案例
              </Space>
            }
            description={
              <Space wrap style={{ marginTop: 8 }}>
                {similarCases.map((caseItem) => (
                  <Button
                    key={caseItem.id}
                    size="small"
                    onClick={() => {
                      comparisonForm.setFieldsValue({ targetCaseId: caseItem.id });
                      setShowComparisonModal(true);
                    }}
                  >
                    {caseItem.caseTitle}
                  </Button>
                ))}
              </Space>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        {comparisons.length === 0 ? (
          <Empty description={selectedIncident ? '暂无对比记录，点击上方按钮创建对比' : '请先选择灾情'} />
        ) : (
          <List
            dataSource={comparisons}
            renderItem={(comparison) => (
              <List.Item
                key={comparison.id}
                actions={[
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => {
                      setCurrentComparison(comparison);
                      setShowComparisonModal(true);
                    }}
                  >
                    查看详情
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span style={{ fontWeight: 500 }}>{comparison.comparisonResult}</span>
                      <Tag color={comparison.similarity >= 70 ? '#52c41a' : comparison.similarity >= 50 ? '#fa8c16' : '#ff4d4f'}>
                        相似度: {comparison.similarity?.toFixed(1)}%
                      </Tag>
                      <Tag color="#1890ff">{comparison.comparisonNo}</Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <Space size="large" style={{ marginBottom: 8 }}>
                        <span>创建时间: {dayjs(comparison.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                      </Space>
                      <Progress
                        percent={comparison.similarity}
                        strokeColor={{
                          '0%': '#1890ff',
                          '100%': comparison.similarity >= 70 ? '#52c41a' : '#fa8c16',
                        }}
                        style={{ width: 400 }}
                      />
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {currentComparison && (
        <Card
          title={
            <Space style={{ marginTop: 16 }}>
              <CopyOutlined />
              对比详情
            </Space>
          }
        >
          <Row gutter={16}>
            <Col span={12}>
              <Descriptions
                title={<Tag color="#1890ff">对比指标</Tag>}
                column={1}
                size="small"
              >
                <Descriptions.Item label="相似度">
                  <span style={{ color: renderScoreColor(currentComparison.similarity), fontWeight: 'bold' }}>
                    {currentComparison.similarity?.toFixed(1)}%
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="结论">{currentComparison.comparisonResult}</Descriptions.Item>
              </Descriptions>
            </Col>
            <Col span={12}>
              <Descriptions
                title={<Tag color="#52c41a">主要建议</Tag>}
                column={1}
                size="small"
              >
                <Descriptions.Item label="处置建议">
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>
                    {currentComparison.suggestions}
                  </pre>
                </Descriptions.Item>
              </Descriptions>
            </Col>
          </Row>
          <Divider />
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small" title="相似点分析" type="inner">
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>
                  {currentComparison.similarities || '暂无数据'}
                </pre>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="差异点分析" type="inner">
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>
                  {currentComparison.differences || '暂无数据'}
                </pre>
              </Card>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
    message.success('已退出登录');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <div
      className="app-container"
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Layout.Header
        style={{
          background: 'linear-gradient(to right, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          borderBottom: '1px solid #1e293b',
          padding: '0 16px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>急</span>
          </div>
          <h1
            style={{
              color: '#fff',
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
              background: 'linear-gradient(90deg, #1890ff, #52c41a)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            省级应急管理指挥系统
          </h1>

          <Space style={{ marginLeft: 32 }}>
            <Button
              type="text"
              icon={<DashboardOutlined />}
              onClick={() => navigate('/')}
              style={{
                color:
                  window.location.pathname === '/'
                    ? '#1890ff'
                    : 'rgba(255,255,255,0.65)',
                borderBottom:
                  window.location.pathname === '/'
                    ? '2px solid #1890ff'
                    : 'none',
                borderRadius: 0,
                height: 54,
              }}
            >
              指挥大屏
            </Button>
            <Button
              type="text"
              icon={<BookOutlined />}
              onClick={() => navigate('/review')}
              style={{
                color:
                  window.location.pathname === '/review'
                    ? '#1890ff'
                    : 'rgba(255,255,255,0.65)',
                borderBottom:
                  window.location.pathname === '/review'
                    ? '2px solid #1890ff'
                    : 'none',
                borderRadius: 0,
                height: 54,
              }}
            >
              复盘分析
            </Button>
          </Space>

          <span style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: 12, marginLeft: 8 }}>
            {new Date().toLocaleString('zh-CN')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tooltip title="刷新数据">
            <Button
              type="text"
              icon={<BarChartOutlined spin={loading} />}
              onClick={() => {
                loadClosedIncidents();
                queryHistoryCases({ pageNum: 1, pageSize: casePagination.pageSize });
                if (selectedIncident) {
                  loadArchives(selectedIncident.id);
                }
              }}
              style={{ color: 'rgba(255, 255, 255, 0.65)' }}
            />
          </Tooltip>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 8px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Avatar
                size={32}
                icon={<UserOutlined />}
                style={{ background: 'linear-gradient(135deg, #1890ff, #096dd9)' }}
              />
              <div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>
                  {user?.realName || '用户'}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                  {user?.roles?.[0]?.name || '管理员'}
                </div>
              </div>
            </div>
          </Dropdown>
        </div>
      </Layout.Header>

      <Layout className="review-layout" style={{ background: 'transparent', flex: 1 }}>
        <Sider
          className="review-sider"
          width={200}
          theme="dark"
          style={{ background: 'rgba(15, 23, 42, 0.8)', borderRight: '1px solid #1e293b' }}
        >
          <div style={{ padding: 20, borderBottom: '1px solid #1e293b' }}>
            <h3
              style={{
                color: '#fff',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <BookOutlined />
              复盘分析中心
            </h3>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[activeMenu]}
            style={{ background: 'transparent', borderRight: 'none', marginTop: 8 }}
            items={[
              {
                key: MenuKey.ARCHIVE,
                icon: <DatabaseOutlined />,
                label: '灾情归档与复盘',
                onClick: () => setActiveMenu(MenuKey.ARCHIVE),
              },
              {
                key: MenuKey.HISTORY,
                icon: <HistoryOutlined />,
                label: '历史案例库',
                onClick: () => setActiveMenu(MenuKey.HISTORY),
              },
              {
                key: MenuKey.COMPARISON,
                icon: <ComparisonOutlined />,
                label: '案例对比分析',
                onClick: () => setActiveMenu(MenuKey.COMPARISON),
              },
            ]}
          />
        </Sider>

        <Layout style={{ background: 'transparent' }}>
          <Content className="review-content" style={{ padding: 24 }}>
            {activeMenu === MenuKey.ARCHIVE && renderArchivePanel()}
            {activeMenu === MenuKey.HISTORY && renderHistoryPanel()}
            {activeMenu === MenuKey.COMPARISON && renderComparisonPanel()}
          </Content>
        </Layout>
      </Layout>

      <Modal
        title={
          <Space>
            <DatabaseOutlined />
            灾情归档
          </Space>
        }
        open={showArchiveModal}
        onCancel={() => {
          setShowArchiveModal(false);
          archiveForm.resetFields();
        }}
        footer={null}
        maskClosable={false}
      >
        {selectedIncident && (
          <>
            <Alert
              type="info"
              showIcon
              message="归档信息"
              description={
                <div>
                  <p style={{ margin: '4px 0' }}>
                    <strong>灾情编号：</strong>{selectedIncident.incidentNo}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>灾情标题：</strong>{selectedIncident.title}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>灾害类型：</strong>{INCIDENT_TYPE_MAP[selectedIncident.type]}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>结案时间：</strong>{dayjs(selectedIncident.closedAt).format('YYYY-MM-DD HH:mm')}
                  </p>
                </div>
              }
              style={{ marginBottom: 16 }}
            />
            <Form form={archiveForm} layout="vertical" onFinish={handleArchive}>
              <Form.Item
                name="archiveType"
                label="归档类型"
                rules={[{ required: true, message: '请选择归档类型' }]}
              >
                <Select placeholder="请选择归档类型">
                  <Option value="MANUAL">人工归档</Option>
                  <Option value="AUTO">系统归档</Option>
                  <Option value="PERIODIC">定期归档</Option>
                </Select>
              </Form.Item>
              <Form.Item name="archiveRemark" label="归档备注">
                <TextArea rows={3} placeholder="请输入归档备注信息（选填）" maxLength={500} showCount />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => {
                    setShowArchiveModal(false);
                    archiveForm.resetFields();
                  }}>
                    取消
                  </Button>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    确认归档
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <FileTextOutlined />
            生成复盘报告
          </Space>
        }
        open={showReviewModal}
        onCancel={() => {
          setShowReviewModal(false);
          reviewForm.resetFields();
        }}
        footer={null}
        width={600}
        maskClosable={false}
      >
        {currentArchive && selectedIncident && (
          <>
            <Alert
              type="success"
              showIcon
              message="归档信息已确认"
              description={`归档编号: ${currentArchive.archiveNo}，系统将自动收集全流程操作日志和相关数据生成复盘报告`}
              style={{ marginBottom: 16 }}
            />
            <Form form={reviewForm} layout="vertical" onFinish={handleGenerateReview}>
              <Form.Item
                name="title"
                label="报告标题"
                rules={[{ required: true, message: '请输入报告标题' }]}
              >
                <Input
                  placeholder="请输入复盘报告标题"
                  defaultValue={`${INCIDENT_TYPE_MAP[selectedIncident.type]}处置复盘报告 - ${selectedIncident.title}`}
                  showCount
                  maxLength={200}
                />
              </Form.Item>
              <Form.Item name="reportType" label="报告类型">
                <Select placeholder="请选择报告类型" defaultValue="AUTO">
                  <Option value="AUTO">自动生成</Option>
                  <Option value="STANDARD">标准报告</Option>
                  <Option value="SIMPLIFIED">简化报告</Option>
                  <Option value="DETAILED">详细报告</Option>
                </Select>
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="existingProblems" label="存在的问题">
                    <TextArea rows={3} placeholder="请描述本次处置中存在的问题" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="improvementMeasures" label="改进措施">
                    <TextArea rows={3} placeholder="请描述针对问题的改进措施" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="lessonsLearned" label="经验教训总结">
                <TextArea rows={3} placeholder="请描述本次处置的经验教训" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => {
                    setShowReviewModal(false);
                    reviewForm.resetFields();
                  }}>
                    取消
                  </Button>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    生成报告
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <FileTextOutlined />
            复盘报告详情
          </Space>
        }
        open={showReportDetail}
        onCancel={() => {
          setShowReportDetail(false);
          setCurrentReport(null);
        }}
        width={800}
        footer={[
          currentReport?.status === 1 && (
            <Button key="approve" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApproveReport(currentReport)}>
              审核通过
            </Button>
          ),
          <Button key="close" onClick={() => {
            setShowReportDetail(false);
            setCurrentReport(null);
          }}>
            关闭
          </Button>,
        ]}
      >
        {currentReport && (
          <Tabs defaultActiveKey="basic">
            <TabPane tab="基本信息" key="basic">
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="报告编号">{currentReport.reportNo}</Descriptions.Item>
                <Descriptions.Item label="报告类型">
                  {currentReport.reportType === 'AUTO' ? '自动生成' : '人工编制'}
                </Descriptions.Item>
                <Descriptions.Item label="关联灾情编号">{selectedIncident?.incidentNo}</Descriptions.Item>
                <Descriptions.Item label="归档编号">{currentReport.archiveId}</Descriptions.Item>
                <Descriptions.Item label="响应时长" span={2}>
                  {currentReport.responseDuration?.toFixed(2)} 小时
                </Descriptions.Item>
                <Descriptions.Item label="生成时间">
                  {dayjs(currentReport.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={currentReport.status === 1 ? '#fa8c16' : '#52c41a'}>
                    {currentReport.status === 1 ? '待审核' : '已审核'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>

              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="调度方案"
                      value={currentReport.dispatchCount}
                      suffix="个"
                      prefix={<RocketOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="调用队伍"
                      value={currentReport.teamCount}
                      suffix="支"
                      prefix={<TeamOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="物资调拨"
                      value={currentReport.materialCount}
                      suffix="次"
                      prefix={<InboxOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="综合评分"
                      value={currentReport.overallScore?.toFixed(1)}
                      suffix="分"
                      valueStyle={{ color: renderScoreColor(currentReport.overallScore || 0) }}
                    />
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab="灾情总结" key="summary">
              <Card size="small" title="灾情概要" type="inner" style={{ marginBottom: 12 }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentReport.incidentSummary}</pre>
              </Card>
              <Card size="small" title="响应过程" type="inner" style={{ marginBottom: 12 }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentReport.responseProcess}</pre>
              </Card>
              <Card size="small" title="时效分析" type="inner" style={{ marginBottom: 12 }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentReport.timelinessAnalysis}</pre>
              </Card>
              <Card size="small" title="资源利用" type="inner">
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentReport.resourceUtilization}</pre>
              </Card>
            </TabPane>

            <TabPane tab="问题与改进" key="improvement">
              <Card size="small" title="存在的问题" type="inner" style={{ marginBottom: 12 }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentReport.existingProblems || '暂无'}</pre>
              </Card>
              <Card size="small" title="改进措施" type="inner" style={{ marginBottom: 12 }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentReport.improvementMeasures || '暂无'}</pre>
              </Card>
              <Card size="small" title="经验教训" type="inner">
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentReport.lessonsLearned || '暂无'}</pre>
              </Card>
            </TabPane>

            <TabPane tab="评分详情" key="scores">
              <Row gutter={16}>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="响应时效"
                      value={currentReport.timelinessScore?.toFixed(1)}
                      suffix="分"
                      valueStyle={{ color: renderScoreColor(currentReport.timelinessScore || 0) }}
                    />
                    <Progress
                      percent={currentReport.timelinessScore}
                      strokeColor={renderScoreColor(currentReport.timelinessScore || 0)}
                      style={{ marginTop: 12 }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="资源利用"
                      value={currentReport.resourceScore?.toFixed(1)}
                      suffix="分"
                      valueStyle={{ color: renderScoreColor(currentReport.resourceScore || 0) }}
                    />
                    <Progress
                      percent={currentReport.resourceScore}
                      strokeColor={renderScoreColor(currentReport.resourceScore || 0)}
                      style={{ marginTop: 12 }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="处置效率"
                      value={currentReport.efficiencyScore?.toFixed(1)}
                      suffix="分"
                      valueStyle={{ color: renderScoreColor(currentReport.efficiencyScore || 0) }}
                    />
                    <Progress
                      percent={currentReport.efficiencyScore}
                      strokeColor={renderScoreColor(currentReport.efficiencyScore || 0)}
                      style={{ marginTop: 12 }}
                    />
                  </Card>
                </Col>
              </Row>
              <div style={{ textAlign: 'center', marginTop: 24, padding: 24, background: 'rgba(24, 144, 255, 0.05)', borderRadius: 8 }}>
                <Statistic
                  title="综合评分"
                  value={currentReport.overallScore?.toFixed(1)}
                  suffix="分"
                  valueStyle={{ fontSize: 48, color: renderScoreColor(currentReport.overallScore || 0), fontWeight: 'bold' }}
                />
                <div style={{ marginTop: 12 }}>
                  {renderRatingStars(calculateRatingFromScore(currentReport.overallScore || 0))}
                </div>
              </div>
            </TabPane>
          </Tabs>
        )}
      </Modal>

      <Drawer
        title={
          <Space>
            <PlayCircleOutlined />
            处置全流程时间轴
          </Space>
        }
        placement="right"
        width={600}
        open={showTimelineDrawer}
        onClose={() => {
          setShowTimelineDrawer(false);
          setTimelineData(null);
        }}
        extra={
          <Button size="small" icon={<DownloadOutlined />}>
            导出时间轴
          </Button>
        }
      >
        {timelineData && timelineData.events && (
          <>
            <Alert
              type="info"
              showIcon
              message={`共记录 ${timelineData.totalEvents} 个关键节点`}
              style={{ marginBottom: 16 }}
            />
            <Timeline
              mode="left"
              items={timelineData.events.map((event: any, index: number) => ({
                color: getTimelineColor(event.type),
                label: dayjs(event.time).format('YYYY-MM-DD HH:mm:ss'),
                children: (
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      <Tag color={getTimelineTagColor(event.type)}>{event.type}</Tag>
                      {event.title}
                    </div>
                    {event.operator && (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                        操作人: {event.operator}
                      </div>
                    )}
                    {event.remark && (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
                        {event.remark}
                      </div>
                    )}
                    {event.beforeStatus && event.afterStatus && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <span style={{ color: 'rgba(255,255,255,0.45)' }}>状态流转：</span>
                        <span style={{ color: '#fa8c16' }}>{event.beforeStatus}</span>
                        <span style={{ color: 'rgba(255,255,255,0.45)', margin: '0 8px' }}>→</span>
                        <span style={{ color: '#52c41a' }}>{event.afterStatus}</span>
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          </>
        )}
      </Drawer>

      <Modal
        title={
          <Space>
            <HistoryOutlined />
            历史案例详情
          </Space>
        }
        open={showCaseDetail}
        onCancel={() => {
          setShowCaseDetail(false);
          setCurrentCase(null);
        }}
        width={700}
        footer={[
          <Button key="compare" type="primary" icon={<ComparisonOutlined />} disabled={!selectedIncident} onClick={() => {
            comparisonForm.setFieldsValue({ targetCaseId: currentCase?.id });
            setShowComparisonModal(true);
            setShowCaseDetail(false);
          }}>
            与当前灾情对比
          </Button>,
          <Button key="close" onClick={() => {
            setShowCaseDetail(false);
            setCurrentCase(null);
          }}>
            关闭
          </Button>,
        ]}
      >
        {currentCase && (
          <Tabs defaultActiveKey="basic">
            <TabPane tab="基本信息" key="basic">
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="案例编号">{currentCase.caseNo}</Descriptions.Item>
                <Descriptions.Item label="案例标题">{currentCase.caseTitle}</Descriptions.Item>
                <Descriptions.Item label="灾害类型">
                  {INCIDENT_TYPE_MAP[currentCase.incidentType]}
                </Descriptions.Item>
                <Descriptions.Item label="灾害级别">
                  <Tag color={INCIDENT_LEVEL_COLOR[currentCase.incidentLevel]}>
                    {INCIDENT_LEVEL_MAP[currentCase.incidentLevel]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="发生地点">{currentCase.location}</Descriptions.Item>
                <Descriptions.Item label="区域编码">{currentCase.regionCode}</Descriptions.Item>
                <Descriptions.Item label="发生时间">
                  {dayjs(currentCase.occurredAt).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="结束时间">
                  {dayjs(currentCase.endedAt).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="处置时长">
                  {currentCase.durationHours?.toFixed(2)} 小时
                </Descriptions.Item>
                <Descriptions.Item label="综合评价">
                  {renderRatingStars(currentCase.overallRating)}
                </Descriptions.Item>
                <Descriptions.Item label="受灾人数" span={2}>
                  {currentCase.affectedPopulation || 0} 人
                </Descriptions.Item>
                <Descriptions.Item label="伤亡人数">
                  {currentCase.casualtyCount || 0} 人
                </Descriptions.Item>
                <Descriptions.Item label="直接损失">
                  {currentCase.directLoss?.toLocaleString() || 0} 元
                </Descriptions.Item>
                {currentCase.isClassic && (
                  <Descriptions.Item label="经典案例">
                    <Tag color="#faad14">是</Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </TabPane>

            <TabPane tab="处置详情" key="detail">
              <Card size="small" title="案例描述" type="inner" style={{ marginBottom: 12 }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentCase.description || '暂无'}</pre>
              </Card>
              <Card size="small" title="关键措施" type="inner" style={{ marginBottom: 12 }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentCase.keyMeasures || '暂无'}</pre>
              </Card>
              <Card size="small" title="主要经验" type="inner" style={{ marginBottom: 12 }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentCase.mainExperiences || '暂无'}</pre>
              </Card>
              <Card size="small" title="经验教训" type="inner" style={{ marginBottom: 12 }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentCase.lessonsLearned || '暂无'}</pre>
              </Card>
              <Card size="small" title="响应效率" type="inner" style={{ marginBottom: 12 }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentCase.responseEfficiency || '暂无'}</pre>
              </Card>
              <Card size="small" title="资源调配" type="inner">
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentCase.resourceAllocation || '暂无'}</pre>
              </Card>
            </TabPane>
          </Tabs>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <ComparisonOutlined />
            创建案例对比
          </Space>
        }
        open={showComparisonModal}
        onCancel={() => {
          setShowComparisonModal(false);
          comparisonForm.resetFields();
          setCurrentComparison(null);
        }}
        footer={null}
        width={520}
        maskClosable={false}
      >
        {selectedIncident && (
          <>
            <Alert
              type="info"
              showIcon
              message="对比信息"
              description={
                <div>
                  <p style={{ margin: '4px 0' }}>
                    <strong>当前灾情：</strong>[{selectedIncident.incidentNo}] {selectedIncident.title}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>灾害类型：</strong>{INCIDENT_TYPE_MAP[selectedIncident.type]}
                    <Tag color={INCIDENT_LEVEL_COLOR[selectedIncident.level]} style={{ marginLeft: 8 }}>
                      {INCIDENT_LEVEL_MAP[selectedIncident.level]}
                    </Tag>
                  </p>
                </div>
              }
              style={{ marginBottom: 16 }}
            />
            {currentComparison ? (
              <div>
                <Card size="small" title="对比结果" type="inner">
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <Statistic
                      title="相似度"
                      value={currentComparison.similarity?.toFixed(1)}
                      suffix="%"
                      valueStyle={{ color: renderScoreColor(currentComparison.similarity || 0) }}
                    />
                    <Progress
                      percent={currentComparison.similarity}
                      strokeColor={renderScoreColor(currentComparison.similarity || 0)}
                      style={{ width: '60%', margin: '0 auto' }}
                    />
                  </div>
                  <Divider />
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="结论">{currentComparison.comparisonResult}</Descriptions.Item>
                    <Descriptions.Item label="相似点">
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>
                        {currentComparison.similarities}
                      </pre>
                    </Descriptions.Item>
                    <Descriptions.Item label="差异点">
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>
                        {currentComparison.differences}
                      </pre>
                    </Descriptions.Item>
                    <Descriptions.Item label="处置建议">
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>
                        {currentComparison.suggestions}
                      </pre>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </div>
            ) : (
              <Form form={comparisonForm} layout="vertical" onFinish={handleCompareWithCase}>
                <Form.Item
                  name="targetCaseId"
                  label="选择历史案例"
                  rules={[{ required: true, message: '请选择要对比的历史案例' }]}
                >
                  <Select
                    placeholder="请选择要对比的历史案例"
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {historyCases.concat(classicCases).map((caseItem) => (
                      <Option key={caseItem.id} value={caseItem.id}>
                        [{caseItem.caseNo}] {caseItem.caseTitle}
                        {caseItem.isClassic && ' ★'}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="comparisonMetrics" label="对比指标（可选）">
                  <Select
                    mode="multiple"
                    placeholder="选择对比指标，留空则使用默认指标"
                    options={[
                      { value: '灾害类型', label: '灾害类型' },
                      { value: '灾害级别', label: '灾害级别' },
                      { value: '受灾人数', label: '受灾人数' },
                      { value: '响应时间', label: '响应时间' },
                      { value: '处置时长', label: '处置时长' },
                      { value: '资源调配', label: '资源调配' },
                      { value: '伤亡损失', label: '伤亡损失' },
                    ]}
                  />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                  <Space>
                    <Button onClick={() => {
                      setShowComparisonModal(false);
                      comparisonForm.resetFields();
                    }}>
                      取消
                    </Button>
                    <Button type="primary" htmlType="submit" loading={loading}>
                      开始对比
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            )}
          </>
        )}
      </Modal>
    </Layout>
  );
};

function calculateRatingFromScore(score: number): number {
  if (score >= 90) return 5;
  if (score >= 80) return 4;
  if (score >= 70) return 3;
  if (score >= 60) return 2;
  return 1;
}

function getTimelineColor(type: string): string {
  const colorMap: Record<string, string> = {
    OCCURRENCE: 'red',
    REPORT: 'orange',
    LEVEL_UPGRADE: 'magenta',
    DISPATCH_GENERATE: 'blue',
    DISPATCH_APPROVE: 'cyan',
    RESOURCE_ALLOCATE: 'green',
    STATUS_CHANGE: 'purple',
    ARCHIVE: 'gray',
    REVIEW_GENERATE: 'gold',
  };
  return colorMap[type] || 'blue';
}

function getTimelineTagColor(type: string): string {
  const colorMap: Record<string, string> = {
    OCCURRENCE: '#ff4d4f',
    REPORT: '#fa8c16',
    LEVEL_UPGRADE: '#eb2f96',
    DISPATCH_GENERATE: '#1890ff',
    DISPATCH_APPROVE: '#13c2c2',
    RESOURCE_ALLOCATE: '#52c41a',
    STATUS_CHANGE: '#722ed1',
    ARCHIVE: '#8c8c8c',
    REVIEW_GENERATE: '#faad14',
  };
  return colorMap[type] || '#1890ff';
}

export default ReviewAnalysis;
