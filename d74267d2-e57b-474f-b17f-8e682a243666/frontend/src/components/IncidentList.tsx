import React, { useState } from 'react';
import { Input, Select, DatePicker, Button, Empty, Tag, Space } from 'antd';
import { SearchOutlined, FilterOutlined, PlusOutlined } from '@ant-design/icons';
import { useCommandStore } from '@/store/commandStore';
import { INCIDENT_TYPE_MAP, INCIDENT_LEVEL_MAP, INCIDENT_LEVEL_COLOR, INCIDENT_STATUS_MAP, INCIDENT_STATUS_COLOR } from '@/constants/dictionary';
import { Incident } from '@/types';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const IncidentList: React.FC = () => {
  const { incidents, currentIncident, setCurrentIncident, filters, setFilters } = useCommandStore();
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');

  const filteredIncidents = incidents.filter((incident) => {
    if (searchText) {
      const text = searchText.toLowerCase();
      if (
        !incident.title.toLowerCase().includes(text) &&
        !incident.location.toLowerCase().includes(text) &&
        !incident.incidentNo.toLowerCase().includes(text)
      ) {
        return false;
      }
    }
    if (filters.incidentType && incident.type !== filters.incidentType) return false;
    if (filters.incidentLevel && incident.level !== filters.incidentLevel) return false;
    if (filters.incidentStatus && incident.status !== filters.incidentStatus) return false;
    if (filters.regionCode && !incident.regionCode.startsWith(filters.regionCode)) return false;
    return true;
  });

  const handleIncidentClick = (incident: Incident) => {
    if (currentIncident?.id === incident.id) {
      setCurrentIncident(null);
    } else {
      setCurrentIncident(incident);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 12 }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.45)' }} />}
          placeholder="搜索灾情编号、标题、位置..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid #1e293b',
            color: '#fff',
            marginBottom: 8,
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="text"
            icon={<FilterOutlined />}
            onClick={() => setShowFilters(!showFilters)}
            style={{ color: showFilters ? '#1890ff' : 'rgba(255,255,255,0.65)', padding: '4px 12px' }}
            size="small"
          >
            筛选
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            style={{ flex: 1 }}
          >
            上报灾情
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="filter-section">
          <div className="filter-title">筛选条件</div>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Select
              placeholder="灾害类型"
              allowClear
              value={filters.incidentType || undefined}
              onChange={(v) => setFilters({ incidentType: v || null })}
              style={{ width: '100%' }}
              options={Object.entries(INCIDENT_TYPE_MAP).map(([value, label]) => ({
                value: Number(value),
                label,
              }))}
            />
            <Select
              placeholder="响应级别"
              allowClear
              value={filters.incidentLevel || undefined}
              onChange={(v) => setFilters({ incidentLevel: v || null })}
              style={{ width: '100%' }}
              options={Object.entries(INCIDENT_LEVEL_MAP).map(([value, label]) => ({
                value: Number(value),
                label,
              }))}
            />
            <Select
              placeholder="灾情状态"
              allowClear
              value={filters.incidentStatus || undefined}
              onChange={(v) => setFilters({ incidentStatus: v || null })}
              style={{ width: '100%' }}
              options={Object.entries(INCIDENT_STATUS_MAP).map(([value, label]) => ({
                value: Number(value),
                label,
              }))}
            />
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['开始时间', '结束时间']}
            />
          </Space>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredIncidents.length === 0 ? (
          <Empty
            description="暂无灾情数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ color: 'rgba(255,255,255,0.45)', marginTop: 40 }}
          />
        ) : (
          filteredIncidents.map((incident) => (
            <div
              key={incident.id}
              className={`incident-item ${currentIncident?.id === incident.id ? 'active' : ''}`}
              style={{ borderLeftColor: INCIDENT_LEVEL_COLOR[incident.level] }}
              onClick={() => handleIncidentClick(incident)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  className="level-badge"
                  style={{ background: INCIDENT_LEVEL_COLOR[incident.level] }}
                >
                  {INCIDENT_LEVEL_MAP[incident.level]}
                </span>
                <Tag
                  color={INCIDENT_STATUS_COLOR[incident.status]}
                  style={{ margin: 0, fontSize: 11 }}
                >
                  {INCIDENT_STATUS_MAP[incident.status]}
                </Tag>
              </div>
              <div className="title" title={incident.title}>
                {incident.title}
              </div>
              <div className="meta">
                <span>{INCIDENT_TYPE_MAP[incident.type]}</span>
                <span>{dayjs(incident.occurredAt).format('MM-DD HH:mm')}</span>
              </div>
              <div className="meta" style={{ marginTop: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                  📍 {incident.location.length > 15 ? incident.location.slice(0, 15) + '...' : incident.location}
                </span>
                {incident.casualties! > 0 && (
                  <span style={{ color: '#ff4d4f' }}>☠ {incident.casualties}人</span>
                )}
                {incident.trapped! > 0 && (
                  <span style={{ color: '#fa8c16' }}>🚨 {incident.trapped}人被困</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default IncidentList;
