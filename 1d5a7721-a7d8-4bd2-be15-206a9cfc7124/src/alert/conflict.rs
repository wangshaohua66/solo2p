use crate::types::{
    AlertSeverity, ConflictAlert, ConflictType, FusedTrack, Position3D, SafetyThresholds, TrackPoint,
};
use chrono::{DateTime, Duration, Utc};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use tracing::warn;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct CpaResult {
    pub time: DateTime<Utc>,
    pub distance: f64,
    pub horizontal_distance: f64,
    pub vertical_distance: f64,
    pub position1: Position3D,
    pub position2: Position3D,
}

#[derive(Debug, Clone)]
pub struct ConflictDetector {
    thresholds: SafetyThresholds,
    lookahead: Duration,
    alert_history: VecDeque<ConflictAlert>,
    max_history: usize,
    dedup_window: Duration,
}

impl ConflictDetector {
    pub fn new(thresholds: SafetyThresholds) -> Self {
        Self {
            thresholds,
            lookahead: Duration::seconds(thresholds.lookahead_seconds),
            alert_history: VecDeque::new(),
            max_history: 1000,
            dedup_window: Duration::seconds(10),
        }
    }

    pub fn with_lookahead(mut self, lookahead: Duration) -> Self {
        self.lookahead = lookahead;
        self
    }

    pub fn with_max_history(mut self, max_history: usize) -> Self {
        self.max_history = max_history;
        self
    }

    pub fn with_dedup_window(mut self, dedup_window: Duration) -> Self {
        self.dedup_window = dedup_window;
        self
    }

    pub fn detect_conflicts(&self, tracks: &[FusedTrack]) -> Vec<ConflictAlert> {
        let now = Utc::now();
        let mut alerts = Vec::new();

        let active_tracks: Vec<&FusedTrack> = tracks
            .iter()
            .filter(|t| now - t.last_update < Duration::seconds(300))
            .collect();

        let pairs: Vec<(usize, usize)> = (0..active_tracks.len())
            .flat_map(|i| (i + 1..active_tracks.len()).map(move |j| (i, j)))
            .collect();

        let results: Vec<Option<ConflictAlert>> = pairs
            .par_iter()
            .map(|(i, j)| {
                let t1 = active_tracks[*i];
                let t2 = active_tracks[*j];

                self.analyze_pair(t1, t2)
            })
            .collect();

        for result in results.into_iter().flatten() {
            alerts.push(result);
        }

        alerts.sort_by(|a, b| {
            b.severity
                .cmp(&a.severity)
                .then_with(|| a.predicted_time.cmp(&b.predicted_time))
        });

        alerts
    }

    fn analyze_pair(&self, t1: &FusedTrack, t2: &FusedTrack) -> Option<ConflictAlert> {
        let p1 = t1.latest_point()?;
        let p2 = t2.latest_point()?;

        let cpa = self.calculate_cpa(p1, p2)?;

        let time_to_cpa = cpa.time - Utc::now();
        if time_to_cpa < Duration::zero() || time_to_cpa > self.lookahead {
            return None;
        }

        let (conflict_type, severity) = self.classify_conflict(
            cpa.horizontal_distance,
            cpa.vertical_distance,
            time_to_cpa,
        );

        let conflict_type = conflict_type?;

        Some(ConflictAlert {
            timestamp: Utc::now(),
            conflict_type,
            aircraft1: t1.icao_address,
            aircraft2: t2.icao_address,
            predicted_time: cpa.time,
            predicted_distance: cpa.distance,
            horizontal_distance: cpa.horizontal_distance,
            vertical_distance: cpa.vertical_distance,
            severity,
        })
    }

