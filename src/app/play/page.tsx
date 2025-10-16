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
import { Suspense, useEffect, useRef, useState } from 'react';

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
import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8 } from '@/lib/utils';

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

  // 网络状态监控
  const [networkStatus, setNetworkStatus] = useState<
    'online' | 'offline' | 'unstable'
  >('online');
  const networkRetryCountRef = useRef<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const lastNetworkCheckRef = useRef<number>(0);

  // 网络状态检测和恢复
  useEffect(() => {
    let networkCheckInterval: NodeJS.Timeout | null = null;

    const checkNetworkStability = async () => {
      try {
        const start = Date.now();
        await fetch('/api/server-config', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000),
        });
        const latency = Date.now() - start;

        if (latency > 3000) {
          setNetworkStatus('unstable');
        } else {
          setNetworkStatus('online');
          networkRetryCountRef.current = 0;
        }
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
    };

    // 监听网络状态变化
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 定期检查网络稳定性
    networkCheckInterval = setInterval(checkNetworkStability, 30000);

    // 初始检查
    checkNetworkStability();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (networkCheckInterval) {
        clearInterval(networkCheckInterval);
      }
    };
  }, []);

  // 监听HLS错误计数，当错误过多时显示提示
  useEffect(() => {
    if (hlsErrorCount > 5) {
      setShowHlsErrorTip(true);
      // 5秒后自动隐藏提示
      const timer = setTimeout(() => {
        setShowHlsErrorTip(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [hlsErrorCount]);

  // 播放进度保存相关
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  const saveProgressDebounceRef = useRef<NodeJS.Timeout | null>(null);
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
  const handleVolumeChange = (delta: number) => {
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

  // 检测 PiP 支持
  useEffect(() => {
    const checkPiPSupport = () => {
      if (typeof window === 'undefined') return;

      const video = document.createElement('video');
      const hasStandardPiP = 'pictureInPictureEnabled' in document;
      const hasSafariPiP = 'webkitSetPresentationMode' in video;

      setIsPiPSupported(hasStandardPiP || hasSafariPiP);
    };

    checkPiPSupport();
  }, []);

  // 监听 PiP 状态变化
  useEffect(() => {
    if (!isPiPSupported) return;

    const handlePiPChange = () => {
      const video = artPlayerRef.current?.video as HTMLVideoElement;
      if (!video) return;

      // Safari 专用状态检测
      // @ts-ignore
      if (typeof video.webkitPresentationMode !== 'undefined') {
        // @ts-ignore
        setIsPiPActive(video.webkitPresentationMode === 'picture-in-picture');
        return;
      }

      // 标准 PiP 状态检测
      setIsPiPActive(document.pictureInPictureElement === video);
    };

    const video = artPlayerRef.current?.video as HTMLVideoElement;
    if (video) {
      // Safari 事件监听
      // @ts-ignore
      if (typeof video.webkitpresentationmodechanged !== 'undefined') {
        // @ts-ignore
        video.addEventListener(
          'webkitpresentationmodechanged',
          handlePiPChange
        );
      }

      // 标准 PiP 事件监听
      video.addEventListener('enterpictureinpicture', handlePiPChange);
      video.addEventListener('leavepictureinpicture', handlePiPChange);

      return () => {
        // @ts-ignore
        video.removeEventListener(
          'webkitpresentationmodechanged',
          handlePiPChange
        );
        video.removeEventListener('enterpictureinpicture', handlePiPChange);
        video.removeEventListener('leavepictureinpicture', handlePiPChange);
      };
    }
  }, [isPiPSupported, artPlayerRef.current]);

  // 画中画切换
  const handleTogglePictureInPicture = async () => {
    try {
      const p = artPlayerRef.current;
      if (!p || !p.video) return;
      const video = p.video as HTMLVideoElement;

      // iOS Safari 专用接口 - 优先使用
      // @ts-ignore
      if (typeof video.webkitSetPresentationMode === 'function') {
        // @ts-ignore
        const currentMode = video.webkitPresentationMode;
        const targetMode =
          currentMode === 'picture-in-picture'
            ? 'inline'
            : 'picture-in-picture';

        // @ts-ignore
        video.webkitSetPresentationMode(targetMode);

        // 提供用户反馈
        const notice = (p as any).notice;
        if (notice && typeof notice.show === 'function') {
          notice.show(
            targetMode === 'picture-in-picture' ? '进入画中画' : '退出画中画'
          );
        }
        return;
      }

      // 标准 PiP API
      if (document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await (document as any).exitPictureInPicture?.();
          const notice = (p as any).notice;
          if (notice && typeof notice.show === 'function') {
            notice.show('退出画中画');
          }
        } else {
          // 确保视频已准备好
          if (video.readyState < 2) {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('视频加载超时'));
              }, 5000);

              const onCanPlay = () => {
                clearTimeout(timeout);
                video.removeEventListener('canplay', onCanPlay);
                video.removeEventListener('error', onError);
                resolve(null);
              };

              const onError = () => {
                clearTimeout(timeout);
                video.removeEventListener('canplay', onCanPlay);
                video.removeEventListener('error', onError);
                reject(new Error('视频加载失败'));
              };

              video.addEventListener('canplay', onCanPlay, { once: true });
              video.addEventListener('error', onError, { once: true });
            });
          }

          await (video as any).requestPictureInPicture?.();
          const notice = (p as any).notice;
          if (notice && typeof notice.show === 'function') {
            notice.show('进入画中画');
          }
        }
      } else {
        const notice = (p as any).notice;
        if (notice && typeof notice.show === 'function') {
          notice.show('当前浏览器不支持画中画');
        }
      }
    } catch (e) {
      console.warn('画中画切换失败:', e);
      const p = artPlayerRef.current as any;
      const notice = p?.notice;
      if (notice && typeof notice.show === 'function') {
        notice.show('切换画中画失败，请重试');
      }
    }
  };

  // -----------------------------------------------------------------------------
  // 工具函数（Utils）
  // -----------------------------------------------------------------------------

  // 播放源优选函数
  const preferBestSource = async (
    sources: SearchResult[]
  ): Promise<SearchResult> => {
    if (sources.length === 1) return sources[0];

    // 将播放源均分为两批，并发测速各批，避免一次性过多请求
    const batchSize = Math.ceil(sources.length / 2);
    const allResults: Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
    } | null> = [];

    for (let start = 0; start < sources.length; start += batchSize) {
      const batchSources = sources.slice(start, start + batchSize);
      const batchResults = await Promise.all(
        batchSources.map(async (source) => {
          try {
            // 检查是否有第一集的播放地址
            if (!source.episodes || source.episodes.length === 0) {
              console.warn(`播放源 ${source.source_name} 没有可用的播放地址`);
              return null;
            }

            const episodeUrl =
              source.episodes.length > 1
                ? source.episodes[1]
                : source.episodes[0];
            const testResult = await getVideoResolutionFromM3u8(episodeUrl);

            return {
              source,
              testResult,
            };
          } catch (error) {
            return null;
          }
        })
      );
      allResults.push(...batchResults);
    }

    // 等待所有测速完成，包含成功和失败的结果
    // 保存所有测速结果到 precomputedVideoInfo，供 EpisodeSelector 使用（包含错误结果）
    const newVideoInfoMap = new Map<
      string,
      {
        quality: string;
        loadSpeed: string;
        pingTime: number;
        hasError?: boolean;
      }
    >();
    allResults.forEach((result, index) => {
      const source = sources[index];
      const sourceKey = `${source.source}-${source.id}`;

      if (result) {
        // 成功的结果
        newVideoInfoMap.set(sourceKey, result.testResult);
      }
    });

    // 过滤出成功的结果用于优选计算
    const successfulResults = allResults.filter(Boolean) as Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
    }>;

    setPrecomputedVideoInfo(newVideoInfoMap);

    if (successfulResults.length === 0) {
      console.warn('所有播放源测速都失败，使用第一个播放源');
      return sources[0];
    }

    // 找出所有有效速度的最大值，用于线性映射
    const validSpeeds = successfulResults
      .map((result) => {
        const speedStr = result.testResult.loadSpeed;
        if (speedStr === '未知' || speedStr === '测量中...') return 0;

        const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2];
        return unit === 'MB/s' ? value * 1024 : value; // 统一转换为 KB/s
      })
      .filter((speed) => speed > 0);

    const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024; // 默认1MB/s作为基准

    // 找出所有有效延迟的最小值和最大值，用于线性映射
    const validPings = successfulResults
      .map((result) => result.testResult.pingTime)
      .filter((ping) => ping > 0);

    const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
    const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

    // 计算每个结果的评分
    const resultsWithScore = successfulResults.map((result) => ({
      ...result,
      score: calculateSourceScore(
        result.testResult,
        maxSpeed,
        minPing,
        maxPing
      ),
    }));

    // 按综合评分排序，选择最佳播放源
    resultsWithScore.sort((a, b) => b.score - a.score);

    console.log('播放源评分排序结果:');
    resultsWithScore.forEach((result, index) => {
      console.log(
        `${index + 1}. ${
          result.source.source_name
        } - 评分: ${result.score.toFixed(2)} (${result.testResult.quality}, ${
          result.testResult.loadSpeed
        }, ${result.testResult.pingTime}ms)`
      );
    });

    return resultsWithScore[0].source;
  };

  // 计算播放源综合评分
  const calculateSourceScore = (
    testResult: {
      quality: string;
      loadSpeed: string;
      pingTime: number;
    },
    maxSpeed: number,
    minPing: number,
    maxPing: number
  ): number => {
    let score = 0;

    // 分辨率评分 (40% 权重)
    const qualityScore = (() => {
      switch (testResult.quality) {
        case '4K':
          return 100;
        case '2K':
          return 85;
        case '1080p':
          return 75;
        case '720p':
          return 60;
        case '480p':
          return 40;
        case 'SD':
          return 20;
        default:
          return 0;
      }
    })();
    score += qualityScore * 0.4;

    // 下载速度评分 (40% 权重) - 基于最大速度线性映射
    const speedScore = (() => {
      const speedStr = testResult.loadSpeed;
      if (speedStr === '未知' || speedStr === '测量中...') return 30;

      // 解析速度值
      const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
      if (!match) return 30;

      const value = parseFloat(match[1]);
      const unit = match[2];
      const speedKBps = unit === 'MB/s' ? value * 1024 : value;

      // 基于最大速度线性映射，最高100分
      const speedRatio = speedKBps / maxSpeed;
      return Math.min(100, Math.max(0, speedRatio * 100));
    })();
    score += speedScore * 0.4;

    // 网络延迟评分 (20% 权重) - 基于延迟范围线性映射
    const pingScore = (() => {
      const ping = testResult.pingTime;
      if (ping <= 0) return 0; // 无效延迟给默认分

      // 如果所有延迟都相同，给满分
      if (maxPing === minPing) return 100;

      // 线性映射：最低延迟=100分，最高延迟=0分
      const pingRatio = (maxPing - ping) / (maxPing - minPing);
      return Math.min(100, Math.max(0, pingRatio * 100));
    })();
    score += pingScore * 0.2;

    return Math.round(score * 100) / 100; // 保留两位小数
  };

  // 更新视频地址
  const updateVideoUrl = (
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
      setVideoUrl(newUrl);
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
        return;
      }
      setLoading(true);
      setLoadingStage(currentSource && currentId ? 'fetching' : 'searching');
      setLoadingMessage(
        currentSource && currentId
          ? '🎬 正在获取视频详情...'
          : '🔍 正在搜索播放源...'
      );

      let sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);
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

        detailData = await preferBestSource(sourcesInfo);
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

    // 增强的全局错误处理器，防止 composedPath 和其他兼容性错误
    const originalError = window.onerror;
    const originalUnhandledRejection = window.onunhandledrejection;

    // 定义需要静默处理的错误模式 - 扩展错误模式覆盖
    const silentErrorPatterns = [
      'composedPath',
      'undefined is not an object',
      'Cannot read property',
      'Cannot read properties',
      'TypeError: undefined is not an object',
      'TypeError: null is not an object',
      'event.composedPath is not a function',
      'event.composedPath is not defined',
      'target.composedPath',
      'TypeError: e.composedPath',
      'ReferenceError',
      'target is not defined',
      'path.composedPath',
      'composedPath of undefined',
      'composedPath of null',
      'event is undefined',
      'event is null',
      'event.path is undefined',
      'event.target is undefined',
      'path.push is not a function',
      'parentNode is undefined',
    ];

    const shouldSilenceError = (message: string) => {
      return silentErrorPatterns.some((pattern) =>
        message.toLowerCase().includes(pattern.toLowerCase())
      );
    };

    window.onerror = (message, source, lineno, colno, error) => {
      const messageStr = String(message || '');
      if (shouldSilenceError(messageStr)) {
        console.warn('静默处理兼容性错误:', messageStr);
        return true; // 阻止错误继续传播
      }
      if (originalError) {
        return originalError(message, source, lineno, colno, error);
      }
      return false;
    };

    window.onunhandledrejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const reasonStr = reason
        ? String(reason.message || reason.toString?.() || reason)
        : '';
      if (shouldSilenceError(reasonStr)) {
        console.warn('静默处理兼容性Promise错误:', reasonStr);
        event.preventDefault();
        return;
      }
      if (originalUnhandledRejection) {
        return originalUnhandledRejection.call(window, event);
      }
    };

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

    // 保存原始的 console.error 以便后续恢复
    const originalConsoleError = console.error;

    // 保存原始的 addEventListener (备用)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const originalAddEventListener = EventTarget.prototype.addEventListener;

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
                  Object.defineProperty(event, 'composedPath', {
                    value: function () {
                      try {
                        const path = [];
                        let current = this.target;
                        while (current && current.nodeType) {
                          path.push(current);
                          current = current.parentNode || current.host;
                        }
                        return path;
                      } catch (e) {
                        return [];
                      }
                    },
                    writable: false,
                    enumerable: false,
                    configurable: true,
                  });
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

      // 添加全局错误处理，防止 composedPath 等错误
      console.error = (...args) => {
        // 过滤掉 composedPath 相关的错误，避免控制台污染
        const errorMessage = args.join(' ');
        if (
          errorMessage.includes('composedPath') ||
          errorMessage.includes('undefined is not an object') ||
          (errorMessage.includes('Cannot read property') &&
            errorMessage.includes('composedPath')) ||
          (errorMessage.includes('TypeError') &&
            errorMessage.includes('composedPath'))
        ) {
          console.warn('Filtered composedPath related error:', ...args);
          return;
        }
        originalConsoleError.apply(console, args);
      };

      // 增强的 Event.prototype.composedPath 兼容性处理
      if (typeof Event !== 'undefined' && Event.prototype) {
        const originalComposedPath = Event.prototype.composedPath;

        // 安全的composedPath实现
        const safeComposedPathImpl = function (this: Event) {
          try {
            const path = [];
            let current = this?.target as any;

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
              const target = this?.target;
              return target ? [target] : [];
            } catch (e) {
              return [];
            }
          }
        };

        // 检查是否需要添加或替换 composedPath 方法
        if (typeof originalComposedPath !== 'function') {
          // 不存在composedPath方法，添加实现
          Object.defineProperty(Event.prototype, 'composedPath', {
            value: safeComposedPathImpl,
            writable: false,
            enumerable: false, // 确保不影响for...in循环
            configurable: true,
          });
          console.log('✅ 已添加 Event.prototype.composedPath 兼容性实现');
        } else {
          // 已存在，包装原始方法确保安全性
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
        }
      }

      // 增强的事件安全包装器函数 (备用)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const createSafeEventHandler = (handler: (e: any) => void) => {
        return playerEventWrapper.wrapEventListener(handler);
      };

      // 添加额外的事件兜底包装器
      const safeguardEventHandler = (originalHandler: (e: any) => void) => {
        return function (this: any, event: any) {
          try {
            // 为事件对象提供安全保护
            if (event && typeof event === 'object') {
              // 确保 composedPath 方法存在且安全
              if (typeof event.composedPath !== 'function') {
                Object.defineProperty(event, 'composedPath', {
                  value: function () {
                    try {
                      const path = [];
                      let current = this.target;
                      while (current && current.nodeType) {
                        path.push(current);
                        current = current.parentNode || current.host;
                      }
                      return path;
                    } catch (e) {
                      return [];
                    }
                  },
                  writable: false,
                  enumerable: false,
                  configurable: true,
                });
              }

              // 确保target属性安全
              if (!event.target && event.currentTarget) {
                Object.defineProperty(event, 'target', {
                  value: event.currentTarget,
                  writable: false,
                  enumerable: false,
                  configurable: true,
                });
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
          m3u8: function (video: HTMLVideoElement, url: string) {
            if (!Hls) {
              console.error('HLS.js 未加载');
              return;
            }

            if (video.hls) {
              video.hls.destroy();
            }
            const hls = new Hls({
              debug: false, // 关闭日志
              enableWorker: true, // WebWorker 解码，降低主线程压力
              lowLatencyMode: true, // 开启低延迟 LL-HLS

              /* 缓冲/内存相关 */
              maxBufferLength: 30, // 前向缓冲最大 30s，过大容易导致高延迟
              backBufferLength: 30, // 仅保留 30s 已播放内容，避免内存占用
              maxBufferSize: 60 * 1000 * 1000, // 约 60MB，超出后触发清理

              /* 网络和超时配置 - 针对不稳定网络优化 */
              fragLoadingTimeOut: 25000, // 片段加载超时时间增加到25秒
              manifestLoadingTimeOut: 15000, // manifest加载超时时间增加
              levelLoadingTimeOut: 15000, // 级别加载超时时间增加
              maxLoadingDelay: 6, // 最大加载延迟增加
              maxBufferHole: 1.0, // 允许更大的缓冲空洞
              highBufferWatchdogPeriod: 3, // 高缓冲监控周期增加
              nudgeOffset: 0.1, // 添加微调偏移

              /* 重试配置 - 更激进的重试策略 */
              fragLoadingMaxRetry: 8, // 片段加载最大重试次数增加
              manifestLoadingMaxRetry: 6, // manifest加载最大重试次数增加
              levelLoadingMaxRetry: 6, // 级别加载最大重试次数增加
              fragLoadingRetryDelay: 500, // 片段加载重试延迟减少，更快重试
              manifestLoadingRetryDelay: 800, // manifest加载重试延迟
              levelLoadingRetryDelay: 800, // 级别加载重试延迟

              /* 网络适应性配置 */
              maxMaxBufferLength: 600, // 最大缓冲长度上限
              startFragPrefetch: true, // 启用片段预取

              /* 自定义loader */
              loader: blockAdEnabledRef.current
                ? CustomHlsJsLoader
                : Hls.DefaultConfig.loader,
            });

            hls.loadSource(url);
            hls.attachMedia(video);
            video.hls = hls;

            // 错误重试计数器
            let errorRetryCount = 0;
            const maxRetries = 3;

            hls.on(Hls.Events.ERROR, function (event: any, data: any) {
              console.error('HLS Error:', event, data);

              // 增加错误计数
              setHlsErrorCount((prev) => prev + 1);

              // 处理非致命错误
              if (!data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    if (data.details === 'fragLoadTimeOut') {
                      console.log('片段加载超时，尝试重新加载...');
                      // 对于超时错误，尝试重新加载
                      hls.startLoad();
                    } else {
                      console.log('网络错误，尝试恢复...');
                      hls.startLoad();
                    }
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log('媒体错误，尝试恢复...');
                    hls.recoverMediaError();
                    break;
                  default:
                    console.log('非致命错误，继续播放...');
                    break;
                }
                return; // 非致命错误处理完毕，直接返回
              }

              // 处理致命错误
              if (data.fatal) {
                errorRetryCount++;
                console.log(
                  `致命错误重试 ${errorRetryCount}/${maxRetries}:`,
                  data.type,
                  data.details
                );

                if (errorRetryCount <= maxRetries) {
                  switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR: {
                      console.log('致命网络错误，尝试恢复...');
                      // 使用指数退避延迟重试
                      const retryDelay = Math.min(
                        1000 * Math.pow(2, errorRetryCount - 1),
                        5000
                      );
                      setTimeout(() => {
                        hls.startLoad();
                      }, retryDelay);
                      break;
                    }
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      console.log('致命媒体错误，尝试恢复...');
                      hls.recoverMediaError();
                      break;
                    default:
                      console.log('无法恢复的致命错误');
                      hls.destroy();
                      break;
                  }
                } else {
                  console.error('达到最大重试次数，停止重试');
                  hls.destroy();
                }
              }
            });

            // 监听成功事件，重置错误计数器
            hls.on(Hls.Events.FRAG_LOADED, function () {
              errorRetryCount = 0; // 重置错误计数器
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
        safeguardEventHandler((_e: any) => {
          setError(null);
          console.log('🎯 播放器就绪');
        })
      );

      artPlayerRef.current.on(
        'video:volumechange',
        safeguardEventHandler((_e: any) => {
          lastVolumeRef.current = artPlayerRef.current.volume;
        })
      );

      // 监听视频可播放事件，这时恢复播放进度更可靠
      artPlayerRef.current.on(
        'video:canplay',
        safeguardEventHandler((_e: any) => {
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
        })
      );

      artPlayerRef.current.on(
        'error',
        safeguardEventHandler((err: any) => {
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
        })
      );

      // 监听视频播放结束事件，自动播放下一集
      artPlayerRef.current.on(
        'video:ended',
        safeguardEventHandler((_e: any) => {
          const d = detailRef.current;
          const idx = currentEpisodeIndexRef.current;
          if (d && d.episodes && idx < d.episodes.length - 1) {
            setTimeout(() => {
              setCurrentEpisodeIndex(idx + 1);
            }, 1000);
          }
        })
      );

      // 监听拖拽开始事件
      artPlayerRef.current.on(
        'video:seeking',
        safeguardEventHandler((_e: any) => {
          isSeekingRef.current = true;
          // 降低日志噪声与主线程压力
        })
      );

      // 监听拖拽结束事件
      artPlayerRef.current.on(
        'video:seeked',
        safeguardEventHandler((_e: any) => {
          isSeekingRef.current = false;
          // 设置拖拽后的短冷却窗口，期间跳过卡死检测与频繁保存
          seekCooldownUntilRef.current = Date.now() + 800; // 0.8s 冷却
          // 拖拽结束后延迟保存一次进度，避免与其他事件冲突
          setTimeout(() => {
            saveCurrentPlayProgress(true);
          }, 100);
        })
      );

      artPlayerRef.current.on(
        'video:timeupdate',
        safeguardEventHandler((_e: any) => {
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
          if (buffered && buffered.length > 0) {
            for (let i = 0; i < buffered.length; i++) {
              const start = buffered.start(i);
              const end = buffered.end(i);

              // 检查当前时间是否在缓冲范围内
              if (currentTime >= start && currentTime <= end) {
                hasBufferedData = true;
                bufferedAhead = end - currentTime; // 计算前方缓冲时长
                break;
              }

              // 检查是否有前方缓冲
              if (start > currentTime && start - currentTime < 2) {
                bufferedAhead = end - currentTime;
                break;
              }
            }
          }

          if (!isPaused && isPageVisible && readyState >= 2) {
            // 每隔2秒进行一次卡死评估，降低检测频率
            const lastCheckTs = lastProgressCheckTsRef.current || 0;
            if (now - lastCheckTs >= 2000) {
              const lastMediaT = lastMediaTimeForStallRef.current || 0;
              const progressed = currentTime - lastMediaT;

              // 更智能的卡死判断条件 - 降低误判率
              const isStuck =
                progressed < 0.03 && // 进度推进极小（降低阈值）
                (hasBufferedData || bufferedAhead > 0.3) && // 有缓冲数据或前方有足够缓冲
                currentTime > 2 && // 播放时间超过2秒
                readyState >= 3 && // 有足够数据可播放
                !isSeekingRef.current && // 确保不在拖拽中
                isPageVisible; // 页面可见

              if (isStuck) {
                stuckCountRef.current += 1;
                console.warn(
                  `🔍 播放进度检测 ${
                    stuckCountRef.current
                  }/3: 进度=${progressed.toFixed(
                    3
                  )}s, 时间=${currentTime.toFixed(
                    1
                  )}s, 缓冲=${hasBufferedData}, 前方缓冲=${bufferedAhead.toFixed(
                    1
                  )}s`
                );

                if (stuckCountRef.current >= 3) {
                  // 连续3次评估(约6秒)无进展，进行渐进式恢复
                  console.warn('🚑 检测到播放卡死，开始渐进式恢复策略...', {
                    stuckCount: stuckCountRef.current,
                    currentTime: currentTime.toFixed(2),
                    bufferedAhead: bufferedAhead.toFixed(2),
                    readyState,
                  });

                  try {
                    const hls = player?.video?.hls;

                    // 策略 1: 微小跳跃 (0.05秒)
                    if (stuckCountRef.current === 3) {
                      const smallNudge = Math.min(duration - currentTime, 0.05);
                      if (smallNudge > 0) {
                        player.currentTime = currentTime + smallNudge;
                        console.log(
                          '✨ 应用微小跳跃恢复:',
                          smallNudge.toFixed(3),
                          '秒'
                        );
                      }
                    }
                    // 策略 2: 中等跳跃 (0.2秒)
                    else if (stuckCountRef.current === 4) {
                      const mediumNudge = Math.min(duration - currentTime, 0.2);
                      if (mediumNudge > 0) {
                        player.currentTime = currentTime + mediumNudge;
                        console.log(
                          '⚡ 应用中等跳跃恢复:',
                          mediumNudge.toFixed(3),
                          '秒'
                        );
                      }
                    }
                    // 策略 3: 大跳跃 (0.5秒)
                    else if (stuckCountRef.current === 5) {
                      const largeNudge = Math.min(duration - currentTime, 0.5);
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
                    else if (stuckCountRef.current === 6) {
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
                    else if (stuckCountRef.current >= 7) {
                      console.log('🔥 应用强制HLS重初始化策略');
                      if (hls) {
                        try {
                          const currentLevel = hls.currentLevel;
                          hls.destroy();

                          // 短暂延迟后重新创建HLS实例
                          setTimeout(() => {
                            try {
                              const newHls = new Hls({
                                debug: false,
                                startLevel:
                                  currentLevel >= 0 ? currentLevel : -1,
                                // 使用更保守的配置
                                maxBufferLength: 15,
                                fragLoadingTimeOut: 30000,
                                fragLoadingMaxRetry: 10,
                                enableWorker: true,
                                lowLatencyMode: true,
                                // 增加网络不稳定环境下的容错能力
                                fragLoadingRetryDelay: 300,
                                manifestLoadingRetryDelay: 500,
                                levelLoadingRetryDelay: 500,
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
        })
      );

      artPlayerRef.current.on(
        'pause',
        safeguardEventHandler((_e: any) => {
          saveCurrentPlayProgress(true); // 暂停时立即保存
          // 重置卡死计数器
          stuckCountRef.current = 0;
        })
      );

      // 添加播放状态监控
      artPlayerRef.current.on(
        'play',
        safeguardEventHandler((_e: any) => {
          // 重置卡死计数器
          stuckCountRef.current = 0;
          lastPlayTimeRef.current = artPlayerRef.current?.currentTime || 0;
        })
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

      // 恢复原始的 console.error
      console.error = originalConsoleError;

      // 注意：不需要恢复addEventListener，因为我们使用的是包装器而不是全局替换
    } catch (err) {
      // 恢复原始的 console.error
      console.error = originalConsoleError;

      console.error('创建播放器失败:', err);
      setError('播放器初始化失败');
    } finally {
      // 恢复原始的错误处理器
      window.onerror = originalError;
      window.onunhandledrejection = originalUnhandledRejection;
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

      // 恢复原始的 console.error
      if (typeof window !== 'undefined') {
        // 这里不需要恢复，因为每次创建播放器时都会重新设置
      }
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

                {/* HLS错误提示 */}
                {showHlsErrorTip && (
                  <div className='absolute top-4 right-4 bg-orange-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg z-[600] transition-all duration-300'>
                    <div className='flex items-center space-x-2'>
                      <span className='text-sm'>⚠️</span>
                      <div>
                        <p className='text-sm font-medium'>网络不稳定</p>
                        <p className='text-xs opacity-90'>
                          正在尝试恢复播放...
                        </p>
                      </div>
                      <button
                        onClick={() => setShowHlsErrorTip(false)}
                        className='ml-2 text-white/80 hover:text-white'
                      >
                        ✕
                      </button>
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
