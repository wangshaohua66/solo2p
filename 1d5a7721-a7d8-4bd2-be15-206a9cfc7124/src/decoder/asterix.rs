use crate::error::{AtcError, AtcResult};
use crate::types::{IcaoAddress, Position3D, TrackPoint, Velocity3D};
use byteorder::{BigEndian, ReadBytesExt};
use chrono::{DateTime, Duration, Utc};
use crc::{Crc, CRC_16_ARC};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Cursor;

pub const ASTERIX_CAT048: u8 = 0x30;
pub const MIN_MESSAGE_LENGTH: usize = 4;

const CRC16: Crc<u16> = Crc::<u16>::new(&CRC_16_ARC);

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AsterixMessage {
    pub category: u8,
    pub length: u16,
    pub data_items: HashMap<u8, Vec<u8>>,
    pub fspec: Vec<u8>,
    pub checksum_valid: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Cat048Record {
    pub sac: u8,
    pub sic: u8,
    pub time_of_day: f64,
    pub target_address: Option<IcaoAddress>,
    pub callsign: Option<String>,
    pub position: Option<Position3D>,
    pub velocity: Option<Velocity3D>,
    pub flight_level: Option<f64>,
    pub track_number: Option<u16>,
    pub alert: Option<bool>,
    pub spi: Option<bool>,
    pub radar_id: String,
}

pub struct AsterixDecoder {
    verify_checksum: bool,
    skip_unknown_items: bool,
    base_time: DateTime<Utc>,
}

impl Default for AsterixDecoder {
    fn default() -> Self {
        Self {
            verify_checksum: true,
            skip_unknown_items: true,
            base_time: Utc::now(),
        }
    }
}

impl AsterixDecoder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_checksum_verification(mut self, verify: bool) -> Self {
        self.verify_checksum = verify;
        self
    }

    pub fn with_skip_unknown(mut self, skip: bool) -> Self {
        self.skip_unknown_items = skip;
        self
    }

    pub fn with_base_time(mut self, base_time: DateTime<Utc>) -> Self {
        self.base_time = base_time;
        self
    }

    pub fn decode_message(&self, data: &[u8]) -> AtcResult<AsterixMessage> {
        if data.len() < MIN_MESSAGE_LENGTH {
            return Err(AtcError::ParseError {
                message: format!(
                    "消息长度不足, 至少需要 {} 字节, 实际 {} 字节",
                    MIN_MESSAGE_LENGTH,
                    data.len()
                ),
                offset: 0,
            });
        }

        let mut cursor = Cursor::new(data);
        let category = cursor.read_u8()?;

        if category != ASTERIX_CAT048 {
            return Err(AtcError::UnsupportedCategory(category));
        }

        let length = cursor.read_u16::<BigEndian>()?;

        if length as usize > data.len() {
            return Err(AtcError::ParseError {
                message: format!(
                    "声明的消息长度 {} 大于实际数据长度 {}",
                    length,
                    data.len()
                ),
                offset: 1,
            });
        }

        let checksum_valid = if self.verify_checksum {
            Some(self.verify_checksum(&data[..length as usize]))
        } else {
            None
        };

        let (fspec, data_items) = self.parse_fspec_and_items(&data[3..length as usize])?;

        Ok(AsterixMessage {
            category,
            length,
            data_items,
            fspec,
            checksum_valid,
        })
    }

    fn parse_fspec_and_items(&self, data: &[u8]) -> AtcResult<(Vec<u8>, HashMap<u8, Vec<u8>>)> {
        let mut fspec = Vec::new();
        let mut offset = 0;

        loop {
            if offset >= data.len() {
                return Err(AtcError::ParseError {
                    message: "FSPEC数据不足".to_string(),
                    offset: 3 + offset,
                });
            }

            let byte = data[offset];
            fspec.push(byte);
            offset += 1;

            if (byte & 0x01) == 0 {
                break;
            }
        }

        let mut items = HashMap::new();
        let mut data_offset = offset;

        for (fspec_byte_idx, &fspec_byte) in fspec.iter().enumerate() {
            for bit_idx in 1..8 {
                if (fspec_byte >> (8 - bit_idx)) & 0x01 != 0 {
                    let item_number = (fspec_byte_idx as u8) * 8 + bit_idx as u8;

                    if data_offset >= data.len() {
                        if self.skip_unknown_items {
                            continue;
                        }
                        return Err(AtcError::ParseError {
                            message: format!("数据项 {} 数据不足", item_number),
                            offset: 3 + data_offset,
                        });
                    }

                    let (item_data, consumed) =
                        self.parse_data_item(item_number, &data[data_offset..])?;
                    items.insert(item_number, item_data);
                    data_offset += consumed;
                }
            }
        }

        Ok((fspec, items))
    }

    fn parse_data_item(&self, item_number: u8, data: &[u8]) -> AtcResult<(Vec<u8>, usize)> {
        let (length, is_variable) = self.get_item_length(item_number);

        if is_variable {
            if data.is_empty() {
                return Err(AtcError::ParseError {
                    message: format!("可变长度数据项 {} 长度字段缺失", item_number),
                    offset: 0,
                });
            }

            let var_len = data[0] as usize;
            if var_len > data.len() {
                return Err(AtcError::ParseError {
                    message: format!(
                        "可变长度数据项 {} 声明长度 {} 大于可用数据 {}",
                        item_number,
                        var_len,
                        data.len()
                    ),
                    offset: 0,
                });
            }

            Ok((data[..var_len].to_vec(), var_len))
        } else if length == 0 {
            Ok((data.to_vec(), data.len()))
        } else {
            if length > data.len() {
                if self.skip_unknown_items {
                    return Ok((data.to_vec(), data.len()));
                }
                return Err(AtcError::ParseError {
                    message: format!(
                        "数据项 {} 需要 {} 字节, 可用 {} 字节",
                        item_number,
                        length,
                        data.len()
                    ),
                    offset: 0,
                });
            }
            Ok((data[..length].to_vec(), length))
        }
    }

    fn get_item_length(&self, item_number: u8) -> (usize, bool) {
        match item_number {
            1 => (2, false),
            2 => (3, false),
            3 => (3, false),
            4 => (4, false),
            5 => (2, false),
            6 => (2, false),
            7 => (2, false),
            8 => (4, false),
            9 => (3, false),
            10 => (2, false),
            11 => (2, false),
            12 => (1, false),
            13 => (2, false),
            14 => (3, false),
            15 => (1, false),
            16 => (8, false),
            17 => (2, false),
            18 => (6, false),
            19 => (1, false),
            20 => (2, false),
            21 => (7, true),
            22 => (1, false),
            23 => (3, false),
            24 => (2, false),
            25 => (2, false),
            26 => (2, false),
            27 => (4, false),
            28 => (4, false),
            29 => (1, false),
            30 => (2, false),
            31 => (0, true),
            32 => (4, false),
            33 => (6, false),
            34 => (2, false),
            35 => (1, false),
            36 => (2, false),
            37 => (3, false),
            38 => (2, false),
            39 => (2, false),
            40 => (4, false),
            41 => (4, false),
            42 => (2, false),
            43 => (2, false),
            44 => (2, false),
            45 => (2, false),
            46 => (4, false),
            47 => (2, false),
            48 => (2, false),
            49 => (3, false),
            _ => (0, true),
        }
    }

    pub fn parse_cat048(&self, message: &AsterixMessage) -> AtcResult<Cat048Record> {
        let mut record = Cat048Record {
            sac: 0,
            sic: 0,
            time_of_day: 0.0,
            target_address: None,
            callsign: None,
            position: None,
            velocity: None,
            flight_level: None,
            track_number: None,
            alert: None,
            spi: None,
            radar_id: String::new(),
        };

        if let Some(data) = message.data_items.get(&1) {
            let (sac, sic) = parse_i010(data)?;
            record.sac = sac;
            record.sic = sic;
            record.radar_id = format!("{:02X}{:02X}", sac, sic);
        }

        if let Some(data) = message.data_items.get(&2) {
            record.time_of_day = parse_i140(data)?;
        }

        if let Some(data) = message.data_items.get(&3) {
            record.target_address = Some(parse_i240(data)?);
        }

        if let Some(data) = message.data_items.get(&4) {
            record.callsign = Some(parse_i250(data)?);
        }

        if let Some(data) = message.data_items.get(&5) {
            let (lat, lon) = parse_i040(data)?;
            let alt = record.flight_level.unwrap_or(0.0) * 30.48;
            record.position = Some(Position3D::new(lat, lon, alt));
        }

        if let Some(data) = message.data_items.get(&6) {
            record.flight_level = Some(parse_i090(data)?);
            if let Some(pos) = record.position.as_mut() {
                pos.altitude = record.flight_level.unwrap() * 30.48;
            }
        }

        if let Some(data) = message.data_items.get(&7) {
            record.track_number = Some(parse_i161(data)?);
        }

        if let Some(data) = message.data_items.get(&8) {
            let (gs, vs, heading) = parse_i200(data)?;
            record.velocity = Some(Velocity3D::new(gs, vs, heading));
        }

        if let Some(data) = message.data_items.get(&12) {
            let (alert, spi) = parse_i070(data)?;
            record.alert = Some(alert);
            record.spi = Some(spi);
        }

        if let Some(data) = message.data_items.get(&11) {
            if let (Some(lat), Some(lon)) = parse_i042(data)? {
                let alt = record.flight_level.unwrap_or(0.0) * 30.48;
                record.position = Some(Position3D::new(lat, lon, alt));
            }
        }

        Ok(record)
    }

    pub fn to_track_point(&self, record: &Cat048Record, radar_id: &str) -> AtcResult<TrackPoint> {
        let position = record.position.ok_or_else(|| AtcError::ParseError {
            message: "缺少位置数据".to_string(),
            offset: 0,
        })?;

        let velocity = record.velocity.unwrap_or_else(|| Velocity3D::new(0.0, 0.0, 0.0));

        let time = self.time_to_datetime(record.time_of_day);

        Ok(TrackPoint {
            timestamp: time,
            position,
            velocity,
            icao_address: record.target_address.unwrap_or(IcaoAddress::new([0, 0, 0])),
            callsign: record.callsign.clone(),
            radar_id: radar_id.to_string(),
            confidence: 0.95,
        })
    }

    fn time_to_datetime(&self, time_of_day: f64) -> DateTime<Utc> {
        let secs = time_of_day.floor() as i64;
        let nanos = ((time_of_day - secs as f64) * 1e9) as u32;
        let duration = Duration::seconds(secs) + Duration::nanoseconds(nanos as i64);

        let date = self.base_time.date_naive();
        let naive_dt = date.and_hms_opt(0, 0, 0).unwrap() + duration;

        DateTime::from_naive_utc_and_offset(naive_dt, Utc)
    }

    fn verify_checksum(&self, data: &[u8]) -> bool {
        if data.len() < 4 {
            return false;
        }

        let checksum_pos = data.len() - 2;
        let message_data = &data[..checksum_pos];
        let mut expected_bytes = [0u8; 2];
        expected_bytes.copy_from_slice(&data[checksum_pos..]);
        let expected = u16::from_be_bytes(expected_bytes);
        let computed = CRC16.checksum(message_data);

        expected == computed
    }

    pub fn decode_stream(&self, data: &[u8]) -> AtcResult<Vec<TrackPoint>> {
        let mut offset = 0;
        let mut points = Vec::new();

        while offset < data.len() {
            if offset + MIN_MESSAGE_LENGTH > data.len() {
                break;
            }

            let length = u16::from_be_bytes([data[offset + 1], data[offset + 2]]) as usize;

            if length == 0 || offset + length > data.len() {
                return Err(AtcError::ParseError {
                    message: format!(
                        "无效的消息长度 {} 在偏移量 {}, 剩余数据 {} 字节",
                        length,
                        offset,
                        data.len() - offset
                    ),
                    offset,
                });
            }

            let message = self.decode_message(&data[offset..offset + length])?;
            let record = self.parse_cat048(&message)?;
            let point = self.to_track_point(&record, &record.radar_id.clone())?;

            points.push(point);
            offset += length;
        }

        Ok(points)
    }

    pub fn decode_batch(&self, batch: &[u8]) -> AtcResult<Vec<TrackPoint>> {
        self.decode_stream(batch)
    }
}

