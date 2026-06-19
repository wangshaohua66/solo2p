use std::path::{Path, PathBuf};
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, NaiveDateTime, TimeZone};
use anyhow::{Result, anyhow, Context};
use regex::Regex;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsLogEntry {
    pub timestamp: DateTime<Utc>,
    pub client_ip: String,
    pub client_port: Option<u16>,
    pub query_domain: String,
    pub query_type: String,
    pub query_class: String,
    pub response_code: Option<String>,
    pub response_ip: Option<String>,
    pub server_ip: Option<String>,
    pub is_response: bool,
    pub raw_line: String,
}

#[derive(Debug, Clone, PartialEq, Copy)]
pub enum LogFormatType {
    Bind,
    Unbound,
    Windows,
    Unknown,
}

pub struct LogParser {
    format: LogFormatType,
    offsets: Mutex<HashMap<PathBuf, u64>>,
    offset_file: PathBuf,
}

impl LogParser {
    pub fn new(format: LogFormatType, offset_file: PathBuf) -> Self {
        let offsets = Self::load_offsets(&offset_file).unwrap_or_default();
        LogParser {
            format,
            offsets: Mutex::new(offsets),
            offset_file,
        }
    }

    pub fn detect_format(file_path: &Path) -> Result<LogFormatType> {
        let file = File::open(file_path)
            .with_context(|| format!("无法打开文件: {}", file_path.display()))?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines().take(100);

        let bind_re = Regex::new(r"^\d{2}-[A-Z][a-z]{2}-\d{4}\s+\d{2}:\d{2}:\d{2}\.\d{3}").unwrap();
        let unbound_re = Regex::new(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}").unwrap();
        let windows_re = Regex::new(r"^\d{2}/\d{2}/\d{4},\d{2}:\d{2}:\d{2}").unwrap();

        while let Some(Ok(line)) = lines.next() {
            if bind_re.is_match(&line) {
                return Ok(LogFormatType::Bind);
            }
            if unbound_re.is_match(&line) {
                return Ok(LogFormatType::Unbound);
            }
            if windows_re.is_match(&line) {
                return Ok(LogFormatType::Windows);
            }
        }

        Ok(LogFormatType::Unknown)
    }

    fn load_offsets(path: &Path) -> Result<HashMap<PathBuf, u64>> {
        if path.exists() {
            let content = std::fs::read_to_string(path)?;
            let map: HashMap<String, u64> = serde_json::from_str(&content)?;
            Ok(map.into_iter().map(|(k, v)| (PathBuf::from(k), v)).collect())
        } else {
            Ok(HashMap::new())
        }
    }

    pub fn save_offsets(&self) -> Result<()> {
        if let Some(parent) = self.offset_file.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let offsets = self.offsets.lock().unwrap();
        let map: HashMap<String, u64> = offsets
            .iter()
            .map(|(k, v)| (k.to_string_lossy().to_string(), *v))
            .collect();
        let content = serde_json::to_string_pretty(&map)?;
        std::fs::write(&self.offset_file, content)?;
        Ok(())
    }

    pub fn parse_file(
        &self,
        file_path: &Path,
        incremental: bool,
    ) -> Result<(Vec<DnsLogEntry>, u64)> {
        let format = if self.format == LogFormatType::Unknown {
            Self::detect_format(file_path)?
        } else {
            self.format
        };

        if format == LogFormatType::Unknown {
            return Err(anyhow!("无法识别日志格式: {}", file_path.display()));
        }

        let file = File::open(file_path)?;
        let mut reader = BufReader::new(file);

        let start_offset = if incremental {
            *self.offsets.lock().unwrap().get(file_path).unwrap_or(&0)
        } else {
            0
        };

        reader.seek(SeekFrom::Start(start_offset))?;

        let mut entries = Vec::new();
        let mut bytes_read = 0u64;
        let mut line_buf = String::new();

        loop {
            line_buf.clear();
            let n = reader.read_line(&mut line_buf)?;
            if n == 0 {
                break;
            }
            bytes_read += n as u64;

            let line = line_buf.trim_end();
            if line.is_empty() {
                continue;
            }

            match self.parse_line(line, format) {
                Ok(entry) => entries.push(entry),
                Err(_) => continue,
            }
        }

        let final_offset = start_offset + bytes_read;
        if incremental {
            self.offsets
                .lock()
                .unwrap()
                .insert(file_path.to_path_buf(), final_offset);
        }

        Ok((entries, final_offset))
    }

