/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import Hls from 'hls.js';

/**
 * 获取图片代理 URL 设置
 */
export function getImageProxyUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 本地未开启图片代理，则不使用代理
  const enableImageProxy = localStorage.getItem('enableImageProxy');
  if (enableImageProxy !== null) {
    if (!JSON.parse(enableImageProxy) as boolean) {
      return null;
    }
  }

  const localImageProxy = localStorage.getItem('imageProxyUrl');
  if (localImageProxy != null) {
    return localImageProxy.trim() ? localImageProxy.trim() : null;
  }

  // 如果未设置，则使用全局对象
  const serverImageProxy = (window as any).RUNTIME_CONFIG?.IMAGE_PROXY;
  return serverImageProxy && serverImageProxy.trim()
    ? serverImageProxy.trim()
    : null;
}

/**
 * 处理图片 URL，如果设置了图片代理则使用代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  const proxyUrl = getImageProxyUrl();
  if (!proxyUrl) return originalUrl;

  return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
}

export function cleanHtmlTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '\n') // 将 HTML 标签替换为换行
    .replace(/\n+/g, '\n') // 将多个连续换行合并为一个
    .replace(/[ \t]+/g, ' ') // 将多个连续空格和制表符合并为一个空格，但保留换行符
    .replace(/^\n+|\n+$/g, '') // 去掉首尾换行
    .replace(/&nbsp;/g, ' ') // 将 &nbsp; 替换为空格
    .trim(); // 去掉首尾空格
}

/**
 * 获取有效的 User-Agent 字符串，支持 globalThis.CUSTOM_USER_AGENT 覆盖
 */
export function getEffectiveUserAgent(): string {
  try {
    const maybeCustom = (globalThis as any)?.CUSTOM_USER_AGENT;
    if (typeof maybeCustom === 'string' && maybeCustom.trim()) {
      return maybeCustom;
    }
  } catch (_) {
    /* ignore */
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent;
  }
  return '';
}

/** 判断是否为 iOS UA */
export function isIOSUserAgent(ua?: string): boolean {
  const s = ua ?? getEffectiveUserAgent();
  return /iPhone|iPad|iPod/i.test(s);
}

/** 判断是否为 Safari 浏览器 */
export function isSafariBrowser(ua?: string): boolean {
  const s = ua ?? getEffectiveUserAgent();
  return /Safari/i.test(s) && !/Chrome/i.test(s) && !/Chromium/i.test(s);
}

/** 判断是否为 WebKit 内核浏览器 */
export function isWebKitBrowser(ua?: string): boolean {
  const s = ua ?? getEffectiveUserAgent();
  return /WebKit/i.test(s);
}

/**
 * 从m3u8地址获取视频质量等级和网络信息
 * @param m3u8Url m3u8播放列表的URL
 * @returns Promise<{quality: string, loadSpeed: string, pingTime: number}> 视频质量等级和网络信息
 */
