# React Concurrent Mode 问答记录

**日期**: 2026-03-04
**主题**: React Concurrent Mode 并发模式深度剖析
**类型**: 原理探究

---

## 问答 1：并发概念理解

### 导师提问

**你对 "并发"（Concurrent）这个概念有什么理解？**

可以从以下几个角度思考：
1. **并发 vs 并行**：它们有什么区别？
2. **为什么 React 需要并发**？是为了解决什么问题？
3. **你用过 `startTransition` 或 `useDeferredValue` 吗？** 知道它们的场景吗？

### 学员回答

1. 并发是可以多个内容一起开始执行，并行是同步执行
2. React 并发是为了解决可以中断渲染问题，解决 React class 版本的主线程被占用过长，渲染掉帧卡帧情况
3. startTransition 过度更新，是用在哪些不需要立即反映在屏幕上的更新，useDeferredValue 推迟更新，优先让更紧急的任务完成更新，然后有空闲再更新延迟的内容

### 导师解答

**1. 并发 vs 并行 精确定义**

```
并发（Concurrency）：多个任务交替执行
并行（Parallelism）：多个任务同时执行

时间线示意：

并行（多核 CPU）：
任务 A: ████
任务 B:     ████
         同时执行

并发（单核 CPU）：
任务 A: ██    ██    ██
任务 B:    ██    ██    ██
         交替执行
```

**React 的并发**：
- 单线程上，多个更新任务可以交替执行
- 高优先级任务可以打断低优先级任务
- 这是并发，不是并行（React 主线程仍然是单线程）

**2. Concurrent Mode 解决的核心问题**

问题场景：
```
场景：用户在一个大型列表中搜索

组件树：
App
├── SearchInput (用户输入)
├── SearchResult (大型列表渲染)
└── Sidebar (侧边栏)

用户行为：
1. 输入 "a" → 触发搜索 → 开始渲染结果（低优先级）
2. 渲染进行中... (已渲染 50%)
3. 用户又输入 "ab" → 新搜索请求

非并发模式问题：
- 必须等第一次渲染完成，才能响应新输入
- 用户感觉：输入卡顿、不跟手
```

Concurrent Mode 解决方案：
```
1. 输入 "a" → 标记为默认优先级 → 开始渲染
2. 渲染进行中... (50%)
3. 用户输入 "ab" → 标记为高优先级 → 打断当前渲染
4. 先渲染 "ab" 的结果
5. 空闲时继续处理未完成的低优先级任务

用户体验：
- 输入始终流畅响应
- 搜索结果可能"稍微慢一点"，但交互不卡顿
```

---

## 知识点 1：Concurrent Mode 核心特性

### 1.1 可中断渲染

```javascript
// Concurrent Mode 之前（同步渲染）
function renderTree(root) {
  // 一旦开始，必须执行完，无法中断
  renderNode(root);
  renderNode(root.child);
  // ... 必须全部完成
}

// Concurrent Mode（可中断）
function renderTreeConcurrent(root, deadline) {
  while (workInProgress && !shouldYield()) {
    renderNode(workInProgress);
    // 时间到了，可以暂停
    if (deadline.timeRemaining() <= 0) {
      pause();  // 让出主线程
      resumeLater();  // 稍后继续
    }
  }
}
```

### 1.2 优先级调度

```
优先级层级（从高到低）：

1. Sync (同步)
   - 用户输入、点击
   - 必须立即响应

2. InputContinuous (连续输入)
   - 滚动、拖拽
   - 需要流畅体验

3. Default (默认)
   - 普通数据更新
   - 可以稍微延迟

4. Transition (过渡)
   - 搜索结果、过滤列表
   - 可以被打断

5. Idle (空闲)
   - 后台预加载
   - 最优先级最低
```

### 1.3 渲染状态管理

```
Concurrent Mode 的关键挑战：

场景：
T1: 开始渲染任务 A（优先级：低）
T2: 打断，开始渲染任务 B（优先级：高）
T3: 任务 B 完成，提交到 DOM
T4: 继续任务 A...

问题：
- 任务 A 应该继续吗？
- 如果任务 A 的状态已经过期（stale），应该丢弃

解决方案：
- 每个任务都有 lane（优先级标记）
- 渲染前检查：当前任务是否还是最新优先级
- 如果过期，直接丢弃，重新开始
```

---

## 知识点 2：startTransition 深度解析

### 2.1 使用场景

```javascript
import { startTransition, useState } from 'react';

function SearchBox() {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  function handleInput(e) {
    const value = e.target.value;

    // 高优先级：立即更新输入框
    setInputValue(value);

    // 低优先级：搜索结果可以等待
    startTransition(() => {
      const results = search(value);
      setSearchResults(results);
    });
  }

  return (
    <div>
      <input value={inputValue} onChange={handleInput} />
      <SearchResults data={searchResults} />
    </div>
  );
}
```

### 2.2 内部原理

