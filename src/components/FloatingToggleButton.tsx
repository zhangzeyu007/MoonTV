'use client';

import { Menu, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isIOSUserAgent } from '@/lib/utils';

import { useNavigation } from './NavigationProvider';

interface Position {
  x: number;
  y: number;
}

const FloatingToggleButton = () => {
  const { isBottomNavVisible, toggleBottomNav } = useNavigation();
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPendingDrag, setIsPendingDrag] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [startPosition, setStartPosition] = useState<Position>({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [activeTouchId, setActiveTouchId] = useState<number | null>(null);

  useEffect(() => {
    try {
      setIsIOS(isIOSUserAgent());
    } catch {
      setIsIOS(false);
    }
  }, []);

  // 初始化位置（屏幕右下角）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedPosition = localStorage.getItem('floatingButtonPosition');
    if (savedPosition) {
      try {
        const { x, y } = JSON.parse(savedPosition);
        setPosition({ x, y });
      } catch (error) {
        console.warn('Failed to parse saved button position:', error);
        setInitialPosition();
      }
    } else {
      setInitialPosition();
    }
  }, []);

  const setInitialPosition = () => {
    if (typeof window === 'undefined') return;
    setPosition({
      x: window.innerWidth - 80, // 距离右边 80px
      y: window.innerHeight - 80, // 距离底部 80px
    });
  };

  // 保存位置到 localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('floatingButtonPosition', JSON.stringify(position));
    } catch (error) {
      console.warn('Failed to save button position:', error);
    }
  }, [position]);

  // 边界检测和位置约束
  const constrainPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };

    const buttonSize = 56; // 按钮大小
    const margin = 10; // 距离边缘的最小距离

    const constrainedX = Math.max(
      margin,
      Math.min(x, window.innerWidth - buttonSize - margin)
    );
    const constrainedY = Math.max(
      margin,
      Math.min(y, window.innerHeight - buttonSize - margin)
    );

    return { x: constrainedX, y: constrainedY };
  }, []);

  // 鼠标事件处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!buttonRef.current) return;

    // 防止在开始拖拽时触发页面其他交互
    e.preventDefault();
    e.stopPropagation();

    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setStartPosition({ x: e.clientX, y: e.clientY });
    setHasMoved(false);
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      // 若未按下主键（松开），结束拖拽，避免外部移动影响按钮
      if (e.buttons === 0) {
        setIsDragging(false);
        setHasMoved(false);
        return;
      }

      // 检测是否移动超过阈值（5px）
      const deltaX = Math.abs(e.clientX - startPosition.x);
      const deltaY = Math.abs(e.clientY - startPosition.y);
      const threshold = 5;

      if (deltaX > threshold || deltaY > threshold) {
        setHasMoved(true);
        e.preventDefault();
      }

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      const constrained = constrainPosition(newX, newY);
      setPosition(constrained);
    },
    [isDragging, dragOffset, constrainPosition, startPosition]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setHasMoved(false);
  }, []);

  // 触摸事件处理
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!buttonRef.current) return;

      const touch = e.touches[0];
      // 记录开始于按钮之上的触点，仅跟踪这一根手指
      try {
        setActiveTouchId(touch?.identifier ?? null);
      } catch (_) {
        setActiveTouchId(null);
      }
      const rect = buttonRef.current.getBoundingClientRect();
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      });
      setStartPosition({ x: touch.clientX, y: touch.clientY });
      setHasMoved(false);

      if (isIOS) {
        // iOS: 延迟到移动超阈值后再进入拖拽，避免阻断滚动
        setIsPendingDrag(true);
        // 不在此处 preventDefault，允许自然滚动/点击
        e.stopPropagation();
      } else {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setIsPendingDrag(false);
      }
    },
    [isIOS]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      // 仅跟踪在按钮上开始的那根触摸
      let touch: Touch | undefined;
      if (activeTouchId !== null) {
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches.item(i);
          if (t && t.identifier === activeTouchId) {
            touch = t;
            break;
          }
        }
      } else {
        touch = e.touches[0];
      }
      if (!touch) return;

      const deltaX = Math.abs(touch.clientX - startPosition.x);
      const deltaY = Math.abs(touch.clientY - startPosition.y);
      const threshold = 5;

      if (isIOS) {
        if (!isDragging) {
          // 尚未进入拖拽，判断是否超过阈值
          if (isPendingDrag && (deltaX > threshold || deltaY > threshold)) {
            setIsDragging(true);
            setHasMoved(true);
          } else {
            // 未超过阈值，不拦截，允许原生滚动
            return;
          }
        }
        // iOS 已进入拖拽后再阻止默认行为
        e.preventDefault();
      } else {
        if (!isDragging) return;
        if (deltaX > threshold || deltaY > threshold) {
          setHasMoved(true);
          e.preventDefault();
        }
      }

      const newX = touch.clientX - dragOffset.x;
      const newY = touch.clientY - dragOffset.y;
      const constrained = constrainPosition(newX, newY);
      setPosition(constrained);
    },
    [
      isIOS,
      isDragging,
      isPendingDrag,
      dragOffset,
      constrainPosition,
      startPosition,
      activeTouchId,
    ]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setHasMoved(false);
    setIsPendingDrag(false);
    setActiveTouchId(null);
  }, []);

  // 处理触摸被取消的情况（如系统手势、滚动中断等）
  const handleTouchCancel = useCallback(() => {
    setIsDragging(false);
    setHasMoved(false);
    setIsPendingDrag(false);
    setActiveTouchId(null);
  }, []);

  // 添加全局事件监听器
  useEffect(() => {
    // 鼠标拖拽仅在 isDragging 时需要监听
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    // 触摸在 iOS 的待定阶段也需要监听，用于阈值判断
    if (isDragging || isPendingDrag) {
      document.addEventListener('touchmove', handleTouchMove, {
        passive: false,
      });
      document.addEventListener('touchend', handleTouchEnd, {
        passive: false,
      });
      document.addEventListener('touchcancel', handleTouchCancel, {
        passive: false,
      });
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [
    isDragging,
    isPendingDrag,
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  ]);

  // 页面可见性变化时，确保拖拽状态被正确重置，避免返回页面后仍处于拖拽中
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsDragging(false);
        setHasMoved(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 处理窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const constrained = constrainPosition(position.x, position.y);
      setPosition(constrained);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, constrainPosition]);

  // 处理点击事件
  const handleClick = useCallback(
    (_e: React.MouseEvent) => {
      // 只有在没有移动的情况下才触发点击
      if (!hasMoved && !isDragging) {
        toggleBottomNav();
      }
    },
    [hasMoved, isDragging, toggleBottomNav]
  );

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={`
        md:hidden fixed z-[9999] w-14 h-14 rounded-full shadow-lg
        bg-green-600 hover:bg-green-700 active:bg-green-800
        dark:bg-green-500 dark:hover:bg-green-600 dark:active:bg-green-700
        text-white transition-all duration-200 ease-in-out
        flex items-center justify-center
        ${isDragging ? 'scale-110 shadow-2xl' : 'hover:scale-105'}
        select-none touch-none
        pointer-events-auto
      `}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: isDragging ? 'scale(1.1)' : undefined,
      }}
      aria-label={isBottomNavVisible ? '隐藏底部导航' : '显示底部导航'}
    >
      {isBottomNavVisible ? (
        <X className='w-6 h-6' />
      ) : (
        <Menu className='w-6 h-6' />
      )}
    </button>
  );
};

export default FloatingToggleButton;
