/**
 * Mini-React - 简化版 React 实现
 * 用于理解 Fiber 架构和 Hooks 原理
 *
 * 功能：
 * - Fiber 数据结构
 * - 双缓存机制
 * - 简单的调度器
 * - Hooks 支持 (useState, useEffect)
 * - 基础 Diff 算法
 */

// =============================================
// 1. Fiber 数据结构
// =============================================

class FiberNode {
  constructor(type, props, key) {
    this.type = type;        // 组件类型 ('div', 'span', FunctionComponent)
    this.props = props;      // 属性
    this.key = key;          // key 用于 diff

    // Fiber 链表结构
    this.return = null;      // 父节点
    this.child = null;       // 第一个子节点
    this.sibling = null;     // 下一个兄弟节点

    // DOM 节点
    this.stateNode = null;   // 对应的 DOM 元素

    // 双缓存
    this.alternate = null;   // 指向另一个 Fiber（current/workInProgress）

    // 副作用
    this.flags = 0;          // 副作用标记
    this.subtreeFlags = 0;   // 子树副作用
    this.deletions = null;   // 需要删除的子节点

    // Hooks（仅函数组件）
    this.memoizedState = null; // Hooks 链表头
    this.updateQueue = null;   // 更新队列
  }
}

// 副作用标记
const Flags = {
  NoFlags: 0b000,
  Placement: 0b001,      // 插入
  Update: 0b010,         // 更新
  ChildDeletion: 0b100,  // 子节点删除
  Deletion: 0b1000,      // 删除
};

// =============================================
// 2. 全局状态
// =============================================

let root = null;                    // 根 Fiber
let workInProgress = null;          // 当前工作的 Fiber
let currentHostRootFiber = null;    // 当前根 Fiber

// 副作用链表
let firstEffect = null;
let lastEffect = null;

// =============================================
// 3. 创建 Fiber
// =============================================

function createFiber(type, props, key) {
  return new FiberNode(type, props, key);
}

function createWorkInProgress(current) {
  let wip = current.alternate;
  if (wip === null) {
    wip = createFiber(current.type, current.props, current.key);
    wip.alternate = current;
    current.alternate = wip;
  } else {
    // 复用已有 Fiber，重置属性
    wip.props = current.props;
    wip.memoizedState = current.memoizedState;
    wip.updateQueue = current.updateQueue;
    wip.flags = 0;
    wip.subtreeFlags = 0;
    wip.deletions = null;
  }
  return wip;
}

// =============================================
// 4. Render 阶段 - 构建 Fiber 树
// =============================================

function beginWork(fiber) {
  console.log('beginWork:', fiber.type);

  if (typeof fiber.type === 'function') {
    // 函数组件
    return updateFunctionComponent(fiber);
  } else {
    // 宿主组件（DOM 元素）
    return updateHostComponent(fiber);
  }
}

function updateFunctionComponent(fiber) {
  const Component = fiber.type;
  const props = fiber.props;

  // 准备 Hooks
  prepareToUseHooks(fiber);

  // 渲染组件
  const children = Component(props);

  // 完成 Hooks
  finishHooks();

  // 调和子节点
  return reconcileChildren(fiber, children);
}

function updateHostComponent(fiber) {
  // 创建或更新 DOM 节点
  if (!fiber.stateNode) {
    fiber.stateNode = document.createElement(fiber.type);
  }

  // 调和子节点
  return reconcileChildren(fiber, fiber.props.children);
}

// =============================================
// 5. 调和子节点（简化版 Diff）
// =============================================

function reconcileChildren(wipFiber, children) {
  if (!children) return null;

  // 将 children 转为数组
  const newChildren = Array.isArray(children) ? children : [children];

  let prevFiber = null;
  let index = 0;
  let oldFiber = wipFiber.child;

  while (index < newChildren.length || oldFiber !== null) {
    const newChild = newChildren[index];
    const sameType =
      oldFiber &&
      newChild &&
      oldFiber.type === newChild.type;

    let newFiber;

    if (sameType) {
      // 类型相同，更新
      newFiber = createWorkInProgress(oldFiber);
      newFiber.props = newChild.props;
      newFiber.flags = Flags.Update;
    } else {
      // 类型不同，创建新 Fiber
      if (newChild) {
        newFiber = createFiber(
          newChild.type,
          newChild.props,
          newChild.key
        );
        newFiber.flags = Flags.Placement;
      }

      // 标记旧 Fiber 为删除
      if (oldFiber) {
        oldFiber.flags = Flags.Deletion;
        if (wipFiber.deletions === null) {
          wipFiber.deletions = [];
        }
        wipFiber.deletions.push(oldFiber);
      }
    }

    // 链接 Fiber
    if (newFiber) {
      if (index === 0) {
        wipFiber.child = newFiber;
      } else {
        prevFiber.sibling = newFiber;
      }
      newFiber.return = wipFiber;
    }

    prevFiber = newFiber;
    oldFiber = oldFiber ? oldFiber.sibling : null;
    index++;
  }

  return wipFiber.child;
}

// =============================================
// 6. Commit 阶段 - 提交到 DOM
// =============================================

function commitWork(fiber) {
  if (!fiber) return;

  // 处理副作用链表
  let effect = firstEffect;
  while (effect) {
    commitEffect(effect);
    effect = effect.nextEffect;
  }
}

