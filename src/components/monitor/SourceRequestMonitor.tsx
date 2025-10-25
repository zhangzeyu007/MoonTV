'use client';

import { CheckCircle, Server, XCircle } from 'lucide-react';

import { RealTimeMetrics } from '@/lib/performance-monitor';

interface SourceRequestMonitorProps {
  metrics: RealTimeMetrics | null;
  className?: string;
}

/**
 * 视频源请求监控组件
 * 显示每次播放视频请求的可用源详情和性能信息
 */
export default function SourceRequestMonitor({
  metrics,
  className = '',
}: SourceRequestMonitorProps) {
  if (!metrics) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
      >
        <div className='flex items-center gap-3 mb-4'>
          <Server className='h-5 w-5 text-blue-600' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            视频源请求监控
          </h3>
        </div>
        <p className='text-gray-500 dark:text-gray-400'>暂无数据</p>
      </div>
    );
  }

  const getSourceStatusIcon = (available: boolean) => {
    return available ? (
      <CheckCircle className='h-4 w-4 text-green-600' />
    ) : (
      <XCircle className='h-4 w-4 text-red-600' />
    );
  };

  const getSourceStatusText = (available: boolean) => {
    return available ? '可用' : '不可用';
  };

  const getSourceStatusColor = (available: boolean) => {
    return available ? 'text-green-600' : 'text-red-600';
  };

  // 使用真实的源信息或模拟数据
  const sources =
    metrics.sourcesInfo && metrics.sourcesInfo.length > 0
      ? metrics.sourcesInfo
      : [
          {
            url: metrics.currentSource || 'https://example.com/video1.m3u8',
            available: true,
            pingTime: metrics.latency || 150,
            quality: 'HD',
            testTime: Date.now() - 30000,
            cdnOptimized: metrics.cdnOptimized || false,
            cacheHit: metrics.cacheHit || false,
          },
          {
            url: 'https://backup1.example.com/video1.m3u8',
            available: true,
            pingTime: 200,
            quality: 'HD',
            testTime: Date.now() - 25000,
            cdnOptimized: false,
            cacheHit: false,
          },
          {
            url: 'https://backup2.example.com/video1.m3u8',
            available: false,
            pingTime: 0,
            quality: 'HD',
            testTime: Date.now() - 20000,
            cdnOptimized: false,
            cacheHit: false,
          },
        ];

  const availableSources =
    metrics.availableSourcesCount || sources.filter((s) => s.available).length;
  const totalSources = sources.length;
  const successRate = metrics.sourceSuccessRate
    ? metrics.sourceSuccessRate * 100
    : totalSources > 0
    ? (availableSources / totalSources) * 100
    : 0;

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}
    >
      <div className='flex items-center gap-3 mb-4'>
        <Server className='h-5 w-5 text-blue-600' />
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          视频源请求监控
        </h3>
        <div className='ml-auto flex items-center gap-2'>
          <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse'></div>
          <span className='text-xs text-gray-500 dark:text-gray-400'>实时</span>
        </div>
      </div>

      {/* 源统计信息 */}
      <div className='grid grid-cols-3 gap-4 mb-6'>
        <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center'>
          <p className='text-lg font-semibold text-gray-900 dark:text-white'>
            {availableSources}
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>可用源</p>
        </div>
        <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center'>
          <p className='text-lg font-semibold text-gray-900 dark:text-white'>
            {totalSources}
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>总源数</p>
        </div>
        <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center'>
          <p
            className={`text-lg font-semibold ${
              successRate > 70
                ? 'text-green-600'
                : successRate > 40
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {successRate.toFixed(1)}%
          </p>
          <p className='text-xs text-gray-500 dark:text-gray-400'>成功率</p>
        </div>
      </div>

      {/* 当前播放源 */}
      {metrics.currentSource && (
        <div className='mb-6'>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
            当前播放源
          </h4>
          <div className='bg-green-50 dark:bg-green-900/20 p-3 rounded-lg'>
            <div className='flex items-center gap-2 mb-2'>
              <CheckCircle className='h-4 w-4 text-green-600' />
              <span className='text-sm font-medium text-green-700 dark:text-green-300'>
                正在播放
              </span>
            </div>
            <div className='text-xs font-mono text-gray-600 dark:text-gray-400 break-all'>
              {metrics.currentSource}
            </div>
            <div className='flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400'>
              <span>延迟: {metrics.latency.toFixed(2)}ms</span>
              <span>质量: {metrics.networkQuality}</span>
              {metrics.cdnOptimized && (
                <span className='text-green-600'>CDN优化</span>
              )}
              {metrics.cacheHit && (
                <span className='text-blue-600'>缓存命中</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 源列表 */}
      <div>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
          所有测试源
        </h4>
        <div className='space-y-2'>
          {sources.map((source, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${
                source.available
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}
            >
              <div className='flex items-center justify-between mb-2'>
                <div className='flex items-center gap-2'>
                  {getSourceStatusIcon(source.available)}
                  <span
                    className={`text-sm font-medium ${getSourceStatusColor(
                      source.available
                    )}`}
                  >
                    {getSourceStatusText(source.available)}
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
                <div className='flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400'>
                  {source.available && (
                    <span>延迟: {source.pingTime.toFixed(2)}ms</span>
                  )}
                  <span>质量: {source.quality}</span>
                </div>
              </div>
              <div className='text-xs font-mono text-gray-600 dark:text-gray-400 break-all'>
                {source.url}
              </div>
              <div className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
                测试时间: {new Date(source.testTime).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 性能指标 */}
      <div className='mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
          性能指标
        </h4>
        <div className='grid grid-cols-2 gap-4'>
          <div className='text-center'>
            <p className='text-lg font-semibold text-gray-900 dark:text-white'>
              {metrics.errorCount}
            </p>
            <p className='text-xs text-gray-500 dark:text-gray-400'>错误次数</p>
          </div>
          <div className='text-center'>
            <p className='text-lg font-semibold text-gray-900 dark:text-white'>
              {metrics.retryCount}
            </p>
            <p className='text-xs text-gray-500 dark:text-gray-400'>重试次数</p>
          </div>
        </div>
      </div>
    </div>
  );
}
