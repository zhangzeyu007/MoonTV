/**
 * 播放器健康监控器
 * 监控播放器健康状态并决定是否需要重建
 */

/**
 * 播放器健康状态接口
 */
export interface PlayerHealthStatus {
  // 是否健康
  isHealthy: boolean;

  // 错误计数
  errorCount: number;

  // 严重错误计数
  criticalErrorCount: number;

  // 最后一次错误时间
  lastErrorTime: number;

  // 连续错误次数
  consecutiveErrors: number;

  // 播放器是否响应
  isResponsive: boolean;

  // 最后一次健康检查时间
  lastHealthCheckTime: number;

  // 是否需要重建
  needsRebuild: boolean;

  // 重建原因
  rebuildReason?: string;
}

/**
 * 错误严重程度
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 播放器健康监控器类
 */
export class PlayerHealthMonitor {
  private static instance: PlayerHealthMonitor | null = null;

  private healthStatus: PlayerHealthStatus = {
    isHealthy: true,
    errorCount: 0,
    criticalErrorCount: 0,
    lastErrorTime: 0,
    consecutiveErrors: 0,
    isResponsive: true,
    lastHealthCheckTime: Date.now(),
    needsRebuild: false,
  };

  // 最后一次重建时间
  private lastRebuildTime = 0;

  // 重建冷却期（30秒）
  private readonly REBUILD_COOLDOWN = 30000;

  // 连续错误阈值
  private readonly CONSECUTIVE_ERROR_THRESHOLD = 5;

  // 严重错误阈值
  private readonly CRITICAL_ERROR_THRESHOLD = 3;

  // 错误时间窗口（5秒内的错误视为连续）
  private readonly ERROR_TIME_WINDOW = 5000;

  /**
   * 获取单例实例
   */
  public static getInstance(): PlayerHealthMonitor {
    if (!PlayerHealthMonitor.instance) {
      PlayerHealthMonitor.instance = new PlayerHealthMonitor();
    }
    return PlayerHealthMonitor.instance;
  }

  /**
   * 监控播放器健康状态
   */
  public monitorPlayerHealth(player: any): void {
    if (!player) {
      console.warn('播放器实例不存在，无法监控健康状态');
      return;
    }

    const now = Date.now();
    this.healthStatus.lastHealthCheckTime = now;

    // 检查播放器响应性
    this.healthStatus.isResponsive = this.checkPlayerResponsiveness(player);

    // 更新健康状态
    this.updateHealthStatus();
  }

  /**
   * 检查播放器是否健康
   */
  public isPlayerHealthy(player: any): boolean {
    if (!player) {
      return false;
    }

    this.monitorPlayerHealth(player);
    return this.healthStatus.isHealthy;
  }

  /**
   * 评估错误严重程度
   */
  public assessErrorSeverity(error: Error): ErrorSeverity {
    const message = error.message || String(error);
    const lowerMessage = message.toLowerCase();

    // 致命错误
    if (
      lowerMessage.includes('cannot create player') ||
      lowerMessage.includes('container not found') ||
      lowerMessage.includes('out of memory') ||
      lowerMessage.includes('fatal')
    ) {
      return 'critical';
    }

    // 严重错误
    if (
      lowerMessage.includes('media decode') ||
      lowerMessage.includes('播放失败') ||
      lowerMessage.includes('player instance') ||
      lowerMessage.includes('hls fatal') ||
      lowerMessage.includes('cannot play')
    ) {
      return 'high';
    }

    // 中度错误
    if (
      lowerMessage.includes('hls error') ||
      lowerMessage.includes('network') ||
      lowerMessage.includes('load failed') ||
      lowerMessage.includes('timeout')
    ) {
      return 'medium';
    }

    // 轻度错误
    return 'low';
  }

  /**
   * 记录错误
   */
  public recordError(error: Error): void {
    const now = Date.now();
    const severity = this.assessErrorSeverity(error);

    // 更新错误计数
    this.healthStatus.errorCount++;

    // 更新严重错误计数
    if (severity === 'critical' || severity === 'high') {
      this.healthStatus.criticalErrorCount++;
    }

    // 更新连续错误计数
    const timeSinceLastError = now - this.healthStatus.lastErrorTime;
    if (timeSinceLastError < this.ERROR_TIME_WINDOW) {
      this.healthStatus.consecutiveErrors++;
    } else {
      this.healthStatus.consecutiveErrors = 1;
    }

    this.healthStatus.lastErrorTime = now;

    // 更新健康状态
    this.updateHealthStatus();

    console.log(
      `记录错误 [${severity}]: ${error.message}`,
      `连续错误: ${this.healthStatus.consecutiveErrors}`,
      `严重错误: ${this.healthStatus.criticalErrorCount}`
    );
  }

