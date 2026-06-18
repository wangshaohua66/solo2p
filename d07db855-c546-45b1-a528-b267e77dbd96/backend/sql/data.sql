USE `iccert`;

-- 初始化部门
INSERT INTO `sys_department` (`id`, `parent_id`, `dept_name`, `dept_code`, `leader`, `sort`) VALUES
(1, 0, '质量管理部', 'QM', '张明华', 1),
(2, 0, '业务受理部', 'BUS', '李娟', 2),
(3, 0, '电气实验室', 'EE-LAB', '王建国', 3),
(4, 0, '机械实验室', 'ME-LAB', '赵刚', 4),
(5, 0, '化学实验室', 'CH-LAB', '陈红', 5),
(6, 0, '建材实验室', 'BM-LAB', '刘强', 6),
(7, 0, '报告审核部', 'REP', '周明', 7);

-- 初始化5类角色 + 管理员
INSERT INTO `sys_role` (`id`, `role_code`, `role_name`, `description`, `sort`) VALUES
(1, 'CUSTOMER', '企业客户', '企业端用户,可在线申请、进度查询、下载报告', 1),
(2, 'SAMPLE_ADMIN', '样品管理员', '负责样品接收、登记、流转、留样管理', 2),
(3, 'TECHNICIAN', '实验室技术员', '负责实验室检测、数据录入', 3),
(4, 'REPORT_AUDITOR', '报告审核员', '负责检测报告编制与审核', 4),
(5, 'CERT_EXPERT', '认证专家', '负责认证证书签发与复核', 5),
(6, 'ADMIN', '系统管理员', '实验室管理员,拥有全部权限', 99);

