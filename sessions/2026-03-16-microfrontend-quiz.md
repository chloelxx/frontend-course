# 微前端架构原理 - 苏格拉底式问答记录

**日期：** 2026-03-16
**主题：** 微前端架构原理、技术方案、核心问题
**类型：** 能力检测 + 原理探究
**教学方式：** 苏格拉底式提问（每次一个问题）

---

## 📊 问答概览

**总题数：** 6 题（+1 题 AI 补充）
**正确率：** 约 75%（B+ 水平）
**总评：** 🟢 **B+**（良好，核心理解到位，细节需加强）

---

## ❓ 问题 0：预习检查（微前端本质）

### 问题
微前端的本质是什么？它解决了什么核心问题？

### 用户回答
> 微前端的本质是将大型应用，跨模块，跨组织的应用用微前端分成多个子模块应用，相互独立运行，独立部署，独立开发。解决了内容项目技术栈不一致，团队难以合作沟通的问题。

### 点评
🟢 **A-**（核心理解正确！）

### AI 补充
**微前端核心价值：**
1. 技术栈无关——各团队可选择适合的技术
2. 独立开发——团队之间代码解耦
3. 独立部署——快速迭代，降低发布风险
4. 增量升级——老系统逐步迁移，不用重写

---

## ❓ 问题 1：技术方案对比

### 问题
微前端有哪些主流的技术实现方案？请列举至少 3 种，并说明每种方案的主要优缺点。

### 用户回答
> iframe 有点可以挂任何应用，不需要管理他们是怎么实现的，完全独立，主子应用通信不方便。
> webpack5 联邦模块使用的是联邦嵌入挂载，适用于小模块，小功能。
> qiankun 大型项目，项目独立开发，部署，运行。

### 点评
🟢 **B+**（理解了核心方案，细节需要补充）

### AI 补充解答

**微前端 4 种主流技术方案对比：**

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **iframe** | • 完全隔离（JS/CSS）<br>• 技术栈无关<br>• 接入简单 | • 通信复杂<br>• 性能开销大<br>• URL 状态管理困难<br>• 用户体验割裂 | 旧系统迁移、临时嵌入第三方应用 |
| **Web Components** | • 浏览器原生支持<br>• 真正的组件复用<br>• 技术栈无关 | • 兼容性需要考虑<br>• 样式隔离不彻底<br>• SEO 问题 | 组件库建设、跨框架复用 |
| **JS 沙箱（qiankun）** | • 体验流畅<br>• 样式隔离方案成熟<br>• 应用间通信方便 | • JS 沙箱有性能开销<br>• 需要子应用配合<br>• 接入成本较高 | 大型项目、长期维护的微前端平台 |
| **Module Federation** | • 原生模块共享<br>• 构建时优化<br>• 按需加载 | • 需要 Webpack 5+<br>• 配置复杂<br>• 版本管理需要注意 | 新项目、技术栈统一的团队 |

---

## ❓ 问题 2：微前端核心问题

### 问题
微前端的核心难点是什么？请从以下 4 个方面说明：
1. JS 沙箱隔离
2. 样式隔离
3. 应用通信
4. 依赖共享

### 用户回答
> 1. 使用 proxy 代理方式实现 js 沙箱隔离。
> 2. css 子应用不被影响大部分都应用在编译的时候加前缀，或者 scope css 实现。
> 3. 使用 event bus，或者路由参数，或者使用浏览器存储。
> 4. 主应用统一导入，或者使用 cdn，或者 webpack 模块联邦的 share 功能。

### 点评
🟢 **A-**（核心思路都正确！）

### AI 补充解答

**1. JS 沙箱隔离——qiankun Proxy 沙箱**
```javascript
const proxy = new Proxy(fakeWindow, {
  set: (target, key, value) => {
    target[key] = value;
    return true;
  },
  get: (target, key) => {
    return key in target ? target[key] : window[key];
  }
});
```

**2. 样式隔离方案**
| 方案 | 原理 | 优缺点 |
|------|------|--------|
| CSS 前缀 | 编译时加前缀 `.app1-button` | 简单，需构建配置 |
| Shadow DOM | 浏览器原生隔离 | 完全隔离，主题定制困难 |
| CSS Modules | 构建时生成唯一类名 | 完全隔离，需构建支持 |

