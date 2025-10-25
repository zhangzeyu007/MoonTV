'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  PerformanceMetrics,
  performanceMonitor,
  RealTimeMetrics,
} from '@/lib/performance-monitor';

/**
 * 实时监控数据Hook
 * 提供实时数据更新和状态管理
 */
export function useRealTimeMonitor() {
  const [realTimeMetrics, setRealTimeMetrics] =
    useState<RealTimeMetrics | null>(null);
  const [historicalMetrics, setHistoricalMetrics] = useState<
    PerformanceMetrics[]
  >([]);
  const [networkStats, setNetworkStats] = useState<any>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 订阅实时指标更新
  useEffect(() => {
    const unsubscribe = performanceMonitor.subscribe((metrics) => {
      setRealTimeMetrics(metrics);
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // 初始化时检查监控状态
  useEffect(() => {
    const status = performanceMonitor.getMonitoringStatus();
    setIsMonitoring(status.isMonitoring);
  }, []);

  // 定期更新历史数据和网络统计
  useEffect(() => {
    const updateData = () => {
      try {
        const allMetrics = performanceMonitor.getAllMetrics();
        const stats = performanceMonitor.getNetworkQualityStats();

        setHistoricalMetrics(allMetrics);
        setNetworkStats(stats);
        setError(null);
      } catch (err) {
        setError('更新数据失败');
        console.error('更新监控数据失败:', err);
      }
    };

    // 立即更新一次
    updateData();

    // 每5秒更新一次
    updateIntervalRef.current = setInterval(updateData, 5000);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  // 开始监控
  const startMonitoring = useCallback(() => {
    try {
      performanceMonitor.startRealTimeMonitoring(true); // 用户控制
      setIsMonitoring(true);
      setError(null);
    } catch (err) {
      setError('启动监控失败');
      console.error('启动监控失败:', err);
    }
  }, []);

  // 停止监控
  const stopMonitoring = useCallback(() => {
    try {
      performanceMonitor.stopRealTimeMonitoringByUser(); // 用户主动停止
      setIsMonitoring(false);
      setError(null);
    } catch (err) {
      setError('停止监控失败');
      console.error('停止监控失败:', err);
    }
  }, []);

  // 刷新数据
  const refreshData = useCallback(async () => {
    try {
      setError(null);

      // 刷新历史数据
      const allMetrics = performanceMonitor.getAllMetrics();
      setHistoricalMetrics(allMetrics);

      // 刷新网络统计
      const stats = performanceMonitor.getNetworkQualityStats();
      setNetworkStats(stats);

      // 刷新当前状态
      const currentState = performanceMonitor.getCurrentRealTimeState();
      if (currentState) {
        setRealTimeMetrics(currentState as RealTimeMetrics);
      }
    } catch (err) {
      setError('刷新数据失败');
      console.error('刷新数据失败:', err);
    }
  }, []);

  // 清除所有数据
  const clearAllData = useCallback(() => {
    try {
      performanceMonitor.clearRealTimeMetrics();
      performanceMonitor.clearMetrics();
      setRealTimeMetrics(null);
      setHistoricalMetrics([]);
      setNetworkStats(null);
      setError(null);
    } catch (err) {
      setError('清除数据失败');
      console.error('清除数据失败:', err);
    }
  }, []);

  // 获取性能报告
  const getPerformanceReport = useCallback(() => {
    try {
      return performanceMonitor.getPerformanceReport();
    } catch (err) {
      console.error('获取性能报告失败:', err);
      return '获取性能报告失败';
    }
  }, []);

  return {
    realTimeMetrics,
    historicalMetrics,
    networkStats,
    isMonitoring,
    error,
    startMonitoring,
    stopMonitoring,
    refreshData,
    clearAllData,
    getPerformanceReport,
  };
}

/**
 * 网络质量监控Hook
 * 提供网络质量测试和监控
 */
export function useNetworkMonitor() {
  const [networkTestResults, setNetworkTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 测试网络质量
  const testNetworkQuality = useCallback(async (urls?: string[]) => {
    try {
      setTesting(true);
      setError(null);

      const response = await fetch('/api/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'test_network',
          urls: urls || [
            'https://www.google.com',
            'https://www.cloudflare.com',
            'https://www.github.com',
          ],
        }),
      });

      const data = await response.json();

      if (data.success) {
        setNetworkTestResults(data.data);
      } else {
        setError(data.error || '网络质量测试失败');
      }
    } catch (err) {
      setError('网络质量测试失败');
      console.error('网络质量测试失败:', err);
    } finally {
      setTesting(false);
    }
  }, []);

  return {
    networkTestResults,
    testing,
    error,
    testNetworkQuality,
  };
}
