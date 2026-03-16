# 网络与加载性能学习记录

**日期**: 2026-03-10
**主题**: 网络加载流程与性能优化深度剖析
**类型**: 原理探究

---

## 第一部分：网络加载流程

### 问题 1：完整网络加载流程

**题目**：当您在浏览器地址栏输入 URL 到页面完全加载，这中间经历了哪些网络过程？

**学员回答**：
- TCP 连接、DNS 解析、发送 HTTP 请求、等待响应、接收数据、解析渲染
- TCP 会经历三次握手去建立连接
- DNS 解析会先从浏览器缓存中查找，如果浏览器缓存中没有，就去系统缓存中查找
- 继续向系统的 hosts 文件查找，如果都没有找到，就去向 DNS 根服务查询

**导师评价**：✓ 基本正确（顺序需要调整：**DNS 解析 → TCP 连接 → HTTP 请求**）

**完整流程**：

```
┌─────────────────────────────────────────────────────────────┐
│              完整网络加载流程                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. DNS 解析（0-100ms）                                      │
│     浏览器缓存 → 系统缓存 → hosts 文件 → DNS 服务器            │
│                                                             │
│  2. TCP 连接（1-3 × RTT）                                    │
│     三次握手：SYN → SYN-ACK → ACK                           │
│                                                             │
│  3. TLS 握手（1-2 × RTT）                                    │
│     TLS 1.2: 2 RTT                                           │
│     TLS 1.3: 1 RTT（更快）                                   │
│                                                             │
│  4. HTTP 请求/响应                                           │
│     发送请求 → 服务器处理 → 返回响应（TTFB）                 │
│                                                             │
│  5. 数据传输                                                 │
│     下载 HTML/CSS/JS/图片等资源                              │
│                                                             │
│  6. 解析渲染                                                 │
│     HTML→DOM, CSS→CSSOM, Render Tree, Layout, Paint         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### DNS 解析优化

```html
<!-- 预解析 DNS，减少未来请求的 DNS 时间 -->
<link rel="dns-prefetch" href="//cdn.example.com">
<link rel="preconnect" href="//api.example.com">
```

### TCP/TLS 优化

```html
<!-- 预建立 TCP 连接 -->
<link rel="preconnect" href="//cdn.example.com">

<!-- 提前加载资源（包括 TCP+TLS） -->
<link rel="preload" href="//cdn.example.com/font.woff2" as="font">
```

---

## 第二部分：HTTP 协议演进

### 问题 2：HTTP/1.1 vs HTTP/2 vs HTTP/3

**导师解答**：

```
┌─────────────────────────────────────────────────────────────┐
│          HTTP 协议演进对比                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HTTP/1.1（1997）：                                          │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                        │
│  │ Req1│  │ Req2│  │ Req3│  │ Req4│  串行请求（队头阻塞）  │
│  └─────┘  └─────┘  └─────┘  └─────┘                        │
│                                                             │
│  HTTP/2（2015）：                                            │
│  ┌─────────────────────────────────────────┐               │
│  │ Stream 1: │Req1│──────│Resp1│           │               │
│  │ Stream 2: │Req2│──│Resp2│               │  多路复用      │
│  │ Stream 3: │Req3│──────────│Resp3│       │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
│  HTTP/3（2022）：                                            │
│  • 基于 QUIC 协议（UDP 而非 TCP）                              │
│  • 0-RTT 连接建立                                            │
│  • 无队头阻塞（应用层）                                      │
│  • 连接迁移（切换网络不断连）                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**协议性能对比**：

| 特性 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|----------|--------|--------|
| 连接数 | 6-8 个/域名 | 1 个 | 1 个 |
| 多路复用 | ❌ | ✓ | ✓ |
| 队头阻塞 | 有 | TCP 层有 | 无 |
| 握手延迟 | 3 RTT | 3 RTT | 0-1 RTT |
| 传输层 | TCP | TCP | QUIC(UDP) |

---

## 第三部分：关键渲染路径优化

### 问题 3：关键渲染路径优化策略

**题目**：如何通过优化关键渲染路径来提升首屏加载速度？

**学员回答**：
- 关键渲染路径是浏览器从接收到 HTML 到最终将页面内容渲染到屏幕上的整个过程
- 优化核心是减少 DOM 操作，减少页面的重排和重绘
- JS 外部资源使用 async，内部资源使用 defer
- 提取关键 CSS，减少 HTTP 请求，使用雪碧图

**导师评价**：✓ 基本正确

**完整优化策略**：

### 1. JavaScript 优化

```html
<!-- async：下载不阻塞，执行阻塞 -->
<script async src="analytics.js"></script>

<!-- defer：下载不阻塞，执行不阻塞（推荐） -->
<script defer src="app.js"></script>

<!-- type="module"：默认 defer 行为 -->
<script type="module" src="app.js"></script>
```

**执行优化**：
```javascript
// 1. 代码分割（Code Splitting）
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));

// 2. Tree Shaking
import { debounce } from 'lodash-es';

// 3. 预加载关键 JS
<link rel="preload" href="critical.js" as="script">

// 4. Web Worker 处理耗时计算
const worker = new Worker('heavy-task.js');
```

