/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 智能缓存预热器
 * 在后台预热热门播放源的缓存
 */

import { fastSourceTester } from './fast-source-tester';
import { sourceCache } from './source-cache';

export interface PreloadStats {
  totalPreloaded: number;
  cacheHitRate: number;
  averagePreloadTime: number;
  lastPreloadTime: number;
}

export interface HotSource {
  url: string;
  accessCount: number;
  lastAccessTime: number;
  priority: number;
}

export interface CachePreloaderConfig {
  enabled: boolean;
  preloadInterval: number; // 预热间隔（毫秒）
  maxHotSources: number; // 最大热门源数量
  minAccessCount: number; // 最小访问次数阈值
  idleTimeout: number; // 空闲超时（毫秒）
}

const DEFAULT_CONFIG: CachePreloaderConfig = {
  enabled: true,
  preloadInterval: 5 * 60 * 1000, // 5分钟
  maxHotSources: 50,
  minAccessCount: 2,
  idleTimeout: 30 * 1000, // 30秒空闲
};

/**
 * 智能缓存预热器类
 */
export class SmartCachePreloader {
  private config: CachePreloaderConfig;
  private hotSources: Map<string, HotSource> = new Map();
  private preloadTimer: NodeJS.Timeout | null = null;
  private stats: PreloadStats = {
    totalPreloaded: 0,
    cacheHitRate: 0,
    averagePreloadTime: 0,
    lastPreloadTime: 0,
  };
  private preloadTimes: number[] = [];
  private isPreloading = false;
  private lastActivityTime = Date.now();

  constructor(config: Partial<CachePreloaderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadHotSourcesFromStorage();
  }

  /**
   * 启动缓存预热
   */
  startPreloading(): void {
    if (!this.config.enabled) {
      console.log('[Cache Preloader] 预热功能已禁用');
      return;
    }

    if (this.preloadTimer) {
      console.log('[Cache Preloader] 预热已在运行');
      return;
    }

    console.log(
      `[Cache Preloader] 启动预热，间隔: ${
        this.config.preloadInterval / 1000
      }秒`
    );

    // 立即执行一次预热
    this.preloadHotSources();

    // 定期预热
    this.preloadTimer = setInterval(() => {
      this.preloadHotSources();
    }, this.config.preloadInterval);
  }

  /**
   * 停止缓存预热
   */
  stopPreloading(): void {
    if (this.preloadTimer) {
      clearInterval(this.preloadTimer);
      this.preloadTimer = null;
      console.log('[Cache Preloader] 预热已停止');
    }
  }

  /**
   * 添加热门播放源
   */
  addHotSource(url: string, priority = 50): void {
    this.lastActivityTime = Date.now();

    const existing = this.hotSources.get(url);

    if (existing) {
      existing.accessCount++;
      existing.lastAccessTime = Date.now();
      existing.priority = Math.max(existing.priority, priority);
    } else {
      this.hotSources.set(url, {
        url,
        accessCount: 1,
        lastAccessTime: Date.now(),
        priority,
      });
    }

    // 限制热门源数量
    if (this.hotSources.size > this.config.maxHotSources) {
      this.pruneHotSources();
    }

    // 保存到存储
    this.saveHotSourcesToStorage();
  }