fn parse_i010(data: &[u8]) -> AtcResult<(u8, u8)> {
    if data.len() < 2 {
        return Err(AtcError::InvalidDataItem {
            message: "I010需要2字节".to_string(),
        });
    }
    Ok((data[0], data[1]))
}

fn parse_i140(data: &[u8]) -> AtcResult<f64> {
    if data.len() < 3 {
        return Err(AtcError::InvalidDataItem {
            message: "I140需要3字节".to_string(),
        });
    }
    let raw = u32::from_be_bytes([0, data[0], data[1], data[2]]);
    let time = (raw as f64) / 128.0;
    Ok(time)
}

fn parse_i240(data: &[u8]) -> AtcResult<IcaoAddress> {
    if data.len() < 3 {
        return Err(AtcError::InvalidDataItem {
            message: "I240需要3字节".to_string(),
        });
    }
    Ok(IcaoAddress::new([data[0], data[1], data[2]]))
}

fn parse_i250(data: &[u8]) -> AtcResult<String> {
    if data.len() < 4 {
        return Err(AtcError::InvalidDataItem {
            message: "I250需要4字节".to_string(),
        });
    }

    let mut callsign = String::new();
    for i in 0..6 {
        let byte_idx = i / 2;
        let is_high = i % 2 == 0;
        let char_code = if is_high {
            (data[byte_idx] >> 2) & 0x3F
        } else {
            ((data[byte_idx] & 0x03) << 4) | ((data[byte_idx + 1] >> 4) & 0x0F)
        };
        callsign.push(decode_asterix_char(char_code));
    }

    Ok(callsign.trim_end().to_string())
}

