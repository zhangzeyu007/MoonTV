/**
 * 刷新执行器
 * 负责执行页面刷新操作，支持多种策略和超时保护
 */

import { RefreshCleanupManager } from './refresh-cleanup-manager';

/**
 * 刷新日志接口
 */
export interface RefreshLog {
  timestamp: number;
  action: string;
  status: 'pending' | 'success' | 'failed';
  details?: string;
}

/**
 * 刷新状态接口
 */
export interface RefreshState {
  // 刷新状态
  isRefreshing: boolean;
  refreshStartTime: number;
  currentStrategy: 'standard' | 'force' | 'navigation' | null;

  // 超时控制
  timeoutId: NodeJS.Timeout | null;
  hasTimedOut: boolean;

  // 尝试次数
  attemptCount: number;
  maxAttempts: number;

  // 日志
  logs: RefreshLog[];
}

/**
 * 刷新选项接口
 */
export interface RefreshOptions {
  timeout?: number; // 默认3000ms
  strategy?: 'standard' | 'force' | 'navigation';
  showLoadingState?: boolean; // 默认true
  logDetails?: boolean; // 默认true
  enableCleanup?: boolean; // 默认true
}

/**
 * 刷新执行器类
 */
export class RefreshExecutor {
  private static instance: RefreshExecutor | null = null;
  private state: RefreshState;
  private cleanupManager: RefreshCleanupManager;

  constructor(cleanupManager: RefreshCleanupManager) {
    this.cleanupManager = cleanupManager;
    this.state = {
      isRefreshing: false,
      refreshStartTime: 0,
      currentStrategy: null,
      timeoutId: null,
      hasTimedOut: false,
      attemptCount: 0,
      maxAttempts: 3,
      logs: [],
    };

    console.log('✅ RefreshExecutor 初始化完成');
  }

  /**
   * 获取单例实例
   */
  public static getInstance(
    cleanupManager: RefreshCleanupManager
  ): RefreshExecutor {
    if (!RefreshExecutor.instance) {
      RefreshExecutor.instance = new RefreshExecutor(cleanupManager);
    }
    return RefreshExecutor.instance;
  }

  /**
   * 执行刷新操作（带超时保护）
   */
  public async executeRefresh(options: RefreshOptions = {}): Promise<void> {
    const {
      timeout = 3000,
      strategy = 'standard',
      showLoadingState = true,
      logDetails = true,
      enableCleanup = true,
    } = options;

    if (this.state.isRefreshing) {
      console.warn('⚠️ 刷新操作已在进行中，跳过重复请求');
      return;
    }

    this.state.isRefreshing = true;
    this.state.refreshStartTime = Date.now();
    this.state.attemptCount++;

    this.log(
      '开始刷新操作',
      'pending',
      `策略: ${strategy}, 超时: ${timeout}ms, 尝试: ${this.state.attemptCount}/${this.state.maxAttempts}`
    );

    try {
      // 1. 执行清理
      if (enableCleanup) {
        if (logDetails) {
          console.log('🧹 执行清理...');
        }
        const cleanupReport = this.cleanupManager.executeCleanup();

        if (logDetails) {
          console.log('✅ 清理完成:', cleanupReport);
        }

        // 如果清理失败但不是致命错误，继续刷新
        if (!cleanupReport.success && cleanupReport.errors.length > 0) {
          console.warn('⚠️ 清理过程有错误，但继续刷新:', cleanupReport.errors);
        }
      }

      // 2. 显示加载状态
      if (showLoadingState) {
        this.showRefreshingState();
      }

      // 3. 设置超时保护
      this.state.timeoutId = setTimeout(() => {
        this.handleRefreshTimeout(strategy, options);
      }, timeout);

      // 4. 执行刷新策略
      this.log('执行刷新策略', 'pending', strategy);

      if (logDetails) {
        console.log(`🔄 执行刷新策略: ${strategy}`);
      }

      switch (strategy) {
        case 'standard':
          this.standardRefresh();
          break;
        case 'force':
          this.forceRefresh();
          break;
        case 'navigation':
          this.navigationRefresh();
          break;
        default:
          throw new Error(`未知的刷新策略: ${strategy}`);
      }

      // 如果代码执行到这里，说明刷新成功（虽然通常不会到这里，因为页面会重新加载）
      this.log('刷新成功', 'success');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log('刷新失败', 'failed', errorMessage);
      console.error('❌ 刷新失败:', error);

      // 清除超时定时器
      if (this.state.timeoutId) {
        clearTimeout(this.state.timeoutId);
        this.state.timeoutId = null;
      }

      // 尝试下一个策略
      if (this.state.attemptCount < this.state.maxAttempts) {
        const nextStrategy = this.getNextStrategy(strategy);
        console.log(`🔄 尝试备用策略: ${nextStrategy}`);
        this.state.isRefreshing = false; // 重置状态以允许下一次尝试
        await this.executeRefresh({ ...options, strategy: nextStrategy });
      } else {
        // 所有策略都失败了
        this.showManualRefreshPrompt();
      }
    }
  }

