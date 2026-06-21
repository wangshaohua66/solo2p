import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, Button, List, Tag, Badge } from 'antd';
import {
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { AlarmItem } from '@/types';
import { useMonitorStore } from '@/stores/monitorStore';

dayjs.extend(relativeTime);

const AUTO_CLOSE_MS = 15 * 1000;
const REMIND_AGAIN_MS = 5 * 60 * 1000;

interface ReminderState {
  [alarmId: string]: number;
}

const UrgentAlarmModal: React.FC = () => {
  const alarms = useMonitorStore((state) => state.alarms);
  const acknowledgeAlarm = useMonitorStore((state) => state.acknowledgeAlarm);
  const acknowledgeAllAlarms = useMonitorStore((state) => state.acknowledgeAllAlarms);
  const toggleAlarmMuted = useMonitorStore((state) => state.toggleAlarmMuted);

  const [visible, setVisible] = useState(false);
  const [selectedAlarm, setSelectedAlarm] = useState<AlarmItem | null>(null);
  const [reminders, setReminders] = useState<ReminderState>({});
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urgentUnackAlarms = useMemo(() => {
    const now = Date.now();
    return alarms.filter(
      (a) =>
        a.level === 'urgent' &&
        !a.ack &&
        (!reminders[a.id] || now - reminders[a.id] >= REMIND_AGAIN_MS),
    );
  }, [alarms, reminders]);

  useEffect(() => {
    if (urgentUnackAlarms.length > 0 && !visible) {
      setVisible(true);
      setSelectedAlarm(urgentUnackAlarms[0]);
    }
  }, [urgentUnackAlarms, visible]);

  useEffect(() => {
    if (visible) {
      closeTimerRef.current = setTimeout(() => {
        handleLaterAll();
      }, AUTO_CLOSE_MS);
    }
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, [visible]);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleAck = (alarm: AlarmItem) => {
    clearCloseTimer();
    acknowledgeAlarm(alarm.id);
    const remaining = urgentUnackAlarms.filter((a) => a.id !== alarm.id);
    if (remaining.length > 0) {
      setSelectedAlarm(remaining[0]);
    } else {
      setVisible(false);
      setSelectedAlarm(null);
    }
  };

  const handleAckAll = () => {
    clearCloseTimer();
    urgentUnackAlarms.forEach((a) => acknowledgeAlarm(a.id));
    setVisible(false);
    setSelectedAlarm(null);
  };

  const handleLater = (alarm: AlarmItem) => {
    clearCloseTimer();
    setReminders((prev) => ({ ...prev, [alarm.id]: Date.now() }));
    const remaining = urgentUnackAlarms.filter((a) => a.id !== alarm.id);
    if (remaining.length > 0) {
      setSelectedAlarm(remaining[0]);
    } else {
      setVisible(false);
      setSelectedAlarm(null);
    }
  };

  const handleLaterAll = () => {
    clearCloseTimer();
    const now = Date.now();
    setReminders((prev) => {
      const next = { ...prev };
      urgentUnackAlarms.forEach((a) => {
        next[a.id] = now;
      });
      return next;
    });
    setVisible(false);
    setSelectedAlarm(null);
  };

  const handleViewDetail = (alarm: AlarmItem) => {
    clearCloseTimer();
    setSelectedAlarm(alarm);
  };

  if (!visible) return null;

  return (
    <Modal
      className="alarm-urgent-modal"
      open={visible}
      onCancel={handleLaterAll}
      maskClosable={false}
      closable={true}
      width={640}
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <WarningOutlined style={{ color: '#ff4d4f', fontSize: 22 }} />
          <span style={{ fontSize: 18, fontWeight: 600, color: '#ff4d4f' }}>
            紧急告警提醒
          </span>
          <Badge
            count={urgentUnackAlarms.length}
            style={{ backgroundColor: '#ff4d4f', marginLeft: 8 }}
          />
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
            <ClockCircleOutlined /> 15秒后自动关闭并5分钟后再次提醒
          </span>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleLaterAll} icon={<ClockCircleOutlined />}>
            全部稍后提醒
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              danger
              icon={<CheckCircleOutlined />}
              onClick={handleAckAll}
            >
              批量确认 ({urgentUnackAlarms.length})
            </Button>
          </div>
        </div>
      }
      onOk={handleAckAll}
    >
      {selectedAlarm && (
        <div
          style={{
            border: '2px solid #ff4d4f',
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
            backgroundColor: 'rgba(255, 77, 79, 0.04)',
            position: 'relative',
          }}
          className="alarm-urgent-card"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
            }}
          >
            <WarningOutlined
              style={{
                color: '#ff4d4f',
                fontSize: 36,
                flexShrink: 0,
                marginTop: 4,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <Tag color="red" style={{ fontSize: 14, padding: '2px 12px' }}>
                  紧急
                </Tag>
                <span style={{ fontSize: 18, fontWeight: 600 }}>
                  {selectedAlarm.title}
                </span>
                {selectedAlarm.count > 1 && (
                  <Badge
                    count={`x${selectedAlarm.count}`}
                    style={{ backgroundColor: '#ff4d4f' }}
                  />
                )}
              </div>
              <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.65)', marginBottom: 12 }}>
                {selectedAlarm.stationName} - {selectedAlarm.channelName}
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.8,
                  padding: 12,
                  backgroundColor: '#ffffff',
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              >
                {selectedAlarm.content}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: 'rgba(0,0,0,0.45)',
                }}
              >
                <span>
                  首次时间：{dayjs(selectedAlarm.firstTimestamp).format('YYYY-MM-DD HH:mm:ss')}
                </span>
                <span>{dayjs(selectedAlarm.timestamp).fromNow()}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <Button size="middle" icon={<ClockCircleOutlined />} onClick={() => handleLater(selectedAlarm)}>
              稍后提醒
            </Button>
            <Button
              type="primary"
              danger
              size="middle"
              icon={<CheckCircleOutlined />}
              onClick={() => handleAck(selectedAlarm)}
            >
              立即处理
            </Button>
          </div>
        </div>
      )}

      {urgentUnackAlarms.length > 1 && (
        <div>
          <div
            style={{
              fontSize: 13,
              color: 'rgba(0,0,0,0.65)',
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            其他未处理紧急告警（{urgentUnackAlarms.length - 1}）
          </div>
          <List
            size="small"
            bordered
            dataSource={urgentUnackAlarms.filter((a) => a.id !== selectedAlarm?.id)}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="view"
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewDetail(item)}
                  >
                    查看
                  </Button>,
                  <Button
                    key="ack"
                    type="text"
                    size="small"
                    danger
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleAck(item)}
                  >
                    确认
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <WarningOutlined
                      style={{ color: '#ff4d4f', fontSize: 16 }}
                    />
                  }
                  title={
                    <span style={{ fontSize: 13 }}>
                      <Tag color="red" style={{ marginRight: 8 }}>紧急</Tag>
                      {item.title}
                    </span>
                  }
                  description={
                    <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                      {item.stationName} - {item.channelName} · {dayjs(item.timestamp).fromNow()}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}
    </Modal>
  );
};

export default UrgentAlarmModal;
