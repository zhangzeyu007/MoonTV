/**
 * 播放器健康统计
 * 扩展 performanceMonitor 以支持播放器健康数据
 */

/**
 * 重建统计数据
 */
export interface RebuildStats {
  totalRebuilds: number;
  successfulRebuilds: number;
  failedRebuilds: number;
  averageRebuildTime: number;
  rebuildReasons: Map<string, number>;
  lastRebuildTime: number;
  rebuildHistory: RebuildEvent[];
}

/**
 * 重建事件
 */
export interface RebuildEvent {
  timestamp: number;
  success: boolean;
  reason: string;
  duration: number;
  attemptNumber: number;
  error?: string;
  errorStack?: string;
}

/**
 * 错误统计数据
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByType: Map<string, number>;
  errorsBySeverity: Map<string, number>;
  errorRate: number;
  recentErrors: ErrorEvent[];
  topErrors: Array<{ type: string; count: number }>;
}

/**
 * 错误事件
 */
export interface ErrorEvent {
  timestamp: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  context: string;
  stack?: string;
}

/**
 * 事件处理性能统计
 */
export interface EventHandlingStats {
  totalEvents: number;
  eventsByType: Map<string, number>;
  averageResponseTime: number;
  errorRate: number;
  debouncedEvents: number;
  throttledEvents: number;
}

/**
 * 播放器健康统计管理器
 */
export class PlayerHealthStats {
  private static instance: PlayerHealthStats | null = null;

  // 重建统计
  private rebuildStats: RebuildStats = {
    totalRebuilds: 0,
    successfulRebuilds: 0,
    failedRebuilds: 0,
    averageRebuildTime: 0,
    rebuildReasons: new Map(),
    lastRebuildTime: 0,
    rebuildHistory: [],
  };

  // 错误统计
  private errorStats: ErrorStats = {
    totalErrors: 0,
    errorsByType: new Map(),
    errorsBySeverity: new Map(),
    errorRate: 0,
    recentErrors: [],
    topErrors: [],
  };

  // 事件处理统计
  private eventHandlingStats: EventHandlingStats = {
    totalEvents: 0,
    eventsByType: new Map(),
    averageResponseTime: 0,
    errorRate: 0,
    debouncedEvents: 0,
    throttledEvents: 0,
  };

  // 最大历史记录数
  private readonly MAX_HISTORY = 100;

  /**
   * 获取单例实例
   */
  public static getInstance(): PlayerHealthStats {
    if (!PlayerHealthStats.instance) {
      PlayerHealthStats.instance = new PlayerHealthStats();
    }
    return PlayerHealthStats.instance;
  }

  /**
   * 记录重建事件
   */
  public recordRebuildEvent(event: RebuildEvent): void {
    // 更新统计
    this.rebuildStats.totalRebuilds++;
    if (event.success) {
      this.rebuildStats.successfulRebuilds++;
    } else {
      this.rebuildStats.failedRebuilds++;
    }

    // 更新平均重建时间
    const totalTime =
      this.rebuildStats.averageRebuildTime *
        (this.rebuildStats.totalRebuilds - 1) +
      event.duration;
    this.rebuildStats.averageRebuildTime =
      totalTime / this.rebuildStats.totalRebuilds;

    // 更新重建原因统计
    const reasonCount = this.rebuildStats.rebuildReasons.get(event.reason) || 0;
    this.rebuildStats.rebuildReasons.set(event.reason, reasonCount + 1);

    // 更新最后重建时间
    this.rebuildStats.lastRebuildTime = event.timestamp;

    // 添加到历史记录
    this.rebuildStats.rebuildHistory.push(event);

    // 限制历史记录数量
    if (this.rebuildStats.rebuildHistory.length > this.MAX_HISTORY) {
      this.rebuildStats.rebuildHistory.shift();
    }

    console.log('📊 记录重建事件:', {
      success: event.success,
      reason: event.reason,
      duration: `${event.duration}ms`,
    });
  }

  /**
   * 记录错误事件
   */
  public recordErrorEvent(event: ErrorEvent): void {
    // 更新统计
    this.errorStats.totalErrors++;

    // 按类型统计
    const typeCount = this.errorStats.errorsByType.get(event.type) || 0;
    this.errorStats.errorsByType.set(event.type, typeCount + 1);

    // 按严重程度统计
    const severityCount =
      this.errorStats.errorsBySeverity.get(event.severity) || 0;
    this.errorStats.errorsBySeverity.set(event.severity, severityCount + 1);

    // 添加到最近错误
    this.errorStats.recentErrors.push(event);

    // 限制最近错误数量
    if (this.errorStats.recentErrors.length > this.MAX_HISTORY) {
      this.errorStats.recentErrors.shift();
    }

    // 更新 Top 错误
    this.updateTopErrors();

    // 计算错误率（最近100个事件中的错误比例）
    const recentCount = Math.min(this.errorStats.recentErrors.length, 100);
    this.errorStats.errorRate = recentCount / 100;

    console.log('📊 记录错误事件:', {
      type: event.type,
      severity: event.severity,
      message: event.message.substring(0, 50),
    });
  }

