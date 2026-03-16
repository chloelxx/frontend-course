# B.4 CSS 渲染机制与布局系统 - 深度学习笔记

> 学习路径：从浏览器渲染原理 → CSS 优先级 → 布局系统 → BFC → 层叠上下文 → 性能优化

---

## 目录

1. [CSS 渲染机制](#1-css-渲染机制)
2. [CSS 选择器与优先级](#2-css-选择器与优先级)
3. [布局系统](#3-布局系统)
4. [BFC 原理](#4-bfc-原理)
5. [层叠上下文](#5-层叠上下文)
6. [CSS 性能优化](#6-css-性能优化)

---

## 1. CSS 渲染机制

### 1.1 浏览器渲染管道

```
┌─────────────────────────────────────────────────────────────┐
│                    浏览器渲染管道                            │
├─────────────────────────────────────────────────────────────┤
│  1. HTML → DOM (文档对象模型)                               │
│  2. CSS → CSSOM (CSS 对象模型)                               │
│  3. DOM + CSSOM → Render Tree (渲染树)                      │
│  4. Layout (布局/回流) - 计算元素位置和大小                  │
│  5. Paint (绘制) - 填充像素                                  │
│  6. Composite (合成) - 图层合并                              │
│  7. 屏幕显示                                                 │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 关键概念对比

| 概念 | 说明 | 阻塞情况 |
|------|------|----------|
| DOM | HTML 解析后的树状结构 | HTML 解析阻塞 |
| CSSOM | CSS 解析后的树状结构 | CSS 解析阻塞 |
| Render Tree | DOM + CSSOM 合并 | 需要 DOM 和 CSSOM 都完成 |
| Layout Tree | Render Tree + 布局信息 | 需要 Render Tree 完成 |

### 1.3 回流 (Reflow) vs 重绘 (Repaint)

**回流（Layout/Reflow）：**
- 定义：浏览器重新计算元素的位置和大小
- 触发条件：
  - 改变元素的宽高、边距、padding
  - 添加或删除 DOM 元素
  - 改变字体大小
  - 调用 `offsetWidth`、`offsetHeight`、`scrollTop`
  - 窗口 resize

**重绘（Repaint）：**
- 定义：浏览器重新绘制元素的外观
- 触发条件：
  - 改变 `color`、`background-color`
  - 改变 `visibility`（注意：display:none 会触发回流）
  - 改变 `border-color`、`box-shadow`

**性能消耗：** Layout >>> Paint > Composite

---

## 2. CSS 选择器与优先级

### 2.1 浏览器匹配机制

**浏览器从右往左匹配选择器！**

```css
/* 示例 */
div.container ul.nav li a.active { }

/* 浏览器匹配顺序： */
/* 1. 找到所有 a.active */
/* 2. 过滤出 li 下的 a */
/* 3. 过滤出 ul.nav 下的 li */
/* 4. 过滤出 div.container 下的 ul */
```

**为什么从右往左？**
- 因为子元素的选择器更具体，可以更快缩小范围
- 父元素可能有很多，但符合条件的子元素较少

### 2.2 优先级计算规则

```
优先级计算（从高到低）：
!important > 内联样式 > ID 选择器 > 类选择器 > 标签选择器 > 通配符

具体计算：
┌─────────────────┬────────────┬───────────────┬────────────┬────────────┐
│ !important      │ 内联样式   │ ID 选择器     │ 类选择器  │ 标签选择器 │
│ -               │ (1,0,0,0)  │ (0,1,0,0)     │ (0,0,1,0) │ (0,0,0,1)  │
└─────────────────┴────────────┴───────────────┴────────────┴────────────┘

示例：
div#header.nav.active > a:hover
= (0, 1, 3, 1)  // 1 个 ID + 3 个类 + 1 个标签
```

### 2.3 优先级对比实验

```css
/* 优先级对比 */
* {}                        /* (0,0,0,0) - 最低 */
li {}                       /* (0,0,0,1) */
ul li {}                    /* (0,0,0,2) */
ul.nav li {}                /* (0,0,1,2) */
ul.nav li a {}              /* (0,0,1,3) */
ul.nav li a.active {}       /* (0,0,2,3) */
#nav a.active {}            /* (0,1,1,1) - 高于上面所有 */
#nav a.active:hover {}      /* (0,1,2,1) */
div#nav a.active:hover {}   /* (0,1,2,2) */
[style*="color"] {}         /* (0,0,1,0) - 属性选择器=类选择器 */
```

### 2.4 !important 规则

```css
/* 优先级覆盖链 */
color: red;                          /* 被下面所有覆盖 */
color: blue !important;              /* 高优先级 */
color: green !important;             /* 覆盖上面的 blue */

/* 注意：!important 只在同一选择器内比较 */
#box { color: red !important; }      /* 获胜 */
.box { color: blue !important; }     /* 失败（ID > 类） */
```

---

## 3. 布局系统

### 3.1 CSS 盒模型

```
┌─────────────────────────────────────────────────────────────┐
│                      标准盒模型                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Border                              │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │                Padding                          │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │              Content                      │  │  │  │
│  │  │  │            (width × height)               │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

box-sizing:
├── content-box（标准）: width = content
├── border-box（IE）: width = content + padding + border
└── 推荐：全局使用 border-box
```

### 3.2 Flexbox 布局

```css
/* 容器属性 */
.container {
  display: flex;

  /* 主轴方向 */
  flex-direction: row | row-reverse | column | column-reverse;

  /* 换行 */
  flex-wrap: nowrap | wrap | wrap-reverse;

  /* 主轴对齐 */
  justify-content: flex-start | flex-end | center | space-between | space-around | space-evenly;

  /* 交叉轴对齐 */
  align-items: stretch | flex-start | flex-end | center | baseline;

  /* 多行时的行间距 */
  align-content: flex-start | flex-end | center | space-between | space-around | stretch;
}

/* 项目属性 */
.item {
  /* 弹性增长/收缩 */
  flex: <flex-grow> <flex-shrink> <flex-basis>;

  /* 简写推荐 */
  flex: 1;              /* flex: 1 1 0% */
  flex: auto;           /* flex: 1 1 auto */
  flex: none;           /* flex: 0 0 auto */

  /* 单独属性 */
  flex-grow: 0;         /* 不增长 */
  flex-shrink: 1;       /* 可收缩 */
  flex-basis: auto;     /* 基准大小 */

  /* 自对齐 */
  align-self: auto | flex-start | flex-end | center | baseline | stretch;

  /* 排序 */
  order: 0;
}
```

### 3.3 Grid 布局

```css
/* 容器定义网格 */
.container {
  display: grid;

  /* 定义列 */
  grid-template-columns: 100px 1fr 2fr;
  grid-template-columns: repeat(3, 1fr);
  grid-template-columns: 200px minmax(100px, 500px) 1fr;

  /* 定义行 */
  grid-template-rows: 100px auto 200px;

  /* 定义区域 */
  grid-template-areas:
    "header header header"
    "sidebar content content"
    "footer footer footer";

  /* 间距 */
  gap: 20px;
  row-gap: 10px;
  column-gap: 20px;
}

/* 项目定位 */
.item {
  /* 定位到具体位置 */
  grid-column-start: 1;
  grid-column-end: 3;
  grid-row-start: 1;
  grid-row-end: 2;

  /* 简写 */
  grid-column: 1 / 3;      /* 从第 1 列到第 3 列 */
  grid-row: 1 / 2;         /* 从第 1 行到第 2 行 */

  /* 使用区域名称 */
  grid-area: header;
}
```

### 3.4 Position 定位

```css
/* 5 种定位方式 */

/* static: 默认，正常文档流 */
.static { position: static; }

/* relative: 相对定位，相对于自身原始位置 */
.relative {
  position: relative;
  top: 10px;  /* 向下 10px */
  left: 20px; /* 向右 20px */
}

/* absolute: 绝对定位，相对于最近的非 static 祖先 */
.absolute {
  position: absolute;
  top: 0;
  right: 0;
}

/* fixed: 固定定位，相对于视口 */
.fixed {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
}

/* sticky: 粘性定位，滚动时固定 */
.sticky {
  position: sticky;
  top: 0;  /* 滚动到顶部时固定 */
}
```

---

## 4. BFC 原理

### 4.1 什么是 BFC？

**BFC (Block Formatting Context)** 块级格式化上下文，是 Web 页面中盒模型布局的 CSS 渲染模式。

**简单理解：** BFC 是一个独立的渲染区域，内部的渲染不会影响外部。

### 4.2 BFC 触发条件

满足以下任一条件即触发 BFC：

```css
/* 1. 根元素 */
html { }

/* 2. float 不为 none */
.float { float: left | right; }

/* 3. position 不为 static/relative */
.positioned { position: absolute | fixed; }

/* 4. display 为特定值 */
.block { display: inline-block | flow-root | table-cell | table-caption | flex | grid; }

/* 5. overflow 不为 visible */
.overflow { overflow: hidden | auto | scroll; }

/* 6. contain 为特定值 */
.contain { contain: layout | content | strict; }

/* 7. columns 不为 none/auto */
.columns { column-count: 2; }
```

### 4.3 BFC 解决的问题

**问题 1：清除浮动**

```html
<!-- 问题：父元素高度塌陷 -->
<div class="parent">
  <div class="child" style="float: left;"></div>
</div>
<!-- .parent 高度为 0 -->

<!-- 解决：触发 BFC -->
<div class="parent" style="overflow: hidden;">
  <div class="child" style="float: left;"></div>
</div>
<!-- .parent 高度自动包含浮动元素 -->
```

**问题 2：防止 margin 重叠**

```css
/* 问题：垂直方向 margin 重叠 */
.div1 { margin-bottom: 20px; }
.div2 { margin-top: 30px; }
/* 实际间距 = max(20, 30) = 30px，不是 50px */

/* 解决：让其中一个元素触发 BFC */
.div2 { overflow: hidden; }
/* 实际间距 = 30px（不会被重叠） */
```

**问题 3：自适应两栏布局**

```html
<div style="display: flow-root;">
  <div style="float: left; width: 200px;">左侧固定</div>
  <div style="overflow: hidden;">右侧自适应</div>
</div>
```

---

## 5. 层叠上下文

### 5.1 什么是层叠上下文？

**层叠上下文 (Stacking Context)** 是 HTML 元素的三维概念，元素在 z 轴上的排序。

### 5.2 层叠上下文创建条件

满足以下任一条件即创建新的层叠上下文：

```css
/* 1. 根元素 */
html { }

/* 2. position + z-index */
.positioned {
  position: relative | absolute | fixed;
  z-index: 1;  /* 必须是 auto 以外的值 */
}

/* 3. opacity 不为 1 */
.opacity { opacity: 0.9; }

/* 4. transform 不为 none */
.transform { transform: translateX(0); }

/* 5. filter 不为 none */
.filter { filter: blur(5px); }

/* 6. will-change */
.will-change { will-change: transform; }

/* 7. contain */
.contain { contain: layout | paint | strict | content; }

/* 8. 弹性/网格项目 */
.flex-child {
  display: flex;
  /* 子元素 z-index 非 auto 时创建 */
}

/* 9. isolation: isolate */
.isolated { isolation: isolate; }
```

### 5.3 z-index 工作机制

```
层叠顺序（从低到高）：
┌─────────────────────────────────────────────────────────┐
│ 1. 背景和边框（层叠上下文内）                            │
│ 2. 负 z-index（层叠上下文内）                            │
│ 3. 块级元素（非定位）                                    │
│ 4. 浮动元素                                              │
│ 5. 行内元素                                              │
│ 6. z-index: auto（定位元素）                             │
│ 7. z-index: 0（正 z-index 层叠上下文）                    │
│ 8. 正 z-index（层叠上下文内）                            │
└─────────────────────────────────────────────────────────┘
```

### 5.4 z-index 不生效的原因

```css
/* 情况 1：position 不是 relative/absolute/fixed */
.element {
  z-index: 10;  /* 不生效！需要 position */
}

/* 情况 2：父元素创建了层叠上下文 */
.parent {
  transform: translateX(0);  /* 创建层叠上下文 */
}
.child {
  position: relative;
  z-index: 999;  /* 只在.parent 内生效，无法超越外部元素 */
}

/* 情况 3：flex/grid 子元素的 z-index */
.parent {
  display: flex;
}
.child {
  z-index: 10;  /* 生效，但创建新的层叠上下文 */
}
```

---

## 6. CSS 性能优化

### 6.1 避免强制同步布局

```javascript
// ❌ 差性能：读写交替
for (let i = 0; i < items.length; i++) {
  items[i].style.width = box.offsetWidth + 'px';  // 读
  items[i].style.height = box.offsetHeight + 'px'; // 写
}

// ✅ 好性能：批量读取，批量写入
const width = box.offsetWidth;   // 批量读
const height = box.offsetHeight;
for (let i = 0; i < items.length; i++) {
  items[i].style.width = width + 'px';   // 批量写
  items[i].style.height = height + 'px';
}
```

### 6.2 使用 transform 代替 top/left

```css
/* ❌ 差性能：触发 Layout */
.animate-bad {
  top: 0;
  animation: move 1s infinite;
}
@keyframes move {
  to { top: 100px; left: 100px; }
}

/* ✅ 好性能：只触发 Composite */
.animate-good {
  animation: move 1s infinite;
}
@keyframes move {
  to { transform: translate(100px, 100px); }
}
```

### 6.3 使用 will-change 提前优化

```css
/* 告知浏览器哪些属性会变化 */
.optimized {
  will-change: transform, opacity;
}

/* 注意：不要滥用 will-change */
/* ❌ 错误用法 */
* { will-change: transform; }  /* 内存浪费 */

/* ✅ 正确用法 */
.dynamic-element {
  will-change: transform;
}
/* 动画结束后移除 */
```

### 6.4 减少复杂选择器

```css
/* ❌ 复杂选择器：匹配慢 */
div.container ul.nav > li:first-child a.active span.icon { }

/* ✅ 简单选择器：匹配快 */
.nav-active-icon { }

/* 选择器性能对比（从快到慢）： */
/* 1. ID 选择器: #header */
/* 2. 类选择器：.nav */
/* 3. 标签选择器：div */
/* 4. 通配符：* */
/* 5. 后代选择器：div ul li a */
```

### 6.5 GPU 加速原理

```
GPU 加速的 CSS 属性：
├── transform（translate/rotate/scale）
├── opacity
├── filter
└── will-change

触发 GPU 加速的条件：
├── 使用上述属性
├── 3D transform: transform: translateZ(0)
└── will-change: transform

如何验证是否启用 GPU 加速？
打开 Chrome DevTools → Rendering 标签 → Layer Borders
启用 GPU 加速的元素会显示绿色边框
```

---

## 课后练习

### 练习 1：性能对比实验

1. 打开 `experiment.html` 文件
2. 观察 top/left vs transform 的 FPS 差异
3. 使用 DevTools 的 Performance 面板分析

### 练习 2：BFC 应用

实现一个两栏布局：
- 左侧固定宽度 200px
- 右侧自适应
- 使用 BFC 解决

### 练习 3：层叠上下文调试

创建一个页面，包含：
- 3 个层叠上下文
- 每个上下文内有不同的 z-index
- 观察层叠顺序

---

## 参考资源

- [MDN - Box 模型](https://developer.mozilla.org/zh-CN/docs/Learn/CSS/Building_blocks/The_box_model)
- [MDN - Flexbox](https://developer.mozilla.org/zh-CN/docs/Learn/CSS/CSS_layout/Flexbox)
- [MDN - Grid](https://developer.mozilla.org/zh-CN/docs/Learn/CSS/CSS_layout/Grids)
- [MDN - BFC](https://developer.mozilla.org/zh-CN/docs/Web/Guide/CSS/Block_formatting_context)
- [Will Change MDN](https://developer.mozilla.org/zh-CN/docs/Web/CSS/will-change)
