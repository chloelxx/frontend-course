# 性能优化深度专项

## 渲染性能深度优化

### 一、性能诊断工具链

#### 1.1 Performance API

```javascript
// 性能观察器配置
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log({
      name: entry.name,
      startTime: entry.startTime,
      duration: entry.duration,
      entryType: entry.entryType
    });
  }
});

// 观察长任务、布局偏移、绘制事件
observer.observe({ entryTypes: ['longtask', 'layout-shift', 'paint'] });

// 测量自定义性能指标
const perfMark = performance.mark('start-render');
// ... 执行渲染
performance.measure('render-time', 'start-render');
```

#### 1.2 Chrome DevTools 性能面板

| 工具 | 用途 |
|------|------|
| Performance | 录制分析运行时性能 |
| Performance Monitor | 实时监控 FPS、CPU、内存 |
| Memory | 内存泄漏诊断 |
| Lighthouse | 综合性能评分 |
| Coverage | JS/CSS 覆盖率分析 |

---

### 二、避免强制同步布局（Force Synchronous Layout）

#### 2.1 问题原理

当 JavaScript 读取布局属性（如 `offsetWidth`）后立即写入样式，浏览器被迫同步执行布局计算，导致性能下降。

#### 2.2 错误示例

```javascript
// 触发强制同步布局
function resizeWidth() {
  for (let i = 0; i < paragraphs.length; i++) {
    paragraphs[i].style.width = box.offsetWidth + 'px';
    // 每次循环都触发一次布局计算
  }
}
```

#### 2.3 优化方案

```javascript
// 批量读取，批量写入
function resizeWidthOptimized() {
  // 先批量读取所有布局信息
  const width = box.offsetWidth;
  const heights = paragraphs.map(p => p.offsetHeight);

  // 使用 requestAnimationFrame 批量写入
  requestAnimationFrame(() => {
    for (let i = 0; i < paragraphs.length; i++) {
      paragraphs[i].style.width = width + 'px';
    }
  });
}
```

#### 2.4 常见触发属性

| 读取操作 | 触发重排 |
|----------|----------|
| offsetWidth, offsetHeight | ✓ |
| clientWidth, clientHeight | ✓ |
| scrollWidth, scrollHeight | ✓ |
| getComputedStyle() | ✓ |
| getBoundingClientRect() | ✓ |

---

### 三、虚拟列表深度优化

#### 3.1 高性能虚拟列表实现要点

```javascript
class VirtualList {
  constructor(options) {
    this.itemHeight = options.itemHeight;
    this.containerHeight = options.containerHeight;
    this.visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    this.bufferCount = 5;  // 缓冲 item 数量

    // 位置缓存
    this.positions = new Map();

    // 使用 transform 代替 top/left
    this.useTransform = true;
  }

  // 动态计算容器大小
  getTotalHeight() {
    return this.items.length * this.itemHeight;
  }

  // 计算可视区域
  getVisibleRange(scrollTop) {
    const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferCount);
    const endIndex = Math.min(
      this.items.length,
      startIndex + this.visibleCount + this.bufferCount * 2
    );
    return { startIndex, endIndex };
  }

  // 使用 transform 进行位移
  renderItems(items, startIndex) {
    const offsetY = startIndex * this.itemHeight;

    // 使用 transform 提升为合成层
    this.contentEl.style.transform = `translate3d(0, ${offsetY}px, 0)`;
  }
}
```

#### 3.2 优化策略总结

| 优化点 | 说明 |
|--------|------|
| 动态计算容器大小 | 避免固定高度导致的空白或溢出 |
| 缓存位置信息 | Map 存储每个 item 的位置，避免重复计算 |
| 使用 Transform | `translate3d` 触发 GPU 加速 |
| 请求空闲时间渲染 | `requestIdleCallback` 批量更新 |
| 预加载可视区外内容 | 缓冲 2 屏数据，提升滚动体验 |

---

### 四、内存泄漏诊断

#### 4.1 常见内存泄漏场景