  /**
   * 记录事件处理统计
   */
  public recordEventHandling(
    eventType: string,
    responseTime: number,
    hasError: boolean,
    wasDebounced: boolean,
    wasThrottled: boolean
  ): void {
    this.eventHandlingStats.totalEvents++;

    // 按类型统计
    const typeCount = this.eventHandlingStats.eventsByType.get(eventType) || 0;
    this.eventHandlingStats.eventsByType.set(eventType, typeCount + 1);

    // 更新平均响应时间
    const totalTime =
      this.eventHandlingStats.averageResponseTime *
        (this.eventHandlingStats.totalEvents - 1) +
      responseTime;
    this.eventHandlingStats.averageResponseTime =
      totalTime / this.eventHandlingStats.totalEvents;

    // 更新错误率
    if (hasError) {
      const errorCount =
        this.eventHandlingStats.errorRate *
          (this.eventHandlingStats.totalEvents - 1) +
        1;
      this.eventHandlingStats.errorRate =
        errorCount / this.eventHandlingStats.totalEvents;
    }

    // 统计防抖和节流
    if (wasDebounced) {
      this.eventHandlingStats.debouncedEvents++;
    }
    if (wasThrottled) {
      this.eventHandlingStats.throttledEvents++;
    }
  }

  /**
   * 获取重建统计
   */
  public getRebuildStats(): RebuildStats {
    return {
      ...this.rebuildStats,
      rebuildReasons: new Map(this.rebuildStats.rebuildReasons),
      rebuildHistory: [...this.rebuildStats.rebuildHistory],
    };
  }

  /**
   * 获取错误统计
   */
  public getErrorStats(): ErrorStats {
    return {
      ...this.errorStats,
      errorsByType: new Map(this.errorStats.errorsByType),
      errorsBySeverity: new Map(this.errorStats.errorsBySeverity),
      recentErrors: [...this.errorStats.recentErrors],
      topErrors: [...this.errorStats.topErrors],
    };
  }

  /**
   * 获取事件处理统计
   */
  public getEventHandlingStats(): EventHandlingStats {
    return {
      ...this.eventHandlingStats,
      eventsByType: new Map(this.eventHandlingStats.eventsByType),
    };
  }

  /**
   * 获取所有统计数据
   */
  public getAllStats(): {
    rebuild: RebuildStats;
    error: ErrorStats;
    eventHandling: EventHandlingStats;
  } {
    return {
      rebuild: this.getRebuildStats(),
      error: this.getErrorStats(),
      eventHandling: this.getEventHandlingStats(),
    };
  }

  /**
   * 清除所有统计数据
   */
  public clearStats(): void {
    this.rebuildStats = {
      totalRebuilds: 0,
      successfulRebuilds: 0,
      failedRebuilds: 0,
      averageRebuildTime: 0,
      rebuildReasons: new Map(),
      lastRebuildTime: 0,
      rebuildHistory: [],
    };

    this.errorStats = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsBySeverity: new Map(),
      errorRate: 0,
      recentErrors: [],
      topErrors: [],
    };

    this.eventHandlingStats = {
      totalEvents: 0,
      eventsByType: new Map(),
      averageResponseTime: 0,
      errorRate: 0,
      debouncedEvents: 0,
      throttledEvents: 0,
    };

    console.log('✅ 已清除所有统计数据');
  }

  /**
   * 导出统计数据为 JSON
   */
  public exportStats(): string {
    const stats = this.getAllStats();

    // 转换 Map 为对象以便序列化
    const exportData = {
      rebuild: {
        ...stats.rebuild,
        rebuildReasons: Object.fromEntries(stats.rebuild.rebuildReasons),
      },
      error: {
        ...stats.error,
        errorsByType: Object.fromEntries(stats.error.errorsByType),
        errorsBySeverity: Object.fromEntries(stats.error.errorsBySeverity),
      },
      eventHandling: {
        ...stats.eventHandling,
        eventsByType: Object.fromEntries(stats.eventHandling.eventsByType),
      },
      exportTime: Date.now(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 更新 Top 错误
   */
  private updateTopErrors(): void {
    const errorCounts = Array.from(this.errorStats.errorsByType.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    this.errorStats.topErrors = errorCounts;
  }
}

// 导出单例实例
export const playerHealthStats = PlayerHealthStats.getInstance();

/**
 * 快捷函数：记录重建事件
 */
export function recordRebuildEvent(event: RebuildEvent): void {
  playerHealthStats.recordRebuildEvent(event);
}

/**
 * 快捷函数：记录错误事件
 */
export function recordErrorEvent(event: ErrorEvent): void {
  playerHealthStats.recordErrorEvent(event);
}

/**
 * 快捷函数：获取所有统计数据
 */
export function getAllPlayerHealthStats() {
  return playerHealthStats.getAllStats();
}
