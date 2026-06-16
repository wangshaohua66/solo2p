-- =====================================================
-- 省级应急管理指挥系统 - 基础数据初始化
-- =====================================================

SET search_path TO emergency;

-- =====================================================
-- 1. 组织数据（省-市-县三级）
-- =====================================================

-- 省级应急管理厅
INSERT INTO sys_organization (id, code, name, level, parent_id, parent_path, region_code, leader, phone, address, sort_order, status)
VALUES (1, 'EMG-PROV', 'XX省应急管理厅', 1, NULL, '/', '110000', '张厅长', '13800000001', 'XX省XX市XX区应急大厦', 1, 1)
ON CONFLICT (id) DO NOTHING;

-- 市级站点（示例3个市）
INSERT INTO sys_organization (id, code, name, level, parent_id, parent_path, region_code, leader, phone, address, sort_order, status) VALUES
(2, 'EMG-CITY-01', 'A市应急管理局', 2, 1, '/1/', '110100', '李局长', '13800000002', 'A市XX区应急中心', 1, 1),
(3, 'EMG-CITY-02', 'B市应急管理局', 2, 1, '/1/', '110200', '王局长', '13800000003', 'B市XX区应急中心', 2, 1),
(4, 'EMG-CITY-03', 'C市应急管理局', 2, 1, '/1/', '110300', '赵局长', '13800000004', 'C市XX区应急中心', 3, 1)
ON CONFLICT (id) DO NOTHING;

