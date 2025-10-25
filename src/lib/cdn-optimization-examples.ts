/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * CDN优化使用示例
 * 展示如何在现有代码中集成和使用CDN优化功能
 */

import { cdnOptimizer } from './cdn-optimizer';
import { fastPreferSources } from './fast-source-tester';
import { geolocationService } from './geolocation-service';

// 示例1: 基本的地理位置检测
export async function exampleGeolocationDetection() {
  try {
    console.log('开始检测用户地理位置...');

    const geolocationInfo = await geolocationService.getGeolocationInfo();

    if (geolocationInfo) {
      console.log('地理位置信息:', {
        country: geolocationInfo.country,
        city: geolocationInfo.city,
        region: geolocationInfo.region,
        ip: geolocationInfo.ip,
        cached: geolocationInfo.cached,
      });

      return geolocationInfo;
    } else {
      console.warn('无法获取地理位置信息');
      return null;
    }
  } catch (error) {
    console.error('地理位置检测失败:', error);
    return null;
  }
}

// 示例2: CDN优化建议获取
export async function exampleCDNRecommendation() {
  try {
    console.log('获取CDN优化建议...');

    const cdnResult = await geolocationService.getOptimalCDNNode();

    if (cdnResult) {
      console.log('CDN优化建议:', {
        recommendedNode: cdnResult.recommendedNode.name,
        region: cdnResult.recommendedNode.region,
        country: cdnResult.recommendedNode.country,
        estimatedLatency: cdnResult.estimatedLatency,
        distance: cdnResult.distance,
        confidence: cdnResult.confidence,
      });

      return cdnResult;
    } else {
      console.warn('无法获取CDN优化建议');
      return null;
    }
  } catch (error) {
    console.error('CDN优化建议获取失败:', error);
    return null;
  }
}

// 示例3: 单个URL的CDN优化
export async function exampleSingleURLOptimization(originalUrl: string) {
  try {
    console.log(`优化URL: ${originalUrl}`);

    const optimizedSources = await cdnOptimizer.optimizeSources([
      { source: null, episodeUrl: originalUrl },
    ]);

    if (optimizedSources.length > 0 && optimizedSources[0].optimizedUrl) {
      const optimized = optimizedSources[0];
      console.log('URL优化结果:', {
        originalUrl: originalUrl,
        optimizedUrl: optimized.optimizedUrl,
        cdnNode: optimized.cdnInfo?.cdnNode.name,
        estimatedLatency: optimized.cdnInfo?.estimatedLatency,
        confidence: optimized.cdnInfo?.confidence,
      });

      return optimized;
    } else {
      console.warn('URL优化失败，使用原始URL');
      return { source: null, episodeUrl: originalUrl };
    }
  } catch (error) {
    console.error('URL优化失败:', error);
    return { source: null, episodeUrl: originalUrl };
  }
}

// 示例4: 批量源优化和测试
export async function exampleBatchSourceOptimization(
  sources: Array<{ source: any; episodeUrl: string }>
) {
  try {
    console.log(`开始批量优化 ${sources.length} 个播放源...`);

    // 使用CDN优化的快速源优选
    const optimizedResults = await fastPreferSources(sources, 3, true);

    console.log('批量优化结果:', {
      totalSources: sources.length,
      optimizedSources: optimizedResults.length,
      cdnOptimizedCount: optimizedResults.filter(
        (r) => r.testResult.cdnOptimized
      ).length,
    });

    // 输出每个源的详细信息
    optimizedResults.forEach((result, index) => {
      const cdnInfo = result.testResult.cdnOptimized
        ? ` (CDN: ${result.testResult.cdnInfo?.cdnNode.name})`
        : '';
      console.log(
        `${index + 1}. ${result.source.source_name} - 评分: ${
          result.testResult.score
        }${cdnInfo}`
      );
    });

    return optimizedResults;
  } catch (error) {
    console.error('批量源优化失败:', error);
    return [];
  }
}

