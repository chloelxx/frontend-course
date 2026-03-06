# React Fiber 架构深度剖析

## 核心问题

**React 为什么要重构 Fiber 架构？Fiber 解决了什么本质问题？**

### 问题本质

React 15 及之前版本使用 **Stack Reconciler（栈协调器）**，采用同步递归遍历组件树。当组件树较大时，更新过程会长时间占用主线程，导致：

1. **页面掉帧卡顿**：无法在 16.67ms 内完成一帧
2. **用户交互无响应**：点击、滚动、输入无法及时响应
3. **动画卡顿**：CSS 动画和 JS 动画无法流畅执行

---

## 一、浏览器主线程模型

### 1.1 主线程任务队列

浏览器主线程是**单线程消息队列**，按顺序处理以下任务：

```
┌─────────────────────────────────────────────────────────────┐
│                    浏览器主线程任务队列                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. JavaScript 执行 (宏任务/微任务)                          │
│  2. 样式计算 (Recalc Style)                                 │
│  3. 布局 (Layout / Reflow)                                  │
│  4. 绘制 (Paint)                                            │
│  5. 合成 (Composite)                                        │
│  6. 用户输入事件处理                                         │
│  7. requestAnimationFrame 回调                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**关键约束**：同一时间只能执行一个任务，其他任务必须等待。

### 1.2 60FPS 的帧时间预算

```
目标帧率：60 FPS → 每帧时间预算：16.67ms

├──────────── 16.67ms ────────────├──────────── 16.67ms ────────────┤
│  JS   │ 样式  │ 布局  │ 绘制  │ 合成  │                           │
│  5ms  │ 3ms   │ 4ms   │ 3ms   │ 1.67ms│  空闲时间                │
└─────────────────────────────────┘
```

如果某一帧的任务超过 16.67ms，就会**掉帧**（视觉卡顿）。

### 1.3 React 15 的问题演示

```
组件树更新耗时 100ms：

帧 1: [───── React 渲染 100ms ─────]  ← 掉 4 帧
帧 2: [                             ]
帧 3: [                             ]
帧 4: [                             ]
帧 5: [       浏览器绘制            ]
```

**用户体验**：页面卡顿约 100ms，期间无法交互。

---

## 二、Stack Reconciler vs Fiber

### 2.1 Stack Reconciler（React 15）

```javascript
// React 15 同步递归更新（简化）
function mountComponent(parent, child) {
  // 同步递归，无法中断
  const rendered = child.render();

  // 递归子组件
  mountComponent(rendered, rendered.children);

  // 创建 DOM
  const dom = createDOM(rendered);
  parent.appendChild(dom);
}

// 调用
mountComponent(container, App);  // 一口气执行完，无法暂停
```

**问题**：
- 调用栈深度 = 组件树深度
- 执行过程无法中断，必须等递归返回
- 主线程被独占，其他任务无法执行

### 2.2 Fiber 架构（React 16+）

Fiber 将递归改为**可中断的链表遍历**：

```javascript
// Fiber 工作循环（简化）
function workLoop(deadline) {
  let shouldYield = false;

  while (workInProgress && !shouldYield) {
    // 执行一个 Fiber 节点的工作
    performUnitOfWork(workInProgress);

    // 移动到下一个 Fiber
    workInProgress = workInProgress.next;

    // 检查剩余时间
    shouldYield = deadline.timeRemaining() <= 0;
  }

  // 时间到了，让出主线程，调度到下一帧
  if (workInProgress) {
    requestIdleCallback(workLoop);
  } else {
    // 完成，进入 Commit 阶段
    commitRoot();
  }
}
```

**关键改进**：
- React 自己控制遍历节奏
- 可以在任意 Fiber 节点后暂停
- 将工作分散到多帧执行

---

## 三、Fiber 数据结构

### 3.1 Fiber 节点结构

```javascript
// ReactFiber.js 简化实现
function FiberNode(tag, pendingProps, key, mode) {
  // === 组件信息 ===
  this.tag = tag;           // 组件类型：函数/类/DOM 等
  this.key = key;
  this.type = null;         // 组件构造函数
  this.pendingProps = pendingProps;
  this.memoizedProps = null; // 上次渲染的 props

  // === 链表结构（核心！）===
  this.return = null;       // 父 Fiber
  this.child = null;        // 子 Fiber
  this.sibling = null;      // 兄弟 Fiber
  this.next = null;         // 下一个 Fiber（副作用链表）

  // === 状态和更新 ===
  this.memoizedState = null;  // 上次渲染的 state
  this.updateQueue = null;    // 更新队列

  // === 副作用 ===
  this.flags = 0;           // 标记需要执行的操作
  this.subtreeFlags = 0;    // 子树副作用

  // === 优先级 ===
  this.lanes = 0;           // 本次更新的优先级
  this.childLanes = 0;      // 子树的优先级
}
```

### 3.2 链表遍历方式

```
原始组件树：
        App
       /   \
   Header  Content
           /    \
        List   Footer

