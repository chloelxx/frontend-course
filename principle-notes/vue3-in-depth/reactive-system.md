# Vue 3 响应式系统深度剖析

## 核心问题

**Vue 3 的响应式系统相比 Vue 2 有什么本质改进？**

## 一、技术演进：从 Object.defineProperty 到 Proxy

### 1.1 Vue 2 实现方式

```javascript
// Vue 2 响应式实现
function defineReactive(obj, key, value) {
  const dep = new Dep();  // 依赖收集器

  Object.defineProperty(obj, key, {
    get() {
      // 依赖收集
      if (Dep.target) {
        dep.depend();
      }
      return value;
    },
    set(newVal) {
      if (newVal !== value) {
        value = newVal;
        // 触发更新
        dep.notify();
      }
    }
  });
}

// 初始化
function observe(obj) {
  Object.keys(obj).forEach(key => {
    defineReactive(obj, key, obj[key]);
  });
}
```

### Vue 2 的局限性

| 限制 | 说明 |
|------|------|
| 无法检测对象属性的添加或删除 | 需要 `Vue.set` / `Vue.delete` |
| 无法监控数组索引和长度变化 | 需要重写数组方法 |
| 深度响应式需要递归遍历 | 初始化性能开销大 |
| Map/Set 等集合类型不支持 | 只能处理普通对象 |

### 1.2 Vue 3 Proxy 实现

```javascript
// Vue 3 响应式核心实现
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      // 依赖收集
      track(target, key);

      const res = Reflect.get(target, key, receiver);

      // 深度响应式：懒代理
      if (isObject(res)) {
        return reactive(res);
      }

      return res;
    },

    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);

      // 触发更新
      if (hasChanged(value, oldValue)) {
        trigger(target, key);
      }

      return result;
    },

    deleteProperty(target, key) {
      const hadKey = hasOwn(target, key);
      const result = Reflect.deleteProperty(target, key);

      // 删除也需要触发更新
      if (hadKey && result) {
        trigger(target, key);
      }

      return result;
    }
  });
}
```

### Proxy 的优势

| 优势 | 说明 |
|------|------|
| 拦截 13 种操作 | get, set, deleteProperty, has, ownKeys 等 |
| 支持动态属性 | 自动拦截新增/删除属性 |
| 原生数组支持 | 索引和长度变化都能捕获 |
| 集合类型支持 | Map, Set, WeakMap, WeakSet |
| 懒代理 | 深层对象访问时才创建代理 |

## 二、依赖收集机制

### 2.1 数据结构设计

```javascript
// 弱映射存储依赖，避免内存泄漏
const targetMap = new WeakMap();  // target -> Map<key, Set<effect>>

function track(target, key) {
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }

  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }

  // 添加当前激活的 effect
  if (!deps.has(activeEffect)) {
    deps.add(activeEffect);
    activeEffect.deps.push(deps);
  }
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const deps = depsMap.get(key);
  if (deps) {
    deps.forEach(effect => {
      if (effect.options.scheduler) {
        effect.options.scheduler(effect);  // 调度执行
      } else {
        effect();  // 直接执行
      }
    });
  }
}
```

### 2.2 effect 调度

```javascript
let activeEffect = null;
const effectStack = [];

function effect(fn, options = {}) {
  const effectFn = () => {
    try {
      activeEffect = effectFn;
      effectStack.push(effectFn);
      return fn();  // 执行时会触发 get，进行依赖收集
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  };

  effectFn.deps = [];
  effectFn.options = options;

  if (!options.lazy) {
    effectFn();
  }

  return effectFn;
}
```

## 三、编译时优化：Patch Flags

### 3.1 编译前后对比

**编译前：**
```vue
<template>
  <div>
    <span>{{ message }}</span>
    <button @click="handleClick">Click</button>
  </div>
</template>
```

**编译后：**
```javascript
import { createElementVNode } from 'vue'

const _hoisted_1 = /*#__PURE__*/ createElementVNode(
  "button",
  { onClick: handleClick },
  "Click",
  8,  // PROPS patch flag
  ["onClick"]
)

export function render(_ctx) {
  return (_openBlock(),
    _createElementBlock("div", null, [
      _createElementVNode(
        "span",
        null,
        _toDisplayString(_ctx.message),
        1  // TEXT patch flag
      ),
      _hoisted_1
    ])
  )
}
```

### 3.2 Patch Flags 类型