// 示例5: 在播放页面中的集成使用
export async function examplePlayPageIntegration(sourcesInfo: any[]) {
  try {
    console.log('播放页面CDN优化集成示例...');

    // 1. 检查是否启用CDN优化
    const enableCDNOptimization = true; // 可以从用户设置中获取

    if (!enableCDNOptimization) {
      console.log('CDN优化已禁用，使用标准源选择');
      return sourcesInfo[0];
    }

    // 2. 提取有效的播放源
    const validSources = sourcesInfo
      .filter((source) => source.episodes && source.episodes.length > 0)
      .map((source) => ({
        source,
        episodeUrl:
          source.episodes.length > 1 ? source.episodes[1] : source.episodes[0],
      }));

    if (validSources.length === 0) {
      console.warn('没有找到有效的播放源');
      return sourcesInfo[0];
    }

    // 3. 使用CDN优化的快速源优选
    const fastResults = await fastPreferSources(validSources, 3, true);

    if (fastResults.length === 0) {
      console.warn('快速测试没有找到可用源，使用第一个播放源');
      return sourcesInfo[0];
    }

    // 4. 选择最佳源
    const bestResult = fastResults[0];
    const cdnInfo = bestResult.testResult.cdnOptimized
      ? ` (CDN优化: ${bestResult.testResult.cdnInfo?.cdnNode.name})`
      : '';

    console.log(
      `选择最佳播放源: ${bestResult.source.source_name} (评分: ${bestResult.testResult.score})${cdnInfo}`
    );

    return bestResult.source;
  } catch (error) {
    console.warn('CDN优化集成失败，使用第一个播放源:', error);
    return sourcesInfo[0];
  }
}

// 示例6: CDN优化配置管理
export async function exampleCDNConfiguration() {
  try {
    console.log('CDN优化配置管理示例...');

    // 1. 获取当前配置建议
    const recommendations = await cdnOptimizer.getOptimizationRecommendations();
    console.log('优化建议:', recommendations.suggestions);

    // 2. 更新CDN优化配置
    cdnOptimizer.updateConfig({
      enableGeolocation: true,
      enableLatencyTest: true,
      maxConcurrency: 3,
      timeout: 3000,
    });

    console.log('CDN优化配置已更新');

    // 3. 获取缓存统计
    const cacheStats = cdnOptimizer.getCacheStats();
    console.log('缓存统计:', cacheStats);

    // 4. 清除缓存（如果需要）
    // cdnOptimizer.clearCache();
    // console.log('CDN优化缓存已清除');
  } catch (error) {
    console.error('CDN配置管理失败:', error);
  }
}

// 示例7: 错误处理和降级策略
export async function exampleErrorHandlingAndFallback(
  sources: Array<{ source: any; episodeUrl: string }>
) {
  try {
    console.log('CDN优化错误处理和降级策略示例...');

    // 尝试CDN优化
    try {
      const optimizedResults = await fastPreferSources(sources, 3, true);
      if (optimizedResults.length > 0) {
        console.log('CDN优化成功');
        return optimizedResults;
      }
    } catch (cdnError) {
      console.warn('CDN优化失败，尝试降级策略:', cdnError);
    }

    // 降级策略1: 禁用CDN优化重试
    try {
      console.log('尝试禁用CDN优化的源选择...');
      const fallbackResults = await fastPreferSources(sources, 3, false);
      if (fallbackResults.length > 0) {
        console.log('降级策略1成功');
        return fallbackResults;
      }
    } catch (fallbackError) {
      console.warn('降级策略1失败:', fallbackError);
    }

    // 降级策略2: 使用第一个可用源
    console.log('使用降级策略2: 返回第一个源');
    return [
      {
        source: sources[0].source,
        episodeUrl: sources[0].episodeUrl,
        testResult: {
          url: sources[0].episodeUrl,
          available: true,
          pingTime: 0,
          score: 50,
          testTime: Date.now(),
          cdnOptimized: false,
        },
      },
    ];
  } catch (error) {
    console.error('所有降级策略失败:', error);
    throw error;
  }
}

// 使用示例的主函数
export async function runCDNOptimizationExamples() {
  console.log('=== CDN优化功能使用示例 ===');

  // 示例数据
  const exampleSources = [
    {
      source: { source_name: '示例源1', id: '1' },
      episodeUrl: 'https://example1.com/video.m3u8',
    },
    {
      source: { source_name: '示例源2', id: '2' },
      episodeUrl: 'https://example2.com/video.m3u8',
    },
    {
      source: { source_name: '示例源3', id: '3' },
      episodeUrl: 'https://example3.com/video.m3u8',
    },
  ];

  try {
    // 运行各种示例
    await exampleGeolocationDetection();
    await exampleCDNRecommendation();
    await exampleSingleURLOptimization('https://example.com/video.m3u8');
    await exampleBatchSourceOptimization(exampleSources);
    await exampleCDNConfiguration();
    await exampleErrorHandlingAndFallback(exampleSources);

    console.log('=== CDN优化示例完成 ===');
  } catch (error) {
    console.error('CDN优化示例运行失败:', error);
  }
}
