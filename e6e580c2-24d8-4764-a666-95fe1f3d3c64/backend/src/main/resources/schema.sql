-- 小区表
CREATE TABLE IF NOT EXISTS community (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    leader_id INTEGER,
    resident_count INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 团长表
CREATE TABLE IF NOT EXISTS group_leader (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    community_id INTEGER,
    id_card VARCHAR(18),
    commission_rate DECIMAL(5,2) DEFAULT 5.00,
    total_commission DECIMAL(10,2) DEFAULT 0.00,
    available_commission DECIMAL(10,2) DEFAULT 0.00,
    status INTEGER DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 供应商表
CREATE TABLE IF NOT EXISTS supplier (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(50),
    phone VARCHAR(20),
    address VARCHAR(255),
    business_license VARCHAR(100),
    settlement_cycle INTEGER DEFAULT 7,
    total_settlement DECIMAL(12,2) DEFAULT 0.00,
    status INTEGER DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 商品分类表
CREATE TABLE IF NOT EXISTS product_category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    parent_id INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 商品表
CREATE TABLE IF NOT EXISTS product (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    category_id INTEGER,
    supplier_id INTEGER,
    description TEXT,
    image_url VARCHAR(500),
    purchase_price DECIMAL(10,2) DEFAULT 0.00,
    selling_price DECIMAL(10,2) DEFAULT 0.00,
    unit VARCHAR(20),
    total_stock INTEGER DEFAULT 0,
    sold_count INTEGER DEFAULT 0,
    status INTEGER DEFAULT 0,
    audit_status INTEGER DEFAULT 0,
    audit_remark VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 商品小区库存表
CREATE TABLE IF NOT EXISTS product_community_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    community_id INTEGER NOT NULL,
    stock INTEGER DEFAULT 0,
    locked_stock INTEGER DEFAULT 0,
    sold_count INTEGER DEFAULT 0,
    price DECIMAL(10,2) DEFAULT 0.00,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    UNIQUE(product_id, community_id)
);

-- 居民用户表
CREATE TABLE IF NOT EXISTS resident_user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password VARCHAR(100) DEFAULT '123456',
    nickname VARCHAR(50),
    avatar VARCHAR(500),
    community_id INTEGER,
    level INTEGER DEFAULT 1,
    points INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    order_count INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 购物车表
CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    community_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(32) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    community_id INTEGER NOT NULL,
    leader_id INTEGER,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    pay_amount DECIMAL(10,2) DEFAULT 0.00,
    status INTEGER DEFAULT 0,
    pay_status INTEGER DEFAULT 0,
    pay_time DATETIME,
    delivery_status INTEGER DEFAULT 0,
    delivery_task_id INTEGER,
    pickup_code VARCHAR(10),
    remark VARCHAR(500),
    cancel_reason VARCHAR(500),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 订单明细表
CREATE TABLE IF NOT EXISTS order_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    order_no VARCHAR(32) NOT NULL,
    product_id INTEGER NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    product_image VARCHAR(500),
    price DECIMAL(10,2) DEFAULT 0.00,
    quantity INTEGER DEFAULT 1,
    total_price DECIMAL(10,2) DEFAULT 0.00,
    community_id INTEGER NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 配送任务表
CREATE TABLE IF NOT EXISTS delivery_task (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_no VARCHAR(32) NOT NULL UNIQUE,
    delivery_date DATE NOT NULL,
    vehicle_no VARCHAR(50),
    driver_name VARCHAR(50),
    driver_phone VARCHAR(20),
    total_orders INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    status INTEGER DEFAULT 0,
    start_time DATETIME,
    end_time DATETIME,
    remark VARCHAR(500),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 配送明细表
CREATE TABLE IF NOT EXISTS delivery_detail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    order_no VARCHAR(32) NOT NULL,
    community_id INTEGER NOT NULL,
    community_name VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 0,
    arrive_time DATETIME,
    confirm_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 结算表
CREATE TABLE IF NOT EXISTS settlement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    settlement_no VARCHAR(32) NOT NULL UNIQUE,
    type INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    target_name VARCHAR(100),
    start_date DATE,
    end_date DATE,
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    order_count INTEGER DEFAULT 0,
    commission_amount DECIMAL(10,2) DEFAULT 0.00,
    platform_profit DECIMAL(10,2) DEFAULT 0.00,
    settle_amount DECIMAL(12,2) DEFAULT 0.00,
    status INTEGER DEFAULT 0,
    settle_time DATETIME,
    remark VARCHAR(500),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 结算明细表
CREATE TABLE IF NOT EXISTS settlement_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    settlement_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    order_no VARCHAR(32) NOT NULL,
    product_id INTEGER,
    product_name VARCHAR(200),
    amount DECIMAL(10,2) DEFAULT 0.00,
    commission DECIMAL(10,2) DEFAULT 0.00,
    profit DECIMAL(10,2) DEFAULT 0.00,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name VARCHAR(50),
    module VARCHAR(50),
    operation VARCHAR(100),
    method VARCHAR(200),
    params TEXT,
    result TEXT,
    ip VARCHAR(50),
    status INTEGER DEFAULT 1,
    cost_time INTEGER,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 管理员表
CREATE TABLE IF NOT EXISTS admin_user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    role_type INTEGER DEFAULT 1,
    status INTEGER DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_product_category ON product(category_id);
CREATE INDEX IF NOT EXISTS idx_product_supplier ON product(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_status ON product(status);
CREATE INDEX IF NOT EXISTS idx_order_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_community ON orders(community_id);
CREATE INDEX IF NOT EXISTS idx_order_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_create_time ON orders(create_time);
CREATE INDEX IF NOT EXISTS idx_order_item_order ON order_item(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_task_date ON delivery_task(delivery_date);
CREATE INDEX IF NOT EXISTS idx_settlement_type ON settlement(type);
CREATE INDEX IF NOT EXISTS idx_settlement_status ON settlement(status);
