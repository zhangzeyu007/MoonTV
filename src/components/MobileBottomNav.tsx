'use client';

import { Clover, Film, Home, Search, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

interface MobileBottomNavProps {
  /**
   * 主动指定当前激活的路径。当未提供时，自动使用 usePathname() 获取的路径。
   */
  activePath?: string;
}

const MobileBottomNav = ({ activePath }: MobileBottomNavProps) => {
  const pathname = usePathname();

  // 当前激活路径：优先使用传入的 activePath，否则回退到浏览器地址
  const currentActive = activePath ?? pathname;

  const navItems = [
    { icon: Home, label: '首页', href: '/' },
    { icon: Search, label: '搜索', href: '/search' },
    {
      icon: Film,
      label: '电影',
      href: '/douban?type=movie',
    },
    {
      icon: Tv,
      label: '剧集',
      href: '/douban?type=tv',
    },
    {
      icon: Clover,
      label: '综艺',
      href: '/douban?type=show',
    },
  ];

  const isActive = (href: string) => {
    const typeMatch = href.match(/type=([^&]+)/)?.[1];

    // 解码URL以进行正确的比较
    const decodedActive = decodeURIComponent(currentActive);
    const decodedItemHref = decodeURIComponent(href);

    return (
      decodedActive === decodedItemHref ||
      (decodedActive.startsWith('/douban') &&
        decodedActive.includes(`type=${typeMatch}`))
    );
  };

  // 添加动态位置调整逻辑，确保底部导航栏始终固定在底部
  const navRef = useRef<HTMLElement>(null);
  const positionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 主动监测底部导航栏位置的函数
  const checkAndFixBottomNavPosition = useCallback(() => {
    const navElement = navRef.current;
    if (!navElement) return;

    // 使用更稳定的视口高度计算方法
    const rect = navElement.getBoundingClientRect();

    // 获取稳定的视口高度，优先使用 document.documentElement.clientHeight
    let viewportHeight = window.innerHeight;

    // 在iOS Safari中，使用更稳定的高度计算方法
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      // 使用 document.documentElement.clientHeight 作为主要参考
      const docHeight = document.documentElement.clientHeight;
      const windowHeight = window.innerHeight;

      // 如果两者差异很大，说明视口高度不稳定，使用更保守的值
      if (Math.abs(docHeight - windowHeight) > 50) {
        viewportHeight = Math.min(docHeight, windowHeight);
      } else {
        viewportHeight = docHeight;
      }
    }

    // 检查导航栏是否在正确位置
    // 导航栏应该在视口底部，即 rect.bottom 应该等于 viewportHeight
    const isAtBottom = Math.abs(rect.bottom - viewportHeight) <= 10; // 增加容错范围
    const currentBottom = navElement.style.bottom;
    const computedStyle = window.getComputedStyle(navElement);
    const computedBottom = computedStyle.bottom;
    const isBottomZero =
      currentBottom === '0px' || currentBottom === '0' || currentBottom === '';
    const isComputedBottomZero =
      computedBottom === '0px' ||
      computedBottom === '0' ||
      computedBottom === 'auto';

    console.log('[底部导航栏] 位置检测', {
      rectBottom: rect.bottom,
      rectTop: rect.top,
      viewportHeight,
      isAtBottom,
      currentBottom,
      computedBottom,
      isBottomZero,
      isComputedBottomZero,
      diff: Math.abs(rect.bottom - viewportHeight),
      position: computedStyle.position,
      transform: computedStyle.transform,
    });

    // 强制修复导航栏位置
    const forceFixPosition = () => {
      // 检查是否在搜索页面
      const isSearchPage = currentActive === '/search';

      if (isSearchPage) {
        // 搜索页面：检查页面内容高度，决定是否需要特殊处理
        const bodyHeight = document.body.scrollHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const maxContentHeight = Math.max(bodyHeight, documentHeight);

        // 如果内容高度小于视口高度，说明内容不足一屏
        const isContentShort = maxContentHeight < viewportHeight;

        if (isContentShort) {
          // 内容不足一屏时，导航栏应该紧贴内容底部
          const contentBottom = Math.max(bodyHeight, documentHeight);
          const targetBottom = Math.max(0, viewportHeight - contentBottom);

          navElement.style.bottom = `${targetBottom}px`;
          navElement.style.position = 'fixed';
          console.log('[底部导航栏] 搜索页内容不足，调整到底部', {
            rectBottom: rect.bottom,
            viewportHeight,
            contentBottom,
            targetBottom,
            bodyHeight,
            documentHeight,
            isContentShort,
          });
        } else {
          // 内容充足时，使用标准底部位置
          navElement.style.bottom = '0px';
          navElement.style.position = 'fixed';
          console.log('[底部导航栏] 搜索页内容充足，使用标准底部位置', {
            rectBottom: rect.bottom,
            viewportHeight,
            maxContentHeight,
            isContentShort,
          });
        }
      } else {
        // 其他页面使用标准修复
        navElement.style.bottom = '0px';
        navElement.style.position = 'fixed';
        console.log('[底部导航栏] 非搜索页，使用标准底部位置', {
          rectBottom: rect.bottom,
          viewportHeight,
          currentBottom,
        });
      }
    };

    // 如果导航栏不在底部位置，主动修复
    if (!isAtBottom || !isBottomZero) {
      console.log('[底部导航栏] 需要修复位置', {
        reason: !isAtBottom ? '位置不正确' : 'bottom值不为0',
        rectBottom: rect.bottom,
        viewportHeight,
        currentBottom,
        computedBottom,
      });

      forceFixPosition();
    } else {
      console.log('[底部导航栏] 位置正确，无需调整', {
        rectBottom: rect.bottom,
        viewportHeight,
        currentBottom,
        computedBottom,
      });
    }

    // 在搜索页面时，无论检测结果如何，都强制检查一次位置
    if (currentActive === '/search') {
      // 延迟一点时间，确保DOM完全渲染后再检查
      setTimeout(() => {
        const newRect = navElement.getBoundingClientRect();
        const newIsAtBottom = Math.abs(newRect.bottom - viewportHeight) <= 10;
        const newCurrentBottom = navElement.style.bottom;
        const newIsBottomZero =
          newCurrentBottom === '0px' ||
          newCurrentBottom === '0' ||
          newCurrentBottom === '';

        if (!newIsAtBottom || !newIsBottomZero) {
          console.log('[底部导航栏] 延迟检查发现位置问题，强制修复', {
            newRectBottom: newRect.bottom,
            viewportHeight,
            newCurrentBottom,
            newIsAtBottom,
            newIsBottomZero,
          });
          forceFixPosition();
        }
      }, 100);
    }
  }, [currentActive]);

  useEffect(() => {
    const adjustBottomNav = () => {
      checkAndFixBottomNavPosition();
    };

    // 在滚动恢复后检查导航栏位置
    const checkAfterScroll = () => {
      setTimeout(adjustBottomNav, 200);
    };

    // 监听滚动恢复完成事件
    const handleScrollRestore = () => {
      // 延迟更长时间，确保滚动恢复完全完成
      setTimeout(adjustBottomNav, 500);
      // 额外延迟检查，确保iOS Safari视口高度稳定
      setTimeout(adjustBottomNav, 1000);
    };

    // 监听页面可见性变化，确保从后台返回时导航栏位置正确
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(adjustBottomNav, 100);
      }
    };

    // 启动主动监测机制
    const startPositionMonitoring = () => {
      // 清除之前的定时器
      if (positionCheckIntervalRef.current) {
        clearInterval(positionCheckIntervalRef.current);
      }

      // 每500ms检查一次导航栏位置
      positionCheckIntervalRef.current = setInterval(() => {
        checkAndFixBottomNavPosition();
      }, 500);
    };

    // 停止主动监测机制
    const stopPositionMonitoring = () => {
      if (positionCheckIntervalRef.current) {
        clearInterval(positionCheckIntervalRef.current);
        positionCheckIntervalRef.current = null;
      }
    };

    // 在搜索页面时启动主动监测
    if (currentActive === '/search') {
      startPositionMonitoring();
    }

    window.addEventListener('scroll', checkAfterScroll);
    window.addEventListener('resize', adjustBottomNav);
    window.addEventListener('load', adjustBottomNav);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 监听自定义的滚动恢复完成事件
    window.addEventListener('scrollRestoreComplete', handleScrollRestore);

    // 监听底部导航栏位置检查事件
    const handleBottomNavPositionCheck = () => {
      setTimeout(adjustBottomNav, 100);
    };
    window.addEventListener(
      'bottomNavPositionCheck',
      handleBottomNavPositionCheck
    );

    // 监听页面路径变化，在搜索页面时启动监测
    const handlePathChange = () => {
      if (currentActive === '/search') {
        startPositionMonitoring();
        // 立即检查一次
        setTimeout(adjustBottomNav, 100);
      } else {
        stopPositionMonitoring();
      }
    };

    // 监听popstate事件，检测页面返回
    window.addEventListener('popstate', handlePathChange);

    // 初始检查
    setTimeout(adjustBottomNav, 100);

    return () => {
      stopPositionMonitoring();
      window.removeEventListener('scroll', checkAfterScroll);
      window.removeEventListener('resize', adjustBottomNav);
      window.removeEventListener('load', adjustBottomNav);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('scrollRestoreComplete', handleScrollRestore);
      window.removeEventListener(
        'bottomNavPositionCheck',
        handleBottomNavPositionCheck
      );
      window.removeEventListener('popstate', handlePathChange);
    };
  }, [currentActive, checkAndFixBottomNavPosition]);

  return (
    <nav
      ref={navRef}
      data-mobile-bottom-nav
      className='md:hidden fixed left-0 right-0 z-[600] bg-white/90 backdrop-blur-xl border-t border-gray-200/50 overflow-hidden dark:bg-gray-900/80 dark:border-gray-700/50'
      style={{
        /* 紧贴视口底部，同时在内部留出安全区高度 */
        bottom: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ul className='flex items-center'>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className='flex-shrink-0 w-1/5'>
              <Link
                href={item.href}
                className='flex flex-col items-center justify-center w-full h-14 gap-1 text-xs'
              >
                <item.icon
                  className={`h-6 w-6 ${
                    active
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                />
                <span
                  className={
                    active
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-300'
                  }
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
