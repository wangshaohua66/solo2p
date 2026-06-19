use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use anyhow::{Result, Context};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub threat_intel: ThreatIntelConfig,
    pub detection: DetectionConfig,
    pub storage: StorageConfig,
    pub monitoring: MonitoringConfig,
    pub whitelist: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatIntelConfig {
    pub virustotal_api_key: Option<String>,
    pub alienvault_api_key: Option<String>,
    pub threatbook_api_key: Option<String>,
    pub cache_ttl_seconds: u64,
    pub refresh_interval_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionConfig {
    pub txt_entropy_threshold: f64,
    pub query_frequency_threshold: u64,
    pub subdomain_length_threshold: usize,
    pub subdomain_entropy_threshold: f64,
    pub high_risk_score: u8,
    pub medium_risk_score: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub database_path: PathBuf,
    pub log_retention_days: u32,
    pub import_offset_file: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub watch_directory: PathBuf,
    pub alert_script: Option<PathBuf>,
    pub check_interval_seconds: u64,
}

impl Default for Config {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let config_dir = home.join(".dns-sec");

        Config {
            threat_intel: ThreatIntelConfig {
                virustotal_api_key: None,
                alienvault_api_key: None,
                threatbook_api_key: None,
                cache_ttl_seconds: 86400,
                refresh_interval_seconds: 3600,
            },
            detection: DetectionConfig {
                txt_entropy_threshold: 3.5,
                query_frequency_threshold: 100,
                subdomain_length_threshold: 30,
                subdomain_entropy_threshold: 4.0,
                high_risk_score: 70,
                medium_risk_score: 40,
            },
            storage: StorageConfig {
                database_path: config_dir.join("dns_logs.db"),
                log_retention_days: 90,
                import_offset_file: config_dir.join("import_offsets.json"),
            },
            monitoring: MonitoringConfig {
                watch_directory: PathBuf::from("/var/log/dns"),
                alert_script: None,
                check_interval_seconds: 10,
            },
            whitelist: vec![
                "localhost".to_string(),
                "google.com".to_string(),
                "baidu.com".to_string(),
            ],
        }
    }
}

impl Config {
    pub fn config_dir() -> PathBuf {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        home.join(".dns-sec")
    }

    pub fn config_path() -> PathBuf {
        Self::config_dir().join("config.toml")
    }

    pub fn load() -> Result<Self> {
        let path = Self::config_path();
        if path.exists() {
            Self::load_from(&path)
        } else {
            let config = Self::default();
            Ok(config)
        }
    }

    pub fn load_from(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read config file: {}", path.display()))?;
        let config: Config = toml::from_str(&content)
            .with_context(|| format!("Failed to parse config file: {}", path.display()))?;
        Ok(config)
    }

    pub fn save(&self) -> Result<()> {
        let config_dir = Self::config_dir();
        std::fs::create_dir_all(&config_dir)
            .with_context(|| format!("Failed to create config directory: {}", config_dir.display()))?;
        let path = Self::config_path();
        let content = toml::to_string_pretty(self)?;
        std::fs::write(&path, content)
            .with_context(|| format!("Failed to write config file: {}", path.display()))?;
        Ok(())
    }

    pub fn save_to(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = toml::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }

    pub fn is_whitelisted(&self, domain: &str) -> bool {
        let domain_lower = domain.to_lowercase();
        self.whitelist.iter().any(|w| {
            let w_lower = w.to_lowercase();
            domain_lower == w_lower || domain_lower.ends_with(&format!(".{}", w_lower))
        })
    }
}
