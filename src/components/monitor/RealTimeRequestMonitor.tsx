'use client';

import { Activity, Clock, Database, Play, Server, Zap } from 'lucide-react';

import { RealTimeMetrics } from '@/lib/performance-monitor';

interface RealTimeRequestMonitorProps {
  metrics: RealTimeMetrics | null;
  className?: string;
}

/**
 * 实时请求监控组件
 * 显示当前正在进行的视频请求的实时状态
 */
export default function RealTimeRequestMonitor({
  metrics,
  className = '',
}: RealTimeRequestMonitorProps) {
  if (!metrics) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
      >
        <div className='flex items-center gap-3 mb-4'>
          <Activity className='h-5 w-5 text-blue-600' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            实时请求监控
          </h3>
        </div>
        <p className='text-gray-500 dark:text-gray-400'>暂无实时数据</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'playing':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'buffering':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'loading':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      case 'error':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'paused':
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'playing':
        return '播放中';
      case 'buffering':
        return '缓冲中';
      case 'loading':
        return '加载中';
      case 'error':
        return '错误';
      case 'paused':
        return '暂停';
      default:
        return '未知';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'playing':
        return <Play className='h-4 w-4' />;
      case 'buffering':
      case 'loading':
        return <Clock className='h-4 w-4' />;
      case 'error':
        return <Zap className='h-4 w-4' />;
      default:
        return <Activity className='h-4 w-4' />;
    }
  };

  const getNetworkQualityColor = (quality: string) => {
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

  const getNetworkQualityText = (quality: string) => {
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

  // 计算性能评分
  const calculatePerformanceScore = () => {
    let score = 100;

    // 基于延迟扣分
    if (metrics.latency > 500) score -= 30;
    else if (metrics.latency > 300) score -= 20;
    else if (metrics.latency > 100) score -= 10;

    // 基于缓冲健康度扣分
    if (metrics.bufferHealth < 0.3) score -= 25;
    else if (metrics.bufferHealth < 0.6) score -= 15;
    else if (metrics.bufferHealth < 0.8) score -= 5;

    // 基于错误次数扣分
    score -= metrics.errorCount * 10;

    // 基于网络质量调整
    switch (metrics.networkQuality) {
      case 'excellent':
        score += 5;
        break;
      case 'good':
        break;
      case 'fair':
        score -= 10;
        break;
      case 'poor':
        score -= 20;
        break;
    }

    return Math.max(0, Math.min(100, score));
  };

  const performanceScore = calculatePerformanceScore();

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreText = (score: number) => {
    if (score >= 90) return '优秀';
    if (score >= 70) return '良好';
    if (score >= 50) return '一般';
    return '较差';
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
    >
      <div className='flex items-center gap-3 mb-4'>
        <Activity className='h-5 w-5 text-blue-600' />
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          实时请求监控
        </h3>
        <div className='ml-auto flex items-center gap-2'>
          <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse'></div>
          <span className='text-xs text-gray-500 dark:text-gray-400'>实时</span>
        </div>
      </div>

      {/* 当前状态 */}
      <div className='mb-6'>
        <div
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusColor(
            metrics.playerStatus
          )}`}
        >
          {getStatusIcon(metrics.playerStatus)}
          <span className='text-sm font-medium'>
            {getStatusText(metrics.playerStatus)}
          </span>
        </div>
      </div>

      {/* 性能评分 */}
      <div className='mb-6'>
        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              综合性能评分
            </span>
            <span
              className={`text-2xl font-bold ${getScoreColor(
                performanceScore
              )}`}
            >
              {performanceScore}
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <div className='flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2'>
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  performanceScore >= 90
                    ? 'bg-green-500'
                    : performanceScore >= 70
                    ? 'bg-blue-500'
                    : performanceScore >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${performanceScore}%` }}
              ></div>
            </div>
            <span
              className={`text-sm font-medium ${getScoreColor(
                performanceScore
              )}`}
            >
              {getScoreText(performanceScore)}
            </span>
          </div>
        </div>
      </div>

      {/* 关键指标 */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
        <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center'>
          <div className='flex items-center justify-center mb-1'>
            <Clock className='h-4 w-4 text-blue-600' />
          </div>
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
          <p className='text-xs text-gray-500 dark:text-gray-400'>延迟</p>
        </div>

        <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center'>
          <div className='flex items-center justify-center mb-1'>
            <Database className='h-4 w-4 text-green-600' />
          </div>
          <p
            className={`text-lg font-semibold ${
              metrics.bufferHealth > 0.7
                ? 'text-green-600'
                : metrics.bufferHealth > 0.4
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {(metrics.bufferHealth * 100).toFixed(0)}%
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>缓冲</p>
        </div>

        <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center'>
          <div className='flex items-center justify-center mb-1'>
            <Server className='h-4 w-4 text-purple-600' />
          </div>
          <p
            className={`text-lg font-semibold ${getNetworkQualityColor(
              metrics.networkQuality
            )}`}
          >
            {getNetworkQualityText(metrics.networkQuality)}
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>网络质量</p>
        </div>

        <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center'>
          <div className='flex items-center justify-center mb-1'>
            <Zap className='h-4 w-4 text-orange-600' />
          </div>
          <p className='text-lg font-semibold text-gray-900 dark:text-white'>
            {metrics.playbackRate}x
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>播放速率</p>
        </div>
      </div>

      {/* 源信息 */}
      {metrics.sourcesInfo && metrics.sourcesInfo.length > 0 && (
        <div className='mb-6'>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
            当前源状态
          </h4>
          <div className='space-y-2'>
            {metrics.sourcesInfo.slice(0, 3).map((source, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  source.available
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}
              >
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        source.available ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    ></div>
                    <span className='text-sm font-medium text-gray-900 dark:text-white'>
                      源 {index + 1}
                    </span>
                    {source.cdnOptimized && (
                      <span className='text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded'>
                        CDN
                      </span>
                    )}
                    {source.cacheHit && (
                      <span className='text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded'>
                        缓存
                      </span>
                    )}
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400'>
                    {source.available ? `${source.pingTime}ms` : '不可用'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 错误统计 */}
      {(metrics.errorCount > 0 || metrics.retryCount > 0) && (
        <div className='pt-4 border-t border-gray-200 dark:border-gray-700'>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
            错误统计
          </h4>
          <div className='grid grid-cols-2 gap-4'>
            <div className='text-center'>
              <p className='text-lg font-semibold text-red-600'>
                {metrics.errorCount}
              </p>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                错误次数
              </p>
            </div>
            <div className='text-center'>
              <p className='text-lg font-semibold text-orange-600'>
                {metrics.retryCount}
              </p>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                重试次数
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 更新时间 */}
      <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center'>
        <p className='text-xs text-gray-500 dark:text-gray-400'>
          更新时间: {new Date(metrics.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
