/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 分层测试器
 * 实现三层测试策略，逐步验证播放源质量
 */

import { fastSourceTester } from './fast-source-tester';
import { sourceCache } from './source-cache';

export interface CacheCheckResult {
  hit: boolean; // 是否命中缓存
  fresh: boolean; // 缓存是否新鲜
  cachedScore: number; // 缓存的评分
  cachedAvailable: boolean; // 缓存的可用性
  cacheAge: number; // 缓存年龄（ms）
}

export interface QuickTestResult {
  available: boolean; // 是否可用
  pingTime: number; // 延迟时间（ms）
  score: number; // 快速测试评分
  statusCode?: number; // HTTP状态码
}

export interface DeepValidationResult {
  available: boolean; // 是否可用
  bandwidth: number; // 带宽（Mbps）
  quality: string; // 视频质量
  loadSpeed: string; // 加载速度
  score: number; // 深度验证评分
}

export interface LayeredTestResult {
  layer1: CacheCheckResult; // 缓存检查结果
  layer2?: QuickTestResult; // 快速测试结果
  layer3?: DeepValidationResult; // 深度验证结果
  finalScore: number; // 最终评分
  available: boolean; // 是否可用
  testDuration: number; // 测试耗时（ms）
  layersUsed: number; // 使用的层数
}

export interface MultiLayerTestConfig {
  enableLayer1: boolean; // 启用缓存检查
  enableLayer2: boolean; // 启用快速测试
  enableLayer3: boolean; // 启用深度验证
  layer1FreshnessThreshold: number; // Layer1新鲜度阈值（ms）
  layer3Threshold: number; // Layer3触发阈值（优先级分数）
}

const DEFAULT_CONFIG: MultiLayerTestConfig = {
  enableLayer1: true,
  enableLayer2: true,
  enableLayer3: false, // 默认不启用深度验证
  layer1FreshnessThreshold: 5 * 60 * 1000, // 5分钟
  layer3Threshold: 80, // 优先级>80才进行深度验证
};

/**
 * 分层测试器类
 */
export class MultiLayerTester {
  private config: MultiLayerTestConfig;

