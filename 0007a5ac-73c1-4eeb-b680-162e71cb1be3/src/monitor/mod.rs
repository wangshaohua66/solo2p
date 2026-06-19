use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use anyhow::{Result, Context};
use chrono::Utc;
use walkdir::WalkDir;
use tokio::process::Command;
use indicatif::{ProgressBar, ProgressStyle};

use crate::config::Config;
use crate::parser::{LogParser, LogFormatType};
use crate::analyzer::tunnel::{TunnelDetector, TunnelDetectionResult};
use crate::storage::sqlite::DnsDatabase;
use crate::utils::memory::MemoryGuard;

#[derive(Debug, Clone)]
pub struct MonitorAlert {
    pub domain: String,
    pub risk_score: u8,
    pub risk_level: String,
    pub client_ip: String,
    pub timestamp: chrono::DateTime<Utc>,
    pub reasons: Vec<String>,
    pub file_path: PathBuf,
}

pub struct DnsMonitor {
    config: Config,
    watch_directory: PathBuf,
    alert_script: Option<PathBuf>,
    check_interval: Duration,
    alert_threshold: u8,
    processed_files: HashSet<PathBuf>,
    db: Arc<DnsDatabase>,
}

impl DnsMonitor {
    pub fn new(
        config: Config,
        watch_directory: PathBuf,
        alert_script: Option<PathBuf>,
        check_interval_seconds: u64,
        alert_threshold: u8,
    ) -> Result<Self> {
        if !watch_directory.exists() {
            std::fs::create_dir_all(&watch_directory)
                .with_context(|| format!("无法创建监控目录: {}", watch_directory.display()))?;
        }

        let db = Arc::new(DnsDatabase::open(&config.storage.database_path)?);

        Ok(DnsMonitor {
            config,
            watch_directory,
            alert_script,
            check_interval: Duration::from_secs(check_interval_seconds),
            alert_threshold,
            processed_files: HashSet::new(),
            db,
        })
    }

    pub async fn run(&mut self) -> Result<()> {
        print_startup_banner(
            &self.watch_directory,
            self.check_interval,
            self.alert_threshold,
        );

        let memory_guard = MemoryGuard::global();

        let parser = LogParser::new(
            LogFormatType::Unknown,
            self.config.storage.import_offset_file.clone(),
        );

        let detector = TunnelDetector::new(self.config.detection.clone());

        loop {
            if memory_guard.usage_percent() > 90.0 {
                eprintln!("[警告] 内存使用过高 ({:.1}%)，触发清理...", memory_guard.usage_percent());
                memory_guard.check_and_cleanup_if_needed(85.0);
            }

            match self.check_and_process_files(&parser, &detector).await {
                Ok(alerts) => {
                    if !alerts.is_empty() {
                        self.handle_alerts(&alerts).await?;
                    }
                }
                Err(e) => {
                    eprintln!("[错误] 处理文件时出错: {}", e);
                }
            }

            if let Err(e) = parser.save_offsets() {
                eprintln!("[警告] 保存偏移量失败: {}", e);
            }

            tokio::time::sleep(self.check_interval).await;
        }
    }

    async fn check_and_process_files(
        &mut self,
        parser: &LogParser,
        detector: &TunnelDetector,
    ) -> Result<Vec<MonitorAlert>> {
        let new_files = self.discover_new_files();

        if new_files.is_empty() {
            return Ok(Vec::new());
        }

        println!(
            "[{}] 发现 {} 个新日志文件待处理",
            Utc::now().format("%H:%M:%S"),
            new_files.len()
        );

        let pb = ProgressBar::new(new_files.len() as u64);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:30.cyan/blue}] {pos}/{len} {msg}")
                .unwrap()
                .progress_chars("##-"),
        );

        let mut all_alerts = Vec::new();

        for file_path in &new_files {
            pb.set_message(file_path.display().to_string());

            let db_clone = Arc::clone(&self.db);
            let threshold = self.alert_threshold;

            match parser.parse_file_streaming(
                file_path,
                true,
                5000,
                move |batch| {
                    db_clone.insert_batch(&batch)?;
                    Ok(())
                },
            ) {
                Ok((count, _offset)) => {
                    if count > 0 {
                        let (entries, _) = parser.parse_file(file_path, false)?;
                        let results = detector.analyze_entries(&entries);
                        let high_risk: Vec<TunnelDetectionResult> = results
                            .into_iter()
                            .filter(|r| r.risk_score >= threshold)
                            .collect();

                        for result in high_risk {
                            let alert = MonitorAlert {
                                domain: result.domain.clone(),
                                risk_score: result.risk_score,
                                risk_level: result.risk_level.to_string().to_string(),
                                client_ip: entries
                                    .iter()
                                    .find(|e| e.query_domain == result.domain)
                                    .map(|e| e.client_ip.clone())
                                    .unwrap_or_default(),
                                timestamp: Utc::now(),
                                reasons: result.detection_reasons.clone(),
                                file_path: file_path.clone(),
                            };
                            all_alerts.push(alert);
                        }
                    }
                    self.processed_files.insert(file_path.clone());
                }
                Err(e) => {
                    eprintln!("[错误] 处理文件 {} 失败: {}", file_path.display(), e);
                }
            }

            pb.inc(1);
        }

        pb.finish_and_clear();

        Ok(all_alerts)
    }

    fn discover_new_files(&self) -> Vec<PathBuf> {
        let mut new_files = Vec::new();
        let extensions = [".log", ".txt", ".dns"];

        for entry in WalkDir::new(&self.watch_directory).max_depth(2) {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            if !entry.file_type().is_file() {
                continue;
            }

            let path = entry.path().to_path_buf();

            let has_valid_ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| extensions.iter().any(|ext| e.eq_ignore_ascii_case(ext.trim_start_matches('.'))))
                .unwrap_or(false);

            if !has_valid_ext {
                if let Some(_) = path.file_name() {
                    // 尝试识别无扩展名的日志文件
                } else {
                    continue;
                }
            }

            if self.processed_files.contains(&path) {
                continue;
            }

            new_files.push(path);
        }

        new_files.sort();
        new_files
    }

    async fn handle_alerts(&self, alerts: &[MonitorAlert]) -> Result<()> {
        for alert in alerts {
            print_alert(alert);

            if let Some(ref script) = self.alert_script {
                if let Err(e) = self.execute_alert_script(script, alert).await {
                    eprintln!("[警告] 执行告警脚本失败: {}", e);
                }
            }
        }

        Ok(())
    }

    async fn execute_alert_script(
        &self,
        script: &Path,
        alert: &MonitorAlert,
    ) -> Result<()> {
        if !script.exists() {
            return Err(anyhow::anyhow!("告警脚本不存在: {}", script.display()));
        }

        let output = Command::new(script)
            .arg(&alert.domain)
            .arg(alert.risk_score.to_string())
            .arg(&alert.risk_level)
            .arg(&alert.client_ip)
            .arg(alert.file_path.to_string_lossy().to_string())
            .output()
            .await
            .with_context(|| format!("执行告警脚本失败: {}", script.display()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            eprintln!("[警告] 告警脚本执行错误: {}", stderr.trim());
        }

        Ok(())
    }
}

