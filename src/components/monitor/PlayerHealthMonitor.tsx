'use client';

import { Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { playerHealthMonitor } from '@/lib/player-health-monitor';
import { getAllPlayerHealthStats } from '@/lib/player-health-stats';

/**
 * 播放器健康监控组件
 */
export default function PlayerHealthMonitor() {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const updateData = () => {
      const health = playerHealthMonitor.getHealthStatus();
      const statsData = getAllPlayerHealthStats();

      console.log('🔍 监控页面更新数据:', {
        totalRebuilds: statsData.rebuild.totalRebuilds,
        successfulRebuilds: statsData.rebuild.successfulRebuilds,
        failedRebuilds: statsData.rebuild.failedRebuilds,
      });

      setHealthStatus(health);
      setStats(statsData);
    };

    updateData();
    const interval = setInterval(updateData, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!healthStatus || !stats) {
    return (
      <div className='bg-white dark:bg-gray-800 p-6 rounded-lg shadow'>
        <p className='text-gray-500 dark:text-gray-400'>加载中...</p>
      </div>
    );
  }

  const getHealthIcon = () => {
    if (healthStatus.isHealthy) {
      return <CheckCircle className='h-6 w-6 text-green-500' />;
    } else if (healthStatus.criticalErrorCount > 0) {
      return <XCircle className='h-6 w-6 text-red-500' />;
    } else {
      return <AlertTriangle className='h-6 w-6 text-yellow-500' />;
    }
  };

  const getHealthColor = () => {
    if (healthStatus.isHealthy) return 'text-green-600';
    if (healthStatus.criticalErrorCount > 0) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getHealthText = () => {
    if (healthStatus.isHealthy) return '健康';
    if (healthStatus.criticalErrorCount > 0) return '严重错误';
    if (healthStatus.consecutiveErrors >= 3) return '警告';
    return '正常';
  };

  return (
    <div className='bg-white dark:bg-gray-800 p-6 rounded-lg shadow'>
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center gap-3'>
          <Activity className='h-6 w-6 text-blue-600' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            播放器健康状态
          </h3>
        </div>
        <div className='flex items-center gap-2'>
          {getHealthIcon()}
          <span className={`font-semibold ${getHealthColor()}`}>
            {getHealthText()}
          </span>
        </div>
      </div>

      {/* 健康指标 */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg'>
          <p className='text-2xl font-bold text-gray-900 dark:text-white'>
            {healthStatus.errorCount}
          </p>
          <p className='text-sm text-gray-500 dark:text-gray-400'>总错误数</p>
        </div>

        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg'>
          <p className='text-2xl font-bold text-red-600'>
            {healthStatus.criticalErrorCount}
          </p>
          <p className='text-sm text-gray-500 dark:text-gray-400'>严重错误</p>
        </div>

        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg'>
          <p className='text-2xl font-bold text-yellow-600'>
            {healthStatus.consecutiveErrors}
          </p>
          <p className='text-sm text-gray-500 dark:text-gray-400'>连续错误</p>
        </div>

        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg'>
          <p className='text-2xl font-bold text-gray-900 dark:text-white'>
            {healthStatus.isResponsive ? '✓' : '✗'}
          </p>
          <p className='text-sm text-gray-500 dark:text-gray-400'>响应性</p>
        </div>
      </div>

      {/* 重建统计 */}
      <div className='mb-6'>
        <h4 className='text-md font-semibold text-gray-900 dark:text-white mb-3'>
          重建统计
        </h4>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <div className='bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg'>
            <p className='text-2xl font-bold text-blue-600'>
              {stats.rebuild.totalRebuilds}
            </p>
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              总重建次数
            </p>
          </div>

          <div className='bg-green-50 dark:bg-green-900/20 p-4 rounded-lg'>
            <p className='text-2xl font-bold text-green-600'>
              {stats.rebuild.successfulRebuilds}
            </p>
            <p className='text-sm text-gray-500 dark:text-gray-400'>成功</p>
          </div>

          <div className='bg-red-50 dark:bg-red-900/20 p-4 rounded-lg'>
            <p className='text-2xl font-bold text-red-600'>
              {stats.rebuild.failedRebuilds}
            </p>
            <p className='text-sm text-gray-500 dark:text-gray-400'>失败</p>
          </div>

          <div className='bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg'>
            <p className='text-2xl font-bold text-purple-600'>
              {stats.rebuild.averageRebuildTime.toFixed(0)}ms
            </p>
            <p className='text-sm text-gray-500 dark:text-gray-400'>平均耗时</p>
          </div>
        </div>
      </div>

      {/* 错误统计 */}
      <div>
        <h4 className='text-md font-semibold text-gray-900 dark:text-white mb-3'>
          错误统计
        </h4>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
          <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg'>
            <p className='text-2xl font-bold text-gray-900 dark:text-white'>
              {stats.error.totalErrors}
            </p>
            <p className='text-sm text-gray-500 dark:text-gray-400'>总错误数</p>
          </div>

          <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg'>
            <p className='text-2xl font-bold text-gray-900 dark:text-white'>
              {(stats.error.errorRate * 100).toFixed(1)}%
            </p>
            <p className='text-sm text-gray-500 dark:text-gray-400'>错误率</p>
          </div>

          <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg'>
            <p className='text-2xl font-bold text-gray-900 dark:text-white'>
              {stats.error.topErrors.length}
            </p>
            <p className='text-sm text-gray-500 dark:text-gray-400'>错误类型</p>
          </div>
        </div>
      </div>

      {/* 重建原因 */}
      {stats.rebuild.rebuildReasons.size > 0 && (
        <div className='mt-6'>
          <h4 className='text-md font-semibold text-gray-900 dark:text-white mb-3'>
            重建原因分布
          </h4>
          <div className='space-y-2'>
            {(
              Array.from(stats.rebuild.rebuildReasons.entries()) as Array<
                [string, number]
              >
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([reason, count]) => (
                <div
                  key={reason}
                  className='flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded'
                >
                  <span className='text-sm text-gray-700 dark:text-gray-300'>
                    {reason}
                  </span>
                  <span className='text-sm font-semibold text-gray-900 dark:text-white'>
                    {count} 次
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Top 错误 */}
      {stats.error.topErrors.length > 0 && (
        <div className='mt-6'>
          <h4 className='text-md font-semibold text-gray-900 dark:text-white mb-3'>
            高频错误 Top 5
          </h4>
          <div className='space-y-2'>
            {stats.error.topErrors
              .slice(0, 5)
              .map((error: any, index: number) => (
                <div
                  key={index}
                  className='flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded'
                >
                  <span className='text-sm text-gray-700 dark:text-gray-300 truncate flex-1'>
                    {error.type}
                  </span>
                  <span className='text-sm font-semibold text-red-600 ml-2'>
                    {error.count} 次
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 需要重建警告 */}
      {healthStatus.needsRebuild && (
        <div className='mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg'>
          <div className='flex items-center gap-2 mb-2'>
            <AlertTriangle className='h-5 w-5 text-red-600' />
            <span className='font-semibold text-red-600'>需要重建播放器</span>
          </div>
          <p className='text-sm text-red-700 dark:text-red-300'>
            原因: {healthStatus.rebuildReason || '未知'}
          </p>
        </div>
      )}
    </div>
  );
}
