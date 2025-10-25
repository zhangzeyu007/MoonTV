/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 性能监控工具
 * 用于监控播放器加载性能
 */

export interface SourceInfo {
  url: string;
  available: boolean;
  pingTime: number;
  quality?: string;
  testTime: number;
  cdnOptimized?: boolean;
  cacheHit?: boolean;
}

export interface PerformanceMetrics {
  sourceSearchTime: number;
  sourceTestTime: number;
  totalLoadTime: number;
  sourceCount: number;
  selectedSource: string;
  cacheHit: boolean;
  sourcesInfo?: SourceInfo[];
  availableSourcesCount?: number;
  sourceSuccessRate?: number;
  // 新增详细请求信息
  requestId?: string;
  videoTitle?: string;
  videoId?: string;
  requestStartTime?: number;
  requestEndTime?: number;
  networkType?: string;
  userAgent?: string;
  errorDetails?: string[];
  retryAttempts?: number;
  finalSourceQuality?: string;
  bandwidthEstimate?: number;
}

export interface RealTimeMetrics {
  timestamp: number;
  playerStatus: 'loading' | 'playing' | 'paused' | 'buffering' | 'error';
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
  currentSource: string;
  bufferHealth: number;
  playbackRate: number;
  cdnOptimized: boolean;
  cacheHit: boolean;
  latency: number;
  bandwidth: number;
  errorCount: number;
  retryCount: number;
  sourcesInfo?: SourceInfo[];
  availableSourcesCount?: number;
  sourceSuccessRate?: number;
  // 新增实时请求信息
  currentRequestId?: string;
  currentVideoTitle?: string;
  currentVideoId?: string;
  requestDuration?: number;
  networkType?: string;
  errorDetails?: string[];
  bandwidthEstimate?: number;
}