  /**
   * 预热热门源
   */
  private async preloadHotSources(): Promise<void> {
    if (this.isPreloading) {
      console.log('[Cache Preloader] 预热正在进行中，跳过');
      return;
    }

    // 检查是否空闲
    const idleTime = Date.now() - this.lastActivityTime;
    if (idleTime < this.config.idleTimeout) {
      console.log(
        `[Cache Preloader] 用户活跃中，延迟预热 (空闲时间: ${Math.round(
          idleTime / 1000
        )}s)`
      );
      return;
    }

    this.isPreloading = true;
    const startTime = performance.now();

    try {
      // 获取需要预热的源
      const sourcesToPreload = this.getSourcesForPreload();

      if (sourcesToPreload.length === 0) {
        console.log('[Cache Preloader] 没有需要预热的源');
        return;
      }

      console.log(
        `[Cache Preloader] 开始预热 ${sourcesToPreload.length} 个热门源`
      );

      // 批量预热
      const urls = sourcesToPreload.map((s) => s.url);
      await fastSourceTester.batchQuickTest(urls, true);

      // 更新统计
      const preloadTime = performance.now() - startTime;
      this.preloadTimes.push(preloadTime);
      if (this.preloadTimes.length > 10) {
        this.preloadTimes.shift();
      }

      this.stats.totalPreloaded += sourcesToPreload.length;
      this.stats.averagePreloadTime =
        this.preloadTimes.reduce((a, b) => a + b, 0) / this.preloadTimes.length;
      this.stats.lastPreloadTime = Date.now();

      console.log(
        `[Cache Preloader] 预热完成，耗时: ${Math.round(preloadTime)}ms`
      );
    } catch (error) {
      console.error('[Cache Preloader] 预热失败:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * 获取需要预热的源
   */
  private getSourcesForPreload(): HotSource[] {
    const sources: HotSource[] = [];

    this.hotSources.forEach((hotSource) => {
      // 只预热访问次数达到阈值的源
      if (hotSource.accessCount < this.config.minAccessCount) {
        return;
      }

      // 检查是否需要重新测试
      if (sourceCache.shouldRetest(hotSource.url)) {
        sources.push(hotSource);
      }
    });

    // 按优先级和访问次数排序
    sources.sort((a, b) => {
      const scoreA = a.priority * 0.6 + a.accessCount * 0.4;
      const scoreB = b.priority * 0.6 + b.accessCount * 0.4;
      return scoreB - scoreA;
    });

    // 限制预热数量（避免一次预热太多）
    return sources.slice(0, 10);
  }

  /**
   * 修剪热门源列表
   */
  private pruneHotSources(): void {
    const sources = Array.from(this.hotSources.values());

    // 按访问次数和最后访问时间排序
    sources.sort((a, b) => {
      const scoreA =
        a.accessCount * 0.7 + (Date.now() - a.lastAccessTime) * 0.3;
      const scoreB =
        b.accessCount * 0.7 + (Date.now() - b.lastAccessTime) * 0.3;
      return scoreB - scoreA;
    });

    // 保留前N个
    const toKeep = sources.slice(0, this.config.maxHotSources);
    this.hotSources.clear();
    toKeep.forEach((source) => {
      this.hotSources.set(source.url, source);
    });

    console.log(
      `[Cache Preloader] 修剪热门源列表，保留 ${this.hotSources.size} 个`
    );
  }

  /**
   * 获取预热统计
   */
  getPreloadStats(): PreloadStats {
    // 计算缓存命中率
    const totalHotSources = this.hotSources.size;
    let cachedCount = 0;

    this.hotSources.forEach((hotSource) => {
      if (sourceCache.getCachedSource(hotSource.url)) {
        cachedCount++;
      }
    });

    this.stats.cacheHitRate =
      totalHotSources > 0 ? cachedCount / totalHotSources : 0;

    return { ...this.stats };
  }

  /**
   * 从本地存储加载热门源
   */
  private loadHotSourcesFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const cached = localStorage.getItem('hotSources');
      if (cached) {
        const data = JSON.parse(cached);
        const now = Date.now();

        // 只加载最近访问的源（7天内）
        Object.entries(data).forEach(([url, value]: [string, any]) => {
          if (now - value.lastAccessTime < 7 * 24 * 60 * 60 * 1000) {
            this.hotSources.set(url, value);
          }
        });

        console.log(
          `[Cache Preloader] 加载了 ${this.hotSources.size} 个热门源`
        );
      }
    } catch (error) {
      console.warn('[Cache Preloader] 加载热门源失败:', error);
    }
  }

  /**
   * 保存热门源到本地存储
   */
  private saveHotSourcesToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = Object.fromEntries(this.hotSources);
      localStorage.setItem('hotSources', JSON.stringify(data));
    } catch (error) {
      console.warn('[Cache Preloader] 保存热门源失败:', error);
    }
  }

  /**
   * 清除热门源
   */
  clearHotSources(): void {
    this.hotSources.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hotSources');
    }
    console.log('[Cache Preloader] 已清除所有热门源');
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CachePreloaderConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // 如果禁用了预热，停止预热
    if (!this.config.enabled) {
      this.stopPreloading();
    }
  }

  /**
   * 获取热门源列表
   */
  getHotSources(): HotSource[] {
    return Array.from(this.hotSources.values()).sort(
      (a, b) => b.accessCount - a.accessCount
    );
  }
}

// 单例实例
export const smartCachePreloader = new SmartCachePreloader();
