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
}

const NavigationContext = createContext<NavigationContextType>({
  isBottomNavVisible: false,
  toggleBottomNav: () => {
    // 默认实现，实际使用时会被 Provider 中的实现覆盖
  },
});

export const useNavigation = () => useContext(NavigationContext);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(false);

  // 从 localStorage 读取用户偏好
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

  // 保存用户偏好到 localStorage
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

  const toggleBottomNav = () => {
    setIsBottomNavVisible((prev) => !prev);
  };

  return (
    <NavigationContext.Provider value={{ isBottomNavVisible, toggleBottomNav }}>
      {children}
    </NavigationContext.Provider>
  );
}
