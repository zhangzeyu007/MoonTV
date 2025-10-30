/**
 * 播放器恢复管理器
 * 协调播放器的销毁、重建和状态恢复
 */

import {
  cleanupPlayerEvents,
  initPlayerEventHandling,
} from './player-event-integration';
import { playerHealthMonitor } from './player-health-monitor';
import { playerHealthStats } from './player-health-stats';
import { playerStateManager } from './player-state-manager';
import {
  hideLoadingIndicator,
  notifyUser,
  showFatalError,
  showLoadingIndicator,
} from './player-ui-feedback';

/**
 * 播放器重建配置
 */
export interface PlayerRebuildConfig {
  // 最大重建尝试次数
  maxAttempts: number;

  // 重建延迟（毫秒）
  rebuildDelay: number;

  // 是否使用指数退避
  useExponentialBackoff: boolean;

  // 是否显示加载指示器
  showLoadingIndicator: boolean;

  // 是否自动恢复播放
  autoResume: boolean;

  // 重建超时时间（毫秒）
  rebuildTimeout: number;

  // 是否保存状态到存储
  persistState: boolean;
}

/**
 * 播放器恢复管理器类
 */
export class PlayerRecoveryManager {
  private static instance: PlayerRecoveryManager | null = null;

  // 重建尝试次数
  private rebuildAttempts = 0;

  // 是否正在重建
  private isRebuildingFlag = false;

  // 默认配置
  private config: PlayerRebuildConfig = {
    maxAttempts: 3,
    rebuildDelay: 2000,
    useExponentialBackoff: true,
    showLoadingIndicator: true,
    autoResume: true,
    rebuildTimeout: 30000,
    persistState: false,
  };

  /**
   * 获取单例实例
   */
  public static getInstance(): PlayerRecoveryManager {
    if (!PlayerRecoveryManager.instance) {
      PlayerRecoveryManager.instance = new PlayerRecoveryManager();
    }
    return PlayerRecoveryManager.instance;
  }