```javascript
// startTransition 简化实现
function startTransition(callback) {
  // 保存之前的优先级
  const previousLane = getCurrentUpdateLane();

  // 设置为 Transition 优先级
  setCurrentUpdateLane(TransitionLane);

  try {
    callback();  // 执行更新
  } finally {
    // 恢复优先级
    setCurrentUpdateLane(previousLane);
  }
}
```

### 2.3 适用场景

| 适合使用 startTransition | 不适合使用 |
|--------------------------|------------|
| 搜索结果显示 | 表单输入 |
| 列表过滤 | 按钮点击 |
| Tab 切换内容 | 动画关键帧 |
| 大数据渲染 | 焦点管理 |

---

## 知识点 3：useDeferredValue 深度解析

### 3.1 使用场景

```javascript
import { useDeferredValue, useState } from 'react';

function SearchBox() {
  const [inputValue, setInputValue] = useState('');

  // 推迟搜索结果的更新
  const deferredValue = useDeferredValue(inputValue);

  return (
    <div>
      <input value={inputValue} onChange={e => setInputValue(e.target.value)} />
      <SearchResults query={deferredValue} />
    </div>
  );
}
```

### 3.2 与 startTransition 的区别

```javascript
// startTransition：包裹"更新动作"
startTransition(() => {
  setSearchResults(value);  // 这个更新是低优先级
});

// useDeferredValue：包裹"值本身"
const deferredValue = useDeferredValue(value);
// 使用 deferredValue 的组件更新是低优先级

// 等价写法
// 写法 1：startTransition
function Component1({ value }) {
  const [deferred, setDeferred] = useState(value);
  useEffect(() => {
    startTransition(() => setDeferred(value));
  }, [value]);
  return <Child value={deferred} />;
}

// 写法 2：useDeferredValue（更简洁）
function Component2({ value }) {
  const deferred = useDeferredValue(value);
  return <Child value={deferred} />;
}
```

### 3.3 内部原理

```javascript
// useDeferredValue 简化实现
function useDeferredValue(value) {
  const [deferredValue, setDeferredValue] = useState(value);

  useEffect(() => {
    // value 变化时，低优先级更新 deferredValue
    startTransition(() => {
      setDeferredValue(value);
    });
  }, [value]);

  return deferredValue;
}
```

---

## 知识点 4：Suspense 与并发渲染

### 4.1 Suspense 工作原理

```javascript
function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}

// HeavyComponent 内部
function HeavyComponent() {
  // 可能抛出 Promise（Suspense 边界捕获）
  const data = resource.read();
  return <div>{data}</div>;
}
```

### 4.2 并发 Suspense 模式

```
组件树：
<Suspense fallback={<Loading />}>
  <ProfilePage>
    <ProfileDetails />       ← 先渲染
    <ProfileTimeline />      ← 数据未就绪，挂起
  </ProfilePage>
</Suspense>

并发渲染流程：
1. 渲染 ProfileDetails → 完成，显示
2. 渲染 ProfileTimeline → 抛出 Promise，挂起
3. 整个 ProfilePage 标记为"未完成"
4. 等待数据就绪
5. 数据就绪后，重新渲染整个 ProfilePage
6. 一次性提交（用户看到完整内容）

效果：
- 不会出现"部分加载"的状态
- 要么显示 Loading，要么显示完整内容
```

---

## 知识点 5：useTransition 使用

```javascript
import { useTransition, useState } from 'react';

function SearchBox() {
  const [isPending, startTransition] = useTransition();
  const [inputValue, setInputValue] = useState('');

  function handleInput(value) {
    setInputValue(value);
    startTransition(() => {
      // 更新搜索结果
    });
  }

  return (
    <div>
      <input onChange={e => handleInput(e.target.value)} />
      {isPending && <LoadingSpinner />}  {/* 显示加载状态 */}
    </div>
  );
}
```

---

## Concurrent Features 总结

| 特性 | 用途 | 优先级 |
|------|------|--------|
| `startTransition` | 标记低优先级更新 | Transition |
| `useDeferredValue` | 推迟值的更新 | Transition |
| `Suspense` | 等待异步数据 | 可配置 |
| `useTransition` | 获取 transition 状态 | Transition |

---

## 知识点掌握情况

| 知识点 | 掌握程度 |
|--------|----------|
| 并发 vs 并行 | ✓ 已掌握 |
| Concurrent Mode 解决问题 | ✓ 已掌握 |
| 可中断渲染 | ✓ 已掌握 |
| 优先级调度 | ✓ 已掌握 |
| startTransition 使用 | ✓ 已掌握 |
| useDeferredValue 使用 | ✓ 已掌握 |
| useDeferredValue vs startTransition | ✓ 已掌握 |
| Suspense 并发行为 | ✓ 已掌握 |
| useTransition 使用 | ✓ 已掌握 |

---

## 后续学习建议

1. 实践验证：在实际项目中使用 startTransition 优化列表渲染
2. 阅读源码：ReactFiberWorkLoop.js 中的调度逻辑
3. 继续 Vue3 相关原理学习

---

*记录时间：2026-03-04*
