import React, { useState, useRef, useCallback, useMemo, memo } from 'react';
import { Tag, Badge, Checkbox, Button, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  SendOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { AlarmItem, AlarmLevel } from '@/types';

dayjs.extend(relativeTime);

interface AlarmListProps {
  alarms: AlarmItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAck: (id: string) => void;
}

const ROW_HEIGHT = 72;
const CONTAINER_HEIGHT = 600;
const BUFFER_ROWS = 5;

const LEVEL_COLOR: Record<AlarmLevel, { tag: string; bar: string; bg: string }> = {
  urgent: { tag: '#ff4d4f', bar: '#ff4d4f', bg: 'rgba(255, 77, 79, 0.04)' },
  important: { tag: '#fa8c16', bar: '#fa8c16', bg: 'rgba(250, 140, 22, 0.04)' },
  general: { tag: '#faad14', bar: '#faad14', bg: 'rgba(250, 173, 20, 0.04)' },
};

const LEVEL_TEXT: Record<AlarmLevel, string> = {
  urgent: '紧急',
  important: '重要',
  general: '一般',
};

interface AlarmRowProps {
  alarm: AlarmItem;
  isSelected: boolean;
  onSelect: () => void;
  onAck: () => void;
}

const AlarmRow = memo<AlarmRowProps>(({ alarm, isSelected, onSelect, onAck }) => {
  const colors = LEVEL_COLOR[alarm.level];
  const isNew = Date.now() - alarm.timestamp < 30 * 1000;

  const rowStyle: React.CSSProperties = {
    height: ROW_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #f0f0f0',
    backgroundColor: isSelected
      ? 'rgba(22, 119, 255, 0.06)'
      : !alarm.ack
      ? colors.bg
      : '#ffffff',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    position: 'relative',
  };

  return (
    <div
      className={`alarm-row ${isNew ? 'alarm-row-new animate-slide-in' : ''} ${
        !alarm.ack ? 'alarm-row-unack' : ''
      }`}
      style={rowStyle}
      onClick={onSelect}
    >
      <div
        style={{
          width: 8,
          height: '100%',
          backgroundColor: colors.bar,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          flex: 1,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          overflow: 'hidden',
        }}
      >
        <Tag color={colors.tag} style={{ margin: 0, flexShrink: 0 }}>
          {LEVEL_TEXT[alarm.level]}
        </Tag>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: 'rgba(0, 0, 0, 0.88)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {alarm.title}
            {alarm.count > 1 && (
              <Badge
                count={`x ${alarm.count}`}
                style={{
                  marginLeft: 8,
                  backgroundColor: 'rgba(0, 0, 0, 0.06)',
                  color: 'rgba(0, 0, 0, 0.65)',
                  boxShadow: 'none',
                }}
              />
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(0, 0, 0, 0.45)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {alarm.stationName} - {alarm.channelName}
          </div>
        </div>

        <Tooltip title={dayjs(alarm.timestamp).format('YYYY-MM-DD HH:mm:ss')}>
          <span
            style={{
              fontSize: 12,
              color: 'rgba(0, 0, 0, 0.45)',
              flexShrink: 0,
              minWidth: 72,
              textAlign: 'right',
            }}
          >
            {dayjs(alarm.timestamp).fromNow()}
          </span>
        </Tooltip>

        <Checkbox
          checked={alarm.ack}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.checked && !alarm.ack) onAck();
          }}
          style={{ flexShrink: 0 }}
        />

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <Button
            type="text"
            size="small"
            icon={<CheckCircleOutlined />}
            disabled={alarm.ack}
            onClick={onAck}
          >
            确认
          </Button>
          <Button type="text" size="small" icon={<SendOutlined />}>
            派单
          </Button>
          <Button type="text" size="small" icon={<InfoCircleOutlined />}>
            详情
          </Button>
        </div>
      </div>
    </div>
  );
});

AlarmRow.displayName = 'AlarmRow';

const AlarmList: React.FC<AlarmListProps> = ({ alarms, selectedId, onSelect, onAck }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  const totalHeight = alarms.length * ROW_HEIGHT;
  const visibleCount = Math.ceil(CONTAINER_HEIGHT / ROW_HEIGHT) + BUFFER_ROWS * 2;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endIndex = Math.min(alarms.length, startIndex + visibleCount);

  const visibleAlarms = useMemo(
    () => alarms.slice(startIndex, endIndex),
    [alarms, startIndex, endIndex],
  );

  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
      rafRef.current = undefined;
    });
  }, []);

  const paddingTop = startIndex * ROW_HEIGHT;
  const paddingBottom = totalHeight - endIndex * ROW_HEIGHT;

  if (alarms.length === 0) {
    return (
      <div
        style={{
          height: CONTAINER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(0, 0, 0, 0.45)',
          fontSize: 14,
        }}
      >
        暂无告警数据
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="alarm-list-container"
      style={{
        height: CONTAINER_HEIGHT,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      <div style={{ paddingTop, paddingBottom }}>
        {visibleAlarms.map((alarm) => (
          <AlarmRow
            key={alarm.id}
            alarm={alarm}
            isSelected={alarm.id === selectedId}
            onSelect={() => onSelect(alarm.id)}
            onAck={() => onAck(alarm.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default AlarmList;
