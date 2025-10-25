import { NextRequest, NextResponse } from 'next/server';

import { cdnOptimizer } from '@/lib/cdn-optimizer';
import { geolocationService } from '@/lib/geolocation-service';
import { performanceMonitor } from '@/lib/performance-monitor';

/**
 * 监控API接口
 * 提供实时监控数据、历史数据查询和配置管理
 */

// 配置为使用 Edge Runtime
export const runtime = 'edge';

// GET - 获取监控数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    switch (type) {
      case 'realtime':
        return await getRealTimeData();
      case 'history':
        return await getHistoryData();
      case 'network':
        return await getNetworkStats();
      case 'cdn':
        return await getCDNStatus();
      case 'geolocation':
        return await getGeolocationInfo();
      case 'all':
      default:
        return await getAllMonitorData();
    }
  } catch (error) {
    console.error('监控API错误:', error);
    return NextResponse.json({ error: '获取监控数据失败' }, { status: 500 });
  }
}

// POST - 更新监控配置或执行操作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'start_monitoring':
        return await startMonitoring();
      case 'stop_monitoring':
        return await stopMonitoring();
      case 'clear_data':
        return await clearAllData();
      case 'refresh_cdn':
        return await refreshCDNStatus();
      case 'test_network':
        return await testNetworkQuality(params);
      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('监控API操作错误:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}

// 获取实时数据
async function getRealTimeData() {
  const currentState = performanceMonitor.getCurrentRealTimeState();
  const realTimeMetrics = performanceMonitor.getRealTimeMetrics();

  return NextResponse.json({
    success: true,
    data: {
      currentState,
      recentMetrics: realTimeMetrics.slice(-10), // 最近10条
      timestamp: Date.now(),
    },
  });
}

// 获取历史数据
async function getHistoryData() {
  const allMetrics = performanceMonitor.getAllMetrics();
  const averageMetrics = performanceMonitor.getAverageMetrics();
  const performanceReport = performanceMonitor.getPerformanceReport();

  return NextResponse.json({
    success: true,
    data: {
      allMetrics,
      averageMetrics,
      performanceReport,
      totalSessions: allMetrics.length,
    },
  });
}

// 获取网络统计
async function getNetworkStats() {
  const networkStats = performanceMonitor.getNetworkQualityStats();
  const realTimeMetrics = performanceMonitor.getRealTimeMetrics();

  // 计算网络质量趋势
  const recentMetrics = realTimeMetrics.slice(-20);
  const qualityTrend = calculateQualityTrend(recentMetrics);

  return NextResponse.json({
    success: true,
    data: {
      ...networkStats,
      qualityTrend,
      recentMetrics: recentMetrics.map((m) => ({
        timestamp: m.timestamp,
        latency: m.latency,
        bandwidth: m.bandwidth,
        quality: m.networkQuality,
      })),
    },
  });
}

// 获取CDN状态
async function getCDNStatus() {
  try {
    const recommendations = await cdnOptimizer.getOptimizationRecommendations();
    const cacheStats = cdnOptimizer.getCacheStats();

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        cacheStats,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.warn('获取CDN状态失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取CDN状态失败',
      data: null,
    });
  }
}

