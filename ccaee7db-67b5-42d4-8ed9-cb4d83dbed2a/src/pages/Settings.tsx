import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Tabs,
  Form,
  Switch,
  Slider,
  Input,
  Select,
  Button,
  Space,
  Row,
  Col,
  Radio,
  Avatar,
  Table,
  Tag,
  message,
  Descriptions,
  Divider,
  Tooltip,
  Alert,
  Typography,
  Checkbox,
} from 'antd';
import {
  BellOutlined,
  DesktopOutlined,
  NotificationOutlined,
  UserOutlined,
  SafetyOutlined,
  SoundOutlined,
  MessageOutlined,
  PhoneOutlined,
  SendOutlined,
  LockOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useDutyStore } from '@/stores/dutyStore';
import { useMonitorStore } from '@/stores/monitorStore';
import type { AlarmLevel, AlarmType, MonitorLayoutType } from '@/types';

const { Text, Title, Paragraph } = Typography;

// 告警类型中文名称
const TYPE_LABELS: Record<AlarmType, string> = {
  signal_loss: '信号中断',
  black_frame: '黑场检测',
  static_frame: '静帧检测',
  audio_loss: '音频丢失',
  bitrate_error: '码率异常',
  device_offline: '设备离线',
};

// 告警级别中文名称
const LEVEL_LABELS: Record<AlarmLevel, string> = {
  urgent: '紧急',
  important: '重要',
  general: '一般',
};

// 告警级别颜色
const LEVEL_COLORS: Record<AlarmLevel, string> = {
  urgent: '#ff4d4f',
  important: '#faad14',
  general: '#1890ff',
};

// 通知方式选项
const NOTIFY_OPTIONS = [
  { label: '声音', value: 'sound', icon: <SoundOutlined /> },
  { label: '弹窗', value: 'popup', icon: <MessageOutlined /> },
  { label: '短信', value: 'sms', icon: <NotificationOutlined /> },
  { label: '电话', value: 'call', icon: <PhoneOutlined /> },
];

// 主题配置
const THEMES = {
  dark: {
    name: '深色模式',
    primary: '#1677ff',
    bg: '#0f172a',
    text: '#ffffff',
    desc: '适合夜间长时间监控使用',
  },
  light: {
    name: '浅色模式',
    primary: '#1677ff',
    bg: '#f5f7fa',
    text: '#1f2937',
    desc: '白天光线充足时推荐使用',
  },
  eye: {
    name: '护眼模式',
    primary: '#52c41a',
    bg: '#c7edcc',
    text: '#3f6600',
    desc: '降低蓝光，缓解视觉疲劳',
  },
};

// 监控墙布局选项
const LAYOUT_OPTIONS: { label: string; value: MonitorLayoutType }[] = [
  { label: '1×1 单画面', value: '1x1' },
  { label: '2×2 四画面', value: '2x2' },
  { label: '3×3 九画面', value: '3x3' },
  { label: '4×4 十六画面', value: '4x4' },
];

// 告警阈值配置项类型
interface ThresholdConfig {
  type: AlarmType;
  level: AlarmLevel;
  threshold: number;
  unit: string;
  enabled: boolean;
  notify: string[];
  desc: string;
}