-- 县级站点（每个市3个县，共9个，加上108个备用，共120个站点）
INSERT INTO sys_organization (id, code, name, level, parent_id, parent_path, region_code, leader, phone, address, sort_order, status) VALUES
-- A市下属县
(11, 'EMG-COUNTY-001', 'A1县应急管理局', 3, 2, '/1/2/', '110101', '孙局长', '13800000011', 'A1县应急中心', 1, 1),
(12, 'EMG-COUNTY-002', 'A2县应急管理局', 3, 2, '/1/2/', '110102', '周局长', '13800000012', 'A2县应急中心', 2, 1),
(13, 'EMG-COUNTY-003', 'A3县应急管理局', 3, 2, '/1/2/', '110103', '吴局长', '13800000013', 'A3县应急中心', 3, 1),
-- B市下属县
(21, 'EMG-COUNTY-004', 'B1县应急管理局', 3, 3, '/1/3/', '110201', '郑局长', '13800000021', 'B1县应急中心', 1, 1),
(22, 'EMG-COUNTY-005', 'B2县应急管理局', 3, 3, '/1/3/', '110202', '冯局长', '13800000022', 'B2县应急中心', 2, 1),
(23, 'EMG-COUNTY-006', 'B3县应急管理局', 3, 3, '/1/3/', '110203', '陈局长', '13800000023', 'B3县应急中心', 3, 1),
-- C市下属县
(31, 'EMG-COUNTY-007', 'C1县应急管理局', 3, 4, '/1/4/', '110301', '褚局长', '13800000031', 'C1县应急中心', 1, 1),
(32, 'EMG-COUNTY-008', 'C2县应急管理局', 3, 4, '/1/4/', '110302', '卫局长', '13800000032', 'C2县应急中心', 2, 1),
(33, 'EMG-COUNTY-009', 'C3县应急管理局', 3, 4, '/1/4/', '110303', '蒋局长', '13800000033', 'C3县应急中心', 3, 1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. 角色数据
-- =====================================================

INSERT INTO sys_role (id, code, name, description, data_scope, sort_order, status) VALUES
(1, 'ADMIN', '超级管理员', '系统最高权限，可访问所有数据', 0, 1, 1),
(2, 'PROVINCE_ADMIN', '省级管理员', '省级应急管理厅管理员，可访问全省数据', 1, 2, 1),
(3, 'CITY_ADMIN', '市级管理员', '市级应急管理局管理员，可访问全市数据', 1, 3, 1),
(4, 'COUNTY_ADMIN', '县级管理员', '县级应急管理局管理员，可访问全县数据', 1, 4, 1),
(5, 'DISPATCHER', '调度员', '负责救援力量调度', 1, 5, 1),
(6, 'INCIDENT_REPORTER', '灾情上报员', '负责灾情信息上报', 2, 6, 1),
(7, 'INVENTORY_MANAGER', '物资管理员', '负责物资仓储管理', 1, 7, 1),
(8, 'INCIDENT_ANALYST', '灾情分析师', '负责灾情分析和复盘', 1, 8, 1),
(9, 'NOTIFICATION_OFFICER', '通知专员', '负责预警通知发布', 1, 9, 1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. 用户数据（默认密码：123456，BCrypt加密）
-- =====================================================

INSERT INTO sys_user (id, username, password, real_name, phone, email, organization_id, region_code, status) VALUES
(1, 'admin', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '系统管理员', '13800000001', 'admin@emergency.gov.cn', 1, '110000', 1),
(2, 'province_leader', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '张厅长', '13800000002', 'province@emergency.gov.cn', 1, '110000', 1),
(3, 'province_dispatcher', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '王调度', '13800000003', 'dispatch@emergency.gov.cn', 1, '110000', 1),
(4, 'city_a_leader', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '李局长', '13800000011', 'city_a@emergency.gov.cn', 2, '110100', 1),
(5, 'city_a_dispatcher', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '赵调度', '13800000012', 'dispatch_a@emergency.gov.cn', 2, '110100', 1),
(6, 'county_a1_leader', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '孙局长', '13800000021', 'county_a1@emergency.gov.cn', 11, '110101', 1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. 用户角色关联
-- =====================================================

INSERT INTO sys_user_role (id, user_id, role_id) VALUES
(1, 1, 1),
(2, 2, 2),
(3, 3, 5),
(4, 4, 3),
(5, 5, 5),
(6, 6, 4)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 5. 权限数据
-- =====================================================

INSERT INTO sys_permission (id, code, name, type, resource, action, parent_id, sort_order, status) VALUES
-- 灾情管理
(1, 'incident:view', '查看灾情', 'API', '/api/incident/incidents', 'GET', 0, 1, 1),
(2, 'incident:report', '上报灾情', 'API', '/api/incident/incidents/report', 'POST', 0, 2, 1),
(3, 'incident:edit', '编辑灾情', 'API', '/api/incident/incidents', 'PUT', 0, 3, 1),
(4, 'incident:upgrade', '升级灾情', 'API', '/api/incident/incidents/*/upgrade', 'PUT', 0, 4, 1),
(5, 'incident:close', '关闭灾情', 'API', '/api/incident/incidents/*/status', 'PUT', 0, 5, 1),
-- 调度管理
(11, 'dispatch:view', '查看调度', 'API', '/api/dispatch/dispatches', 'GET', 0, 11, 1),
(12, 'dispatch:create', '创建调度', 'API', '/api/dispatch/dispatches/generate', 'POST', 0, 12, 1),
(13, 'dispatch:approve', '审批调度', 'API', '/api/auth/approvals/process', 'POST', 0, 13, 1),
(14, 'dispatch:cancel', '取消调度', 'API', '/api/dispatch/dispatches/*/cancel', 'POST', 0, 14, 1),
(15, 'dispatch:reassign', '重新分配', 'API', '/api/dispatch/assignments/*/reassign', 'POST', 0, 15, 1),
-- 物资管理
(21, 'inventory:view', '查看库存', 'API', '/api/inventory/stocks', 'GET', 0, 21, 1),
(22, 'inventory:lock', '锁定物资', 'API', '/api/inventory/lock', 'POST', 0, 22, 1),
(23, 'inventory:unlock', '解锁物资', 'API', '/api/inventory/lock/*/unlock', 'POST', 0, 23, 1),
(24, 'inventory:allocate', '确认调拨', 'API', '/api/inventory/lock/*/confirm', 'POST', 0, 24, 1),
-- 通知管理
(31, 'notification:view', '查看通知', 'API', '/api/notification/notifications', 'GET', 0, 31, 1),
(32, 'notification:send', '发送通知', 'API', '/api/notification/notifications/send', 'POST', 0, 32, 1),
(33, 'notification:broadcast', '广播通知', 'API', '/api/notification/notifications/broadcast', 'POST', 0, 33, 1),
-- 审批管理
(41, 'approval:view', '查看审批', 'API', '/api/auth/approvals', 'GET', 0, 41, 1),
(42, 'approval:process', '处理审批', 'API', '/api/auth/approvals/process', 'POST', 0, 42, 1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 6. 角色权限关联
-- =====================================================

-- 超级管理员拥有所有权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT 1, id FROM sys_permission
ON CONFLICT DO NOTHING;

-- 省级管理员
INSERT INTO sys_role_permission (role_id, permission_id) VALUES
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5),
(2, 11), (2, 12), (2, 13), (2, 14), (2, 15),
(2, 21), (2, 22), (2, 23), (2, 24),
(2, 31), (2, 32), (2, 33),
(2, 41), (2, 42)
ON CONFLICT DO NOTHING;

-- 市级管理员
INSERT INTO sys_role_permission (role_id, permission_id) VALUES
(3, 1), (3, 2), (3, 3),
(3, 11), (3, 12), (3, 13),
(3, 21), (3, 22),
(3, 31), (3, 32),
(3, 41), (3, 42)
ON CONFLICT DO NOTHING;

-- 调度员
INSERT INTO sys_role_permission (role_id, permission_id) VALUES
(5, 1), (5, 11), (5, 12), (5, 14), (5, 15),
(5, 21), (5, 22),
(5, 31)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. 救援队伍数据
-- =====================================================

INSERT INTO rescue_team (id, team_code, team_name, team_type, team_size, organization_id, region_code, address, location_point, leader_name, leader_phone, status, response_radius, equipment, capabilities) VALUES
(1, 'TEAM-PROV-001', '省应急救援总队', '综合救援', 100, 1, '340000', '安徽省合肥市包河区应急基地',
 ST_SetSRID(ST_MakePoint(117.29, 31.82), 4326), '王队长', '13900000001', 1, 200, '救援车20辆、直升机2架、冲锋舟30艘', '地震救援、水域救援、消防灭火'),
(2, 'TEAM-PROV-002', '省消防救援总队', '消防救援', 200, 1, '340000', '安徽省合肥市蜀山区消防基地',
 ST_SetSRID(ST_MakePoint(117.23, 31.85), 4326), '李队长', '13900000002', 1, 200, '消防车50辆、云梯车5辆', '消防灭火、高空救援、危化品处置'),
(3, 'TEAM-PROV-003', '省医疗救援队', '医疗救援', 50, 1, '340000', '安徽省合肥市庐阳区急救中心',
 ST_SetSRID(ST_MakePoint(117.27, 31.88), 4326), '张队长', '13900000003', 1, 200, '救护车10辆、移动医院1套', '现场急救、医疗转运、疫情防控'),
(4, 'TEAM-CITY-A-001', '芜湖市综合救援队', '综合救援', 50, 2, '340200', '芜湖市镜湖区应急基地',
 ST_SetSRID(ST_MakePoint(118.44, 31.34), 4326), '赵队长', '13900000004', 1, 100, '救援车10辆、冲锋舟10艘', '综合救援、水域救援'),
(5, 'TEAM-CITY-B-001', '蚌埠市综合救援队', '综合救援', 50, 3, '340300', '蚌埠市蚌山区应急基地',
 ST_SetSRID(ST_MakePoint(117.35, 32.93), 4326), '钱队长', '13900000005', 1, 100, '救援车10辆、冲锋舟10艘', '综合救援、山地救援'),
(6, 'TEAM-CITY-C-001', '淮南市综合救援队', '综合救援', 50, 4, '340400', '淮南市田家庵区应急基地',
 ST_SetSRID(ST_MakePoint(117.02, 32.63), 4326), '孙队长', '13900000006', 1, 100, '救援车10辆、冲锋舟10艘', '综合救援、地震救援'),
(7, 'TEAM-COUNTY-A1-001', '肥东县应急队', '综合救援', 20, 11, '340122', '合肥市肥东县应急中心',
 ST_SetSRID(ST_MakePoint(117.46, 31.89), 4326), '周队长', '13900000007', 1, 50, '救援车3辆、冲锋舟3艘', '综合救援'),
(8, 'TEAM-COUNTY-A2-001', '肥西县应急队', '综合救援', 20, 12, '340123', '合肥市肥西县应急中心',
 ST_SetSRID(ST_MakePoint(117.14, 31.71), 4326), '吴队长', '13900000008', 1, 50, '救援车3辆、冲锋舟3艘', '综合救援'),
(9, 'TEAM-COUNTY-A3-001', '长丰县应急队', '综合救援', 20, 13, '340121', '合肥市长丰县应急中心',
 ST_SetSRID(ST_MakePoint(117.16, 32.48), 4326), '郑队长', '13900000009', 1, 50, '救援车3辆、冲锋舟3艘', '综合救援')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 8. 物资仓库数据
-- =====================================================

INSERT INTO warehouse (id, warehouse_code, warehouse_name, warehouse_type, organization_id, region_code, address, location_point, manager_name, manager_phone, capacity, used_capacity, status) VALUES
(1, 'WH-PROV-001', '省级中心仓库', 1, 1, '340000', '安徽省合肥市包河区应急物资中心',
 ST_SetSRID(ST_MakePoint(117.28, 31.84), 4326), '刘主任', '13700000001', 10000, 6000, 1),
(2, 'WH-PROV-002', '省级救灾物资储备库', 2, 1, '340000', '安徽省合肥市瑶海区救灾储备基地',
 ST_SetSRID(ST_MakePoint(117.31, 31.86), 4326), '陈主任', '13700000002', 20000, 12000, 1),
(3, 'WH-CITY-A-001', '芜湖市物资仓库', 1, 2, '340200', '芜湖市弋江区应急物资中心',
 ST_SetSRID(ST_MakePoint(118.41, 31.30), 4326), '杨主任', '13700000003', 5000, 3000, 1),
(4, 'WH-CITY-B-001', '蚌埠市物资仓库', 1, 3, '340300', '蚌埠市禹会区应急物资中心',
 ST_SetSRID(ST_MakePoint(117.30, 32.92), 4326), '黄主任', '13700000004', 5000, 2800, 1),
(5, 'WH-CITY-C-001', '淮南市物资仓库', 1, 4, '340400', '淮南市谢家集区应急物资中心',
 ST_SetSRID(ST_MakePoint(116.94, 32.60), 4326), '朱主任', '13700000005', 5000, 2600, 1),
(6, 'WH-COUNTY-A1-001', '肥东县物资仓库', 1, 11, '340122', '合肥市肥东县应急物资站',
 ST_SetSRID(ST_MakePoint(117.48, 31.90), 4326), '秦主任', '13700000006', 1000, 600, 1),
(7, 'WH-COUNTY-A2-001', '肥西县物资仓库', 1, 12, '340123', '合肥市肥西县应急物资站',
 ST_SetSRID(ST_MakePoint(117.15, 31.72), 4326), '尤主任', '13700000007', 1000, 550, 1),
(8, 'WH-COUNTY-A3-001', '长丰县物资仓库', 1, 13, '340121', '合肥市长丰县应急物资站',
 ST_SetSRID(ST_MakePoint(117.18, 32.50), 4326), '许主任', '13700000008', 1000, 500, 1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 9. 物资品类数据
-- =====================================================

INSERT INTO material (id, material_code, material_name, category, specification, unit, unit_price, manufacturer, shelf_life, storage_condition, usage_method) VALUES
(1, 'MAT-001', '饮用水', '生活物资', '550ml/瓶', '瓶', 2.50, 'XX矿泉水厂', 365, '常温', '直接饮用'),
(2, 'MAT-002', '方便面', '生活物资', '108g/桶', '桶', 5.00, 'XX食品公司', 180, '常温干燥', '开水冲泡'),
(3, 'MAT-003', '压缩饼干', '生活物资', '1kg/箱', '箱', 80.00, 'XX食品公司', 730, '常温干燥', '直接食用'),
(4, 'MAT-004', '棉被', '生活物资', '1.5m×2m', '床', 150.00, 'XX纺织厂', 3650, '干燥通风', '直接使用'),
(5, 'MAT-005', '帐篷', '生活物资', '3m×4m', '顶', 1200.00, 'XX户外用品厂', 1825, '干燥', '展开使用'),
(6, 'MAT-006', '救生衣', '救援装备', '成人型', '件', 180.00, 'XX防护装备厂', 1825, '干燥通风', '穿戴使用'),
(7, 'MAT-007', '冲锋舟', '救援装备', '6人玻璃钢', '艘', 12000.00, 'XX船舶厂', 3650, '干燥', '投入水面使用'),
(8, 'MAT-008', '发电机', '救援装备', '5KW柴油', '台', 8500.00, 'XX机械厂', 3650, '干燥通风', '加注柴油启动'),
(9, 'MAT-009', '手持对讲机', '通讯设备', '数字防爆', '台', 2800.00, 'XX电子厂', 1825, '干燥', '充电后使用'),
(10, 'MAT-010', '医疗急救包', '医疗物资', '标准配置', '个', 350.00, 'XX医疗器械厂', 365, '干燥', '按说明书使用'),
(11, 'MAT-011', '口罩', '防护物资', 'N95', '只', 3.50, 'XX医疗器械厂', 730, '干燥', '佩戴使用'),
(12, 'MAT-012', '防护服', '防护物资', '一次性医用', '套', 80.00, 'XX医疗器械厂', 365, '干燥', '穿戴使用'),
(13, 'MAT-013', '强光手电筒', '照明设备', 'LED充电', '个', 120.00, 'XX电子厂', 1825, '干燥', '充电后使用'),
(14, 'MAT-014', '铁锹', '工具', '钢柄尖头', '把', 45.00, 'XX五金厂', 3650, '干燥', '直接使用'),
(15, 'MAT-015', '钢丝绳', '救援装备', '直径12mm', '米', 15.00, 'XX五金厂', 3650, '干燥', '按需要截断使用'),
(16, 'MAT-016', '移动厕所', '生活设施', '单蹲位', '个', 3500.00, 'XX环保设备厂', 3650, '通风', '放置使用'),
(17, 'MAT-017', '消毒水', '防疫物资', '500ml/瓶', '瓶', 18.00, 'XX化工厂', 730, '阴凉', '稀释后喷洒'),
(18, 'MAT-018', '输液器', '医疗物资', '一次性', '套', 8.00, 'XX医疗器械厂', 365, '干燥', '无菌操作'),
(19, 'MAT-019', '保暖毯', '生活物资', '铝箔急救', '条', 25.00, 'XX纺织厂', 3650, '干燥', '包裹使用'),
(20, 'MAT-020', '卫星电话', '通讯设备', '全球覆盖', '台', 15000.00, 'XX通讯设备厂', 1825, '干燥', '充电后使用')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 10. 库存数据
-- =====================================================

INSERT INTO inventory_stock (warehouse_id, material_id, material_code, material_name, quantity, locked_quantity, available_quantity, warning_threshold)
SELECT w.id, m.id, m.material_code, m.material_name,
       CASE m.id
           WHEN 1 THEN 50000
           WHEN 2 THEN 30000
           WHEN 3 THEN 10000
           WHEN 4 THEN 5000
           WHEN 5 THEN 2000
           WHEN 6 THEN 3000
           WHEN 7 THEN 100
           WHEN 8 THEN 50
           WHEN 9 THEN 200
           WHEN 10 THEN 1000
           WHEN 11 THEN 100000
           WHEN 12 THEN 50000
           WHEN 13 THEN 2000
           WHEN 14 THEN 3000
           WHEN 15 THEN 10000
           WHEN 16 THEN 200
           WHEN 17 THEN 20000
           WHEN 18 THEN 5000
           WHEN 19 THEN 20000
           WHEN 20 THEN 20
       END,
       0,
       CASE m.id
           WHEN 1 THEN 50000
           WHEN 2 THEN 30000
           WHEN 3 THEN 10000
           WHEN 4 THEN 5000
           WHEN 5 THEN 2000
           WHEN 6 THEN 3000
           WHEN 7 THEN 100
           WHEN 8 THEN 50
           WHEN 9 THEN 200
           WHEN 10 THEN 1000
           WHEN 11 THEN 100000
           WHEN 12 THEN 50000
           WHEN 13 THEN 2000
           WHEN 14 THEN 3000
           WHEN 15 THEN 10000
           WHEN 16 THEN 200
           WHEN 17 THEN 20000
           WHEN 18 THEN 5000
           WHEN 19 THEN 20000
           WHEN 20 THEN 20
       END,
       CASE m.id
           WHEN 1 THEN 10000
           WHEN 2 THEN 5000
           WHEN 3 THEN 2000
           WHEN 4 THEN 1000
           WHEN 5 THEN 500
           WHEN 6 THEN 500
           WHEN 7 THEN 20
           WHEN 8 THEN 10
           WHEN 9 THEN 50
           WHEN 10 THEN 200
           WHEN 11 THEN 20000
           WHEN 12 THEN 10000
           WHEN 13 THEN 500
           WHEN 14 THEN 500
           WHEN 15 THEN 2000
           WHEN 16 THEN 50
           WHEN 17 THEN 5000
           WHEN 18 THEN 1000
           WHEN 19 THEN 5000
           WHEN 20 THEN 5
       END
FROM warehouse w
CROSS JOIN material m
WHERE w.id IN (1, 2, 3, 4, 5)
ON CONFLICT (warehouse_id, material_id) DO NOTHING;

-- =====================================================
-- 11. 应急预案数据
-- =====================================================

INSERT INTO incident_response_plan (id, plan_code, plan_name, incident_type, min_level, max_level, description, response_procedure, required_resources, responsible_dept, contact_info, estimated_duration, priority, status) VALUES
(1, 'PLAN-EQ-1', '特别重大地震应急预案', 1, 1, 1, '应对7.0级以上地震', '1.启动Ⅰ级响应 2.调集全省救援力量 3.请求国家支援 4.发布全省预警', '重型救援设备×20、救援队伍×5000人、物资×5000吨', '省应急管理厅', '000-12345678', 720, 1, 1),
(2, 'PLAN-EQ-2', '重大地震应急预案', 1, 2, 2, '应对6.0-6.9级地震', '1.启动Ⅱ级响应 2.调集周边市救援力量 3.请求邻省支援', '救援设备×10、救援队伍×2000人、物资×2000吨', '省应急管理厅', '000-12345678', 360, 2, 1),
(3, 'PLAN-FL-1', '特大洪水应急预案', 2, 1, 1, '应对流域性特大洪水', '1.启动Ⅰ级响应 2.转移受威胁群众 3.调度水利工程 4.协调部队支援', '冲锋舟×100、救援队伍×3000人、救灾物资×3000吨', '省应急管理厅+水利厅', '000-12345678', 720, 1, 1),
(4, 'PLAN-FL-2', '较大洪水应急预案', 2, 3, 3, '应对局部洪水', '1.启动Ⅲ级响应 2.组织当地救援 3.转移群众', '冲锋舟×20、救援队伍×500人、物资×500吨', '市应急管理局', '000-12345678', 120, 3, 1),
(5, 'PLAN-FR-1', '重大火灾应急预案', 3, 2, 2, '应对重大火灾事故', '1.启动Ⅱ级响应 2.调集消防力量 3.组织人员疏散', '消防车×30、消防员×200人、急救车辆×10', '省消防救援总队', '119', 180, 2, 1),
(6, 'PLAN-TY-1', '台风应急预案', 4, 1, 4, '应对台风灾害', '1.提前发布预警 2.转移危险区域人员 3.加固设施 4.准备救援力量', '冲锋舟×50、应急车辆×100、救援队伍×1000人', '省应急管理厅', '000-12345678', 240, 2, 1),
(7, 'PLAN-HM-1', '危化品泄漏应急预案', 9, 2, 4, '应对危化品泄漏事故', '1.划定警戒区域 2.疏散周边群众 3.专业处置队伍入场 4.环境监测', '防化装备×50套、监测设备×10台、专业队伍×50人', '省应急管理厅+生态环境厅', '000-12345678', 240, 2, 1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 12. 通知模板数据
-- =====================================================

INSERT INTO notification_template (id, template_code, template_name, incident_type, min_incident_level, title_template, content_template, channel, target_rules, priority, variables, status) VALUES
(1, 'TPL-INCIDENT-ALERT', '灾情预警通知', NULL, 3, '【灾情预警】{{title}}', '【{{levelName}}预警】{{regionName}}发生{{incidentTypeName}}：{{content}}。请相关部门立即做好响应准备。', '1,2,3', '按区域匹配相关应急队伍负责人', 2, 'title,levelName,regionName,incidentTypeName,content', 1),
(2, 'TPL-DISPATCH-ORDER', '调度命令通知', NULL, 3, '【调度命令】{{dispatchNo}}', '请{{teamName}}立即携带{{equipment}}前往{{location}}执行{{task}}任务。预计到达时间：{{eta}}。联系人：{{contactName}}，电话：{{contactPhone}}。', '1,2', '指定救援队伍负责人', 1, 'dispatchNo,teamName,equipment,location,task,eta,contactName,contactPhone', 1),
(3, 'TPL-INCIDENT-UPGRADE', '灾情升级通知', NULL, 2, '【紧急】灾情升级为{{newLevelName}}', '{{incidentTitle}}灾情已由{{oldLevelName}}升级为{{newLevelName}}。请相关部门提升响应等级，增派救援力量。', '1,2,3', '按区域匹配所有相关部门负责人', 1, 'newLevelName,incidentTitle,oldLevelName', 1),
(4, 'TPL-APPROVAL-NOTICE', '审批待办通知', NULL, 4, '【待办提醒】您有新的审批待处理', '您有1条{{businessType}}审批待处理。申请人：{{applicantName}}，申请时间：{{applyTime}}。请及时处理。', '2', '指定审批人', 3, 'businessType,applicantName,applyTime', 1),
(5, 'TPL-INVENTORY-ALERT', '库存预警通知', NULL, 4, '【库存预警】{{materialName}}库存不足', '物资{{materialName}}（编码：{{materialCode}}）当前库存{{currentQuantity}}，已低于预警阈值{{warningThreshold}}。请及时补充。', '2', '物资管理员', 3, 'materialName,materialCode,currentQuantity,warningThreshold', 1)
ON CONFLICT (id) DO NOTHING;
