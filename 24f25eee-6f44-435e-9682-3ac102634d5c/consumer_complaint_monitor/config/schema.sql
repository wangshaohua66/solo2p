CREATE TABLE IF NOT EXISTS `complaints` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '投诉标题',
    `content` MEDIUMTEXT COMMENT '投诉内容',
    `publish_date` VARCHAR(50) DEFAULT '' COMMENT '发布日期',
    `detail_url` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '详情页URL',
    `channel_code` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '渠道代码',
    `channel_type` VARCHAR(30) NOT NULL DEFAULT '' COMMENT '渠道类型(government/ecommerce/weixin)',
    `source_name` VARCHAR(200) DEFAULT '' COMMENT '来源渠道名称',
    `category` VARCHAR(50) DEFAULT '其他' COMMENT '投诉分类(食品/家电/服务/金融等)',
    `risk_level` VARCHAR(20) DEFAULT 'general' COMMENT '风险等级(general/attention/warning/urgent)',
    `keywords` VARCHAR(1000) DEFAULT '' COMMENT '关键词(逗号分隔)',
    `companies` VARCHAR(500) DEFAULT '' COMMENT '涉事企业(逗号分隔)',
    `products` VARCHAR(500) DEFAULT '' COMMENT '涉及产品(逗号分隔)',
    `account_id` VARCHAR(100) DEFAULT '' COMMENT '公众号账号ID(微信渠道)',
    `collected_at` DATETIME DEFAULT NULL COMMENT '采集时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '入库时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_detail_url` (`detail_url`(255)),
    KEY `idx_channel_code` (`channel_code`),
    KEY `idx_channel_type` (`channel_type`),
    KEY `idx_category` (`category`),
    KEY `idx_risk_level` (`risk_level`),
    KEY `idx_publish_date` (`publish_date`),
    KEY `idx_collected_at` (`collected_at`),
    KEY `idx_created_at` (`created_at`),
    KEY `idx_companies` (`companies`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消费投诉信息表';


CREATE TABLE IF NOT EXISTS `crawl_failures` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `channel_code` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '渠道代码',
    `url` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '请求URL',
    `error_type` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '错误类型',
    `error_detail` TEXT COMMENT '错误详情',
    `attempt` INT NOT NULL DEFAULT 0 COMMENT '重试次数',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_channel_code` (`channel_code`),
    KEY `idx_error_type` (`error_type`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='采集失败记录表';
