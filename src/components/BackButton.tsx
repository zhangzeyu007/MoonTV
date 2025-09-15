'use client';

import { ArrowLeft } from 'lucide-react';
import { useCallback } from 'react';

export function BackButton() {
  const handleBack = useCallback(() => {
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
