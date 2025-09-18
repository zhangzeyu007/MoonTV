'use client';

import { Clover, Film, Home, Search, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import useVisualViewportBottomOffset from './hooks/useVisualViewportBottomOffset';

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

  const bottomOffsetPx = useVisualViewportBottomOffset({
    enableOnIOSOnly: true,
    throttleMs: 80,
  });

  return (
    <nav
      className='mobile-bottom-nav md:hidden'
      style={{
        // 依赖 globals.css 的固定定位与 z-index，组件内仅控制合成层与位移
        transform: `translate3d(0, ${bottomOffsetPx}px, 0)`,
        WebkitTransform: `translate3d(0, ${bottomOffsetPx}px, 0)`,
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        transition: 'transform 0.2s ease-out',
      }}
    >
      <ul className='flex items-center h-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800'>
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