// 获取地理位置信息
async function getGeolocationInfo() {
  try {
    const geolocationInfo = await geolocationService.getGeolocationInfo();
    const cdnResult = await geolocationService.getOptimalCDNNode();

    return NextResponse.json({
      success: true,
      data: {
        geolocationInfo,
        cdnResult,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.warn('获取地理位置信息失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取地理位置信息失败',
      data: null,
    });
  }
}

// 获取所有监控数据
async function getAllMonitorData() {
  try {
    // 直接调用内部函数获取数据，避免HTTP响应解析问题
    const realTimeData = await getRealTimeDataInternal();
    const historyData = await getHistoryDataInternal();
    const networkData = await getNetworkStatsInternal();
    const cdnData = await getCDNStatusInternal();
    const geolocationData = await getGeolocationInfoInternal();

    return NextResponse.json({
      success: true,
      data: {
        realtime: realTimeData,
        history: historyData,
        network: networkData,
        cdn: cdnData,
        geolocation: geolocationData,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('获取所有监控数据失败:', error);
    return NextResponse.json({ error: '获取监控数据失败' }, { status: 500 });
  }
}

// 内部数据获取函数（不返回HTTP响应）
async function getRealTimeDataInternal() {
  const currentState = performanceMonitor.getCurrentRealTimeState();
  const realTimeMetrics = performanceMonitor.getRealTimeMetrics();

  return {
    currentState,
    recentMetrics: realTimeMetrics.slice(-10),
    timestamp: Date.now(),
  };
}

async function getHistoryDataInternal() {
  const allMetrics = performanceMonitor.getAllMetrics();
  const averageMetrics = performanceMonitor.getAverageMetrics();
  const performanceReport = performanceMonitor.getPerformanceReport();

  return {
    allMetrics,
    averageMetrics,
    performanceReport,
    totalSessions: allMetrics.length,
  };
}

async function getNetworkStatsInternal() {
  const networkStats = performanceMonitor.getNetworkQualityStats();
  const realTimeMetrics = performanceMonitor.getRealTimeMetrics();

  const recentMetrics = realTimeMetrics.slice(-20);
  const qualityTrend = calculateQualityTrend(recentMetrics);

  return {
    ...networkStats,
    qualityTrend,
    recentMetrics: recentMetrics.map((m) => ({
      timestamp: m.timestamp,
      latency: m.latency,
      bandwidth: m.bandwidth,
      quality: m.networkQuality,
    })),
  };
}

async function getCDNStatusInternal() {
  try {
    const recommendations = await cdnOptimizer.getOptimizationRecommendations();
    const cacheStats = cdnOptimizer.getCacheStats();

    return {
      recommendations,
      cacheStats,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.warn('获取CDN状态失败:', error);
    return null;
  }
}

async function getGeolocationInfoInternal() {
  try {
    const geolocationInfo = await geolocationService.getGeolocationInfo();
    const cdnResult = await geolocationService.getOptimalCDNNode();

    return {
      geolocationInfo,
      cdnResult,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.warn('获取地理位置信息失败:', error);
    return null;
  }
}

// 开始监控
async function startMonitoring() {
  performanceMonitor.startRealTimeMonitoring();

  return NextResponse.json({
    success: true,
    message: '实时监控已启动',
    timestamp: Date.now(),
  });
}

// 停止监控
async function stopMonitoring() {
  performanceMonitor.stopRealTimeMonitoring();

  return NextResponse.json({
    success: true,
    message: '实时监控已停止',
    timestamp: Date.now(),
  });
}

// 清除所有数据
async function clearAllData() {
  performanceMonitor.clearRealTimeMetrics();
  performanceMonitor.clearMetrics();
  cdnOptimizer.clearCache();
  geolocationService.clearCache();

  return NextResponse.json({
    success: true,
    message: '所有监控数据已清除',
    timestamp: Date.now(),
  });
}

// 刷新CDN状态
async function refreshCDNStatus() {
  try {
    // 清除CDN缓存
    cdnOptimizer.clearCache();
    geolocationService.clearCache();

    // 重新获取CDN状态
    const recommendations = await cdnOptimizer.getOptimizationRecommendations();

    return NextResponse.json({
      success: true,
      message: 'CDN状态已刷新',
      data: recommendations,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('刷新CDN状态失败:', error);
    return NextResponse.json({ error: '刷新CDN状态失败' }, { status: 500 });
  }
}

// 测试网络质量
async function testNetworkQuality(params: { urls?: string[] }) {
  try {
    const testUrls = params.urls || [
      'https://www.google.com',
      'https://www.cloudflare.com',
      'https://www.github.com',
    ];

    const results = await Promise.allSettled(
      testUrls.map(async (url) => {
        const startTime = performance.now();
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            mode: 'cors',
            signal: AbortSignal.timeout(5000),
          });
          const latency = performance.now() - startTime;

          return {
            url,
            latency: Math.round(latency),
            status: response.ok ? 'success' : 'error',
            statusCode: response.status,
          };
        } catch (error) {
          return {
            url,
            latency: Math.round(performance.now() - startTime),
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    const testResults = results.map((result, index) => ({
      ...(result.status === 'fulfilled'
        ? result.value
        : {
            url: testUrls[index],
            latency: 0,
            status: 'error',
            error: 'Test failed',
          }),
    }));

    return NextResponse.json({
      success: true,
      message: '网络质量测试完成',
      data: {
        testResults,
        averageLatency: Math.round(
          testResults.reduce((sum, r) => sum + r.latency, 0) /
            testResults.length
        ),
        successRate:
          (testResults.filter((r) => r.status === 'success').length /
            testResults.length) *
          100,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('网络质量测试失败:', error);
    return NextResponse.json({ error: '网络质量测试失败' }, { status: 500 });
  }
}

// 计算质量趋势
function calculateQualityTrend(metrics: any[]) {
  if (metrics.length < 2) return 'stable';

  const qualityScores = metrics.map((m) => {
    switch (m.networkQuality) {
      case 'excellent':
        return 4;
      case 'good':
        return 3;
      case 'fair':
        return 2;
      case 'poor':
        return 1;
      default:
        return 0;
    }
  });

  const firstHalf = qualityScores.slice(
    0,
    Math.floor(qualityScores.length / 2)
  );
  const secondHalf = qualityScores.slice(Math.floor(qualityScores.length / 2));

  const firstAvg =
    firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;

  const change = secondAvg - firstAvg;

  if (change > 0.5) return 'improving';
  if (change < -0.5) return 'declining';
  return 'stable';
}
