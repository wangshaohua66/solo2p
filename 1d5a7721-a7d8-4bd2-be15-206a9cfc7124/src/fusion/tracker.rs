use crate::config::AppConfig;
use crate::error::{AtcError, AtcResult};
use crate::types::{FusedTrack, IcaoAddress, Position3D, TrackPoint, Velocity3D};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Duration, Utc};
use parking_lot::RwLock;
use rayon::prelude::*;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tracing::{debug, info};

#[derive(Debug, Clone)]
struct TrackBuffer {
    points: Vec<TrackPoint>,
    last_update: DateTime<Utc>,
}

pub struct MultiRadarTracker {
    tracks: Arc<RwLock<HashMap<IcaoAddress, TrackBuffer>>>,
    radar_weights: HashMap<String, f64>,
    time_alignment_window: Duration,
    max_history_size: usize,
    fusion_timeout: Duration,
}

impl MultiRadarTracker {
    pub fn new(config: &AppConfig) -> Self {
        Self {
            tracks: Arc::new(RwLock::new(HashMap::new())),
            radar_weights: config.radar_weights(),
            time_alignment_window: Duration::milliseconds(config.processing.time_alignment_window_ms),
            max_history_size: config.processing.track_history_size,
            fusion_timeout: Duration::milliseconds(config.processing.fusion_timeout_ms),
        }
    }

    pub fn with_radar_weights(mut self, weights: HashMap<String, f64>) -> Self {
        self.radar_weights = weights;
        self
    }

    pub fn add_point(&self, point: TrackPoint) {
        let mut tracks = self.tracks.write();
        let buffer = tracks
            .entry(point.icao_address)
            .or_insert_with(|| TrackBuffer {
                points: Vec::new(),
                last_update: Utc::now(),
            });

        buffer.points.push(point);
        buffer.last_update = Utc::now();

        if buffer.points.len() > self.max_history_size {
            buffer.points = buffer.points.split_off(buffer.points.len() - self.max_history_size);
        }
    }

    pub fn add_points(&self, points: Vec<TrackPoint>) {
        for point in points {
            self.add_point(point);
        }
    }

    pub fn add_points_parallel(&self, points: Vec<TrackPoint>) {
        points.into_par_iter().for_each(|point| self.add_point(point));
    }

    pub fn get_track(&self, icao: &IcaoAddress) -> Option<FusedTrack> {
        let tracks = self.tracks.read();
        let buffer = tracks.get(icao)?;
        self.fuse_track(buffer, icao)
    }

    pub fn get_all_tracks(&self) -> Vec<FusedTrack> {
        let tracks = self.tracks.read();
        tracks
            .par_iter()
            .filter_map(|(icao, buffer)| self.fuse_track(buffer, icao))
            .collect()
    }

    pub fn get_active_tracks(&self) -> Vec<FusedTrack> {
        let now = Utc::now();
        let tracks = self.tracks.read();
        tracks
            .par_iter()
            .filter(|(_, buffer)| now - buffer.last_update < self.fusion_timeout)
            .filter_map(|(icao, buffer)| self.fuse_track(buffer, icao))
            .collect()
    }

    fn fuse_track(&self, buffer: &TrackBuffer, icao: &IcaoAddress) -> Option<FusedTrack> {
        if buffer.points.is_empty() {
            return None;
        }

        let mut sorted_points: Vec<TrackPoint> = buffer.points.clone();
        sorted_points.sort_by_key(|p| p.timestamp);

        let aligned_points = self.align_by_time(&sorted_points);
        let fused_points = self.weighted_fusion(&aligned_points);

        let contributing_radars: HashSet<String> =
            sorted_points.iter().map(|p| p.radar_id.clone()).collect();

        let callsign = sorted_points
            .iter()
            .find(|p| p.callsign.is_some())
            .and_then(|p| p.callsign.clone());

        let last_update = sorted_points
            .last()
            .map(|p| p.timestamp)
            .unwrap_or_else(Utc::now);

        Some(FusedTrack {
            icao_address: *icao,
            callsign,
            points: fused_points,
            last_update,
            contributing_radars: contributing_radars.into_iter().collect(),
        })
    }

    fn align_by_time(&self, points: &[TrackPoint]) -> Vec<Vec<TrackPoint>> {
        if points.is_empty() {
            return Vec::new();
        }

        let mut aligned = Vec::new();
        let mut current_group = vec![points[0].clone()];
        let mut current_time = points[0].timestamp;

        for point in points.iter().skip(1) {
            if point.timestamp - current_time <= self.time_alignment_window {
                current_group.push(point.clone());
            } else {
                aligned.push(current_group);
                current_group = vec![point.clone()];
                current_time = point.timestamp;
            }
        }

        if !current_group.is_empty() {
            aligned.push(current_group);
        }

        aligned
    }

    fn weighted_fusion(&self, aligned_groups: &[Vec<TrackPoint>]) -> Vec<TrackPoint> {
        aligned_groups
            .par_iter()
            .filter_map(|group| self.fuse_single_group(group))
            .collect()
    }