export interface NetworkQualityMetrics {
  latency: number;
  bandwidth: number;
  packetLoss: number;
  jitter: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface PlayerStateMetrics {
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  playbackRate: number;
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private currentSession: Partial<PerformanceMetrics> = {};
  private realTimeMetrics: RealTimeMetrics[] = [];
  private currentRealTimeSession: Partial<RealTimeMetrics> = {};
  private subscribers: ((metrics: RealTimeMetrics) => void)[] = [];
  private updateInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private isUserControlled = false; // 用户是否主动控制监控状态

  /**
   * 开始监控会话
   */
  startSession(): void {
    this.currentSession = {
      sourceSearchTime: 0,
      sourceTestTime: 0,
      totalLoadTime: 0,
      sourceCount: 0,
      selectedSource: '',
      cacheHit: false,
    };
  }

  /**
   * 记录源搜索时间
   */
  recordSourceSearchTime(time: number): void {
    this.currentSession.sourceSearchTime = time;
  }

  /**
   * 记录源测试时间
   */
  recordSourceTestTime(time: number): void {
    this.currentSession.sourceTestTime = time;
  }

  /**
   * 记录总加载时间
   */
  recordTotalLoadTime(time: number): void {
    this.currentSession.totalLoadTime = time;
  }

  /**
   * 记录源数量
   */
  recordSourceCount(count: number): void {
    this.currentSession.sourceCount = count;
  }

  /**
   * 记录选择的源
   */
  recordSelectedSource(source: string): void {
    this.currentSession.selectedSource = source;
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit(hit: boolean): void {
    this.currentSession.cacheHit = hit;
  }

  /**
   * 记录源信息
   */
  recordSourcesInfo(sourcesInfo: SourceInfo[]): void {
    this.currentSession.sourcesInfo = sourcesInfo;
    this.currentSession.availableSourcesCount = sourcesInfo.filter(
      (s) => s.available
    ).length;
    this.currentSession.sourceSuccessRate =
      sourcesInfo.length > 0
        ? (this.currentSession.availableSourcesCount || 0) / sourcesInfo.length
        : 0;
  }

  /**
   * 记录请求详细信息
   */
  recordRequestDetails(details: {
    requestId?: string;
    videoTitle?: string;
    videoId?: string;
    requestStartTime?: number;
    networkType?: string;
    userAgent?: string;
    errorDetails?: string[];
    retryAttempts?: number;
    finalSourceQuality?: string;
    bandwidthEstimate?: number;
  }): void {
    this.currentSession.requestId = details.requestId;
    this.currentSession.videoTitle = details.videoTitle;
    this.currentSession.videoId = details.videoId;
    this.currentSession.requestStartTime = details.requestStartTime;
    this.currentSession.networkType = details.networkType;
    this.currentSession.userAgent = details.userAgent;
    this.currentSession.errorDetails = details.errorDetails;
    this.currentSession.retryAttempts = details.retryAttempts;
    this.currentSession.finalSourceQuality = details.finalSourceQuality;
    this.currentSession.bandwidthEstimate = details.bandwidthEstimate;
  }

  /**
   * 结束会话并保存指标
   */
  endSession(): PerformanceMetrics | null {
    if (!this.currentSession.totalLoadTime) {
      return null;
    }

    const metrics: PerformanceMetrics = {
      sourceSearchTime: this.currentSession.sourceSearchTime || 0,
      sourceTestTime: this.currentSession.sourceTestTime || 0,
      totalLoadTime: this.currentSession.totalLoadTime || 0,
      sourceCount: this.currentSession.sourceCount || 0,
      selectedSource: this.currentSession.selectedSource || '',
      cacheHit: this.currentSession.cacheHit || false,
      sourcesInfo: this.currentSession.sourcesInfo || [],
      availableSourcesCount: this.currentSession.availableSourcesCount || 0,
      sourceSuccessRate: this.currentSession.sourceSuccessRate || 0,
      // 详细请求信息
      requestId: this.currentSession.requestId,
      videoTitle: this.currentSession.videoTitle,
      videoId: this.currentSession.videoId,
      requestStartTime: this.currentSession.requestStartTime,
      requestEndTime: Date.now(),
      networkType: this.currentSession.networkType,
      userAgent: this.currentSession.userAgent,
      errorDetails: this.currentSession.errorDetails,
      retryAttempts: this.currentSession.retryAttempts,
      finalSourceQuality: this.currentSession.finalSourceQuality,
      bandwidthEstimate: this.currentSession.bandwidthEstimate,
    };

    this.metrics.push(metrics);
    this.currentSession = {};

    // 保存到本地存储
    this.saveMetrics();

    return metrics;
  }

  /**
   * 获取平均性能指标
   */
  getAverageMetrics(): Partial<PerformanceMetrics> {
    if (this.metrics.length === 0) return {};

    const total = this.metrics.reduce(
      (acc, metric) => ({
        sourceSearchTime: acc.sourceSearchTime + metric.sourceSearchTime,
        sourceTestTime: acc.sourceTestTime + metric.sourceTestTime,
        totalLoadTime: acc.totalLoadTime + metric.totalLoadTime,
        sourceCount: acc.sourceCount + metric.sourceCount,
      }),
      {
        sourceSearchTime: 0,
        sourceTestTime: 0,
        totalLoadTime: 0,
        sourceCount: 0,
      }
    );

    const count = this.metrics.length;
    const cacheHitRate = this.metrics.filter((m) => m.cacheHit).length / count;

    return {
      sourceSearchTime: Math.round(total.sourceSearchTime / count),
      sourceTestTime: Math.round(total.sourceTestTime / count),
      totalLoadTime: Math.round(total.totalLoadTime / count),
      sourceCount: Math.round(total.sourceCount / count),
      cacheHit: cacheHitRate > 0.5,
    };
  }

  /**
   * 获取所有指标
   */
  getAllMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * 保存指标到本地存储
   */
  private saveMetrics(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = {
        metrics: this.metrics.slice(-50), // 只保存最近50次
        timestamp: Date.now(),
      };
      localStorage.setItem('performanceMetrics', JSON.stringify(data));
    } catch (error) {
      console.warn('保存性能指标失败:', error);
    }
  }

  /**
   * 从本地存储加载指标
   */
  loadMetrics(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = localStorage.getItem('performanceMetrics');
      if (data) {
        const parsed = JSON.parse(data);
        // 只加载最近7天的数据
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (parsed.timestamp > weekAgo) {
          this.metrics = parsed.metrics || [];
        }
      }
    } catch (error) {
      console.warn('加载性能指标失败:', error);
    }
  }

