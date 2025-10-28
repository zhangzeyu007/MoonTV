'use client';

import { Activity, RefreshCw } from 'lucide-react';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { useRealTimeMonitor } from '@/hooks/useRealTimeMonitor';

import NetworkChart from '@/components/monitor/NetworkChart';
import PerformanceChart from '@/components/monitor/PerformanceChart';
import PlayerHealthMonitor from '@/components/monitor/PlayerHealthMonitor';
import RealTimeMetricsComponent from '@/components/monitor/RealTimeMetrics';
import RealTimeRequestMonitor from '@/components/monitor/RealTimeRequestMonitor';
import SourceQualityComponent from '@/components/monitor/SourceQuality';
import SourceRequestMonitor from '@/components/monitor/SourceRequestMonitor';
import VideoRequestStats from '@/components/monitor/VideoRequestStats';
import PageLayout from '@/components/PageLayout';

/**
 * 实时性能监控页面
 * 显示播放器性能指标、网络质量、视频源请求等实时信息
 */
function MonitorPageContent() {
  const {
    realTimeMetrics,
    historicalMetrics,
    isMonitoring,
    error: monitorError,
    startMonitoring,
    stopMonitoring,
    refreshData,
    clearAllData,
  } = useRealTimeMonitor();

  const [error, setError] = useState<string | null>(null);

  // 合并所有错误
  useEffect(() => {
    const errors = [monitorError].filter(Boolean);
    setError(errors.length > 0 ? errors.join('; ') : null);
  }, [monitorError]);

  // 开始/停止监控
  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  }, [isMonitoring, startMonitoring, stopMonitoring]);

  // 刷新所有数据
  const refreshAll = useCallback(async () => {
    await refreshData();
  }, [refreshData]);

  // 清除所有数据
  const clearAll = useCallback(() => {
    clearAllData();
  }, [clearAllData]);

  return (
    <PageLayout activePath='/monitor'>
      <div className='px-2 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto'>
        {/* 页面标题和控制按钮 */}
        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4'>
          <div className='flex items-center gap-3'>
            <Activity className='h-6 w-6 sm:h-8 sm:w-8 text-green-600' />
            <h1 className='text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white'>
              实时性能监控
            </h1>
          </div>

          <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
            <button
              onClick={toggleMonitoring}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                isMonitoring
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isMonitoring ? '停止监控' : '开始监控'}
            </button>

            <button
              onClick={refreshAll}
              className='px-3 py-2 sm:px-4 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm sm:text-base'
            >
              <RefreshCw className='h-4 w-4' />
              <span className='hidden sm:inline'>刷新</span>
            </button>

            <button
              onClick={clearAll}
              className='px-3 py-2 sm:px-4 sm:py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base'
            >
              <span className='hidden sm:inline'>清除数据</span>
              <span className='sm:hidden'>清除</span>
            </button>
          </div>
        </div>

        {error && (
          <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6'>
            {error}
          </div>
        )}

        {/* 播放器健康监控 */}
        <div className='mb-6'>
          <PlayerHealthMonitor />
        </div>

        {/* 实时指标面板 */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6'>
          <RealTimeMetricsComponent metrics={realTimeMetrics} />
          <SourceQualityComponent metrics={realTimeMetrics} />
        </div>

        {/* 实时请求监控 */}
        <div className='mb-6'>
          <RealTimeRequestMonitor metrics={realTimeMetrics} />
        </div>

        {/* 视频源请求监控 */}
        <div className='mb-6'>
          <SourceRequestMonitor metrics={realTimeMetrics} />
        </div>

        {/* 视频请求性能统计 */}
        <div className='mb-6'>
          <VideoRequestStats metrics={historicalMetrics} />
        </div>

        {/* 网络状态 */}
        <div className='mb-6'>
          <NetworkChart metrics={realTimeMetrics ? [realTimeMetrics] : []} />
        </div>

        {/* 性能趋势分析 */}
        <div className='mb-6'>
          <PerformanceChart metrics={historicalMetrics} />
        </div>

        {/* 当前播放源信息 */}
        {realTimeMetrics?.currentSource && (
          <div className='bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
              当前播放源详情
            </h3>
            <div className='bg-gray-50 dark:bg-gray-700 p-3 rounded text-xs sm:text-sm font-mono break-all'>
              {realTimeMetrics.currentSource}
            </div>
            <div className='mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm'>
              <div className='text-center'>
                <p className='font-semibold text-gray-900 dark:text-white'>
                  {realTimeMetrics.latency.toFixed(2)}ms
                </p>
                <p className='text-xs text-gray-500 dark:text-gray-400'>延迟</p>
              </div>
              <div className='text-center'>
                <p className='font-semibold text-gray-900 dark:text-white'>
                  {realTimeMetrics.bufferHealth
                    ? (realTimeMetrics.bufferHealth * 100).toFixed(0) + '%'
                    : '0%'}
                </p>
                <p className='text-xs text-gray-500 dark:text-gray-400'>缓冲</p>
              </div>
              <div className='text-center'>
                <p className='font-semibold text-gray-900 dark:text-white'>
                  {realTimeMetrics.networkQuality}
                </p>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  网络质量
                </p>
              </div>
              <div className='text-center'>
                <p className='font-semibold text-gray-900 dark:text-white'>
                  {realTimeMetrics.playbackRate}x
                </p>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  播放速率
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function MonitorPage() {
  return (
    <Suspense
      fallback={
        <div className='flex items-center justify-center min-h-screen'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4'></div>
            <p className='text-gray-600 dark:text-gray-400'>加载监控面板...</p>
          </div>
        </div>
      }
    >
      <MonitorPageContent />
    </Suspense>
  );
}
