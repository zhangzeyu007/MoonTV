/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 加载监控器
 * 监控视频加载状态和时间，检测加载超时
 */

export type LoadingStage = 'initial' | 'buffering' | 'seeking' | 'ready';
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface LoadingState {
  isLoading: boolean;
  loadStartTime: number;
  loadDuration: number;
  loadingStage: LoadingStage;
  networkQuality: NetworkQuality;
}

export interface LoadingTimeoutConfig {
  // 基础超时时间（毫秒）
  baseTimeout: number;

  // 网络质量超时映射
  networkTimeouts: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };

  // 强制超时时间（无论网络质量）
  forceTimeout: number;

  // 缓冲超时时间（播放中）
  bufferingTimeout: number;
}

const DEFAULT_TIMEOUT_CONFIG: LoadingTimeoutConfig = {
  baseTimeout: 6000,
  networkTimeouts: {
    excellent: 6000,
    good: 6000,
    fair: 8000,
    poor: 10000,
  },
  forceTimeout: 6000,
  bufferingTimeout: 8000,
};

/**
 * 加载监控器类
 */
export class LoadingMonitor {
  private videoElement: HTMLVideoElement | null = null;
  private loadingState: LoadingState = {
    isLoading: false,
    loadStartTime: 0,
    loadDuration: 0,
    loadingStage: 'initial',
    networkQuality: 'good',
  };

  private config: LoadingTimeoutConfig;
  private monitorInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, EventListener> = new Map();

  constructor(config: Partial<LoadingTimeoutConfig> = {}) {
    this.config = { ...DEFAULT_TIMEOUT_CONFIG, ...config };
  }

  /**
   * 开始监控加载
   */
  public startMonitoring(videoElement: HTMLVideoElement): void {
    if (this.videoElement) {
      console.warn('[LoadingMonitor] 已在监控中，先停止旧的监控');
      this.stopMonitoring();
    }

    this.videoElement = videoElement;
    this.setupEventListeners();
    this.startMonitorLoop();

    console.log('[LoadingMonitor] 开始监控视频加载');
  }

  /**
   * 停止监控
   */
  public stopMonitoring(): void {
    this.removeEventListeners();
    this.stopMonitorLoop();
    this.videoElement = null;

    console.log('[LoadingMonitor] 停止监控');
  }

  /**
   * 获取当前加载状态
   */
  public getLoadingState(): LoadingState {
    return { ...this.loadingState };
  }

  /**
   * 检查是否超时
   */
  public isLoadingTimeout(): boolean {
    if (!this.loadingState.isLoading) {
      return false;
    }

    const threshold = this.getTimeoutThreshold();
    const isTimeout = this.loadingState.loadDuration >= threshold;

    if (isTimeout) {
      console.warn(
        `[LoadingMonitor] 加载超时: ${Math.round(
          this.loadingState.loadDuration / 1000
        )}秒 >= ${Math.round(threshold / 1000)}秒 (${
          this.loadingState.loadingStage
        })`
      );
    }

    return isTimeout;
  }

  /**
   * 获取超时阈值（根据网络质量和加载阶段）
   */
  public getTimeoutThreshold(): number {
    // 强制超时优先级最高
    if (this.loadingState.loadDuration >= this.config.forceTimeout) {
      return this.config.forceTimeout;
    }

    // 根据加载阶段选择超时时间
    if (this.loadingState.loadingStage === 'buffering') {
      return this.config.bufferingTimeout;
    }

    // 根据网络质量选择超时时间
    return this.config.networkTimeouts[this.loadingState.networkQuality];
  }

  /**
   * 更新网络质量
   */
  public updateNetworkQuality(quality: NetworkQuality): void {
    if (this.loadingState.networkQuality !== quality) {
      console.log(
        `[LoadingMonitor] 网络质量变化: ${this.loadingState.networkQuality} -> ${quality}`
      );
      this.loadingState.networkQuality = quality;
    }
  }

  /**
   * 重置监控状态
   */
  public reset(): void {
    this.loadingState = {
      isLoading: false,
      loadStartTime: 0,
      loadDuration: 0,
      loadingStage: 'initial',
      networkQuality: this.loadingState.networkQuality, // 保持网络质量
    };

    console.log('[LoadingMonitor] 重置监控状态');
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.videoElement) return;

