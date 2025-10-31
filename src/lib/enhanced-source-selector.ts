/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 增强的源选择器
 * 集成智能源选择器，添加性能数据库和历史分析
 */

import { URLValidator } from './url-validator';

export interface SourceEvaluation {
  source: any;
  episodeUrl: string;
  score: number;
  pingTime: number;
  successRate: number;
  lastUsedTime: number;
  errorCount: number;
  available: boolean;
  priority?: number;
}

export interface SourcePerformanceData {
  // 源标识
  sourceId: string;
  sourceName: string;
  sourceUrl: string;

  // 性能指标
  averageLoadTime: number;
  minLoadTime: number;
  maxLoadTime: number;
  lastLoadTime: number;

  // 成功率
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number;

  // 错误统计
  errorTypes: Map<string, number>;
  lastError: string | null;
  lastErrorTime: number;

  // 使用历史
  firstUsedTime: number;
  lastUsedTime: number;
  usageCount: number;

  // 网络相关
  averagePingTime: number;
  lastPingTime: number;

  // 可用性
  isAvailable: boolean;
  unavailableReason: string | null;
  unavailableSince: number | null;

  // 验证相关(新增)
  validationErrors: number;
  lastValidationError?: string;
  lastValidationErrorTime?: number;
}

/**
 * 源性能数据库
 */
class SourcePerformanceDatabase {
  private static readonly STORAGE_KEY = 'source_performance_data';
  private static readonly MAX_RECORDS = 100;
  private static readonly BLACKLIST_EXPIRY = 3600000; // 1小时

  private performanceData: Map<string, SourcePerformanceData> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * 获取源性能数据
   */
  public getPerformanceData(sourceUrl: string): SourcePerformanceData | null {
    return this.performanceData.get(sourceUrl) || null;
  }

  /**
   * 更新源性能数据
   */
  public updatePerformanceData(
    sourceUrl: string,
    success: boolean,
    loadTime: number,
    errorType?: string
  ): void {
    let data = this.performanceData.get(sourceUrl);

    if (!data) {
      // 创建新记录
      const isValidationError = errorType?.includes('validation');
      data = {
        sourceId: this.generateSourceId(sourceUrl),
        sourceName: this.extractSourceName(sourceUrl),
        sourceUrl,
        averageLoadTime: loadTime,
        minLoadTime: loadTime,
        maxLoadTime: loadTime,
        lastLoadTime: loadTime,
        totalAttempts: 1,
        successfulAttempts: success ? 1 : 0,
        failedAttempts: success ? 0 : 1,
        successRate: success ? 1 : 0,
        errorTypes: new Map(),
        lastError: errorType || null,
        lastErrorTime: success ? 0 : Date.now(),
        firstUsedTime: Date.now(),
        lastUsedTime: Date.now(),
        usageCount: 1,
        averagePingTime: loadTime,
        lastPingTime: loadTime,
        isAvailable: success,
        unavailableReason: success ? null : errorType || 'unknown',
        unavailableSince: success ? null : Date.now(),
        validationErrors: isValidationError ? 1 : 0,
        lastValidationError: isValidationError ? errorType : undefined,
        lastValidationErrorTime: isValidationError ? Date.now() : undefined,
      };
    } else {
      // 更新现有记录
      data.totalAttempts++;
      data.lastUsedTime = Date.now();
      data.usageCount++;
      data.lastLoadTime = loadTime;

      if (success) {
        data.successfulAttempts++;
        data.isAvailable = true;
        data.unavailableReason = null;
        data.unavailableSince = null;
      } else {
        data.failedAttempts++;
        data.lastError = errorType || 'unknown';
        data.lastErrorTime = Date.now();

        if (errorType) {
          const count = data.errorTypes.get(errorType) || 0;
          data.errorTypes.set(errorType, count + 1);

          // 记录验证错误
          if (errorType.includes('validation')) {
            data.validationErrors = (data.validationErrors || 0) + 1;
            data.lastValidationError = errorType;
            data.lastValidationErrorTime = Date.now();
          }
        }
      }

      // 更新成功率
      data.successRate = data.successfulAttempts / data.totalAttempts;

      // 更新平均加载时间
      data.averageLoadTime =
        (data.averageLoadTime * (data.totalAttempts - 1) + loadTime) /
        data.totalAttempts;

      // 更新最小/最大加载时间
      data.minLoadTime = Math.min(data.minLoadTime, loadTime);
      data.maxLoadTime = Math.max(data.maxLoadTime, loadTime);

      // 更新 ping 时间
      data.lastPingTime = loadTime;
      data.averagePingTime =
        (data.averagePingTime * (data.usageCount - 1) + loadTime) /
        data.usageCount;
    }

    this.performanceData.set(sourceUrl, data);
    this.saveToStorage();
  }

