# Vue 3 响应式系统深度剖析问答记录

**日期**: 2026-03-04
**主题**: Vue 3 响应式系统原理深度剖析
**类型**: 原理探究

---

## 问答 1：Vue 2 响应式缺陷

### 导师提问

**Vue 2 使用什么 API 实现响应式？它有什么固有缺陷？**

### 学员回答

Vue2 使用的 ES5 中的 `Object.defineProperty` 属性去做响应式，它的缺陷是：
- 没法监听到数组长度或者数组下标值的变化
- 对于对象新增加的属性没法监听到变化

### 导师解答

**完全正确**！让我系统总结一下：

| 缺陷 | 原因 | Vue 2 解决方案 |
|------|------|---------------|
| 无法监听数组索引/长度变化 | `Object.defineProperty` 对数组的索引和 `length` 修改不触发 setter | 重写 7 个数组变异方法（`push`、`pop`、`shift`、`unshift`、`splice`、`sort`、`reverse`） |
| 无法监听对象新增属性 | 新属性没有定义 getter/setter | `Vue.set(obj, key, value)` |
| 无法监听对象删除属性 | 删除属性不会触发任何钩子 | `Vue.delete(obj, key)` |

**Vue 2 对数组的 Hack 实现**：

```javascript
const arrayMethods = Object.create(Array.prototype);
const mutatedMethods = [
  'push', 'pop', 'shift', 'unshift',
  'splice', 'sort', 'reverse'
];

mutatedMethods.forEach(method => {
  const original = Array.prototype[method];

  Object.defineProperty(arrayMethods, method, {
    value: function mutator(...args) {
      const result = original.apply(this, args);
      ob.dep.notify();  // 通知更新
      return result;
    }
  });
});
```

---

## 问答 2：Vue 3 Proxy 实现

### 导师解答

**Vue 3 核心实现**：

```javascript
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key);  // 依赖收集
      const res = Reflect.get(target, key, receiver);
      if (isObject(res)) {
        return reactive(res);  // 懒代理
      }
      return res;
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key);  // 触发更新
      return result;
    }
  });
}
```

**相比 Vue 2 的改进**：

| 改进点 | Vue 2 | Vue 3 |
|--------|-------|-------|
| 数组监听 | 重写 7 个方法 | 原生支持 |
| 新增属性 | 需要 Vue.set | 原生支持 |
| 删除属性 | 需要 Vue.delete | 原生支持 |
| 初始化性能 | 递归遍历所有属性 | 懒代理（访问时转换） |
| 内存占用 | 高 | 低 |

---

## 问答 3：依赖收集机制

### 导师提问

**为什么 `targetMap` 要用 `WeakMap` 而不是 `Map`？**

**为什么依赖集合 `dep` 要用 `Set` 而不是 `Array`？**

### 学员回答

（学员正确回答了前两个问题，第三个问题由导师补充）

### 导师解答

**问题 1：WeakMap 的优势**

| 特性 | WeakMap | Map |
|------|---------|-----|
| 键的引用 | 弱引用 | 强引用 |
| 内存泄漏风险 | 低（对象可被 GC） | 高（持有强引用） |

```javascript
// WeakMap 避免内存泄漏
function createComponent() {
  const state = reactive({ count: 0 });
  // 组件销毁后，state 没有引用时会被 GC
  // targetMap 中的对应条目也会自动被回收
}
```

**问题 2：Set 的优势**

1. **自动去重** - 同一个 effect 可能被多次收集
2. **O(1) 删除** - 清理依赖时效率高

```javascript
// 依赖去重示例
effect(() => {
  console.log(state.count + state.count);  // 访问两次 state.count
});

// 用 Set：dep 中只有一个 effect
// 用 Array：dep 中有两个相同的 effect
```

---

## 问答 4：依赖清理的必要性

### 导师提问

**`effect` 函数执行前为什么要清理旧的依赖？**

### 学员回答

（由导师补充解答）

### 导师解答

**原因**：依赖可能**动态变化**，需要清理不再使用的依赖。

```javascript
const state = reactive({
  count: 0,
  show: true,
  name: 'Vue'
});

effect(() => {
  if (state.show) {
    console.log(state.count);  // 依赖 count
  } else {
    console.log(state.name);   // 依赖 name
  }
});

// 如果不清理旧依赖：
// show = true  时收集了 count
// show = false 时收集了 name，但 count 的依赖没清理
// count 变化时 effect 会错误地执行！
```

