/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * CDN优化测试工具
 * 用于测试和验证CDN优化功能的效果
 */

import { cdnOptimizer } from './cdn-optimizer';
import { fastSourceTester } from './fast-source-tester';
import { geolocationService } from './geolocation-service';

export interface CDNTestResult {
  testId: string;
  timestamp: number;
  testUrls: string[];
  geolocationInfo: any;
  cdnOptimizationResult: any;
  performanceMetrics: {
    totalTestTime: number;
    averageLatency: number;
    optimizationRate: number;
    cdnOptimizedCount: number;
    averageImprovement: number;
  };
  recommendations: string[];
}

export interface CDNTestConfig {
  testUrls: string[];
  enableGeolocation: boolean;
  enableCDNOptimization: boolean;
  enableLatencyTest: boolean;
  maxConcurrency: number;
}

class CDNOptimizationTester {
  private testHistory: CDNTestResult[] = [];
  private maxHistorySize = 10;

  /**
   * 执行CDN优化测试
   */
  async runCDNTest(config: CDNTestConfig): Promise<CDNTestResult> {
    const testId = `cdn_test_${Date.now()}`;
    const startTime = performance.now();

    console.log(`开始CDN优化测试: ${testId}`);

    try {
      // 1. 获取地理位置信息
      let geolocationInfo = null;
      if (config.enableGeolocation) {
        geolocationInfo = await geolocationService.getGeolocationInfo();
        console.log('地理位置信息:', geolocationInfo);
      }

      // 2. 获取CDN优化建议
      let cdnOptimizationResult = null;
      if (config.enableCDNOptimization) {
        cdnOptimizationResult = await geolocationService.getOptimalCDNNode();
        console.log('CDN优化建议:', cdnOptimizationResult);
      }

      // 3. 执行源测试
      const testSources = config.testUrls.map((url) => ({
        source: null,
        episodeUrl: url,
      }));

      // 使用CDN优化进行测试
      const optimizedSources = await cdnOptimizer.optimizeSources(testSources);

      // 执行快速测试
      const testResults = await fastSourceTester.batchQuickTest(
        config.testUrls,
        config.enableCDNOptimization
      );

      // 4. 计算性能指标
      const totalTestTime = performance.now() - startTime;
      const availableResults = testResults.filter((r) => r.available);
      const cdnOptimizedResults = testResults.filter((r) => r.cdnOptimized);

      const averageLatency =
        availableResults.length > 0
          ? availableResults.reduce((sum, r) => sum + r.pingTime, 0) /
            availableResults.length
          : 0;

      const optimizationRate =
        config.testUrls.length > 0
          ? (cdnOptimizedResults.length / config.testUrls.length) * 100
          : 0;

      // 估算改进效果（基于CDN优化结果）
      let averageImprovement = 0;
      if (cdnOptimizedResults.length > 0) {
        const improvements = cdnOptimizedResults.map((r) => {
          if (r.cdnInfo) {
            return Math.max(0, 100 - r.cdnInfo.estimatedLatency);
          }
          return 0;
        });
        averageImprovement =
          improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;
      }

      // 5. 生成建议
      const recommendations = this.generateRecommendations({
        geolocationInfo,
        cdnOptimizationResult,
        optimizationRate,
        averageLatency,
        averageImprovement,
      });

      const testResult: CDNTestResult = {
        testId,
        timestamp: Date.now(),
        testUrls: config.testUrls,
        geolocationInfo,
        cdnOptimizationResult,
        performanceMetrics: {
          totalTestTime: Math.round(totalTestTime),
          averageLatency: Math.round(averageLatency),
          optimizationRate: Math.round(optimizationRate * 100) / 100,
          cdnOptimizedCount: cdnOptimizedResults.length,
          averageImprovement: Math.round(averageImprovement),
        },
        recommendations,
      };

      // 保存测试历史
      this.testHistory.unshift(testResult);
      if (this.testHistory.length > this.maxHistorySize) {
        this.testHistory = this.testHistory.slice(0, this.maxHistorySize);
      }

      console.log(`CDN优化测试完成: ${testId}`, testResult.performanceMetrics);

      return testResult;
    } catch (error) {
      console.error('CDN优化测试失败:', error);
      throw error;
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(data: {
    geolocationInfo: any;
    cdnOptimizationResult: any;
    optimizationRate: number;
    averageLatency: number;
    averageImprovement: number;
  }): string[] {
    const recommendations: string[] = [];

    if (data.geolocationInfo) {
      recommendations.push(
        `检测到您位于 ${data.geolocationInfo.city}, ${data.geolocationInfo.country}`
      );
    }

    if (data.cdnOptimizationResult) {
      recommendations.push(
        `推荐使用 ${data.cdnOptimizationResult.recommendedNode.name} CDN节点`
      );
      recommendations.push(
        `预估延迟: ${data.cdnOptimizationResult.estimatedLatency.toFixed(0)}ms`
      );
    }

    if (data.optimizationRate > 80) {
      recommendations.push('CDN优化率很高，建议保持当前配置');
    } else if (data.optimizationRate > 50) {
      recommendations.push('CDN优化率中等，建议检查网络连接');
    } else {
      recommendations.push('CDN优化率较低，建议检查CDN配置或网络环境');
    }

    if (data.averageLatency < 100) {
      recommendations.push('平均延迟较低，网络状况良好');
    } else if (data.averageLatency < 300) {
      recommendations.push('平均延迟中等，建议优化网络环境');
    } else {
      recommendations.push('平均延迟较高，建议检查网络连接或更换CDN节点');
    }

    if (data.averageImprovement > 50) {
      recommendations.push('CDN优化效果显著，建议启用地理位置优化');
    } else if (data.averageImprovement > 20) {
      recommendations.push('CDN优化有一定效果，建议保持启用');
    } else {
      recommendations.push('CDN优化效果有限，建议检查CDN配置');
    }

    return recommendations;
  }

  /**
   * 获取测试历史
   */
  getTestHistory(): CDNTestResult[] {
    return [...this.testHistory];
  }

  /**
   * 清除测试历史
   */
  clearTestHistory(): void {
    this.testHistory = [];
  }

  /**
   * 获取测试统计
   */
  getTestStats(): {
    totalTests: number;
    averageOptimizationRate: number;
    averageLatency: number;
    averageImprovement: number;
    lastTestTime: number | null;
  } {
    if (this.testHistory.length === 0) {
      return {
        totalTests: 0,
        averageOptimizationRate: 0,
        averageLatency: 0,
        averageImprovement: 0,
        lastTestTime: null,
      };
    }

    const totalTests = this.testHistory.length;
    const averageOptimizationRate =
      this.testHistory.reduce(
        (sum, test) => sum + test.performanceMetrics.optimizationRate,
        0
      ) / totalTests;

    const averageLatency =
      this.testHistory.reduce(
        (sum, test) => sum + test.performanceMetrics.averageLatency,
        0
      ) / totalTests;

    const averageImprovement =
      this.testHistory.reduce(
        (sum, test) => sum + test.performanceMetrics.averageImprovement,
        0
      ) / totalTests;

    const lastTestTime = this.testHistory[0]?.timestamp || null;

    return {
      totalTests,
      averageOptimizationRate: Math.round(averageOptimizationRate * 100) / 100,
      averageLatency: Math.round(averageLatency),
      averageImprovement: Math.round(averageImprovement),
      lastTestTime,
    };
  }

  /**
   * 快速测试单个URL的CDN优化效果
   */
  async quickTestUrl(url: string): Promise<{
    originalUrl: string;
    optimizedUrl?: string;
    cdnNode?: string;
    latencyImprovement?: number;
    confidence?: number;
  }> {
    try {
      const optimizedSources = await cdnOptimizer.optimizeSources([
        { source: null, episodeUrl: url },
      ]);

      if (
        optimizedSources.length > 0 &&
        optimizedSources[0].optimizedUrl &&
        optimizedSources[0].cdnInfo
      ) {
        const optimized = optimizedSources[0];
        return {
          originalUrl: url,
          optimizedUrl: optimized.optimizedUrl,
          cdnNode: optimized.cdnInfo?.cdnNode.name || 'Unknown',
          latencyImprovement: optimized.cdnInfo
            ? Math.round(100 - optimized.cdnInfo.estimatedLatency)
            : 0,
          confidence: optimized.cdnInfo?.confidence || 0,
        };
      }

      return { originalUrl: url };
    } catch (error) {
      console.warn('快速URL测试失败:', error);
      return { originalUrl: url };
    }
  }
}

// 单例实例
export const cdnOptimizationTester = new CDNOptimizationTester();
