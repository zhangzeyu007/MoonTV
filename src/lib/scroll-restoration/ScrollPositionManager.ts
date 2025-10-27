/**
 * 滚动位置管理器
 * 统一管理滚动位置的获取、保存和恢复
 */

import { getPlatformConfig } from './config';
import { POSITION, STORAGE_KEYS, TIMING } from './constants';
import { IOSScrollRestorer } from './IOSScrollRestorer';
import { NavigationLockManager } from './NavigationLockManager';
import { PCScrollRestorer } from './PCScrollRestorer';
import { PlatformDetector } from './PlatformDetector';
import { ScrollPositionCache } from './ScrollPositionCache';
import type { SavedScrollState, ScrollOptions } from './types';

export interface IScrollPositionManager {
  /**
   * 获取当前滚动位置
   */
  getCurrentScrollPosition(): number;

  /**
   * 设置滚动位置
   */
  setScrollPosition(
    position: number,
    options?: ScrollOptions
  ): Promise<boolean>;

  /**
   * 保存滚动位置到缓存和存储
   */
  saveScrollPosition(position: number, anchorKey?: string): void;

  /**
   * 从存储恢复滚动位置
   */
  restoreScrollPosition(): Promise<boolean>;

  /**
   * 清除保存的滚动位置
   */
  clearScrollPosition(): void;

  /**
   * 启动滚动监听
   */
  startListening(): void;

  /**
   * 停止滚动监听
   */
  stopListening(): void;
}

/**
 * 滚动位置管理器实现
 */
export class ScrollPositionManager implements IScrollPositionManager {
  private platformDetector: PlatformDetector;
  private scrollCache: ScrollPositionCache;
  private navLockManager: NavigationLockManager;
  private iosRestorer: IOSScrollRestorer;
  private pcRestorer: PCScrollRestorer;
  private platform: 'ios' | 'pc';

  constructor(
    platformDetector: PlatformDetector,
    navLockManager: NavigationLockManager
  ) {
    this.platformDetector = platformDetector;
    this.navLockManager = navLockManager;

    // 检测平台
    const isIOS = this.platformDetector.isIOS();
    this.platform = isIOS ? 'ios' : 'pc';

    // 初始化组件
    const config = getPlatformConfig(this.platform);
    this.scrollCache = new ScrollPositionCache(isIOS);
    this.iosRestorer = new IOSScrollRestorer(config);
    this.pcRestorer = new PCScrollRestorer(config);
  }

  /**
   * 获取当前滚动位置（使用多种方法确保准确性）
   */
  getCurrentScrollPosition(): number {
    if (typeof window === 'undefined') {
      return 0;
    }

    const methods = [
      () => (typeof window.scrollY === 'number' ? window.scrollY : 0),
      () => document.documentElement?.scrollTop || 0,
      () => document.body?.scrollTop || 0,
      () => document.scrollingElement?.scrollTop || 0,
    ];

    // 找到第一个非零值
    for (const method of methods) {
      try {
        const value = method();
        if (value > 0) {
          // 更新缓存
          this.scrollCache.update(value);
          return value;
        }
      } catch (e) {
        continue;
      }
    }

    // 如果都是0，返回最大值
    const maxValue = Math.max(
      ...methods.map((m) => {
        try {
          return m();
        } catch {
          return 0;
        }
      })
    );

    this.scrollCache.update(maxValue);
    return maxValue;
  }

  /**
   * 设置滚动位置
   */
  async setScrollPosition(
    position: number,
    options?: ScrollOptions
  ): Promise<boolean> {
    const platform = options?.platform || this.platform;
    const anchorKey = options?.anchorKey;

    console.log('[滚动位置管理器] 开始恢复', {
      position,
      platform,
      anchorKey,
      options,
    });

    try {
      let success = false;

      if (platform === 'ios') {
        success = await this.iosRestorer.restore(position, anchorKey);
      } else {
        success = await this.pcRestorer.restore(position);
      }

      if (success) {
        // 更新缓存
        this.scrollCache.update(position);
        // 释放导航锁
        this.navLockManager.unlock();
      }

      return success;
    } catch (error) {
      console.error('[滚动位置管理器] 恢复失败', error);
      return false;
    }
  }

