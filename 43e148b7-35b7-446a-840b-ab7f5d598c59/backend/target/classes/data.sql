INSERT OR IGNORE INTO sys_user (id, username, password, name, role, email, phone, profession) VALUES
(1, 'admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '系统管理员', 'ADMIN', 'admin@design.com', '13800000001', NULL),
(2, 'pm01', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '张经理', 'PROJECT_MANAGER', 'pm01@design.com', '13800000002', NULL),
(3, 'pm02', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '李经理', 'PROJECT_MANAGER', 'pm02@design.com', '13800000003', NULL),
(4, 'lead_arch', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '王建筑', 'PROFESSIONAL_LEAD', 'lead_arch@design.com', '13800000004', 'ARCHITECTURE'),
(5, 'lead_struct', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '赵结构', 'PROFESSIONAL_LEAD', 'lead_struct@design.com', '13800000005', 'STRUCTURE'),
(6, 'lead_plumb', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '钱给排水', 'PROFESSIONAL_LEAD', 'lead_plumb@design.com', '13800000006', 'PLUMBING'),
(7, 'lead_hvac', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '孙暖通', 'PROFESSIONAL_LEAD', 'lead_hvac@design.com', '13800000007', 'HVAC'),
(8, 'lead_elec', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '周电气', 'PROFESSIONAL_LEAD', 'lead_elec@design.com', '13800000008', 'ELECTRICAL'),
(9, 'designer01', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '吴设计', 'DESIGNER', 'designer01@design.com', '13800000009', 'ARCHITECTURE'),
(10, 'designer02', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '郑设计', 'DESIGNER', 'designer02@design.com', '13800000010', 'STRUCTURE'),
(11, 'designer03', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '冯设计', 'DESIGNER', 'designer03@design.com', '13800000011', 'ELECTRICAL'),
(12, 'client01', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '陈总', 'CLIENT', 'client01@client.com', '13900000001', NULL);

INSERT OR IGNORE INTO project (id, project_no, name, type, stage, status, contract_amount, start_date, end_date, client_name, client_contact, client_phone, project_manager_id, description, progress) VALUES
(1, 'PRJ-2024-001', '市政府办公大楼设计', 'GOVERNMENT', 'CONSTRUCTION', 'IN_PROGRESS', 5800000.00, '2024-01-15', '2024-12-30', '市政府办公厅', '刘主任', '13900000010', 2, '市政府新建办公大楼，地上12层，地下2层，总建筑面积约35000平方米', 45),
(2, 'PRJ-2024-002', '万达广场商业综合体', 'COMMERCIAL', 'PRELIMINARY', 'IN_PROGRESS', 8200000.00, '2024-02-01', '2025-06-30', '万达商业地产', '黄总', '13900000011', 3, '大型商业综合体项目，含购物中心、写字楼、酒店，总建筑面积约120000平方米', 28),
(3, 'PRJ-2024-003', '智能制造产业园厂房', 'INDUSTRIAL', 'SCHEME', 'REVIEWING', 2600000.00, '2024-03-10', '2024-09-30', '智能制造科技公司', '徐工', '13900000012', 2, '标准工业厂房3栋，配套办公楼1栋，总建筑面积约50000平方米', 80),
(4, 'PRJ-2024-004', '科技园区研发中心', 'GOVERNMENT', 'SCHEME', 'PENDING', 4500000.00, '2024-04-01', '2025-03-31', '高新区管委会', '马主任', '13900000013', 3, '科技园区研发中心大楼，含实验室、办公、会议等功能', 0),
(5, 'PRJ-2024-005', '城市棚户区改造安置房', 'GOVERNMENT', 'CONSTRUCTION', 'IN_PROGRESS', 12000000.00, '2023-10-01', '2025-12-31', '城市建设投资集团', '朱总', '13900000014', 2, '棚户区改造安置房项目，共8栋高层住宅，总建筑面积约180000平方米', 62);

INSERT OR IGNORE INTO project_professional (id, project_id, profession, professional_lead_id, progress) VALUES
(1, 1, 'ARCHITECTURE', 4, 55),
(2, 1, 'STRUCTURE', 5, 40),
(3, 1, 'PLUMBING', 6, 38),
(4, 1, 'HVAC', 7, 35),
(5, 1, 'ELECTRICAL', 8, 42),
(6, 2, 'ARCHITECTURE', 4, 32),
(7, 2, 'STRUCTURE', 5, 25),
(8, 2, 'PLUMBING', 6, 22),
(9, 2, 'HVAC', 7, 20),
(10, 2, 'ELECTRICAL', 8, 24),
(11, 3, 'ARCHITECTURE', 4, 85),
(12, 3, 'STRUCTURE', 5, 78),
(13, 3, 'PLUMBING', 6, 75),
(14, 3, 'HVAC', 7, 72),
(15, 3, 'ELECTRICAL', 8, 78);

INSERT OR IGNORE INTO design_task (id, project_id, stage, profession, name, description, parent_id, assignee_id, status, progress, planned_start_date, planned_end_date, actual_start_date, deliverables) VALUES
(1, 1, 'CONSTRUCTION', 'ARCHITECTURE', '建筑施工图-主体', '办公楼主体建筑施工图纸绘制', NULL, 9, 'IN_PROGRESS', 60, '2024-03-01', '2024-06-30', '2024-03-05', '建筑施工图CAD文件'),
(2, 1, 'CONSTRUCTION', 'STRUCTURE', '结构施工图-基础', '基础结构施工图纸绘制', NULL, 10, 'IN_PROGRESS', 45, '2024-03-01', '2024-06-30', '2024-03-10', '结构施工图CAD文件'),
(3, 1, 'CONSTRUCTION', 'ELECTRICAL', '电气施工图-强电', '强电系统施工图纸绘制', NULL, 11, 'PENDING', 0, '2024-04-01', '2024-07-31', NULL, '电气施工图CAD文件'),
(4, 1, 'CONSTRUCTION', 'ARCHITECTURE', '建筑施工图-地下室', '地下室建筑施工图纸绘制', 1, 9, 'REVIEWING', 95, '2024-03-15', '2024-05-15', '2024-03-18', '地下室建筑施工图'),
(5, 2, 'PRELIMINARY', 'ARCHITECTURE', '建筑方案深化', '商业综合体建筑方案深化设计', NULL, 9, 'IN_PROGRESS', 35, '2024-02-15', '2024-05-30', '2024-02-20', '建筑方案设计说明书'),
(6, 3, 'SCHEME', 'STRUCTURE', '结构方案设计', '厂房结构方案选型与设计', NULL, 10, 'COMPLETED', 100, '2024-03-15', '2024-04-30', '2024-03-18', '结构方案设计文件'),
(7, 3, 'SCHEME', 'ARCHITECTURE', '建筑方案设计', '厂房建筑方案设计', NULL, 9, 'COMPLETED', 100, '2024-03-10', '2024-04-20', '2024-03-12', '建筑方案设计文件');

INSERT OR IGNORE INTO design_version (id, project_id, task_id, version_no, file_name, file_size, file_path, uploaded_by, description, is_released) VALUES
(1, 1, 1, 'V1.0', '办公楼建筑施工图_v1.dwg', 15234567, '/uploads/prj1/arch_v1.dwg', 9, '第一版建筑施工图初稿', 0),
(2, 1, 1, 'V1.1', '办公楼建筑施工图_v1.1.dwg', 15789234, '/uploads/prj1/arch_v1.1.dwg', 9, '根据校对意见修改', 0),
(3, 1, 1, 'V1.2', '办公楼建筑施工图_v1.2.dwg', 16023456, '/uploads/prj1/arch_v1.2.dwg', 9, '根据审核意见修改完善', 1),
(4, 1, 2, 'V1.0', '办公楼结构施工图_v1.dwg', 18234567, '/uploads/prj1/struct_v1.dwg', 10, '结构施工图初稿', 0),
(5, 3, 6, 'V1.0', '厂房结构方案_v1.pdf', 5234567, '/uploads/prj3/struct_scheme_v1.pdf', 10, '厂房结构方案设计文件', 1);

INSERT OR IGNORE INTO review_record (id, task_id, project_id, version_id, level, reviewer_id, status, submitted_at, completed_at) VALUES
(1, 4, 1, 2, 'CHECK', 4, 'IN_PROGRESS', '2024-05-10 09:30:00', NULL),
(2, 6, 3, 5, 'APPROVE', 5, 'PASSED', '2024-04-25 14:00:00', '2024-04-28 10:30:00');

INSERT OR IGNORE INTO review_comment (id, review_record_id, content, reply, location, resolved, created_by, created_at, replied_at) VALUES
(1, 1, '地下室防火分区划分需要重新调整，建议按照规范重新划分防火分区面积', NULL, 'B1层平面图', 0, 4, '2024-05-10 10:15:00', NULL),
(2, 1, '疏散楼梯宽度不足，需要增加至1.5米', '已修改，楼梯宽度调整为1.6米', 'B1层疏散详图', 1, 4, '2024-05-10 10:20:00', '2024-05-11 16:30:00'),
(3, 1, '集水坑位置标注不清晰，请明确具体位置及尺寸', NULL, '基础平面图', 0, 4, '2024-05-10 10:25:00', NULL),
(4, 2, '结构选型合理，计算书完整，方案通过', NULL, NULL, 1, 5, '2024-04-28 10:00:00', NULL);

INSERT OR IGNORE INTO change_request (id, project_id, change_no, title, reason, content, impact_scope, workload, additional_fee, status, applicant_id, applicant_type, current_approver_id) VALUES
(1, 1, 'CHG-2024-001', '办公楼外立面幕墙方案调整', '业主方要求提升外立面品质，采用更高级的幕墙系统', '原方案采用普通玻璃幕墙，调整为单元式玻璃幕墙，增加铝合金装饰线条', '建筑专业、结构专业、造价', 120, 580000.00, 'LEAD_APPROVED', 9, 'INTERNAL', 2),
(2, 2, 'CHG-2024-002', '商业综合体楼层功能调整', '招商部门反馈，原规划餐饮楼层面积不足', '将原3层部分零售区域调整为餐饮区，增加厨房排油烟系统及隔油设施', '建筑、给排水、暖通、电气', 85, 320000.00, 'SUBMITTED', 12, 'CLIENT', 3),
(3, 3, 'CHG-2024-003', '厂房增加行车梁设计', '生产工艺调整，需在2号厂房增加10吨行车', '2号厂房新增10吨桥式行车，需增设行车梁及相应牛腿，结构荷载重新计算', '结构专业', 45, 180000.00, 'CLIENT_APPROVED', 9, 'INTERNAL', NULL);

INSERT OR IGNORE INTO change_approval (id, change_request_id, approver_id, approver_role, comment, approved, approved_at) VALUES
(1, 1, 4, 'PROFESSIONAL_LEAD', '建筑专业方案可行，结构需复核荷载', 1, '2024-05-05 14:20:00'),
(2, 1, 5, 'PROFESSIONAL_LEAD', '结构方案已复核，可满足新增幕墙荷载要求', 1, '2024-05-06 10:15:00'),
(3, 3, 5, 'PROFESSIONAL_LEAD', '结构计算已完成，满足行车荷载要求', 1, '2024-04-15 16:00:00'),
(4, 3, 2, 'PROJECT_MANAGER', '变更内容合理，费用可控', 1, '2024-04-16 09:30:00'),
(5, 3, 12, 'CLIENT', '同意变更方案及费用调整', 1, '2024-04-18 11:00:00');

INSERT OR IGNORE INTO project_log (id, project_id, action, content, operator_id, operator_name) VALUES
(1, 1, 'CREATE', '项目立项，创建市政府办公大楼设计项目', 1, '系统管理员'),
(2, 1, 'ASSIGN', '分配项目经理：张经理', 1, '系统管理员'),
(3, 1, 'UPDATE', '项目阶段从初步设计更新为施工图设计', 2, '张经理'),
(4, 1, 'TASK', '创建建筑施工图任务，负责人：吴设计', 2, '张经理'),
(5, 3, 'REVIEW', '厂房结构方案通过审定', 5, '赵结构');
