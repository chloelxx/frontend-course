# 微前端架构学习记录

**日期**: 2026-03-10
**主题**: 微前端架构深度剖析
**类型**: 原理探究

---

## 第一部分：微前端核心概念

### 问题 1：什么是微前端？

**题目**：请描述微前端架构的核心概念，它要解决什么问题？

**学员回答**：
- 微前端的核心概念是将大型应用拆分成小的应用
- 他们可以独立部署、独立应用、独立开发、独立运行
- 主要是解决大项目中各个业务并存的问题

**导师评价**：✓ 基本正确

**微前端要解决的核心痛点**：

1. **巨石应用困境（Monolithic Frontend）**
   - 应用越来越大，代码库臃肿
   - 多个团队修改同一代码库，冲突频繁
   - 构建速度越来越慢
   - 技术栈无法升级（牵一发而动全身）

2. **多业务线并存问题**
   - 不同业务线开发节奏不同
   - 强行业务耦合导致发布互相阻塞
   - 无法独立回滚某个业务

3. **技术栈历史包袱**
   - 老项目用 jQuery/AngularJS
   - 新功能想用 React/Vue
   - 无法渐进式迁移

**微前端架构示意**：
```
┌─────────────────────────────────────────────────────────────┐
│                      宿主应用（基座）                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  微前端 A   │  │  微前端 B   │  │  微前端 C   │          │
│  │  (商品模块)  │  │  (订单模块)  │  │  (用户模块)  │          │
│  │  Vue 2      │  │  React 18   │  │  Vue 3      │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## 第二部分：微前端实现方案

### 问题 2：微前端的实现方案

**题目**：您了解哪些微前端实现方案？它们的核心原理是什么？

**学员回答**：
- 微前端的实现方案有 qiankun、webpack5 的联邦模块、single-spa
- 他们的核心原理都是 JS 沙箱隔离、CSS 沙箱隔离

**导师评价**：✓ 正确

**主流方案对比**：

### 1. Single-SPA（最早期的微前端框架）

**核心原理**：路由劫持 + 应用生命周期管理

```javascript
import { registerApplication, start } from 'single-spa';

registerApplication({
  name: 'app1',
  activeWhen: '/app1',
  app: {
    async bootstrap() { /* 初始化 */ },
    async mount(props) { /* 挂载 */ },
    async unmount(props) { /* 卸载 */ }
  }
});

start();
```

**优缺点**：
- ✓ 优点：简单灵活，无框架限制
- ✗ 缺点：需要手动处理沙箱、样式隔离、JS 沙箱

---

### 2. qiankun（基于 Single-SPA 增强）

**核心原理**：在 Single-SPA 基础上增加了沙箱隔离

**JS 沙箱实现**：
```javascript
class Sandbox {
  constructor() {
    this.proxy = new Proxy(window, {
      set: (target, key, value) => {
        this.modifiedProps.set(key, value);
        return Reflect.set(target, key, value);
      },
      get: (target, key) => {
        return Reflect.get(target, key);
      }
    });
  }

  inactive() {
    this.modifiedProps.forEach((value, key) => {
      delete window[key];
    });
  }
}
```

**CSS 沙箱实现**：
```css
/* 样式隔离 - 添加 scope 前缀 */
.app1-container .button { }
/* 编译后变成 */
[data-app-name="app1"] .button { }
```

---

### 3. Webpack 5 Module Federation（模块联邦）

**核心原理**：运行时动态共享模块

```javascript
// Webpack 配置 - 主机应用
new ModuleFederationPlugin({
  name: 'host',
  remotes: {
    app1: 'app1@http://localhost:3001/remoteEntry.js'
  },
  shared: ['react', 'react-dom']
});

// 使用时
import App1 from 'app1/Header';
```

**与 qiankun 的区别**：
| 特性 | qiankun | Module Federation |
|------|---------|-------------------|
| 集成方式 | 路由 | 模块导入 |
| 技术栈 | 完全隔离 | 需共享依赖版本 |
| 通信 | custom events | 直接 import |
| 构建工具 | 无关 | 需 Webpack 5 |

---

### 4. iframe 方案（最传统）

**优缺点**：
- ✓ 优点：天然隔离（JS/CSS/全局变量）
- ✗ 缺点：URL 不同步、通信复杂、性能差、SEO 不友好

---

## 第三部分：微前端的挑战

### 问题 3：微前端的挑战

**题目**：您认为微前端架构会带来哪些新的问题和挑战？

**学员回答**：
- 应用太大可能会导致某些应用冲突
- 全局事件管理复杂
- 性能差

**导师评价**：✓ 基本正确

**完整挑战与解决方案**：

### 1. 全局状态冲突

**问题**：
```javascript
// 微前端 A
window.API_BASE_URL = 'https://api-a.com';

// 微前端 B（后加载，覆盖了 A 的配置）
window.API_BASE_URL = 'https://api-b.com';
```

**解决方案**：
```javascript
// 命名空间隔离
window.__MICRO_APP_A__ = { API_BASE_URL: '...' };
window.__MICRO_APP_B__ = { API_BASE_URL: '...' };

