# React Hooks 实现原理问答记录

**日期**: 2026-03-04
**主题**: React Hooks 实现原理深度剖析
**类型**: 原理探究

---

## 问答 1：Hook 状态存储机制

### 导师提问

**你能猜一下 React 内部是如何存储多个 Hook 的状态的吗？**

背景知识：
- 一个组件中可以调用多个 `useState`、`useEffect`
- 每次渲染时，React 需要知道每个 Hook 对应的状态
- 函数组件每次渲染都是新的函数调用，局部变量会重置

**问题**：
1. React 用什么数据结构存储多个 Hook 的状态？
2. 为什么 Hook 必须按顺序调用（不能条件调用）？
3. `useState(0)` 返回的 `[state, setState]`，React 如何知道对应的是第几个 useState？

### 学员回答

- React 用链表存储多个 hook 状态
- 因为 react 的组件中的状态和每一个 hook 节点一一对应，如果放在条件语句中就会导致渲染异常
- react 中有一个全局状态会记录当前 hook 是第一个 useState

### 导师解答

**1. Hook 节点结构**

```javascript
Hook 节点 = {
  memoizedState: any,     // 当前状态值
  queue: UpdateQueue,     // 更新队列
  next: Hook | null,      // 指向下一个 Hook
  baseState: any,         // 基础状态
  baseQueue: Update,      // 基础更新队列
}
```

**2. 链表存储示意**

```
fiber.memoizedState (Hook 链表头)
    ↓
┌─────────────────────────┐
│ memoizedState: 0        │  ← Hook 0 (useState count)
│ queue: {...}            │
│ next: ──────────────────┼──→
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ memoizedState: ''       │  ← Hook 1 (useState name)
│ queue: {...}            │
│ next: ──────────────────┼──→
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ memoizedState: {...}    │  ← Hook 2 (useEffect)
│ queue: null             │
│ next: null              │  ← 链表结束
```

**3. 全局游标变量**

```javascript
// ReactFiberHooks.js 核心全局变量
let workInProgressHook = null;  // 当前正在处理的 Hook 节点（游标）
let firstWorkInProgressHook = null;  // 当前组件的第一个 Hook
let currentlyRenderingFiber = null;  // 当前正在处理的 Fiber 节点
```

**4. Mount 阶段（首次渲染）**

```javascript
function mountState(initialState) {
  // 1. 创建新的 Hook 节点
  const hook = {
    memoizedState: initialState,
    queue: [],
    next: null
  };

  // 2. 链接到链表
  if (!firstWorkInProgressHook) {
    firstWorkInProgressHook = workInProgressHook = hook;
  } else {
    workInProgressHook = workInProgressHook.next = hook;
  }

  return [hook.memoizedState, dispatchAction];
}
```

**5. Update 阶段（更新渲染）**

```javascript
function updateState(initialState) {
  // 1. 从链表获取当前 Hook（按顺序）
  workInProgressHook = workInProgressHook.next;

  // 2. 复用之前的状态
  const hook = workInProgressHook;

  return [hook.memoizedState, dispatchAction];
}
```

---

## 问答 2：条件调用 Hooks 问题

### 导师提问

**为什么不能条件调用 Hooks？**

### 学员回答

条件 hooks 会导致渲染异常，是因为 react 组件在渲染的时候会把第一次的 setstate 状态记录到 hooks 链表中，后面每一次的渲染都会根据之前第一次的链表结构和当前状态去匹配，如果放在条状调用，就会导致没法一一对应，会导致状态错位。

### 导师解答

**问题演示**

```javascript
// 错误示例
function BrokenComponent({ condition }) {
  if (condition) {
    const [state1, setState1] = useState(0);  // Hook 索引 0
  }
  const [state2, setState2] = useState(1);    // Hook 索引 1 或 0？
}
```

**第一次渲染（condition = true）**
```
Hook 链表：Hook0 (useState) → Hook1 (useState)
```

**第二次渲染（condition = false）**
```
Hook 链表（复用）：Hook0 (useState) → Hook1 (useState)

遍历过程：
1. if(condition) 为 false → 跳过，workInProgressHook 不动
2. 第二个 useState → 获取 Hook0.next = Hook1

问题：state2 获取的是 Hook1 的状态，完全错位！
```

