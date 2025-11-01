/**
 * 刷新清理管理器
 * 负责在页面刷新前清理所有可能阻塞的资源
 */

/**
 * 清理报告接口
 */
export interface CleanupReport {
  timersStopped: number;
  listenersRemoved: number;
  requestsCancelled: number;
  hlsInstancesDestroyed: number;
  timestamp: number;
  success: boolean;
  errors: string[];
}

/**
 * 事件监听器信息
 */
export interface EventListenerInfo {
  target: EventTarget;
  type: string;
  listener: EventListener;
  options?: AddEventListenerOptions;
}

/**
 * 清理状态接口
 */
export interface CleanupState {
  // 定时器追踪
  timers: Set<NodeJS.Timeout>;
  intervals: Set<NodeJS.Timeout>;

  // 事件监听器追踪
  eventListeners: Map<string, EventListenerInfo[]>;

  // 网络请求追踪
  pendingRequests: Set<AbortController>;

  // HLS实例追踪
  hlsInstances: Set<any>;

  // 清理状态
  isCleanupInProgress: boolean;
  lastCleanupTime: number;
}

/**
 * 刷新清理管理器类
 */
export class RefreshCleanupManager {
  private static instance: RefreshCleanupManager | null = null;
  private state: CleanupState;

  constructor() {
    this.state = {
      timers: new Set(),
      intervals: new Set(),
      eventListeners: new Map(),
      pendingRequests: new Set(),
      hlsInstances: new Set(),
      isCleanupInProgress: false,
      lastCleanupTime: 0,
    };

    console.log('✅ RefreshCleanupManager 初始化完成');
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): RefreshCleanupManager {
    if (!RefreshCleanupManager.instance) {
      RefreshCleanupManager.instance = new RefreshCleanupManager();
    }
    return RefreshCleanupManager.instance;
  }

  /**
   * 注册定时器
   */
  public registerTimer(timer: NodeJS.Timeout): void {
    this.state.timers.add(timer);
  }

  /**
   * 注册间隔器
   */
  public registerInterval(interval: NodeJS.Timeout): void {
    this.state.intervals.add(interval);
  }

  /**
   * 注册事件监听器
   */
  public registerEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void {
    const key = `${target.constructor.name}_${type}`;
    if (!this.state.eventListeners.has(key)) {
      this.state.eventListeners.set(key, []);
    }
    this.state.eventListeners.get(key)!.push({
      target,
      type,
      listener,
      options,
    });
  }

  /**
   * 注册网络请求控制器
   */
  public registerRequest(controller: AbortController): void {
    this.state.pendingRequests.add(controller);
  }

  /**
   * 注册HLS实例
   */
  public registerHlsInstance(hls: any): void {
    this.state.hlsInstances.add(hls);
  }

