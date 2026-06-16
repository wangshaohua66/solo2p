import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Spin, Modal, Tag, Button, Space, Descriptions } from 'antd';
import { useCommandStore } from '@/store/commandStore';
import {
  INCIDENT_LEVEL_MAP,
  INCIDENT_LEVEL_COLOR,
  INCIDENT_STATUS_MAP,
  INCIDENT_STATUS_COLOR,
  TEAM_STATUS_MAP,
  TEAM_STATUS_COLOR,
} from '@/constants/dictionary';
import { MapPoint, Incident, RescueTeam, Warehouse } from '@/types';

interface MapContainerProps {
  className?: string;
  style?: React.CSSProperties;
}

const MapContainer: React.FC<MapContainerProps> = ({ className, style }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { incidents, teams, warehouses, currentIncident, setCurrentIncident } = useCommandStore();

  const mapPoints = useMemo(() => {
    const points: MapPoint[] = [];

    incidents.forEach((incident) => {
      if (incident.locationPoint) {
        points.push({
          id: `incident-${incident.id}`,
          type: 'incident',
          position: incident.locationPoint,
          name: incident.title,
          status: INCIDENT_STATUS_MAP[incident.status],
          level: incident.level,
          data: incident,
        });
      }
    });

    teams.forEach((team) => {
      if (team.locationPoint) {
        points.push({
          id: `team-${team.id}`,
          type: 'team',
          position: team.locationPoint,
          name: team.teamName,
          status: TEAM_STATUS_MAP[team.status],
          data: team,
        });
      }
    });

    warehouses.forEach((warehouse) => {
      if (warehouse.locationPoint) {
        points.push({
          id: `warehouse-${warehouse.id}`,
          type: 'warehouse',
          position: warehouse.locationPoint,
          name: warehouse.warehouseName,
          data: warehouse,
        });
      }
    });

    return points;
  }, [incidents, teams, warehouses]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handlePointClick = useCallback(
    (point: MapPoint) => {
      setSelectedPoint(point);
      setShowDetail(true);
      if (point.type === 'incident' && point.data) {
        setCurrentIncident(point.data as Incident);
      }
    },
    [setCurrentIncident]
  );

  const handleBackgroundClick = useCallback(() => {
    setCurrentIncident(null);
  }, [setCurrentIncident]);

  const renderMarker = (point: MapPoint) => {
    const isSelected = currentIncident?.id === point.data?.id && point.type === 'incident';
    const isHighLevel = point.type === 'incident' && (point.data as Incident)?.level <= 2;

    let bgColor = '#1890ff';
    let icon = '📍';

    if (point.type === 'incident') {
      bgColor = INCIDENT_LEVEL_COLOR[(point.data as Incident)?.level || 4];
      icon = '🚨';
    } else if (point.type === 'team') {
      bgColor = TEAM_STATUS_COLOR[(point.data as RescueTeam)?.status || 1];
      icon = '🚒';
    } else if (point.type === 'warehouse') {
      bgColor = '#52c41a';
      icon = '🏭';
    }

    return (
      <div
        key={point.id}
        onClick={(e) => {
          e.stopPropagation();
          handlePointClick(point);
        }}
        className={`map-marker ${isSelected ? 'selected' : ''} ${isHighLevel ? 'pulse-animation' : ''}`}
        style={{
          position: 'absolute',
          left: `${30 + Math.random() * 40}%`,
          top: `${30 + Math.random() * 40}%`,
          transform: 'translate(-50%, -100%)',
          cursor: 'pointer',
          zIndex: isSelected ? 20 : 10,
          transition: 'transform 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translate(-50%, -100%) scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translate(-50%, -100%)';
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              background: bgColor,
              color: '#fff',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              border: isSelected ? '2px solid #fff' : 'none',
            }}
          >
            <span>{icon}</span>
            <span>{point.name}</span>
          </div>
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `8px solid ${bgColor}`,
              marginTop: -1,
            }}
          />
        </div>
      </div>
    );
  };

  const renderDetailModal = () => {
    if (!selectedPoint || !selectedPoint.data) return null;

    let title = '';
    let content = null;

    if (selectedPoint.type === 'incident') {
      const incident = selectedPoint.data as Incident;
      title = `灾情详情 - ${incident.incidentNo}`;
      content = (
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="灾情编号">{incident.incidentNo}</Descriptions.Item>
          <Descriptions.Item label="灾害类型">{INCIDENT_LEVEL_MAP[incident.type] || '其他'}</Descriptions.Item>
          <Descriptions.Item label="响应级别">
            <Tag color={INCIDENT_LEVEL_COLOR[incident.level]}>{INCIDENT_LEVEL_MAP[incident.level]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="当前状态">
            <Tag color={INCIDENT_STATUS_COLOR[incident.status]}>{INCIDENT_STATUS_MAP[incident.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="发生地点">{incident.location}</Descriptions.Item>
          <Descriptions.Item label="发生时间">{incident.occurredAt}</Descriptions.Item>
          <Descriptions.Item label="受灾面积">{incident.affectedArea || 0} km²</Descriptions.Item>
          <Descriptions.Item label="受灾人数">{incident.affectedPopulation || 0} 人</Descriptions.Item>
          <Descriptions.Item label="死亡">{incident.casualties || 0} 人</Descriptions.Item>
          <Descriptions.Item label="受伤">{incident.injured || 0} 人</Descriptions.Item>
          <Descriptions.Item label="失联">{incident.missing || 0} 人</Descriptions.Item>
          <Descriptions.Item label="被困">{incident.trapped || 0} 人</Descriptions.Item>
          <Descriptions.Item label="预估损失">¥ {incident.estimatedLoss?.toLocaleString() || 0} 万</Descriptions.Item>
          <Descriptions.Item label="信息来源">{incident.sourceType}</Descriptions.Item>
          <Descriptions.Item label="灾情描述" span={2}>
            {incident.description}
          </Descriptions.Item>
          <Descriptions.Item label="天气情况">{incident.weatherCondition || '-'}</Descriptions.Item>
          <Descriptions.Item label="地形情况">{incident.terrainCondition || '-'}</Descriptions.Item>
        </Descriptions>
      );
    } else if (selectedPoint.type === 'team') {
      const team = selectedPoint.data as RescueTeam;
      title = `救援队伍详情 - ${team.teamCode}`;
      content = (
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="队伍编号">{team.teamCode}</Descriptions.Item>
          <Descriptions.Item label="队伍名称">{team.teamName}</Descriptions.Item>
          <Descriptions.Item label="队伍类型">{team.teamType}</Descriptions.Item>
          <Descriptions.Item label="当前状态">
            <Tag color={TEAM_STATUS_COLOR[team.status]}>{TEAM_STATUS_MAP[team.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="人员编制">{team.teamSize} 人</Descriptions.Item>
          <Descriptions.Item label="当前任务">{team.currentTaskCount} 个</Descriptions.Item>
          <Descriptions.Item label="队长">{team.leaderName}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{team.leaderPhone}</Descriptions.Item>
          <Descriptions.Item label="驻地">{team.address}</Descriptions.Item>
          <Descriptions.Item label="响应半径">{team.responseRadius} km</Descriptions.Item>
          <Descriptions.Item label="平均到达时间">{team.averageArrivalTime} 分钟</Descriptions.Item>
          <Descriptions.Item label="所属区域">{team.regionCode}</Descriptions.Item>
          <Descriptions.Item label="装备配置" span={2}>
            {team.equipment}
          </Descriptions.Item>
          <Descriptions.Item label="救援能力" span={2}>
            {team.capabilities}
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (selectedPoint.type === 'warehouse') {
      const warehouse = selectedPoint.data as Warehouse;
      title = `物资仓库详情 - ${warehouse.warehouseCode}`;
      content = (
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="仓库编号">{warehouse.warehouseCode}</Descriptions.Item>
          <Descriptions.Item label="仓库名称">{warehouse.warehouseName}</Descriptions.Item>
          <Descriptions.Item label="仓库类型">{warehouse.warehouseType === 1 ? '中心仓库' : '储备仓库'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={warehouse.status === 1 ? '#52c41a' : '#ff4d4f'}>
              {warehouse.status === 1 ? '正常' : '停用'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="总容量">{warehouse.capacity} 件</Descriptions.Item>
          <Descriptions.Item label="已使用">{warehouse.usedCapacity} 件</Descriptions.Item>
          <Descriptions.Item label="负责人">{warehouse.managerName}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{warehouse.managerPhone}</Descriptions.Item>
          <Descriptions.Item label="仓库地址" span={2}>
            {warehouse.address}
          </Descriptions.Item>
          <Descriptions.Item label="所属区域">{warehouse.regionCode}</Descriptions.Item>
          <Descriptions.Item label="所属机构">{warehouse.organizationId}</Descriptions.Item>
        </Descriptions>
      );
    }

    return (
      <Modal
        title={title}
        open={showDetail}
        onCancel={() => {
          setShowDetail(false);
          setSelectedPoint(null);
        }}
        footer={
          <Space>
            <Button onClick={() => setShowDetail(false)}>关闭</Button>
            {selectedPoint.type === 'incident' && (
              <Button type="primary">创建调度方案</Button>
            )}
          </Space>
        }
        width={720}
      >
        {content}
      </Modal>
    );
  };

  return (
    <div
      ref={mapRef}
      className={`map-container ${className || ''}`}
      style={{
        ...style,
        background: `
          linear-gradient(rgba(24, 144, 255, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(24, 144, 255, 0.05) 1px, transparent 1px),
          linear-gradient(135deg, #0a1628 0%, #0f1e38 50%, #0a1628 100%)
        `,
        backgroundSize: '50px 50px, 50px 50px, 100% 100%',
        position: 'relative',
      }}
      onClick={handleBackgroundClick}
    >
      {loading && (
        <div className="map-loading">
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.45)' }}>正在加载地图...</div>
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: 80,
          right: 16,
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid #1e293b',
          borderRadius: 6,
          padding: 12,
          backdropFilter: 'blur(8px)',
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>图例</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff4d4f' }} />
            <span>Ⅰ级灾情</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#fa8c16' }} />
            <span>Ⅱ级灾情</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#faad14' }} />
            <span>Ⅲ级灾情</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#52c41a' }} />
            <span>Ⅳ级灾情</span>
          </div>
          <div style={{ borderTop: '1px solid #1e293b', margin: '4px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#1890ff' }} />
            <span>救援队伍</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#13c2c2' }} />
            <span>物资仓库</span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 136,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 10,
        }}
      >
        <Button
          style={{
            width: 36,
            height: 36,
            padding: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid #1e293b',
            color: '#fff',
          }}
        >
          +
        </Button>
        <Button
          style={{
            width: 36,
            height: 36,
            padding: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid #1e293b',
            color: '#fff',
          }}
        >
          -
        </Button>
      </div>

      {!loading &&
        mapPoints.map((point) =>
          renderMarker(point)
        )}

      {currentIncident && currentIncident.locationPoint && (
        <div
          style={{
            position: 'absolute',
            left: `${30 + Math.random() * 40}%`,
            top: `${30 + Math.random() * 40}%`,
            width: '80px',
            height: '80px',
            border: `2px solid ${INCIDENT_LEVEL_COLOR[currentIncident.level]}`,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            animation: 'pulse 1.5s infinite',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
      )}

      {renderDetailModal()}
    </div>
  );
};

export default MapContainer;