    fn fuse_single_group(&self, group: &[TrackPoint]) -> Option<TrackPoint> {
        if group.is_empty() {
            return None;
        }

        let total_weight: f64 = group
            .iter()
            .map(|p| {
                self.radar_weights
                    .get(&p.radar_id)
                    .copied()
                    .unwrap_or(1.0)
                    * p.confidence
            })
            .sum();

        if total_weight <= 0.0 {
            return Some(group[0].clone());
        }

        let mut lat = 0.0;
        let mut lon = 0.0;
        let mut alt = 0.0;
        let mut gs = 0.0;
        let mut vs = 0.0;
        let mut hdg_sin = 0.0;
        let mut hdg_cos = 0.0;
        let mut avg_timestamp = 0.0;

        for point in group {
            let w = self
                .radar_weights
                .get(&point.radar_id)
                .copied()
                .unwrap_or(1.0)
                * point.confidence
                / total_weight;

            lat += point.position.latitude * w;
            lon += point.position.longitude * w;
            alt += point.position.altitude * w;
            gs += point.velocity.ground_speed * w;
            vs += point.velocity.vertical_speed * w;

            let hdg_rad = point.velocity.heading.to_radians();
            hdg_sin += hdg_rad.sin() * w;
            hdg_cos += hdg_rad.cos() * w;

            avg_timestamp += point.timestamp.timestamp_millis() as f64 * w;
        }

        let heading = hdg_sin.atan2(hdg_cos).to_degrees();
        let heading = if heading < 0.0 { heading + 360.0 } else { heading };

        let timestamp = DateTime::from_timestamp_millis(avg_timestamp.round() as i64)
            .unwrap_or_else(Utc::now);

        let primary_point = group
            .iter()
            .max_by(|a, b| {
                let wa = self
                    .radar_weights
                    .get(&a.radar_id)
                    .copied()
                    .unwrap_or(1.0)
                    * a.confidence;
                let wb = self
                    .radar_weights
                    .get(&b.radar_id)
                    .copied()
                    .unwrap_or(1.0)
                    * b.confidence;
                wa.partial_cmp(&wb).unwrap_or(std::cmp::Ordering::Equal)
            })
            .unwrap();

        Some(TrackPoint {
            timestamp,
            position: Position3D::new(lat, lon, alt),
            velocity: Velocity3D::new(gs, vs, heading),
            icao_address: primary_point.icao_address,
            callsign: primary_point.callsign.clone(),
            radar_id: "FUSED".to_string(),
            confidence: total_weight.min(1.0),
        })
    }

    pub fn query_tracks(
        &self,
        time_start: Option<DateTime<Utc>>,
        time_end: Option<DateTime<Utc>>,
        callsign_pattern: Option<&str>,
        icao_pattern: Option<&str>,
    ) -> AtcResult<Vec<FusedTrack>> {
        let regex_callsign = if let Some(pattern) = callsign_pattern {
            Some(regex::Regex::new(pattern)?)
        } else {
            None
        };

        let regex_icao = if let Some(pattern) = icao_pattern {
            Some(regex::Regex::new(pattern)?)
        } else {
            None
        };

        let tracks = self.tracks.read();
        let mut results = Vec::new();

        for (icao, buffer) in tracks.iter() {
            if let Some(re) = &regex_icao {
                if !re.is_match(&icao.to_hex_string()) {
                    continue;
                }
            }

            if let Some(re) = &regex_callsign {
                let has_match = buffer.points.iter().any(|p| {
                    p.callsign
                        .as_ref()
                        .map(|c| re.is_match(c))
                        .unwrap_or(false)
                });
                if !has_match {
                    continue;
                }
            }

            let mut filtered_points: Vec<TrackPoint> = buffer
                .points
                .iter()
                .filter(|p| {
                    if let Some(start) = time_start {
                        if p.timestamp < start {
                            return false;
                        }
                    }
                    if let Some(end) = time_end {
                        if p.timestamp > end {
                            return false;
                        }
                    }
                    true
                })
                .cloned()
                .collect();

            if filtered_points.is_empty() {
                continue;
            }

            filtered_points.sort_by_key(|p| p.timestamp);

            let contributing_radars: HashSet<String> =
                filtered_points.iter().map(|p| p.radar_id.clone()).collect();

            let callsign = filtered_points
                .iter()
                .find(|p| p.callsign.is_some())
                .and_then(|p| p.callsign.clone());

            let last_update = filtered_points
                .last()
                .map(|p| p.timestamp)
                .unwrap_or_else(Utc::now);

            results.push(FusedTrack {
                icao_address: *icao,
                callsign,
                points: filtered_points,
                last_update,
                contributing_radars: contributing_radars.into_iter().collect(),
            });
        }

        results.sort_by(|a, b| b.last_update.cmp(&a.last_update));

        Ok(results)
    }

    pub fn clean_expired(&self) -> usize {
        let mut tracks = self.tracks.write();
        let now = Utc::now();
        let before = tracks.len();

        tracks.retain(|_, buffer| now - buffer.last_update < self.fusion_timeout);

        let removed = before - tracks.len();
        if removed > 0 {
            debug!("清理了 {} 条过期轨迹", removed);
        }
        removed
    }

