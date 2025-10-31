/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 切换统计器
 * 记录和分析源切换数据
 */

export interface SwitchRecord {
  timestamp: number;
  fromSource: string;
  toSource: string;
  reason: string;
  loadDuration: number;
  success: boolean;
  errorMessage?: string;
  errorType?: 'validation' | 'timeout' | 'network' | 'player';
  networkQuality: string;
}

export interface SourceStats {
  sourceName: string;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  averageLoadTime: number;
  successRate: number;
  lastUsedTime: number;
  errorReasons: Map<string, number>;
}

/**
 * 切换统计器类
 */
export class SwitchStatistics {
  private static readonly STORAGE_KEY = 'source_switch_history';
  private static readonly MAX_HISTORY = 100;

  private switchHistory: SwitchRecord[] = [];
  private sourceStats: Map<string, SourceStats> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * 记录切换事件
   */
  public recordSwitch(record: SwitchRecord): void {
    // 添加到历史记录
    this.switchHistory.push(record);

    // 限制历史记录数量
    if (this.switchHistory.length > SwitchStatistics.MAX_HISTORY) {
      this.switchHistory = this.switchHistory.slice(
        -SwitchStatistics.MAX_HISTORY
      );
    }

    // 更新源统计
    this.updateSourceStats(record);

    // 保存到存储
    this.saveToStorage();

    console.log('[SwitchStatistics] 记录切换事件:', {
      from: record.fromSource,
      to: record.toSource,
      success: record.success,
      reason: record.reason,
    });
  }

  /**
   * 获取切换历史
   */
  public getSwitchHistory(limit?: number): SwitchRecord[] {
    if (limit) {
      return this.switchHistory.slice(-limit);
    }
    return [...this.switchHistory];
  }

  /**
   * 获取源统计数据
   */
  public getSourceStats(sourceName: string): SourceStats | null {
    return this.sourceStats.get(sourceName) || null;
  }

  /**
   * 获取所有源统计
   */
  public getAllSourceStats(): SourceStats[] {
    return Array.from(this.sourceStats.values());
  }

  /**
   * 导出统计数据
   */
  public exportStats(): string {
    const data = {
      history: this.switchHistory,
      stats: Array.from(this.sourceStats.entries()).map(([name, stats]) => ({
        name,
        ...stats,
        errorReasons: Object.fromEntries(stats.errorReasons),
      })),
      summary: {
        totalSwitches: this.switchHistory.length,
        successfulSwitches: this.switchHistory.filter((r) => r.success).length,
        failedSwitches: this.switchHistory.filter((r) => !r.success).length,
        overallSuccessRate: this.getOverallSuccessRate(),
        averageSwitchTime: this.getAverageSwitchTime(),
      },
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * 清除历史数据
   */
  public clearHistory(): void {
    this.switchHistory = [];
    this.sourceStats.clear();
    this.saveToStorage();
    console.log('[SwitchStatistics] 历史数据已清除');
  }

  /**
   * 获取切换成功率
   */
  public getOverallSuccessRate(): number {
    if (this.switchHistory.length === 0) return 0;

    const successCount = this.switchHistory.filter((r) => r.success).length;
    return successCount / this.switchHistory.length;
  }

  /**
   * 获取平均切换时间
   */
  public getAverageSwitchTime(): number {
    if (this.switchHistory.length === 0) return 0;

    const totalTime = this.switchHistory.reduce(
      (sum, r) => sum + r.loadDuration,
      0
    );
    return totalTime / this.switchHistory.length;
  }

  /**
   * 获取最近的切换记录
   */
  public getRecentSwitches(count = 10): SwitchRecord[] {
    return this.switchHistory.slice(-count);
  }

  /**
   * 获取失败的切换记录
   */
  public getFailedSwitches(): SwitchRecord[] {
    return this.switchHistory.filter((r) => !r.success);
  }

  /**
   * 获取按原因分组的切换统计
   */
  public getSwitchReasonStats(): Map<string, number> {
    const reasonStats = new Map<string, number>();

    this.switchHistory.forEach((record) => {
      const count = reasonStats.get(record.reason) || 0;
      reasonStats.set(record.reason, count + 1);
    });

    return reasonStats;
  }

  /**
   * 更新源统计
   */
  private updateSourceStats(record: SwitchRecord): void {
    // 更新目标源统计
    let stats = this.sourceStats.get(record.toSource);

    if (!stats) {
      stats = {
        sourceName: record.toSource,
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        averageLoadTime: 0,
        successRate: 0,
        lastUsedTime: record.timestamp,
        errorReasons: new Map(),
      };
    }

    stats.totalAttempts++;
    stats.lastUsedTime = record.timestamp;

    if (record.success) {
      stats.successfulAttempts++;
    } else {
      stats.failedAttempts++;

      // 记录错误原因
      if (record.errorMessage) {
        const count = stats.errorReasons.get(record.errorMessage) || 0;
        stats.errorReasons.set(record.errorMessage, count + 1);
      }
    }

    // 更新成功率
    stats.successRate = stats.successfulAttempts / stats.totalAttempts;

    // 更新平均加载时间
    stats.averageLoadTime =
      (stats.averageLoadTime * (stats.totalAttempts - 1) +
        record.loadDuration) /
      stats.totalAttempts;

    this.sourceStats.set(record.toSource, stats);
  }

  /**
   * 从 localStorage 加载数据
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(SwitchStatistics.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        this.switchHistory = parsed.history || [];

        if (parsed.stats) {
          this.sourceStats = new Map(
            parsed.stats.map((item: any) => [
              item.name,
              {
                ...item,
                errorReasons: new Map(Object.entries(item.errorReasons || {})),
              },
            ])
          );
        }

        console.log(
          `[SwitchStatistics] 加载了 ${this.switchHistory.length} 条历史记录`
        );
      }
    } catch (error) {
      console.error('[SwitchStatistics] 加载数据失败:', error);
    }
  }

  /**
   * 保存到 localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        history: this.switchHistory,
        stats: Array.from(this.sourceStats.entries()).map(([name, stats]) => ({
          name,
          ...stats,
          errorReasons: Object.fromEntries(stats.errorReasons),
        })),
      };

      localStorage.setItem(SwitchStatistics.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[SwitchStatistics] 保存数据失败:', error);
    }
  }
}

// 单例实例
export const switchStatistics = new SwitchStatistics();

// 导出便捷函数
export function recordSwitch(record: SwitchRecord): void {
  switchStatistics.recordSwitch(record);
}

export function getSwitchHistory(limit?: number): SwitchRecord[] {
  return switchStatistics.getSwitchHistory(limit);
}

export function getSourceStats(sourceName: string): SourceStats | null {
  return switchStatistics.getSourceStats(sourceName);
}

export function getAllSourceStats(): SourceStats[] {
  return switchStatistics.getAllSourceStats();
}

export function exportStats(): string {
  return switchStatistics.exportStats();
}

export function clearHistory(): void {
  switchStatistics.clearHistory();
}

export function getOverallSuccessRate(): number {
  return switchStatistics.getOverallSuccessRate();
}
