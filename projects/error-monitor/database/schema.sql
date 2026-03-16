-- =============================================
-- 错误监控系统数据库表结构
-- MySQL 8.0+
-- =============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS error_monitor
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

USE error_monitor;

-- =============================================
-- 错误记录表
-- =============================================
CREATE TABLE IF NOT EXISTS errors (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fingerprint VARCHAR(64) NOT NULL COMMENT '错误指纹（去重用）',
    app_id VARCHAR(64) NOT NULL DEFAULT 'unknown' COMMENT '应用 ID',
    environment VARCHAR(32) NOT NULL DEFAULT 'production' COMMENT '环境',

    -- 错误信息
    type VARCHAR(64) NOT NULL COMMENT '错误类型',
    message TEXT NOT NULL COMMENT '错误消息',
    stack TEXT COMMENT '堆栈信息',

    -- 上下文信息
    page_path VARCHAR(512) COMMENT '页面路径',
    full_url VARCHAR(1024) COMMENT '完整 URL',
    user_agent TEXT COMMENT 'User Agent',
    referer VARCHAR(1024) COMMENT '来源页面',

    -- 用户信息
    user_id VARCHAR(128) COMMENT '用户 ID',

    -- 元数据（JSON 格式存储额外信息）
    meta JSON COMMENT '额外元数据',

    -- 统计信息
    occur_count BIGINT UNSIGNED DEFAULT 1 COMMENT '发生次数',
    first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '首次发现时间',
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后发现时间',

    -- 处理状态
    status TINYINT UNSIGNED DEFAULT 0 COMMENT '状态：0-未处理，1-处理中，2-已解决，3-已忽略',
    priority TINYINT UNSIGNED DEFAULT 0 COMMENT '优先级：0-P0, 1-P1, 2-P2, 3-P3',
    assigned_to VARCHAR(128) COMMENT '负责人',

    -- 索引
    INDEX idx_fingerprint (fingerprint),
    INDEX idx_app_id (app_id),
    INDEX idx_environment (environment),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_first_seen (first_seen),
    INDEX idx_last_seen (last_seen),
    INDEX idx_page_path (page_path(255))
) ENGINE=InnoDB COMMENT='错误记录表';

-- =============================================
-- 告警记录表
-- =============================================
CREATE TABLE IF NOT EXISTS alerts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    error_fingerprint VARCHAR(64) NOT NULL COMMENT '关联错误指纹',

    -- 告警信息
    alert_type VARCHAR(32) NOT NULL COMMENT '告警类型：P0/P1/P2/P3',
    title VARCHAR(256) NOT NULL COMMENT '告警标题',
    content TEXT COMMENT '告警内容',

    -- 告警状态
    status TINYINT UNSIGNED DEFAULT 0 COMMENT '状态：0-待处理，1-处理中，2-已解决，3-误报',
    triggered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '触发时间',
    acknowledged_at DATETIME COMMENT '确认时间',
    resolved_at DATETIME COMMENT '解决时间',

    -- 通知记录
    notified_users JSON COMMENT '已通知用户列表',
    escalation_level TINYINT UNSIGNED DEFAULT 0 COMMENT '升级级别',

    -- 负责人
    assigned_to VARCHAR(128) COMMENT '负责人',

    INDEX idx_fingerprint (error_fingerprint),
    INDEX idx_status (status),
    INDEX idx_triggered_at (triggered_at)
) ENGINE=InnoDB COMMENT='告警记录表';

-- =============================================
-- 值班表
-- =============================================
CREATE TABLE IF NOT EXISTS oncall_schedule (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL COMMENT '用户 ID',
    user_name VARCHAR(64) NOT NULL COMMENT '用户名',
    role VARCHAR(32) NOT NULL COMMENT '角色：engineer/lead/manager/director',
    phone VARCHAR(32) COMMENT '手机号',
    email VARCHAR(128) COMMENT '邮箱',

    -- 值班时间
    start_date DATE NOT NULL COMMENT '值班开始日期',
    end_date DATE NOT NULL COMMENT '值班结束日期',
    is_backup BOOLEAN DEFAULT FALSE COMMENT '是否备份人员',

    INDEX idx_user_id (user_id),
    INDEX idx_date_range (start_date, end_date)
) ENGINE=InnoDB COMMENT='值班表';

-- =============================================
-- 告警通知记录表
-- =============================================
CREATE TABLE IF NOT EXISTS alert_notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    alert_id BIGINT UNSIGNED NOT NULL COMMENT '告警 ID',
    user_id VARCHAR(128) NOT NULL COMMENT '用户 ID',

    -- 通知方式
    channel VARCHAR(32) NOT NULL COMMENT '渠道：phone/sms/im/email',

    -- 通知状态
    status TINYINT UNSIGNED DEFAULT 0 COMMENT '状态：0-发送中，1-已发送，2-失败',
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
    responded_at DATETIME COMMENT '响应时间',

    -- 失败信息
    error_message TEXT COMMENT '错误信息',

    INDEX idx_alert_id (alert_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='告警通知记录表';

-- =============================================
-- 页面性能表（预留扩展）
-- =============================================
CREATE TABLE IF NOT EXISTS page_performance (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL COMMENT '会话 ID',
    app_id VARCHAR(64) NOT NULL,

    -- 性能指标
    fcp FLOAT COMMENT '首次内容绘制 (ms)',
    lcp FLOAT COMMENT '最大内容绘制 (ms)',
    fid FLOAT COMMENT '首次输入延迟 (ms)',
    cls FLOAT COMMENT '累积布局偏移',
    tti FLOAT COMMENT '可交互时间 (ms)',

    -- 页面信息
    page_path VARCHAR(512) NOT NULL,
    user_agent TEXT,

    -- 时间
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_session_id (session_id),
    INDEX idx_page_path (page_path(255)),
    INDEX idx_recorded_at (recorded_at)
) ENGINE=InnoDB COMMENT='页面性能记录表';

-- =============================================
-- 初始化示例数据
-- =============================================

-- 插入示例值班人员
INSERT INTO oncall_schedule (user_id, user_name, role, phone, email, start_date, end_date) VALUES
('u001', '张三', 'engineer', '13800138001', 'zhangsan@example.com', '2026-03-09', '2026-03-15'),
('u002', '李四', 'engineer', '13800138002', 'lisi@example.com', '2026-03-16', '2026-03-22'),
('u003', '王五', 'lead', '13800138003', 'wangwu@example.com', '2026-03-09', '2026-03-31'),
('u004', '赵六', 'manager', '13800138004', 'zhaoliu@example.com', '2026-03-01', '2026-03-31');