### 2. CSS 优化

```html
<head>
  <!-- 内联关键 CSS -->
  <style>
    /* 首屏必需的 CSS（通常 < 14KB） */
    header { height: 60px; }
    .hero { min-height: 400px; }
  </style>

  <!-- 异步加载非关键 CSS -->
  <link rel="preload" href="styles.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
</head>
```

### 3. 图片优化

```html
<!-- 懒加载 -->
<img src="image.jpg" loading="lazy">

<!-- 响应式图片 -->
<img src="small.jpg"
     srcset="small.jpg 480w, medium.jpg 768w, large.jpg 1200w"
     sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 33vw">

<!-- 现代格式 -->
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="description">
</picture>
```

### 4. 页面解析与渲染优化

```javascript
// 1. 减少 DOM 复杂度（< 1500 个节点，< 32 层深度）

// 2. 避免强制同步布局（先读后写）
const widths = elements.map(el => el.offsetWidth);
elements.forEach((el, i) => {
  el.style.width = widths[i] + 10 + 'px';
});

// 3. 使用 CSS 合成层优化动画
.animated {
  will-change: transform;
  transform: translateZ(0);
}
/* 只合成，不重排：避免动画 width/height/top/left */

// 4. 虚拟列表渲染大数据
import { FixedSizeList } from 'react-window';
```

### 5. 网络请求优化

```html
<!-- 资源预加载 -->
<link rel="preload" href="font.woff2" as="font">
<link rel="prefetch" href="next-page.js">
<link rel="preconnect" href="//cdn.example.com">
<link rel="dns-prefetch" href="//analytics.com">

<!-- 缓存策略 -->
Cache-Control: max-age=31536000, immutable
ETag: "abc123"

<!-- Service Worker 自定义缓存 -->
```

---

## 第四部分：性能监控

### 问题 4：性能监控方案

**学员回答**：
- 通过 Chrome DevTools 中的 Performance 监控页面性能
- 也可以使用 Sentry 系统监控页面性能

**导师评价**：✓ 正确

### Core Web Vitals 监控

```javascript
import { onLCP, onFID, onCLS } from 'web-vitals';

onLCP((metric) => {
  console.log('LCP:', metric.value);
  sendToAnalytics(metric);
});

onFID((metric) => {
  console.log('FID:', metric.value);
  sendToAnalytics(metric);
});

onCLS((metric) => {
  console.log('CLS:', metric.value);
  sendToAnalytics(metric);
});

function sendToAnalytics(metric) {
  const body = {
    name: metric.name,
    value: metric.value,
    url: window.location.href,
  };
  navigator.sendBeacon('/analytics', JSON.stringify(body));
}
```

### Performance API

```javascript
// Navigation Timing - 页面加载各阶段耗时
const navigation = performance.getEntriesByType('navigation')[0];
console.log({
  DNS 解析：navigation.domainLookupEnd - navigation.domainLookupStart,
  TCP 连接：navigation.connectEnd - navigation.connectStart,
  请求响应：navigation.responseEnd - navigation.requestStart,
  DOM 解析：navigation.domComplete - navigation.domInteractive,
  完整加载：navigation.loadEventEnd - navigation.navigationStart,
});

// Resource Timing - 每个资源加载详情
const resources = performance.getEntriesByType('resource');
resources.forEach(res => {
  console.log({
    name: res.name,
    duration: res.duration,
    type: res.initiatorType,
  });
});

// Long Task 监听
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Long Task:', entry.duration, 'ms');
  }
}).observe({ entryTypes: ['longtask'] });
```

---

## 知识点掌握情况

| 知识点 | 掌握程度 |
|--------|----------|
| DNS 解析流程 | ✓ 已掌握 |
| TCP 三次握手 | ✓ 已掌握 |
| TLS 握手过程 | ✓ 已掌握 |
| HTTP/1.1 vs HTTP/2 vs HTTP/3 | ✓ 已掌握 |
| 关键渲染路径 | ✓ 已掌握 |
| JS 加载优化（async/defer） | ✓ 已掌握 |
| CSS 优化（关键 CSS 内联） | ✓ 已掌握 |
| 图片优化（懒加载/响应式） | ✓ 已掌握 |
| DOM 复杂度优化 | ✓ 已掌握 |
| 强制同步布局 | ✓ 已掌握 |
| CSS 合成层与 GPU 加速 | ✓ 已掌握 |
| Core Web Vitals | ✓ 已掌握 |
| Performance API | ✓ 已掌握 |

---

## 权威参考资料

| 主题 | 来源 | 链接 |
|------|------|------|
| Critical Rendering Path | Google Developers | https://developers.google.com/web/fundamentals/performance/critical-rendering-path |
| HTTP/3 Explained | Daniel Stenberg | https://http3-explained.haxx.se/ |
| Web Performance APIs | MDN | https://developer.mozilla.org/en-US/docs/Web/API/Performance |
| Core Web Vitals | Google | https://web.dev/vitals/ |

---

*记录时间：2026-03-10*
