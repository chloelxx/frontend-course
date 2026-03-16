# React Fiber 架构与 Hooks 原理源码实现 - 会话记录

**日期：** 2026-03-11
**主题：** React Fiber 架构 + Hooks 原理源码级实现
**类型：** 源码实现

---

## 📚 学习内容概述

基于之前学习的 React Fiber 和 Hooks 知识，从零实现一个简化版 React（Mini-React），深入理解核心机制。

---

## 🎯 核心讨论内容

### 一、Fiber 数据结构

```javascript
class FiberNode {
  // 组件信息
  type: string | Function,
  props: Object,
  key: string,

  // Fiber 链表结构
  return: FiberNode | null,     // 父节点
  child: FiberNode | null,      // 第一个子节点
  sibling: FiberNode | null,    // 下一个兄弟节点

  // DOM 节点
  stateNode: HTMLElement | null,

  // 双缓存
  alternate: FiberNode | null,

  // 副作用
  flags: number,
  nextEffect: FiberNode | null,

  // Hooks（函数组件）
  memoizedState: any,
  updateQueue: any,
}
```

### 二、双缓存机制

```
渲染前：
Current Tree:    WorkInProgress Tree:
    A                  null
   / \
  B   C

渲染中：
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

**优势：**
1. 可中断渲染
2. 批量更新
3. 无副作用
4. 原子更新

### 三、调度与渲染流程

```
Phase 1: Render（可中断）
├─ 从根 Fiber 开始遍历
├─ beginWork 构建 Fiber 树
└─ 产出：WIP Tree + Effect List

Phase 2: Commit（不可中断）
├─ before mutation
├─ mutation（修改 DOM）
└─ layout（调用 useEffect）

Phase 3: Idle
└─ 清理副作用
```

### 四、Hooks 实现

**useState 核心代码：**
```javascript
let hooks = [];
let hookIndex = 0;
let isMount = true;

function useState(initialState) {
  const index = hookIndex++;

  if (isMount) {
    // Mount：创建新 Hook
    const hook = {
      state: initialState,
      queue: [],
      next: null,
    };
    hooks.push(hook);
    return [hook.state, createDispatch(hook)];
  } else {
    // Update：获取已有 Hook
    const hook = hooks[index];
    hook.queue.forEach(update => {
      hook.state = typeof update === 'function' ? update(hook.state) : update;
    });
    hook.queue = [];
    return [hook.state, createDispatch(hook)];
  }
}
```

### 五、闭包陷阱根因

**问题代码：**
```javascript
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count);  // 永远是 0！
    }, 1000);
    return () => clearInterval(timer);
  }, []);  // 空依赖

  return <div>{count}</div>;
}
```

**根因：** useEffect 回调捕获了创建时的 count 值。

**解决方案：**
1. 函数式更新：`setCount(c => c + 1)`
2. 使用 ref：`useRef` 保存最新值
3. 添加正确依赖：`[count]`

---

## 📁 产出文件

### 1. Mini-React 源码
```
E:\frontend-course\projects\depth-1-framework-principle\mini-react\
├── src/
│   └── mini-react.js       # 核心实现（500+ 行代码）
└── example.html            # 使用示例（可运行）
```

**核心功能：**
- ✅ Fiber 数据结构
- ✅ 双缓存机制
- ✅ 调度器（workLoop）
- ✅ useState 实现
- ✅ useEffect 实现
- ✅ 基础 Diff 算法

### 2. 学习笔记
```
E:\frontend-course\principle-notes\react-in-depth\
└── fiber-and-hooks-principle.md
```

**内容：**
- Fiber 架构核心概念
- 双缓存机制
- 调度与渲染流程
- Hooks 实现原理
- 闭包陷阱根因分析
- Mini-React 实战代码

---

## 🧠 理解检查

### 问题 1：Fiber 的本质是什么？

**答案：**
- 数据结构：链表节点
- 设计模式：可中断渲染

### 问题 2：为什么 Hooks 不能条件调用？

**答案：** Hooks 通过索引访问，条件调用破坏索引顺序。

### 问题 3：双缓存的优势？

**答案：**
1. 可中断渲染（WIP 树可丢弃）
2. 批量更新（多次更新合并）
3. 无副作用（不影响当前 UI）
4. 原子更新（一次性提交）

### 问题 4：闭包陷阱的根因？

**答案：** useEffect 回调捕获创建时的值。

---

## 📊 学习成果

| 主题 | 掌握程度 |
|------|----------|
| Fiber 数据结构 | ✅ 理解链表结构 |
| 双缓存机制 | ✅ 理解切换指针原理 |
| 调度流程 | ✅ 理解 Render/Commit 阶段 |
| useState 实现 | ✅ 理解链表存储和队列更新 |
| useEffect 实现 | ✅ 理解依赖检查机制 |
| 闭包陷阱 | ✅ 理解根因和解决方案 |

---

## 🎯 后续行动

### 选项 A：继续 React 深度探索
- 实现 Diff 算法（key 的作用）
- 实现 Context 机制
- 实现 Suspense 并发渲染

### 选项 B：开始 Vue 3 原理对比
- 响应式系统（Proxy vs Virtual DOM）
- 编译时优化（Patch Flags）
- 设计哲学差异

---

**记录人：** AI Tutor
**审核状态：** 待用户确认
