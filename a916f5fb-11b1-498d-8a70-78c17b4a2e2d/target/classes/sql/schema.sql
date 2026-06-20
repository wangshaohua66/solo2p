-- =====================================================
-- 烟草专卖管理系统 - 数据库脚本
-- 数据库: MySQL 8.0
-- 字符集: utf8mb4
-- =====================================================

CREATE DATABASE IF NOT EXISTS tobacco_admin DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE tobacco_admin;

-- =====================================================
-- 1. 用户表
-- =====================================================
DROP TABLE IF EXISTS sys_user;
CREATE TABLE sys_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    username VARCHAR(64) NOT NULL COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码（加密）',
    real_name VARCHAR(64) NOT NULL COMMENT '真实姓名',
    role_code VARCHAR(64) NOT NULL COMMENT '角色编码',
    phone VARCHAR(20) COMMENT '联系电话',
    email VARCHAR(128) COMMENT '邮箱',
    county_id BIGINT COMMENT '县局ID',
    station_id BIGINT COMMENT '管理所ID',
    status TINYINT DEFAULT 1 COMMENT '状态：0禁用 1启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除：0未删除 1已删除',
    UNIQUE KEY uk_username (username),
    INDEX idx_role_code (role_code),
    INDEX idx_county_id (county_id),
    INDEX idx_station_id (station_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统用户表';

-- =====================================================
-- 2. 零售户表
-- =====================================================
DROP TABLE IF EXISTS retailer;
CREATE TABLE retailer (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    user_id BIGINT COMMENT '关联用户ID',
    retailer_name VARCHAR(128) NOT NULL COMMENT '店铺名称',
    license_no VARCHAR(64) COMMENT '许可证编号',
    legal_person VARCHAR(64) COMMENT '法人姓名',
    id_card_no VARCHAR(32) COMMENT '身份证号',
    phone VARCHAR(20) COMMENT '联系电话',
    province VARCHAR(32) COMMENT '省份',
    city VARCHAR(32) COMMENT '城市',
    county VARCHAR(64) COMMENT '区县',
    address VARCHAR(256) COMMENT '经营地址',
    longitude DECIMAL(10,6) COMMENT '经度',
    latitude DECIMAL(10,6) COMMENT '纬度',
    business_type VARCHAR(32) COMMENT '经营业态',
    tier INT DEFAULT 1 COMMENT '档位（1-30）',
    credit_level VARCHAR(8) DEFAULT 'BBB' COMMENT '信用等级：AAA AA A BBB BB B C D',
    credit_score INT DEFAULT 75 COMMENT '信用分（0-120）',
    consecutive_no_violation_periods INT DEFAULT 0 COMMENT '连续无违规期数',
    register_date DATE COMMENT '注册日期',
    county_id BIGINT COMMENT '县局ID',
    station_id BIGINT COMMENT '管理所ID',
    grid_id BIGINT COMMENT '网格ID',
    status TINYINT DEFAULT 1 COMMENT '状态：0停业 1正常营业',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_license_no (license_no),
    INDEX idx_user_id (user_id),
    INDEX idx_county_id (county_id),
    INDEX idx_station_id (station_id),
    INDEX idx_grid_id (grid_id),
    INDEX idx_tier (tier),
    INDEX idx_credit_level (credit_level),
    INDEX idx_credit_score (credit_score),
    INDEX idx_status (status),
    INDEX idx_business_type (business_type),
    INDEX idx_longitude_latitude (longitude, latitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售户表';

-- =====================================================
-- 3. 许可证表
-- =====================================================
DROP TABLE IF EXISTS license;
CREATE TABLE license (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    license_no VARCHAR(64) NOT NULL COMMENT '许可证编号',
    retailer_id BIGINT COMMENT '零售户ID',
    retailer_name VARCHAR(128) COMMENT '店铺名称',
    license_type VARCHAR(32) COMMENT '许可证类型',
    business_type VARCHAR(32) COMMENT '经营业态',
    business_scope VARCHAR(256) COMMENT '经营范围',
    legal_person VARCHAR(64) COMMENT '法人姓名',
    id_card_no VARCHAR(32) COMMENT '身份证号',
    phone VARCHAR(20) COMMENT '联系电话',
    province VARCHAR(32) COMMENT '省份',
    city VARCHAR(32) COMMENT '城市',
    county VARCHAR(64) COMMENT '区县',
    address VARCHAR(256) COMMENT '经营地址',
    longitude DECIMAL(10,6) COMMENT '经度',
    latitude DECIMAL(10,6) COMMENT '纬度',
    application_type VARCHAR(32) NOT NULL COMMENT '申请类型：NEW新办 RENEWAL延续 CHANGE变更 SUSPEND停业 RESUME恢复 CANCEL注销',
    status INT NOT NULL DEFAULT 0 COMMENT '状态：0待初审 1待复审 2待终审 10正常营业 11驳回 20停业 21待延续 22延续审批中 23变更审批中 30注销 31过期',
    tier INT DEFAULT 1 COMMENT '档位（1-30）',
    issue_date DATE COMMENT '发证日期',
    expire_date DATE COMMENT '到期日期',
    first_reviewer_id BIGINT COMMENT '初审人ID',
    first_review_time DATETIME COMMENT '初审时间',
    first_review_opinion VARCHAR(512) COMMENT '初审意见',
    second_reviewer_id BIGINT COMMENT '复审人ID',
    second_review_time DATETIME COMMENT '复审时间',
    second_review_opinion VARCHAR(512) COMMENT '复审意见',
    final_reviewer_id BIGINT COMMENT '终审人ID',
    final_review_time DATETIME COMMENT '终审时间',
    final_review_opinion VARCHAR(512) COMMENT '终审意见',
    county_id BIGINT COMMENT '县局ID',
    station_id BIGINT COMMENT '管理所ID',
    original_license_id BIGINT COMMENT '原许可证ID（变更、延续时关联）',
    remark VARCHAR(512) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_license_no (license_no),
    INDEX idx_retailer_id (retailer_id),
    INDEX idx_status (status),
    INDEX idx_application_type (application_type),
    INDEX idx_county_id (county_id),
    INDEX idx_station_id (station_id),
    INDEX idx_tier (tier),
    INDEX idx_expire_date (expire_date),
    INDEX idx_create_time (create_time),
    INDEX idx_business_type (business_type),
    INDEX idx_longitude_latitude (longitude, latitude),
    INDEX idx_original_license_id (original_license_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='烟草专卖许可证表';

-- =====================================================
-- 4. 卷烟商品表
-- =====================================================
DROP TABLE IF EXISTS cigarette;
CREATE TABLE cigarette (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    cigarette_code VARCHAR(32) NOT NULL COMMENT '卷烟编码',
    cigarette_name VARCHAR(128) NOT NULL COMMENT '卷烟名称',
    brand VARCHAR(64) COMMENT '品牌',
    specification VARCHAR(64) COMMENT '规格',
    unit_price DECIMAL(10,2) NOT NULL COMMENT '单价（元/条）',
    tar_content DECIMAL(4,1) COMMENT '焦油量（mg）',
    nicotine_content DECIMAL(3,1) COMMENT '烟碱量（mg）',
    category VARCHAR(32) COMMENT '分类：一类 二类 三类 四类 五类',
    status TINYINT DEFAULT 1 COMMENT '状态：0下架 1在售',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_cigarette_code (cigarette_code),
    INDEX idx_brand (brand),
    INDEX idx_category (category),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='卷烟商品表';

-- =====================================================
-- 5. 订单表
-- =====================================================
DROP TABLE IF EXISTS tobacco_order;
CREATE TABLE tobacco_order (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    order_no VARCHAR(64) NOT NULL COMMENT '订单编号',
    retailer_id BIGINT NOT NULL COMMENT '零售户ID',
    retailer_name VARCHAR(128) COMMENT '店铺名称',
    license_no VARCHAR(64) COMMENT '许可证编号',
    order_period VARCHAR(32) NOT NULL COMMENT '订货周期',
    total_quantity INT COMMENT '总订货量（条）',
    total_amount DECIMAL(12,2) COMMENT '总金额（元）',
    quota_limit INT COMMENT '配额上限（条）',
    quota_used INT COMMENT '已用配额（条）',
    status TINYINT DEFAULT 1 COMMENT '订单状态：0待审核 1已确认 2已配货 3配送中 4已完成 5已取消',
    delivery_status TINYINT DEFAULT 0 COMMENT '配送状态：0未配送 1配送中 2已送达',
    county_id BIGINT COMMENT '县局ID',
    station_id BIGINT COMMENT '管理所ID',
    remark VARCHAR(512) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_order_no (order_no),
    INDEX idx_retailer_id (retailer_id),
    INDEX idx_order_period (order_period),
    INDEX idx_status (status),
    INDEX idx_delivery_status (delivery_status),
    INDEX idx_county_id (county_id),
    INDEX idx_station_id (station_id),
    INDEX idx_create_time (create_time),
    INDEX idx_license_no (license_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='卷烟订货订单表';

-- =====================================================
-- 6. 订单明细表
-- =====================================================
DROP TABLE IF EXISTS order_item;
CREATE TABLE order_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    order_no VARCHAR(64) NOT NULL COMMENT '订单编号',
    cigarette_code VARCHAR(32) NOT NULL COMMENT '卷烟编码',
    cigarette_name VARCHAR(128) COMMENT '卷烟名称',
    brand VARCHAR(64) COMMENT '品牌',
    specification VARCHAR(64) COMMENT '规格',
    unit_price DECIMAL(10,2) COMMENT '单价（元/条）',
    quantity INT NOT NULL COMMENT '订购数量（条）',
    subtotal DECIMAL(12,2) COMMENT '小计金额（元）',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_order_id (order_id),
    INDEX idx_order_no (order_no),
    INDEX idx_cigarette_code (cigarette_code),
    INDEX idx_brand (brand)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单明细表';

-- =====================================================
-- 7. 稽查任务表
-- =====================================================
DROP TABLE IF EXISTS inspection_task;
CREATE TABLE inspection_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    task_no VARCHAR(64) NOT NULL COMMENT '任务编号',
    task_type VARCHAR(32) COMMENT '任务类型：ROUTINE日常检查 SPECIAL专项检查',
    retailer_id BIGINT COMMENT '零售户ID',
    retailer_name VARCHAR(128) COMMENT '店铺名称',
    license_no VARCHAR(64) COMMENT '许可证编号',
    inspector_id BIGINT COMMENT '稽查员ID',
    inspector_name VARCHAR(64) COMMENT '稽查员姓名',
    risk_level VARCHAR(16) COMMENT '风险等级：high高 risk中 low低',
    grid_id BIGINT COMMENT '网格ID',
    county_id BIGINT COMMENT '县局ID',
    station_id BIGINT COMMENT '管理所ID',
    plan_date DATETIME COMMENT '计划检查时间',
    actual_date DATETIME COMMENT '实际检查时间',
    status TINYINT DEFAULT 0 COMMENT '状态：0待派发 1待执行 2执行中 3已完成',
    has_violation TINYINT DEFAULT 0 COMMENT '是否有违规：0否 1是',
    remark VARCHAR(512) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_task_no (task_no),
    INDEX idx_retailer_id (retailer_id),
    INDEX idx_inspector_id (inspector_id),
    INDEX idx_status (status),
    INDEX idx_risk_level (risk_level),
    INDEX idx_county_id (county_id),
    INDEX idx_station_id (station_id),
    INDEX idx_grid_id (grid_id),
    INDEX idx_plan_date (plan_date),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='稽查任务表';

-- =====================================================
-- 8. 违规记录表
-- =====================================================
DROP TABLE IF EXISTS violation_record;
CREATE TABLE violation_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    record_no VARCHAR(64) NOT NULL COMMENT '记录编号',
    task_id BIGINT COMMENT '关联任务ID',
    retailer_id BIGINT NOT NULL COMMENT '零售户ID',
    retailer_name VARCHAR(128) COMMENT '店铺名称',
    license_no VARCHAR(64) COMMENT '许可证编号',
    violation_type INT NOT NULL COMMENT '违规类型：1无证经营 2超范围经营 3假冒卷烟 4未明码标价 5价格欺诈 6非法渠道进货 7向未成年人销售 8其他',
    violation_type_name VARCHAR(32) COMMENT '违规类型名称',
    severity VARCHAR(16) COMMENT '严重程度：high高 medium中 low低',
    description VARCHAR(1024) COMMENT '违规描述',
    inspector_id BIGINT COMMENT '检查人ID',
    inspector_name VARCHAR(64) COMMENT '检查人姓名',
    county_id BIGINT COMMENT '县局ID',
    station_id BIGINT COMMENT '管理所ID',
    deduct_points INT COMMENT '扣减信用分',
    has_triggered_penalty TINYINT DEFAULT 0 COMMENT '是否触发许可证处罚：0否 1是',
    penalty_type VARCHAR(32) COMMENT '处罚类型：SUSPEND停业 CANCEL注销 FINE罚款 WARNING警告',
    status TINYINT DEFAULT 0 COMMENT '状态：0待处理 1已处理 2已结案',
    disposal_opinion VARCHAR(512) COMMENT '处理意见',
    disposal_time DATETIME COMMENT '处理时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_record_no (record_no),
    INDEX idx_task_id (task_id),
    INDEX idx_retailer_id (retailer_id),
    INDEX idx_violation_type (violation_type),
    INDEX idx_severity (severity),
    INDEX idx_status (status),
    INDEX idx_county_id (county_id),
    INDEX idx_station_id (station_id),
    INDEX idx_create_time (create_time),
    INDEX idx_license_no (license_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='违规记录表';

-- =====================================================
-- 9. 配送计划表
-- =====================================================
DROP TABLE IF EXISTS delivery_plan;
CREATE TABLE delivery_plan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    plan_no VARCHAR(64) NOT NULL COMMENT '计划编号',
    delivery_date DATETIME COMMENT '配送日期',
    order_period VARCHAR(32) COMMENT '订货周期',
    total_orders INT COMMENT '总订单数',
    total_quantity INT COMMENT '总件数',
    fleet_count INT COMMENT '车队数',
    vehicle_count INT COMMENT '车辆数',
    status TINYINT DEFAULT 0 COMMENT '状态：0草稿 1已生成 2配送中 3已完成',
    calc_time DECIMAL(8,3) COMMENT '算法计算耗时（秒）',
    county_id BIGINT COMMENT '县局ID',
    remark VARCHAR(512) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_plan_no (plan_no),
    INDEX idx_order_period (order_period),
    INDEX idx_status (status),
    INDEX idx_delivery_date (delivery_date),
    INDEX idx_county_id (county_id),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='配送计划表';

-- =====================================================
-- 10. 配送路线表
-- =====================================================
DROP TABLE IF EXISTS delivery_route;
CREATE TABLE delivery_route (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    plan_id BIGINT NOT NULL COMMENT '配送计划ID',
    route_no VARCHAR(64) NOT NULL COMMENT '路线编号',
    fleet_id BIGINT COMMENT '车队ID',
    vehicle_no VARCHAR(32) COMMENT '车牌号',
    driver_name VARCHAR(64) COMMENT '司机姓名',
    delivery_count INT COMMENT '配送点数量',
    total_load INT COMMENT '总载重（件）',
    load_rate DECIMAL(5,2) COMMENT '装载率（%）',
    estimated_distance DECIMAL(8,2) COMMENT '预计里程（公里）',
    estimated_duration DECIMAL(6,2) COMMENT '预计时长（小时）',
    start_point VARCHAR(128) COMMENT '起点',
    end_point VARCHAR(128) COMMENT '终点',
    delivery_sequence TEXT COMMENT '配送顺序JSON',
    status TINYINT DEFAULT 0 COMMENT '状态：0待出发 1配送中 2已完成',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_route_no (route_no),
    INDEX idx_plan_id (plan_id),
    INDEX idx_fleet_id (fleet_id),
    INDEX idx_vehicle_no (vehicle_no),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='配送路线表';

-- =====================================================
-- 11. 配送明细表
-- =====================================================
DROP TABLE IF EXISTS delivery_detail;
CREATE TABLE delivery_detail (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    route_id BIGINT NOT NULL COMMENT '路线ID',
    plan_id BIGINT NOT NULL COMMENT '计划ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    order_no VARCHAR(64) NOT NULL COMMENT '订单编号',
    retailer_id BIGINT COMMENT '零售户ID',
    retailer_name VARCHAR(128) COMMENT '店铺名称',
    address VARCHAR(256) COMMENT '配送地址',
    longitude DECIMAL(10,6) COMMENT '经度',
    latitude DECIMAL(10,6) COMMENT '纬度',
    quantity INT COMMENT '配送数量（件）',
    sequence_number INT COMMENT '配送顺序号',
    estimated_arrival_time DATETIME COMMENT '预计到达时间',
    status TINYINT DEFAULT 0 COMMENT '状态：0待配送 1配送中 2已送达',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_route_id (route_id),
    INDEX idx_plan_id (plan_id),
    INDEX idx_order_id (order_id),
    INDEX idx_retailer_id (retailer_id),
    INDEX idx_sequence_number (sequence_number),
    INDEX idx_longitude_latitude (longitude, latitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='配送明细表';

-- =====================================================
-- 12. 信用记录表
-- =====================================================
DROP TABLE IF EXISTS credit_record;
CREATE TABLE credit_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    record_no VARCHAR(64) NOT NULL COMMENT '记录编号',
    retailer_id BIGINT NOT NULL COMMENT '零售户ID',
    retailer_name VARCHAR(128) COMMENT '店铺名称',
    license_no VARCHAR(64) COMMENT '许可证编号',
    change_type VARCHAR(16) NOT NULL COMMENT '变更类型：DEDUCT扣分 BONUS加分 REPAIR修复',
    change_reason VARCHAR(256) COMMENT '变更原因',
    source_id BIGINT COMMENT '来源ID',
    source_type VARCHAR(32) COMMENT '来源类型：VIOLATION违规 FULFILLMENT履约 PERIOD_CHECK周期检查',
    before_score INT COMMENT '变更前分数',
    change_score INT COMMENT '变更分数（正加负减）',
    after_score INT COMMENT '变更后分数',
    before_level VARCHAR(8) COMMENT '变更前等级',
    after_level VARCHAR(8) COMMENT '变更后等级',
    county_id BIGINT COMMENT '县局ID',
    station_id BIGINT COMMENT '管理所ID',
    operator_id BIGINT COMMENT '操作人ID',
    operator_name VARCHAR(64) COMMENT '操作人姓名',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_record_no (record_no),
    INDEX idx_retailer_id (retailer_id),
    INDEX idx_change_type (change_type),
    INDEX idx_source_type (source_type),
    INDEX idx_county_id (county_id),
    INDEX idx_station_id (station_id),
    INDEX idx_create_time (create_time),
    INDEX idx_license_no (license_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='信用变更记录表';

-- =====================================================
-- 13. 县局/管理所表
-- =====================================================
DROP TABLE IF EXISTS sys_org;
CREATE TABLE sys_org (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    org_code VARCHAR(64) NOT NULL COMMENT '机构编码',
    org_name VARCHAR(128) NOT NULL COMMENT '机构名称',
    org_type VARCHAR(32) NOT NULL COMMENT '机构类型：CITY市局 COUNTY县局 STATION管理所',
    parent_id BIGINT COMMENT '父机构ID',
    leader_id BIGINT COMMENT '负责人ID',
    address VARCHAR(256) COMMENT '地址',
    phone VARCHAR(20) COMMENT '联系电话',
    sort INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '状态：0禁用 1启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_org_code (org_code),
    INDEX idx_parent_id (parent_id),
    INDEX idx_org_type (org_type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='组织机构表';

-- =====================================================
-- 初始化数据
-- =====================================================

-- 初始化管理员用户（密码: 123456，BCrypt加密）
INSERT INTO sys_user (username, password, real_name, role_code, phone, status) VALUES
('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '系统管理员', 'ROLE_CITY_ADMIN', '13800000000', 1),
('county_admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '县局管理员', 'ROLE_COUNTY_ADMIN', '13800000001', 1),
('inspector1', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '稽查员张三', 'ROLE_INSPECTOR', '13800000002', 1),
('auditor1', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '审核员李四', 'ROLE_AUDITOR', '13800000003', 1),
('retailer1', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '阳光便利店', 'ROLE_RETAILER', '13800000004', 1);

-- 初始化卷烟商品
INSERT INTO cigarette (cigarette_code, cigarette_name, brand, specification, unit_price, tar_content, nicotine_content, category, status) VALUES
('HY001', '黄鹤楼（硬1916）', '黄鹤楼', '硬盒', 1000.00, 10.0, 1.0, '一类', 1),
('HY002', '黄鹤楼（软蓝）', '黄鹤楼', '软盒', 180.00, 11.0, 1.1, '二类', 1),
('ZH001', '中华（软）', '中华', '软盒', 700.00, 11.0, 1.0, '一类', 1),
('ZH002', '中华（硬）', '中华', '硬盒', 450.00, 12.0, 1.1, '一类', 1),
('YT001', '云烟（紫）', '云烟', '硬盒', 100.00, 12.0, 1.1, '三类', 1),
('YT002', '云烟（软珍品）', '云烟', '软盒', 230.00, 11.0, 1.0, '二类', 1),
('YL001', '玉溪（软）', '玉溪', '软盒', 230.00, 11.0, 1.0, '二类', 1),
('HN001', '红河（硬甲）', '红河', '硬盒', 60.00, 13.0, 1.2, '四类', 1),
('BS001', '白沙（硬）', '白沙', '硬盒', 80.00, 12.0, 1.1, '三类', 1),
('NT001', '南京（炫赫门）', '南京', '硬盒', 160.00, 8.0, 0.8, '二类', 1);

-- 初始化零售户
INSERT INTO retailer (user_id, retailer_name, license_no, legal_person, id_card_no, phone, province, city, county, address, longitude, latitude, business_type, tier, credit_level, credit_score, register_date, county_id, station_id, grid_id, status) VALUES
(5, '阳光便利店', 'TC2024010100001', '张三', '370101199001011234', '13800138001', '山东省', '济南市', '历下区', '济南市历下区解放路100号', 117.010000, 36.670000, '便利店', 15, 'A', 85, '2020-01-01', 1, 1, 1, 1),
(null, '万家超市', 'TC2024010100002', '李四', '370101199002022345', '13800138002', '山东省', '济南市', '历下区', '济南市历下区文化路50号', 117.020000, 36.650000, '超市', 20, 'AA', 92, '2019-06-15', 1, 1, 1, 1),
(null, '好又多商店', 'TC2024010100003', '王五', '370101199003033456', '13800138003', '山东省', '济南市', '市中区', '济南市市中区经七路200号', 116.980000, 36.660000, '便利店', 12, 'BBB', 70, '2021-03-10', 2, 2, 2, 1),
(null, '福临门烟酒', 'TC2024010100004', '赵六', '370101199004044567', '13800138004', '山东省', '济南市', '天桥区', '济南市天桥区堤口路80号', 116.950000, 36.680000, '烟酒商店', 18, 'BBB', 78, '2020-08-20', 3, 3, 3, 1),
(null, '鑫鑫小卖部', 'TC2024010100005', '孙七', '370101199005055678', '13800138005', '山东省', '济南市', '槐荫区', '济南市槐荫区经十路300号', 116.900000, 36.640000, '小卖部', 8, 'BB', 60, '2022-01-05', 4, 4, 4, 1);

-- 初始化许可证
INSERT INTO license (license_no, retailer_id, retailer_name, license_type, business_type, business_scope, legal_person, id_card_no, phone, province, city, county, address, longitude, latitude, application_type, status, tier, issue_date, expire_date, county_id, station_id) VALUES
('TC2024010100001', 1, '阳光便利店', '烟草专卖零售许可证', '便利店', '卷烟、雪茄烟', '张三', '370101199001011234', '13800138001', '山东省', '济南市', '历下区', '济南市历下区解放路100号', 117.010000, 36.670000, 'NEW', 10, 15, '2020-01-01', '2025-12-31', 1, 1),
('TC2024010100002', 2, '万家超市', '烟草专卖零售许可证', '超市', '卷烟、雪茄烟', '李四', '370101199002022345', '13800138002', '山东省', '济南市', '历下区', '济南市历下区文化路50号', 117.020000, 36.650000, 'NEW', 10, 20, '2019-06-15', '2024-06-14', 1, 1),
('TC2024010100003', 3, '好又多商店', '烟草专卖零售许可证', '便利店', '卷烟、雪茄烟', '王五', '370101199003033456', '13800138003', '山东省', '济南市', '市中区', '济南市市中区经七路200号', 116.980000, 36.660000, 'NEW', 10, 12, '2021-03-10', '2026-03-09', 2, 2),
('TC2024010100004', 4, '福临门烟酒', '烟草专卖零售许可证', '烟酒商店', '卷烟、雪茄烟', '赵六', '370101199004044567', '13800138004', '山东省', '济南市', '天桥区', '济南市天桥区堤口路80号', 116.950000, 36.680000, 'NEW', 10, 18, '2020-08-20', '2025-08-19', 3, 3);