  /**
   * 判断是否需要重建播放器
   */
  public shouldRebuildPlayer(): boolean {
    const now = Date.now();

    // 1. 检查是否在冷却期内（防止频繁重建）
    const timeSinceLastRebuild = now - this.lastRebuildTime;
    if (timeSinceLastRebuild < this.REBUILD_COOLDOWN) {
      console.log(
        `在重建冷却期内（${Math.round(
          (this.REBUILD_COOLDOWN - timeSinceLastRebuild) / 1000
        )}秒后可重建），跳过重建`
      );
      return false;
    }

    // 2. 检查连续错误次数
    if (
      this.healthStatus.consecutiveErrors >= this.CONSECUTIVE_ERROR_THRESHOLD
    ) {
      console.log('连续错误次数过多，触发重建');
      this.healthStatus.needsRebuild = true;
      this.healthStatus.rebuildReason = `连续错误${this.healthStatus.consecutiveErrors}次`;
      return true;
    }

    // 3. 检查严重错误计数
    if (this.healthStatus.criticalErrorCount >= this.CRITICAL_ERROR_THRESHOLD) {
      console.log('严重错误次数过多，触发重建');
      this.healthStatus.needsRebuild = true;
      this.healthStatus.rebuildReason = `严重错误${this.healthStatus.criticalErrorCount}次`;
      return true;
    }

    // 4. 检查播放器响应性
    if (!this.healthStatus.isResponsive) {
      console.log('播放器无响应，触发重建');
      this.healthStatus.needsRebuild = true;
      this.healthStatus.rebuildReason = '播放器无响应';
      return true;
    }

    // 5. 检查健康状态标记
    if (this.healthStatus.needsRebuild) {
      console.log('健康监控标记需要重建');
      return true;
    }

    return false;
  }

  /**
   * 重置健康状态
   */
  public resetHealthStatus(): void {
    this.healthStatus = {
      isHealthy: true,
      errorCount: 0,
      criticalErrorCount: 0,
      lastErrorTime: 0,
      consecutiveErrors: 0,
      isResponsive: true,
      lastHealthCheckTime: Date.now(),
      needsRebuild: false,
    };

    console.log('✅ 播放器健康状态已重置');
  }

  /**
   * 标记重建已完成
   */
  public markRebuildCompleted(): void {
    this.lastRebuildTime = Date.now();
    this.resetHealthStatus();
  }

  /**
   * 获取当前健康状态
   */
  public getHealthStatus(): PlayerHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * 检查播放器响应性
   */
  private checkPlayerResponsiveness(player: any): boolean {
    try {
      // 检查播放器实例是否存在
      if (!player) {
        return false;
      }

      // 检查关键属性是否可访问
      if (typeof player.paused === 'undefined') {
        return false;
      }

      // 检查关键方法是否存在
      if (
        typeof player.play !== 'function' ||
        typeof player.pause !== 'function'
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn('检查播放器响应性失败:', error);
      return false;
    }
  }

  /**
   * 更新健康状态
   */
  private updateHealthStatus(): void {
    // 根据错误计数和响应性更新健康状态
    this.healthStatus.isHealthy =
      this.healthStatus.consecutiveErrors < this.CONSECUTIVE_ERROR_THRESHOLD &&
      this.healthStatus.criticalErrorCount < this.CRITICAL_ERROR_THRESHOLD &&
      this.healthStatus.isResponsive;
  }
}

// 导出单例实例
export const playerHealthMonitor = PlayerHealthMonitor.getInstance();

/**
 * 快捷函数：记录错误
 */
export function recordPlayerError(error: Error): void {
  playerHealthMonitor.recordError(error);
}

/**
 * 快捷函数：检查是否需要重建
 */
export function shouldRebuildPlayer(): boolean {
  return playerHealthMonitor.shouldRebuildPlayer();
}

/**
 * 快捷函数：重置健康状态
 */
export function resetPlayerHealth(): void {
  playerHealthMonitor.resetHealthStatus();
}
