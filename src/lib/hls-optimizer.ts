/* eslint-disable @typescript-eslint/no-explicit-any */

import Hls from 'hls.js';

/**
 * 优化的 HLS.js 配置
 * 根据不同场景提供最佳的性能配置
 */
export interface HlsConfigOptions {
  isMobile?: boolean;
  isLowEndDevice?: boolean;
  networkSpeed?: 'slow' | 'medium' | 'fast';
  enableLowLatency?: boolean;
}

/**
 * 获取优化的 HLS.js 配置
 */
export function getOptimizedHlsConfig(options: HlsConfigOptions = {}): any {
  const {
    isMobile = false,
    isLowEndDevice = false,
    networkSpeed = 'medium',
    enableLowLatency = false,
  } = options;

  // 基础配置
  const baseConfig: any = {
    debug: false,
    enableWorker: true,
    lowLatencyMode: enableLowLatency,
    startLevel: -1, // 自动选择起始质量
    capLevelToPlayerSize: true,
    capLevelOnFPSDrop: true,
    fpsDroppedMonitoringPeriod: 5000,
    fpsDroppedMonitoringThreshold: 0.2,
    appendErrorMaxRetry: 3,
    loader: undefined, // 使用默认加载器
    fLoader: undefined, // 使用默认片段加载器
    pLoader: undefined, // 使用默认播放列表加载器
    xhrSetup: undefined, // 使用默认 XHR 设置
    fetchSetup: undefined, // 使用默认 Fetch 设置
    abrEwmaFastLive: 3.0,
    abrEwmaSlowLive: 9.0,
    abrEwmaFastVoD: 3.0,
    abrEwmaSlowVoD: 9.0,
    abrEwmaDefaultEstimate: 500000,
    abrMaxWithRealBitrate: false,
    maxStarvationDelay: 4,
    maxLoadingDelay: 4,
    minAutoBitrate: 0,
    emeEnabled: false,
    widevineLicenseUrl: undefined,
    drmSystemOptions: {},
    requestMediaKeySystemAccessFunc: undefined,
    // 缓冲配置
    maxBufferLength: 60,
    backBufferLength: 60,
    maxBufferSize: 100 * 1000 * 1000, // 100MB
    maxMaxBufferLength: 600,
    fragLoadingTimeOut: 30000,
    manifestLoadingTimeOut: 20000,
    levelLoadingTimeOut: 20000,
    maxBufferHole: 2.0,
    highBufferWatchdogPeriod: 5,
    nudgeOffset: 0.2,
    fragLoadingMaxRetry: 6,
    manifestLoadingMaxRetry: 4,
    levelLoadingMaxRetry: 4,
    fragLoadingRetryDelay: 1000,
    manifestLoadingRetryDelay: 1500,
    levelLoadingRetryDelay: 1500,
  };

  // 根据设备类型调整配置
  if (isMobile) {
    baseConfig.maxBufferLength = 30;
    baseConfig.backBufferLength = 30;
    baseConfig.maxBufferSize = 50 * 1000 * 1000; // 50MB
    baseConfig.maxMaxBufferLength = 300;
    baseConfig.fragLoadingTimeOut = 20000;
    baseConfig.manifestLoadingTimeOut = 10000;
    baseConfig.levelLoadingTimeOut = 10000;
    baseConfig.maxLoadingDelay = 6;
    baseConfig.maxBufferHole = 1.0;
    baseConfig.highBufferWatchdogPeriod = 3;
    baseConfig.nudgeOffset = 0.1;
    baseConfig.fragLoadingMaxRetry = 4;
    baseConfig.manifestLoadingMaxRetry = 3;
    baseConfig.levelLoadingMaxRetry = 3;
    baseConfig.fragLoadingRetryDelay = 1000;
    baseConfig.manifestLoadingRetryDelay = 1000;
    baseConfig.levelLoadingRetryDelay = 1000;
  } else {
    baseConfig.maxBufferLength = 60;
    baseConfig.backBufferLength = 60;
    baseConfig.maxBufferSize = 100 * 1000 * 1000; // 100MB
    baseConfig.maxMaxBufferLength = 600;
    baseConfig.fragLoadingTimeOut = 30000;
    baseConfig.manifestLoadingTimeOut = 20000;
    baseConfig.levelLoadingTimeOut = 20000;
    baseConfig.maxLoadingDelay = 8;
    baseConfig.maxBufferHole = 2.0;
    baseConfig.highBufferWatchdogPeriod = 5;
    baseConfig.nudgeOffset = 0.2;
    baseConfig.fragLoadingMaxRetry = 6;
    baseConfig.manifestLoadingMaxRetry = 4;
    baseConfig.levelLoadingMaxRetry = 4;
    baseConfig.fragLoadingRetryDelay = 1000;
    baseConfig.manifestLoadingRetryDelay = 1500;
    baseConfig.levelLoadingRetryDelay = 1500;
  }

  // 低端设备优化
  if (isLowEndDevice) {
    baseConfig.maxBufferLength = 20;
    baseConfig.backBufferLength = 20;
    baseConfig.maxBufferSize = 30 * 1000 * 1000; // 30MB
    baseConfig.maxMaxBufferLength = 200;
    baseConfig.fragLoadingTimeOut = 15000;
    baseConfig.manifestLoadingTimeOut = 8000;
    baseConfig.levelLoadingTimeOut = 8000;
    baseConfig.maxLoadingDelay = 4;
    baseConfig.maxBufferHole = 0.5;
    baseConfig.highBufferWatchdogPeriod = 2;
    baseConfig.nudgeOffset = 0.05;
    baseConfig.fragLoadingMaxRetry = 3;
    baseConfig.manifestLoadingMaxRetry = 2;
    baseConfig.levelLoadingMaxRetry = 2;
    baseConfig.fragLoadingRetryDelay = 500;
    baseConfig.manifestLoadingRetryDelay = 800;
    baseConfig.levelLoadingRetryDelay = 800;
  }

  // 根据网络速度调整配置
  switch (networkSpeed) {
    case 'slow':
      baseConfig.maxBufferLength = Math.min(baseConfig.maxBufferLength, 30);
      baseConfig.maxBufferSize = Math.min(
        baseConfig.maxBufferSize,
        50 * 1000 * 1000
      );
      baseConfig.fragLoadingTimeOut = Math.min(
        baseConfig.fragLoadingTimeOut,
        20000
      );
      baseConfig.maxLoadingDelay = Math.min(baseConfig.maxLoadingDelay, 6);
      break;
    case 'fast':
      baseConfig.maxBufferLength = Math.max(baseConfig.maxBufferLength, 90);
      baseConfig.maxBufferSize = Math.max(
        baseConfig.maxBufferSize,
        200 * 1000 * 1000
      );
      baseConfig.fragLoadingTimeOut = Math.max(
        baseConfig.fragLoadingTimeOut,
        45000
      );
      baseConfig.maxLoadingDelay = Math.max(baseConfig.maxLoadingDelay, 12);
      break;
  }

  // 低延迟模式优化
  if (enableLowLatency) {
    baseConfig.lowLatencyMode = true;
    baseConfig.maxBufferLength = Math.min(baseConfig.maxBufferLength, 10);
    baseConfig.backBufferLength = Math.min(baseConfig.backBufferLength, 10);
    baseConfig.maxBufferSize = Math.min(
      baseConfig.maxBufferSize,
      20 * 1000 * 1000
    );
    baseConfig.fragLoadingTimeOut = Math.min(
      baseConfig.fragLoadingTimeOut,
      10000
    );
    baseConfig.manifestLoadingTimeOut = Math.min(
      baseConfig.manifestLoadingTimeOut,
      5000
    );
    baseConfig.levelLoadingTimeOut = Math.min(
      baseConfig.levelLoadingTimeOut,
      5000
    );
    baseConfig.maxLoadingDelay = Math.min(baseConfig.maxLoadingDelay, 2);
    baseConfig.maxBufferHole = Math.min(baseConfig.maxBufferHole, 0.1);
    baseConfig.highBufferWatchdogPeriod = Math.min(
      baseConfig.highBufferWatchdogPeriod,
      1
    );
    baseConfig.nudgeOffset = Math.min(baseConfig.nudgeOffset, 0.05);
  }

  return baseConfig;
}