fn decode_asterix_char(code: u8) -> char {
    match code {
        0..=25 => (b'A' + code) as char,
        26..=35 => (b'0' + (code - 26)) as char,
        36 => ' ',
        37 => '!',
        38 => '"',
        39 => '#',
        40 => '$',
        41 => '%',
        42 => '&',
        43 => '\'',
        44 => '(',
        45 => ')',
        46 => '*',
        47 => '+',
        48 => ',',
        49 => '-',
        50 => '.',
        51 => '/',
        52 => ':',
        53 => ';',
        54 => '<',
        55 => '=',
        56 => '>',
        57 => '?',
        58 => '@',
        59 => '[',
        60 => '\\',
        61 => ']',
        62 => '^',
        63 => '_',
        _ => ' ',
    }
}

fn parse_i040(data: &[u8]) -> AtcResult<(f64, f64)> {
    if data.len() < 4 {
        return Err(AtcError::InvalidDataItem {
            message: "I040需要4字节".to_string(),
        });
    }

    let raw_lat = u16::from_be_bytes([data[0], data[1]]) as i16 as f64;
    let raw_lon = u16::from_be_bytes([data[2], data[3]]) as i16 as f64;

    let lat = raw_lat * (180.0 / 32768.0);
    let lon = raw_lon * (180.0 / 32768.0);

    Ok((lat, lon))
}