function commitEffect(fiber) {
  const flags = fiber.flags;

  if (flags & Flags.Placement) {
    // 插入
    const parent = fiber.return.stateNode || document;
    parent.appendChild(fiber.stateNode);
  }

  if (flags & Flags.Update) {
    // 更新属性
    updateHostComponentProps(fiber);
  }

  if (flags & Flags.Deletion) {
    // 删除
    const parent = fiber.return?.stateNode || document;
    parent.removeChild(fiber.stateNode);
  }
}

function updateHostComponentProps(fiber) {
  const node = fiber.stateNode;
  const oldProps = fiber.alternate?.props || {};
  const newProps = fiber.props;

  // 更新事件监听
  for (const key in newProps) {
    if (key.startsWith('on') && typeof newProps[key] === 'function') {
      node.addEventListener(key.toLowerCase().slice(2), newProps[key]);
    } else if (key !== 'children' && oldProps[key] !== newProps[key]) {
      node.setAttribute(key, newProps[key]);
    }
  }
}

// =============================================
// 7. 调度器（简化版）
// =============================================

function scheduleUpdateOnFiber(fiber) {
  ensureRootIsScheduled(fiber);
}

function ensureRootIsScheduled(rootFiber) {
  // 简化：立即执行
  workLoop();
  commitRoot();
}

function workLoop() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber) {
  // 开始工作
  const next = beginWork(fiber);

  if (next) {
    workInProgress = next;
    return;
  }

  // 完成工作，回到父节点
  let complete = fiber;
  while (complete) {
    const nextSibling = complete.sibling;
    if (nextSibling) {
      workInProgress = nextSibling;
      return;
    }
    complete = complete.return;
  }
}

function commitRoot() {
  // 收集副作用
  collectEffects(root);

  // 提交到 DOM
  commitWork(root);

  // 清理
  firstEffect = null;
  lastEffect = null;
}

function collectEffects(fiber) {
  if (!fiber) return;

  // 收集当前 Fiber 的副作用
  if (fiber.flags & (Flags.Placement | Flags.Update | Flags.Deletion)) {
    if (firstEffect === null) {
      firstEffect = fiber;
      lastEffect = fiber;
    } else {
      lastEffect.nextEffect = fiber;
      lastEffect = fiber;
    }
  }

  // 递归收集子树
  collectEffects(fiber.child);
  collectEffects(fiber.sibling);
}

// =============================================
// 8. Hooks 实现
// =============================================

let hooks = [];          // Hooks 链表
let currentHookIndex = 0; // 当前 Hook 索引
let isMount = true;      // 是否首次渲染

function prepareToUseHooks(fiber) {
  if (isMount) {
    hooks = [];
    currentHookIndex = 0;
  } else {
    hooks = fiber.memoizedState || [];
    currentHookIndex = 0;
  }
}

function finishHooks() {
  workInProgress.memoizedState = hooks;
  isMount = false;
}

function useState(initialState) {
  const hookIndex = currentHookIndex++;

  if (isMount) {
    // Mount：创建新 Hook
    const hook = {
      state: initialState,
      queue: [],
      next: null,
    };

    if (hooks.length === 0) {
      hooks[0] = hook;
    } else {
      const prevHook = hooks[hookIndex - 1];
      prevHook.next = hook;
    }
    hooks.push(hook);

    return [hook.state, createDispatch(hookIndex)];
  } else {
    // Update：获取已有 Hook
    const hook = hooks[hookIndex];

    // 处理队列中的更新
    hook.queue.forEach(update => {
      hook.state = typeof update === 'function' ? update(hook.state) : update;
    });
    hook.queue = [];

    return [hook.state, createDispatch(hookIndex)];
  }
}

function createDispatch(hookIndex) {
  return function dispatch(update) {
    const hook = hooks[hookIndex];
    hook.queue.push(update);

    // 触发重新渲染
    scheduleUpdateOnFiber(workInProgress);
  };
}

function useEffect(effect, deps) {
  const hookIndex = currentHookIndex++;

  if (isMount) {
    const hook = {
      effect,
      deps,
      next: null,
    };

    if (hooks.length === 0) {
      hooks[0] = hook;
    } else {
      const prevHook = hooks[hookIndex - 1];
      prevHook.next = hook;
    }
    hooks.push(hook);

    // 首次渲染后执行
    setTimeout(effect, 0);
  } else {
    const hook = hooks[hookIndex];

    // 依赖变化时执行
    const depsChanged =
      !hook.deps ||
      deps.some((dep, i) => dep !== hook.deps[i]);

    if (depsChanged) {
      hook.effect = effect;
      hook.deps = deps;
      setTimeout(effect, 0);
    }
  }
}

// =============================================
// 9. 公共 API
// =============================================

const MiniReact = {
  createElement(type, props, ...children) {
    return {
      type,
      props: {
        ...props,
        children: children.length === 1 ? children[0] : children,
      },
    };
  },

  render(element, container) {
    // 创建根 Fiber
    root = createFiber(() => element, {}, null);
    root.stateNode = container;
    currentHostRootFiber = root;

    // 调度更新
    scheduleUpdateOnFiber(root);
  },

  useState,
  useEffect,
};

// 导出
export { MiniReact, FiberNode, Flags };
