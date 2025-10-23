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
  isMobileSidebarVisible: boolean;
  toggleMobileSidebar: () => void;
}

const NavigationContext = createContext<NavigationContextType>({
  isBottomNavVisible: false,
  toggleBottomNav: () => {
    // 默认实现，实际使用时会被 Provider 中的实现覆盖
  },
  isMobileSidebarVisible: false,
  toggleMobileSidebar: () => {
    // 默认实现，实际使用时会被 Provider 中的实现覆盖
  },
});

export const useNavigation = () => useContext(NavigationContext);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(false);
  const [isMobileSidebarVisible, setIsMobileSidebarVisible] = useState(false);

  // 安全地从 localStorage 读取数据
  const safeReadFromStorage = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to read ${key} from localStorage:`, error);
      return null;
    }
  };

  // 安全地向 localStorage 写入数据
  const safeWriteToStorage = (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  };

  // 从 localStorage 读取用户偏好 - 底部导航
  useEffect(() => {
    const saved = safeReadFromStorage('bottomNavVisible');
    if (saved !== null) {
      try {
        setIsBottomNavVisible(JSON.parse(saved));
      } catch (error) {
        console.warn(
          'Failed to parse bottomNavVisible from localStorage:',
          error
        );
      }
    }
  }, []);

  // 保存用户偏好到 localStorage - 底部导航
  useEffect(() => {
    safeWriteToStorage('bottomNavVisible', JSON.stringify(isBottomNavVisible));
  }, [isBottomNavVisible]);

  // 从 localStorage 读取用户偏好 - 移动端侧边栏
  useEffect(() => {
    const saved = safeReadFromStorage('mobileSidebarVisible');
    if (saved !== null) {
      try {
        setIsMobileSidebarVisible(JSON.parse(saved));
      } catch (error) {
        console.warn(
          'Failed to parse mobileSidebarVisible from localStorage:',
          error
        );
      }
    }
  }, []);

  // 保存用户偏好到 localStorage - 移动端侧边栏
  useEffect(() => {
    safeWriteToStorage(
      'mobileSidebarVisible',
      JSON.stringify(isMobileSidebarVisible)
    );
  }, [isMobileSidebarVisible]);

  const toggleBottomNav = () => {
    setIsBottomNavVisible((prev) => !prev);
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarVisible((prev) => !prev);
  };

  return (
    <NavigationContext.Provider
      value={{
        isBottomNavVisible,
        toggleBottomNav,
        isMobileSidebarVisible,
        toggleMobileSidebar,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
