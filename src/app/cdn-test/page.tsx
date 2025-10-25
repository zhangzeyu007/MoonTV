'use client';

import { useState } from 'react';

import { cdnOptimizationTester } from '@/lib/cdn-optimization-tester';
import { cdnOptimizer } from '@/lib/cdn-optimizer';
import { fastSourceTester } from '@/lib/fast-source-tester';
import { geolocationService } from '@/lib/geolocation-service';

/**
 * CDN优化测试页面
 * 用于测试和验证CDN优化功能
 */

export default function CDNOptimizationTestPage() {
  const [geolocationInfo, setGeolocationInfo] = useState<any>(null);
  const [cdnRecommendation, setCdnRecommendation] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 测试URL列表
  const testUrls = [
    'https://example1.com/video.m3u8',
    'https://example2.com/video.m3u8',
    'https://example3.com/video.m3u8',
  ];

  // 获取地理位置信息
  const fetchGeolocation = async () => {
    try {
      setLoading(true);
      const info = await geolocationService.getGeolocationInfo();
      setGeolocationInfo(info);
    } catch (err) {
      setError('获取地理位置信息失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 获取CDN优化建议
  const fetchCDNRecommendation = async () => {
    try {
      setLoading(true);
      const recommendation = await geolocationService.getOptimalCDNNode();
      setCdnRecommendation(recommendation);
    } catch (err) {
      setError('获取CDN优化建议失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 执行CDN优化测试
  const runCDNTest = async () => {
    try {
      setLoading(true);
      setError(null);

      const testConfig = {
        testUrls,
        enableGeolocation: true,
        enableCDNOptimization: true,
        enableLatencyTest: true,
        maxConcurrency: 3,
      };

      const results = await cdnOptimizationTester.runCDNTest(testConfig);
      setTestResults(results);
    } catch (err) {
      setError('CDN优化测试失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 快速测试单个URL
  const quickTestUrl = async (url: string) => {
    try {
      const result = await cdnOptimizationTester.quickTestUrl(url);
      console.log('快速测试结果:', result);
      return result;
    } catch (err) {
      console.error('快速测试失败:', err);
      return null;
    }
  };

  // 清除所有缓存
  const clearAllCaches = async () => {
    try {
      geolocationService.clearCache();
      cdnOptimizer.clearCache();
      fastSourceTester.clearCache();
      cdnOptimizationTester.clearTestHistory();
      alert('所有缓存已清除');
    } catch (err) {
      console.error('清除缓存失败:', err);
    }
  };

  return (
    <div className='container mx-auto p-6 max-w-4xl'>
      <h1 className='text-3xl font-bold mb-6'>CDN优化测试工具</h1>

      {error && (
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4'>
          {error}
        </div>
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* 地理位置信息 */}
        <div className='bg-white p-6 rounded-lg shadow'>
          <h2 className='text-xl font-semibold mb-4'>地理位置信息</h2>
          <button
            onClick={fetchGeolocation}
            disabled={loading}
            className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 mb-4'
          >
            {loading ? '获取中...' : '获取地理位置'}
          </button>

          {geolocationInfo && (
            <div className='space-y-2'>
              <p>
                <strong>国家:</strong> {geolocationInfo.country}
              </p>
              <p>
                <strong>城市:</strong> {geolocationInfo.city}
              </p>
              <p>
                <strong>地区:</strong> {geolocationInfo.region}
              </p>
              <p>
                <strong>IP地址:</strong> {geolocationInfo.ip}
              </p>
              <p>
                <strong>ISP:</strong> {geolocationInfo.isp}
              </p>
              <p>
                <strong>时区:</strong> {geolocationInfo.timezone}
              </p>
            </div>
          )}
        </div>

        {/* CDN优化建议 */}
        <div className='bg-white p-6 rounded-lg shadow'>
          <h2 className='text-xl font-semibold mb-4'>CDN优化建议</h2>
          <button
            onClick={fetchCDNRecommendation}
            disabled={loading}
            className='bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 mb-4'
          >
            {loading ? '获取中...' : '获取CDN建议'}
          </button>

          {cdnRecommendation && (
            <div className='space-y-2'>
              <p>
                <strong>推荐节点:</strong>{' '}
                {cdnRecommendation.recommendedNode.name}
              </p>
              <p>
                <strong>地区:</strong>{' '}
                {cdnRecommendation.recommendedNode.region}
              </p>
              <p>
                <strong>国家:</strong>{' '}
                {cdnRecommendation.recommendedNode.country}
              </p>
              <p>
                <strong>预估延迟:</strong>{' '}
                {cdnRecommendation.estimatedLatency.toFixed(0)}ms
              </p>
              <p>
                <strong>距离:</strong> {cdnRecommendation.distance.toFixed(1)}km
              </p>
              <p>
                <strong>置信度:</strong>{' '}
                {(cdnRecommendation.confidence * 100).toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CDN优化测试 */}
      <div className='bg-white p-6 rounded-lg shadow mt-6'>
        <h2 className='text-xl font-semibold mb-4'>CDN优化测试</h2>

        <div className='mb-4'>
          <h3 className='font-medium mb-2'>测试URL列表:</h3>
          <ul className='list-disc list-inside space-y-1'>
            {testUrls.map((url, index) => (
              <li key={index} className='text-sm text-gray-600'>
                {url}
                <button
                  onClick={() => quickTestUrl(url)}
                  className='ml-2 text-blue-500 hover:text-blue-700 text-xs'
                >
                  快速测试
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={runCDNTest}
          disabled={loading}
          className='bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600 disabled:opacity-50 mb-4'
        >
          {loading ? '测试中...' : '执行CDN优化测试'}
        </button>

        {testResults && (
          <div className='space-y-4'>
            <h3 className='font-medium'>测试结果:</h3>

            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <div className='bg-gray-50 p-3 rounded'>
                <p className='text-sm text-gray-600'>总测试时间</p>
                <p className='font-semibold'>
                  {testResults.performanceMetrics.totalTestTime}ms
                </p>
              </div>
              <div className='bg-gray-50 p-3 rounded'>
                <p className='text-sm text-gray-600'>平均延迟</p>
                <p className='font-semibold'>
                  {testResults.performanceMetrics.averageLatency}ms
                </p>
              </div>
              <div className='bg-gray-50 p-3 rounded'>
                <p className='text-sm text-gray-600'>优化率</p>
                <p className='font-semibold'>
                  {testResults.performanceMetrics.optimizationRate}%
                </p>
              </div>
              <div className='bg-gray-50 p-3 rounded'>
                <p className='text-sm text-gray-600'>CDN优化数量</p>
                <p className='font-semibold'>
                  {testResults.performanceMetrics.cdnOptimizedCount}
                </p>
              </div>
            </div>

            <div>
              <h4 className='font-medium mb-2'>优化建议:</h4>
              <ul className='list-disc list-inside space-y-1'>
                {testResults.recommendations.map(
                  (rec: string, index: number) => (
                    <li key={index} className='text-sm'>
                      {rec}
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 缓存管理 */}
      <div className='bg-white p-6 rounded-lg shadow mt-6'>
        <h2 className='text-xl font-semibold mb-4'>缓存管理</h2>
        <button
          onClick={clearAllCaches}
          className='bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600'
        >
          清除所有缓存
        </button>
      </div>
    </div>
  );
}