  /**
   * 执行完整的清理流程
   */
  public executeCleanup(): CleanupReport {
    const startTime = performance.now();
    this.state.isCleanupInProgress = true;

    const report: CleanupReport = {
      timersStopped: 0,
      listenersRemoved: 0,
      requestsCancelled: 0,
      hlsInstancesDestroyed: 0,
      timestamp: Date.now(),
      success: false,
      errors: [],
    };

    console.log('🧹 开始执行清理流程...');

    try {
      // 1. 停止所有定时器
      report.timersStopped = this.stopAllTimers();

      // 2. 移除所有事件监听器
      report.listenersRemoved = this.removeAllEventListeners();

      // 3. 取消所有网络请求
      report.requestsCancelled = this.cancelAllRequests();

      // 4. 销毁HLS实例
      report.hlsInstancesDestroyed = this.destroyHlsInstances();

      // 5. 清理全局引用
      this.clearGlobalReferences();

      report.success = true;
      this.state.lastCleanupTime = Date.now();

      const duration = performance.now() - startTime;
      console.log(`✅ 清理完成 (耗时: ${duration.toFixed(2)}ms):`, {
        定时器: report.timersStopped,
        监听器: report.listenersRemoved,
        请求: report.requestsCancelled,
        HLS实例: report.hlsInstancesDestroyed,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('❌ 清理过程出错:', error);
      report.errors.push(errorMessage);
      report.success = false;
    } finally {
      this.state.isCleanupInProgress = false;
    }

    return report;
  }

  /**
   * 停止所有定时器
   */
  public stopAllTimers(): number {
    let count = 0;

    try {
      // 清理已追踪的定时器
      this.state.timers.forEach((timer) => {
        try {
          clearTimeout(timer);
          count++;
        } catch (e) {
          console.warn('清理定时器失败:', e);
        }
      });
      this.state.timers.clear();

      // 清理已追踪的间隔器
      this.state.intervals.forEach((interval) => {
        try {
          clearInterval(interval);
          count++;
        } catch (e) {
          console.warn('清理间隔器失败:', e);
        }
      });
      this.state.intervals.clear();

      // 清理已知的定时器引用（从播放器页面）
      const timerRefs = [
        'notificationDebounceRef',
        'errorDebounceRef',
        'saveProgressDebounceRef',
        'saveIntervalRef',
        'playbackRecoveryRef',
        'rebuildTimeoutRef',
        'networkQualityIntervalRef',
        'networkMonitorIntervalRef',
      ];

      timerRefs.forEach((refName) => {
        try {
          // 尝试从window对象获取
          const windowRef = (window as any)[refName];
          if (windowRef?.current) {
            clearTimeout(windowRef.current);
            clearInterval(windowRef.current);
            windowRef.current = null;
            count++;
          }
        } catch (e) {
          // 忽略错误，继续清理其他定时器
        }
      });

      console.log(`✅ 已停止 ${count} 个定时器/间隔器`);
    } catch (error) {
      console.error('停止定时器时出错:', error);
    }

    return count;
  }

  /**
   * 移除所有事件监听器
   */
  public removeAllEventListeners(): number {
    let count = 0;

    try {
      // 移除已追踪的事件监听器
      this.state.eventListeners.forEach((listeners, eventType) => {
        listeners.forEach((info) => {
          try {
            info.target.removeEventListener(
              info.type,
              info.listener,
              info.options
            );
            count++;
          } catch (e) {
            console.warn(`移除事件监听器失败 (${eventType}):`, e);
          }
        });
      });
      this.state.eventListeners.clear();

      // 移除已知的全局事件监听器
      // 注意：这里我们不能直接移除所有监听器，因为可能影响其他功能
      // 只记录日志，实际的监听器应该在注册时被追踪
      console.log(`✅ 已移除 ${count} 个事件监听器`);
    } catch (error) {
      console.error('移除事件监听器时出错:', error);
    }

    return count;
  }

  /**
   * 取消所有网络请求
   */
  public cancelAllRequests(): number {
    let count = 0;

    try {
      this.state.pendingRequests.forEach((controller) => {
        try {
          if (!controller.signal.aborted) {
            controller.abort();
            count++;
          }
        } catch (e) {
          console.warn('取消网络请求失败:', e);
        }
      });
      this.state.pendingRequests.clear();

      console.log(`✅ 已取消 ${count} 个网络请求`);
    } catch (error) {
      console.error('取消网络请求时出错:', error);
    }

    return count;
  }

  /**
   * 销毁HLS实例
   */
  public destroyHlsInstances(): number {
    let count = 0;

    try {
      // 销毁已追踪的HLS实例
      this.state.hlsInstances.forEach((hls) => {
        try {
          if (hls && typeof hls.destroy === 'function') {
            if (typeof hls.stopLoad === 'function') {
              hls.stopLoad();
            }
            if (typeof hls.detachMedia === 'function') {
              hls.detachMedia();
            }
            hls.destroy();
            count++;
          }
        } catch (e) {
          console.warn('销毁HLS实例失败:', e);
        }
      });
      this.state.hlsInstances.clear();

      // 清理播放器中的HLS实例
      try {
        const player = (window as any).artPlayerInstance;
        if (player?.video?.hls) {
          const hls = player.video.hls;
          if (typeof hls.stopLoad === 'function') {
            hls.stopLoad();
          }
          if (typeof hls.detachMedia === 'function') {
            hls.detachMedia();
          }
          if (typeof hls.destroy === 'function') {
            hls.destroy();
          }
          player.video.hls = null;
          count++;
        }
      } catch (e) {
        console.warn('清理播放器HLS实例失败:', e);
      }

      console.log(`✅ 已销毁 ${count} 个HLS实例`);
    } catch (error) {
      console.error('销毁HLS实例时出错:', error);
    }

    return count;
  }

  /**
   * 清理全局引用
   */
  public clearGlobalReferences(): void {
    try {
      if (typeof window !== 'undefined') {
        // 清理全局播放器引用
        (window as any).artPlayerInstance = null;

        // 清理测试函数
        (window as any).testFatalError = null;

        console.log('✅ 已清理全局引用');
      }
    } catch (error) {
      console.error('清理全局引用时出错:', error);
    }
  }

  /**
   * 获取清理报告
   */
  public getCleanupReport(): CleanupReport | null {
    if (this.state.lastCleanupTime === 0) {
      return null;
    }

    return {
      timersStopped: this.state.timers.size,
      listenersRemoved: this.state.eventListeners.size,
      requestsCancelled: this.state.pendingRequests.size,
      hlsInstancesDestroyed: this.state.hlsInstances.size,
      timestamp: this.state.lastCleanupTime,
      success: true,
      errors: [],
    };
  }

  /**
   * 重置清理管理器状态
   */
  public reset(): void {
    this.state = {
      timers: new Set(),
      intervals: new Set(),
      eventListeners: new Map(),
      pendingRequests: new Set(),
      hlsInstances: new Set(),
      isCleanupInProgress: false,
      lastCleanupTime: 0,
    };
    console.log('✅ 清理管理器已重置');
  }

  /**
   * 检查是否正在清理
   */
  public isCleaningUp(): boolean {
    return this.state.isCleanupInProgress;
  }
}

// 导出单例实例
export const refreshCleanupManager = RefreshCleanupManager.getInstance();

/**
 * 快捷函数：执行清理
 */
export function executeCleanup(): CleanupReport {
  return refreshCleanupManager.executeCleanup();
}

/**
 * 快捷函数：注册定时器
 */
export function registerTimer(timer: NodeJS.Timeout): void {
  refreshCleanupManager.registerTimer(timer);
}

/**
 * 快捷函数：注册间隔器
 */
export function registerInterval(interval: NodeJS.Timeout): void {
  refreshCleanupManager.registerInterval(interval);
}

/**
 * 快捷函数：注册事件监听器
 */
export function registerEventListener(
  target: EventTarget,
  type: string,
  listener: EventListener,
  options?: AddEventListenerOptions
): void {
  refreshCleanupManager.registerEventListener(target, type, listener, options);
}

/**
 * 快捷函数：注册网络请求
 */
export function registerRequest(controller: AbortController): void {
  refreshCleanupManager.registerRequest(controller);
}

/**
 * 快捷函数：注册HLS实例
 */
export function registerHlsInstance(hls: any): void {
  refreshCleanupManager.registerHlsInstance(hls);
}