---

## 问答 5：触发更新次数

### 导师提问

**下面这段代码中，`effect` 会被触发几次？**

```javascript
const state = reactive({ count: 0, name: 'Vue' });

effect(() => {
  console.log(state.count);
});

state.count = 1;      // 第一次修改
state.count = 2;      // 第二次修改
state.name = 'Vue3';  // 第三次修改
```

### 学员回答

**2 次**（count 的两次修改）

### 导师解答

**完全正确**！

| 操作 | 是否触发 | 原因 |
|------|----------|------|
| `state.count = 1` | ✓ 触发 | count 是当前 effect 的依赖 |
| `state.count = 2` | ✓ 触发 | 同上 |
| `state.name = 'Vue3'` | ✗ 不触发 | name 不是当前 effect 的依赖 |

---

## 问答 6：ref vs reactive

### 导师提问

**ref 的设计动机是什么？与 reactive 有什么区别？**

### 学员回答

- `reactive` 是基于 Proxy 去实现引用类型的响应式
- `ref` 是通过 `Object.defineProperty` 的 getter 和 setter 实现基本类型的响应式补充

### 导师解答

**基本正确**！补充关键点：

| 特性 | reactive | ref |
|------|----------|-----|
| 实现方式 | Proxy | Object.defineProperty（基本类型）/ Proxy（引用类型） |
| 适用类型 | 对象、数组 | 基本类型 + 引用类型 |
| 访问方式 | 直接访问 | `.value` |

**关键补充**：
- `ref` 处理引用类型时，内部会调用 `reactive`，所以**本质还是 Proxy**
- `ref` 的设计动机还包括：模板自动解包、组合式函数返回值、避免 Proxy 限制

---

## 问答 7：ref 触发重新渲染

### 导师提问

**下面哪些操作会触发重新渲染？**

```javascript
const obj = reactive({ count: 0 });
const countRef = ref(0);

// A
obj.count = 1;

// B
obj = reactive({ count: 0 });

// C
countRef.value = 1;

// D
countRef = ref(100);
```

### 学员回答

**A、C、D**

### 导师解答

**完全正确**！

| 操作 | 是否触发 | 原因 |
|------|----------|------|
| `obj.count = 1` | ✓ | 修改 reactive 对象的属性 |
| `obj = reactive({...})` | ✗ | 重新赋值局部变量，原对象没变 |
| `countRef.value = 1` | ✓ | 修改 ref 的 value |
| `countRef = ref(100)` | ✓ | 重新赋值 ref 变量（在 setup 中） |

---

## 问答 8：模板自动解包

### 导师提问

**为什么在模板中 `ref` 不需要 `.value`，但在 JS 中需要？**

### 学员回答

模板在编译的时候直接获取了当前的上下文，直接解构了。但是在 JS 中本质是把你的值塞进一个对象的 `.value` 中，没法解构。

### 导师解答

**完全正确**！

**模板编译后**：
```javascript
// 编译前
<div>{{ count }}</div>

// 编译后（简化）
export function render(_ctx, _cache, $props, $setup) {
  return _createElementVNode("div", null, _toDisplayString($setup.count), 1);
}

// _toDisplayString 内部会检查是否是 ref
function toDisplayString(val) {
  return isRef(val) ? String(val.value) : String(val);
}
```

---

## 问答 9：shallowRef vs ref

### 导师提问

**`shallowRef` 和 `ref` 有什么区别？什么场景下使用？**

### 学员回答

- `shallowRef` 是浅层响应，只追踪 `.value` 本身变化
- `ref` 是深层响应，传给 ref 对象，内部所有嵌套的属性都会响应

### 导师解答

**完全正确**！

```javascript
// ref - 深度响应式
const data = ref({ nested: { count: 0 } });
data.value.nested.count = 1;  // ✓ 触发更新

// shallowRef - 只追踪 .value 本身
const shallow = shallowRef({ nested: { count: 0 } });
shallow.value.nested.count = 1;  // ✗ 不触发更新
shallow.value = { new: 'obj' };  // ✓ 触发更新

// 使用场景：大型对象，只关心整体替换
const largeData = shallowRef(hugeObject);
```

---

## 问答 10：computed 缓存机制

### 导师提问

**下面这段代码中，`console.log` 会输出几次？**

