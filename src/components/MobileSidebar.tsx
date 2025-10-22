/*
 * @Description:
 * @Author: 张泽雨
 * @Date: 2025-10-22 20:44:20
 * @LastEditors: 张泽雨
 * @LastEditTime: 2025-10-22 20:44:21
 * @FilePath: /MoonTV/src/components/MobileSidebar.tsx
 */
'use client';

import { Clover, Film, Home, Search, Tv, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface MobileSidebarProps {
  /**
   * 控制侧边栏的显示/隐藏状态
   */
  isVisible: boolean;
  /**
   * 关闭侧边栏的回调函数
   */
  onClose: () => void;
}

const MobileSidebar = ({ isVisible, onClose }: MobileSidebarProps) => {
  const pathname = usePathname();
  const [activePath, setActivePath] = useState(pathname);

  useEffect(() => {
    setActivePath(pathname);
  }, [pathname]);

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
    const decodedActive = decodeURIComponent(activePath);
    const decodedItemHref = decodeURIComponent(href);

    return (
      decodedActive === decodedItemHref ||
      (decodedActive.startsWith('/douban') &&
        decodedActive.includes(`type=${typeMatch}`))
    );
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`md:hidden fixed inset-0 z-[599] bg-black transition-opacity duration-300 ease-in-out ${
          isVisible ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* 侧边栏 */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full z-[600] bg-white dark:bg-gray-900 transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '70%', maxWidth: '280px' }}
      >
        {/* 头部区域 */}
        <div className='flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700'>
          <span className='text-xl font-bold text-green-600'>MoonTV</span>
          <button
            onClick={onClose}
            className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800'
            aria-label='关闭侧边栏'
          >
            <X className='h-5 w-5 text-gray-500 dark:text-gray-400' />
          </button>
        </div>

        {/* 导航菜单 */}
        <nav className='py-3'>
          <ul className='space-y-1'>
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose} // 点击链接后关闭侧边栏
                    className={`flex items-center px-4 py-3.5 text-base ${
                      active
                        ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                  >
                    <item.icon
                      className={`h-5 w-5 mr-3 ${
                        active
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default MobileSidebar;
