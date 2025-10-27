/**
 * 播放器事件处理集成
 * 为播放器提供统一的事件处理接口
 */

import { initGlobalComposedPathPolyfill } from './composed-path-polyfill';
import { errorBoundary } from './error-boundary';
import { eventHandlerManager } from './event-handler-manager';
import { EventHandlerConfig } from './event-handler-utils';

/**
 * 初始化播放器事件处理
 * 应该在播放器创建之前调用
 */
export function initPlayerEventHandling(): void {
  console.log('🎬 初始化播放器事件处理系统...');

  // 1. 初始化全局 composedPath polyfill
  initGlobalComposedPathPolyfill();

  // 2. 设置全局错误处理器
  setupGlobalErrorHandlers();

  console.log('✅ 播放器事件处理系统初始化完成');
}

/**
 * 设置全局错误处理器
 */
function setupGlobalErrorHandlers(): void {
  // 保存原始错误处理器
  const originalError = window.onerror;
  const originalUnhandledRejection = window.onunhandledrejection;

  // 设置新的错误处理器
  window.onerror = (message, source, lineno, colno, error) => {
    const messageStr = String(message || '');

    // 使用错误边界处理
    if (error) {
      errorBoundary.handleError(error, 'window.onerror');
    }

    // 调用原始处理器
    if (originalError) {
      return originalError(message, source, lineno, colno, error);
    }

    // 静默处理某些错误
    return errorBoundary.isRecoverableError(error || new Error(messageStr));
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error =
      reason instanceof Error
        ? reason
        : new Error(String(reason || 'Unknown error'));

    // 使用错误边界处理
    errorBoundary.handleError(error, 'unhandledrejection');

    // 如果是可恢复错误，阻止默认行为
    if (errorBoundary.isRecoverableError(error)) {
      event.preventDefault();
      return;
    }

    // 调用原始处理器
    if (originalUnhandledRejection) {
      return originalUnhandledRejection.call(window, event);
    }
  };
}

/**
 * 为播放器注册事件处理器
 */
export function registerPlayerEvent(
  player: any,
  eventType: string,
  handler: (event: any) => void,
  config?: Partial<EventHandlerConfig>
): void {
  if (!player || !player.on) {
    console.warn('无效的播放器实例');
    return;
  }

  // 获取播放器的事件目标（通常是播放器实例本身或其容器）
  const eventTarget = player.template?.$player || player;

  // 合并配置
  const fullConfig: EventHandlerConfig = {
    eventType,
    needsPolyfill: true,
    ...config,
  };

  // 使用事件管理器注册
  eventHandlerManager.register(
    eventTarget,
    eventType,
    handler as EventListener,
    undefined,
    fullConfig
  );

  // 同时使用播放器的 on 方法注册（Artplayer 特定）
  player.on(eventType, handler);
}

/**
 * 获取播放器事件配置预设
 */
export function getPlayerEventConfig(
  eventType: string
): Partial<EventHandlerConfig> {
  // 根据事件类型返回推荐配置
  switch (eventType) {
    case 'click':
    case 'dblclick':
      // 点击事件：防抖 200ms
      return {
        debounce: {
          enabled: true,
          delay: 200,
          leading: true,
          trailing: false,
        },
      };

    case 'video:timeupdate':
    case 'timeupdate':
      // 时间更新事件：节流 500ms
      return {
        throttle: {
          enabled: true,
          interval: 500,
          useRAF: false,
        },
      };

    case 'mousemove':
    case 'touchmove':
      // 高频移动事件：使用 RAF 节流
      return {
        throttle: {
          enabled: true,
          interval: 16, // ~60fps
          useRAF: true,
        },
      };

    case 'video:progress':
    case 'progress':
      // 进度事件：节流 1000ms
      return {
        throttle: {
          enabled: true,
          interval: 1000,
          useRAF: false,
        },
      };

    case 'resize':
    case 'scroll':
      // 窗口事件：防抖 150ms
      return {
        debounce: {
          enabled: true,
          delay: 150,
          leading: false,
          trailing: true,
        },
      };

    default:
      // 默认配置：不使用防抖或节流
      return {};
  }
}

/**
 * 清理播放器事件处理器
 */
export function cleanupPlayerEvents(): void {
  console.log('🧹 清理播放器事件处理器...');
  eventHandlerManager.cleanup();
}

/**
 * 重置播放器事件处理器
 * 在检测到连续错误时调用
 */
export function resetPlayerEvents(): void {
  console.log('🔄 重置播放器事件处理器...');
  eventHandlerManager.reset();
}

/**
 * 检查是否需要重置播放器事件
 */
export function shouldResetPlayerEvents(context = 'player'): boolean {
  return errorBoundary.shouldResetListeners(context);
}

/**
 * 获取播放器事件统计
 */
export function getPlayerEventStats() {
  return {
    handlers: eventHandlerManager.getHandlerCount(),
    metrics: eventHandlerManager.getMetrics(),
    errors: errorBoundary.getErrorStats(),
  };
}

/**
 * 创建安全的播放器事件处理器
 * 这是一个便捷函数，用于快速创建带有所有保护机制的事件处理器
 */
export function createSafePlayerHandler<T extends (...args: any[]) => any>(
  handler: T,
  eventType: string
): T {
  return errorBoundary.wrapHandler(handler, eventType);
}
