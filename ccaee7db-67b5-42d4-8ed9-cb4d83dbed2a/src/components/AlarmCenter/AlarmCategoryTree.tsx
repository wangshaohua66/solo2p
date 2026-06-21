import React, { useMemo } from 'react';
import { Tree, Badge } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { AlarmItem, FilterType, AlarmLevel, AlarmType } from '@/types';
import { groupAlarms } from '@/utils/alarmClassifier';

interface AlarmCategoryTreeProps {
  alarms: AlarmItem[];
  onSelect: (filter: FilterType) => void;
  selectedFilter: FilterType;
}

const LEVEL_TEXT: Record<AlarmLevel, string> = {
  urgent: '紧急',
  important: '重要',
  general: '一般',
};

const TYPE_TEXT: Record<AlarmType, string> = {
  signal_loss: '信号中断',
  black_frame: '黑场',
  static_frame: '静帧',
  audio_loss: '音频丢失',
  bitrate_error: '码率异常',
  device_offline: '设备离线',
};

const LEVEL_ORDER: AlarmLevel[] = ['urgent', 'important', 'general'];
const TYPE_ORDER: AlarmType[] = [
  'signal_loss',
  'black_frame',
  'static_frame',
  'audio_loss',
  'bitrate_error',
  'device_offline',
];

const AlarmCategoryTree: React.FC<AlarmCategoryTreeProps> = ({
  alarms,
  onSelect,
  selectedFilter,
}) => {
  const grouped = useMemo(() => groupAlarms(alarms), [alarms]);

  const treeData = useMemo<DataNode[]>(() => {
    const levelChildren: DataNode[] = LEVEL_ORDER.map((level) => ({
      key: `level-${level}`,
      title: (
        <span className="tree-node-title">
          {LEVEL_TEXT[level]}
          <Badge
            count={grouped.byLevel[level].length}
            size="small"
            color={
              level === 'urgent'
                ? '#ff4d4f'
                : level === 'important'
                ? '#fa8c16'
                : '#faad14'
            }
          />
        </span>
      ),
    }));

    const typeChildren: DataNode[] = TYPE_ORDER.map((type) => ({
      key: `type-${type}`,
      title: (
        <span className="tree-node-title">
          {TYPE_TEXT[type]}
          <Badge count={grouped.byType[type].length} size="small" />
        </span>
      ),
    }));

    const stationEntries = Object.entries(grouped.byStation)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 15);

    const stationChildren: DataNode[] = stationEntries.map(([stationId, stationAlarms]) => {
      const stationName = stationAlarms[0]?.stationName || stationId;
      const channelMap = new Map<string, AlarmItem[]>();
      stationAlarms.forEach((alarm) => {
        const list = channelMap.get(alarm.channelId) || [];
        list.push(alarm);
        channelMap.set(alarm.channelId, list);
      });

      const channelChildren: DataNode[] = Array.from(channelMap.entries()).map(
        ([channelId, channelAlarms]) => ({
          key: `channel-${stationId}-${channelId}`,
          title: (
            <span className="tree-node-title">
              {channelAlarms[0]?.channelName || channelId}
              <Badge count={channelAlarms.length} size="small" />
            </span>
          ),
        }),
      );

      return {
        key: `station-${stationId}`,
        title: (
          <span className="tree-node-title">
            {stationName}
            <Badge count={stationAlarms.length} size="small" />
          </span>
        ),
        children: channelChildren,
      };
    });

    return [
      {
        key: 'category-level',
        title: '按级别',
        children: levelChildren,
      },
      {
        key: 'category-type',
        title: '按告警类型',
        children: typeChildren,
      },
      {
        key: 'category-station',
        title: '按机房',
        children: stationChildren,
      },
    ];
  }, [grouped]);

  const selectedKeys = useMemo<string[]>(() => {
    if (!selectedFilter.category) return [];
    if (selectedFilter.category === 'level' && selectedFilter.level) {
      return [`level-${selectedFilter.level}`];
    }
    if (selectedFilter.category === 'type' && selectedFilter.type) {
      return [`type-${selectedFilter.type}`];
    }
    if (selectedFilter.category === 'station') {
      if (selectedFilter.channelId && selectedFilter.stationId) {
        return [`channel-${selectedFilter.stationId}-${selectedFilter.channelId}`];
      }
      if (selectedFilter.stationId) {
        return [`station-${selectedFilter.stationId}`];
      }
    }
    return [];
  }, [selectedFilter]);

  const handleSelect = (keys: React.Key[]) => {
    if (keys.length === 0) {
      onSelect({});
      return;
    }
    const key = String(keys[0]);
    const parts = key.split('-');
    const prefix = parts[0];

    if (prefix === 'level') {
      onSelect({ category: 'level', level: parts[1] as AlarmLevel });
    } else if (prefix === 'type') {
      onSelect({ category: 'type', type: parts.slice(1).join('-') as AlarmType });
    } else if (prefix === 'station') {
      onSelect({ category: 'station', stationId: parts.slice(1).join('-') });
    } else if (prefix === 'channel') {
      const stationId = parts[1];
      const channelId = parts.slice(2).join('-');
      onSelect({ category: 'station', stationId, channelId });
    }
  };

  return (
    <Tree
      className="alarm-category-tree"
      treeData={treeData}
      selectedKeys={selectedKeys}
      onSelect={handleSelect}
      defaultExpandedKeys={['category-level']}
      showLine={{ showLeafIcon: false }}
      blockNode
    />
  );
};

export default AlarmCategoryTree;
