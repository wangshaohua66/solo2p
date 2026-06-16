CREATE DATABASE IF NOT EXISTS crew_scheduling DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE crew_scheduling;

CREATE TABLE IF NOT EXISTS sys_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    real_name VARCHAR(50),
    enabled TINYINT(1) DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS crew_member (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    crew_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL COMMENT 'PILOT/ATTENDANT',
    rank VARCHAR(20) COMMENT 'CAPTAIN/FO/PURSER/ATTENDANT',
    base VARCHAR(10) COMMENT 'PEK/SHA/CAN/CTU',
    language VARCHAR(100) COMMENT 'ZH,EN',
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' COMMENT 'AVAILABLE/ON_DUTY/LEAVE/GROUNDED',
    monthly_flight_hours DOUBLE DEFAULT 0,
    weekly_flight_hours DOUBLE DEFAULT 0,
    consecutive_duty_days INT DEFAULT 0,
    last_duty_end DATETIME,
    timezone_offset INT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_crew_code (crew_code),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_base (base),
    INDEX idx_type_status (type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS flight (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    flight_no VARCHAR(20) NOT NULL,
    departure VARCHAR(10) NOT NULL,
    arrival VARCHAR(10) NOT NULL,
    departure_time DATETIME NOT NULL,
    arrival_time DATETIME NOT NULL,
    aircraft_type VARCHAR(20) NOT NULL COMMENT 'B737/A320/ARJ21',
    timezone_diff INT DEFAULT 0,
    is_red_eye TINYINT(1) DEFAULT 0,
    required_pilots INT DEFAULT 2,
    required_attendants INT DEFAULT 4,
    language_required VARCHAR(50),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_flight_no (flight_no),
    INDEX idx_departure_time (departure_time),
    INDEX idx_aircraft_type (aircraft_type),
    INDEX idx_departure_arrival (departure, arrival)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS roster_plan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plan_no VARCHAR(50) NOT NULL UNIQUE,
    month DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/APPROVED/REJECTED',
    total_flights INT DEFAULT 0,
    total_crew_assigned INT DEFAULT 0,
    violation_count INT DEFAULT 0,
    avg_fatigue_score DOUBLE DEFAULT 0,
    generated_by VARCHAR(50),
    generated_at DATETIME,
    approved_at DATETIME,
    approved_by VARCHAR(50),
    remark VARCHAR(500),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_plan_no (plan_no),
    INDEX idx_month (month),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS roster (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    roster_no VARCHAR(80),
    crew_id BIGINT NOT NULL,
    flight_id BIGINT NOT NULL,
    roster_date DATE NOT NULL,
    duty_role VARCHAR(20) NOT NULL COMMENT 'PILOT/ATTENDANT',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/APPROVED/ACTIVE/COMPLETED/CANCELLED',
    report_time DATETIME,
    release_time DATETIME,
    duty_hours DOUBLE DEFAULT 0,
    timezone_crossings INT DEFAULT 0,
    is_red_eye TINYINT(1) DEFAULT 0,
    fatigue_score DOUBLE DEFAULT 0,
    approved_at DATETIME,
    approved_by VARCHAR(50),
    swap_reason VARCHAR(200),
    swapped_from BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_roster_no (roster_no),
    INDEX idx_crew_id (crew_id),
    INDEX idx_flight_id (flight_id),
    INDEX idx_roster_date (roster_date),
    INDEX idx_status (status),
    INDEX idx_crew_date (crew_id, roster_date),
    INDEX idx_crew_date_status (crew_id, roster_date, status),
    CONSTRAINT fk_roster_crew FOREIGN KEY (crew_id) REFERENCES crew_member(id),
    CONSTRAINT fk_roster_flight FOREIGN KEY (flight_id) REFERENCES flight(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS duty_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    crew_id BIGINT NOT NULL,
    roster_id BIGINT,
    check_in_time DATETIME,
    check_out_time DATETIME,
    actual_duty_hours DOUBLE DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/COMPLETED',
    overtime_flag TINYINT(1) DEFAULT 0,
    fatigue_score DOUBLE DEFAULT 0,
    timezone_crossings INT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_crew_id (crew_id),
    INDEX idx_roster_id (roster_id),
    INDEX idx_status (status),
    INDEX idx_check_in_time (check_in_time),
    INDEX idx_crew_status (crew_id, status),
    INDEX idx_crew_time_range (crew_id, check_in_time),
    CONSTRAINT fk_duty_crew FOREIGN KEY (crew_id) REFERENCES crew_member(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS qualification (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    crew_id BIGINT NOT NULL,
    qual_type VARCHAR(30) NOT NULL COMMENT 'LICENSE/TYPE_RATING/MEDICAL/LANGUAGE',
    qual_code VARCHAR(50),
    aircraft_type VARCHAR(20) COMMENT 'B737/A320/ARJ21',
    issue_date DATE,
    expiry_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'VALID' COMMENT 'VALID/EXPIRING_SOON/EXPIRED',
    language_level VARCHAR(20) COMMENT 'ICAO4/ICAO5/ICAO6',
    remark VARCHAR(500),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_crew_id (crew_id),
    INDEX idx_qual_type (qual_type),
    INDEX idx_status (status),
    INDEX idx_expiry_date (expiry_date),
    INDEX idx_crew_type (crew_id, qual_type),
    INDEX idx_crew_aircraft (crew_id, aircraft_type),
    CONSTRAINT fk_qual_crew FOREIGN KEY (crew_id) REFERENCES crew_member(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fatigue_alert (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    crew_id BIGINT NOT NULL,
    duty_record_id BIGINT,
    alert_level VARCHAR(20) NOT NULL COMMENT 'YELLOW/RED/FATIGUE_HIGH',
    fatigue_score DOUBLE DEFAULT 0,
    duty_ratio DOUBLE DEFAULT 0,
    message VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/RESOLVED',
    triggered_at DATETIME,
    resolved_at DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_crew_id (crew_id),
    INDEX idx_alert_level (alert_level),
    INDEX idx_status (status),
    INDEX idx_triggered_at (triggered_at),
    CONSTRAINT fk_alert_crew FOREIGN KEY (crew_id) REFERENCES crew_member(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS swap_request (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    roster_id BIGINT NOT NULL,
    original_crew_id BIGINT NOT NULL,
    target_crew_id BIGINT,
    reason VARCHAR(30) NOT NULL COMMENT 'SICK/EMERGENCY/PERSONAL',
    urgency VARCHAR(20) DEFAULT 'NORMAL' COMMENT 'URGENT/NORMAL',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/APPROVED/REJECTED',
    review_comment VARCHAR(500),
    reviewed_at DATETIME,
    reviewed_by VARCHAR(50),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_roster_id (roster_id),
    INDEX idx_original_crew (original_crew_id),
    INDEX idx_target_crew (target_crew_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS conflict_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    roster_id BIGINT,
    crew_id BIGINT,
    conflict_type VARCHAR(30) NOT NULL COMMENT 'OVERTIME/QUAL_MISMATCH/INSUFFICIENT_REST',
    description VARCHAR(500),
    suggestion VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN/RESOLVED',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_roster_id (roster_id),
    INDEX idx_crew_id (crew_id),
    INDEX idx_conflict_type (conflict_type),
    INDEX idx_status (status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sys_user (username, password, role, real_name, enabled) VALUES
('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', 'ADMIN', '系统管理员', 1),
('dispatcher', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', 'DISPATCHER', '签派员', 1),
('crew', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', 'CREW', '机组人员', 1);
