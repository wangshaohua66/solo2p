/// 终端 ANSI 颜色辅助：不引入额外依赖，直接输出 ANSI 转义码
pub fn green(s: &str) -> String {
    paint("\x1b[32m", s)
}
pub fn red(s: &str) -> String {
    paint("\x1b[31m", s)
}
pub fn yellow(s: &str) -> String {
    paint("\x1b[33m", s)
}
pub fn cyan(s: &str) -> String {
    paint("\x1b[36m", s)
}
pub fn dim(s: &str) -> String {
    paint("\x1b[2m", s)
}
pub fn bold(s: &str) -> String {
    paint("\x1b[1m", s)
}
pub fn magenta(s: &str) -> String {
    paint("\x1b[35m", s)
}

fn paint(prefix: &str, s: &str) -> String {
    format!("{}{}\x1b[0m", prefix, s)
}

/// 按状态着色：相同→绿，等同→黄，不同/缺失→红
pub fn status_colored(status: &str, s: &str) -> String {
    match status {
        "相同" | "字面侵权" => green(s),
        "等同" | "等同侵权" => yellow(s),
        "不同" | "缺失" | "不侵权" | "无法判定" => red(s),
        _ => s.to_string(),
    }
}
