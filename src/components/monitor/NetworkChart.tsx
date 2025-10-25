'use client';

import { BarChart3, Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { RealTimeMetrics } from '@/lib/performance-monitor';

interface NetworkChartProps {
  metrics: RealTimeMetrics[];
  className?: string;
}

/**
 * 网络质量图表组件
 * 显示网络延迟和带宽的趋势图表
 */
export default function NetworkChart({
  metrics,
  className = '',
}: NetworkChartProps) {
  if (!metrics || metrics.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
      >
        <div className='flex items-center gap-3 mb-4'>
          <BarChart3 className='h-5 w-5 text-blue-600' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            网络质量趋势
          </h3>
        </div>
        <p className='text-gray-500 dark:text-gray-400'>暂无数据</p>
      </div>
    );
  }

  // 获取最近20个数据点
  const recentMetrics = metrics.slice(-20);
  const maxLatency = Math.max(...recentMetrics.map((m) => m.latency), 1);
  const maxBandwidth = Math.max(...recentMetrics.map((m) => m.bandwidth), 1);

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

  const latencyTrend = calculateTrend(recentMetrics.map((m) => m.latency));
  const bandwidthTrend = calculateTrend(recentMetrics.map((m) => m.bandwidth));

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className='h-4 w-4 text-red-500' />;
      case 'down':
        return <TrendingDown className='h-4 w-4 text-green-500' />;
      default:
        return <Minus className='h-4 w-4 text-gray-500' />;
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
          网络质量趋势
        </h3>
      </div>

      {/* 趋势指标 */}
      <div className='grid grid-cols-2 gap-4 mb-6'>
        <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded-lg'>
          <div className='flex items-center gap-2 mb-1'>
            <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              延迟趋势
            </span>
            {getTrendIcon(latencyTrend)}
          </div>
          <p className='text-xs text-gray-600 dark:text-gray-400'>
            {getTrendText(latencyTrend)}
          </p>
        </div>

        <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded-lg'>
          <div className='flex items-center gap-2 mb-1'>
            <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              带宽趋势
            </span>
            {getTrendIcon(bandwidthTrend)}
          </div>
          <p className='text-xs text-gray-600 dark:text-gray-400'>
            {getTrendText(bandwidthTrend)}
          </p>
        </div>
      </div>

      {/* 延迟图表 */}
      <div className='mb-6'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          延迟 (ms)
        </h4>
        <div className='h-20 bg-gray-50 dark:bg-gray-700 rounded-lg p-2'>
          <div className='h-full flex items-end gap-1'>
            {recentMetrics.map((metric, index) => (
              <div
                key={index}
                className={`flex-1 rounded-sm transition-all duration-300 ${
                  metric.latency < 100
                    ? 'bg-green-500'
                    : metric.latency < 300
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{
                  height: `${(metric.latency / maxLatency) * 100}%`,
                }}
                title={`${new Date(metric.timestamp).toLocaleTimeString()}: ${
                  metric.latency
                }ms`}
              ></div>
            ))}
          </div>
        </div>
        <div className='flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1'>
          <span>20秒前</span>
          <span>现在</span>
        </div>
      </div>

      {/* 带宽图表 */}
      <div className='mb-4'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          带宽 (Mbps)
        </h4>
        <div className='h-20 bg-gray-50 dark:bg-gray-700 rounded-lg p-2'>
          <div className='h-full flex items-end gap-1'>
            {recentMetrics.map((metric, index) => (
              <div
                key={index}
                className={`flex-1 rounded-sm transition-all duration-300 ${
                  metric.bandwidth > 10
                    ? 'bg-green-500'
                    : metric.bandwidth > 5
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{
                  height: `${(metric.bandwidth / maxBandwidth) * 100}%`,
                }}
                title={`${new Date(metric.timestamp).toLocaleTimeString()}: ${
                  metric.bandwidth
                }Mbps`}
              ></div>
            ))}
          </div>
        </div>
        <div className='flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1'>
          <span>20秒前</span>
          <span>现在</span>
        </div>
      </div>

      {/* 统计信息 */}
      <div className='grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
        <div className='text-center'>
          <p className='text-lg font-semibold text-gray-900 dark:text-white'>
            {Math.round(
              recentMetrics.reduce((sum, m) => sum + m.latency, 0) /
                recentMetrics.length
            )}
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>
            平均延迟(ms)
          </p>
        </div>
        <div className='text-center'>
          <p className='text-lg font-semibold text-gray-900 dark:text-white'>
            {Math.round(
              recentMetrics.reduce((sum, m) => sum + m.bandwidth, 0) /
                recentMetrics.length
            )}
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>
            平均带宽(Mbps)
          </p>
        </div>
        <div className='text-center'>
          <p className='text-lg font-semibold text-gray-900 dark:text-white'>
            {
              recentMetrics.filter(
                (m) =>
                  m.networkQuality === 'excellent' ||
                  m.networkQuality === 'good'
              ).length
            }
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>
            良好质量次数
          </p>
        </div>
      </div>
    </div>
  );
}