  /**
   * 策略1：标准刷新
   */
  public standardRefresh(): void {
    console.log('🔄 执行标准刷新: window.location.reload()');
    this.state.currentStrategy = 'standard';

    try {
      // iOS Safari 兼容：使用同步方式立即刷新
      if (this.isIOSSafari()) {
        console.log('检测到 iOS Safari，使用兼容刷新方式');
        // 方法1：使用 assign 方法（iOS Safari 最可靠）
        const currentUrl = window.location.href;
        window.location.assign(currentUrl);
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('标准刷新失败:', error);
      throw error;
    }
  }

  /**
   * 策略2：强制刷新
   */
  public forceRefresh(): void {
    console.log('🔄 执行强制刷新: window.location.href');
    this.state.currentStrategy = 'force';

    try {
      // 添加时间戳强制刷新，绕过缓存
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('_refresh', Date.now().toString());

      if (this.isIOSSafari()) {
        console.log('iOS Safari: 使用带时间戳的URL刷新');
        window.location.href = currentUrl.toString();
      } else {
        window.location.href = currentUrl.toString();
      }
    } catch (error) {
      console.error('强制刷新失败:', error);
      throw error;
    }
  }

  /**
   * 策略3：导航刷新
   */
  public navigationRefresh(): void {
    console.log('🔄 执行导航刷新: window.location.replace()');
    this.state.currentStrategy = 'navigation';

    try {
      const currentUrl = window.location.href;

      if (this.isIOSSafari()) {
        console.log('iOS Safari: 使用 assign 方法刷新');
        // iOS Safari 上 replace 可能不工作，使用 assign
        window.location.assign(currentUrl);
      } else {
        window.location.replace(currentUrl);
      }
    } catch (error) {
      console.error('导航刷新失败:', error);
      throw error;
    }
  }

  /**
   * 检测是否为 iOS Safari
   */
  private isIOSSafari(): boolean {
    if (typeof window === 'undefined' || !window.navigator) {
      return false;
    }

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isWebKit = /WebKit/.test(ua);
    const isNotChrome = !/CriOS|Chrome/.test(ua);
    const isNotFirefox = !/FxiOS/.test(ua);

    return isIOS && isWebKit && isNotChrome && isNotFirefox;
  }

  /**
   * 处理刷新超时
   */
  private handleRefreshTimeout(
    currentStrategy: string,
    options: RefreshOptions
  ): void {
    this.state.hasTimedOut = true;
    this.log('刷新超时', 'failed', `策略: ${currentStrategy}`);

    console.warn(
      `⏱️ 刷新超时 (策略: ${currentStrategy}, 尝试: ${this.state.attemptCount}/${this.state.maxAttempts})`
    );

    // 清除超时定时器
    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
      this.state.timeoutId = null;
    }

    // 尝试下一个策略
    if (this.state.attemptCount < this.state.maxAttempts) {
      const nextStrategy = this.getNextStrategy(currentStrategy);
      console.log(`🔄 超时后尝试备用策略: ${nextStrategy}`);

      // 重置刷新状态
      this.state.isRefreshing = false;
      this.state.hasTimedOut = false;

      // 执行下一个策略
      this.executeRefresh({ ...options, strategy: nextStrategy as any });
    } else {
      // 所有策略都失败了
      console.error('❌ 所有刷新策略均已超时');
      this.showManualRefreshPrompt();
    }
  }

  /**
   * 获取下一个刷新策略
   */
  private getNextStrategy(
    current: string
  ): 'standard' | 'force' | 'navigation' {
    const strategies: Array<'standard' | 'force' | 'navigation'> = [
      'standard',
      'force',
      'navigation',
    ];
    const currentIndex = strategies.indexOf(current as any);
    const nextIndex = (currentIndex + 1) % strategies.length;
    return strategies[nextIndex];
  }