**正确做法**
```javascript
function WorkingComponent({ condition }) {
  const [state1, setState1] = useState(0);  // 永远第一个
  const [state2, setState2] = useState(1);  // 永远第二个

  // 条件逻辑写在 Hook 内部
  if (condition) {
    // 使用 state1
  }
}
```

---

## 问答 3：闭包陷阱

### 导师提问

**闭包陷阱的根本原因是什么？**

### 学员回答

闭包陷阱的根本原因是因为函数式编程结构保存的是前变量的快照。

### 导师解答

**现象演示**
```javascript
function Counter() {
  const [count, setCount] = useState(0);

  function handleAlert() {
    setTimeout(() => {
      alert(count);  // 总是弹出旧值
    }, 3000);
  }

  return <button onClick={handleAlert}>Alert</button>;
}
```

**根因分析**
```
每次渲染都有独立的闭包：

渲染 1: count = 0, handleAlert 闭包捕获 count=0
渲染 2: count = 1, handleAlert 闭包捕获 count=1
渲染 3: count = 2, handleAlert 闭包捕获 count=2
渲染 4: count = 3, handleAlert 闭包捕获 count=3

点击 Alert 时：
- 执行的是渲染 1 时的 handleAlert
- 闭包捕获的是渲染 1 时的 count=0
- 3 秒后 alert(0)
```

**解决方案**

1. **使用函数式更新**
   ```javascript
   setCount(c => c + 1);
   ```

2. **使用 ref 保存最新值**
   ```javascript
   const countRef = useRef(count);
   countRef.current = count;

   setTimeout(() => {
     alert(countRef.current);  // 正确
   }, 3000);
   ```

3. **useEffect 替代**
   ```javascript
   useEffect(() => {
     console.log('count changed:', count);
   }, [count]);
   ```

---

## 问答 4：依赖数组对比算法

### 导师提问

**依赖数组的对比算法是如何工作的？**

### 学员回答

不知道依赖数组对比算法。

### 导师解答

**源码实现**
```javascript
// ReactFiberHooks.js
function areHookInputsEqual(nextDeps, prevDeps) {
  // 1. 长度不同，直接返回 false
  if (prevDeps.length !== nextDeps.length) {
    return false;
  }

  // 2. 逐项对比（使用 Object.is）
  for (let i = 0; i < prevDeps.length; i++) {
    if (!Object.is(prevDeps[i], nextDeps[i])) {
      return false;
    }
  }

  return true;
}

// Object.is polyfill
function is(x, y) {
  if (x === y) {
    return x !== 0 || y !== 0 || 1 / x === 1 / y;
  }
  return x !== x && y !== y;  // 处理 NaN
}
```

**对比示例**
```javascript
// 示例 1：基本类型
prevDeps = [1, 2, 3]
nextDeps = [1, 2, 3]
结果：true

// 示例 2：对象引用
const obj = { id: 1 };
prevDeps = [obj]
nextDeps = [{ id: 1 }]  // 新引用
结果：false（即使内容相同）

// 示例 3：NaN 对比
prevDeps = [NaN]
nextDeps = [NaN]
结果：true（Object.is 特殊处理）
```

**常见陷阱**
```javascript
// 陷阱 1：对象作为依赖
function Component({ config }) {
  useEffect(() => {
    // 每次 config 都是新引用，effect 每次都执行
  }, [config]);
}

// 解决：依赖具体属性
useEffect(() => {}, [config.theme]);

// 解决：使用 useMemo 稳定引用
const stableConfig = useMemo(() => ({ theme: 'dark' }), []);
useEffect(() => {}, [stableConfig]);

// 陷阱 2：函数作为依赖
function Component() {
  const fetchData = () => { ... };
  useEffect(() => { fetchData(); }, [fetchData]);  // 每次都执行
}

// 解决：使用 useCallback
const fetchData = useCallback(() => { ... }, []);
useEffect(() => { fetchData(); }, [fetchData]);  // 只执行一次
```

