'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

interface NavigationContextType {
  isBottomNavVisible: boolean;
  toggleBottomNav: () => void;
  isMobileSidebarVisible: boolean; // 新增
  toggleMobileSidebar: () => void; // 新增
}

const NavigationContext = createContext<NavigationContextType>({
  isBottomNavVisible: false,
  toggleBottomNav: () => {
    // 默认实现，实际使用时会被 Provider 中的实现覆盖
  },
  isMobileSidebarVisible: false, // 新增
  toggleMobileSidebar: () => {
    // 默认实现，实际使用时会被 Provider 中的实现覆盖
  }, // 新增
});

export const useNavigation = () => useContext(NavigationContext);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(false);
  const [isMobileSidebarVisible, setIsMobileSidebarVisible] = useState(false); // 新增

  // 从 localStorage 读取用户偏好 - 底部导航
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('bottomNavVisible');
      if (saved !== null) {
        setIsBottomNavVisible(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to read bottomNavVisible from localStorage:', error);
    }
  }, []);

  // 保存用户偏好到 localStorage - 底部导航
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(
        'bottomNavVisible',
        JSON.stringify(isBottomNavVisible)
      );
    } catch (error) {
      console.warn('Failed to save bottomNavVisible to localStorage:', error);
    }
  }, [isBottomNavVisible]);

  // 从 localStorage 读取用户偏好 - 移动端侧边栏
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('mobileSidebarVisible');
      if (saved !== null) {
        setIsMobileSidebarVisible(JSON.parse(saved));
      }
    } catch (error) {
      console.warn(
        'Failed to read mobileSidebarVisible from localStorage:',
        error
      );
    }
  }, []);

  // 保存用户偏好到 localStorage - 移动端侧边栏
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(
        'mobileSidebarVisible',
        JSON.stringify(isMobileSidebarVisible)
      );
    } catch (error) {
      console.warn(
        'Failed to save mobileSidebarVisible to localStorage:',
        error
      );
    }
  }, [isMobileSidebarVisible]);

  const toggleBottomNav = () => {
    setIsBottomNavVisible((prev) => !prev);
  };

  const toggleMobileSidebar = () => {
    // 新增
    setIsMobileSidebarVisible((prev) => !prev);
  };

  return (
    <NavigationContext.Provider
      value={{
        isBottomNavVisible,
        toggleBottomNav,
        isMobileSidebarVisible, // 新增
        toggleMobileSidebar, // 新增
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
