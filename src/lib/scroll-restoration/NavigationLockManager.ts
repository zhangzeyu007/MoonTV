/**
 * 导航锁管理器
 * 管理导航锁，防止跳转过程中的错误覆盖
 */

import { GLOBAL_KEYS } from './constants';
import type { NavigationLockState } from './types';

export interface INavigationLockManager {
  /**
   * 设置导航锁
   */
  lock(scrollPosition: number, anchorKey?: string): void;

  /**
   * 释放导航锁
   */
  unlock(): void;

  /**
   * 检查是否已锁定
   */
  isLocked(): boolean;

  /**
   * 获取锁定的滚动位置
   */
  getLockedPosition(): number | null;

  /**
   * 获取锁定的锚点标识
   */
  getLockedAnchorKey(): string | null;
}

/**
 * 导航锁管理器实现
 */
export class NavigationLockManager implements INavigationLockManager {
  private lockState: NavigationLockState | null = null;

  /**
   * 设置导航锁
   */
  lock(scrollPosition: number, anchorKey?: string): void {
    this.lockState = {
      active: true,
      position: scrollPosition,
      timestamp: Date.now(),
      anchorKey,
    };

    // 存储到全局对象供其他组件访问
    if (typeof window !== 'undefined') {
      (window as any)[GLOBAL_KEYS.NAV_LOCK] = this.lockState;
    }

    console.log('[导航锁] 已设置', this.lockState);
  }

  /**
   * 释放导航锁
   */
  unlock(): void {
    if (this.lockState) {
      console.log('[导航锁] 已释放', this.lockState);
      this.lockState = null;

      if (typeof window !== 'undefined') {
        (window as any)[GLOBAL_KEYS.NAV_LOCK] = { active: false };
      }
    }
  }

  /**
   * 检查是否已锁定
   */
  isLocked(): boolean {
    return this.lockState?.active ?? false;
  }

  /**
   * 获取锁定的滚动位置
   */
  getLockedPosition(): number | null {
    return this.lockState?.position ?? null;
  }

  /**
   * 获取锁定的锚点标识
   */
  getLockedAnchorKey(): string | null {
    return this.lockState?.anchorKey ?? null;
  }

  /**
   * 清理遗留的导航锁（用于组件挂载时）
   */
  clearStalelock(): void {
    if (typeof window !== 'undefined') {
      const globalLock = (window as any)[GLOBAL_KEYS.NAV_LOCK];
      if (globalLock?.active) {
        console.log('[导航锁] 清理遗留锁', globalLock);
        (window as any)[GLOBAL_KEYS.NAV_LOCK] = { active: false };
      }
    }
    this.lockState = null;
  }
}

// 导出单例实例
export const navigationLockManager = new NavigationLockManager();
