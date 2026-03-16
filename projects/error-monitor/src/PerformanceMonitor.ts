/**
 * 性能监控 SDK
 * 监控 Web Vitals 指标：FCP、LCP、FID、CLS、TTI
 */

export interface PerformanceConfig {
  reportUrl: string;
  appId?: string;
  environment?: string;
  sampleRate?: number;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  sessionId: string;
  pagePath: string;
  timestamp: number;
  appId?: string;
  environment?: string;
  meta?: Record<string, any>;
}

export class PerformanceMonitor {
  private config: Required<PerformanceConfig>;
  private sessionId: string;
  private metrics: Map<string, PerformanceMetric> = new Map();

  constructor(config: PerformanceConfig) {
    this.config = {
      reportUrl: config.reportUrl,
      appId: config.appId ?? 'unknown',
      environment: config.environment ?? 'production',
      sampleRate: config.sampleRate ?? 0.1,
    };
    this.sessionId = this.generateSessionId();
    this.init();
  }

  private generateSessionId(): string {
    return 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  private init(): void {
    // 采样检查
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    this.observeFCP();
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeTTI();
  }

  /**
   * 1. FCP - First Contentful Paint
   * 首次内容绘制时间
   */
  private observeFCP(): void {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        if (entry.name === 'first-contentful-paint') {
          this.reportMetric({
            name: 'FCP',
            value: entry.startTime,
            rating: this.getFCPRating(entry.startTime),
            delta: entry.startTime,
          });
        }
      }
    }).observe({ entryTypes: ['paint'] });
  }

  private getFCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value < 1800) return 'good';
    if (value < 3000) return 'needs-improvement';
    return 'poor';
  }

  /**
   * 2. LCP - Largest Contentful Paint
   * 最大内容绘制时间
   */
  private observeLCP(): void {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.reportMetric({
        name: 'LCP',
        value: lastEntry.startTime,
        rating: this.getLCPRating(lastEntry.startTime),
        delta: lastEntry.startTime,
        meta: {
          element: (lastEntry as any).element?.tagName,
          url: (lastEntry as any).url,
        },
      });
    }).observe({ entryTypes: ['largest-contentful-paint'] });
  }

  private getLCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value < 2500) return 'good';
    if (value < 4000) return 'needs-improvement';
    return 'poor';
  }

  /**
   * 3. FID - First Input Delay
   * 首次输入延迟
   */
  private observeFID(): void {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        if (entry.entryType === 'first-input') {
          const fid = entry.processingStart - entry.startTime;
          this.reportMetric({
            name: 'FID',
            value: fid,
            rating: this.getFIDRating(fid),
            delta: fid,
          });
        }
      }
    }).observe({ entryTypes: ['first-input'] });
  }

  private getFIDRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value < 100) return 'good';
    if (value < 300) return 'needs-improvement';
    return 'poor';
  }

  /**
   * 4. CLS - Cumulative Layout Shift
   * 累积布局偏移
   */
  private observeCLS(): void {
    let clsValue = 0;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // 只计算非用户输入的布局偏移
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }

      this.reportMetric({
        name: 'CLS',
        value: clsValue,
        rating: this.getCLSRating(clsValue),
        delta: clsValue,
      });
    }).observe({ entryTypes: ['layout-shift'] });
  }

  private getCLSRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value < 0.1) return 'good';
    if (value < 0.25) return 'needs-improvement';
    return 'poor';
  }

  /**
   * 5. TTI - Time to Interactive
   * 可交互时间（通过长任务估算）
   */
  private observeTTI(): void {
    let ttiValue = 0;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          // 长任务
          ttiValue = Math.max(ttiValue, entry.startTime + entry.duration);
        }
      }

      this.reportMetric({
        name: 'TTI',
        value: ttiValue,
        rating: this.getTTIRating(ttiValue),
        delta: ttiValue,
      });
    }).observe({ entryTypes: ['longtask'] });
  }

  private getTTIRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value < 3800) return 'good';
    if (value < 7300) return 'needs-improvement';
    return 'poor';
  }

  /**
   * 报告性能指标
   */
  private reportMetric(metric: Omit<PerformanceMetric, 'sessionId' | 'pagePath' | 'timestamp' | 'appId' | 'environment'>): void {
    // 去重（只报告显著变化）
    const existingMetric = this.metrics.get(metric.name);
    if (existingMetric && Math.abs(metric.value - existingMetric.value) < 100) {
      return; // 变化不大，不上报
    }

    const fullMetric: PerformanceMetric = {
      ...metric,
      sessionId: this.sessionId,
      pagePath: window.location.pathname,
      timestamp: Date.now(),
      appId: this.config.appId,
      environment: this.config.environment,
    };

    this.metrics.set(metric.name, fullMetric);

    // 批量上报
    this.send(fullMetric);
  }

  /**
   * 发送指标数据
   */
  private send(metric: PerformanceMetric): void {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        this.config.reportUrl,
        JSON.stringify({ metric })
      );
    } else {
      fetch(this.config.reportUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric }),
        keepalive: true,
      }).catch(console.error);
    }
  }

  /**
   * 获取当前会话的所有指标
   */
  getMetrics(): Map<string, PerformanceMetric> {
    return new Map(this.metrics);
  }
}

export default PerformanceMonitor;
