'use client';

import { Activity, BarChart3, TrendingUp } from 'lucide-react';

import { PerformanceMetrics } from '@/lib/performance-monitor';

interface PerformanceChartProps {
  metrics: PerformanceMetrics[];
  className?: string;
}

/**
 * 性能趋势图表组件
 * 显示历史性能数据的趋势分析
 */
export default function PerformanceChart({
  metrics,
  className = '',
}: PerformanceChartProps) {
  if (!metrics || metrics.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
      >
        <div className='flex items-center gap-3 mb-4'>
          <BarChart3 className='h-5 w-5 text-blue-600' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            性能趋势分析
          </h3>
        </div>
        <p className='text-gray-500 dark:text-gray-400'>暂无历史数据</p>
      </div>
    );
  }

  // 获取最近20个数据点
  const recentMetrics = metrics.slice(-20);
  const maxLoadTime = Math.max(...recentMetrics.map((m) => m.totalLoadTime), 1);
  const maxSearchTime = Math.max(
    ...recentMetrics.map((m) => m.sourceSearchTime),
    1
  );
  const maxTestTime = Math.max(
    ...recentMetrics.map((m) => m.sourceTestTime),
    1
  );

  // 计算平均性能
  const avgLoadTime = Math.round(
    recentMetrics.reduce((sum, m) => sum + m.totalLoadTime, 0) /
      recentMetrics.length
  );
  const avgSearchTime = Math.round(
    recentMetrics.reduce((sum, m) => sum + m.sourceSearchTime, 0) /
      recentMetrics.length
  );
  const avgTestTime = Math.round(
    recentMetrics.reduce((sum, m) => sum + m.sourceTestTime, 0) /
      recentMetrics.length
  );
  const avgSourceCount = Math.round(
    recentMetrics.reduce((sum, m) => sum + m.sourceCount, 0) /
      recentMetrics.length
  );
  const cacheHitRate = Math.round(
    (recentMetrics.filter((m) => m.cacheHit).length / recentMetrics.length) *
      100
  );

  // 计算趋势
  const calculateTrend = (values: number[]) => {
    if (values.length < 2) return 'stable';
    const first = values.slice(0, Math.floor(values.length / 2));
    const second = values.slice(Math.floor(values.length / 2));
    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const secondAvg = second.reduce((a, b) => a + b, 0) / second.length;
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 10) return 'up';
    if (change < -10) return 'down';
    return 'stable';
  };

  const loadTimeTrend = calculateTrend(
    recentMetrics.map((m) => m.totalLoadTime)
  );
  const searchTimeTrend = calculateTrend(
    recentMetrics.map((m) => m.sourceSearchTime)
  );

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className='h-4 w-4 text-red-500' />;
      case 'down':
        return <TrendingUp className='h-4 w-4 text-green-500 rotate-180' />;
      default:
        return <Activity className='h-4 w-4 text-gray-500' />;
    }
  };

  const getTrendText = (trend: string) => {
    switch (trend) {
      case 'up':
        return '上升';
      case 'down':
        return '下降';
      default:
        return '稳定';
    }
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
    >
      <div className='flex items-center gap-3 mb-4'>
        <BarChart3 className='h-5 w-5 text-blue-600' />
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          性能趋势分析
        </h3>
      </div>

      {/* 趋势指标 */}
      <div className='grid grid-cols-2 gap-4 mb-6'>
        <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded-lg'>
          <div className='flex items-center gap-2 mb-1'>
            <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              加载时间趋势
            </span>
            {getTrendIcon(loadTimeTrend)}
          </div>
          <p className='text-xs text-gray-600 dark:text-gray-400'>
            {getTrendText(loadTimeTrend)}
          </p>
        </div>

        <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded-lg'>
          <div className='flex items-center gap-2 mb-1'>
            <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              搜索时间趋势
            </span>
            {getTrendIcon(searchTimeTrend)}
          </div>
          <p className='text-xs text-gray-600 dark:text-gray-400'>
            {getTrendText(searchTimeTrend)}
          </p>
        </div>
      </div>

      {/* 加载时间图表 */}
      <div className='mb-6'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          总加载时间 (ms)
        </h4>
        <div className='h-20 bg-gray-50 dark:bg-gray-700 rounded-lg p-2'>
          <div className='h-full flex items-end gap-1'>
            {recentMetrics.map((metric, index) => (
              <div
                key={index}
                className={`flex-1 rounded-sm transition-all duration-300 ${
                  metric.totalLoadTime < 2000
                    ? 'bg-green-500'
                    : metric.totalLoadTime < 5000
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{
                  height: `${(metric.totalLoadTime / maxLoadTime) * 100}%`,
                }}
                title={`${metric.totalLoadTime}ms - ${metric.selectedSource}`}
              ></div>
            ))}
          </div>
        </div>
        <div className='flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1'>
          <span>20次前</span>
          <span>最近</span>
        </div>
      </div>

      {/* 源搜索时间图表 */}
      <div className='mb-6'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          源搜索时间 (ms)
        </h4>
        <div className='h-20 bg-gray-50 dark:bg-gray-700 rounded-lg p-2'>
          <div className='h-full flex items-end gap-1'>
            {recentMetrics.map((metric, index) => (
              <div
                key={index}
                className={`flex-1 rounded-sm transition-all duration-300 ${
                  metric.sourceSearchTime < 1000
                    ? 'bg-green-500'
                    : metric.sourceSearchTime < 3000
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{
                  height: `${(metric.sourceSearchTime / maxSearchTime) * 100}%`,
                }}
                title={`${metric.sourceSearchTime}ms`}
              ></div>
            ))}
          </div>
        </div>
        <div className='flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1'>
          <span>20次前</span>
          <span>最近</span>
        </div>
      </div>

      {/* 源测试时间图表 */}
      <div className='mb-6'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          源测试时间 (ms)
        </h4>
        <div className='h-20 bg-gray-50 dark:bg-gray-700 rounded-lg p-2'>
          <div className='h-full flex items-end gap-1'>
            {recentMetrics.map((metric, index) => (
              <div
                key={index}
                className={`flex-1 rounded-sm transition-all duration-300 ${
                  metric.sourceTestTime < 2000
                    ? 'bg-green-500'
                    : metric.sourceTestTime < 5000
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{
                  height: `${(metric.sourceTestTime / maxTestTime) * 100}%`,
                }}
                title={`${metric.sourceTestTime}ms`}
              ></div>
            ))}
          </div>
        </div>
        <div className='flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1'>
          <span>20次前</span>
          <span>最近</span>
        </div>
      </div>

      {/* 统计信息 */}
      <div className='grid grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
        <div className='text-center'>
          <p className='text-lg font-semibold text-gray-900 dark:text-white'>
            {avgLoadTime}
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>
            平均加载(ms)
          </p>
        </div>
        <div className='text-center'>
          <p className='text-lg font-semibold text-gray-900 dark:text-white'>
            {avgSearchTime}
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>
            平均搜索(ms)
          </p>
        </div>
        <div className='text-center'>
          <p className='text-lg font-semibold text-gray-900 dark:text-white'>
            {avgTestTime}
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>
            平均测试(ms)
          </p>
        </div>
        <div className='text-center'>
          <p className='text-lg font-semibold text-gray-900 dark:text-white'>
            {avgSourceCount}
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>平均源数</p>
        </div>
        <div className='text-center'>
          <p
            className={`text-lg font-semibold ${
              cacheHitRate > 70
                ? 'text-green-600'
                : cacheHitRate > 40
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {cacheHitRate}%
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>缓存命中率</p>
        </div>
      </div>

      {/* 性能建议 */}
      <div className='mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          性能建议
        </h4>
        <div className='space-y-1 text-sm text-gray-600 dark:text-gray-400'>
          {avgLoadTime > 5000 && (
            <p>• 平均加载时间较长，建议检查网络连接或CDN配置</p>
          )}
          {avgSearchTime > 3000 && <p>• 源搜索时间较长，建议优化搜索算法</p>}
          {cacheHitRate < 50 && (
            <p>• 缓存命中率较低，建议增加缓存时间或优化缓存策略</p>
          )}
          {avgSourceCount < 3 && <p>• 可用源数量较少，建议增加更多备用源</p>}
          {avgLoadTime <= 2000 &&
            avgSearchTime <= 1000 &&
            cacheHitRate > 70 && <p>• 性能表现优秀，继续保持当前配置</p>}
        </div>
      </div>
    </div>
  );
}
