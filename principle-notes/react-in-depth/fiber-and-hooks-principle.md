# React Fiber 架构与 Hooks 原理 - 深度学习笔记

> 基于源码级分析，从实现角度理解 React 设计思想

---

## 目录

1. [Fiber 架构核心概念](#1-fiber-架构核心概念)
2. [双缓存机制](#2-双缓存机制)
3. [调度与渲染流程](#3-调度与渲染流程)
4. [Hooks 实现原理](#4-hooks-实现原理)
5. [闭包陷阱根因分析](#5-闭包陷阱根因分析)
6. [实战：实现 Mini-React](#6-实战实现 mini-react)

---

## 1. Fiber 架构核心概念

### 1.1 为什么需要 Fiber？

**问题背景：** React 15 及之前的 Stack Reconciler 是同步递归的。

```
React 15 渲染流程：
Parent Component
  → Child Component 1
    → GrandChild 1
    → GrandChild 2
  → Child Component 2
    → ...

问题：整个过程是同步的，无法中断！
```

**带来的问题：**
- 大型组件树渲染时，主线程被长时间占用
- 无法响应用户输入（点击、滚动等）
- 导致掉帧、卡顿

**解决方案：** 将同步渲染改为**可中断的异步渲染**

### 1.2 Fiber 的数据结构

Fiber 是一个链表结构，每个节点代表一个组件：

```javascript
class FiberNode {
  // 组件信息
  type: string | Function,      // 组件类型
  props: Object,                // 属性
  key: string,                  // key

  // Fiber 链表结构
  return: FiberNode | null,     // 父节点
  child: FiberNode | null,      // 第一个子节点
  sibling: FiberNode | null,    // 下一个兄弟节点

  // DOM 节点
  stateNode: HTMLElement | null,

  // 双缓存
  alternate: FiberNode | null,  // 指向另一个 Fiber

  // 副作用
  flags: number,                // 副作用标记
  nextEffect: FiberNode | null, // 下一个有副作用的 Fiber

  // Hooks（函数组件）
  memoizedState: any,           // Hooks 链表头
  updateQueue: any,             // 更新队列
}
```

### 1.3 Fiber 链表 vs 树形结构

**React 15 的树形结构：**
```
        Parent
       /   \
     C1     C2
    / \     |
  GC1 GC2  GC3

递归遍历：深度优先，无法中断
```

**React 16+ 的 Fiber 链表：**
```
        Parent
         ↓
        C1 → C2
         ↓    ↓
       GC1   GC3
         ↓
       GC2

遍历：链表遍历，可以随时中断
```

---

## 2. 双缓存机制

### 2.1 什么是双缓存？

React 维护两棵 Fiber 树：
- **Current Tree**：当前屏幕上显示的 Fiber 树
- **WorkInProgress Tree**：正在构建的新 Fiber 树

```
渲染前：
Current Tree:    WorkInProgress Tree:
    A                  null
   / \
  B   C

渲染中（构建 WIP 树）：
Current Tree:    WorkInProgress Tree:
    A                  A'
   / \                / \
  B   C              B'  C'

渲染完成（切换指针）：
Current Tree:    WorkInProgress Tree:
    A'                 null
   / \
  B'  C'
```

### 2.2 双缓存的代码实现

```javascript
// 创建 WorkInProgress
function createWorkInProgress(current) {
  let wip = current.alternate;

  if (wip === null) {
    // 首次创建
    wip = createFiber(current.type, current.props, current.key);
    wip.alternate = current;
    current.alternate = wip;
  } else {
    // 复用已有 Fiber，重置属性
    wip.props = current.props;
    wip.flags = 0;
    wip.subtreeFlags = 0;
    wip.deletions = null;
  }

  return wip;
}

// 切换根节点
function commitRoot() {
  // ...提交变更

  // 交换 current 和 workInProgress
  const root = workInProgressRoot;
  const finishedWork = root.alternate;
  root.current = finishedWork;
  finishedWork.alternate = null;
}
```

### 2.3 双缓存的优势

1. **可中断渲染**：WIP 树可以随时丢弃重建
2. **批量更新**：多次更新可以合并到 WIP 树
3. **无副作用**：渲染过程中不影响当前 UI

---

## 3. 调度与渲染流程

### 3.1 三阶段流程

```
┌─────────────────────────────────────────────────────────────┐
│                    React 渲染流程                            │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: Render（渲染阶段）                                 │
│  ├─ 从根 Fiber 开始遍历                                       │
│  ├─ 调用 beginWork 构建 Fiber 树                             │
│  ├─ 可中断（让出主线程）                                      │
│  └─ 产出：WorkInProgress Tree + Effect List                 │
├─────────────────────────────────────────────────────────────┤
│  Phase 2: Commit（提交阶段）                                 │
│  ├─ 不可中断（必须同步完成）                                  │
│  ├─ before mutation：读取 DOM                               │
│  ├─ mutation：修改 DOM                                       │
│  └─ layout：调用 useEffect、useLayoutEffect                 │
├─────────────────────────────────────────────────────────────┤
│  Phase 3: Idle（空闲阶段）                                   │
│  ├─ 清理副作用                                                 │
│  └─ 准备下一次渲染                                            │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Render 阶段核心代码

```javascript
// 工作循环
function workLoop() {
  while (workInProgress !== null && !shouldYield()) {
    workInProgress = performUnitOfWork(workInProgress);
  }

  if (workInProgress !== null) {
    // 被中断，调度下次继续
    scheduleWorkLoop();
  } else {
    // 完成，进入 Commit 阶段
    commitRoot();
  }
}

// 执行单个 Fiber 单元
function performUnitOfWork(fiber) {
  // 1. 开始工作（处理当前 Fiber）
  const next = beginWork(fiber);

  if (next) {
    return next; // 继续处理子节点
  }

  // 2. 完成工作（处理兄弟节点）
  let complete = fiber;
  while (complete) {
    completeUnitOfWork(complete);
    const nextSibling = complete.sibling;
    if (nextSibling) {
      return nextSibling;
    }
    complete = complete.return;
  }

  return null; // 完成整棵树
}
```

### 3.3 Lane 优先级模型

React 18 使用 Lane 模型管理优先级：

```javascript
// Lane 优先级（位运算）
const NoLanes = 0b000;
const SyncLane = 0b001;           // 同步（点击、输入）
const InputContinuousLane = 0b010; // 连续输入（滚动）
const DefaultLane = 0b100;        // 默认
const TransitionLane = 0b1000;    // 过渡动画
const IdleLane = 0b10000;         // 空闲

// 优先级比较
function includes(a, b) {
  return (a & b) === b;
}

// 高优先级可以打断低优先级
function shouldYield() {
  const currentTime = requestCurrentTime();
  return currentTime > expirationTime;
}
```

---

## 4. Hooks 实现原理

### 4.1 Hooks 链表结构

每个函数组件的 Hooks 组成一个链表：

```
FunctionComponent
    ↓
FiberNode.memoizedState (Hook 1)
    ↓
  next (Hook 2)
    ↓
  next (Hook 3)
    ↓
  null
```

### 4.2 useState 实现

```javascript
// 简化版实现
let hooks = [];
let hookIndex = 0;
let isMount = true;

function useState(initialState) {
  const index = hookIndex++;

  if (isMount) {
    // Mount：创建新 Hook
    const hook = {
      state: initialState,
      queue: [],  // 更新队列
      next: null, // 指向下一个 Hook
    };

    if (hooks.length === 0) {
      hooks[0] = hook;
    } else {
      const prevHook = hooks[index - 1];
      prevHook.next = hook;
    }
    hooks.push(hook);

    return [hook.state, createDispatch(hook)];
  } else {
    // Update：获取已有 Hook
    const hook = hooks[index];

    // 处理队列中的更新
    hook.queue.forEach(update => {
      hook.state = typeof update === 'function'
        ? update(hook.state)
        : update;
    });
    hook.queue = [];

    return [hook.state, createDispatch(hook)];
  }
}

function createDispatch(hook) {
  return function dispatch(update) {
    hook.queue.push(update);
    isMount = false;
    // 触发重新渲染
    scheduleUpdate();
  };
}
```

### 4.3 useEffect 实现

```javascript
function useEffect(effect, deps) {
  const index = hookIndex++;

  if (isMount) {
    // Mount：创建 Hook，执行 effect
    const hook = {
      effect,
      deps,
      cleanup: null,
      next: null,
    };
    hooks.push(hook);
    setTimeout(effect, 0); // 异步执行
  } else {
    // Update：依赖变化时执行
    const hook = hooks[index];
    const depsChanged = !deps || deps.some((d, i) => d !== hook.deps[i]);

    if (depsChanged) {
      // 执行清理
      if (hook.cleanup) {
        hook.cleanup();
      }
      // 执行新 effect
      hook.effect = effect;
      hook.deps = deps;
      setTimeout(effect, 0);
    }
  }
}
```

---

## 5. 闭包陷阱根因分析

### 5.1 什么是闭包陷阱？

```javascript
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count);  // 闭包陷阱：永远是 0
    }, 1000);
    return () => clearInterval(timer);
  }, []);  // 空依赖数组

  return <div>{count}</div>;
}
```

### 5.2 闭包陷阱的根因

**原因：** useEffect 的回调函数捕获了**创建时的 count 值**。

```
Render 1: count = 0
  → useEffect 回调捕获 count = 0
  → deps = []，不再重新执行

