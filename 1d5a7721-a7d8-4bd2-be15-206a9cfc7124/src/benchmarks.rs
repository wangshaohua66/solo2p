#[cfg(test)]
use crate::alert::ConflictDetector;
#[cfg(test)]
use crate::config::AppConfig;
#[cfg(test)]
use crate::decoder::AsterixDecoder;
#[cfg(test)]
use crate::fusion::MultiRadarTracker;
#[cfg(test)]
use crate::io::{BinaryReader, InputStream};
#[cfg(test)]
use crate::types::{
    FusedTrack, IcaoAddress, Position3D, SafetyThresholds, TrackPoint, Velocity3D,
};
#[cfg(test)]
use chrono::{Duration, TimeZone, Utc};
#[cfg(test)]
use std::time::Instant;

#[allow(dead_code)]
const MIN_THROUGHPUT_RECORDS_PER_SEC: f64 = 5000.0;
#[allow(dead_code)]
const MAX_FUSION_LATENCY_MS: u128 = 100;
#[allow(dead_code)]
const MAX_CONFLICT_DETECTION_MS: u128 = 50;

#[cfg(test)]
fn make_cat048_message(idx: usize) -> Vec<u8> {
    let mut msg = Vec::new();

    msg.push(0x30);

    let body = vec![0x01u8, 0x02u8];
    let total_len = 3 + 1 + body.len();
    msg.extend_from_slice(&(total_len as u16).to_be_bytes());

    msg.push(0x80);
    msg.extend_from_slice(&body);

    let _ = idx;
    msg
}

#[cfg(test)]
fn generate_test_messages(count: usize) -> Vec<Vec<u8>> {
    (0..count).map(|i| make_cat048_message(i)).collect()
}