    pub fn parse_file_streaming<F>(
        &self,
        file_path: &Path,
        incremental: bool,
        batch_size: usize,
        mut callback: F,
    ) -> Result<(u64, u64)>
    where
        F: FnMut(Vec<DnsLogEntry>) -> Result<()>,
    {
        let format = if self.format == LogFormatType::Unknown {
            Self::detect_format(file_path)?
        } else {
            self.format
        };

        if format == LogFormatType::Unknown {
            return Err(anyhow!("无法识别日志格式: {}", file_path.display()));
        }

        let file = File::open(file_path)?;
        let mut reader = BufReader::new(file);

        let start_offset = if incremental {
            *self.offsets.lock().unwrap().get(file_path).unwrap_or(&0)
        } else {
            0
        };

        reader.seek(SeekFrom::Start(start_offset))?;

        let mut batch = Vec::with_capacity(batch_size);
        let mut total_records = 0u64;
        let mut bytes_read = 0u64;
        let mut line_buf = String::new();

        loop {
            line_buf.clear();
            let n = reader.read_line(&mut line_buf)?;
            if n == 0 {
                break;
            }
            bytes_read += n as u64;

            let line = line_buf.trim_end();
            if line.is_empty() {
                continue;
            }

            if let Ok(entry) = self.parse_line(line, format) {
                batch.push(entry);
                total_records += 1;

                if batch.len() >= batch_size {
                    callback(std::mem::take(&mut batch))?;
                    batch = Vec::with_capacity(batch_size);
                }
            }
        }

        if !batch.is_empty() {
            callback(batch)?;
        }

        let final_offset = start_offset + bytes_read;
        if incremental {
            self.offsets
                .lock()
                .unwrap()
                .insert(file_path.to_path_buf(), final_offset);
        }

        Ok((total_records, final_offset))
    }

    fn parse_line(&self, line: &str, format: LogFormatType) -> Result<DnsLogEntry> {
        match format {
            LogFormatType::Bind => Self::parse_bind_line(line),
            LogFormatType::Unbound => Self::parse_unbound_line(line),
            LogFormatType::Windows => Self::parse_windows_line(line),
            LogFormatType::Unknown => Err(anyhow!("未知日志格式")),
        }
    }

    fn parse_bind_line(line: &str) -> Result<DnsLogEntry> {
        let re = Regex::new(
            r"^(\d{2}-[A-Z][a-z]{2}-\d{4}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\S+)\s+query:\s+(\S+)\s+(\S+)\s+(\S+)"
        ).unwrap();

        let caps = re.captures(line)
            .ok_or_else(|| anyhow!("BIND日志格式不匹配: {}", line))?;

        let time_str = &caps[1];
        let client = &caps[2];
        let domain = &caps[3];
        let class = &caps[4];
        let qtype = &caps[5];

        let naive = NaiveDateTime::parse_from_str(time_str, "%d-%b-%Y %H:%M:%S%.3f")
            .map_err(|e| anyhow!("时间解析失败: {} - {}", time_str, e))?;
        let timestamp = Utc.from_utc_datetime(&naive);

        let (client_ip, client_port) = if let Some(port_pos) = client.rfind('#') {
            let ip = &client[..port_pos];
            let port = client[port_pos + 1..].parse::<u16>().ok();
            (ip.to_string(), port)
        } else {
            (client.to_string(), None)
        };

        Ok(DnsLogEntry {
            timestamp,
            client_ip,
            client_port,
            query_domain: domain.to_lowercase(),
            query_type: qtype.to_uppercase(),
            query_class: class.to_uppercase(),
            response_code: None,
            response_ip: None,
            server_ip: None,
            is_response: false,
            raw_line: line.to_string(),
        })
    }