Fiber 链表结构：
App → Header → Content → List → Footer

遍历顺序（深度优先）：
1. App
2. Header
3. Header 的兄弟 → 无，返回
4. Content
5. List
6. Footer
```

### 3.3 遍历实现

```javascript
// 开始工作
function performUnitOfWork(workInProgress) {
  // 1. 执行当前 Fiber 的 render
  const next = beginWork(workInProgress);

  // 2. 有子节点，处理子节点
  if (next !== null) {
    return next;
  }

  // 3. 无子节点，向上或向兄弟
  let current = workInProgress;
  while (current !== null) {
    // 完成当前节点
    completeWork(current);

    // 有兄弟，处理兄弟
    if (current.sibling !== null) {
      return current.sibling;
    }

    // 无兄弟，继续向上
    current = current.return;
  }

  return null;  // 整棵树完成
}
```

---

## 四、双缓存机制（Double Buffering）

### 4.1 问题：渲染中断的视觉不一致

```
如果渲染可以中断，用户会看到什么？

组件树：
App
├── Header      (5ms)   ✓ 完成
├── Sidebar     (10ms)  ✓ 完成
├── Content     (50ms)  ⏸️ 中断（只渲染了一半）
└── Footer      ⏸️ 未开始

问题：用户看到的是旧 UI 还是部分新 UI？
```

### 4.2 解决方案：双缓存

```javascript
// 核心概念
const rootFiber = {
  current: null,           // 当前屏幕上显示的树
  workInProgress: null     // 正在构建的树（离屏）
};

// 更新流程
function scheduleUpdateOnFiber(root, fiber) {
  // 1. 创建 workInProgress 树（基于 current 树复制）
  const workInProgress = createWorkInProgress(fiber);

  // 2. 异步构建，可中断恢复
  //    这个过程用户看不到（离屏）
  performConcurrentWorkOnRoot(workInProgress);

  // 3. 完成后一次性提交
  commitRoot(workInProgress);

  // 4. 切换指针（用户看到完整更新）
  rootFiber.current = workInProgress;
}
```

### 4.3 视觉效果

```
时间线：

