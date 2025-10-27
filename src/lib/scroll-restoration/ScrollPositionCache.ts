/**
 * 滚动位置缓存
 * 实时缓存滚动位置，确保点击时能获取准确值
 */

import { GLOBAL_KEYS, POSITION, STORAGE_KEYS, TIMING } from './constants';
import type { SavedScrollState } from './types';

export interface IScrollPositionCache {
  /**
   * 更新缓存的滚动位置
   */
  update(position: number): void;

  /**
   * 获取缓存的滚动位置
   */
  get(): number;

  /**
   * 清除缓存
   */
  clear(): void;

  /**
   * 启动监听
   */
  startListening(): void;

  /**
   * 停止监听
   */
  stopListening(): void;
}

/**
 * 滚动位置缓存实现
 */
export class ScrollPositionCache implements IScrollPositionCache {
  private cachedPosition = 0;
  private rafId: number | null = null;
  private lastUpdateTime = 0;
  private updateInterval: number;
  private isListening = false;
  private scrollHandler: (() => void) | null = null;

  constructor(private isIOS: boolean) {
    // iOS 降低更新频率
    this.updateInterval = isIOS
      ? TIMING.IOS_SAVE_INTERVAL
      : TIMING.PC_SAVE_INTERVAL;
  }

  /**
   * 启动监听滚动事件
   */
  startListening(): void {
    if (this.isListening || typeof window === 'undefined') {
      return;
    }

    let ticking = false;

    this.scrollHandler = () => {
      if (!ticking) {
        ticking = true;
        this.rafId = requestAnimationFrame(() => {
          const now = Date.now();

          // 立即更新缓存
          const currentPos = this.getCurrentScrollPosition();
          this.cachedPosition = currentPos;

          // 限制保存频率
          if (now - this.lastUpdateTime >= this.updateInterval) {
            this.saveToStorage(currentPos);
            this.lastUpdateTime = now;
          }

          ticking = false;
        });
      }
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.isListening = true;

    // 暴露全局方法供其他组件使用
    if (typeof window !== 'undefined') {
      (window as any)[GLOBAL_KEYS.GET_SCROLL_POSITION] = () => this.get();
      (window as any)[GLOBAL_KEYS.UPDATE_SCROLL_CACHE] = (pos: number) =>
        this.update(pos);
    }
  }

  /**
   * 停止监听滚动事件
   */
  stopListening(): void {
    if (!this.isListening || typeof window === 'undefined') {
      return;
    }

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.isListening = false;

    // 清除全局方法
    if (typeof window !== 'undefined') {
      delete (window as any)[GLOBAL_KEYS.GET_SCROLL_POSITION];
      delete (window as any)[GLOBAL_KEYS.UPDATE_SCROLL_CACHE];
    }
  }

  /**
   * 获取当前滚动位置（使用多种方法确保准确性）
   */
  private getCurrentScrollPosition(): number {
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
          return value;
        }
      } catch (e) {
        continue;
      }
    }

    // 如果都是0，返回最大值
    return Math.max(
      ...methods.map((m) => {
        try {
          return m();
        } catch {
          return 0;
        }
      })
    );
  }

  /**
   * 保存到 LocalStorage
   */
  private saveToStorage(position: number): void {
    if (typeof window === 'undefined') {
      return;
    }

    // 检查导航锁
    const navLock = (window as any)[GLOBAL_KEYS.NAV_LOCK];
    if (navLock?.active) {
      return;
    }

    // 小值回写保护
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_PAGE_STATE);
      if (saved) {
        const parsed: SavedScrollState = JSON.parse(saved);
        const prevPosition = parsed.scrollPosition || 0;

        // 如果当前值很小且之前有大值，忽略
        if (
          prevPosition > 0 &&
          position > 0 &&
          position < POSITION.SMALL_VALUE_THRESHOLD &&
          prevPosition > position + POSITION.SMALL_VALUE_DIFF
        ) {
          return;
        }
      }

      // 更新存储
      const state: Partial<SavedScrollState> = saved ? JSON.parse(saved) : {};
      state.scrollPosition = position;
      state.timestamp = Date.now();
      localStorage.setItem(
        STORAGE_KEYS.SEARCH_PAGE_STATE,
        JSON.stringify(state)
      );
    } catch (e) {
      // 静默处理错误
    }
  }

  /**
   * 更新缓存的滚动位置
   */
  update(position: number): void {
    this.cachedPosition = position;
  }

  /**
   * 获取缓存的滚动位置
   */
  get(): number {
    return this.cachedPosition;
  }

  /**
   * 清除缓存
   */
  clear(): void {
    this.cachedPosition = 0;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
