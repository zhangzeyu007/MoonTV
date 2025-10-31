/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 切换决策器
 * 评估是否应该切换源，管理冷却期和错误计数
 */

export interface SwitchConditions {
  isLoadingTimeout: boolean;
  isCooldownExpired: boolean;
  hasMinimumAttemptTime: boolean;
  hasEnoughErrors: boolean;
  hasAvailableBackups: boolean;
}

export interface SwitchCooldownConfig {
  // 标准冷却期（毫秒）
  standardCooldown: number;

  // 最小源尝试时间（毫秒）
  minimumAttemptTime: number;

  // 错误阈值
  errorThreshold: number;

  // 致命错误立即切换
  fatalErrorImmediateSwitch: boolean;
}

const DEFAULT_COOLDOWN_CONFIG: SwitchCooldownConfig = {
  standardCooldown: 10000, // 10秒
  minimumAttemptTime: 5000, // 5秒
  errorThreshold: 3, // 3次错误
  fatalErrorImmediateSwitch: true,
};

/**
 * 切换决策器类
 */
export class SwitchDecisionMaker {
  private config: SwitchCooldownConfig;
  private lastSwitchTime = 0;
  private currentSourceLoadStartTime = 0;
  private currentSourceErrorCount = 0;
  private availableBackupCount = 0;

  constructor(config: Partial<SwitchCooldownConfig> = {}) {
    this.config = { ...DEFAULT_COOLDOWN_CONFIG, ...config };
  }

  /**
   * 评估是否应该切换源
   */
  public shouldSwitchSource(
    isLoadingTimeout: boolean,
    isFatalError = false
  ): boolean {
    const conditions = this.getSwitchConditions(isLoadingTimeout);

    // 致命错误立即切换
    if (isFatalError && this.config.fatalErrorImmediateSwitch) {
      console.log('[SwitchDecision] ⚠️ 致命错误，立即切换源');
      return true;
    }

    // 强制超时条件（优先级最高）
    if (conditions.isLoadingTimeout) {
      const timeSinceLoadStart = Date.now() - this.currentSourceLoadStartTime;
      // 如果加载时间超过6秒，强制切换
      if (timeSinceLoadStart >= 6000) {
        console.log(
          `[SwitchDecision] ⚠️ 强制超时（${Math.round(
            timeSinceLoadStart / 1000
          )}秒 >= 6秒），立即切换源`
        );
        return true;
      }
    }

    // 检查所有条件
    const shouldSwitch =
      conditions.isLoadingTimeout &&
      conditions.isCooldownExpired &&
      conditions.hasMinimumAttemptTime &&
      conditions.hasEnoughErrors &&
      conditions.hasAvailableBackups;

    if (shouldSwitch) {
      console.log('[SwitchDecision] ✅ 满足所有切换条件');
    } else {
      this.logFailedConditions(conditions);
    }

    return shouldSwitch;
  }

  /**
   * 获取切换条件详情
   */
  public getSwitchConditions(isLoadingTimeout: boolean): SwitchConditions {
    const now = Date.now();
    const timeSinceLastSwitch = now - this.lastSwitchTime;
    const timeSinceLoadStart = now - this.currentSourceLoadStartTime;

    return {
      isLoadingTimeout,
      isCooldownExpired: timeSinceLastSwitch >= this.config.standardCooldown,
      hasMinimumAttemptTime:
        timeSinceLoadStart >= this.config.minimumAttemptTime,
      hasEnoughErrors:
        this.currentSourceErrorCount >= this.config.errorThreshold,
      hasAvailableBackups: this.availableBackupCount > 0,
    };
  }

  /**
   * 记录源切换
   */
  public recordSourceSwitch(): void {
    this.lastSwitchTime = Date.now();
    this.currentSourceLoadStartTime = Date.now();
    this.currentSourceErrorCount = 0;

    console.log('[SwitchDecision] 📍 记录源切换时间');
  }

  /**
   * 记录源加载开始
   */
  public recordSourceLoadStart(): void {
    this.currentSourceLoadStartTime = Date.now();
    this.currentSourceErrorCount = 0;

    console.log('[SwitchDecision] 📍 记录源加载开始时间');
  }

  /**
   * 记录源错误
   */
  public recordSourceError(): void {
    this.currentSourceErrorCount++;

    console.log(
      `[SwitchDecision] 📍 记录源错误 (${this.currentSourceErrorCount}/${this.config.errorThreshold})`
    );
  }

  /**
   * 更新可用备用源数量
   */
  public updateAvailableBackupCount(count: number): void {
    this.availableBackupCount = count;

    console.log(`[SwitchDecision] 📍 更新可用备用源数量: ${count}`);
  }

  /**
   * 获取冷却剩余时间
   */
  public getCooldownRemaining(): number {
    const now = Date.now();
    const timeSinceLastSwitch = now - this.lastSwitchTime;
    const remaining = Math.max(
      0,
      this.config.standardCooldown - timeSinceLastSwitch
    );

    return remaining;
  }

  /**
   * 获取最小尝试剩余时间
   */
  public getMinimumAttemptRemaining(): number {
    const now = Date.now();
    const timeSinceLoadStart = now - this.currentSourceLoadStartTime;
    const remaining = Math.max(
      0,
      this.config.minimumAttemptTime - timeSinceLoadStart
    );

    return remaining;
  }

  /**
   * 获取当前源错误计数
   */
  public getCurrentSourceErrorCount(): number {
    return this.currentSourceErrorCount;
  }

  /**
   * 重置决策状态
   */
  public reset(): void {
    this.lastSwitchTime = 0;
    this.currentSourceLoadStartTime = 0;
    this.currentSourceErrorCount = 0;

    console.log('[SwitchDecision] 重置决策状态');
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<SwitchCooldownConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[SwitchDecision] 配置已更新:', this.config);
  }

  /**
   * 获取当前配置
   */
  public getConfig(): SwitchCooldownConfig {
    return { ...this.config };
  }

  /**
   * 记录未满足的条件（用于调试）
   */
  private logFailedConditions(conditions: SwitchConditions): void {
    const failed: string[] = [];

    if (!conditions.isLoadingTimeout) {
      failed.push('未超时');
    }

    if (!conditions.isCooldownExpired) {
      const remaining = Math.round(this.getCooldownRemaining() / 1000);
      failed.push(`冷却期内（${remaining}秒后可切换）`);
    }

    if (!conditions.hasMinimumAttemptTime) {
      const remaining = Math.round(this.getMinimumAttemptRemaining() / 1000);
      failed.push(`尝试时间不足（还需${remaining}秒）`);
    }

    if (!conditions.hasEnoughErrors) {
      failed.push(
        `错误次数不足（${this.currentSourceErrorCount}/${this.config.errorThreshold}）`
      );
    }

    if (!conditions.hasAvailableBackups) {
      failed.push('无可用备用源');
    }

    if (failed.length > 0) {
      console.log(`[SwitchDecision] ⏳ 不满足切换条件: ${failed.join(', ')}`);
    }
  }
}

// 导出便捷函数
export function createSwitchDecisionMaker(
  config?: Partial<SwitchCooldownConfig>
): SwitchDecisionMaker {
  return new SwitchDecisionMaker(config);
}