    pub fn calculate_cpa(&self, p1: &TrackPoint, p2: &TrackPoint) -> Option<CpaResult> {
        let dt = (p2.timestamp - p1.timestamp).num_milliseconds() as f64 / 1000.0;
        if dt.abs() > 30.0 {
            warn!(
                "轨迹时间差过大: {} 秒, CPA计算可能不准确",
                dt.abs()
            );
        }

        let lat_avg = (p1.position.latitude + p2.position.latitude) / 2.0;
        let lat_m_per_deg = 111320.0;
        let lon_m_per_deg = 111320.0 * lat_avg.to_radians().cos();

        let dx = (p2.position.longitude - p1.position.longitude) * lon_m_per_deg;
        let dy = (p2.position.latitude - p1.position.latitude) * lat_m_per_deg;
        let dz = p2.position.altitude - p1.position.altitude;

        let gs1_ms = p1.velocity.ground_speed / 3.6;
        let gs2_ms = p2.velocity.ground_speed / 3.6;

        let heading1 = p1.velocity.heading.to_radians();
        let heading2 = p2.velocity.heading.to_radians();

        let v1x = gs1_ms * heading1.sin();
        let v1y = gs1_ms * heading1.cos();
        let v1z = p1.velocity.vertical_speed;

        let v2x = gs2_ms * heading2.sin();
        let v2y = gs2_ms * heading2.cos();
        let v2z = p2.velocity.vertical_speed;

        let dvx = v2x - v1x;
        let dvy = v2y - v1y;
        let dvz = v2z - v1z;

        let dv_sq = dvx * dvx + dvy * dvy + dvz * dvz;

        if dv_sq < 1e-6 {
            return None;
        }

        let dot_product = dx * dvx + dy * dvy + dz * dvz;
        let t_min = -dot_product / dv_sq;

        if t_min < 0.0 || t_min > self.lookahead.num_seconds() as f64 {
            return None;
        }

        let cpa_dx = dx + dvx * t_min;
        let cpa_dy = dy + dvy * t_min;
        let cpa_dz = dz + dvz * t_min;

        let h_dist = (cpa_dx * cpa_dx + cpa_dy * cpa_dy).sqrt();
        let v_dist = cpa_dz.abs();
        let dist = (h_dist * h_dist + v_dist * v_dist).sqrt();

        let cpa_time = p1.timestamp + Duration::seconds(t_min as i64);

        let lat1_cpa = p1.position.latitude + (v1y * t_min) / lat_m_per_deg;
        let lon1_cpa = p1.position.longitude + (v1x * t_min) / lon_m_per_deg;
        let alt1_cpa = p1.position.altitude + v1z * t_min;

        let lat2_cpa = p2.position.latitude + (v2y * t_min) / lat_m_per_deg;
        let lon2_cpa = p2.position.longitude + (v2x * t_min) / lon_m_per_deg;
        let alt2_cpa = p2.position.altitude + v2z * t_min;

        Some(CpaResult {
            time: cpa_time,
            distance: dist,
            horizontal_distance: h_dist,
            vertical_distance: v_dist,
            position1: Position3D::new(lat1_cpa, lon1_cpa, alt1_cpa),
            position2: Position3D::new(lat2_cpa, lon2_cpa, alt2_cpa),
        })
    }

    fn classify_conflict(
        &self,
        h_dist: f64,
        v_dist: f64,
        time_to_cpa: Duration,
    ) -> (Option<ConflictType>, AlertSeverity) {
        let h_threshold = self.thresholds.horizontal_separation;
        let v_threshold = self.thresholds.vertical_separation;

        let h_violation = h_dist < h_threshold;
        let v_violation = v_dist < v_threshold;

        if !h_violation && !v_violation {
            return (None, AlertSeverity::Info);
        }

        let time_secs = time_to_cpa.num_seconds();

        let severity = if time_secs <= 30 {
            AlertSeverity::Critical
        } else if time_secs <= 60 {
            AlertSeverity::Warning
        } else {
            AlertSeverity::Info
        };

        let conflict_type = match (h_violation, v_violation) {
            (true, true) => ConflictType::ThreeDimensional,
            (true, false) => ConflictType::Horizontal,
            (false, true) => ConflictType::Vertical,
            (false, false) => return (None, AlertSeverity::Info),
        };

        (Some(conflict_type), severity)
    }

    pub fn detect_and_dedupe(&mut self, tracks: &[FusedTrack]) -> Vec<ConflictAlert> {
        let mut alerts = self.detect_conflicts(tracks);
        let now = Utc::now();

        alerts.retain(|alert| !self.is_duplicate(alert, now));

        for alert in &alerts {
            self.add_to_history(alert.clone());
        }

        alerts
    }

    fn is_duplicate(&self, alert: &ConflictAlert, now: DateTime<Utc>) -> bool {
        self.alert_history.iter().any(|existing| {
            (existing.aircraft1 == alert.aircraft1 && existing.aircraft2 == alert.aircraft2
                || existing.aircraft1 == alert.aircraft2 && existing.aircraft2 == alert.aircraft1)
                && existing.conflict_type == alert.conflict_type
                && (now - existing.timestamp) < self.dedup_window
        })
    }

    fn add_to_history(&mut self, alert: ConflictAlert) {
        self.alert_history.push_back(alert);
        if self.alert_history.len() > self.max_history {
            self.alert_history.pop_front();
        }
    }

    pub fn get_history(&self) -> &VecDeque<ConflictAlert> {
        &self.alert_history
    }

    pub fn clear_history(&mut self) {
        self.alert_history.clear();
    }

    pub fn set_thresholds(&mut self, thresholds: SafetyThresholds) {
        self.thresholds = thresholds;
        self.lookahead = Duration::seconds(thresholds.lookahead_seconds);
    }
}

