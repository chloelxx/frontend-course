# React Fiber 架构问答记录

**日期**: 2026-03-03
**主题**: React Fiber 架构深度剖析
**类型**: 原理探究

---

## 问答 1：Fiber 架构的设计动机

### 导师提问

**你能描述一下 React 在 15 版本及之前使用的 Stack Reconciler（栈协调器）有什么本质问题吗？**

提示：可以从以下几个角度思考
- 当组件树很大时，更新过程会发生什么？
- 为什么主线程被长时间占用会导致页面卡顿？
- 浏览器的主线程上除了 React 的 render 方法，还在执行什么任务？

### 学员回答

组件树很大的时候，渲染会出现掉帧卡顿现象。主线程在不停的递归调用，阻塞了页面的渲染。主线程除了 react 的 render 方法，我不知道还在执行什么方法。

### 导师解答

**浏览器主线程任务队列**：

1. JavaScript 执行（宏任务/微任务）
2. 样式计算（Recalc Style）
3. 布局（Layout / Reflow）
4. 绘制（Paint）
5. 合成（Composite）
6. 用户输入事件处理
7. requestAnimationFrame 回调

**关键问题**：React 15 的同步渲染会独占主线程，导致其他任务无法执行。

**60FPS 的要求**：每帧时间预算 16.67ms。如果某一帧的任务超过 16.67ms，就会掉帧（卡顿）。

**React 15 Stack Reconciler 的问题**：
- 同步递归，无法中断
- 组件树更新耗时可能达到 100ms+
- 用户交互无响应

---

## 问答 2：递归 vs 链表遍历的本质区别

### 导师提问

**为什么将递归改为链表可以解决阻塞问题？**

提示：思考两种遍历方式的控制权差异。

### 学员回答

递归遍历无法中断，都是在栈中执行的，链表调用采用了任务队列的方式，不在在栈中执行，会根据任务的优先级，调用规则去执行遍历调用。

### 导师解答

**递归调用栈（不可中断）**：
```
mountComponent(App)
  └─ mountComponent(Header)
      └─ mountComponent(Nav)
          └─ mountComponent(Link)  ← 无法中途暂停，必须等栈返回
```

**链表遍历（可中断）**：
```
Fiber 链表：App → Header → Nav → Link → ... → Content → List → Item1 → Item2 → ...

工作循环：
while (workInProgress && hasTime()) {
  performUnitOfWork(fiber);  // 处理一个节点
  workInProgress = fiber.next;  // 移动到下一个
}

// 时间用完，让出主线程
if (workInProgress) {
  scheduleCallback(workLoop);  // 下一帧继续
}
```

**关键区别**：
| 特性 | 递归 | 链表遍历 |
|------|------|----------|
| 控制权 | 浏览器/调用栈 | React 自己 |
| 可中断性 | 否 | 是 |
| 执行方式 | 同步 | 可分片异步 |

---

## 问答 3：Fiber 架构的代价

### 导师提问

**Fiber 架构引入了什么新的复杂性或代价？**

提示：想象一下，如果渲染可以中断，会发生什么情况？

### 学员回答

时间分片，任务队列，代价是以空间换时间。如果渲染中断用户看到的页面是一个半成品状态。

### 导师解答

**双缓存机制（Double Buffering）解决视觉不一致**：

```
rootFiber = {
  current: null,           // 当前屏幕上显示的树
  workInProgress: null     // 正在构建的树（离屏）
}
```

**更新流程**：
1. 创建 workInProgress 树（离屏构建）
2. 异步构建，可中断恢复
3. 完成后一次性提交
4. 切换指针（用户看到完整更新）

**Fiber 的代价与权衡**：

| 优势 | 代价/权衡 |
|------|----------|
| 可中断渲染，避免长任务 | 内存占用增加（存储两棵 Fiber 树） |
| 优先级调度，响应更快 | 实现复杂度大幅增加 |
| 并发渲染能力 | 需要处理部分树过期问题 |
| 更好的用户体验 | 调试难度增加 |

---

## 问答 4：Fiber 核心高频考点

### 导师提问

检查以下知识点的理解：
1. Fiber 如何断点续传？
2. 副作用链表（Effect List）是如何工作的？
3. key 的作用是什么？为什么 index 作为 key 有问题？
4. requestIdleCallback 为什么被替换为 MessageChannel？

### 学员回答

1. **Fiber 如何断点续传** - 不知道
2. **副作用链表** - 组件更新的时候会根据 effect list 中的状态，去和组件中的状态一一对应更新，然后再渲染页面
3. **key 的作用** - 为了提高组件更新对比时 diff 算法效率
4. **requestIdleCallback** - 它的空白时间不是固定的，而是页面当前时间影响，使用 messagechannel 效率更好

### 导师解答

**1. Fiber 如何断点续传**

核心：全局变量 `workInProgress`

```javascript
let workInProgress = null;  // 指向当前正在处理的 Fiber 节点

function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

// 中断时：workInProgress = Fiber(Content)  ← 保存位置
// 恢复时：从 workInProgress 继续
```

**2. 副作用链表（Effect List）工作原理**

Effect 类型（Flags）：
- Placement: 插入节点
- Update: 更新属性
- Deletion: 删除节点
- ChildDeletion: 删除子节点

构建过程（Render 阶段）：
- 组件更新时打标记
- 将当前节点加入父节点的 effect list

Commit 阶段遍历：
- 从根节点的 firstEffect 开始
- 根据 flag 执行对应操作（插入/更新/删除）
- 遍历到 nextEffect

**3. key 的作用与 index 作为 key 的问题**

key 的核心作用：
- diff 时快速定位节点
- 避免不必要的更新

index 作为 key 的问题：
```
// 删除列表第一项
初始：[A, B, C] → key: 0, 1, 2
删除后：[B, C] → key: 0, 1

React 认为：
B 的 key=0，但数据变成了 B（原来是 A）→ B 继承了 A 的状态！
```

**4. requestIdleCallback vs MessageChannel**

| 特性 | requestIdleCallback | MessageChannel |
|------|---------------------|----------------|
| 触发频率 | 20-100ms（不稳定） | 每帧都触发（稳定） |
| 时间预算 | 不固定 | 自己控制（通常 5ms） |
| 兼容性 | 差（Safari 不支持） | 好（所有现代浏览器） |
| 可控性 | 低 | 高 |

---

## 知识点掌握情况

| 知识点 | 掌握程度 |
|--------|----------|
| Fiber 设计动机 | ✓ 理解 |
| 浏览器主线程模型 | ✓ 理解 |
| Stack vs Fiber | ✓ 理解 |
| 双缓存机制 | ✓ 理解 |
| 断点续传机制 | ✓ 已掌握 |
| Effect List | ✓ 已掌握 |
| key 的作用 | ✓ 已掌握 |
| MessageChannel | ✓ 已掌握 |

---

## 后续学习建议

1. 继续 React Hooks 原理学习
2. 实践验证：实现简化版 Fiber
3. 阅读源码：ReactFiber.js、ReactFiberWorkLoop.js

---

*记录时间：2026-03-03*
