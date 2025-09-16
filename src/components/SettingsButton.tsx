/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Search, Settings, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const SettingsButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [defaultAggregateSearch, setDefaultAggregateSearch] = useState(true);
  const [doubanProxyUrl, setDoubanProxyUrl] = useState('');
  const [imageProxyUrl, setImageProxyUrl] = useState('');
  const [enableOptimization, setEnableOptimization] = useState(true);
  const [enableImageProxy, setEnableImageProxy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [resourceSearchQuery, setResourceSearchQuery] = useState('');
  const [allResources, setAllResources] = useState<
    Array<{ key: string; name: string }>
  >([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [enableDebugConsole, setEnableDebugConsole] = useState(false);

  // 确保组件已挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 隐藏滚动条样式
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const style = document.createElement('style');
      style.innerHTML = `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `;
      document.head.appendChild(style);

      return () => {
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      };
    }
  }, []);

  // 从 localStorage 读取设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAggregateSearch = localStorage.getItem(
        'defaultAggregateSearch'
      );
      if (savedAggregateSearch !== null) {
        setDefaultAggregateSearch(JSON.parse(savedAggregateSearch));
      }

      const savedDoubanProxyUrl = localStorage.getItem('doubanProxyUrl');
      if (savedDoubanProxyUrl !== null) {
        setDoubanProxyUrl(savedDoubanProxyUrl);
      }

      const savedEnableImageProxy = localStorage.getItem('enableImageProxy');
      const defaultImageProxy =
        (window as any).RUNTIME_CONFIG?.IMAGE_PROXY || '';
      if (savedEnableImageProxy !== null) {
        setEnableImageProxy(JSON.parse(savedEnableImageProxy));
      } else if (defaultImageProxy) {
        // 如果有默认图片代理配置，则默认开启
        setEnableImageProxy(true);
      }

      const savedImageProxyUrl = localStorage.getItem('imageProxyUrl');
      if (savedImageProxyUrl !== null) {
        setImageProxyUrl(savedImageProxyUrl);
      } else if (defaultImageProxy) {
        setImageProxyUrl(defaultImageProxy);
      }

      const savedEnableOptimization =
        localStorage.getItem('enableOptimization');
      if (savedEnableOptimization !== null) {
        setEnableOptimization(JSON.parse(savedEnableOptimization));
      }

      const savedEnableDebugConsole =
        localStorage.getItem('enableDebugConsole');
      if (savedEnableDebugConsole !== null) {
        setEnableDebugConsole(JSON.parse(savedEnableDebugConsole));
      }

      // 读取指定资源选择
      const savedSelectedResources = localStorage.getItem('selectedResources');
      if (savedSelectedResources !== null) {
        setSelectedResources(JSON.parse(savedSelectedResources));
      }

      // 加载所有资源列表 - 动态从后端获取
      (async () => {
        try {
          setResourcesLoading(true);
          setResourcesError(null);
          const resp = await fetch('/api/search/resources', {
            cache: 'no-store',
          });
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }
          const data = await resp.json();
          const resources = Array.isArray(data) ? data : [];
          const mapped = resources.map((r: any) => ({
            key: r.key,
            name: r.name,
          }));
          setAllResources(mapped);
          try {
            sessionStorage.setItem('allResourcesCache', JSON.stringify(mapped));
          } catch (storageError) {
            // Ignore storage errors
          }
        } catch (e) {
          setResourcesError('资源列表加载失败');
          try {
            const cached = sessionStorage.getItem('allResourcesCache');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed)) {
                setAllResources(parsed);
                setResourcesError(null);
              }
            }
          } catch (cacheError) {
            // Ignore cache read errors
          }
        } finally {
          setResourcesLoading(false);
        }
      })();
    }
  }, []);

  // 监听 localStorage 变化，实现与搜索页面的双向同步
  useEffect(() => {
    const handleLocalStorageChange = (e: CustomEvent) => {
      if (e.detail?.key === 'defaultAggregateSearch') {
        setDefaultAggregateSearch(e.detail.value);
      }

      if (e.detail?.key === 'selectedResources') {
        setSelectedResources(e.detail.value || []);
      }
    };

    window.addEventListener(
      'localStorageChange',
      handleLocalStorageChange as EventListener
    );

    return () => {
      window.removeEventListener(
        'localStorageChange',
        handleLocalStorageChange as EventListener
      );
    };
  }, []);

  // 保存设置到 localStorage
  const handleAggregateToggle = (value: boolean) => {
    setDefaultAggregateSearch(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('defaultAggregateSearch', JSON.stringify(value));
      // 触发自定义事件，通知同标签页内的其他组件
      window.dispatchEvent(
        new CustomEvent('localStorageChange', {
          detail: { key: 'defaultAggregateSearch', value },
        })
      );
    }
  };

  const handleDoubanProxyUrlChange = (value: string) => {
    setDoubanProxyUrl(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanProxyUrl', value);
    }
  };

  const handleImageProxyUrlChange = (value: string) => {
    setImageProxyUrl(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('imageProxyUrl', value);
    }
  };

  const handleOptimizationToggle = (value: boolean) => {
    setEnableOptimization(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enableOptimization', JSON.stringify(value));
    }
  };

  const handleDebugConsoleToggle = (value: boolean) => {
    setEnableDebugConsole(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enableDebugConsole', JSON.stringify(value));
      window.dispatchEvent(
        new CustomEvent('localStorageChange', {
          detail: { key: 'enableDebugConsole', value },
        })
      );
    }
  };

  const handleCopyLogs = async () => {
    try {
      const logs = (window as any).__APP_LOGS || [];
      const text = logs
        .map(
          (l: any) =>
            `[${new Date(l.time).toISOString()}] ${l.level.toUpperCase()} | ${
              l.msg
            }`
        )
        .join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      // 轻提示：不引入额外库，仅控制台提示
      // eslint-disable-next-line no-console
      console.info('日志已复制到剪贴板');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('复制日志失败', e);
    }
  };

  const handleClearLogs = () => {
    try {
      (window as any).__APP_LOGS = [];
      // eslint-disable-next-line no-console
      console.info('已清空本地日志');
    } catch (_) {
      // ignore
    }
  };

  const handleImageProxyToggle = (value: boolean) => {
    setEnableImageProxy(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enableImageProxy', JSON.stringify(value));
    }
  };

  const handleResourceToggle = (resourceKey: string) => {
    const newSelectedResources = selectedResources.includes(resourceKey)
      ? selectedResources.filter((key) => key !== resourceKey)
      : [...selectedResources, resourceKey];

    setSelectedResources(newSelectedResources);
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'selectedResources',
        JSON.stringify(newSelectedResources)
      );
      // 触发自定义事件，通知同标签页内的其他组件
      window.dispatchEvent(
        new CustomEvent('localStorageChange', {
          detail: { key: 'selectedResources', value: newSelectedResources },
        })
      );
    }
  };

  const handleSelectAllResources = () => {
    const allKeys = allResources.map((r) => r.key);
    setSelectedResources(allKeys);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedResources', JSON.stringify(allKeys));
      // 触发自定义事件，通知同标签页内的其他组件
      window.dispatchEvent(
        new CustomEvent('localStorageChange', {
          detail: { key: 'selectedResources', value: allKeys },
        })
      );
    }
  };

  const handleClearAllResources = () => {
    setSelectedResources([]);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedResources', JSON.stringify([]));
      // 触发自定义事件，通知同标签页内的其他组件
      window.dispatchEvent(
        new CustomEvent('localStorageChange', {
          detail: { key: 'selectedResources', value: [] },
        })
      );
    }
  };

  const handleSettingsClick = () => {
    setIsOpen(!isOpen);
  };

  const handleClosePanel = () => {
    setIsOpen(false);
  };

  // 重置所有设置为默认值
  const handleResetSettings = () => {
    const defaultImageProxy = (window as any).RUNTIME_CONFIG?.IMAGE_PROXY || '';

    // 重置所有状态
    setDefaultAggregateSearch(true);
    setEnableOptimization(true);
    setDoubanProxyUrl('');
    setEnableImageProxy(!!defaultImageProxy);
    setImageProxyUrl(defaultImageProxy);
    setSelectedResources([]);
    setResourceSearchQuery('');

    // 保存到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('defaultAggregateSearch', JSON.stringify(true));
      localStorage.setItem('enableOptimization', JSON.stringify(true));
      localStorage.setItem('doubanProxyUrl', '');
      localStorage.setItem(
        'enableImageProxy',
        JSON.stringify(!!defaultImageProxy)
      );
      localStorage.setItem('imageProxyUrl', defaultImageProxy);
      localStorage.setItem('selectedResources', JSON.stringify([]));

      // 触发自定义事件，通知同标签页内的其他组件（如搜索页面）
      window.dispatchEvent(
        new CustomEvent('localStorageChange', {
          detail: { key: 'defaultAggregateSearch', value: true },
        })
      );
      window.dispatchEvent(
        new CustomEvent('localStorageChange', {
          detail: { key: 'selectedResources', value: [] },
        })
      );
    }
  };

  // 设置面板内容
  const settingsPanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] transition-opacity duration-300 ease-out'
        onClick={handleClosePanel}
      />

      {/* 设置面板 */}
      <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl z-[1001] flex flex-col max-h-[90vh] transition-all duration-300 ease-out'>
        {/* 标题栏 */}
        <div className='flex items-center justify-between p-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0'>
          <div className='flex items-center gap-3'>
            <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
              本地设置
            </h3>
            <button
              onClick={handleResetSettings}
              className='px-2 py-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors'
              title='重置为默认设置'
            >
              重置
            </button>
          </div>
          <button
            onClick={handleClosePanel}
            className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
            aria-label='Close'
          >
            <X className='w-full h-full' />
          </button>
        </div>

        {/* 设置项容器 - 支持滚动但隐藏滚动条 */}
        <div className='overflow-y-auto flex-grow p-6 hide-scrollbar space-y-8'>
          {/* 调试控制台 */}
          <div className='flex items-center justify-between'>
            <div>
              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                启用调试控制台
              </h4>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                开启后在移动端/真机上显示调试面板（eruda），便于查看日志
              </p>
            </div>
            <label className='flex items-center cursor-pointer'>
              <div className='relative'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={enableDebugConsole}
                  onChange={(e) => handleDebugConsoleToggle(e.target.checked)}
                />
                <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
              </div>
            </label>
          </div>

          {/* 日志操作 */}
          <div className='flex items-center justify-between'>
            <div>
              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                日志操作
              </h4>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                复制当前会话控制台日志，或清空本地缓存的日志
              </p>
            </div>
            <div className='flex gap-2'>
              <button
                onClick={handleCopyLogs}
                className='px-3 py-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200 hover:border-blue-300 dark:border-blue-800 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors'
              >
                复制日志
              </button>
              <button
                onClick={handleClearLogs}
                className='px-3 py-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors'
              >
                清空日志
              </button>
            </div>
          </div>
          {/* 默认聚合搜索结果 */}
          <div className='flex items-center justify-between'>
            <div>
              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                默认聚合搜索结果
              </h4>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                搜索时默认按标题和年份聚合显示结果
              </p>
            </div>
            <label className='flex items-center cursor-pointer'>
              <div className='relative'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={defaultAggregateSearch}
                  onChange={(e) => handleAggregateToggle(e.target.checked)}
                />
                <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
              </div>
            </label>
          </div>

          {/* 指定资源搜索设置 */}
          <div
            className={`space-y-4 ${
              defaultAggregateSearch ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <div>
              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                指定资源搜索
              </h4>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                关闭聚合搜索后可选择特定资源进行搜索
              </p>
            </div>

            {/* 资源搜索框 */}
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500' />
              <input
                type='text'
                className='w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                placeholder='搜索资源名称...'
                value={resourceSearchQuery}
                onChange={(e) => setResourceSearchQuery(e.target.value)}
              />
            </div>

            {/* 全选/清空按钮 */}
            <div className='flex gap-2'>
              <button
                onClick={handleSelectAllResources}
                className='px-3 py-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200 hover:border-blue-300 dark:border-blue-800 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors'
              >
                全选
              </button>
              <button
                onClick={handleClearAllResources}
                className='px-3 py-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors'
              >
                清空
              </button>
            </div>

            {/* 资源列表 */}
            <div className='max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2 hide-scrollbar'>
              {resourcesLoading ? (
                <div className='text-center text-gray-500 dark:text-gray-400 py-4 text-sm'>
                  正在加载资源列表...
                </div>
              ) : (
                <>
                  {allResources
                    .filter(
                      (resource) =>
                        resource.name
                          .toLowerCase()
                          .includes(resourceSearchQuery.toLowerCase()) ||
                        resource.key
                          .toLowerCase()
                          .includes(resourceSearchQuery.toLowerCase())
                    )
                    .map((resource) => (
                      <label
                        key={resource.key}
                        className='flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors duration-150'
                      >
                        <input
                          type='checkbox'
                          checked={selectedResources.includes(resource.key)}
                          onChange={() => handleResourceToggle(resource.key)}
                          className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                        />
                        <span className='text-sm text-gray-700 dark:text-gray-300'>
                          {resource.name}
                        </span>
                      </label>
                    ))}

                  {allResources.filter(
                    (resource) =>
                      resource.name
                        .toLowerCase()
                        .includes(resourceSearchQuery.toLowerCase()) ||
                      resource.key
                        .toLowerCase()
                        .includes(resourceSearchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className='text-center text-gray-500 dark:text-gray-400 py-4 text-sm'>
                      {resourcesError
                        ? '资源列表加载失败，请稍后重试'
                        : '未找到匹配的资源'}
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedResources.length > 0 && (
              <div className='text-xs text-gray-500 dark:text-gray-400'>
                已选择 {selectedResources.length} 个资源
              </div>
            )}
          </div>

          {/* 优选和测速 */}
          <div className='flex items-center justify-between'>
            <div>
              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                启用优选和测速
              </h4>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                如出现播放器劫持问题可关闭
              </p>
            </div>
            <label className='flex items-center cursor-pointer'>
              <div className='relative'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={enableOptimization}
                  onChange={(e) => handleOptimizationToggle(e.target.checked)}
                />
                <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
              </div>
            </label>
          </div>

          {/* 豆瓣代理设置 */}
          <div className='space-y-4'>
            <div>
              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                豆瓣数据代理
              </h4>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                设置代理URL以绕过豆瓣访问限制，留空则使用服务端API
              </p>
            </div>
            <input
              type='text'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='例如: https://proxy.example.com/fetch?url='
              value={doubanProxyUrl}
              onChange={(e) => handleDoubanProxyUrlChange(e.target.value)}
            />
          </div>

          {/* 图片代理开关 */}
          <div className='flex items-center justify-between'>
            <div>
              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                启用图片代理
              </h4>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                启用后，所有图片加载将通过代理服务器
              </p>
            </div>
            <label className='flex items-center cursor-pointer'>
              <div className='relative'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={enableImageProxy}
                  onChange={(e) => handleImageProxyToggle(e.target.checked)}
                />
                <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
              </div>
            </label>
          </div>

          {/* 图片代理地址设置 */}
          <div className='space-y-4'>
            <div>
              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                图片代理地址
              </h4>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                仅在启用图片代理时生效
              </p>
            </div>
            <input
              type='text'
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                enableImageProxy
                  ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 placeholder-gray-400 dark:placeholder-gray-600 cursor-not-allowed'
              }`}
              placeholder='例如: https://imageproxy.example.com/?url='
              value={imageProxyUrl}
              onChange={(e) => handleImageProxyUrlChange(e.target.value)}
              disabled={!enableImageProxy}
            />
          </div>

          {/* 底部说明 */}
          <div className='mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <p className='text-xs text-gray-500 dark:text-gray-400 text-center'>
              这些设置保存在本地浏览器中
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={handleSettingsClick}
        className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors duration-200 transform hover:scale-110'
        aria-label='Settings'
      >
        <Settings className='w-full h-full' />
      </button>

      {/* 使用 Portal 将设置面板渲染到 document.body */}
      {isOpen && mounted && createPortal(settingsPanel, document.body)}
    </>
  );
};
