-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    real_name VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'inspector',
    unit_id UUID,
    area VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 使用单位表
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    credit_code VARCHAR(18) UNIQUE,
    address VARCHAR(500),
    contact_person VARCHAR(50),
    contact_phone VARCHAR(20),
    area VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 设备表
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_code VARCHAR(20) UNIQUE NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    device_name VARCHAR(200) NOT NULL,
    model VARCHAR(100),
    manufacturer VARCHAR(200),
    manufacture_date DATE,
    installation_date DATE,
    acceptance_date DATE,
    unit_id UUID NOT NULL REFERENCES units(id),
    location VARCHAR(500),
    area VARCHAR(100),
    safety_level VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'normal',
    last_inspection_date DATE,
    next_inspection_date DATE,
    inspection_cycle_months INTEGER,
    custom_cycle_months INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_registration_code ON devices(registration_code);
CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices(device_type);
CREATE INDEX IF NOT EXISTS idx_devices_unit_id ON devices(unit_id);
CREATE INDEX IF NOT EXISTS idx_devices_area ON devices(area);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_next_inspection_date ON devices(next_inspection_date);

-- 检验记录表
CREATE TABLE IF NOT EXISTS inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id),
    inspection_type VARCHAR(50) NOT NULL,
    inspector_id UUID REFERENCES users(id),
    plan_date DATE,
    actual_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    conclusion VARCHAR(20),
    safety_level VARCHAR(20),
    report_number VARCHAR(50),
    report_url VARCHAR(500),
    findings TEXT,
    next_inspection_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspections_device_id ON inspections(device_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector_id ON inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspections_plan_date ON inspections(plan_date);

-- 隐患表
CREATE TABLE IF NOT EXISTS hazards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id),
    inspection_id UUID REFERENCES inspections(id),
    hazard_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    inspector_id UUID REFERENCES users(id),
    unit_contact_id UUID REFERENCES users(id),
    deadline DATE,
    rectification_description TEXT,
    rectification_files JSONB,
    review_date DATE,
    review_result VARCHAR(20),
    reviewer_id UUID REFERENCES users(id),
    supervision_level VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hazards_device_id ON hazards(device_id);
CREATE INDEX IF NOT EXISTS idx_hazards_status ON hazards(status);
CREATE INDEX IF NOT EXISTS idx_hazards_severity ON hazards(severity);
CREATE INDEX IF NOT EXISTS idx_hazards_deadline ON hazards(deadline);

-- 操作审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 检验预警队列表
CREATE TABLE IF NOT EXISTS inspection_warnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id),
    warning_type VARCHAR(20) NOT NULL,
    warning_date DATE NOT NULL,
    days_remaining INTEGER,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_warnings_device_id ON inspection_warnings(device_id);
CREATE INDEX IF NOT EXISTS idx_warnings_is_sent ON inspection_warnings(is_sent);

-- 检验规则配置表
CREATE TABLE IF NOT EXISTS inspection_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_type VARCHAR(50) UNIQUE NOT NULL,
    default_cycle_months INTEGER NOT NULL,
    warning_days_1 INTEGER DEFAULT 30,
    warning_days_2 INTEGER DEFAULT 7,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 初始化检验规则
INSERT INTO inspection_rules (device_type, default_cycle_months, warning_days_1, warning_days_2, description)
VALUES 
    ('elevator', 12, 30, 7, '电梯：1年检验周期'),
    ('boiler', 24, 30, 7, '锅炉：2年检验周期'),
    ('pressure_vessel', 36, 30, 7, '压力容器：3年检验周期'),
    ('crane', 24, 30, 7, '起重机械：2年检验周期')
ON CONFLICT (device_type) DO NOTHING;

-- 初始化管理员账号 (密码: admin123)
INSERT INTO users (username, password_hash, real_name, email, role, status)
VALUES ('admin', '$2b$12$FQ9Yp7sYq8e2X3w4V5U6T7S8R9Q0P1O2N3M4L5K6J7H6G5F4E3D2C1B0A9', '系统管理员', 'admin@example.com', 'admin', 'active')
ON CONFLICT (username) DO NOTHING;