帧 1: [旧 UI] ─────┐
帧 2: [旧 UI]      │  用户始终看到完整、一致的 UI
帧 3: [旧 UI] ─────┤
帧 4: [新 UI]      │  瞬间切换（无中间状态）
```

### 4.4 源码位置

- `ReactFiber.js`: `createHostRootFiber` - 创建根 Fiber
- `ReactFiberWorkLoop.js`: `prepareFreshStack` - 准备新栈
- `ReactFiberCommitWork.js`: `commitRootImpl` - 提交根

---

## 五、Fiber 三阶段调度流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Fiber 工作循环                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ╔════════════════════════════════════════════════════╗    │
│  ║  1. Render 阶段（可中断，异步）                     ║    │
│  ║     └─ 构建 Fiber 树，计算差异                       ║    │
│  ║     └─ 时间用完就让出主线程                          ║    │
│  ║     └─ 生成副作用链表（effect list）                ║    │
│  ╚════════════════════════════════════════════════════╝    │
│                          ↓                                  │
│  ╔════════════════════════════════════════════════════╗    │
│  ║  2. Commit 阶段（同步，不可中断）                    ║    │
│  ║     └─ 将变更提交到 DOM                              ║    │
│  ║     └─ 必须同步保证 UI 一致性                        ║    │
│  ╚════════════════════════════════════════════════════╝    │
│                          ↓                                  │
│  ╔════════════════════════════════════════════════════╗    │
│  ║  3. Paint 阶段（浏览器执行）                         ║    │
│  ║     └─ 浏览器绘制到屏幕                              ║    │
│  ╚════════════════════════════════════════════════════╝    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.1 Render 阶段详解

```javascript
// Render 阶段：可中断的构建过程
function workLoopConcurrent(root, lanes) {
  prepareFreshStack(root, lanes);

  while (workInProgress !== null && !shouldYield()) {
    // 处理一个 Fiber 节点
    workInProgress = performUnitOfWork(workInProgress);
  }

  if (workInProgress !== null) {
    // 时间到了，未完成，调度到下一帧
    scheduleCallback(performConcurrentWorkOnRoot.bind(null, root));
    return;
  }

  // 完成，进入 Commit 阶段
  commitRoot(root);
}
```

### 5.2 Commit 阶段三步骤

```javascript
function commitRootImpl(root, recoverableErrors) {
  const finishedWork = root.finishedWork;

  // === 第一步：DOM 变更前 ===
  // 执行 getSnapshotBeforeUpdate、beforeUnmount
  commitBeforeMutationEffects(root, finishedWork);

  // === 第二步：执行 DOM 操作（核心）===
  // 增删改 DOM 节点
  commitMutationEffects(root, finishedWork, lanes);

  // === 第三步：DOM 变更后 ===
  // 执行 componentDidMount、componentDidUpdate
  // 执行 useLayoutEffect
  commitLayoutEffects(finishedWork, root, lanes);

  // 切换 current 指针
  root.current = finishedWork;
}
```

### 5.3 为什么 Commit 必须同步？

```
假设 Commit 也可中断：

帧 1: 删除旧节点 ✓
帧 2: ... 中断，用户看到空白
帧 3: 添加新节点 ✓

结果：用户看到中间状态（空白/部分 UI）

因此：Commit 阶段必须同步执行，保证 UI 一致性
```

---

## 六、Lane 优先级模型（React 18）

### 6.1 Lane 模型设计

React 18 使用**位运算**实现优先级：

```javascript
// ReactFiberLane.js 简化
const Lanes = {
  // 同步任务（最高优先级）
  SyncLane: 0b0000000000000000000000000000001,

  // 连续输入（高优先级）
  InputContinuousLane: 0b0000000000000000000000000000100,

  // 默认优先级
  DefaultLane: 0b0000000000000000000000000010000,

  // 过渡动画（低优先级）
  TransitionLane: 0b00000000000000000000001100000000,

  // 空闲任务（最低优先级）
  IdleLane: 0b01000000000000000000000000000000,

  // 隐藏内容
  OffscreenLane: 0b10000000000000000000000000000000,
};

// 优先级对比
SyncLane > InputContinuousLane > DefaultLane > TransitionLane > IdleLane
```

### 6.2 优先级应用场景

| 优先级 | 场景 | API 示例 |
|--------|------|----------|
| SyncLane | 同步任务 | `setState` 在事件中 |
| InputContinuousLane | 连续输入 | 滚动、拖拽、输入 |
| DefaultLane | 默认 | 数据获取后更新 |
| TransitionLane | 过渡动画 | `startTransition(() => update())` |
| IdleLane | 空闲任务 | 后台数据预加载 |

### 6.3 优先级调度示例

```javascript
// 高优先级任务可以打断低优先级任务

function handleClick() {
  // SyncLane - 立即执行
  setInputValue('a');
}

function fetchData() {
  // TransitionLane - 可中断
  startTransition(() => {
    setSearchResults(results);
  });
}

