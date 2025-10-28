/**
 * 播放器状态管理器
 * 捕获和恢复播放器状态
 */

/**
 * 播放器状态接口
 */
export interface PlayerState {
  // 基本播放信息
  videoUrl: string;
  currentTime: number;
  volume: number;
  playbackRate: number;
  muted: boolean;
  paused: boolean;

  // 字幕信息
  subtitles?: {
    enabled: boolean;
    track?: number;
  };

  // 质量信息
  quality?: string;

  // UI 状态
  fullscreen?: boolean;
  pip?: boolean;
  aspectRatio?: string;
  flip?: string;

  // 自定义配置
  customConfig?: {
    autoplay?: boolean;
    loop?: boolean;
    screenshot?: boolean;
    hotkey?: boolean;
    [key: string]: any;
  };

  // 时间戳
  capturedAt: number;
}

/**
 * 播放器状态管理器类
 */
export class PlayerStateManager {
  private static instance: PlayerStateManager | null = null;

  // 最后捕获的状态
  private lastCapturedState: PlayerState | null = null;

  // 存储键名
  private readonly STORAGE_KEY = 'player_recovery_state';

  /**
   * 获取单例实例
   */
  public static getInstance(): PlayerStateManager {
    if (!PlayerStateManager.instance) {
      PlayerStateManager.instance = new PlayerStateManager();
    }
    return PlayerStateManager.instance;
  }

  /**
   * 捕获当前播放器状态
   */
  public captureState(player: any): PlayerState {
    try {
      if (!player) {
        throw new Error('播放器实例不存在');
      }

      const state: PlayerState = {
        // 基本播放信息
        videoUrl: player.url || '',
        currentTime: player.currentTime || 0,
        volume: player.volume ?? 0.7,
        playbackRate: player.playbackRate || 1,
        muted: player.muted || false,
        paused: player.paused !== false,

        // 字幕信息
        subtitles: {
          enabled: player.subtitle?.show || false,
          track: player.subtitle?.index ?? 0,
        },

        // 质量信息
        quality: player.quality?.name || 'auto',

        // UI 状态
        fullscreen: player.fullscreen || false,
        pip: player.pip || false,
        aspectRatio: player.aspectRatio || 'default',
        flip: player.flip || 'normal',

        // 自定义配置
        customConfig: {
          autoplay: player.autoplay,
          loop: player.loop,
          screenshot: player.screenshot,
          hotkey: player.hotkey,
        },

        // 时间戳
        capturedAt: Date.now(),
      };

      // 保存到内存
      this.lastCapturedState = state;

      console.log('✅ 已捕获播放器状态:', {
        url: state.videoUrl.substring(0, 50) + '...',
        time: state.currentTime,
        volume: state.volume,
        paused: state.paused,
      });

      return state;
    } catch (error) {
      console.error('捕获播放器状态失败:', error);

      // 返回最小状态
      const minimalState: PlayerState = {
        videoUrl: '',
        currentTime: 0,
        volume: 0.7,
        playbackRate: 1,
        muted: false,
        paused: true,
        capturedAt: Date.now(),
      };

      this.lastCapturedState = minimalState;
      return minimalState;
    }
  }

  /**
   * 恢复播放器状态
   */
  public async restoreState(player: any, state: PlayerState): Promise<void> {
    try {
      if (!player) {
        throw new Error('播放器实例不存在');
      }

      if (!state) {
        throw new Error('状态对象不存在');
      }

      console.log('开始恢复播放器状态...');

      // 1. 恢复视频 URL（如果不同）
      if (state.videoUrl && player.url !== state.videoUrl) {
        console.log('恢复视频 URL...');
        player.switchUrl(state.videoUrl);
      }

      // 2. 等待视频加载
      await this.waitForVideoReady(player);

      // 3. 恢复播放时间
      if (state.currentTime > 0) {
        player.currentTime = state.currentTime;
        console.log(`✅ 已恢复播放时间: ${state.currentTime.toFixed(2)}秒`);
      }

      // 4. 恢复音量
      if (
        typeof state.volume === 'number' &&
        state.volume >= 0 &&
        state.volume <= 1
      ) {
        player.volume = state.volume;
        console.log(`✅ 已恢复音量: ${(state.volume * 100).toFixed(0)}%`);
      }

      // 5. 恢复播放速率
      if (state.playbackRate && state.playbackRate > 0) {
        player.playbackRate = state.playbackRate;
        console.log(`✅ 已恢复播放速率: ${state.playbackRate}x`);
      }

      // 6. 恢复静音状态
      if (state.muted !== undefined) {
        player.muted = state.muted;
        console.log(`✅ 已恢复静音状态: ${state.muted}`);
      }

      // 7. 恢复字幕
      if (state.subtitles?.enabled && player.subtitle) {
        try {
          player.subtitle.show = true;
          if (state.subtitles.track !== undefined) {
            player.subtitle.switch(state.subtitles.track);
          }
          console.log('✅ 已恢复字幕设置');
        } catch (e) {
          console.warn('恢复字幕失败:', e);
        }
      }

      // 8. 恢复全屏状态
      if (state.fullscreen && player.fullscreen !== state.fullscreen) {
        try {
          player.fullscreen = state.fullscreen;
          console.log('✅ 已恢复全屏状态');
        } catch (e) {
          console.warn('恢复全屏状态失败:', e);
        }
      }

      // 9. 恢复画中画状态
      if (state.pip && player.pip !== state.pip) {
        try {
          player.pip = state.pip;
          console.log('✅ 已恢复画中画状态');
        } catch (e) {
          console.warn('恢复画中画状态失败:', e);
        }
      }

      // 10. 恢复宽高比
      if (state.aspectRatio && player.aspectRatio !== state.aspectRatio) {
        try {
          player.aspectRatio = state.aspectRatio;
          console.log('✅ 已恢复宽高比');
        } catch (e) {
          console.warn('恢复宽高比失败:', e);
        }
      }

      console.log('✅ 播放器状态恢复完成');
    } catch (error) {
      console.error('恢复播放器状态失败:', error);
      // 不抛出错误，允许播放器以默认状态运行
    }
  }

