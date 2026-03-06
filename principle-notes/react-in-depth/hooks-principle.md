# React Hooks 原理深度剖析

## 核心问题

**为什么 Hooks 必须在顶层调用？为什么不能条件调用？**

这个问题的本质是 React Hooks 的状态存储和检索机制依赖于调用顺序的稳定性。

## 一、实现机制：Hooks 链表结构

### 1.1 Hook 数据结构

```javascript
// ReactFiberHooks.js 简化实现
const Hook = {
  memoizedState: null,  // 当前状态值
  queue: null,          // 更新队列
  next: null,           // 指向下一个 Hook（链表）
};
```

### 1.2 Hook 链表存储

```javascript
// 简化实现示意
let currentHook = null;
let firstHook = null;
let isMount = true;

function mountWorkInProgressHook() {
    const hook = {
        memoizedState: null,
        queue: null,
        next: null
    };
    if (!firstHook) {
        firstHook = currentHook = hook;
    } else {
        currentHook = currentHook.next = hook;
    }
    return currentHook;
}

function updateWorkInProgressHook() {
    // 更新时按顺序遍历链表
    currentHook = currentHook.next;
    return currentHook;
}
```

### 1.3 Fiber 节点存储

Hook 链表存储在 Fiber 节点的 `memoizedState` 属性中：

```
FiberNode {
  type: "FunctionComponent",
  memoizedState: firstHook,  // Hook 链表头
  ...
}
```

## 二、执行顺序依赖分析

### 2.1 正确示例

```javascript
function Counter() {
  const [count, setCount] = useState(0);  // Hook 索引 0
  const [name, setName] = useState('');   // Hook 索引 1
  useEffect(() => {...});                  // Hook 索引 2

  // 渲染时按顺序重建链表，顺序一致
}
```

### 2.2 错误示例 - 条件调用破坏顺序

```javascript
function BrokenComponent({ condition }) {
  if (condition) {
    const [state1, setState1] = useState(0);  // Hook 索引 0（仅条件满足时）
  }
  const [state2, setState2] = useState(1);    // Hook 索引？

  // 问题：
  // - condition=true: state2 对应索引 1
  // - condition=false: state2 对应索引 0
  // 状态会错位！
}
```

### 2.3 源码位置参考

- ReactFiberHooks.js: `mountState`, `updateState`
- ReactFiberHooks.js: `mountWorkInProgressHook`, `updateWorkInProgressHook`
- ReactFiber.js: Fiber 节点结构定义

## 三、各 Hook 实现原理

### 3.1 useState

```javascript
function useState(initialState) {
  const hook = mountWorkInProgressHook();

  if (isMount) {
    // 初始化状态
    hook.memoizedState = initialState;
  } else {
    // 使用已有状态
    currentState = hook.memoizedState;
  }

  // 返回 [状态，更新函数]
  return [hook.memoizedState, dispatchAction.bind(null, hook)];
}
```

### 3.2 useEffect

```javascript
function useEffect(create, deps) {
  const hook = mountWorkInProgressHook();

  if (isMount) {
    hook.memoizedState = {
      create,
      deps,
      destroy: undefined
    };
  } else {
    // 依赖对比
    const prevDeps = hook.memoizedState.deps;
    if (deps !== null && areDepsEqual(deps, prevDeps)) {
      // 依赖未变，跳过
      return;
    }
    hook.memoizedState = { create, deps, destroy: undefined };
  }
}
```

### 3.3 useMemo/useCallback

```javascript
function useMemo(create, deps) {
  const hook = mountWorkInProgressHook();

  if (isMount) {
    const nextValue = create();
    hook.memoizedState = { value: nextValue, deps };
    return nextValue;
  } else {
    const prevValue = hook.memoizedState.value;
    const prevDeps = hook.memoizedState.deps;

    if (areDepsEqual(deps, prevDeps)) {
      return prevValue;  // 缓存命中
    }

    const nextValue = create();
    hook.memoizedState = { value: nextValue, deps };
    return nextValue;
  }
}
```

## 四、性能特征分析

### 4.1 时间复杂度

| 操作 | 复杂度 | 说明 |
|------|--------|------|
| Hook 查找 | O(n) | 需要顺序遍历链表 |
| 状态更新 | O(1) | 直接修改 memoizedState |
| 依赖对比 | O(m) | m 为依赖数组长度 |

### 4.2 内存特征

- Hook 链表与 Fiber 节点生命周期一致
- 闭包引用可能导致内存泄漏（需注意清理函数）

## 五、工程应用

### 5.1 自定义 Hook 设计原则

```javascript
// 好的自定义 Hook - 稳定的 Hook 调用顺序
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    // 初始化逻辑
  });

  const setValue = useEventCallback((value) => {
    // 更新逻辑
  });

  return [storedValue, setValue];
}

// 避免：在自定义 Hook 内部条件调用 Hooks
```

### 5.2 性能优化要点

1. **useMemo/useCallback 正确使用**
   - 仅在计算成本高时使用
   - 依赖数组必须完整
   - 避免创建新引用导致子组件重渲染

2. **useEventCallback 场景**
   - 事件处理器需要最新 props/state
   - 避免闭包陷阱

### 5.3 调试技巧

- React DevTools Components 面板查看 Hook 状态
- React DevTools Profiler 分析渲染性能
- 使用 `useDebugValue` 自定义 Hook 显示

## 六、理解检查清单

- [ ] 能否解释为什么条件调用 Hooks 会导致状态错位？
- [ ] 能否手绘 Hook 链表结构图？
- [ ] 能否实现一个简化版 useState？
- [ ] 知道 useMemo 和 useCallback 的区别和联系吗？
- [ ] 理解闭包陷阱及其解决方案吗？

## 七、扩展阅读

- [React 官方源码 - ReactFiberHooks.js](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberHooks.js)
- [React Hooks 官方文档](https://react.dev/reference/react)
- Dan Abramov 关于 Hooks 设计的文章

---

*最后更新：2026-03-03*
