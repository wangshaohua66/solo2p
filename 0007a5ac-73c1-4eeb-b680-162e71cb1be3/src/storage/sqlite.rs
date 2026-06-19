use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use std::path::Path;
use std::sync::Mutex;
use anyhow::{Result, Context};
use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};

use crate::parser::DnsLogEntry;

pub struct DnsDatabase {
    conn: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsRecord {
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    pub client_ip: String,
    pub query_domain: String,
    pub query_type: String,
    pub query_class: String,
    pub response_code: Option<String>,
    pub response_ip: Option<String>,
    pub is_response: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceResult {
    pub records: Vec<DnsRecord>,
    pub total_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainStats {
    pub domain: String,
    pub query_count: i64,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub node_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

impl DnsDatabase {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("无法创建数据库目录: {}", parent.display()))?;
        }

        let conn = Connection::open_with_flags(
            path,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
        ).with_context(|| format!("无法打开数据库: {}", path.display()))?;

        let db = DnsDatabase {
            conn: Mutex::new(conn),
        };
        db.init()?;
        Ok(db)
    }

    fn init(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS dns_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                client_ip TEXT NOT NULL,
                client_port INTEGER,
                query_domain TEXT NOT NULL,
                query_type TEXT NOT NULL,
                query_class TEXT NOT NULL,
                response_code TEXT,
                response_ip TEXT,
                server_ip TEXT,
                is_response INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_timestamp ON dns_logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_domain ON dns_logs(query_domain);
            CREATE INDEX IF NOT EXISTS idx_client_ip ON dns_logs(client_ip);
            CREATE INDEX IF NOT EXISTS idx_query_type ON dns_logs(query_type);
            CREATE INDEX IF NOT EXISTS idx_domain_time ON dns_logs(query_domain, timestamp);
            CREATE INDEX IF NOT EXISTS idx_ip_time ON dns_logs(client_ip, timestamp);

            CREATE TABLE IF NOT EXISTS threat_intel_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT NOT NULL UNIQUE,
                source TEXT NOT NULL,
                malicious INTEGER NOT NULL DEFAULT 0,
                details TEXT,
                first_seen INTEGER,
                last_updated INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_intel_domain ON threat_intel_cache(domain);
            CREATE INDEX IF NOT EXISTS idx_intel_updated ON threat_intel_cache(last_updated);

            CREATE TABLE IF NOT EXISTS whois_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT NOT NULL UNIQUE,
                registrar TEXT,
                registrant TEXT,
                creation_date INTEGER,
                expiration_date INTEGER,
                last_updated INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_whois_domain ON whois_cache(domain);

            CREATE TABLE IF NOT EXISTS import_state (
                file_path TEXT PRIMARY KEY,
                last_offset INTEGER NOT NULL DEFAULT 0,
                last_import_time INTEGER
            );
            "
        )?;

        Ok(())
    }

    pub fn insert_batch(&self, entries: &[DnsLogEntry]) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let tx = conn.unchecked_transaction()?;

        let mut stmt = tx.prepare(
            "INSERT INTO dns_logs (
                timestamp, client_ip, client_port, query_domain,
                query_type, query_class, response_code, response_ip,
                server_ip, is_response
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )?;

        let mut count = 0;
        for entry in entries {
            stmt.execute(params![
                entry.timestamp.timestamp(),
                entry.client_ip,
                entry.client_port,
                entry.query_domain,
                entry.query_type,
                entry.query_class,
                entry.response_code,
                entry.response_ip,
                entry.server_ip,
                entry.is_response as i32,
            ])?;
            count += 1;
        }