**3. 应用通信方案**
- props 传递（父子通信）
- CustomEvent（任意通信）
- globalState（状态共享）
- localStorage（持久化数据）

**4. 依赖共享方案**
- External + CDN
- Module Federation（Webpack 5）
- DLL 预编译

---

## ❓ 问题 3：qiankun 沙箱原理

### 问题
qiankun 是如何实现 JS 沙箱的？
1. Proxy 沙箱如何捕获子应用对 window 的修改？
2. 子应用卸载时，如何还原对全局 window 的修改？
3. 如果多个相同子应用同时运行（多实例），如何解决？

### 用户回答
> qiankun 是使用 proxy 实现 js 沙箱隔离的。通过代理 fake windows，然后在目标 target windows 上去修改子应用。子应用卸载的时候恢复 fake windows。多个应用同时运行不影响。相当于多个 proxy windows 存在。

### 点评
🟡 **B+**（核心理解正确，细节需要补充）

### AI 补充解答（源码级分析）

**单实例沙箱（ProxySandbox）：**
```javascript
class ProxySandbox {
  constructor() {
    this.rawWindow = window;
    this.fakeWindow = Object.create(null);
    this.modifiedProps = new Map(); // 记录修改
    this.addedProps = new Set();    // 记录新增
  }

  createProxy() {
    return new Proxy(this.fakeWindow, {
      set: (target, key, value) => {
        if (key in this.rawWindow) {
          if (!this.modifiedProps.has(key)) {
            this.modifiedProps.set(key, this.rawWindow[key]);
          }
        } else {
          this.addedProps.add(key);
        }
        target[key] = value;
        return true;
      },
      get: (target, key) => {
        return key in target ? target[key] : this.rawWindow[key];
      }
    });
  }

  // 卸载时还原
  inactive() {
    this.addedProps.forEach(key => delete this.proxy[key]);
    this.modifiedProps.forEach((val, key) => {
      this.proxy[key] = val;
    });
  }
}
```

**多实例沙箱（LegacySandbox）：**
- 每个实例创建独立的 Proxy
- 直接代理真实 window，记录修改痕迹
- 卸载时根据记录还原

---

## ❓ 问题 4：样式隔离原理（AI 补充）

### 问题
qiankun 的两种样式隔离方案有什么区别？
1. `strictStyleIsolation` 使用什么方案？
2. `experimentalStyleIsolation` 使用什么方案？

### AI 解答

**方案 1：strictStyleIsolation（Shadow DOM）**
```javascript
registerMicroApps([...], {
  strictStyleIsolation: true,  // 使用 Shadow DOM
});
```
- 原理：Shadow DOM 创建独立样式作用域
- 优点：完全隔离
- 缺点：主题定制困难，第三方库兼容性问题

**方案 2：experimentalStyleIsolation（动态加前缀）**
```javascript
registerMicroApps([...], {
  experimentalStyleIsolation: true,  // 动态加 [data-qiankun] 前缀
});
```
- 原理：运行时给 CSS 选择器加 `[data-qiankun="app1"]` 前缀
- 优点：可外部覆盖，主题定制可行
- 缺点：不是完全隔离，运行时处理 CSS 有开销

---

## ❓ 问题 5：性能优化

### 问题
微前端架构中，首屏加载慢是常见问题。有哪些性能优化手段？
1. 预加载
2. 依赖共享
3. 按需加载
4. 缓存策略

### 用户回答
> 使用预加载，子应用中的 js、css 可以预加载。对于公共的组件，框架可以有主应用统一导入，子应用相互共享。子应用按需加载。使用缓存策略缓存子应用资源。

### 点评
🟢 **B+**（方向都正确，具体实现需要深入）

### AI 补充解答

**1. 预加载策略**
- 空闲时预加载（requestIdleCallback）
- 用户交互时预加载
- DNS 预解析 + preconnect