// 权限列表数据
const PERMISSION_TABLE_DATA = [
  {
    key: '1',
    code: 'monitor:view',
    name: '监控画面查看',
    category: '监控管理',
    desc: '查看所有监控频道画面及实时数据',
    granted: true,
  },
  {
    key: '2',
    code: 'monitor:control',
    name: '监控墙布局管理',
    category: '监控管理',
    desc: '调整监控墙布局、切换频道、拖拽排序',
    granted: true,
  },
  {
    key: '3',
    code: 'alarm:view',
    name: '告警信息查看',
    category: '告警管理',
    desc: '查看实时告警、历史告警及统计分析',
    granted: true,
  },
  {
    key: '4',
    code: 'alarm:handle',
    name: '告警处理',
    category: '告警管理',
    desc: '确认告警、分派处理、记录处理结果',
    granted: true,
  },
  {
    key: '5',
    code: 'alarm:config',
    name: '告警规则配置',
    category: '告警管理',
    desc: '修改告警阈值、通知方式、合并规则',
    granted: false,
  },
  {
    key: '6',
    code: 'station:view',
    name: '机房信息查看',
    category: '机房管理',
    desc: '查看机房详情、拓扑结构、运行指标',
    granted: true,
  },
  {
    key: '7',
    code: 'station:control',
    name: '机房远程控制',
    category: '机房管理',
    desc: '远程重启设备、切换备用信号、启动预案',
    granted: false,
  },
  {
    key: '8',
    code: 'duty:handover',
    name: '交接班管理',
    category: '值班管理',
    desc: '创建交接班记录、确认交接班',
    granted: true,
  },
  {
    key: '9',
    code: 'duty:schedule',
    name: '排班表管理',
    category: '值班管理',
    desc: '调整排班计划、设置值班人员',
    granted: false,
  },
  {
    key: '10',
    code: 'system:settings',
    name: '系统设置',
    category: '系统管理',
    desc: '修改系统配置、通知设置、主题切换',
    granted: true,
  },
  {
    key: '11',
    code: 'system:user',
    name: '用户管理',
    category: '系统管理',
    desc: '新增/删除用户、分配角色权限',
    granted: false,
  },
  {
    key: '12',
    code: 'system:export',
    name: '数据导出',
    category: '系统管理',
    desc: '导出告警记录、运行报告、统计报表',
    granted: true,
  },
];

