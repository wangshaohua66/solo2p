use crate::error::AtcResult;
use std::path::Path;

pub fn generate_man_page(section: u8) -> String {
    let mut man = String::new();

    man.push_str(&format!(".TH ATC-ANALYZER {} \"{}\" \"atc-analyzer 1.0.0\" \"用户命令\"\n",
        section,
        chrono::Local::now().format("%Y-%m-%d")
    ));
    man.push_str(".SH 名称\n");
    man.push_str("atc-analyzer \\- 民航空管多雷达数据融合与分析系统\n");
    man.push_str(".SH 概要\n");
    man.push_str(".B atc-analyzer\n");
    man.push_str("[\\fI全局选项\\fR] \\fI子命令\\fR [\\fI子命令选项\\fR]\n");
    man.push_str(".SH 描述\n");
    man.push_str(".B atc-analyzer\n");
    man.push_str("是一个用于民航空管中心的 ASTerix Cat048 多雷达数据处理工具。\n");
    man.push_str("支持二进制报文解码、多雷达轨迹融合、飞行冲突检测、流量统计与轨迹查询。\n");
    man.push_str("设计处理能力为单核每秒 5000 条以上轨迹记录，支持 GB 级大文件流式处理。\n");

    man.push_str(".SH 全局选项\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-c, --config\\fR <FILE>\n");
    man.push_str("指定 TOML 格式的配置文件路径。配置包含雷达站坐标、安全阈值、输出路径等参数。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--log-level\\fR <LEVEL>\n");
    man.push_str("设置日志级别: trace, debug, info, warn, error。默认: info。\n");
    man.push_str("可通过环境变量 ATC_LOG_LEVEL 覆盖。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-q, --quiet\\fR\n");
    man.push_str("静默模式，不输出进度信息，适用于管道调用场景。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--json\\fR\n");
    man.push_str("以 JSON 格式输出结果，便于机器读取与后续处理。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-h, --help\\fR\n");
    man.push_str("显示帮助信息。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-V, --version\\fR\n");
    man.push_str("显示版本号。\n");

    man.push_str(".SH 子命令\n");

    man.push_str(".SS decode\n");
    man.push_str("解码 ASTerix Cat048 二进制报文为结构化轨迹点。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-i, --input\\fR <FILE>\n");
    man.push_str("输入二进制文件路径，省略则从标准输入读取。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-o, --output\\fR <FILE>\n");
    man.push_str("输出文件路径，省略则输出到标准输出。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-f, --format\\fR <FORMAT>\n");
    man.push_str("输出格式: json, csv, text。默认: text。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--no-checksum\\fR\n");
    man.push_str("跳过 CRC16 校验和验证。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--radar-id\\fR <ID>\n");
    man.push_str("指定雷达站 ID，覆盖解码结果中的雷达标识。\n");

    man.push_str(".SS fuse\n");
    man.push_str("多雷达轨迹数据融合，进行时空对齐与加权融合。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-i, --input\\fR <FILE>\n");
    man.push_str("输入文件路径，可重复指定多个雷达数据源。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-o, --output\\fR <FILE>\n");
    man.push_str("输出文件路径。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-f, --format\\fR <FORMAT>\n");
    man.push_str("输出格式: json, csv, text。默认: text。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--batch-size\\fR <SIZE>\n");
    man.push_str("批处理大小。默认: 1000。\n");

    man.push_str(".SS alert\n");
    man.push_str("飞行冲突检测与告警，基于 CPA (最近相遇点) 算法计算冲突。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-i, --input\\fR <FILE>\n");
    man.push_str("融合轨迹数据文件 (JSON 格式)。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-o, --output\\fR <FILE>\n");
    man.push_str("告警输出文件路径。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-f, --format\\fR <FORMAT>\n");
    man.push_str("输出格式: json, csv, text。默认: text。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--horizontal\\fR <METERS>\n");
    man.push_str("水平安全间隔 (米)。默认: 5000。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--vertical\\fR <METERS>\n");
    man.push_str("垂直安全间隔 (米)。默认: 300。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--lookahead\\fR <SECONDS>\n");
    man.push_str("预测时间窗口 (秒)。默认: 120。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--warning-factor\\fR <FACTOR>\n");
    man.push_str("警告阈值因子。默认: 1.5。\n");

    man.push_str(".SS stats\n");
    man.push_str("流量统计与报表生成，支持累积与滑动窗口两种模式。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-i, --input\\fR <FILE>\n");
    man.push_str("融合轨迹数据文件 (JSON 格式)。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-o, --output\\fR <FILE>\n");
    man.push_str("统计报表输出路径。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-f, --format\\fR <FORMAT>\n");
    man.push_str("输出格式: json, csv, text。默认: text。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--mode\\fR <MODE>\n");
    man.push_str("统计模式: cumulative, sliding。默认: cumulative。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--time-start\\fR <DATETIME>\n");
    man.push_str("统计开始时间 (RFC3339 格式)。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--time-end\\fR <DATETIME>\n");
    man.push_str("统计结束时间 (RFC3339 格式)。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--window\\fR <DURATION>\n");
    man.push_str("滑动窗口大小 (如: 15m, 1h)。默认: 15m。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--slide\\fR <DURATION>\n");
    man.push_str("滑动间隔 (如: 5m, 30s)。默认: 5m。\n");

    man.push_str(".SS query\n");
    man.push_str("轨迹数据查询与筛选，支持时间范围、呼号、ICAO 地址和扇区编号过滤。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-i, --input\\fR <FILE>\n");
    man.push_str("融合轨迹数据文件 (JSON 格式)。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-o, --output\\fR <FILE>\n");
    man.push_str("查询结果输出路径。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB-f, --format\\fR <FORMAT>\n");
    man.push_str("输出格式: json, csv, text。默认: text。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--time-start\\fR <DATETIME>\n");
    man.push_str("开始时间 (RFC3339 格式)。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--time-end\\fR <DATETIME>\n");
    man.push_str("结束时间 (RFC3339 格式)。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--callsign\\fR <PATTERN>\n");
    man.push_str("呼号正则匹配模式。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--icao\\fR <PATTERN>\n");
    man.push_str("ICAO 地址正则匹配模式。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--sector\\fR <ID>\n");
    man.push_str("扇区编号精确匹配 (如: SECTOR01)。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB--sector-range\\fR <START-END>\n");
    man.push_str("扇区编号范围查询 (如: 1-3 匹配 SECTOR01 至 SECTOR03)。\n");

    man.push_str(".SH 示例\n");
    man.push_str(".TP\n");
    man.push_str("解码二进制报文:\n");
    man.push_str("atc-analyzer decode -i radar_data.bin -o output.json --format json\n");
    man.push_str(".TP\n");
    man.push_str("多雷达融合:\n");
    man.push_str("atc-analyzer fuse -i radar1.bin -i radar2.bin -o fused.json\n");
    man.push_str(".TP\n");
    man.push_str("冲突检测:\n");
    man.push_str("atc-analyzer alert -i fused_tracks.json --horizontal 5000 --vertical 300\n");
    man.push_str(".TP\n");
    man.push_str("流量统计:\n");
    man.push_str("atc-analyzer stats -i fused_tracks.json --mode sliding --window 15m\n");
    man.push_str(".TP\n");
    man.push_str("按扇区查询:\n");
    man.push_str("atc-analyzer query -i fused_tracks.json --sector SECTOR01\n");
    man.push_str(".TP\n");
    man.push_str("扇区范围查询:\n");
    man.push_str("atc-analyzer query -i fused_tracks.json --sector-range 1-3\n");

    man.push_str(".SH 配置文件\n");
    man.push_str("配置文件使用 TOML 格式，包含以下部分:\n");
    man.push_str(".TP\n");
    man.push_str("\\fB[radar_stations]\\fR\n");
    man.push_str("雷达站配置: id, name, latitude, longitude, altitude, weight。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB[safety_thresholds]\\fR\n");
    man.push_str("安全阈值: horizontal_separation, vertical_separation, lookahead_seconds, warning_factor。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB[output]\\fR\n");
    man.push_str("输出配置: format, path, pretty_print, include_timestamp。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB[processing]\\fR\n");
    man.push_str("处理配置: parallelism, batch_size, time_alignment_window_ms, track_history_size, fusion_timeout_ms。\n");
    man.push_str(".TP\n");
    man.push_str("\\fB[logging]\\fR\n");
    man.push_str("日志配置: level, file, json_format, show_target, show_module_path。\n");

    man.push_str(".SH 性能指标\n");
    man.push_str(".TP\n");
    man.push_str("处理吞吐量\n");
    man.push_str("单核 CPU 每秒处理 5000 条以上轨迹记录。\n");
    man.push_str(".TP\n");
    man.push_str("内存占用\n");
    man.push_str("处理 100 万条记录时内存占用不超过 500MB。\n");
    man.push_str(".TP\n");
    man.push_str("融合延迟\n");
    man.push_str("轨迹融合延迟控制在 100 毫秒以内。\n");
    man.push_str(".TP\n");
    man.push_str("冲突检测响应\n");
    man.push_str("冲突检测响应时间不超过 50 毫秒。\n");

    man.push_str(".SH 环境变量\n");
    man.push_str(".TP\n");
    man.push_str("\\fBATC_LOG_LEVEL\\fR\n");
    man.push_str("设置日志级别，覆盖命令行 --log-level 参数。\n");

    man.push_str(".SH 参见\n");
    man.push_str("\\fBclap\\fR(3), \\fBserde\\fR(3), \\fBtokio\\fR(3), \\fBrayon\\fR(3)\n");

    man.push_str(".SH 作者\n");
    man.push_str("ATC Analyzer 开发团队\n");

    man.push_str(".SH 版权\n");
    man.push_str("MIT License\n");

    man
}

pub fn write_man_page(output_path: Option<&Path>, section: u8) -> AtcResult<()> {
    let content = generate_man_page(section);

    match output_path {
        Some(path) => {
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(path, content)?;
            eprintln!("man 手册已生成: {}", path.display());
        }
        None => {
            print!("{}", content);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_man_page_generation() {
        let man = generate_man_page(1);
        assert!(man.contains(".TH ATC-ANALYZER"));
        assert!(man.contains(".SH 名称"));
        assert!(man.contains(".SH 概要"));
        assert!(man.contains(".SH 描述"));
        assert!(man.contains(".SH 子命令"));
        assert!(man.contains("decode"));
        assert!(man.contains("fuse"));
        assert!(man.contains("alert"));
        assert!(man.contains("stats"));
        assert!(man.contains("query"));
        assert!(man.contains(".SH 示例"));
        assert!(man.contains(".SH 配置文件"));
        assert!(man.contains(".SH 性能指标"));
    }

    #[test]
    fn test_man_page_contains_sector_options() {
        let man = generate_man_page(1);
        assert!(man.contains("--sector"));
        assert!(man.contains("--sector-range"));
    }
}
