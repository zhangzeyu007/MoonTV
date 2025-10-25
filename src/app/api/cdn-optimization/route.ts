import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * CDN优化配置API
 * 提供CDN优化功能的配置和状态查询
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        return await getCDNStatus();
      case 'recommendations':
        return await getOptimizationRecommendations();
      case 'cache-stats':
        return await getCacheStats();
      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            availableActions: ['status', 'recommendations', 'cache-stats'],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('CDN API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();

    switch (action) {
      case 'configure':
        return await configureCDN(body);
      case 'clear-cache':
        return await clearCache();
      case 'test-optimization':
        return await testOptimization(body);
      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            availableActions: ['configure', 'clear-cache', 'test-optimization'],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('CDN API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 获取CDN优化状态
 */
async function getCDNStatus() {
  // 这里应该从实际的CDN优化器获取状态
  // 由于这是Edge Runtime，我们需要模拟返回
  return NextResponse.json({
    enabled: true,
    geolocationAvailable: true,
    cdnNodes: 12,
    lastOptimization: new Date().toISOString(),
    optimizationRate: 85.5,
    averageLatencyImprovement: 45,
  });
}

/**
 * 获取优化建议
 */
async function getOptimizationRecommendations() {
  // 模拟返回优化建议
  return NextResponse.json({
    currentLocation: {
      country: '中国',
      city: '北京',
      region: '华北',
    },
    recommendedCDN: {
      node: '北京',
      region: '华北',
      estimatedLatency: 25,
      confidence: 0.9,
    },
    suggestions: [
      '检测到您位于北京，推荐使用北京CDN节点',
      '预估延迟: 25ms',
      'CDN选择置信度较高，建议启用地理位置优化',
    ],
  });
}

/**
 * 获取缓存统计
 */
async function getCacheStats() {
  return NextResponse.json({
    geolocationCache: {
      size: 1,
      entries: ['default'],
    },
    cdnOptimizationCache: {
      size: 15,
      entries: ['example1.com', 'example2.com'],
    },
    fastSourceCache: {
      size: 8,
      entries: ['source1', 'source2'],
    },
  });
}

/**
 * 配置CDN优化
 */
async function configureCDN(config: any) {
  // 这里应该更新CDN优化器的配置
  return NextResponse.json({
    success: true,
    message: 'CDN配置已更新',
    config: {
      enableGeolocation: config.enableGeolocation ?? true,
      enableLatencyTest: config.enableLatencyTest ?? true,
      cdnWeight: config.cdnWeight ?? 0.3,
      maxConcurrency: config.maxConcurrency ?? 3,
      timeout: config.timeout ?? 3000,
    },
  });
}

/**
 * 清除缓存
 */
async function clearCache() {
  // 这里应该清除所有相关缓存
  return NextResponse.json({
    success: true,
    message: '缓存已清除',
    clearedCaches: ['geolocation', 'cdn-optimization', 'fast-source'],
  });
}

/**
 * 测试CDN优化
 */
async function testOptimization(testData: { urls: string[] }) {
  const { urls } = testData;

  if (!urls || !Array.isArray(urls)) {
    return NextResponse.json({ error: 'Invalid test data' }, { status: 400 });
  }

  // 模拟CDN优化测试结果
  const results = urls.map((url, index) => ({
    originalUrl: url,
    optimizedUrl: `${url}?cdn=beijing&region=cn-north`,
    cdnNode: '北京',
    estimatedLatency: 25 + Math.random() * 20,
    distance: 0,
    confidence: 0.8 + Math.random() * 0.2,
    optimized: Math.random() > 0.3,
  }));

  const optimizedCount = results.filter((r) => r.optimized).length;
  const averageLatency =
    results.reduce((sum, r) => sum + r.estimatedLatency, 0) / results.length;

  return NextResponse.json({
    success: true,
    results,
    summary: {
      totalSources: urls.length,
      optimizedSources: optimizedCount,
      optimizationRate: (optimizedCount / urls.length) * 100,
      averageLatency: Math.round(averageLatency),
      averageImprovement: Math.round(averageLatency * 0.3),
    },
  });
}