```javascript
const count = ref(0);

const double = computed(() => {
  console.log('计算 double');
  return count.value * 2;
});

console.log('--- 开始 ---');
console.log(double.value);  // 第 1 次
console.log(double.value);  // 第 2 次
count.value = 5;
console.log(double.value);  // 第 3 次
console.log(double.value);  // 第 4 次
```

### 学员回答

**2 次**

### 导师解答

**完全正确**！

```
console.log(double.value);  // 第 1 次：_dirty=true → 执行 getter → 输出
console.log(double.value);  // 第 2 次：_dirty=false → 返回缓存 → 不输出
count.value = 5;            // 只标记 _dirty=true，不执行 getter（懒执行）
console.log(double.value);  // 第 3 次：_dirty=true → 执行 getter → 输出
console.log(double.value);  // 第 4 次：_dirty=false → 返回缓存 → 不输出
```

**关键点**：computed 是**懒执行**的，只有在访问 `.value` 时才会重新计算。

---

## 问答 11：computed vs watch vs watchEffect

### 导师提问

**`computed` 和 `watchEffect` 的区别是什么？**

**什么场景下应该用 `computed`，什么场景下应该用 `watch`？**

### 学员回答

- `computed` 是缓存，`watchEffect` 是监听
- 复杂数据的计算使用 `computed`，需要监听值的变化去做下一次逻辑使用 `watch`

### 导师解答

**完全正确**！

**三者对比**：

| 特性 | computed | watch | watchEffect |
|------|----------|-------|-------------|
| 返回值 | 有（计算结果） | 无 | 无 |
| 执行时机 | 懒执行（访问时才计算） | 被动触发 | 立即执行 |
| 缓存 | 有缓存 | 无缓存 | 无缓存 |
| 依赖收集 | 自动 | 手动指定源 | 自动 |
| 用途 | 派生状态 | 副作用 | 副作用 |

**使用场景**：

```javascript
// ✅ computed：派生状态
const fullName = computed(() => `${firstName.value} ${lastName.value}`);

// ✅ watch：副作用（异步请求等）
watch(userId, async (newId) => {
  const data = await fetchUser(newId);
  userData.value = data;
});

// ✅ watchEffect：自动依赖追踪
watchEffect(() => {
  console.log(`User ${userId.value} logged in`);
});
```

---

## 问答 12：watch 触发次数

### 导师提问

**下面这段代码中，`watch` 的回调会执行几次？**

```javascript
const count = ref(0);

watch(count, (newVal, oldVal) => {
  console.log(`count: ${oldVal} → ${newVal}`);
});

count.value = 1;
count.value = 2;
count.value = 3;
```

### 学员回答

**3 次**

### 导师解答

**完全正确**！每次 `count.value` 变化都会触发回调。

---

## 问答 13：computed 缓存的意义

### 导师提问

**为什么 `computed` 要有缓存机制？没有缓存会怎样？**

### 学员回答

`computed` 缓存机制是为了解决性能问题，没有缓存每次获取属性都会去执行计算。

### 导师解答

**完全正确**！

**没有缓存的问题**：
```javascript
const double = computed(() => {
  console.log('计算');
  return count.value * 2;
});

// 没有缓存时：
double.value;  // 输出"计算"
double.value;  // 输出"计算"
double.value;  // 输出"计算"

// 有缓存时：
double.value;  // 输出"计算"
double.value;  // 不输出
double.value;  // 不输出
```

---

## 知识点掌握情况

| 知识点 | 掌握程度 |
|--------|----------|
| Vue 2 响应式缺陷 | ✓ 已掌握 |
| Vue 3 Proxy 实现原理 | ✓ 已掌握 |
| 依赖收集机制 | ✓ 已掌握 |
| WeakMap 的作用 | ✓ 已掌握 |
| Set 去重的作用 | ✓ 已掌握 |
| ref vs reactive 区别 | ✓ 已掌握 |
| shallowRef 使用场景 | ✓ 已掌握 |
| computed 缓存机制 | ✓ 已掌握 |
| computed vs watch vs watchEffect | ✓ 已掌握 |

---

## 待深入内容

1. watch 和 watchEffect 在依赖收集上的具体差异
2. Vue 3 响应式边界情况（什么场景会失效）
3. React 响应式 vs Vue 响应式对比

---

*记录时间：2026-03-04*
