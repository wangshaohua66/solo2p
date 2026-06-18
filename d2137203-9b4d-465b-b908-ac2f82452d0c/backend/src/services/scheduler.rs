use chrono::{NaiveDate, Duration};
use std::collections::HashMap;

pub fn calculate_next_inspection_date(
    device_type: &str,
    last_inspection_date: NaiveDate,
    conclusion: Option<&str>,
    custom_cycle_months: Option<i32>,
) -> (NaiveDate, i32) {
    let default_cycles: HashMap<&str, i32> = [
        ("elevator", 12),
        ("boiler", 24),
        ("pressure_vessel", 36),
        ("crane", 24),
    ].iter().cloned().collect();

    let cycle_months = if let Some(custom) = custom_cycle_months {
        custom
    } else {
        *default_cycles.get(device_type).unwrap_or(&12)
    };

    let adjusted_cycle = match conclusion {
        Some("qualified") => cycle_months,
        Some("basically_qualified") => cycle_months / 2,
        Some("unqualified") => 1,
        _ => cycle_months,
    };

    let next_date = last_inspection_date + Duration::days((adjusted_cycle as i64) * 30);

    (next_date, adjusted_cycle)
}

pub fn calculate_warnings(
    next_inspection_date: NaiveDate,
    warning_days_1: i32,
    warning_days_2: i32,
) -> Vec<(String, NaiveDate, i32)> {
    let mut warnings = Vec::new();

    warnings.push((
        "level_1".to_string(),
        next_inspection_date - Duration::days(warning_days_1 as i64),
        warning_days_1,
    ));

    warnings.push((
        "level_2".to_string(),
        next_inspection_date - Duration::days(warning_days_2 as i64),
        warning_days_2,
    ));

    warnings
}

pub fn get_default_cycle(device_type: &str) -> i32 {
    match device_type {
        "elevator" => 12,
        "boiler" => 24,
        "pressure_vessel" => 36,
        "crane" => 24,
        _ => 12,
    }
}

pub fn get_default_warning_days() -> (i32, i32) {
    (30, 7)
}
