/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 源可用性缓存系统
 * 用于缓存和预测试视频源的可用性，提升播放体验
 */

export interface SourceTestResult {
  quality: string;
  loadSpeed: string;
  pingTime: number;
  hasError?: boolean;
  testTime: number; // 测试时间戳
  successRate: number; // 成功率 (0-1)
}

export interface CachedSourceInfo {
  url: string;
  testResult: SourceTestResult;
  lastTestTime: number;
  testCount: number; // 测试次数
  averageScore: number; // 平均评分
  healthScore: number; // 健康度评分 (0-1)
}

export interface SourceCacheConfig {
  cacheExpiry: number; // 缓存过期时间（毫秒）
  maxCacheSize: number; // 最大缓存条目数
  minTestInterval: number; // 最小测试间隔（毫秒）
  healthThreshold: number; // 健康度阈值
}

const DEFAULT_CONFIG: SourceCacheConfig = {
  cacheExpiry: 30 * 60 * 1000, // 30分钟
  maxCacheSize: 1000,
  minTestInterval: 5 * 60 * 1000, // 5分钟
  healthThreshold: 0.3, // 30%成功率阈值
};

class SourceCacheManager {
  private cache: Map<string, CachedSourceInfo> = new Map();
  private config: SourceCacheConfig;
  private testingSources: Set<string> = new Set(); // 正在测试的源