  /**
   * 显示刷新中状态
   */
  private showRefreshingState(): void {
    try {
      // 更新刷新按钮状态
      const refreshBtn = document.getElementById('error-refresh-btn');
      if (refreshBtn) {
        refreshBtn.textContent = '正在刷新...';
        refreshBtn.setAttribute('disabled', 'true');
        refreshBtn.style.opacity = '0.6';
        refreshBtn.style.cursor = 'not-allowed';
        refreshBtn.style.pointerEvents = 'none';
      }

      // 更新强制刷新按钮状态
      const forceRefreshBtn = document.getElementById(
        'error-force-refresh-btn'
      );
      if (forceRefreshBtn) {
        forceRefreshBtn.setAttribute('disabled', 'true');
        forceRefreshBtn.style.opacity = '0.6';
        forceRefreshBtn.style.cursor = 'not-allowed';
        forceRefreshBtn.style.pointerEvents = 'none';
      }

      console.log('✅ 已更新按钮为刷新中状态');
    } catch (error) {
      console.warn('更新刷新状态失败:', error);
    }
  }

  /**
   * 显示手动刷新提示
   */
  public showManualRefreshPrompt(): void {
    console.error('❌ 所有刷新策略均失败，显示手动刷新提示');

    try {
      // 更新错误提示
      const errorMessage = document.querySelector('.error-message');
      if (errorMessage) {
        errorMessage.textContent = '自动刷新失败，请手动刷新浏览器';
      }

      const errorSuggestion = document.querySelector('.error-suggestion');
      if (errorSuggestion) {
        errorSuggestion.innerHTML = `
          请使用以下方式手动刷新：<br>
          • Windows/Linux: 按 <strong>Ctrl + R</strong> 或 <strong>F5</strong><br>
          • Mac: 按 <strong>Cmd + R</strong><br>
          • 或点击浏览器的刷新按钮
        `;
      }

      // 恢复按钮状态，允许用户再次尝试
      const refreshBtn = document.getElementById('error-refresh-btn');
      if (refreshBtn) {
        refreshBtn.textContent = '重试刷新';
        refreshBtn.removeAttribute('disabled');
        refreshBtn.style.opacity = '1';
        refreshBtn.style.cursor = 'pointer';
        refreshBtn.style.pointerEvents = 'auto';
      }

      const forceRefreshBtn = document.getElementById(
        'error-force-refresh-btn'
      );
      if (forceRefreshBtn) {
        forceRefreshBtn.removeAttribute('disabled');
        forceRefreshBtn.style.opacity = '1';
        forceRefreshBtn.style.cursor = 'pointer';
        forceRefreshBtn.style.pointerEvents = 'auto';
      }

      // 重置状态以允许重试
      this.state.isRefreshing = false;
      this.state.attemptCount = 0;
      this.state.hasTimedOut = false;

      console.log('✅ 已显示手动刷新提示');
    } catch (error) {
      console.error('显示手动刷新提示失败:', error);
    }
  }

  /**
   * 记录日志
   */
  private log(
    action: string,
    status: RefreshLog['status'],
    details?: string
  ): void {
    const log: RefreshLog = {
      timestamp: Date.now(),
      action,
      status,
      details,
    };
    this.state.logs.push(log);

    // 限制日志数量，避免内存泄漏
    if (this.state.logs.length > 50) {
      this.state.logs = this.state.logs.slice(-50);
    }

    const statusIcon =
      status === 'success' ? '✅' : status === 'failed' ? '❌' : '⏳';
    console.log(`[Refresh] ${statusIcon} ${action} - ${status}`, details || '');
  }

  /**
   * 获取刷新日志
   */
  public getRefreshLogs(): RefreshLog[] {
    return [...this.state.logs];
  }

  /**
   * 获取刷新状态
   */
  public getRefreshState(): Readonly<RefreshState> {
    return { ...this.state };
  }

  /**
   * 重置刷新执行器状态
   */
  public reset(): void {
    // 清除超时定时器
    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
    }

    this.state = {
      isRefreshing: false,
      refreshStartTime: 0,
      currentStrategy: null,
      timeoutId: null,
      hasTimedOut: false,
      attemptCount: 0,
      maxAttempts: 3,
      logs: [],
    };

    console.log('✅ 刷新执行器已重置');
  }

  /**
   * 检查是否正在刷新
   */
  public isRefreshing(): boolean {
    return this.state.isRefreshing;
  }
}

// 导出便捷函数
let executorInstance: RefreshExecutor | null = null;

/**
 * 获取刷新执行器实例
 */
export function getRefreshExecutor(
  cleanupManager: RefreshCleanupManager
): RefreshExecutor {
  if (!executorInstance) {
    executorInstance = RefreshExecutor.getInstance(cleanupManager);
  }
  return executorInstance;
}

/**
 * 快捷函数：执行刷新
 */
export async function executeRefresh(
  cleanupManager: RefreshCleanupManager,
  options?: RefreshOptions
): Promise<void> {
  const executor = getRefreshExecutor(cleanupManager);
  return executor.executeRefresh(options);
}
