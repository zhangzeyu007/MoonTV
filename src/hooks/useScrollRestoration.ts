/**
 * 滚动位置恢复 Hook
 * 封装滚动位置管理逻辑，供搜索页面使用
 */

import { useCallback, useEffect, useRef } from 'react';

import {
  navigationLockManager,
  platformDetector,
  ScrollPositionManager,
} from '@/lib/scroll-restoration';

export interface UseScrollRestorationOptions {
  /**
   * 是否启用滚动恢复
   */
  enabled?: boolean;

  /**
   * 是否有搜索结果
   */
  hasResults?: boolean;

  /**
   * 搜索结果数量
   */
  resultsCount?: number;

  /**
   * 是否正在加载
   */
  isLoading?: boolean;
}

export interface UseScrollRestorationReturn {
  /**
   * 滚动位置管理器实例
   */
  manager: ScrollPositionManager;

  /**
   * 保存当前滚动位置
   */
  savePosition: (anchorKey?: string) => void;

  /**
   * 恢复滚动位置
   */
  restorePosition: () => Promise<boolean>;

  /**
   * 清除保存的滚动位置
   */
  clearPosition: () => void;

  /**
   * 获取当前滚动位置
   */
  getCurrentPosition: () => number;

  /**
   * 设置导航锁
   */
  lockNavigation: (position: number, anchorKey?: string) => void;

  /**
   * 释放导航锁
   */
  unlockNavigation: () => void;

  /**
   * 是否为 iOS 平台
   */
  isIOS: boolean;
}

/**
 * 滚动位置恢复 Hook
 */
export function useScrollRestoration(
  options: UseScrollRestorationOptions = {}
): UseScrollRestorationReturn {
  const { enabled = true } = options;

  // 创建管理器实例（使用 ref 确保单例）
  const managerRef = useRef<ScrollPositionManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new ScrollPositionManager(
      platformDetector,
      navigationLockManager
    );
  }

  const manager = managerRef.current;
  const isIOS = manager.getPlatform() === 'ios';

  // 启动/停止监听
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // 清理遗留的导航锁
    navigationLockManager.clearStalelock();

    // 启动滚动监听
    manager.startListening();

    // 暴露全局函数供 VideoCard 使用
    if (typeof window !== 'undefined') {
      (window as any).getSearchPageScrollPosition = () =>
        manager.getCurrentScrollPosition();
      (window as any).lockSearchNavigation = (
        position: number,
        anchorKey?: string
      ) => navigationLockManager.lock(position, anchorKey);
      (window as any).saveSearchScrollPosition = (
        position: number,
        anchorKey?: string
      ) => manager.saveScrollPosition(position, anchorKey);
    }

    return () => {
      manager.stopListening();

      // 清除全局函数
      if (typeof window !== 'undefined') {
        delete (window as any).getSearchPageScrollPosition;
        delete (window as any).lockSearchNavigation;
        delete (window as any).saveSearchScrollPosition;
      }
    };
  }, [enabled, manager]);

  // 保存当前滚动位置
  const savePosition = useCallback(
    (anchorKey?: string) => {
      if (!enabled) {
        return;
      }

      const position = manager.getCurrentScrollPosition();
      manager.saveScrollPosition(position, anchorKey);
    },
    [enabled, manager]
  );

  // 恢复滚动位置
  const restorePosition = useCallback(async () => {
    if (!enabled) {
      return false;
    }

    return await manager.restoreScrollPosition();
  }, [enabled, manager]);

  // 清除保存的滚动位置
  const clearPosition = useCallback(() => {
    if (!enabled) {
      return;
    }

    manager.clearScrollPosition();
  }, [enabled, manager]);

  // 获取当前滚动位置
  const getCurrentPosition = useCallback(() => {
    return manager.getCurrentScrollPosition();
  }, [manager]);

  // 设置导航锁
  const lockNavigation = useCallback((position: number, anchorKey?: string) => {
    navigationLockManager.lock(position, anchorKey);
  }, []);

  // 释放导航锁
  const unlockNavigation = useCallback(() => {
    navigationLockManager.unlock();
  }, []);

  // 页面卸载时保存滚动位置
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleBeforeUnload = () => {
      savePosition();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        savePosition();
      }
    };

    const handlePageHide = () => {
      savePosition();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [enabled, savePosition]);

  // iOS 特殊处理：BFCache 支持
  useEffect(() => {
    if (!enabled || !isIOS) {
      return;
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // 从 BFCache 恢复
        setTimeout(() => {
          restorePosition();
        }, 100);
      }
    };

    const handlePopState = () => {
      setTimeout(() => {
        restorePosition();
      }, 100);
    };

    window.addEventListener('pageshow', handlePageShow as any);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('pageshow', handlePageShow as any);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled, isIOS, restorePosition]);

  return {
    manager,
    savePosition,
    restorePosition,
    clearPosition,
    getCurrentPosition,
    lockNavigation,
    unlockNavigation,
    isIOS,
  };
}