  constructor(config: Partial<SourceCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  /**
   * 从本地存储加载缓存
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const cached = localStorage.getItem('sourceCache');
      if (cached) {
        const data = JSON.parse(cached);
        const now = Date.now();

        // 只加载未过期的缓存
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          if (now - value.lastTestTime < this.config.cacheExpiry) {
            this.cache.set(key, value);
          }
        });
      }
    } catch (error) {
      console.warn('加载源缓存失败:', error);
    }
  }

  /**
   * 保存缓存到本地存储
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = Object.fromEntries(this.cache);
      localStorage.setItem('sourceCache', JSON.stringify(data));
    } catch (error) {
      console.warn('保存源缓存失败:', error);
    }
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(url: string): string {
    // 使用URL的hash作为缓存键，避免URL过长
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * 检查源是否需要重新测试
   */
  shouldRetest(url: string): boolean {
    const key = this.getCacheKey(url);
    const cached = this.cache.get(key);

    if (!cached) return true;

    const now = Date.now();
    const timeSinceLastTest = now - cached.lastTestTime;

    // 如果健康度低，缩短测试间隔
    const testInterval =
      cached.healthScore < this.config.healthThreshold
        ? this.config.minTestInterval / 2
        : this.config.minTestInterval;

    return timeSinceLastTest > testInterval;
  }

  /**
   * 更新源的缓存信息
   */
  updateCache(url: string, testResult: SourceTestResult): void {
    const key = this.getCacheKey(url);
    const now = Date.now();

    let cached = this.cache.get(key);

    if (!cached) {
      cached = {
        url,
        testResult,
        lastTestTime: now,
        testCount: 1,
        averageScore: this.calculateScore(testResult),
        healthScore: testResult.hasError ? 0 : 1,
      };
    } else {
      // 更新现有缓存
      cached.testCount++;
      cached.lastTestTime = now;

      // 计算新的平均评分
      const newScore = this.calculateScore(testResult);
      cached.averageScore =
        (cached.averageScore * (cached.testCount - 1) + newScore) /
        cached.testCount;

      // 更新健康度评分
      const success = testResult.hasError ? 0 : 1;
      cached.healthScore =
        (cached.healthScore * (cached.testCount - 1) + success) /
        cached.testCount;

      cached.testResult = testResult;
    }

    this.cache.set(key, cached);

    // 清理过期缓存
    this.cleanupExpiredCache();

    // 保存到存储
    this.saveToStorage();
  }

  /**
   * 计算源的综合评分
   */
  private calculateScore(testResult: SourceTestResult): number {
    let score = 0;

    // 质量评分 (40%)
    const qualityScore = this.getQualityScore(testResult.quality);
    score += qualityScore * 0.4;

    // 速度评分 (40%)
    const speedScore = this.getSpeedScore(testResult.loadSpeed);
    score += speedScore * 0.4;

    // 延迟评分 (20%)
    const pingScore = this.getPingScore(testResult.pingTime);
    score += pingScore * 0.2;

    return Math.round(score);
  }

  /**
   * 获取质量评分
   */
  private getQualityScore(quality: string): number {
    switch (quality) {
      case '4K':
        return 100;
      case '2K':
        return 85;
      case '1080p':
        return 75;
      case '720p':
        return 60;
      case '480p':
        return 40;
      case 'SD':
        return 20;
      default:
        return 0;
    }
  }

  /**
   * 获取速度评分
   */
  private getSpeedScore(speed: string): number {
    if (speed === '未知' || speed === '测量中...') return 30;

    const match = speed.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
    if (!match) return 30;

    const value = parseFloat(match[1]);
    const unit = match[2];
    const speedKBps = unit === 'MB/s' ? value * 1024 : value;

    // 基于速度线性评分，1MB/s = 100分
    return Math.min(100, Math.max(0, (speedKBps / 1024) * 100));
  }

  /**
   * 获取延迟评分
   */
  private getPingScore(ping: number): number {
    if (ping <= 0) return 0;

    // 延迟越低评分越高
    if (ping <= 100) return 100;
    if (ping <= 200) return 80;
    if (ping <= 500) return 60;
    if (ping <= 1000) return 40;
    if (ping <= 2000) return 20;
    return 0;
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((value, key) => {
      if (now - value.lastTestTime > this.config.cacheExpiry) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach((key) => this.cache.delete(key));

    // 如果缓存过大，删除最旧的条目
    if (this.cache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].lastTestTime - b[1].lastTestTime);

      const toDelete = entries.slice(
        0,
        this.cache.size - this.config.maxCacheSize
      );
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * 获取缓存的源信息
   */
  getCachedSource(url: string): CachedSourceInfo | null {
    const key = this.getCacheKey(url);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // 检查是否过期
    const now = Date.now();
    if (now - cached.lastTestTime > this.config.cacheExpiry) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * 检查源是否正在测试
   */
  isTesting(url: string): boolean {
    return this.testingSources.has(url);
  }

  /**
   * 标记源开始测试
   */
  markTesting(url: string): void {
    this.testingSources.add(url);
  }

  /**
   * 标记源测试完成
   */
  markTestComplete(url: string): void {
    this.testingSources.delete(url);
  }

  /**
   * 快速测试源的可用性（HEAD请求）
   */
  async quickTestSource(
    url: string
  ): Promise<{ available: boolean; pingTime: number }> {
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超时

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15',
          Referer: window.location.origin,
          Accept: '*/*',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const pingTime = performance.now() - startTime;

      return {
        available: response.ok,
        pingTime: Math.round(pingTime),
      };
    } catch (error) {
      const pingTime = performance.now() - startTime;
      return {
        available: false,
        pingTime: Math.round(pingTime),
      };
    }
  }

  /**
   * 批量快速测试多个源
   */
  async batchQuickTest(
    urls: string[]
  ): Promise<Map<string, { available: boolean; pingTime: number }>> {
    const results = new Map<string, { available: boolean; pingTime: number }>();

    // 并发测试，但限制并发数
    const concurrency = Math.min(6, urls.length);
    const chunks = [];

    for (let i = 0; i < urls.length; i += concurrency) {
      chunks.push(urls.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (url) => {
        const result = await this.quickTestSource(url);
        results.set(url, result);
      });

      await Promise.allSettled(promises);
    }

    return results;
  }

  /**
   * 获取源的健康度信息
   */
  getSourceHealth(
    url: string
  ): { healthScore: number; testCount: number; lastTestTime: number } | null {
    const key = this.getCacheKey(url);
    const cached = this.cache.get(key);

    if (!cached) return null;

    return {
      healthScore: cached.healthScore,
      testCount: cached.testCount,
      lastTestTime: cached.lastTestTime,
    };
  }

  /**
   * 获取所有缓存的源信息
   */
  getAllCachedSources(): CachedSourceInfo[] {
    return Array.from(this.cache.values());
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.testingSources.clear();

    if (typeof window !== 'undefined') {
      localStorage.removeItem('sourceCache');
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<SourceCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 单例实例
export const sourceCache = new SourceCacheManager();

/**
 * 智能源测试函数
 * 结合缓存和快速测试，提供最优的源选择
 */
export async function smartTestSource(
  url: string,
  detailedTest?: (url: string) => Promise<SourceTestResult>
): Promise<SourceTestResult | null> {
  // 检查是否正在测试
  if (sourceCache.isTesting(url)) {
    return null;
  }

  // 检查缓存
  const cached = sourceCache.getCachedSource(url);
  if (cached && !sourceCache.shouldRetest(url)) {
    return cached.testResult;
  }

  // 标记开始测试
  sourceCache.markTesting(url);

  try {
    // 先进行快速测试
    const quickResult = await sourceCache.quickTestSource(url);

    if (!quickResult.available) {
      // 快速测试失败，记录失败结果
      const failedResult: SourceTestResult = {
        quality: '未知',
        loadSpeed: '未知',
        pingTime: quickResult.pingTime,
        hasError: true,
        testTime: Date.now(),
        successRate: 0,
      };

      sourceCache.updateCache(url, failedResult);
      return failedResult;
    }

    // 如果提供了详细测试函数，进行详细测试
    if (detailedTest) {
      try {
        const detailedResult = await detailedTest(url);
        sourceCache.updateCache(url, detailedResult);
        return detailedResult;
      } catch (error) {
        // 详细测试失败，使用快速测试结果
        const fallbackResult: SourceTestResult = {
          quality: '未知',
          loadSpeed: '未知',
          pingTime: quickResult.pingTime,
          hasError: false,
          testTime: Date.now(),
          successRate: 0.5, // 部分成功
        };

        sourceCache.updateCache(url, fallbackResult);
        return fallbackResult;
      }
    } else {
      // 只有快速测试结果
      const quickTestResult: SourceTestResult = {
        quality: '未知',
        loadSpeed: '未知',
        pingTime: quickResult.pingTime,
        hasError: false,
        testTime: Date.now(),
        successRate: 1,
      };

      sourceCache.updateCache(url, quickTestResult);
      return quickTestResult;
    }
  } finally {
    // 标记测试完成
    sourceCache.markTestComplete(url);
  }
}

/**
 * 批量智能测试源
 */
export async function batchSmartTestSources(
  urls: string[],
  detailedTest?: (url: string) => Promise<SourceTestResult>
): Promise<Map<string, SourceTestResult | null>> {
  const results = new Map<string, SourceTestResult | null>();

  // 并发测试，限制并发数
  const concurrency = Math.min(4, urls.length);
  const chunks = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    chunks.push(urls.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (url) => {
      const result = await smartTestSource(url, detailedTest);
      results.set(url, result);
    });

    await Promise.allSettled(promises);
  }

  return results;
}