fn parse_i042(data: &[u8]) -> AtcResult<(Option<f64>, Option<f64>)> {
    if data.len() < 2 {
        return Err(AtcError::InvalidDataItem {
            message: "I042需要2字节".to_string(),
        });
    }

    let mut lat: Option<f64> = None;
    let mut lon: Option<f64> = None;
    let mut offset = 1;

    if (data[0] & 0x80) != 0 {
        if offset + 2 > data.len() {
            return Err(AtcError::InvalidDataItem {
                message: "I042纬度数据不足".to_string(),
            });
        }
        let raw = u16::from_be_bytes([data[offset], data[offset + 1]]) as i16 as f64;
        lat = Some(raw * (180.0 / 32768.0));
        offset += 2;
    }

    if (data[0] & 0x40) != 0 {
        if offset + 2 > data.len() {
            return Err(AtcError::InvalidDataItem {
                message: "I042经度数据不足".to_string(),
            });
        }
        let raw = u16::from_be_bytes([data[offset], data[offset + 1]]) as i16 as f64;
        lon = Some(raw * (180.0 / 32768.0));
    }

    Ok((lat, lon))
}

fn parse_i090(data: &[u8]) -> AtcResult<f64> {
    if data.len() < 2 {
        return Err(AtcError::InvalidDataItem {
            message: "I090需要2字节".to_string(),
        });
    }

    let raw = u16::from_be_bytes([data[0], data[1]]) as i16;
    let flight_level = (raw as f64) * 0.25;

    Ok(flight_level)
}