#[cfg(test)]
fn generate_test_track_points(count: usize) -> Vec<TrackPoint> {
    let base = Utc.with_ymd_and_hms(2025, 1, 1, 12, 0, 0).unwrap();
    (0..count)
        .map(|i| {
            let icao = [(i % 256) as u8, ((i / 256) % 256) as u8, ((i / 65536) % 256) as u8];
            TrackPoint {
                timestamp: base + Duration::milliseconds(i as i64),
                position: Position3D::new(
                    39.0 + (i as f64 % 100.0) * 0.01,
                    116.0 + (i as f64 % 100.0) * 0.01,
                    8000.0 + (i as f64 % 20.0) * 100.0,
                ),
                velocity: Velocity3D::new(250.0, 90.0, 0.0),
                icao_address: IcaoAddress::new(icao),
                callsign: Some(format!("TEST{:03}", i % 999)),
                radar_id: format!("RADAR{:02}", i % 3),
                confidence: 0.95,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn benchmark_decode_throughput() {
        let count = 10000;
        let messages = generate_test_messages(count);
        let decoder = AsterixDecoder::new()
            .with_checksum_verification(false)
            .with_skip_unknown(true);

        let start = Instant::now();
        let mut success = 0usize;
        for msg in &messages {
            if decoder.decode_message(msg).is_ok() {
                success += 1;
            }
        }
        let elapsed = start.elapsed();

        let elapsed_secs = elapsed.as_secs_f64().max(0.001);
        let throughput = success as f64 / elapsed_secs;

        eprintln!(
            "解码吞吐量: {:.0} 条/秒 ({} 条, 耗时 {:.3}s)",
            throughput, success, elapsed_secs
        );

        assert!(throughput >= MIN_THROUGHPUT_RECORDS_PER_SEC,
            "解码吞吐量 {:.0} 低于阈值 {:.0} 条/秒", throughput, MIN_THROUGHPUT_RECORDS_PER_SEC);
    }

    #[test]
    fn benchmark_decode_stream() {
        let count = 10000;
        let messages = generate_test_messages(count);
        let mut stream_data = Vec::with_capacity(count * 8);
        for msg in &messages {
            stream_data.extend_from_slice(msg);
        }

        let decoder = AsterixDecoder::new()
            .with_checksum_verification(false)
            .with_skip_unknown(true);

        let start = Instant::now();
        let mut decoded_count = 0usize;
        let mut offset = 0;
        while offset < stream_data.len() {
            if offset + 3 > stream_data.len() {
                break;
            }
            let length = u16::from_be_bytes([stream_data[offset + 1], stream_data[offset + 2]]) as usize;
            if length < 3 || offset + length > stream_data.len() {
                break;
            }
            if decoder.decode_message(&stream_data[offset..offset + length]).is_ok() {
                decoded_count += 1;
            }
            offset += length;
        }
        let elapsed = start.elapsed();

        let elapsed_secs = elapsed.as_secs_f64().max(0.001);
        let throughput = decoded_count as f64 / elapsed_secs;

        eprintln!(
            "流式解码吞吐量: {:.0} 条/秒 ({} 条, 耗时 {:.3}s)",
            throughput, decoded_count, elapsed_secs
        );

        assert!(throughput >= MIN_THROUGHPUT_RECORDS_PER_SEC,
            "流式解码吞吐量 {:.0} 低于阈值 {:.0} 条/秒", throughput, MIN_THROUGHPUT_RECORDS_PER_SEC);
    }

    #[test]
    fn benchmark_file_read_throughput() {
        let count = 10000;
        let messages = generate_test_messages(count);

        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        for msg in &messages {
            tmp.write_all(msg).unwrap();
        }
        tmp.flush().unwrap();

        let path = tmp.path().to_path_buf();
        let start = Instant::now();
        let mut reader = BinaryReader::new(InputStream::File(path), false).unwrap();

        let mut total_records = 0usize;
        loop {
            let header = reader.read_bytes(3).unwrap();
            if header.len() < 3 {
                break;
            }
            let length = u16::from_be_bytes([header[1], header[2]]) as usize;
            if length < 3 {
                break;
            }
            let _remaining = reader.read_bytes(length - 3).unwrap();
            total_records += 1;
        }

        let elapsed = start.elapsed();
        let elapsed_secs = elapsed.as_secs_f64().max(0.001);
        let throughput = total_records as f64 / elapsed_secs;

        eprintln!(
            "文件读取吞吐量: {:.0} 条/秒 ({} 条, 耗时 {:.3}s)",
            throughput, total_records, elapsed_secs
        );

        assert!(throughput >= MIN_THROUGHPUT_RECORDS_PER_SEC,
            "文件读取吞吐量 {:.0} 低于阈值 {:.0} 条/秒", throughput, MIN_THROUGHPUT_RECORDS_PER_SEC);
    }

    #[test]
    fn benchmark_fusion_latency() {
        let config = AppConfig::default();
        let tracker = MultiRadarTracker::new(&config);

        let points_per_radar = 100;
        let num_radars = 3;
        let base = Utc.with_ymd_and_hms(2025, 1, 1, 12, 0, 0).unwrap();

        for radar_idx in 0..num_radars {
            let radar_id = format!("RADAR{:02}", radar_idx);
            for i in 0..points_per_radar {
                let icao = [(i % 256) as u8, ((i / 256) % 256) as u8, 0u8];
                let point = TrackPoint {
                    timestamp: base + Duration::milliseconds(i as i64),
                    position: Position3D::new(
                        40.0 + (i as f64) * 0.001 + radar_idx as f64 * 0.0001,
                        116.0 + (i as f64) * 0.001,
                        10000.0,
                    ),
                    velocity: Velocity3D::new(250.0, 90.0, 0.0),
                    icao_address: IcaoAddress::new(icao),
                    callsign: Some(format!("TEST{:03}", i)),
                    radar_id: radar_id.clone(),
                    confidence: 0.9,
                };
                tracker.add_point(point);
            }
        }

        let test_points = generate_test_track_points(300);
        let start = Instant::now();
        tracker.add_points_parallel(test_points);
        let _tracks = tracker.get_all_tracks();
        let elapsed = start.elapsed();

        eprintln!(
            "融合延迟: {}ms (目标: <{}ms)",
            elapsed.as_millis(), MAX_FUSION_LATENCY_MS
        );

        assert!(elapsed.as_millis() < MAX_FUSION_LATENCY_MS,
            "融合延迟 {}ms 超过阈值 {}ms", elapsed.as_millis(), MAX_FUSION_LATENCY_MS);
    }

    #[test]
    fn benchmark_conflict_detection() {
        let base = Utc.with_ymd_and_hms(2025, 1, 1, 12, 0, 0).unwrap();

        let make_track = |icao: [u8; 3], lat: f64, lon: f64, heading: f64| -> FusedTrack {
            let point = TrackPoint {
                timestamp: base,
                position: Position3D::new(lat, lon, 10000.0),
                velocity: Velocity3D::new(500.0, heading, 0.0),
                icao_address: IcaoAddress::new(icao),
                callsign: Some("TEST".to_string()),
                radar_id: "FUSED".to_string(),
                confidence: 0.95,
            };
            FusedTrack {
                icao_address: IcaoAddress::new(icao),
                callsign: Some("TEST".to_string()),
                points: vec![point],
                last_update: base,
                contributing_radars: vec!["RADAR01".to_string()],
            }
        };

        let mut tracks = Vec::new();
        for i in 0..50 {
            let lat1 = 40.0 + i as f64 * 0.01;
            let lat2 = 40.0 + i as f64 * 0.01 + 0.005;
            tracks.push(make_track([i as u8, 0, 0], lat1, 116.0, 90.0));
            tracks.push(make_track([(i + 50) as u8, 0, 0], lat2, 116.1, 270.0));
        }

        let thresholds = SafetyThresholds {
            horizontal_separation: 5000.0,
            vertical_separation: 300.0,
            lookahead_seconds: 120,
            warning_factor: 1.5,
        };

        let detector = ConflictDetector::new(thresholds);

        let start = Instant::now();
        let alerts = detector.detect_conflicts(&tracks);
        let elapsed = start.elapsed();

        eprintln!(
            "冲突检测: {} 条告警 ({} 条轨迹, 耗时 {}ms, 目标: <{}ms)",
            alerts.len(), tracks.len(), elapsed.as_millis(), MAX_CONFLICT_DETECTION_MS
        );

        assert!(elapsed.as_millis() < MAX_CONFLICT_DETECTION_MS,
            "冲突检测耗时 {}ms 超过阈值 {}ms", elapsed.as_millis(), MAX_CONFLICT_DETECTION_MS);
    }

    #[test]
    fn benchmark_memory_large_dataset() {
        let count = 100_000;
        let config = AppConfig::default();
        let tracker = MultiRadarTracker::new(&config);

        let batch_size = 10000;
        let base = Utc.with_ymd_and_hms(2025, 1, 1, 12, 0, 0).unwrap();

        let start = Instant::now();
        for batch_start in (0..count).step_by(batch_size) {
            let batch_end = (batch_start + batch_size).min(count);
            let mut batch = Vec::with_capacity(batch_end - batch_start);
            for i in batch_start..batch_end {
                let icao = [(i % 256) as u8, ((i / 256) % 256) as u8, ((i / 65536) % 256) as u8];
                batch.push(TrackPoint {
                    timestamp: base + Duration::milliseconds(i as i64),
                    position: Position3D::new(
                        39.0 + (i as f64 % 1000.0) * 0.001,
                        116.0 + (i as f64 % 1000.0) * 0.001,
                        8000.0 + (i as f64 % 100.0) * 10.0,
                    ),
                    velocity: Velocity3D::new(250.0, 90.0, 0.0),
                    icao_address: IcaoAddress::new(icao),
                    callsign: Some(format!("T{:06}", i)),
                    radar_id: "RADAR01".to_string(),
                    confidence: 0.9,
                });
            }
            tracker.add_points_parallel(batch);
        }

        let track_count = tracker.track_count();
        let elapsed = start.elapsed();

        eprintln!(
            "大内存数据集: {} 条轨迹点 -> {} 条独立轨迹, 耗时 {:.3}s",
            count, track_count, elapsed.as_secs_f64()
        );

        assert!(track_count > 0, "应有轨迹数据");
    }

    #[test]
    fn benchmark_parallel_fusion() {
        let config = AppConfig::default();
        let tracker = MultiRadarTracker::new(&config);

        let count = 50000;
        let points = generate_test_track_points(count);

        let start = Instant::now();
        tracker.add_points_parallel(points);
        let tracks = tracker.get_all_tracks();
        let elapsed = start.elapsed();

        let elapsed_secs = elapsed.as_secs_f64().max(0.001);
        let throughput = count as f64 / elapsed_secs;

        eprintln!(
            "并行融合吞吐量: {:.0} 条/秒 ({} 条轨迹, 耗时 {:.3}s)",
            throughput, tracks.len(), elapsed_secs
        );

        assert!(throughput >= MIN_THROUGHPUT_RECORDS_PER_SEC,
            "并行融合吞吐量 {:.0} 低于阈值 {:.0} 条/秒", throughput, MIN_THROUGHPUT_RECORDS_PER_SEC);
    }
}