  /**
   * 清除所有指标
   */
  clearMetrics(): void {
    this.metrics = [];
    this.currentSession = {};
    if (typeof window !== 'undefined') {
      localStorage.removeItem('performanceMetrics');
    }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): string {
    const avg = this.getAverageMetrics();
    const recent = this.metrics.slice(-10);

    if (recent.length === 0) {
      return '暂无性能数据';
    }

    const report = [
      '=== 播放器性能报告 ===',
      `平均总加载时间: ${avg.totalLoadTime}ms`,
      `平均源搜索时间: ${avg.sourceSearchTime}ms`,
      `平均源测试时间: ${avg.sourceTestTime}ms`,
      `平均源数量: ${avg.sourceCount}`,
      `缓存命中率: ${avg.cacheHit ? '高' : '低'}`,
      '',
      '最近10次加载时间:',
      ...recent.map(
        (m, i) => `${i + 1}. ${m.totalLoadTime}ms (${m.selectedSource})`
      ),
    ].join('\n');

    return report;
  }

  // ========== 实时监控功能 ==========

  /**
   * 开始实时监控
   * @param userControlled 是否为用户主动控制（默认false，兼容现有代码）
   */
  startRealTimeMonitoring(userControlled = false): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.isUserControlled = userControlled;
    this.currentRealTimeSession = {
      timestamp: Date.now(),
      playerStatus: 'loading',
      networkQuality: 'good',
      currentSource: '',
      bufferHealth: 0,
      playbackRate: 1,
      cdnOptimized: false,
      cacheHit: false,
      latency: 0,
      bandwidth: 0,
      errorCount: 0,
      retryCount: 0,
    };

    // 每1秒更新一次实时数据
    this.updateInterval = setInterval(() => {
      this.updateRealTimeMetrics();
    }, 1000);

    // 保存监控状态到本地存储
    this.saveMonitoringState();