fn parse_i161(data: &[u8]) -> AtcResult<u16> {
    if data.len() < 2 {
        return Err(AtcError::InvalidDataItem {
            message: "I161需要2字节".to_string(),
        });
    }

    let raw = u16::from_be_bytes([data[0], data[1]]);
    let track_num = raw & 0x0FFF;

    Ok(track_num)
}

fn parse_i200(data: &[u8]) -> AtcResult<(f64, f64, f64)> {
    if data.len() < 4 {
        return Err(AtcError::InvalidDataItem {
            message: "I200需要4字节".to_string(),
        });
    }

    let mut offset = 0;
    let mut ground_speed = 0.0;
    let mut vertical_speed = 0.0;
    let mut heading = 0.0;

    if (data[0] & 0x80) != 0 {
        offset += 1;
        let sp = (data[offset] as f64) * 1.852;
        ground_speed = sp;
        offset += 1;
    }

    if (data[0] & 0x40) != 0 {
        offset += 1;
        let raw = u16::from_be_bytes([data[offset], data[offset + 1]]) as i16;
        heading = (raw as f64) * (360.0 / 65536.0);
        offset += 2;
    }

    if (data[0] & 0x20) != 0 {
        if offset + 2 <= data.len() {
            let raw = u16::from_be_bytes([data[offset], data[offset + 1]]) as i16;
            vertical_speed = (raw as f64) * 0.5;
        }
    }

    Ok((ground_speed, vertical_speed, heading))
}

fn parse_i070(data: &[u8]) -> AtcResult<(bool, bool)> {
    if data.is_empty() {
        return Err(AtcError::InvalidDataItem {
            message: "I070需要1字节".to_string(),
        });
    }

    let alert = (data[0] & 0x80) != 0;
    let spi = (data[0] & 0x40) != 0;

    Ok((alert, spi))
}

pub fn parse_asterix_stream(data: &[u8]) -> AtcResult<Vec<TrackPoint>> {
    let decoder = AsterixDecoder::new();
    decoder.decode_stream(data)
}

pub fn decode_with_progress(
    data: &[u8],
    batch_size: usize,
) -> AtcResult<Vec<TrackPoint>> {
    let decoder = AsterixDecoder::new();
    let mut points = Vec::new();

    for chunk in data.chunks(batch_size) {
        let mut batch_points = decoder.decode_batch(chunk)?;
        points.append(&mut batch_points);
    }

    Ok(points)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_asterix_char() {
        assert_eq!(decode_asterix_char(0), 'A');
        assert_eq!(decode_asterix_char(25), 'Z');
        assert_eq!(decode_asterix_char(26), '0');
        assert_eq!(decode_asterix_char(35), '9');
        assert_eq!(decode_asterix_char(36), ' ');
    }

    #[test]
    fn test_parse_i240() {
        let data = [0x01, 0x02, 0x03];
        let icao = parse_i240(&data).unwrap();
        assert_eq!(icao, IcaoAddress::new([0x01, 0x02, 0x03]));
    }

    #[test]
    fn test_parse_i040() {
        let data = [0x40, 0x00, 0x50, 0x00];
        let (lat, lon) = parse_i040(&data).unwrap();
        assert!((lat - 90.0).abs() < 0.1);
        assert!((lon - 112.5).abs() < 0.1);
    }
}
