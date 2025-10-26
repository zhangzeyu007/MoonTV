/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable unused-imports/no-unused-vars */
/**
 * 智能源优化使用示例
 * 展示如何使用智能源优化系统
 */

import {
  smartCachePreloader,
  smartSourceSelector,
  SourceCandidate,
} from './smart-source-optimization';

/**
 * 示例1：基础使用 - 渐进式选择播放源
 */
export async function example1_BasicUsage() {
  console.log('=== 示例1：基础使用 ===');

  // 准备播放源
  const sources: SourceCandidate[] = [
    {
      source: { source_name: '源1' },
      episodeUrl: 'https://example.com/video1.m3u8',
    },
    {
      source: { source_name: '源2' },
      episodeUrl: 'https://example.com/video2.m3u8',
    },
    {
      source: { source_name: '源3' },
      episodeUrl: 'https://example.com/video3.m3u8',
    },
  ];

  // 渐进式选择（推荐）
  console.log('开始渐进式选择...');
  for await (const result of smartSourceSelector.selectSourcesProgressive(
    sources,
    {
      mode: 'balanced',
      maxResults: 3,
    }
  )) {
    console.log('找到可用源:', {
      url: result.episodeUrl,
      score: result.score,
      pingTime: result.pingTime,
      cdnOptimized: result.cdnOptimized,
    });

    // 这里可以立即使用这个源开始播放
    // playVideo(result);
    // break; // 如果只需要第一个可用源，可以在这里break
  }
}

/**
 * 示例2：快速选择第一个可用源
 */
export async function example2_FastSelection() {
  console.log('\n=== 示例2：快速选择 ===');

  const sources: SourceCandidate[] = [
    {
      source: { source_name: '源1' },
      episodeUrl: 'https://example.com/video1.m3u8',
    },
    {
      source: { source_name: '源2' },
      episodeUrl: 'https://example.com/video2.m3u8',
    },
  ];

  const firstSource = await smartSourceSelector.selectFirstAvailable(sources);

  if (firstSource) {
    console.log('找到第一个可用源:', {
      url: firstSource.episodeUrl,
      score: firstSource.score,
      available: firstSource.available,
    });
  } else {
    console.log('未找到可用源');
  }
}

/**
 * 示例3：批量选择最佳源
 */
export async function example3_BatchSelection() {
  console.log('\n=== 示例3：批量选择 ===');

  const sources: SourceCandidate[] = [
    {
      source: { source_name: '源1' },
      episodeUrl: 'https://example.com/video1.m3u8',
    },
    {
      source: { source_name: '源2' },
      episodeUrl: 'https://example.com/video2.m3u8',
    },
    {
      source: { source_name: '源3' },
      episodeUrl: 'https://example.com/video3.m3u8',
    },
  ];

  const bestSources = await smartSourceSelector.selectBestSources(sources, 3);

  console.log(`找到 ${bestSources.length} 个最佳源:`);
  bestSources.forEach((source, index) => {
    console.log(`${index + 1}. ${source.episodeUrl} (评分: ${source.score})`);
  });
}

/**
 * 示例4：启用缓存预热
 */
export async function example4_CachePreloading() {
  console.log('\n=== 示例4：缓存预热 ===');

  // 启动预热
  smartCachePreloader.startPreloading();
  console.log('缓存预热已启动');

  // 添加热门源
  const hotVideos = [
    'https://popular1.com/video.m3u8',
    'https://popular2.com/video.m3u8',
    'https://popular3.com/video.m3u8',
  ];

  hotVideos.forEach((url) => {
    smartCachePreloader.addHotSource(url, 80);
  });

  console.log(`已添加 ${hotVideos.length} 个热门源`);

  // 查看统计
  const stats = smartCachePreloader.getPreloadStats();
  console.log('预热统计:', {
    totalPreloaded: stats.totalPreloaded,
    cacheHitRate: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
    averagePreloadTime: `${Math.round(stats.averagePreloadTime)}ms`,
  });
}

/**
 * 示例5：不同选择模式对比
 */
export async function example5_ModeComparison() {
  console.log('\n=== 示例5：模式对比 ===');

  const sources: SourceCandidate[] = Array.from({ length: 10 }, (_, i) => ({
    source: { source_name: `源${i + 1}` },
    episodeUrl: `https://example.com/video${i + 1}.m3u8`,
  }));

  // Fast 模式
  console.log('\n--- Fast 模式 ---');
  const fastStart = performance.now();
  let fastCount = 0;
  for await (const result of smartSourceSelector.selectSourcesProgressive(
    sources,
    { mode: 'fast' }
  )) {
    fastCount++;
  }
  console.log(
    `Fast 模式: 找到 ${fastCount} 个源，耗时 ${Math.round(
      performance.now() - fastStart
    )}ms`
  );

  // Balanced 模式
  console.log('\n--- Balanced 模式 ---');
  const balancedStart = performance.now();
  let balancedCount = 0;
  for await (const result of smartSourceSelector.selectSourcesProgressive(
    sources,
    { mode: 'balanced' }
  )) {
    balancedCount++;
  }
  console.log(
    `Balanced 模式: 找到 ${balancedCount} 个源，耗时 ${Math.round(
      performance.now() - balancedStart
    )}ms`
  );

  // Comprehensive 模式
  console.log('\n--- Comprehensive 模式 ---');
  const comprehensiveStart = performance.now();
  let comprehensiveCount = 0;
  for await (const result of smartSourceSelector.selectSourcesProgressive(
    sources,
    { mode: 'comprehensive' }
  )) {
    comprehensiveCount++;
  }
  console.log(
    `Comprehensive 模式: 找到 ${comprehensiveCount} 个源，耗时 ${Math.round(
      performance.now() - comprehensiveStart
    )}ms`
  );
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('智能源优化系统 - 使用示例\n');

  try {
    await example1_BasicUsage();
    await example2_FastSelection();
    await example3_BatchSelection();
    await example4_CachePreloading();
    await example5_ModeComparison();

    console.log('\n所有示例运行完成！');
  } catch (error) {
    console.error('示例运行失败:', error);
  }
}

// 如果直接运行此文件
if (typeof window !== 'undefined') {
  // 浏览器环境
  (window as any).smartSourceExamples = {
    example1_BasicUsage,
    example2_FastSelection,
    example3_BatchSelection,
    example4_CachePreloading,
    example5_ModeComparison,
    runAllExamples,
  };

  console.log(
    '示例已加载！在控制台中运行：\n' +
      '  smartSourceExamples.runAllExamples() - 运行所有示例\n' +
      '  smartSourceExamples.example1_BasicUsage() - 运行示例1\n' +
      '  ...'
  );
}
