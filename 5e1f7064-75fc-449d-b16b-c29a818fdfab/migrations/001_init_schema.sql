-- 医学检验中心样本管理系统数据库初始化脚本
-- PostgreSQL 15

-- 创建数据库（如果不存在的话需要手动执行）
-- CREATE DATABASE lab_management WITH ENCODING 'UTF8' LC_COLLATE='zh_CN.UTF-8' LC_CTYPE='zh_CN.UTF-8' TEMPLATE=template0;

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_samples_barcode ON samples(barcode);
CREATE INDEX IF NOT EXISTS idx_samples_institution_id ON samples(institution_id);
CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);
CREATE INDEX IF NOT EXISTS idx_samples_created_at ON samples(created_at);
CREATE INDEX IF NOT EXISTS idx_samples_is_critical ON samples(is_critical);
CREATE INDEX IF NOT EXISTS idx_samples_patient ON samples(patient_id, patient_name);
CREATE INDEX IF NOT EXISTS idx_sample_items_sample_id ON sample_items(sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_status_logs_sample ON sample_status_logs(sample_id, created_at);
CREATE INDEX IF NOT EXISTS idx_test_results_sample ON test_results(sample_id);
CREATE INDEX IF NOT EXISTS idx_critical_values_sample ON critical_value_records(sample_id);
CREATE INDEX IF NOT EXISTS idx_critical_values_unreviewed ON critical_value_records(is_fully_reviewed, alert_time);
CREATE INDEX IF NOT EXISTS idx_reports_sample ON reports(sample_id);
CREATE INDEX IF NOT EXISTS idx_reports_no ON reports(report_no);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_settlements_inst_month ON settlements(institution_id, settle_year, settle_month);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlement_details_settlement ON settlement_details(settlement_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, module);
CREATE INDEX IF NOT EXISTS idx_report_read_logs_report ON report_read_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_report_read_logs_reader ON report_read_logs(reader_id);

-- 创建日计数器唯一索引（已在模型中通过gorm定义，此处为冗余确保）
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_counter_date_code ON daily_counters(institution_code, count_date);

-- 创建分区表可选（超大数据量时使用，此处提供示例）
-- 按月份分区审计日志表（可选启用）
/*
CREATE TABLE audit_logs_2024 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
*/

-- 创建视图：样本全信息视图
CREATE OR REPLACE VIEW v_sample_full AS
SELECT
    s.id,
    s.barcode,
    s.institution_id,
    i.name AS institution_name,
    i.code AS institution_code,
    s.patient_id,
    s.patient_name,
    s.gender,
    s.age,
    s.specimen_type,
    s.collect_time,
    s.arrival_time,
    s.status,
    s.is_critical,
    s.total_price,
    s.final_price,
    s.remark,
    s.created_at AS registered_at,
    s.updated_at
FROM samples s
LEFT JOIN institutions i ON s.institution_id = i.id;

COMMENT ON VIEW v_sample_full IS '样本全信息视图：关联机构信息';

-- 创建视图：月度统计视图
CREATE OR REPLACE VIEW v_monthly_stats AS
SELECT
    EXTRACT(YEAR FROM s.created_at) AS year,
    EXTRACT(MONTH FROM s.created_at) AS month,
    s.institution_id,
    i.name AS institution_name,
    COUNT(*) AS total_samples,
    SUM(CASE WHEN s.is_critical = true THEN 1 ELSE 0 END) AS critical_count,
    SUM(CASE WHEN s.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
    SUM(CASE WHEN s.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count,
    SUM(s.total_price) AS total_amount,
    SUM(s.final_price) AS final_amount
FROM samples s
LEFT JOIN institutions i ON s.institution_id = i.id
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, 2 DESC;

COMMENT ON VIEW v_monthly_stats IS '月度统计视图：按机构维度汇总';

-- 创建函数：生成唯一条码（触发器备用方案）
CREATE OR REPLACE FUNCTION generate_sample_barcode()
RETURNS TRIGGER AS $$
DECLARE
    inst_code VARCHAR(20);
    date_str VARCHAR(8);
    seq_val BIGINT;
BEGIN
    -- 条码生成逻辑在应用层完成，此函数仅作备份参考
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_sample_barcode() IS '样本条码生成函数（应用层已实现）';

-- 创建紧急值报警通知表（用于扩展：短信/推送通知记录）
CREATE TABLE IF NOT EXISTS critical_alerts (
    id BIGSERIAL PRIMARY KEY,
    critical_value_id BIGINT NOT NULL REFERENCES critical_value_records(id),
    sample_id BIGINT NOT NULL REFERENCES samples(id),
    alert_type VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT,
    target_contact VARCHAR(100),
    content TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMP,
    error_message VARCHAR(500),
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_critical_alerts_cv ON critical_alerts(critical_value_id);
CREATE INDEX IF NOT EXISTS idx_critical_alerts_status ON critical_alerts(status);

COMMENT ON TABLE critical_alerts IS '危急值报警发送记录表：记录短信/系统通知';
