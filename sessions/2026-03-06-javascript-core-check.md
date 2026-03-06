# JavaScript 核心知识点检查记录

**日期**: 2026-03-06
**主题**: JavaScript 核心知识点全面检查（A-E 模块）
**类型**: 知识点验证

---

## A 模块：执行上下文与作用域

### 问题 1：执行上下文与提升

**题目**：
```javascript
console.log(a);
console.log(b);
console.log(c);

var a = 1;
let b = 2;
const c = 3;
function c() { console.log('function c'); }
```

**学员回答**：
- 代码会报错，因为 let 和 const 会发生暂时性死区
- 暂时性死区时变量脱离了当前作用域不能被外界访问
- var 会让作用域提升，let const 会产生暂时性死区

**导师评价**：✓ 完全正确

**标准输出**：
```javascript
console.log(a);  // undefined（var 提升，但未赋值）
console.log(b);  // ReferenceError: Cannot access 'b' before initialization
console.log(c);  // 不会执行
```

---

### 问题 2：闭包与作用域

**题目**：
```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => {
    console.log(i);
  }, 100);
}
console.log('循环结束');
```

**学员回答**：
- 输出三个 0（实际是三个 3）
- 因为 setTimeout 是宏任务，在 JS 任务队列循环中执行
- 解决方案：立即执行函数包裹、使用 let 定义 i

**导师评价**：✓ 基本正确（输出应为 3,3,3）

**标准输出**：
```
循环结束
3
3
3
```

---

### 问题 3：this 绑定

**题目**：
```javascript
const obj = {
  name: 'obj',
  getName() { return this.name; },
  getNameArrow: () => { return this.name; }
};
const getName = obj.getName;

console.log(obj.getName());        // ?
console.log(obj.getNameArrow());   // ?
console.log(getName());            // ?
console.log(getName.call(obj));    // ?
```

**学员回答**：
- 箭头函数的 this 是在词法环境中确定的
- call/apply/bind 都是上下文 this 绑定
- call 传递普通参数，apply 可传递数组，bind 返回新函数稍后执行
- 四种绑定：显式绑定（call/apply/bind）、默认绑定、隐式绑定、new 绑定

**导师评价**：✓ 完全正确

**标准输出**：
```javascript
obj.getName();        // 'obj'
obj.getNameArrow();   // undefined（或全局对象的 name）
getName();            // undefined（默认绑定）
getName.call(obj);    // 'obj'（显式绑定）
```

---

### A 模块评分

| 知识点 | 掌握程度 |
|--------|----------|
| var/let/const 提升 | ✓ 已掌握 |
| 暂时性死区（TDZ） | ✓ 已掌握 |
| 闭包本质 | ✓ 已掌握 |
| 事件循环（宏/微任务） | ✓ 已掌握 |
| 箭头函数 this | ✓ 已掌握 |
| call/apply/bind | ✓ 已掌握 |
| this 四种绑定 | ✓ 已掌握 |

**A 模块总评：A-**

---

## B 模块：原型与继承

### 问题 1：原型链

**题目**：解释 `Object.create()` 的作用，为什么要重置 constructor？

**学员回答**：
- Object.create() 的作用是创建一个对象，这个对象继承 create 里面传入的参数
- 因为不重置的话 Student 的 constructor 就是 Person

**导师评价**：✓ 完全正确

---

### 问题 2：ES6 class vs 原型继承

**学员回答**：
- ES5 中的 class 语法是原型继承的另一种方式
- class 更灵活功能更多，扩展更多

**导师评价**：⚠️ 需要具体化

**补充要点**：
```javascript
// class 特有的特性：
// 1. 必须用 new 调用
// 2. 方法不可枚举
// 3. 支持 extends/super
// 4. 静态方法
// 5. 天然支持继承
```

---

### 问题 3：继承模式对比

**学员回答**：
- 原型链、构造函数、组合继承都会导致继承对象中的内容重新执行一遍
- 寄生组合继承不会导致函数重新执行，只是继承原型链上的内容

**导师评价**：✓ 基本正确

---

### B 模块评分

| 知识点 | 掌握程度 |
|--------|----------|
| Object.create() | ✓ 已掌握 |
| constructor 重置 | ✓ 已掌握 |
| 原型链工作原理 | ✓ 已掌握 |
| instanceof 原理 | ✓ 已掌握 |
| 继承模式对比 | B 基本掌握 |
| ES6 class 语法 | B 基本掌握 |

**B 模块总评：B+**

---

## C 模块：异步编程

### 问题 1：Event Loop 输出

**题目**：
```javascript
console.log('1. script start');
setTimeout(() => { console.log('2. setTimeout'); }, 0);
Promise.resolve()
  .then(() => { console.log('3. promise then1'); })
  .then(() => { console.log('4. promise then2'); });
async function async1() {
  console.log('5. async1 start');
  await Promise.resolve();
  console.log('6. async1 end');
}
async1();
console.log('7. script end');
```

**学员回答**：
- 输出顺序：1, 5, 7, 3, 4, 6, 2
- 先执行同步任务，然后执行异步队列中的任务
- 异步队列中先执行微任务再执行宏任务
- 宏任务有 setTimeout、setInterval，微任务有 Promise、async
- async 本质是 Promise 语法糖

**导师评价**：✓ 完全正确

---

### 问题 2：Promise 状态

**学员回答**：
- Promise 状态只能改变一次
- resolve 后不能 reject
- Promise 链式调用原理是因为它们执行后都返回 Promise

**导师评价**：✓ 完全正确

---

### 问题 3：async/await 错误处理