**2. 依赖共享**
- Webpack External + CDN
- Module Federation（singleton: true）
- DLL 预编译

**3. 按需加载**
- 路由懒加载
- 组件懒加载（Suspense + lazy）

**4. 缓存策略**
- HTTP 缓存头（no-cache / max-age）
- Service Worker 缓存

**性能优化总结：**
| 优化手段 | 预期效果 | 实施难度 |
|----------|----------|----------|
| 预加载 | 减少 30-50% 加载时间 | ⭐⭐ |
| 依赖共享 | 减少 200-500KB 体积 | ⭐⭐⭐ |
| 按需加载 | 减少 60-80% 初始加载 | ⭐⭐ |
| HTTP 缓存 | 二次访问秒开 | ⭐ |
| Service Worker | 离线可用 | ⭐⭐⭐ |

---

## ❓ 问题 6：架构选型（综合应用）

### 问题
假设您要为一个电商平台设计微前端架构：
- 团队规模：10 人前端团队，分为 3 个小组
- 现有系统：1 个老单体应用（jQuery + Bootstrap）
- 新需求：需要快速迭代新的营销活动页（React）
- 目标：3 个小组可以独立开发、独立部署

问题：
1. 您会选择哪种微前端技术方案？为什么？
2. 如何设计主应用和子应用的划分？
3. 老系统如何逐步迁移？

### 用户回答
> qiankun 微前端架构，因为她可以独立开发，独立部署，独立运行。主应用提供框架，架构。老系统如何逐步迁移不清楚。

### 点评
🟡 **B+**（技术选型正确，迁移策略需要补充）

### AI 补充解答

**1. 为什么选择 qiankun？**
| 方案 | 是否适合 | 原因 |
|------|----------|------|
| qiankun | ✅ 最佳 | 支持 jQuery 老应用 + React 新应用，技术栈无关 |
| iframe | ⚠️ 可用但体验差 | 通信复杂，用户体验割裂 |
| Module Federation | ❌ 不适合 | 老 jQuery 应用无法使用 |

**2. 主应用和子应用划分：**
```
主应用（React + qiankun）
├── 全局导航菜单
├── 用户登录/权限
├── 子应用路由分发
└── 公共依赖（React、antd）

子应用：
├── /home      → 首页子应用（React，组 A）
├── /product   → 商品子应用（React，组 B）
├── /activity  → 营销活动子应用（React，组 C，快速迭代）
└── /legacy    → 老系统子应用（jQuery，逐步迁移）
```

**3. 老系统渐进式迁移策略（4 个阶段）：**
```
阶段 1（1-2 周）：接入老系统
  → 将老系统作为子应用接入 qiankun
  → 老代码不做任何修改

阶段 2（2-4 周）：新旧并存
  → 新需求用 React 开发
  → 老系统保持不变

阶段 3（4-8 周）：逐步迁移
  → 按业务模块逐个迁移
  → 每迁移一个模块，老页面重定向到新子应用

阶段 4（8-12 周）：老系统下线
  → 所有功能迁移完成
  → 老系统服务器关闭
```

---

## 📊 总成绩

| 题号 | 主题 | 得分 |
|------|------|------|
| 0 | 微前端本质 | A- |
| 1 | 技术方案对比 | B+ |
| 2 | 核心问题 | A- |
| 3 | qiankun 沙箱原理 | B+ |
| 4 | 样式隔离原理 | AI 补充 |
| 5 | 性能优化 | B+ |
| 6 | 架构选型 | B+ |

**总评：** 🟢 **B+**（75% 正确率，良好）

---

## 💡 薄弱环节

1. **老系统迁移策略**：需要理解渐进式迁移的 4 个阶段
2. **样式隔离方案细节**：Shadow DOM vs 动态前缀
3. **qiankun 沙箱源码细节**：修改记录与还原机制

---

## 📚 建议复习

1. qiankun 官方文档：https://qiankun.umijs.org/
2. Module Federation 文档：https://webpack.js.org/concepts/module-federation/
3. 微前端架构设计实践案例

---

**记录人：** AI Tutor
**审核状态：** ✅ 待用户确认
**下次学习：** 待定
