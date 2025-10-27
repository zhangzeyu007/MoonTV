/**
 * 防抖和节流工具
 * 提供事件防抖和节流功能
 */

import { IEventDebouncer, IEventThrottler } from './event-handler-utils';

/**
 * EventDebouncer 类
 */
export class EventDebouncer implements IEventDebouncer {
  private timerId: NodeJS.Timeout | number | null = null;
  private lastArgs: any[] | null = null;
  private lastThis: any = null;
  private lastFunc: ((...args: any[]) => any) | null = null;

  /**
   * 创建防抖函数
   */
  public debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
    options?: { leading?: boolean; trailing?: boolean }
  ): (...args: Parameters<T>) => void {
    const leading = options?.leading ?? false;
    const trailing = options?.trailing ?? true;

    let lastCallTime = 0;
    let lastInvokeTime = 0;
    let timerId: NodeJS.Timeout | number | null = null;
    let lastArgs: any[] | null = null;
    let lastThis: any = null;

    const invokeFunc = (time: number) => {
      const args = lastArgs;
      const thisArg = lastThis;

      lastArgs = null;
      lastThis = null;
      lastInvokeTime = time;

      if (args) {
        return func.apply(thisArg, args);
      }
    };

    const leadingEdge = (time: number) => {
      lastInvokeTime = time;
      timerId = setTimeout(timerExpired, delay);
      return leading ? invokeFunc(time) : undefined;
    };

    const remainingWait = (time: number) => {
      const timeSinceLastCall = time - lastCallTime;
      const timeSinceLastInvoke = time - lastInvokeTime;
      const timeWaiting = delay - timeSinceLastCall;

      return timeWaiting;
    };

    const shouldInvoke = (time: number) => {
      const timeSinceLastCall = time - lastCallTime;

      return (
        lastCallTime === 0 ||
        timeSinceLastCall >= delay ||
        timeSinceLastCall < 0
      );
    };

    const timerExpired = () => {
      const time = Date.now();
      if (shouldInvoke(time)) {
        return trailingEdge(time);
      }
      timerId = setTimeout(timerExpired, remainingWait(time));
    };

    const trailingEdge = (time: number) => {
      timerId = null;

      if (trailing && lastArgs) {
        return invokeFunc(time);
      }
      lastArgs = null;
      lastThis = null;
      return undefined;
    };

    const cancel = () => {
      if (timerId !== null) {
        clearTimeout(timerId as any);
      }
      lastInvokeTime = 0;
      lastArgs = null;
      lastCallTime = 0;
      lastThis = null;
      timerId = null;
    };

    const flush = () => {
      return timerId === null ? undefined : trailingEdge(Date.now());
    };

    const debounced = function (this: any, ...args: any[]) {
      const time = Date.now();
      const isInvoking = shouldInvoke(time);

      lastArgs = args;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastThis = this;
      lastCallTime = time;

      if (isInvoking) {
        if (timerId === null) {
          return leadingEdge(lastCallTime);
        }
      }
      if (timerId === null) {
        timerId = setTimeout(timerExpired, delay);
      }
      return undefined;
    };

    debounced.cancel = cancel;
    debounced.flush = flush;

    return debounced as any;
  }

  /**
   * 取消待执行的防抖函数
   */
  public cancel(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId as any);
      this.timerId = null;
    }
    this.lastArgs = null;
    this.lastThis = null;
    this.lastFunc = null;
  }

  /**
   * 立即执行防抖函数
   */
  public flush(): void {
    if (this.lastFunc && this.lastArgs) {
      this.lastFunc.apply(this.lastThis, this.lastArgs);
    }
    this.cancel();
  }
}

/**
 * EventThrottler 类
 */
export class EventThrottler implements IEventThrottler {
  /**
   * 创建节流函数
   */
  public throttle<T extends (...args: any[]) => any>(
    func: T,
    interval: number
  ): (...args: Parameters<T>) => void {
    let lastTime = 0;
    let timerId: NodeJS.Timeout | number | null = null;
    let lastArgs: any[] | null = null;
    let lastThis: any = null;

    const throttled = function (this: any, ...args: any[]) {
      const now = Date.now();
      const remaining = interval - (now - lastTime);

      lastArgs = args;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastThis = this;

      if (remaining <= 0 || remaining > interval) {
        // 立即执行
        if (timerId !== null) {
          clearTimeout(timerId as any);
          timerId = null;
        }
        lastTime = now;
        func.apply(this, args);
        lastArgs = null;
        lastThis = null;
      } else if (timerId === null) {
        // 设置定时器确保最后一次调用被执行
        timerId = setTimeout(() => {
          lastTime = Date.now();
          timerId = null;
          if (lastArgs) {
            func.apply(lastThis, lastArgs);
            lastArgs = null;
            lastThis = null;
          }
        }, remaining);
      }
    };

    throttled.cancel = () => {
      if (timerId !== null) {
        clearTimeout(timerId as any);
        timerId = null;
      }
      lastArgs = null;
      lastThis = null;
      lastTime = 0;
    };

    return throttled as any;
  }

  /**
   * 使用 RAF 的节流（用于动画相关事件）
   */
  public throttleRAF<T extends (...args: any[]) => any>(
    func: T
  ): (...args: Parameters<T>) => void {
    let rafId: number | null = null;
    let lastArgs: any[] | null = null;
    let lastThis: any = null;

    const throttled = function (this: any, ...args: any[]) {
      lastArgs = args;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastThis = this;

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          if (lastArgs) {
            func.apply(lastThis, lastArgs);
            lastArgs = null;
            lastThis = null;
          }
        });
      }
    };

    throttled.cancel = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastArgs = null;
      lastThis = null;
    };

    return throttled as any;
  }
}

// 导出实例
export const eventDebouncer = new EventDebouncer();
export const eventThrottler = new EventThrottler();

/**
 * 快捷函数：创建防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  options?: { leading?: boolean; trailing?: boolean }
): (...args: Parameters<T>) => void {
  return eventDebouncer.debounce(func, delay, options);
}

/**
 * 快捷函数：创建节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  interval: number
): (...args: Parameters<T>) => void {
  return eventThrottler.throttle(func, interval);
}

/**
 * 快捷函数：创建 RAF 节流函数
 */
export function throttleRAF<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  return eventThrottler.throttleRAF(func);
}
