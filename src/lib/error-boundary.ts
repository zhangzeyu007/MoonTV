/**
 * 错误边界
 * 捕获和处理事件处理过程中的错误
 */

import { composedPathPolyfill } from './composed-path-polyfill';
import {
  calculateBackoffDelay,
  ErrorRecord,
  IErrorBoundary,
  isComposedPathError,
  shouldSilenceError,
} from './event-handler-utils';

/**
 * ErrorBoundary 类
 */
export class ErrorBoundary implements IErrorBoundary {
  private static instance: ErrorBoundary | null = null;
  private errorRecords: ErrorRecord[] = [];
  private errorCountByContext: Map<string, number> = new Map();
  private lastErrorTime: Map<string, number> = new Map();
  private consecutiveErrors: Map<string, number> = new Map();
  private maxErrorRecords = 100; // 最多保留100条错误记录

  /**
   * 获取单例实例
   */
  public static getInstance(): ErrorBoundary {
    if (!ErrorBoundary.instance) {
      ErrorBoundary.instance = new ErrorBoundary();
    }
    return ErrorBoundary.instance;
  }

  /**
   * 包装事件处理器
   */
  public wrapHandler<T extends (...args: any[]) => any>(
    handler: T,
    context = 'unknown'
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return function wrappedHandler(this: any, ...args: any[]) {
      try {
        // 验证第一个参数（通常是事件对象）
        if (args.length > 0 && args[0]) {
          const event = args[0];

          // 基本验证
          if (typeof event === 'object' && event !== null) {
            // 确保 composedPath 方法存在
            if (typeof event.composedPath !== 'function') {
              composedPathPolyfill.applyPolyfill(event);
            }

            // 确保 target 属性存在
            if (!event.target && event.currentTarget) {
              try {
                Object.defineProperty(event, 'target', {
                  value: event.currentTarget,
                  writable: false,
                  enumerable: false,
                  configurable: true,
                });
              } catch (e) {
                // 忽略定义属性失败
              }
            }
          }
        }

        // 执行原始处理器
        return handler.apply(this, args);
      } catch (error) {
        // 处理错误
        self.handleError(error as Error, context);

        // 如果是可恢复错误，尝试恢复
        if (self.isRecoverableError(error as Error)) {
          // 尝试修复事件对象并重试
          if (args.length > 0 && args[0]) {
            try {
              const event = args[0];
              if (typeof event === 'object' && event !== null) {
                // 应用 polyfill
                composedPathPolyfill.applyPolyfill(event);

                // 重试一次
                return handler.apply(this, args);
              }
            } catch (retryError) {
              console.warn('重试事件处理失败:', retryError);
            }
          }
        }

        // 不可恢复错误或重试失败，静默处理或抛出
        if (!shouldSilenceError(error as Error)) {
          // 非静默错误，记录但不抛出以避免中断应用
          console.error(`事件处理器错误 [${context}]:`, error);
        }
      }
    } as T;
  }

  /**
   * 处理错误
   */
  public handleError(error: Error, context: string): void {
    const now = Date.now();
    const errorMessage = error.message || String(error);

    // 创建错误记录
    const record: ErrorRecord = {
      type: this.categorizeError(error),
      message: errorMessage,
      stack: error.stack,
      timestamp: now,
      context,
      recoverable: this.isRecoverableError(error),
      retryCount: 0,
    };

    // 添加到错误记录
    this.errorRecords.push(record);

    // 限制错误记录数量
    if (this.errorRecords.length > this.maxErrorRecords) {
      this.errorRecords.shift();
    }

    // 更新错误计数
    const currentCount = this.errorCountByContext.get(context) || 0;
    this.errorCountByContext.set(context, currentCount + 1);

    // 更新连续错误计数
    const lastTime = this.lastErrorTime.get(context) || 0;
    const timeSinceLastError = now - lastTime;

    if (timeSinceLastError < 5000) {
      // 5秒内的错误视为连续错误
      const consecutive = this.consecutiveErrors.get(context) || 0;
      this.consecutiveErrors.set(context, consecutive + 1);
    } else {
      // 重置连续错误计数
      this.consecutiveErrors.set(context, 1);
    }

    this.lastErrorTime.set(context, now);

    // 记录错误（根据类型决定日志级别）
    if (shouldSilenceError(error)) {
      console.warn(`🔇 静默错误 [${context}]:`, errorMessage);
    } else if (record.recoverable) {
      console.warn(`⚠️ 可恢复错误 [${context}]:`, errorMessage);
    } else {
      console.error(`❌ 不可恢复错误 [${context}]:`, errorMessage, error);
    }

    // 检查是否需要触发恢复机制
    const consecutiveCount = this.consecutiveErrors.get(context) || 0;
    if (consecutiveCount >= 3) {
      console.warn(
        `⚠️ 检测到连续错误 (${consecutiveCount}次)，建议重置事件监听器`
      );
    }
  }

