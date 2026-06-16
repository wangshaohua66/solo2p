-- =====================================================
-- 碳排放配额管理系统 数据库建表脚本
-- PostgreSQL 16
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 企业表
CREATE TABLE IF NOT EXISTS t_enterprise (
    id              BIGINT          PRIMARY KEY,
    enterprise_code VARCHAR(32)     NOT NULL UNIQUE,
    enterprise_name VARCHAR(200)    NOT NULL,
    industry_code   VARCHAR(32)     NOT NULL,
    industry_name   VARCHAR(100),
    contact_person  VARCHAR(50),
    contact_phone   VARCHAR(20),
    region_code     VARCHAR(32),
    key_emission    BOOLEAN         DEFAULT TRUE,
    enabled         BOOLEAN         DEFAULT TRUE,
    created_time    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_time    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_enterprise_code ON t_enterprise(enterprise_code);
CREATE INDEX idx_enterprise_industry ON t_enterprise(industry_code);

-- 行业基准线表
CREATE TABLE IF NOT EXISTS t_baseline (
    id                BIGINT          PRIMARY KEY,
    industry_code     VARCHAR(32)     NOT NULL,
    industry_name     VARCHAR(100),
    quota_year        INT             NOT NULL,
    baseline_value    DECIMAL(18,4)   NOT NULL,
    adjust_coefficient DECIMAL(6,4)  DEFAULT 1.0000,
    description       TEXT,
    created_time      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_time      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(industry_code, quota_year)
);

-- 配额表
CREATE TABLE IF NOT EXISTS t_quota (
    id                  BIGINT          PRIMARY KEY,
    enterprise_id       BIGINT          NOT NULL,
    enterprise_code     VARCHAR(32)     NOT NULL,
    quota_year          INT             NOT NULL,
    total_amount        DECIMAL(18,2)   NOT NULL DEFAULT 0,
    used_amount         DECIMAL(18,2)   NOT NULL DEFAULT 0,
    frozen_amount       DECIMAL(18,2)   NOT NULL DEFAULT 0,
    available_amount    DECIMAL(18,2)   NOT NULL DEFAULT 0,
    status              VARCHAR(20)     NOT NULL DEFAULT 'PRE_ALLOCATED',
    historical_emission DECIMAL(18,2),
    baseline_value      DECIMAL(18,4),
    allocate_reason     TEXT,
    version             INT             DEFAULT 0,
    created_time        TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_time        TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(enterprise_id, quota_year)
);
CREATE INDEX idx_quota_enterprise ON t_quota(enterprise_id);
CREATE INDEX idx_quota_year ON t_quota(quota_year);
CREATE INDEX idx_quota_status ON t_quota(status);

-- 排放报告表
CREATE TABLE IF NOT EXISTS t_emission_report (
    id                BIGINT          PRIMARY KEY,
    enterprise_id     BIGINT          NOT NULL,
    enterprise_code   VARCHAR(32)     NOT NULL,
    report_year       INT             NOT NULL,
    report_month      INT             NOT NULL,
    emission_amount   DECIMAL(18,4)   NOT NULL,
    co2_amount        DECIMAL(18,4),
    ch4_amount        DECIMAL(18,4),
    n2o_amount        DECIMAL(18,4),
    fuel_type         VARCHAR(50),
    fuel_consumption  DECIMAL(18,4),
    power_consumption DECIMAL(18,4),
    heat_consumption  DECIMAL(18,4),
    report_format     VARCHAR(10)     NOT NULL DEFAULT 'JSON',
    status            VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    verify_remark     TEXT,
    verifier          VARCHAR(50),
    verify_time       TIMESTAMP,
    created_time      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_time      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(enterprise_id, report_year, report_month)
);
CREATE INDEX idx_emission_enterprise_year ON t_emission_report(enterprise_id, report_year);
CREATE INDEX idx_emission_status ON t_emission_report(status);

-- 交易订单表
CREATE TABLE IF NOT EXISTS t_trade_order (
    id              BIGINT          PRIMARY KEY,
    order_no        VARCHAR(64)     NOT NULL UNIQUE,
    seller_id       BIGINT          NOT NULL,
    seller_code     VARCHAR(32)     NOT NULL,
    buyer_id        BIGINT,
    buyer_code      VARCHAR(32),
    trade_mode      VARCHAR(20)     NOT NULL,
    amount          DECIMAL(18,2)   NOT NULL,
    unit_price      DECIMAL(18,4)   NOT NULL,
    total_price     DECIMAL(18,2)   NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    listed_time     TIMESTAMP,
    matched_time    TIMESTAMP,
    settled_time    TIMESTAMP,
    cancel_reason   TEXT,
    version         INT             DEFAULT 0,
    created_time    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_time    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trade_seller ON t_trade_order(seller_id);
CREATE INDEX idx_trade_buyer ON t_trade_order(buyer_id);
CREATE INDEX idx_trade_status ON t_trade_order(status);
CREATE INDEX idx_trade_mode ON t_trade_order(trade_mode);

-- 履约结算表
CREATE TABLE IF NOT EXISTS t_settlement (
    id                    BIGINT          PRIMARY KEY,
    enterprise_id         BIGINT          NOT NULL,
    enterprise_code       VARCHAR(32)     NOT NULL,
    settlement_year       INT             NOT NULL,
    quota_balance         DECIMAL(18,2)   NOT NULL DEFAULT 0,
    actual_emission       DECIMAL(18,2)   NOT NULL DEFAULT 0,
    deficit               DECIMAL(18,2)   NOT NULL DEFAULT 0,
    surplus               DECIMAL(18,2)   NOT NULL DEFAULT 0,
    status                VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    penalty_amount        DECIMAL(18,2)   DEFAULT 0,
    penalty_rule          TEXT,
    installment_allowed   BOOLEAN         DEFAULT FALSE,
    installment_periods   INT,
    installment_paid      DECIMAL(18,2)   DEFAULT 0,
    operator              VARCHAR(50),
    settled_time          TIMESTAMP,
    created_time          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_time          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(enterprise_id, settlement_year)
);
CREATE INDEX idx_settlement_enterprise ON t_settlement(enterprise_id);
CREATE INDEX idx_settlement_year ON t_settlement(settlement_year);

-- 审计日志表（追加式，不可删除）
CREATE TABLE IF NOT EXISTS t_audit_log (
    id                BIGINT          PRIMARY KEY,
    biz_type          VARCHAR(50)     NOT NULL,
    biz_id            BIGINT,
    enterprise_id     BIGINT,
    enterprise_code   VARCHAR(32),
    operation         VARCHAR(200)    NOT NULL,
    operator          VARCHAR(50),
    before_snapshot   TEXT,
    after_snapshot    TEXT,
    remark            TEXT,
    created_time      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_biz ON t_audit_log(biz_type, biz_id);
CREATE INDEX idx_audit_enterprise ON t_audit_log(enterprise_id);
CREATE INDEX idx_audit_time ON t_audit_log(created_time);
CREATE INDEX idx_audit_type_time ON t_audit_log(biz_type, created_time);

-- 超排预警表
CREATE TABLE IF NOT EXISTS t_emission_warning (
    id                   BIGINT          PRIMARY KEY,
    enterprise_id        BIGINT          NOT NULL,
    enterprise_code      VARCHAR(32)     NOT NULL,
    warning_year         INT             NOT NULL,
    cumulative_emission  DECIMAL(18,4)   DEFAULT 0,
    quota_total          DECIMAL(18,2)   DEFAULT 0,
    emission_ratio       DECIMAL(6,4)    DEFAULT 0,
    warning_level        VARCHAR(20)     NOT NULL DEFAULT 'NORMAL',
    sell_restricted      BOOLEAN         DEFAULT FALSE,
    notify_status        VARCHAR(20)     DEFAULT 'NOTIFIED',
    created_time         TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_time         TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(enterprise_id, warning_year)
);
CREATE INDEX idx_warning_enterprise ON t_emission_warning(enterprise_id);
CREATE INDEX idx_warning_level ON t_emission_warning(warning_level);

-- 审计日志不可删除触发器
CREATE OR REPLACE FUNCTION prevent_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '审计日志不可删除，仅支持追加';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_delete
BEFORE DELETE ON t_audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_delete();

-- 审计日志不可更新触发器
CREATE OR REPLACE FUNCTION prevent_audit_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '审计日志不可修改，仅支持追加';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_update
BEFORE UPDATE ON t_audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_update();
