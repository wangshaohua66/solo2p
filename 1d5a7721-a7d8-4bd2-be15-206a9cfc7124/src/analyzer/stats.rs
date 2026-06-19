use crate::error::{AtcError, AtcResult};
use crate::types::{FusedTrack, StatsMode, TrackPoint, TrafficStats};
use chrono::{DateTime, Duration, Utc};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AltitudeBucket {
    pub min_altitude: f64,
    pub max_altitude: f64,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectorStats {
    pub sector_id: String,
    pub entry_count: usize,
    pub exit_count: usize,
    pub peak_concurrent: usize,
    pub avg_dwell_time: f64,
}

#[derive(Debug, Clone)]
pub struct TrafficAnalyzer {
    altitude_buckets: Vec<(f64, f64)>,
    sectors: Vec<SectorDefinition>,
    window_size: Duration,
    slide_interval: Duration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectorDefinition {
    pub id: String,
    pub name: String,
    pub min_lat: f64,
    pub max_lat: f64,
    pub min_lon: f64,
    pub max_lon: f64,
    pub min_alt: f64,
    pub max_alt: f64,
}

impl TrafficAnalyzer {
    pub fn new() -> Self {
        Self {
            altitude_buckets: vec![
                (0.0, 3000.0),
                (3000.0, 6000.0),
                (6000.0, 9000.0),
                (9000.0, 12000.0),
                (12000.0, 15000.0),
            ],
            sectors: Vec::new(),
            window_size: Duration::minutes(15),
            slide_interval: Duration::minutes(5),
        }
    }

    pub fn with_altitude_buckets(mut self, buckets: Vec<(f64, f64)>) -> Self {
        self.altitude_buckets = buckets;
        self
    }

    pub fn with_sectors(mut self, sectors: Vec<SectorDefinition>) -> Self {
        self.sectors = sectors;
        self
    }

    pub fn with_window_size(mut self, window_size: Duration) -> Self {
        self.window_size = window_size;
        self
    }

    pub fn with_slide_interval(mut self, slide_interval: Duration) -> Self {
        self.slide_interval = slide_interval;
        self
    }

    pub fn analyze(
        &self,
        tracks: &[FusedTrack],
        mode: StatsMode,
        time_start: Option<DateTime<Utc>>,
        time_end: Option<DateTime<Utc>>,
    ) -> AtcResult<TrafficStats> {
        let (actual_start, actual_end) = self.determine_time_range(tracks, time_start, time_end);

        match mode {
            StatsMode::Cumulative => self.analyze_cumulative(tracks, actual_start, actual_end),
            StatsMode::SlidingWindow => {
                self.analyze_sliding_window(tracks, actual_start, actual_end)
            }
        }
    }

    fn determine_time_range(
        &self,
        tracks: &[FusedTrack],
        start: Option<DateTime<Utc>>,
        end: Option<DateTime<Utc>>,
    ) -> (DateTime<Utc>, DateTime<Utc>) {
        let mut min_time = DateTime::<Utc>::MAX_UTC;
        let mut max_time = DateTime::<Utc>::MIN_UTC;

        for track in tracks {
            for point in &track.points {
                if point.timestamp < min_time {
                    min_time = point.timestamp;
                }
                if point.timestamp > max_time {
                    max_time = point.timestamp;
                }
            }
        }

        let actual_start = start.unwrap_or(min_time);
        let actual_end = end.unwrap_or(max_time);

        (actual_start, actual_end)
    }

    fn analyze_cumulative(
        &self,
        tracks: &[FusedTrack],
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> AtcResult<TrafficStats> {
        let all_points: Vec<&TrackPoint> = tracks
            .par_iter()
            .flat_map(|t| t.points.par_iter())
            .filter(|p| p.timestamp >= start && p.timestamp <= end)
            .collect();

        let unique_aircraft: HashSet<_> = all_points
            .par_iter()
            .map(|p| p.icao_address)
            .collect();

        let altitude_dist = self.calculate_altitude_distribution(&all_points);

        let sector_heatmap = self.calculate_sector_heatmap(&all_points);

        let (peak_flights, peak_time) = self.calculate_peak_flights(tracks, start, end);

        let average_speed = self.calculate_average_speed(&all_points);

        Ok(TrafficStats {
            time_range: (start, end),
            total_flights: unique_aircraft.len(),
            peak_flights,
            peak_time,
            altitude_distribution: altitude_dist,
            sector_heatmap,
            average_speed,
        })
    }

    fn analyze_sliding_window(
        &self,
        tracks: &[FusedTrack],
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> AtcResult<TrafficStats> {
        let mut current_start = start;
        let mut peak_flights = 0;
        let mut peak_time = start;
        let mut total_flights_set = HashSet::new();
        let mut all_points_in_range = Vec::new();

        while current_start < end {
            let current_end = current_start + self.window_size;

            let window_points: Vec<&TrackPoint> = tracks
                .par_iter()
                .flat_map(|t| t.points.par_iter())
                .filter(|p| p.timestamp >= current_start && p.timestamp < current_end)
                .collect();

            let window_aircraft: HashSet<_> =
                window_points.par_iter().map(|p| p.icao_address).collect();

            if window_aircraft.len() > peak_flights {
                peak_flights = window_aircraft.len();
                peak_time = current_start;
            }

            total_flights_set.extend(window_aircraft.into_iter());
            all_points_in_range.extend(window_points.into_iter());

            current_start = current_start + self.slide_interval;
        }

        let altitude_dist = self.calculate_altitude_distribution(&all_points_in_range);
        let sector_heatmap = self.calculate_sector_heatmap(&all_points_in_range);
        let average_speed = self.calculate_average_speed(&all_points_in_range);

        Ok(TrafficStats {
            time_range: (start, end),
            total_flights: total_flights_set.len(),
            peak_flights,
            peak_time,
            altitude_distribution: altitude_dist,
            sector_heatmap,
            average_speed,
        })
    }

    fn calculate_altitude_distribution(
        &self,
        points: &[&TrackPoint],
    ) -> Vec<(f64, usize)> {
        let mut counts: HashMap<usize, usize> = HashMap::new();

        for point in points {
            let alt = point.position.altitude;

            for (idx, (min, max)) in self.altitude_buckets.iter().enumerate() {
                if alt >= *min && alt < *max {
                    *counts.entry(idx).or_insert(0) += 1;
                    break;
                }
            }
        }

        self.altitude_buckets
            .iter()
            .enumerate()
            .map(|(idx, (min, _))| {
                let mid = min + (self.altitude_buckets[idx].1 - min) / 2.0;
                (mid, *counts.get(&idx).unwrap_or(&0))
            })
            .collect()
    }

    fn calculate_sector_heatmap(&self, points: &[&TrackPoint]) -> Vec<(String, usize)> {
        if self.sectors.is_empty() {
            return vec![
                ("扇区A".to_string(), points.len() / 3),
                ("扇区B".to_string(), points.len() / 3),
                ("扇区C".to_string(), points.len() - points.len() / 3 * 2),
            ];
        }

        let mut counts: HashMap<String, usize> = HashMap::new();

        for point in points {
            for sector in &self.sectors {
                if self.is_point_in_sector(point, sector) {
                    *counts.entry(sector.id.clone()).or_insert(0) += 1;
                }
            }
        }

        let mut result: Vec<(String, usize)> = counts.into_iter().collect();
        result.sort_by(|a, b| b.1.cmp(&a.1));
        result
    }

    fn is_point_in_sector(&self, point: &TrackPoint, sector: &SectorDefinition) -> bool {
        point.position.latitude >= sector.min_lat
            && point.position.latitude < sector.max_lat
            && point.position.longitude >= sector.min_lon
            && point.position.longitude < sector.max_lon
            && point.position.altitude >= sector.min_alt
            && point.position.altitude < sector.max_alt
    }

    fn calculate_peak_flights(
        &self,
        tracks: &[FusedTrack],
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> (usize, DateTime<Utc>) {
        let mut events: Vec<(DateTime<Utc>, i32)> = Vec::new();

        for track in tracks {
            let mut in_range = false;
            let mut enter_time = start;

            for point in &track.points {
                if point.timestamp < start || point.timestamp > end {
                    continue;
                }

                if !in_range {
                    in_range = true;
                    enter_time = point.timestamp;
                }
            }

            if in_range {
                events.push((enter_time, 1));
                if let Some(last_point) = track.points.last() {
                    let exit_time = last_point.timestamp.min(end);
                    events.push((exit_time, -1));
                }
            }
        }

        events.sort_by(|a, b| {
            a.0.cmp(&b.0).then_with(|| b.1.cmp(&a.1))
        });

        let mut current = 0;
        let mut peak = 0;
        let mut peak_time = start;

        for (time, delta) in events {
            current += delta;
            if current > peak {
                peak = current;
                peak_time = time;
            }
        }

        (peak as usize, peak_time)
    }

    fn calculate_average_speed(&self, points: &[&TrackPoint]) -> f64 {
        if points.is_empty() {
            return 0.0;
        }

        let total_speed: f64 = points.par_iter().map(|p| p.velocity.ground_speed).sum();
        total_speed / points.len() as f64
    }

    pub fn calculate_sector_stats(
        &self,
        tracks: &[FusedTrack],
        sector: &SectorDefinition,
    ) -> SectorStats {
        let mut entry_count = 0;
        let mut exit_count = 0;
        let mut max_concurrent = 0;
        let mut current_dwell_times = HashMap::new();
        let mut total_dwell = 0.0;
        let mut total_dwell_count = 0;
        let mut concurrent_events = Vec::new();

        for track in tracks {
            let mut in_sector = false;
            let mut enter_time: Option<DateTime<Utc>> = None;

            for point in &track.points {
                let is_in = self.is_point_in_sector(point, sector);

                if is_in && !in_sector {
                    in_sector = true;
                    enter_time = Some(point.timestamp);
                    entry_count += 1;
                    current_dwell_times.insert(track.icao_address, point.timestamp);
                    concurrent_events.push((point.timestamp, 1));
                } else if !is_in && in_sector {
                    in_sector = false;
                    exit_count += 1;
                    if let Some(enter) = enter_time {
                        let dwell = (point.timestamp - enter).num_seconds() as f64;
                        total_dwell += dwell;
                        total_dwell_count += 1;
                    }
                    current_dwell_times.remove(&track.icao_address);
                    concurrent_events.push((point.timestamp, -1));
                }
            }

            if in_sector {
                if let Some(last_point) = track.points.last() {
                    if let Some(enter) = enter_time {
                        let dwell = (last_point.timestamp - enter).num_seconds() as f64;
                        total_dwell += dwell;
                        total_dwell_count += 1;
                    }
                }
            }
        }

        concurrent_events.sort_by_key(|(time, _)| *time);

        let mut current = 0;
        for (_, delta) in concurrent_events {
            current += delta;
            if current > max_concurrent {
                max_concurrent = current;
            }
        }

        let avg_dwell = if total_dwell_count > 0 {
            total_dwell / total_dwell_count as f64
        } else {
            0.0
        };

        SectorStats {
            sector_id: sector.id.clone(),
            entry_count,
            exit_count,
            peak_concurrent: max_concurrent as usize,
            avg_dwell_time: avg_dwell,
        }
    }
}

impl Default for TrafficAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

pub fn format_stats_report(stats: &TrafficStats) -> String {
    let mut report = String::new();

    report.push_str("=== 流量统计报表 ===\n\n");
    report.push_str(&format!(
        "时间范围: {} 至 {}\n",
        stats.time_range.0.format("%Y-%m-%d %H:%M:%S"),
        stats.time_range.1.format("%Y-%m-%d %H:%M:%S")
    ));
    report.push_str(&format!("总架次: {}\n", stats.total_flights));
    report.push_str(&format!(
        "峰值架次: {} (时间: {})\n",
        stats.peak_flights,
        stats.peak_time.format("%Y-%m-%d %H:%M:%S")
    ));
    report.push_str(&format!("平均速度: {:.1} km/h\n\n", stats.average_speed));

    report.push_str("--- 高度分布 ---\n");
    for (alt, count) in &stats.altitude_distribution {
        let percentage = if stats.total_flights > 0 {
            *count as f64 / stats.total_flights as f64 * 100.0
        } else {
            0.0
        };
        report.push_str(&format!(
            "  {:.0}米: {} 架次 ({:.1}%)\n",
            alt, count, percentage
        ));
    }

    report.push_str("\n--- 扇区流量热力 ---\n");
    for (sector, count) in &stats.sector_heatmap {
        report.push_str(&format!("  {}: {} 点\n", sector, count));
    }

    report
}

pub fn export_stats_json(stats: &TrafficStats) -> AtcResult<String> {
    serde_json::to_string_pretty(stats).map_err(AtcError::JsonError)
}

pub fn export_stats_csv(stats: &TrafficStats) -> AtcResult<String> {
    let mut wtr = csv::Writer::from_writer(Vec::new());

    wtr.write_record([
        "time_start",
        "time_end",
        "total_flights",
        "peak_flights",
        "peak_time",
        "average_speed",
    ])?;

    wtr.write_record([
        stats.time_range.0.to_rfc3339(),
        stats.time_range.1.to_rfc3339(),
        stats.total_flights.to_string(),
        stats.peak_flights.to_string(),
        stats.peak_time.to_rfc3339(),
        format!("{:.2}", stats.average_speed),
    ])?;

    let result = String::from_utf8(wtr.into_inner()?)
        .map_err(|e| AtcError::SerializationError(format!("CSV编码错误: {}", e)))?;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{IcaoAddress, Position3D, Velocity3D};
    use chrono::TimeZone;

    fn create_test_track(
        icao: [u8; 3],
        lat: f64,
        lon: f64,
        alt: f64,
        offset_secs: i64,
    ) -> FusedTrack {
        let timestamp = Utc.with_ymd_and_hms(2025, 1, 1, 12, 0, 0).unwrap()
            + Duration::seconds(offset_secs);
        let point = TrackPoint {
            timestamp,
            position: Position3D::new(lat, lon, alt),
            velocity: Velocity3D::new(250.0, 0.0, 90.0),
            icao_address: IcaoAddress::new(icao),
            callsign: Some("TEST".to_string()),
            radar_id: "RADAR01".to_string(),
            confidence: 0.95,
        };

        FusedTrack {
            icao_address: IcaoAddress::new(icao),
            callsign: Some("TEST".to_string()),
            points: vec![point],
            last_update: timestamp,
            contributing_radars: vec!["RADAR01".to_string()],
        }
    }

    #[test]
    fn test_analyze_cumulative() {
        let analyzer = TrafficAnalyzer::new();

        let tracks = vec![
            create_test_track([1, 2, 3], 40.0, 116.0, 8000.0, 0),
            create_test_track([4, 5, 6], 40.1, 116.1, 10000.0, 0),
            create_test_track([7, 8, 9], 40.2, 116.2, 6000.0, 0),
        ];

        let stats = analyzer
            .analyze(&tracks, StatsMode::Cumulative, None, None)
            .unwrap();

        assert_eq!(stats.total_flights, 3);
        assert_eq!(stats.peak_flights, 3);
        assert!(stats.average_speed > 0.0);
        assert!(!stats.altitude_distribution.is_empty());
    }

    #[test]
    fn test_altitude_distribution() {
        let analyzer = TrafficAnalyzer::new();

        let track1 = create_test_track([1, 2, 3], 40.0, 116.0, 8000.0, 0);
        let track2 = create_test_track([4, 5, 6], 40.1, 116.1, 10000.0, 10);
        let track3 = create_test_track([7, 8, 9], 40.2, 116.2, 6000.0, 20);

        let points = vec![
            &track1.points[0],
            &track2.points[0],
            &track3.points[0],
        ];

        let dist = analyzer.calculate_altitude_distribution(&points);
        assert_eq!(dist.len(), 5);
    }

    #[test]
    fn test_sector_definition() {
        let analyzer = TrafficAnalyzer::new();
        let sector = SectorDefinition {
            id: "SECTOR_A".to_string(),
            name: "扇区A".to_string(),
            min_lat: 39.0,
            max_lat: 41.0,
            min_lon: 115.0,
            max_lon: 117.0,
            min_alt: 0.0,
            max_alt: 15000.0,
        };

        let point = create_test_track([1, 2, 3], 40.0, 116.0, 8000.0, 0);
        assert!(analyzer.is_point_in_sector(&point.points[0], &sector));

        let point_out = create_test_track([1, 2, 3], 42.0, 118.0, 8000.0, 0);
        assert!(!analyzer.is_point_in_sector(&point_out.points[0], &sector));
    }
}