  /**
   * 保存状态到存储
   */
  public saveState(state: PlayerState): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        console.warn('localStorage 不可用，无法保存状态');
        return;
      }

      const stateJson = JSON.stringify(state);
      localStorage.setItem(this.STORAGE_KEY, stateJson);
      console.log('✅ 状态已保存到 localStorage');
    } catch (error) {
      console.warn('保存状态到 localStorage 失败:', error);
    }
  }

  /**
   * 从存储加载状态
   */
  public loadState(): PlayerState | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        console.warn('localStorage 不可用，无法加载状态');
        return null;
      }

      const stateJson = localStorage.getItem(this.STORAGE_KEY);
      if (!stateJson) {
        return null;
      }

      const state = JSON.parse(stateJson) as PlayerState;

      // 验证状态有效性
      if (!this.validateState(state)) {
        console.warn('加载的状态无效');
        return null;
      }

      console.log('✅ 从 localStorage 加载状态成功');
      return state;
    } catch (error) {
      console.warn('从 localStorage 加载状态失败:', error);
      return null;
    }
  }

  /**
   * 清除保存的状态
   */
  public clearState(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }

      localStorage.removeItem(this.STORAGE_KEY);
      this.lastCapturedState = null;
      console.log('✅ 已清除保存的状态');
    } catch (error) {
      console.warn('清除状态失败:', error);
    }
  }

  /**
   * 获取最后捕获的状态
   */
  public getLastCapturedState(): PlayerState | null {
    return this.lastCapturedState;
  }

  /**
   * 等待视频加载就绪
   */
  private async waitForVideoReady(player: any, timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('视频加载超时'));
      }, timeout);

      const checkReady = () => {
        try {
          if (!player || !player.video) {
            clearTimeout(timeoutId);
            reject(new Error('播放器或视频元素不存在'));
            return;
          }

          // 检查视频是否就绪（readyState >= 2 表示有足够数据可以播放）
          if (player.video.readyState >= 2) {
            clearTimeout(timeoutId);
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      };

      checkReady();
    });
  }

  /**
   * 验证状态有效性
   */
  private validateState(state: any): state is PlayerState {
    if (!state || typeof state !== 'object') {
      return false;
    }

    // 检查必需字段
    if (
      typeof state.videoUrl !== 'string' ||
      typeof state.currentTime !== 'number' ||
      typeof state.volume !== 'number' ||
      typeof state.playbackRate !== 'number' ||
      typeof state.muted !== 'boolean' ||
      typeof state.paused !== 'boolean'
    ) {
      return false;
    }

    // 检查数值范围
    if (
      state.currentTime < 0 ||
      state.volume < 0 ||
      state.volume > 1 ||
      state.playbackRate <= 0
    ) {
      return false;
    }

    // 检查状态是否过期（超过1小时）
    if (state.capturedAt && Date.now() - state.capturedAt > 3600000) {
      console.warn('状态已过期（超过1小时）');
      return false;
    }

    return true;
  }
}

// 导出单例实例
export const playerStateManager = PlayerStateManager.getInstance();

/**
 * 快捷函数：捕获播放器状态
 */
export function capturePlayerState(player: any): PlayerState {
  return playerStateManager.captureState(player);
}

/**
 * 快捷函数：恢复播放器状态
 */
export async function restorePlayerState(
  player: any,
  state: PlayerState
): Promise<void> {
  return playerStateManager.restoreState(player, state);
}

/**
 * 快捷函数：保存状态到存储
 */
export function savePlayerState(state: PlayerState): void {
  playerStateManager.saveState(state);
}

/**
 * 快捷函数：从存储加载状态
 */
export function loadPlayerState(): PlayerState | null {
  return playerStateManager.loadState();
}
