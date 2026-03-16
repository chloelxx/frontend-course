/**
 * 前端异常监控 SDK
 * 支持：JS 错误、Promise 错误、资源错误、Vue/React 错误
 */

export interface ErrorMonitorConfig {
  reportUrl: string;
  sampleRate?: number;        // 采样率 (0-1]
  maxErrorsPerBatch?: number; // 批量上报最大数量
  flushInterval?: number;     // 上报间隔 (ms)
  appId?: string;             // 应用 ID
  environment?: string;       // 环境 (production/development)
  userId?: string;            // 用户 ID
}

export interface ErrorPayload {
  type: string;
  message: string;
  stack?: string;
  fingerprint: string;
  timestamp: number;
  url: string;
  pagePath: string;
  userAgent: string;
  userId?: string;
  appId?: string;
  environment: string;
  meta?: Record<string, any>;
}

export class ErrorMonitor {
  private config: Required<ErrorMonitorConfig>;
  private errorQueue: ErrorPayload[] = [];
  private knownErrors: Set<string> = new Set();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing: boolean = false;

  constructor(config: ErrorMonitorConfig) {
    this.config = {
      reportUrl: config.reportUrl,
      sampleRate: config.sampleRate ?? 0.1,
      maxErrorsPerBatch: config.maxErrorsPerBatch ?? 10,
      flushInterval: config.flushInterval ?? 5000,
      appId: config.appId ?? 'unknown',
      environment: config.environment ?? 'production',
      userId: config.userId ?? '',
    };
    this.install();
  }

  /**
   * 安装所有错误处理器
   */
  install(): void {
    this.installJSErrorHandler();
    this.installPromiseHandler();
    this.installResourceHandler();
    this.installVueErrorHandler();
    this.installReactErrorHandler();
  }

  /**
   * 1. JS 运行时错误捕获
   */
  private installJSErrorHandler(): void {
    window.addEventListener('error', (e) => {
      // 忽略资源错误（由 resourceHandler 处理）
      if (e.target instanceof HTMLElement &&
          e.target.tagName !== 'SCRIPT') {
        return;
      }

      this.report({
        type: 'js-error',
        message: e.message,
        stack: e.error?.stack,
        meta: {
          line: e.lineno,
          column: e.colno,
          source: e.filename,
        },
      });
    }, true);
  }

  /**
   * 2. Promise 未捕获错误
   */
  private installPromiseHandler(): void {
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason;
      this.report({
        type: 'promise-error',
        message: reason?.message || String(reason),
        stack: reason?.stack,
        meta: {
          reasonType: typeof reason,
        },
      });
    }, true);
  }

  /**
   * 3. 资源加载错误
   */
  private installResourceHandler(): void {
    window.addEventListener('error', (e) => {
      if (e.target instanceof HTMLElement &&
          (e.target.tagName === 'IMG' ||
           e.target.tagName === 'SCRIPT' ||
           e.target.tagName === 'LINK')) {
        this.report({
          type: 'resource-error',
          message: `Failed to load ${e.target.tagName.toLowerCase()}`,
          meta: {
            tagName: e.target.tagName,
            src: e.target.src || e.target.href,
          },
        });
      }
    }, true);
  }

  /**
   * 4. Vue 错误处理（如果项目使用 Vue）
   */
  private installVueErrorHandler(): void {
    // Vue 2: app.config.errorHandler
    // Vue 3: app.config.errorHandler
    // 需要在应用初始化时手动调用
    // this.setupVueErrorHandler(Vue);
  }

  /**
   * 5. React 错误处理（需要配合 Error Boundary）
   */
  private installReactErrorHandler(): void {
    // React 错误需要通过 Error Boundary 捕获
    // 提供手动报告方法供 Error Boundary 调用
  }

  /**
   * 报告错误
   */
  report(error: Partial<ErrorPayload>): void {
    const payload: ErrorPayload = {
      type: error.type || 'unknown',
      message: error.message || '',
      stack: error.stack,
      fingerprint: this.generateFingerprint(error),
      timestamp: Date.now(),
      url: window.location.href,
      pagePath: this.cleanUrl(window.location.pathname),
      userAgent: navigator.userAgent,
      userId: this.config.userId,
      appId: this.config.appId,
      environment: this.config.environment,
      meta: error.meta || {},
    };

    // 新错误 100% 上报
    if (!this.knownErrors.has(payload.fingerprint)) {
      this.knownErrors.add(payload.fingerprint);
      this.enqueue(payload);
      return;
    }

    // 已知错误采样上报
    if (Math.random() < this.config.sampleRate) {
      this.enqueue(payload);
    }
  }

  /**
   * 手动报告错误（供 Error Boundary 使用）
   */
  reportError(error: Error, info?: { componentStack?: string }): void {
    this.report({
      type: 'react-error-boundary',
      message: error.message,
      stack: error.stack,
      meta: {
        componentStack: info?.componentStack,
      },
    });
  }

  /**
   * 生成错误指纹
   */
  private generateFingerprint(error: Partial<ErrorPayload>): string {
    const key = JSON.stringify({
      message: this.normalizeMessage(error.message || ''),
      stack: this.parseStack(error.stack),
      pagePath: this.cleanUrl(error.pagePath || window.location.pathname),
      type: error.type,
    });
    return this.simpleHash(key);
  }

  /**
   * 标准化错误消息（移除动态值）
   */
  private normalizeMessage(msg: string): string {
    return msg
      .replace(/user_\d+/gi, 'user_<id>')
      .replace(/item_\d+/gi, 'item_<id>')
      .replace(/product_\d+/gi, 'product_<id>')
      .replace(/order_\d+/gi, 'order_<id>')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<ip>')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
      .replace(/\d+/g, '<num>');
  }

  /**
   * 解析堆栈（只保留前 3 帧）
   */
  private parseStack(stack?: string): string {
    if (!stack) return '';
    return stack.split('\n').slice(0, 3).join('\n');
  }

  /**
   * 清理 URL（移除动态参数）
   */
  private cleanUrl(url: string): string {
    return url
      .replace(/\/\d+/g, '/<id>')
      .replace(/\?.*$/, '');
  }

  /**
   * 简单哈希算法
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'err_' + Math.abs(hash).toString(36);
  }

  /**
   * 加入上报队列
   */
  private enqueue(payload: ErrorPayload): void {
    this.errorQueue.push(payload);

    // 达到批次大小立即上报
    if (this.errorQueue.length >= this.config.maxErrorsPerBatch) {
      this.flush();
    } else if (!this.flushTimer) {
      // 否则等待间隔上报
      this.flushTimer = setTimeout(() => this.flush(), this.config.flushInterval);
    }
  }

  /**
   * 批量上报
   */
  private flush(): void {
    if (this.isFlushing || this.errorQueue.length === 0) return;

    this.isFlushing = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    // 使用 sendBeacon（页面卸载时也能发送）
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.config.reportUrl, JSON.stringify({
        errors,
        meta: {
          sdkVersion: '1.0.0',
          timestamp: Date.now(),
        },
      }));
    } else {
      // 降级为 fetch
      fetch(this.config.reportUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors }),
        keepalive: true,
      }).catch(() => {
        // 上报失败，将错误重新加入队列
        this.errorQueue.unshift(...errors);
      });
    }

    this.isFlushing = false;
  }

  /**
   * 设置用户 ID（用户登录后调用）
   */
  setUserId(userId: string): void {
    this.config.userId = userId;
  }

  /**
   * 销毁（清理定时器）
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush(); // 上报剩余错误
  }
}

export default ErrorMonitor;
