-- 省级特种设备安全监察管理系统数据库脚本
CREATE DATABASE IF NOT EXISTS special_equipment DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE special_equipment;

-- 用户表
CREATE TABLE IF NOT EXISTS sys_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    username VARCHAR(64) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(256) NOT NULL COMMENT '密码(BCrypt加密)',
    real_name VARCHAR(64) COMMENT '真实姓名',
    phone VARCHAR(20) COMMENT '手机号',
    email VARCHAR(128) COMMENT '邮箱',
    role_code VARCHAR(32) NOT NULL COMMENT '角色编码',
    organization_id BIGINT COMMENT '所属机构ID',
    organization_name VARCHAR(128) COMMENT '所属机构名称',
    status TINYINT DEFAULT 1 COMMENT '状态(1启用0禁用)',
    avatar VARCHAR(512) COMMENT '头像',
    create_time DATETIME COMMENT '创建时间',
    update_time DATETIME COMMENT '更新时间',
    create_by BIGINT COMMENT '创建人',
    update_by BIGINT COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '删除标识',
    INDEX idx_username (username),
    INDEX idx_org (organization_id),
    INDEX idx_role (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- 检验机构表
CREATE TABLE IF NOT EXISTS inspection_agency (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    agency_code VARCHAR(32) NOT NULL UNIQUE COMMENT '机构编码',
    agency_name VARCHAR(128) NOT NULL COMMENT '机构名称',
    legal_person VARCHAR(64) COMMENT '法人',
    contact_person VARCHAR(64) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    address VARCHAR(512) COMMENT '地址',
    region_code VARCHAR(12) COMMENT '行政区划编码',
    qualification_number VARCHAR(64) COMMENT '资质编号',
    status TINYINT DEFAULT 1 COMMENT '状态',
    create_time DATETIME,
    update_time DATETIME,
    create_by BIGINT,
    update_by BIGINT,
    deleted TINYINT DEFAULT 0,
    INDEX idx_code (agency_code),
    INDEX idx_region (region_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验机构表';

-- 使用单位表
CREATE TABLE IF NOT EXISTS use_unit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    unit_code VARCHAR(32) NOT NULL UNIQUE COMMENT '单位编码',
    unit_name VARCHAR(128) NOT NULL COMMENT '单位名称',
    legal_person VARCHAR(64) COMMENT '法人',
    contact_person VARCHAR(64) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    address VARCHAR(512) COMMENT '地址',
    region_code VARCHAR(12) COMMENT '行政区划编码',
    unified_social_credit_code VARCHAR(32) COMMENT '统一社会信用代码',
    status TINYINT DEFAULT 1 COMMENT '状态',
    create_time DATETIME,
    update_time DATETIME,
    create_by BIGINT,
    update_by BIGINT,
    deleted TINYINT DEFAULT 0,
    INDEX idx_code (unit_code),
    INDEX idx_region (region_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='使用单位表';

-- 设备档案表
CREATE TABLE IF NOT EXISTS device (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    device_code VARCHAR(32) NOT NULL UNIQUE COMMENT '设备编码',
    device_type TINYINT NOT NULL COMMENT '设备类型(1电梯2起重机3压力容器4锅炉5索道6游乐设施)',
    device_name VARCHAR(128) COMMENT '设备名称',
    model VARCHAR(64) COMMENT '型号',
    specification VARCHAR(128) COMMENT '规格参数',
    manufacturer VARCHAR(128) COMMENT '制造单位',
    manufacturing_license VARCHAR(64) COMMENT '制造许可证',
    manufacture_date DATE COMMENT '制造日期',
    serial_number VARCHAR(64) COMMENT '出厂编号',
    use_unit_id BIGINT NOT NULL COMMENT '使用单位ID',
    use_unit_name VARCHAR(128) COMMENT '使用单位名称',
    installation_location VARCHAR(512) COMMENT '安装地点',
    region_code VARCHAR(12) COMMENT '行政区划编码',
    region_name VARCHAR(64) COMMENT '行政区划名称',
    rated_speed DECIMAL(10,2) COMMENT '额定速度(m/s)',
    rated_load DECIMAL(10,2) COMMENT '额定载荷(t)',
    span DECIMAL(10,2) COMMENT '跨度(m)',
    volume DECIMAL(10,2) COMMENT '容积(m3)',
    working_pressure DECIMAL(10,2) COMMENT '工作压力(MPa)',
    ropeway_length DECIMAL(10,2) COMMENT '索道长度(km)',
    install_date DATE COMMENT '安装日期',
    acceptance_date DATE COMMENT '验收日期',
    last_inspection_date DATE COMMENT '上次检验日期',
    next_inspection_date DATE COMMENT '下次检验日期',
    status TINYINT DEFAULT 1 COMMENT '设备状态(1在用2停用3移装中4注销5超期6待检)',
    maintenance_unit VARCHAR(128) COMMENT '维保单位',
    maintenance_contact VARCHAR(64) COMMENT '维保联系人',
    maintenance_phone VARCHAR(20) COMMENT '维保电话',
    remark TEXT COMMENT '备注',
    register_time DATETIME COMMENT '注册登记时间',
    create_time DATETIME,
    update_time DATETIME,
    create_by BIGINT,
    update_by BIGINT,
    deleted TINYINT DEFAULT 0,
    INDEX idx_code (device_code),
    INDEX idx_type (device_type),
    INDEX idx_status (status),
    INDEX idx_unit (use_unit_id),
    INDEX idx_region (region_code),
    INDEX idx_next_inspect (next_inspection_date),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='特种设备档案表';

-- 设备状态变更日志
CREATE TABLE IF NOT EXISTS device_status_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    device_code VARCHAR(32),
    from_status TINYINT,
    to_status TINYINT,
    change_reason VARCHAR(512),
    operator_name VARCHAR(64),
    operate_time DATETIME,
    remark VARCHAR(512),
    create_time DATETIME,
    update_time DATETIME,
    create_by BIGINT,
    update_by BIGINT,
    deleted TINYINT DEFAULT 0,
    INDEX idx_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备状态变更日志';

-- 检验记录表
CREATE TABLE IF NOT EXISTS inspection_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    inspection_no VARCHAR(32) NOT NULL UNIQUE COMMENT '检验报告编号',
    device_id BIGINT NOT NULL,
    device_code VARCHAR(32),
    device_type TINYINT,
    agency_id BIGINT COMMENT '检验机构ID',
    agency_name VARCHAR(128) COMMENT '检验机构名称',
    inspector VARCHAR(64) COMMENT '检验员',
    inspector_certificate VARCHAR(64) COMMENT '检验员证号',
    inspection_date DATE COMMENT '检验日期',
    report_date DATE COMMENT '报告日期',
    conclusion TINYINT NOT NULL COMMENT '检验结论(1合格2整改后复检3不合格)',
    next_inspection_date DATE COMMENT '下次检验日期',
    defect_description TEXT COMMENT '缺陷描述',
    rectification_requirements TEXT COMMENT '整改要求',
    report_file_url VARCHAR(512) COMMENT '报告文件',
    status TINYINT DEFAULT 1 COMMENT '状态',
    receive_time DATETIME COMMENT '接收时间',
    remark VARCHAR(512),
    create_time DATETIME,
    update_time DATETIME,
    create_by BIGINT,
    update_by BIGINT,
    deleted TINYINT DEFAULT 0,
    INDEX idx_no (inspection_no),
    INDEX idx_device (device_id),
    INDEX idx_agency (agency_id),
    INDEX idx_conclusion (conclusion),
    INDEX idx_date (inspection_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验记录表';

-- 检验计划表
CREATE TABLE IF NOT EXISTS inspection_plan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plan_no VARCHAR(32) NOT NULL UNIQUE,
    device_id BIGINT NOT NULL,
    device_code VARCHAR(32),
    agency_id BIGINT,
    agency_name VARCHAR(128),
    plan_date DATE COMMENT '计划检验日期',
    status TINYINT DEFAULT 1 COMMENT '状态(1待执行2已推送3已完成)',
    push_time DATETIME,
    remark VARCHAR(512),
    create_time DATETIME,
    update_time DATETIME,
    create_by BIGINT,
    update_by BIGINT,
    deleted TINYINT DEFAULT 0,
    INDEX idx_device (device_id),
    INDEX idx_date (plan_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验计划表';

-- 隐患记录表
CREATE TABLE IF NOT EXISTS hazard_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    hazard_no VARCHAR(32) NOT NULL UNIQUE COMMENT '隐患编号',
    device_id BIGINT,
    device_code VARCHAR(32),
    device_type TINYINT,
    use_unit_id BIGINT,
    use_unit_name VARCHAR(128),
    hazard_level TINYINT NOT NULL COMMENT '隐患等级(1一般2严重3重大)',
    hazard_type VARCHAR(64) COMMENT '隐患类型',
    hazard_description TEXT COMMENT '隐患描述',
    discovery_date DATE COMMENT '发现日期',
    discoverer VARCHAR(64),
    discoverer_id BIGINT,
    deadline DATE COMMENT '整改期限',
    rectification_requirements TEXT COMMENT '整改要求',
    rectification_measures TEXT COMMENT '整改措施',
    rectification_date DATE COMMENT '整改日期',
    rectifier VARCHAR(64),
    review_date DATE COMMENT '复查日期',
    reviewer VARCHAR(64),
    status TINYINT DEFAULT 1 COMMENT '状态(1待整改2整改中3待复查4已闭环5逾期6升级督办)',
    escalated TINYINT DEFAULT 0 COMMENT '是否已升级',
    escalate_time DATETIME,
    remark VARCHAR(512),
    create_time DATETIME,
    update_time DATETIME,
    create_by BIGINT,
    update_by BIGINT,
    deleted TINYINT DEFAULT 0,
    INDEX idx_no (hazard_no),
    INDEX idx_device (device_id),
    INDEX idx_unit (use_unit_id),
    INDEX idx_level (hazard_level),
    INDEX idx_status (status),
    INDEX idx_deadline (deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='隐患记录表';

-- 事故报告表
CREATE TABLE IF NOT EXISTS accident_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    accident_no VARCHAR(32) NOT NULL UNIQUE,
    device_id BIGINT,
    device_code VARCHAR(32),
    device_type TINYINT,
    use_unit_id BIGINT,
    use_unit_name VARCHAR(128),
    accident_level TINYINT COMMENT '事故等级(1一般2较大3重大4特别重大)',
    accident_time DATETIME,
    accident_location VARCHAR(512),
    casualties INT DEFAULT 0 COMMENT '死亡人数',
    injuries INT DEFAULT 0 COMMENT '受伤人数',
    direct_loss DECIMAL(15,2) COMMENT '直接经济损失(万元)',
    accident_description TEXT COMMENT '事故描述',
    reporter VARCHAR(64),
    reporter_phone VARCHAR(20),
    report_time DATETIME,
    emergency_measures TEXT COMMENT '应急处置措施',
    handling_status VARCHAR(32) COMMENT '处理状态',
    remark TEXT,
    create_time DATETIME,
    update_time DATETIME,
    create_by BIGINT,
    update_by BIGINT,
    deleted TINYINT DEFAULT 0,
    INDEX idx_no (accident_no),
    INDEX idx_device (device_id),
    INDEX idx_time (accident_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='事故报告表';

-- 应急资源表
CREATE TABLE IF NOT EXISTS emergency_resource (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    resource_type VARCHAR(32) COMMENT '资源类型(检验人员/救援设备/专家)',
    resource_name VARCHAR(128),
    organization_id BIGINT,
    organization_name VARCHAR(128),
    contact_person VARCHAR(64),
    contact_phone VARCHAR(20),
    address VARCHAR(512),
    region_code VARCHAR(12),
    longitude DECIMAL(10,6),
    latitude DECIMAL(10,6),
    quantity INT,
    capability VARCHAR(512) COMMENT '能力描述',
    status TINYINT DEFAULT 1,
    remark VARCHAR(512),
    create_time DATETIME,
    update_time DATETIME,
    create_by BIGINT,
    update_by BIGINT,
    deleted TINYINT DEFAULT 0,
    INDEX idx_region (region_code),
    INDEX idx_type (resource_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应急资源表';

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operation_module VARCHAR(64) COMMENT '模块',
    operation_type VARCHAR(32) COMMENT '操作类型(新增/修改/删除/查询)',
    operation_desc VARCHAR(512) COMMENT '操作描述',
    operator_id BIGINT,
    operator_name VARCHAR(64),
    operator_role VARCHAR(32),
    operate_time DATETIME,
    request_ip VARCHAR(64),
    request_method VARCHAR(16),
    request_url VARCHAR(512),
    request_param TEXT,
    result_status TINYINT COMMENT '结果状态(1成功0失败)',
    result_message VARCHAR(512),
    cost_time BIGINT COMMENT '耗时(ms)',
    create_time DATETIME,
    update_time DATETIME,
    create_by BIGINT,
    update_by BIGINT,
    deleted TINYINT DEFAULT 0,
    INDEX idx_operator (operator_id),
    INDEX idx_time (operate_time),
    INDEX idx_module (operation_module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志表';

-- 通知消息表
CREATE TABLE IF NOT EXISTS notification (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    notification_type VARCHAR(32) COMMENT '通知类型(超期预警/隐患督办/应急调度)',
    title VARCHAR(256),
    content TEXT,
    receiver_id BIGINT,
    receiver_name VARCHAR(64),
    receiver_role VARCHAR(32),
    read_status TINYINT DEFAULT 0 COMMENT '读取状态(0未读1已读)',
    read_time DATETIME,
    biz_type VARCHAR(32) COMMENT '业务类型',
    biz_id BIGINT COMMENT '业务ID',
    remark VARCHAR(512),
    create_time DATETIME,
    update_time DATETIME,
    create_by BIGINT,
    update_by BIGINT,
    deleted TINYINT DEFAULT 0,
    INDEX idx_receiver (receiver_id),
    INDEX idx_read (read_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知消息表';

-- 初始化数据
INSERT INTO sys_user (username, password, real_name, phone, role_code, organization_name, status) VALUES
('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '系统管理员', '13800000000', 'ADMIN', '省局', 1),
('supervisor01', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '监察员张工', '13800000001', 'SUPERVISOR', '省局监察一处', 1),
('agency01', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '检验机构A管理员', '13800000002', 'INSPECTION_AGENCY', '省特种设备检验研究院', 1),
('unit01', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '使用单位A管理员', '13800000003', 'USE_UNIT', 'XX物业管理有限公司', 1);

INSERT INTO inspection_agency (agency_code, agency_name, legal_person, contact_person, contact_phone, address, region_code, qualification_number, status) VALUES
('JY001', '省特种设备检验研究院', '李院长', '王主任', '0371-66666666', '郑州市金水区XX路1号', '410100', 'TS7110001', 1),
('JY002', '郑州市特种设备检验检测中心', '赵主任', '孙工', '0371-66666667', '郑州市中原区XX路2号', '410100', 'TS7110002', 1);

INSERT INTO use_unit (unit_code, unit_name, legal_person, contact_person, contact_phone, address, region_code, unified_social_credit_code, status) VALUES
('SY001', 'XX物业管理有限公司', '周总', '吴经理', '0371-88888888', '郑州市金水区XX大厦', '410100', '91410100MA12345678', 1),
('SY002', 'YY商业管理有限公司', '郑总', '冯主管', '0371-88888889', '郑州市二七区XX广场', '410100', '91410100MA87654321', 1);
