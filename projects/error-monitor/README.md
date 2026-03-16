# 前端异常监控系统

## 📚 项目结构

```
error-monitor/
├── src/                      # 前端 SDK 源码
│   ├── ErrorMonitor.ts       # 核心监控类
│   ├── ErrorBoundary.tsx     # React Error Boundary
│   └── index.ts              # 出口文件
├── server/                   # 后端服务
│   └── index.js              # Express API 服务
├── database/                 # 数据库脚本
│   └── schema.sql            # 表结构
├── package.json
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd E:\frontend-course\projects\error-monitor
npm install
```

### 2. 初始化数据库

```bash
mysql -u root -p < database/schema.sql
```

### 3. 启动后端服务

```bash
# 设置环境变量（可选）
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=error_monitor

# 启动服务
npm run start:server
```

### 4. 前端接入

#### 4.1 安装 SDK

```bash
# 方式 1：本地链接（开发）
npm link ./src

# 方式 2：发布到私有 npm
npm publish
```

#### 4.2 初始化 SDK

```typescript
// main.tsx 或 App.tsx
import { ErrorMonitor, ErrorBoundary } from 'error-monitor';

// 1. 初始化监控
const monitor = new ErrorMonitor({
  reportUrl: 'http://localhost:3001/api/error',
  sampleRate: 1,              // 开发环境 100% 采样
  appId: 'my-ecommerce-app',
  environment: process.env.NODE_ENV,
});

// 2. 用户登录后设置 userId
monitor.setUserId(currentUser.id);

// 3. 包裹应用（React）
<ErrorBoundary fallback={<div>出错了</div>}>
  <App />
</ErrorBoundary>
```

#### 4.3 手动报告错误

```typescript
// 在需要手动捕获的地方
try {
  // 某些可能出错的代码
} catch (error) {
  monitor.report({
    type: 'custom-error',
    message: error.message,
    stack: error.stack,
  });
}
```

## 📊 API 接口

### 错误上报
```
POST /api/error
Body: { errors: ErrorPayload[], meta?: object }
```

### 错误列表
```
GET /api/errors?page=1&limit=20&status=0&priority=1
```

### 错误详情
```
GET /api/errors/:fingerprint
```

### 更新错误状态
```
PUT /api/errors/:fingerprint
Body: { status?: number, priority?: number, assigned_to?: string }
```

### 统计概览
```
GET /api/stats/overview
```

## 🔔 告警配置

### 告警规则（伪代码）

```javascript
// P0 告警：核心页面错误率 > 1%
if (errorRate > 0.01 && isCorePage(page)) {
  triggerAlert('P0');
}

// P1 告警：新增错误且影响用户 > 100
if (isNewError && affectedUsers > 100) {
  triggerAlert('P1');
}

// P2 告警：已知错误激增（5 倍以上）
if (errorCount > avgCount * 5) {
  triggerAlert('P2');
}
```

## 📈 监控指标

| 指标 | 目标值 |
|------|--------|
| 错误捕获率 | > 95% |
| 上报延迟 | < 5s |
| SDK 体积 | < 5KB (gzip) |
| 性能影响 | FCP 影响 < 50ms |

## 🎯 下一步

完成异常监控部署后，继续学习：
- **B.4 CSS 渲染机制与布局系统**
- **性能监控模块**
- **告警系统进阶**
