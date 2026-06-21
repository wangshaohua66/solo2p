import React, { useState, useMemo, useCallback } from 'react';
import {
  Select,
  Input,
  DatePicker,
  Button,
  Card,
  message,
  Tooltip,
} from 'antd';
import {
  SoundOutlined,
  MutedOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { AlarmItem, AlarmLevel, AlarmType, FilterType } from '@/types';
import { useMonitorStore } from '@/stores/monitorStore';
import { groupAlarms, generateAlarmTitle, shouldMerge } from '@/utils/alarmClassifier';
import { exportToCSV } from '@/utils/dataAggregator';
import AlarmCategoryTree from './AlarmCategoryTree';
import AlarmList from './AlarmList';
import AlarmDetailPanel from './AlarmDetailPanel';
import UrgentAlarmModal from './UrgentAlarmModal';

const { RangePicker } = DatePicker;
const { Search } = Input;

type LevelOption = AlarmLevel;
type TypeOption = AlarmType;

const LEVEL_OPTIONS: { label: string; value: LevelOption; color: string }[] = [
  { label: '紧急', value: 'urgent', color: '#ff4d4f' },
  { label: '重要', value: 'important', color: '#fa8c16' },
  { label: '一般', value: 'general', color: '#faad14' },
];

const TYPE_OPTIONS: { label: string; value: TypeOption }[] = [
  { label: '信号中断', value: 'signal_loss' },
  { label: '黑场', value: 'black_frame' },
  { label: '静帧', value: 'static_frame' },
  { label: '音频丢失', value: 'audio_loss' },
  { label: '码率异常', value: 'bitrate_error' },
  { label: '设备离线', value: 'device_offline' },
];

const AlarmCenter: React.FC = () => {
  const alarms = useMonitorStore((state) => state.alarms);
  const alarmMuted = useMonitorStore((state) => state.alarmMuted);
  const summary = useMonitorStore((state) => state.summary);
  const toggleAlarmMuted = useMonitorStore((state) => state.toggleAlarmMuted);
  const acknowledgeAlarm = useMonitorStore((state) => state.acknowledgeAlarm);
  const acknowledgeAllAlarms = useMonitorStore((state) => state.acknowledgeAllAlarms);

  const [selectedLevels, setSelectedLevels] = useState<LevelOption[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<TypeOption[]>([]);
  const [stationKeyword, setStationKeyword] = useState('');
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [treeFilter, setTreeFilter] = useState<FilterType>({});
  const [selectedAlarmId, setSelectedAlarmId] = useState<string | null>(null);

  const grouped = useMemo(() => groupAlarms(alarms), [alarms]);

  const levelStats = useMemo(
    () => ({
      urgent: grouped.byLevel.urgent.length,
      important: grouped.byLevel.important.length,
      general: grouped.byLevel.general.length,
      unhandled: alarms.filter((a) => !a.ack).length,
    }),
    [grouped, alarms],
  );

  const filteredAlarms = useMemo(() => {
    let result = [...alarms];

    if (treeFilter.category) {
      if (treeFilter.level) {
        result = result.filter((a) => a.level === treeFilter.level);
      }
      if (treeFilter.type) {
        result = result.filter((a) => a.type === treeFilter.type);
      }
      if (treeFilter.stationId) {
        result = result.filter((a) => a.stationId === treeFilter.stationId);
      }
      if (treeFilter.channelId) {
        result = result.filter((a) => a.channelId === treeFilter.channelId);
      }
    }

    if (selectedLevels.length > 0) {
      result = result.filter((a) => selectedLevels.includes(a.level));
    }

    if (selectedTypes.length > 0) {
      result = result.filter((a) => selectedTypes.includes(a.type));
    }

    if (stationKeyword.trim()) {
      const kw = stationKeyword.trim().toLowerCase();
      result = result.filter(
        (a) =>
          a.stationName.toLowerCase().includes(kw) ||
          a.stationId.toLowerCase().includes(kw),
      );
    }

    if (timeRange && timeRange[0] && timeRange[1]) {
      const start = timeRange[0].valueOf();
      const end = timeRange[1].valueOf();
      result = result.filter((a) => a.timestamp >= start && a.timestamp <= end);
    }

    return result;
  }, [alarms, treeFilter, selectedLevels, selectedTypes, stationKeyword, timeRange]);

  const selectedAlarm = useMemo<AlarmItem | null>(
    () => alarms.find((a) => a.id === selectedAlarmId) || null,
    [alarms, selectedAlarmId],
  );

  const handleSelectAlarm = useCallback((id: string) => {
    setSelectedAlarmId(id);
  }, []);

  const handleAckAlarm = useCallback(
    (id: string) => {
      acknowledgeAlarm(id);
      message.success('告警已确认');
    },
    [acknowledgeAlarm],
  );

  const handleBatchAck = useCallback(() => {
    if (filteredAlarms.filter((a) => !a.ack).length === 0) {
      message.info('暂无可确认的告警');
      return;
    }
    acknowledgeAllAlarms();
    message.success('已批量确认所有未处理告警');
  }, [filteredAlarms, acknowledgeAllAlarms]);

  const handleExportCSV = useCallback(() => {
    if (filteredAlarms.length === 0) {
      message.info('暂无可导出的告警数据');
      return;
    }
    const headers = [
      '告警ID',
      '告警级别',
      '告警类型',
      '告警标题',
      '所属机房',
      '所属频道',
      '告警内容',
      '发生时间',
      '首次时间',
      '重复次数',
      '确认状态',
    ];
    const rows = filteredAlarms.map((a) => [
      a.id,
      LEVEL_OPTIONS.find((l) => l.value === a.level)?.label || a.level,
      TYPE_OPTIONS.find((t) => t.value === a.type)?.label || a.type,
      generateAlarmTitle(a.type, a.stationName, a.channelName),
      a.stationName,
      a.channelName,
      a.content,
      dayjs(a.timestamp).format('YYYY-MM-DD HH:mm:ss'),
      dayjs(a.firstTimestamp).format('YYYY-MM-DD HH:mm:ss'),
      a.count,
      a.ack ? '已确认' : '未确认',
    ]);
    const filename = `告警导出_${dayjs().format('YYYYMMDD_HHmmss')}`;
    exportToCSV(headers, rows, filename);
    message.success(`已导出 ${filteredAlarms.length} 条告警数据`);
  }, [filteredAlarms]);

  const handleDispatchAlarm = useCallback((alarm: AlarmItem) => {
    message.info(`派发工单：${alarm.title}`);
  }, []);

  const StatCard = ({
    label,
    value,
    color,
    icon,
  }: {
    label: string;
    value: number;
    color: string;
    icon: React.ReactNode;
  }) => (
    <Card
      size="small"
      style={{
        flex: 1,
        borderLeft: `4px solid ${color}`,
        borderRadius: 8,
        backgroundColor: value > 0 ? `${color}08` : '#ffffff',
      }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>
            {label}
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: color,
              lineHeight: 1.2,
            }}
          >
            {value}
          </div>
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            fontSize: 20,
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="alarm-center" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 16, gap: 16 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          <StatCard
            label="紧急告警"
            value={levelStats.urgent}
            color="#ff4d4f"
            icon={<WarningOutlined />}
          />
          <StatCard
            label="重要告警"
            value={levelStats.important}
            color="#fa8c16"
            icon={<ExclamationCircleOutlined />}
          />
          <StatCard
            label="一般告警"
            value={levelStats.general}
            color="#faad14"
            icon={<InfoCircleOutlined />}
          />
          <StatCard
            label="未处理"
            value={levelStats.unhandled}
            color="#1677ff"
            icon={<AlertOutlined />}
          />
        </div>

        <Card size="small" style={{ borderRadius: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ color: 'rgba(0,0,0,0.65)', whiteSpace: 'nowrap' }}>级别：</span>
            <Select
              mode="multiple"
              allowClear
              style={{ minWidth: 200 }}
              placeholder="全部级别"
              value={selectedLevels}
              onChange={setSelectedLevels}
              options={LEVEL_OPTIONS}
              tagRender={(props) => {
                const opt = LEVEL_OPTIONS.find((o) => o.value === props.value);
                return (
                  <span
                    style={{
                      color: opt?.color,
                      borderColor: opt?.color,
                      backgroundColor: `${opt?.color}15`,
                      border: '1px solid',
                      borderRadius: 4,
                      padding: '0 8px',
                      fontSize: 12,
                      marginRight: 4,
                    }}
                  >
                    {props.label}
                  </span>
                );
              }}
            />

            <span style={{ color: 'rgba(0,0,0,0.65)', whiteSpace: 'nowrap' }}>类型：</span>
            <Select
              mode="multiple"
              allowClear
              style={{ minWidth: 280 }}
              placeholder="全部类型"
              value={selectedTypes}
              onChange={setSelectedTypes}
              options={TYPE_OPTIONS}
            />

            <Search
              placeholder="搜索机房名称/ID"
              allowClear
              style={{ width: 200 }}
              value={stationKeyword}
              onChange={(e) => setStationKeyword(e.target.value)}
            />

            <RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              placeholder={['开始时间', '结束时间']}
              value={timeRange}
              onChange={(val) => setTimeRange(val as [Dayjs | null, Dayjs | null] | null)}
            />

            <div style={{ flex: 1 }} />

            <Tooltip title={alarmMuted ? '开启告警音效' : '静音告警音效'}>
              <Button
                type={alarmMuted ? 'default' : 'primary'}
                icon={alarmMuted ? <MutedOutlined /> : <SoundOutlined />}
                onClick={toggleAlarmMuted}
                danger={alarmMuted}
              >
                {alarmMuted ? '已静音' : '一键静音'}
              </Button>
            </Tooltip>

            <Button
              icon={<CheckCircleOutlined />}
              onClick={handleBatchAck}
            >
              批量确认
            </Button>

            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportCSV}
            >
              导出CSV
            </Button>
          </div>
        </Card>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 16,
          minHeight: 0,
        }}
      >
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>告警分类</span>
              <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: 'normal' }}>
                共 {alarms.length} 条
              </span>
            </div>
          }
          size="small"
          style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, overflow: 'auto', padding: 8 } }}
        >
          <AlarmCategoryTree
            alarms={alarms}
            onSelect={setTreeFilter}
            selectedFilter={treeFilter}
          />
        </Card>

        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>告警列表</span>
                <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: 'normal' }}>
                  筛选 {filteredAlarms.length} 条 / 全部 {alarms.length} 条
                </span>
              </div>
            </div>
          }
          size="small"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
          styles={{ body: { flex: 1, overflow: 'auto', padding: 0 } }}
          className="alarm-list-wrapper"
        >
          <AlarmList
            alarms={filteredAlarms}
            selectedId={selectedAlarmId}
            onSelect={handleSelectAlarm}
            onAck={handleAckAlarm}
          />
        </Card>

        <Card
          title="告警详情"
          size="small"
          style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, overflow: 'hidden', padding: 0 } }}
        >
          <AlarmDetailPanel
            alarm={selectedAlarm}
            onAck={handleAckAlarm}
            onDispatch={handleDispatchAlarm}
          />
        </Card>
      </div>

      <UrgentAlarmModal />
    </div>
  );
};

export default AlarmCenter;