```javascript
// 1. 未清理的事件监听器
class Component {
  mount() {
    window.addEventListener('resize', this.handleResize);
    // 忘记在 unmount 时移除
  }
}

// 2. 闭包引用大对象
function createClosure() {
  const largeData = new Array(1000000).fill('x');
  return function() {
    console.log('closure');  // largeData 无法释放
  };
}

// 3. 未清除的定时器
setInterval(() => {
  // 组件卸载后仍在执行
}, 1000);

// 4. DOM 引用泄漏
const detachedNodes = [];
function removeNode(node) {
  node.parentNode.removeChild(node);
  detachedNodes.push(node);  // 已移除的 DOM 仍被引用
}
```

#### 4.2 诊断步骤

1. **拍摄堆快照（Heap Snapshot）**
   - Chrome DevTools → Memory → Heap Snapshot
   - 操作前后各拍一张

2. **对比快照**
   - 查找未释放的引用
   - 关注 Detached DOM trees

3. **排查常见泄漏点**
   - 闭包引用
   - 事件监听器
   - 定时器
   - 全局变量

#### 4.3 预防方案

```javascript
// 使用 WeakMap/WeakSet 避免强引用
const cache = new WeakMap();

function getData(obj) {
  if (!cache.has(obj)) {
    cache.set(obj, computeData(obj));
  }
  return cache.get(obj);
}
// obj 被 GC 时，cache 中的引用会自动清理
```

---

## 构建性能深度优化

### 一、Webpack 深度优化

#### 1.1 缓存策略配置

```javascript
// webpack.config.js
module.exports = {
  // 1. 文件系统缓存（Webpack 5）
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename]
    }
  },

  // 2. 模块解析优化
  resolve: {
    symlinks: false,  // 不解析符号链接
    modules: [
      path.resolve('node_modules')  // 限定搜索范围
    ],
    mainFields: ['module', 'main']  // ES Module 优先
  },

  // 3. 代码分割策略
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          chunks: 'all'
        },
        commons: {
          name: 'commons',
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true
        }
      }
    },
    runtimeChunk: 'single'  // 提取 runtime
  }
};
```

#### 1.2 性能分析

```bash
# 分析构建速度
webpack --profile --json > stats.json
npx webpack-bundle-analyzer stats.json

# 分析模块解析耗时
webpack --stats-modules-order speed
```

---

### 二、Vite 性能剖析

#### 2.1 开发服务器优化

```typescript
// vite.config.ts
export default defineConfig({
  // 1. 依赖预构建优化
  optimizeDeps: {
    include: ['lodash-es', 'axios'],  // 强制预构建
    exclude: ['@local/package'],       // 排除本地包
    esbuildOptions: {
      target: 'esnext'  // 使用最新 ES 特性
    }
  },

  // 2. 构建输出优化
  build: {
    target: 'esnext',  // 禁用降级
    minify: 'esbuild',  // 使用 esbuild 压缩

    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        // 内联小文件
        inlineDynamicImports: false
      }
    },

    // 3. 压缩优化
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log']
      }
    }
  }
});
```

#### 2.2 Vite vs Webpack 性能对比

| 指标 | Vite (ESM) | Webpack |
|------|------------|---------|
| 冷启动 | ~100ms | ~10s |
| HMR | <50ms | ~500ms |
| 构建速度 | 快（esbuild） | 较慢 |
| 输出优化 | 相当 | 更成熟 |

---

## 性能优化检查清单

### 渲染性能

- [ ] 避免强制同步布局（先读后写）
- [ ] 使用 transform 代替 top/left
- [ ] 虚拟列表实现正确
- [ ] 使用 will-change 提示浏览器
- [ ] 避免深层嵌套的 Flex/Grid

### JavaScript 性能

- [ ] 避免长任务（>50ms）
- [ ] 使用 Web Worker 处理计算
- [ ] 防抖/节流事件处理
- [ ] 使用 Passive Event Listeners

### 内存优化

- [ ] 及时清理事件监听器
- [ ] 清除定时器
- [ ] 使用 WeakMap/WeakSet
- [ ] 避免闭包泄漏

### 构建优化

- [ ] 启用缓存
- [ ] 代码分割合理
- [ ] 依赖预构建
- [ ] 按需加载

---

*最后更新：2026-03-03*
