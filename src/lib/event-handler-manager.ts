/**
 * 事件处理器管理器
 * 统一管理所有事件处理器的注册和清理
 */

import { eventDebouncer, eventThrottler } from './debounce-throttle';
import { errorBoundary } from './error-boundary';
import {
  EventHandlerConfig,
  EventMetrics,
  IEventHandlerManager,
} from './event-handler-utils';
import { eventValidator } from './event-validator';

interface RegisteredHandler {
  element: EventTarget;
  eventType: string;
  originalHandler: EventListener;
  wrappedHandler: EventListener;
  options?: AddEventListenerOptions;
  config?: EventHandlerConfig;
}

/**
 * EventHandlerManager 类
 */
export class EventHandlerManager implements IEventHandlerManager {
  private static instance: EventHandlerManager | null = null;
  private handlers: RegisteredHandler[] = [];
  private handlerMap: WeakMap<EventTarget, Map<string, RegisteredHandler[]>> =
    new WeakMap();
  private metrics: Map<string, EventMetrics> = new Map();

  /**
   * 获取单例实例
   */
  public static getInstance(): EventHandlerManager {
    if (!EventHandlerManager.instance) {
      EventHandlerManager.instance = new EventHandlerManager();
    }
    return EventHandlerManager.instance;
  }

  /**
   * 注册事件处理器
   */
  public register(
    element: EventTarget,
    eventType: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
    config?: EventHandlerConfig
  ): void {
    // 检查是否已注册
    if (this.isRegistered(element, eventType, handler)) {
      console.warn(`事件处理器已注册: ${eventType}`);
      return;
    }

    // 包装处理器
    const wrappedHandler = this.wrapHandler(handler, eventType, config);

    // 注册事件监听器
    element.addEventListener(eventType, wrappedHandler, options);

    // 保存注册信息
    const registered: RegisteredHandler = {
      element,
      eventType,
      originalHandler: handler,
      wrappedHandler,
      options,
      config,
    };

    this.handlers.push(registered);

    // 更新 WeakMap
    let eventMap = this.handlerMap.get(element);
    if (!eventMap) {
      eventMap = new Map();
      this.handlerMap.set(element, eventMap);
    }

    let handlers = eventMap.get(eventType);
    if (!handlers) {
      handlers = [];
      eventMap.set(eventType, handlers);
    }

    handlers.push(registered);

    // 初始化指标
    if (!this.metrics.has(eventType)) {
      this.metrics.set(eventType, {
        eventType,
        triggerCount: 0,
        executionCount: 0,
        averageResponseTime: 0,
        errorCount: 0,
        lastTriggerTime: 0,
      });
    }

    console.log(`✅ 已注册事件处理器: ${eventType}`);
  }

  /**
   * 注销事件处理器
   */
  public unregister(
    element: EventTarget,
    eventType: string,
    handler: EventListener
  ): void {
    // 查找注册信息
    const registered = this.findRegistered(element, eventType, handler);
    if (!registered) {
      console.warn(`未找到事件处理器: ${eventType}`);
      return;
    }

    // 移除事件监听器
    element.removeEventListener(
      eventType,
      registered.wrappedHandler,
      registered.options
    );

    // 从列表中移除
    const index = this.handlers.indexOf(registered);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }

    // 从 WeakMap 中移除
    const eventMap = this.handlerMap.get(element);
    if (eventMap) {
      const handlers = eventMap.get(eventType);
      if (handlers) {
        const handlerIndex = handlers.indexOf(registered);
        if (handlerIndex > -1) {
          handlers.splice(handlerIndex, 1);
        }

        if (handlers.length === 0) {
          eventMap.delete(eventType);
        }
      }

      if (eventMap.size === 0) {
        this.handlerMap.delete(element);
      }
    }

