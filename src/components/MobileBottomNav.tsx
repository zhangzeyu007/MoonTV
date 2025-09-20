'use client';

import { Clover, Film, Home, Search, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    const adjustBottomNav = () => {
      const navElement = navRef.current;
      if (navElement) {
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

        // 减去顶部导航条的高度 (h-12 = 48px = 3rem)
        const headerHeight = 48; // 移动端顶部导航条高度
        const availableViewportHeight = viewportHeight - headerHeight;

        // 如果导航栏不在底部，强制调整
        // 使用可用视窗高度来检测位置
        if (Math.abs(rect.bottom - viewportHeight) > 5) {
          navElement.style.bottom = '0px';
          navElement.style.position = 'fixed';
          console.log('[底部导航栏] 已修复位置', {
            rectBottom: rect.bottom,
            viewportHeight,
            availableViewportHeight,
            headerHeight,
            diff: Math.abs(rect.bottom - viewportHeight),
          });
        }
      }
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

    window.addEventListener('scroll', checkAfterScroll);
    window.addEventListener('resize', adjustBottomNav);
    window.addEventListener('load', adjustBottomNav);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 监听自定义的滚动恢复完成事件
    window.addEventListener('scrollRestoreComplete', handleScrollRestore);

    // 初始检查
    setTimeout(adjustBottomNav, 100);

    return () => {
      window.removeEventListener('scroll', checkAfterScroll);
      window.removeEventListener('resize', adjustBottomNav);
      window.removeEventListener('load', adjustBottomNav);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('scrollRestoreComplete', handleScrollRestore);
    };
  }, []);

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
