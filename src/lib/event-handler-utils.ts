/**
 * 事件处理工具库
 * 提供健壮的事件处理机制，包括事件验证、composedPath polyfill、防抖节流和错误边界
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 事件处理器配置
 */
export interface EventHandlerConfig {
  /** 事件类型 */
  eventType: string;

  /** 防抖配置 */
  debounce?: {
    enabled: boolean;
    delay: number;
    leading?: boolean;
    trailing?: boolean;
  };

  /** 节流配置 */
  throttle?: {
    enabled: boolean;
    interval: number;
    useRAF?: boolean;
  };

  /** 错误处理配置 */
  errorHandling?: {
    recoverable: boolean;
    maxRetries: number;
    retryDelay: number;
  };

  /** 是否需要 composedPath polyfill */
  needsPolyfill: boolean;
}

/**
 * 错误记录
 */
export interface ErrorRecord {
  /** 错误类型 */
  type: string;

  /** 错误消息 */
  message: string;

  /** 堆栈跟踪 */
  stack?: string;

  /** 发生时间 */
  timestamp: number;

  /** 事件上下文 */
  context: string;

  /** 是否可恢复 */
  recoverable: boolean;

  /** 重试次数 */
  retryCount: number;
}

/**
 * 事件指标
 */
export interface EventMetrics {
  /** 事件类型 */
  eventType: string;

  /** 触发次数 */
  triggerCount: number;

  /** 实际执行次数（防抖/节流后） */
  executionCount: number;

  /** 平均响应时间 */
  averageResponseTime: number;

  /** 错误次数 */
  errorCount: number;

  /** 最后触发时间 */
  lastTriggerTime: number;
}

// ============================================================================
// 接口定义
// ============================================================================

/**
 * 事件验证器接口
 */
export interface IEventValidator {
  /** 验证事件对象是否有效 */
  isValidEvent(event: any): boolean;

  /** 确保事件对象具有必要的属性 */
  ensureEventProperties(event: any): Event;

  /** 检查是否需要 polyfill */
  needsPolyfill(event: any): boolean;
}

/**
 * composedPath Polyfill 接口
 */
export interface IComposedPathPolyfill {
  /** 为事件对象添加 composedPath 方法 */
  applyPolyfill(event: Event): void;

  /** 手动构建事件传播路径 */
  buildEventPath(target: EventTarget | null): EventTarget[];

  /** 检测浏览器是否支持 composedPath */
  isSupported(): boolean;
}

/**
 * 事件防抖器接口
 */
export interface IEventDebouncer {
  /** 创建防抖函数 */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
    options?: { leading?: boolean; trailing?: boolean }
  ): (...args: Parameters<T>) => void;

  /** 取消待执行的防抖函数 */
  cancel(): void;

  /** 立即执行防抖函数 */
  flush(): void;
}

/**
 * 事件节流器接口
 */
export interface IEventThrottler {
  /** 创建节流函数 */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    interval: number
  ): (...args: Parameters<T>) => void;

  /** 使用 RAF 的节流（用于动画相关事件） */
  throttleRAF<T extends (...args: any[]) => any>(
    func: T
  ): (...args: Parameters<T>) => void;
}

/**
 * 错误边界接口
 */
export interface IErrorBoundary {
  /** 包装事件处理器 */
  wrapHandler<T extends (...args: any[]) => any>(
    handler: T,
    context?: string
  ): T;

  /** 处理错误 */
  handleError(error: Error, context: string): void;

  /** 判断错误是否可恢复 */
  isRecoverableError(error: Error): boolean;

  /** 重置错误状态 */
  reset(): void;
}

/**
 * 事件处理器管理器接口
 */
export interface IEventHandlerManager {
  /** 注册事件处理器 */
  register(
    element: EventTarget,
    eventType: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void;

  /** 注销事件处理器 */
  unregister(
    element: EventTarget,
    eventType: string,
    handler: EventListener
  ): void;

  /** 清理所有事件处理器 */
  cleanup(): void;

  /** 重置所有事件处理器 */
  reset(): void;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 检查是否为 composedPath 相关错误
 */
export function isComposedPathError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message || '';
  const composedPathPatterns = [
    'composedPath',
    'e.composedPath',
    'event.composedPath',
    'target.composedPath',
    'path.composedPath',
    'composedPath of undefined',
    'composedPath of null',
    'event.composedPath is not a function',
    'event.composedPath is not defined',
    'TypeError: e.composedPath',
    "TypeError: undefined is not an object (evaluating 'e.composedPath')",
  ];

  return composedPathPatterns.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * 检查错误是否应该被静默处理
 * 注意：composedPath 错误不再被静默，因为我们有自动重建机制来处理它们
 */
export function shouldSilenceError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message || '';
  const silentErrorPatterns = [
    // 移除了 composedPath 相关的模式，因为我们现在有更好的处理机制
    // 只保留真正应该被静默的错误
    'AbortError',
    'The operation was aborted',
    'The play() request was interrupted',
    'The fetching process for the media resource was aborted',
  ];

  return silentErrorPatterns.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * 计算指数退避延迟
 */
export function calculateBackoffDelay(retryCount: number): number {
  const baseDelay = 1000; // 1秒
  const maxDelay = 30000; // 30秒
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

  // 添加随机抖动避免雷鸣群效应
  const jitter = Math.random() * 0.3 * delay;
  return delay + jitter;
}

/**
 * 检测浏览器类型
 */
export function detectBrowser(): {
  isChrome: boolean;
  isSafari: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isWebKit: boolean;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isChrome: false,
      isSafari: false,
      isFirefox: false,
      isEdge: false,
      isWebKit: false,
    };
  }

  const ua = navigator.userAgent.toLowerCase();

  return {
    isChrome: /chrome/.test(ua) && !/edge/.test(ua),
    isSafari: /safari/.test(ua) && !/chrome/.test(ua),
    isFirefox: /firefox/.test(ua),
    isEdge: /edge/.test(ua) || /edg/.test(ua),
    isWebKit: /webkit/.test(ua),
  };
}

// ============================================================================
// 导出所有接口和工具函数
// ============================================================================

export type {
  IComposedPathPolyfill as ComposedPathPolyfill,
  IErrorBoundary as ErrorBoundary,
  IEventDebouncer as EventDebouncer,
  IEventHandlerManager as EventHandlerManager,
  IEventThrottler as EventThrottler,
  IEventValidator as EventValidator,
};
