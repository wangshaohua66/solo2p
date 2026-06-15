import { useEffect, useState } from 'react';
import { usePatrolStore } from '@/stores/patrolStore';
import { useDisorderStore } from '@/stores/disorderStore';
import { MapPin, Play, Square, AlertTriangle, Navigation } from 'lucide-react';
import type { ReportDisorderParams } from '@/services/api';
import { DisorderType, Severity } from '@/types';
import styles from './PatrolPage.module.css';

export default function PatrolPage() {
  const {
    trackPoints,
    currentInspectorId,
    loading,
    startPatrol,
    addTrackPoint,
    disconnectPatrolWebSocket,
    fetchCoverage,
    coverageList
  } = usePatrolStore();

  const { reportDisorder } = useDisorderStore();

  const [isPatrolling, setIsPatrolling] = useState(false);
  const [inspectorId, setInspectorId] = useState('');

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  const handleStartPatrol = () => {
    if (!inspectorId) return;
    startPatrol(inspectorId);
    setIsPatrolling(true);
  };

  const handleStopPatrol = () => {
    disconnectPatrolWebSocket();
    setIsPatrolling(false);
  };

  const handleAddTrackPoint = async () => {
    if (!currentInspectorId) return;
    await addTrackPoint({
      userId: currentInspectorId,
      lat: 39.9042 + Math.random() * 0.01,
      lng: 116.4074 + Math.random() * 0.01,
      speed: 30 + Math.random() * 20
    });
  };

  const handleReportDisorder = async () => {
    if (!currentInspectorId) return;
    const data: ReportDisorderParams = {
      type: DisorderType.Pothole,
      severity: Severity.Moderate,
      location: { lat: 39.9042, lng: 116.4074 },
      roadSectionId: 'road-001',
      description: '测试病害报告',
      images: [],
      reporterId: currentInspectorId
    };
    await reportDisorder(data);
  };

  return (
    <div className="page">
      <div className={styles.controlSection}>
        <div className="card">
          <h3>巡查控制</h3>
          {!isPatrolling ? (
            <div className="form-row">
              <input
                type="text"
                placeholder="巡查人员ID"
                value={inspectorId}
                onChange={(e) => setInspectorId(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleStartPatrol} disabled={loading}>
                <Play size={16} />
                开始巡查
              </button>
            </div>
          ) : (
            <div className="button-group">
              <button className="btn btn-primary" onClick={handleAddTrackPoint} disabled={loading}>
                <MapPin size={16} />
                记录轨迹点
              </button>
              <button className="btn btn-warning" onClick={handleReportDisorder} disabled={loading}>
                <AlertTriangle size={16} />
                上报病害
              </button>
              <button className="btn btn-danger" onClick={handleStopPatrol}>
                <Square size={16} />
                结束巡查
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.mapContainer}>
        <div className={styles.mapPlaceholder} />
        {trackPoints.slice(-5).map((point, index) => (
          <div
            key={index}
            className={styles.mapMarker}
            style={{
              left: `${30 + Math.random() * 40}%`,
              top: `${30 + Math.random() * 40}%`
            }}
          >
            <Navigation size={24} color="#3498db" fill="#3498db" />
          </div>
        ))}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHandle} />
        <div className={styles.reportForm}>
          <div className="card" style={{ boxShadow: 'none', padding: 0 }}>
            <h3>轨迹信息</h3>
            <p>已记录轨迹点: <span className="tabular-nums">{trackPoints.length}</span></p>
            {trackPoints.length > 0 && (
              <div className={styles.trackList}>
                {trackPoints.slice(-5).map((point, index) => (
                  <div key={index} className={styles.trackItem}>
                    <span>
                      {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                    </span>
                    <span>{point.speed?.toFixed(1)} km/h</span>
                    <span>{point.timestamp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ boxShadow: 'none', padding: 0, marginTop: 16 }}>
            <h3>巡查覆盖率</h3>
            <div className={styles.coverageList}>
              {coverageList.map((item) => (
                <div key={item.roadSectionId} className={styles.coverageItem}>
                  <span className={styles.coverageName}>{item.roadSectionName}</span>
                  <div className={styles.coverageBar}>
                    <div
                      className={styles.coverageProgress}
                      style={{ width: `${item.coverageRate * 100}%` }}
                    />
                  </div>
                  <span className={styles.coverageRate}>
                    {(item.coverageRate * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
