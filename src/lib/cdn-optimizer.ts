/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * CDN优化器
 * 根据地理位置和网络状况优化CDN节点选择
 */

import {
  CDNNode,
  CDNOptimizationResult,
  GeolocationInfo,
  geolocationService,
} from './geolocation-service';

export interface CDNOptimizedSource {
  originalUrl: string;
  optimizedUrl: string;
  cdnNode: CDNNode;
  priority: number;
  estimatedLatency: number;
  distance: number;
  confidence: number;
}

export interface CDNOptimizationConfig {
  enableGeolocation: boolean;
  enableLatencyTest: boolean;
  maxConcurrency: number;
  timeout: number;
  cacheExpiry: number;
  fallbackToOriginal: boolean;
}

const DEFAULT_CONFIG: CDNOptimizationConfig = {
  enableGeolocation: true,
  enableLatencyTest: true,
  maxConcurrency: 3,
  timeout: 3000,
  cacheExpiry: 10 * 60 * 1000, // 10分钟
  fallbackToOriginal: true,
};

class CDNOptimizer {
  private config: CDNOptimizationConfig;
  private cache: Map<string, CDNOptimizedSource[]> = new Map();
  private testingUrls: Set<string> = new Set();

  constructor(config: Partial<CDNOptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadCacheFromStorage();
  }

