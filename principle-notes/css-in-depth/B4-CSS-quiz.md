# CSS 渲染机制与布局系统 - 苏格拉底式测验

> 采用苏格拉底方法：先思考，再回答，最后对照答案加深理解

---

## 问题 1：CSS 渲染流程

**问题：** 浏览器是如何将 CSS 渲染到屏幕上的？请按顺序说明每个阶段。

<details>
<summary>💡 点击查看提示</summary>
提示：从 HTML 解析开始，到屏幕显示，中间经历了哪些步骤？
</details>

<details>
<summary>✅ 点击查看答案</summary>

**答案：**
1. HTML → DOM（文档对象模型）
2. CSS → CSSOM（CSS 对象模型）
3. DOM + CSSOM → Render Tree（渲染树）
4. Layout（布局/回流）- 计算元素位置和大小
5. Paint（绘制）- 填充像素
6. Composite（合成）- 图层合并
7. 屏幕显示

**关键点：**
- CSSOM 构建会阻塞渲染，但不会阻塞 HTML 解析
- 只有可见元素（display 不为 none）才会进入 Render Tree
</details>

---

## 问题 2：回流 vs 重绘

**问题：** Reflow（回流）和 Repaint（重绘）的区别是什么？哪个性能消耗更大？

<details>
<summary>💡 点击查看提示</summary>
提示：想想改变 width 和改变 color 分别会触发什么？
</details>

<details>
<summary>✅ 点击查看答案</summary>

**答案：**

| 对比 | Reflow（回流） | Repaint（重绘） |
|------|---------------|----------------|
| 定义 | 重新计算元素位置和大小 | 重新绘制元素外观 |
| 触发 | width/height/top/left、添加删除 DOM | color、background-color、visibility |
| 性能 | 高消耗 | 中等消耗 |
| 范围 | 可能影响整个文档 | 只影响元素本身 |

**性能消耗：** Layout >>> Paint > Composite

**示例：**
```css
/* 触发回流 */
.element { width: 200px; }

/* 只触发重绘 */
.element { color: red; }

/* 只触发合成（性能最好） */
.element { transform: translateX(100px); }
```
</details>

---

## 问题 3：CSS 选择器匹配方向

**问题：** 浏览器是从左到右还是从右到左匹配 CSS 选择器？为什么？

<details>
<summary>💡 点击查看提示</summary>
提示：假设你有 1000 个 div，但只有 10 个有 class="active"，哪种匹配方式更快？
</details>

<details>
<summary>✅ 点击查看答案</summary>

**答案：** 从右往左匹配

**原因：**
- 右边的选择器更具体，可以更快缩小范围
- 从具体到抽象的匹配效率更高

**示例：**
```css
div.container ul.nav li a.active { }

/* 浏览器匹配顺序： */
/* 1. 找到所有 a.active（可能只有几个） */
/* 2. 过滤出 li 下的 a（范围缩小） */
/* 3. 过滤出 ul.nav 下的 li（范围继续缩小） */
/* 4. 过滤出 div.container 下的 ul（最终结果） */
```

**如果从左到右：**
- 先找所有 div（可能几千个）
- 再筛选有 container 类的（可能几百个）
- 效率低得多！
</details>

---

## 问题 4：优先级计算

**问题：** 计算以下选择器的优先级：
```css
div#header.nav.active > a:hover
```

<details>
<summary>💡 点击查看提示</summary>
提示：ID 选择器、类选择器、标签选择器、伪类的权重分别是多少？
</details>

<details>
<summary>✅ 点击查看答案</summary>

**答案：** (0, 1, 3, 1)

**计算过程：**
```
div#header.nav.active > a:hover
= 1 个 ID (#header)     → (0, 1, 0, 0)
+ 3 个类 (.nav, .active, :hover) → (0, 0, 3, 0)
+ 1 个标签 (div, a 算 1 个，因为 a 是伪类的目标) → (0, 0, 0, 1)
= (0, 1, 3, 1)
```

**优先级对比：**
```css
* {}                    /* (0,0,0,0) */
li {}                   /* (0,0,0,1) */
ul li {}                /* (0,0,0,2) */
#nav {}                 /* (0,1,0,0) - 高于上面所有 */
#nav a.active:hover {}  /* (0,1,2,1) */
</details>

---

## 问题 5：BFC 触发条件

**问题：** 列举至少 5 种触发 BFC 的方法。

<details>
<summary>💡 点击查看提示</summary>
提示：想想 float、position、overflow、display 这些属性
</details>

<details>
<summary>✅ 点击查看答案</summary>

**答案：** 满足以下任一条件即触发 BFC：

1. **根元素** - html
2. **float 不为 none** - float: left/right
3. **position 不为 static/relative** - position: absolute/fixed
4. **display 为特定值** - inline-block, flow-root, table-cell, flex, grid
5. **overflow 不为 visible** - overflow: hidden/auto/scroll
6. **contain 为特定值** - contain: layout/content/strict
7. **column-count 不为 none/auto**

**最常用的是：**
```css
/* 清除浮动 */
.clearfix { overflow: hidden; }

/* 创建独立渲染区域 */
.container { display: flow-root; }
```
</details>

---

## 问题 6：BFC 解决的布局问题

**问题：** BFC 可以解决哪些常见的布局问题？请举例说明。

<details>
<summary>💡 点击查看提示</summary>
提示：想想浮动元素导致父元素高度塌陷的问题
</details>

<details>
<summary>✅ 点击查看答案</summary>

**答案：** BFC 解决 3 个主要问题：

### 问题 1：清除浮动（父元素高度塌陷）

```html
<!-- 问题 -->
<div class="parent">
  <div class="child" style="float: left;"></div>
</div>
<!-- .parent 高度为 0 -->