    fn parse_unbound_line(line: &str) -> Result<DnsLogEntry> {
        let re = Regex::new(
            r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^ ]*)\s+\S+\s+query:\s+info:\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)"
        ).unwrap();

        if let Some(caps) = re.captures(line) {
            let time_str = &caps[1];
            let client = &caps[2];
            let domain = &caps[3];
            let qtype = &caps[4];
            let class = &caps[5];

            let timestamp: DateTime<Utc> = time_str.parse()
                .map_err(|e| anyhow!("时间解析失败: {} - {}", time_str, e))?;

            let (client_ip, client_port) = if let Some(port_pos) = client.rfind('@') {
                let ip = &client[..port_pos];
                let port = client[port_pos + 1..].parse::<u16>().ok();
                (ip.to_string(), port)
            } else {
                (client.to_string(), None)
            };

            return Ok(DnsLogEntry {
                timestamp,
                client_ip,
                client_port,
                query_domain: domain.to_lowercase(),
                query_type: qtype.to_uppercase(),
                query_class: class.to_uppercase(),
                response_code: None,
                response_ip: None,
                server_ip: None,
                is_response: false,
                raw_line: line.to_string(),
            });
        }

        let re_resp = Regex::new(
            r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^ ]*)\s+\S+\s+reply:\s+info:\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)"
        ).unwrap();

        if let Some(caps) = re_resp.captures(line) {
            let time_str = &caps[1];
            let client = &caps[2];
            let domain = &caps[3];
            let qtype = &caps[4];
            let class = &caps[5];
            let rcode = &caps[6];

            let timestamp: DateTime<Utc> = time_str.parse()
                .map_err(|e| anyhow!("时间解析失败: {} - {}", time_str, e))?;

            let (client_ip, client_port) = if let Some(port_pos) = client.rfind('@') {
                let ip = &client[..port_pos];
                let port = client[port_pos + 1..].parse::<u16>().ok();
                (ip.to_string(), port)
            } else {
                (client.to_string(), None)
            };

            return Ok(DnsLogEntry {
                timestamp,
                client_ip,
                client_port,
                query_domain: domain.to_lowercase(),
                query_type: qtype.to_uppercase(),
                query_class: class.to_uppercase(),
                response_code: Some(rcode.to_string()),
                response_ip: None,
                server_ip: None,
                is_response: true,
                raw_line: line.to_string(),
            });
        }

        Err(anyhow!("Unbound日志格式不匹配: {}", line))
    }

    fn parse_windows_line(line: &str) -> Result<DnsLogEntry> {
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() < 8 {
            return Err(anyhow!("Windows DNS日志字段不足: {}", line));
        }

        let date_str = parts[0];
        let time_str = parts[1];
        let datetime_str = format!("{} {}", date_str, time_str);

        let naive = NaiveDateTime::parse_from_str(&datetime_str, "%m/%d/%Y %H:%M:%S")
            .map_err(|e| anyhow!("时间解析失败: {} - {}", datetime_str, e))?;
        let timestamp = Utc.from_utc_datetime(&naive);

        let client_ip = parts.get(3).map(|s| s.to_string()).unwrap_or_default();
        let query_type = parts.get(4).map(|s| s.to_string()).unwrap_or_default();
        let query_domain = parts.get(5).map(|s| s.to_lowercase()).unwrap_or_default();
        let query_class = parts.get(6).map(|s| s.to_string()).unwrap_or("IN".to_string());
        let response_code = parts.get(7).map(|s| s.to_string());

        Ok(DnsLogEntry {
            timestamp,
            client_ip,
            client_port: None,
            query_domain,
            query_type: query_type.to_uppercase(),
            query_class,
            response_code,
            response_ip: None,
            server_ip: None,
            is_response: response_code.is_some(),
            raw_line: line.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_bind_line() {
        let line = "19-Jan-2024 10:30:45.123 192.168.1.100#5321 query: example.com IN A";
        let entry = LogParser::parse_bind_line(line).unwrap();
        assert_eq!(entry.query_domain, "example.com");
        assert_eq!(entry.query_type, "A");
        assert_eq!(entry.client_ip, "192.168.1.100");
        assert_eq!(entry.client_port, Some(5321));
    }

    #[test]
    fn test_parse_unbound_line() {
        let line = "2024-01-19T10:30:45.123Z unbound query: info: 192.168.1.100@5321 example.com A IN";
        let entry = LogParser::parse_unbound_line(line).unwrap();
        assert_eq!(entry.query_domain, "example.com");
        assert_eq!(entry.query_type, "A");
    }

    #[test]
    fn test_format_type_debug() {
        let f = LogFormatType::Bind;
        assert_eq!(format!("{:?}", f), "Bind");
    }
}