pub fn check_point_conflict(p1: &TrackPoint, p2: &TrackPoint) -> Option<ConflictType> {
    let h_dist = p1.position.distance_horizontal(&p2.position);
    let v_dist = p1.position.distance_vertical(&p2.position);

    let h_threshold = 5000.0;
    let v_threshold = 300.0;

    match (h_dist < h_threshold, v_dist < v_threshold) {
        (true, true) => Some(ConflictType::ThreeDimensional),
        (true, false) => Some(ConflictType::Horizontal),
        (false, true) => Some(ConflictType::Vertical),
        (false, false) => None,
    }
}

pub fn generate_conflict_summary(alerts: &[ConflictAlert]) -> ConflictSummary {
    let total = alerts.len();
    let critical = alerts
        .iter()
        .filter(|a| a.severity == AlertSeverity::Critical)
        .count();
    let warning = alerts
        .iter()
        .filter(|a| a.severity == AlertSeverity::Warning)
        .count();
    let info = alerts
        .iter()
        .filter(|a| a.severity == AlertSeverity::Info)
        .count();

    let horizontal = alerts
        .iter()
        .filter(|a| a.conflict_type == ConflictType::Horizontal)
        .count();
    let vertical = alerts
        .iter()
        .filter(|a| a.conflict_type == ConflictType::Vertical)
        .count();
    let three_d = alerts
        .iter()
        .filter(|a| a.conflict_type == ConflictType::ThreeDimensional)
        .count();

    ConflictSummary {
        total,
        critical,
        warning,
        info,
        horizontal,
        vertical,
        three_d,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictSummary {
    pub total: usize,
    pub critical: usize,
    pub warning: usize,
    pub info: usize,
    pub horizontal: usize,
    pub vertical: usize,
    pub three_d: usize,
}

impl std::fmt::Display for ConflictSummary {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "冲突摘要: 总数={}, 严重={}, 警告={}, 提示={}, 水平={}, 垂直={}, 三维={}",
            self.total,
            self.critical,
            self.warning,
            self.info,
            self.horizontal,
            self.vertical,
            self.three_d
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{IcaoAddress, Position3D, Velocity3D};

    fn create_test_track(
        icao: [u8; 3],
        lat: f64,
        lon: f64,
        alt: f64,
        heading: f64,
        gs: f64,
    ) -> FusedTrack {
        let point = TrackPoint {
            timestamp: Utc::now(),
            position: Position3D::new(lat, lon, alt),
            velocity: Velocity3D::new(gs, 0.0, heading),
            icao_address: IcaoAddress::new(icao),
            callsign: Some("TEST".to_string()),
            radar_id: "RADAR01".to_string(),
            confidence: 0.95,
        };

        FusedTrack {
            icao_address: IcaoAddress::new(icao),
            callsign: Some("TEST".to_string()),
            points: vec![point],
            last_update: Utc::now(),
            contributing_radars: vec!["RADAR01".to_string()],
        }
    }

    #[test]
    fn test_check_point_conflict() {
        let p1 = TrackPoint {
            timestamp: Utc::now(),
            position: Position3D::new(40.0, 116.0, 10000.0),
            velocity: Velocity3D::new(200.0, 0.0, 90.0),
            icao_address: IcaoAddress::new([1, 2, 3]),
            callsign: None,
            radar_id: "RADAR01".to_string(),
            confidence: 0.9,
        };

        let p2_close = TrackPoint {
            position: Position3D::new(40.0001, 116.0001, 10000.0),
            ..p1.clone()
        };

        let p2_far = TrackPoint {
            position: Position3D::new(40.1, 116.1, 15000.0),
            ..p1.clone()
        };

        assert!(check_point_conflict(&p1, &p2_close).is_some());
        assert!(check_point_conflict(&p1, &p2_far).is_none());
    }

    #[test]
    fn test_classify_conflict() {
        let detector = ConflictDetector::new(SafetyThresholds::default());

        let (ctype, severity) =
            detector.classify_conflict(1000.0, 100.0, Duration::seconds(30));
        assert_eq!(ctype, Some(ConflictType::ThreeDimensional));
        assert_eq!(severity, AlertSeverity::Critical);

        let (ctype, _severity) =
            detector.classify_conflict(6000.0, 1000.0, Duration::seconds(60));
        assert_eq!(ctype, None);
    }

    #[test]
    fn test_conflict_detection() {
        let thresholds = SafetyThresholds {
            horizontal_separation: 5000.0,
            vertical_separation: 300.0,
            lookahead_seconds: 120,
            warning_factor: 1.5,
        };
        let detector = ConflictDetector::new(thresholds);

        let t1 = create_test_track([1, 2, 3], 40.0, 116.0, 10000.0, 90.0, 200.0);
        let t2 = create_test_track([4, 5, 6], 40.0, 116.01, 10000.0, 270.0, 200.0);

        let alerts = detector.detect_conflicts(&[t1, t2]);
        assert!(!alerts.is_empty());
    }
}
