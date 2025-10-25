'use client';

import { Activity, Clover, Film, Home, Search, Tv, X } from 'lucide-react';
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

// 定义固定的导航项标识符
const NAV_ITEM_KEYS = {
  HOME: 'home',
  SEARCH: 'search',
  MOVIE: 'movie',
  TV: 'tv',
  SHOW: 'show',
  MONITOR: 'monitor',
} as const;

type NavItemKey = (typeof NAV_ITEM_KEYS)[keyof typeof NAV_ITEM_KEYS];

const MobileSidebar = ({ isVisible, onClose }: MobileSidebarProps) => {
  const pathname = usePathname();
  const [activeKey, setActiveKey] = useState<NavItemKey>(NAV_ITEM_KEYS.HOME);
  const [userSelected, setUserSelected] = useState<boolean>(false);

  // 获取存储的导航项键
  const getStoredNavKey = (): NavItemKey | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('mobileSidebarActivePath');
      if (
        stored &&
        Object.values(NAV_ITEM_KEYS).includes(stored as NavItemKey)
      ) {
        return stored as NavItemKey;
      }
      return null;
    } catch (error) {
      console.warn(
        'Failed to read mobileSidebarActivePath from localStorage:',
        error
      );
      return null;
    }
  };

  // 保存导航项键到存储
  const setStoredNavKey = (key: NavItemKey) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('mobileSidebarActivePath', key);
    } catch (error) {
      console.warn(
        'Failed to save mobileSidebarActivePath to localStorage:',
        error
      );
    }
  };

  // 根据路径名获取对应的导航项键
  const getNavKeyFromPath = (path: string): NavItemKey => {
    if (path === '/') return NAV_ITEM_KEYS.HOME;
    if (path === '/search') return NAV_ITEM_KEYS.SEARCH;
    if (path === '/monitor') return NAV_ITEM_KEYS.MONITOR;
    if (path.startsWith('/douban')) {
      const type = new URLSearchParams(path.split('?')[1]).get('type');
      switch (type) {
        case 'movie':
          return NAV_ITEM_KEYS.MOVIE;
        case 'tv':
          return NAV_ITEM_KEYS.TV;
        case 'show':
          return NAV_ITEM_KEYS.SHOW;
        default:
          return NAV_ITEM_KEYS.HOME;
      }
    }
    return NAV_ITEM_KEYS.HOME;
  };

  // 初始化活动导航项
  useEffect(() => {
    const storedKey = getStoredNavKey();
    if (storedKey) {
      setActiveKey(storedKey);
      setUserSelected(true);
    } else if (pathname) {
      const key = getNavKeyFromPath(pathname);
      setActiveKey(key);
    }
  }, [pathname]);

  // 当路由变化时更新活动导航项，但不覆盖用户手动选择的导航项
  useEffect(() => {
    // 只有在用户没有手动选择导航项且当前路径有效时才更新
    if (!userSelected && pathname) {
      const key = getNavKeyFromPath(pathname);
      if (key !== activeKey) {
        setActiveKey(key);
      }
    }
  }, [pathname, userSelected, activeKey]);

  // 保存活动导航项到 localStorage
  useEffect(() => {
    setStoredNavKey(activeKey);
  }, [activeKey]);

  const navItems = [
    { key: NAV_ITEM_KEYS.HOME, icon: Home, label: '首页', href: '/' },
    { key: NAV_ITEM_KEYS.SEARCH, icon: Search, label: '搜索', href: '/search' },
    {
      key: NAV_ITEM_KEYS.MOVIE,
      icon: Film,
      label: '电影',
      href: '/douban?type=movie',
    },
    {
      key: NAV_ITEM_KEYS.TV,
      icon: Tv,
      label: '剧集',
      href: '/douban?type=tv',
    },
    {
      key: NAV_ITEM_KEYS.SHOW,
      icon: Clover,
      label: '综艺',
      href: '/douban?type=show',
    },
    {
      key: NAV_ITEM_KEYS.MONITOR,
      icon: Activity,
      label: '性能监控',
      href: '/monitor',
    },
  ];

  const handleItemClick = (key: NavItemKey, _href: string) => {
    setActiveKey(key);
    setUserSelected(true);
    setStoredNavKey(key); // 立即保存到存储
    onClose(); // 点击链接后关闭侧边栏
  };

  const isActive = (key: NavItemKey) => {
    return activeKey === key;
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
        className={`md:hidden fixed top-0 left-0 h-full z-[600] bg-white dark:bg-gray-900 transition-all duration-300 ease-in-out transform-gpu ${
          isVisible ? 'translate-x-0' : '-translate-x-full'
        } shadow-2xl`}
        style={{ width: '70%', maxWidth: '280px' }}
      >
        {/* 头部区域 */}
        <div className='flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700'>
          <span className='text-xl font-bold text-green-600 dark:text-green-400'>
            MoonTV
          </span>
          <button
            onClick={onClose}
            className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200'
            aria-label='关闭侧边栏'
          >
            <X className='h-5 w-5 text-gray-500 dark:text-gray-400' />
          </button>
        </div>

        {/* 导航菜单 */}
        <nav className='py-4 px-2'>
          <ul className='space-y-2'>
            {navItems.map((item) => {
              const active = isActive(item.key);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => handleItemClick(item.key, item.href)}
                    className={`flex items-center px-4 py-3.5 text-base rounded-xl transition-all duration-300 ease-in-out transform ${
                      active
                        ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30 font-semibold shadow-md scale-[1.02]'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 hover:scale-[1.01] hover:shadow-sm'
                    }`}
                  >
                    <item.icon
                      className={`h-5 w-5 mr-3 transition-all duration-300 ${
                        active
                          ? 'text-green-600 dark:text-green-400 scale-110'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    />
                    <span className={`${active ? 'font-semibold' : ''}`}>
                      {item.label}
                    </span>
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
