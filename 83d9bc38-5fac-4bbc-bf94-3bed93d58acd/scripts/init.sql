-- 角色表
CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 实验中心表
CREATE TABLE centers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 用户表
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role_id BIGINT REFERENCES roles(id),
    center_id BIGINT REFERENCES centers(id),
    budget DECIMAL(12,2) NOT NULL DEFAULT 0,
    advisor_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 设备表
CREATE TABLE equipment (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    category VARCHAR(50) NOT NULL,
    center_id BIGINT REFERENCES centers(id),
    hourly_rate DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    specs JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 设备状态日志表
CREATE TABLE equipment_logs (
    id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT REFERENCES equipment(id),
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    operator_id BIGINT REFERENCES users(id),
    remark TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 预约表
CREATE TABLE bookings (
    id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT REFERENCES equipment(id) NOT NULL,
    user_id BIGINT REFERENCES users(id) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    is_series BOOLEAN NOT NULL DEFAULT FALSE,
    series_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 等待队列表
CREATE TABLE waitlists (
    id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT REFERENCES equipment(id) NOT NULL,
    user_id BIGINT REFERENCES users(id) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    position INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 账单表
CREATE TABLE billings (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT REFERENCES bookings(id),
    user_id BIGINT REFERENCES users(id) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'paid',
    billing_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 维护计划表
CREATE TABLE maintenances (
    id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT REFERENCES equipment(id) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    remark TEXT,
    operator_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 通知表
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 审计日志表
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50),
    record_id BIGINT,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_bookings_equipment_time ON bookings(equipment_id, start_time, end_time);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_equipment_center ON equipment(center_id);
CREATE INDEX idx_equipment_category ON equipment(category);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_waitlists_equipment ON waitlists(equipment_id, position);
CREATE INDEX idx_billings_user_date ON billings(user_id, billing_date);
CREATE INDEX idx_maintenances_equipment_time ON maintenances(equipment_id, start_time);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- 初始化角色数据
INSERT INTO roles (name, permissions) VALUES
('super_admin', '["*"]'),
('center_admin', '["equipment:view","equipment:create","equipment:update","booking:view","booking:manage","billing:view","billing:export","maintenance:view","maintenance:create","stats:view"]'),
('operator', '["equipment:view","booking:view","maintenance:view","maintenance:complete"]'),
('teacher', '["equipment:view","booking:create","booking:cancel","booking:view","billing:view"]'),
('student', '["equipment:view","booking:create","booking:cancel","booking:view"]');

-- 初始化实验中心
INSERT INTO centers (name, address, description) VALUES
('材料科学实验中心', 'A座1楼', '先进材料制备与表征中心'),
('生命科学实验中心', 'B座2楼', '生物医学与生命科学研究'),
('化学化工实验中心', 'C座3楼', '化学合成与分析测试'),
('物理实验中心', 'D座1楼', '凝聚态物理与光学实验'),
('电子信息实验中心', 'E座4楼', '微电子与通信技术实验'),
('机械工程实验中心', 'F座2楼', '精密制造与数控加工'),
('能源与环境实验中心', 'G座3楼', '新能源与环境科学研究'),
('医学实验中心', 'H座5楼', '基础医学与临床医学实验'),
('农业科学实验中心', 'I座1楼', '现代农业与生物技术'),
('海洋科学实验中心', 'J座2楼', '海洋资源与环境监测'),
('天文与空间实验中心', 'K座楼顶', '天文观测与空间科学'),
('计算机科学实验中心', 'L座6楼', '高性能计算与人工智能'),
('土木工程实验中心', 'M座1楼', '结构力学与岩土工程'),
('交通运输实验中心', 'N座2楼', '智能交通与物流工程'),
('艺术与设计实验中心', 'O座3楼', '数字媒体与创意设计');

-- 初始化管理员用户 (密码: admin123)
INSERT INTO users (username, password_hash, name, email, role_id, center_id, budget) VALUES
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '系统管理员', 'admin@university.edu.cn', 1, NULL, 999999.99),
('center_admin1', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '张主任', 'zhang@university.edu.cn', 2, 1, 50000.00),
('operator1', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '李操作员', 'li@university.edu.cn', 3, 1, 1000.00),
('teacher1', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '王教授', 'wang@university.edu.cn', 4, NULL, 100000.00),
('student1', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '赵同学', 'zhao@university.edu.cn', 5, NULL, 0);

-- 初始化设备数据
INSERT INTO equipment (name, model, category, center_id, hourly_rate, status, specs) VALUES
('场发射扫描电子显微镜', 'Zeiss Sigma 300', '电镜', 1, 800.00, 'available', '{"resolution": "1.0nm", "magnification": "12x-2000kx", "voltage": "0.02-30kV"}'),
('高分辨透射电子显微镜', 'FEI Titan G2', '电镜', 1, 1500.00, 'available', '{"resolution": "0.08nm", "voltage": "80-300kV", "EELS": true}'),
('X射线光电子能谱仪', 'Thermo ESCALAB 250Xi', '表面分析', 1, 600.00, 'available', '{"source": "Al K_alpha", "resolution": "0.45eV", "spot_size": "100um-900um"}'),
('原子力显微镜', 'Bruker Dimension Icon', '探针显微', 1, 400.00, 'available', '{"mode": "AC/DC", "resolution": "0.06nm", "scan_range": "125um x 125um"}'),
('超导核磁共振波谱仪', 'Bruker AVANCE III 600', '核磁', 2, 500.00, 'available', '{"field": "14.1T", "probe": "5mm BBO", "nuclei": "1H,13C,15N,31P"}'),
('高分辨质谱仪', 'Thermo Orbitrap Fusion', '质谱', 2, 700.00, 'available', '{"mass_range": "50-4000m/z", "resolution": "450000", "scan_rate": "20Hz"}'),
('液相色谱-质谱联用仪', 'Agilent 6460', '色谱质谱', 2, 450.00, 'available', '{"ion_source": "ESI/APCI", "mass_range": "10-3000m/z", "sensitivity": "fg level"}'),
('紫外可见近红外分光光度计', 'Shimadzu UV-3600', '光谱分析', 2, 200.00, 'available', '{"wavelength": "185-3300nm", "resolution": "0.1nm", "slit": "0.1-20nm"}'),
('X射线衍射仪', 'Bruker D8 Advance', 'XRD', 1, 350.00, 'available', '{"source": "Cu K_alpha", "range": "0.5-140°", "detector": "LynxEye XE"}'),
('拉曼光谱仪', 'Renishaw inVia', '光谱分析', 2, 300.00, 'available', '{"laser": "532nm/785nm", "resolution": "1cm-1", "mapping": true}'),
('荧光分光光度计', 'Hitachi F-7100', '光谱分析', 2, 250.00, 'available', '{"wavelength": "200-900nm", "resolution": "0.5nm", "sensitivity": "S/N 800:1"}'),
('热重分析仪', 'TA TGA 55', '热分析', 2, 200.00, 'available', '{"range": "Room-1000°C", "heating_rate": "0.1-100°C/min", "sensitivity": "0.1ug"}'),
('差示扫描量热仪', 'TA DSC 2500', '热分析', 2, 200.00, 'available', '{"temp_range": "-180-725°C", "sensitivity": "0.04μW", "modulation": true}'),
('扫描隧道显微镜', 'Omicron VT-STM', '探针显微', 1, 500.00, 'available', '{"temperature": "25-1500K", "resolution": "0.01nm", "UHV": "5e-11mbar"}'),
('聚焦离子束/电子束双束系统', 'Helios G4 UC', '电镜', 1, 1200.00, 'available', '{"FIB_resolution": "2.5nm", "SEM_resolution": "0.6nm", "deposition": "Pt/W/C"}'),
('电子探针显微分析仪', 'JEOL JXA-8530F', '元素分析', 1, 600.00, 'available', '{"elements": "B-U", "resolution": "5nm", "mapping": true}'),
('离子色谱仪', 'Dionex ICS-6000', '色谱分析', 2, 300.00, 'available', '{"suppressor": "ES-AP", "detector": "Conductivity/ECD", "columns": "Anion/Cation"}'),
('气相色谱-质谱联用仪', 'Agilent 7890B-5977A', '色谱质谱', 2, 400.00, 'available', '{"mass_range": "10-1050m/z", "sensitivity": "1pg OFN", "ion_source": "EI"}'),
('核磁共振波谱仪400M', 'Bruker AVANCE III HD 400', '核磁', 2, 350.00, 'available', '{"field": "9.4T", "probe": "5mm PABBO", "auto_sampler": true}'),
('顺磁共振波谱仪', 'Bruker E500', 'EPR', 2, 400.00, 'available', '{"frequency": "X-band", "temp_range": "4-473K", "resolution": "0.02G"}'),
('振动样品磁强计', 'Lake Shore 7400', '磁学测量', 1, 300.00, 'available', '{"sensitivity": "5e-7 emu", "field_range": "±2.4T", "temp_range": "77-1273K"}'),
('超导量子干涉仪', 'MPMS XL-7', '磁学测量', 1, 800.00, 'available', '{"field_range": "±7T", "temp_range": "1.8-400K", "sensitivity": "1e-8 emu"}'),
('物理性能测量系统', 'PPMS DynaCool', '综合物性', 1, 1000.00, 'available', '{"field_range": "±9T", "temp_range": "1.8-400K", "options": "Resistivity, Heat Capacity"}'),
('霍尔效应测量系统', 'HMS-5000', '电学测量', 1, 200.00, 'available', '{"field": "0.55T", "temp": "80-500K", "resistivity": "1e-8 to 1e8 ohm·cm"}'),
('半导体参数分析仪', 'Keithley 4200A', '电学测量', 5, 300.00, 'available', '{"IV_range": "1fA-1A", "CV_range": "1kHz-10MHz", "pulsed_IV": true}'),
('微波探针台', 'Cascade Summit 12000', '射频测量', 5, 400.00, 'available', '{"frequency": "DC-67GHz", "temp_range": "-40 to 310°C", "pitch": "5um"}'),
('网络分析仪', 'Keysight E8364B', '射频测量', 5, 350.00, 'available', '{"frequency": "10MHz-50GHz", "ports": "2/4", "dynamic_range": "125dB"}'),
('频谱分析仪', 'Keysight N9040B', '射频测量', 5, 300.00, 'available', '{"frequency": "3Hz-50GHz", "analysis_bw": "160MHz", "phase_noise": "-118dBc/Hz"}'),
('高速示波器', 'Tektronix DSA72004C', '时域测量', 5, 400.00, 'available', '{"bandwidth": "20GHz", "sample_rate": "100GS/s", "channels": "4"}'),
('矢量信号发生器', 'Keysight N5182A', '信号源', 5, 250.00, 'available', '{"frequency": "9kHz-6GHz", "modulation": "AM/FM/PM/QAM", "output_power": "-144 to +23dBm"}'),
('高功率激光器', 'IPG YLR-1000', '激光加工', 6, 500.00, 'available', '{"wavelength": "1070nm", "power": "1kW", "mode": "CW/Pulsed"}'),
('激光共聚焦显微镜', 'Zeiss LSM 880', '光学成像', 2, 600.00, 'available', '{"lasers": "405,488,561,633nm", "resolution": "120nm", "Z-stack": true}'),
('荧光寿命成像显微镜', 'PicoQuant MicroTime 200', '光学成像', 2, 700.00, 'available', '{"resolution": "100nm", "time_resolution": "10ps", "FLIM": true}'),
('超分辨显微镜', 'Nikon N-STORM', '光学成像', 2, 1000.00, 'available', '{"resolution": "20nm", "channels": "3", "TIRF": true}'),
('流式细胞仪', 'BD FACSAria III', '细胞分析', 2, 500.00, 'available', '{"lasers": "405,488,561,633nm", "parameters": "15 colors", "sorting": true}'),
('共聚焦拉曼显微镜', 'WITec alpha300 R', '光谱成像', 2, 550.00, 'available', '{"resolution": "300nm", "lasers": "488,532,633,785nm", "AFM": true}'),
('纳米压痕仪', 'Hysitron TI 980', '力学测试', 1, 400.00, 'available', '{"load_range": "1uN-10mN", "depth_resolution": "0.2nm", "in-situ_SPM": true}'),
('万能材料试验机', 'Instron 5982', '力学测试', 13, 300.00, 'available', '{"force_range": "100N-100kN", "speed": "0.0001-1000mm/min", "extensometer": true}'),
('冲击试验机', 'Zwick/Roell RKP 450', '力学测试', 13, 250.00, 'available', '{"energy": "150-450J", "temp_range": "-196 to 300°C", "type": "Charpy/Izod"}'),
('硬度计', 'Wilson VH3300', '力学测试', 1, 200.00, 'available', '{"type": "Vickers/Knoop", "load": "10gf-3kgf", "auto_measurement": true}'),
('摩擦磨损试验机', 'CSM Tribometer', '表面测试', 1, 300.00, 'available', '{"mode": "pin-on-disc", "load": "0.1-200N", "temp_range": "RT-1000°C"}'),
('离子束溅射沉积系统', 'IBS 300', '薄膜制备', 1, 800.00, 'available', '{"sources": "2", "ion_energy": "50-1500eV", "UHV": "1e-8 mbar"}'),
('磁控溅射系统', 'AJA ATC 2200', '薄膜制备', 1, 600.00, 'available', '{"targets": "6", "DC/RF": true, "base_pressure": "5e-9 Torr"}'),
('脉冲激光沉积系统', 'Neocera Model 930', '薄膜制备', 1, 700.00, 'available', '{"laser": "KrF Excimer", "substrate_temp": "RT-900°C", "oxygen_pressure": "1e-6 to 1 Torr"}'),
('分子束外延系统', 'VG V90', '薄膜制备', 1, 1500.00, 'available', '{"cells": "6", "base_pressure": "1e-11 Torr", "RHEED": true}'),
('原子层沉积系统', 'Beneq TFS 200', '薄膜制备', 1, 600.00, 'available', '{"temp_range": "RT-400°C", "precursors": "8", "plasma": true}'),
('化学气相沉积系统', 'MOCVD Emcore D-180', '薄膜制备', 1, 1000.00, 'available', '{"wafer_size": "2-8 inch", "temp": "400-1200°C", "MO_sources": "8"}'),
('电感耦合等离子体刻蚀系统', 'STS ICP-RIE', '微纳加工', 1, 700.00, 'available', '{"plasma_source": "ICP", "wafer_size": "8 inch", "etch_depth": "10nm-500um"}'),
('反应离子刻蚀机', 'Oxford Instruments Plasmalab 100', '微纳加工', 1, 500.00, 'available', '{"gases": "CF4,SF6,O2,Ar,Cl2", "RF_power": "600W", "pressure": "1-100mTorr"}'),
('电子束曝光系统', 'Vistec EBPG 5000+', '微纳加工', 1, 1200.00, 'available', '{"beam_energy": "100kV", "resolution": "8nm", "write_field": "100um-2mm"}'),
('紫外曝光机', 'ABM/6/350/NUV/DCCD/BSV/M', '微纳加工', 1, 400.00, 'available', '{"wavelength": "350-450nm", "resolution": "0.8um", "wafer_size": "6 inch"}'),
('光刻机', 'SUSS MA6/BA6', '微纳加工', 1, 800.00, 'available', '{"alignment": "±0.5um", "resolution": "0.5um", "mask_size": "5/6/7 inch"}'),
('等离子体增强化学气相沉积', 'Oxford PlasmaPro 800 PECVD', '薄膜制备', 1, 500.00, 'available', '{"films": "SiO2,SiN,SiOxNy", "temp": "100-400°C", "wafer_size": "8 inch"}'),
('原子力显微镜-拉曼联用', 'Horiba Xplora Plus', '联用系统', 2, 700.00, 'available', '{"AFM_mode": "Contact/Tapping", "Raman_resolution": "1cm-1", "TERS": true}'),
('X射线吸收精细结构谱', 'Stanford SR-XAS', '同步辐射', 11, 1000.00, 'available', '{"energy_range": "4-30keV", "resolution": "1e-4", "fluorescence": true}'),
('小角X射线散射仪', 'SAXSess mc2', 'X射线散射', 1, 500.00, 'available', '{"q_range": "0.003-40nm-1", "source": "Cu K_alpha", "detector": "2D Pilatus"}'),
('X射线荧光光谱仪', 'PANalytical Axios MAX', '元素分析', 1, 450.00, 'available', '{"elements": "O-U", "concentration": "ppm-100%", "power": "4kW"}'),
('电感耦合等离子体发射光谱', 'Agilent 5110', '元素分析', 2, 400.00, 'available', '{"elements": "70+", "detection_limit": "ppb level", "simultaneous": true}'),
('离子体质谱仪', 'Agilent 7900', '元素分析', 2, 600.00, 'available', '{"elements": "Li-U", "detection_limit": "ng/L", "collision_cell": "He mode"}'),
('总有机碳分析仪', 'Shimadzu TOC-L', '水质分析', 7, 200.00, 'available', '{"range": "4ug/L-30000mg/L", "combustion_temp": "680°C", "solid_sample": true}'),
('高效液相色谱仪', 'Waters Acquity UPLC H-Class', '色谱分析', 2, 350.00, 'available', '{"detectors": "PDA,FLR,MS", "pressure": "15000psi", "auto_sampler": true}'),
('凝胶渗透色谱仪', 'Waters Alliance e2695', '高分子分析', 2, 300.00, 'available', '{"detectors": "RI,UV,LS", "columns": "GPC/SEC", "temp_range": "30-80°C"}'),
('毛细管电泳仪', 'Agilent 7100', '电泳分析', 2, 250.00, 'available', '{"voltage": "30kV", "detection": "UV-Vis, LIF", "auto_sampler": true}'),
('超速离心机', 'Beckman Optima XPN-100', '分离纯化', 2, 400.00, 'available', '{"max_speed": "100000rpm", "max_g": "802400g", "temp_range": "0-40°C"}'),
('生物大分子相互作用仪', 'GE Biacore T200', '分子互作', 2, 450.00, 'available', '{"detect_method": "SPR", "kinetics": true, "affinity_range": "mM to pM"}'),
('等温滴定量热仪', 'Malcolm MicroCal PEAQ-ITC', '分子互作', 2, 350.00, 'available', '{"cell_volume": "200uL", "sensitivity": "0.1uJ/s", "kd_range": "nM to mM"}'),
('傅里叶变换红外光谱仪', 'Nicolet iS50', '光谱分析', 2, 300.00, 'available', '{"range": "7800-350cm-1", "resolution": "0.09cm-1", "ATR/Transmission": true}'),
('近红外光谱仪', 'Bruker MPA', '光谱分析', 2, 250.00, 'available', '{"range": "12500-4000cm-1", "resolution": "2cm-1", "integrating_sphere": true}'),
('X射线单晶衍射仪', 'Bruker D8 VENTURE', 'XRD', 1, 700.00, 'available', '{"source": "Cu/Mo", "detector": "PHOTON 100", "temp_range": "80-500K"}'),
('介电阻抗谱仪', 'Novocontrol Alpha-A', '介电测量', 1, 350.00, 'available', '{"frequency": "3uHz-40MHz", "temp_range": "-160 to 400°C", "impedance": "10mohm-100Tohm"}'),
('压电响应力显微镜', 'Asylum Research Cypher ES', '探针显微', 1, 550.00, 'available', '{"mode": "PFM", "voltage": "±10V", "band_excitation": true}'),
('开尔文探针力显微镜', 'Park NX20', '探针显微', 1, 450.00, 'available', '{"SKPM_mode": "AM/FM", "resolution": "1mV", "scan_range": "100um x 100um"}'),
('表面等离子体共振成像', 'Horiba SPiM', '表面分析', 2, 500.00, 'available', '{"wavelength": "630-800nm", "imaging_area": "10x10mm", "refractive_index": "1.30-1.40"}'),
('石英晶体微天平', 'Q-Sense E4', '表面分析', 2, 250.00, 'available', '{"sensitivity": "0.5ng/cm2", "dissipation": true, "flow_cell": true}'),
('椭圆偏振光谱仪', 'J.A. Woollam V-VASE', '薄膜表征', 1, 400.00, 'available', '{"wavelength": "190-1700nm", "angle": "45-90°", "resolution": "0.001°"}'),
('扫描近场光学显微镜', 'NT-MDT NTEGRA Spectra', '近场光学', 2, 650.00, 'available', '{"aperture": "50-100nm", "spectroscopy": "Raman/PL", "resolution": "50nm"}'),
('太赫兹时域光谱仪', 'Advantest TAS7500', 'THz光谱', 5, 550.00, 'available', '{"range": "0.1-4THz", "resolution": "1.9GHz", "imaging": true}'),
('时间关联单光子计数', 'PicoQuant PicoHarp 300', '时间分辨', 2, 450.00, 'available', '{"time_resolution": "4ps", "channels": "2", "sync_rate": "85MHz"}'),
('飞秒激光系统', 'Spectra-Physics Spitfire Ace', '超快激光', 1, 1200.00, 'available', '{"pulse_width": "100fs", "power": "5W", "repetition": "1kHz-10MHz"}'),
('光学参量放大器', 'Coherent Opera Solo', '超快光学', 1, 800.00, 'available', '{"tuning_range": "240-2600nm", "pulse_width": "100fs", "energy": "100uJ"}'),
('瞬态吸收光谱仪', 'Ultrafast Systems HELIOS', '超快光谱', 2, 900.00, 'available', '{"time_range": "100fs-8s", "probe_range": "320-1600nm", "pump_range": "240-2600nm"}'),
('上转换荧光光谱仪', 'Edinburgh Instruments FLS1000', '发光光谱', 2, 500.00, 'available', '{"excitation": "200-2000nm", "emission": "250-5500nm", "lifetime": "10ps-10s"}'),
('高分辨透射电镜冷阱', 'Gatan 636', '电镜附件', 1, 600.00, 'available', '{"temp_range": "-185 to 200°C", "heating_rate": "100°C/s", "gas": "N2"}'),
('电子能量损失谱', 'Gatan Quantum ER', '电镜附件', 1, 700.00, 'available', '{"energy_range": "0-5000eV", "resolution": "0.1eV", "dual_EELS": true}'),
('能量色散X射线谱', 'Oxford X-MaxN 80', '电镜附件', 1, 400.00, 'available', '{"detector_area": "80mm2", "elements": "B5-U92", "resolution": "125eV"}'),
('电子背散射衍射', 'Oxford NordlysNano', 'EBSD', 1, 500.00, 'available', '{"resolution": "1.5nm", "pattern_speed": "3030fps", "3D": true}'),
('聚焦离子束 tomography', 'FEI Tomography', 'FIB-SEM', 1, 900.00, 'available', '{"slice_thickness": "1-100nm", "volume": "50x50x50um", "auto_acquisition": true}'),
('微区X射线衍射', 'Bruker D8 Discover', 'XRD', 1, 550.00, 'available', '{"beam_size": "100um-2mm", "2D_detector": "Vantec 500", "grazing_incidence": true}'),
('X射线反射仪', 'Bruker D8 Discover HRXRD', 'XRD', 1, 500.00, 'available', '{"resolution": "5 arcsec", "thickness": "1nm-10um", "roughness": "0.1-5nm"}'),
('白光干涉仪', 'Zygo NewView 9000', '表面形貌', 1, 450.00, 'available', '{"vertical_resolution": "0.1nm", "lateral_resolution": "0.28um", "scan_range": "20mm"}'),
('光学轮廓仪', 'Bruker ContourGT-X', '表面形貌', 1, 350.00, 'available', '{"vertical_range": "10mm", "resolution": "0.1nm", "objective": "1x-100x"}'),
('激光共聚焦扫描显微镜', 'Olympus LEXT OLS5000', '表面形貌', 1, 400.00, 'available', '{"resolution": "0.12um", "height_range": "25mm", "3D_stitching": true}'),
('球差校正透射电镜', 'JEOL Grand ARM300', '电镜', 1, 2000.00, 'available', '{"resolution": "0.05nm", "voltage": "80-300kV", "corrector": "CEOS ASCOR"}'),
('原位气体环境电镜', 'FEI Titan G2 ETEM', '电镜', 1, 1800.00, 'available', '{"pressure": "up to 20mbar", "gases": "O2,N2,CO,H2", "temp": "RT-1000°C"}'),
('原位液体环境电镜', 'Hummingbird Scientific', '电镜附件', 1, 1000.00, 'available', '{"flow_cell": true, "pressure": "up to 10bar", "temp": "RT-100°C"}'),
('低能离子散射谱', 'ION-TOF Qtac100', '表面分析', 1, 650.00, 'available', '{"depth_resolution": "0.3nm", "elements": "H-U", "imaging": true}'),
('二次离子质谱', 'ION-TOF ToF-SIMS 5', '表面分析', 1, 850.00, 'available', '{"mass_resolution": "10000", "lateral_resolution": "80nm", "depth_profiling": true}'),
('X射线光电子能谱成像', 'Scienta Omicron DA 30', '表面分析', 1, 950.00, 'available', '{"energy_resolution": "1meV", "spatial_resolution": "3um", "imaging": true}'),
('紫外光电子能谱', 'Scienta R4000', '表面分析', 1, 550.00, 'available', '{"energy_resolution": "1meV", "angle_resolved": true, "He I/II": true}'),
('密度泛函理论计算站', 'Custom GPU Cluster', '计算模拟', 10, 100.00, 'available', '{"GPUs": "8 x A100", "CPUs": "128 cores", "memory": "1TB"}'),
('第一性原理计算服务器', 'Dell PowerEdge R750', '计算模拟', 10, 80.00, 'available', '{"CPUs": "64 cores", "memory": "256GB", "storage": "10TB SSD"}'),
('分子动力学计算站', 'NVIDIA DGX A100', '计算模拟', 10, 150.00, 'available', '{"GPUs": "8 x A100 80GB", "CPUs": "128 cores", "NVLink": true}'),
('3D X射线显微镜', 'ZEISS Xradia 810 Ultra', 'X射线成像', 1, 1200.00, 'available', '{"resolution": "50nm", "FOV": "64um", "phase_contrast": true}'),
('微计算机断层扫描', 'Bruker Skyscan 2214', 'CT成像', 1, 800.00, 'available', '{"resolution": "0.35um", "FOV": "10mm", "energy": "20-100kV"}'),
('正电子发射断层扫描', 'PET/CT Mediso nanoScan', '核医学', 8, 1500.00, 'available', '{"resolution": "0.7mm", "FOV": "80mm axial", "CT_resolution": "25um"}'),
('磁共振成像仪7T', 'Bruker BioSpec 70/30', 'MRI', 8, 2000.00, 'available', '{"field": "7T", "bore": "30cm", "sequences": "T1,T2,fMRI,MRS"}'),
('高性能计算集群', 'Inspur NF5280M6', 'HPC', 12, 50.00, 'available', '{"nodes": "100", "cores": "5120", "peak_performance": "200TFLOPS"}'),
('冷冻透射电子显微镜', 'FEI Titan Krios G3i', '冷冻电镜', 2, 2500.00, 'available', '{"voltage": "300kV", "resolution": "0.17nm", "autoloader": true, "phase_plate": true}'),
('冷冻聚焦离子束', 'FEI Aquilos 2', '冷冻电镜', 2, 1800.00, 'available', '{"temp": "-180°C", "thinning": "cryo-lamella", "imaging": "cryo-SEM"}'),
('单分子荧光显微镜', 'Nikon Ti2-E PFS', '单分子成像', 2, 900.00, 'available', '{"detection": "EMCCD/sCMOS", "lasers": "405,488,561,640nm", "TIRF": true, "HILO": true}'),
('膜片钳系统', 'Molecular Devices Axon 700B', '电生理', 8, 400.00, 'available', '{"mode": "voltage/current clamp", "bandwidth": "100kHz", "noise": "0.06pA RMS"}'),
('双光子显微镜', 'Olympus FVMPE-RS', '活体成像', 8, 1200.00, 'available', '{"laser": "Mai Tai DeepSee", "penetration": "1mm", "speed": "30fps"}'),
('荧光激活细胞分选仪', 'BD FACSMelody', '细胞分选', 2, 600.00, 'available', '{"sort_speed": "20000 events/s", "purity": ">99%", "96-well_plate": true}'),
('高通量测序仪', 'Illumina NovaSeq 6000', '基因测序', 2, 1500.00, 'available', '{"output": "6TB per run", "read_length": "2x150bp", "flow_cell": "SP/S1/S2/S4"}'),
('单细胞RNA测序平台', '10x Genomics Chromium', '单细胞分析', 2, 800.00, 'available', '{"cells": "100-10000 per sample", "capture_rate": ">65%", "feature_barcoding": true}'),
('蛋白质晶体筛选机器人', 'Art Gryphon LCP', '蛋白结晶', 2, 500.00, 'available', '{"drop_volume": "50-500nL", "plates": "96/1536 well", "LCP": true}'),
('表面等离子体共振质谱联用', 'Bruker timsTOF fleX', '联用系统', 2, 1200.00, 'available', '{"SPR_MALDI": true, "mass_resolution": "60000", "imaging": true}'),
('液相色谱-串联质谱', 'Thermo Exploris 480', '蛋白质组学', 2, 900.00, 'available', '{"mass_range": "100-6000m/z", "resolution": "120000", "scan_rate": "40Hz"}'),
('气相色谱-嗅闻-质谱', 'Agilent 8890-7010B-OFW', '联用系统', 2, 700.00, 'available', '{"olfactory_port": true, "mass_range": "10-1050m/z", "multi_deodorant": true}'),
('超高效合相色谱仪', 'Waters ACQUITY UPC2', '色谱分析', 2, 400.00, 'available', '{"pressure": "6000psi", "flow_rate": "0.1-4.0mL/min", "detectors": "PDA, MS"}'),
('热裂解-气相色谱质谱', 'Frontier EGA/PY 3030D', '联用系统', 2, 550.00, 'available', '{"temp_range": "RT-1050°C", "EGA_mode": true, "heart_cut": true}'),
('电感耦合等离子体串联质谱', 'Agilent 8900', '元素分析', 2, 800.00, 'available', '{"MS/MS": true, "detection_limit": "ng/L", "reaction_gases": "H2,He,NH3,O2"}'),
('高效液相色谱-电感耦合等离子体质谱', 'Agilent 1290-7900', '联用系统', 2, 900.00, 'available', '{"speciation_analysis": true, "nebulizer": "MicroMist", "interface": "PTFE"}'),
('全二维气相色谱-飞行时间质谱', 'LECO Pegasus GC-HRT+ 4D', '色谱质谱', 2, 1100.00, 'available', '{"modulator": "thermal", "mass_resolution": "50000", "scan_rate": "200 spectra/s"}'),
('液相色谱-高分辨质谱', 'Thermo Q Exactive HF-X', '蛋白质组学', 2, 1000.00, 'available', '{"resolution": "240000", "scan_rate": "40Hz", "HCD_cell": true}'),
('基质辅助激光解吸电离质谱成像', 'Bruker timsTOF fleX', '质谱成像', 2, 1300.00, 'available', '{"spatial_resolution": "5um", "mass_range": "100-3000m/z", "speed": "20 pixel/s"}'),
('核磁共振代谢组学平台', 'Bruker Avance III 600 HD', '代谢组学', 2, 950.00, 'available', '{"pulse_programs": "NOESY,CPMG", "automation": true, "temp_control": true}'),
('生物传感分析系统', 'Sartorius Octet RED96e', '生物分析', 2, 550.00, 'available', '{"assay_type": "BLI", "sample_number": "96", "kinetics": true}'),
('细胞能量代谢分析仪', 'Agilent Seahorse XFe96', '细胞分析', 2, 450.00, 'available', '{"measurements": "OCR,ECAR,PER,ATP", "wells": "96", "injection": "4 ports"}'),
('高内涵细胞成像分析系统', 'Molecular Devices ImageXpress Micro 4', '细胞成像', 2, 750.00, 'available', '{"objectives": "1x-100x", "sCMOS_camera": true, "autofocus": "laser"}'),
('实时荧光定量PCR仪', 'Applied Biosystems QuantStudio 7 Flex', '分子生物学', 2, 350.00, 'available', '{"blocks": "96,384,TaqMan", "chemistries": "SYBR,TaqMan", "HRM": true}'),
('数字PCR系统', 'Bio-Rad QX200 Droplet Digital', '分子生物学', 2, 450.00, 'available', '{"droplets": "20000 per sample", "sensitivity": "0.001%", "multiplex": "FAM/VIC"}'),
('全自动微生物鉴定系统', 'Biolog Gen III OmniLog', '微生物分析', 2, 300.00, 'available', '{"identification": "Bacteria,Yeast,Fungi", "plates": "96 well", "incubation": "15-45°C"}'),
('纳米颗粒跟踪分析仪', 'Malvern NanoSight NS300', '纳米表征', 2, 350.00, 'available', '{"size_range": "10-2000nm", "concentration": "10^6-10^9 particles/mL", "zeta_potential": true}'),
('多角光散射凝胶渗透色谱', 'Wyatt DAWN HELEOS II', '高分子分析', 2, 600.00, 'available', '{"molar_mass": "200Da-1GDa", "detectors": "MALS,UV,RI,ViscoStar", "fraction_collection": true}'),
('Zeta电位分析仪', 'Malvern Zetasizer Ultra', '纳米表征', 2, 250.00, 'available', '{"size_range": "0.3nm-15um", "zeta_range": "3.8nm-100um", "concentration": "0.00001-40% w/v"}'),
('超高效聚合物色谱', 'Waters ACQUITY APC', '高分子分析', 2, 400.00, 'available', '{"resolution": "3x higher than GPC", "analysis_time": "10-20min", "columns": "1.7um particles"}'),
('半导体工艺生产线', 'Suss MicroTec Cluster System', '微纳加工', 1, 3000.00, 'available', '{"processes": "Lithography,Deposition,Etching", "wafer_size": "8 inch", "class": "100"}'),
('深紫外光刻机', 'ASML PAS 5500/300', '微纳加工', 1, 5000.00, 'available', '{"wavelength": "248nm", "resolution": "0.25um", "wafer_size": "8 inch"}'),
('纳米压印光刻系统', 'EVG 620 NT', '微纳加工', 1, 1500.00, 'available', '{"resolution": "10nm", "wafer_size": "8 inch", "UV_imprint": true, "hot_embossing": true}'),
('等离子体辅助键合机', 'EVG 850', '微纳加工', 1, 1000.00, 'available', '{"wafer_size": "8 inch", "bond_types": "Plasma activated, Anodic", "vacuum": "1e-5 mbar"}'),
('快速热退火炉', 'MILA-5000', '热处理', 1, 300.00, 'available', '{"temp_range": "RT-1100°C", "heating_rate": "100°C/s", "atmosphere": "N2,O2,Ar"}'),
('管式炉', 'Carbolite GPC 12/600', '热处理', 1, 200.00, 'available', '{"temp_range": "RT-1200°C", "tube_size": "60mm dia", "atmosphere_control": true}'),
('真空热压烧结炉', 'FCT Systeme HP D 250', '材料制备', 1, 800.00, 'available', '{"max_temp": "2200°C", "max_pressure": "50MPa", "vacuum": "1e-3 mbar"}'),
('火花等离子体烧结炉', 'SPS Syntex 707', '材料制备', 1, 900.00, 'available', '{"max_temp": "2400°C", "max_pressure": "100kN", "heating_rate": "1000°C/min"}'),
('真空感应熔炼炉', 'Indutherm VTC 200 V', '材料制备', 1, 700.00, 'available', '{"max_temp": "1700°C", "capacity": "200g", "vacuum": "1e-4 mbar"}'),
('电弧熔炼炉', 'Edmund Bühler MAM-1', '材料制备', 1, 500.00, 'available', '{"current": "1000A", "max_temp": "3500°C", "argon_atmosphere": true}'),
('区熔单晶生长炉', 'NEC SC-35HD', '晶体生长', 1, 1000.00, 'available', '{"max_temp": "1600°C", "zone_length": "20-80mm", "vacuum": "1e-6 Torr"}'),
('提拉法晶体生长炉', "Cyberstar Oxypuller", '晶体生长', 1, 900.00, 'available', '{"max_temp": "2100°C", "capacity": "5kg", "atmosphere": "Air/Ar/O2"}'),
('水热反应釜', 'Parr 4749', '材料制备', 2, 100.00, 'available', '{"capacity": "1L", "max_temp": "300°C", "max_pressure": "3000psi"}'),
('冷冻干燥机', 'Labconco FreeZone 12', '样品制备', 2, 250.00, 'available', '{"capacity": "12L", "temp": "-84°C", "vacuum": "0.002mbar"}'),
('手套箱', 'MBraun Labmaster 130', '气氛控制', 1, 400.00, 'available', '{"H2O/O2": "<1ppm", "volume": "1300L", "gas_purification": true}'),
('真空镀膜系统', 'Thermal Evaporator', '薄膜制备', 1, 350.00, 'available', '{"sources": "4", "base_pressure": "1e-6 Torr", "thickness_monitor": "QCM"}'),
('键合机', 'Karl Suss SB6e', '微纳加工', 1, 450.00, 'available', '{"wafer_size": "6 inch", "bond_types": "Eutectic,Adhesive,GlassFrit", "alignment": "±2um"}'),
('划片机', 'Disco DAD3240', '微纳加工', 1, 350.00, 'available', '{"blade_thickness": "15um", "wafer_size": "8 inch", "spindle_speed": "60000rpm"}'),
('探针台', 'Cascade Microtech 11000', '电学测试', 5, 200.00, 'available', '{"wafer_size": "8 inch", "chuck_temp": "RT-310°C", "microscope": "1500x"}'),
('铁电测试系统', 'Radiant Precision Premier II', '铁电测量', 1, 400.00, 'available', '{"voltage": "±100V", "frequency": "1mHz-100kHz", "hysteresis_loop": true}'),
('热释电测量系统', 'Pyroelectric Tester', '热释电测量', 1, 300.00, 'available', '{"temp_range": "-50 to 200°C", "heating_rate": "0.1-10°C/min", "current_measurement": "fA level"}'),
('压电系数测量仪', 'APC YE2730A', '压电测量', 1, 200.00, 'available', '{"d33_range": "1-2000pC/N", "frequency": "110Hz", "static_force": "2-18N"}'),
('磁电阻测量系统', 'Physical Property Measurement', '磁电测量', 1, 800.00, 'available', '{"field": "±9T", "temp": "1.8-400K", "resistivity": "10nohm-10Mohm"}'),
('磁热效应测量系统', 'Adiabatic Calorimeter', '磁热测量', 1, 700.00, 'available', '{"field": "0-5T", "temp": "20-300K", "delta_T_accuracy": "0.01K"}'),
('自旋电子学测量系统', 'Protemics MPMS3-AC', '自旋测量', 1, 900.00, 'available', '{"field": "±7T", "temp": "1.8-400K", "AC_susceptibility": "10Hz-10kHz"}'),
('隧道磁阻测量系统', 'Nanomagnetics Instruments', 'TMR测量', 1, 550.00, 'available', '{"field": "±2T", "current": "1nA-10mA", "rotation": "360°"}'),
('磁光克尔效应显微镜', 'Evico Magnetics', '磁畴成像', 1, 600.00, 'available', '{"field": "±0.5T", "lateral_resolution": "300nm", "time_resolution": "1ns"}'),
('布里渊光散射仪', 'JRS Scientific', '自旋波测量', 1, 650.00, 'available', '{"frequency_range": "0.1-1000GHz", "contrast": ">1e10", "imaging": true}'),
('磁力显微镜', 'Bruker Multimode 8-HR', '磁畴表征', 1, 450.00, 'available', '{"lift_height": "10-100nm", "resolution": "30nm", "phase_contrast": true}'),
('逆磁光克尔效应系统', 'Pump-Probe MOKE', '超快磁学', 1, 900.00, 'available', '{"time_resolution": "100fs", "laser": "800nm", "field": "±0.5T"}'),
('自旋泵浦测量系统', 'FMR-spin pumping', '自旋电子学', 1, 700.00, 'available', '{"frequency": "1-40GHz", "field": "±2T", "temp": "77-400K"}');
