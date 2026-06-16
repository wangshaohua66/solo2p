-- =====================================================
-- 省级应急管理指挥系统 - 数据库初始化脚本
-- Database: PostgreSQL 16 + PostGIS 3.4
-- =====================================================

-- 创建 schema
CREATE SCHEMA IF NOT EXISTS emergency;
SET search_path TO emergency;

-- 启用 PostGIS 扩展
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- =====================================================
-- 1. 认证授权相关表
-- =====================================================

-- 组织表（省-市-县三级）
CREATE TABLE IF NOT EXISTS sys_organization (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    level INT NOT NULL,
    parent_id BIGINT,
    parent_path VARCHAR(500),
    region_code VARCHAR(20),
    leader VARCHAR(50),
    phone VARCHAR(20),
    address VARCHAR(500),
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    remark VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 用户表
CREATE TABLE IF NOT EXISTS sys_user (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    real_name VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    avatar VARCHAR(500),
    organization_id BIGINT REFERENCES sys_organization(id),
    region_code VARCHAR(20),
    status INT DEFAULT 1,
    login_fail_count INT DEFAULT 0,
    last_login_time TIMESTAMP,
    last_login_ip VARCHAR(50),
    lock_expire_time TIMESTAMP,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 角色表
CREATE TABLE IF NOT EXISTS sys_role (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(500),
    data_scope INT DEFAULT 1,
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    remark VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 权限表
CREATE TABLE IF NOT EXISTS sys_permission (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20),
    resource VARCHAR(200),
    action VARCHAR(50),
    parent_id BIGINT,
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    remark VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 用户角色关联表
CREATE TABLE IF NOT EXISTS sys_user_role (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES sys_user(id),
    role_id BIGINT NOT NULL REFERENCES sys_role(id),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0,
    UNIQUE(user_id, role_id)
);

-- 角色权限关联表
CREATE TABLE IF NOT EXISTS sys_role_permission (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES sys_role(id),
    permission_id BIGINT NOT NULL REFERENCES sys_permission(id),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0,
    UNIQUE(role_id, permission_id)
);

-- 审批表
CREATE TABLE IF NOT EXISTS sys_approval (
    id BIGSERIAL PRIMARY KEY,
    business_type VARCHAR(50) NOT NULL,
    business_id BIGINT NOT NULL,
    business_no VARCHAR(50),
    applicant_id BIGINT,
    applicant_name VARCHAR(50),
    applicant_org_id BIGINT,
    current_approver_id BIGINT,
    current_approver_name VARCHAR(50),
    approver_org_id BIGINT,
    approval_level INT,
    status INT DEFAULT 0,
    remark VARCHAR(500),
    approved_at TIMESTAMP,
    approval_opinion VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 审批日志表
CREATE TABLE IF NOT EXISTS sys_approval_log (
    id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT REFERENCES sys_approval(id),
    approver_id BIGINT,
    approver_name VARCHAR(50),
    approver_org_id BIGINT,
    approval_level INT,
    action INT,
    opinion VARCHAR(500),
    action_time TIMESTAMP,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- =====================================================
-- 2. 灾情事件相关表
-- =====================================================

-- 灾情事件表
CREATE TABLE IF NOT EXISTS incident_event (
    id BIGSERIAL PRIMARY KEY,
    incident_no VARCHAR(50) UNIQUE NOT NULL,
    type INT NOT NULL,
    level INT NOT NULL,
    status INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(500),
    location_point GEOGRAPHY(POINT, 4326),
    region_code VARCHAR(20),
    organization_id BIGINT REFERENCES sys_organization(id),
    affected_area DECIMAL(10,2),
    affected_population INT,
    estimated_loss DECIMAL(15,2),
    casualties INT DEFAULT 0,
    injured INT DEFAULT 0,
    missing INT DEFAULT 0,
    trapped INT DEFAULT 0,
    source_type VARCHAR(50),
    source_detail VARCHAR(500),
    weather_condition VARCHAR(200),
    terrain_condition VARCHAR(200),
    occurred_at TIMESTAMP,
    reported_at TIMESTAMP,
    responded_at TIMESTAMP,
    controlled_at TIMESTAMP,
    closed_at TIMESTAMP,
    response_plan_id VARCHAR(50),
    remarks TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 灾情数据源表
CREATE TABLE IF NOT EXISTS incident_data_source (
    id BIGSERIAL PRIMARY KEY,
    incident_id BIGINT REFERENCES incident_event(id),
    data_type VARCHAR(50),
    source VARCHAR(100),
    data_content TEXT,
    raw_data TEXT,
    data_point GEOGRAPHY(POINT, 4326),
    data_quality VARCHAR(20),
    confidence DECIMAL(5,4),
    collected_at TIMESTAMP,
    collected_by VARCHAR(100),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 应急预案表
CREATE TABLE IF NOT EXISTS incident_response_plan (
    id BIGSERIAL PRIMARY KEY,
    plan_code VARCHAR(50) UNIQUE NOT NULL,
    plan_name VARCHAR(200) NOT NULL,
    incident_type INT,
    min_level INT,
    max_level INT,
    description TEXT,
    response_procedure TEXT,
    required_resources TEXT,
    responsible_dept VARCHAR(200),
    contact_info VARCHAR(500),
    estimated_duration INT,
    priority INT DEFAULT 0,
    status INT DEFAULT 1,
    rules_config TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 灾情操作日志表
CREATE TABLE IF NOT EXISTS incident_operation_log (
    id BIGSERIAL PRIMARY KEY,
    incident_id BIGINT REFERENCES incident_event(id),
    operation_type VARCHAR(50),
    operation_detail VARCHAR(500),
    before_status VARCHAR(50),
    after_status VARCHAR(50),
    operator_name VARCHAR(50),
    operator_id BIGINT,
    operator_org_id BIGINT,
    operation_time TIMESTAMP,
    remark VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- =====================================================
-- 3. 救援调度相关表
-- =====================================================

-- 救援队伍表
CREATE TABLE IF NOT EXISTS rescue_team (
    id BIGSERIAL PRIMARY KEY,
    team_code VARCHAR(50) UNIQUE NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    team_type VARCHAR(50),
    team_size INT DEFAULT 0,
    organization_id BIGINT REFERENCES sys_organization(id),
    region_code VARCHAR(20),
    address VARCHAR(500),
    location_point GEOGRAPHY(POINT, 4326),
    leader_name VARCHAR(50),
    leader_phone VARCHAR(20),
    status INT DEFAULT 1,
    current_task_count INT DEFAULT 0,
    equipment TEXT,
    capabilities TEXT,
    response_radius INT DEFAULT 50,
    average_arrival_time DECIMAL(5,2),
    remark VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 调度方案表
CREATE TABLE IF NOT EXISTS dispatch_plan (
    id BIGSERIAL PRIMARY KEY,
    dispatch_no VARCHAR(50) UNIQUE NOT NULL,
    incident_id BIGINT REFERENCES incident_event(id),
    incident_no VARCHAR(50),
    title VARCHAR(200),
    status INT DEFAULT 0,
    priority INT DEFAULT 3,
    required_level INT DEFAULT 4,
    estimated_distance DECIMAL(10,2),
    estimated_duration INT,
    estimated_arrival_time TIMESTAMP,
    dispatch_strategy TEXT,
    task_description TEXT,
    danger_warning TEXT,
    current_approval_id BIGINT,
    created_by_org_id BIGINT,
    remark TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 队伍分配表
CREATE TABLE IF NOT EXISTS dispatch_team_assignment (
    id BIGSERIAL PRIMARY KEY,
    dispatch_plan_id BIGINT REFERENCES dispatch_plan(id),
    team_id BIGINT REFERENCES rescue_team(id),
    team_name VARCHAR(100),
    assignment_role VARCHAR(50),
    team_count INT,
    assigned_at TIMESTAMP,
    departed_at TIMESTAMP,
    arrived_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20),
    conflict_info TEXT,
    task_detail TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- =====================================================
-- 4. 物资仓储相关表
-- =====================================================

-- 仓库表
CREATE TABLE IF NOT EXISTS warehouse (
    id BIGSERIAL PRIMARY KEY,
    warehouse_code VARCHAR(50) UNIQUE NOT NULL,
    warehouse_name VARCHAR(100) NOT NULL,
    warehouse_type INT DEFAULT 1,
    organization_id BIGINT REFERENCES sys_organization(id),
    region_code VARCHAR(20),
    address VARCHAR(500),
    location_point GEOGRAPHY(POINT, 4326),
    manager_name VARCHAR(50),
    manager_phone VARCHAR(20),
    capacity INT DEFAULT 0,
    used_capacity INT DEFAULT 0,
    status INT DEFAULT 1,
    remark VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 物资品类表
CREATE TABLE IF NOT EXISTS material (
    id BIGSERIAL PRIMARY KEY,
    material_code VARCHAR(50) UNIQUE NOT NULL,
    material_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    specification VARCHAR(200),
    unit VARCHAR(20),
    unit_price DECIMAL(10,2),
    manufacturer VARCHAR(200),
    shelf_life INT,
    storage_condition VARCHAR(200),
    usage_method TEXT,
    remark VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 库存表
CREATE TABLE IF NOT EXISTS inventory_stock (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT REFERENCES warehouse(id),
    material_id BIGINT REFERENCES material(id),
    material_code VARCHAR(50),
    material_name VARCHAR(100),
    quantity INT DEFAULT 0,
    locked_quantity INT DEFAULT 0,
    available_quantity INT DEFAULT 0,
    warning_threshold INT DEFAULT 0,
    last_inbound_at TIMESTAMP,
    last_outbound_at TIMESTAMP,
    batch_no VARCHAR(50),
    expire_date TIMESTAMP,
    remark VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0,
    UNIQUE(warehouse_id, material_id)
);

-- 库存锁定表
CREATE TABLE IF NOT EXISTS stock_lock (
    id BIGSERIAL PRIMARY KEY,
    lock_no VARCHAR(50) UNIQUE NOT NULL,
    incident_id BIGINT REFERENCES incident_event(id),
    dispatch_plan_id BIGINT REFERENCES dispatch_plan(id),
    warehouse_id BIGINT REFERENCES warehouse(id),
    material_id BIGINT REFERENCES material(id),
    lock_quantity INT NOT NULL,
    estimated_cost DECIMAL(15,2),
    lock_expire_at TIMESTAMP,
    status INT DEFAULT 0,
    lock_reason VARCHAR(500),
    unlock_reason VARCHAR(500),
    unlocked_at TIMESTAMP,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 物资调拨表
CREATE TABLE IF NOT EXISTS material_allocation (
    id BIGSERIAL PRIMARY KEY,
    allocation_no VARCHAR(50) UNIQUE NOT NULL,
    incident_id BIGINT REFERENCES incident_event(id),
    dispatch_plan_id BIGINT REFERENCES dispatch_plan(id),
    from_warehouse_id BIGINT REFERENCES warehouse(id),
    to_warehouse_id BIGINT REFERENCES warehouse(id),
    material_id BIGINT REFERENCES material(id),
    quantity INT NOT NULL,
    estimated_distance DECIMAL(10,2),
    estimated_duration INT,
    route_plan TEXT,
    transport_mode VARCHAR(50),
    carrier VARCHAR(200),
    driver_name VARCHAR(50),
    driver_phone VARCHAR(20),
    vehicle_no VARCHAR(50),
    departed_at TIMESTAMP,
    arrived_at TIMESTAMP,
    status INT DEFAULT 0,
    remark TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- =====================================================
-- 5. 通知相关表
-- =====================================================

-- 通知表
CREATE TABLE IF NOT EXISTS notification (
    id BIGSERIAL PRIMARY KEY,
    notification_no VARCHAR(50) UNIQUE NOT NULL,
    incident_id BIGINT REFERENCES incident_event(id),
    dispatch_plan_id BIGINT REFERENCES dispatch_plan(id),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    summary VARCHAR(500),
    channel INT,
    target_type VARCHAR(20),
    target_ids TEXT,
    target_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    fail_count INT DEFAULT 0,
    read_count INT DEFAULT 0,
    status INT DEFAULT 0,
    priority INT DEFAULT 3,
    region_code VARCHAR(20),
    incident_level INT,
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    expired_at TIMESTAMP,
    template_code VARCHAR(50),
    template_params TEXT,
    failure_reason TEXT,
    callback_url VARCHAR(500),
    remark TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 通知回执表
CREATE TABLE IF NOT EXISTS notification_receipt (
    id BIGSERIAL PRIMARY KEY,
    notification_id BIGINT REFERENCES notification(id),
    recipient_id BIGINT,
    recipient_name VARCHAR(50),
    recipient_phone VARCHAR(20),
    channel INT,
    message_id VARCHAR(100),
    status INT DEFAULT 0,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    failure_reason TEXT,
    device_info VARCHAR(500),
    ip_address VARCHAR(50),
    location VARCHAR(500),
    remark VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- 通知模板表
CREATE TABLE IF NOT EXISTS notification_template (
    id BIGSERIAL PRIMARY KEY,
    template_code VARCHAR(50) UNIQUE NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    incident_type INT,
    min_incident_level INT,
    title_template VARCHAR(200),
    content_template TEXT,
    channel VARCHAR(50),
    target_rules TEXT,
    priority INT DEFAULT 3,
    variables TEXT,
    status INT DEFAULT 1,
    remark VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

-- =====================================================
-- 创建索引
-- =====================================================

-- 空间索引
CREATE INDEX IF NOT EXISTS idx_incident_location ON incident_event USING GIST(location_point);
CREATE INDEX IF NOT EXISTS idx_rescue_team_location ON rescue_team USING GIST(location_point);
CREATE INDEX IF NOT EXISTS idx_warehouse_location ON warehouse USING GIST(location_point);

-- 业务索引
CREATE INDEX IF NOT EXISTS idx_incident_status ON incident_event(status, deleted);
CREATE INDEX IF NOT EXISTS idx_incident_level ON incident_event(level, deleted);
CREATE INDEX IF NOT EXISTS idx_incident_region ON incident_event(region_code, deleted);
CREATE INDEX IF NOT EXISTS idx_incident_created ON incident_event(created_at DESC, deleted);

CREATE INDEX IF NOT EXISTS idx_dispatch_incident ON dispatch_plan(incident_id, deleted);
CREATE INDEX IF NOT EXISTS idx_dispatch_status ON dispatch_plan(status, deleted);

CREATE INDEX IF NOT EXISTS idx_stock_warehouse ON inventory_stock(warehouse_id, deleted);
CREATE INDEX IF NOT EXISTS idx_stock_material ON inventory_stock(material_id, deleted);

CREATE INDEX IF NOT EXISTS idx_notification_incident ON notification(incident_id, deleted);
CREATE INDEX IF NOT EXISTS idx_notification_status ON notification(status, deleted);

CREATE INDEX IF NOT EXISTS idx_user_org ON sys_user(organization_id, deleted);
CREATE INDEX IF NOT EXISTS idx_user_username ON sys_user(username, deleted);

CREATE INDEX IF NOT EXISTS idx_approval_business ON sys_approval(business_type, business_id, deleted);
CREATE INDEX IF NOT EXISTS idx_approval_approver ON sys_approval(current_approver_id, status, deleted);