// 场景：用户快速输入时
// 1. 搜索结果更新（低优先级）开始渲染
// 2. 用户再次输入（高优先级）打断
// 3. 先处理输入，再继续渲染搜索结果
```

---

## 七、Fiber 的代价与权衡

| 优势 | 代价/权衡 |
|------|----------|
| 可中断渲染，避免长任务 | 内存占用增加（存储两棵 Fiber 树） |
| 优先级调度，响应更快 | 实现复杂度大幅增加 |
| 并发渲染能力 | 需要处理部分树过期问题 |
| 更好的用户体验 | 调试难度增加 |
| 支持并发特性（Suspense） | Render 阶段可能被多次执行 |

### 7.1 内存代价

```
双缓存机制 = 两棵完整的 Fiber 树

current 树：显示在屏幕上
workInProgress 树：正在构建

内存占用 ≈ 组件数量 × Fiber 节点大小
```

### 7.2 实现复杂度

```
React 15 Stack Reconciler：~1000 行
React 16+ Fiber：~3000 行

需要处理的问题：
- 中断后如何恢复
- 如何合并多次更新
- 如何处理过期任务
- 如何保证数据一致性
```

---

## 八、工程应用

### 8.1 使用 startTransition 优化体验

```javascript
// 场景：搜索框输入
function SearchBox() {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  function handleInput(e) {
    const value = e.target.value;

    // 高优先级：立即更新输入框
    setInputValue(value);

    // 低优先级：搜索结果的渲染可以等待
    startTransition(() => {
      const results = search(value);
      setSearchResults(results);
    });
  }

  return (
    <input value={inputValue} onChange={handleInput} />
  );
}
```

### 8.2 使用 Suspense 优化加载体验

```javascript
// 场景：懒加载组件
function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### 8.3 调试技巧

```javascript
// 开启 Fiber 调试
// React DevTools → Profiler → 记录

// 观察：
// 1. 哪些组件渲染时间长
// 2. 是否有不必要的重渲染
// 3. 优先级是否正确

// 性能 API 监控
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'longtask') {
      console.log('长任务:', entry.duration, 'ms');
    }
  }
});
observer.observe({ entryTypes: ['longtask'] });
```

---

## 九、理解检查清单

- [ ] 能解释为什么递归无法中断，而链表可以？
- [ ] 能手绘 Fiber 链表结构图（return/child/sibling）？
- [ ] 理解双缓存机制如何解决视觉不一致问题？
- [ ] 能说明 Render 和 Commit 阶段的区别？
- [ ] 理解 Lane 优先级模型的应用场景？
- [ ] 能说明 Fiber 的代价和权衡吗？

---

## 十、扩展阅读

- [React 官方源码 - ReactFiber.js](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiber.js)
- [React 官方源码 - ReactFiberWorkLoop.js](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js)
- [React 官方源码 - ReactFiberLane.js](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberLane.js)
- [Inside Fiber: in-depth overview of the new reconciliation algorithm in React](https://indepth.dev/posts/1009/inside-fiber)
- [React 18 并发特性官方文档](https://react.dev/blog/2022/03/29/react-v18)

---

## 附录：关键源码片段

### A.1 workLoop 实现

```javascript
// ReactFiberWorkLoop.js
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}
```

### A.2 shouldYield 实现

```javascript
// Scheduler.js
function shouldYield() {
  const currentTime = exports.unstable_now();
  const timeRemaining = deadline - currentTime;

  // 剩余时间不足 5ms，让出主线程
  return timeRemaining <= 5;
}
```

### A.3 调度回调

```javascript
// Scheduler.js
exports.unstable_scheduleCallback = function(priorityLevel, callback) {
  const currentTime = exports.unstable_now();
  let timeout;

  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = -1;
      break;
    case UserBlockingPriority:
      timeout = 250;
      break;
    case NormalPriority:
      timeout = 5000;
      break;
    case LowPriority:
      timeout = 10000;
      break;
    case IdlePriority:
      timeout = 1073741823;
      break;
  }

  const expirationTime = currentTime + timeout;

  // 加入任务队列
  pushTask({ callback, expirationTime });

  // 调度执行
  requestHostCallback(flushWork);
};
```

---

*最后更新：2026-03-03*