Render 2: count = 1
  → useEffect 不重新执行，回调仍是旧的

Render 3: count = 2
  → useEffect 不重新执行，回调仍是旧的
```

### 5.3 解决方案

**方案 1：使用函数式更新**

```javascript
useEffect(() => {
  const timer = setInterval(() => {
    setCount(c => c + 1);  // 函数式更新，不依赖 count
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

**方案 2：使用 ref 保存最新值**

```javascript
function Counter() {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  useEffect(() => {
    countRef.current = count;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(countRef.current);  // 总是最新值
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return <div>{count}</div>;
}
```

**方案 3：添加正确的依赖**

```javascript
useEffect(() => {
  const timer = setInterval(() => {
    console.log(count);
  }, 1000);
  return () => clearInterval(timer);
}, [count]);  // count 变化时重新执行
```

---

## 6. 实战：实现 Mini-React

### 6.1 项目结构

```
mini-react/
├── src/
│   ├── mini-react.js     # 核心实现
│   └── index.js          # 导出 API
├── example.html           # 使用示例
└── README.md
```

### 6.2 核心 API

```javascript
const MiniReact = {
  // 创建元素
  createElement(type, props, ...children),

  // 渲染到容器
  render(element, container),

  // Hooks
  useState(initialState),
  useEffect(effect, deps),
};
```

### 6.3 使用示例

```javascript
import { MiniReact } from './mini-react';

function Counter() {
  const [count, setCount] = MiniReact.useState(0);

  MiniReact.useEffect(() => {
    console.log('count changed:', count);
  }, [count]);

  return MiniReact.createElement('div', null,
    MiniReact.createElement('span', null, count),
    MiniReact.createElement('button', {
      onClick: () => setCount(c => c + 1)
    }, '+')
  );
}

MiniReact.render(Counter, document.getElementById('root'));
```

---

## 7. 关键问题理解检查

### 问题 1：Fiber 链表如何解决卡顿问题？

<details>
<summary>点击查看答案</summary>

**答案：** Fiber 链表将渲染过程拆分为多个小任务，每个任务处理一个 Fiber 节点。

```javascript
function workLoop() {
  while (workInProgress !== null && !shouldYield()) {
    // 每次只处理一个 Fiber
    workInProgress = performUnitOfWork(workInProgress);
  }

  if (workInProgress !== null) {
    // 需要让出主线程，调度下次继续
    scheduleWorkLoop();
  }
}
```

**关键：** `shouldYield()` 检查是否需要让出主线程，将大任务拆分为小任务。
</details>

### 问题 2：为什么 Hooks 不能条件调用？

<details>
<summary>点击查看答案</summary>

**答案：** Hooks 通过数组索引访问，条件调用会破坏索引顺序。

```javascript
// 正确：顺序固定
function Component() {
  const [a] = useState(0);  // index 0
  const [b] = useState(0);  // index 1
}

// 错误：条件调用破坏顺序
function Component() {
  if (condition) {
    const [a] = useState(0);  // index 0（有时存在）
  }
  const [b] = useState(0);     // index 1 或 0？不确定！
}
```

**根因：** Update 阶段依赖**固定顺序**来遍历 Hooks 链表。
</details>

### 问题 3：双缓存机制的优势是什么？

<details>
<summary>点击查看答案</summary>

**答案：**

1. **可中断渲染**：WIP 树可以随时丢弃重建
2. **批量更新**：多次状态更新合并到 WIP 树
3. **无副作用**：渲染过程不影响当前 UI
4. **原子更新**：Commit 阶段一次性提交所有变更
</details>

---

## 8. 下一步学习

1. **实现 Diff 算法**：理解 key 的作用、最长递增子序列优化
2. **实现调度器**：理解 Lane 优先级、时间切片
3. **实现 Context**：理解 Context 传播机制
4. **实现 Suspense**：理解并发渲染、延迟加载

---

## 参考资源

- [React Fiber 架构](https://github.com/acdlite/react-fiber-architecture)
- [React 源码](https://github.com/facebook/react)
- [Build your own React](https://pomb.us/build-your-own-react/)