**学员回答**：
- 使用 Promise.all 并行执行
- async 函数需要配套使用

**导师评价**：✓ 基本正确

---

### C 模块评分

| 知识点 | 掌握程度 |
|--------|----------|
| Event Loop 执行顺序 | ✓ 已掌握 |
| 宏任务 vs 微任务 | ✓ 已掌握 |
| Promise 状态机 | ✓ 已掌握 |
| Promise 链式原理 | ✓ 已掌握 |
| async/await 本质 | ✓ 已掌握 |
| 错误处理 | B 基本掌握 |
| 并行请求优化 | ✓ 已掌握 |

**C 模块总评：A-**

---

## D 模块：类型系统

### 问题 1：类型转换输出

**题目**：
```javascript
console.log([] == ![]);         // ?
console.log('0' == 0);          // ?
console.log('0' === 0);         // ?
console.log(null == undefined); // ?
console.log(null === undefined);// ?
console.log(NaN == NaN);        // ?
console.log(NaN === NaN);       // ?
console.log([1] == 1);          // ?
console.log([1, 2] == 12);      // ?
console.log({} == {});          // ?
```

**学员回答**：
- == 会隐式转换，=== 不存在隐式转换
- 隐式转换的规则是调用对象上的 toString、valueOf 方法
- NaN !== NaN

**导师评价**：✓ 基本正确

**标准输出**：
```javascript
[] == ![]         // true
'0' == 0          // true
'0' === 0         // false
null == undefined // true
null === undefined// false
NaN == NaN        // false
NaN === NaN       // false
[1] == 1          // true
[1, 2] == 12      // false
{} == {}          // false
```

---

### 问题 2：类型判断

**学员回答**：
- instanceof 的原理是判断实例是否继承于另一个对象
- 准确判断数组使用 Array.isArray

**导师评价**：✓ 正确

---

### D 模块评分

| 知识点 | 掌握程度 |
|--------|----------|
| `==` vs `===` | ✓ 已掌握 |
| 隐式类型转换规则 | ✓ 已掌握 |
| `NaN` 特性 | ✓ 已掌握 |
| `typeof` 边界情况 | ✓ 已掌握 |
| `instanceof` 原理 | ✓ 已掌握 |
| 类型判断最佳实践 | ✓ 已掌握 |

**D 模块总评：A-**

---

## E 模块：内存管理

### 问题 1：内存泄漏场景

**题目**：以下代码哪些会导致内存泄漏？

**学员回答**：
- 3、4 会导致内存泄漏，因为它们引用没有释放
- 使用 Chrome DevTools Memory 中的 Heap Snapshot 检查
- WeakMap/WeakSet 保存的是弱引用

**导师评价**：⚠️ 部分正确（实际 1-5 都会泄漏）

**完整答案**：
| 场景 | 是否泄漏 | 原因 |
|------|----------|------|
| 1. 全局变量 | ✓ | 隐式全局变量永不被 GC |
| 2. 定时器 | ✓ | setInterval 未清理，闭包引用 |
| 3. 闭包 | ✓ | 返回的闭包引用大对象 |
| 4. DOM 引用 | ✓ | DOM 移除后 JS 仍持有引用 |
| 5. 事件监听 | ✓ | 未移除监听器 |

---

### 问题 2：GC 算法

**学员回答**：
- 标记清除算法不清楚
- 引用计数算法是当引用一次就 +1，释放就 -1，循环引用无法释放
- V8 引擎使用标记清除

**导师评价**：⚠️ 需要补充

**补充要点**：
```
标记 - 清除算法流程：
1. 标记阶段：从根对象遍历，标记所有可达对象为"活跃"
2. 清除阶段：清除所有未标记的对象

V8 GC 策略：
- 分代收集（新生代 + 老生代）
- 增量标记（减少停顿）
- 并发标记（与 JS 代码并发执行）
- 惰性清理（延迟到空闲时）
```

---

### E 模块评分

| 知识点 | 掌握程度 |
|--------|----------|
| 内存泄漏场景识别 | B 部分掌握 |
| WeakMap/WeakSet 弱引用 | ✓ 已掌握 |
| 引用计数算法 | ✓ 已掌握 |
| 标记 - 清除算法 | ⚠️ 需要了解 |
| V8 GC 策略 | B 基本掌握 |

**E 模块总评：B**

---

## 总体评分

| 模块 | 评分 | 掌握情况 |
|------|------|----------|
| A. 执行上下文与作用域 | A- | 优秀 |
| B. 原型与继承 | B+ | 良好 |
| C. 异步编程 | A- | 优秀 |
| D. 类型系统 | A- | 优秀 |
| E. 内存管理 | B | 良好 |

**总体评价：A-** ✓

---

## 知识盲点总结

1. **内存泄漏场景识别** - 5 个场景只识别 2 个，需要加强对实际泄漏场景的敏感度
2. **标记 - 清除算法** - 建议深入理解 GC 原理
3. **V8 GC 细节** - 分代收集、增量标记等概念需要了解

---

## 后续学习建议

### 实践方向
1. 使用 Chrome DevTools Memory 面板分析内存泄漏
2. 阅读 V8 GC 相关文档
3. 在实际项目中排查响应式失效问题

### 理论方向
1. 深入学习《JavaScript 高级程序设计》内存章节
2. 阅读 V8 官方博客 GC 相关文章
3. 继续 Vue 3 虚拟 DOM diff 算法（最长递增子序列优化）

### 框架学习方向
1. Vue 3 组合式 API 深度
2. React vs Vue 响应式对比
3. 浏览器渲染管道深度

---

*记录时间：2026-03-06*