/**
 * 检测设备类型和网络状况
 */
export function detectDeviceAndNetwork(): HlsConfigOptions {
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  const isLowEndDevice = (() => {
    // 检测设备性能指标
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (connection) {
      // 基于网络连接类型判断
      const slowConnections = ['slow-2g', '2g', '3g'];
      return slowConnections.includes(connection.effectiveType);
    }

    // 基于硬件并发数判断
    if (navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency <= 2;
    }

    // 基于内存判断（如果可用）
    if ((navigator as any).deviceMemory) {
      return (navigator as any).deviceMemory <= 2;
    }

    return false;
  })();

  const networkSpeed = (() => {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (connection) {
      switch (connection.effectiveType) {
        case 'slow-2g':
        case '2g':
          return 'slow';
        case '3g':
          return 'medium';
        case '4g':
        default:
          return 'fast';
      }
    }
    return 'medium';
  })();

  return {
    isMobile,
    isLowEndDevice,
    networkSpeed,
    enableLowLatency: false, // 默认关闭低延迟模式
  };
}

/**
 * 创建优化的 HLS 实例
 */
export function createOptimizedHlsInstance(
  options?: HlsConfigOptions,
  customConfig?: any
): Hls {
  const detectedOptions = detectDeviceAndNetwork();
  const finalOptions = { ...detectedOptions, ...options };
  const config = getOptimizedHlsConfig(finalOptions);

  // 合并自定义配置
  const finalConfig = { ...config, ...customConfig };

  console.log('HLS.js 配置:', finalConfig);

  return new Hls(finalConfig);
}

