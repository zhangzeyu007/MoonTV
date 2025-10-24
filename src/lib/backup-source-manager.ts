/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 智能备用源管理器
 * 提供更智能的备用源生成和切换机制
 */

export interface BackupSource {
  url: string;
  priority: number;
  type: 'cdn' | 'mirror' | 'protocol' | 'cache' | 'custom';
  description: string;
}

export interface BackupSourceConfig {
  enableCdnFallback: boolean;
  enableProtocolFallback: boolean;
  enableCacheFallback: boolean;
  enableCustomFallback: boolean;
  maxBackupSources: number;
  customBackupDomains: string[];
}

const DEFAULT_CONFIG: BackupSourceConfig = {
  enableCdnFallback: true,
  enableProtocolFallback: true,
  enableCacheFallback: true,
  enableCustomFallback: true,
  maxBackupSources: 5,
  customBackupDomains: [],
};

class BackupSourceManager {
  private config: BackupSourceConfig;
  private sourceCache: Map<string, BackupSource[]> = new Map();

  constructor(config: Partial<BackupSourceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成智能备用源
   */
  generateBackupSources(originalUrl: string): BackupSource[] {
    const cacheKey = this.getCacheKey(originalUrl);

    // 检查缓存
    if (this.sourceCache.has(cacheKey)) {
      const cached = this.sourceCache.get(cacheKey);
      if (cached) return cached;
    }

    const backupSources: BackupSource[] = [];

    try {
      const url = new URL(originalUrl);

      // 主源（最高优先级）
      backupSources.push({
        url: originalUrl,
        priority: 100,
        type: 'custom',
        description: '原始源',
      });

      // CDN 备用源
      if (this.config.enableCdnFallback) {
        const cdnSources = this.generateCdnSources(originalUrl, url);
        backupSources.push(...cdnSources);
      }

      // 协议切换备用源
      if (this.config.enableProtocolFallback) {
        const protocolSources = this.generateProtocolSources(originalUrl, url);
        backupSources.push(...protocolSources);
      }

      // 缓存破坏备用源
      if (this.config.enableCacheFallback) {
        const cacheSources = this.generateCacheSources(originalUrl);
        backupSources.push(...cacheSources);
      }

      // 自定义域名备用源
      if (
        this.config.enableCustomFallback &&
        this.config.customBackupDomains.length > 0
      ) {
        const customSources = this.generateCustomDomainSources(
          originalUrl,
          url
        );
        backupSources.push(...customSources);
      }

      // 按优先级排序
      backupSources.sort((a, b) => b.priority - a.priority);

      // 限制备用源数量
      const limitedSources = backupSources.slice(
        0,
        this.config.maxBackupSources
      );

      // 缓存结果
      this.sourceCache.set(cacheKey, limitedSources);

      console.log(
        `为 ${originalUrl} 生成了 ${limitedSources.length} 个备用源:`,
        limitedSources
      );

      return limitedSources;
    } catch (error) {
      console.warn('生成备用源失败:', error);
      return [
        {
          url: originalUrl,
          priority: 100,
          type: 'custom',
          description: '原始源（备用源生成失败）',
        },
      ];
    }
  }

  /**
   * 生成 CDN 备用源
   */
  private generateCdnSources(originalUrl: string, url: URL): BackupSource[] {
    const sources: BackupSource[] = [];

    // 常见的 CDN 前缀
    const cdnPrefixes = ['cdn', 'static', 'assets', 'media', 'video', 'stream'];

    // 如果已经是 CDN，尝试原始源
    if (cdnPrefixes.some((prefix) => url.hostname.includes(prefix))) {
      const originalHostname = url.hostname.replace(
        new RegExp(`(${cdnPrefixes.join('|')})\\.`),
        ''
      );
      if (originalHostname !== url.hostname) {
        const originalServerUrl = originalUrl.replace(
          url.hostname,
          originalHostname
        );
        sources.push({
          url: originalServerUrl,
          priority: 80,
          type: 'cdn',
          description: '原始服务器源',
        });
      }
    } else {
      // 尝试添加 CDN 前缀
      cdnPrefixes.forEach((prefix) => {
        const cdnUrl = originalUrl.replace('://', `://${prefix}.`);
        sources.push({
          url: cdnUrl,
          priority: 70,
          type: 'cdn',
          description: `${prefix} CDN 源`,
        });
      });
    }

    return sources;
  }

  /**
   * 生成协议切换备用源
   */
  private generateProtocolSources(
    originalUrl: string,
    url: URL
  ): BackupSource[] {
    const sources: BackupSource[] = [];

    if (url.protocol === 'https:') {
      const httpUrl = originalUrl.replace('https://', 'http://');
      sources.push({
        url: httpUrl,
        priority: 60,
        type: 'protocol',
        description: 'HTTP 协议源',
      });
    } else if (url.protocol === 'http:') {
      const httpsUrl = originalUrl.replace('http://', 'https://');
      sources.push({
        url: httpsUrl,
        priority: 60,
        type: 'protocol',
        description: 'HTTPS 协议源',
      });
    }

    return sources;
  }

  /**
   * 生成缓存破坏备用源
   */
  private generateCacheSources(originalUrl: string): BackupSource[] {
    const sources: BackupSource[] = [];

    // 添加时间戳参数
    const timestampUrl =
      originalUrl + (originalUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    sources.push({
      url: timestampUrl,
      priority: 50,
      type: 'cache',
      description: '缓存破坏源',
    });

    // 添加随机参数
    const randomUrl =
      originalUrl +
      (originalUrl.includes('?') ? '&' : '?') +
      'r=' +
      Math.random().toString(36).substr(2, 9);
    sources.push({
      url: randomUrl,
      priority: 45,
      type: 'cache',
      description: '随机参数源',
    });

    return sources;
  }

  /**
   * 生成自定义域名备用源
   */
  private generateCustomDomainSources(
    originalUrl: string,
    url: URL
  ): BackupSource[] {
    const sources: BackupSource[] = [];

    this.config.customBackupDomains.forEach((domain) => {
      const customUrl = originalUrl.replace(url.hostname, domain);
      sources.push({
        url: customUrl,
        priority: 40,
        type: 'custom',
        description: `自定义域名源 (${domain})`,
      });
    });

    return sources;
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * 测试备用源可用性
   */
  async testBackupSource(url: string, timeout = 3000): Promise<boolean> {
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
      return false;
    }
  }

  /**
   * 批量测试备用源
   */
  async testBackupSources(
    sources: BackupSource[],
    maxConcurrency = 3,
    timeout = 3000
  ): Promise<BackupSource[]> {
    const availableSources: BackupSource[] = [];

    // 分批测试
    const chunks = [];
    for (let i = 0; i < sources.length; i += maxConcurrency) {
      chunks.push(sources.slice(i, i + maxConcurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (source) => {
        const isAvailable = await this.testBackupSource(source.url, timeout);
        if (isAvailable) {
          availableSources.push(source);
        }
      });

      await Promise.allSettled(promises);
    }

    // 按优先级排序
    availableSources.sort((a, b) => b.priority - a.priority);

    return availableSources;
  }

  /**
   * 获取最佳备用源
   */
  async getBestBackupSource(originalUrl: string): Promise<BackupSource | null> {
    const backupSources = this.generateBackupSources(originalUrl);

    if (backupSources.length <= 1) {
      return backupSources[0] || null;
    }

    // 测试备用源可用性
    const availableSources = await this.testBackupSources(
      backupSources.slice(1),
      2,
      2000
    );

    return availableSources[0] || backupSources[0] || null;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<BackupSourceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // 清除缓存
    this.sourceCache.clear();
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.sourceCache.clear();
  }
}

// 单例实例
export const backupSourceManager = new BackupSourceManager();

/**
 * 智能源切换器
 */
export class SmartSourceSwitcher {
  private currentSourceIndex = 0;
  public backupSources: BackupSource[] = [];
  private retryCount = 0;
  private maxRetries = 3;
  private retryHandler: any;

  constructor() {
    this.retryHandler = {
      shouldRetry: (error: any): boolean => {
        return (
          this.retryCount < this.maxRetries && this.isRetryableError(error)
        );
      },

      getRetryDelay: (): number => {
        this.retryCount++;
        return 1000 * Math.pow(2, this.retryCount - 1); // 指数退避
      },

      reset: (): void => {
        this.retryCount = 0;
      },
    };
  }

  /**
   * 初始化备用源
   */
  async initializeBackupSources(originalUrl: string): Promise<void> {
    this.backupSources = backupSourceManager.generateBackupSources(originalUrl);
    this.currentSourceIndex = 0;
    this.retryHandler.reset();

    console.log(`初始化了 ${this.backupSources.length} 个备用源`);
  }

  /**
   * 获取当前源
   */
  getCurrentSource(): BackupSource | null {
    if (this.currentSourceIndex < this.backupSources.length) {
      return this.backupSources[this.currentSourceIndex];
    }
    return null;
  }

  /**
   * 切换到下一个源
   */
  switchToNextSource(): BackupSource | null {
    this.currentSourceIndex++;
    this.retryHandler.reset();

    if (this.currentSourceIndex < this.backupSources.length) {
      const nextSource = this.backupSources[this.currentSourceIndex];
      console.log(
        `切换到备用源 ${this.currentSourceIndex + 1}/${
          this.backupSources.length
        }: ${nextSource.description}`
      );
      return nextSource;
    }

    console.warn('所有备用源都已尝试');
    return null;
  }

  /**
   * 检查是否应该重试
   */
  shouldRetry(error: any): boolean {
    return this.retryHandler.shouldRetry(error);
  }

  /**
   * 获取重试延迟
   */
  getRetryDelay(): number {
    return this.retryHandler.getRetryDelay();
  }

  /**
   * 检查错误是否可重试
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'NetworkError',
      'AbortError',
      'TimeoutError',
      'MEDIA_ERR_NETWORK',
      'MEDIA_ERR_SRC_NOT_SUPPORTED',
      'FRAG_LOAD_ERROR',
      'MANIFEST_LOAD_ERROR',
      'LEVEL_LOAD_ERROR',
    ];

    const errorMessage = error.message || error.type || '';
    return retryableErrors.some((retryableError) =>
      errorMessage.includes(retryableError)
    );
  }

  /**
   * 重置切换器
   */
  reset(): void {
    this.currentSourceIndex = 0;
    this.retryHandler.reset();
  }
}
