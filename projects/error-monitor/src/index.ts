/**
 * 前端 SDK 出口文件
 */

export { ErrorMonitor, default as ErrorMonitorDefault } from './ErrorMonitor';
export { ErrorBoundary } from './ErrorBoundary';
export type { ErrorMonitorConfig, ErrorPayload } from './ErrorMonitor';

// 单例模式获取实例
let instance: ErrorMonitor | null = null;

export function initErrorMonitor(config: Parameters<typeof ErrorMonitor>[0]): ErrorMonitor {
  if (instance) {
    console.warn('ErrorMonitor already initialized. Use getInstance() to access the existing instance.');
    return instance;
  }
  instance = new ErrorMonitor(config);
  return instance;
}

export function getInstance(): ErrorMonitor | null {
  return instance;
}