/**
 * 智能重试机制
 */
export function createRetryHandler(maxRetries = 3, baseDelay = 1000) {
  let retryCount = 0;

  return {
    shouldRetry: (error: any): boolean => {
      if (retryCount >= maxRetries) {
        return false;
      }

      // 检查错误类型，决定是否重试
      const retryableErrors = [
        'NetworkError',
        'AbortError',
        'TimeoutError',
        'MEDIA_ERR_NETWORK',
        'MEDIA_ERR_SRC_NOT_SUPPORTED',
      ];

      const errorMessage = error.message || error.type || '';
      return retryableErrors.some((retryableError) =>
        errorMessage.includes(retryableError)
      );
    },

    getRetryDelay: (): number => {
      retryCount++;
      // 指数退避算法
      return baseDelay * Math.pow(2, retryCount - 1);
    },

    reset: (): void => {
      retryCount = 0;
    },
  };
}

/**
 * 预加载 HLS 资源
 */
export async function preloadHlsResource(
  url: string,
  timeout = 5000
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15',
        Accept: '*/*',
      },
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('HLS 资源预加载失败:', error);
    return false;
  }
}

/**
 * 批量预加载 HLS 资源
 */
export async function batchPreloadHlsResources(
  urls: string[],
  maxConcurrency = 3,
  timeout = 5000
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // 分批处理
  const chunks = [];
  for (let i = 0; i < urls.length; i += maxConcurrency) {
    chunks.push(urls.slice(i, i + maxConcurrency));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (url) => {
      const success = await preloadHlsResource(url, timeout);
      results.set(url, success);
    });

    await Promise.allSettled(promises);
  }

  return results;
}