// 系统设置页面组件
const Settings: React.FC = () => {
  // 当前激活的Tab
  const [activeKey, setActiveKey] = useState('alarm');

  // 从Store获取数据
  const { currentUser, dutyStatistics } = useDutyStore();
  const { layout, setLayout, toggleAlarmMuted, alarmMuted } = useMonitorStore();

  // ========== Tab1：告警规则配置表单 ==========
  const [alarmForm] = Form.useForm();

  // 6类告警阈值配置（默认值）
  const initialThresholds: ThresholdConfig[] = useMemo(() => [
    { type: 'signal_loss', level: 'urgent', threshold: 30, unit: '秒', enabled: true, notify: ['sound', 'popup', 'sms', 'call'], desc: '信号丢失超过此时长触发告警' },
    { type: 'black_frame', level: 'important', threshold: 10, unit: '秒', enabled: true, notify: ['sound', 'popup', 'sms'], desc: '连续黑帧超过此时长触发告警' },
    { type: 'static_frame', level: 'important', threshold: 60, unit: '秒', enabled: true, notify: ['sound', 'popup'], desc: '画面静止超过此时长触发告警' },
    { type: 'audio_loss', level: 'important', threshold: 15, unit: '秒', enabled: true, notify: ['sound', 'popup', 'sms'], desc: '主声道音频丢失超过此时长触发' },
    { type: 'bitrate_error', level: 'general', threshold: 30, unit: '%', enabled: true, notify: ['popup'], desc: '码率波动超过阈值百分比触发' },
    { type: 'device_offline', level: 'urgent', threshold: 60, unit: '秒', enabled: true, notify: ['sound', 'popup', 'sms', 'call'], desc: '设备心跳超时超过此时长触发' },
  ], []);

  // 阈值配置本地状态
  const [thresholds, setThresholds] = useState<ThresholdConfig[]>(initialThresholds);

  // 更新单个阈值配置
  const updateThreshold = (index: number, patch: Partial<ThresholdConfig>) => {
    setThresholds((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    );
  };

  // 保存告警规则
  const handleSaveAlarmConfig = async () => {
    try {
      await alarmForm.validateFields();
      message.loading({ content: '正在保存告警规则配置...', key: 'save-alarm' });
      setTimeout(() => {
        message.success({ content: '告警规则配置已保存并生效', key: 'save-alarm' });
      }, 800);
    } catch {
      message.warning('请检查表单填写是否正确');
    }
  };

  // ========== Tab2：显示设置表单 ==========
  const [displayForm] = Form.useForm();

  // 当前主题
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light' | 'eye'>('dark');

  // 保存显示设置
  const handleSaveDisplayConfig = async () => {
    try {
      const values = await displayForm.validateFields();
      // 应用主题CSS变量
      const theme = THEMES[currentTheme];
      const root = document.documentElement;
      root.style.setProperty('--primary-color', theme.primary);
      root.style.setProperty('--bg-color', theme.bg);
      root.style.setProperty('--text-color', theme.text);
      // 应用监控墙布局
      if (values.defaultLayout) {
        setLayout(values.defaultLayout);
      }
      message.loading({ content: '正在保存显示设置...', key: 'save-display' });
      setTimeout(() => {
        message.success({
          content: `显示设置已保存，当前主题：${theme.name}`,
          key: 'save-display',
        });
      }, 600);
    } catch {
      message.warning('请检查配置项');
    }
  };

  // ========== Tab3：通知设置表单 ==========
  const [notifyForm] = Form.useForm();

  // 测试通知
  const handleTestNotify = async () => {
    try {
      const values = await notifyForm.validateFields();
      message.loading({ content: '正在发送测试通知...', key: 'test-notify' });
      setTimeout(() => {
        const methods: string[] = [];
        if (values.urgentNotify?.includes('sound')) methods.push('声音');
        if (values.urgentNotify?.includes('popup')) methods.push('弹窗');
        if (values.urgentNotify?.includes('sms')) methods.push('短信');
        if (values.urgentNotify?.includes('call')) methods.push('电话');
        message.success({
          content: `测试通知已发送：${methods.join('、') || '无'}，值班电话 ${values.dutyPhone || '未设置'}`,
          key: 'test-notify',
        });
      }, 1200);
    } catch {
      message.warning('请先填写通知配置');
    }
  };

  // 保存通知设置
  const handleSaveNotifyConfig = async () => {
    try {
      await notifyForm.validateFields();
      message.loading({ content: '正在保存通知设置...', key: 'save-notify' });
      setTimeout(() => {
        message.success({ content: '通知设置已保存', key: 'save-notify' });
      }, 600);
    } catch {
      message.warning('请检查配置项');
    }
  };

  // ========== Tab4：账户与权限 ==========
  const [passwordForm] = Form.useForm();

  // 修改密码
  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      if (values.newPassword !== values.confirmPassword) {
        message.error('两次输入的新密码不一致');
        return;
      }
      if (values.newPassword === values.oldPassword) {
        message.warning('新密码不能与原密码相同');
        return;
      }
      message.loading({ content: '正在修改密码...', key: 'change-pwd' });
      setTimeout(() => {
        message.success({ content: '密码修改成功，请妥善保管', key: 'change-pwd' });
        passwordForm.resetFields();
      }, 1000);
    } catch {
      message.warning('请完整填写密码表单');
    }
  };

  // 权限列表表格列
  const permissionColumns = [
    {
      title: '权限类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (cat: string) => <Tag color="blue">{cat}</Tag>,
    },
    {
      title: '权限名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '权限代码',
      dataIndex: 'code',
      key: 'code',
      width: 180,
      render: (code: string) => (
        <Text code style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 4 }}>
          {code}
        </Text>
      ),
    },
    {
      title: '说明',
      dataIndex: 'desc',
      key: 'desc',
      ellipsis: true,
    },
    {
      title: '授权状态',
      dataIndex: 'granted',
      key: 'granted',
      width: 110,
      align: 'center' as const,
      render: (granted: boolean) =>
        granted ? (
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>
            已授权
          </Tag>
        ) : (
          <Tag color="default" style={{ margin: 0 }}>
            未授权
          </Tag>
        ),
    },
  ];

  // 页面初始化：设置表单默认值
  useEffect(() => {
    alarmForm.setFieldsValue({
      smartMerge: true,
      suppressRule: true,
      mergeWindow: 5,
    });
    displayForm.setFieldsValue({
      numberAnimation: true,
      defaultLayout: layout,
      autoScroll: true,
      refreshRate: 1000,
    });
    notifyForm.setFieldsValue({
      dutyPhone: currentUser.phone,
      urgentNotify: ['sound', 'popup', 'sms', 'call'],
      importantNotify: ['sound', 'popup', 'sms'],
      generalNotify: ['popup'],
    });
  }, [layout, currentUser.phone]);

  // ========== Tab配置项 ==========
  const tabItems = [
    {
      key: 'alarm',
      label: (
        <Space size={8}>
          <BellOutlined />
          <span>告警规则配置</span>
        </Space>
      ),
      children: (
        <div style={{ padding: '8px 4px 16px' }}>
          <Alert
            type="info"
            showIcon
            message="告警规则配置"
            description="调整以下参数来控制告警的触发条件、合并逻辑和通知方式。保存后将立即对全系统生效，请谨慎修改。"
            style={{ marginBottom: 20 }}
          />
          <Form<{
            smartMerge: boolean;
            suppressRule: boolean;
            mergeWindow: number;
          }>
            form={alarmForm}
            layout="vertical"
            initialValues={{ smartMerge: true, suppressRule: true, mergeWindow: 5 }}
          >
            {/* 顶部开关和滑块区 */}
            <Card size="small" title="通用规则" style={{ marginBottom: 16 }}>
              <Row gutter={[24, 16]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label={
                      <Space size={6}>
                        <span>启用智能告警合并</span>
                        <Tooltip title="相同机房、频道、类型的告警在时间窗口内自动合并为一条，避免告警风暴">
                          <BulbOutlined style={{ color: '#faad14' }} />
                        </Tooltip>
                      </Space>
                    }
                    name="smartMerge"
                    valuePropName="checked"
                    style={{ marginBottom: 0 }}
                  >
                    <Switch checkedChildren="已启用" unCheckedChildren="已禁用" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label={
                      <Space size={6}>
                        <span>启用告警抑制规则</span>
                        <Tooltip title="高级别告警存在时自动抑制低级别同类告警，减少信息干扰">
                          <BulbOutlined style={{ color: '#faad14' }} />
                        </Tooltip>
                      </Space>
                    }
                    name="suppressRule"
                    valuePropName="checked"
                    style={{ marginBottom: 0 }}
                  >
                    <Switch checkedChildren="已启用" unCheckedChildren="已禁用" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label={
                      <Space size={6}>
                        <span>合并时间窗口</span>
                        <Tag color="blue">{alarmForm.getFieldValue('mergeWindow') || 5} 分钟</Tag>
                      </Space>
                    }
                    name="mergeWindow"
                    style={{ marginBottom: 0 }}
                  >
                    <Slider min={1} max={30} step={1} marks={{ 1: '1', 5: '5', 15: '15', 30: '30' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 告警阈值配置列表 */}
            <Card
              size="small"
              title={
                <Space size={8}>
                  <SafetyOutlined style={{ color: '#1677ff' }} />
                  <span>告警阈值配置（6类）</span>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <div
                style={{
                  overflowX: 'auto',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <th style={thStyle}>告警类型</th>
                      <th style={thStyle}>告警级别</th>
                      <th style={thStyle}>触发阈值</th>
                      <th style={thStyle}>启用状态</th>
                      <th style={thStyle}>通知方式</th>
                      <th style={thStyle}>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {thresholds.map((t, idx) => (
                      <tr key={t.type} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={tdStyle}>
                          <Space size={6}>
                            <WarningBadge level={t.level} />
                            <Text strong>{TYPE_LABELS[t.type]}</Text>
                          </Space>
                        </td>
                        <td style={tdStyle}>
                          <Select
                            size="small"
                            value={t.level}
                            onChange={(v) => updateThreshold(idx, { level: v })}
                            options={Object.entries(LEVEL_LABELS).map(([value, label]) => ({
                              label: (
                                <Space size={4}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      background: LEVEL_COLORS[value as AlarmLevel],
                                    }}
                                  />
                                  {label}
                                </Space>
                              ),
                              value,
                            }))}
                            style={{ width: 100 }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <Space size={4}>
                            <InputNumberMini
                              value={t.threshold}
                              onChange={(v) => updateThreshold(idx, { threshold: Number(v) || 0 })}
                            />
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{t.unit}</span>
                          </Space>
                        </td>
                        <td style={tdStyle}>
                          <Switch
                            size="small"
                            checked={t.enabled}
                            checkedChildren="开"
                            unCheckedChildren="关"
                            onChange={(v) => updateThreshold(idx, { enabled: v })}
                          />
                        </td>
                        <td style={tdStyle}>
                          <Select
                            mode="multiple"
                            size="small"
                            value={t.notify}
                            onChange={(v) => updateThreshold(idx, { notify: v })}
                            options={NOTIFY_OPTIONS}
                            style={{ minWidth: 180 }}
                            maxTagCount="responsive"
                            placeholder="选择通知方式"
                          />
                        </td>
                        <td style={tdStyle}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t.desc}
                          </Text>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 底部操作按钮 */}
            <Space size={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setThresholds(initialThresholds);
                  alarmForm.resetFields();
                  message.success('已重置为默认配置');
                }}
              >
                重置默认
              </Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAlarmConfig}>
                保存配置
              </Button>
            </Space>
          </Form>
        </div>
      ),
    },
    {
      key: 'display',
      label: (
        <Space size={8}>
          <DesktopOutlined />
          <span>显示设置</span>
        </Space>
      ),
      children: (
        <div style={{ padding: '8px 4px 16px' }}>
          <Alert
            type="info"
            showIcon
            message="显示设置"
            description="配置界面主题、动画效果、监控墙默认布局等显示相关参数。主题切换将立即生效。"
            style={{ marginBottom: 20 }}
          />
          <Form
            form={displayForm}
            layout="vertical"
            initialValues={{ numberAnimation: true, defaultLayout: '3x3', autoScroll: true, refreshRate: 1000 }}
          >
            {/* 主题选择区 */}
            <Card size="small" title="主题选择" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">
                  选择系统配色方案，当前选择：
                  <Tag color={currentTheme === 'dark' ? 'default' : currentTheme === 'light' ? 'blue' : 'green'}>
                    {THEMES[currentTheme].name}
                  </Tag>
                </Text>
              </div>
              <Radio.Group
                value={currentTheme}
                onChange={(e) => setCurrentTheme(e.target.value)}
                style={{ width: '100%' }}
              >
                <Row gutter={[16, 16]}>
                  {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map((key) => {
                    const theme = THEMES[key];
                    return (
                      <Col xs={24} md={8} key={key}>
                        <Radio.Button
                          value={key}
                          style={{
                            width: '100%',
                            height: 'auto',
                            padding: '16px 20px',
                            background: key === currentTheme ? 'rgba(22,119,255,0.1)' : 'rgba(255,255,255,0.02)',
                            borderColor: key === currentTheme ? '#1677ff' : 'rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            lineHeight: 1.4,
                          }}
                        >
                          <Space direction="vertical" size={6} style={{ width: '100%' }}>
                            <Space size={8}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  background: theme.bg,
                                  border: `2px solid ${theme.primary}`,
                                  flexShrink: 0,
                                }}
                              />
                              <Text strong>{theme.name}</Text>
                            </Space>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {theme.desc}
                            </Text>
                          </Space>
                        </Radio.Button>
                      </Col>
                    );
                  })}
                </Row>
              </Radio.Group>
            </Card>

            {/* 布局与动画配置 */}
            <Card size="small" title="界面与动画" style={{ marginBottom: 16 }}>
              <Row gutter={[24, 20]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="数字滚动动画"
                    name="numberAnimation"
                    valuePropName="checked"
                    style={{ marginBottom: 0 }}
                    extra={<Text type="secondary" style={{ fontSize: 11 }}>统计卡片数字变化时启用平滑动画</Text>}
                  >
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="告警列表自动滚动"
                    name="autoScroll"
                    valuePropName="checked"
                    style={{ marginBottom: 0 }}
                    extra={<Text type="secondary" style={{ fontSize: 11 }}>新告警到达时自动滚动到最新位置</Text>}
                  >
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="告警音效" style={{ marginBottom: 0 }} extra={<Text type="secondary" style={{ fontSize: 11 }}>当前：{alarmMuted ? '已静音' : '已开启'}</Text>}>
                    <Switch
                      checked={!alarmMuted}
                      checkedChildren="开启"
                      unCheckedChildren="静音"
                      onChange={() => toggleAlarmMuted()}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 监控墙配置 */}
            <Card size="small" title="监控墙默认设置" style={{ marginBottom: 16 }}>
              <Row gutter={[24, 20]}>
                <Col xs={24} md={14}>
                  <Form.Item
                    label="默认监控墙布局"
                    name="defaultLayout"
                    style={{ marginBottom: 0 }}
                  >
                    <Radio.Group optionType="button" buttonStyle="solid" style={{ width: '100%' }}>
                      <Row gutter={[8, 8]}>
                        {LAYOUT_OPTIONS.map((opt) => (
                          <Col xs={12} sm={6} key={opt.value}>
                            <Radio.Button value={opt.value} style={{ width: '100%', textAlign: 'center' }}>
                              {opt.label}
                            </Radio.Button>
                          </Col>
                        ))}
                      </Row>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col xs={24} md={10}>
                  <Form.Item
                    label={
                      <Space size={6}>
                        <span>监控画面刷新频率</span>
                        <Tag color="purple">
                          {displayForm.getFieldValue('refreshRate') || 1000} ms
                        </Tag>
                      </Space>
                    }
                    name="refreshRate"
                    style={{ marginBottom: 0 }}
                  >
                    <Slider
                      min={100}
                      max={5000}
                      step={100}
                      marks={{ 100: '100ms', 1000: '1s', 3000: '3s', 5000: '5s' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 底部操作按钮 */}
            <Space size={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  displayForm.resetFields();
                  setCurrentTheme('dark');
                  message.success('已重置显示设置');
                }}
              >
                重置默认
              </Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveDisplayConfig}>
                保存设置
              </Button>
            </Space>
          </Form>
        </div>
      ),
    },
    {
      key: 'notify',
      label: (
        <Space size={8}>
          <NotificationOutlined />
          <span>通知设置</span>
        </Space>
      ),
      children: (
        <div style={{ padding: '8px 4px 16px' }}>
          <Alert
            type="warning"
            showIcon
            message="通知设置"
            description="以下配置决定不同级别告警通过何种方式通知值班人员。请确保值班电话填写正确，紧急告警将通过电话外呼通知。"
            style={{ marginBottom: 20 }}
          />
          <Form
            form={notifyForm}
            layout="vertical"
            initialValues={{
              urgentNotify: ['sound', 'popup', 'sms', 'call'],
              importantNotify: ['sound', 'popup', 'sms'],
              generalNotify: ['popup'],
            }}
          >
            <Card size="small" title="基础配置" style={{ marginBottom: 16 }}>
              <Row gutter={[24, 16]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={
                      <Space size={6}>
                        <PhoneOutlined />
                        <span>值班电话</span>
                      </Space>
                    }
                    name="dutyPhone"
                    rules={[
                      { required: true, message: '请输入值班电话' },
                      { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的11位手机号码' },
                    ]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input
                      size="large"
                      placeholder="请输入值班手机号码（用于紧急告警外呼）"
                      prefix={<PhoneOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                      addonAfter={<Tag color="green">已验证</Tag>}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12} style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button
                    type="primary"
                    ghost
                    size="large"
                    icon={<SendOutlined />}
                    onClick={handleTestNotify}
                    block
                    style={{ height: 40 }}
                  >
                    发送测试通知
                  </Button>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="分级通知策略" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {/* 紧急告警 */}
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: 8,
                    background: 'rgba(255,77,79,0.06)',
                    border: '1px solid rgba(255,77,79,0.15)',
                  }}
                >
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Space size={8} align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space size={8}>
                        <Tag color="red" style={{ margin: 0, fontSize: 13, padding: '2px 12px' }}>
                          紧急告警
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          影响播出安全的严重故障，需立即响应处理
                        </Text>
                      </Space>
                      <Text type="danger" style={{ fontSize: 13, fontWeight: 600 }}>
                        SLA响应：≤ 2分钟
                      </Text>
                    </Space>
                    <Form.Item name="urgentNotify" style={{ marginBottom: 0 }} label="通知方式（多选）">
                      <CheckboxGroup />
                    </Form.Item>
                  </Space>
                </div>

                {/* 重要告警 */}
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: 8,
                    background: 'rgba(250,173,20,0.06)',
                    border: '1px solid rgba(250,173,20,0.15)',
                  }}
                >
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Space size={8} align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space size={8}>
                        <Tag color="orange" style={{ margin: 0, fontSize: 13, padding: '2px 12px' }}>
                          重要告警
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          可能影响播出质量的异常，需尽快处理
                        </Text>
                      </Space>
                      <Text style={{ color: '#faad14', fontSize: 13, fontWeight: 600 }}>
                        SLA响应：≤ 15分钟
                      </Text>
                    </Space>
                    <Form.Item name="importantNotify" style={{ marginBottom: 0 }} label="通知方式（多选）">
                      <CheckboxGroup />
                    </Form.Item>
                  </Space>
                </div>

                {/* 一般告警 */}
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: 8,
                    background: 'rgba(24,144,255,0.06)',
                    border: '1px solid rgba(24,144,255,0.15)',
                  }}
                >
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Space size={8} align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space size={8}>
                        <Tag color="blue" style={{ margin: 0, fontSize: 13, padding: '2px 12px' }}>
                          一般告警
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          轻微异常或指标波动，可在交接班时处理
                        </Text>
                      </Space>
                      <Text style={{ color: '#1890ff', fontSize: 13, fontWeight: 600 }}>
                        SLA响应：≤ 2小时
                      </Text>
                    </Space>
                    <Form.Item name="generalNotify" style={{ marginBottom: 0 }} label="通知方式（多选）">
                      <CheckboxGroup />
                    </Form.Item>
                  </Space>
                </div>
              </Space>
            </Card>

            {/* 底部操作按钮 */}
            <Space size={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  notifyForm.resetFields();
                  message.success('已重置通知设置');
                }}
              >
                重置默认
              </Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveNotifyConfig}>
                保存设置
              </Button>
            </Space>
          </Form>
        </div>
      ),
    },
    {
      key: 'account',
      label: (
        <Space size={8}>
          <UserOutlined />
          <span>账户与权限</span>
        </Space>
      ),
      children: (
        <div style={{ padding: '8px 4px 16px' }}>
          <Row gutter={[16, 16]}>
            {/* 左侧：用户信息 + 修改密码 */}
            <Col xs={24} lg={10}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {/* 当前用户信息卡片 */}
                <Card size="small" title="当前用户信息">
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Space size={16} align="center">
                      <Avatar
                        size={72}
                        icon={<UserOutlined />}
                        src={currentUser.avatar}
                        style={{
                          background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
                          fontSize: 28,
                          flexShrink: 0,
                        }}
                      />
                      <Space direction="vertical" size={2}>
                        <Space size={8} align="center">
                          <Title level={4} style={{ margin: 0, color: '#fff' }}>
                            {currentUser.name}
                          </Title>
                          <Tag color="processing">在职</Tag>
                        </Space>
                        <Space size={10} wrap>
                          <Tag color="blue">{currentUser.role === 'operator' ? '值机操作员' : currentUser.role}</Tag>
                          <Space size={4}>
                            <UserOutlined style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>ID: {currentUser.id}</span>
                          </Space>
                        </Space>
                      </Space>
                    </Space>
                    <Divider style={{ margin: 0 }} />
                    <Descriptions column={1} size="small" colon={false} labelStyle={{ color: 'rgba(255,255,255,0.45)', width: 80 }}>
                      <Descriptions.Item label="联系电话">
                        <Space size={6}>
                          <PhoneOutlined style={{ color: '#52c41a' }} />
                          <a href={`tel:${currentUser.phone}`} style={{ color: '#52c41a' }}>
                            {currentUser.phone}
                          </a>
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="本月值班">
                        <span style={{ fontWeight: 600 }}>{dutyStatistics.thisMonthShifts}</span> 班
                        <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                          （共 {dutyStatistics.totalHours} 小时）
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="连续值班">
                        <span
                          style={{
                            fontWeight: 600,
                            color: dutyStatistics.continuousHours > 16 ? '#ff4d4f' : '#52c41a',
                          }}
                        >
                          {dutyStatistics.continuousHours}
                        </span> 小时
                        {dutyStatistics.continuousHours > 16 && (
                          <Tag color="red" style={{ marginLeft: 8 }}>
                            超时警告
                          </Tag>
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="超时预警">
                        {dutyStatistics.overtimeWarnings > 0 ? (
                          <Tag color="orange">{dutyStatistics.overtimeWarnings} 次</Tag>
                        ) : (
                          <Tag color="success">无异常</Tag>
                        )}
                      </Descriptions.Item>
                    </Descriptions>
                  </Space>
                </Card>

                {/* 修改密码表单 */}
                <Card size="small" title="修改密码">
                  <Form
                    form={passwordForm}
                    layout="vertical"
                    onFinish={handleChangePassword}
                  >
                    <Form.Item
                      label="原密码"
                      name="oldPassword"
                      rules={[{ required: true, message: '请输入原密码' }]}
                      style={{ marginBottom: 14 }}
                    >
                      <Input.Password
                        size="large"
                        placeholder="请输入当前登录密码"
                        prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                        visibilityToggle
                      />
                    </Form.Item>
                    <Form.Item
                      label="新密码"
                      name="newPassword"
                      rules={[
                        { required: true, message: '请输入新密码' },
                        { min: 8, message: '密码长度至少8位' },
                        { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: '密码需同时包含字母和数字' },
                      ]}
                      style={{ marginBottom: 14 }}
                    >
                      <Input.Password
                        size="large"
                        placeholder="至少8位，包含字母和数字"
                        prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                        visibilityToggle
                      />
                    </Form.Item>
                    <Form.Item
                      label="确认新密码"
                      name="confirmPassword"
                      dependencies={['newPassword']}
                      rules={[
                        { required: true, message: '请再次输入新密码' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('newPassword') === value) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error('两次输入的密码不一致'));
                          },
                        }),
                      ]}
                      style={{ marginBottom: 16 }}
                    >
                      <Input.Password
                        size="large"
                        placeholder="请再次输入新密码"
                        prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                        visibilityToggle
                      />
                    </Form.Item>
                    <Button
                      type="primary"
                      block
                      size="large"
                      htmlType="submit"
                      icon={<SaveOutlined />}
                      style={{ height: 42 }}
                    >
                      确认修改密码
                    </Button>
                  </Form>
                </Card>
              </Space>
            </Col>

            {/* 右侧：权限列表 */}
            <Col xs={24} lg={14}>
              <Card
                size="small"
                title={
                  <Space size={8}>
                    <SafetyOutlined style={{ color: '#52c41a' }} />
                    <span>权限列表（只读）</span>
                    <Tag color="green">
                      已授权 {PERMISSION_TABLE_DATA.filter((p) => p.granted).length} /{' '}
                      {PERMISSION_TABLE_DATA.length}
                    </Tag>
                  </Space>
                }
                extra={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <SettingOutlined /> 如需提升权限请联系系统管理员
                  </Text>
                }
              >
                <Table
                  dataSource={PERMISSION_TABLE_DATA}
                  columns={permissionColumns}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  scroll={{ y: 520 }}
                  rowClassName={(record) =>
                    record.granted ? '' : 'opacity-60'
                  }
                />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        styles={{ body: { padding: '16px 20px 20px' } }}
        style={{ borderRadius: 8 }}
        title={
          <Space size={8}>
            <SettingOutlined style={{ color: '#1677ff' }} />
            <span>系统设置中心</span>
          </Space>
        }
      >
        <Tabs
          tabPosition="left"
          activeKey={activeKey}
          onChange={setActiveKey}
          items={tabItems}
          style={{ minHeight: 600 }}
          tabBarStyle={{
            paddingTop: 8,
            borderRight: '1px solid rgba(255,255,255,0.08)',
            minWidth: 200,
          }}
        />
      </Card>
    </div>
  );
};

// ========== 辅助样式常量 ==========
const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 12,
  color: 'rgba(255,255,255,0.55)',
  fontWeight: 500,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
};

// ========== 辅助组件：告警级别小徽章 ==========
const WarningBadge: React.FC<{ level: AlarmLevel }> = ({ level }) => (
  <span
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: LEVEL_COLORS[level],
      boxShadow: `0 0 6px ${LEVEL_COLORS[level]}`,
    }}
  />
);

// ========== 辅助组件：迷你数字输入框 ==========
const InputNumberMini: React.FC<{
  value: number;
  onChange: (v: number) => void;
}> = ({ value, onChange }) => (
  <Input
    size="small"
    type="number"
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    style={{ width: 70 }}
    min={0}
  />
);

// ========== 辅助组件：通知方式多选组 ==========
const CheckboxGroup: React.FC = () => {
  return (
    <Checkbox.Group>
      <Space size={[16, 8]} wrap>
        {NOTIFY_OPTIONS.map((opt) => (
          <Checkbox value={opt.value} key={opt.value}>
            <Space size={4}>
              {opt.icon}
              <span>{opt.label}</span>
            </Space>
          </Checkbox>
        ))}
      </Space>
    </Checkbox.Group>
  );
};

export default Settings;
