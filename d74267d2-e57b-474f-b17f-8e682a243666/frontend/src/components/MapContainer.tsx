import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L, { Map as LeafletMap, TileLayer, Marker, Popup, Circle, Polygon, LayerGroup, GeoJSON } from 'leaflet';
import { Spin, Modal, Tag, Button, Space, Descriptions, Card, List } from 'antd';
import {
  EnvironmentOutlined,
  SafetyOutlined,
  ShopOutlined,
  RocketOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import { useCommandStore } from '@/store/commandStore';
import {
  INCIDENT_LEVEL_MAP,
  INCIDENT_LEVEL_COLOR,
  INCIDENT_STATUS_MAP,
  INCIDENT_STATUS_COLOR,
  INCIDENT_TYPE_MAP,
  TEAM_STATUS_MAP,
  TEAM_STATUS_COLOR,
} from '@/constants/dictionary';
import {
  MAP_CENTER,
  MAP_ZOOM,
  MAP_MIN_ZOOM,
  MAP_MAX_ZOOM,
  MAP_BOUNDS,
  ANHUI_PROVINCE,
  PROVINCIAL_EMERGENCY_CENTER,
  getLocationByRegionCode,
} from '@/constants/geoConfig';
import { MapPoint, Incident, RescueTeam, Warehouse, TimelineEvent } from '@/types';
import dayjs from 'dayjs';
import 'leaflet/dist/leaflet.css';

interface MapContainerProps {
  className?: string;
  style?: React.CSSProperties;
}

const MapContainer: React.FC<MapContainerProps> = ({ className, style }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const incidentsLayerRef = useRef<LayerGroup | null>(null);
  const teamsLayerRef = useRef<LayerGroup | null>(null);
  const warehousesLayerRef = useRef<LayerGroup | null>(null);
  const routesLayerRef = useRef<LayerGroup | null>(null);

  const [loading, setLoading] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [layers, setLayers] = useState({
    incidents: true,
    teams: true,
    warehouses: true,
    routes: false,
    heatmap: false,
  });
  const [timelineIndex, setTimelineIndex] = useState(-1);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);

  const { incidents, teams, warehouses, currentIncident, setCurrentIncident, timelineEvents, selectedTime } =
    useCommandStore();

  const createCustomIcon = useCallback((type: string, color: string, pulse: boolean = false) => {
    const iconHtml = `
      <div style="position: relative;">
        <div style="
          width: 32px;
          height: 32px;
          background: ${color};
          border: 3px solid #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 14px;
          font-weight: bold;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ${pulse ? 'animation: pulse 1.5s infinite;' : ''}
        ">
          ${type === 'incident' ? '🚨' : type === 'team' ? '🚒' : type === 'warehouse' ? '🏭' : '📍'}
        </div>
        <div style="
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid ${color};
        "></div>
      </div>
    `;

    return L.divIcon({
      html: iconHtml,
      className: 'custom-marker',
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      popupAnchor: [0, -40],
    });
  }, []);

  const incidentPoints = useMemo<MapPoint[]>(() => {
    const points: MapPoint[] = [];
    incidents.forEach((incident) => {
      let position: [number, number];
      if (incident.locationPoint && incident.locationPoint.lat && incident.locationPoint.lng) {
        position = [incident.locationPoint.lat, incident.locationPoint.lng];
      } else {
        position = getLocationByRegionCode(incident.regionCode) || MAP_CENTER;
      }
      points.push({
        id: `incident-${incident.id}`,
        type: 'incident',
        position: { lat: position[0], lng: position[1] },
        name: incident.title,
        status: INCIDENT_STATUS_MAP[incident.status],
        level: incident.level,
        data: incident,
      });
    });
    return points;
  }, [incidents]);

  const teamPoints = useMemo<MapPoint[]>(() => {
    const points: MapPoint[] = [];
    teams.forEach((team) => {
      let position: [number, number];
      if (team.locationPoint && team.locationPoint.lat && team.locationPoint.lng) {
        position = [team.locationPoint.lat, team.locationPoint.lng];
      } else {
        position = getLocationByRegionCode(team.regionCode) || MAP_CENTER;
      }
      points.push({
        id: `team-${team.id}`,
        type: 'team',
        position: { lat: position[0], lng: position[1] },
        name: team.teamName,
        status: TEAM_STATUS_MAP[team.status],
        data: team,
      });
    });
    return points;
  }, [teams]);

  const warehousePoints = useMemo<MapPoint[]>(() => {
    const points: MapPoint[] = [];
    warehouses.forEach((warehouse) => {
      let position: [number, number];
      if (warehouse.locationPoint && warehouse.locationPoint.lat && warehouse.locationPoint.lng) {
        position = [warehouse.locationPoint.lat, warehouse.locationPoint.lng];
      } else {
        position = getLocationByRegionCode(warehouse.regionCode) || MAP_CENTER;
      }
      points.push({
        id: `warehouse-${warehouse.id}`,
        type: 'warehouse',
        position: { lat: position[0], lng: position[1] },
        name: warehouse.warehouseName,
        data: warehouse,
      });
    });
    return points;
  }, [warehouses]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }
      .custom-marker {
        background: transparent !important;
        border: none !important;
      }
      .leaflet-popup-content-wrapper {
        background: rgba(15, 23, 42, 0.95);
        color: #fff;
        border-radius: 8px;
        border: 1px solid #1e293b;
      }
      .leaflet-popup-content {
        margin: 12px 16px;
      }
      .leaflet-popup-tip {
        background: rgba(15, 23, 42, 0.95);
      }
      .leaflet-control-attribution {
        background: rgba(15, 23, 42, 0.8) !important;
        color: rgba(255,255,255,0.45) !important;
      }
      .leaflet-control-attribution a {
        color: #1890ff !important;
      }
    `;
    document.head.appendChild(style);

    const map = L.map(mapContainerRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    map.setMaxBounds(MAP_BOUNDS);
    map.setMaxBoundsViscosity(0.5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxNativeZoom: 19,
    }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxNativeZoom: 19,
    }).addTo(map);

    L.circle(PROVINCIAL_EMERGENCY_CENTER, {
      color: '#1890ff',
      fillColor: '#1890ff',
      fillOpacity: 0.2,
      radius: 5000,
      weight: 2,
    }).addTo(map).bindPopup('省级应急指挥中心');

    incidentsLayerRef.current = L.layerGroup().addTo(map);
    teamsLayerRef.current = L.layerGroup().addTo(map);
    warehousesLayerRef.current = L.layerGroup().addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);

    const geoJsonData = {
      type: 'Feature',
      properties: { name: '安徽省' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [114.9, 29.4],
          [119.6, 29.4],
          [119.6, 34.6],
          [114.9, 34.6],
          [114.9, 29.4],
        ]],
      },
    };

    L.geoJSON(geoJsonData as any, {
      style: {
        color: '#1890ff',
        weight: 2,
        fillColor: 'transparent',
        fillOpacity: 0,
        dashArray: '10, 10',
      },
    }).addTo(map);

    mapRef.current = map;

    setTimeout(() => {
      setLoading(false);
      map.invalidateSize();
    }, 500);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !incidentsLayerRef.current) return;

    incidentsLayerRef.current.clearLayers();

    if (layers.incidents) {
      const filteredPoints = timelineIndex >= 0
        ? incidentPoints.filter((_, idx) => idx <= timelineIndex)
        : incidentPoints;

      filteredPoints.forEach((point) => {
        const incident = point.data as Incident;
        const color = INCIDENT_LEVEL_COLOR[incident.level || 4];
        const isHighLevel = incident.level && incident.level <= 2;
        const isSelected = currentIncident?.id === incident.id;

        const marker = L.marker([point.position.lat, point.position.lng], {
          icon: createCustomIcon('incident', color, isHighLevel || isSelected),
          zIndexOffset: isSelected ? 1000 : isHighLevel ? 500 : 100,
        });

        const popupContent = `
          <div style="min-width: 240px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: ${color};">
              ${point.name}
            </div>
            <div style="margin-bottom: 8px;">
              <span style="padding: 2px 8px; background: ${color}; color: #fff; border-radius: 10px; font-size: 12px;">
                ${INCIDENT_LEVEL_MAP[incident.level || 4]}
              </span>
              <span style="margin-left: 8px; padding: 2px 8px; background: ${INCIDENT_STATUS_COLOR[incident.status]}; color: #fff; border-radius: 10px; font-size: 12px;">
                ${INCIDENT_STATUS_MAP[incident.status]}
              </span>
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.65); margin-bottom: 4px;">
              📍 ${incident.location}
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.65); margin-bottom: 4px;">
              👥 受灾: ${incident.affectedPopulation || 0}人
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.65);">
              ⏰ ${dayjs(incident.occurredAt).format('MM-DD HH:mm')}
            </div>
            <div style="margin-top: 8px; text-align: right;">
              <button onclick="window.dispatchEvent(new CustomEvent('selectIncident', {detail: ${incident.id}}))" 
                style="background: #1890ff; color: #fff; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                查看详情
              </button>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          setSelectedPoint(point);
          setCurrentIncident(incident);
        });

        if (incidentsLayerRef.current) {
          marker.addTo(incidentsLayerRef.current);
        }

        if (isSelected || isHighLevel) {
          const circle = L.circle([point.position.lat, point.position.lng], {
            color: color,
            fillColor: color,
            fillOpacity: 0.1,
            radius: incident.affectedArea ? incident.affectedArea * 1000 : 3000,
            weight: 1,
            dashArray: '5, 5',
          });
          if (incidentsLayerRef.current) {
            circle.addTo(incidentsLayerRef.current);
          }
        }
      });
    }
  }, [incidentPoints, layers.incidents, timelineIndex, currentIncident, createCustomIcon, setCurrentIncident]);

  useEffect(() => {
    if (!mapRef.current || !teamsLayerRef.current) return;

    teamsLayerRef.current.clearLayers();

    if (layers.teams) {
      teamPoints.forEach((point) => {
        const team = point.data as RescueTeam;
        const color = TEAM_STATUS_COLOR[team.status || 1];

        const marker = L.marker([point.position.lat, point.position.lng], {
          icon: createCustomIcon('team', color),
          zIndexOffset: 200,
        });

        const popupContent = `
          <div style="min-width: 220px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: ${color};">
              🚒 ${point.name}
            </div>
            <div style="margin-bottom: 8px;">
              <span style="padding: 2px 8px; background: ${color}; color: #fff; border-radius: 10px; font-size: 12px;">
                ${TEAM_STATUS_MAP[team.status || 1]}
              </span>
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.65); margin-bottom: 4px;">
              👥 编制: ${team.teamSize}人
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.65); margin-bottom: 4px;">
              📋 类型: ${team.teamType}
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.65); margin-bottom: 4px;">
              📞 队长: ${team.leaderName} (${team.leaderPhone})
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.65);">
              🚗 响应半径: ${team.responseRadius}km
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => setSelectedPoint(point));

        if (teamsLayerRef.current) {
          marker.addTo(teamsLayerRef.current);
        }
      });
    }
  }, [teamPoints, layers.teams, createCustomIcon]);

  useEffect(() => {
    if (!mapRef.current || !warehousesLayerRef.current) return;

    warehousesLayerRef.current.clearLayers();

    if (layers.warehouses) {
      warehousePoints.forEach((point) => {
        const warehouse = point.data as Warehouse;
        const usagePercent = warehouse.capacity > 0 ? (warehouse.usedCapacity / warehouse.capacity) * 100 : 0;
        const isLow = usagePercent < 30;
        const isHigh = usagePercent > 80;
        const color = isHigh ? '#ff4d4f' : isLow ? '#52c41a' : '#13c2c2';

        const marker = L.marker([point.position.lat, point.position.lng], {
          icon: createCustomIcon('warehouse', color),
          zIndexOffset: 150,
        });

        const popupContent = `
          <div style="min-width: 220px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: ${color};">
              🏭 ${point.name}
            </div>
            <div style="margin-bottom: 8px;">
              <span style="padding: 2px 8px; background: ${warehouse.status === 1 ? '#52c41a' : '#ff4d4f'}; color: #fff; border-radius: 10px; font-size: 12px;">
                ${warehouse.status === 1 ? '正常运行' : '已停用'}
              </span>
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.65); margin-bottom: 4px;">
              📦 容量: ${warehouse.usedCapacity?.toLocaleString() || 0} / ${warehouse.capacity?.toLocaleString() || 0} 件
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin: 8px 0; overflow: hidden;">
              <div style="width: ${usagePercent}%; height: 100%; background: ${color}; transition: width 0.3s;"></div>
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.65); margin-bottom: 4px;">
              📞 负责人: ${warehouse.managerName} (${warehouse.managerPhone})
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.65);">
              📍 ${warehouse.address}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => setSelectedPoint(point));

        if (warehousesLayerRef.current) {
          marker.addTo(warehousesLayerRef.current);
        }
      });
    }
  }, [warehousePoints, layers.warehouses, createCustomIcon]);

  useEffect(() => {
    if (!mapRef.current || !routesLayerRef.current) return;

    routesLayerRef.current.clearLayers();

    if (layers.routes && currentIncident) {
      const incidentPos = currentIncident.locationPoint
        ? [currentIncident.locationPoint.lat, currentIncident.locationPoint.lng]
        : getLocationByRegionCode(currentIncident.regionCode) || MAP_CENTER;

      const nearbyTeams = teams.slice(0, 3);
      nearbyTeams.forEach((team, index) => {
        const teamPos = team.locationPoint
          ? [team.locationPoint.lat, team.locationPoint.lng]
          : getLocationByRegionCode(team.regionCode) || MAP_CENTER;

        const latlngs: [number, number][] = [
          teamPos as [number, number],
          incidentPos as [number, number],
        ];

        const colors = ['#1890ff', '#52c41a', '#faad14'];
        const polyline = L.polyline(latlngs, {
          color: colors[index % colors.length],
          weight: 3,
          opacity: 0.8,
          dashArray: '10, 10',
        });

        if (routesLayerRef.current) {
          polyline.addTo(routesLayerRef.current);
        }

        const arrow = L.circleMarker(incidentPos as [number, number], {
          radius: 6,
          fillColor: colors[index % colors.length],
          color: '#fff',
          weight: 2,
          fillOpacity: 1,
        });
        if (routesLayerRef.current) {
          arrow.addTo(routesLayerRef.current);
        }
      });
    }
  }, [layers.routes, currentIncident, teams, warehouses]);

  useEffect(() => {
    const handler = (e: any) => {
      const incidentId = e.detail;
      const incident = incidents.find((i) => i.id === incidentId);
      if (incident) {
        setCurrentIncident(incident);
        const point = incidentPoints.find((p) => p.id === `incident-${incidentId}`);
        if (point && mapRef.current) {
          mapRef.current.setView([point.position.lat, point.position.lng], 12);
        }
      }
    };

    window.addEventListener('selectIncident', handler);
    return () => window.removeEventListener('selectIncident', handler);
  }, [incidents, incidentPoints, setCurrentIncident]);

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
          <Descriptions.Item label="灾害类型">{INCIDENT_TYPE_MAP[incident.type] || '其他'}</Descriptions.Item>
          <Descriptions.Item label="响应级别">
            <Tag color={INCIDENT_LEVEL_COLOR[incident.level]}>{INCIDENT_LEVEL_MAP[incident.level]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="当前状态">
            <Tag color={INCIDENT_STATUS_COLOR[incident.status]}>{INCIDENT_STATUS_MAP[incident.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="发生地点">{incident.location}</Descriptions.Item>
          <Descriptions.Item label="发生时间">{dayjs(incident.occurredAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
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
          <Descriptions.Item label="坐标" span={2}>
            {incident.locationPoint
              ? `${incident.locationPoint.lat.toFixed(6)}, ${incident.locationPoint.lng.toFixed(6)}`
              : getLocationByRegionCode(incident.regionCode)?.map((c) => c.toFixed(6)).join(', ') || '-'}
          </Descriptions.Item>
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
          <Descriptions.Item label="坐标" span={2}>
            {team.locationPoint
              ? `${team.locationPoint.lat.toFixed(6)}, ${team.locationPoint.lng.toFixed(6)}`
              : getLocationByRegionCode(team.regionCode)?.map((c) => c.toFixed(6)).join(', ') || '-'}
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (selectedPoint.type === 'warehouse') {
      const warehouse = selectedPoint.data as Warehouse;
      const usagePercent = warehouse.capacity > 0 ? (warehouse.usedCapacity / warehouse.capacity) * 100 : 0;
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
          <Descriptions.Item label="总容量">{warehouse.capacity?.toLocaleString() || 0} 件</Descriptions.Item>
          <Descriptions.Item label="已使用">{warehouse.usedCapacity?.toLocaleString() || 0} 件</Descriptions.Item>
          <Descriptions.Item label="使用率" span={2}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${usagePercent}%`,
                    height: '100%',
                    background: usagePercent > 80 ? '#ff4d4f' : usagePercent > 60 ? '#faad14' : '#52c41a',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <span style={{ minWidth: 50, textAlign: 'right' }}>{usagePercent.toFixed(1)}%</span>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="负责人">{warehouse.managerName}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{warehouse.managerPhone}</Descriptions.Item>
          <Descriptions.Item label="仓库地址" span={2}>
            {warehouse.address}
          </Descriptions.Item>
          <Descriptions.Item label="所属区域">{warehouse.regionCode}</Descriptions.Item>
          <Descriptions.Item label="所属机构">{warehouse.organizationId}</Descriptions.Item>
          <Descriptions.Item label="坐标" span={2}>
            {warehouse.locationPoint
              ? `${warehouse.locationPoint.lat.toFixed(6)}, ${warehouse.locationPoint.lng.toFixed(6)}`
              : getLocationByRegionCode(warehouse.regionCode)?.map((c) => c.toFixed(6)).join(', ') || '-'}
          </Descriptions.Item>
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
              <Button type="primary" onClick={() => setShowDetail(false)}>
                创建调度方案
              </Button>
            )}
          </Space>
        }
        width={720}
      >
        {content}
      </Modal>
    );
  };

  const layerControls = [
    { key: 'incidents', label: '灾情点位', icon: <WarningOutlined /> },
    { key: 'teams', label: '救援队伍', icon: <RocketOutlined /> },
    { key: 'warehouses', label: '物资仓库', icon: <ShopOutlined /> },
    { key: 'routes', label: '调度路线', icon: <EnvironmentOutlined /> },
  ];

  return (
    <div
      ref={mapContainerRef}
      className={`map-container ${className || ''}`}
      style={{
        ...style,
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#0a1628',
      }}
    >
      {loading && (
        <div className="map-loading">
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.45)' }}>正在加载GIS地图...</div>
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: 80,
          right: 16,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 12,
          backdropFilter: 'blur(8px)',
          zIndex: 500,
          minWidth: 180,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12, color: '#1890ff' }}>
          <EnvironmentOutlined style={{ marginRight: 6 }} />
          图层控制
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {layerControls.map((ctrl) => (
            <Button
              key={ctrl.key}
              type={layers[ctrl.key as keyof typeof layers] ? 'primary' : 'default'}
              size="small"
              onClick={() =>
                setLayers((prev) => ({
                  ...prev,
                  [ctrl.key]: !prev[ctrl.key as keyof typeof layers],
                }))
              }
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                background: layers[ctrl.key as keyof typeof layers]
                  ? 'linear-gradient(135deg, #1890ff, #096dd9)'
                  : 'rgba(30, 41, 59, 0.5)',
                border: '1px solid #1e293b',
                color: layers[ctrl.key as keyof typeof layers] ? '#fff' : 'rgba(255,255,255,0.65)',
              }}
            >
              {ctrl.icon}
              <span style={{ marginLeft: 8 }}>{ctrl.label}</span>
            </Button>
          ))}
        </Space>

        <div style={{ borderTop: '1px solid #1e293b', margin: '12px 0', paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>图例</div>
          <List size="small" dataSource={[
            { color: '#ff4d4f', label: 'Ⅰ级灾情' },
            { color: '#fa8c16', label: 'Ⅱ级灾情' },
            { color: '#faad14', label: 'Ⅲ级灾情' },
            { color: '#52c41a', label: 'Ⅳ级灾情' },
            { color: '#1890ff', label: '救援队伍' },
            { color: '#13c2c2', label: '物资仓库' },
          ]} renderItem={(item) => (
            <List.Item style={{ padding: '4px 0', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>{item.label}</span>
              </div>
            </List.Item>
          )} />
        </div>
      </div>

      {timelineEvents.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 136,
            left: 16,
            right: 16,
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid #1e293b',
            borderRadius: 8,
            padding: 12,
            backdropFilter: 'blur(8px)',
            zIndex: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1890ff' }}>
              时间轴回放
            </div>
            <Space size="small">
              <Button
                type="text"
                size="small"
                icon={isPlayingTimeline ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
                style={{ color: '#1890ff' }}
              >
                {isPlayingTimeline ? '暂停' : '播放'}
              </Button>
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => setTimelineIndex(-1)}
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                重置
              </Button>
            </Space>
          </div>
          <input
            type="range"
            min="-1"
            max={timelineEvents.length - 1}
            value={timelineIndex}
            onChange={(e) => setTimelineIndex(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#1890ff' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            <span>开始</span>
            <span>{selectedTime.toLocaleString('zh-CN')}</span>
            <span>
              {timelineIndex >= 0 ? timelineEvents[timelineIndex]?.title : '实时'}
            </span>
          </div>
        </div>
      )}

      {renderDetailModal()}
    </div>
  );
};

export default MapContainer;
