/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 性能监控工具
 * 用于监控播放器加载性能
 */

export interface PerformanceMetrics {
  sourceSearchTime: number;
  sourceTestTime: number;
  totalLoadTime: number;
  sourceCount: number;
  selectedSource: string;
  cacheHit: boolean;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private currentSession: Partial<PerformanceMetrics> = {};

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