  /**
   * 设置配置
   */
  public setConfig(config: Partial<PlayerRebuildConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 执行播放器重建
   */
  public async rebuildPlayer(
    player: any,
    container: HTMLElement,
    options: any
  ): Promise<any> {
    console.log('🎯 rebuildPlayer 方法被调用');

    if (this.isRebuildingFlag) {
      console.warn('播放器正在重建中，跳过重复请求');
      return null;
    }

    this.isRebuildingFlag = true;
    this.rebuildAttempts++;

    const startTime = performance.now();

    try {
      console.log(
        `🔄 开始第 ${this.rebuildAttempts} 次播放器重建... (startTime: ${startTime})`
      );

      // 显示加载指示器
      if (this.config.showLoadingIndicator) {
        showLoadingIndicator(
          '正在修复播放器...',
          this.rebuildAttempts,
          this.config.maxAttempts
        );
      }

      // 1. 捕获播放状态
      const savedState = playerStateManager.captureState(player);

      // 可选：保存到存储
      if (this.config.persistState) {
        playerStateManager.saveState(savedState);
      }

      // 2. 销毁旧实例
      await this.destroyPlayer(player);

      // 3. 等待延迟
      const delay = this.calculateRebuildDelay(this.rebuildAttempts);
      console.log(`等待 ${delay}ms 后创建新实例...`);
      await this.sleep(delay);

      // 4. 创建新实例
      const newPlayer = await this.createPlayer(container, options);

      // 5. 恢复状态
      await playerStateManager.restoreState(newPlayer, savedState);

      // 6. 自动恢复播放
      if (this.config.autoResume && !savedState.paused) {
        try {
          await newPlayer.play();
          console.log('✅ 已自动恢复播放');
        } catch (e) {
          console.warn('自动播放失败:', e);
        }
      }

      // 7. 重置状态
      this.resetRebuildAttempts();
      playerHealthMonitor.markRebuildCompleted();

      // 隐藏加载指示器
      if (this.config.showLoadingIndicator) {
        hideLoadingIndicator();
      }

      // 通知用户
      notifyUser('播放器已自动修复', 'success');

      // 记录成功的重建事件
      const endTime = performance.now();
      const duration = endTime - startTime;
      const healthStatus = playerHealthMonitor.getHealthStatus();

      console.log('📊 准备记录重建事件 (成功):', {
        timestamp: Date.now(),
        success: true,
        reason: healthStatus.rebuildReason || '未知原因',
        duration,
        attemptNumber: this.rebuildAttempts,
      });

      playerHealthStats.recordRebuildEvent({
        timestamp: Date.now(),
        success: true,
        reason: healthStatus.rebuildReason || '未知原因',
        duration,
        attemptNumber: this.rebuildAttempts,
      });

      console.log('✅ 播放器重建成功，统计已记录');
      return newPlayer;
    } catch (error) {
      console.error(`❌ 第 ${this.rebuildAttempts} 次重建失败:`, error);

      // 记录失败的重建事件
      const endTime = performance.now();
      const duration = endTime - startTime;
      const healthStatus = playerHealthMonitor.getHealthStatus();

      console.log('📊 准备记录重建事件 (失败):', {
        timestamp: Date.now(),
        success: false,
        reason: healthStatus.rebuildReason || '未知原因',
        duration,
        attemptNumber: this.rebuildAttempts,
        error: (error as Error).message,
      });

      playerHealthStats.recordRebuildEvent({
        timestamp: Date.now(),
        success: false,
        reason: healthStatus.rebuildReason || '未知原因',
        duration,
        attemptNumber: this.rebuildAttempts,
        error: (error as Error).message,
        errorStack: (error as Error).stack,
      });

      console.log('❌ 播放器重建失败，统计已记录');

      // 隐藏加载指示器
      if (this.config.showLoadingIndicator) {
        hideLoadingIndicator();
      }

      throw error;
    } finally {
      this.isRebuildingFlag = false;
    }
  }

  /**
   * 销毁播放器实例
   */
  public async destroyPlayer(player: any): Promise<void> {
    try {
      console.log('🗑️ 开始销毁播放器实例...');

      if (!player) {
        console.warn('播放器实例不存在，跳过销毁');
        return;
      }

      // 1. 暂停播放
      if (player && !player.paused) {
        try {
          player.pause();
          console.log('✅ 已暂停播放');
        } catch (e) {
          console.warn('暂停播放失败:', e);
        }
      }

      // 2. 停止 HLS 加载
      if (player?.video?.hls) {
        try {
          player.video.hls.stopLoad();
          player.video.hls.detachMedia();
          player.video.hls.destroy();
          player.video.hls = null;
          console.log('✅ 已销毁 HLS 实例');
        } catch (e) {
          console.warn('销毁 HLS 实例失败:', e);
        }
      }

      // 3. 移除所有事件监听器
      try {
        cleanupPlayerEvents();
        console.log('✅ 已清理事件监听器');
      } catch (e) {
        console.warn('清理事件监听器失败:', e);
      }

      // 4. 销毁播放器实例
      if (player && typeof player.destroy === 'function') {
        try {
          player.destroy(false); // false = 不移除容器
          console.log('✅ 已销毁播放器实例');
        } catch (e) {
          console.warn('销毁播放器失败:', e);
        }
      }

      // 5. 清理 DOM 引用
      try {
        const container = document.querySelector('.artplayer-app');
        if (container) {
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
          console.log('✅ 已清理 DOM 引用');
        }
      } catch (e) {
        console.warn('清理 DOM 引用失败:', e);
      }

      // 6. 清理全局引用
      try {
        if (
          typeof window !== 'undefined' &&
          (window as any).artPlayerInstance
        ) {
          (window as any).artPlayerInstance = null;
          console.log('✅ 已清理全局引用');
        }
      } catch (e) {
        console.warn('清理全局引用失败:', e);
      }

      console.log('✅ 播放器实例销毁完成');
    } catch (error) {
      console.error('销毁播放器时发生错误:', error);
      throw error;
    }
  }

  /**
   * 创建新播放器实例
   */
  public async createPlayer(
    container: HTMLElement,
    options: any
  ): Promise<any> {
    try {
      console.log('🎬 开始创建新播放器实例...');

      // 1. 验证容器
      if (!container) {
        throw new Error('播放器容器不存在');
      }

      // 2. 确保容器为空
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      // 3. 动态导入 Artplayer
      let Artplayer: any = null;
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('artplayer');
        Artplayer = mod.default || mod;
      }

      if (!Artplayer) {
        throw new Error('无法加载 Artplayer');
      }

      // 4. 创建新的 Artplayer 实例
      const newPlayer = new Artplayer({
        ...options,
        container: container,
      });

      // 5. 等待播放器就绪
      await this.waitForPlayerReady(newPlayer, this.config.rebuildTimeout);

      // 6. 初始化事件处理
      initPlayerEventHandling();

      // 7. 保存全局引用
      if (typeof window !== 'undefined') {
        (window as any).artPlayerInstance = newPlayer;
      }

      console.log('✅ 新播放器实例创建成功');
      return newPlayer;
    } catch (error) {
      console.error('创建播放器失败:', error);
      throw error;
    }
  }