        drop(stmt);
        tx.commit()?;
        Ok(count)
    }

    pub fn query_by_domain(
        &self,
        domain: &str,
        time_start: Option<DateTime<Utc>>,
        time_end: Option<DateTime<Utc>>,
        limit: usize,
    ) -> Result<Vec<DnsRecord>> {
        let conn = self.conn.lock().unwrap();

        let mut sql = "SELECT id, timestamp, client_ip, query_domain, query_type, query_class, response_code, response_ip, is_response 
                       FROM dns_logs WHERE query_domain = ?".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(domain.to_string())];

        if let Some(start) = time_start {
            sql.push_str(" AND timestamp >= ?");
            params.push(Box::new(start.timestamp()));
        }
        if let Some(end) = time_end {
            sql.push_str(" AND timestamp <= ?");
            params.push(Box::new(end.timestamp()));
        }

        sql.push_str(" ORDER BY timestamp DESC LIMIT ?");
        params.push(Box::new(limit as i64));

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok(DnsRecord {
                id: row.get(0)?,
                timestamp: Utc.timestamp_opt(row.get::<_, i64>(1)?, 0).unwrap(),
                client_ip: row.get(2)?,
                query_domain: row.get(3)?,
                query_type: row.get(4)?,
                query_class: row.get(5)?,
                response_code: row.get(6)?,
                response_ip: row.get(7)?,
                is_response: row.get::<_, i32>(8)? != 0,
            })
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    pub fn query_by_ip(
        &self,
        ip: &str,
        time_start: Option<DateTime<Utc>>,
        time_end: Option<DateTime<Utc>>,
        limit: usize,
    ) -> Result<Vec<DnsRecord>> {
        let conn = self.conn.lock().unwrap();

        let mut sql = "SELECT id, timestamp, client_ip, query_domain, query_type, query_class, response_code, response_ip, is_response 
                       FROM dns_logs WHERE client_ip = ?".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(ip.to_string())];

        if let Some(start) = time_start {
            sql.push_str(" AND timestamp >= ?");
            params.push(Box::new(start.timestamp()));
        }
        if let Some(end) = time_end {
            sql.push_str(" AND timestamp <= ?");
            params.push(Box::new(end.timestamp()));
        }

        sql.push_str(" ORDER BY timestamp DESC LIMIT ?");
        params.push(Box::new(limit as i64));

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok(DnsRecord {
                id: row.get(0)?,
                timestamp: Utc.timestamp_opt(row.get::<_, i64>(1)?, 0).unwrap(),
                client_ip: row.get(2)?,
                query_domain: row.get(3)?,
                query_type: row.get(4)?,
                query_class: row.get(5)?,
                response_code: row.get(6)?,
                response_ip: row.get(7)?,
                is_response: row.get::<_, i32>(8)? != 0,
            })
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    pub fn get_domain_stats(
        &self,
        time_start: Option<DateTime<Utc>>,
        time_end: Option<DateTime<Utc>>,
        limit: usize,
    ) -> Result<Vec<DomainStats>> {
        let conn = self.conn.lock().unwrap();

        let mut sql = "SELECT query_domain, COUNT(*) as cnt, MIN(timestamp) as first, MAX(timestamp) as last
                       FROM dns_logs WHERE 1=1".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(start) = time_start {
            sql.push_str(" AND timestamp >= ?");
            params.push(Box::new(start.timestamp()));
        }
        if let Some(end) = time_end {
            sql.push_str(" AND timestamp <= ?");
            params.push(Box::new(end.timestamp()));
        }

        sql.push_str(" GROUP BY query_domain ORDER BY cnt DESC LIMIT ?");
        params.push(Box::new(limit as i64));

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok(DomainStats {
                domain: row.get(0)?,
                query_count: row.get(1)?,
                first_seen: Utc.timestamp_opt(row.get::<_, i64>(2)?, 0).unwrap(),
                last_seen: Utc.timestamp_opt(row.get::<_, i64>(3)?, 0).unwrap(),
            })
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    pub fn get_relation_graph(
        &self,
        domain: &str,
        time_start: Option<DateTime<Utc>>,
        time_end: Option<DateTime<Utc>>,
        depth: u32,
    ) -> Result<RelationGraph> {
        let conn = self.conn.lock().unwrap();
        let mut nodes = Vec::new();
        let mut edges = Vec::new();
        let mut visited_domains = std::collections::HashSet::new();

        let root_id = format!("domain:{}", domain);
        nodes.push(GraphNode {
            id: root_id.clone(),
            label: domain.to_string(),
            node_type: "domain".to_string(),
        });
        visited_domains.insert(domain.to_string());

        self.trace_graph_recursive(
            &conn,
            domain,
            &root_id,
            time_start,
            time_end,
            depth,
            &mut nodes,
            &mut edges,
            &mut visited_domains,
        )?;

        Ok(RelationGraph { nodes, edges })
    }

    fn trace_graph_recursive(
        &self,
        conn: &Connection,
        domain: &str,
        current_id: &str,
        time_start: Option<DateTime<Utc>>,
        time_end: Option<DateTime<Utc>>,
        depth: u32,
        nodes: &mut Vec<GraphNode>,
        edges: &mut Vec<GraphEdge>,
        visited: &mut std::collections::HashSet<String>,
    ) -> Result<()> {
        if depth == 0 {
            return Ok(());
        }

        let mut sql = "SELECT DISTINCT client_ip FROM dns_logs WHERE query_domain = ?".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(domain.to_string())];

        if let Some(start) = time_start {
            sql.push_str(" AND timestamp >= ?");
            params.push(Box::new(start.timestamp()));
        }
        if let Some(end) = time_end {
            sql.push_str(" AND timestamp <= ?");
            params.push(Box::new(end.timestamp()));
        }
        sql.push_str(" LIMIT 20");

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let ip_rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok(row.get::<_, String>(0)?)
        })?;

        let ips: Vec<String> = ip_rows.filter_map(|r| r.ok()).collect();

        for ip in &ips {
            let ip_id = format!("ip:{}", ip);
            nodes.push(GraphNode {
                id: ip_id.clone(),
                label: ip.clone(),
                node_type: "ip".to_string(),
            });
            edges.push(GraphEdge {
                source: current_id.to_string(),
                target: ip_id.clone(),
                label: Some("queried by".to_string()),
            });
        }

        if depth > 1 {
            for ip in &ips {
                let ip_id = format!("ip:{}", ip);
                let domain_sql = "SELECT DISTINCT query_domain FROM dns_logs WHERE client_ip = ? LIMIT 10";
                let mut d_stmt = conn.prepare(domain_sql)?;
                let domain_rows = d_stmt.query_map(params![ip], |row| {
                    Ok(row.get::<_, String>(0)?)
                })?;

                let related_domains: Vec<String> = domain_rows.filter_map(|r| r.ok()).collect();

                for rd in related_domains {
                    if visited.contains(&rd) {
                        continue;
                    }
                    visited.insert(rd.clone());
                    let rd_id = format!("domain:{}", rd);
                    nodes.push(GraphNode {
                        id: rd_id.clone(),
                        label: rd.clone(),
                        node_type: "domain".to_string(),
                    });
                    edges.push(GraphEdge {
                        source: ip_id.clone(),
                        target: rd_id.clone(),
                        label: Some("queries".to_string()),
                    });

                    self.trace_graph_recursive(
                        conn,
                        &rd,
                        &rd_id,
                        time_start,
                        time_end,
                        depth - 1,
                        nodes,
                        edges,
                        visited,
                    )?;
                }
            }
        }

        Ok(())
    }

    pub fn save_whois_cache(&self, domain: &str, whois: &WhoisRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO whois_cache 
             (domain, registrar, registrant, creation_date, expiration_date, last_updated)
             VALUES (?, ?, ?, ?, ?, ?)",
            params![
                domain,
                whois.registrar,
                whois.registrant,
                whois.creation_date.map(|d| d.timestamp()),
                whois.expiration_date.map(|d| d.timestamp()),
                Utc::now().timestamp(),
            ],
        )?;
        Ok(())
    }

    pub fn get_whois_cache(&self, domain: &str, max_age: Duration) -> Result<Option<WhoisRecord>> {
        let conn = self.conn.lock().unwrap();
        let cutoff = Utc::now() - max_age;

        let result = conn.query_row(
            "SELECT registrar, registrant, creation_date, expiration_date FROM whois_cache
             WHERE domain = ? AND last_updated >= ?",
            params![domain, cutoff.timestamp()],
            |row| {
                Ok(WhoisRecord {
                    registrar: row.get(0)?,
                    registrant: row.get(1)?,
                    creation_date: row.get::<_, Option<i64>>(2)?
                        .map(|ts| Utc.timestamp_opt(ts, 0).unwrap()),
                    expiration_date: row.get::<_, Option<i64>>(3)?
                        .map(|ts| Utc.timestamp_opt(ts, 0).unwrap()),
                    domain: domain.to_string(),
                })
            },
        ).optional()?;

        Ok(result)
    }

    pub fn clean_old_logs(&self, retention_days: u32) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let cutoff = Utc::now() - Duration::days(retention_days as i64);
        let count = conn.execute(
            "DELETE FROM dns_logs WHERE timestamp < ?",
            params![cutoff.timestamp()],
        )?;
        Ok(count)
    }

    pub fn get_total_count(&self) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM dns_logs",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn get_date_range(&self) -> Result<(Option<DateTime<Utc>>, Option<DateTime<Utc>>)> {
        let conn = self.conn.lock().unwrap();
        let result: Option<(i64, i64)> = conn.query_row(
            "SELECT MIN(timestamp), MAX(timestamp) FROM dns_logs",
            [],
            |row| {
                let min_ts: Option<i64> = row.get(0).ok();
                let max_ts: Option<i64> = row.get(1).ok();
                match (min_ts, max_ts) {
                    (Some(min), Some(max)) => Ok(Some((min, max))),
                    _ => Ok(None),
                }
            },
        ).optional()?.flatten();

        Ok(match result {
            Some((min, max)) => (
                Some(Utc.timestamp_opt(min, 0).unwrap()),
                Some(Utc.timestamp_opt(max, 0).unwrap()),
            ),
            None => (None, None),
        })
    }

    pub fn get_daily_trend(
        &self,
        days: u32,
    ) -> Result<Vec<(String, u64, u64)>> {
        use rusqlite::params;
        let conn = self.conn.lock().unwrap();
        let cutoff = Utc::now() - chrono::Duration::days(days as i64);
        let cutoff_ts = cutoff.timestamp();

        let sql = "
            SELECT
                date(timestamp, 'unixepoch', 'localtime') as day,
                COUNT(*) as total_queries,
                SUM(CASE WHEN query_type IN ('TXT') OR query_domain LIKE '%.%.%.%.com'
                    OR query_domain LIKE '%.%.%.%.net' OR query_domain LIKE '%.%.%.%.org'
                    OR length(query_domain) > 60 THEN 1 ELSE 0 END) as alerts
            FROM dns_logs
            WHERE timestamp >= ?
            GROUP BY day
            ORDER BY day ASC
        ";

        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(params![cutoff_ts], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)? as u64,
                row.get::<_, i64>(2)? as u64,
            ))
        })?;

        let mut results: Vec<(String, u64, u64)> = Vec::new();
        for row in rows {
            results.push(row?);
        }

        if results.is_empty() {
            let now = Utc::now();
            for i in (0..days).rev() {
                let date = now - chrono::Duration::days(i as i64);
                results.push((date.format("%Y-%m-%d").to_string(), 0, 0));
            }
        } else if results.len() < days as usize {
            let existing_days: std::collections::HashSet<String> = results
                .iter()
                .map(|(d, _, _)| d.clone())
                .collect();
            let now = Utc::now();
            for i in (0..days).rev() {
                let date = now - chrono::Duration::days(i as i64);
                let date_str = date.format("%Y-%m-%d").to_string();
                if !existing_days.contains(&date_str) {
                    results.push((date_str, 0, 0));
                }
            }
            results.sort_by(|a, b| a.0.cmp(&b.0));
        }

        Ok(results)
    }

    pub fn get_hourly_trend(
        &self,
        hours: u32,
    ) -> Result<Vec<(String, u64, u64)>> {
        use rusqlite::params;
        let conn = self.conn.lock().unwrap();
        let cutoff = Utc::now() - chrono::Duration::hours(hours as i64);
        let cutoff_ts = cutoff.timestamp();

        let sql = "
            SELECT
                strftime('%Y-%m-%d %H:00', timestamp, 'unixepoch', 'localtime') as hour,
                COUNT(*) as total_queries,
                SUM(CASE WHEN query_type IN ('TXT') OR length(query_domain) > 60 THEN 1 ELSE 0 END) as alerts
            FROM dns_logs
            WHERE timestamp >= ?
            GROUP BY hour
            ORDER BY hour ASC
        ";

        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(params![cutoff_ts], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)? as u64,
                row.get::<_, i64>(2)? as u64,
            ))
        })?;

        let mut results: Vec<(String, u64, u64)> = Vec::new();
        for row in rows {
            results.push(row?);
        }

        Ok(results)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhoisRecord {
    pub domain: String,
    pub registrar: Option<String>,
    pub registrant: Option<String>,
    pub creation_date: Option<DateTime<Utc>>,
    pub expiration_date: Option<DateTime<Utc>>,
}

impl WhoisRecord {
    pub fn age_days(&self) -> Option<i64> {
        self.creation_date.map(|d| (Utc::now() - d).num_days())
    }

    pub fn is_new_domain(&self, threshold_days: i64) -> bool {
        self.age_days().map(|age| age < threshold_days).unwrap_or(false)
    }
}