-- 初始化用户: 密码均为123456 (BCrypt: $2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi)
INSERT INTO `sys_user` (`id`, `username`, `password`, `real_name`, `email`, `phone`, `department_id`, `status`) VALUES
(1, 'admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '张明华', 'admin@iccert.com', '13800000000', 1, 1),
(2, 'lijuan', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '李娟', 'lijuan@iccert.com', '13800000001', 2, 1),
(3, 'zhangwei', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '张伟', 'zhangwei@iccert.com', '13800000002', 3, 1),
(4, 'liuxiaoyan', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '刘晓燕', 'liuxiaoyan@iccert.com', '13800000003', 5, 1),
(5, 'zhouming', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '周明', 'zhouming@iccert.com', '13800000004', 7, 1),
(6, 'wangfang', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '王芳', 'wangfang@iccert.com', '13800000005', 7, 1),
(7, 'zhaogang', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '赵刚', 'zhaogang@iccert.com', '13800000006', 4, 1),
(8, 'chenhong', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '陈红', 'chenhong@iccert.com', '13800000007', 5, 1);

-- 用户角色关联
INSERT INTO `sys_user_role` (`user_id`, `role_id`) VALUES
(1, 6), (2, 2), (3, 3), (4, 3), (5, 4), (6, 5), (7, 3), (8, 3);

-- 初始化菜单
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_path`, `menu_icon`, `permission`, `menu_type`, `sort`) VALUES
(1, 0, '工作台', '/dashboard', '📊', NULL, 1, 1),
(2, 1, '数据概览', '/dashboard', '📊', 'dashboard:view', 2, 1),
(3, 1, '我的待办', '/todo', '📋', 'todo:view', 2, 2),
(4, 0, '业务管理', NULL, '📦', NULL, 1, 2),
(5, 4, '样品管理', '/samples', '📦', 'sample:view', 2, 1),
(6, 5, '样品登记', NULL, NULL, 'sample:add', 3, 1),
(7, 5, '批量导入', NULL, NULL, 'sample:import', 3, 2),
(8, 5, '样品销毁', NULL, NULL, 'sample:destroy', 3, 3),
(9, 4, '检测任务', '/tasks', '📝', 'task:view', 2, 2),
(10, 9, '任务分配', NULL, NULL, 'task:assign', 3, 1),
(11, 9, '智能调度', NULL, NULL, 'task:dispatch', 3, 2),
(12, 4, '报告证书', '/reports', '📄', 'report:view', 2, 3),
(13, 12, '生成报告', NULL, NULL, 'report:generate', 3, 1),
(14, 12, '审核报告', NULL, NULL, 'report:audit', 3, 2),
(15, 12, '签发证书', NULL, NULL, 'cert:issue', 3, 3),
(16, 4, '客户服务', '/customers', '🏢', 'customer:view', 2, 4),
(17, 16, '申请审核', NULL, NULL, 'application:audit', 3, 1),
(18, 16, '发票管理', NULL, NULL, 'invoice:manage', 3, 2),
(19, 0, '资源管理', NULL, '🔬', NULL, 1, 3),
(20, 19, '实验室资源', '/lab', '🔬', 'lab:view', 2, 1),
(21, 20, '设备校准', NULL, NULL, 'equipment:calibrate', 3, 1),
(22, 20, '培训记录', NULL, NULL, 'training:manage', 3, 2),
(23, 20, '能力范围', NULL, NULL, 'ability:manage', 3, 3),
(24, 19, '数据追溯', '/trace', '🔍', 'trace:view', 2, 2),
(25, 0, '统计分析', NULL, '📈', NULL, 1, 4),
(26, 25, '统计报表', '/analytics', '📈', 'analytics:view', 2, 1),
(27, 0, '系统管理', NULL, '⚙️', NULL, 1, 99),
(28, 27, '用户管理', NULL, '👥', 'user:manage', 2, 1),
(29, 27, '角色管理', NULL, '🎭', 'role:manage', 2, 2),
(30, 27, '菜单管理', NULL, '📑', 'menu:manage', 2, 3);

-- 管理员角色所有菜单
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 6, id FROM `sys_menu`;

-- 样品管理员
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES
(2,1),(2,2),(2,3),(2,4),(2,5),(2,6),(2,7),(2,8),(2,9),(2,19),(2,20),(2,24);

-- 实验室技术员
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES
(3,1),(3,2),(3,3),(3,4),(3,9),(3,19),(3,20),(3,24);

-- 报告审核员
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES
(4,1),(4,2),(4,3),(4,4),(4,12),(4,13),(4,14),(4,24),(4,25),(4,26);

-- 认证专家
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES
(5,1),(5,2),(5,3),(5,4),(5,12),(5,15),(5,25),(5,26);

-- 企业客户
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES
(1,1),(1,2);

-- 8个产品领域(补齐3个缺失: 纺织服装TX、玩具文具TW、医疗器械MD)
INSERT INTO `dict_product_category` (`id`, `category_code`, `category_name`, `description`, `sort`) VALUES
(1, 'EE', '电子电器', '电子电器产品检测', 1),
(2, 'ME', '机械装备', '机械设备装备检测', 2),
(3, 'BM', '建材家具', '建筑材料与家具检测', 3),
(4, 'AU', '汽车零部件', '汽车及零部件检测', 4),
(5, 'FC', '食品接触', '食品接触材料检测', 5),
(6, 'TX', '纺织服装', '纺织品、服装及鞋类检测', 6),
(7, 'TW', '玩具文具', '玩具、文具及儿童用品检测', 7),
(8, 'MD', '医疗器械', '医疗器械及医美产品检测', 8);

-- 认证类型
INSERT INTO `dict_cert_type` (`id`, `cert_code`, `cert_name`, `cert_full_name`, `valid_period_months`, `sort`) VALUES
(1, 'CCC', 'CCC认证', '中国强制性产品认证', 60, 1),
(2, 'CE', 'CE认证', '欧盟CE安全合格认证', 36, 2),
(3, 'ISO', 'ISO体系认证', 'ISO质量管理体系认证', 36, 3),
(4, 'ROHS', 'RoHS认证', '欧盟有害物质限用指令认证', 36, 4),
(5, 'REACH', 'REACH认证', '欧盟化学品注册评估授权许可', 36, 5),
(6, 'FDA', 'FDA认证', '美国食品药品监督管理局认证', 24, 6);

-- 实验室
INSERT INTO `lab_info` (`id`, `lab_code`, `lab_name`, `lab_type`, `director`, `sort`) VALUES
(1, 'EE-LAB', '电气实验室', '安全/EMC', '王建国', 1),
(2, 'ME-LAB', '机械实验室', '机械/材料', '赵刚', 2),
(3, 'CH-LAB', '化学实验室', '化学分析', '陈红', 3),
(4, 'BM-LAB', '建材实验室', '建材/阻燃', '刘强', 4),
(5, 'EMC-LAB', 'EMC实验室', '电磁兼容', '孙明', 5),
(6, 'ENV-LAB', '环境实验室', '环境可靠性', '黄海', 6),
(7, 'AU-LAB', '汽车零部件实验室', '汽车安全', '吴强', 7),
(8, 'TX-LAB', '纺织玩具实验室', '纺织/玩具', '郑华', 8);

-- 客户企业
INSERT INTO `customer_company` (`id`, `company_name`, `credit_code`, `legal_person`, `contact_person`, `contact_phone`, `contact_email`, `product_category_id`, `customer_level`) VALUES
(1, '上海正泰电器有限公司', '91310000MA1FL0XX11', '南存辉', '陈经理', '13812345678', 'chen@chint.com', 1, 'A'),
(2, '三一重工股份有限公司', '91430000717079XX22', '梁稳根', '李主任', '13987654321', 'li@sany.com', 2, 'A'),
(3, '苏泊尔集团有限公司', '913310007195XXXX33', '苏显泽', '王总', '13700001111', 'wang@supor.com', 5, 'B'),
(4, '海尔智家股份有限公司', '91370200163XXXX44', '张瑞敏', '刘经理', '13600002222', 'liu@haier.com', 1, 'A'),
(5, '比亚迪股份有限公司', '91440300192XXXX55', '王传福', '赵工', '13500003333', 'zhao@byd.com', 4, 'A'),
(6, '海澜之家股份有限公司', '91320200703XXXX66', '周建平', '孙经理', '13400004444', 'sun@heilan.com', 6, 'B');

-- 企业端用户
INSERT INTO `customer_user` (`id`, `company_id`, `username`, `password`, `real_name`, `phone`, `email`, `is_main_contact`, `status`) VALUES
(1, 1, 'chint_customer', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '陈经理', '13812345678', 'chen@chint.com', 1, 1),
(2, 2, 'sany_customer', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '李主任', '13987654321', 'li@sany.com', 1, 1);

-- 检测设备
INSERT INTO `lab_equipment` (`id`, `equipment_code`, `equipment_name`, `equipment_model`, `lab_id`, `lab_name`, `equipment_status`, `current_load`, `max_load`, `calibration_cycle_days`, `next_calibration_date`, `manufacturer`, `purchase_date`) VALUES
(1, 'EE-001', '耐压测试仪', 'CS2675DX', 1, '电气实验室', 'IDLE', 0, 100, 180, '2025-09-15', '南京长盛', '2023-05-10'),
(2, 'EE-002', '接地电阻测试仪', 'UT572', 1, '电气实验室', 'RUNNING', 45, 100, 180, '2025-08-20', '优利德', '2023-03-15'),
(3, 'EE-003', '泄漏电流测试仪', 'CS5510', 1, '电气实验室', 'IDLE', 0, 100, 180, '2025-10-01', '南京长盛', '2022-11-08'),
(4, 'EMC-001', 'EMC传导测试系统', 'EMI-3000', 5, 'EMC实验室', 'IDLE', 0, 100, 120, '2025-07-25', 'R&S罗德与施瓦茨', '2023-01-20'),
(5, 'ME-001', '万能材料试验机', 'WDW-100', 2, '机械实验室', 'RUNNING', 60, 100, 365, '2025-12-30', '济南时代试金', '2022-06-18'),
(6, 'ME-002', '三坐标测量仪', 'Global S', 2, '机械实验室', 'IDLE', 0, 100, 365, '2026-01-10', '海克斯康', '2023-08-05'),
(7, 'CH-001', 'GC-MS气相色谱质谱联用仪', '7890B-5977A', 3, '化学实验室', 'RUNNING', 70, 100, 180, '2025-08-10', 'Agilent安捷伦', '2022-04-22'),
(8, 'CH-002', 'ICP-MS电感耦合等离子体质谱', 'NexION 350D', 3, '化学实验室', 'IDLE', 0, 100, 180, '2025-09-30', 'PerkinElmer', '2023-06-15'),
(9, 'ENV-001', '恒温恒湿试验箱', 'GDJS-1000', 6, '环境实验室', 'IDLE', 0, 100, 180, '2025-11-15', '上海一恒', '2022-09-10'),
(10, 'ENV-002', '振动试验机', 'ES-50', 6, '环境实验室', 'RUNNING', 30, 100, 180, '2025-10-05', '东菱振动', '2023-02-28');

-- 技术人员
INSERT INTO `lab_technician` (`id`, `user_id`, `technician_name`, `title`, `lab_id`, `lab_name`, `workload`, `status`, `cert_count`) VALUES
(1, 3, '张伟', '高级工程师', 1, '电气实验室', 40, 'BUSY', 5),
(2, 4, '刘晓燕', '工程师', 3, '化学实验室', 65, 'BUSY', 4),
(3, 7, '赵刚', '高级工程师', 2, '机械实验室', 35, 'BUSY', 6),
(4, 8, '陈红', '工程师', 5, '化学实验室', 25, 'NORMAL', 3),
(5, NULL, '孙明', '工程师', 5, 'EMC实验室', 10, 'NORMAL', 4),
(6, NULL, '黄海', '高级工程师', 6, '环境实验室', 55, 'BUSY', 5);

-- 技术员技能
INSERT INTO `technician_skill` (`technician_id`, `skill_name`, `skill_level`, `cert_no`, `expire_date`) VALUES
(1, '电气安全检测', '高级', 'CQC-EE-2023-001', '2026-05-10'),
(1, 'EMC检测', '中级', 'CQC-EMC-2024-015', '2027-01-20'),
(2, '化学分析检测', '高级', 'CQC-CH-2023-008', '2026-08-15'),
(2, 'RoHS检测', '高级', 'CQC-RoHS-2023-022', '2026-11-30'),
(3, '机械性能检测', '高级', 'CQC-ME-2022-045', '2025-12-01'),
(3, '材料检测', '中级', 'CQC-MAT-2023-010', '2026-03-15'),
(4, '食品接触材料检测', '高级', 'CQC-FC-2023-018', '2026-09-20'),
(5, 'EMC传导测试', '高级', 'CQC-EMC-2023-003', '2026-04-10'),
(6, '环境可靠性测试', '高级', 'CQC-ENV-2022-033', '2025-10-18');

-- 技术员培训记录
INSERT INTO `technician_training` (`technician_id`, `training_title`, `training_content`, `training_date`, `training_hours`, `trainer`) VALUES
(1, '新版GB4706.1标准培训', '家用和类似用途电器安全通用要求新版标准解读', '2025-03-15', 8.0, '国家认监委专家'),
(2, 'RoHS 2.0新增物质检测方法', '邻苯二甲酸酯等4项新增物质GC-MS检测方法', '2025-02-20', 6.0, '安捷伦技术工程师'),
(3, 'ISO 17025体系内审员培训', '实验室认可体系内审员资格培训', '2025-01-10', 16.0, 'CNAS认可机构'),
(6, '高低温交变试验操作规范', '环境试验箱的使用、维护及数据判定', '2025-04-05', 4.0, '设备厂家工程师');

-- 实验室能力范围
INSERT INTO `lab_ability_scope` (`lab_id`, `product_category_id`, `cert_type_id`, `standard_code`, `standard_name`, `test_item_scope`, `accreditation_no`, `accreditation_date`, `expire_date`) VALUES
(1, 1, 1, 'GB 4706.1-2005', '家用和类似用途电器的安全 第1部分：通用要求', '电气强度、接地电阻、泄漏电流、温升等', 'CNAS L0001-EE', '2024-01-15', '2026-01-14'),
(1, 1, 2, 'EN 60335-1:2012', 'Household and similar electrical appliances - Safety - Part 1: General requirements', 'Electrical strength, Earth continuity, Leakage current', 'CNAS L0001-CE', '2024-03-20', '2026-03-19'),
(5, 1, 2, 'EN 55014-1:2017', '电磁兼容 家用电器、电动工具和类似器具的要求 第1部分：发射', '传导发射、辐射发射', 'CNAS L0005-EMC', '2024-02-10', '2026-02-09'),
(3, 5, 4, 'IEC 62321-4:2013', '电子电气产品中某些物质的测定 第4部分：CV-AAS、CV-AFS、ICP-OES和ICP-MS法测定汞', '铅、汞、镉、六价铬等有害物质', 'CNAS L0003-RoHS', '2024-05-08', '2026-05-07'),
(2, 2, 1, 'GB/T 1002-2021', '家用和类似用途单相插头插座 型式、基本参数和尺寸', '机械强度、电气性能', 'CNAS L0002-ME', '2024-04-22', '2026-04-21'),
(6, 1, 1, 'GB/T 2423系列', '电工电子产品环境试验', '高低温、湿热、振动、冲击', 'CNAS L0006-ENV', '2024-06-30', '2026-06-29'),
(8, 6, 2, 'EN ISO 105-X02:1993', '纺织品 色牢度试验 第X02部分：耐摩擦色牢度', '耐摩擦色牢度、耐水洗色牢度', 'CNAS L0008-TX', '2024-07-12', '2026-07-11');

-- 样品(示例数据)
INSERT INTO `sample_info` (`id`, `sample_code`, `sample_name`, `sample_model`, `sample_code_internal`, `company_id`, `company_name`, `product_category_id`, `product_category_name`, `cert_type_id`, `cert_type_code`, `sample_amount`, `sample_unit`, `receiver_id`, `receiver_name`, `receive_time`, `sample_status`, `storage_location`, `retention_expire_date`, `priority`) VALUES
(1, 'SP202501150001', '智能电饭煲', 'CFXB40FC8040-75', 'ZT-2025-001', 4, '海尔智家股份有限公司', 1, '电子电器', 1, 'CCC', 2, '台', 2, '李娟', '2025-01-15 09:30:00', 'TESTING', 'A区-01-03', '2025-07-15', 'HIGH'),
(2, 'SP202501160002', '电动自行车充电器', 'EC-4812', 'CDQ-008', 1, '上海正泰电器有限公司', 1, '电子电器', 1, 'CCC', 5, '台', 2, '李娟', '2025-01-16 10:15:00', 'REPORTED', 'A区-02-05', '2025-07-16', 'NORMAL'),
(3, 'SP202501170003', '液压油缸', 'HOB-80*200', 'YYG-2025-015', 2, '三一重工股份有限公司', 2, '机械装备', 3, 'ISO', 1, '件', 2, '李娟', '2025-01-17 14:20:00', 'TESTING', 'B区-01-08', '2025-07-17', 'MEDIUM'),
(4, 'SP202501180004', '不锈钢压力锅', 'YL249H2', 'YLG-022', 3, '苏泊尔集团有限公司', 5, '食品接触', 4, 'ROHS', 3, '件', 2, '李娟', '2025-01-18 11:00:00', 'REGISTERED', 'C区-03-02', '2025-07-18', 'NORMAL'),
(5, 'SP202501190005', '电动汽车电机控制器', 'TCU-BYD-2024', 'DKQ-003', 5, '比亚迪股份有限公司', 4, '汽车零部件', 1, 'CCC', 2, '件', 2, '李娟', '2025-01-19 16:45:00', 'TESTING', 'D区-02-10', '2025-07-19', 'HIGH'),
(6, 'SP202501200006', '男士商务衬衫', 'HL-2025-SS001', 'CS-088', 6, '海澜之家股份有限公司', 6, '纺织服装', 2, 'CE', 10, '件', 2, '李娟', '2025-01-20 09:00:00', 'RECEIVED', 'E区-01-01', '2025-07-20', 'NORMAL'),
(7, 'SP202501210007', '儿童塑料玩具', 'TW-888', 'WJ-055', NULL, '某玩具厂', 7, '玩具文具', 1, 'CCC', 3, '件', 2, '李娟', '2025-01-21 13:30:00', 'TESTING', 'F区-01-03', '2025-07-21', 'HIGH'),
(8, 'SP202501220008', '一次性使用输液器', 'IV-001-G', 'YLQX-012', NULL, '某医疗器械公司', 8, '医疗器械', 1, 'CCC', 20, '套', 2, '李娟', '2025-01-22 10:30:00', 'REGISTERED', 'G区-01-05', '2025-07-22', 'HIGH');

-- 样品流转记录
INSERT INTO `sample_flow_log` (`sample_id`, `sample_code`, `flow_status`, `flow_status_text`, `operator_id`, `operator_name`, `operation_desc`) VALUES
(1, 'SP202501150001', 'RECEIVED', '样品已接收', 2, '李娟', '快递签收,外观完好'),
(1, 'SP202501150001', 'REGISTERED', '样品已登记', 2, '李娟', '录入系统,生成追溯码'),
(1, 'SP202501150001', 'TESTING', '检测中', 1, '张伟', '分配至电气实验室'),
(2, 'SP202501160002', 'RECEIVED', '样品已接收', 2, '李娟', '自送样品'),
(2, 'SP202501160002', 'REGISTERED', '样品已登记', 2, '李娟', '录入系统'),
(2, 'SP202501160002', 'TESTING', '检测中', 1, '张伟', '电气安全检测完成'),
(2, 'SP202501160002', 'REPORTED', '报告编制中', 5, '周明', '生成检测报告');

-- 检测任务
INSERT INTO `inspection_task` (`id`, `task_code`, `task_title`, `sample_id`, `sample_code`, `cert_type_id`, `cert_type_code`, `technician_id`, `technician_name`, `equipment_id`, `equipment_name`, `priority`, `task_status`, `progress`, `assign_time`, `start_time`, `deadline`, `auto_dispatched`) VALUES
(1, 'TK202501150001', '智能电饭煲CCC安全检测', 1, 'SP202501150001', 1, 'CCC', 1, '张伟', 1, '耐压测试仪', 'HIGH', 'IN_PROGRESS', 55, '2025-01-15 10:00:00', '2025-01-15 10:30:00', '2025-01-28', 1),
(2, 'TK202501150002', '智能电饭煲EMC传导检测', 1, 'SP202501150001', 1, 'CCC', 5, '孙明', 4, 'EMC传导测试系统', 'HIGH', 'PENDING', 0, NULL, NULL, '2025-01-30', 0),
(3, 'TK202501160003', '电动自行车充电器CCC检测', 2, 'SP202501160002', 1, 'CCC', 1, '张伟', 2, '接地电阻测试仪', 'NORMAL', 'COMPLETED', 100, '2025-01-16 11:00:00', '2025-01-16 13:00:00', '2025-01-25', 1),
(4, 'TK202501170004', '液压油缸机械性能检测', 3, 'SP202501170003', 3, 'ISO', 3, '赵刚', 5, '万能材料试验机', 'MEDIUM', 'IN_PROGRESS', 40, '2025-01-17 15:00:00', '2025-01-18 09:00:00', '2025-02-05', 1),
(5, 'TK202501180005', '不锈钢压力锅RoHS有害物质检测', 4, 'SP202501180004', 4, 'ROHS', 2, '刘晓燕', 7, 'GC-MS气相色谱质谱联用仪', 'NORMAL', 'PENDING', 0, NULL, NULL, '2025-02-01', 0),
(6, 'TK202501190006', '电动汽车电机控制器CCC检测', 5, 'SP202501190005', 1, 'CCC', 1, '张伟', 3, '泄漏电流测试仪', 'HIGH', 'IN_PROGRESS', 20, '2025-01-19 17:30:00', '2025-01-20 09:00:00', '2025-02-08', 1),
(7, 'TK202501200007', '男士衬衫CE色牢度检测', 6, 'SP202501200006', 2, 'CE', 4, '陈红', NULL, NULL, 'NORMAL', 'PENDING', 0, NULL, NULL, '2025-02-10', 0),
(8, 'TK202501210008', '儿童玩具CCC安全检测', 7, 'SP202501210007', 1, 'CCC', 6, '黄海', 9, '恒温恒湿试验箱', 'HIGH', 'IN_PROGRESS', 65, '2025-01-21 14:00:00', '2025-01-22 09:00:00', '2025-02-05', 1),
(9, 'TK202501210009', '儿童玩具机械物理性能检测', 7, 'SP202501210007', 1, 'CCC', 3, '赵刚', 6, '三坐标测量仪', 'HIGH', 'REVIEW', 95, '2025-01-21 15:00:00', '2025-01-22 10:00:00', '2025-02-01', 1);

-- 检测项目明细
INSERT INTO `task_item` (`task_id`, `item_name`, `item_code`, `standard_clause`, `requirement`, `test_method`, `result_value`, `result_unit`, `result_judgment`, `is_tested`, `test_time`, `tester_id`, `sort`) VALUES
(1, '电气强度', 'EE-001', 'GB4706.1-2005 第13章', '1500V/1min 无击穿闪络', '耐压测试仪测试', 'PASS', NULL, 'PASS', 1, '2025-01-15 14:20:00', 1, 1),
(1, '接地电阻', 'EE-002', 'GB4706.1-2005 第27章', '≤0.1Ω', '接地电阻测试仪', '0.042', 'Ω', 'PASS', 1, '2025-01-15 14:45:00', 1, 2),
(1, '泄漏电流', 'EE-003', 'GB4706.1-2005 第16章', '≤0.75mA', '泄漏电流测试仪', NULL, 'mA', 'PENDING', 0, NULL, NULL, 3),
(1, '温升测试', 'EE-004', 'GB4706.1-2005 第11章', '绕组温升≤75K', '热电偶法', NULL, 'K', 'PENDING', 0, NULL, NULL, 4),
(3, '电气强度', 'EE-001', 'GB4706.1-2005 第13章', '3750V/1min 无击穿', '耐压测试仪测试', 'PASS', NULL, 'PASS', 1, '2025-01-16 15:30:00', 1, 1),
(3, '接地电阻', 'EE-002', 'GB4706.1-2005 第27章', '≤0.1Ω', '接地电阻测试仪', '0.035', 'Ω', 'PASS', 1, '2025-01-16 15:50:00', 1, 2),
(4, '抗拉强度', 'ME-001', 'ISO 6892-1:2019', '≥350MPa', '万能试验机拉伸', '385', 'MPa', 'PASS', 1, '2025-01-18 14:20:00', 3, 1),
(4, '屈服强度', 'ME-002', 'ISO 6892-1:2019', '≥235MPa', '万能试验机拉伸', '268', 'MPa', 'PASS', 1, '2025-01-18 14:35:00', 3, 2),
(4, '延伸率', 'ME-003', 'ISO 6892-1:2019', '≥20%', '万能试验机拉伸', NULL, '%', 'PENDING', 0, NULL, NULL, 3),
(9, '小零件测试', 'TW-001', 'GB 6675.2-2014 第5.2节', '不得产生可摄入小零件', '扭矩/拉力测试', 'PASS', NULL, 'PASS', 1, '2025-01-22 11:30:00', 3, 1),
(9, '锐利尖端测试', 'TW-002', 'GB 6675.2-2014 第5.3节', '不得存在危险锐利尖端', '锐利尖端测试仪', 'PASS', NULL, 'PASS', 1, '2025-01-22 14:00:00', 3, 2),
(9, '锐利边缘测试', 'TW-003', 'GB 6675.2-2014 第5.4节', '不得存在危险锐利边缘', '锐利边缘测试仪', NULL, NULL, 'PENDING', 0, NULL, NULL, 3);

-- 检测报告
INSERT INTO `inspection_report` (`id`, `report_code`, `report_title`, `sample_id`, `sample_code`, `task_id`, `company_id`, `company_name`, `cert_type_id`, `cert_type_code`, `report_status`, `report_version`, `overall_result`, `author_id`, `author_name`, `reviewer_id`, `reviewer_name`, `issue_time`) VALUES
(1, 'RP202501200001', '电动自行车充电器CCC检测报告', 2, 'SP202501160002', 3, 1, '上海正泰电器有限公司', 1, 'CCC', 'ISSUED', 'V1.0', 'PASS', 5, '周明', 6, '王芳', '2025-01-20 16:00:00'),
(2, 'RP202501150002', '智能电饭煲CCC检测报告', 1, 'SP202501150001', 1, 4, '海尔智家股份有限公司', 1, 'CCC', 'DRAFT', 'V1.0', NULL, 5, '周明', NULL, NULL, NULL),
(3, 'RP202501170003', '液压油缸ISO检测报告', 3, 'SP202501170003', 4, 2, '三一重工股份有限公司', 3, 'ISO', 'REVIEWING', 'V1.0', NULL, 5, '周明', NULL, NULL, NULL),
(4, 'RP202501210004', '儿童玩具CCC检测报告', 7, 'SP202501210007', 9, NULL, '某玩具厂', 1, 'CCC', 'DRAFT', 'V1.0', NULL, 5, '周明', NULL, NULL, NULL),
(5, 'RP202412010005', '不锈钢保温杯食品接触检测报告', NULL, NULL, NULL, 3, '苏泊尔集团有限公司', 4, 'ROHS', 'ISSUED', 'V1.2', 'PASS', 5, '周明', 6, '王芳', '2024-12-05 10:30:00');

-- 证书
INSERT INTO `certificate_info` (`id`, `cert_no`, `cert_type_id`, `cert_type_code`, `company_id`, `company_name`, `product_name`, `product_model`, `product_category_id`, `standard_code`, `report_id`, `report_code`, `cert_status`, `issue_date`, `expire_date`, `valid_years`, `issuer_id`, `issuer_name`) VALUES
(1, 'CCC202401010012345', 1, 'CCC', 1, '上海正泰电器有限公司', '小型断路器', 'DZ47-63 C16', 1, 'GB 10963.1-2020', 5, 'RP202412010005', 'VALID', '2024-01-15', '2029-01-14', 5, 6, '王芳'),
(2, 'CE2024EU0023456', 2, 'CE', 4, '海尔智家股份有限公司', '家用洗衣机', 'XQG100-BD14376LU1', 1, 'EN 60335-2-7', NULL, NULL, 'VALID', '2024-05-20', '2027-05-19', 3, 6, '王芳'),
(3, 'ISO9001-2024-0088', 3, 'ISO', 2, '三一重工股份有限公司', '质量管理体系', NULL, 2, 'ISO 9001:2015', NULL, NULL, 'VALID', '2024-08-10', '2027-08-09', 3, 6, '王芳'),
(4, 'CCC202301010009988', 1, 'CCC', 5, '比亚迪股份有限公司', '电动汽车充电桩', 'BYD-EVSE-7kW', 4, 'GB/T 18487.1-2023', NULL, NULL, 'EXPIRING', '2023-03-25', '2025-03-24', 5, 6, '王芳'),
(5, 'ROHS2024-00345', 4, 'ROHS', 3, '苏泊尔集团有限公司', '食品接触用不锈钢制品', 'FW-24', 5, 'IEC 62321系列', NULL, NULL, 'VALID', '2024-11-05', '2027-11-04', 3, 6, '王芳');

-- 报告模板
INSERT INTO `report_template` (`id`, `template_code`, `template_name`, `cert_type_id`, `product_category_id`, `template_content`, `field_mapping`, `condition_rules`, `calculation_rules`, `version`, `is_default`, `create_by`) VALUES
(1, 'RPT-CCC-EE', '电子电器CCC检测报告模板', 1, 1, '<!DOCTYPE html><html><head><title>CCC检测报告</title></head><body>报告内容...</body></html>', '{"report_code":"报告编号","sample_name":"样品名称","company_name":"委托单位","test_items":"检测项目表","overall_result":"判定结论"}', '[{"field":"overall_result","condition":"PASS","show":"绿色合格章"},{"field":"overall_result","condition":"FAIL","show":"红色不合格章"}]', '[{"target":"overall_result","formula":"ALL(test_items.pass) ? \"PASS\" : \"FAIL\""}]', 'V2.1', 1, 5),
(2, 'RPT-CE-EE', '电子电器CE检测报告模板', 2, 1, '<!DOCTYPE html><html><head><title>CE Test Report</title></head><body>...</body></html>', '{}', '[]', '[]', 'V1.5', 1, 5),
(3, 'RPT-ISO-ME', '机械装备ISO检测报告模板', 3, 2, '<html><body>ISO体系检测报告模板...</body></html>', '{}', '[]', '[]', 'V1.2', 1, 5),
(4, 'RPT-ROHS-CH', 'RoHS有害物质检测报告模板', 4, 5, '<html><body>RoHS检测报告模板...</body></html>', '{}', '[]', '[]', 'V1.8', 1, 5);

-- 证书模板
INSERT INTO `certificate_template` (`id`, `template_code`, `template_name`, `cert_type_id`, `template_content`, `field_mapping`, `signature_config`, `print_config`) VALUES
(1, 'CERT-CCC', 'CCC认证证书模板', 1, '<!DOCTYPE html><html><body style="background:#FFF8DC;"><div style="border:8px double #D4AF37; padding:60px;"><h1 style="text-align:center;color:#8B6914;">中国强制性产品认证证书</h1>...</div></body></html>', '{"cert_no":"证书编号","company_name":"委托人名称","product_name":"产品名称和描述","standard_code":"认证依据标准","issue_date":"发证日期","expire_date":"有效期至"}', '{"enable":true,"position":"bottom-right","signer_name":"授权签字人","seal_image_url":"/seals/ccc-seal.png"}', '{"paper_size":"A4","orientation":"portrait","margin_top":"20mm","color":true,"copies":2}'),
(2, 'CERT-CE', 'CE认证证书模板', 2, '<!DOCTYPE html><html><body><div style="border:3px solid #003399; padding:50px;"><h1 style="text-align:center;color:#003399;">CE Certificate of Conformity</h1>...</div></body></html>', '{}', '{"enable":true,"position":"bottom-center"}', '{"paper_size":"A4","orientation":"landscape"}'),
(3, 'CERT-ISO', 'ISO体系认证证书模板', 3, '<html><body><h1 style="text-align:center;">质量管理体系认证证书</h1>...</body></html>', '{}', '{"enable":true,"position":"bottom-right"}', '{"paper_size":"A3","orientation":"portrait"}');

-- 客户在线申请
INSERT INTO `inspection_application` (`id`, `application_no`, `company_id`, `company_name`, `applicant_id`, `applicant_name`, `product_name`, `product_model`, `product_category_id`, `product_category_name`, `cert_type_id`, `cert_type_code`, `sample_amount`, `application_status`, `sample_send_method`, `total_amount`, `paid_amount`, `payment_status`, `submit_time`, `sample_id`, `task_id`, `report_id`, `certificate_id`) VALUES
(1, 'AP202501150001', 1, '上海正泰电器有限公司', NULL, '陈经理', '智能漏电保护器', 'DZ47LE-32', 1, '电子电器', 1, 'CCC', 10, 'COMPLETED', 'EXPRESS', 3500.00, 3500.00, 'PAID', '2025-01-15 08:30:00', 2, 3, 1, 1),
(2, 'AP202501160002', 4, '海尔智家股份有限公司', NULL, '刘经理', '智能电饭煲', 'CFXB40FC8040-75', 1, '电子电器', 1, 'CCC', 2, 'PROCESSING', 'SELF', 4800.00, 4800.00, 'PAID', '2025-01-16 09:15:00', 1, 1, 2, NULL),
(3, 'AP202501170003', 2, '三一重工股份有限公司', NULL, '李主任', '液压油缸', 'HOB-80*200', 2, '机械装备', 3, 'ISO', 1, 'PROCESSING', 'EXPRESS', 2200.00, 0.00, 'UNPAID', '2025-01-17 10:00:00', 3, 4, 3, NULL),
(4, 'AP202501180004', 5, '比亚迪股份有限公司', NULL, '赵工', '电机控制器', 'TCU-BYD-2024', 4, '汽车零部件', 1, 'CCC', 2, 'APPROVED', 'EXPRESS', 6500.00, 6500.00, 'PAID', '2025-01-18 14:30:00', 5, 6, NULL, NULL),
(5, 'AP202501190005', 3, '苏泊尔集团有限公司', NULL, '王总', '不锈钢压力锅', 'YL249H2', 5, '食品接触', 4, 'ROHS', 3, 'PENDING', 'EXPRESS', 1800.00, 0.00, 'UNPAID', '2025-01-19 16:00:00', NULL, NULL, NULL, NULL);

-- 申请进度追踪
INSERT INTO `application_progress` (`application_id`, `progress_code`, `progress_name`, `progress_desc`, `operator_name`, `progress_time`) VALUES
(1, 'SUBMIT', '提交申请', '客户在线提交检测申请', '陈经理', '2025-01-15 08:30:00'),
(1, 'PAYMENT', '完成支付', '检测费用已支付 ¥3500.00', '系统', '2025-01-15 08:35:00'),
(1, 'AUDIT', '申请审核通过', '业务受理部审核通过', '李娟', '2025-01-15 09:00:00'),
(1, 'SAMPLE_RECEIVED', '样品已接收', '样品快递签收,外观完好', '李娟', '2025-01-16 10:15:00'),
(1, 'TESTING', '检测中', '实验室正在进行检测', '张伟', '2025-01-16 13:00:00'),
(1, 'REPORT_ISSUED', '报告已签发', '检测报告已签发,可下载', '周明', '2025-01-20 16:00:00'),
(1, 'CERT_ISSUED', '证书已签发', 'CCC认证证书已签发', '王芳', '2025-01-21 10:00:00'),
(2, 'SUBMIT', '提交申请', '客户在线提交检测申请', '刘经理', '2025-01-16 09:15:00'),
(2, 'PAYMENT', '完成支付', '检测费用已支付 ¥4800.00', '系统', '2025-01-16 09:20:00'),
(2, 'AUDIT', '申请审核通过', '业务受理部审核通过', '李娟', '2025-01-16 10:00:00'),
(2, 'SAMPLE_RECEIVED', '样品已接收', '客户自送样品,已验收', '李娟', '2025-01-15 09:30:00'),
(2, 'TESTING', '检测中', '实验室正在进行电气安全检测', '张伟', '2025-01-15 10:30:00');

-- 支付记录
INSERT INTO `payment_record` (`id`, `payment_no`, `application_id`, `company_id`, `payment_amount`, `payment_method`, `payment_status`, `third_party_no`, `payment_time`) VALUES
(1, 'PAY202501150001', 1, 1, 3500.00, 'ALIPAY', 'SUCCESS', '2025011522001442001', '2025-01-15 08:35:12'),
(2, 'PAY202501160002', 2, 4, 4800.00, 'WECHAT', 'SUCCESS', '420000123420250116', '2025-01-16 09:20:45'),
(3, 'PAY202501180003', 4, 5, 6500.00, 'BANK', 'SUCCESS', 'BANK2025011800123', '2025-01-18 15:10:00');

-- 通知
INSERT INTO `sys_notification` (`id`, `notification_type`, `title`, `content`, `target_user_id`, `target_role_code`, `biz_type`, `biz_id`, `priority`, `is_read`) VALUES
(1, 'TASK', '新检测任务待分配', '您有3条新的检测任务待分配，请及时处理', NULL, 'SAMPLE_ADMIN', 'TASK', NULL, 'HIGH', 0),
(2, 'CERT', '证书即将到期提醒', '证书编号 CCC202301010009988 将于 2025-03-24 到期，距离到期仅60天，请提醒客户及时续证', NULL, 'CERT_EXPERT', 'CERT', '4', 'HIGH', 0),
(3, 'OVERDUE', '留样到期提醒', '样品 SP202407150008 留样期限已到，请按流程安排销毁', NULL, 'SAMPLE_ADMIN', 'SAMPLE', NULL, 'NORMAL', 0),
(4, 'REPORT', '报告待审核', '检测报告 RP202501170003 已提交审核，请您及时处理', 6, NULL, 'REPORT', '3', 'NORMAL', 0);

-- 审计日志
INSERT INTO `sys_audit_log` (`id`, `log_no`, `user_id`, `user_name`, `module`, `operation`, `target_type`, `target_id`, `operation_detail`, `operation_ip`, `operation_result`) VALUES
(1, 'LOG20250120000001', 5, '周明', '报告管理', '签发报告', 'inspection_report', '1', '{"before":{"status":"REVIEWING"},"after":{"status":"ISSUED"}}', '192.168.1.101', 'SUCCESS'),
(2, 'LOG20250120000002', 2, '李娟', '样品管理', '登记样品', 'sample_info', '6', '{"sample_code":"SP202501200006","sample_name":"男士商务衬衫"}', '192.168.1.102', 'SUCCESS'),
(3, 'LOG20250120000003', 1, '张伟', '任务管理', '提交检测结果', 'task_item', '1', '{"item_name":"电气强度","result":"PASS"}', '192.168.1.103', 'SUCCESS'),
(4, 'LOG20250120000004', 6, '王芳', '证书管理', '签发证书', 'certificate_info', '1', '{"cert_no":"CCC202401010012345","status":"VALID"}', '192.168.1.104', 'SUCCESS');
