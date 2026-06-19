use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

/// 全局配置：管理 XML 解析规则、比对策略、输出格式与日志级别
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub parsing: ParsingSettings,
    #[serde(default)]
    pub comparison: ComparisonSettings,
    #[serde(default)]
    pub output: OutputSettings,
    #[serde(default)]
    pub graph: GraphSettings,
    #[serde(default)]
    pub log: LogSettings,
    /// 本配置文件的加载路径
    #[serde(skip)]
    pub source: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsingSettings {
    /// 输入文件编码，默认 utf-8
    pub encoding: String,
    /// 严格模式：遇异常直接报错而非降级
    pub strict: bool,
    /// 解析并发度
    pub concurrency: usize,
}

impl Default for ParsingSettings {
    fn default() -> Self {
        Self {
            encoding: "utf-8".to_string(),
            strict: false,
            concurrency: 8,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonSettings {
    /// 是否启用全面覆盖原则
    pub full_coverage: bool,
    /// 是否启用等同原则
    pub equivalence: bool,
    /// 关键词重合度阈值（0~1），高于此值判为等同
    pub equivalent_keyword_threshold: f64,
    /// 每条权利要求最多拆分特征数上限
    pub max_features_per_claim: usize,
}

impl Default for ComparisonSettings {
    fn default() -> Self {
        Self {
            full_coverage: true,
            equivalence: true,
            equivalent_keyword_threshold: 0.5,
            max_features_per_claim: 64,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputSettings {
    /// 默认输出格式：json | text
    pub format: String,
    /// 终端彩色输出
    pub color: bool,
    /// JSON 缩进空格数
    pub indent: usize,
}

impl Default for OutputSettings {
    fn default() -> Self {
        Self {
            format: "text".to_string(),
            color: true,
            indent: 2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphSettings {
    /// PageRank 阻尼系数
    pub damping: f64,
    /// PageRank 迭代次数
    pub iterations: usize,
    /// 核心节点 Top-N
    pub top_n: usize,
}

impl Default for GraphSettings {
    fn default() -> Self {
        Self {
            damping: 0.85,
            iterations: 100,
            top_n: 10,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogSettings {
    /// 日志级别：error/warn/info/debug/trace
    pub level: String,
}

impl Default for LogSettings {
    fn default() -> Self {
        Self {
            level: "warn".to_string(),
        }
    }
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            parsing: ParsingSettings::default(),
            comparison: ComparisonSettings::default(),
            output: OutputSettings::default(),
            graph: GraphSettings::default(),
            log: LogSettings::default(),
            source: None,
        }
    }
}

/// CLI 覆盖项：仅当对应字段为 Some 时覆盖配置文件
#[derive(Debug, Clone, Default)]
pub struct CliOverrides {
    pub format: Option<String>,
    pub color: Option<bool>,
    pub log_level: Option<String>,
    pub strict: Option<bool>,
    pub output_path: Option<PathBuf>,
}

impl Settings {
    pub fn default_toml() -> String {
        toml::to_string_pretty(&Settings::default()).unwrap_or_else(|_| String::new())
    }

    /// 从 TOML 文件加载；文件不存在时返回默认值并记录警告
    pub fn load_from_file(path: &Path) -> Result<Self> {
        if !path.exists() {
            log::warn!("配置文件不存在，使用默认配置: {}", path.display());
            let mut s = Settings::default();
            s.source = Some(path.to_path_buf());
            return Ok(s);
        }
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("读取配置文件失败: {}", path.display()))?;
        let mut settings: Settings = toml::from_str(&content)
            .with_context(|| format!("解析配置文件失败: {}", path.display()))?;
        settings.source = Some(path.to_path_buf());
        Ok(settings)
    }

    /// 合并策略：CLI 覆盖项优先于配置文件
    pub fn apply_overrides(&mut self, o: CliOverrides) {
        if let Some(fmt) = o.format {
            self.output.format = fmt;
        }
        if let Some(color) = o.color {
            self.output.color = color;
        }
        if let Some(level) = o.log_level {
            self.log.level = level;
        }
        if let Some(strict) = o.strict {
            self.parsing.strict = strict;
        }
    }

    pub fn log_level_filter(&self) -> log::LevelFilter {
        match self.log.level.to_ascii_lowercase().as_str() {
            "error" => log::LevelFilter::Error,
            "warn" => log::LevelFilter::Warn,
            "info" => log::LevelFilter::Info,
            "debug" => log::LevelFilter::Debug,
            "trace" => log::LevelFilter::Trace,
            _ => log::LevelFilter::Warn,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_roundtrip() {
        let s = Settings::default();
        let toml_str = toml::to_string(&s).unwrap();
        let back: Settings = toml::from_str(&toml_str).unwrap();
        assert_eq!(back.comparison.equivalent_keyword_threshold, 0.5);
        assert_eq!(back.output.format, "text");
    }

    #[test]
    fn overrides_take_priority() {
        let mut s = Settings::default();
        assert_eq!(s.output.format, "text");
        s.apply_overrides(CliOverrides {
            format: Some("json".into()),
            log_level: Some("debug".into()),
            ..Default::default()
        });
        assert_eq!(s.output.format, "json");
        assert_eq!(s.log.level, "debug");
        assert_eq!(s.log_level_filter(), log::LevelFilter::Debug);
    }

    #[test]
    fn missing_file_falls_back_to_default() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("nope.toml");
        let s = Settings::load_from_file(&path).unwrap();
        assert!(s.source.is_some());
    }
}
