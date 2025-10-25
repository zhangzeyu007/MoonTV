/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 快速播放源测试器
 * 提供更快的播放源测试和选择机制，集成CDN优化功能
 */

import { CDNOptimizedSource, cdnOptimizer } from './cdn-optimizer';

export interface FastTestResult {
  url: string;
  originalUrl?: string; // 原始URL（如果经过CDN优化）
  available: boolean;
  pingTime: number;
  quality?: string;
  loadSpeed?: string;
  score: number;
  testTime: number;
  cdnOptimized?: boolean;
  cdnInfo?: CDNOptimizedSource;
}

export interface SourceTestConfig {
  maxConcurrency: number;
  quickTestTimeout: number;
  detailedTestTimeout: number;
  enableCache: boolean;
  cacheExpiry: number;
  enableCDNOptimization: boolean;
  cdnWeight: number; // CDN优化权重 (0-1)
}

const DEFAULT_CONFIG: SourceTestConfig = {
  maxConcurrency: 6,
  quickTestTimeout: 2000,
  detailedTestTimeout: 5000,
  enableCache: true,
  cacheExpiry: 10 * 60 * 1000, // 10分钟
  enableCDNOptimization: true,
  cdnWeight: 0.3, // CDN优化权重30%
};

class FastSourceTester {
  private config: SourceTestConfig;
  private cache: Map<string, FastTestResult> = new Map();
  private testingUrls: Set<string> = new Set();

  constructor(config: Partial<SourceTestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadCacheFromStorage();
  }

  /**
   * 从本地存储加载缓存
   */
  private loadCacheFromStorage(): void {
    if (typeof window === 'undefined' || !this.config.enableCache) return;

    try {
      const cached = localStorage.getItem('fastSourceCache');
      if (cached) {
        const data = JSON.parse(cached);
        const now = Date.now();

        Object.entries(data).forEach(([key, value]: [string, any]) => {
          if (now - value.testTime < this.config.cacheExpiry) {
            this.cache.set(key, value);
          }
        });
      }
    } catch (error) {
      console.warn('加载快速源测试缓存失败:', error);
    }
  }

  /**
   * 保存缓存到本地存储
   */
  private saveCacheToStorage(): void {
    if (typeof window === 'undefined' || !this.config.enableCache) return;

    try {
      const data = Object.fromEntries(this.cache);
      localStorage.setItem('fastSourceCache', JSON.stringify(data));
    } catch (error) {
      console.warn('保存快速源测试缓存失败:', error);
    }
  }