  /**
   * 标记源为不可用
   */
  public markSourceUnavailable(sourceUrl: string, reason: string): void {
    let data = this.performanceData.get(sourceUrl);
    const isValidationError = reason.includes('validation');

    if (!data) {
      // 创建新记录
      data = {
        sourceId: this.generateSourceId(sourceUrl),
        sourceName: this.extractSourceName(sourceUrl),
        sourceUrl,
        averageLoadTime: 0,
        minLoadTime: 0,
        maxLoadTime: 0,
        lastLoadTime: 0,
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        successRate: 0,
        errorTypes: new Map(),
        lastError: reason,
        lastErrorTime: Date.now(),
        firstUsedTime: Date.now(),
        lastUsedTime: Date.now(),
        usageCount: 0,
        averagePingTime: 0,
        lastPingTime: 0,
        isAvailable: false,
        unavailableReason: reason,
        unavailableSince: Date.now(),
        validationErrors: isValidationError ? 1 : 0,
        lastValidationError: isValidationError ? reason : undefined,
        lastValidationErrorTime: isValidationError ? Date.now() : undefined,
      };
    } else {
      data.isAvailable = false;
      data.unavailableReason = reason;
      data.unavailableSince = Date.now();
      data.lastError = reason;
      data.lastErrorTime = Date.now();

      // 区分验证错误和其他错误类型
      if (isValidationError) {
        data.validationErrors = (data.validationErrors || 0) + 1;
        data.lastValidationError = reason;
        data.lastValidationErrorTime = Date.now();
      }
    }

    this.performanceData.set(sourceUrl, data);
    this.saveToStorage();
  }

  /**
   * 检查源是否在黑名单中
   */
  public isBlacklisted(sourceUrl: string): boolean {
    const data = this.performanceData.get(sourceUrl);

    if (!data || data.isAvailable) {
      return false;
    }

    // 检查黑名单是否过期（1小时后重试）
    if (data.unavailableSince) {
      const timeSinceBlacklisted = Date.now() - data.unavailableSince;
      if (timeSinceBlacklisted >= SourcePerformanceDatabase.BLACKLIST_EXPIRY) {
        // 黑名单过期，重置可用性
        data.isAvailable = true;
        data.unavailableReason = null;
        data.unavailableSince = null;
        this.performanceData.set(sourceUrl, data);
        this.saveToStorage();
        return false;
      }
    }

    return true;
  }

  /**
   * 获取所有性能数据
   */
  public getAllPerformanceData(): SourcePerformanceData[] {
    return Array.from(this.performanceData.values());
  }

  /**
   * 清除所有数据
   */
  public clearAll(): void {
    this.performanceData.clear();
    this.saveToStorage();
  }

