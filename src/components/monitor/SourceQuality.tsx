'use client';

import { AlertTriangle, Clock, Pause, Play, Zap } from 'lucide-react';

import { RealTimeMetrics } from '@/lib/performance-monitor';

interface SourceQualityProps {
  metrics: RealTimeMetrics | null;
  className?: string;
}

/**
 * 源质量监控组件
 * 显示当前播放源的质量评分和状态信息
 */
export default function SourceQualityComponent({
  metrics,
  className = '',
}: SourceQualityProps) {
  if (!metrics) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
      >
        <div className='flex items-center gap-3 mb-4'>
          <Play className='h-5 w-5 text-green-600' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            源质量监控
          </h3>
        </div>
        <p className='text-gray-500 dark:text-gray-400'>暂无数据</p>
      </div>
    );
  }

  const getQualityScore = (metrics: RealTimeMetrics): number => {
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

    // CDN优化加分
    if (metrics.cdnOptimized) score += 5;

    // 缓存命中加分
    if (metrics.cacheHit) score += 3;

    return Math.max(0, Math.min(100, score));
  };

  const getQualityLevel = (score: number) => {
    if (score >= 90)
      return {
        level: '优秀',
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-900/20',
      };
    if (score >= 70)
      return {
        level: '良好',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      };
    if (score >= 50)
      return {
        level: '一般',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
      };
    return {
      level: '较差',
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
    };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'playing':
        return <Play className='h-4 w-4 text-green-600' />;
      case 'paused':
        return <Pause className='h-4 w-4 text-yellow-600' />;
      case 'buffering':
        return <Clock className='h-4 w-4 text-blue-600' />;
      case 'error':
        return <AlertTriangle className='h-4 w-4 text-red-600' />;
      default:
        return <Clock className='h-4 w-4 text-gray-600' />;
    }
  };

  const qualityScore = getQualityScore(metrics);
  const qualityInfo = getQualityLevel(qualityScore);

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
    >
      <div className='flex items-center gap-3 mb-4'>
        <Play className='h-5 w-5 text-green-600' />
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          源质量监控
        </h3>
      </div>

      {/* 质量评分 */}
      <div className={`${qualityInfo.bgColor} p-4 rounded-lg mb-6`}>
        <div className='flex items-center justify-between mb-2'>
          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            综合质量评分
          </span>
          <span className={`text-lg font-bold ${qualityInfo.color}`}>
            {qualityScore}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          <div className='flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                qualityScore >= 90
                  ? 'bg-green-500'
                  : qualityScore >= 70
                  ? 'bg-blue-500'
                  : qualityScore >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${qualityScore}%` }}
            ></div>
          </div>
          <span className={`text-sm font-medium ${qualityInfo.color}`}>
            {qualityInfo.level}
          </span>
        </div>
      </div>

      {/* 播放状态 */}
      <div className='mb-6'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
          播放状态
        </h4>
        <div className='grid grid-cols-2 gap-4'>
          <div className='flex items-center gap-2'>
            {getStatusIcon(metrics.playerStatus)}
            <div>
              <p className='text-sm font-medium text-gray-900 dark:text-white'>
                {metrics.playerStatus === 'playing'
                  ? '播放中'
                  : metrics.playerStatus === 'buffering'
                  ? '缓冲中'
                  : metrics.playerStatus === 'error'
                  ? '错误'
                  : metrics.playerStatus === 'paused'
                  ? '暂停'
                  : '加载中'}
              </p>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                当前状态
              </p>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <Zap className='h-4 w-4 text-blue-600' />
            <div>
              <p className='text-sm font-medium text-gray-900 dark:text-white'>
                {metrics.playbackRate}x
              </p>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                播放速率
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 质量指标 */}
      <div className='mb-6'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
          质量指标
        </h4>
        <div className='space-y-3'>
          <div className='flex justify-between items-center'>
            <span className='text-sm text-gray-600 dark:text-gray-400'>
              缓冲健康度
            </span>
            <div className='flex items-center gap-2'>
              <div className='w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5'>
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    metrics.bufferHealth > 0.7
                      ? 'bg-green-500'
                      : metrics.bufferHealth > 0.4
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${metrics.bufferHealth * 100}%` }}
                ></div>
              </div>
              <span className='text-sm font-medium text-gray-900 dark:text-white'>
                {(metrics.bufferHealth * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className='flex justify-between items-center'>
            <span className='text-sm text-gray-600 dark:text-gray-400'>
              网络延迟
            </span>
            <span
              className={`text-sm font-medium ${
                metrics.latency < 100
                  ? 'text-green-600'
                  : metrics.latency < 300
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {metrics.latency.toFixed(2)}ms
            </span>
          </div>

          <div className='flex justify-between items-center'>
            <span className='text-sm text-gray-600 dark:text-gray-400'>
              网络质量
            </span>
            <span
              className={`text-sm font-medium ${
                metrics.networkQuality === 'excellent'
                  ? 'text-green-600'
                  : metrics.networkQuality === 'good'
                  ? 'text-blue-600'
                  : metrics.networkQuality === 'fair'
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {metrics.networkQuality === 'excellent'
                ? '优秀'
                : metrics.networkQuality === 'good'
                ? '良好'
                : metrics.networkQuality === 'fair'
                ? '一般'
                : '较差'}
            </span>
          </div>
        </div>
      </div>

      {/* 优化状态 */}
      <div className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
          优化状态
        </h4>
        <div className='grid grid-cols-2 gap-4'>
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

        <div className='mt-3 grid grid-cols-2 gap-4'>
          <div className='text-center'>
            <p className='text-lg font-semibold text-red-600'>
              {metrics.errorCount}
            </p>
            <p className='text-xs text-gray-500 dark:text-gray-400'>错误次数</p>
          </div>
          <div className='text-center'>
            <p className='text-lg font-semibold text-orange-600'>
              {metrics.retryCount}
            </p>
            <p className='text-xs text-gray-500 dark:text-gray-400'>重试次数</p>
          </div>
        </div>
      </div>
    </div>
  );
}