  constructor(config: Partial<MultiLayerTestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行分层测试
   */
  async testInLayers(url: string, priority = 50): Promise<LayeredTestResult> {
    const startTime = performance.now();
    let layersUsed = 0;

    const result: LayeredTestResult = {
      layer1: await this.checkCache(url),
      finalScore: 0,
      available: false,
      testDuration: 0,
      layersUsed: 0,
    };

    layersUsed++;

    // Layer 1: 缓存检查
    if (this.config.enableLayer1 && result.layer1.hit && result.layer1.fresh) {
      result.finalScore = result.layer1.cachedScore;
      result.available = result.layer1.cachedAvailable;
      result.testDuration = Math.round(performance.now() - startTime);
      result.layersUsed = layersUsed;

      console.log(
        `[Multi-Layer] Layer 1 命中: ${url.substring(
          0,
          50
        )}... (缓存年龄: ${Math.round(result.layer1.cacheAge / 1000)}s)`
      );

      return result; // 缓存命中且新鲜，直接返回
    }

    // Layer 2: 快速测试（HEAD请求）
    if (this.config.enableLayer2) {
      layersUsed++;
      result.layer2 = await this.quickTest(url);

      if (!result.layer2.available) {
        result.available = false;
        result.finalScore = 0;
        result.testDuration = Math.round(performance.now() - startTime);
        result.layersUsed = layersUsed;

        console.log(
          `[Multi-Layer] Layer 2 失败: ${url.substring(0, 50)}... (不可用)`
        );

        return result; // 快速测试失败，无需深度验证
      }

      result.finalScore = result.layer2.score;
      result.available = result.layer2.available;
    }

    // Layer 3: 深度验证（可选，仅对高优先级源）
    if (
      this.config.enableLayer3 &&
      this.shouldDeepValidate(priority, result.layer2)
    ) {
      layersUsed++;
      result.layer3 = await this.deepValidate(url);

      result.finalScore = this.calculateFinalScore(
        result.layer2,
        result.layer3
      );
      result.available = result.layer3.available;

      console.log(
        `[Multi-Layer] Layer 3 完成: ${url.substring(0, 50)}... (最终评分: ${
          result.finalScore
        })`
      );
    }

    result.testDuration = Math.round(performance.now() - startTime);
    result.layersUsed = layersUsed;

    return result;
  }

  /**
   * Layer 1: 缓存检查
   */
  private async checkCache(url: string): Promise<CacheCheckResult> {
    const cached = sourceCache.getCachedSource(url);

    if (!cached) {
      return {
        hit: false,
        fresh: false,
        cachedScore: 0,
        cachedAvailable: false,
        cacheAge: 0,
      };
    }

    const now = Date.now();
    const cacheAge = now - cached.lastTestTime;
    const fresh = cacheAge < this.config.layer1FreshnessThreshold;

    return {
      hit: true,
      fresh,
      cachedScore: cached.averageScore,
      cachedAvailable: !cached.testResult.hasError,
      cacheAge,
    };
  }

  /**
   * Layer 2: 快速测试（HEAD请求）
   */
  private async quickTest(url: string): Promise<QuickTestResult> {
    try {
      const testResult = await fastSourceTester.quickTestSource(url, false);

      return {
        available: testResult.available,
        pingTime: testResult.pingTime,
        score: testResult.score,
        statusCode: testResult.available ? 200 : 0,
      };
    } catch (error) {
      return {
        available: false,
        pingTime: 0,
        score: 0,
      };
    }
  }

  /**
   * Layer 3: 深度验证（可选）
   */
  private async deepValidate(url: string): Promise<DeepValidationResult> {
    // 注意：深度验证需要实际下载部分内容，成本较高
    // 这里提供一个简化实现，实际项目中可以根据需要扩展

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const startTime = performance.now();
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
        headers: {
          Range: 'bytes=0-10240', // 只下载前10KB
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          available: false,
          bandwidth: 0,
          quality: '未知',
          loadSpeed: '未知',
          score: 0,
        };
      }

      const loadTime = performance.now() - startTime;
      const contentLength = parseInt(
        response.headers.get('content-length') || '0'
      );

      // 估算带宽（Mbps）
      const bandwidth =
        contentLength > 0 ? (contentLength * 8) / (loadTime * 1000) : 0;

      // 估算加载速度
      const loadSpeed =
        loadTime > 0
          ? `${((10240 / 1024 / loadTime) * 1000).toFixed(2)} MB/s`
          : '未知';

      // 根据带宽估算质量
      let quality = 'SD';
      if (bandwidth > 10) quality = '4K';
      else if (bandwidth > 5) quality = '2K';
      else if (bandwidth > 3) quality = '1080p';
      else if (bandwidth > 1.5) quality = '720p';
      else if (bandwidth > 0.5) quality = '480p';

      // 计算深度验证评分
      const score = this.calculateDeepValidationScore(bandwidth, loadTime);

      return {
        available: true,
        bandwidth: Math.round(bandwidth * 100) / 100,
        quality,
        loadSpeed,
        score,
      };
    } catch (error) {
      return {
        available: false,
        bandwidth: 0,
        quality: '未知',
        loadSpeed: '未知',
        score: 0,
      };
    }
  }

  /**
   * 判断是否应该进行深度验证
   */
  private shouldDeepValidate(
    priority: number,
    quickTestResult?: QuickTestResult
  ): boolean {
    // 只对高优先级源进行深度验证
    if (priority < this.config.layer3Threshold) {
      return false;
    }

    // 如果快速测试不可用，不进行深度验证
    if (quickTestResult && !quickTestResult.available) {
      return false;
    }

    return true;
  }

  /**
   * 计算最终评分
   */
  private calculateFinalScore(
    layer2?: QuickTestResult,
    layer3?: DeepValidationResult
  ): number {
    if (!layer2) return 0;

    let score = layer2.score;

    // 如果有深度验证结果，综合计算
    if (layer3 && layer3.available) {
      // Layer2权重60%，Layer3权重40%
      score = layer2.score * 0.6 + layer3.score * 0.4;
    }

    return Math.round(score);
  }

  /**
   * 计算深度验证评分
   */
  private calculateDeepValidationScore(
    bandwidth: number,
    loadTime: number
  ): number {
    let score = 0;

    // 带宽评分（70%）
    if (bandwidth > 10) score += 70;
    else if (bandwidth > 5) score += 60;
    else if (bandwidth > 3) score += 50;
    else if (bandwidth > 1.5) score += 40;
    else if (bandwidth > 0.5) score += 30;
    else score += 20;

    // 加载时间评分（30%）
    if (loadTime < 500) score += 30;
    else if (loadTime < 1000) score += 25;
    else if (loadTime < 2000) score += 20;
    else if (loadTime < 3000) score += 15;
    else score += 10;

    return Math.min(100, score);
  }

  /**
   * 批量分层测试
   */
  async batchTestInLayers(
    urls: string[],
    priorities: number[] = []
  ): Promise<LayeredTestResult[]> {
    const results: LayeredTestResult[] = [];

    console.log(`[Multi-Layer] 开始批量分层测试 ${urls.length} 个源`);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const priority = priorities[i] || 50;
      const result = await this.testInLayers(url, priority);
      results.push(result);
    }

    const layer1Hits = results.filter(
      (r) => r.layer1.hit && r.layer1.fresh
    ).length;
    const layer2Used = results.filter((r) => r.layersUsed >= 2).length;
    const layer3Used = results.filter((r) => r.layersUsed >= 3).length;

    console.log(
      `[Multi-Layer] 批量测试完成: Layer1命中=${layer1Hits}, Layer2使用=${layer2Used}, Layer3使用=${layer3Used}`
    );

    return results;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MultiLayerTestConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 单例实例
export const multiLayerTester = new MultiLayerTester();