  /**
   * 保存滚动位置到缓存和存储
   */
  saveScrollPosition(position: number, anchorKey?: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    // 检查导航锁
    if (this.navLockManager.isLocked()) {
      console.log('[滚动位置管理器] 检测到导航锁，跳过保存');
      return;
    }

    // 小值回写保护
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_PAGE_STATE);
      if (saved) {
        const parsed: SavedScrollState = JSON.parse(saved);
        const prevPosition = parsed.scrollPosition || 0;

        if (
          prevPosition > 0 &&
          position > 0 &&
          position < POSITION.SMALL_VALUE_THRESHOLD &&
          prevPosition > position + POSITION.SMALL_VALUE_DIFF
        ) {
          console.log('[滚动位置管理器] 小值回写被忽略', {
            prevPosition,
            position,
          });
          return;
        }
      }

      // 更新存储
      const state: Partial<SavedScrollState> = saved ? JSON.parse(saved) : {};
      state.scrollPosition = position;
      state.anchorKey = anchorKey;
      state.timestamp = Date.now();
      localStorage.setItem(
        STORAGE_KEYS.SEARCH_PAGE_STATE,
        JSON.stringify(state)
      );

      // 更新缓存
      this.scrollCache.update(position);

      console.log('[滚动位置管理器] 保存成功', { position, anchorKey });
    } catch (error) {
      console.error('[滚动位置管理器] 保存失败', error);
    }
  }

  /**
   * 从存储恢复滚动位置
   */
  async restoreScrollPosition(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_PAGE_STATE);
      if (!saved) {
        console.log('[滚动位置管理器] 没有保存的状态');
        return false;
      }

      const state: SavedScrollState = JSON.parse(saved);

      // 检查状态是否过期（24小时）
      const isExpired = Date.now() - state.timestamp > TIMING.STATE_EXPIRY;
      if (isExpired) {
        console.log('[滚动位置管理器] 状态已过期');
        localStorage.removeItem(STORAGE_KEYS.SEARCH_PAGE_STATE);
        return false;
      }

      const position = state.scrollPosition;
      const anchorKey = state.anchorKey;

      if (!position || position <= 0) {
        console.log('[滚动位置管理器] 无效的滚动位置');
        return false;
      }

      console.log('[滚动位置管理器] 开始恢复', { position, anchorKey });

      // 根据平台调用相应的恢复器
      const success = await this.setScrollPosition(position, { anchorKey });

      if (success) {
        console.log('[滚动位置管理器] 恢复成功');
      } else {
        console.warn('[滚动位置管理器] 恢复失败');
      }

      return success;
    } catch (error) {
      console.error('[滚动位置管理器] 恢复错误', error);
      return false;
    }
  }

  /**
   * 清除保存的滚动位置
   */
  clearScrollPosition(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(STORAGE_KEYS.SEARCH_PAGE_STATE);
      this.scrollCache.clear();
      this.navLockManager.unlock();
      console.log('[滚动位置管理器] 已清除');
    } catch (error) {
      console.error('[滚动位置管理器] 清除失败', error);
    }
  }

  /**
   * 启动滚动监听
   */
  startListening(): void {
    this.scrollCache.startListening();
    console.log('[滚动位置管理器] 已启动监听');
  }

  /**
   * 停止滚动监听
   */
  stopListening(): void {
    this.scrollCache.stopListening();
    console.log('[滚动位置管理器] 已停止监听');
  }

  /**
   * 获取平台类型
   */
  getPlatform(): 'ios' | 'pc' {
    return this.platform;
  }

  /**
   * 获取导航锁管理器
   */
  getNavLockManager(): NavigationLockManager {
    return this.navLockManager;
  }
}