  /**
   * 从 localStorage 加载数据
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(
        SourcePerformanceDatabase.STORAGE_KEY
      );
      if (stored) {
        const parsed = JSON.parse(stored);
        this.performanceData = new Map(
          parsed.map((item: any) => [
            item.sourceUrl,
            {
              ...item,
              errorTypes: new Map(Object.entries(item.errorTypes || {})),
              // 确保验证错误字段存在
              validationErrors: item.validationErrors || 0,
              lastValidationError: item.lastValidationError,
              lastValidationErrorTime: item.lastValidationErrorTime,
            },
          ])
        );
        console.log(
          `[SourcePerformanceDB] 加载了 ${this.performanceData.size} 条性能数据`
        );
      }
    } catch (error) {
      console.error('[SourcePerformanceDB] 加载数据失败:', error);
    }
  }

  /**
   * 保存到 localStorage
   */
  private saveToStorage(): void {
    try {
      // 限制记录数量
      if (this.performanceData.size > SourcePerformanceDatabase.MAX_RECORDS) {
        this.pruneOldRecords();
      }

      const data = Array.from(this.performanceData.values()).map((item) => ({
        ...item,
        errorTypes: Object.fromEntries(item.errorTypes),
      }));

      localStorage.setItem(
        SourcePerformanceDatabase.STORAGE_KEY,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('[SourcePerformanceDB] 保存数据失败:', error);
    }
  }

  /**
   * 清理旧记录
   */
  private pruneOldRecords(): void {
    const sorted = Array.from(this.performanceData.entries()).sort(
      (a, b) => b[1].lastUsedTime - a[1].lastUsedTime
    );

    // 保留最近使用的记录
    this.performanceData = new Map(
      sorted.slice(0, SourcePerformanceDatabase.MAX_RECORDS)
    );

    console.log(
      `[SourcePerformanceDB] 清理旧记录，保留 ${this.performanceData.size} 条`
    );
  }

  /**
   * 生成源 ID
   */
  private generateSourceId(sourceUrl: string): string {
    try {
      const url = new URL(sourceUrl);
      return `${url.hostname}${url.pathname}`;
    } catch {
      return sourceUrl;
    }
  }

  /**
   * 提取源名称
   */
  private extractSourceName(sourceUrl: string): string {
    try {
      const url = new URL(sourceUrl);
      return url.hostname;
    } catch {
      return 'unknown';
    }
  }
}

/**
 * 增强的源选择器类
 */
export class EnhancedSourceSelector {
  private performanceDB: SourcePerformanceDatabase;

  constructor() {
    this.performanceDB = new SourcePerformanceDatabase();
  }

  /**
   * 评估所有可用源
   */
  public async evaluateSources(sources: any[]): Promise<SourceEvaluation[]> {
    const evaluations: SourceEvaluation[] = [];

    // 批量验证所有源
    const { valid, invalid } = URLValidator.validateSources(sources);

    // 记录无效源
    invalid.forEach(({ source, error, errorType }: any) => {
      const url = source.episodeUrl || source.url || 'unknown';
      console.warn(`[EnhancedSourceSelector] 源验证失败: ${url} - ${error}`, {
        source,
        errorType,
        timestamp: new Date().toISOString(),
      });
      // 标记源为不可用,包含验证错误类型
      this.performanceDB.markSourceUnavailable(
        url,
        `url_validation_error: ${errorType || 'unknown'}`
      );
    });

    // 只处理有效源
    for (const source of valid) {
      const episodeUrl = source.episodeUrl || source.url;
      if (!episodeUrl) continue;

      // 检查是否在黑名单中
      if (this.performanceDB.isBlacklisted(episodeUrl)) {
        console.log(`[EnhancedSourceSelector] 跳过黑名单源: ${episodeUrl}`);
        continue;
      }

      // 获取性能数据
      const perfData = this.performanceDB.getPerformanceData(episodeUrl);

      const evaluation: SourceEvaluation = {
        source: source.source || source,
        episodeUrl,
        score: perfData ? this.calculateScore(perfData) : 50, // 默认分数50
        pingTime: perfData?.lastPingTime || 0,
        successRate: perfData?.successRate || 0,
        lastUsedTime: perfData?.lastUsedTime || 0,
        errorCount: perfData?.failedAttempts || 0,
        available: perfData?.isAvailable !== false,
        priority: source.priority,
      };

      evaluations.push(evaluation);
    }

    // 按评分排序
    evaluations.sort((a, b) => b.score - a.score);

    console.log(
      `[EnhancedSourceSelector] 评估完成: ${evaluations.length}个有效源, ${invalid.length}个无效源`
    );

    return evaluations;
  }

