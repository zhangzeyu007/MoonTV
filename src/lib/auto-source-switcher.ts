/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 自动源切换器
 * 协调所有组件，提供统一的自动切换接口
 */

import {
  EnhancedSourceSelector,
  SourceEvaluation,
} from './enhanced-source-selector';
import { LoadingMonitor, NetworkQuality } from './loading-monitor';
import { SourceSwitchExecutor, SwitchContext } from './source-switch-executor';
import { SwitchDecisionMaker } from './switch-decision-maker';
import { SwitchRecord, SwitchStatistics } from './switch-statistics';

export interface AutoSwitchConfig {
  enabled: boolean;
  timeoutThreshold: number;
  cooldownPeriod: number;
  minimumAttemptTime: number;
  errorThreshold: number;
  maxSwitchAttempts: number;
  networkAdaptive: boolean;
}

const DEFAULT_CONFIG: AutoSwitchConfig = {
  enabled: true,
  timeoutThreshold: 6000,
  cooldownPeriod: 10000,
  minimumAttemptTime: 5000,
  errorThreshold: 3,
  maxSwitchAttempts: 5,
  networkAdaptive: true,
};

export type AutoSwitchEvent =
  | 'switch-start'
  | 'switch-success'
  | 'switch-failed'
  | 'all-sources-failed';

export type AutoSwitchEventHandler = (data: any) => void;

/**
 * 自动源切换器类
 */
export class AutoSourceSwitcher {
  private config: AutoSwitchConfig;
  private player: any = null;
  private sources: any[] = [];
  private triedSources: Set<string> = new Set();

  // 子组件
  private loadingMonitor: LoadingMonitor;
  private decisionMaker: SwitchDecisionMaker;
  private sourceSelector: EnhancedSourceSelector;
  private switchExecutor: SourceSwitchExecutor;
  private statistics: SwitchStatistics;

  // 状态
  private isRunning = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private currentSourceUrl = '';
  private switchAttempts = 0;

  // 事件系统
  private eventHandlers: Map<AutoSwitchEvent, Set<AutoSwitchEventHandler>> =
    new Map();

  constructor(config: Partial<AutoSwitchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 初始化子组件
    this.loadingMonitor = new LoadingMonitor({
      baseTimeout: this.config.timeoutThreshold,
      forceTimeout: 6000,
    });

    this.decisionMaker = new SwitchDecisionMaker({
      standardCooldown: this.config.cooldownPeriod,
      minimumAttemptTime: this.config.minimumAttemptTime,
      errorThreshold: this.config.errorThreshold,
    });

    this.sourceSelector = new EnhancedSourceSelector();
    this.switchExecutor = new SourceSwitchExecutor();
    this.statistics = new SwitchStatistics();
  }

  /**
   * 初始化自动切换
   */
  public initialize(
    player: any,
    sources: any[],
    config?: Partial<AutoSwitchConfig>
  ): void {
    if (config) {
      this.updateConfig(config);
    }

    this.player = player;
    this.sources = sources;
    this.switchExecutor.setPlayer(player);

    // 更新可用备用源数量
    this.decisionMaker.updateAvailableBackupCount(sources.length);

    console.log(`[AutoSourceSwitcher] 初始化完成，共 ${sources.length} 个源`);
  }

  /**
   * 启动自动切换
   */
  public start(): void {
    if (!this.player) {
      console.error('[AutoSourceSwitcher] 播放器未初始化');
      return;
    }

    if (this.isRunning) {
      console.warn('[AutoSourceSwitcher] 已在运行中');
      return;
    }

    this.isRunning = true;

    // 启动加载监控
    if (this.player.video) {
      this.loadingMonitor.startMonitoring(this.player.video);
    }

    // 记录当前源加载开始
    this.currentSourceUrl = this.player.url || '';
    this.decisionMaker.recordSourceLoadStart();

    // 启动监控循环
    this.startMonitorLoop();

    console.log('[AutoSourceSwitcher] 自动切换已启动');
  }

  /**
   * 停止自动切换
   */
  public stop(): void {
    this.isRunning = false;

    // 停止加载监控
    this.loadingMonitor.stopMonitoring();

    // 停止监控循环
    this.stopMonitorLoop();

    console.log('[AutoSourceSwitcher] 自动切换已停止');
  }

  /**
   * 手动触发切换
   */
  public async manualSwitch(targetSource?: any): Promise<boolean> {
    if (!this.player) {
      console.error('[AutoSourceSwitcher] 播放器未初始化');
      return false;
    }

    console.log('[AutoSourceSwitcher] 手动触发切换');

    // 捕获当前状态
    const context = this.switchExecutor.capturePlayerState();
    if (!context) {
      console.error('[AutoSourceSwitcher] 无法捕获播放器状态');
      return false;
    }

    // 选择目标源
    let target: SourceEvaluation | null = null;

    if (targetSource) {
      // 使用指定的源
      target = {
        source: targetSource,
        episodeUrl: targetSource.episodeUrl || targetSource.url,
        score: 100,
        pingTime: 0,
        successRate: 0,
        lastUsedTime: 0,
        errorCount: 0,
        available: true,
      };
    } else {
      // 自动选择最佳源
      target = await this.sourceSelector.selectBestSource(
        this.sources,
        this.triedSources
      );
    }

    if (!target) {
      console.error('[AutoSourceSwitcher] 没有可用的备用源');
      return false;
    }

    // 执行切换
    context.currentSource = { name: this.currentSourceUrl };
    context.targetSource = target;
    context.reason = 'manual';

    return await this.performSwitch(context);
  }