```javascript
const PatchFlags = {
  TEXT: 1,           // 动态文本节点
  CLASS: 2,          // 动态 class
  STYLE: 4,          // 动态 style
  PROPS: 8,          // 动态 props
  FULL_PROPS: 16,    // 完整 props（动态 key）
  HYDRATE_EVENTS: 32,// 事件监听
  STABLE_FRAGMENT: 64,    // 稳定 fragment
  KEYED_FRAGMENT: 128,    // key 化 fragment
  UNKEYED_FRAGMENT: 256,  // 无 key fragment
  NEED_PATCH: 512,        // 需要补丁
  DYNAMIC_SLOTS: 1024,    // 动态插槽
  HOISTED: -1,       // 静态节点（跳过 diff）
  BAIL: -2           // 放弃优化
}
```

### 3.3 运行时 diff 优化

```javascript
// 带 Patch Flags 的 diff
function patch(n1, n2, container, anchor) {
  const { type, ref, shapeFlag, patchFlag, dynamicProps } = n2;

  if (patchFlag > 0) {
    // 有 patch flag，跳过类型对比

    if (patchFlag & PatchFlags.TEXT) {
      // 只对比文本内容
      if (n1.children !== n2.children) {
        container.textContent = n2.children;
      }
    }

    if (patchFlag & PatchFlags.PROPS) {
      // 只对比动态 props
      for (let i = 0; i < dynamicProps.length; i++) {
        const key = dynamicProps[i];
        patchProp(n1.el, key, n1.props[key], n2.props[key]);
      }
    }
  } else if (patchFlag < 0) {
    // 完全静态节点，跳过更新
    if (patchFlag === PatchFlags.HOISTED) {
      return;
    }
  } else {
    // 无 flag，完整 diff
    fullDiff(n1, n2);
  }
}
```

## 四、虚拟 DOM diff 算法优化

### 4.1 最长递增子序列（LIS）优化

```javascript
// Vue 3 diff 核心优化
function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;

  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = ((u + v) / 2) | 0;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }

  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }

  return result;
}
```

### 4.2 diff 策略

1. **key 相同即为相同节点**：直接复用，减少 DOM 操作
2. **只对比同级节点**：时间复杂度 O(n)
3. **LIS 优化移动次数**：最少移动完成重排

## 五、ref vs reactive 选择

### 5.1 实现差异

```javascript
// ref 实现
function ref(value) {
  return createRef(value, false);
}

function createRef(rawValue, shallow) {
  if (isRef(rawValue)) {
    return rawValue;
  }

  const r = {
    _value: rawValue,
    __v_isRef: true
  };

  return shallow
    ? new ShallowRefImpl(r)
    : new RefImpl(r);
}

// reactive 实现
function reactive(target) {
  return createReactiveObject(target, false);
}
```

### 5.2 选择指南

| 场景 | 推荐 | 原因 |
|------|------|------|
| 基本类型 | ref | reactive 需要对象 |
| 对象/数组 | reactive | 自动深度响应式 |
| 可能为 null | ref | reactive 要求非 null |
| 需要替换整个对象 | ref | reactive 替换会丢失响应式 |
| 组合式 API 返回值 | ref | 统一解包行为 |

## 六、工程应用

### 6.1 响应式性能优化

```javascript
// 避免不必要的深度响应式
const shallowState = shallowReactive({
  largeArray: [...]  // 大数组，不需要深度响应式
});

// 只读优化
const readonlyState = readonly(state);

// 标记不需要响应式的属性
const state = reactive({
  [toRawSymbol]: someValue  // 内部属性，不参与响应式
});
```

### 6.2 常见问题排查

1. **解构丢失响应式**
   ```javascript
   // 错误
   let { count } = state;

   // 正确
   let { count } = toRefs(state);
   ```

2. **数组响应式**
   ```javascript
   // Vue 3 原生支持
   state.array.push(item);
   state.array[index] = value;
   ```

## 七、理解检查清单

- [ ] 能解释 Proxy 相比 defineProperty 的优势吗？
- [ ] 能手绘依赖收集流程图吗？
- [ ] 理解 Patch Flags 如何优化 diff 吗？
- [ ] 知道 LIS 算法在 diff 中的应用吗？
- [ ] 能说明 ref 和 reactive 的选择场景吗？

## 八、源码位置参考

- `packages/reactivity/src/baseHandlers.ts` - Proxy 处理器
- `packages/reactivity/src/effect.ts` - 依赖收集
- `packages/runtime-core/src/vnode.ts` - Patch Flags
- `packages/runtime-core/src/renderer.ts` - diff 算法

---

*最后更新：2026-03-03*