  /**
   * 选择最佳源
   */
  public async selectBestSource(
    sources: any[],
    excludeSources?: Set<string>
  ): Promise<SourceEvaluation | null> {
    const evaluations = await this.evaluateSources(sources);

    // 过滤掉排除的源
    const filtered = excludeSources
      ? evaluations.filter((e) => !excludeSources.has(e.episodeUrl))
      : evaluations;

    if (filtered.length === 0) {
      console.log('[EnhancedSourceSelector] 没有可用的源');
      return null;
    }

    const best = filtered[0];
    console.log(
      `[EnhancedSourceSelector] 选择最佳源: ${best.episodeUrl} (评分: ${best.score})`
    );

    return best;
  }

  /**
   * 获取下一个备用源
   */
  public async getNextBackupSource(
    sources: any[],
    triedSources: Set<string>
  ): Promise<SourceEvaluation | null> {
    return this.selectBestSource(sources, triedSources);
  }

  /**
   * 更新源性能数据
   */
  public updateSourcePerformance(
    sourceUrl: string,
    success: boolean,
    loadTime: number,
    errorType?: string
  ): void {
    this.performanceDB.updatePerformanceData(
      sourceUrl,
      success,
      loadTime,
      errorType
    );
  }

  /**
   * 标记源为不可用
   */
  public markSourceUnavailable(sourceUrl: string, reason = 'unknown'): void {
    this.performanceDB.markSourceUnavailable(sourceUrl, reason);
  }

  /**
   * 获取源性能数据
   */
  public getSourcePerformanceData(
    sourceUrl: string
  ): SourcePerformanceData | null {
    return this.performanceDB.getPerformanceData(sourceUrl);
  }

  /**
   * 获取所有性能数据
   */
  public getAllPerformanceData(): SourcePerformanceData[] {
    return this.performanceDB.getAllPerformanceData();
  }

  /**
   * 重置源选择状态
   */
  public reset(): void {
    // 不清除性能数据，只重置黑名单
    const allData = this.performanceDB.getAllPerformanceData();
    allData.forEach((data) => {
      if (!data.isAvailable) {
        data.isAvailable = true;
        data.unavailableReason = null;
        data.unavailableSince = null;
      }
    });
    console.log('[EnhancedSourceSelector] 重置源选择状态');
  }

  /**
   * 计算源评分
   */
  private calculateScore(perfData: SourcePerformanceData): number {
    let score = 50; // 基础分数

    // 成功率权重 40%
    score += perfData.successRate * 40;

    // 响应时间权重 30%（越快越好）
    if (perfData.averageLoadTime > 0) {
      const timeScore = Math.max(0, 30 - perfData.averageLoadTime / 100);
      score += timeScore;
    }

    // 使用频率权重 20%（最近使用的优先）
    const daysSinceLastUse =
      (Date.now() - perfData.lastUsedTime) / (1000 * 60 * 60 * 24);
    const usageScore = Math.max(0, 20 - daysSinceLastUse * 2);
    score += usageScore;

    // 错误率惩罚 10%
    const errorRate = perfData.failedAttempts / perfData.totalAttempts;
    score -= errorRate * 10;

    return Math.max(0, Math.min(100, score));
  }
}

// 单例实例
export const enhancedSourceSelector = new EnhancedSourceSelector();

// 导出便捷函数
export async function selectBestSource(
  sources: any[],
  excludeSources?: Set<string>
): Promise<SourceEvaluation | null> {
  return enhancedSourceSelector.selectBestSource(sources, excludeSources);
}

export function updateSourcePerformance(
  sourceUrl: string,
  success: boolean,
  loadTime: number,
  errorType?: string
): void {
  enhancedSourceSelector.updateSourcePerformance(
    sourceUrl,
    success,
    loadTime,
    errorType
  );
}

export function markSourceUnavailable(
  sourceUrl: string,
  reason?: string
): void {
  enhancedSourceSelector.markSourceUnavailable(sourceUrl, reason);
}