    console.log(`✅ 已注销事件处理器: ${eventType}`);
  }

  /**
   * 清理所有事件处理器
   */
  public cleanup(): void {
    console.log(`🧹 开始清理 ${this.handlers.length} 个事件处理器...`);

    // 复制数组以避免在迭代时修改
    const handlersToClean = [...this.handlers];

    for (const registered of handlersToClean) {
      try {
        registered.element.removeEventListener(
          registered.eventType,
          registered.wrappedHandler,
          registered.options
        );
      } catch (error) {
        console.warn(`清理事件处理器失败: ${registered.eventType}`, error);
      }
    }

    this.handlers = [];
    this.handlerMap = new WeakMap();

    console.log('✅ 所有事件处理器已清理');
  }

  /**
   * 重置所有事件处理器
   */
  public reset(): void {
    console.log('🔄 重置事件处理器...');

    // 保存当前注册信息
    const savedHandlers = [...this.handlers];

    // 清理现有处理器
    this.cleanup();

    // 重新注册
    for (const registered of savedHandlers) {
      try {
        this.register(
          registered.element,
          registered.eventType,
          registered.originalHandler,
          registered.options,
          registered.config
        );
      } catch (error) {
        console.warn(`重新注册事件处理器失败: ${registered.eventType}`, error);
      }
    }

    // 重置错误边界
    errorBoundary.reset();

    console.log('✅ 事件处理器已重置');
  }

  /**
   * 包装处理器（应用验证、防抖、节流和错误边界）
   */
  private wrapHandler(
    handler: EventListener,
    eventType: string,
    config?: EventHandlerConfig
  ): EventListener {
    let wrappedHandler = handler;

    // 1. 应用事件验证
    wrappedHandler = this.applyValidation(wrappedHandler, eventType);

    // 2. 应用防抖或节流
    if (config?.debounce?.enabled) {
      wrappedHandler = this.applyDebounce(wrappedHandler, config.debounce);
    } else if (config?.throttle?.enabled) {
      wrappedHandler = this.applyThrottle(wrappedHandler, config.throttle);
    }

    // 3. 应用错误边界
    wrappedHandler = this.applyErrorBoundary(wrappedHandler, eventType);

    // 4. 应用指标收集
    wrappedHandler = this.applyMetrics(wrappedHandler, eventType);

    return wrappedHandler;
  }

  /**
   * 应用事件验证
   */
  private applyValidation(
    handler: EventListener,
    eventType: string
  ): EventListener {
    return function (this: any, event: Event) {
      try {
        // 验证并修复事件对象
        const validEvent = eventValidator.validateAndFix(event);
        if (validEvent) {
          return handler.call(this, validEvent);
        } else {
          console.warn(`事件验证失败: ${eventType}`);
        }
      } catch (error) {
        console.error(`事件验证出错: ${eventType}`, error);
      }
    };
  }

  /**
   * 应用防抖
   */
  private applyDebounce(
    handler: EventListener,
    config: NonNullable<EventHandlerConfig['debounce']>
  ): EventListener {
    return eventDebouncer.debounce(handler as any, config.delay, {
      leading: config.leading,
      trailing: config.trailing,
    }) as EventListener;
  }

  /**
   * 应用节流
   */
  private applyThrottle(
    handler: EventListener,
    config: NonNullable<EventHandlerConfig['throttle']>
  ): EventListener {
    if (config.useRAF) {
      return eventThrottler.throttleRAF(handler as any) as EventListener;
    } else {
      return eventThrottler.throttle(
        handler as any,
        config.interval
      ) as EventListener;
    }
  }

  /**
   * 应用错误边界
   */
  private applyErrorBoundary(
    handler: EventListener,
    eventType: string
  ): EventListener {
    return errorBoundary.wrapHandler(
      handler as any,
      eventType
    ) as EventListener;
  }

  /**
   * 应用指标收集
   */
  private applyMetrics(
    handler: EventListener,
    eventType: string
  ): EventListener {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return function (this: any, event: Event) {
      const metrics = self.metrics.get(eventType);
      if (metrics) {
        metrics.triggerCount++;
        metrics.lastTriggerTime = Date.now();

        const startTime = performance.now();
        try {
          const result = handler.call(this, event);
          const endTime = performance.now();
          const responseTime = endTime - startTime;

          metrics.executionCount++;

          // 更新平均响应时间
          metrics.averageResponseTime =
            (metrics.averageResponseTime * (metrics.executionCount - 1) +
              responseTime) /
            metrics.executionCount;

          return result;
        } catch (error) {
          metrics.errorCount++;
          throw error;
        }
      } else {
        return handler.call(this, event);
      }
    };
  }

  /**
   * 检查是否已注册
   */
  private isRegistered(
    element: EventTarget,
    eventType: string,
    handler: EventListener
  ): boolean {
    return this.findRegistered(element, eventType, handler) !== null;
  }

  /**
   * 查找注册信息
   */
  private findRegistered(
    element: EventTarget,
    eventType: string,
    handler: EventListener
  ): RegisteredHandler | null {
    const eventMap = this.handlerMap.get(element);
    if (!eventMap) return null;

    const handlers = eventMap.get(eventType);
    if (!handlers) return null;

    return handlers.find((h) => h.originalHandler === handler) || null;
  }

  /**
   * 获取事件指标
   */
  public getMetrics(
    eventType?: string
  ): EventMetrics | Map<string, EventMetrics> {
    if (eventType) {
      return (
        this.metrics.get(eventType) || {
          eventType,
          triggerCount: 0,
          executionCount: 0,
          averageResponseTime: 0,
          errorCount: 0,
          lastTriggerTime: 0,
        }
      );
    }
    return new Map(this.metrics);
  }

  /**
   * 获取所有注册的处理器数量
   */
  public getHandlerCount(): number {
    return this.handlers.length;
  }

  /**
   * 获取指定元素和事件类型的处理器数量
   */
  public getHandlerCountFor(element: EventTarget, eventType?: string): number {
    const eventMap = this.handlerMap.get(element);
    if (!eventMap) return 0;

    if (eventType) {
      const handlers = eventMap.get(eventType);
      return handlers ? handlers.length : 0;
    }

    let count = 0;
    eventMap.forEach((handlers) => {
      count += handlers.length;
    });
    return count;
  }
}

// 导出单例实例
export const eventHandlerManager = EventHandlerManager.getInstance();

/**
 * 快捷函数：注册事件处理器
 */
export function registerEventHandler(
  element: EventTarget,
  eventType: string,
  handler: EventListener,
  options?: AddEventListenerOptions,
  config?: EventHandlerConfig
): void {
  eventHandlerManager.register(element, eventType, handler, options, config);
}

/**
 * 快捷函数：注销事件处理器
 */
export function unregisterEventHandler(
  element: EventTarget,
  eventType: string,
  handler: EventListener
): void {
  eventHandlerManager.unregister(element, eventType, handler);
}

/**
 * 快捷函数：清理所有事件处理器
 */
export function cleanupAllEventHandlers(): void {
  eventHandlerManager.cleanup();
}

/**
 * 快捷函数：重置所有事件处理器
 */
export function resetAllEventHandlers(): void {
  eventHandlerManager.reset();
}
