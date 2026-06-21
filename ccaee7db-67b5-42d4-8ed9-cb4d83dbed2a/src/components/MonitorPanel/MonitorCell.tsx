import React, { useState, useEffect, useCallback, memo } from 'react';
import { ZoomInOutlined, CameraOutlined, WarningOutlined } from '@ant-design/icons';
import { message } from 'antd';
import type { ChannelData as _ChannelData, SignalStatus as _SignalStatus } from '@/types';
import styles from './style.module.less';

/**
 * 单个监控画面单元组件 Props
 */
export interface MonitorCellProps {
  channel: _ChannelData;
  isSelected?: boolean;
  isEnlarged?: boolean;
  onSelect?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
}

/**
 * 根据信号状态获取样式类名
 */
const getSignalStatusClass = (status: _SignalStatus): string => {
  switch (status) {
    case 'good':
      return styles.signalGood;
    case 'warning':
      return `${styles.signalWarning} ${styles.pulseBorder}`;
    case 'error':
      return `${styles.signalError} ${styles.pulseBorder}`;
    default:
      return '';
  }
};

/**
 * 单个监控画面单元组件
 */
const MonitorCell: React.FC<MonitorCellProps> = memo(function MonitorCell({
  channel,
  isSelected = false,
  isEnlarged = false,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging = false,
}) {
  // 16格音量柱高度状态
  const [volumeLevels, setVolumeLevels] = useState<number[]>(() =>
    Array(16).fill(0).map(() => Math.floor(Math.random() * 12) + 4),
  );

  // 模拟音量条实时跳动（每300ms随机值1-16）
  useEffect(() => {
    if (channel.signalStatus === 'error' && channel.isAudioLoss) {
      // 音频丢失时音量全为0
      setVolumeLevels(Array(16).fill(0));
      return;
    }

    const interval = setInterval(() => {
      setVolumeLevels(
        Array(16)
          .fill(0)
          .map(() => {
            // 信号异常时音量波动减小
            const maxLevel = channel.signalStatus === 'good' ? 16 : 8;
            const minLevel = channel.signalStatus === 'error' ? 0 : 2;
            return Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
          }),
      );
    }, 300);

    return () => clearInterval(interval);
  }, [channel.signalStatus, channel.isAudioLoss]);

  // 点击cell触发放大选中
  const handleClick = useCallback(() => {
    onSelect?.();
  }, [onSelect]);

  // 截图按钮
  const handleScreenshot = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      message.success(`已截取【${channel.name}】画面`);
    },
    [channel.name],
  );

  // 告警详情按钮
  const handleAlarmDetail = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      message.info(`查看【${channel.name}】告警详情`);
    },
    [channel.name],
  );

  // 放大按钮（等同于点击cell）
  const handleZoom = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect?.();
    },
    [onSelect],
  );

  const cellWrapperClass = [
    styles.monitorCell,
    getSignalStatusClass(channel.signalStatus),
    isDragging ? styles.dragging : '',
    isSelected ? styles.isSelected : '',
    isEnlarged ? styles.enlargedCell : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cellWrapperClass}
      onClick={handleClick}
      draggable={!isEnlarged}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* 背景层：模拟视频画面 */}
      <div className={styles.videoBackground}>
        <div className={styles.programName}>{channel.programName}</div>
      </div>

      {/* 顶部频道信息栏 */}
      <div className={styles.cellInfoBar}>
        <span className={styles.cellChannelName} title={channel.name}>
          {channel.name}
        </span>
        <span className={styles.cellStationName} title={channel.stationName}>
          {channel.stationName}
        </span>
      </div>

      {/* 信号状态指示灯 */}
      <div
        className={`${styles.signalIndicator} ${styles[channel.signalStatus]}`}
        title={`信号状态：${channel.signalStatus === 'good' ? '正常' : channel.signalStatus === 'warning' ? '警告' : '异常'}`}
      />

      {/* 三色检测标识 */}
      <div className={styles.detectionBadges}>
        {channel.isBlackFrame && (
          <div className={`${styles.detectionBadge} ${styles.badgeBlackFrame}`} title="黑帧检测">
            BF
          </div>
        )}
        {channel.isStaticFrame && (
          <div className={`${styles.detectionBadge} ${styles.badgeStaticFrame}`} title="静帧检测">
            SF
          </div>
        )}
        {channel.isAudioLoss && (
          <div className={`${styles.detectionBadge} ${styles.badgeAudioLoss}`} title="音频丢失">
            🔊
          </div>
        )}
      </div>

      {/* 音量条：16格音量柱 */}
      <div className={styles.volumeBar}>
        {volumeLevels.map((level, index) => (
          <div
            key={index}
            className={styles.volumeBlock}
            style={{ height: `${(level / 16) * 100}%` }}
          />
        ))}
      </div>

      {/* 鼠标悬浮操作按钮 */}
      <div className={styles.cellToolbar} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={handleZoom}
          title="放大画面"
        >
          <ZoomInOutlined />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={handleScreenshot}
          title="画面截图"
        >
          <CameraOutlined />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={handleAlarmDetail}
          title="告警详情"
        >
          <WarningOutlined />
        </button>
      </div>
    </div>
  );
});

export default MonitorCell;
