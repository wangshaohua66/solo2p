import React from 'react';
import { useCommandStore } from '@/store/commandStore';
import { INCIDENT_LEVEL_MAP, INCIDENT_LEVEL_COLOR, INCIDENT_STATUS_MAP, INCIDENT_STATUS_COLOR, INCIDENT_TYPE_MAP } from '@/constants/dictionary';

const StatisticsBar: React.FC = () => {
  const { statistics, incidents } = useCommandStore();

  const level2Count = incidents.filter((i) => i.level === 2).length;

  const stats = [
    {
      label: '全部灾情',
      value: incidents.length,
      color: '#1890ff',
      className: '',
    },
    {
      label: 'Ⅰ级(特别重大)',
      value: statistics.level1,
      color: '#ff4d4f',
      className: 'level-1',
    },
    {
      label: 'Ⅱ级(重大)',
      value: level2Count,
      color: '#fa8c16',
      className: 'level-2',
    },
    {
      label: 'Ⅲ级(较大)',
      value: statistics.level3,
      color: '#faad14',
      className: 'level-3',
    },
    {
      label: 'Ⅳ级(一般)',
      value: statistics.level4,
      color: '#52c41a',
      className: 'level-4',
    },
    {
      label: '处置中',
      value: incidents.filter((i) => i.status <= 4).length,
      color: '#13c2c2',
      className: '',
    },
  ];

  return (
    <div className="statistics-bar">
      {stats.map((stat, index) => (
        <div key={index} className={`stat-card ${stat.className}`}>
          <div className="label">{stat.label}</div>
          <div className="value" style={{ color: stat.color }}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatisticsBar;