// 使用 CustomEvent 通信
window.dispatchEvent(new CustomEvent('APP_EVENT', { detail: data }));
```

---

### 2. 样式污染

**解决方案对比**：
| 方案 | 实现方式 | 优点 | 缺点 |
|------|----------|------|------|
| BEM 命名 | `.app1__button` | 简单 | 靠约定 |
| CSS Modules | `._button_x7z9a` | 自动隔离 | 需构建支持 |
| Shadow DOM | 真正的 DOM 隔离 | 完全隔离 | 兼容性问题 |
| CSS-in-JS | styled-components | 灵活 | 运行时开销 |
| Scope 前缀 | `[data-app="app1"]` | 运行时注入 | 需框架支持 |

---

### 3. 依赖重复/版本冲突

**问题**：
```
微前端 A: React 16.8
微前端 B: React 18.2
```

**解决方案**：
```javascript
// Module Federation 共享依赖配置
shared: {
  react: {
    singleton: true,    // 强制单例
    requiredVersion: '^18.0.0',
    eager: true         // 预加载
  }
}
```

---

### 4. 性能问题

**性能瓶颈**：
- 5 份 React/Vue 运行时 = 200KB × 5
- 5 次 HTTP 请求（串行）
- 5 次 JS 解析/执行
- 沙箱切换开销

**优化方案**：
```javascript
// 1. 公共依赖提取
externals: {
  react: 'React',
  'react-dom': 'ReactDOM'
}

// 2. 预加载策略
link rel="prefetch" href="/app2/remoteEntry.js"

// 3. 按需加载
const App1 = lazy(() => import('app1/App'));
```

---

### 5. 应用间通信

**通信方案对比**：
| 方案 | 适用场景 | 优点 | 缺点 |
|------|----------|------|------|
| CustomEvent | 任意应用间 | 解耦 | 类型不安全 |
| Props 传递 | 父子组件式 | 简单 | 只能向下传递 |
| URL 参数 | 路由跳转 | 可分享 | 数据量有限 |
| localStorage | 持久化状态 | 跨域支持 | 同步、容量限制 |
| 状态管理库 | 复杂状态 | 类型安全 | 需共享依赖 |
| postMessage | iframe 场景 | 跨域安全 | API 繁琐 |

---

## 第四部分：微前端 vs Monorepo

### 问题 4：微前端 vs Monorepo

**题目**：什么情况下应该选择 Monorepo 而不是微前端？两者的本质区别是什么？

**学员回答**：
- Monorepo 是单仓库多包，代码可以复用，原子化提交，追求开发体验
- 微前端是大应用分为多个子应用，独立部署，独立运行，独立开发
- 本质区别是人和项目之前的关系应该怎么管理

**导师评价**：✓ 完全正确

**完整对比**：

```
┌─────────────────────────────────────────────────────────────┐
│  Monorepo                    微前端                          │
│  ─────────                   ────────                       │
│  代码组织方式                应用架构方式                    │
│  （开发阶段）                （运行阶段）                    │
│                                                             │
│  解决：代码复用              解决：部署解耦                  │
│        依赖管理                      技术栈隔离              │
│        统一规范                      团队自治                │
│                                                             │
│  ✅ 可以和微前端组合使用！                                   │
└─────────────────────────────────────────────────────────────┘
```

**决策矩阵**：
| 维度 | 单体应用 | Monorepo | 微前端 |
|------|----------|----------|--------|
| 团队规模 | < 10 人 | 10-50 人 | 50+ 人 |
| 代码复用 | 低 | 高 | 中 |
| 部署独立性 | 无 | 无 | 高 |
| 技术栈隔离 | 无 | 无 | 高 |
| 开发体验 | 简单 | 中等 | 复杂 |
| 运维成本 | 低 | 低 | 高 |

---

## 知识点掌握情况

| 知识点 | 掌握程度 |
|--------|----------|
| 微前端核心概念 | ✓ 已掌握 |
| Single-SPA 原理 | ✓ 已掌握 |
| qiankun 沙箱机制 | ✓ 已掌握 |
| Module Federation | ✓ 已掌握 |
| 样式隔离方案 | ✓ 已掌握 |
| 依赖共享策略 | ✓ 已掌握 |
| 微前端挑战与优化 | ✓ 已掌握 |
| Monorepo vs 微前端 | ✓ 已掌握 |

---

## 权威参考资料

| 主题 | 来源 | 链接 |
|------|------|------|
| Micro Frontends | Martin Fowler | https://martinfowler.com/articles/micro-frontends.html |
| Module Federation | Zack Jackson | https://module-federation.github.io/ |
| qiankun 原理 | 蚂蚁金服 | https://qiankun.umijs.org/ |
| Monorepo 最佳实践 | Nx | https://nx.dev/more-concepts/monorepo-nx-and-enterprise |

---

*记录时间：2026-03-10*
