/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 源切换执行器
 * 执行源切换操作，保存和恢复播放器状态
 */

import { URLValidator } from './url-validator';

export interface SwitchContext {
  currentSource: any;
  targetSource: any;
  currentTime: number;
  volume: number;
  playbackRate: number;
  paused: boolean;
  reason: string;
  muted?: boolean;
  subtitles?: {
    enabled: boolean;
    track?: number;
  };
}

export type NotificationType = 'info' | 'success' | 'error';

/**
 * 源切换执行器类
 */
export class SourceSwitchExecutor {
  private player: any = null;
  private isSwitching = false;
  private switchTimeout: NodeJS.Timeout | null = null;
  private readonly SWITCH_TIMEOUT = 2000; // 2秒切换超时

  /**
   * 设置播放器实例
   */
  public setPlayer(player: any): void {
    this.player = player;
  }

  /**
   * 执行源切换
   */
  public async switchSource(context: SwitchContext): Promise<boolean> {
    if (this.isSwitching) {
      console.warn('[SourceSwitchExecutor] 正在切换中，跳过重复请求');
      return false;
    }

    if (!this.player) {
      console.error('[SourceSwitchExecutor] 播放器实例未设置');
      return false;
    }

    this.isSwitching = true;
    const startTime = Date.now();

    try {
      console.log(
        `[SourceSwitchExecutor] 开始切换源: ${
          context.currentSource?.name || 'unknown'
        } -> ${context.targetSource?.name || 'unknown'}`
      );

      // 显示切换提示
      this.showSwitchNotification(
        `正在切换到 ${context.targetSource?.name || '备用源'}...`,
        'info'
      );

      // 保存当前状态（已在 context 中）
      console.log('[SourceSwitchExecutor] 当前状态:', {
        currentTime: context.currentTime,
        volume: context.volume,
        playbackRate: context.playbackRate,
        paused: context.paused,
      });

      // 切换视频源
      const switchSuccess = await this.performSwitch(context);

      if (!switchSuccess) {
        throw new Error('切换视频源失败');
      }

      // 恢复播放器状态
      await this.restorePlayerState(context);

      const duration = Date.now() - startTime;
      console.log(`[SourceSwitchExecutor] 切换成功，耗时 ${duration}ms`);

      // 显示成功提示
      this.showSwitchNotification(
        `已切换到 ${context.targetSource?.name || '备用源'}`,
        'success'
      );

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[SourceSwitchExecutor] 切换失败，耗时 ${duration}ms:`,
        error
      );

      // 显示失败提示
      this.showSwitchNotification(
        `切换失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'error'
      );

      return false;
    } finally {
      this.isSwitching = false;
      if (this.switchTimeout) {
        clearTimeout(this.switchTimeout);
        this.switchTimeout = null;
      }
    }
  }

  /**
   * 捕获播放器状态
   */
  public capturePlayerState(): SwitchContext | null {
    if (!this.player) {
      console.error('[SourceSwitchExecutor] 播放器实例未设置');
      return null;
    }

    try {
      const context: SwitchContext = {
        currentSource: null, // 需要外部提供
        targetSource: null, // 需要外部提供
        currentTime: this.player.currentTime || 0,
        volume: this.player.volume || 0.7,
        playbackRate: this.player.playbackRate || 1,
        paused: this.player.paused !== false,
        reason: '', // 需要外部提供
        muted: this.player.muted || false,
      };

      // 捕获字幕状态
      if (this.player.subtitle) {
        context.subtitles = {
          enabled: this.player.subtitle.show || false,
          track: this.player.subtitle.index || 0,
        };
      }

      console.log('[SourceSwitchExecutor] 已捕获播放器状态:', context);

      return context;
    } catch (error) {
      console.error('[SourceSwitchExecutor] 捕获播放器状态失败:', error);
      return null;
    }
  }

  /**
   * 恢复播放器状态
   */
  public async restorePlayerState(context: SwitchContext): Promise<void> {
    if (!this.player) {
      throw new Error('播放器实例未设置');
    }

    try {
      console.log('[SourceSwitchExecutor] 开始恢复播放器状态');

      // 等待视频加载就绪
      await this.waitForVideoReady();

      // 恢复播放时间
      if (context.currentTime > 0) {
        this.player.currentTime = context.currentTime;
        console.log(
          `[SourceSwitchExecutor] 恢复播放时间: ${context.currentTime}秒`
        );
      }

      // 恢复音量
      if (typeof context.volume === 'number') {
        this.player.volume = context.volume;
        console.log(`[SourceSwitchExecutor] 恢复音量: ${context.volume}`);
      }

      // 恢复播放速率
      if (context.playbackRate) {
        this.player.playbackRate = context.playbackRate;
        console.log(
          `[SourceSwitchExecutor] 恢复播放速率: ${context.playbackRate}x`
        );
      }

      // 恢复静音状态
      if (context.muted !== undefined) {
        this.player.muted = context.muted;
      }

      // 恢复字幕
      if (context.subtitles?.enabled && this.player.subtitle) {
        this.player.subtitle.show = true;
        if (context.subtitles.track !== undefined) {
          this.player.subtitle.switch(context.subtitles.track);
        }
      }

      // 恢复播放状态
      if (!context.paused) {
        await this.player.play();
        console.log('[SourceSwitchExecutor] 恢复播放');
      }

      console.log('[SourceSwitchExecutor] 播放器状态恢复完成');
    } catch (error) {
      console.error('[SourceSwitchExecutor] 恢复播放器状态失败:', error);
      // 不抛出错误，允许播放器以默认状态运行
    }
  }

  /**
   * 显示切换提示
   */
  public showSwitchNotification(message: string, type: NotificationType): void {
    if (!this.player) return;

    try {
      const notice = (this.player as any).notice;
      if (notice && typeof notice.show === 'function') {
        // 根据类型设置显示时间
        const duration =
          type === 'success' ? 2000 : type === 'error' ? 4000 : 3000;
        notice.show(message, duration);
      } else {
        // 降级到控制台
        console.log(`[SourceSwitchExecutor] ${type.toUpperCase()}: ${message}`);
      }
    } catch (error) {
      console.error('[SourceSwitchExecutor] 显示通知失败:', error);
    }
  }

  /**
   * 检查是否正在切换
   */
  public isSwitchingSource(): boolean {
    return this.isSwitching;
  }

  /**
   * 取消切换
   */
  public cancelSwitch(): void {
    if (this.switchTimeout) {
      clearTimeout(this.switchTimeout);
      this.switchTimeout = null;
    }
    this.isSwitching = false;
    console.log('[SourceSwitchExecutor] 切换已取消');
  }

  /**
   * 执行实际的源切换
   */
  private async performSwitch(context: SwitchContext): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // 1. 验证目标源URL
        const validation = URLValidator.validateSourceURL(context.targetSource);

        if (!validation.valid) {
          // 记录完整的targetSource对象结构用于调试
          console.error('[SourceSwitchExecutor] URL验证失败:', {
            targetSource: context.targetSource,
            error: validation.error,
            errorType: validation.errorType,
            timestamp: new Date().toISOString(),
          });

          // 创建带有validationError标志的错误对象
          const error = new Error(
            `URL验证失败: ${validation.error} (类型: ${validation.errorType})`
          );
          (error as any).validationError = true;
          (error as any).errorType = validation.errorType;
          (error as any).targetSource = context.targetSource;
          reject(error);
          return;
        }

        const targetUrl = validation.url!;

        // 2. 记录验证成功的URL
        console.log(`[SourceSwitchExecutor] URL验证通过: ${targetUrl}`, {
          episodeUrl: context.targetSource?.episodeUrl,
          url: context.targetSource?.url,
          normalizedUrl: targetUrl,
          timestamp: new Date().toISOString(),
        });

        // 3. 设置超时保护
        this.switchTimeout = setTimeout(() => {
          reject(new Error('切换超时'));
        }, this.SWITCH_TIMEOUT);

        // 4. 执行切换
        if (typeof this.player.switchUrl === 'function') {
          this.player.switchUrl(targetUrl);
        } else {
          this.player.url = targetUrl;
        }

        console.log(`[SourceSwitchExecutor] 已切换到新源: ${targetUrl}`);
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 等待视频加载就绪
   */
  private async waitForVideoReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('等待视频就绪超时'));
      }, 5000);

      const checkReady = () => {
        if (this.player?.video?.readyState >= 2) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * 销毁执行器
   */
  public destroy(): void {
    this.cancelSwitch();
    this.player = null;
    console.log('[SourceSwitchExecutor] 执行器已销毁');
  }
}

// 导出便捷函数
export function createSourceSwitchExecutor(): SourceSwitchExecutor {
  return new SourceSwitchExecutor();
}