  /**
   * 快速测试单个源（集成CDN优化）
   */
  async quickTestSource(
    url: string,
    enableCDNOptimization = true
  ): Promise<FastTestResult> {
    const cacheKey = this.getCacheKey(url);

    // 检查缓存
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.testTime < this.config.cacheExpiry) {
        return cached;
      }
    }

    // 检查是否正在测试
    if (this.testingUrls.has(url)) {
      return {
        url,
        available: false,
        pingTime: 0,
        score: 0,
        testTime: Date.now(),
      };
    }

    this.testingUrls.add(url);
    const startTime = performance.now();

    try {
      // 如果启用CDN优化，先尝试优化URL
      let testUrl = url;
      let cdnInfo: CDNOptimizedSource | undefined;
      let cdnOptimized = false;

      if (enableCDNOptimization && this.config.enableCDNOptimization) {
        try {
          const optimizedSources = await cdnOptimizer.optimizeSources([
            { source: null, episodeUrl: url },
          ]);
          if (
            optimizedSources.length > 0 &&
            optimizedSources[0].optimizedUrl &&
            optimizedSources[0].cdnInfo
          ) {
            testUrl = optimizedSources[0].optimizedUrl;
            cdnInfo = optimizedSources[0].cdnInfo;
            cdnOptimized = true;
            console.log(`CDN优化: ${url} -> ${testUrl}`);
          }
        } catch (error) {
          console.warn('CDN优化失败，使用原始URL:', error);
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.quickTestTimeout
      );

      const response = await fetch(testUrl, {
        method: 'HEAD',
        mode: 'cors',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15',
          Accept: '*/*',
          Referer: window.location.origin,
        },
      });

      clearTimeout(timeoutId);
      const pingTime = performance.now() - startTime;

      // 计算综合评分，包含CDN优化权重
      let score = this.calculateQuickScore(response.ok, pingTime);

      if (cdnOptimized && cdnInfo) {
        // CDN优化加分
        const cdnBonus = Math.min(20, cdnInfo.confidence * 20);
        score += cdnBonus * this.config.cdnWeight;
      }

      const result: FastTestResult = {
        url: testUrl, // 使用实际测试的URL
        originalUrl: url, // 保存原始URL
        available: response.ok,
        pingTime: Math.round(pingTime),
        score,
        testTime: Date.now(),
        cdnOptimized,
        cdnInfo,
      };

      // 缓存结果
      if (this.config.enableCache) {
        this.cache.set(cacheKey, result);
        this.saveCacheToStorage();
      }

      return result;
    } catch (error) {
      const pingTime = performance.now() - startTime;
      const result: FastTestResult = {
        url,
        available: false,
        pingTime: Math.round(pingTime),
        score: 0,
        testTime: Date.now(),
        cdnOptimized: false,
      };

      // 缓存失败结果
      if (this.config.enableCache) {
        this.cache.set(cacheKey, result);
        this.saveCacheToStorage();
      }

      return result;
    } finally {
      this.testingUrls.delete(url);
    }
  }

  /**
   * 批量快速测试（集成CDN优化）
   */
  async batchQuickTest(
    urls: string[],
    enableCDNOptimization = true
  ): Promise<FastTestResult[]> {
    if (urls.length === 0) return [];

    console.log(
      `开始批量快速测试 ${urls.length} 个源${
        enableCDNOptimization ? '（启用CDN优化）' : ''
      }`
    );

    // 如果启用CDN优化，先批量优化所有源
    let optimizedUrls: string[] = urls;
    const cdnOptimizationMap: Map<string, CDNOptimizedSource> = new Map();

    if (enableCDNOptimization && this.config.enableCDNOptimization) {
      try {
        const sourcesToOptimize = urls.map((url) => ({
          source: null,
          episodeUrl: url,
        }));
        const optimizedSources = await cdnOptimizer.optimizeSources(
          sourcesToOptimize
        );

        optimizedUrls = [];
        optimizedSources.forEach((optimized, index) => {
          const originalUrl = urls[index];
          if (optimized.optimizedUrl && optimized.cdnInfo) {
            optimizedUrls.push(optimized.optimizedUrl);
            cdnOptimizationMap.set(optimized.optimizedUrl, optimized.cdnInfo);
          } else {
            optimizedUrls.push(originalUrl);
          }
        });

        const optimizedCount = optimizedSources.filter(
          (s) => s.optimizedUrl
        ).length;
        console.log(`CDN优化完成: ${optimizedCount}/${urls.length} 个源已优化`);
      } catch (error) {
        console.warn('批量CDN优化失败，使用原始URL:', error);
        optimizedUrls = urls;
      }
    }

    const results: FastTestResult[] = [];

    // 分批处理，控制并发数
    const chunks = [];
    for (let i = 0; i < optimizedUrls.length; i += this.config.maxConcurrency) {
      chunks.push({
        urls: optimizedUrls.slice(i, i + this.config.maxConcurrency),
        originalUrls: urls.slice(i, i + this.config.maxConcurrency),
      });
    }

    for (const chunk of chunks) {
      const promises = chunk.urls.map(async (url, index) => {
        const originalUrl = chunk.originalUrls[index];
        const result = await this.quickTestSource(originalUrl, false); // 避免重复优化

        // 如果使用了CDN优化，更新结果信息
        if (cdnOptimizationMap.has(url)) {
          const cdnInfo = cdnOptimizationMap.get(url)!;
          result.url = url;
          result.originalUrl = originalUrl;
          result.cdnOptimized = true;
          result.cdnInfo = cdnInfo;

          // 重新计算评分，包含CDN优化权重
          const cdnBonus = Math.min(20, cdnInfo.confidence * 20);
          result.score += cdnBonus * this.config.cdnWeight;
        }

        return result;
      });

      const chunkResults = await Promise.allSettled(promises);

      chunkResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });
    }

    const availableCount = results.filter((r) => r.available).length;
    const cdnOptimizedCount = results.filter((r) => r.cdnOptimized).length;

    console.log(
      `批量测试完成: ${availableCount}/${urls.length} 个源可用，${cdnOptimizedCount} 个源已CDN优化`
    );

    return results;
  }

  /**
   * 智能源选择
   */
  selectBestSources(
    results: FastTestResult[],
    maxSources = 3
  ): FastTestResult[] {
    // 过滤可用的源
    const availableResults = results.filter((r) => r.available);

    if (availableResults.length === 0) {
      return results.slice(0, maxSources);
    }

    // 按评分排序
    availableResults.sort((a, b) => b.score - a.score);

    return availableResults.slice(0, maxSources);
  }

  /**
   * 计算快速评分
   */
  private calculateQuickScore(available: boolean, pingTime: number): number {
    if (!available) return 0;

    // 基于延迟的评分 (0-100)
    let score = 100;
    if (pingTime > 1000) score = 60;
    else if (pingTime > 500) score = 80;
    else if (pingTime > 200) score = 90;

    return score;
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return btoa(url).replace(/[^a-zA-Z0-9]/g, '');
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fastSourceCache');
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<SourceTestConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 单例实例
export const fastSourceTester = new FastSourceTester();

/**
 * 快速播放源优选函数（集成CDN优化）
 */
export async function fastPreferSources(
  sources: Array<{ source: any; episodeUrl: string }>,
  maxSources = 3,
  enableCDNOptimization = true
): Promise<
  Array<{ source: any; episodeUrl: string; testResult: FastTestResult }>
> {
  if (sources.length === 0) return [];

  console.log(
    `开始快速测试 ${sources.length} 个播放源${
      enableCDNOptimization ? '（启用CDN优化）' : ''
    }`
  );

  // 提取所有播放地址
  const urls = sources.map((s) => s.episodeUrl);

  // 批量快速测试（集成CDN优化）
  const testResults = await fastSourceTester.batchQuickTest(
    urls,
    enableCDNOptimization
  );

  // 选择最佳源
  const bestResults = fastSourceTester.selectBestSources(
    testResults,
    maxSources
  );

  // 构建结果
  const results: Array<{
    source: any;
    episodeUrl: string;
    testResult: FastTestResult;
  }> = [];

  sources.forEach(({ source, episodeUrl }) => {
    const testResult = testResults.find(
      (r) => r.url === episodeUrl || r.originalUrl === episodeUrl
    );
    if (testResult && bestResults.includes(testResult)) {
      results.push({ source, episodeUrl, testResult });
    }
  });

  const cdnOptimizedCount = results.filter(
    (r) => r.testResult.cdnOptimized
  ).length;
  console.log(
    `快速测试完成，选择了 ${results.length} 个最佳源，${cdnOptimizedCount} 个已CDN优化`
  );

  return results;
}

/**
 * 超快速源选择（仅基于可用性）
 */
export async function ultraFastSourceSelect(
  sources: Array<{ source: any; episodeUrl: string }>
): Promise<{ source: any; episodeUrl: string } | null> {
  if (sources.length === 0) return null;
  if (sources.length === 1) return sources[0];

  console.log(`超快速选择 ${sources.length} 个播放源`);

  // 只测试前3个源，提高速度
  const testSources = sources.slice(0, 3);
  const urls = testSources.map((s) => s.episodeUrl);

  // 并发快速测试
  const testResults = await fastSourceTester.batchQuickTest(urls);

  // 找到第一个可用的源
  for (const result of testResults) {
    if (result.available) {
      const source = testSources.find((s) => s.episodeUrl === result.url);
      if (source) {
        console.log(`超快速选择完成，选择源: ${source.source.source_name}`);
        return source;
      }
    }
  }

  // 如果没有可用源，返回第一个
  console.log('超快速选择完成，使用第一个源');
  return sources[0];
}