  /**
   * 判断错误是否可恢复
   */
  public isRecoverableError(error: Error): boolean {
    const message = error.message || String(error);

    // composedPath 相关错误是可恢复的
    if (isComposedPathError(message)) {
      return true;
    }

    // 事件对象属性访问错误是可恢复的
    const recoverablePatterns = [
      'Cannot read property',
      'Cannot read properties',
      'undefined is not an object',
      'null is not an object',
      'is not a function',
      'is not defined',
      'target is undefined',
      'event is undefined',
      'event is null',
    ];

    const isRecoverable = recoverablePatterns.some((pattern) =>
      message.toLowerCase().includes(pattern.toLowerCase())
    );

    // 网络相关错误通常是可恢复的
    if (message.includes('network') || message.includes('fetch')) {
      return true;
    }

    // AbortError 是可恢复的
    if (error.name === 'AbortError' || message.includes('AbortError')) {
      return true;
    }

    return isRecoverable;
  }

  /**
   * 重置错误状态
   */
  public reset(): void {
    this.errorRecords = [];
    this.errorCountByContext.clear();
    this.lastErrorTime.clear();
    this.consecutiveErrors.clear();
    console.log('✅ 错误边界状态已重置');
  }

  /**
   * 获取错误统计
   */
  public getErrorStats(): {
    totalErrors: number;
    errorsByContext: Map<string, number>;
    recentErrors: ErrorRecord[];
    consecutiveErrors: Map<string, number>;
  } {
    return {
      totalErrors: this.errorRecords.length,
      errorsByContext: new Map(this.errorCountByContext),
      recentErrors: this.errorRecords.slice(-10), // 最近10条
      consecutiveErrors: new Map(this.consecutiveErrors),
    };
  }

  /**
   * 获取指定上下文的连续错误次数
   */
  public getConsecutiveErrorCount(context: string): number {
    return this.consecutiveErrors.get(context) || 0;
  }

  /**
   * 检查是否需要重置事件监听器
   */
  public shouldResetListeners(context: string): boolean {
    const consecutiveCount = this.getConsecutiveErrorCount(context);
    return consecutiveCount >= 3;
  }

  /**
   * 分类错误类型
   */
  private categorizeError(error: Error): string {
    const message = error.message || String(error);

    if (isComposedPathError(message)) {
      return 'composedPath错误';
    }

    if (message.includes('network') || message.includes('fetch')) {
      return '网络错误';
    }

    if (error.name === 'AbortError' || message.includes('AbortError')) {
      return 'AbortError';
    }

    if (
      message.includes('Cannot read property') ||
      message.includes('Cannot read properties') ||
      message.includes('undefined is not an object')
    ) {
      return '属性访问错误';
    }

    if (message.includes('is not a function')) {
      return '函数调用错误';
    }

    if (error.name === 'TypeError') {
      return 'TypeError';
    }

    if (error.name === 'ReferenceError') {
      return 'ReferenceError';
    }

    return '未知错误';
  }

  /**
   * 计算重试延迟
   */
  public getRetryDelay(context: string): number {
    const retryCount = this.consecutiveErrors.get(context) || 0;
    return calculateBackoffDelay(retryCount);
  }

  /**
   * 清理过期的错误记录
   */
  public cleanupOldRecords(maxAge = 300000): void {
    // 默认清理5分钟前的记录
    const now = Date.now();
    this.errorRecords = this.errorRecords.filter(
      (record) => now - record.timestamp < maxAge
    );
  }
}

// 导出单例实例
export const errorBoundary = ErrorBoundary.getInstance();

/**
 * 快捷函数：包装事件处理器
 */
export function wrapEventHandler<T extends (...args: any[]) => any>(
  handler: T,
  context?: string
): T {
  return errorBoundary.wrapHandler(handler, context);
}

/**
 * 快捷函数：检查是否需要重置
 */
export function shouldResetListeners(context: string): boolean {
  return errorBoundary.shouldResetListeners(context);
}

/**
 * 快捷函数：重置错误状态
 */
export function resetErrorBoundary(): void {
  errorBoundary.reset();
}
