import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Radio,
  Button,
  Select,
  Modal,
  Tooltip,
  Space,
  message,
} from 'antd';
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  ReloadOutlined,
  SearchOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import type { RadioChangeEvent } from 'antd';
import type { MonitorLayoutType as _MLT, ChannelData as _CD } from '@/types';
import { useMonitorStore } from '@/stores/monitorStore';
import type { MonitorState, MonitorActions } from '@/stores/monitorStore';
type _Store = MonitorState & MonitorActions;
import MonitorCell from './MonitorCell';
import styles from './style.module.less';

/**
 * 布局类型对应画面数量
 */
const LAYOUT_COUNTS: Record<_MLT, number> = {
  '1x1': 1,
  '2x2': 4,
  '3x3': 9,
  '4x4': 16,
};

/**
 * 布局选项
 */
const LAYOUT_OPTIONS: { label: string; value: _MLT }[] = [
  { label: '1画面', value: '1x1' },
  { label: '4画面', value: '2x2' },
  { label: '9画面', value: '3x3' },
  { label: '16画面', value: '4x4' },
];

/**
 * 多画面监控墙主组件
 */
const MonitorPanel: React.FC = () => {
  const store = useMonitorStore;
  const layout = store((s: _Store) => s.layout);
  const channels = store((s: _Store) => s.channels);
  const channelOrder = store((s: _Store) => s.channelOrder);
  const selectedChannelId = store((s: _Store) => s.selectedChannelId);
  const setLayout = store((s: _Store) => s.setLayout);
  const setSelectedChannel = store((s: _Store) => s.setSelectedChannel);
  const reorderChannels = store((s: _Store) => s.reorderChannels);
  const initializeMockData = store((s: _Store) => s.initializeMockData);

  // 本地状态
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [isZoomMode, setIsZoomMode] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // 初始化 Mock 数据（如果尚未初始化）
  useEffect(() => {
    if (channelOrder.length === 0) {
      initializeMockData();
    }
  }, [channelOrder.length, initializeMockData]);

  // 根据布局类型计算 gridTemplateColumns
  const gridTemplateColumns = useMemo(() => {
    const cols = parseInt(layout.split('x')[0], 10);
    return `repeat(${cols}, 1fr)`;
  }, [layout]);

  // 根据布局计算 gridTemplateRows
  const gridTemplateRows = useMemo(() => {
    const rows = parseInt(layout.split('x')[1], 10);
    return `repeat(${rows}, 1fr)`;
  }, [layout]);

  // 当前布局需要的画面数量
  const currentLayoutCount = LAYOUT_COUNTS[layout];

  const displayedChannels: (_CD | null)[] = useMemo(() => {
    const filteredOrder = searchKeyword
      ? channelOrder.filter((id: string) => {
          const ch = channels[id];
          if (!ch) return false;
          const keyword = searchKeyword.toLowerCase();
          return (
            ch.name.toLowerCase().includes(keyword) ||
            ch.stationName.toLowerCase().includes(keyword) ||
            ch.programName.toLowerCase().includes(keyword)
          );
        })
      : channelOrder;

    const result: (_CD | null)[] = [];
    for (let i = 0; i < currentLayoutCount; i++) {
      const channelId = filteredOrder[i];
      result.push(channelId ? channels[channelId] || null : null);
    }
    return result;
  }, [channelOrder, channels, searchKeyword, currentLayoutCount]);

  const channelSelectOptions = useMemo(() => {
    return channelOrder
      .map<string | undefined>((id: string) => (channels[id] ? id : undefined))
      .filter((id: string | undefined): id is string => !!id)
      .map((id: string) => {
        const ch = channels[id]!;
        return {
          label: `${ch.name} - ${ch.stationName}`,
          value: ch.id,
        };
      });
  }, [channelOrder, channels]);

  // 选中放大的频道数据
  const selectedChannel = selectedChannelId ? channels[selectedChannelId] : null;

  const handleLayoutChange = useCallback(
    (e: RadioChangeEvent) => {
      setLayout(e.target.value as _MLT);
    },
    [setLayout],
  );

  // 放大/缩小切换按钮
  const handleZoomToggle = useCallback(() => {
    setIsZoomMode((prev) => {
      const next = !prev;
      if (next) {
        // 切换到1画面
        setLayout('1x1');
      } else {
        // 恢复到3x3
        setLayout('3x3');
      }
      return next;
    });
  }, [setLayout]);

  // 全屏切换（Fullscreen API）
  const handleFullscreenToggle = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
        message.success('已进入全屏模式');
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        message.success('已退出全屏模式');
      }
    } catch (err) {
      message.error('全屏操作失败');
    }
  }, []);

  // 监听全屏状态变化（用户按ESC等操作）
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 刷新按钮
  const handleRefresh = useCallback(() => {
    message.loading({ content: '正在刷新监控画面...', key: 'refresh' });
    setTimeout(() => {
      initializeMockData();
      message.success({ content: '监控画面已刷新', key: 'refresh' });
    }, 600);
  }, [initializeMockData]);

  // 搜索频道选择
  const handleChannelSelect = useCallback(
    (value: string) => {
      setSelectedChannel(value);
      setSearchKeyword('');
    },
    [setSelectedChannel],
  );

  // ===== 拖拽重排：HTML5 Drag & Drop =====

  const handleCellDragStart = useCallback(
    (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
      // 只有实际有频道数据的cell才允许拖拽排序
      if (!displayedChannels[index]) {
        e.preventDefault();
        return;
      }
      setDragStartIndex(index);
      setDraggingIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    [displayedChannels],
  );

  const handleCellDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleCellDrop = useCallback(
    (dropIndex: number) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (dragStartIndex === null || dragStartIndex === dropIndex) {
        setDragStartIndex(null);
        setDraggingIndex(null);
        return;
      }

      // 调用 reorderChannels 完成排序
      reorderChannels(dragStartIndex, dropIndex);

      setDragStartIndex(null);
      setDraggingIndex(null);
    },
    [dragStartIndex, reorderChannels],
  );

  // 放大Modal关闭
  const handleModalClose = useCallback(() => {
    setSelectedChannel(null);
  }, [setSelectedChannel]);

  return (
    <div className={styles.monitorPanel} ref={containerRef}>
      {/* 顶部工具栏 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.layoutLabel}>画面布局：</span>
          <Radio.Group
            value={layout}
            onChange={handleLayoutChange}
            optionType="button"
            buttonStyle="solid"
            size="middle"
          >
            {LAYOUT_OPTIONS.map((opt) => (
              <Radio.Button key={opt.value} value={opt.value}>
                {opt.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>

        <div className={styles.toolbarRight}>
          <Space size="small">
            {/* 搜索频道下拉 */}
            <Select
              showSearch
              placeholder="搜索频道..."
              allowClear
              size="middle"
              style={{ width: 240 }}
              value={searchKeyword || undefined}
              filterOption={false}
              onSearch={setSearchKeyword}
              onChange={handleChannelSelect}
              options={channelSelectOptions}
              suffixIcon={<SearchOutlined style={{ color: 'rgba(255,255,255,0.65)' }} />}
              notFoundContent="未找到匹配频道"
            />

            {/* 放大切换按钮 */}
            <Tooltip title={isZoomMode ? '恢复多画面' : '切换到单画面'}>
              <Button
                type="default"
                icon={isZoomMode ? <ZoomOutOutlined /> : <ZoomInOutlined />}
                onClick={handleZoomToggle}
              />
            </Tooltip>

            {/* 全屏按钮 */}
            <Tooltip title={isFullscreen ? '退出全屏' : '全屏显示'}>
              <Button
                type="default"
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={handleFullscreenToggle}
              />
            </Tooltip>

            {/* 刷新按钮 */}
            <Tooltip title="刷新监控数据">
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
              >
                刷新
              </Button>
            </Tooltip>
          </Space>
        </div>
      </div>

      {/* 监控网格容器 */}
      <div
        className={styles.monitorGrid}
        style={{
          gridTemplateColumns,
          gridTemplateRows,
        }}
      >
        {displayedChannels.map((channel, index) =>
          channel ? (
            <MonitorCell
              key={channel.id}
              channel={channel}
              isSelected={selectedChannelId === channel.id}
              isDragging={draggingIndex === index}
              onSelect={() => setSelectedChannel(channel.id)}
              onDragStart={handleCellDragStart(index)}
              onDragOver={handleCellDragOver}
              onDrop={handleCellDrop(index)}
            />
          ) : (
            // 空位占位：保持网格结构
            <div
              key={`empty-${index}`}
              className={styles.monitorCell}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px dashed rgba(255,255,255,0.1)',
                cursor: 'default',
              }}
            />
          ),
        )}
      </div>

      <Modal
        open={!!selectedChannel}
        onCancel={handleModalClose}
        footer={null}
        width="90vw"
        centered
        destroyOnHidden
        className={styles.enlargedModal}
        title={selectedChannel ? `${selectedChannel.name} - ${selectedChannel.programName}` : undefined}
      >
        {selectedChannel && (
          <MonitorCell
            channel={selectedChannel}
            isEnlarged
            onSelect={() => {}}
          />
        )}
      </Modal>
    </div>
  );
};

export default MonitorPanel;
