-- =============================================
-- 保险理赔管理系统数据库初始化脚本
-- 数据库: MySQL 8.0+
-- 字符集: utf8mb4
-- =============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS claim_management DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE claim_management;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================
-- 1. 用户表
-- =============================================
DROP TABLE IF EXISTS sys_user;
CREATE TABLE sys_user (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    username VARCHAR(64) NOT NULL COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码(BCrypt加密)',
    real_name VARCHAR(64) NOT NULL COMMENT '真实姓名',
    id_card VARCHAR(32) DEFAULT NULL COMMENT '身份证号',
    phone VARCHAR(32) DEFAULT NULL COMMENT '手机号',
    email VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
    avatar VARCHAR(255) DEFAULT NULL COMMENT '头像URL',
    role TINYINT NOT NULL DEFAULT 0 COMMENT '角色: 1-管理员 2-查勘员 3-定损员 4-核赔师 5-财务专员 6-报案人 7-欺诈调查员',
    department VARCHAR(128) DEFAULT NULL COMMENT '部门',
    branch_code VARCHAR(32) DEFAULT NULL COMMENT '分支机构编码',
    branch_name VARCHAR(128) DEFAULT NULL COMMENT '分支机构名称',
    work_area VARCHAR(255) DEFAULT NULL COMMENT '工作区域',
    work_longitude DECIMAL(10, 7) DEFAULT NULL COMMENT '工作经度',
    work_latitude DECIMAL(10, 7) DEFAULT NULL COMMENT '工作纬度',
    work_radius INT DEFAULT 5000 COMMENT '工作半径(米)',
    employee_no VARCHAR(32) DEFAULT NULL COMMENT '员工编号',
    qualification_no VARCHAR(64) DEFAULT NULL COMMENT '资质证书编号',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0-禁用 1-启用',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-未删除 1-已删除',
    last_login_time DATETIME DEFAULT NULL COMMENT '最后登录时间',
    last_login_ip VARCHAR(64) DEFAULT NULL COMMENT '最后登录IP',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_username (username),
    UNIQUE KEY uk_phone (phone),
    KEY idx_role (role),
    KEY idx_branch_code (branch_code),
    KEY idx_status (status),
    KEY idx_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- =============================================
-- 2. 保单表
-- =============================================
DROP TABLE IF EXISTS policy;
CREATE TABLE policy (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    policy_no VARCHAR(64) NOT NULL COMMENT '保单号',
    insurance_type TINYINT NOT NULL COMMENT '险种: 1-车险 2-家财险 3-企财险',
    product_code VARCHAR(64) DEFAULT NULL COMMENT '产品代码',
    product_name VARCHAR(128) DEFAULT NULL COMMENT '产品名称',
    policyholder_name VARCHAR(64) NOT NULL COMMENT '投保人姓名',
    policyholder_id_card VARCHAR(32) DEFAULT NULL COMMENT '投保人身份证',
    policyholder_phone VARCHAR(32) DEFAULT NULL COMMENT '投保人电话',
    insured_name VARCHAR(64) DEFAULT NULL COMMENT '被保险人姓名',
    insured_id_card VARCHAR(32) DEFAULT NULL COMMENT '被保险人身份证',
    insured_phone VARCHAR(32) DEFAULT NULL COMMENT '被保险人电话',
    total_premium DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT '总保费',
    total_coverage DECIMAL(14, 2) NOT NULL DEFAULT 0.00 COMMENT '总保额',
    deductible DECIMAL(12, 2) DEFAULT 0.00 COMMENT '绝对免赔额',
    deductible_ratio DECIMAL(5, 2) DEFAULT 0.00 COMMENT '免赔率(%)',
    effective_date DATE NOT NULL COMMENT '生效日期',
    expiry_date DATE NOT NULL COMMENT '到期日期',
    vehicle_plate_no VARCHAR(32) DEFAULT NULL COMMENT '车牌号(车险)',
    vehicle_frame_no VARCHAR(64) DEFAULT NULL COMMENT '车架号(车险)',
    vehicle_engine_no VARCHAR(64) DEFAULT NULL COMMENT '发动机号(车险)',
    vehicle_brand VARCHAR(64) DEFAULT NULL COMMENT '车辆品牌(车险)',
    vehicle_model VARCHAR(64) DEFAULT NULL COMMENT '车辆型号(车险)',
    vehicle_register_year INT DEFAULT NULL COMMENT '车辆注册年份(车险)',
    property_address VARCHAR(255) DEFAULT NULL COMMENT '财产地址(家财险)',
    property_value DECIMAL(14, 2) DEFAULT NULL COMMENT '财产价值(家财险)',
    enterprise_name VARCHAR(128) DEFAULT NULL COMMENT '企业名称(企财险)',
    enterprise_address VARCHAR(255) DEFAULT NULL COMMENT '企业地址(企财险)',
    policy_status TINYINT NOT NULL DEFAULT 1 COMMENT '保单状态: 0-未生效 1-有效 2-已过期 3-已注销',
    branch_code VARCHAR(32) DEFAULT NULL COMMENT '承保分支机构编码',
    branch_name VARCHAR(128) DEFAULT NULL COMMENT '承保分支机构名称',
    agent_code VARCHAR(32) DEFAULT NULL COMMENT '代理人编码',
    agent_name VARCHAR(64) DEFAULT NULL COMMENT '代理人姓名',
    claim_count INT NOT NULL DEFAULT 0 COMMENT '理赔次数',
    total_claim_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00 COMMENT '累计赔付金额',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-未删除 1-已删除',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_policy_no (policy_no),
    KEY idx_insurance_type (insurance_type),
    KEY idx_policyholder_id_card (policyholder_id_card),
    KEY idx_vehicle_plate_no (vehicle_plate_no),
    KEY idx_effective_date (effective_date),
    KEY idx_expiry_date (expiry_date),
    KEY idx_branch_code (branch_code),
    KEY idx_policy_status (policy_status),
    KEY idx_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='保单表';

-- =============================================
-- 3. 理赔案件表
-- =============================================
DROP TABLE IF EXISTS claim;
CREATE TABLE claim (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    claim_no VARCHAR(64) NOT NULL COMMENT '理赔案件编号',
    policy_no VARCHAR(64) NOT NULL COMMENT '保单号',
    insurance_type TINYINT NOT NULL COMMENT '险种: 1-车险 2-家财险 3-企财险',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '案件状态: 1-已报案 2-待派工 3-已派工 4-查勘中 5-查勘完成 6-定损中 7-定损完成 8-待核赔 9-核赔中 10-核赔通过 11-核赔退回 12-赔款计算中 13-赔款计算完成 14-已支付 15-已结案 16-已注销',
    accident_time DATETIME NOT NULL COMMENT '事故时间',
    accident_location VARCHAR(255) DEFAULT NULL COMMENT '事故地点',
    accident_province VARCHAR(64) DEFAULT NULL COMMENT '事故省份',
    accident_city VARCHAR(64) DEFAULT NULL COMMENT '事故城市',
    accident_district VARCHAR(64) DEFAULT NULL COMMENT '事故区县',
    accident_longitude DECIMAL(10, 7) DEFAULT NULL COMMENT '事故经度',
    accident_latitude DECIMAL(10, 7) DEFAULT NULL COMMENT '事故纬度',
    accident_description TEXT COMMENT '事故经过描述',
    reporter_name VARCHAR(64) NOT NULL COMMENT '报案人姓名',
    reporter_phone VARCHAR(32) NOT NULL COMMENT '报案人电话',
    reporter_id_card VARCHAR(32) DEFAULT NULL COMMENT '报案人身份证',
    estimated_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '预估损失金额',
    total_loss_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '定损总金额',
    deductible_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '免赔金额',
    payable_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '应赔金额',
    paid_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '已赔金额',
    liability_ratio INT DEFAULT 100 COMMENT '责任比例(%)',
    accident_count INT DEFAULT 0 COMMENT '保单事故次数',
    floating_coefficient DECIMAL(5, 4) DEFAULT 1.0000 COMMENT '浮动系数',
    surveyor_id BIGINT DEFAULT NULL COMMENT '查勘员ID',
    surveyor_name VARCHAR(64) DEFAULT NULL COMMENT '查勘员姓名',
    assessor_id BIGINT DEFAULT NULL COMMENT '定损员ID',
    assessor_name VARCHAR(64) DEFAULT NULL COMMENT '定损员姓名',
    reviewer_id BIGINT DEFAULT NULL COMMENT '核赔师ID',
    reviewer_name VARCHAR(64) DEFAULT NULL COMMENT '核赔师姓名',
    finance_id BIGINT DEFAULT NULL COMMENT '财务专员ID',
    finance_name VARCHAR(64) DEFAULT NULL COMMENT '财务专员姓名',
    fraud_score INT DEFAULT 0 COMMENT '欺诈风险评分(0-100)',
    fraud_flags VARCHAR(255) DEFAULT NULL COMMENT '欺诈风险标识(逗号分隔)',
    fraud_suspicious TINYINT DEFAULT 0 COMMENT '是否可疑欺诈: 0-否 1-是',
    review_comments TEXT COMMENT '核赔意见',
    reject_reason VARCHAR(500) DEFAULT NULL COMMENT '退回原因',
    reported_at DATETIME DEFAULT NULL COMMENT '报案时间',
    survey_assigned_at DATETIME DEFAULT NULL COMMENT '查勘派工时间',
    survey_completed_at DATETIME DEFAULT NULL COMMENT '查勘完成时间',
    assessment_completed_at DATETIME DEFAULT NULL COMMENT '定损完成时间',
    review_completed_at DATETIME DEFAULT NULL COMMENT '核赔完成时间',
    calculation_completed_at DATETIME DEFAULT NULL COMMENT '赔款计算完成时间',
    payment_completed_at DATETIME DEFAULT NULL COMMENT '支付完成时间',
    closed_at DATETIME DEFAULT NULL COMMENT '结案时间',
    remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
    version INT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-未删除 1-已删除',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_claim_no (claim_no),
    KEY idx_policy_no (policy_no),
    KEY idx_insurance_type (insurance_type),
    KEY idx_status (status),
    KEY idx_reporter_id_card (reporter_id_card),
    KEY idx_reporter_phone (reporter_phone),
    KEY idx_accident_time (accident_time),
    KEY idx_reported_at (reported_at),
    KEY idx_surveyor_id (surveyor_id),
    KEY idx_assessor_id (assessor_id),
    KEY idx_reviewer_id (reviewer_id),
    KEY idx_fraud_suspicious (fraud_suspicious),
    KEY idx_status_reported (status, reported_at),
    KEY idx_deleted (deleted),
    KEY idx_insurance_status (insurance_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='理赔案件表';

-- =============================================
-- 4. 查勘记录表
-- =============================================
DROP TABLE IF EXISTS survey;
CREATE TABLE survey (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    claim_id BIGINT NOT NULL COMMENT '理赔案件ID',
    claim_no VARCHAR(64) NOT NULL COMMENT '理赔案件编号',
    surveyor_id BIGINT DEFAULT NULL COMMENT '查勘员ID',
    surveyor_name VARCHAR(64) DEFAULT NULL COMMENT '查勘员姓名',
    surveyor_phone VARCHAR(32) DEFAULT NULL COMMENT '查勘员电话',
    assigned_at DATETIME DEFAULT NULL COMMENT '派工时间',
    departed_at DATETIME DEFAULT NULL COMMENT '出发时间',
    arrived_at DATETIME DEFAULT NULL COMMENT '到达时间',
    depart_longitude DECIMAL(10, 7) DEFAULT NULL COMMENT '出发经度',
    depart_latitude DECIMAL(10, 7) DEFAULT NULL COMMENT '出发纬度',
    arrive_longitude DECIMAL(10, 7) DEFAULT NULL COMMENT '到达经度',
    arrive_latitude DECIMAL(10, 7) DEFAULT NULL COMMENT '到达纬度',
    gps_distance DECIMAL(10, 2) DEFAULT NULL COMMENT 'GPS行驶距离(公里)',
    gps_verified TINYINT DEFAULT 0 COMMENT 'GPS校验是否通过: 0-否 1-是',
    weather_condition VARCHAR(64) DEFAULT NULL COMMENT '天气情况',
    road_condition VARCHAR(64) DEFAULT NULL COMMENT '道路情况',
    site_description TEXT COMMENT '现场情况描述',
    damage_description TEXT COMMENT '损失情况描述',
    scene_diagram VARCHAR(255) DEFAULT NULL COMMENT '现场示意图URL',
    liability_ratio INT DEFAULT 100 COMMENT '查勘判定责任比例(%)',
    liability_determination VARCHAR(255) DEFAULT NULL COMMENT '责任认定说明',
    police_report_no VARCHAR(64) DEFAULT NULL COMMENT '交警认定书编号',
    police_opinion TEXT COMMENT '交警意见',
    estimated_loss_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '查勘预估损失金额',
    survey_comments TEXT COMMENT '查勘意见',
    completed_at DATETIME DEFAULT NULL COMMENT '查勘完成时间',
    remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-未删除 1-已删除',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_claim_id (claim_id),
    KEY idx_claim_no (claim_no),
    KEY idx_surveyor_id (surveyor_id),
    KEY idx_assigned_at (assigned_at),
    KEY idx_completed_at (completed_at),
    KEY idx_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='查勘记录表';

-- =============================================
-- 5. 定损评估表
-- =============================================
DROP TABLE IF EXISTS loss_assessment;
CREATE TABLE loss_assessment (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    claim_id BIGINT NOT NULL COMMENT '理赔案件ID',
    claim_no VARCHAR(64) NOT NULL COMMENT '理赔案件编号',
    assessor_id BIGINT DEFAULT NULL COMMENT '定损员ID',
    assessor_name VARCHAR(64) DEFAULT NULL COMMENT '定损员姓名',
    assessment_time DATETIME DEFAULT NULL COMMENT '定损时间',
    total_loss_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT '总损失金额',
    material_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '材料费',
    labor_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '工时费',
    other_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '其他费用',
    salvage_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '残值',
    deductible_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '免赔金额',
    payable_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '赔付金额',
    repair_shop VARCHAR(128) DEFAULT NULL COMMENT '维修厂名称',
    repair_shop_level VARCHAR(32) DEFAULT NULL COMMENT '维修厂级别',
    assessment_basis VARCHAR(255) DEFAULT NULL COMMENT '定损依据',
    assessment_comments TEXT COMMENT '定损说明',
    approval_required TINYINT DEFAULT 0 COMMENT '是否需要审批: 0-否 1-是',
    approval_status TINYINT DEFAULT 0 COMMENT '审批状态: 0-待审批 1-已通过 2-已驳回',
    approver_id BIGINT DEFAULT NULL COMMENT '审批人ID',
    approver_name VARCHAR(64) DEFAULT NULL COMMENT '审批人姓名',
    approval_time DATETIME DEFAULT NULL COMMENT '审批时间',
    approval_comments TEXT COMMENT '审批意见',
    status TINYINT DEFAULT 1 COMMENT '状态: 1-定损中 2-已完成 3-已驳回',
    remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
    version INT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-未删除 1-已删除',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_claim_id (claim_id),
    KEY idx_claim_no (claim_no),
    KEY idx_assessor_id (assessor_id),
    KEY idx_status (status),
    KEY idx_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定损评估表';

-- =============================================
-- 6. 损失项目明细表
-- =============================================
DROP TABLE IF EXISTS loss_item;
CREATE TABLE loss_item (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    assessment_id BIGINT NOT NULL COMMENT '定损评估ID',
    claim_id BIGINT NOT NULL COMMENT '理赔案件ID',
    claim_no VARCHAR(64) NOT NULL COMMENT '理赔案件编号',
    item_type TINYINT NOT NULL COMMENT '项目类型: 1-配件 2-工时 3-其他',
    item_code VARCHAR(64) DEFAULT NULL COMMENT '项目编码',
    item_name VARCHAR(255) NOT NULL COMMENT '项目名称',
    item_category VARCHAR(64) DEFAULT NULL COMMENT '项目类别',
    quantity INT NOT NULL DEFAULT 1 COMMENT '数量',
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '单价',
    total_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT '总价',
    guide_price DECIMAL(10, 2) DEFAULT NULL COMMENT '指导价',
    price_deviation DECIMAL(5, 2) DEFAULT NULL COMMENT '价格偏差率(%)',
    exceed_standard TINYINT DEFAULT 0 COMMENT '是否超标: 0-否 1-是',
    part_brand VARCHAR(64) DEFAULT NULL COMMENT '配件品牌',
    part_origin VARCHAR(64) DEFAULT NULL COMMENT '配件产地',
    labor_hours DECIMAL(6, 2) DEFAULT NULL COMMENT '工时数',
    hourly_rate DECIMAL(8, 2) DEFAULT NULL COMMENT '工时单价',
    vehicle_side VARCHAR(32) DEFAULT NULL COMMENT '车辆部位',
    damage_degree VARCHAR(32) DEFAULT NULL COMMENT '损坏程度',
    repair_mode VARCHAR(32) DEFAULT NULL COMMENT '维修方式: 更换/维修/钣金/喷漆',
    remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-未删除 1-已删除',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_assessment_id (assessment_id),
    KEY idx_claim_id (claim_id),
    KEY idx_claim_no (claim_no),
    KEY idx_item_type (item_type),
    KEY idx_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='损失项目明细表';

-- =============================================
-- 7. 涉案方表
-- =============================================
DROP TABLE IF EXISTS claim_party;
CREATE TABLE claim_party (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    claim_id BIGINT NOT NULL COMMENT '理赔案件ID',
    claim_no VARCHAR(64) NOT NULL COMMENT '理赔案件编号',
    party_type TINYINT NOT NULL COMMENT '涉案方类型: 1-我方 2-三者方 3-物损方 4-受伤人员',
    party_name VARCHAR(64) DEFAULT NULL COMMENT '姓名/名称',
    party_id_card VARCHAR(32) DEFAULT NULL COMMENT '身份证号',
    party_phone VARCHAR(32) DEFAULT NULL COMMENT '联系电话',
    party_address VARCHAR(255) DEFAULT NULL COMMENT '地址',
    driver_license_no VARCHAR(32) DEFAULT NULL COMMENT '驾驶证号',
    driver_license_type VARCHAR(16) DEFAULT NULL COMMENT '驾驶证类型',
    vehicle_plate_no VARCHAR(32) DEFAULT NULL COMMENT '车牌号',
    vehicle_type VARCHAR(64) DEFAULT NULL COMMENT '车辆类型',
    vehicle_usage VARCHAR(32) DEFAULT NULL COMMENT '车辆使用性质',
    insurance_company VARCHAR(128) DEFAULT NULL COMMENT '保险公司',
    policy_no VARCHAR(64) DEFAULT NULL COMMENT '保单号',
    insurance_amount DECIMAL(14, 2) DEFAULT NULL COMMENT '保险金额',
    liability_ratio INT DEFAULT 0 COMMENT '责任比例(%)',
    injury_description TEXT COMMENT '伤情描述',
    property_damage_description TEXT COMMENT '财产损失描述',
    remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-未删除 1-已删除',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_claim_id (claim_id),
    KEY idx_claim_no (claim_no),
    KEY idx_party_type (party_type),
    KEY idx_party_id_card (party_id_card),
    KEY idx_vehicle_plate_no (vehicle_plate_no),
    KEY idx_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='涉案方表';

-- =============================================
-- 8. 理赔文档表
-- =============================================
DROP TABLE IF EXISTS claim_document;
CREATE TABLE claim_document (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    claim_id BIGINT NOT NULL COMMENT '理赔案件ID',
    claim_no VARCHAR(64) NOT NULL COMMENT '理赔案件编号',
    business_id BIGINT DEFAULT NULL COMMENT '业务ID(查勘/定损等)',
    business_type VARCHAR(32) DEFAULT NULL COMMENT '业务类型: claim/survey/assessment/review/payment',
    document_type TINYINT NOT NULL COMMENT '文档类型: 1-事故照片 2-查勘照片 3-定损照片 4-交警认定书 5-行驶证 6-驾驶证 7-身份证 8-保单 9-维修发票 10-视频 11-其他',
    document_name VARCHAR(255) NOT NULL COMMENT '文档名称',
    document_url VARCHAR(500) NOT NULL COMMENT '文档访问URL',
    file_type VARCHAR(32) DEFAULT NULL COMMENT '文件类型: jpg/png/pdf/mp4等',
    file_size BIGINT DEFAULT NULL COMMENT '文件大小(字节)',
    storage_path VARCHAR(500) DEFAULT NULL COMMENT '存储路径',
    storage_bucket VARCHAR(128) DEFAULT NULL COMMENT '存储桶',
    md5 VARCHAR(32) DEFAULT NULL COMMENT '文件MD5',
    upload_status TINYINT DEFAULT 1 COMMENT '上传状态: 0-上传中 1-上传成功 2-上传失败',
    uploader_id BIGINT DEFAULT NULL COMMENT '上传人ID',
    uploader_name VARCHAR(64) DEFAULT NULL COMMENT '上传人姓名',
    remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-未删除 1-已删除',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_claim_id (claim_id),
    KEY idx_claim_no (claim_no),
    KEY idx_business (business_id, business_type),
    KEY idx_document_type (document_type),
    KEY idx_uploader_id (uploader_id),
    KEY idx_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='理赔文档表';

-- =============================================
-- 9. 核赔审核表
-- =============================================
DROP TABLE IF EXISTS claim_review;
CREATE TABLE claim_review (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    claim_id BIGINT NOT NULL COMMENT '理赔案件ID',
    claim_no VARCHAR(64) NOT NULL COMMENT '理赔案件编号',
    reviewer_id BIGINT DEFAULT NULL COMMENT '核赔师ID',
    reviewer_name VARCHAR(64) DEFAULT NULL COMMENT '核赔师姓名',
    review_level TINYINT DEFAULT 1 COMMENT '审核级别: 1-一级 2-二级 3-三级',
    review_type VARCHAR(32) DEFAULT NULL COMMENT '审核类型: auto-自动审核 manual-人工审核',
    claim_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '报案金额',
    reviewed_amount DECIMAL(12, 2) DEFAULT 0.00 COMMENT '审核金额',
    review_result TINYINT DEFAULT 0 COMMENT '审核结果: 0-待审核 1-通过 2-退回 3-需补充材料',
    review_comments TEXT COMMENT '审核意见',
    reject_reason VARCHAR(500) DEFAULT NULL COMMENT '退回原因',
    supplement_requirements TEXT COMMENT '补充材料要求',
    review_start_time DATETIME DEFAULT NULL COMMENT '审核开始时间',
    review_end_time DATETIME DEFAULT NULL COMMENT '审核结束时间',
    review_duration INT DEFAULT NULL COMMENT '审核时长(秒)',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-未删除 1-已删除',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_claim_id (claim_id),
    KEY idx_claim_no (claim_no),
    KEY idx_reviewer_id (reviewer_id),
    KEY idx_review_result (review_result),
    KEY idx_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='核赔审核表';

-- =============================================
-- 10. 支付记录表
-- =============================================
DROP TABLE IF EXISTS payment;
CREATE TABLE payment (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    claim_id BIGINT NOT NULL COMMENT '理赔案件ID',
    claim_no VARCHAR(64) NOT NULL COMMENT '理赔案件编号',
    payment_no VARCHAR(64) NOT NULL COMMENT '支付流水号',
    payment_type TINYINT NOT NULL DEFAULT 1 COMMENT '支付类型: 1-赔款支付 2-预付款 3-尾款',
    payment_amount DECIMAL(12, 2) NOT NULL COMMENT '支付金额',
    payee_type TINYINT DEFAULT 1 COMMENT '收款方类型: 1-被保险人 2-维修厂 3-医院 4-第三方',
    payee_name VARCHAR(128) NOT NULL COMMENT '收款方名称',
    payee_bank VARCHAR(128) DEFAULT NULL COMMENT '收款银行',
    payee_account VARCHAR(64) DEFAULT NULL COMMENT '收款账号',
    payee_id_card VARCHAR(32) DEFAULT NULL COMMENT '收款方身份证',
    payment_method TINYINT DEFAULT 1 COMMENT '支付方式: 1-银行转账 2-第三方支付 3-现金',
    payment_channel VARCHAR(32) DEFAULT NULL COMMENT '支付渠道',
    payment_status TINYINT NOT NULL DEFAULT 1 COMMENT '支付状态: 1-待支付 2-支付中 3-支付成功 4-支付失败 5-已退款',
    payment_time DATETIME DEFAULT NULL COMMENT '支付时间',
    arrive_time DATETIME DEFAULT NULL COMMENT '到账时间',
    retry_count INT NOT NULL DEFAULT 0 COMMENT '重试次数',
    gateway_order_no VARCHAR(128) DEFAULT NULL COMMENT '网关订单号',
    gateway_response TEXT COMMENT '网关返回信息',
    voucher_url VARCHAR(255) DEFAULT NULL COMMENT '电子凭证URL',
    operator_id BIGINT DEFAULT NULL COMMENT '操作人ID',
    operator_name VARCHAR(64) DEFAULT NULL COMMENT '操作人姓名',
    fail_reason VARCHAR(500) DEFAULT NULL COMMENT '失败原因',
    remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-未删除 1-已删除',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_payment_no (payment_no),
    KEY idx_claim_id (claim_id),
    KEY idx_claim_no (claim_no),
    KEY idx_payment_status (payment_status),
    KEY idx_payment_time (payment_time),
    KEY idx_gateway_order_no (gateway_order_no),
    KEY idx_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付记录表';

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- 初始化数据
-- =============================================

-- 初始化用户数据 (密码都是123456的BCrypt加密: $2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2)
INSERT INTO sys_user (username, password, real_name, phone, email, role, department, branch_code, branch_name, employee_no, status) VALUES
('admin', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '系统管理员', '13800000000', 'admin@insurance.com', 1, '信息技术部', 'BRANCH001', '总公司', 'EMP001', 1),
('surveyor01', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '张查勘', '13800000001', 'surveyor01@insurance.com', 2, '理赔部', 'BRANCH001', '北京分公司', 'EMP002', 1),
('surveyor02', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '李查勘', '13800000002', 'surveyor02@insurance.com', 2, '理赔部', 'BRANCH002', '上海分公司', 'EMP003', 1),
('assessor01', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '王定损', '13800000003', 'assessor01@insurance.com', 3, '理赔部', 'BRANCH001', '北京分公司', 'EMP004', 1),
('reviewer01', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '赵核赔', '13800000004', 'reviewer01@insurance.com', 4, '核赔部', 'BRANCH001', '北京分公司', 'EMP005', 1),
('finance01', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '陈财务', '13800000005', 'finance01@insurance.com', 5, '财务部', 'BRANCH001', '北京分公司', 'EMP006', 1),
('reporter01', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '刘先生', '13900000001', 'reporter01@example.com', 6, '', 'BRANCH001', '北京分公司', '', 1),
('fraud01', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '孙调查', '13800000006', 'fraud01@insurance.com', 7, '反欺诈部', 'BRANCH001', '总公司', 'EMP007', 1);

-- 初始化保单数据
INSERT INTO policy (policy_no, insurance_type, product_code, product_name, policyholder_name, policyholder_id_card, policyholder_phone, insured_name, insured_id_card, insured_phone, total_premium, total_coverage, deductible, deductible_ratio, effective_date, expiry_date, vehicle_plate_no, vehicle_brand, vehicle_model, vehicle_register_year, policy_status, branch_code, branch_name, agent_name) VALUES
('POL202400000001', 1, 'AUTO001', '机动车辆损失保险', '张先生', '110101199001011234', '13900000001', '张先生', '110101199001011234', '13900000001', 3500.00, 200000.00, 200.00, 5.00, '2024-01-01', '2024-12-31', '京A12345', '大众', '帕萨特', 2020, 1, 'BRANCH001', '北京分公司', '王代理'),
('POL202400000002', 1, 'AUTO002', '机动车第三者责任保险', '李女士', '310101199203045678', '13900000002', '李女士', '310101199203045678', '13900000002', 1800.00, 1000000.00, 0.00, 0.00, '2024-02-01', '2025-01-31', '沪B67890', '丰田', '凯美瑞', 2021, 1, 'BRANCH002', '上海分公司', '李代理'),
('POL202400000003', 2, 'HOME001', '家庭财产综合保险', '王先生', '440101198505067890', '13900000003', '王先生', '440101198505067890', '13900000003', 500.00, 500000.00, 500.00, 10.00, '2024-01-15', '2025-01-14', NULL, NULL, NULL, NULL, 1, 'BRANCH003', '广州分公司', '张代理'),
('POL202400000004', 3, 'ENT001', '企业财产基本险', 'ABC科技有限公司', '91110000MA001ABCDE', '010-12345678', 'ABC科技有限公司', '91110000MA001ABCDE', '010-12345678', 50000.00, 10000000.00, 10000.00, 5.00, '2024-03-01', '2025-02-28', NULL, NULL, NULL, NULL, 1, 'BRANCH001', '北京分公司', '赵代理');

-- 初始化理赔案件示例数据
INSERT INTO claim (claim_no, policy_no, insurance_type, status, accident_time, accident_location, accident_province, accident_city, accident_district, accident_description, reporter_name, reporter_phone, reporter_id_card, estimated_amount, liability_ratio, fraud_score, fraud_suspicious, reported_at, remark, version, deleted) VALUES
('CLAIM202400000001', 'POL202400000001', 1, 1, '2024-06-15 08:30:00', '北京市朝阳区建国路88号', '北京市', '北京市', '朝阳区', '车辆追尾事故，我方车辆前部受损', '张先生', '13900000001', '110101199001011234', 8000.00, 100, 15, 0, '2024-06-15 08:45:00', '正常理赔案件', 0, 0),
('CLAIM202400000002', 'POL202400000002', 1, 5, '2024-07-20 14:20:00', '上海市浦东新区世纪大道100号', '上海市', '上海市', '浦东新区', '变道刮擦事故，双方车辆均有损伤', '李女士', '13900000002', '310101199203045678', 15000.00, 70, 25, 0, '2024-07-20 14:35:00', '双方事故，责任7:3', 0, 0),
('CLAIM202400000003', 'POL202400000003', 2, 8, '2024-08-10 16:00:00', '广州市天河区天河路385号', '广东省', '广州市', '天河区', '家中水管爆裂，造成地板和家具受损', '王先生', '13900000003', '440101198505067890', 25000.00, 100, 10, 0, '2024-08-10 16:30:00', '家财险理赔案件', 0, 0);
