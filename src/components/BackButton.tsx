'use client';

import { ArrowLeft } from 'lucide-react';
import { useCallback } from 'react';

export function BackButton() {
  const handleBack = useCallback(() => {
    // 标记一次"从播放页返回搜索"的触发点，便于搜索页在 iOS 上加固恢复
    try {
      const triggerTime = Date.now();
      localStorage.setItem('searchReturnTrigger', String(triggerTime));
      // console.log('[返回按钮] 设置返回触发标记:', {
      //   triggerTime,
      //   timestamp: new Date().toISOString()
      // });
    } catch (error) {
      // console.error('[返回按钮] 设置返回触发标记失败:', error);
    }

    // 在执行返回操作前，确保清理可能存在的播放器实例
    try {
      // 如果存在全局的播放器实例，尝试销毁它
      if (typeof window !== 'undefined' && (window as any).artPlayerInstance) {
        const player = (window as any).artPlayerInstance;
        if (player && typeof player.destroy === 'function') {
          // 销毁HLS实例
          if (player.video && player.video.hls) {
            player.video.hls.destroy();
          }
          // 销毁播放器
          player.destroy();
          (window as any).artPlayerInstance = null;
          console.log('[返回按钮] 已清理播放器实例');
        }
      }
    } catch (error) {
      console.warn('[返回按钮] 清理播放器实例失败:', error);
    }

    // console.log('[返回按钮] 执行返回操作');
    // 直接使用浏览器历史记录返回，让搜索页面自己处理状态恢复
    window.history.back();
  }, []);

  return (
    <button
      onClick={handleBack}
      className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
      aria-label='Back'
    >
      <ArrowLeft className='w-full h-full' />
    </button>
  );
}