    pub fn track_count(&self) -> usize {
        self.tracks.read().len()
    }

    pub fn point_count(&self) -> usize {
        self.tracks.read().values().map(|b| b.points.len()).sum()
    }

    pub fn get_statistics(&self) -> TrackerStats {
        let tracks = self.tracks.read();
        let now = Utc::now();

        let active = tracks
            .values()
            .filter(|b| now - b.last_update < self.fusion_timeout)
            .count();

        let total_points: usize = tracks.values().map(|b| b.points.len()).sum();

        let radars: HashSet<String> = tracks
            .values()
            .flat_map(|b| b.points.iter().map(|p| p.radar_id.clone()))
            .collect();

        TrackerStats {
            total_tracks: tracks.len(),
            active_tracks: active,
            total_points,
            contributing_radars: radars.len(),
            radar_ids: radars.into_iter().collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackerStats {
    pub total_tracks: usize,
    pub active_tracks: usize,
    pub total_points: usize,
    pub contributing_radars: usize,
    pub radar_ids: Vec<String>,
}

impl std::fmt::Display for TrackerStats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "TrackerStats: 总轨迹={}, 活跃轨迹={}, 总点数={}, 参与雷达={}, 雷达列表=[{}]",
            self.total_tracks,
            self.active_tracks,
            self.total_points,
            self.contributing_radars,
            self.radar_ids.join(", ")
        )
    }
}

pub async fn run_fusion_pipeline(
    tracker: Arc<MultiRadarTracker>,
    receiver: crossbeam_channel::Receiver<TrackPoint>,
    batch_size: usize,
) -> AtcResult<()> {
    let mut batch = Vec::with_capacity(batch_size);

    info!("启动融合处理流水线");

    loop {
        match receiver.recv_timeout(std::time::Duration::from_millis(100)) {
            Ok(point) => {
                batch.push(point);
                if batch.len() >= batch_size {
                    let points = std::mem::take(&mut batch);
                    let tracker_clone = tracker.clone();
                    tokio::task::spawn_blocking(move || {
                        tracker_clone.add_points_parallel(points);
                    })
                    .await
                    .map_err(|e| AtcError::Other(format!("融合任务异常: {}", e)))?;
                }
            }
            Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                if !batch.is_empty() {
                    let points = std::mem::take(&mut batch);
                    tracker.add_points_parallel(points);
                }
                tracker.clean_expired();
            }
            Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                if !batch.is_empty() {
                    tracker.add_points_parallel(batch);
                }
                info!("融合流水线已关闭");
                break;
            }
        }
    }

    Ok(())
}

pub fn fuse_points(points: &[TrackPoint], config: &AppConfig) -> Vec<FusedTrack> {
    let tracker = MultiRadarTracker::new(config);
    tracker.add_points_parallel(points.to_vec());
    tracker.get_all_tracks()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn create_test_point(
        icao: [u8; 3],
        lat: f64,
        lon: f64,
        alt: f64,
        radar: &str,
        offset_ms: i64,
    ) -> TrackPoint {
        TrackPoint {
            timestamp: Utc.with_ymd_and_hms(2025, 1, 1, 12, 0, 0).unwrap()
                + Duration::milliseconds(offset_ms),
            position: Position3D::new(lat, lon, alt),
            velocity: Velocity3D::new(250.0, 0.0, 90.0),
            icao_address: IcaoAddress::new(icao),
            callsign: Some("TEST123".to_string()),
            radar_id: radar.to_string(),
            confidence: 0.9,
        }
    }

    #[test]
    fn test_weighted_fusion() {
        let config = AppConfig::default();
        let tracker = MultiRadarTracker::new(&config);

        let point1 = create_test_point([1, 2, 3], 40.0, 116.0, 10000.0, "RADAR01", 0);
        let point2 = create_test_point([1, 2, 3], 40.001, 116.001, 10001.0, "RADAR02", 0);
        let point3 = create_test_point([1, 2, 3], 40.002, 116.002, 9999.0, "RADAR03", 0);

        let group = vec![point1, point2, point3];
        let fused = tracker.fuse_single_group(&group).unwrap();

        assert!((fused.position.latitude - 40.001).abs() < 0.001);
        assert!((fused.position.longitude - 116.001).abs() < 0.001);
        assert_eq!(fused.radar_id, "FUSED");
        assert!(fused.confidence > 0.0);
    }

    #[test]
    fn test_time_alignment() {
        let config = AppConfig::default();
        let tracker = MultiRadarTracker::new(&config);

        let points = vec![
            create_test_point([1, 2, 3], 40.0, 116.0, 10000.0, "RADAR01", 0),
            create_test_point([1, 2, 3], 40.001, 116.001, 10000.0, "RADAR02", 50),
            create_test_point([1, 2, 3], 40.002, 116.002, 10000.0, "RADAR03", 1000),
        ];

        let aligned = tracker.align_by_time(&points);
        assert_eq!(aligned.len(), 2);
        assert_eq!(aligned[0].len(), 2);
        assert_eq!(aligned[1].len(), 1);
    }
}
