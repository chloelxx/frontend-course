/**
 * 错误监控后端服务
 * Node.js + Express + MySQL
 */

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 数据库连接池
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'error_monitor',
  waitForConnections: true,
  connectionLimit: 10,
});

// =============================================
// API 路由
// =============================================

/**
 * 1. 错误上报接口
 * POST /api/error
 */
app.post('/api/error', async (req, res) => {
  try {
    const { errors, meta } = req.body;
    const errorList = Array.isArray(errors) ? errors : [errors];

    if (errorList.length === 0) {
      return res.json({ success: true, message: 'No errors to report' });
    }

    const sql = `
      INSERT INTO errors
      (fingerprint, app_id, environment, type, message, stack,
       page_path, full_url, user_agent, user_id, meta, occur_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
      occur_count = occur_count + VALUES(occur_count),
      last_seen = NOW(),
      environment = VALUES(environment)
    `;

    for (const error of errorList) {
      // 提取 user_id（从 meta 或独立字段）
      const userId = error.userId || error.meta?.userId;

      await db.execute(sql, [
        error.fingerprint,
        error.appId || 'unknown',
        error.environment || 'production',
        error.type || 'unknown',
        error.message || '',
        error.stack || null,
        error.pagePath || '/',
        error.url || null,
        error.userAgent || null,
        userId || null,
        error.meta ? JSON.stringify(error.meta) : null,
      ]);
    }

    console.log(`Received ${errorList.length} errors`);
    res.json({ success: true, received: errorList.length });
  } catch (err) {
    console.error('Error reporting failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. 错误列表接口（支持分页和过滤）
 * GET /api/errors
 */
app.get('/api/errors', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      type,
      appId,
      environment,
      startDate,
      endDate,
      keyword,
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    // 构建 WHERE 条件
    if (status !== undefined) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (priority !== undefined) {
      conditions.push('priority = ?');
      params.push(priority);
    }
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }
    if (appId) {
      conditions.push('app_id = ?');
      params.push(appId);
    }
    if (environment) {
      conditions.push('environment = ?');
      params.push(environment);
    }
    if (startDate) {
      conditions.push('first_seen >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('last_seen <= ?');
      params.push(endDate);
    }
    if (keyword) {
      conditions.push('(message LIKE ? OR fingerprint LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 查询总数
    const [countRows] = await db.query(
      `SELECT COUNT(DISTINCT fingerprint) as total FROM errors ${whereClause}`,
      params
    );

    // 查询数据
    const [rows] = await db.query(
      `
      SELECT
        id, fingerprint, app_id, environment, type, message,
        page_path, occur_count, first_seen, last_seen,
        status, priority, assigned_to
      FROM errors
      ${whereClause}
      GROUP BY fingerprint
      ORDER BY
        CASE priority
          WHEN 0 THEN 1
          WHEN 1 THEN 2
          WHEN 2 THEN 3
          ELSE 4
        END,
        occur_count DESC,
        last_seen DESC
      LIMIT ? OFFSET ?
      `,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countRows[0].total,
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching errors:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. 错误详情接口
 * GET /api/errors/:fingerprint
 */
app.get('/api/errors/:fingerprint', async (req, res) => {
  try {
    const { fingerprint } = req.params;

    const [rows] = await db.query(
      `SELECT * FROM errors WHERE fingerprint = ? ORDER BY last_seen DESC LIMIT 1`,
      [fingerprint]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Error not found' });
    }

    // 获取堆栈样本（最近 10 条）
    const [samples] = await db.query(
      `SELECT stack, page_path, user_agent, created_at
       FROM errors
       WHERE fingerprint = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [fingerprint]
    );

    res.json({
      success: true,
      data: {
        ...rows[0],
        stackSamples: samples,
      },
    });
  } catch (err) {
    console.error('Error fetching error details:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. 更新错误状态
 * PUT /api/errors/:fingerprint
 */
app.put('/api/errors/:fingerprint', async (req, res) => {
  try {
    const { fingerprint } = req.params;
    const { status, priority, assigned_to } = req.body;

    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    params.push(fingerprint);
    await db.query(
      `UPDATE errors SET ${updates.join(', ')} WHERE fingerprint = ?`,
      params
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. 统计概览接口
 * GET /api/stats/overview
 */
app.get('/api/stats/overview', async (req, res) => {
  try {
    // 总错误数（按指纹去重）
    const [totalRows] = await db.query(
      `SELECT COUNT(DISTINCT fingerprint) as total FROM errors WHERE first_seen >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );

    // 按优先级统计
    const [priorityRows] = await db.query(
      `SELECT priority, COUNT(DISTINCT fingerprint) as count
       FROM errors
       WHERE first_seen >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY priority`
    );

    // 按类型统计
    const [typeRows] = await db.query(
      `SELECT type, COUNT(DISTINCT fingerprint) as count
       FROM errors
       WHERE first_seen >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY type`
    );

    // Top 10 错误
    const [topErrors] = await db.query(
      `SELECT fingerprint, message, page_path, occur_count, priority
       FROM errors
       WHERE first_seen >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ORDER BY occur_count DESC
       LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        totalErrors: totalRows[0]?.total || 0,
        byPriority: priorityRows.reduce((acc, row) => {
          acc[`P${row.priority}`] = row.count;
          return acc;
        }, {}),
        byType: typeRows,
        topErrors,
      },
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. 健康检查接口
 * GET /api/health
 */
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================
// 启动服务器
// =============================================

app.listen(PORT, () => {
  console.log(`Error Monitor API server running on port ${PORT}`);
});

module.exports = app;