<!-- 解决 -->
<div class="parent" style="overflow: hidden;">
  <div class="child" style="float: left;"></div>
</div>
<!-- .parent 高度自动包含浮动元素 -->
```

### 问题 2：防止 margin 重叠

```css
/* 问题：垂直方向 margin 重叠 */
.div1 { margin-bottom: 20px; }
.div2 { margin-top: 30px; }
/* 实际间距 = max(20, 30) = 30px */

/* 解决 */
.div2 { overflow: hidden; }
/* 触发 BFC 后，margin 不重叠 */
```

### 问题 3：自适应两栏布局

```html
<div style="display: flow-root;">
  <div style="float: left; width: 200px;">左侧固定</div>
  <div style="overflow: hidden;">右侧自适应</div>
</div>
```
</details>

---

## 问题 7：层叠上下文创建条件

**问题：** 哪些 CSS 属性会创建新的层叠上下文？

<details>
<summary>💡 点击查看提示</summary>
提示：想想 position、transform、opacity 这些属性
</details>

<details>
<summary>✅ 点击查看答案</summary>

**答案：** 以下条件会创建层叠上下文：

1. **根元素** - html
2. **position + z-index** - position: relative/absolute/fixed 且 z-index 不为 auto
3. **opacity 不为 1** - opacity: 0.9
4. **transform 不为 none** - transform: translateX(0)
5. **filter 不为 none** - filter: blur(5px)
6. **will-change** - will-change: transform
7. **contain** - contain: layout/paint/strict/content
8. **flex/grid 子元素** - z-index 非 auto 时
9. **isolation: isolate**

**示例：**
```css
.parent {
  transform: translateX(0);  /* 创建层叠上下文 */
}
.child {
  position: relative;
  z-index: 999;  /* 只在.parent 内生效 */
}
```
</details>

---

## 问题 8：z-index 不生效的原因

**问题：** 为什么有时候设置了 z-index 但不生效？

<details>
<summary>💡 点击查看提示</summary>
提示：想想 z-index 需要配合什么属性使用？层叠上下文的影响？
</details>

<details>
<summary>✅ 点击查看答案</summary>

**答案：** z-index 不生效的 3 个常见原因：

### 原因 1：position 不是 relative/absolute/fixed

```css
/* ❌ 不生效 */
.element { z-index: 10; }

/* ✅ 生效 */
.element {
  position: relative;
  z-index: 10;
}
```

### 原因 2：父元素创建了层叠上下文

```css
.parent {
  transform: translateX(0);  /* 创建层叠上下文 */
}
.child {
  position: relative;
  z-index: 999;  /* 只在.parent 内生效，无法超越外部元素 */
}
```

### 原因 3：层叠顺序限制

```
同一层叠上下文内：
- 负 z-index < 0 < 正 z-index
- 数字越大，层级越高

不同层叠上下文：
- 父元素的层级决定子元素的层级上限
```
</details>

---

## 问题 9：CSS 动画性能优化

**问题：** 为什么使用 transform 做动画比使用 top/left 性能更好？

<details>
<summary>💡 点击查看提示</summary>
提示：回想一下 Layout、Paint、Composite 三个阶段
</details>

<details>
<summary>✅ 点击查看答案</summary>

**答案：**

### top/left 动画（差性能）

```css
@keyframes move {
  to { top: 100px; left: 100px; }
}
```
**触发流程：** Layout → Paint → Composite
- 每次改变位置都要重新计算布局
- 性能消耗大，容易卡顿

### transform 动画（好性能）

```css
@keyframes move {
  to { transform: translate(100px, 100px); }
}
```
**触发流程：** Composite only
- 只触发合成阶段
- GPU 加速，性能高

### 性能对比

| 方案 | 触发阶段 | FPS | 内存占用 |
|------|----------|-----|----------|
| top/left | Layout → Paint → Composite | 30-45 | 低 |
| transform | Composite only | 55-60 | 稍高（创建合成层） |
</details>

---

## 问题 10：will-change 的使用

**问题：** will-change 的作用是什么？使用时有什么注意事项？

<details>
<summary>💡 点击查看提示</summary>
提示：will-change 是提前告知浏览器哪些属性会变化，但滥用会怎样？
</details>

<details>
<summary>✅ 点击查看答案</summary>

**答案：**

### will-change 的作用

```css
.optimized {
  will-change: transform, opacity;
}
```

- 提前告知浏览器哪些属性会变化
- 浏览器提前创建合成层（GPU 加速）
- 动画开始时更流畅

### 注意事项

**❌ 错误用法：**
```css
/* 滥用 will-change */
* { will-change: transform; }  /* 内存浪费！ */
.every-element { will-change: transform; }
```

**✅ 正确用法：**
```css
/* 只用于确实会动画的元素 */
.animated-element {
  will-change: transform;
}

/* 动画结束后移除 */
element.addEventListener('animationend', () => {
  element.style.willChange = 'auto';
});
```

### 最佳实践

1. 不要提前在所有元素上添加 will-change
2. 在动画开始前动态添加
3. 动画结束后移除
4. 只用于真正需要优化的属性
</details>

---

## 📊 自我评估

完成所有问题后，统计你的得分：

| 答对题数 | 评级 | 建议 |
|----------|------|------|
| 10 题 | 🏆 专家 | 可以深入源码研究了 |
| 7-9 题 | 🎯 高级 | 理解很好，注意细节 |
| 4-6 题 | 📚 中级 | 复习笔记，做实验 |
| 0-3 题 | 🌱 初级 | 重新学习，动手实践 |

---

## 🎯 下一步

完成测验后：
1. 打开 `experiment.html` 做性能对比实验
2. 使用 DevTools 的 Performance 面板分析
3. 在实际项目中应用所学原理