  /**
   * 获取可用源列表
   */
  public getAvailableSources(): SourceEvaluation[] {
    return this.sources.map((source) => ({
      source,
      episodeUrl: source.episodeUrl || source.url,
      score: 0,
      pingTime: 0,
      successRate: 0,
      lastUsedTime: 0,
      errorCount: 0,
      available: true,
    }));
  }

  /**
   * 获取当前配置
   */
  public getConfig(): AutoSwitchConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<AutoSwitchConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新子组件配置
    this.loadingMonitor.updateConfig({
      baseTimeout: this.config.timeoutThreshold,
    });

    this.decisionMaker.updateConfig({
      standardCooldown: this.config.cooldownPeriod,
      minimumAttemptTime: this.config.minimumAttemptTime,
      errorThreshold: this.config.errorThreshold,
    });

    console.log('[AutoSourceSwitcher] 配置已更新:', this.config);
  }

  /**
   * 更新网络质量
   */
  public updateNetworkQuality(quality: NetworkQuality): void {
    this.loadingMonitor.updateNetworkQuality(quality);
  }

  /**
   * 记录源错误
   */
  public recordSourceError(errorType?: string): void {
    this.decisionMaker.recordSourceError();

    if (this.currentSourceUrl && errorType) {
      this.sourceSelector.updateSourcePerformance(
        this.currentSourceUrl,
        false,
        0,
        errorType
      );
    }
  }

  /**
   * 获取切换统计
   */
  public getStatistics(): SwitchStatistics {
    return this.statistics;
  }

  /**
   * 重置切换器
   */
  public reset(): void {
    this.triedSources.clear();
    this.switchAttempts = 0;
    this.decisionMaker.reset();
    this.loadingMonitor.reset();
    this.sourceSelector.reset();

    console.log('[AutoSourceSwitcher] 切换器已重置');
  }

  /**
   * 销毁切换器
   */
  public destroy(): void {
    this.stop();
    this.switchExecutor.destroy();
    this.loadingMonitor.destroy();

    console.log('[AutoSourceSwitcher] 切换器已销毁');
  }

  /**
   * 监听事件
   */
  public on(event: AutoSwitchEvent, handler: AutoSwitchEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * 取消监听事件
   */
  public off(event: AutoSwitchEvent, handler: AutoSwitchEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: AutoSwitchEvent, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[AutoSourceSwitcher] 事件处理器错误:`, error);
        }
      });
    }
  }

  /**
   * 启动监控循环
   */
  private startMonitorLoop(): void {
    // 每秒检查一次
    this.monitorInterval = setInterval(() => {
      this.checkAndSwitch();
    }, 1000);
  }

  /**
   * 停止监控循环
   */
  private stopMonitorLoop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * 检查并切换
   */
  private async checkAndSwitch(): Promise<void> {
    if (!this.config.enabled || !this.isRunning) {
      return;
    }

    // 检查是否正在切换
    if (this.switchExecutor.isSwitchingSource()) {
      return;
    }

    // 检查是否超时
    const isTimeout = this.loadingMonitor.isLoadingTimeout();

    if (!isTimeout) {
      return;
    }

    // 评估是否应该切换
    const shouldSwitch = this.decisionMaker.shouldSwitchSource(isTimeout);

    if (!shouldSwitch) {
      return;
    }

    // 检查是否超过最大切换次数
    if (this.switchAttempts >= this.config.maxSwitchAttempts) {
      console.error('[AutoSourceSwitcher] 超过最大切换次数');
      this.handleAllSourcesFailed();
      return;
    }

    // 执行自动切换
    await this.performAutoSwitch();
  }

  /**
   * 执行自动切换
   */
  private async performAutoSwitch(): Promise<void> {
    console.log('[AutoSourceSwitcher] 触发自动切换');

    // 捕获当前状态
    const context = this.switchExecutor.capturePlayerState();
    if (!context) {
      console.error('[AutoSourceSwitcher] 无法捕获播放器状态');
      return;
    }

    // 选择最佳备用源
    const target = await this.sourceSelector.selectBestSource(
      this.sources,
      this.triedSources
    );

    if (!target) {
      console.error('[AutoSourceSwitcher] 没有可用的备用源');
      this.handleAllSourcesFailed();
      return;
    }

    // 执行切换
    context.currentSource = { name: this.currentSourceUrl };
    context.targetSource = target;
    context.reason = 'loading_timeout';

    await this.performSwitch(context);
  }

  /**
   * 执行切换
   */
  private async performSwitch(context: SwitchContext): Promise<boolean> {
    const startTime = Date.now();

    // 触发切换开始事件
    this.emit('switch-start', {
      from: context.currentSource,
      to: context.targetSource,
      reason: context.reason,
    });

    try {
      // 执行切换
      const success = await this.switchExecutor.switchSource(context);

      const duration = Date.now() - startTime;
      const loadingState = this.loadingMonitor.getLoadingState();

      // 记录切换结果
      const record: SwitchRecord = {
        timestamp: Date.now(),
        fromSource: context.currentSource?.name || 'unknown',
        toSource: context.targetSource?.episodeUrl || 'unknown',
        reason: context.reason,
        loadDuration: loadingState.loadDuration,
        success,
        errorMessage: success ? undefined : '切换失败',
        errorType: success ? undefined : 'player',
        networkQuality: loadingState.networkQuality,
      };

      this.statistics.recordSwitch(record);

      if (success) {
        // 切换成功
        this.switchAttempts++;
        this.currentSourceUrl = context.targetSource?.episodeUrl || '';
        this.triedSources.add(this.currentSourceUrl);

        // 记录源切换
        this.decisionMaker.recordSourceSwitch();

        // 更新源性能数据
        this.sourceSelector.updateSourcePerformance(
          this.currentSourceUrl,
          true,
          duration
        );

        // 重置加载监控
        this.loadingMonitor.reset();

        // 触发成功事件
        this.emit('switch-success', {
          source: context.targetSource,
          duration,
        });

        console.log('[AutoSourceSwitcher] 切换成功');
        return true;
      } else {
        // 切换失败
        this.sourceSelector.updateSourcePerformance(
          context.targetSource?.episodeUrl || '',
          false,
          duration,
          '切换失败'
        );

        // 触发失败事件
        this.emit('switch-failed', {
          source: context.targetSource,
          error: '切换失败',
          errorType: 'player',
        });

        console.error('[AutoSourceSwitcher] 切换失败');
        return false;
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const loadingState = this.loadingMonitor.getLoadingState();

      // 检查是否为验证错误
      const isValidationError = error.validationError === true;
      const errorType: 'validation' | 'timeout' | 'network' | 'player' =
        isValidationError
          ? 'validation'
          : error.message?.includes('超时')
          ? 'timeout'
          : error.message?.includes('网络')
          ? 'network'
          : 'player';

      console.error(
        `[AutoSourceSwitcher] 切换异常 (${errorType}):`,
        error.message,
        {
          targetSource: context.targetSource,
          errorType,
          timestamp: new Date().toISOString(),
        }
      );

      // 标记源为不可用
      const targetUrl =
        context.targetSource?.episodeUrl || context.targetSource?.url;
      if (targetUrl) {
        this.sourceSelector.markSourceUnavailable(
          targetUrl,
          `${errorType}_error: ${error.errorType || error.message}`
        );
      }

      // 记录失败
      this.statistics.recordSwitch({
        timestamp: Date.now(),
        fromSource: context.currentSource?.name || 'unknown',
        toSource: targetUrl || 'unknown',
        reason: context.reason,
        loadDuration: duration,
        success: false,
        errorMessage: error.message,
        errorType,
        networkQuality: loadingState.networkQuality,
      });

      // 触发失败事件
      this.emit('switch-failed', {
        source: context.targetSource,
        error: error.message,
        errorType,
      });

      // 验证错误时返回 false,允许尝试下一个源
      return false;
    }
  }

  /**
   * 处理所有源都失败的情况
   */
  private handleAllSourcesFailed(): void {
    console.error('[AutoSourceSwitcher] 所有源都已失败');

    // 停止自动切换
    this.stop();

    // 检查是否有任何有效源
    const availableSources = this.getAvailableSources().filter(
      (s) => s.available
    );

    console.log(`[AutoSourceSwitcher] 可用源数量: ${availableSources.length}`, {
      totalSources: this.sources.length,
      triedSources: this.triedSources.size,
      availableSources: availableSources.length,
    });

    // 触发所有源失败事件
    this.emit('all-sources-failed', {
      triedSources: Array.from(this.triedSources),
      switchAttempts: this.switchAttempts,
      availableSources: availableSources.length,
      hasValidSources: availableSources.length > 0,
    });

    // 根据情况显示不同的错误消息
    if (availableSources.length === 0) {
      // 没有有效源时显示"无可用播放源"致命错误
      console.error('[AutoSourceSwitcher] 没有任何有效的播放源');
      // 注意: 实际的 UI 显示由监听 'all-sources-failed' 事件的代码处理
    } else {
      // 有有效源但都失败时,用户可以通过事件监听器显示手动恢复对话框
      console.warn(
        '[AutoSourceSwitcher] 有可用源但自动切换失败,建议显示手动选择对话框'
      );
    }
  }
}

// 导出便捷函数
export function createAutoSourceSwitcher(
  config?: Partial<AutoSwitchConfig>
): AutoSourceSwitcher {
  return new AutoSourceSwitcher(config);
}