  /**
   * 完整的恢复流程
   */
  public async recoverPlayer(
    player: any,
    container: HTMLElement,
    options: any
  ): Promise<any> {
    try {
      return await this.rebuildPlayer(player, container, options);
    } catch (error) {
      // 如果还有重试机会，递归重试
      if (this.rebuildAttempts < this.config.maxAttempts) {
        console.log(`将进行第 ${this.rebuildAttempts + 1} 次重建尝试...`);
        return await this.recoverPlayer(player, container, options);
      } else {
        console.error('所有重建尝试均失败');

        // 显示致命错误页面
        showFatalError({
          title: '播放器无法恢复',
          message: '很抱歉，播放器遇到了严重问题，多次修复尝试均失败',
          suggestion: '请尝试刷新页面或更换浏览器',
          error: error as Error,
        });

        throw error;
      }
    }
  }

  /**
   * 检查是否正在重建
   */
  public isRebuilding(): boolean {
    return this.isRebuildingFlag;
  }

  /**
   * 获取重建尝试次数
   */
  public getRebuildAttempts(): number {
    return this.rebuildAttempts;
  }

  /**
   * 重置重建计数
   */
  public resetRebuildAttempts(): void {
    this.rebuildAttempts = 0;
    console.log('✅ 重建计数已重置');
  }

  /**
   * 等待播放器就绪
   */
  private async waitForPlayerReady(
    player: any,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('播放器初始化超时'));
      }, timeout);

      const onReady = () => {
        clearTimeout(timeoutId);
        player.off('ready', onReady);
        player.off('error', onError);
        resolve();
      };

      const onError = (error: any) => {
        clearTimeout(timeoutId);
        player.off('ready', onReady);
        player.off('error', onError);
        reject(error);
      };

      player.on('ready', onReady);
      player.on('error', onError);
    });
  }

  /**
   * 计算重建延迟
   */
  private calculateRebuildDelay(attemptNumber: number): number {
    if (!this.config.useExponentialBackoff) {
      return this.config.rebuildDelay;
    }

    // 指数退避：2秒、5秒、10秒
    const delays = [2000, 5000, 10000];
    return delays[attemptNumber - 1] || 10000;
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 导出单例实例
export const playerRecoveryManager = PlayerRecoveryManager.getInstance();

/**
 * 快捷函数：重建播放器
 */
export async function rebuildPlayer(
  player: any,
  container: HTMLElement,
  options: any
): Promise<any> {
  return playerRecoveryManager.rebuildPlayer(player, container, options);
}

/**
 * 快捷函数：销毁播放器
 */
export async function destroyPlayer(player: any): Promise<void> {
  return playerRecoveryManager.destroyPlayer(player);
}

/**
 * 快捷函数：创建播放器
 */
export async function createPlayer(
  container: HTMLElement,
  options: any
): Promise<any> {
  return playerRecoveryManager.createPlayer(container, options);
}