fn print_startup_banner(dir: &Path, interval: Duration, threshold: u8) {
    println!();
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║            DNS安全实时监控系统 已启动                         ║");
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!("║ 监控目录:      {:<45}║", dir.display());
    println!("║ 检查间隔:      {:<45}║", format!("{:?}", interval));
    println!("║ 告警阈值:      {:<45}║", format!("评分 >= {}", threshold));
    println!("║ 启动时间:      {:<45}║", Utc::now().format("%Y-%m-%d %H:%M:%S").to_string());
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!();
    println!("[提示] 按 Ctrl+C 停止监控");
    println!();
}

fn print_alert(alert: &MonitorAlert) {
    use termcolor::{Color, ColorChoice, ColorSpec, StandardStream, WriteColor};
    use std::io::Write;

    let mut stdout = StandardStream::stdout(ColorChoice::Auto);

    let timestamp = alert.timestamp.format("%Y-%m-%d %H:%M:%S");

    let color = if alert.risk_score >= 80 {
        Color::Red
    } else if alert.risk_score >= 60 {
        Color::Yellow
    } else {
        Color::Cyan
    };

    stdout.set_color(
        ColorSpec::new()
            .set_fg(Some(color))
            .set_bold(true),
    ).unwrap();
    write!(&mut stdout, "[告警 {}]", timestamp).unwrap();

    stdout.set_color(
        ColorSpec::new()
            .set_fg(Some(Color::Red))
            .set_bold(true),
    ).unwrap();
    write!(&mut stdout, "[{}分]", alert.risk_score).unwrap();

    stdout.reset().unwrap();

    writeln!(
        &mut stdout,
        " 域名: {} (级别:{}) | 来源IP: {} | 文件: {}",
        alert.domain,
        alert.risk_level,
        alert.client_ip,
        alert.file_path.display()
    ).unwrap();

    for reason in &alert.reasons {
        writeln!(&mut stdout, "         原因: {}", reason).unwrap();
    }

    writeln!(&mut stdout).unwrap();
}

pub fn confirm_high_risk_operation(message: &str) -> Result<bool> {
    use dialoguer::Confirm;

    println!();
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("⚠️  高风险操作确认");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("{}", message);
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let confirmed = Confirm::new()
        .with_prompt("确认执行此操作?")
        .default(false)
        .interact()
        .unwrap_or(false);

    if !confirmed {
        println!("操作已取消。");
    }

    Ok(confirmed)
}

pub fn confirm_delete(message: &str, items_count: usize) -> Result<bool> {
    use dialoguer::Confirm;

    println!();
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("⚠️  删除确认");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("{}", message);
    println!("将删除 {} 条记录。", items_count);
    println!("此操作不可撤销！");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let confirmed = Confirm::new()
        .with_prompt("确认删除?")
        .default(false)
        .interact()
        .unwrap_or(false);

    Ok(confirmed)
}

pub fn select_domains(domains: &[String]) -> Result<Vec<String>> {
    use dialoguer::MultiSelect;

    if domains.is_empty() {
        return Ok(Vec::new());
    }

    let selections = MultiSelect::new()
        .with_prompt("选择域名（空格选择，Enter确认）")
        .items(domains)
        .interact()
        .unwrap_or_default();

    let selected: Vec<String> = selections
        .into_iter()
        .map(|i| domains[i].clone())
        .collect();

    Ok(selected)
}
