/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 快速播放源测试器
 * 提供更快的播放源测试和选择机制
 */

export interface FastTestResult {
  url: string;
  available: boolean;
  pingTime: number;
  quality?: string;
  loadSpeed?: string;
  score: number;
  testTime: number;
}

export interface SourceTestConfig {
  maxConcurrency: number;
  quickTestTimeout: number;
  detailedTestTimeout: number;
  enableCache: boolean;
  cacheExpiry: number;
}

const DEFAULT_CONFIG: SourceTestConfig = {
  maxConcurrency: 6,
  quickTestTimeout: 2000,
  detailedTestTimeout: 5000,
  enableCache: true,
  cacheExpiry: 10 * 60 * 1000, // 10分钟
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
   * 快速测试单个源
   */
  async quickTestSource(url: string): Promise<FastTestResult> {
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
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.quickTestTimeout
      );

      const response = await fetch(url, {
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

      const result: FastTestResult = {
        url,
        available: response.ok,
        pingTime: Math.round(pingTime),
        score: this.calculateQuickScore(response.ok, pingTime),
        testTime: Date.now(),
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
   * 批量快速测试
   */
  async batchQuickTest(urls: string[]): Promise<FastTestResult[]> {
    const results: FastTestResult[] = [];

    // 分批处理，控制并发数
    const chunks = [];
    for (let i = 0; i < urls.length; i += this.config.maxConcurrency) {
      chunks.push(urls.slice(i, i + this.config.maxConcurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map((url) => this.quickTestSource(url));
      const chunkResults = await Promise.allSettled(promises);

      chunkResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });
    }

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
 * 快速播放源优选函数
 */
export async function fastPreferSources(
  sources: Array<{ source: any; episodeUrl: string }>,
  maxSources = 3
): Promise<
  Array<{ source: any; episodeUrl: string; testResult: FastTestResult }>
> {
  if (sources.length === 0) return [];

  console.log(`开始快速测试 ${sources.length} 个播放源`);

  // 提取所有播放地址
  const urls = sources.map((s) => s.episodeUrl);

  // 批量快速测试
  const testResults = await fastSourceTester.batchQuickTest(urls);

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
    const testResult = testResults.find((r) => r.url === episodeUrl);
    if (testResult && bestResults.includes(testResult)) {
      results.push({ source, episodeUrl, testResult });
    }
  });

  console.log(`快速测试完成，选择了 ${results.length} 个最佳源`);

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
