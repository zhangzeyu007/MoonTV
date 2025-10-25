'use client';

import { Activity, AlertCircle, CheckCircle, Clock, Wifi } from 'lucide-react';

import { RealTimeMetrics } from '@/lib/performance-monitor';

interface RealTimeMetricsProps {
  metrics: RealTimeMetrics | null;
  className?: string;
}

/**
 * 实时指标组件
 * 显示播放器状态、网络质量等关键指标
 */
export default function RealTimeMetricsComponent({
  metrics,
  className = '',
}: RealTimeMetricsProps) {
  if (!metrics) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
      >
        <div className='flex items-center gap-3 mb-4'>
          <Activity className='h-5 w-5 text-blue-600' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            实时指标
          </h3>
        </div>
        <p className='text-gray-500 dark:text-gray-400'>暂无数据</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'playing':
        return 'text-green-600';
      case 'buffering':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      case 'paused':
        return 'text-gray-600';
      default:
        return 'text-blue-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'playing':
        return <CheckCircle className='h-4 w-4 text-green-600' />;
      case 'buffering':
        return <Clock className='h-4 w-4 text-yellow-600' />;
      case 'error':
        return <AlertCircle className='h-4 w-4 text-red-600' />;
      default:
        return <Activity className='h-4 w-4 text-blue-600' />;
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-600';
      case 'good':
        return 'text-blue-600';
      case 'fair':
        return 'text-yellow-600';
      case 'poor':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getQualityText = (quality: string) => {
    switch (quality) {
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'playing':
        return '播放中';
      case 'buffering':
        return '缓冲中';
      case 'error':
        return '错误';
      case 'paused':
        return '暂停';
      case 'loading':
        return '加载中';
      default:
        return '未知';
    }
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
    >
      <div className='flex items-center gap-3 mb-4'>
        <Activity className='h-5 w-5 text-blue-600' />
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          实时指标
        </h3>
        <div className='ml-auto flex items-center gap-2'>
          <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse'></div>
          <span className='text-xs text-gray-500 dark:text-gray-400'>实时</span>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        {/* 播放器状态 */}
        <div className='space-y-2'>
          <div className='flex items-center gap-2'>
            {getStatusIcon(metrics.playerStatus)}
            <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              播放器状态
            </span>
          </div>
          <p
            className={`text-lg font-semibold ${getStatusColor(
              metrics.playerStatus
            )}`}
          >
            {getStatusText(metrics.playerStatus)}
          </p>
        </div>

        {/* 网络质量 */}
        <div className='space-y-2'>
          <div className='flex items-center gap-2'>
            <Wifi className='h-4 w-4 text-green-600' />
            <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              网络质量
            </span>
          </div>
          <p
            className={`text-lg font-semibold ${getQualityColor(
              metrics.networkQuality
            )}`}
          >
            {getQualityText(metrics.networkQuality)}
          </p>
        </div>

        {/* 缓冲健康度 */}
        <div className='space-y-2'>
          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            缓冲健康度
          </span>
          <div className='flex items-center gap-2'>
            <div className='flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  metrics.bufferHealth > 0.7
                    ? 'bg-green-500'
                    : metrics.bufferHealth > 0.4
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${metrics.bufferHealth * 100}%` }}
              ></div>
            </div>
            <span className='text-sm font-medium text-gray-600 dark:text-gray-400'>
              {(metrics.bufferHealth * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* 延迟 */}
        <div className='space-y-2'>
          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            延迟
          </span>
          <p
            className={`text-lg font-semibold ${
              metrics.latency < 100
                ? 'text-green-600'
                : metrics.latency < 300
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {metrics.latency}ms
          </p>
        </div>

        {/* 播放速率 */}
        <div className='space-y-2'>
          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            播放速率
          </span>
          <p className='text-lg font-semibold text-gray-900 dark:text-white'>
            {metrics.playbackRate}x
          </p>
        </div>

        {/* 错误计数 */}
        <div className='space-y-2'>
          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            错误次数
          </span>
          <p
            className={`text-lg font-semibold ${
              metrics.errorCount === 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {metrics.errorCount}
          </p>
        </div>
      </div>

      {/* CDN和缓存状态 */}
      <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-2'>
              <div
                className={`w-2 h-2 rounded-full ${
                  metrics.cdnOptimized ? 'bg-green-500' : 'bg-gray-400'
                }`}
              ></div>
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                CDN优化: {metrics.cdnOptimized ? '已启用' : '未启用'}
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <div
                className={`w-2 h-2 rounded-full ${
                  metrics.cacheHit ? 'bg-green-500' : 'bg-gray-400'
                }`}
              ></div>
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                缓存: {metrics.cacheHit ? '命中' : '未命中'}
              </span>
            </div>
          </div>
          <span className='text-xs text-gray-500 dark:text-gray-400'>
            更新时间: {new Date(metrics.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}