    console.log(`实时性能监控已启动${userControlled ? '（用户控制）' : ''}`);
  }

  /**
   * 停止实时监控
   * @param forceStop 是否强制停止（忽略用户控制状态）
   */
  stopRealTimeMonitoring(forceStop = false): void {
    if (!this.isMonitoring) return;

    // 如果是用户控制的监控且不是强制停止，则不允许停止
    if (this.isUserControlled && !forceStop) {
      console.log('用户控制的监控不允许自动停止');
      return;
    }

    this.isMonitoring = false;
    this.isUserControlled = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // 清除监控状态
    this.clearMonitoringState();

    console.log('实时性能监控已停止');
  }

  /**
   * 用户主动停止监控
   */
  stopRealTimeMonitoringByUser(): void {
    this.stopRealTimeMonitoring(true);
  }

  /**
   * 更新实时指标
   */
  private updateRealTimeMetrics(): void {
    if (!this.isMonitoring) return;

    const metrics: RealTimeMetrics = {
      timestamp: Date.now(),
      playerStatus: this.currentRealTimeSession.playerStatus || 'loading',
      networkQuality: this.currentRealTimeSession.networkQuality || 'good',
      currentSource: this.currentRealTimeSession.currentSource || '',
      bufferHealth: this.currentRealTimeSession.bufferHealth || 0,
      playbackRate: this.currentRealTimeSession.playbackRate || 1,
      cdnOptimized: this.currentRealTimeSession.cdnOptimized || false,
      cacheHit: this.currentRealTimeSession.cacheHit || false,
      latency: this.currentRealTimeSession.latency || 0,
      bandwidth: this.currentRealTimeSession.bandwidth || 0,
      errorCount: this.currentRealTimeSession.errorCount || 0,
      retryCount: this.currentRealTimeSession.retryCount || 0,
      sourcesInfo: this.currentRealTimeSession.sourcesInfo || [],
      availableSourcesCount:
        this.currentRealTimeSession.availableSourcesCount || 0,
      sourceSuccessRate: this.currentRealTimeSession.sourceSuccessRate || 0,
      // 实时请求信息
      currentRequestId: this.currentRealTimeSession.currentRequestId,
      currentVideoTitle: this.currentRealTimeSession.currentVideoTitle,
      currentVideoId: this.currentRealTimeSession.currentVideoId,
      requestDuration: this.currentRealTimeSession.requestDuration,
      networkType: this.currentRealTimeSession.networkType,
      errorDetails: this.currentRealTimeSession.errorDetails,
      bandwidthEstimate: this.currentRealTimeSession.bandwidthEstimate,
    };

    // 保存到历史记录（只保留最近100条）
    this.realTimeMetrics.push(metrics);
    if (this.realTimeMetrics.length > 100) {
      this.realTimeMetrics = this.realTimeMetrics.slice(-100);
    }

    // 通知订阅者
    this.notifySubscribers(metrics);
  }

  /**
   * 记录播放器状态
   */
  recordPlayerStatus(status: RealTimeMetrics['playerStatus']): void {
    this.currentRealTimeSession.playerStatus = status;
  }

  /**
   * 记录网络质量
   */
  recordNetworkQuality(quality: NetworkQualityMetrics): void {
    this.currentRealTimeSession.networkQuality = quality.quality;
    this.currentRealTimeSession.latency = quality.latency;
    this.currentRealTimeSession.bandwidth = quality.bandwidth;
  }

  /**
   * 记录当前播放源
   */
  recordCurrentSource(
    source: string,
    cdnOptimized = false,
    cacheHit = false
  ): void {
    this.currentRealTimeSession.currentSource = source;
    this.currentRealTimeSession.cdnOptimized = cdnOptimized;
    this.currentRealTimeSession.cacheHit = cacheHit;
  }

  /**
   * 记录实时源信息
   */
  recordRealTimeSourcesInfo(sourcesInfo: SourceInfo[]): void {
    this.currentRealTimeSession.sourcesInfo = sourcesInfo;
    this.currentRealTimeSession.availableSourcesCount = sourcesInfo.filter(
      (s) => s.available
    ).length;
    this.currentRealTimeSession.sourceSuccessRate =
      sourcesInfo.length > 0
        ? (this.currentRealTimeSession.availableSourcesCount || 0) /
          sourcesInfo.length
        : 0;
  }

  /**
   * 记录实时请求信息
   */
  recordRealTimeRequestInfo(info: {
    currentRequestId?: string;
    currentVideoTitle?: string;
    currentVideoId?: string;
    requestDuration?: number;
    networkType?: string;
    errorDetails?: string[];
    bandwidthEstimate?: number;
  }): void {
    this.currentRealTimeSession.currentRequestId = info.currentRequestId;
    this.currentRealTimeSession.currentVideoTitle = info.currentVideoTitle;
    this.currentRealTimeSession.currentVideoId = info.currentVideoId;
    this.currentRealTimeSession.requestDuration = info.requestDuration;
    this.currentRealTimeSession.networkType = info.networkType;
    this.currentRealTimeSession.errorDetails = info.errorDetails;
    this.currentRealTimeSession.bandwidthEstimate = info.bandwidthEstimate;
  }

  /**
   * 记录缓冲健康度
   */
  recordBufferHealth(health: number): void {
    this.currentRealTimeSession.bufferHealth = Math.max(0, Math.min(1, health));
  }

  /**
   * 记录播放速率
   */
  recordPlaybackRate(rate: number): void {
    this.currentRealTimeSession.playbackRate = rate;
  }

  /**
   * 记录错误
   */
  recordError(): void {
    this.currentRealTimeSession.errorCount =
      (this.currentRealTimeSession.errorCount || 0) + 1;
  }

  /**
   * 记录重试
   */
  recordRetry(): void {
    this.currentRealTimeSession.retryCount =
      (this.currentRealTimeSession.retryCount || 0) + 1;
  }

  /**
   * 订阅实时指标更新
   */
  subscribe(callback: (metrics: RealTimeMetrics) => void): () => void {
    this.subscribers.push(callback);

    // 返回取消订阅函数
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * 通知所有订阅者
   */
  private notifySubscribers(metrics: RealTimeMetrics): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(metrics);
      } catch (error) {
        console.warn('实时监控订阅者回调出错:', error);
      }
    });
  }

  /**
   * 获取实时指标
   */
  getRealTimeMetrics(): RealTimeMetrics[] {
    return [...this.realTimeMetrics];
  }

  /**
   * 获取当前实时状态
   */
  getCurrentRealTimeState(): Partial<RealTimeMetrics> {
    return { ...this.currentRealTimeSession };
  }

  /**
   * 获取网络质量统计
   */
  getNetworkQualityStats(): {
    averageLatency: number;
    averageBandwidth: number;
    qualityDistribution: Record<string, number>;
  } {
    if (this.realTimeMetrics.length === 0) {
      return {
        averageLatency: 0,
        averageBandwidth: 0,
        qualityDistribution: {},
      };
    }

    const recent = this.realTimeMetrics.slice(-20); // 最近20条记录
    const averageLatency =
      recent.reduce((sum, m) => sum + m.latency, 0) / recent.length;
    const averageBandwidth =
      recent.reduce((sum, m) => sum + m.bandwidth, 0) / recent.length;

    const qualityDistribution: Record<string, number> = {};
    recent.forEach((m) => {
      qualityDistribution[m.networkQuality] =
        (qualityDistribution[m.networkQuality] || 0) + 1;
    });

    return {
      averageLatency: Math.round(averageLatency),
      averageBandwidth: Math.round(averageBandwidth),
      qualityDistribution,
    };
  }

  /**
   * 清除实时监控数据
   */
  clearRealTimeMetrics(): void {
    this.realTimeMetrics = [];
    this.currentRealTimeSession = {};
  }

  /**
   * 保存监控状态到本地存储
   */
  private saveMonitoringState(): void {
    if (typeof window === 'undefined') return;

    try {
      const state = {
        isMonitoring: this.isMonitoring,
        isUserControlled: this.isUserControlled,
        timestamp: Date.now(),
      };
      localStorage.setItem('performanceMonitoringState', JSON.stringify(state));
    } catch (error) {
      console.warn('保存监控状态失败:', error);
    }
  }

  /**
   * 从本地存储加载监控状态
   */
  private loadMonitoringState(): {
    isMonitoring: boolean;
    isUserControlled: boolean;
  } | null {
    if (typeof window === 'undefined') return null;

    try {
      const data = localStorage.getItem('performanceMonitoringState');
      if (data) {
        const state = JSON.parse(data);
        // 检查状态是否过期（超过1小时）
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        if (state.timestamp > oneHourAgo) {
          return {
            isMonitoring: state.isMonitoring || false,
            isUserControlled: state.isUserControlled || false,
          };
        }
      }
    } catch (error) {
      console.warn('加载监控状态失败:', error);
    }

    return null;
  }

  /**
   * 清除监控状态
   */
  private clearMonitoringState(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem('performanceMonitoringState');
    } catch (error) {
      console.warn('清除监控状态失败:', error);
    }
  }

  /**
   * 检查是否应该恢复监控
   */
  shouldRestoreMonitoring(): boolean {
    const state = this.loadMonitoringState();
    return state ? state.isMonitoring && state.isUserControlled : false;
  }

  /**
   * 获取当前监控状态
   */
  getMonitoringStatus(): { isMonitoring: boolean; isUserControlled: boolean } {
    return {
      isMonitoring: this.isMonitoring,
      isUserControlled: this.isUserControlled,
    };
  }

  /**
   * 生成测试数据（用于演示）
   */
  generateTestData(): void {
    const testMetrics: PerformanceMetrics[] = [];
    const now = Date.now();

    for (let i = 0; i < 20; i++) {
      const timestamp = now - (20 - i) * 60000; // 每分钟一个数据点
      const loadTime = Math.random() * 8000 + 1000; // 1-9秒
      const searchTime = Math.random() * 3000 + 500; // 0.5-3.5秒
      const testTime = Math.random() * 4000 + 1000; // 1-5秒
      const sourceCount = Math.floor(Math.random() * 8) + 2; // 2-9个源
      const availableCount = Math.floor(
        sourceCount * (0.6 + Math.random() * 0.4)
      ); // 60-100%可用

      testMetrics.push({
        sourceSearchTime: searchTime,
        sourceTestTime: testTime,
        totalLoadTime: loadTime,
        sourceCount: sourceCount,
        selectedSource: `测试源${i + 1}`,
        cacheHit: Math.random() > 0.3, // 70%缓存命中
        sourcesInfo: Array.from({ length: sourceCount }, (_, j) => ({
          url: `https://test-source-${j + 1}.example.com/video.m3u8`,
          available: j < availableCount,
          pingTime: Math.random() * 500 + 50,
          quality: ['HD', 'SD', '4K'][Math.floor(Math.random() * 3)],
          testTime: timestamp,
          cdnOptimized: Math.random() > 0.5,
          cacheHit: Math.random() > 0.6,
        })),
        availableSourcesCount: availableCount,
        sourceSuccessRate: availableCount / sourceCount,
        requestId: `req_${i + 1}`,
        videoTitle: `测试视频 ${i + 1}`,
        videoId: `video_${i + 1}`,
        requestStartTime: timestamp - loadTime,
        requestEndTime: timestamp,
        networkType: ['wifi', '4g', '5g'][Math.floor(Math.random() * 3)],
        userAgent: 'Mozilla/5.0 (Test Browser)',
        errorDetails: Math.random() > 0.8 ? ['网络超时', '源不可用'] : [],
        retryAttempts: Math.floor(Math.random() * 3),
        finalSourceQuality: ['HD', 'SD', '4K'][Math.floor(Math.random() * 3)],
        bandwidthEstimate: Math.random() * 50 + 10, // 10-60 Mbps
      });
    }

    this.metrics = testMetrics;
    this.saveMetrics();
    console.log('已生成测试数据:', testMetrics.length, '条记录');
  }
}

// 单例实例
export const performanceMonitor = new PerformanceMonitor();

/**
 * 性能监控装饰器
 */
export function monitorPerformance<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  metricName: keyof PerformanceMetrics
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = performance.now();
    try {
      const result = await fn(...args);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // 根据指标类型记录
      switch (metricName) {
        case 'sourceSearchTime':
          performanceMonitor.recordSourceSearchTime(duration);
          break;
        case 'sourceTestTime':
          performanceMonitor.recordSourceTestTime(duration);
          break;
        case 'totalLoadTime':
          performanceMonitor.recordTotalLoadTime(duration);
          break;
      }

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      // 即使出错也记录时间
      switch (metricName) {
        case 'sourceSearchTime':
          performanceMonitor.recordSourceSearchTime(duration);
          break;
        case 'sourceTestTime':
          performanceMonitor.recordSourceTestTime(duration);
          break;
        case 'totalLoadTime':
          performanceMonitor.recordTotalLoadTime(duration);
          break;
      }

      throw error;
    }
  };
}
