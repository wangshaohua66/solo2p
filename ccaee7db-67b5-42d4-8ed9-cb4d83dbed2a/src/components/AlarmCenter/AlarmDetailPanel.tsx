import React, { useMemo } from 'react';
import {
  Button,
  Tag,
  Timeline,
  Empty,
  Divider,
  Card,
  List,
  Badge,
} from 'antd';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SendOutlined,
  PhoneOutlined,
  StopOutlined,
  BlockOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { AlarmItem, AlarmLevel, AlarmType } from '@/types';
import { useMonitorStore } from '@/stores/monitorStore';

interface AlarmDetailPanelProps {
  alarm: AlarmItem | null;
  onAck: (id: string) => void;
  onDispatch: (alarm: AlarmItem) => void;
}

const LEVEL_ICON: Record<AlarmLevel, React.ReactNode> = {
  urgent: <WarningOutlined style={{ color: '#ff4d4f', fontSize: 32 }} />,
  important: <ExclamationCircleOutlined style={{ color: '#fa8c16', fontSize: 32 }} />,
  general: <InfoCircleOutlined style={{ color: '#faad14', fontSize: 32 }} />,
};

const LEVEL_TEXT: Record<AlarmLevel, string> = {
  urgent: '紧急告警',
  important: '重要告警',
  general: '一般告警',
};

const LEVEL_COLOR: Record<AlarmLevel, string> = {
  urgent: '#ff4d4f',
  important: '#fa8c16',
  general: '#faad14',
};

const TYPE_TEXT: Record<AlarmType, string> = {
  signal_loss: '信号中断',
  black_frame: '黑场',
  static_frame: '静帧',
  audio_loss: '音频丢失',
  bitrate_error: '码率异常',
  device_offline: '设备离线',
};

const AlarmDetailPanel: React.FC<AlarmDetailPanelProps> = ({ alarm, onAck, onDispatch }) => {
  const allAlarms = useMonitorStore((state) => state.alarms);

  const relatedAlarms = useMemo(() => {
    if (!alarm) return [];
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return allAlarms
      .filter(
        (a) =>
          a.stationId === alarm.stationId &&
          a.id !== alarm.id &&
          a.timestamp >= oneHourAgo,
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [alarm, allAlarms]);

  const timelineItems = useMemo(() => {
    if (!alarm) return [];
    const items = [
      {
        color: '#ff4d4f',
        dot: <ClockCircleOutlined />,
        children: (
          <div>
            <div style={{ fontWeight: 500 }}>告警产生</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
              {dayjs(alarm.firstTimestamp).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
        ),
      },
    ];

    if (alarm.ack) {
      items.push({
        color: '#1677ff',
        dot: <CheckCircleOutlined />,
        children: (
          <div>
            <div style={{ fontWeight: 500 }}>已确认</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
              {dayjs(alarm.timestamp).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
        ),
      });
    } else {
      items.push({
        color: '#d9d9d9',
        dot: <CheckCircleOutlined />,
        children: (
          <div>
            <div style={{ fontWeight: 500, color: 'rgba(0,0,0,0.45)' }}>未处理</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>待确认</div>
          </div>
        ),
      });
    }

    return items;
  }, [alarm]);

  if (!alarm) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Empty description="请选择一条告警查看详情" />
      </div>
    );
  }

  return (
    <div
      className="alarm-detail-panel"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
        }}
      >
        {LEVEL_ICON[alarm.level]}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: LEVEL_COLOR[alarm.level],
              lineHeight: 1.4,
            }}
          >
            {LEVEL_TEXT[alarm.level]}
          </div>
          <Tag color={LEVEL_COLOR[alarm.level]} style={{ marginTop: 8 }}>
            {TYPE_TEXT[alarm.type]}
          </Tag>
        </div>
        <Badge
          count={`x${alarm.count}`}
          style={{
            backgroundColor: LEVEL_COLOR[alarm.level],
            fontSize: 14,
            padding: '4px 12px',
            height: 'auto',
            borderRadius: 12,
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px' }}>
        <div style={{ padding: '16px 0' }}>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(0,0,0,0.45)',
              marginBottom: 8,
            }}
          >
            告警标题
          </div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>{alarm.title}</div>
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '8px 0' }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>所属机房</div>
            <div style={{ fontSize: 14 }}>{alarm.stationName}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>所属频道</div>
            <div style={{ fontSize: 14 }}>{alarm.channelName}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>发生时间</div>
            <div style={{ fontSize: 14 }}>
              {dayjs(alarm.timestamp).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>首次时间</div>
            <div style={{ fontSize: 14 }}>
              {dayjs(alarm.firstTimestamp).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>重复次数</div>
            <div style={{ fontSize: 14 }}>{alarm.count} 次</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>当前状态</div>
            <div style={{ fontSize: 14 }}>
              <Tag color={alarm.ack ? 'green' : 'red'}>
                {alarm.ack ? '已确认' : '未确认'}
              </Tag>
            </div>
          </div>
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <div style={{ padding: '16px 0' }}>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>告警描述</div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              padding: 16,
              backgroundColor: 'rgba(0,0,0,0.02)',
              borderRadius: 8,
            }}
          >
            {alarm.content}
          </div>
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <div style={{ padding: '16px 0' }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>同机房近1小时关联告警</span>
            <Tag color="blue">{relatedAlarms.length}</Tag>
          </div>
          {relatedAlarms.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联告警" />
          ) : (
            <List
              size="small"
              bordered
              dataSource={relatedAlarms}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: LEVEL_COLOR[item.level],
                          margin: 'auto',
                        }}
                      />
                    }
                    title={
                      <span style={{ fontSize: 13 }}>
                        <Tag color={LEVEL_COLOR[item.level]} style={{ marginRight: 8 }}>
                          {LEVEL_TEXT[item.level].replace('告警', '')}
                        </Tag>
                        {TYPE_TEXT[item.type]}
                      </span>
                    }
                    description={
                      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                        {item.channelName} · {dayjs(item.timestamp).fromNow()}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <div style={{ padding: '16px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>处理时间线</div>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Timeline items={timelineItems} />
          </Card>
        </div>
      </div>

      <div
        style={{
          padding: '16px 24px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          flexShrink: 0,
          backgroundColor: 'rgba(0,0,0,0.01)',
        }}
      >
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          disabled={alarm.ack}
          onClick={() => onAck(alarm.id)}
        >
          确认告警
        </Button>
        <Button icon={<SendOutlined />} onClick={() => onDispatch(alarm)}>
          派发工单
        </Button>
        <Button icon={<PhoneOutlined />}>呼叫机房</Button>
        <Button icon={<StopOutlined />}>标记误报</Button>
        <Button danger icon={<BlockOutlined />}>
          屏蔽告警
        </Button>
      </div>
    </div>
  );
};

export default AlarmDetailPanel;
