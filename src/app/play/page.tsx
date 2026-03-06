/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console, @next/next/no-img-element */

'use client';

let Artplayer: any = null;
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('artplayer');
  Artplayer = mod.default || mod;
}
import Hls from 'hls.js';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import {
  AutoSourceSwitcher,
  createAutoSourceSwitcher,
} from '@/lib/auto-source-switcher';
import { SmartSourceSwitcher } from '@/lib/backup-source-manager';
import {
  deleteFavorite,
  deletePlayRecord,
  generateStorageKey,
  getAllPlayRecords,
  isFavorited,
  saveFavorite,
  savePlayRecord,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { shouldSilenceError } from '@/lib/event-handler-utils';
import {
  fastPreferSources,
  fastSourceTester,
  ultraFastSourceSelect,
} from '@/lib/fast-source-tester';
import {
  createOptimizedHlsInstance,
  detectDeviceAndNetwork,
  preloadHlsResource,
} from '@/lib/hls-optimizer';
import { performanceMonitor } from '@/lib/performance-monitor';
import {
  checkPlayerHealth,
  getPlayerHealthStatus,
} from '@/lib/player-auto-recovery';
import {
  cleanupPlayerEvents,
  createSafePlayerHandler,
  initPlayerEventHandling,
  resetPlayerEvents,
  shouldResetPlayerEvents,
} from '@/lib/player-event-integration';
import { playerHealthMonitor } from '@/lib/player-health-monitor';
import { playerRecoveryManager } from '@/lib/player-recovery-manager';
import { showFatalError } from '@/lib/player-ui-feedback';
import { SearchResult } from '@/lib/types';
import {
  detectPiPSupport,
  getRecommendedReadyState,
  isIOSSafari,
  isSafariBrowser,
  isWebKitBrowser,
  waitForVideoReady,
} from '@/lib/utils';

import EpisodeSelector from '@/components/EpisodeSelector';
import PageLayout from '@/components/PageLayout';

// 扩展 HTMLVideoElement 类型以支持 hls 属性
declare global {
  interface HTMLVideoElement {
    hls?: any;
  }
}

function PlayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 挂载保护，避免 SSR/CSR 文本不一致
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);

    // 初始化播放器事件处理系统
    initPlayerEventHandling();

    // 添加全局错误捕获机制 - 直接显示弹窗，不尝试自动修复
    const handleGlobalError = (event: ErrorEvent) => {
      const error = event.error;

      // 检测 composedPath 相关错误
      if (
        error &&
        error.message &&
        (error.message.includes('composedPath') ||
          error.message.includes('undefined is not an object'))
      ) {
        console.error('🚨 捕获到严重的 composedPath 错误:', error);

        // 直接显示致命错误弹窗，要求用户手动刷新
        showFatalError({
          title: '播放器遇到严重错误',
          message: '播放器事件处理出现问题，无法继续播放',
          suggestion: '请点击下方按钮刷新页面以恢复正常播放',
          error: error,
          enableCleanup: true,
          refreshTimeout: 3000,
          showFallbackButton: true,
        });

        // 阻止错误继续传播
        event.preventDefault();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;

      // 检测 composedPath 相关错误
      if (
        error &&
        error.message &&
        (error.message.includes('composedPath') ||
          error.message.includes('undefined is not an object'))
      ) {
        console.error('🚨 捕获到 composedPath Promise 拒绝:', error);

        // 直接显示致命错误弹窗
        showFatalError({
          title: '播放器遇到严重错误',
          message: '播放器事件处理出现问题，无法继续播放',
          suggestion: '请点击下方按钮刷新页面以恢复正常播放',
          error: error,
          enableCleanup: true,
          refreshTimeout: 3000,
          showFallbackButton: true,
        });

        // 阻止错误继续传播
        event.preventDefault();
      }

      // 检测 URL 类型错误
      if (
        error &&
        error.message &&
        (error.message.includes('option.url') ||
          error.message.includes('require') ||
          error.message.includes('string') ||
          error.message.includes('number'))
      ) {
        console.error('🚨 捕获到 URL 类型错误:', error, {
          timestamp: new Date().toISOString(),
          errorMessage: error.message,
          errorStack: error.stack,
        });

        // 显示致命错误弹窗
        showFatalError({
          title: '播放源数据错误',
          message: '播放源URL格式不正确，无法继续播放',
          suggestion: '请刷新页面重试或联系管理员',
          error: error,
          enableCleanup: true,
          refreshTimeout: 3000,
          showFallbackButton: true,
        });

        // 阻止错误继续传播
        event.preventDefault();
      }
    };

    // 注册全局错误监听器
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 开发模式：添加全局测试函数
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.testFatalError = () => {
        console.log('🧪 触发测试：模拟 composedPath 错误');
        const testError = new Error(
          "undefined is not an object (evaluating 'e.composedPath')"
        );
        testError.stack = `Error: undefined is not an object (evaluating 'e.composedPath')
    at HTMLDivElement.handleClick (play/page.tsx:2500:15)
    at HTMLDivElement.dispatch (artplayer.js:1234:20)`;

        // 触发全局错误
        setTimeout(() => {
          throw testError;
        }, 0);
      };

      console.log(
        '💡 开发提示：在控制台输入 window.testFatalError() 可以测试致命错误弹窗'
      );
    }

    // 检查是否需要恢复用户控制的监控
    if (performanceMonitor.shouldRestoreMonitoring()) {
      console.log('恢复用户控制的监控状态');
      performanceMonitor.startRealTimeMonitoring(true);
    } else {
      // 启动自动监控（非用户控制）
      performanceMonitor.startRealTimeMonitoring(false);
    }

    // 组件卸载时清理
    return () => {
      // 移除全局错误监听器
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection
      );

      // 清理播放器事件处理器
      cleanupPlayerEvents();

      // 只停止非用户控制的监控
      const status = performanceMonitor.getMonitoringStatus();
      if (!status.isUserControlled) {
        performanceMonitor.stopRealTimeMonitoring();
      }
    };
  }, []);

  // -----------------------------------------------------------------------------
  // 状态变量（State）
  // -----------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<
    'searching' | 'preferring' | 'fetching' | 'ready'
  >('searching');
  const [loadingMessage, setLoadingMessage] = useState('正在搜索播放源...');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SearchResult | null>(null);

  // 收藏状态
  const [favorited, setFavorited] = useState(false);

  // 去广告开关（从 localStorage 继承，默认 true）
  const [blockAdEnabled, _setBlockAdEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('enable_blockad');
      if (v !== null) return v === 'true';
    }
    return true;
  });
  const blockAdEnabledRef = useRef(blockAdEnabled);
  useEffect(() => {
    blockAdEnabledRef.current = blockAdEnabled;
  }, [blockAdEnabled]);

  // 视频基本信息
  const [videoTitle, setVideoTitle] = useState(searchParams.get('title') || '');
  const [videoYear, setVideoYear] = useState(searchParams.get('year') || '');
  const [videoCover, setVideoCover] = useState('');
  const returnAnchorRef = useRef<string | null>(searchParams.get('sanchor'));
  // 当前源和ID
  const [currentSource, setCurrentSource] = useState(
    searchParams.get('source') || ''
  );
  const [currentId, setCurrentId] = useState(searchParams.get('id') || '');

  // 搜索所需信息
  const [searchTitle] = useState(searchParams.get('stitle') || '');
  const [searchType] = useState(searchParams.get('stype') || '');

  // 是否需要优选
  const [needPrefer, setNeedPrefer] = useState(
    searchParams.get('prefer') === 'true'
  );
  const needPreferRef = useRef(needPrefer);
  useEffect(() => {
    needPreferRef.current = needPrefer;
  }, [needPrefer]);
  // 集数相关
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);

  const currentSourceRef = useRef(currentSource);
  const currentIdRef = useRef(currentId);
  const videoTitleRef = useRef(videoTitle);
  const videoYearRef = useRef(videoYear);
  const detailRef = useRef<SearchResult | null>(detail);
  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);

  // 同步最新值到 refs
  useEffect(() => {
    currentSourceRef.current = currentSource;
    currentIdRef.current = currentId;
    detailRef.current = detail;
    currentEpisodeIndexRef.current = currentEpisodeIndex;
    videoTitleRef.current = videoTitle;
    videoYearRef.current = videoYear;
  }, [
    currentSource,
    currentId,
    detail,
    currentEpisodeIndex,
    videoTitle,
    videoYear,
  ]);

  // 视频播放地址
  const [videoUrl, setVideoUrl] = useState('');

  // 总集数
  const totalEpisodes = detail?.episodes?.length || 0;

  // 用于记录是否需要在播放器 ready 后跳转到指定进度
  const resumeTimeRef = useRef<number | null>(null);
  // 上次使用的音量，默认 0.7
  const lastVolumeRef = useRef<number>(0.7);

  // 换源相关状态
  const [availableSources, setAvailableSources] = useState<SearchResult[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [sourceSearchError, setSourceSearchError] = useState<string | null>(
    null
  );
  const [isTestingAllSources, setIsTestingAllSources] = useState(false);

  // 优选和测速开关
  const [optimizationEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enableOptimization');
      if (saved !== null) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return true;
  });

  // 保存优选时的测速结果，避免EpisodeSelector重复测速
  const [precomputedVideoInfo, setPrecomputedVideoInfo] = useState<
    Map<string, { quality: string; loadSpeed: string; pingTime: number }>
  >(new Map());

  // 折叠状态（仅在 lg 及以上屏幕有效）
  const [isEpisodeSelectorCollapsed, setIsEpisodeSelectorCollapsed] =
    useState(false);

  // 换源加载状态
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoLoadingStage, setVideoLoadingStage] = useState<
    'initing' | 'sourceChanging'
  >('initing');

  // HLS错误状态
  const [hlsErrorCount, setHlsErrorCount] = useState(0);
  const [showHlsErrorTip, setShowHlsErrorTip] = useState(false);
  const [hlsErrorDetails, setHlsErrorDetails] = useState<{
    type: string;
    message: string;
    suggestion: string;
  } | null>(null);

  // 增强的提示冷却机制
  const [lastNotificationTime, setLastNotificationTime] = useState(0);
  const [hasShownRecoveryNotification, setHasShownRecoveryNotification] =
    useState(false);
  const [lastErrorTime, setLastErrorTime] = useState(0);
  const [consecutiveErrorCount, setConsecutiveErrorCount] = useState(0);

  // 防抖相关
  const notificationDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const errorDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 动态冷却时间：根据错误频率调整
  const getNotificationCooldown = () => {
    if (consecutiveErrorCount > 5) return 30000; // 30秒
    if (consecutiveErrorCount > 3) return 20000; // 20秒
    return 15000; // 15秒
  };

  // 网络状态监控
  const [networkStatus, setNetworkStatus] = useState<
    'online' | 'offline' | 'unstable'
  >('online');
  const networkRetryCountRef = useRef<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const lastNetworkCheckRef = useRef<number>(0);

  // 网络质量监测
  const [_networkQuality, setNetworkQuality] = useState<
    'excellent' | 'good' | 'fair' | 'poor'
  >('good');
  const networkQualityRef = useRef<'excellent' | 'good' | 'fair' | 'poor'>(
    'good'
  );

  // 网络状态检测和恢复
  useEffect(() => {
    let networkCheckInterval: NodeJS.Timeout | null = null;
    let networkRecoveryInterval: NodeJS.Timeout | null = null;

    const checkNetworkStability = async () => {
      try {
        const start = Date.now();
        // 优化超时时间到5秒，提高响应速度
        await fetch('/api/server-config', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000),
        });
        const latency = Date.now() - start;

        // 根据延迟调整网络状态
        if (latency > 5000) {
          setNetworkStatus('unstable');
        } else if (latency > 2000) {
          setNetworkStatus('unstable');
        } else {
          setNetworkStatus('online');
          networkRetryCountRef.current = 0;
        }

        // 更新最后一次检查时间
        lastNetworkCheckRef.current = Date.now();
      } catch (error) {
        setNetworkStatus('offline');
        networkRetryCountRef.current++;

        // 网络离线时暂停播放器以节省带宽
        if (artPlayerRef.current && !artPlayerRef.current.paused) {
          console.warn('网络连接丢失，暂停播放');
          artPlayerRef.current.pause();
        }
      }
    };

    const handleOnline = () => {
      console.log('网络连接恢复');
      setNetworkStatus('online');
      networkRetryCountRef.current = 0;

      // 网络恢复时尝试恢复播放
      if (artPlayerRef.current && artPlayerRef.current.paused) {
        setTimeout(() => {
          if (artPlayerRef.current) {
            // 在网络恢复后，先检查HLS状态再尝试播放
            const hls = artPlayerRef.current.video?.hls;
            if (hls) {
              // 重新开始加载
              hls.startLoad();
            }

            artPlayerRef.current.play().catch(() => {
              console.warn('网络恢复后自动播放失败');
            });
          }
        }, 1000);
      }
    };

    const handleOffline = () => {
      console.warn('网络连接断开');
      setNetworkStatus('offline');

      // 暂停播放器
      if (artPlayerRef.current && !artPlayerRef.current.paused) {
        artPlayerRef.current.pause();
      }

      // 增加错误计数以触发恢复机制
      setHlsErrorCount((prev) => prev + 1);
    };

    // 监听网络状态变化
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 定期检查网络稳定性（减少到30秒，避免过度检查）
    networkCheckInterval = setInterval(checkNetworkStability, 30000);

    // 网络恢复监控（每5秒检查一次）
    networkRecoveryInterval = setInterval(() => {
      // 只在网络不稳定或离线时进行恢复检查
      if (networkStatus === 'offline' || networkStatus === 'unstable') {
        // 尝试通过加载一个小资源来检测网络是否恢复
        fetch('/api/server-config', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000),
        })
          .then(() => {
            // 网络似乎已恢复
            console.log('检测到网络可能已恢复');
            setNetworkStatus('online');
            networkRetryCountRef.current = 0;

            // 尝试恢复播放
            if (artPlayerRef.current && artPlayerRef.current.paused) {
              setTimeout(() => {
                if (artPlayerRef.current) {
                  const hls = artPlayerRef.current.video?.hls;
                  if (hls) {
                    hls.startLoad();
                  }

                  artPlayerRef.current.play().catch(() => {
                    console.warn('网络恢复后自动播放失败');
                  });
                }
              }, 500);
            }
          })
          .catch(() => {
            // 网络仍然不可用，保持当前状态
          });
      }
    }, 5000);

    // 初始检查
    checkNetworkStability();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (networkCheckInterval) {
        clearInterval(networkCheckInterval);
      }
      if (networkRecoveryInterval) {
        clearInterval(networkRecoveryInterval);
      }
    };
  }, [networkStatus]);

  // 网络质量检测和调整
  const checkNetworkQuality = useCallback(async () => {
    try {
      // 测试下载速度
      const testUrl = '/api/server-config'; // 使用一个较小的API端点测试网络
      const startTime = performance.now();

      // 并行发送多个请求以更好地测试网络
      const requests = Array(3)
        .fill(null)
        .map(() =>
          fetch(testUrl, {
            method: 'HEAD',
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000),
          })
        );

      await Promise.all(requests);

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgDuration = duration / 3; // 平均响应时间
      const latency = avgDuration; // 使用平均响应时间作为延迟
      const bandwidth = 1000000; // 默认带宽估算，后续可以基于实际测试优化

      // 根据响应时间判断网络质量
      let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
      if (avgDuration < 200) {
        quality = 'excellent';
      } else if (avgDuration < 500) {
        quality = 'good';
      } else if (avgDuration < 1000) {
        quality = 'fair';
      } else {
        quality = 'poor';
      }

      setNetworkQuality(quality);
      networkQualityRef.current = quality;

      // 将网络质量数据传递给性能监控系统
      performanceMonitor.recordNetworkQuality({
        latency: latency,
        bandwidth: bandwidth,
        packetLoss: 0, // 暂时设为0，后续可以添加丢包检测
        jitter: 0, // 暂时设为0，后续可以添加抖动检测
        quality: quality,
      });

      // 更新自动源切换器的网络质量
      if (autoSourceSwitcherRef.current) {
        autoSourceSwitcherRef.current.updateNetworkQuality(quality);
      }

      // 根据网络质量调整播放器配置
      if (artPlayerRef.current?.video?.hls) {
        const hls = artPlayerRef.current.video.hls;

        switch (quality) {
          case 'excellent':
            // 网络优秀时，增加缓冲以提供更流畅的体验
            hls.config.maxBufferLength = 120;
            hls.config.maxBufferSize = 150 * 1000 * 1000;
            break;
          case 'good':
            // 网络良好时，保持标准缓冲
            hls.config.maxBufferLength = 60;
            hls.config.maxBufferSize = 100 * 1000 * 1000;
            break;
          case 'fair':
            // 网络一般时，适度减少缓冲
            hls.config.maxBufferLength = 30;
            hls.config.maxBufferSize = 60 * 1000 * 1000;
            break;
          case 'poor':
            // 网络较差时，最小化缓冲以减少延迟
            hls.config.maxBufferLength = 15;
            hls.config.maxBufferSize = 30 * 1000 * 1000;
            break;
        }
      }

      return quality;
    } catch (error) {
      // 网络测试失败，认为网络质量较差
      setNetworkQuality('poor');
      networkQualityRef.current = 'poor';

      // 调整播放器配置
      if (artPlayerRef.current?.video?.hls) {
        const hls = artPlayerRef.current.video.hls;
        hls.config.maxBufferLength = 15;
        hls.config.maxBufferSize = 30 * 1000 * 1000;
      }

      return 'poor';
    }
  }, []);

  // 网络质量检测定时器引用
  const networkQualityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const networkMonitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(true);

  // 页面可见性检测
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);

      // 当页面变为不可见时，暂停网络监控
      if (!visible) {
        console.log('页面不可见，暂停网络监控');
        // 清理网络监控定时器
        if (networkQualityIntervalRef.current) {
          clearInterval(networkQualityIntervalRef.current);
          networkQualityIntervalRef.current = null;
        }
        if (networkMonitorIntervalRef.current) {
          clearInterval(networkMonitorIntervalRef.current);
          networkMonitorIntervalRef.current = null;
        }
      } else {
        console.log('页面可见，恢复网络监控');
        // 页面变为可见时，重新启动网络质量检测
        if (!networkQualityIntervalRef.current) {
          checkNetworkQuality();
          networkQualityIntervalRef.current = setInterval(
            checkNetworkQuality,
            30000
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkNetworkQuality]);

  // 定期检测网络质量
  useEffect(() => {
    // 只在页面可见时进行检测
    if (!isPageVisible) return;

    // 初始检测
    checkNetworkQuality();

    // 每30秒检测一次网络质量
    networkQualityIntervalRef.current = setInterval(checkNetworkQuality, 30000);

    return () => {
      if (networkQualityIntervalRef.current) {
        clearInterval(networkQualityIntervalRef.current);
        networkQualityIntervalRef.current = null;
      }
    };
  }, [checkNetworkQuality, isPageVisible]);

  // 网络恢复时的智能调整
  useEffect(() => {
    // 当网络状态从离线或不稳定变为在线时
    if (
      networkStatus === 'online' &&
      (networkQualityRef.current === 'fair' ||
        networkQualityRef.current === 'poor')
    ) {
      // 检查网络质量是否有所改善
      const checkAndAdjust = async () => {
        const quality = await checkNetworkQuality();
        if (quality === 'good' || quality === 'excellent') {
          console.log('网络恢复且质量改善，调整播放策略');

          // 如果播放器暂停，尝试恢复播放
          if (artPlayerRef.current && artPlayerRef.current.paused) {
            setTimeout(() => {
              if (artPlayerRef.current) {
                const hls = artPlayerRef.current.video?.hls;
                if (hls) {
                  hls.startLoad();
                }

                artPlayerRef.current.play().catch(() => {
                  console.warn('网络恢复后自动播放失败');
                });
              }
            }, 500);
          }
        }
      };

      checkAndAdjust();
    }
  }, [networkStatus, checkNetworkQuality]);

  // 优化的错误提示防抖逻辑
  useEffect(() => {
    if (hlsErrorCount > 0) {
      const now = Date.now();
      const cooldown = getNotificationCooldown();

      // 检查是否在冷却期内
      if (now - lastNotificationTime < cooldown) {
        return;
      }

      // 清除之前的防抖定时器
      if (notificationDebounceRef.current) {
        clearTimeout(notificationDebounceRef.current);
      }

      // 使用防抖机制，避免频繁提示
      notificationDebounceRef.current = setTimeout(() => {
        // 再次检查冷却期，防止在防抖期间状态变化
        const currentTime = Date.now();
        if (currentTime - lastNotificationTime < cooldown) {
          return;
        }

        // 智能错误阈值：根据错误类型和频率决定是否显示
        const shouldShowNotification =
          (hlsErrorCount >= 3 && consecutiveErrorCount >= 2) || // 连续错误且总数达到阈值
          hlsErrorDetails?.type === '播放失败' || // 播放失败总是显示
          hlsErrorDetails?.type === '网络连接错误' || // 网络错误总是显示
          hlsErrorDetails?.type === '媒体解码错误' || // 媒体错误总是显示
          hlsErrorCount >= 5; // 错误次数过多时显示

        if (!shouldShowNotification) {
          return;
        }

        setShowHlsErrorTip(true);
        setLastNotificationTime(currentTime);

        // 根据错误严重程度和频率设置显示时间
        let displayTime = 4000; // 基础显示时间
        if (hlsErrorCount > 8) {
          displayTime = 10000; // 错误过多时显示更久
        } else if (hlsErrorCount > 5) {
          displayTime = 7000;
        }

        if (hlsErrorDetails?.type === '播放失败') {
          displayTime = 12000; // 播放失败显示12秒
        }

        const timer = setTimeout(() => {
          setShowHlsErrorTip(false);
          // 延迟清除错误详情，避免闪烁
          setTimeout(() => {
            setHlsErrorDetails(null);
          }, 300);
        }, displayTime);

        return () => clearTimeout(timer);
      }, 1000); // 1秒防抖延迟
    }
  }, [
    hlsErrorCount,
    hlsErrorDetails,
    lastNotificationTime,
    consecutiveErrorCount,
  ]);

  // 播放进度保存相关
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  const saveProgressDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 清理所有定时器的函数
  const cleanupTimers = () => {
    if (notificationDebounceRef.current) {
      clearTimeout(notificationDebounceRef.current);
      notificationDebounceRef.current = null;
    }
    if (errorDebounceRef.current) {
      clearTimeout(errorDebounceRef.current);
      errorDebounceRef.current = null;
    }
    if (saveProgressDebounceRef.current) {
      clearTimeout(saveProgressDebounceRef.current);
      saveProgressDebounceRef.current = null;
    }
  };
  // 拖拽后的短冷却时间戳（毫秒），在此之前跳过 heavy 逻辑，避免卡顿
  const seekCooldownUntilRef = useRef<number>(0);

  // 播放恢复相关
  const playbackRecoveryRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlayTimeRef = useRef<number>(0);
  const stuckCountRef = useRef<number>(0);
  // 更稳健的卡死检测：记录上次检查时间与媒体时间
  const lastProgressCheckTsRef = useRef<number>(0);
  const lastMediaTimeForStallRef = useRef<number>(0);

  const artPlayerRef = useRef<any>(null);
  const artRef = useRef<HTMLDivElement | null>(null);

  // 播放器重建防抖
  const rebuildTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 智能源切换器
  const sourceSwitcherRef = useRef<SmartSourceSwitcher | null>(null);

  // 自动源切换器（新）
  const autoSourceSwitcherRef = useRef<AutoSourceSwitcher | null>(null);

  // 源切换冷却期管理
  const lastSourceSwitchTimeRef = useRef<number>(0);
  const sourceLoadStartTimeRef = useRef<number>(0);
  const currentSourceErrorCountRef = useRef<number>(0);
  const SOURCE_SWITCH_COOLDOWN = 10000; // 10秒冷却期，给每个源足够的加载时间
  const SOURCE_ERROR_THRESHOLD = 3; // 当前源连续3次错误才切换

  // 源切换状态跟踪
  const triedSourcesRef = useRef<Set<string>>(new Set()); // 已尝试的源
  const [allSourcesFailed, setAllSourcesFailed] = useState(false); // 所有源都失败了
  const currentSourceIndexRef = useRef<number>(0); // 当前尝试的源索引（基于availableSources）

  // 播放器控制（全屏 / 音量 / 倍速）
  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.7;
    try {
      const v = localStorage.getItem('player_volume');
      const parsed = v != null ? parseFloat(v) : NaN;
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
        ? parsed
        : 0.7;
    } catch {
      return 0.7;
    }
  });

  const handleToggleFullscreen = () => {
    const p = artPlayerRef.current;
    if (!p) return;
    try {
      p.fullscreen = !p.fullscreen;
    } catch (e) {
      /* noop */
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleVolumeChange = (delta: number) => {
    const p = artPlayerRef.current;
    if (!p) return;
    const next = Math.max(0, Math.min(1, (p.volume || 0) + delta));
    p.volume = next;
    setVolume(next);
    try {
      localStorage.setItem('player_volume', String(next));
    } catch {
      /* noop */
    }
    const notice = (p as any).notice;
    if (notice && typeof notice.show === 'function') {
      notice.show(`音量: ${Math.round(next * 100)}`);
    }
  };

  const handleSpeedCycle = () => {
    const p = artPlayerRef.current;
    if (!p) return;
    const idx = speedOptions.findIndex(
      (v) => Math.abs(v - (playbackRate || 1)) < 0.0001
    );
    const next = speedOptions[(idx + 1) % speedOptions.length];
    try {
      p.playbackRate = next;
      setPlaybackRate(next);
      const notice = (p as any).notice;
      if (notice && typeof notice.show === 'function') {
        notice.show(`倍速: ${next}x`);
      }
    } catch (e) {
      /* noop */
    }
  };

  // PiP 状态管理
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [pipApiType, setPipApiType] = useState<'webkit' | 'standard' | 'none'>(
    'none'
  );

  // 检测 PiP 支持
  useEffect(() => {
    const checkPiPSupport = () => {
      if (typeof window === 'undefined') return;

      // 使用新的检测工具函数
      const detection = detectPiPSupport();

      setIsPiPSupported(detection.isSupported);
      setPipApiType(detection.apiType);

      // 调试日志
      console.log('[PiP Detection]', {
        isSupported: detection.isSupported,
        apiType: detection.apiType,
        requiresUserGesture: detection.requiresUserGesture,
        browserInfo: detection.browserInfo,
      });
    };

    checkPiPSupport();
  }, []);

  // 监听 PiP 状态变化
  useEffect(() => {
    if (!isPiPSupported) return;

    const handlePiPChange = () => {
      const video = artPlayerRef.current?.video as HTMLVideoElement;
      if (!video) return;

      let newPiPState = false;

      // 根据 API 类型检测状态
      if (pipApiType === 'webkit') {
        // WebKit API 状态检测
        // @ts-ignore
        if (typeof video.webkitPresentationMode !== 'undefined') {
          // @ts-ignore
          newPiPState = video.webkitPresentationMode === 'picture-in-picture';

          // 调试日志
          console.log('[PiP State Change - WebKit]', {
            // @ts-ignore
            mode: video.webkitPresentationMode,
            isActive: newPiPState,
            timestamp: Date.now(),
          });
        }
      } else if (pipApiType === 'standard') {
        // 标准 PiP API 状态检测
        newPiPState = document.pictureInPictureElement === video;

        // 调试日志
        console.log('[PiP State Change - Standard]', {
          pictureInPictureElement: document.pictureInPictureElement,
          isActive: newPiPState,
          timestamp: Date.now(),
        });
      }

      setIsPiPActive(newPiPState);
    };

    const video = artPlayerRef.current?.video as HTMLVideoElement;
    if (video) {
      // 根据 API 类型添加相应的事件监听器
      if (pipApiType === 'webkit') {
        // WebKit 事件监听
        // @ts-ignore
        if (typeof video.webkitpresentationmodechanged !== 'undefined') {
          // @ts-ignore
          video.addEventListener(
            'webkitpresentationmodechanged',
            handlePiPChange
          );
          console.log('[PiP] WebKit event listener added');
        }
      } else if (pipApiType === 'standard') {
        // 标准 PiP 事件监听
        video.addEventListener('enterpictureinpicture', handlePiPChange);
        video.addEventListener('leavepictureinpicture', handlePiPChange);
        console.log('[PiP] Standard event listeners added');
      }

      return () => {
        // 清理事件监听器
        if (pipApiType === 'webkit') {
          // @ts-ignore
          video.removeEventListener(
            'webkitpresentationmodechanged',
            handlePiPChange
          );
        } else if (pipApiType === 'standard') {
          video.removeEventListener('enterpictureinpicture', handlePiPChange);
          video.removeEventListener('leavepictureinpicture', handlePiPChange);
        }
        console.log('[PiP] Event listeners cleaned up');
      };
    }
  }, [isPiPSupported, pipApiType, artPlayerRef.current]);

  // 画中画切换
  const handleTogglePictureInPicture = async () => {
    const startTime = Date.now();

    try {
      const p = artPlayerRef.current;
      if (!p || !p.video) {
        console.warn('[PiP] Player or video not available');
        return;
      }

      const video = p.video as HTMLVideoElement;
      const notice = (p as any).notice;

      // 记录调试信息
      console.log('[PiP Toggle] Starting', {
        apiType: pipApiType,
        readyState: video.readyState,
        paused: video.paused,
        currentTime: video.currentTime,
        timestamp: startTime,
      });

      // iOS Safari / WebKit 专用处理
      // 重要：iOS Safari 要求 PiP 必须在用户手势的同步调用栈中触发，不能有任何 await，
      // 否则用户手势上下文丢失会导致 webkitSetPresentationMode 静默失败。
      if (pipApiType === 'webkit') {
        // 在实际 video 上再次确认 API 存在（HLS 等场景下可能与检测时不一致）
        const setMode = (
          video as HTMLVideoElement & {
            webkitSetPresentationMode?: (mode: string) => void;
          }
        ).webkitSetPresentationMode;
        if (typeof setMode !== 'function') {
          console.error('[PiP] WebKit API not available on this video');
          if (notice && typeof notice.show === 'function') {
            notice.show('当前环境不支持画中画');
          }
          return;
        }

        const minReadyState = getRecommendedReadyState(pipApiType);

        // 不等待：若视频未就绪则直接提示并返回，避免 await 导致用户手势丢失
        if (video.readyState < minReadyState) {
          console.log('[PiP] Video not ready (sync check)', {
            currentReadyState: video.readyState,
            minReadyState,
          });
          if (notice && typeof notice.show === 'function') {
            notice.show('视频加载中，请稍后再试');
          }
          return;
        }

        const currentMode = (
          video as HTMLVideoElement & { webkitPresentationMode?: string }
        ).webkitPresentationMode;
        const targetMode =
          currentMode === 'picture-in-picture'
            ? 'inline'
            : 'picture-in-picture';

        console.log('[PiP] WebKit mode change', {
          currentMode,
          targetMode,
          readyState: video.readyState,
        });

        setMode.call(video, targetMode);

        if (notice && typeof notice.show === 'function') {
          notice.show(
            targetMode === 'picture-in-picture' ? '进入画中画' : '退出画中画'
          );
        }

        console.log('[PiP] WebKit toggle completed', {
          duration: Date.now() - startTime,
        });

        return;
      }

      // 标准 PiP API 处理
      if (pipApiType === 'standard') {
        if (!document.pictureInPictureEnabled) {
          console.error('[PiP] Standard API not enabled');
          if (notice && typeof notice.show === 'function') {
            notice.show('当前浏览器不支持画中画');
          }
          return;
        }

        // 获取推荐的就绪状态
        const minReadyState = getRecommendedReadyState(pipApiType);

        // 退出画中画
        if (document.pictureInPictureElement) {
          console.log('[PiP] Exiting picture-in-picture');

          await (document as any).exitPictureInPicture?.();

          if (notice && typeof notice.show === 'function') {
            notice.show('退出画中画');
          }

          console.log('[PiP] Standard exit completed', {
            duration: Date.now() - startTime,
          });

          return;
        }

        // 进入画中画
        // 检查视频就绪状态
        if (video.readyState < minReadyState) {
          console.log('[PiP] Video not ready, waiting...', {
            currentReadyState: video.readyState,
            minReadyState,
          });

          if (notice && typeof notice.show === 'function') {
            notice.show('视频加载中，请稍候...');
          }

          try {
            await waitForVideoReady(video, {
              minReadyState,
              timeout: 5000,
            });
          } catch (waitError) {
            console.error('[PiP] Video ready timeout', waitError);
            if (notice && typeof notice.show === 'function') {
              notice.show('视频未就绪，请稍后再试');
            }
            return;
          }
        }

        console.log('[PiP] Entering picture-in-picture', {
          readyState: video.readyState,
        });

        await (video as any).requestPictureInPicture?.();

        if (notice && typeof notice.show === 'function') {
          notice.show('进入画中画');
        }

        console.log('[PiP] Standard enter completed', {
          duration: Date.now() - startTime,
        });

        return;
      }

      // 不支持画中画
      console.warn('[PiP] Picture-in-picture not supported');
      if (notice && typeof notice.show === 'function') {
        notice.show('当前浏览器不支持画中画');
      }
    } catch (e: any) {
      const duration = Date.now() - startTime;

      // 详细的错误分类和处理
      let errorMessage = '切换画中画失败';
      let errorCode = 'UNKNOWN';

      if (e.name === 'NotAllowedError') {
        errorCode = 'NOT_ALLOWED';
        errorMessage = '请直接点击按钮进入画中画';
        console.error('[PiP] NotAllowedError - User gesture required', {
          error: e,
          duration,
        });
      } else if (e.name === 'InvalidStateError') {
        errorCode = 'INVALID_STATE';
        errorMessage = '视频状态异常，请重试';
        console.error('[PiP] InvalidStateError - Video not ready', {
          error: e,
          duration,
        });
      } else if (e.name === 'NotSupportedError') {
        errorCode = 'NOT_SUPPORTED';
        errorMessage = '当前视频格式不支持画中画';
        console.error('[PiP] NotSupportedError - Format not supported', {
          error: e,
          duration,
        });
      } else if (e.message && e.message.includes('timeout')) {
        errorCode = 'TIMEOUT';
        errorMessage = '视频加载超时，请重试';
        console.error('[PiP] Timeout error', {
          error: e,
          duration,
        });
      } else {
        console.error('[PiP] Unknown error', {
          error: e,
          name: e.name,
          message: e.message,
          duration,
        });
      }

      // 显示用户友好的错误提示
      const p = artPlayerRef.current as any;
      const notice = p?.notice;
      if (notice && typeof notice.show === 'function') {
        notice.show(errorMessage);
      }

      // 记录错误到控制台（生产环境也保留，便于用户反馈问题）
      console.error('[PiP Error Summary]', {
        errorCode,
        errorMessage,
        apiType: pipApiType,
        duration,
        error: e,
      });
    }
  };

  // -----------------------------------------------------------------------------
  // 工具函数（Utils）
  // -----------------------------------------------------------------------------

  // 优化的播放源优选函数
  const preferBestSource = async (
    sources: SearchResult[]
  ): Promise<SearchResult> => {
    if (sources.length === 1) return sources[0];

    console.log(`开始优化源选择，共 ${sources.length} 个源`);

    // 提取所有有效的播放地址
    const validSources: Array<{ source: SearchResult; episodeUrl: string }> =
      [];

    sources.forEach((source) => {
      if (source.episodes && source.episodes.length > 0) {
        const episodeUrl =
          source.episodes.length > 1 ? source.episodes[1] : source.episodes[0];
        validSources.push({ source, episodeUrl });
      } else {
        console.warn(`播放源 ${source.source_name} 没有可用的播放地址`);
      }
    });

    if (validSources.length === 0) {
      console.warn('没有找到有效的播放源');
      return sources[0];
    }

    try {
      // 记录源测试开始时间
      const testStartTime = performance.now();

      // 使用快速源测试器进行优选（启用CDN优化）
      const fastResults = await fastPreferSources(validSources, 3, true);

      const testEndTime = performance.now();

      // 记录源测试时间
      performanceMonitor.recordSourceTestTime(testEndTime - testStartTime);

      if (fastResults.length === 0) {
        console.warn('快速测试没有找到可用源，使用第一个播放源');
        return sources[0];
      }

      // 保存快速测试结果到 precomputedVideoInfo
      const newVideoInfoMap = new Map<
        string,
        {
          quality: string;
          loadSpeed: string;
          pingTime: number;
          hasError?: boolean;
          cdnOptimized?: boolean;
          cdnInfo?: any;
        }
      >();

      fastResults.forEach(({ source, testResult }) => {
        const sourceKey = `${source.source}-${source.id}`;
        newVideoInfoMap.set(sourceKey, {
          quality: testResult.quality || '未知',
          loadSpeed: testResult.loadSpeed || '未知',
          pingTime: testResult.pingTime,
          hasError: !testResult.available,
          cdnOptimized: testResult.cdnOptimized,
          cdnInfo: testResult.cdnInfo,
        });
      });

      setPrecomputedVideoInfo(newVideoInfoMap);

      // 选择评分最高的源
      const bestResult = fastResults[0];
      const cdnInfo = bestResult.testResult.cdnOptimized
        ? ` (CDN优化: ${bestResult.testResult.cdnInfo?.cdnNode.name})`
        : '';
      console.log(
        `快速选择最佳播放源: ${bestResult.source.source_name} (评分: ${bestResult.testResult.score})${cdnInfo}`
      );
      return bestResult.source;
    } catch (error) {
      console.warn('快速源测试失败，使用第一个播放源:', error);
      return sources[0];
    }
  };

  // 一键测速所有源并按延迟选出最佳源（实现定义放在 handleSourceChange 之后）

  // 更新视频地址
  const updateVideoUrl = async (
    detailData: SearchResult | null,
    episodeIndex: number
  ) => {
    if (
      !detailData ||
      !detailData.episodes ||
      episodeIndex >= detailData.episodes.length
    ) {
      setVideoUrl('');
      return;
    }
    const newUrl = detailData?.episodes[episodeIndex] || '';
    if (newUrl !== videoUrl) {
      // 立即设置URL，不等待预加载
      setVideoUrl(newUrl);

      // 异步预加载，不阻塞播放
      setTimeout(async () => {
        try {
          console.log('异步预加载视频源:', newUrl);
          const preloadSuccess = await preloadHlsResource(newUrl, 2000);
          if (preloadSuccess) {
            console.log('视频源预加载成功');
          } else {
            console.warn('视频源预加载失败');
          }
        } catch (error) {
          console.warn('视频源预加载出错:', error);
        }
      }, 100);
    }
  };

  const ensureVideoSource = (video: HTMLVideoElement | null, url: string) => {
    if (!video || !url) return;
    const sources = Array.from(video.getElementsByTagName('source'));
    const existed = sources.some((s) => s.src === url);
    if (!existed) {
      // 移除旧的 source，保持唯一
      sources.forEach((s) => s.remove());
      const sourceEl = document.createElement('source');
      sourceEl.src = url;
      video.appendChild(sourceEl);
    }

    // 始终允许远程播放（AirPlay / Cast）
    video.disableRemotePlayback = false;
    // 如果曾经有禁用属性，移除之
    if (video.hasAttribute('disableRemotePlayback')) {
      video.removeAttribute('disableRemotePlayback');
    }
  };

  // 去广告相关函数
  function filterAdsFromM3U8(m3u8Content: string): string {
    if (!m3u8Content) return '';

    // 按行分割M3U8内容
    const lines = m3u8Content.split('\n');
    const filteredLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 只过滤#EXT-X-DISCONTINUITY标识
      if (!line.includes('#EXT-X-DISCONTINUITY')) {
        filteredLines.push(line);
      }
    }

    return filteredLines.join('\n');
  }

  class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
    constructor(config: any) {
      super(config);
      const load = this.load.bind(this);
      this.load = function (context: any, config: any, callbacks: any) {
        // 拦截manifest和level请求
        if (
          (context as any).type === 'manifest' ||
          (context as any).type === 'level'
        ) {
          const onSuccess = callbacks.onSuccess;
          callbacks.onSuccess = function (
            response: any,
            stats: any,
            context: any
          ) {
            // 如果是m3u8文件，处理内容以移除广告分段
            if (response.data && typeof response.data === 'string') {
              // 过滤掉广告段 - 实现更精确的广告过滤逻辑
              response.data = filterAdsFromM3U8(response.data);
            }
            return onSuccess(response, stats, context, null);
          };
        }
        // 执行原始load方法
        load(context, config, callbacks);
      };
    }
  }

  // 当集数索引变化时自动更新视频地址
  useEffect(() => {
    updateVideoUrl(detail, currentEpisodeIndex);
  }, [detail, currentEpisodeIndex]);

  // 进入页面时直接获取全部源信息
  useEffect(() => {
    const fetchSourceDetail = async (
      source: string,
      id: string
    ): Promise<SearchResult[]> => {
      try {
        const detailResponse = await fetch(
          `/api/detail?source=${source}&id=${id}`
        );
        if (!detailResponse.ok) {
          throw new Error('获取视频详情失败');
        }
        const detailData = (await detailResponse.json()) as SearchResult;
        setAvailableSources([detailData]);
        return [detailData];
      } catch (err) {
        console.error('获取视频详情失败:', err);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };
    const fetchSourcesData = async (query: string): Promise<SearchResult[]> => {
      // 根据搜索词获取全部源信息
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        );
        if (!response.ok) {
          throw new Error('搜索失败');
        }
        const data = await response.json();

        // 处理搜索结果，根据规则过滤
        const results = data.results.filter(
          (result: SearchResult) =>
            result.title.replaceAll(' ', '').toLowerCase() ===
              videoTitleRef.current.replaceAll(' ', '').toLowerCase() &&
            (videoYearRef.current
              ? result.year.toLowerCase() === videoYearRef.current.toLowerCase()
              : true) &&
            (searchType
              ? (searchType === 'tv' && result.episodes.length > 1) ||
                (searchType === 'movie' && result.episodes.length === 1)
              : true)
        );
        setAvailableSources(results);
        return results;
      } catch (err) {
        setSourceSearchError(err instanceof Error ? err.message : '搜索失败');
        setAvailableSources([]);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const initAll = async () => {
      if (!currentSource && !currentId && !videoTitle && !searchTitle) {
        setError('缺少必要参数');
        setLoading(false);

        // 记录错误
        performanceMonitor.recordError();
        performanceMonitor.recordPlayerStatus('error');
        return;
      }

      // 开始性能监控
      performanceMonitor.startSession();
      const sessionStartTime = performance.now();

      setLoading(true);
      setLoadingStage(currentSource && currentId ? 'fetching' : 'searching');
      setLoadingMessage(
        currentSource && currentId
          ? '🎬 正在获取视频详情...'
          : '🔍 正在搜索播放源...'
      );

      // 记录源搜索开始时间
      const searchStartTime = performance.now();
      let sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);
      const searchEndTime = performance.now();

      // 记录源搜索时间
      performanceMonitor.recordSourceSearchTime(
        searchEndTime - searchStartTime
      );
      if (
        currentSource &&
        currentId &&
        !sourcesInfo.some(
          (source) => source.source === currentSource && source.id === currentId
        )
      ) {
        sourcesInfo = await fetchSourceDetail(currentSource, currentId);
      }
      if (sourcesInfo.length === 0) {
        setError('未找到匹配结果');
        setLoading(false);

        // 记录错误
        performanceMonitor.recordError();
        performanceMonitor.recordPlayerStatus('error');
        return;
      }

      let detailData: SearchResult = sourcesInfo[0];
      // 指定源和id且无需优选
      if (currentSource && currentId && !needPreferRef.current) {
        const target = sourcesInfo.find(
          (source) => source.source === currentSource && source.id === currentId
        );
        if (target) {
          detailData = target;
        } else {
          setError('未找到匹配结果');
          setLoading(false);
          return;
        }
      }

      // 未指定源和 id 或需要优选，且开启优选开关
      if (
        (!currentSource || !currentId || needPreferRef.current) &&
        optimizationEnabled
      ) {
        setLoadingStage('preferring');
        setLoadingMessage('⚡ 正在优选最佳播放源...');

        // 如果源数量较少，使用超快速选择
        if (sourcesInfo.length <= 3) {
          setLoadingMessage('🚀 正在快速选择播放源...');
          const validSources = sourcesInfo
            .filter((source) => source.episodes && source.episodes.length > 0)
            .map((source) => ({
              source,
              episodeUrl:
                source.episodes.length > 1
                  ? source.episodes[1]
                  : source.episodes[0],
            }));

          // 记录源测试开始时间
          const testStartTime = performance.now();
          const ultraFastResult = await ultraFastSourceSelect(validSources);
          const testEndTime = performance.now();

          // 记录源测试时间
          performanceMonitor.recordSourceTestTime(testEndTime - testStartTime);

          if (ultraFastResult) {
            detailData = ultraFastResult.source;
            setLoadingMessage('✅ 快速选择完成');
          } else {
            setLoadingMessage('⚡ 正在智能优选播放源...');
            detailData = await preferBestSource(sourcesInfo);
          }
        } else {
          setLoadingMessage('⚡ 正在智能优选播放源...');
          // 记录源测试开始时间
          const testStartTime = performance.now();
          detailData = await preferBestSource(sourcesInfo);
          const testEndTime = performance.now();

          // 记录源测试时间
          performanceMonitor.recordSourceTestTime(testEndTime - testStartTime);
        }
      }

      console.log(detailData.source, detailData.id);

      setNeedPrefer(false);
      setCurrentSource(detailData.source);
      setCurrentId(detailData.id);
      setVideoYear(detailData.year);
      setVideoTitle(detailData.title || videoTitleRef.current);
      setVideoCover(detailData.poster);
      setDetail(detailData);
      if (currentEpisodeIndex >= detailData.episodes.length) {
        setCurrentEpisodeIndex(0);
      }

      // 规范URL参数
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', detailData.source);
      newUrl.searchParams.set('id', detailData.id);
      newUrl.searchParams.set('year', detailData.year);
      newUrl.searchParams.set('title', detailData.title);
      newUrl.searchParams.delete('prefer');
      window.history.replaceState({}, '', newUrl.toString());

      setLoadingStage('ready');
      setLoadingMessage('✨ 准备就绪，即将开始播放...');

      // 记录性能指标
      const sessionEndTime = performance.now();
      const totalLoadTime = sessionEndTime - sessionStartTime;

      performanceMonitor.recordTotalLoadTime(totalLoadTime);
      performanceMonitor.recordSourceCount(sourcesInfo.length);
      performanceMonitor.recordSelectedSource(detailData.source_name || '');

      // 记录实时监控数据
      // 检查CDN优化状态：通过检查URL是否包含CDN标识
      const currentUrl = detailData.source_name || '';
      const cdnOptimized =
        currentUrl.includes('cdn') ||
        currentUrl.includes('cloudflare') ||
        currentUrl.includes('fastly');

      // 检查缓存命中：通过检查加载时间是否很短
      const cacheHit = totalLoadTime < 1000; // 如果总加载时间少于1秒，认为可能使用了缓存

      performanceMonitor.recordCurrentSource(
        currentUrl,
        cdnOptimized,
        cacheHit
      );

      const metrics = performanceMonitor.endSession();

      if (metrics) {
        console.log('播放器加载性能指标:', metrics);
        console.log('性能报告:', performanceMonitor.getPerformanceReport());
      }

      // 短暂延迟让用户看到完成状态
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    };

    initAll();
  }, []);

  // 在离开播放页前，仅写入返回锚点，避免覆盖搜索页的滚动位置
  useEffect(() => {
    const markReturn = () => {
      try {
        console.log('[播放页离开] 开始保存返回状态:', {
          returnAnchor: returnAnchorRef.current,
          timestamp: new Date().toISOString(),
        });

        if (returnAnchorRef.current) {
          const saved = localStorage.getItem('searchPageState');
          const parsed = saved ? JSON.parse(saved) : {};
          parsed.anchorKey = returnAnchorRef.current;

          // 不写入 scrollPosition，避免覆盖搜索页点击时保存的准确滚动
          parsed.timestamp = Date.now();

          localStorage.setItem('searchPageState', JSON.stringify(parsed));
          localStorage.setItem('searchReturnTrigger', String(Date.now()));
        } else {
          console.log('[播放页离开] 没有返回锚点，跳过保存');
        }
      } catch (error) {
        console.error('[播放页离开] 保存返回状态失败:', error);
      }
    };

    window.addEventListener('pagehide', markReturn);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        console.log('[播放页离开] 页面隐藏，触发保存');
        markReturn();
      }
    });
    return () => {
      window.removeEventListener('pagehide', markReturn);
      document.removeEventListener('visibilitychange', markReturn);
    };
  }, []);

  // 播放记录处理
  useEffect(() => {
    // 仅在初次挂载时检查播放记录
    const initFromHistory = async () => {
      if (!currentSource || !currentId) return;

      try {
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(currentSource, currentId);
        const record = allRecords[key];

        if (record) {
          const targetIndex = record.index - 1;
          const targetTime = record.play_time;

          // 更新当前选集索引
          if (targetIndex !== currentEpisodeIndex) {
            setCurrentEpisodeIndex(targetIndex);
          }

          // 保存待恢复的播放进度，待播放器就绪后跳转
          resumeTimeRef.current = targetTime;
        }
      } catch (err) {
        console.error('读取播放记录失败:', err);
      }
    };

    initFromHistory();
  }, []);

  // 处理换源
  const handleSourceChange = async (
    newSource: string,
    newId: string,
    newTitle: string
  ) => {
    try {
      // 显示换源加载状态
      setVideoLoadingStage('sourceChanging');
      setIsVideoLoading(true);

      // 记录当前播放进度（仅在同一集数切换时恢复）
      const currentPlayTime = artPlayerRef.current?.currentTime || 0;
      console.log('换源前当前播放时间:', currentPlayTime);

      // 清除前一个历史记录
      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deletePlayRecord(
            currentSourceRef.current,
            currentIdRef.current
          );
          console.log('已清除前一个播放记录');
        } catch (err) {
          console.error('清除播放记录失败:', err);
        }
      }

      const newDetail = availableSources.find(
        (source) => source.source === newSource && source.id === newId
      );
      if (!newDetail) {
        setError('未找到匹配结果');
        return;
      }

      // 尝试跳转到当前正在播放的集数
      let targetIndex = currentEpisodeIndex;

      // 如果当前集数超出新源的范围，则跳转到第一集
      if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) {
        targetIndex = 0;
      }

      // 如果仍然是同一集数且播放进度有效，则在播放器就绪后恢复到原始进度
      if (targetIndex !== currentEpisodeIndex) {
        resumeTimeRef.current = 0;
      } else if (
        (!resumeTimeRef.current || resumeTimeRef.current === 0) &&
        currentPlayTime > 1
      ) {
        resumeTimeRef.current = currentPlayTime;
      }

      // 更新URL参数（不刷新页面）
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', newSource);
      newUrl.searchParams.set('id', newId);
      newUrl.searchParams.set('year', newDetail.year);
      window.history.replaceState({}, '', newUrl.toString());

      setVideoTitle(newDetail.title || newTitle);
      setVideoYear(newDetail.year);
      setVideoCover(newDetail.poster);
      setCurrentSource(newSource);
      setCurrentId(newId);
      setDetail(newDetail);
      setCurrentEpisodeIndex(targetIndex);
    } catch (err) {
      // 隐藏换源加载状态
      setIsVideoLoading(false);
      setError(err instanceof Error ? err.message : '换源失败');
    }
  };

  // 一键测速所有源并按延迟选出最佳源
  const handleTestAllSources = useCallback(async () => {
    if (isTestingAllSources) return;
    if (!availableSources || availableSources.length === 0) return;

    try {
      setIsTestingAllSources(true);

      // 为当前集数构造所有有效源的播放地址
      const validSources: Array<{ source: SearchResult; episodeUrl: string }> =
        [];
      availableSources.forEach((source) => {
        if (!source.episodes || source.episodes.length === 0) return;

        let episodeIndex = currentEpisodeIndex;
        if (episodeIndex >= source.episodes.length) {
          episodeIndex = 0;
        }
        const episodeUrl = source.episodes[episodeIndex];
        if (!episodeUrl) return;

        validSources.push({ source, episodeUrl });
      });

      if (validSources.length === 0) {
        console.warn('一键测速失败：没有有效的播放源');
        return;
      }

      const urls = validSources.map((s) => s.episodeUrl);

      // 批量快速测试所有源延迟
      const testResults = await fastSourceTester.batchQuickTest(urls, true);

      // 将测速结果写入预计算表，供换源列表展示
      const newVideoInfoMap = new Map<
        string,
        {
          quality: string;
          loadSpeed: string;
          pingTime: number;
          hasError?: boolean;
        }
      >();

      testResults.forEach((result, index) => {
        const source = validSources[index]?.source;
        if (!source) return;
        const sourceKey = `${source.source}-${source.id}`;
        newVideoInfoMap.set(sourceKey, {
          quality: result.quality || '未知',
          loadSpeed: result.loadSpeed || '未知',
          pingTime: result.pingTime,
          hasError: !result.available,
        });
      });

      setPrecomputedVideoInfo(newVideoInfoMap);

      // 选择延迟最低且可用的源作为最佳源
      const getPing = (s: SearchResult): number => {
        const info = newVideoInfoMap.get(`${s.source}-${s.id}`);
        if (!info) return Number.MAX_SAFE_INTEGER;
        if (info.hasError) return Number.MAX_SAFE_INTEGER - 1;
        return info.pingTime;
      };

      const bestSource =
        [...availableSources]
          .sort((a, b) => getPing(a) - getPing(b))
          .find((s) => {
            const info = newVideoInfoMap.get(`${s.source}-${s.id}`);
            return info && !info.hasError;
          }) || availableSources[0];

      if (
        bestSource &&
        (bestSource.source !== currentSource || bestSource.id !== currentId)
      ) {
        await handleSourceChange(
          bestSource.source,
          bestSource.id,
          bestSource.title || videoTitle
        );
      }
    } catch (err) {
      console.warn('一键测速所有源失败:', err);
    } finally {
      setIsTestingAllSources(false);
    }
  }, [
    availableSources,
    currentEpisodeIndex,
    currentId,
    currentSource,
    handleSourceChange,
    isTestingAllSources,
    videoTitle,
  ]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 集数切换
  // ---------------------------------------------------------------------------
  // 处理集数切换
  const handleEpisodeChange = (episodeNumber: number) => {
    if (episodeNumber >= 0 && episodeNumber < totalEpisodes) {
      // 在更换集数前保存当前播放进度
      if (artPlayerRef.current && artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(episodeNumber);
    }
  };

  const handlePreviousEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx > 0) {
      if (artPlayerRef.current && !artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(idx - 1);
    }
  };

  const handleNextEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx < d.episodes.length - 1) {
      if (artPlayerRef.current && !artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(idx + 1);
    }
  };

  // ---------------------------------------------------------------------------
  // 键盘快捷键
  // ---------------------------------------------------------------------------
  // 处理全局快捷键
  const handleKeyboardShortcuts = (e: KeyboardEvent) => {
    // 忽略输入框中的按键事件
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    )
      return;

    // Alt + 左箭头 = 上一集
    if (e.altKey && e.key === 'ArrowLeft') {
      if (detailRef.current && currentEpisodeIndexRef.current > 0) {
        handlePreviousEpisode();
        e.preventDefault();
      }
    }

    // Alt + 右箭头 = 下一集
    if (e.altKey && e.key === 'ArrowRight') {
      const d = detailRef.current;
      const idx = currentEpisodeIndexRef.current;
      if (d && idx < d.episodes.length - 1) {
        handleNextEpisode();
        e.preventDefault();
      }
    }

    // 左箭头 = 快退
    if (!e.altKey && e.key === 'ArrowLeft') {
      if (artPlayerRef.current && artPlayerRef.current.currentTime > 5) {
        artPlayerRef.current.currentTime -= 10;
        e.preventDefault();
      }
    }

    // 右箭头 = 快进
    if (!e.altKey && e.key === 'ArrowRight') {
      if (
        artPlayerRef.current &&
        artPlayerRef.current.currentTime < artPlayerRef.current.duration - 5
      ) {
        artPlayerRef.current.currentTime += 10;
        e.preventDefault();
      }
    }

    // 上箭头 = 音量+
    if (e.key === 'ArrowUp') {
      if (artPlayerRef.current && artPlayerRef.current.volume < 1) {
        artPlayerRef.current.volume = Math.min(
          1,
          (artPlayerRef.current.volume || 0) + 0.1
        );
        const notice = (artPlayerRef.current as any).notice;
        if (notice && typeof notice.show === 'function') {
          notice.show(`音量: ${Math.round(artPlayerRef.current.volume * 100)}`);
        }
        e.preventDefault();
      }
    }

    // 下箭头 = 音量-
    if (e.key === 'ArrowDown') {
      if (artPlayerRef.current && artPlayerRef.current.volume > 0) {
        artPlayerRef.current.volume = Math.max(
          0,
          (artPlayerRef.current.volume || 0) - 0.1
        );
        const notice = (artPlayerRef.current as any).notice;
        if (notice && typeof notice.show === 'function') {
          notice.show(`音量: ${Math.round(artPlayerRef.current.volume * 100)}`);
        }
        e.preventDefault();
      }
    }

    // 空格 = 播放/暂停
    if (e.key === ' ') {
      if (artPlayerRef.current) {
        artPlayerRef.current.toggle();
        e.preventDefault();
      }
    }

    // f 键 = 切换全屏
    if (e.key === 'f' || e.key === 'F') {
      if (artPlayerRef.current) {
        artPlayerRef.current.fullscreen = !artPlayerRef.current.fullscreen;
        e.preventDefault();
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 播放记录相关
  // ---------------------------------------------------------------------------
  // 保存播放进度（带防抖机制）
  const saveCurrentPlayProgress = async (immediate = false) => {
    if (
      !artPlayerRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current ||
      !videoTitleRef.current ||
      !detailRef.current?.source_name ||
      isSeekingRef.current // 如果正在拖拽，不保存
    ) {
      return;
    }

    const player = artPlayerRef.current;
    const currentTime = player.currentTime || 0;
    const duration = player.duration || 0;

    // 如果播放时间太短（少于5秒）或者视频时长无效，不保存
    if (currentTime < 1 || !duration) {
      return;
    }

    // 如果不是立即保存，使用防抖机制
    if (!immediate) {
      // 清除之前的防抖定时器
      if (saveProgressDebounceRef.current) {
        clearTimeout(saveProgressDebounceRef.current);
      }

      // 设置新的防抖定时器
      saveProgressDebounceRef.current = setTimeout(async () => {
        await performSaveProgress();
      }, 500); // 0.5秒防抖延迟，提供更及时的保存体验
      return;
    }

    await performSaveProgress();
  };

  // 执行实际的保存操作
  const performSaveProgress = async () => {
    if (
      !artPlayerRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current ||
      !videoTitleRef.current ||
      !detailRef.current?.source_name ||
      isSeekingRef.current
    ) {
      return;
    }

    const player = artPlayerRef.current;
    const currentTime = player.currentTime || 0;
    const duration = player.duration || 0;

    if (currentTime < 1 || !duration) {
      return;
    }

    try {
      await savePlayRecord(currentSourceRef.current, currentIdRef.current, {
        title: videoTitleRef.current,
        source_name: detailRef.current?.source_name || '',
        year: detailRef.current?.year,
        cover: detailRef.current?.poster || '',
        index: currentEpisodeIndexRef.current + 1, // 转换为1基索引
        total_episodes: detailRef.current?.episodes.length || 1,
        play_time: Math.floor(currentTime),
        total_time: Math.floor(duration),
        save_time: Date.now(),
        search_title: searchTitle,
      });

      lastSaveTimeRef.current = Date.now();
      console.log('播放进度已保存:', {
        title: videoTitleRef.current,
        episode: currentEpisodeIndexRef.current + 1,
        year: detailRef.current?.year,
        progress: `${Math.floor(currentTime)}/${Math.floor(duration)}`,
      });
    } catch (err) {
      console.error('保存播放进度失败:', err);
    }
  };

  useEffect(() => {
    // 页面即将卸载时保存播放进度
    const handleBeforeUnload = () => {
      saveCurrentPlayProgress(true); // 立即保存
    };

    // 页面可见性变化时保存播放进度
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPlayProgress(true); // 立即保存
      }
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // 清理事件监听器
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentEpisodeIndex, detail, artPlayerRef.current]);

  // 清理定时器
  useEffect(() => {
    return () => {
      // 清理所有定时器
      cleanupTimers();

      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
      if (saveProgressDebounceRef.current) {
        clearTimeout(saveProgressDebounceRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 收藏相关
  // ---------------------------------------------------------------------------
  // 每当 source 或 id 变化时检查收藏状态
  useEffect(() => {
    if (!currentSource || !currentId) return;
    (async () => {
      try {
        const fav = await isFavorited(currentSource, currentId);
        setFavorited(fav);
      } catch (err) {
        console.error('检查收藏状态失败:', err);
      }
    })();
  }, [currentSource, currentId]);

  // 监听收藏数据更新事件
  useEffect(() => {
    if (!currentSource || !currentId) return;

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (favorites: Record<string, any>) => {
        const key = generateStorageKey(currentSource, currentId);
        const isFav = !!favorites[key];
        setFavorited(isFav);
      }
    );

    return unsubscribe;
  }, [currentSource, currentId]);

  // 切换收藏
  const handleToggleFavorite = async () => {
    if (
      !videoTitleRef.current ||
      !detailRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current
    )
      return;

    try {
      if (favorited) {
        // 如果已收藏，删除收藏
        await deleteFavorite(currentSourceRef.current, currentIdRef.current);
        setFavorited(false);
      } else {
        // 如果未收藏，添加收藏
        await saveFavorite(currentSourceRef.current, currentIdRef.current, {
          title: videoTitleRef.current,
          source_name: detailRef.current?.source_name || '',
          year: detailRef.current?.year,
          cover: detailRef.current?.poster || '',
          total_episodes: detailRef.current?.episodes.length || 1,
          save_time: Date.now(),
          search_title: searchTitle,
        });
        setFavorited(true);
      }
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  // 跟踪视频URL变化，标记源加载开始
  useEffect(() => {
    if (videoUrl) {
      sourceLoadStartTimeRef.current = Date.now();
      // 记录当前URL到已尝试列表
      triedSourcesRef.current.add(videoUrl);
      console.log(
        `📍 视频URL变化，标记源加载开始时间 (已尝试 ${triedSourcesRef.current.size} 个源)`
      );
    }
  }, [videoUrl]);

  // 当切换集数时，重置已尝试源列表
  useEffect(() => {
    triedSourcesRef.current.clear();
    setAllSourcesFailed(false);
    currentSourceIndexRef.current = 0;
    console.log('🔄 切换集数，重置已尝试源列表');
  }, [currentEpisodeIndex]);

  // 当前源变化时，记录到已尝试列表
  useEffect(() => {
    if (currentSource && currentId) {
      const sourceKey = `${currentSource}-${currentId}`;
      triedSourcesRef.current.add(sourceKey);
      console.log(
        `📍 当前源: ${currentSource} (已尝试 ${triedSourcesRef.current.size} 个源)`
      );
    }
  }, [currentSource, currentId]);

  useEffect(() => {
    if (
      !Artplayer ||
      !Hls ||
      !videoUrl ||
      loading ||
      currentEpisodeIndex === null ||
      !artRef.current
    ) {
      return;
    }

    // 检查是否需要重置事件监听器
    if (shouldResetPlayerEvents('player')) {
      console.warn('⚠️ 检测到连续错误，重置事件监听器');
      resetPlayerEvents();
    }

    // 使用新的工具库创建安全的事件处理包装器
    const createRobustEventHandler = (
      handler: (e: any) => void,
      eventName = ''
    ) => {
      return createSafePlayerHandler(handler, eventName);
    };

    // 判断是否应该切换源
    const shouldSwitchSource = (): boolean => {
      const now = Date.now();
      const timeSinceLastSwitch = now - lastSourceSwitchTimeRef.current;
      const timeSinceLoadStart = now - sourceLoadStartTimeRef.current;

      // 0. 强制切换条件：超过6秒最大等待时间，强制切换
      const MAX_SOURCE_WAIT_TIME = 6000; // 6秒最大等待时间
      if (timeSinceLoadStart >= MAX_SOURCE_WAIT_TIME) {
        console.log(
          `⚠️ 当前源加载超时（已等待${Math.round(
            timeSinceLoadStart / 1000
          )}秒 >= 6秒），强制切换源`
        );
        return true;
      }

      // 1. 检查冷却期：距离上次切换是否超过10秒
      if (timeSinceLastSwitch < SOURCE_SWITCH_COOLDOWN) {
        console.log(
          `⏳ 源切换冷却期内（${Math.round(
            (SOURCE_SWITCH_COOLDOWN - timeSinceLastSwitch) / 1000
          )}秒后可切换）`
        );
        return false;
      }

      // 2. 检查加载时间：当前源是否已经尝试加载至少5秒
      if (timeSinceLoadStart < 5000) {
        console.log(
          `⏳ 当前源加载时间不足（已加载${Math.round(
            timeSinceLoadStart / 1000
          )}秒，需要至少5秒）`
        );
        return false;
      }

      // 3. 检查错误次数：当前源是否连续错误达到阈值
      if (currentSourceErrorCountRef.current < SOURCE_ERROR_THRESHOLD) {
        console.log(
          `⏳ 当前源错误次数不足（${
            currentSourceErrorCountRef.current
          }/${SOURCE_ERROR_THRESHOLD}），已等待${Math.round(
            timeSinceLoadStart / 1000
          )}秒/6秒`
        );
        return false;
      }

      console.log('✅ 满足源切换条件');
      return true;
    };

    // 记录源加载开始
    const markSourceLoadStart = () => {
      sourceLoadStartTimeRef.current = Date.now();
      currentSourceErrorCountRef.current = 0;
      console.log('📍 标记源加载开始时间');
    };

    // 记录源切换
    const markSourceSwitch = () => {
      lastSourceSwitchTimeRef.current = Date.now();
      sourceLoadStartTimeRef.current = Date.now();
      currentSourceErrorCountRef.current = 0;
      console.log('📍 标记源切换时间');
    };

    // 记录当前源错误
    const recordCurrentSourceError = () => {
      currentSourceErrorCountRef.current++;
      console.log(
        `📍 记录当前源错误（${currentSourceErrorCountRef.current}/${SOURCE_ERROR_THRESHOLD}）`
      );
    };

    // 播放器重建函数（备用，现在使用 handlePlayerError）
    const _rebuildPlayer = () => {
      // 防止重复重建
      if (rebuildTimeoutRef.current) {
        console.warn('🔄 播放器重建已在进行中，跳过重复请求');
        return;
      }

      console.warn('🔄 检测到 composedPath 错误，开始重建播放器实例...');

      // 设置重建标志，防止重复触发
      rebuildTimeoutRef.current = setTimeout(() => {
        rebuildTimeoutRef.current = null;
      }, 2000); // 2秒内不允许重复重建

      // 保存当前播放状态
      const currentTime = artPlayerRef.current?.currentTime || 0;
      const currentVolume = artPlayerRef.current?.volume || (volume ?? 0.7);
      const isPlaying = !artPlayerRef.current?.paused;

      // 销毁当前播放器实例
      if (artPlayerRef.current) {
        try {
          // 销毁HLS实例
          if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
            artPlayerRef.current.video.hls.destroy();
          }
          // 销毁播放器
          artPlayerRef.current.destroy();
        } catch (e) {
          console.warn('播放器销毁过程中出现错误:', e);
        } finally {
          artPlayerRef.current = null;
          // 清理全局实例引用
          if (
            typeof window !== 'undefined' &&
            (window as any).artPlayerInstance
          ) {
            (window as any).artPlayerInstance = null;
          }
        }
      }

      // 延迟重建播放器，确保DOM完全清理
      setTimeout(() => {
        console.log('🔄 开始重建播放器实例...');
        // 触发播放器重新初始化
        if (artRef.current && videoUrl) {
          // 重新创建播放器实例
          artPlayerRef.current = new Artplayer({
            container: artRef.current as HTMLElement,
            url: videoUrl,
            poster: videoCover,
            volume: currentVolume,
            muted: false,
            autoplay: isPlaying,
            screenshot: false,
            loop: false,
            theme: '#22c55e',
            lang: 'zh-cn',
            hotkey: false,
            pip: isPiPSupported,
            type: 'm3u8',
            customType: {
              m3u8: function (video: HTMLVideoElement, url: string) {
                if (!Hls) {
                  console.error('HLS.js 未加载');
                  return;
                }

                if (video.hls) {
                  video.hls.destroy();
                }

                // 将播放器实例暴露到全局
                if (typeof window !== 'undefined') {
                  (window as any).artPlayerInstance = artPlayerRef.current;
                }

                // 使用优化的 HLS 配置
                const deviceOptions = detectDeviceAndNetwork();
                const hls = createOptimizedHlsInstance(deviceOptions, {
                  startFragPrefetch: true,
                  testBandwidth: true,
                  autoStartLoad: true,
                  capLevelToPlayerSize: false,
                  loader: blockAdEnabledRef.current
                    ? CustomHlsJsLoader
                    : Hls.DefaultConfig.loader,
                });

                hls.loadSource(url);
                hls.attachMedia(video);
                video.hls = hls;
              },
            },
          });

          // 重新设置所有事件监听器
          if (artPlayerRef.current) {
            // 监听播放器事件 - 使用增强的安全包装器
            artPlayerRef.current.on(
              'ready',
              createRobustEventHandler((_e: any) => {
                setError(null);
                console.log('🎯 播放器就绪');

                // 记录播放器状态
                performanceMonitor.recordPlayerStatus('loading');
              }, 'ready')
            );

            artPlayerRef.current.on(
              'video:volumechange',
              createRobustEventHandler((_e: any) => {
                lastVolumeRef.current = artPlayerRef.current.volume;
              }, 'volumechange')
            );

            // 监听视频可播放事件，这时恢复播放进度更可靠
            artPlayerRef.current.on(
              'video:canplay',
              createRobustEventHandler((_e: any) => {
                // 若存在需要恢复的播放进度，则跳转
                if (resumeTimeRef.current && resumeTimeRef.current > 0) {
                  try {
                    const duration = artPlayerRef.current.duration || 0;
                    let target = resumeTimeRef.current;
                    if (duration && target >= duration - 2) {
                      target = Math.max(0, duration - 5);
                    }
                    artPlayerRef.current.currentTime = target;
                    console.log(
                      '⏭️ 成功恢复播放进度到:',
                      resumeTimeRef.current
                    );
                  } catch (err) {
                    console.warn('⚠️ 恢复播放进度失败:', err);
                  }
                }
                resumeTimeRef.current = null;

                setTimeout(() => {
                  if (
                    Math.abs(
                      artPlayerRef.current.volume - lastVolumeRef.current
                    ) > 0.01
                  ) {
                    artPlayerRef.current.volume = lastVolumeRef.current;
                  }
                  const notice = (artPlayerRef.current as any).notice;
                  if (notice && typeof notice.show === 'function') {
                    notice.show('');
                  }
                }, 0);

                // 隐藏换源加载状态
                setIsVideoLoading(false);
              }, 'canplay')
            );

            artPlayerRef.current.on(
              'error',
              createRobustEventHandler((err: any) => {
                // 特别处理AbortError，防止播放器卡死
                if (
                  err?.name === 'AbortError' ||
                  (err?.message && err.message.includes('AbortError'))
                ) {
                  console.warn('检测到AbortError，尝试恢复播放状态');
                  // 重置播放器状态
                  stuckCountRef.current = 0;
                  isSeekingRef.current = false;
                  seekCooldownUntilRef.current = 0;

                  // 尝试重新播放
                  setTimeout(() => {
                    if (artPlayerRef.current && artPlayerRef.current.play) {
                      artPlayerRef.current.play().catch((playError: any) => {
                        console.warn('AbortError后重新播放失败:', playError);
                      });
                    }
                  }, 100);
                  return;
                }
                // 提供更详细的错误信息
                let errorMessage = '播放器错误: ';
                if (err instanceof Error) {
                  errorMessage += err.message;
                } else if (err.type) {
                  errorMessage += `事件类型: ${err.type}`;
                } else if (err.code) {
                  errorMessage += `错误代码: ${err.code}`;
                } else if (err.target && err.target.error) {
                  const videoError = err.target.error;
                  if (videoError) {
                    errorMessage += `视频错误 - 代码: ${videoError.code}, 消息: ${videoError.message}`;
                  }
                } else {
                  errorMessage += '未知错误';
                }

                console.error('❌', errorMessage, err);

                // 如果是视频元素错误，提供更具体的处理
                if (err.target && err.target.error) {
                  const videoError = err.target.error;
                  if (videoError) {
                    switch (videoError.code) {
                      case 1: // MEDIA_ERR_ABORTED
                        console.log('播放被中止');
                        break;
                      case 2: // MEDIA_ERR_NETWORK
                        console.log('网络错误，尝试重新加载');
                        if (artPlayerRef.current) {
                          artPlayerRef.current.load();
                        }
                        break;
                      case 3: // MEDIA_ERR_DECODE
                        console.log('解码错误');
                        break;
                      case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                        console.log('不支持的媒体格式');
                        break;
                      default:
                        console.log('未知视频错误');
                    }
                  }
                }
              }, 'error')
            );
          }

          // 恢复播放状态
          if (currentTime > 0) {
            setTimeout(() => {
              if (artPlayerRef.current) {
                artPlayerRef.current.currentTime = currentTime;
                console.log('⏭️ 恢复播放进度到:', currentTime);
              }
            }, 1000);
          }

          console.log('✅ 播放器实例重建完成');
        }
      }, 500); // 延迟500ms确保完全清理
    };

    // 全局错误处理已由 initPlayerEventHandling() 处理，无需重复设置

    // 确保选集索引有效
    if (
      !detail ||
      !detail.episodes ||
      currentEpisodeIndex >= detail.episodes.length ||
      currentEpisodeIndex < 0
    ) {
      setError(`选集索引无效，当前共 ${totalEpisodes} 集`);
      return;
    }

    if (!videoUrl) {
      setError('视频地址无效');
      return;
    }
    console.log(videoUrl);

    // 统一销毁并重建播放器实例，避免在部分浏览器下复用导致事件状态不一致

    // WebKit浏览器或首次创建：销毁之前的播放器实例并创建新的
    if (artPlayerRef.current) {
      try {
        const video = artPlayerRef.current.video as
          | HTMLVideoElement
          | undefined;
        if (video) {
          // Safari 退出 PiP
          // @ts-ignore
          if (typeof video.webkitSetPresentationMode === 'function') {
            // @ts-ignore
            if (video.webkitPresentationMode === 'picture-in-picture') {
              // @ts-ignore
              video.webkitSetPresentationMode('inline');
            }
          }
          // 标准 PiP 退出（非阻塞调用）
          if (document.pictureInPictureElement) {
            try {
              const exit = (document as any).exitPictureInPicture;
              if (typeof exit === 'function') exit.call(document);
            } catch (err) {
              // 忽略退出画中画失败
            }
          }
        }
      } catch (err) {
        // 忽略退出画中画失败，确保销毁流程继续
      }
      if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
        artPlayerRef.current.video.hls.destroy();
      }
      // 销毁播放器实例
      artPlayerRef.current.destroy();
      artPlayerRef.current = null;
    }

    // 事件处理已由全局系统管理

    try {
      // 临时增强的事件监听器包装器 - 仅在播放器初始化期间使用
      const playerEventWrapper = {
        wrapEventListener: (listener: any) => {
          return function (this: any, event: any) {
            try {
              // 确保事件对象的基本安全性
              if (event && typeof event === 'object') {
                // 为事件对象提供安全的composedPath方法（如果缺失）
                if (typeof event.composedPath !== 'function') {
                  // 更安全的实现，确保不会因为undefined导致错误
                  const safeComposedPath = function (this: any) {
                    try {
                      // 检查this是否存在且有效
                      if (!this || typeof this !== 'object') {
                        return [];
                      }

                      const path = [];
                      let current = this.target;

                      // 添加安全检查防止循环和访问错误
                      let iterations = 0;
                      const maxIterations = 100;

                      // 确保current存在且有nodeType属性
                      while (
                        current &&
                        typeof current === 'object' &&
                        current.nodeType &&
                        iterations < maxIterations
                      ) {
                        path.push(current);

                        // 更安全的父节点访问
                        const nextParent =
                          current.parentNode ||
                          current.host ||
                          current.parentElement;

                        // 检查是否存在循环引用或无效引用
                        if (
                          !nextParent ||
                          nextParent === current ||
                          nextParent === window ||
                          nextParent === document
                        ) {
                          break;
                        }

                        current = nextParent;
                        iterations++;
                      }

                      // 添加document和window到路径末尾（如果不在路径中）
                      if (path.length > 0) {
                        if (
                          typeof document !== 'undefined' &&
                          !path.includes(document)
                        ) {
                          path.push(document);
                        }
                        if (
                          typeof window !== 'undefined' &&
                          !path.includes(window)
                        ) {
                          path.push(window);
                        }
                      }

                      return path;
                    } catch (e) {
                      // 在任何错误情况下都返回空数组而不是抛出异常
                      return [];
                    }
                  };

                  // 安全地定义composedPath属性
                  try {
                    Object.defineProperty(event, 'composedPath', {
                      value: safeComposedPath,
                      writable: false,
                      enumerable: false,
                      configurable: true,
                    });
                  } catch (defineError) {
                    // 如果无法定义属性，静默处理
                    console.warn(
                      '无法为事件对象定义composedPath方法:',
                      defineError
                    );
                  }
                }
              }

              // 调用原始监听器
              if (typeof listener === 'function') {
                return listener.call(this, event);
              } else if (
                listener &&
                typeof listener.handleEvent === 'function'
              ) {
                return listener.handleEvent.call(listener, event);
              }
            } catch (error) {
              // 智能错误处理：只静默特定的兼容性错误
              const errorMessage = String(
                (error as any)?.message || error || ''
              );
              if (shouldSilenceError(errorMessage)) {
                console.warn(
                  '播放器事件处理中的兼容性错误已静默:',
                  errorMessage
                );
              } else {
                console.error('播放器事件处理错误:', error);
              }
            }
          };
        },
      };

      // 错误过滤已由全局系统处理

      // 增强的 Event.prototype.composedPath 兼容性处理
      if (typeof Event !== 'undefined' && Event.prototype) {
        const originalComposedPath = Event.prototype.composedPath;

        // 安全的composedPath实现
        const safeComposedPathImpl = function (this: Event) {
          try {
            // 检查this是否存在且有效
            if (!this || typeof this !== 'object') {
              return [];
            }

            const path = [];
            let current = this.target as any;

            // 更严格的类型检查
            if (!current || typeof current !== 'object') {
              return [];
            }

            // 安全地遍历DOM树构建路径
            while (current && current.nodeType) {
              try {
                path.push(current);
                // 更安全的父节点访问
                const nextParent =
                  current.parentNode || current.host || current.parentElement;
                if (!nextParent || nextParent === current) {
                  break; // 避免无限循环
                }
                current = nextParent;
              } catch (e) {
                break; // 遇到访问限制时停止遍历
              }
            }

            // 添加document和window到路径末尾
            if (path.length > 0) {
              try {
                const doc =
                  path[0] && typeof path[0].ownerDocument !== 'undefined'
                    ? path[0].ownerDocument
                    : typeof document !== 'undefined'
                    ? document
                    : null;
                if (doc && !path.includes(doc)) {
                  path.push(doc);
                }
                if (typeof window !== 'undefined' && !path.includes(window)) {
                  path.push(window);
                }
              } catch (e) {
                // 忽略访问错误
              }
            }

            return path;
          } catch (error) {
            // 完全降级，返回基础路径
            try {
              const target = (this as any)?.target;
              return target ? [target] : [];
            } catch (e) {
              return [];
            }
          }
        };

        // 检查是否需要添加或替换 composedPath 方法
        if (typeof originalComposedPath !== 'function') {
          // 不存在composedPath方法，添加实现
          try {
            Object.defineProperty(Event.prototype, 'composedPath', {
              value: safeComposedPathImpl,
              writable: false,
              enumerable: false, // 确保不影响for...in循环
              configurable: true,
            });
            console.log('✅ 已添加 Event.prototype.composedPath 兼容性实现');
          } catch (defineError) {
            console.warn(
              '无法添加Event.prototype.composedPath兼容性实现:',
              defineError
            );
          }
        } else {
          // 已存在，包装原始方法确保安全性
          try {
            Object.defineProperty(Event.prototype, 'composedPath', {
              value: function () {
                try {
                  // 尝试调用原始方法
                  const result = originalComposedPath.call(this);
                  return Array.isArray(result) ? result : [];
                } catch (error) {
                  // 原始方法失败，使用降级实现
                  console.warn('🔄 composedPath 原生实现失败，使用安全降级');
                  return safeComposedPathImpl.call(this);
                }
              },
              writable: false,
              enumerable: false,
              configurable: true,
            });
            console.log('✅ 已增强 Event.prototype.composedPath 安全性');
          } catch (wrapError) {
            console.warn(
              '无法包装Event.prototype.composedPath方法:',
              wrapError
            );
          }
        }
      }

      // 增强的事件安全包装器函数 (备用)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _createSafeEventHandler = (handler: (e: any) => void) => {
        return playerEventWrapper.wrapEventListener(handler);
      };

      // 添加额外的事件兜底包装器
      const _safeguardEventHandler = (originalHandler: (e: any) => void) => {
        return function (this: any, event: any) {
          try {
            // 为事件对象提供安全保护
            if (event && typeof event === 'object') {
              // 确保 composedPath 方法存在且安全
              if (typeof event.composedPath !== 'function') {
                // 更安全的实现
                const safeComposedPath = function (this: any) {
                  try {
                    // 检查this是否存在且有效
                    if (!this || typeof this !== 'object') {
                      return [];
                    }

                    const path = [];
                    let current = this.target;

                    // 添加安全检查防止循环和访问错误
                    let iterations = 0;
                    const maxIterations = 100;

                    // 确保current存在且有nodeType属性
                    while (
                      current &&
                      typeof current === 'object' &&
                      current.nodeType &&
                      iterations < maxIterations
                    ) {
                      path.push(current);

                      // 更安全的父节点访问
                      const nextParent =
                        current.parentNode ||
                        current.host ||
                        current.parentElement;

                      // 检查是否存在循环引用或无效引用
                      if (
                        !nextParent ||
                        nextParent === current ||
                        nextParent === window ||
                        nextParent === document
                      ) {
                        break;
                      }

                      current = nextParent;
                      iterations++;
                    }

                    // 添加document和window到路径末尾（如果不在路径中）
                    if (path.length > 0) {
                      if (
                        typeof document !== 'undefined' &&
                        !path.includes(document)
                      ) {
                        path.push(document);
                      }
                      if (
                        typeof window !== 'undefined' &&
                        !path.includes(window)
                      ) {
                        path.push(window);
                      }
                    }

                    return path;
                  } catch (e) {
                    // 在任何错误情况下都返回空数组而不是抛出异常
                    return [];
                  }
                };

                // 安全地定义composedPath属性
                try {
                  Object.defineProperty(event, 'composedPath', {
                    value: safeComposedPath,
                    writable: false,
                    enumerable: false,
                    configurable: true,
                  });
                } catch (defineError) {
                  // 如果无法定义属性，静默处理
                  console.warn(
                    '无法为事件对象定义composedPath方法:',
                    defineError
                  );
                }
              }

              // 确保target属性安全
              if (!event.target && event.currentTarget) {
                try {
                  Object.defineProperty(event, 'target', {
                    value: event.currentTarget,
                    writable: false,
                    enumerable: false,
                    configurable: true,
                  });
                } catch (defineError) {
                  console.warn('无法为事件对象定义target属性:', defineError);
                }
              }
            }

            return originalHandler.call(this, event);
          } catch (error) {
            const errorMessage = String((error as any)?.message || error || '');
            if (shouldSilenceError(errorMessage)) {
              console.warn(
                '🔇 播放器事件处理中的兼容性错误已静默:',
                errorMessage
              );
            } else {
              console.error('❌ 播放器事件处理错误:', error);
              // 对于非兼容性错误，可以选择抛出或记录
            }
          }
        };
      };

      if (!Artplayer) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('artplayer');
        Artplayer = mod.default || mod;
      }

      artPlayerRef.current = new Artplayer({
        container: artRef.current as HTMLElement,
        url: videoUrl,
        poster: videoCover,
        volume: volume ?? 0.7,
        muted: false,
        autoplay: true,
        screenshot: false,
        loop: false,
        theme: '#22c55e',
        lang: 'zh-cn',
        hotkey: false,
        pip: isPiPSupported, // 根据支持情况动态设置
        type: 'm3u8',
        customType: {
          m3u8: async function (video: HTMLVideoElement, url: string) {
            if (!Hls) {
              console.error('HLS.js 未加载');
              return;
            }

            // iOS Safari：设置 playsInline 以支持内联播放与画中画
            if (typeof window !== 'undefined' && isIOSSafari()) {
              video.setAttribute('playsinline', 'true');
              video.playsInline = true;
            }

            if (video.hls) {
              video.hls.destroy();
            }

            // 将播放器实例暴露到全局，以便其他组件可以访问和清理
            if (typeof window !== 'undefined') {
              (window as any).artPlayerInstance = artPlayerRef.current;
            }

            // 初始化智能源切换器
            if (!sourceSwitcherRef.current) {
              sourceSwitcherRef.current = new SmartSourceSwitcher();
            }

            await sourceSwitcherRef.current.initializeBackupSources(videoUrl);
            const _backupSources = sourceSwitcherRef.current.backupSources.map(
              (s) => s.url
            );
            const currentSourceIndex = 0;
            let sourceRetryCount = 0;
            const maxSourceRetries = 3;

            const tryNextSource = () => {
              const nextSource =
                sourceSwitcherRef.current?.switchToNextSource();
              if (nextSource) {
                console.log(
                  `尝试备用源: ${nextSource.description} (${nextSource.url})`
                );
                sourceRetryCount = 0;

                // 销毁当前HLS实例
                if (hls) {
                  hls.destroy();
                }

                // 创建新的HLS实例，使用优化的配置
                const deviceOptions = detectDeviceAndNetwork();
                const newHls = createOptimizedHlsInstance(deviceOptions, {
                  fragLoadingMaxRetry: 8,
                  manifestLoadingMaxRetry: 6,
                  levelLoadingMaxRetry: 6,
                  fragLoadingRetryDelay: 1000,
                  manifestLoadingRetryDelay: 1500,
                  levelLoadingRetryDelay: 1500,
                  loader: blockAdEnabledRef.current
                    ? CustomHlsJsLoader
                    : Hls.DefaultConfig.loader,
                });

                // 重新设置错误处理
                setupHlsErrorHandling(newHls);

                // 加载新的源
                newHls.loadSource(nextSource.url);
                newHls.attachMedia(video);

                return newHls;
              }
              return null;
            };

            const setupHlsErrorHandling = (hlsInstance: any) => {
              hlsInstance.on(
                Hls.Events.ERROR,
                function (event: any, data: any) {
                  console.error(
                    'HLS Error (Source:',
                    currentSourceIndex + 1,
                    '):',
                    event,
                    data
                  );

                  if (data.fatal) {
                    sourceRetryCount++;
                    console.log(
                      `源失败，重试次数: ${sourceRetryCount}/${maxSourceRetries}`
                    );

                    if (sourceRetryCount < maxSourceRetries) {
                      // 重试当前源
                      setTimeout(() => {
                        try {
                          hlsInstance.startLoad();
                        } catch (error) {
                          console.error('重试当前源失败:', error);
                        }
                      }, 2000 * sourceRetryCount);
                    } else {
                      // 尝试下一个源
                      const nextHls = tryNextSource();
                      if (!nextHls) {
                        console.error('所有备用源都已尝试，播放失败');
                        // 可以在这里显示错误提示给用户
                      }
                    }
                  }
                }
              );
            };
            const hls = new Hls({
              debug: false, // 关闭日志
              enableWorker: true, // WebWorker 解码，降低主线程压力
              lowLatencyMode: true, // 开启低延迟 LL-HLS

              /* 缓冲/内存相关 - 优化配置 */
              maxBufferLength: 60, // 增加前向缓冲到60秒，提供更流畅的播放体验
              backBufferLength: 60, // 增加后向缓冲到60秒
              maxBufferSize: 100 * 1000 * 1000, // 增加到约100MB，允许更多缓冲内容
              maxMaxBufferLength: 600, // 最大缓冲长度上限增加到600秒

              /* 网络和超时配置 - 针对不稳定网络优化 */
              fragLoadingTimeOut: 30000, // 片段加载超时时间增加到30秒
              manifestLoadingTimeOut: 20000, // manifest加载超时时间增加
              levelLoadingTimeOut: 20000, // 级别加载超时时间增加
              maxLoadingDelay: 8, // 最大加载延迟增加
              maxBufferHole: 2.0, // 允许更大的缓冲空洞（从1.0增加到2.0）
              highBufferWatchdogPeriod: 5, // 高缓冲监控周期增加到5秒
              nudgeOffset: 0.2, // 添加微调偏移增加到0.2

              /* 重试配置 - 更智能的重试策略 */
              fragLoadingMaxRetry: 8, // 片段加载最大重试次数增加到8次
              manifestLoadingMaxRetry: 6, // manifest加载最大重试次数增加到6次
              levelLoadingMaxRetry: 6, // 级别加载最大重试次数增加到6次
              fragLoadingRetryDelay: 1000, // 片段加载重试延迟增加到1秒
              manifestLoadingRetryDelay: 1500, // manifest加载重试延迟增加到1.5秒
              levelLoadingRetryDelay: 1500, // 级别加载重试延迟增加到1.5秒

              /* 自定义loader */
              loader: blockAdEnabledRef.current
                ? CustomHlsJsLoader
                : Hls.DefaultConfig.loader,
            });

            // 添加带宽监测和动态调整
            let lastBandwidthCheck = 0;
            const bandwidthHistory: number[] = [];
            let lastBufferAdjustment = 0;

            hls.on(Hls.Events.FRAG_LOADED, function (_event: any, _data: any) {
              // 记录带宽信息用于动态调整
              if (hls.bandwidthEstimate > 0) {
                bandwidthHistory.push(hls.bandwidthEstimate);
                // 保持最近10个带宽测量值
                if (bandwidthHistory.length > 10) {
                  bandwidthHistory.shift();
                }

                // 每30秒检查一次带宽变化
                const now = Date.now();
                if (now - lastBandwidthCheck > 30000) {
                  lastBandwidthCheck = now;

                  // 计算平均带宽
                  const avgBandwidth =
                    bandwidthHistory.reduce((sum, bw) => sum + bw, 0) /
                    bandwidthHistory.length;

                  // 如果带宽显著下降，调整缓冲策略
                  if (avgBandwidth < hls.bandwidthEstimate * 0.5) {
                    console.log('检测到带宽显著下降，调整缓冲策略');
                    // 减少缓冲长度以适应较低带宽
                    hls.config.maxBufferLength = Math.max(
                      30,
                      hls.config.maxBufferLength * 0.8
                    );
                  }
                  // 如果带宽稳定且充足，可以增加缓冲
                  else if (
                    avgBandwidth > hls.bandwidthEstimate * 1.2 &&
                    hls.config.maxBufferLength < 120
                  ) {
                    console.log('检测到带宽充足，增加缓冲长度');
                    hls.config.maxBufferLength = Math.min(
                      120,
                      hls.config.maxBufferLength * 1.2
                    );
                  }
                }
              }

              // 根据网络质量调整缓冲策略
              const now = Date.now();
              if (now - lastBufferAdjustment > 10000) {
                // 每10秒调整一次
                lastBufferAdjustment = now;

                // 根据网络质量调整缓冲长度
                switch (networkQualityRef.current) {
                  case 'excellent':
                    hls.config.maxBufferLength = Math.min(
                      120,
                      hls.config.maxBufferLength + 10
                    );
                    break;
                  case 'good':
                    hls.config.maxBufferLength = Math.min(
                      90,
                      hls.config.maxBufferLength + 5
                    );
                    break;
                  case 'fair':
                    hls.config.maxBufferLength = Math.max(
                      30,
                      hls.config.maxBufferLength - 5
                    );
                    break;
                  case 'poor':
                    hls.config.maxBufferLength = Math.max(
                      15,
                      hls.config.maxBufferLength - 10
                    );
                    break;
                }
              }
            });

            hls.loadSource(url);
            hls.attachMedia(video);
            video.hls = hls;

            // 错误重试计数器
            let errorRetryCount = 0;
            const maxRetries = 3; // 减少重试次数，避免过度干预

            // 检测浏览器类型
            const isSafari = isSafariBrowser();
            const isWebKit = isWebKitBrowser();

            console.log(`浏览器检测: Safari=${isSafari}, WebKit=${isWebKit}`);

            // 网络状态检测
            let networkCheckInterval: NodeJS.Timeout | null = null;
            let isNetworkOnline = navigator.onLine;
            let lastNetworkCheck = Date.now();

            const startNetworkMonitoring = () => {
              if (networkCheckInterval) return;

              networkCheckInterval = setInterval(async () => {
                const now = Date.now();
                const timeSinceLastCheck = now - lastNetworkCheck;

                // 检查网络连接状态
                const wasOnline = isNetworkOnline;
                isNetworkOnline = navigator.onLine;

                if (!wasOnline && isNetworkOnline) {
                  console.log('网络已恢复，尝试重新加载HLS...');
                  try {
                    hls.startLoad();
                  } catch (error) {
                    console.warn('网络恢复后重新加载失败:', error);
                  }
                }

                // 定期检查网络质量
                if (timeSinceLastCheck > 10000) {
                  // 每10秒检查一次
                  try {
                    const response = await fetch(videoUrl, {
                      method: 'HEAD',
                      signal: AbortSignal.timeout(3000),
                    });
                    if (!response.ok) {
                      console.warn(
                        '网络质量检测失败，状态码:',
                        response.status
                      );
                    }
                  } catch (error) {
                    console.warn('网络质量检测失败:', error);
                  }
                  lastNetworkCheck = now;
                }
              }, 5000);
            };

            const _stopNetworkMonitoring = () => {
              if (networkCheckInterval) {
                clearInterval(networkCheckInterval);
                networkCheckInterval = null;
              }
            };

            // 开始网络监控（只在页面可见时）
            if (isPageVisible) {
              startNetworkMonitoring();
            }

            // 网络质量检测和自适应播放
            const networkQualityMonitor = {
              connectionSpeed: 0,
              latency: 0,
              packetLoss: 0,
              qualityScore: 1.0,

              async measureNetworkQuality() {
                try {
                  const startTime = performance.now();
                  const response = await fetch(videoUrl, {
                    method: 'HEAD',
                    signal: AbortSignal.timeout(5000),
                  });
                  const endTime = performance.now();

                  this.latency = endTime - startTime;
                  this.connectionSpeed =
                    this.calculateConnectionSpeed(response);
                  this.qualityScore = this.calculateQualityScore();

                  // 将网络质量数据传递给性能监控系统
                  performanceMonitor.recordNetworkQuality({
                    latency: this.latency,
                    bandwidth: this.connectionSpeed,
                    packetLoss: 0,
                    jitter: 0,
                    quality: this.getQualityFromScore(this.qualityScore),
                  });

                  console.log(
                    `网络质量检测: 延迟=${this.latency.toFixed(2)}ms, 速度=${(
                      this.connectionSpeed /
                      1024 /
                      1024
                    ).toFixed(2)}MB/s, 质量分数=${this.qualityScore.toFixed(2)}`
                  );

                  return this.qualityScore;
                } catch (error) {
                  console.warn('网络质量检测失败:', error);
                  this.qualityScore = 0.3; // 低质量默认值
                  return this.qualityScore;
                }
              },

              calculateConnectionSpeed(response: Response) {
                const contentLength = response.headers.get('content-length');
                if (contentLength) {
                  return parseInt(contentLength) / (this.latency / 1000);
                }
                return 1000000; // 默认1MB/s
              },

              calculateQualityScore() {
                let score = 1.0;

                // 延迟影响
                if (this.latency > 2000) score -= 0.3;
                else if (this.latency > 1000) score -= 0.2;
                else if (this.latency > 500) score -= 0.1;

                // 速度影响
                if (this.connectionSpeed < 100000) score -= 0.4; // < 100KB/s
                else if (this.connectionSpeed < 500000)
                  score -= 0.2; // < 500KB/s
                else if (this.connectionSpeed < 1000000) score -= 0.1; // < 1MB/s

                return Math.max(0.1, Math.min(1.0, score));
              },

              getQualityFromScore(
                score: number
              ): 'excellent' | 'good' | 'fair' | 'poor' {
                if (score > 0.8) return 'excellent';
                else if (score > 0.6) return 'good';
                else if (score > 0.4) return 'fair';
                else return 'poor';
              },

              getAdaptiveConfig() {
                if (this.qualityScore > 0.8) {
                  return {
                    maxBufferLength: 60,
                    fragLoadingTimeOut: 20000,
                    fragLoadingMaxRetry: 4,
                  };
                } else if (this.qualityScore > 0.5) {
                  return {
                    maxBufferLength: 30,
                    fragLoadingTimeOut: 30000,
                    fragLoadingMaxRetry: 6,
                  };
                } else {
                  return {
                    maxBufferLength: 15,
                    fragLoadingTimeOut: 45000,
                    fragLoadingMaxRetry: 8,
                  };
                }
              },
            };

            // 定期检测网络质量并调整配置
            networkMonitorIntervalRef.current = setInterval(async () => {
              const quality =
                await networkQualityMonitor.measureNetworkQuality();
              const adaptiveConfig = networkQualityMonitor.getAdaptiveConfig();

              // 如果网络质量变化较大，重新配置HLS
              if (
                Math.abs(quality - networkQualityMonitor.qualityScore) > 0.2
              ) {
                console.log('网络质量变化，调整播放配置:', adaptiveConfig);
                // 这里可以动态调整HLS配置
              }
            }, 15000); // 每15秒检测一次

            hls.on(Hls.Events.ERROR, function (event: any, data: any) {
              console.error('HLS Error:', event, data);

              const now = Date.now();

              // 创建错误对象用于健康监控
              const error = new Error(
                `HLS ${data.fatal ? 'Fatal' : 'Non-Fatal'} Error: ${
                  data.type
                } - ${data.details || 'Unknown'}`
              );

              // 记录错误到健康监控系统
              playerHealthMonitor.recordError(error);

              // 记录当前源错误
              recordCurrentSourceError();

              // 记录错误到自动切换器
              if (autoSourceSwitcherRef.current) {
                const errorType = data.fatal
                  ? `fatal_${data.type}_${data.details || 'unknown'}`
                  : `non_fatal_${data.type}_${data.details || 'unknown'}`;
                autoSourceSwitcherRef.current.recordSourceError(errorType);
              }

              // 清除之前的错误防抖定时器
              if (errorDebounceRef.current) {
                clearTimeout(errorDebounceRef.current);
              }

              // 使用防抖机制处理错误计数
              errorDebounceRef.current = setTimeout(() => {
                // 检查是否为连续错误
                const timeSinceLastError = now - lastErrorTime;
                const isConsecutiveError = timeSinceLastError < 5000; // 5秒内认为是连续错误

                // 更新连续错误计数
                setConsecutiveErrorCount((prev) =>
                  isConsecutiveError ? prev + 1 : 1
                );
                setLastErrorTime(now);

                // 增加错误计数
                setHlsErrorCount((prev) => prev + 1);

                // 重置恢复提示标志，允许下次显示恢复提示
                setHasShownRecoveryNotification(false);
              }, 500); // 500ms防抖延迟

              // 设置详细的错误信息
              let errorType = '未知错误';
              let errorMessage = '播放过程中出现错误';
              let errorSuggestion = '正在尝试自动恢复...';

              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    errorType = '网络连接错误';
                    errorMessage = '无法连接到视频服务器';
                    errorSuggestion = '请检查网络连接，正在尝试切换备用源...';
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    errorType = '媒体解码错误';
                    errorMessage = '视频文件格式不支持或损坏';
                    errorSuggestion = '正在尝试重新加载视频...';
                    break;
                  case Hls.ErrorTypes.MUX_ERROR:
                    errorType = '多路复用错误';
                    errorMessage = '视频流格式错误';
                    errorSuggestion = '正在尝试重新解析视频流...';
                    break;
                  default:
                    errorType = '播放错误';
                    errorMessage = '视频播放遇到问题';
                    errorSuggestion = '正在尝试自动恢复...';
                    break;
                }
              } else {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    errorType = '网络不稳定';
                    errorMessage = '网络连接不稳定';
                    errorSuggestion = '正在尝试重新连接...';
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    errorType = '媒体问题';
                    errorMessage = '视频片段加载失败';
                    errorSuggestion = '正在尝试跳过此片段...';
                    break;
                  default:
                    errorType = '轻微错误';
                    errorMessage = '播放过程中出现轻微问题';
                    errorSuggestion = '正在自动处理...';
                    break;
                }
              }

              setHlsErrorDetails({
                type: errorType,
                message: errorMessage,
                suggestion: errorSuggestion,
              });

              // 处理非致命错误 - 增强的错误处理
              if (!data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log('网络错误详情:', data.details);
                    if (data.details === 'fragLoadTimeOut') {
                      console.log('片段加载超时，尝试重新加载...');
                      // 增加延迟重试，避免频繁重试
                      setTimeout(() => {
                        try {
                          hls.startLoad();
                        } catch (error) {
                          console.error('重新加载失败:', error);
                        }
                      }, 2000);
                    } else if (data.details === 'fragLoadError') {
                      console.log('片段加载错误，尝试恢复...');
                      setTimeout(() => {
                        try {
                          hls.startLoad();
                        } catch (error) {
                          console.error('恢复失败:', error);
                        }
                      }, 1500);
                    } else {
                      console.log('其他网络错误，尝试恢复...');
                      setTimeout(() => {
                        try {
                          hls.startLoad();
                        } catch (error) {
                          console.error('网络恢复失败:', error);
                        }
                      }, 1000);
                    }
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log('媒体错误，尝试恢复...');
                    try {
                      hls.recoverMediaError();
                    } catch (error) {
                      console.error('媒体错误恢复失败:', error);
                    }
                    break;
                  case Hls.ErrorTypes.MUX_ERROR:
                    console.log('多路复用错误，尝试重新加载...');
                    setTimeout(() => {
                      try {
                        hls.startLoad();
                      } catch (error) {
                        console.error('重新加载失败:', error);
                      }
                    }, 3000);
                    break;
                  default:
                    console.log('非致命错误，继续播放...');
                    break;
                }
                return;
              }

              // 处理致命错误 - 根据浏览器类型采用不同策略
              if (data.fatal) {
                errorRetryCount++;
                console.log(
                  `致命错误重试 ${errorRetryCount}/${maxRetries}:`,
                  data.type,
                  data.details
                );

                // Safari浏览器：智能错误处理策略
                if (isSafari) {
                  console.log('Safari浏览器：采用智能错误处理策略');

                  if (errorRetryCount <= 2) {
                    // Safari重试2次，提高成功率
                    switch (data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log('Safari: 网络错误，尝试智能恢复...');
                        // 根据错误详情采用不同策略
                        if (
                          data.details === 'fragLoadTimeOut' ||
                          data.details === 'manifestLoadTimeOut'
                        ) {
                          // 超时错误：增加延迟并重试
                          setTimeout(() => {
                            hls.startLoad();
                          }, 3000 + errorRetryCount * 1000);
                        } else {
                          // 其他网络错误：标准重试
                          setTimeout(() => {
                            hls.startLoad();
                          }, 2000);
                        }
                        break;
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('Safari: 媒体错误，尝试恢复...');
                        try {
                          hls.recoverMediaError();
                        } catch (recoverError) {
                          console.warn(
                            'Safari: 媒体错误恢复失败，尝试重新加载:',
                            recoverError
                          );
                          setTimeout(() => {
                            hls.startLoad();
                          }, 1500);
                        }
                        break;
                      case Hls.ErrorTypes.MUX_ERROR:
                        console.log('Safari: 多路复用错误，尝试重新加载...');
                        setTimeout(() => {
                          hls.startLoad();
                        }, 2500);
                        break;
                      default:
                        console.log('Safari: 未知错误类型，尝试轻量级恢复...');
                        setTimeout(() => {
                          hls.startLoad();
                        }, 2000);
                        break;
                    }
                  } else {
                    console.log('Safari: 达到最大重试次数，尝试切换备用源');
                    // Safari在多次重试失败后，尝试切换备用源
                    const nextHls = tryNextSource();
                    if (!nextHls) {
                      console.error('Safari: 所有备用源都已尝试，播放失败');
                      setError(
                        '播放失败：所有播放源都无法访问，请检查网络连接或稍后重试'
                      );
                    }
                  }
                }
                // WebKit浏览器（非Safari）：中等干预
                else if (isWebKit) {
                  console.log('WebKit浏览器：采用中等干预策略');

                  if (errorRetryCount <= 2) {
                    // WebKit重试2次
                    switch (data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR: {
                        console.log('WebKit: 网络错误，尝试恢复...');
                        const retryDelay = Math.min(
                          1000 * errorRetryCount,
                          5000
                        );
                        setTimeout(() => {
                          hls.startLoad();
                        }, retryDelay);
                        break;
                      }
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('WebKit: 媒体错误，尝试恢复...');
                        hls.recoverMediaError();
                        break;
                      default:
                        console.log('WebKit: 无法恢复的致命错误');
                        hls.destroy();
                        break;
                    }
                  } else {
                    console.log('WebKit: 达到最大重试次数，尝试切换备用源');
                    // WebKit在多次重试失败后，也尝试切换备用源
                    const nextHls = tryNextSource();
                    if (!nextHls) {
                      console.error('WebKit: 所有备用源都已尝试，播放失败');
                      setError(
                        '播放失败：所有播放源都无法访问，请检查网络连接或稍后重试'
                      );
                    }
                  }
                }
                // 其他浏览器：保持原有逻辑但减少重试次数
                else {
                  console.log('其他浏览器：采用标准错误处理策略');

                  if (errorRetryCount <= maxRetries) {
                    switch (data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR: {
                        console.log('其他浏览器: 网络错误，尝试恢复...');
                        const retryDelay = Math.min(
                          1000 * Math.pow(2, errorRetryCount - 1),
                          8000
                        );
                        setTimeout(() => {
                          hls.startLoad();
                        }, retryDelay);
                        break;
                      }
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('其他浏览器: 媒体错误，尝试恢复...');
                        hls.recoverMediaError();
                        break;
                      default:
                        console.log('其他浏览器: 无法恢复的致命错误');
                        hls.destroy();
                        break;
                    }
                  } else {
                    console.log('其他浏览器: 达到最大重试次数，尝试切换备用源');
                    // 其他浏览器在多次重试失败后，也尝试切换备用源
                    const nextHls = tryNextSource();
                    if (!nextHls) {
                      console.error('其他浏览器: 所有备用源都已尝试，播放失败');
                      setError(
                        '播放失败：所有播放源都无法访问，请检查网络连接或稍后重试'
                      );
                    }
                  }
                }

                // 检查是否需要重建播放器（在所有错误处理后）
                if (data.fatal) {
                  setTimeout(async () => {
                    try {
                      // 检查播放器健康状态
                      const healthStatus = getPlayerHealthStatus();
                      console.log('播放器健康状态:', healthStatus);

                      // 如果需要重建播放器
                      if (playerHealthMonitor.shouldRebuildPlayer()) {
                        console.log(
                          '⚠️ 检测到严重HLS错误，开始智能恢复流程...'
                        );

                        // 策略1: 先尝试切换播放源（需要满足切换条件）
                        if (shouldSwitchSource()) {
                          const nextSource = tryNextSource();
                          if (nextSource) {
                            console.log('✅ 已切换到备用HLS源，重置健康状态');
                            // 标记源切换
                            markSourceSwitch();
                            // 重置健康状态，给新源一个机会
                            playerHealthMonitor.resetHealthStatus();
                            return; // 不需要重建，HLS已经切换源
                          }
                        } else {
                          console.log(
                            '⏳ 不满足HLS源切换条件，继续等待当前源加载...'
                          );
                          return; // 等待当前源继续尝试
                        }

                        // 策略2: 如果没有更多HLS源，则重建播放器
                        console.log('🔄 没有更多HLS源，重建播放器实例...');

                        // 获取播放器容器和选项
                        const container = artRef.current;
                        if (!container) {
                          console.error('播放器容器不存在，无法重建');
                          return;
                        }

                        // 构建播放器选项
                        const playerOptions = {
                          url: videoUrl,
                          volume: lastVolumeRef.current,
                          autoplay: true,
                          poster: videoCover,
                          theme: '#22c55e',
                          lang: 'zh-cn',
                          pip: isPiPSupported,
                          type: 'm3u8',
                        };

                        // 直接调用重建管理器
                        console.log('🔧 开始执行播放器重建...');
                        const newPlayer =
                          await playerRecoveryManager.recoverPlayer(
                            artPlayerRef.current,
                            container,
                            playerOptions
                          );

                        // 如果成功重建，更新播放器引用
                        if (newPlayer) {
                          artPlayerRef.current = newPlayer;
                          console.log('✅ 播放器自动重建成功');
                        }
                      }
                    } catch (rebuildError) {
                      console.error('播放器自动恢复失败:', rebuildError);
                      // 注意：recoverPlayer 内部已经调用了 showFatalError
                      // 这里只记录日志，不需要额外处理
                      // 致命错误弹窗已经显示给用户
                    }
                  }, 1000); // 延迟1秒后检查，避免与其他恢复机制冲突
                }
              }
            });

            // 监听成功事件，重置错误计数器
            hls.on(Hls.Events.FRAG_LOADED, function () {
              errorRetryCount = 0; // 重置错误计数器
              currentSourceErrorCountRef.current = 0; // 重置当前源错误计数

              // 优化的恢复提示逻辑：更严格的恢复条件
              // 不显示播放恢复提示，只重置错误计数
              if (hlsErrorCount > 0 && !hasShownRecoveryNotification) {
                const now = Date.now();
                const cooldown = getNotificationCooldown();

                // 检查是否在冷却期内，避免频繁提示
                if (now - lastNotificationTime >= cooldown) {
                  // 只有在连续错误后成功恢复时才重置计数
                  if (consecutiveErrorCount >= 2 || hlsErrorCount >= 3) {
                    // 不显示恢复提示，直接重置错误计数
                    setHasShownRecoveryNotification(true);
                    setLastNotificationTime(now);

                    // 延迟重置错误计数
                    setTimeout(() => {
                      setHlsErrorCount(0);
                      setConsecutiveErrorCount(0);
                    }, 1000);
                  }
                }
              }
            });

            hls.on(Hls.Events.LEVEL_LOADED, function () {
              errorRetryCount = 0; // 重置错误计数器
            });
          },
        },
      });

      // 监听播放器事件 - 使用增强的安全包装器
      artPlayerRef.current.on(
        'ready',
        createRobustEventHandler((_e: any) => {
          setError(null);
          console.log('🎯 播放器就绪');

          // 初始化播放器健康监控
          if (artPlayerRef.current) {
            playerHealthMonitor.monitorPlayerHealth(artPlayerRef.current);
            console.log('✅ 播放器健康监控已启动');
          }
        }, 'ready')
      );

      artPlayerRef.current.on(
        'video:volumechange',
        createRobustEventHandler((_e: any) => {
          lastVolumeRef.current = artPlayerRef.current.volume;
        }, 'volumechange')
      );

      // 监听视频可播放事件，这时恢复播放进度更可靠
      artPlayerRef.current.on(
        'video:canplay',
        createRobustEventHandler((_e: any) => {
          // 若存在需要恢复的播放进度，则跳转
          if (resumeTimeRef.current && resumeTimeRef.current > 0) {
            try {
              const duration = artPlayerRef.current.duration || 0;
              let target = resumeTimeRef.current;
              if (duration && target >= duration - 2) {
                target = Math.max(0, duration - 5);
              }
              artPlayerRef.current.currentTime = target;
              console.log('⏭️ 成功恢复播放进度到:', resumeTimeRef.current);
            } catch (err) {
              console.warn('⚠️ 恢复播放进度失败:', err);
            }
          }
          resumeTimeRef.current = null;

          setTimeout(() => {
            if (
              Math.abs(artPlayerRef.current.volume - lastVolumeRef.current) >
              0.01
            ) {
              artPlayerRef.current.volume = lastVolumeRef.current;
            }
            const notice = (artPlayerRef.current as any).notice;
            if (notice && typeof notice.show === 'function') {
              notice.show('');
            }
          }, 0);

          // 隐藏换源加载状态
          setIsVideoLoading(false);
        }, 'canplay')
      );

      artPlayerRef.current.on(
        'error',
        createRobustEventHandler(async (err: any) => {
          // 特别处理AbortError，防止播放器卡死
          const isAbortError =
            err?.name === 'AbortError' ||
            (err?.message && err.message.includes('AbortError'));

          if (isAbortError) {
            console.warn('检测到AbortError，尝试恢复播放状态');
            // 重置播放器状态
            stuckCountRef.current = 0;
            isSeekingRef.current = false;
            seekCooldownUntilRef.current = 0;

            // 尝试重新播放
            setTimeout(() => {
              if (artPlayerRef.current && artPlayerRef.current.play) {
                artPlayerRef.current.play().catch((playError: any) => {
                  console.warn('AbortError后重新播放失败:', playError);
                });
              }
            }, 100);

            // 不要直接return，继续检查是否需要重建
            // （虽然AbortError本身不严重，但可能有其他累积的错误）
          }
          // 提供更详细的错误信息
          let errorMessage = '播放器错误: ';
          if (err instanceof Error) {
            errorMessage += err.message;
          } else if (err.type) {
            errorMessage += `事件类型: ${err.type}`;
          } else if (err.code) {
            errorMessage += `错误代码: ${err.code}`;
          } else if (err.target && err.target.error) {
            const videoError = err.target.error;
            if (videoError) {
              errorMessage += `视频错误 - 代码: ${videoError.code}, 消息: ${videoError.message}`;
            }
          } else {
            errorMessage += '未知错误';
          }

          console.error('❌', errorMessage, err);

          // 创建错误对象并记录到健康监控系统
          // 但是AbortError不应该被记录为严重错误
          if (!isAbortError) {
            const error = err instanceof Error ? err : new Error(errorMessage);
            playerHealthMonitor.recordError(error);

            // 检查播放器健康状态
            const isHealthy = checkPlayerHealth(artPlayerRef.current);
            if (!isHealthy) {
              console.warn('⚠️ 播放器健康状态异常');
            }
          } else {
            console.log('ℹ️ AbortError不计入错误统计');
          }

          // 如果是视频元素错误，提供更具体的处理
          if (err.target && err.target.error) {
            const videoError = err.target.error;
            switch (videoError.code) {
              case 1: // MEDIA_ERR_ABORTED
                console.warn('📛 视频播放被中止');
                break;
              case 2: // MEDIA_ERR_NETWORK
                console.warn('🌐 网络错误导致视频下载失败');
                break;
              case 3: // MEDIA_ERR_DECODE
                console.warn('🔧 视频解码错误');
                break;
              case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                console.warn('❌ 视频格式不支持或文件不存在');
                setError('视频格式不支持或文件不存在');
                break;
              default:
                console.warn('❓ 未知视频错误');
            }
          }

          if (artPlayerRef.current && artPlayerRef.current.currentTime > 0) {
            return;
          }

          // 记录当前源错误（AbortError除外）
          if (!isAbortError) {
            recordCurrentSourceError();
          }

          // 检查是否需要重建播放器
          setTimeout(async () => {
            try {
              if (playerHealthMonitor.shouldRebuildPlayer()) {
                console.log('⚠️ 检测到严重错误，开始智能恢复流程...');

                // 策略1: 使用真实源列表切换（基于播放器下方的换源列表）
                console.log('🔍 检查源切换条件:', {
                  availableSourcesCount: availableSources.length,
                  shouldSwitch: shouldSwitchSource(),
                  currentSource,
                  currentId,
                });

                if (availableSources.length > 1 && shouldSwitchSource()) {
                  console.log(
                    `🔄 步骤1: 切换到下一个真实源站 (当前: ${currentSource})`
                  );

                  // 找到当前源在列表中的索引
                  const currentIndex = availableSources.findIndex(
                    (s) => s.source === currentSource && s.id === currentId
                  );

                  console.log(
                    '📍 当前源索引:',
                    currentIndex,
                    '总源数:',
                    availableSources.length
                  );
                  console.log(
                    '📋 所有可用源:',
                    availableSources.map((s) => `${s.source_name}(${s.source})`)
                  );
                  console.log(
                    '🔖 已尝试的源:',
                    Array.from(triedSourcesRef.current)
                  );

                  // 从下一个源开始尝试
                  let nextIndex = (currentIndex + 1) % availableSources.length;
                  let attempts = 0;
                  let foundNewSource = false;

                  // 尝试找到一个未尝试过的源
                  while (attempts < availableSources.length) {
                    const nextSource = availableSources[nextIndex];
                    const sourceKey = `${nextSource.source}-${nextSource.id}`;

                    console.log(
                      `🔍 检查源 [${attempts + 1}/${availableSources.length}]:`,
                      {
                        source: nextSource.source_name,
                        sourceKey,
                        alreadyTried: triedSourcesRef.current.has(sourceKey),
                      }
                    );

                    // 检查是否已经尝试过这个源
                    if (!triedSourcesRef.current.has(sourceKey)) {
                      foundNewSource = true;
                      console.log(
                        `✅ 找到下一个源: ${nextSource.source_name} (${
                          triedSourcesRef.current.size + 1
                        }/${availableSources.length})`
                      );

                      // 记录已尝试的源
                      triedSourcesRef.current.add(sourceKey);
                      currentSourceIndexRef.current = nextIndex;

                      // 标记源切换
                      markSourceSwitch();

                      // 通知用户
                      if (artPlayerRef.current?.notice) {
                        artPlayerRef.current.notice.show(
                          `正在切换到: ${nextSource.source_name} (${triedSourcesRef.current.size}/${availableSources.length})`
                        );
                      }

                      // 使用 handleSourceChange 切换源
                      console.log('🔄 调用 handleSourceChange:', {
                        source: nextSource.source,
                        id: nextSource.id,
                        title: nextSource.title || videoTitleRef.current,
                      });

                      try {
                        await handleSourceChange(
                          nextSource.source,
                          nextSource.id,
                          nextSource.title || videoTitleRef.current
                        );
                        console.log('✅ handleSourceChange 完成');
                      } catch (switchError) {
                        console.error(
                          '❌ handleSourceChange 失败:',
                          switchError
                        );
                      }

                      // 重置健康状态，给新源一个机会
                      playerHealthMonitor.resetHealthStatus();

                      return; // 不需要重建，只是切换源
                    }

                    // 尝试下一个源
                    nextIndex = (nextIndex + 1) % availableSources.length;
                    attempts++;
                  }

                  // 所有源都尝试完了
                  if (!foundNewSource) {
                    console.error('❌ 所有播放源都已尝试，全部失败');
                    setAllSourcesFailed(true);

                    // 通知用户
                    if (artPlayerRef.current?.notice) {
                      artPlayerRef.current.notice.show(
                        '所有播放源都无法使用，请稍后重试',
                        5000
                      );
                    }

                    // 显示错误信息
                    setError('所有播放源都无法访问，请检查网络连接或稍后重试');

                    return; // 不再尝试重建
                  }
                } else if (availableSources.length <= 1) {
                  console.log('⚠️ 只有一个源，无法切换');
                } else if (
                  sourceSwitcherRef.current &&
                  sourceSwitcherRef.current.backupSources.length > 0
                ) {
                  console.log('⏳ 不满足源切换条件，继续等待当前源加载...');
                  return; // 等待当前源继续尝试
                }

                // 策略2: 如果没有更多源，或切换源失败，则重建播放器
                console.log('🔄 步骤2: 重建播放器实例...');

                const container = artRef.current;
                if (!container) {
                  console.error('播放器容器不存在，无法重建');
                  return;
                }

                // 构建播放器选项
                const playerOptions = {
                  url: videoUrl,
                  volume: lastVolumeRef.current,
                  autoplay: true,
                  poster: videoCover,
                  theme: '#22c55e',
                  lang: 'zh-cn',
                  pip: isPiPSupported,
                  type: 'm3u8',
                };

                // 直接调用重建管理器
                console.log('🔧 开始执行播放器重建...');
                const newPlayer = await playerRecoveryManager.recoverPlayer(
                  artPlayerRef.current,
                  container,
                  playerOptions
                );

                // 如果成功重建，更新播放器引用
                if (newPlayer) {
                  artPlayerRef.current = newPlayer;
                  console.log('✅ 播放器自动重建成功');
                }
              }
            } catch (rebuildError) {
              console.error('播放器自动恢复失败:', rebuildError);
              // 注意：recoverPlayer 内部已经调用了 showFatalError
              // 这里只记录日志，不需要额外处理
              // 致命错误弹窗已经显示给用户
            }
          }, 1000);
        }, 'error')
      );

      // 监听视频播放结束事件，自动播放下一集
      artPlayerRef.current.on(
        'video:ended',
        createRobustEventHandler((_e: any) => {
          const d = detailRef.current;
          const idx = currentEpisodeIndexRef.current;
          if (d && d.episodes && idx < d.episodes.length - 1) {
            setTimeout(() => {
              setCurrentEpisodeIndex(idx + 1);
            }, 1000);
          }
        }, 'ended')
      );

      // 监听拖拽开始事件
      artPlayerRef.current.on(
        'video:seeking',
        createRobustEventHandler((_e: any) => {
          isSeekingRef.current = true;
          // 降低日志噪声与主线程压力
        }, 'seeking')
      );

      // 监听拖拽结束事件
      artPlayerRef.current.on(
        'video:seeked',
        createRobustEventHandler((_e: any) => {
          isSeekingRef.current = false;
          // 设置拖拽后的短冷却窗口，期间跳过卡死检测与频繁保存
          seekCooldownUntilRef.current = Date.now() + 800; // 0.8s 冷却
          // 拖拽结束后延迟保存一次进度，避免与其他事件冲突
          setTimeout(() => {
            saveCurrentPlayProgress(true);
          }, 100);

          // 网络状态检查，如果网络不稳定则增加冷却时间
          if (networkStatus === 'unstable' || networkStatus === 'offline') {
            seekCooldownUntilRef.current = Date.now() + 3000; // 网络不稳定时增加到3秒冷却
          }
        }, 'seeked')
      );

      artPlayerRef.current.on(
        'video:timeupdate',
        createRobustEventHandler((_e: any) => {
          // 额外的安全检查
          if (!artPlayerRef.current) {
            return;
          }

          const now = Date.now();
          // 拖拽后冷却期：跳过卡死检测与频繁保存，提升进度条流畅性
          if (now < seekCooldownUntilRef.current || isSeekingRef.current) {
            return;
          }

          const player = artPlayerRef.current;
          if (!player) {
            return;
          }

          const currentTime = player?.currentTime || 0;

          // 更智能的播放进度卡死检测与恢复机制
          const isPaused = !!player?.paused;
          const isPageVisible =
            typeof document !== 'undefined'
              ? document.visibilityState === 'visible'
              : true;
          const readyState = (player?.video?.readyState as number) ?? 0;
          const buffered = player?.video?.buffered;
          const duration = player?.duration || 0;

          // 检查缓冲状态 - 更精确的缓冲检测
          let hasBufferedData = false;
          let bufferedAhead = 0;
          let totalBuffered = 0;
          const _bufferStart = 0;
          const _bufferEnd = 0;

          if (buffered && buffered.length > 0) {
            // 计算总缓冲时长
            for (let i = 0; i < buffered.length; i++) {
              totalBuffered += buffered.end(i) - buffered.start(i);
            }

            // 找到当前播放位置的缓冲区间
            for (let i = 0; i < buffered.length; i++) {
              const start = buffered.start(i);
              const end = buffered.end(i);

              // 检查当前时间是否在缓冲范围内
              if (currentTime >= start && currentTime <= end) {
                hasBufferedData = true;
                bufferedAhead = end - currentTime; // 计算前方缓冲时长
                const _bufferStart = start;
                const _bufferEnd = end;
                break;
              }

              // 检查是否有前方缓冲
              if (start > currentTime && start - currentTime < 2) {
                bufferedAhead = end - currentTime;
                const _bufferStart = start;
                const _bufferEnd = end;
                break;
              }
            }
          }

          // 计算缓冲健康度并传递给性能监控系统
          if (duration > 0) {
            const bufferHealth = Math.min(
              1,
              Math.max(0, totalBuffered / duration)
            );
            performanceMonitor.recordBufferHealth(bufferHealth);
          }

          // 动态调整缓冲策略
          if (player?.video?.hls) {
            const hls = player.video.hls;

            // 如果前方缓冲不足且总缓冲较少，增加缓冲长度
            if (bufferedAhead < 10 && totalBuffered < 30) {
              // 根据网络质量调整增加幅度
              let increaseAmount = 5;
              switch (networkQualityRef.current) {
                case 'excellent':
                  increaseAmount = 15;
                  break;
                case 'good':
                  increaseAmount = 10;
                  break;
                case 'fair':
                  increaseAmount = 5;
                  break;
                case 'poor':
                  increaseAmount = 3;
                  break;
              }
              hls.config.maxBufferLength = Math.min(
                120,
                hls.config.maxBufferLength + increaseAmount
              );
            }
            // 如果前方缓冲充足，可以适当减少缓冲长度以节省内存
            else if (bufferedAhead > 30 && totalBuffered > 60) {
              // 根据网络质量调整减少幅度
              let decreaseAmount = 5;
              switch (networkQualityRef.current) {
                case 'excellent':
                  decreaseAmount = 5;
                  break;
                case 'good':
                  decreaseAmount = 10;
                  break;
                case 'fair':
                  decreaseAmount = 15;
                  break;
                case 'poor':
                  decreaseAmount = 20;
                  break;
              }
              hls.config.maxBufferLength = Math.max(
                30,
                hls.config.maxBufferLength - decreaseAmount
              );
            }
          }

          if (!isPaused && isPageVisible && readyState >= 2) {
            // 每隔1秒进行一次卡死评估（从2秒减少到1秒，提高检测灵敏度）
            const lastCheckTs = lastProgressCheckTsRef.current || 0;
            if (now - lastCheckTs >= 1000) {
              const lastMediaT = lastMediaTimeForStallRef.current || 0;
              const progressed = currentTime - lastMediaT;

              // 更智能的卡死判断条件 - 降低误判率
              const isStuck =
                progressed < 0.05 && // 进度推进极小（从0.03增加到0.05，减少误判）
                (hasBufferedData || bufferedAhead > 0.5) && // 有缓冲数据或前方有足够缓冲（从0.3增加到0.5）
                currentTime > 2 && // 播放时间超过2秒
                readyState >= 3 && // 有足够数据可播放
                !isSeekingRef.current && // 确保不在拖拽中
                isPageVisible && // 页面可见
                totalBuffered > 5 && // 总缓冲时长超过5秒
                !player?.seeking && // 确保不在seeking状态
                networkStatus !== 'offline'; // 确保网络不是离线状态

              if (isStuck) {
                stuckCountRef.current += 1;
                console.warn(
                  `🔍 播放进度检测 ${
                    stuckCountRef.current
                  }/4: 进度=${progressed.toFixed(
                    3
                  )}s, 时间=${currentTime.toFixed(
                    1
                  )}s, 缓冲=${hasBufferedData}, 前方缓冲=${bufferedAhead.toFixed(
                    1
                  )}s, 总缓冲=${totalBuffered.toFixed(1)}s`
                );

                // 根据网络质量调整恢复策略
                const maxStuckCount =
                  networkQualityRef.current === 'poor' ? 5 : 6; // 增加最大卡死检测次数

                if (stuckCountRef.current >= maxStuckCount) {
                  // 根据网络质量调整触发阈值
                  // 连续评估无进展，进行渐进式恢复
                  console.warn('🚑 检测到播放卡死，开始渐进式恢复策略...', {
                    stuckCount: stuckCountRef.current,
                    currentTime: currentTime.toFixed(2),
                    bufferedAhead: bufferedAhead.toFixed(2),
                    totalBuffered: totalBuffered.toFixed(2),
                    readyState,
                    networkQuality: networkQualityRef.current,
                  });

                  try {
                    const hls = player?.video?.hls;

                    // 策略 1: 微小跳跃 (根据网络质量调整)
                    if (stuckCountRef.current === maxStuckCount) {
                      const jumpAmount =
                        networkQualityRef.current === 'poor' ? 0.05 : 0.1;
                      const smallNudge = Math.min(
                        duration - currentTime,
                        jumpAmount
                      );
                      if (smallNudge > 0) {
                        player.currentTime = currentTime + smallNudge;
                        console.log(
                          '✨ 应用微小跳跃恢复:',
                          smallNudge.toFixed(3),
                          '秒'
                        );
                      }
                    }
                    // 策略 2: 中等跳跃 (根据网络质量调整)
                    else if (stuckCountRef.current === maxStuckCount + 1) {
                      const jumpAmount =
                        networkQualityRef.current === 'poor' ? 0.1 : 0.3;
                      const mediumNudge = Math.min(
                        duration - currentTime,
                        jumpAmount
                      );
                      if (mediumNudge > 0) {
                        player.currentTime = currentTime + mediumNudge;
                        console.log(
                          '⚡ 应用中等跳跃恢复:',
                          mediumNudge.toFixed(3),
                          '秒'
                        );
                      }
                    }
                    // 策略 3: 大跳跃 (根据网络质量调整)
                    else if (stuckCountRef.current === maxStuckCount + 2) {
                      const jumpAmount =
                        networkQualityRef.current === 'poor' ? 0.2 : 0.8;
                      const largeNudge = Math.min(
                        duration - currentTime,
                        jumpAmount
                      );
                      if (largeNudge > 0) {
                        player.currentTime = currentTime + largeNudge;
                        console.log(
                          '🚀 应用大跳跃恢复:',
                          largeNudge.toFixed(3),
                          '秒'
                        );
                      }
                    }
                    // 策略 4: HLS重载当前片段
                    else if (stuckCountRef.current === maxStuckCount + 3) {
                      console.log('🔄 应用HLS重载恢复策略');
                      if (hls && typeof hls.startLoad === 'function') {
                        hls.stopLoad();
                        setTimeout(() => {
                          try {
                            hls.startLoad();
                            console.log('✅ HLS重载成功');
                          } catch (e) {
                            console.warn('⚠️ HLS重载失败:', e);
                          }
                        }, 200);
                      }
                    }
                    // 策略 5: 强制重新初始化HLS
                    else if (stuckCountRef.current === maxStuckCount + 4) {
                      console.log('🔥 应用强制HLS重初始化策略');
                      if (hls) {
                        try {
                          const currentLevel = hls.currentLevel;
                          hls.destroy();

                          // 根据网络质量选择合适的配置
                          let maxBufferLength = 60;
                          let maxBufferSize = 100 * 1000 * 1000;

                          switch (networkQualityRef.current) {
                            case 'excellent':
                              maxBufferLength = 120;
                              maxBufferSize = 150 * 1000 * 1000;
                              break;
                            case 'good':
                              maxBufferLength = 60;
                              maxBufferSize = 100 * 1000 * 1000;
                              break;
                            case 'fair': {
                              maxBufferLength = 30;
                              maxBufferSize = 60 * 1000 * 1000;
                              break;
                            }
                            case 'poor': {
                              maxBufferLength = 15;
                              maxBufferSize = 30 * 1000 * 1000;
                              break;
                            }
                          }

                          // 短暂延迟后重新创建HLS实例
                          setTimeout(() => {
                            try {
                              const newHls = new Hls({
                                debug: false,
                                startLevel:
                                  currentLevel >= 0 ? currentLevel : -1,
                                // 使用更保守的配置
                                maxBufferLength: maxBufferLength,
                                maxBufferSize: maxBufferSize,
                                backBufferLength: 30,
                                fragLoadingTimeOut: 30000,
                                fragLoadingMaxRetry: 6,
                                enableWorker: true,
                                lowLatencyMode: true,
                                // 增加网络不稳定环境下的容错能力
                                fragLoadingRetryDelay: 500,
                                manifestLoadingRetryDelay: 1000,
                                levelLoadingRetryDelay: 1000,
                                // 片段加载策略
                                fragLoadPolicy: {
                                  default: {
                                    maxTimeToFirstByteMs: 10000,
                                    maxLoadTimeMs: 60000,
                                    timeoutRetry: {
                                      maxNumRetry: 3,
                                      retryDelayMs: 1000,
                                      maxRetryDelayMs: 8000,
                                      backoff: 'exponential',
                                    },
                                    errorRetry: {
                                      maxNumRetry: 6,
                                      retryDelayMs: 2000,
                                      maxRetryDelayMs: 15000,
                                      backoff: 'exponential',
                                    },
                                  },
                                },
                              });
                              newHls.loadSource(videoUrl);
                              newHls.attachMedia(player.video);
                              player.video.hls = newHls;

                              // 恢复播放位置
                              setTimeout(() => {
                                if (
                                  player &&
                                  player.currentTime !== currentTime
                                ) {
                                  player.currentTime = currentTime;
                                  console.log(
                                    '✅ HLS重初始化成功，已恢复播放位置'
                                  );
                                }
                              }, 500);
                            } catch (e) {
                              console.error('❌ HLS重初始化失败:', e);
                            }
                          }, 300);
                        } catch (e) {
                          console.warn('⚠️ HLS销毁失败:', e);
                        }
                      }
                      stuckCountRef.current = 0; // 重置计数器
                    }

                    // 确保播放状态
                    if (player?.play && typeof player.play === 'function') {
                      player.play().catch((playError: any) => {
                        console.warn('⚠️ 自动播放失败:', playError);
                      });
                    }
                  } catch (err) {
                    console.warn('❌ 播放恢复失败:', err);
                    stuckCountRef.current = 0;
                  }
                }
              } else {
                // 有正常推进，重置计数
                if (stuckCountRef.current > 0) {
                  console.log('✅ 播放恢复正常，重置卡死计数器');
                }
                stuckCountRef.current = 0;
              }

              lastMediaTimeForStallRef.current = currentTime;
              lastProgressCheckTsRef.current = now;
            }
          } else {
            // 暂停或不可见状态下不进行卡死统计
            stuckCountRef.current = 0;
            lastMediaTimeForStallRef.current = currentTime;
            lastProgressCheckTsRef.current = now;
          }

          let interval = 5000;
          if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'd1') {
            interval = 10000;
          }
          if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'upstash') {
            interval = 20000;
          }
          if (now - lastSaveTimeRef.current > interval) {
            saveCurrentPlayProgress(); // 使用防抖机制
            lastSaveTimeRef.current = now;
          }
        }, 'timeupdate')
      );

      artPlayerRef.current.on(
        'pause',
        createRobustEventHandler((_e: any) => {
          saveCurrentPlayProgress(true); // 暂停时立即保存
          // 重置卡死计数器
          stuckCountRef.current = 0;

          // 记录播放器状态
          performanceMonitor.recordPlayerStatus('paused');
        }, 'pause')
      );

      // 添加播放状态监控
      artPlayerRef.current.on(
        'play',
        createRobustEventHandler((_e: any) => {
          // 重置卡死计数器
          stuckCountRef.current = 0;
          lastPlayTimeRef.current = artPlayerRef.current?.currentTime || 0;

          // 记录播放器状态
          performanceMonitor.recordPlayerStatus('playing');
        }, 'play')
      );

      if (artPlayerRef.current?.video) {
        ensureVideoSource(
          artPlayerRef.current.video as HTMLVideoElement,
          videoUrl
        );
      }

      // 输出优化状态信息
      console.log('🚀 播放器稳定性优化已启用：');
      console.log('  ✅ composedPath兼容性增强');
      console.log('  ✅ 网络状态智能监控');
      console.log('  ✅ 播放卡死智能恢复');
      console.log('  ✅ 事件安全性加固');

      // 初始化自动源切换器
      if (!autoSourceSwitcherRef.current && availableSources.length > 0) {
        console.log('🔄 初始化自动源切换器...');

        autoSourceSwitcherRef.current = createAutoSourceSwitcher({
          enabled: true,
          timeoutThreshold: 6000, // 6秒超时
          cooldownPeriod: 10000, // 10秒冷却期
          minimumAttemptTime: 5000, // 5秒最小尝试时间
          errorThreshold: 3, // 3次错误阈值
          maxSwitchAttempts: 5, // 最多尝试5个源
          networkAdaptive: true, // 启用网络自适应
        });

        // 初始化切换器
        autoSourceSwitcherRef.current.initialize(
          artPlayerRef.current,
          availableSources.map((s) => ({
            source: s.source,
            episodeUrl: s.episodes?.[currentEpisodeIndex] || '',
            url: s.episodes?.[currentEpisodeIndex] || '',
          }))
        );

        // 监听切换事件
        autoSourceSwitcherRef.current.on('switch-start', (data: any) => {
          console.log('🔄 开始切换源:', data);
          setVideoLoadingStage('sourceChanging');
          setIsVideoLoading(true);
        });

        autoSourceSwitcherRef.current.on('switch-success', (data: any) => {
          console.log('✅ 源切换成功:', data);
          setIsVideoLoading(false);

          // 更新当前源信息
          if (data.source?.source) {
            setCurrentSource(data.source.source.name || '');
            setCurrentId(data.source.source.id || '');
          }

          // 记录到性能监控
          // TODO: 等待TypeScript类型更新后启用
          // performanceMonitor.recordSourceSwitch({
          //   timestamp: Date.now(),
          //   fromSource: currentSourceRef.current || 'unknown',
          //   toSource: data.source?.episodeUrl || 'unknown',
          //   reason: 'auto_switch',
          //   success: true,
          //   duration: data.duration || 0,
          //   loadDuration: 0,
          //   networkQuality: networkQualityRef.current,
          // });
        });

        autoSourceSwitcherRef.current.on('switch-failed', (data: any) => {
          console.error('❌ 源切换失败:', data);
          setIsVideoLoading(false);
        });

        autoSourceSwitcherRef.current.on('all-sources-failed', (data: any) => {
          console.error('❌ 所有源都失败了:', data);
          setAllSourcesFailed(true);
          setIsVideoLoading(false);

          // 根据情况显示不同的错误消息
          if (data.hasValidSources === false || data.availableSources === 0) {
            // 没有有效源时显示"无可用播放源"致命错误
            console.error('[PlayPage] 没有任何有效的播放源');
            showFatalError({
              title: '无可用播放源',
              message: '所有播放源都已失败或URL格式不正确，无法继续播放',
              suggestion: '请稍后重试或联系管理员',
              enableCleanup: true,
              refreshTimeout: 3000,
              showFallbackButton: true,
            });
          } else {
            // 有有效源但都失败时显示通知
            console.warn('[PlayPage] 有可用源但自动切换失败，显示错误提示');
            if (artPlayerRef.current?.notice) {
              artPlayerRef.current.notice.show(
                '所有播放源都不可用，请稍后重试或刷新页面',
                5000
              );
            }

            // 也可以选择显示致命错误弹窗
            showFatalError({
              title: '播放失败',
              message: `已尝试 ${data.switchAttempts} 次切换源，但都失败了`,
              suggestion: '请刷新页面重试或稍后再试',
              enableCleanup: true,
              refreshTimeout: 3000,
              showFallbackButton: true,
            });
          }
        });

        // 更新网络质量
        autoSourceSwitcherRef.current.updateNetworkQuality(
          networkQualityRef.current
        );

        // 启动自动切换
        autoSourceSwitcherRef.current.start();

        console.log('✅ 自动源切换器已启动');
      }

      // 错误处理由全局系统管理
    } catch (err) {
      console.error('创建播放器失败:', err);
      setError('播放器初始化失败');

      // 增强错误处理，尝试重新初始化
      setTimeout(() => {
        if (!loading && videoUrl && artRef.current) {
          console.log('尝试重新初始化播放器...');
          // 重置播放器引用
          artPlayerRef.current = null;
          // 触发重新渲染
          setVideoUrl('');
          setTimeout(() => setVideoUrl(videoUrl), 100);
        }
      }, 2000);
    } finally {
      // 错误处理器由全局系统管理，无需恢复
    }
  }, [Artplayer, Hls, videoUrl, loading, blockAdEnabled]);

  // 当组件卸载时清理定时器和恢复原始处理器
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
      if (saveProgressDebounceRef.current) {
        clearTimeout(saveProgressDebounceRef.current);
      }
      if (playbackRecoveryRef.current) {
        clearTimeout(playbackRecoveryRef.current);
      }
      if (rebuildTimeoutRef.current) {
        clearTimeout(rebuildTimeoutRef.current);
      }

      // 清理网络监控定时器
      if (networkQualityIntervalRef.current) {
        clearInterval(networkQualityIntervalRef.current);
        networkQualityIntervalRef.current = null;
      }
      if (networkMonitorIntervalRef.current) {
        clearInterval(networkMonitorIntervalRef.current);
        networkMonitorIntervalRef.current = null;
      }

      // 清理自动源切换器
      if (autoSourceSwitcherRef.current) {
        autoSourceSwitcherRef.current.destroy();
        autoSourceSwitcherRef.current = null;
        console.log('✅ 自动源切换器已清理');
      }

      // 确保播放器完全销毁
      if (artPlayerRef.current) {
        try {
          // 销毁HLS实例
          if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
            artPlayerRef.current.video.hls.destroy();
          }
          // 销毁播放器
          artPlayerRef.current.destroy();
        } catch (e) {
          console.warn('播放器销毁失败:', e);
        } finally {
          artPlayerRef.current = null;
          // 清理全局实例引用
          if (
            typeof window !== 'undefined' &&
            (window as any).artPlayerInstance
          ) {
            (window as any).artPlayerInstance = null;
          }
        }
      }

      // 恢复原始的错误处理器
      window.onerror = null;
      window.onunhandledrejection = null;
    };
  }, []);

  // 添加一个额外的useEffect来处理页面可见性变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // 页面隐藏时保存播放进度
        saveCurrentPlayProgress(true);
      } else if (document.visibilityState === 'visible') {
        // 页面重新可见时，如果播放器存在则刷新状态
        if (artPlayerRef.current) {
          // 确保播放器状态正确
          console.log('页面重新可见，播放器状态已刷新');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 监听页面卸载事件
    const handleBeforeUnload = () => {
      // 确保在页面卸载前销毁播放器
      if (artPlayerRef.current) {
        try {
          if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
            artPlayerRef.current.video.hls.destroy();
          }
          artPlayerRef.current.destroy();
        } catch (e) {
          console.warn('页面卸载时播放器销毁失败:', e);
        } finally {
          artPlayerRef.current = null;
          // 清理全局实例引用
          if (
            typeof window !== 'undefined' &&
            (window as any).artPlayerInstance
          ) {
            (window as any).artPlayerInstance = null;
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  if (!mounted || loading) {
    return (
      <PageLayout activePath='/play'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 动画影院图标 */}
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <div className='text-white text-4xl'>
                  {loadingStage === 'searching' && '🔍'}
                  {loadingStage === 'preferring' && '⚡'}
                  {loadingStage === 'fetching' && '🎬'}
                  {loadingStage === 'ready' && '✨'}
                </div>
                {/* 旋转光环 */}
                <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
              </div>

              {/* 浮动粒子效果 */}
              <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                <div className='absolute top-2 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce'></div>
                <div
                  className='absolute top-4 right-4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce'
                  style={{ animationDelay: '0.5s' }}
                ></div>
                <div
                  className='absolute bottom-3 left-6 w-1 h-1 bg-lime-400 rounded-full animate-bounce'
                  style={{ animationDelay: '1s' }}
                ></div>
              </div>
            </div>

            {/* 进度指示器 */}
            <div className='mb-6 w-80 mx-auto'>
              <div className='flex justify-center space-x-2 mb-4'>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    loadingStage === 'searching' || loadingStage === 'fetching'
                      ? 'bg-green-500 scale-125'
                      : loadingStage === 'preferring' ||
                        loadingStage === 'ready'
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                ></div>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    loadingStage === 'preferring'
                      ? 'bg-green-500 scale-125'
                      : loadingStage === 'ready'
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                ></div>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    loadingStage === 'ready'
                      ? 'bg-green-500 scale-125'
                      : 'bg-gray-300'
                  }`}
                ></div>
              </div>

              {/* 进度条 */}
              <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden'>
                <div
                  className='h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-1000 ease-out'
                  style={{
                    width:
                      loadingStage === 'searching' ||
                      loadingStage === 'fetching'
                        ? '33%'
                        : loadingStage === 'preferring'
                        ? '66%'
                        : '100%',
                  }}
                ></div>
              </div>
            </div>

            {/* 加载消息 */}
            <div className='space-y-2'>
              <p className='text-xl font-semibold text-gray-800 dark:text-gray-200 animate-pulse'>
                {loadingMessage}
              </p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout activePath='/play'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 错误图标 */}
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <div className='text-white text-4xl'>😵</div>
                {/* 脉冲效果 */}
                <div className='absolute -inset-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl opacity-20 animate-pulse'></div>
              </div>

              {/* 浮动错误粒子 */}
              <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                <div className='absolute top-2 left-2 w-2 h-2 bg-red-400 rounded-full animate-bounce'></div>
                <div
                  className='absolute top-4 right-4 w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce'
                  style={{ animationDelay: '0.5s' }}
                ></div>
                <div
                  className='absolute bottom-3 left-6 w-1 h-1 bg-yellow-400 rounded-full animate-bounce'
                  style={{ animationDelay: '1s' }}
                ></div>
              </div>
            </div>

            {/* 错误信息 */}
            <div className='space-y-4 mb-8'>
              <h2 className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
                哎呀，出现了一些问题
              </h2>
              <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4'>
                <p className='text-red-600 dark:text-red-400 font-medium'>
                  {error}
                </p>
              </div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                请检查网络连接或尝试刷新页面
              </p>
            </div>

            {/* 操作按钮 */}
            <div className='space-y-3'>
              <button
                onClick={() =>
                  videoTitle
                    ? router.push(`/search?q=${encodeURIComponent(videoTitle)}`)
                    : router.back()
                }
                className='w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl'
              >
                {videoTitle ? '🔍 返回搜索' : '← 返回上页'}
              </button>

              <button
                onClick={() => window.location.reload()}
                className='w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200'
              >
                🔄 重新尝试
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/play'>
      <div className='flex flex-col gap-3 py-4 px-5 lg:px-[3rem] 2xl:px-20'>
        {/* 第一行：影片标题 */}
        <div className='py-1'>
          <h1 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
            {videoTitle || '影片标题'}
            {totalEpisodes > 1 && (
              <span className='text-gray-500 dark:text-gray-400'>
                {` > 第 ${currentEpisodeIndex + 1} 集`}
              </span>
            )}
          </h1>
        </div>
        {/* 第二行：播放器和选集 */}
        <div className='space-y-2'>
          {/* 折叠控制 - 仅在 lg 及以上屏幕显示 */}
          <div className='hidden lg:flex justify-end'>
            <button
              onClick={() =>
                setIsEpisodeSelectorCollapsed(!isEpisodeSelectorCollapsed)
              }
              className='group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200'
              title={
                isEpisodeSelectorCollapsed ? '显示选集面板' : '隐藏选集面板'
              }
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                  isEpisodeSelectorCollapsed ? 'rotate-180' : 'rotate-0'
                }`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 5l7 7-7 7'
                />
              </svg>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-300'>
                {isEpisodeSelectorCollapsed ? '显示' : '隐藏'}
              </span>

              {/* 精致的状态指示点 */}
              <div
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full transition-all duration-200 ${
                  isEpisodeSelectorCollapsed
                    ? 'bg-orange-400 animate-pulse'
                    : 'bg-green-400'
                }`}
              ></div>
            </button>
          </div>

          <div
            className={`grid gap-4 lg:h-[500px] xl:h-[650px] 2xl:h-[750px] transition-all duration-300 ease-in-out ${
              isEpisodeSelectorCollapsed
                ? 'grid-cols-1'
                : 'grid-cols-1 md:grid-cols-4'
            }`}
          >
            {/* 播放器 */}
            <div
              className={`h-full transition-all duration-300 ease-in-out rounded-xl border border-white/0 dark:border-white/30 ${
                isEpisodeSelectorCollapsed ? 'col-span-1' : 'md:col-span-3'
              }`}
            >
              <div className='relative w-full h-[300px] lg:h-full'>
                <div
                  ref={artRef}
                  className='bg-black w-full h-full rounded-xl overflow-hidden shadow-lg'
                ></div>

                {/* 自定义简易控制栏 */}
                <div className='absolute bottom-0 right-0 z-[550] flex items-center gap-2 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-tl-md'>
                  {isPiPSupported && (
                    <button
                      onClick={handleTogglePictureInPicture}
                      className={`text-sm px-2 py-1 transition-colors ${
                        isPiPActive
                          ? 'text-green-400 hover:text-green-300'
                          : 'text-white/90 hover:text-white'
                      }`}
                      aria-label={isPiPActive ? '退出画中画' : '进入画中画'}
                      title={isPiPActive ? '退出画中画' : '进入画中画'}
                    >
                      {isPiPActive ? '退出画中画' : '画中画'}
                    </button>
                  )}
                  <button
                    onClick={handleSpeedCycle}
                    className='text-white/90 hover:text-white text-sm px-2 py-1'
                    aria-label='倍速'
                  >
                    倍速
                  </button>
                  <button
                    onClick={handleToggleFullscreen}
                    className='text-white/90 hover:text-white text-sm px-2 py-1'
                    aria-label='全屏'
                  >
                    全屏
                  </button>
                </div>

                {/* 换源加载蒙层 */}
                {isVideoLoading && (
                  <div className='absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl flex items-center justify-center z-[500] transition-all duration-300'>
                    <div className='text-center max-w-md mx-auto px-6'>
                      {/* 动画影院图标 */}
                      <div className='relative mb-8'>
                        <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                          <div className='text-white text-4xl'>🎬</div>
                          {/* 旋转光环 */}
                          <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
                        </div>

                        {/* 浮动粒子效果 */}
                        <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                          <div className='absolute top-2 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce'></div>
                          <div
                            className='absolute top-4 right-4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce'
                            style={{ animationDelay: '0.5s' }}
                          ></div>
                          <div
                            className='absolute bottom-3 left-6 w-1 h-1 bg-lime-400 rounded-full animate-bounce'
                            style={{ animationDelay: '1s' }}
                          ></div>
                        </div>
                      </div>

                      {/* 换源消息 */}
                      <div className='space-y-2'>
                        <p className='text-xl font-semibold text-white animate-pulse'>
                          {videoLoadingStage === 'sourceChanging'
                            ? '🔄 切换播放源...'
                            : '🔄 视频加载中...'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* HLS错误/恢复提示 */}
                {showHlsErrorTip && hlsErrorDetails && (
                  <div
                    className={`absolute top-4 right-4 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-lg z-[600] transition-all duration-300 max-w-sm ${
                      hlsErrorDetails.type === '播放恢复'
                        ? 'bg-green-500/90'
                        : hlsErrorDetails.type === '播放失败'
                        ? 'bg-red-500/90'
                        : 'bg-orange-500/90'
                    }`}
                  >
                    <div className='flex items-start space-x-3'>
                      <span className='text-lg'>
                        {hlsErrorDetails.type === '播放恢复'
                          ? '✅'
                          : hlsErrorDetails.type === '播放失败'
                          ? '❌'
                          : '⚠️'}
                      </span>
                      <div className='flex-1'>
                        <div className='flex items-center justify-between mb-1'>
                          <p className='text-sm font-medium'>
                            {hlsErrorDetails.type}
                          </p>
                          <button
                            onClick={() => {
                              setShowHlsErrorTip(false);
                              setHlsErrorDetails(null);
                            }}
                            className='ml-2 text-white/80 hover:text-white text-sm'
                          >
                            ✕
                          </button>
                        </div>
                        <p className='text-xs opacity-90 mb-2'>
                          {hlsErrorDetails.message}
                        </p>
                        <p className='text-xs opacity-75'>
                          {hlsErrorDetails.suggestion}
                        </p>
                        {hlsErrorDetails.type === '播放失败' && (
                          <div className='mt-3'>
                            <button
                              onClick={() => {
                                // 重新加载页面以重试播放
                                window.location.reload();
                              }}
                              className='bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded transition-colors duration-200'
                            >
                              重新加载
                            </button>
                          </div>
                        )}
                        {hlsErrorCount > 0 &&
                          hlsErrorDetails.type !== '播放恢复' &&
                          hlsErrorDetails.type !== '播放失败' && (
                            <div className='mt-2 flex items-center space-x-2'>
                              <div className='flex space-x-1'>
                                {Array.from({
                                  length: Math.min(hlsErrorCount, 5),
                                }).map((_, i) => (
                                  <div
                                    key={i}
                                    className='w-1 h-1 bg-white/60 rounded-full animate-pulse'
                                    style={{ animationDelay: `${i * 0.2}s` }}
                                  />
                                ))}
                              </div>
                              <span className='text-xs opacity-60'>
                                错误次数: {hlsErrorCount}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 网络状态指示器 */}
                {networkStatus === 'offline' && (
                  <div className='absolute top-4 left-4 bg-red-500/90 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-lg z-[600] transition-all duration-300'>
                    <div className='flex items-center space-x-2'>
                      <span className='text-sm'>🚫</span>
                      <div>
                        <p className='text-sm font-medium'>网络连接断开</p>
                        <p className='text-xs opacity-90'>请检查网络连接</p>
                      </div>
                    </div>
                  </div>
                )}

                {networkStatus === 'unstable' && (
                  <div className='absolute top-4 left-4 bg-yellow-500/90 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-lg z-[600] transition-all duration-300'>
                    <div className='flex items-center space-x-2'>
                      <span className='text-sm'>⚠️</span>
                      <div>
                        <p className='text-sm font-medium'>网络不稳定</p>
                        <p className='text-xs opacity-90'>可能影响播放效果</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 选集和换源 - 在移动端始终显示，在 lg 及以上可折叠 */}
            <div
              className={`h-[400px] lg:h-full md:overflow-hidden transition-all duration-300 ease-in-out ${
                isEpisodeSelectorCollapsed
                  ? 'md:col-span-1 lg:hidden lg:opacity-0 lg:scale-95'
                  : 'md:col-span-1 lg:opacity-100 lg:scale-100'
              }`}
            >
              <EpisodeSelector
                totalEpisodes={totalEpisodes}
                value={currentEpisodeIndex + 1}
                onChange={handleEpisodeChange}
                onSourceChange={handleSourceChange}
                currentSource={currentSource}
                currentId={currentId}
                videoTitle={searchTitle || videoTitle}
                availableSources={availableSources}
                sourceSearchLoading={sourceSearchLoading}
                sourceSearchError={sourceSearchError}
                precomputedVideoInfo={precomputedVideoInfo}
                onTestAllSources={handleTestAllSources}
                testingSources={isTestingAllSources}
                currentDetail={detail}
                favorited={favorited}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayPageClient />
    </Suspense>
  );
}
