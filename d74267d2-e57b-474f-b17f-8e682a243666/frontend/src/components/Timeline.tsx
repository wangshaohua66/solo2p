import React, { useCallback } from 'react';
import { Button, Slider, Space, Tooltip, Tag } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  FastBackwardOutlined,
  FastForwardOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import { useCommandStore } from '@/store/commandStore';
import dayjs from 'dayjs';

const Timeline: React.FC = () => {
  const {
    selectedTime,
    isPlayingTimeline,
    setSelectedTime,
    setIsPlayingTimeline,
    timelineEvents,
    incidents,
  } = useCommandStore();

  const events = React.useMemo(() => {
    const result = [];
    const now = dayjs();

    for (let i = 0; i < 8; i++) {
      const time = now.subtract(7 - i, 'hour');
      result.push({
        id: `t-${i}`,
        time: time.format('HH:mm'),
        fullTime: time.format('YYYY-MM-DD HH:mm:ss'),
        title: `事件 ${i + 1}`,
        type: 'info',
      });
    }

    incidents.slice(0, 5).forEach((incident, idx) => {
      if (incident.occurredAt) {
        result.push({
          id: `incident-${incident.id}`,
          time: dayjs(incident.occurredAt).format('HH:mm'),
          fullTime: incident.occurredAt,
          title: incident.title,
          type: 'incident',
          color: idx < 2 ? '#ff4d4f' : '#fa8c16',
        });
      }
    });

    return result.sort((a, b) => (a.fullTime > b.fullTime ? 1 : -1));
  }, [incidents]);

  const marks = React.useMemo(() => {
    const marksObj: Record<number, React.ReactNode> = {};
    events.forEach((event, index) => {
      marksObj[index] = (
        <Tooltip title={`${event.fullTime} - ${event.title}`}>
          <span style={{ color: event.color || 'rgba(255,255,255,0.45)', fontSize: 10 }}>
            {event.time}
          </span>
        </Tooltip>
      );
    });
    return marksObj;
  }, [events]);

  const currentIndex = React.useMemo(() => {
    return Math.min(Math.floor((Date.now() - selectedTime.getTime()) / 3600000), events.length - 1);
  }, [selectedTime, events.length]);

  const handlePlay = useCallback(() => {
    setIsPlayingTimeline(!isPlayingTimeline);
  }, [isPlayingTimeline, setIsPlayingTimeline]);

  const handleSliderChange = useCallback(
    (value: number) => {
      const event = events[value];
      if (event) {
        setSelectedTime(dayjs(event.fullTime).toDate());
      }
    },
    [events, setSelectedTime]
  );

  const handleStepBackward = useCallback(() => {
    const newIndex = Math.max(0, currentIndex - 1);
    handleSliderChange(newIndex);
  }, [currentIndex, handleSliderChange]);

  const handleStepForward = useCallback(() => {
    const newIndex = Math.min(events.length - 1, currentIndex + 1);
    handleSliderChange(newIndex);
  }, [currentIndex, events.length, handleSliderChange]);

  const handleReset = useCallback(() => {
    setSelectedTime(new Date());
    setIsPlayingTimeline(false);
  }, [setSelectedTime, setIsPlayingTimeline]);

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#1890ff',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {dayjs(selectedTime).format('YYYY-MM-DD HH:mm:ss')}
          </span>
          {currentIndex >= 0 && events[currentIndex] && (
            <Tag color={events[currentIndex].color || '#1890ff'} style={{ margin: 0 }}>
              {events[currentIndex].title}
            </Tag>
          )}
        </div>
        <div className="timeline-controls">
          <Space size="small">
            <Tooltip title="回到最新">
              <Button
                type="text"
                icon={<FastBackwardOutlined />}
                onClick={handleReset}
                size="small"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              />
            </Tooltip>
            <Tooltip title="上一事件">
              <Button
                type="text"
                icon={<StepBackwardOutlined />}
                onClick={handleStepBackward}
                disabled={currentIndex <= 0}
                size="small"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              />
            </Tooltip>
            <Tooltip title={isPlayingTimeline ? '暂停' : '播放'}>
              <Button
                type="primary"
                icon={isPlayingTimeline ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={handlePlay}
                size="small"
              >
                {isPlayingTimeline ? '暂停' : '回放'}
              </Button>
            </Tooltip>
            <Tooltip title="下一事件">
              <Button
                type="text"
                icon={<StepForwardOutlined />}
                onClick={handleStepForward}
                disabled={currentIndex >= events.length - 1}
                size="small"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              />
            </Tooltip>
            <Tooltip title="快进">
              <Button
                type="text"
                icon={<FastForwardOutlined />}
                size="small"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              />
            </Tooltip>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginLeft: 8 }}>
              速度：1x
            </span>
          </Space>
        </div>
      </div>
      <div className="timeline-slider" style={{ flex: 1, padding: '0 20px' }}>
        <Slider
          min={0}
          max={events.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          marks={marks}
          step={null}
          tooltip={{
            formatter: (value) => {
              if (typeof value === 'number' && events[value]) {
                return `${events[value].fullTime} - ${events[value].title}`;
              }
              return '';
            },
          }}
          styles={{
            track: { background: 'linear-gradient(to right, #1890ff, #13c2c2)' },
            rail: { background: '#1e293b' },
            handle: { borderColor: '#1890ff', background: '#1890ff' },
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4px 20px 0',
          fontSize: 11,
          color: 'rgba(255,255,255,0.45)',
        }}
      >
        <span>{events[0]?.fullTime || '-'}</span>
        <span>{events[events.length - 1]?.fullTime || '-'}</span>
      </div>
    </div>
  );
};

export default Timeline;
