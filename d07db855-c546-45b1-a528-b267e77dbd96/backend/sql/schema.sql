-- =====================================================
-- 检验检测认证中心管理系统 - MySQL 8.0 建表脚本
-- 数据库: iccert
-- 字符集: utf8mb4
-- =====================================================

CREATE DATABASE IF NOT EXISTS `iccert` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `iccert`;

-- =====================================================
-- 1. 用户权限模块
-- =====================================================

DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `username` VARCHAR(64) NOT NULL COMMENT '用户名',
    `password` VARCHAR(255) NOT NULL COMMENT '密码(Bcrypt加密)',
    `real_name` VARCHAR(64) NOT NULL COMMENT '真实姓名',
    `email` VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
    `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
    `avatar` VARCHAR(255) DEFAULT NULL COMMENT '头像URL',
    `department_id` BIGINT DEFAULT NULL COMMENT '部门ID',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1-启用 0-禁用',
    `last_login_time` DATETIME DEFAULT NULL COMMENT '最后登录时间',
    `last_login_ip` VARCHAR(64) DEFAULT NULL COMMENT '最后登录IP',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `is_deleted` TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-否 1-是',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`),
    KEY `idx_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

DROP TABLE IF EXISTS `sys_role`;
CREATE TABLE `sys_role` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `role_code` VARCHAR(64) NOT NULL COMMENT '角色编码',
    `role_name` VARCHAR(64) NOT NULL COMMENT '角色名称',
    `description` VARCHAR(255) DEFAULT NULL COMMENT '角色描述',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1-启用 0-禁用',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `is_deleted` TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_role_code` (`role_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统角色表';

DROP TABLE IF EXISTS `sys_menu`;
CREATE TABLE `sys_menu` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `parent_id` BIGINT NOT NULL DEFAULT 0 COMMENT '父级ID',
    `menu_name` VARCHAR(64) NOT NULL COMMENT '菜单名称',
    `menu_path` VARCHAR(255) DEFAULT NULL COMMENT '菜单路径',
    `menu_icon` VARCHAR(64) DEFAULT NULL COMMENT '菜单图标',
    `component` VARCHAR(255) DEFAULT NULL COMMENT '前端组件',
    `permission` VARCHAR(128) DEFAULT NULL COMMENT '权限标识',
    `menu_type` TINYINT NOT NULL COMMENT '类型: 1-目录 2-菜单 3-按钮',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
    `visible` TINYINT NOT NULL DEFAULT 1 COMMENT '是否显示: 1-显示 0-隐藏',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `is_deleted` TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    PRIMARY KEY (`id`),
    KEY `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统菜单表';

DROP TABLE IF EXISTS `sys_user_role`;
CREATE TABLE `sys_user_role` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `user_id` BIGINT NOT NULL COMMENT '用户ID',
    `role_id` BIGINT NOT NULL COMMENT '角色ID',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_role` (`user_id`, `role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表';

DROP TABLE IF EXISTS `sys_role_menu`;
CREATE TABLE `sys_role_menu` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `role_id` BIGINT NOT NULL COMMENT '角色ID',
    `menu_id` BIGINT NOT NULL COMMENT '菜单ID',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_role_menu` (`role_id`, `menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单关联表';

DROP TABLE IF EXISTS `sys_department`;
CREATE TABLE `sys_department` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `parent_id` BIGINT NOT NULL DEFAULT 0 COMMENT '父级ID',
    `dept_name` VARCHAR(64) NOT NULL COMMENT '部门名称',
    `dept_code` VARCHAR(64) DEFAULT NULL COMMENT '部门编码',
    `leader` VARCHAR(64) DEFAULT NULL COMMENT '负责人',
    `phone` VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `is_deleted` TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门表';

-- =====================================================
-- 2. 产品领域、认证类型字典
-- =====================================================

DROP TABLE IF EXISTS `dict_product_category`;
CREATE TABLE `dict_product_category` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `category_code` VARCHAR(32) NOT NULL COMMENT '类别编码',
    `category_name` VARCHAR(64) NOT NULL COMMENT '类别名称',
    `description` VARCHAR(255) DEFAULT NULL COMMENT '描述',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_category_code` (`category_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品领域类别表';

DROP TABLE IF EXISTS `dict_cert_type`;
CREATE TABLE `dict_cert_type` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `cert_code` VARCHAR(32) NOT NULL COMMENT '认证类型编码',
    `cert_name` VARCHAR(64) NOT NULL COMMENT '认证类型名称',
    `cert_full_name` VARCHAR(255) DEFAULT NULL COMMENT '全称',
    `description` VARCHAR(255) DEFAULT NULL COMMENT '描述',
    `valid_period_months` INT NOT NULL DEFAULT 36 COMMENT '默认有效期(月)',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_cert_code` (`cert_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认证类型表';

-- =====================================================
-- 3. 样品管理模块
-- =====================================================

DROP TABLE IF EXISTS `sample_info`;
CREATE TABLE `sample_info` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `sample_code` VARCHAR(64) NOT NULL COMMENT '样品追溯码(唯一)',
    `sample_name` VARCHAR(255) NOT NULL COMMENT '样品名称',
    `sample_model` VARCHAR(128) DEFAULT NULL COMMENT '规格型号',
    `sample_code_internal` VARCHAR(64) DEFAULT NULL COMMENT '企业内部编码',
    `company_id` BIGINT NOT NULL COMMENT '委托企业ID',
    `company_name` VARCHAR(255) NOT NULL COMMENT '委托企业名称(冗余)',
    `product_category_id` BIGINT NOT NULL COMMENT '产品类别ID',
    `product_category_name` VARCHAR(64) NOT NULL COMMENT '产品类别名称(冗余)',
    `cert_type_id` BIGINT NOT NULL COMMENT '认证类型ID',
    `cert_type_code` VARCHAR(32) NOT NULL COMMENT '认证类型编码(冗余)',
    `sample_amount` INT NOT NULL DEFAULT 1 COMMENT '样品数量',
    `sample_unit` VARCHAR(16) DEFAULT '件' COMMENT '样品单位',
    `receiver_id` BIGINT DEFAULT NULL COMMENT '接收人ID',
    `receiver_name` VARCHAR(64) DEFAULT NULL COMMENT '接收人姓名(冗余)',
    `receive_time` DATETIME NOT NULL COMMENT '接收时间',
    `sample_status` VARCHAR(32) NOT NULL DEFAULT 'RECEIVED' COMMENT '状态: RECEIVED-已接收 REGISTERED-已登记 TESTING-检测中 REPORTED-报告中 CERTIFIED-已发证 ARCHIVED-已归档 DESTROYED-已销毁',
    `storage_location` VARCHAR(128) DEFAULT NULL COMMENT '存放位置',
    `retention_expire_date` DATE DEFAULT NULL COMMENT '留样到期日期',
    `destroy_time` DATETIME DEFAULT NULL COMMENT '销毁时间',
    `destroy_operator` VARCHAR(64) DEFAULT NULL COMMENT '销毁操作人',
    `destroy_remark` VARCHAR(500) DEFAULT NULL COMMENT '销毁备注',
    `priority` VARCHAR(16) NOT NULL DEFAULT 'NORMAL' COMMENT '优先级: HIGH-高 MEDIUM-中 NORMAL-普通',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
    `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_sample_code` (`sample_code`),
    KEY `idx_company_id` (`company_id`),
    KEY `idx_status` (`sample_status`),
    KEY `idx_receive_time` (`receive_time`),
    KEY `idx_retention_expire` (`retention_expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='样品信息表';

DROP TABLE IF EXISTS `sample_photo`;
CREATE TABLE `sample_photo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `sample_id` BIGINT NOT NULL COMMENT '样品ID',
    `photo_url` VARCHAR(500) NOT NULL COMMENT '照片URL',
    `photo_name` VARCHAR(255) DEFAULT NULL COMMENT '原始文件名',
    `photo_size` BIGINT DEFAULT NULL COMMENT '文件大小(字节)',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
    `upload_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
    `uploader_id` BIGINT DEFAULT NULL COMMENT '上传人ID',
    PRIMARY KEY (`id`),
    KEY `idx_sample_id` (`sample_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='样品照片表';

DROP TABLE IF EXISTS `sample_flow_log`;
CREATE TABLE `sample_flow_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `sample_id` BIGINT NOT NULL COMMENT '样品ID',
    `sample_code` VARCHAR(64) NOT NULL COMMENT '样品追溯码(冗余)',
    `flow_status` VARCHAR(32) NOT NULL COMMENT '流转状态',
    `flow_status_text` VARCHAR(64) NOT NULL COMMENT '状态文本',
    `operator_id` BIGINT DEFAULT NULL COMMENT '操作人ID',
    `operator_name` VARCHAR(64) DEFAULT NULL COMMENT '操作人姓名',
    `operation_desc` VARCHAR(500) DEFAULT NULL COMMENT '操作描述',
    `operation_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    PRIMARY KEY (`id`),
    KEY `idx_sample_id` (`sample_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='样品流转记录表';

-- =====================================================
-- 4. 检测任务模块
-- =====================================================

DROP TABLE IF EXISTS `lab_equipment`;
CREATE TABLE `lab_equipment` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `equipment_code` VARCHAR(64) NOT NULL COMMENT '设备编号',
    `equipment_name` VARCHAR(128) NOT NULL COMMENT '设备名称',
    `equipment_model` VARCHAR(128) DEFAULT NULL COMMENT '设备型号',
    `lab_id` BIGINT DEFAULT NULL COMMENT '所属实验室ID',
    `lab_name` VARCHAR(64) DEFAULT NULL COMMENT '实验室名称(冗余)',
    `equipment_status` VARCHAR(32) NOT NULL DEFAULT 'IDLE' COMMENT '状态: IDLE-空闲 RUNNING-运行中 MAINTENANCE-维护中 FAULT-故障',
    `current_load` INT NOT NULL DEFAULT 0 COMMENT '当前负载(0-100)',
    `max_load` INT NOT NULL DEFAULT 100 COMMENT '最大负载',
    `last_calibration_date` DATE DEFAULT NULL COMMENT '上次校准日期',
    `next_calibration_date` DATE DEFAULT NULL COMMENT '下次校准日期',
    `calibration_cycle_days` INT NOT NULL DEFAULT 180 COMMENT '校准周期(天)',
    `manufacturer` VARCHAR(128) DEFAULT NULL COMMENT '生产厂家',
    `purchase_date` DATE DEFAULT NULL COMMENT '购置日期',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_equipment_code` (`equipment_code`),
    KEY `idx_next_calibration` (`next_calibration_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测设备表';

DROP TABLE IF EXISTS `lab_technician`;
CREATE TABLE `lab_technician` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `user_id` BIGINT NOT NULL COMMENT '关联用户ID',
    `technician_name` VARCHAR(64) NOT NULL COMMENT '技术员姓名',
    `title` VARCHAR(64) DEFAULT NULL COMMENT '职称',
    `lab_id` BIGINT DEFAULT NULL COMMENT '所属实验室ID',
    `lab_name` VARCHAR(64) DEFAULT NULL COMMENT '实验室名称',
    `workload` INT NOT NULL DEFAULT 0 COMMENT '当前工作负载(0-100)',
    `status` VARCHAR(32) NOT NULL DEFAULT 'NORMAL' COMMENT '状态: NORMAL-空闲 BUSY-工作中 LEAVE-休假',
    `cert_count` INT NOT NULL DEFAULT 0 COMMENT '资质证书数量',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技术人员表';

DROP TABLE IF EXISTS `technician_skill`;
CREATE TABLE `technician_skill` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `technician_id` BIGINT NOT NULL COMMENT '技术员ID',
    `skill_name` VARCHAR(64) NOT NULL COMMENT '技能名称',
    `skill_level` VARCHAR(32) DEFAULT NULL COMMENT '技能等级',
    `cert_no` VARCHAR(128) DEFAULT NULL COMMENT '证书编号',
    `expire_date` DATE DEFAULT NULL COMMENT '证书到期日',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_technician_id` (`technician_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技术员技能证书表';

DROP TABLE IF EXISTS `technician_training`;
CREATE TABLE `technician_training` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `technician_id` BIGINT NOT NULL COMMENT '技术员ID',
    `training_title` VARCHAR(255) NOT NULL COMMENT '培训主题',
    `training_content` TEXT COMMENT '培训内容',
    `training_date` DATE NOT NULL COMMENT '培训日期',
    `training_hours` DECIMAL(5,1) DEFAULT NULL COMMENT '培训时长(小时)',
    `trainer` VARCHAR(64) DEFAULT NULL COMMENT '讲师',
    `certificate_url` VARCHAR(500) DEFAULT NULL COMMENT '培训证书URL',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_technician_id` (`technician_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技术员培训记录表';

DROP TABLE IF EXISTS `equipment_booking`;
CREATE TABLE `equipment_booking` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `equipment_id` BIGINT NOT NULL COMMENT '设备ID',
    `task_id` BIGINT NOT NULL COMMENT '任务ID',
    `booker_id` BIGINT DEFAULT NULL COMMENT '预约人ID',
    `book_start_time` DATETIME NOT NULL COMMENT '预约开始时间',
    `book_end_time` DATETIME NOT NULL COMMENT '预约结束时间',
    `booking_status` VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED' COMMENT '状态: CONFIRMED-已确认 CANCELLED-已取消 COMPLETED-已完成 CONFLICT-冲突',
    `conflict_remark` VARCHAR(500) DEFAULT NULL COMMENT '冲突说明',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_equipment_time` (`equipment_id`, `book_start_time`, `book_end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备预约表';

DROP TABLE IF EXISTS `inspection_task`;
CREATE TABLE `inspection_task` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `task_code` VARCHAR(64) NOT NULL COMMENT '任务编号',
    `task_title` VARCHAR(255) NOT NULL COMMENT '任务标题',
    `sample_id` BIGINT NOT NULL COMMENT '样品ID',
    `sample_code` VARCHAR(64) NOT NULL COMMENT '样品追溯码(冗余)',
    `cert_type_id` BIGINT DEFAULT NULL COMMENT '认证类型ID',
    `cert_type_code` VARCHAR(32) DEFAULT NULL COMMENT '认证类型编码',
    `standard_id` BIGINT DEFAULT NULL COMMENT '检测标准ID',
    `standard_code` VARCHAR(128) DEFAULT NULL COMMENT '检测标准号',
    `technician_id` BIGINT DEFAULT NULL COMMENT '分配技术员ID',
    `technician_name` VARCHAR(64) DEFAULT NULL COMMENT '技术员姓名(冗余)',
    `equipment_id` BIGINT DEFAULT NULL COMMENT '使用设备ID',
    `equipment_name` VARCHAR(128) DEFAULT NULL COMMENT '设备名称(冗余)',
    `priority` VARCHAR(16) NOT NULL DEFAULT 'NORMAL' COMMENT '优先级: HIGH-高 MEDIUM-中 NORMAL-普通',
    `task_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING-待分配 IN_PROGRESS-进行中 REVIEW-待审核 COMPLETED-已完成 CANCELLED-已取消 OVERDUE-已超期',
    `progress` INT NOT NULL DEFAULT 0 COMMENT '进度(0-100)',
    `assign_time` DATETIME DEFAULT NULL COMMENT '分配时间',
    `start_time` DATETIME DEFAULT NULL COMMENT '开始时间',
    `expected_finish_time` DATETIME DEFAULT NULL COMMENT '预计完成时间',
    `actual_finish_time` DATETIME DEFAULT NULL COMMENT '实际完成时间',
    `deadline` DATE DEFAULT NULL COMMENT '截止日期',
    `is_overdue_warned` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已超期预警',
    `auto_dispatched` TINYINT NOT NULL DEFAULT 0 COMMENT '是否系统自动调度',
    `dispatch_algorithm` VARCHAR(64) DEFAULT NULL COMMENT '调度算法版本',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
    `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_task_code` (`task_code`),
    KEY `idx_sample_id` (`sample_id`),
    KEY `idx_status` (`task_status`),
    KEY `idx_technician_id` (`technician_id`),
    KEY `idx_deadline` (`deadline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测任务表';

DROP TABLE IF EXISTS `task_item`;
CREATE TABLE `task_item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `task_id` BIGINT NOT NULL COMMENT '任务ID',
    `item_name` VARCHAR(255) NOT NULL COMMENT '检测项目名称',
    `item_code` VARCHAR(64) DEFAULT NULL COMMENT '检测项目编码',
    `standard_clause` VARCHAR(128) DEFAULT NULL COMMENT '标准条款',
    `requirement` VARCHAR(500) DEFAULT NULL COMMENT '标准要求',
    `test_method` VARCHAR(500) DEFAULT NULL COMMENT '检测方法',
    `result_value` VARCHAR(255) DEFAULT NULL COMMENT '检测结果值',
    `result_unit` VARCHAR(32) DEFAULT NULL COMMENT '结果单位',
    `result_judgment` VARCHAR(16) DEFAULT NULL COMMENT '判定: PASS-合格 FAIL-不合格 PENDING-待判定',
    `is_tested` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已检测',
    `test_time` DATETIME DEFAULT NULL COMMENT '检测时间',
    `tester_id` BIGINT DEFAULT NULL COMMENT '检测人ID',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测项目明细表';

DROP TABLE IF EXISTS `raw_record`;
CREATE TABLE `raw_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `record_code` VARCHAR(64) NOT NULL COMMENT '原始记录编号',
    `task_id` BIGINT NOT NULL COMMENT '任务ID',
    `task_item_id` BIGINT DEFAULT NULL COMMENT '检测项目ID',
    `sample_id` BIGINT NOT NULL COMMENT '样品ID',
    `record_type` VARCHAR(32) NOT NULL DEFAULT 'DATA' COMMENT '类型: DATA-数值 PHOTO-照片 FILE-附件',
    `record_content` TEXT COMMENT '记录内容(JSON格式存储, 数值型数据)',
    `record_url` VARCHAR(500) DEFAULT NULL COMMENT '附件URL(照片/文件)',
    `record_hash` VARCHAR(128) NOT NULL COMMENT '数据SHA-256哈希(防篡改)',
    `prev_record_hash` VARCHAR(128) DEFAULT NULL COMMENT '上一条记录哈希(链式存储)',
    `tester_id` BIGINT DEFAULT NULL COMMENT '检测人ID',
    `tester_name` VARCHAR(64) DEFAULT NULL COMMENT '检测人姓名',
    `test_time` DATETIME NOT NULL COMMENT '检测时间(不可修改)',
    `equipment_id` BIGINT DEFAULT NULL COMMENT '使用设备ID',
    `equipment_snapshot` VARCHAR(1000) DEFAULT NULL COMMENT '设备状态快照(JSON)',
    `environment_snapshot` VARCHAR(1000) DEFAULT NULL COMMENT '环境条件快照(JSON:温湿度等)',
    `is_immutable` TINYINT NOT NULL DEFAULT 1 COMMENT '是否不可修改(1-是, 默认不可修改)',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '写入时间(不可修改)',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_record_code` (`record_code`),
    KEY `idx_task_id` (`task_id`),
    KEY `idx_sample_id` (`sample_id`),
    KEY `idx_record_hash` (`record_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测原始记录表(追加式存储,防篡改)';

-- =====================================================
-- 5. 报告证书模块
-- =====================================================

DROP TABLE IF EXISTS `report_template`;
CREATE TABLE `report_template` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `template_code` VARCHAR(64) NOT NULL COMMENT '模板编码',
    `template_name` VARCHAR(128) NOT NULL COMMENT '模板名称',
    `cert_type_id` BIGINT DEFAULT NULL COMMENT '适用认证类型ID',
    `product_category_id` BIGINT DEFAULT NULL COMMENT '适用产品类别ID',
    `template_content` LONGTEXT NOT NULL COMMENT '模板内容(FreeMarker/HTML)',
    `field_mapping` TEXT COMMENT '字段映射配置(JSON)',
    `condition_rules` TEXT COMMENT '条件渲染规则(JSON)',
    `calculation_rules` TEXT COMMENT '自动计算规则(JSON)',
    `version` VARCHAR(32) NOT NULL DEFAULT 'V1.0' COMMENT '版本号',
    `is_default` TINYINT NOT NULL DEFAULT 0 COMMENT '是否默认模板',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `create_by` BIGINT DEFAULT NULL,
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_template_code_version` (`template_code`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测报告模板表';

DROP TABLE IF EXISTS `inspection_report`;
CREATE TABLE `inspection_report` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `report_code` VARCHAR(64) NOT NULL COMMENT '报告编号',
    `report_title` VARCHAR(255) NOT NULL COMMENT '报告标题',
    `sample_id` BIGINT NOT NULL COMMENT '样品ID',
    `sample_code` VARCHAR(64) NOT NULL COMMENT '样品追溯码(冗余)',
    `task_id` BIGINT DEFAULT NULL COMMENT '任务ID',
    `company_id` BIGINT NOT NULL COMMENT '委托企业ID',
    `company_name` VARCHAR(255) NOT NULL COMMENT '委托企业名称',
    `cert_type_id` BIGINT DEFAULT NULL COMMENT '认证类型ID',
    `cert_type_code` VARCHAR(32) DEFAULT NULL COMMENT '认证类型编码',
    `template_id` BIGINT DEFAULT NULL COMMENT '使用模板ID',
    `template_version` VARCHAR(32) DEFAULT NULL COMMENT '模板版本',
    `report_content` LONGTEXT COMMENT '报告内容(HTML)',
    `report_pdf_url` VARCHAR(500) DEFAULT NULL COMMENT '报告PDF URL',
    `report_status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT-草稿 REVIEWING-审核中 ISSUED-已签发 REJECTED-已驳回 VOID-已作废',
    `report_version` VARCHAR(32) NOT NULL DEFAULT 'V1.0' COMMENT '报告版本',
    `page_count` INT DEFAULT NULL COMMENT '页数',
    `overall_result` VARCHAR(16) DEFAULT NULL COMMENT '总体结论: PASS-合格 FAIL-不合格',
    `author_id` BIGINT DEFAULT NULL COMMENT '编制人ID',
    `author_name` VARCHAR(64) DEFAULT NULL COMMENT '编制人姓名',
    `reviewer_id` BIGINT DEFAULT NULL COMMENT '审核人ID',
    `reviewer_name` VARCHAR(64) DEFAULT NULL COMMENT '审核人姓名',
    `review_time` DATETIME DEFAULT NULL COMMENT '审核时间',
    `review_remark` VARCHAR(500) DEFAULT NULL COMMENT '审核意见',
    `approver_id` BIGINT DEFAULT NULL COMMENT '批准人ID',
    `approver_name` VARCHAR(64) DEFAULT NULL COMMENT '批准人姓名',
    `issue_time` DATETIME DEFAULT NULL COMMENT '签发时间',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_report_code` (`report_code`),
    KEY `idx_sample_id` (`sample_id`),
    KEY `idx_status` (`report_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测报告表';

DROP TABLE IF EXISTS `report_revision`;
CREATE TABLE `report_revision` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `report_id` BIGINT NOT NULL COMMENT '报告ID',
    `report_version` VARCHAR(32) NOT NULL COMMENT '修订版本号',
    `revision_content` LONGTEXT COMMENT '修订后内容',
    `revision_type` VARCHAR(32) NOT NULL COMMENT '修订类型: CREATE-创建 EDIT-编辑 REVIEW-审核 APPROVE-签发',
    `revision_remark` VARCHAR(500) DEFAULT NULL COMMENT '修订说明',
    `operator_id` BIGINT DEFAULT NULL COMMENT '操作人ID',
    `operator_name` VARCHAR(64) DEFAULT NULL COMMENT '操作人姓名',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '修订时间',
    PRIMARY KEY (`id`),
    KEY `idx_report_id` (`report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报告修订记录追踪表';

DROP TABLE IF EXISTS `report_annotation`;
CREATE TABLE `report_annotation` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `report_id` BIGINT NOT NULL COMMENT '报告ID',
    `report_version` VARCHAR(32) DEFAULT NULL COMMENT '报告版本',
    `page_number` INT DEFAULT NULL COMMENT '页码',
    `x_position` DECIMAL(10,2) DEFAULT NULL COMMENT 'X坐标(百分比)',
    `y_position` DECIMAL(10,2) DEFAULT NULL COMMENT 'Y坐标(百分比)',
    `annotation_type` VARCHAR(32) NOT NULL DEFAULT 'TEXT' COMMENT '批注类型: TEXT-文字 HIGHLIGHT-高亮 SIGNATURE-签章',
    `annotation_content` TEXT COMMENT '批注内容',
    `annotation_color` VARCHAR(16) DEFAULT '#FF0000' COMMENT '批注颜色',
    `annotator_id` BIGINT DEFAULT NULL COMMENT '批注人ID',
    `annotator_name` VARCHAR(64) DEFAULT NULL COMMENT '批注人姓名',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '批注时间',
    PRIMARY KEY (`id`),
    KEY `idx_report_id` (`report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报告批注表';

DROP TABLE IF EXISTS `certificate_template`;
CREATE TABLE `certificate_template` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `template_code` VARCHAR(64) NOT NULL COMMENT '模板编码',
    `template_name` VARCHAR(128) NOT NULL COMMENT '模板名称',
    `cert_type_id` BIGINT NOT NULL COMMENT '认证类型ID',
    `template_content` LONGTEXT NOT NULL COMMENT '模板内容(HTML)',
    `field_mapping` TEXT COMMENT '字段映射配置(JSON)',
    `signature_config` TEXT COMMENT '电子签章配置(JSON)',
    `print_config` TEXT COMMENT '打印配置(JSON)',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_template_code` (`template_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='证书模板配置表';

DROP TABLE IF EXISTS `certificate_info`;
CREATE TABLE `certificate_info` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `cert_no` VARCHAR(64) NOT NULL COMMENT '证书编号',
    `cert_type_id` BIGINT NOT NULL COMMENT '认证类型ID',
    `cert_type_code` VARCHAR(32) NOT NULL COMMENT '认证类型编码',
    `company_id` BIGINT NOT NULL COMMENT '获证企业ID',
    `company_name` VARCHAR(255) NOT NULL COMMENT '获证企业名称',
    `product_name` VARCHAR(255) NOT NULL COMMENT '产品名称',
    `product_model` VARCHAR(128) DEFAULT NULL COMMENT '产品型号',
    `product_category_id` BIGINT DEFAULT NULL COMMENT '产品类别ID',
    `standard_code` VARCHAR(128) DEFAULT NULL COMMENT '依据标准号',
    `standard_name` VARCHAR(255) DEFAULT NULL COMMENT '依据标准名称',
    `report_id` BIGINT DEFAULT NULL COMMENT '关联报告ID',
    `report_code` VARCHAR(64) DEFAULT NULL COMMENT '关联报告编号',
    `template_id` BIGINT DEFAULT NULL COMMENT '使用模板ID',
    `cert_content` LONGTEXT COMMENT '证书内容(HTML)',
    `cert_pdf_url` VARCHAR(500) DEFAULT NULL COMMENT '证书PDF URL',
    `cert_status` VARCHAR(32) NOT NULL DEFAULT 'VALID' COMMENT '状态: VALID-有效 EXPIRING-即将到期 EXPIRED-已过期 REVOKED-已撤销 CHANGED-已变更 SUSPENDED-已暂停',
    `issue_date` DATE NOT NULL COMMENT '发证日期',
    `expire_date` DATE NOT NULL COMMENT '到期日期',
    `valid_years` INT NOT NULL DEFAULT 3 COMMENT '有效期(年)',
    `signature_url` VARCHAR(500) DEFAULT NULL COMMENT '电子签章图片URL',
    `is_reminder_sent` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已发送到期提醒',
    `reminder_sent_date` DATE DEFAULT NULL COMMENT '提醒发送日期',
    `revoke_time` DATETIME DEFAULT NULL COMMENT '撤销时间',
    `revoke_reason` VARCHAR(500) DEFAULT NULL COMMENT '撤销原因',
    `issuer_id` BIGINT DEFAULT NULL COMMENT '签发人ID',
    `issuer_name` VARCHAR(64) DEFAULT NULL COMMENT '签发人姓名',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_cert_no` (`cert_no`),
    KEY `idx_company_id` (`company_id`),
    KEY `idx_status` (`cert_status`),
    KEY `idx_expire_date` (`expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认证证书表';

DROP TABLE IF EXISTS `certificate_change_log`;
CREATE TABLE `certificate_change_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `certificate_id` BIGINT NOT NULL COMMENT '证书ID',
    `cert_no` VARCHAR(64) NOT NULL COMMENT '证书编号(冗余)',
    `change_type` VARCHAR(32) NOT NULL COMMENT '变更类型: ISSUE-发证 RENEW-续期 REVOKE-撤销 SUSPEND-暂停 RESUME-恢复 INFO_CHANGE-信息变更',
    `change_before` TEXT COMMENT '变更前内容(JSON)',
    `change_after` TEXT COMMENT '变更后内容(JSON)',
    `change_reason` VARCHAR(500) DEFAULT NULL COMMENT '变更原因',
    `operator_id` BIGINT DEFAULT NULL COMMENT '操作人ID',
    `operator_name` VARCHAR(64) DEFAULT NULL COMMENT '操作人姓名',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '变更时间',
    PRIMARY KEY (`id`),
    KEY `idx_certificate_id` (`certificate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='证书变更记录表';

-- =====================================================
-- 6. 客户服务模块
-- =====================================================

DROP TABLE IF EXISTS `customer_company`;
CREATE TABLE `customer_company` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `company_name` VARCHAR(255) NOT NULL COMMENT '企业名称',
    `credit_code` VARCHAR(32) NOT NULL COMMENT '统一社会信用代码',
    `legal_person` VARCHAR(64) DEFAULT NULL COMMENT '法人代表',
    `contact_person` VARCHAR(64) NOT NULL COMMENT '联系人',
    `contact_phone` VARCHAR(20) NOT NULL COMMENT '联系电话',
    `contact_email` VARCHAR(128) DEFAULT NULL COMMENT '联系邮箱',
    `address` VARCHAR(500) DEFAULT NULL COMMENT '企业地址',
    `product_category_id` BIGINT DEFAULT NULL COMMENT '主营产品类别ID',
    `customer_level` VARCHAR(16) NOT NULL DEFAULT 'C' COMMENT '客户等级: A/B/C',
    `total_cert_count` INT NOT NULL DEFAULT 0 COMMENT '持有证书总数',
    `total_order_count` INT NOT NULL DEFAULT 0 COMMENT '历史订单总数',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `register_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_credit_code` (`credit_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户企业表';

DROP TABLE IF EXISTS `customer_user`;
CREATE TABLE `customer_user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `company_id` BIGINT NOT NULL COMMENT '所属企业ID',
    `username` VARCHAR(64) NOT NULL COMMENT '登录账号',
    `password` VARCHAR(255) NOT NULL COMMENT '密码',
    `real_name` VARCHAR(64) NOT NULL COMMENT '姓名',
    `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
    `email` VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
    `is_main_contact` TINYINT NOT NULL DEFAULT 0 COMMENT '是否主要联系人',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `last_login_time` DATETIME DEFAULT NULL,
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`),
    KEY `idx_company_id` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业端用户表';

DROP TABLE IF EXISTS `inspection_application`;
CREATE TABLE `inspection_application` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `application_no` VARCHAR(64) NOT NULL COMMENT '申请编号',
    `company_id` BIGINT NOT NULL COMMENT '申请企业ID',
    `company_name` VARCHAR(255) NOT NULL COMMENT '企业名称(冗余)',
    `applicant_id` BIGINT DEFAULT NULL COMMENT '申请人ID',
    `applicant_name` VARCHAR(64) DEFAULT NULL COMMENT '申请人姓名',
    `product_name` VARCHAR(255) NOT NULL COMMENT '产品名称',
    `product_model` VARCHAR(128) DEFAULT NULL COMMENT '产品型号',
    `product_category_id` BIGINT NOT NULL COMMENT '产品类别ID',
    `product_category_name` VARCHAR(64) NOT NULL COMMENT '产品类别名称(冗余)',
    `cert_type_id` BIGINT NOT NULL COMMENT '认证类型ID',
    `cert_type_code` VARCHAR(32) NOT NULL COMMENT '认证类型编码',
    `sample_amount` INT NOT NULL DEFAULT 1 COMMENT '样品数量',
    `standard_code` VARCHAR(128) DEFAULT NULL COMMENT '检测标准号',
    `application_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING-待审核 APPROVED-已通过 REJECTED-已驳回 PROCESSING-检测中 COMPLETED-已完成',
    `reject_reason` VARCHAR(500) DEFAULT NULL COMMENT '驳回原因',
    `sample_send_method` VARCHAR(32) DEFAULT 'EXPRESS' COMMENT '样品寄送方式: EXPRESS-快递 SELF-自送 ONSITE-现场',
    `expected_send_date` DATE DEFAULT NULL COMMENT '预计寄送日期',
    `express_company` VARCHAR(64) DEFAULT NULL COMMENT '快递公司',
    `express_no` VARCHAR(64) DEFAULT NULL COMMENT '快递单号',
    `receive_address` VARCHAR(500) DEFAULT NULL COMMENT '接收地址',
    `receiver_name` VARCHAR(64) DEFAULT NULL COMMENT '接样人',
    `receiver_phone` VARCHAR(20) DEFAULT NULL COMMENT '接样人电话',
    `sample_id` BIGINT DEFAULT NULL COMMENT '关联样品ID(登记后生成)',
    `task_id` BIGINT DEFAULT NULL COMMENT '关联任务ID',
    `report_id` BIGINT DEFAULT NULL COMMENT '关联报告ID',
    `certificate_id` BIGINT DEFAULT NULL COMMENT '关联证书ID',
    `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '总金额',
    `paid_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已付金额',
    `payment_status` VARCHAR(32) NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态: UNPAID-未支付 PARTIAL-部分支付 PAID-已支付 REFUND-已退款',
    `payment_time` DATETIME DEFAULT NULL COMMENT '支付时间',
    `submit_time` DATETIME NOT NULL COMMENT '提交时间',
    `audit_time` DATETIME DEFAULT NULL COMMENT '审核时间',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_application_no` (`application_no`),
    KEY `idx_company_id` (`company_id`),
    KEY `idx_status` (`application_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='在线检测申请表';

DROP TABLE IF EXISTS `payment_record`;
CREATE TABLE `payment_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `payment_no` VARCHAR(64) NOT NULL COMMENT '支付流水号',
    `application_id` BIGINT NOT NULL COMMENT '关联申请ID',
    `company_id` BIGINT NOT NULL COMMENT '企业ID',
    `payment_amount` DECIMAL(12,2) NOT NULL COMMENT '支付金额',
    `payment_method` VARCHAR(32) NOT NULL COMMENT '支付方式: ALIPAY-支付宝 WECHAT-微信 BANK-银行转账',
    `payment_status` VARCHAR(32) NOT NULL DEFAULT 'PROCESSING' COMMENT '状态: PROCESSING-处理中 SUCCESS-成功 FAILED-失败',
    `third_party_no` VARCHAR(128) DEFAULT NULL COMMENT '第三方支付流水号',
    `payment_time` DATETIME DEFAULT NULL COMMENT '支付完成时间',
    `operator_id` BIGINT DEFAULT NULL COMMENT '操作人ID',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_payment_no` (`payment_no`),
    KEY `idx_application_id` (`application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付记录表';

DROP TABLE IF EXISTS `invoice_application`;
CREATE TABLE `invoice_application` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `invoice_no` VARCHAR(64) NOT NULL COMMENT '发票申请编号',
    `application_id` BIGINT NOT NULL COMMENT '关联申请ID',
    `company_id` BIGINT NOT NULL COMMENT '企业ID',
    `invoice_type` VARCHAR(32) NOT NULL COMMENT '发票类型: SPECIAL-增值税专用发票 GENERAL-增值税普通发票 ELECTRONIC-电子发票',
    `invoice_title` VARCHAR(255) NOT NULL COMMENT '发票抬头',
    `taxpayer_no` VARCHAR(32) NOT NULL COMMENT '纳税人识别号',
    `invoice_amount` DECIMAL(12,2) NOT NULL COMMENT '开票金额',
    `invoice_content` VARCHAR(255) DEFAULT NULL COMMENT '开票内容',
    `address` VARCHAR(500) DEFAULT NULL COMMENT '注册地址',
    `phone` VARCHAR(20) DEFAULT NULL COMMENT '注册电话',
    `bank_name` VARCHAR(128) DEFAULT NULL COMMENT '开户银行',
    `bank_account` VARCHAR(64) DEFAULT NULL COMMENT '银行账号',
    `receiver_name` VARCHAR(64) DEFAULT NULL COMMENT '收票人',
    `receiver_phone` VARCHAR(20) DEFAULT NULL COMMENT '收票人电话',
    `receiver_address` VARCHAR(500) DEFAULT NULL COMMENT '收票地址',
    `invoice_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING-待开具 INVOICED-已开具 MAILED-已寄出',
    `invoice_code` VARCHAR(64) DEFAULT NULL COMMENT '发票代码',
    `invoice_number` VARCHAR(64) DEFAULT NULL COMMENT '发票号码',
    `express_company` VARCHAR(64) DEFAULT NULL COMMENT '快递公司',
    `express_no` VARCHAR(64) DEFAULT NULL COMMENT '快递单号',
    `applicant_id` BIGINT DEFAULT NULL COMMENT '申请人ID',
    `issuer_id` BIGINT DEFAULT NULL COMMENT '开票人ID',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `issue_time` DATETIME DEFAULT NULL COMMENT '开票时间',
    `mail_time` DATETIME DEFAULT NULL COMMENT '寄出时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_invoice_no` (`invoice_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发票申请表';

DROP TABLE IF EXISTS `application_progress`;
CREATE TABLE `application_progress` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `application_id` BIGINT NOT NULL COMMENT '申请ID',
    `progress_code` VARCHAR(32) NOT NULL COMMENT '进度编码',
    `progress_name` VARCHAR(64) NOT NULL COMMENT '进度名称',
    `progress_desc` VARCHAR(500) DEFAULT NULL COMMENT '进度描述',
    `operator_name` VARCHAR(64) DEFAULT NULL COMMENT '处理人',
    `progress_time` DATETIME NOT NULL COMMENT '进度时间',
    `is_completed` TINYINT NOT NULL DEFAULT 1 COMMENT '是否已完成',
    PRIMARY KEY (`id`),
    KEY `idx_application_id` (`application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='申请进度追踪表';

-- =====================================================
-- 7. 实验室能力与资源
-- =====================================================

DROP TABLE IF EXISTS `lab_info`;
CREATE TABLE `lab_info` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `lab_code` VARCHAR(32) NOT NULL COMMENT '实验室编码',
    `lab_name` VARCHAR(64) NOT NULL COMMENT '实验室名称',
    `lab_type` VARCHAR(32) DEFAULT NULL COMMENT '实验室类型',
    `director` VARCHAR(64) DEFAULT NULL COMMENT '负责人',
    `phone` VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
    `location` VARCHAR(255) DEFAULT NULL COMMENT '位置',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_lab_code` (`lab_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='实验室信息表';

DROP TABLE IF EXISTS `lab_ability_scope`;
CREATE TABLE `lab_ability_scope` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `lab_id` BIGINT NOT NULL COMMENT '实验室ID',
    `product_category_id` BIGINT NOT NULL COMMENT '产品类别ID',
    `cert_type_id` BIGINT NOT NULL COMMENT '认证类型ID',
    `standard_code` VARCHAR(128) NOT NULL COMMENT '认可标准号',
    `standard_name` VARCHAR(255) NOT NULL COMMENT '认可标准名称',
    `test_item_scope` TEXT COMMENT '认可检测项目范围',
    `accreditation_no` VARCHAR(64) DEFAULT NULL COMMENT '认可编号',
    `accreditation_date` DATE DEFAULT NULL COMMENT '认可日期',
    `expire_date` DATE DEFAULT NULL COMMENT '认可到期日',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_lab_id` (`lab_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='实验室能力认可范围表';

-- =====================================================
-- 8. 统计与审计
-- =====================================================

DROP TABLE IF EXISTS `sys_audit_log`;
CREATE TABLE `sys_audit_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `log_no` VARCHAR(64) NOT NULL COMMENT '日志编号',
    `user_id` BIGINT DEFAULT NULL COMMENT '操作人ID',
    `user_name` VARCHAR(64) DEFAULT NULL COMMENT '操作人姓名',
    `module` VARCHAR(64) NOT NULL COMMENT '模块',
    `operation` VARCHAR(64) NOT NULL COMMENT '操作类型',
    `target_type` VARCHAR(64) DEFAULT NULL COMMENT '操作对象类型',
    `target_id` VARCHAR(64) DEFAULT NULL COMMENT '操作对象ID',
    `operation_detail` TEXT COMMENT '操作详情(JSON)',
    `operation_ip` VARCHAR(64) DEFAULT NULL COMMENT '操作IP',
    `user_agent` VARCHAR(500) DEFAULT NULL COMMENT 'User Agent',
    `operation_result` VARCHAR(16) NOT NULL DEFAULT 'SUCCESS' COMMENT '结果: SUCCESS-成功 FAIL-失败',
    `fail_reason` VARCHAR(500) DEFAULT NULL COMMENT '失败原因',
    `operation_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_log_no` (`log_no`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_operation_time` (`operation_time`),
    KEY `idx_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统操作审计日志表';

DROP TABLE IF EXISTS `sys_notification`;
CREATE TABLE `sys_notification` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `notification_type` VARCHAR(32) NOT NULL COMMENT '通知类型: SAMPLE-样品 TASK-任务 REPORT-报告 CERT-证书 OVERDUE-超期 REMIND-提醒',
    `title` VARCHAR(255) NOT NULL COMMENT '通知标题',
    `content` VARCHAR(1000) NOT NULL COMMENT '通知内容',
    `target_user_id` BIGINT DEFAULT NULL COMMENT '接收人ID(空则全体管理员)',
    `target_role_code` VARCHAR(64) DEFAULT NULL COMMENT '接收角色编码',
    `biz_type` VARCHAR(32) DEFAULT NULL COMMENT '业务类型',
    `biz_id` VARCHAR(64) DEFAULT NULL COMMENT '业务ID',
    `priority` VARCHAR(16) NOT NULL DEFAULT 'NORMAL' COMMENT '优先级: HIGH-高 NORMAL-普通 LOW-低',
    `is_read` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已读',
    `read_time` DATETIME DEFAULT NULL COMMENT '阅读时间',
    `is_push_sent` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已推送',
    `push_time` DATETIME DEFAULT NULL COMMENT '推送时间',
    `is_email_sent` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已邮件通知',
    `email_sent_time` DATETIME DEFAULT NULL COMMENT '邮件发送时间',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_target_user` (`target_user_id`),
    KEY `idx_is_read` (`is_read`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统通知表';