---

## 问答 5：dispatchAction 工作流程

### 导师提问

**dispatchAction 的工作流程是什么？**

### 学员回答

不理解 dispatchAction 的工作流程。

### 导师解答

**整体流程**
```
用户点击 → setCount(1)
              ↓
    dispatchAction(fiber, queue, 1)
              ↓
    ┌──────────────────────────┐
    │ 1. 创建 Update 对象      │
    │    update = { action: 1 }│
    └──────────────────────────┘
              ↓
    ┌──────────────────────────┐
    │ 2. 加入更新队列          │
    │    queue.pending = update│
    └──────────────────────────┘
              ↓
    ┌──────────────────────────┐
    │ 3. 调度 Fiber 更新        │
    │    scheduleUpdateOnFiber │
    └──────────────────────────┘
              ↓
    ┌──────────────────────────┐
    │ 4. Render 阶段遍历 Hooks │
    └──────────────────────────┘
              ↓
    ┌──────────────────────────┐
    │ 5. 处理 Update 队列      │
    │    计算新状态            │
    └──────────────────────────┘
              ↓
    ┌──────────────────────────┐
    │ 6. Commit 阶段提交        │
    │    更新 UI               │
    └──────────────────────────┘
```

**源码简化实现**
```javascript
// 1. dispatchAction
function dispatchAction(fiber, queue, action) {
  const eventTime = requestEventTime();
  const lane = requestUpdateLane(fiber);

  const update = {
    eventTime,
    lane,
    action,
    eagerReducer: null,
    eagerState: null,
    next: null
  };

  // 环形链表插入
  const pending = queue.pending;
  if (pending === null) {
    update.next = update;  // 自己指向自己
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;

  scheduleUpdateOnFiber(fiber);
}

// 2. 处理更新队列
function updateReducer(reducer, initialArg, hook) {
  const queue = hook.queue;
  const pending = queue.pending;
  let newState = hook.memoizedState;

  if (pending !== null) {
    const first = pending.next;
    let update = first;

    do {
      const action = update.action;
      newState = reducer(newState, action);
      update = update.next;
    } while (update !== null && update !== first);

    queue.pending = null;
  }

  hook.memoizedState = newState;
  return [newState, dispatchAction.bind(null, fiber, queue)];
}

// 3. useState 的 reducer
function basicStateReducer(state, action) {
  if (typeof action === 'function') {
    return action(state);  // 函数式更新
  }
  return action;  // 直接返回
}
```

**批量更新示例**
```javascript
function handleClick() {
  setCount(1);  // update1 加入队列
  setCount(2);  // update2 加入队列
  setCount(3);  // update3 加入队列
  // 统一调度，只渲染一次
}

// 更新队列处理：
// 1. newState = 当前状态
// 2. 执行 update1: newState = 1
// 3. 执行 update2: newState = 2
// 4. 执行 update3: newState = 3
// 5. 最终状态 = 3
```

**函数式更新示例**
```javascript
setCount(c => c + 1);

// 处理过程：
// 1. 获取当前状态：count = 0
// 2. 执行 reducer: basicStateReducer(0, c => c + 1)
// 3. 执行函数：0 + 1 = 1
// 4. 新状态 = 1
```

---

## 知识点掌握情况

| 知识点 | 掌握程度 |
|--------|----------|
| Hook 链表结构 | ✓ 已掌握 |
| 全局游标机制 | ✓ 已掌握 |
| Mount/Update 区别 | ✓ 已掌握 |
| 条件调用问题 | ✓ 已掌握 |
| 闭包陷阱根因 | ✓ 已掌握 |
| 依赖数组对比算法 | ✓ 已掌握 |
| dispatchAction 流程 | ✓ 已掌握 |
| 批量更新机制 | ✓ 已掌握 |
| 函数式更新 | ✓ 已掌握 |

---

## 后续学习建议

1. 继续阅读源码：`ReactFiberHooks.js`
2. 实践验证：实现简化版 useState、useEffect
3. 继续 Vue3 相关原理学习

---

*记录时间：2026-03-04*
