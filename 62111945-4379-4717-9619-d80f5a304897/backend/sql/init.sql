-- 人才市场服务平台数据库初始化脚本
-- PostgreSQL 16

-- 创建数据库
-- CREATE DATABASE talent_market WITH ENCODING = 'UTF8';

-- ============================================
-- 企业表
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise (
    id BIGINT PRIMARY KEY,
    enterprise_name VARCHAR(200) NOT NULL COMMENT '企业名称',
    unified_social_credit_code VARCHAR(50) COMMENT '统一社会信用代码',
    legal_person VARCHAR(50) COMMENT '法人',
    registered_capital VARCHAR(100) COMMENT '注册资本',
    registration_date VARCHAR(50) COMMENT '注册日期',
    business_scope TEXT COMMENT '经营范围',
    industry VARCHAR(100) COMMENT '所属行业',
    enterprise_type VARCHAR(50) COMMENT '企业类型',
    employee_count INTEGER DEFAULT 0 COMMENT '员工人数',
    province VARCHAR(50) COMMENT '省份',
    city VARCHAR(50) COMMENT '城市',
    address VARCHAR(500) COMMENT '详细地址',
    business_license_url VARCHAR(500) COMMENT '营业执照图片',
    contact_name VARCHAR(50) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    contact_email VARCHAR(100) COMMENT '联系邮箱',
    official_website VARCHAR(200) COMMENT '官网',
    company_logo VARCHAR(500) COMMENT '企业Logo',
    company_description TEXT COMMENT '企业简介',
    auth_status INTEGER DEFAULT 0 COMMENT '认证状态：0待审核 1已通过 2已拒绝',
    auth_remark VARCHAR(500) COMMENT '审核备注',
    auth_time TIMESTAMP COMMENT '审核时间',
    auth_by BIGINT COMMENT '审核人',
    verified INTEGER DEFAULT 0 COMMENT '是否已验证：0否 1是',
    verified_time TIMESTAMP COMMENT '验证时间',
    history_score INTEGER DEFAULT 50 COMMENT '历史信用评分',
    status INTEGER DEFAULT 1 COMMENT '状态：0禁用 1启用',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX idx_enterprise_name ON enterprise(enterprise_name);
CREATE INDEX idx_enterprise_credit_code ON enterprise(unified_social_credit_code);
CREATE INDEX idx_industry ON enterprise(industry);

-- ============================================
-- 岗位表
-- ============================================
CREATE TABLE IF NOT EXISTS job_position (
    id BIGINT PRIMARY KEY,
    enterprise_id BIGINT NOT NULL COMMENT '企业ID',
    position_name VARCHAR(200) NOT NULL COMMENT '职位名称',
    position_type VARCHAR(50) COMMENT '职位类型',
    salary_min INTEGER COMMENT '最低薪资（K/月）',
    salary_max INTEGER COMMENT '最高薪资（K/月）',
    salary_type VARCHAR(20) DEFAULT '月薪' COMMENT '薪资类型',
    city VARCHAR(50) COMMENT '工作城市',
    district VARCHAR(50) COMMENT '工作区域',
    address VARCHAR(500) COMMENT '工作地址',
    experience_required VARCHAR(50) COMMENT '经验要求',
    education_required VARCHAR(50) COMMENT '学历要求',
    recruit_count INTEGER DEFAULT 1 COMMENT '招聘人数',
    position_description TEXT COMMENT '职位描述',
    requirements TEXT COMMENT '任职要求',
    skill_tags TEXT COMMENT '技能标签（JSON数组）',
    welfare_tags TEXT COMMENT '福利标签（JSON数组）',
    department VARCHAR(100) COMMENT '所属部门',
    report_to VARCHAR(50) COMMENT '汇报对象',
    work_type INTEGER DEFAULT 1 COMMENT '工作类型：1全职 2兼职 3实习',
    match_score DECIMAL(5,2) COMMENT '匹配度（用于推荐）',
    status INTEGER DEFAULT 1 COMMENT '状态：0下架 1上架',
    audit_status INTEGER DEFAULT 1 COMMENT '审核状态：0待审核 1已通过 2已拒绝',
    audit_remark VARCHAR(500) COMMENT '审核备注',
    audit_by BIGINT COMMENT '审核人',
    audit_time TIMESTAMP COMMENT '审核时间',
    view_count INTEGER DEFAULT 0 COMMENT '浏览次数',
    apply_count INTEGER DEFAULT 0 COMMENT '投递次数',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX idx_position_enterprise ON job_position(enterprise_id);
CREATE INDEX idx_position_name ON job_position(position_name);
CREATE INDEX idx_position_city ON job_position(city);
CREATE INDEX idx_position_status ON job_position(status);
CREATE INDEX idx_position_salary ON job_position(salary_min, salary_max);

-- ============================================
-- 招聘会表
-- ============================================
CREATE TABLE IF NOT EXISTS recruitment_fair (
    id BIGINT PRIMARY KEY,
    fair_name VARCHAR(200) NOT NULL COMMENT '招聘会名称',
    fair_type VARCHAR(50) COMMENT '招聘会类型',
    organizer VARCHAR(200) COMMENT '主办方',
    co_organizer VARCHAR(500) COMMENT '协办方',
    start_date DATE COMMENT '开始日期',
    end_date DATE COMMENT '结束日期',
    start_time TIMESTAMP COMMENT '开始时间',
    end_time TIMESTAMP COMMENT '结束时间',
    venue VARCHAR(200) COMMENT '举办地点',
    address VARCHAR(500) COMMENT '详细地址',
    city VARCHAR(50) COMMENT '城市',
    district VARCHAR(50) COMMENT '区域',
    fair_theme VARCHAR(200) COMMENT '展会主题',
    description TEXT COMMENT '展会描述',
    cover_image VARCHAR(500) COMMENT '封面图片',
    booth_total INTEGER DEFAULT 0 COMMENT '展位总数',
    booth_available INTEGER DEFAULT 0 COMMENT '可用展位',
    participant_limit INTEGER DEFAULT 0 COMMENT '参会人数上限',
    current_participants INTEGER DEFAULT 0 COMMENT '当前参会人数',
    intention_count INTEGER DEFAULT 0 COMMENT '意向登记数',
    status VARCHAR(20) DEFAULT 'draft' COMMENT '状态：draft报名中 ongoing进行中 ended已结束',
    published INTEGER DEFAULT 0 COMMENT '是否已发布',
    publish_time TIMESTAMP COMMENT '发布时间',
    qr_code_url VARCHAR(500) COMMENT '二维码链接',
    sign_in_qr_code VARCHAR(500) COMMENT '签到二维码',
    center_id BIGINT COMMENT '所属人才中心',
    center_name VARCHAR(100) COMMENT '人才中心名称',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX idx_fair_date ON recruitment_fair(start_date, end_date);
CREATE INDEX idx_fair_status ON recruitment_fair(status);
CREATE INDEX idx_fair_city ON recruitment_fair(city);

-- ============================================
-- 展位表
-- ============================================
CREATE TABLE IF NOT EXISTS fair_booth (
    id BIGINT PRIMARY KEY,
    fair_id BIGINT NOT NULL COMMENT '招聘会ID',
    booth_code VARCHAR(50) NOT NULL COMMENT '展位编号',
    booth_area VARCHAR(50) COMMENT '展位区域',
    booth_number INTEGER COMMENT '展位号',
    booth_type VARCHAR(50) COMMENT '展位类型',
    quality_score INTEGER COMMENT '展位质量评分',
    enterprise_id BIGINT COMMENT '企业ID',
    enterprise_name VARCHAR(200) COMMENT '企业名称',
    status INTEGER DEFAULT 0 COMMENT '状态：0空闲 1已分配',
    match_score DECIMAL(5,2) COMMENT '匹配度',
    industry VARCHAR(100) COMMENT '所属行业',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX idx_booth_fair ON fair_booth(fair_id);
CREATE INDEX idx_booth_enterprise ON fair_booth(enterprise_id);

-- ============================================
-- 简历表
-- ============================================
CREATE TABLE IF NOT EXISTS resume (
    id BIGINT PRIMARY KEY,
    jobseeker_id BIGINT NOT NULL COMMENT '求职者ID',
    resume_title VARCHAR(200) COMMENT '简历标题',
    is_default INTEGER DEFAULT 0 COMMENT '是否默认：0否 1是',
    privacy INTEGER DEFAULT 0 COMMENT '隐私状态：0公开 1私密',
    name VARCHAR(50) COMMENT '姓名',
    gender VARCHAR(10) COMMENT '性别',
    age INTEGER COMMENT '年龄',
    phone VARCHAR(20) COMMENT '手机号',
    email VARCHAR(100) COMMENT '邮箱',
    city VARCHAR(50) COMMENT '所在城市',
    highest_education VARCHAR(50) COMMENT '最高学历',
    years_of_experience INTEGER COMMENT '工作年限',
    current_status VARCHAR(50) COMMENT '当前状态',
    expected_position VARCHAR(200) COMMENT '期望职位',
    expected_salary_min INTEGER COMMENT '期望最低薪资',
    expected_salary_max INTEGER COMMENT '期望最高薪资',
    expected_city VARCHAR(50) COMMENT '期望城市',
    self_introduction TEXT COMMENT '自我介绍',
    resume_file_url VARCHAR(500) COMMENT '简历附件URL',
    resume_file_name VARCHAR(200) COMMENT '简历文件名',
    skill_tags TEXT COMMENT '技能标签（逗号分隔）',
    complete_rate INTEGER DEFAULT 0 COMMENT '简历完整度',
    status INTEGER DEFAULT 1 COMMENT '状态',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX idx_resume_jobseeker ON resume(jobseeker_id);
CREATE INDEX idx_resume_education ON resume(highest_education);
CREATE INDEX idx_resume_city ON resume(expected_city);

-- ============================================
-- 投递记录表
-- ============================================
CREATE TABLE IF NOT EXISTS job_application (
    id BIGINT PRIMARY KEY,
    jobseeker_id BIGINT NOT NULL COMMENT '求职者ID',
    resume_id BIGINT NOT NULL COMMENT '简历ID',
    position_id BIGINT NOT NULL COMMENT '职位ID',
    enterprise_id BIGINT NOT NULL COMMENT '企业ID',
    position_name VARCHAR(200) COMMENT '职位名称',
    enterprise_name VARCHAR(200) COMMENT '企业名称',
    jobseeker_name VARCHAR(50) COMMENT '求职者姓名',
    match_score DECIMAL(5,2) COMMENT '匹配度',
    status INTEGER DEFAULT 1 COMMENT '状态：1已投递 2已查看 3面试中 4已Offer 5已拒绝',
    status_name VARCHAR(50) COMMENT '状态名称',
    view_time TIMESTAMP COMMENT '查看时间',
    interview_time TIMESTAMP COMMENT '面试时间',
    interviewer VARCHAR(50) COMMENT '面试官',
    reject_reason VARCHAR(500) COMMENT '拒绝原因',
    offer_salary VARCHAR(100) COMMENT 'Offer薪资',
    remark TEXT COMMENT '备注',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX idx_application_jobseeker ON job_application(jobseeker_id);
CREATE INDEX idx_application_position ON job_application(position_id);
CREATE INDEX idx_application_enterprise ON job_application(enterprise_id);
CREATE INDEX idx_application_status ON job_application(status);

-- ============================================
-- 面试表
-- ============================================
CREATE TABLE IF NOT EXISTS interview (
    id BIGINT PRIMARY KEY,
    application_id BIGINT COMMENT '投递记录ID',
    position_id BIGINT COMMENT '职位ID',
    enterprise_id BIGINT COMMENT '企业ID',
    jobseeker_id BIGINT COMMENT '求职者ID',
    position_name VARCHAR(200) COMMENT '职位名称',
    enterprise_name VARCHAR(200) COMMENT '企业名称',
    jobseeker_name VARCHAR(50) COMMENT '求职者姓名',
    interviewer VARCHAR(50) COMMENT '面试官',
    interviewer_id BIGINT COMMENT '面试官ID',
    interview_type VARCHAR(20) COMMENT '面试类型：video视频 onsite现场 phone电话',
    interview_round INTEGER DEFAULT 1 COMMENT '面试轮次',
    schedule_time TIMESTAMP COMMENT '约定时间',
    duration INTEGER DEFAULT 60 COMMENT '面试时长（分钟）',
    room_id VARCHAR(100) COMMENT '视频房间ID',
    status INTEGER DEFAULT 1 COMMENT '状态：1待开始 2进行中 3已完成 4已取消',
    status_name VARCHAR(50) COMMENT '状态名称',
    evaluation TEXT COMMENT '面试评价',
    score INTEGER COMMENT '面试评分（1-10）',
    result VARCHAR(20) COMMENT '面试结果：pass fail pending',
    remark TEXT COMMENT '备注',
    actual_start_time TIMESTAMP COMMENT '实际开始时间',
    actual_end_time TIMESTAMP COMMENT '实际结束时间',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX idx_interview_enterprise ON interview(enterprise_id);
CREATE INDEX idx_interview_jobseeker ON interview(jobseeker_id);
CREATE INDEX idx_interview_status ON interview(status);
CREATE INDEX idx_interview_schedule ON interview(schedule_time);

-- ============================================
-- 消息通知表
-- ============================================
CREATE TABLE IF NOT EXISTS message (
    id BIGINT PRIMARY KEY,
    receiver_id BIGINT NOT NULL COMMENT '接收人ID',
    receiver_role VARCHAR(20) COMMENT '接收人角色',
    message_type VARCHAR(50) COMMENT '消息类型',
    title VARCHAR(200) COMMENT '消息标题',
    content TEXT COMMENT '消息内容',
    related_id BIGINT COMMENT '关联ID',
    related_type VARCHAR(50) COMMENT '关联类型',
    is_read INTEGER DEFAULT 0 COMMENT '是否已读：0否 1是',
    read_time TIMESTAMP COMMENT '读取时间',
    channel VARCHAR(20) DEFAULT 'site' COMMENT '发送渠道：site站内信 sms短信 email邮件',
    send_status INTEGER DEFAULT 1 COMMENT '发送状态：0失败 1成功',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX idx_message_receiver ON message(receiver_id, receiver_role);
CREATE INDEX idx_message_type ON message(message_type);
CREATE INDEX idx_message_read ON message(is_read);

-- ============================================
-- 签到记录表
-- ============================================
CREATE TABLE IF NOT EXISTS sign_in_record (
    id BIGINT PRIMARY KEY,
    fair_id BIGINT COMMENT '招聘会ID',
    booth_id BIGINT COMMENT '展位ID',
    user_id BIGINT COMMENT '用户ID',
    user_type VARCHAR(20) COMMENT '用户类型：jobseeker enterprise',
    user_name VARCHAR(50) COMMENT '用户姓名',
    sign_in_time TIMESTAMP COMMENT '签到时间',
    sign_in_type VARCHAR(20) COMMENT '签到类型：qr扫码 manual人工',
    remark VARCHAR(500) COMMENT '备注',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX idx_signin_fair ON sign_in_record(fair_id);
CREATE INDEX idx_signin_user ON sign_in_record(user_id);

-- ============================================
-- 人才中心表
-- ============================================
CREATE TABLE IF NOT EXISTS talent_center (
    id BIGINT PRIMARY KEY,
    center_name VARCHAR(200) NOT NULL COMMENT '中心名称',
    center_code VARCHAR(50) COMMENT '中心编码',
    city VARCHAR(50) COMMENT '所属城市',
    district VARCHAR(50) COMMENT '所属区县',
    address VARCHAR(500) COMMENT '地址',
    contact_name VARCHAR(50) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    description TEXT COMMENT '中心描述',
    status INTEGER DEFAULT 1 COMMENT '状态',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 插入示例数据：8个县区人才中心
INSERT INTO talent_center (id, center_name, center_code, city, district, contact_name, contact_phone, status) VALUES
(1, '朝阳区人才服务中心', 'CYRC', '北京市', '朝阳区', '张主任', '010-12345678', 1),
(2, '海淀区人才服务中心', 'HDRC', '北京市', '海淀区', '李主任', '010-23456789', 1),
(3, '西城区人才服务中心', 'XCRC', '北京市', '西城区', '王主任', '010-34567890', 1),
(4, '东城区人才服务中心', 'DRC', '北京市', '东城区', '赵主任', '010-45678901', 1),
(5, '丰台区人才服务中心', 'FTRC', '北京市', '丰台区', '刘主任', '010-56789012', 1),
(6, '石景山区人才服务中心', 'SJRC', '北京市', '石景山区', '孙主任', '010-67890123', 1),
(7, '通州区人才服务中心', 'TZHRC', '北京市', '通州区', '周主任', '010-78901234', 1),
(8, '昌平区人才服务中心', 'CPRC', '北京市', '昌平区', '吴主任', '010-89012345', 1);