    // loadstart: 开始加载
    const onLoadStart = () => {
      console.log('[LoadingMonitor] loadstart - 开始加载');
      this.loadingState.isLoading = true;
      this.loadingState.loadStartTime = Date.now();
      this.loadingState.loadDuration = 0;
      this.loadingState.loadingStage = 'initial';
    };

    // waiting: 等待数据
    const onWaiting = () => {
      console.log('[LoadingMonitor] waiting - 等待数据');
      if (!this.loadingState.isLoading) {
        this.loadingState.isLoading = true;
        this.loadingState.loadStartTime = Date.now();
        this.loadingState.loadDuration = 0;
      }
      // 如果已经播放过，则是缓冲
      if (this.videoElement && this.videoElement.currentTime > 0) {
        this.loadingState.loadingStage = 'buffering';
      }
    };

    // seeking: 跳转中
    const onSeeking = () => {
      console.log('[LoadingMonitor] seeking - 跳转中');
      this.loadingState.isLoading = true;
      this.loadingState.loadStartTime = Date.now();
      this.loadingState.loadDuration = 0;
      this.loadingState.loadingStage = 'seeking';
    };

    // canplay: 可以播放
    const onCanPlay = () => {
      console.log('[LoadingMonitor] canplay - 可以播放');
      this.loadingState.isLoading = false;
      this.loadingState.loadingStage = 'ready';
      this.loadingState.loadDuration = 0;
    };

    // playing: 正在播放
    const onPlaying = () => {
      console.log('[LoadingMonitor] playing - 正在播放');
      this.loadingState.isLoading = false;
      this.loadingState.loadingStage = 'ready';
      this.loadingState.loadDuration = 0;
    };

    // canplaythrough: 可以流畅播放
    const onCanPlayThrough = () => {
      console.log('[LoadingMonitor] canplaythrough - 可以流畅播放');
      this.loadingState.isLoading = false;
      this.loadingState.loadingStage = 'ready';
      this.loadingState.loadDuration = 0;
    };

    // 注册事件监听器
    this.addEventListener('loadstart', onLoadStart);
    this.addEventListener('waiting', onWaiting);
    this.addEventListener('seeking', onSeeking);
    this.addEventListener('canplay', onCanPlay);
    this.addEventListener('playing', onPlaying);
    this.addEventListener('canplaythrough', onCanPlayThrough);
  }

  /**
   * 添加事件监听器
   */
  private addEventListener(eventType: string, listener: EventListener): void {
    if (!this.videoElement) return;

    this.videoElement.addEventListener(eventType, listener);
    this.eventListeners.set(eventType, listener);
  }

  /**
   * 移除所有事件监听器
   */
  private removeEventListeners(): void {
    if (!this.videoElement) return;

    this.eventListeners.forEach((listener, eventType) => {
      this.videoElement?.removeEventListener(eventType, listener);
    });

    this.eventListeners.clear();
  }

  /**
   * 启动监控循环
   */
  private startMonitorLoop(): void {
    // 每秒检查一次加载状态
    this.monitorInterval = setInterval(() => {
      if (this.loadingState.isLoading) {
        this.loadingState.loadDuration =
          Date.now() - this.loadingState.loadStartTime;

        // 调试日志（每5秒输出一次）
        if (
          Math.floor(this.loadingState.loadDuration / 5000) >
          Math.floor((this.loadingState.loadDuration - 1000) / 5000)
        ) {
          console.log(
            `[LoadingMonitor] 加载中: ${Math.round(
              this.loadingState.loadDuration / 1000
            )}秒 (${this.loadingState.loadingStage}, 阈值: ${Math.round(
              this.getTimeoutThreshold() / 1000
            )}秒)`
          );
        }
      }
    }, 1000);
  }

  /**
   * 停止监控循环
   */
  private stopMonitorLoop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<LoadingTimeoutConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[LoadingMonitor] 配置已更新:', this.config);
  }

  /**
   * 获取当前配置
   */
  public getConfig(): LoadingTimeoutConfig {
    return { ...this.config };
  }

  /**
   * 销毁监控器
   */
  public destroy(): void {
    this.stopMonitoring();
    console.log('[LoadingMonitor] 监控器已销毁');
  }
}

// 导出便捷函数
export function createLoadingMonitor(
  config?: Partial<LoadingTimeoutConfig>
): LoadingMonitor {
  return new LoadingMonitor(config);
}