  /**
   * 从本地存储加载缓存
   */
  private loadCacheFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const cached = localStorage.getItem('cdn_optimization_cache');
      if (cached) {
        const data = JSON.parse(cached);
        Object.entries(data).forEach(([key, value]) => {
          this.cache.set(key, value as CDNOptimizedSource[]);
        });
      }
    } catch (error) {
      console.warn('Failed to load CDN optimization cache:', error);
    }
  }

  /**
   * 保存缓存到本地存储
   */
  private saveCacheToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data: Record<string, CDNOptimizedSource[]> = {};
      this.cache.forEach((value, key) => {
        data[key] = value;
      });
      localStorage.setItem('cdn_optimization_cache', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save CDN optimization cache:', error);
    }
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * 优化播放源URL，根据地理位置选择最优CDN
   */
  async optimizeSources(
    sources: Array<{ source: any; episodeUrl: string }>
  ): Promise<
    Array<{
      source: any;
      episodeUrl: string;
      optimizedUrl?: string;
      cdnInfo?: CDNOptimizedSource;
    }>
  > {
    if (!this.config.enableGeolocation || sources.length === 0) {
      return sources.map((s) => ({ ...s }));
    }

    console.log(`开始CDN优化，共 ${sources.length} 个源`);

    try {
      // 获取最优CDN节点
      const cdnResult = await geolocationService.getOptimalCDNNode();
      if (!cdnResult) {
        console.warn('无法获取CDN优化信息，使用原始源');
        return sources.map((s) => ({ ...s }));
      }

      console.log(
        `推荐CDN节点: ${cdnResult.recommendedNode.name} (${cdnResult.recommendedNode.country})`
      );

      // 优化每个源
      const optimizedSources = await Promise.all(
        sources.map(async (source) => {
          try {
            const optimized = await this.optimizeSource(
              source.episodeUrl,
              cdnResult
            );
            return {
              ...source,
              optimizedUrl: optimized?.optimizedUrl,
              cdnInfo: optimized || undefined,
            };
          } catch (error) {
            console.warn(`优化源失败 ${source.episodeUrl}:`, error);
            return { ...source };
          }
        })
      );

      console.log(
        `CDN优化完成，优化了 ${
          optimizedSources.filter((s) => 'optimizedUrl' in s && s.optimizedUrl)
            .length
        } 个源`
      );
      return optimizedSources;
    } catch (error) {
      console.warn('CDN优化失败:', error);
      return sources.map((s) => ({ ...s }));
    }
  }

  /**
   * 优化单个源URL
   */
  private async optimizeSource(
    originalUrl: string,
    cdnResult: CDNOptimizationResult
  ): Promise<CDNOptimizedSource | null> {
    const cacheKey = this.getCacheKey(originalUrl);

    // 检查缓存
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.length > 0) {
        const now = Date.now();
        const validCached = cached.find(
          (item) =>
            item.cdnNode.id === cdnResult.recommendedNode.id &&
            now - (item as any).timestamp < this.config.cacheExpiry
        );
        if (validCached) {
          return validCached;
        }
      }
    }

    // 检查是否正在测试
    if (this.testingUrls.has(originalUrl)) {
      return null;
    }

    this.testingUrls.add(originalUrl);

    try {
      const optimizedUrl = this.generateOptimizedUrl(
        originalUrl,
        cdnResult.recommendedNode
      );

      // 如果启用了延迟测试，进行实际测试
      let estimatedLatency = cdnResult.estimatedLatency;
      if (this.config.enableLatencyTest) {
        const testLatency = await this.testLatency(optimizedUrl);
        if (testLatency > 0) {
          estimatedLatency = testLatency;
        }
      }

      const optimizedSource: CDNOptimizedSource = {
        originalUrl,
        optimizedUrl,
        cdnNode: cdnResult.recommendedNode,
        priority: cdnResult.recommendedNode.priority,
        estimatedLatency,
        distance: cdnResult.distance,
        confidence: cdnResult.confidence,
      };

      // 缓存结果
      this.cacheOptimizedSource(cacheKey, optimizedSource);

      return optimizedSource;
    } finally {
      this.testingUrls.delete(originalUrl);
    }
  }

  /**
   * 生成优化后的URL
   */
  private generateOptimizedUrl(originalUrl: string, cdnNode: CDNNode): string {
    try {
      const url = new URL(originalUrl);

      // 根据CDN节点生成优化URL
      // 这里可以根据实际的CDN服务提供商进行URL转换
      if (cdnNode.baseUrl) {
        // 如果有基础URL，替换域名
        const optimizedUrl = new URL(
          url.pathname + url.search + url.hash,
          cdnNode.baseUrl
        );
        return optimizedUrl.toString();
      } else {
        // 否则添加CDN参数或使用其他优化策略
        url.searchParams.set('cdn', cdnNode.id);
        url.searchParams.set('region', cdnNode.region);
        return url.toString();
      }
    } catch (error) {
      console.warn('Failed to generate optimized URL:', error);
      return originalUrl;
    }
  }

  /**
   * 测试URL的延迟
   */
  private async testLatency(url: string): Promise<number> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout
      );

      const startTime = performance.now();
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15',
          Accept: '*/*',
        },
      });

      clearTimeout(timeoutId);
      const latency = performance.now() - startTime;

      return response.ok ? Math.round(latency) : -1;
    } catch (error) {
      console.warn(`Latency test failed for ${url}:`, error);
      return -1;
    }
  }

  /**
   * 缓存优化后的源
   */
  private cacheOptimizedSource(
    cacheKey: string,
    optimizedSource: CDNOptimizedSource
  ): void {
    const cached = this.cache.get(cacheKey) || [];
    const timestampedSource = { ...optimizedSource, timestamp: Date.now() };

    // 移除旧的相同CDN节点的缓存
    const filtered = cached.filter(
      (item) => item.cdnNode.id !== optimizedSource.cdnNode.id
    );
    filtered.push(timestampedSource as any);

    this.cache.set(cacheKey, filtered);
    this.saveCacheToStorage();
  }

  /**
   * 批量测试CDN优化效果
   */
  async batchTestCDNOptimization(
    sources: Array<{ source: any; episodeUrl: string }>
  ): Promise<{
    optimized: Array<{
      source: any;
      episodeUrl: string;
      optimizedUrl: string;
      cdnInfo: CDNOptimizedSource;
    }>;
    original: Array<{ source: any; episodeUrl: string }>;
    performance: {
      averageLatencyImprovement: number;
      optimizationRate: number;
      totalSources: number;
    };
  }> {
    const optimizedSources = await this.optimizeSources(sources);

    const optimized = optimizedSources.filter(
      (s) => s.optimizedUrl && s.cdnInfo
    );
    const original = optimizedSources.filter((s) => !s.optimizedUrl);

    // 计算性能指标
    const latencyImprovements = optimized
      .map((s) => s.cdnInfo!.estimatedLatency)
      .filter((latency) => latency > 0);

    const averageLatencyImprovement =
      latencyImprovements.length > 0
        ? latencyImprovements.reduce((sum, latency) => sum + latency, 0) /
          latencyImprovements.length
        : 0;

    const performance = {
      averageLatencyImprovement: Math.round(averageLatencyImprovement),
      optimizationRate:
        sources.length > 0 ? (optimized.length / sources.length) * 100 : 0,
      totalSources: sources.length,
    };

    console.log(
      `CDN批量测试完成: 优化率 ${performance.optimizationRate.toFixed(
        1
      )}%, 平均延迟 ${performance.averageLatencyImprovement}ms`
    );

    return {
      optimized: optimized as Array<{
        source: any;
        episodeUrl: string;
        optimizedUrl: string;
        cdnInfo: CDNOptimizedSource;
      }>,
      original,
      performance,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CDNOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cdn_optimization_cache');
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * 获取CDN优化建议
   */
  async getOptimizationRecommendations(): Promise<{
    currentLocation: GeolocationInfo | null;
    recommendedCDN: CDNOptimizationResult | null;
    suggestions: string[];
  }> {
    try {
      const location = await geolocationService.getGeolocationInfo();
      const cdnResult = await geolocationService.getOptimalCDNNode();

      const suggestions: string[] = [];

      if (location) {
        suggestions.push(`检测到您位于 ${location.city}, ${location.country}`);

        if (cdnResult) {
          suggestions.push(
            `推荐使用 ${cdnResult.recommendedNode.name} CDN节点`
          );
          suggestions.push(
            `预估延迟: ${cdnResult.estimatedLatency.toFixed(0)}ms`
          );

          if (cdnResult.confidence > 0.8) {
            suggestions.push('CDN选择置信度较高，建议启用地理位置优化');
          } else if (cdnResult.confidence < 0.5) {
            suggestions.push('CDN选择置信度较低，建议手动选择或使用原始源');
          }
        }
      } else {
        suggestions.push('无法检测地理位置，建议使用默认CDN配置');
      }

      return {
        currentLocation: location,
        recommendedCDN: cdnResult,
        suggestions,
      };
    } catch (error) {
      console.warn('Failed to get optimization recommendations:', error);
      return {
        currentLocation: null,
        recommendedCDN: null,
        suggestions: ['无法获取优化建议'],
      };
    }
  }
}

// 单例实例
export const cdnOptimizer = new CDNOptimizer();
