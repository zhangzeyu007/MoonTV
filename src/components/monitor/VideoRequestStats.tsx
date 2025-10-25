'use client';

import { BarChart3, Clock, Database, Server, Users } from 'lucide-react';

import { PerformanceMetrics } from '@/lib/performance-monitor';

interface VideoRequestStatsProps {
  metrics: PerformanceMetrics[];
  className?: string;
}

/**
 * 视频请求性能统计图表组件
 * 显示每个视频请求的详细性能统计和分析
 */
export default function VideoRequestStats({
  metrics,
  className = '',
}: VideoRequestStatsProps) {
  if (!metrics || metrics.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
      >
        <div className='flex items-center gap-3 mb-4'>
          <BarChart3 className='h-5 w-5 text-blue-600' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            视频请求性能统计
          </h3>
        </div>
        <p className='text-gray-500 dark:text-gray-400'>暂无请求数据</p>
      </div>
    );
  }

  // 获取最近30个请求
  const recentRequests = metrics.slice(-30);

  // 计算统计数据
  const totalRequests = recentRequests.length;
  const successfulRequests = recentRequests.filter(
    (m) => m.totalLoadTime > 0
  ).length;
  const successRate =
    totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

  // 计算平均性能指标
  const avgLoadTime = Math.round(
    recentRequests.reduce((sum, m) => sum + m.totalLoadTime, 0) / totalRequests
  );
  const avgSearchTime = Math.round(
    recentRequests.reduce((sum, m) => sum + m.sourceSearchTime, 0) /
      totalRequests
  );
  const avgTestTime = Math.round(
    recentRequests.reduce((sum, m) => sum + m.sourceTestTime, 0) / totalRequests
  );
  const avgSourceCount = Math.round(
    recentRequests.reduce((sum, m) => sum + m.sourceCount, 0) / totalRequests
  );

  // 计算缓存命中率
  const cacheHits = recentRequests.filter((m) => m.cacheHit).length;
  const cacheHitRate =
    totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

  // 计算源成功率
  const totalAvailableSources = recentRequests.reduce(
    (sum, m) => sum + (m.availableSourcesCount || 0),
    0
  );
  const totalSources = recentRequests.reduce(
    (sum, m) => sum + m.sourceCount,
    0
  );
  const sourceSuccessRate =
    totalSources > 0 ? (totalAvailableSources / totalSources) * 100 : 0;

  // 性能分级统计
  const performanceLevels = {
    excellent: recentRequests.filter((m) => m.totalLoadTime < 2000).length,
    good: recentRequests.filter(
      (m) => m.totalLoadTime >= 2000 && m.totalLoadTime < 5000
    ).length,
    fair: recentRequests.filter(
      (m) => m.totalLoadTime >= 5000 && m.totalLoadTime < 10000
    ).length,
    poor: recentRequests.filter((m) => m.totalLoadTime >= 10000).length,
  };

  // 源质量分布
  const sourceQualityDistribution = recentRequests.reduce((acc, m) => {
    if (m.sourcesInfo) {
      m.sourcesInfo.forEach((source) => {
        const quality = source.quality || 'unknown';
        acc[quality] = (acc[quality] || 0) + 1;
      });
    }
    return acc;
  }, {} as Record<string, number>);

  // 时间分布统计（按小时）- 暂时未使用，保留用于未来扩展
  // const hourlyStats = recentRequests.reduce((acc, m) => {
  //   const hour = new Date(m.totalLoadTime > 0 ? Date.now() - (recentRequests.length - recentRequests.indexOf(m)) * 60000 : Date.now()).getHours();
  //   acc[hour] = (acc[hour] || 0) + 1;
  //   return acc;
  // }, {} as Record<number, number>);

  const getPerformanceColor = (level: string) => {
    switch (level) {
      case 'excellent':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'good':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      case 'fair':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'poor':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getPerformanceText = (level: string) => {
    switch (level) {
      case 'excellent':
        return '优秀';
      case 'good':
        return '良好';
      case 'fair':
        return '一般';
      case 'poor':
        return '较差';
      default:
        return '未知';
    }
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
    >
      <div className='flex items-center gap-3 mb-6'>
        <BarChart3 className='h-5 w-5 text-blue-600' />
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          视频请求性能统计
        </h3>
        <div className='ml-auto text-sm text-gray-500 dark:text-gray-400'>
          最近 {totalRequests} 次请求
        </div>
      </div>

      {/* 核心指标 */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center'>
          <div className='flex items-center justify-center mb-2'>
            <Server className='h-5 w-5 text-blue-600' />
          </div>
          <p className='text-2xl font-bold text-gray-900 dark:text-white'>
            {successRate.toFixed(1)}%
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>成功率</p>
        </div>

        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center'>
          <div className='flex items-center justify-center mb-2'>
            <Clock className='h-5 w-5 text-green-600' />
          </div>
          <p className='text-2xl font-bold text-gray-900 dark:text-white'>
            {avgLoadTime}
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>
            平均加载(ms)
          </p>
        </div>

        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center'>
          <div className='flex items-center justify-center mb-2'>
            <Database className='h-5 w-5 text-purple-600' />
          </div>
          <p className='text-2xl font-bold text-gray-900 dark:text-white'>
            {cacheHitRate.toFixed(1)}%
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>缓存命中率</p>
        </div>

        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center'>
          <div className='flex items-center justify-center mb-2'>
            <Users className='h-5 w-5 text-orange-600' />
          </div>
          <p className='text-2xl font-bold text-gray-900 dark:text-white'>
            {sourceSuccessRate.toFixed(1)}%
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>源成功率</p>
        </div>
      </div>

      {/* 性能分级分布 */}
      <div className='mb-6'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
          性能分级分布
        </h4>
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
          {Object.entries(performanceLevels).map(([level, count]) => (
            <div
              key={level}
              className={`p-3 rounded-lg ${getPerformanceColor(level)}`}
            >
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium'>
                  {getPerformanceText(level)}
                </span>
                <span className='text-lg font-bold'>{count}</span>
              </div>
              <div className='mt-1'>
                <div className='w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5'>
                  <div
                    className={`h-1.5 rounded-full ${
                      level === 'excellent'
                        ? 'bg-green-500'
                        : level === 'good'
                        ? 'bg-blue-500'
                        : level === 'fair'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{
                      width: `${
                        totalRequests > 0 ? (count / totalRequests) * 100 : 0
                      }%`,
                    }}
                  ></div>
                </div>
                <p className='text-xs mt-1'>
                  {totalRequests > 0
                    ? ((count / totalRequests) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 加载时间趋势图 */}
      <div className='mb-6'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
          加载时间趋势
        </h4>
        <div className='h-24 bg-gray-50 dark:bg-gray-700 rounded-lg p-3'>
          <div className='h-full flex items-end gap-1'>
            {recentRequests.map((request, index) => {
              const maxTime = Math.max(
                ...recentRequests.map((r) => r.totalLoadTime),
                1
              );
              const height = (request.totalLoadTime / maxTime) * 100;
              return (
                <div
                  key={index}
                  className={`flex-1 rounded-sm transition-all duration-300 ${
                    request.totalLoadTime < 2000
                      ? 'bg-green-500'
                      : request.totalLoadTime < 5000
                      ? 'bg-yellow-500'
                      : request.totalLoadTime < 10000
                      ? 'bg-orange-500'
                      : 'bg-red-500'
                  }`}
                  style={{ height: `${height}%` }}
                  title={`请求 ${index + 1}: ${request.totalLoadTime}ms`}
                ></div>
              );
            })}
          </div>
        </div>
        <div className='flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2'>
          <span>30次前</span>
          <span>最近</span>
        </div>
      </div>

      {/* 详细统计 */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* 时间统计 */}
        <div>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
            时间统计
          </h4>
          <div className='space-y-3'>
            <div className='flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded'>
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                平均搜索时间
              </span>
              <span className='text-sm font-medium text-gray-900 dark:text-white'>
                {avgSearchTime}ms
              </span>
            </div>
            <div className='flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded'>
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                平均测试时间
              </span>
              <span className='text-sm font-medium text-gray-900 dark:text-white'>
                {avgTestTime}ms
              </span>
            </div>
            <div className='flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded'>
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                平均源数量
              </span>
              <span className='text-sm font-medium text-gray-900 dark:text-white'>
                {avgSourceCount}
              </span>
            </div>
          </div>
        </div>

        {/* 源质量分布 */}
        <div>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
            源质量分布
          </h4>
          <div className='space-y-2'>
            {Object.entries(sourceQualityDistribution).map(
              ([quality, count]) => (
                <div
                  key={quality}
                  className='flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded'
                >
                  <span className='text-sm text-gray-600 dark:text-gray-400'>
                    {quality === 'HD'
                      ? '高清'
                      : quality === 'SD'
                      ? '标清'
                      : quality === '4K'
                      ? '4K'
                      : quality}
                  </span>
                  <div className='flex items-center gap-2'>
                    <div className='w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5'>
                      <div
                        className='h-1.5 rounded-full bg-blue-500'
                        style={{ width: `${(count / totalSources) * 100}%` }}
                      ></div>
                    </div>
                    <span className='text-sm font-medium text-gray-900 dark:text-white'>
                      {count}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* 性能建议 */}
      <div className='mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          性能优化建议
        </h4>
        <div className='space-y-1 text-sm text-gray-600 dark:text-gray-400'>
          {successRate < 90 && (
            <p>• 请求成功率较低，建议检查网络连接和源质量</p>
          )}
          {avgLoadTime > 5000 && <p>• 平均加载时间较长，建议优化源选择策略</p>}
          {cacheHitRate < 50 && <p>• 缓存命中率较低，建议增加缓存时间</p>}
          {sourceSuccessRate < 70 && <p>• 源成功率较低，建议增加更多备用源</p>}
          {performanceLevels.poor > totalRequests * 0.2 && (
            <p>• 较差性能请求较多，建议检查网络环境</p>
          )}
          {successRate >= 95 && avgLoadTime <= 3000 && cacheHitRate >= 80 && (
            <p>• 性能表现优秀，继续保持当前配置</p>
          )}
        </div>
      </div>
    </div>
  );
}