export async function getVideoResolutionFromM3u8(
  m3u8Url: string,
  onSourceFailure?: (url: string, error: any) => void
): Promise<{
  quality: string; // 如720p、1080p等
  loadSpeed: string; // 自动转换为KB/s或MB/s
  pingTime: number; // 网络延迟（毫秒）
}> {
  try {
    // 直接使用m3u8 URL作为视频源，避免CORS问题
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';

      // 测量网络延迟（ping时间） - 使用m3u8 URL而不是ts文件
      const pingStart = performance.now();
      let pingTime = 0;

      // 测量ping时间（使用m3u8 URL）- 优化网络请求处理
      const _pingPromise = fetch(m3u8Url, {
        method: 'HEAD',
        mode: 'cors',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15',
          Referer: window.location.origin,
          Accept: '*/*',
        },
        signal: AbortSignal.timeout(3000), // 3秒超时
      })
        .catch((fetchError) => {
          // 捕获fetch错误，避免未处理的Promise rejection
          console.warn(`Fetch请求失败: ${fetchError.message}`, fetchError);
          throw fetchError;
        })
        .then((response) => {
          pingTime = performance.now() - pingStart;

          // 检查响应状态码
          if (response.status >= 200 && response.status < 300) {
            console.log(
              `网络ping成功: ${pingTime.toFixed(2)}ms, 状态: ${response.status}`
            );
            return response;
          } else if (response.status >= 500) {
            // 服务器错误（5xx），使用较长的默认延迟
            console.warn(
              `服务器错误 ${response.status}: ${pingTime.toFixed(
                2
              )}ms, 使用较长延迟`
            );
            pingTime = 2000; // 服务器错误时使用2秒延迟
            return response;
          } else {
            // 客户端错误（4xx），使用中等延迟
            console.warn(
              `客户端错误 ${response.status}: ${pingTime.toFixed(
                2
              )}ms, 使用中等延迟`
            );
            pingTime = 1500; // 客户端错误时使用1.5秒延迟
            return response;
          }
        })
        .catch((error) => {
          pingTime = performance.now() - pingStart;

          // 根据错误类型设置不同的延迟时间
          if (error.name === 'AbortError') {
            console.warn(
              `网络ping超时: ${pingTime.toFixed(2)}ms, 使用超时延迟`
            );
            pingTime = 3000; // 超时时使用3秒延迟

            // 如果是长时间超时（接近5秒），触发源切换
            if (pingTime >= 4500) {
              console.warn(`长时间超时检测到，建议切换视频源: ${m3u8Url}`);
              if (onSourceFailure) {
                onSourceFailure(m3u8Url, error);
              }
            }
          } else if (
            error.message.includes('CORS') ||
            error.message.includes('CORS policy')
          ) {
            console.warn(`CORS错误: ${pingTime.toFixed(2)}ms, 使用CORS延迟`);
            pingTime = 1500; // CORS错误时使用1.5秒延迟
          } else if (
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError')
          ) {
            console.warn(
              `网络连接失败: ${pingTime.toFixed(2)}ms, 使用网络错误延迟`
            );
            pingTime = 2000; // 网络错误时使用2秒延迟

            // 对于网络错误，触发源切换
            console.warn(`网络错误检测到，建议切换视频源: ${m3u8Url}`);
            if (onSourceFailure) {
              onSourceFailure(m3u8Url, error);
            }
          } else {
            console.warn(
              `网络ping失败: ${error.message}, 耗时: ${pingTime.toFixed(
                2
              )}ms, 使用默认延迟`
            );
            pingTime = 1000; // 其他错误使用1秒延迟
          }

          // 不抛出错误，而是返回一个模拟的成功响应，避免Promise rejection
          return {
            status: 200,
            ok: true,
            headers: new Headers(),
          };
        });

      // 固定使用hls.js加载
      const hls = new Hls();

      // 设置超时处理
      const timeout = setTimeout(() => {
        hls.destroy();
        video.remove();
        reject(new Error('Timeout loading video metadata'));
      }, 3000);

      video.onerror = () => {
        clearTimeout(timeout);
        hls.destroy();
        video.remove();
        reject(new Error('Failed to load video metadata'));
      };

      let actualLoadSpeed = '未知';
      let hasSpeedCalculated = false;
      let hasMetadataLoaded = false;

      let fragmentStartTime = 0;

      // 检查是否可以返回结果
      const checkAndResolve = () => {
        if (
          hasMetadataLoaded &&
          (hasSpeedCalculated || actualLoadSpeed !== '未知')
        ) {
          clearTimeout(timeout);
          const width = video.videoWidth;
          if (width && width > 0) {
            hls.destroy();
            video.remove();

            // 根据视频宽度判断视频质量等级，使用经典分辨率的宽度作为分割点
            const quality =
              width >= 3840
                ? '4K' // 4K: 3840x2160
                : width >= 2560
                ? '2K' // 2K: 2560x1440
                : width >= 1920
                ? '1080p' // 1080p: 1920x1080
                : width >= 1280
                ? '720p' // 720p: 1280x720
                : width >= 854
                ? '480p'
                : 'SD'; // 480p: 854x480

            resolve({
              quality,
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          } else {
            // webkit 无法获取尺寸，直接返回
            resolve({
              quality: '未知',
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          }
        }
      };

      // 监听片段加载开始
      hls.on(Hls.Events.FRAG_LOADING, () => {
        fragmentStartTime = performance.now();
      });

      // 监听片段加载完成，只需首个分片即可计算速度
      hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
        if (
          fragmentStartTime > 0 &&
          data &&
          data.payload &&
          !hasSpeedCalculated
        ) {
          const loadTime = performance.now() - fragmentStartTime;
          const size = data.payload.byteLength || 0;

          if (loadTime > 0 && size > 0) {
            const speedKBps = size / 1024 / (loadTime / 1000);

            // 立即计算速度，无需等待更多分片
            const avgSpeedKBps = speedKBps;

            if (avgSpeedKBps >= 1024) {
              actualLoadSpeed = `${(avgSpeedKBps / 1024).toFixed(1)} MB/s`;
            } else {
              actualLoadSpeed = `${avgSpeedKBps.toFixed(1)} KB/s`;
            }
            hasSpeedCalculated = true;
            checkAndResolve(); // 尝试返回结果
          }
        }
      });

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      // 监听hls.js错误
      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        console.error('HLS错误:', data);

        // 检测浏览器类型
        const isSafari = isSafariBrowser();
        const isWebKit = isWebKitBrowser();

        // 增强错误处理，根据浏览器类型采用不同策略
        if (data.fatal) {
          console.warn('检测到HLS致命错误，尝试恢复...');
          clearTimeout(timeout);

          // Safari浏览器：减少干预
          if (isSafari) {
            console.log('Safari: 轻量级错误恢复');
            setTimeout(() => {
              try {
                hls.startLoad();
                console.log('Safari: HLS轻量级恢复成功');
              } catch (recoverError) {
                console.error('Safari: HLS恢复失败，停止干预:', recoverError);
                hls.destroy();
                video.remove();
                reject(new Error(`Safari HLS播放失败: ${data.type}`));
              }
            }, 2000);
          }
          // WebKit浏览器：中等干预
          else if (isWebKit) {
            console.log('WebKit: 中等干预错误恢复');
            setTimeout(() => {
              try {
                hls.startLoad();
                console.log('WebKit: HLS恢复成功');
              } catch (recoverError) {
                console.error('WebKit: HLS恢复失败:', recoverError);
                hls.destroy();
                video.remove();
                reject(new Error(`WebKit HLS播放失败: ${data.type}`));
              }
            }, 1500);
          }
          // 其他浏览器：标准干预
          else {
            console.log('其他浏览器: 标准错误恢复');
            setTimeout(() => {
              try {
                hls.startLoad();
                console.log('其他浏览器: HLS恢复成功');
              } catch (recoverError) {
                console.error('其他浏览器: HLS恢复失败:', recoverError);
                hls.destroy();
                video.remove();
                reject(new Error(`HLS播放失败: ${data.type}`));
              }
            }, 1000);
          }
        }
      });

      // 监听视频元数据加载完成
      video.onloadedmetadata = () => {
        hasMetadataLoaded = true;
        checkAndResolve(); // 尝试返回结果
      };
    });
  } catch (error) {
    throw new Error(
      `Error getting video resolution: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * 优化的视频源测试函数
 * 结合缓存机制，提供更快的源测试体验
 */
export async function getOptimizedVideoResolutionFromM3u8(
  m3u8Url: string,
  onSourceFailure?: (url: string, error: any) => void,
  _useCache = true
): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
}> {
  // 暂时禁用缓存功能，直接使用原始测试方法
  // TODO: 实现更简单的缓存机制
  return getVideoResolutionFromM3u8(m3u8Url, onSourceFailure);
}

/**
 * 批量测试视频源
 * 并发测试多个源，提高效率
 */
export async function batchTestVideoSources(
  urls: string[],
  onSourceFailure?: (url: string, error: any) => void,
  maxConcurrency = 3
): Promise<
  Map<string, { quality: string; loadSpeed: string; pingTime: number } | null>
> {
  const results = new Map<
    string,
    { quality: string; loadSpeed: string; pingTime: number } | null
  >();

  // 分批处理，避免过多并发请求
  const chunks = [];
  for (let i = 0; i < urls.length; i += maxConcurrency) {
    chunks.push(urls.slice(i, i + maxConcurrency));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (url) => {
      try {
        const result = await getOptimizedVideoResolutionFromM3u8(
          url,
          onSourceFailure
        );
        results.set(url, result);
      } catch (error) {
        console.warn(`源测试失败: ${url}`, error);
        results.set(url, null);
      }
    });

    await Promise.allSettled(promises);
  }

  return results;
}

/**
 * 智能源选择算法
 * 基于多个因素选择最佳播放源
 */
export function selectBestSource(
  sources: Array<{
    source: any;
    testResult: { quality: string; loadSpeed: string; pingTime: number };
  }>
): any {
  if (sources.length === 0) return null;
  if (sources.length === 1) return sources[0].source;

  // 计算每个源的综合评分
  const scoredSources = sources.map(({ source, testResult }) => {
    let score = 0;

    // 质量评分 (40%)
    const qualityScore = getQualityScore(testResult.quality);
    score += qualityScore * 0.4;

    // 速度评分 (40%)
    const speedScore = getSpeedScore(testResult.loadSpeed);
    score += speedScore * 0.4;

    // 延迟评分 (20%)
    const pingScore = getPingScore(testResult.pingTime);
    score += pingScore * 0.2;

    return { source, score };
  });

  // 按评分排序
  scoredSources.sort((a, b) => b.score - a.score);

  console.log('源评分排序结果:');
  scoredSources.forEach((item, index) => {
    console.log(
      `${index + 1}. ${item.source.source_name} - 评分: ${item.score.toFixed(
        2
      )}`
    );
  });

  return scoredSources[0].source;
}

/**
 * 获取质量评分
 */
function getQualityScore(quality: string): number {
  switch (quality) {
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
}

/**
 * 获取速度评分
 */
function getSpeedScore(speed: string): number {
  if (speed === '未知' || speed === '测量中...') return 30;

  const match = speed.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
  if (!match) return 30;

  const value = parseFloat(match[1]);
  const unit = match[2];
  const speedKBps = unit === 'MB/s' ? value * 1024 : value;

  // 基于速度线性评分，1MB/s = 100分
  return Math.min(100, Math.max(0, (speedKBps / 1024) * 100));
}

/**
 * 获取延迟评分
 */
function getPingScore(ping: number): number {
  if (ping <= 0) return 0;

  // 延迟越低评分越高
  if (ping <= 100) return 100;
  if (ping <= 200) return 80;
  if (ping <= 500) return 60;
  if (ping <= 1000) return 40;
  if (ping <= 2000) return 20;
  return 0;
}
