/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
'use client';

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  getSearchHistory,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

function SearchPageClient() {
  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // 搜索状态持久化相关
  const [isInitialized, setIsInitialized] = useState(false);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const [hasRestoredState, setHasRestoredState] = useState(false);

  // 使用ref存储最新的搜索参数，避免闭包问题
  const searchQueryRef = useRef(searchQuery);
  const viewModeRef = useRef<'agg' | 'all'>('agg');
  const selectedResourcesRef = useRef<string[]>([]);

  // 防抖定时器ref，用于实时搜索
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 获取默认聚合设置：只读取用户本地设置，默认为 true
  const getDefaultAggregate = useCallback(() => {
    if (typeof window !== 'undefined') {
      const userSetting = localStorage.getItem('defaultAggregateSearch');
      if (userSetting !== null) {
        return JSON.parse(userSetting);
      }
    }
    return true; // 默认启用聚合
  }, []);

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(() => {
    return getDefaultAggregate() ? 'agg' : 'all';
  });
  const [selectedResources, setSelectedResources] = useState<string[]>([]);

  // 更新ref值
  useEffect(() => {
    searchQueryRef.current = searchQuery;
    viewModeRef.current = viewMode;
    selectedResourcesRef.current = selectedResources;
  }, [searchQuery, viewMode, selectedResources]);

  // 保存搜索状态到本地存储
  const saveSearchState = useCallback(() => {
    if (typeof window === 'undefined') return;

    const searchState = {
      query: searchQuery,
      results: searchResults,
      showResults: showResults,
      viewMode: viewMode,
      selectedResources: selectedResources,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem('searchPageState', JSON.stringify(searchState));
    } catch (error) {
      // 静默处理错误
    }
  }, [searchQuery, searchResults, showResults, viewMode, selectedResources]);

  // 从本地存储恢复搜索状态
  const restoreSearchState = useCallback(() => {
    if (typeof window === 'undefined') return null;

    try {
      const savedState = localStorage.getItem('searchPageState');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        // 检查状态是否过期（24小时）
        const isExpired =
          Date.now() - parsedState.timestamp > 24 * 60 * 60 * 1000;
        if (!isExpired) {
          return parsedState;
        } else {
          // 清除过期状态
          localStorage.removeItem('searchPageState');
        }
      }
    } catch (error) {
      localStorage.removeItem('searchPageState');
    }
    return null;
  }, []);

  // 检测是否为从详情页返回
  const detectNavigationBack = useCallback(() => {
    if (typeof window === 'undefined') return false;

    // 检查是否有保存的搜索状态
    const savedState = localStorage.getItem('searchPageState');
    if (!savedState) return false;

    try {
      const parsedState = JSON.parse(savedState);
      const timeDiff = Date.now() - parsedState.timestamp;
      const urlQuery = searchParams.get('q');

      // 如果保存的状态时间戳很近（30分钟内），认为是从详情页返回
      const isRecentState = timeDiff < 30 * 60 * 1000; // 30分钟内

      // 如果有保存的状态且时间较近，则认为是从详情页返回
      if (isRecentState) {
        // 如果URL中有查询参数，检查是否与保存的状态一致
        if (urlQuery) {
          return urlQuery === parsedState.query;
        }
        // 如果URL中没有查询参数，更可能是从详情页返回
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }, [searchParams]);

  // 保存搜索状态到本地存储
  useEffect(() => {
    if (isInitialized) {
      saveSearchState();
    }
  }, [
    searchQuery,
    searchResults,
    showResults,
    viewMode,
    selectedResources,
    isInitialized,
    saveSearchState,
  ]);

  // 聚合后的结果（按标题和年份分组）
  const aggregatedResults = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    searchResults.forEach((item) => {
      // 使用 title + year + type 作为键，year 必然存在，但依然兜底 'unknown'
      const key = `${item.title.replaceAll(' ', '')}-${
        item.year || 'unknown'
      }-${item.episodes.length === 1 ? 'movie' : 'tv'}`;
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort((a, b) => {
      // 优先排序：标题与搜索词完全一致的排在前面
      const aExactMatch = a[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));
      const bExactMatch = b[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // 年份排序
      if (a[1][0].year === b[1][0].year) {
        return a[0].localeCompare(b[0]);
      } else {
        // 处理 unknown 的情况
        const aYear = a[1][0].year;
        const bYear = b[1][0].year;

        if (aYear === 'unknown' && bYear === 'unknown') {
          return 0;
        } else if (aYear === 'unknown') {
          return 1; // a 排在后面
        } else if (bYear === 'unknown') {
          return -1; // b 排在后面
        } else {
          // 都是数字年份，按数字大小排序（大的在前面）
          return aYear > bYear ? -1 : 1;
        }
      }
    });
  }, [searchResults, searchQuery]);

  // 优化的搜索函数
  const fetchSearchResults = useCallback(async (query: string) => {
    try {
      setIsLoading(true);

      // 构建搜索URL
      const urlParams = new URLSearchParams();
      urlParams.append('q', query.trim());

      // 如果不是聚合模式且有选择的资源，添加资源参数
      if (
        viewModeRef.current === 'all' &&
        selectedResourcesRef.current.length > 0
      ) {
        urlParams.append('resources', selectedResourcesRef.current.join(','));
      }

      const response = await fetch(`/api/search?${urlParams.toString()}`);
      if (!response.ok) {
        throw new Error(`搜索请求失败: ${response.status}`);
      }

      const data = await response.json();
      setSearchResults(
        data.results.sort((a: SearchResult, b: SearchResult) => {
          // 优先排序：标题与搜索词完全一致的排在前面
          const aExactMatch = a.title === query.trim();
          const bExactMatch = b.title === query.trim();

          if (aExactMatch && !bExactMatch) return -1;
          if (!aExactMatch && bExactMatch) return 1;

          // 如果都匹配或都不匹配，则按原来的逻辑排序
          if (a.year === b.year) {
            return a.title.localeCompare(b.title);
          } else {
            // 处理 unknown 的情况
            if (a.year === 'unknown' && b.year === 'unknown') {
              return 0;
            } else if (a.year === 'unknown') {
              return 1; // a 排在后面
            } else if (b.year === 'unknown') {
              return -1; // b 排在后面
            } else {
              // 都是数字年份，按数字大小排序（大的在前面）
              return parseInt(a.year) > parseInt(b.year) ? -1 : 1;
            }
          }
        })
      );
      setShowResults(true);
    } catch (error) {
      // 静默处理搜索错误，避免影响用户体验
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 优化的重新搜索函数
  const refreshSearchResults = useCallback(() => {
    const currentQuery = searchQueryRef.current.trim();
    if (currentQuery) {
      setSearchResults([]);
      setShowResults(false);
      // 使用queueMicrotask确保状态更新完成后再执行搜索
      queueMicrotask(() => {
        fetchSearchResults(currentQuery);
      });
    }
  }, [fetchSearchResults]);

  // 实时搜索函数（带防抖）
  const handleRealtimeSearch = useCallback(
    (query: string) => {
      // 清除之前的防抖定时器
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // 如果查询为空，立即清除结果
      if (!query.trim()) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      // 设置防抖定时器，500ms后执行搜索
      debounceTimeoutRef.current = setTimeout(() => {
        const trimmedQuery = query.trim();
        if (trimmedQuery) {
          // 更新URL参数（不触发页面刷新）
          const newUrl = `/search?q=${encodeURIComponent(trimmedQuery)}`;
          window.history.replaceState({}, '', newUrl);

          // 执行搜索
          fetchSearchResults(trimmedQuery);
        }
      }, 500); // 500ms 防抖延迟
    },
    [fetchSearchResults]
  );

  // 优化的搜索处理函数
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
      if (!trimmed) return;

      // 清除防抖定时器，立即执行搜索
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // 清除导航状态和恢复状态标记，表示这是用户主动搜索
      setIsNavigatingBack(false);
      setHasRestoredState(false);

      // 回显搜索框
      setSearchQuery(trimmed);
      setIsLoading(true);
      setShowResults(true);

      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      // 直接发请求
      fetchSearchResults(trimmed);

      // 保存到搜索历史 (事件监听会自动更新界面)
      addSearchHistory(trimmed);

      // 保存当前状态，确保返回时能正确恢复
      setTimeout(() => {
        saveSearchState();
      }, 100);
    },
    [searchQuery, router, fetchSearchResults, addSearchHistory, saveSearchState]
  );

  // 优化的聚合模式切换处理
  const handleViewModeToggle = useCallback(() => {
    const newViewMode = viewMode === 'agg' ? 'all' : 'agg';
    setViewMode(newViewMode);

    // 同步更新 localStorage 设置
    if (typeof window !== 'undefined') {
      const newAggregateSetting = newViewMode === 'agg';
      localStorage.setItem(
        'defaultAggregateSearch',
        JSON.stringify(newAggregateSetting)
      );

      // 触发自定义事件，通知其他组件（如设置页面）
      window.dispatchEvent(
        new CustomEvent('localStorageChange', {
          detail: {
            key: 'defaultAggregateSearch',
            value: newAggregateSetting,
          },
        })
      );
    }

    // 清除当前搜索结果，重新搜索以应用新的模式
    refreshSearchResults();
  }, [viewMode, refreshSearchResults]);

  // 优化的搜索历史点击处理
  const handleHistoryClick = useCallback(
    (item: string) => {
      // 清除导航状态和恢复状态标记，表示这是用户主动搜索
      setIsNavigatingBack(false);
      setHasRestoredState(false);

      setSearchQuery(item);
      router.push(`/search?q=${encodeURIComponent(item.trim())}`);
      // 保存当前状态，确保返回时能正确恢复
      setTimeout(() => {
        saveSearchState();
      }, 100);
    },
    [router, saveSearchState]
  );

  // 优化的搜索历史删除处理
  const handleHistoryDelete = useCallback(
    (item: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // 立即更新搜索历史状态，确保界面立即更新
      setSearchHistory((prev) =>
        prev.filter((historyItem) => historyItem !== item)
      );

      deleteSearchHistory(item); // 事件监听会自动更新界面
    },
    []
  );

  // 优化的清空搜索历史处理
  const handleClearHistory = useCallback(async () => {
    // 立即清空搜索历史状态，确保界面立即更新
    setSearchHistory([]);

    try {
      await clearSearchHistory(); // 事件监听会自动更新界面
    } catch (error) {
      // 静默处理错误
    }
  }, []);

  // 清空搜索状态
  const clearSearchState = useCallback(async () => {
    // 清除导航状态和恢复状态标记，表示这是用户主动操作
    setIsNavigatingBack(false);
    setHasRestoredState(false);

    // 立即清空所有搜索相关状态
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setSearchHistory([]);

    // 清除本地存储的搜索状态
    if (typeof window !== 'undefined') {
      localStorage.removeItem('searchPageState');
    }

    // 更新URL，移除查询参数
    router.push('/search');

    // 清空搜索历史记录 - 等待完成
    try {
      await clearSearchHistory();
    } catch (error) {
      // 静默处理错误
    }

    // 聚焦搜索框
    setTimeout(() => {
      document.getElementById('searchInput')?.focus();
    }, 100);
  }, [
    clearSearchHistory,
    searchQuery,
    showResults,
    searchHistory.length,
    router,
  ]);

  useEffect(() => {
    // 初始化搜索状态
    const initializeSearchState = async () => {
      const savedState = restoreSearchState();
      const urlQuery = searchParams.get('q');
      const isBackNavigation = detectNavigationBack();

      if (isBackNavigation && savedState) {
        // 从详情页返回，优先恢复保存的状态
        setSearchQuery(savedState.query || '');
        setSearchResults(savedState.results || []);
        setShowResults(savedState.showResults || false);
        setViewMode(savedState.viewMode || 'agg');
        setSelectedResources(savedState.selectedResources || []);
        setIsNavigatingBack(true);
        setHasRestoredState(true);

        // 如果保存的状态有搜索结果，确保显示结果
        if (savedState.results && savedState.results.length > 0) {
          setShowResults(true);
        }
      } else if (urlQuery) {
        // 有URL参数，使用URL参数（用户主动搜索或直接访问）
        setSearchQuery(urlQuery);
        // 立即触发搜索
        queueMicrotask(() => {
          fetchSearchResults(urlQuery);
        });
        // 保存到搜索历史
        addSearchHistory(urlQuery);
      } else if (savedState) {
        // 没有URL参数但有保存状态，恢复保存的状态
        setSearchQuery(savedState.query || '');
        setSearchResults(savedState.results || []);
        setShowResults(savedState.showResults || false);
        setViewMode(savedState.viewMode || 'agg');
        setSelectedResources(savedState.selectedResources || []);
        setHasRestoredState(true);

        // 如果保存的状态有搜索结果，确保显示结果
        if (savedState.results && savedState.results.length > 0) {
          setShowResults(true);
        }
      } else {
        // 都没有，聚焦搜索框
        document.getElementById('searchInput')?.focus();
      }

      // 标记为已初始化
      setIsInitialized(true);
    };

    initializeSearchState();

    // 初始加载搜索历史
    getSearchHistory().then(setSearchHistory);

    // 监听搜索历史更新事件
    const unsubscribe = subscribeToDataUpdates(
      'searchHistoryUpdated',
      (newHistory: string[]) => {
        setSearchHistory(newHistory);
      }
    );

    // 加载指定资源选择
    if (typeof window !== 'undefined') {
      const savedSelectedResources = localStorage.getItem('selectedResources');
      if (savedSelectedResources !== null) {
        setSelectedResources(JSON.parse(savedSelectedResources));
      }
    }

    return unsubscribe;
  }, [searchParams, restoreSearchState]);

  // 监听 localStorage 变化，实现设置实时同步
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'defaultAggregateSearch') {
        const newValue = e.newValue ? JSON.parse(e.newValue) : true;
        const newViewMode = newValue ? 'agg' : 'all';
        setViewMode(newViewMode);

        // 如果有搜索查询，重新搜索以应用新设置
        if (searchQueryRef.current.trim()) {
          refreshSearchResults();
        }
      }

      if (e.key === 'selectedResources') {
        const newResources = e.newValue ? JSON.parse(e.newValue) : [];
        setSelectedResources(newResources);

        // 如果当前是指定搜索模式且有搜索查询，重新搜索
        if (viewModeRef.current === 'all' && searchQueryRef.current.trim()) {
          refreshSearchResults();
        }
      }
    };

    // 监听其他标签页的 localStorage 变化
    window.addEventListener('storage', handleStorageChange);

    // 监听同标签页的 localStorage 变化（通过自定义事件）
    const handleLocalStorageChange = (e: CustomEvent) => {
      if (e.detail?.key === 'defaultAggregateSearch') {
        const newValue = e.detail.value;
        const newViewMode = newValue ? 'agg' : 'all';
        setViewMode(newViewMode);

        if (searchQueryRef.current.trim()) {
          refreshSearchResults();
        }
      }

      if (e.detail?.key === 'selectedResources') {
        const newResources = e.detail.value || [];
        setSelectedResources(newResources);

        if (viewModeRef.current === 'all' && searchQueryRef.current.trim()) {
          refreshSearchResults();
        }
      }
    };

    window.addEventListener(
      'localStorageChange',
      handleLocalStorageChange as EventListener
    );

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(
        'localStorageChange',
        handleLocalStorageChange as EventListener
      );
    };
  }, [refreshSearchResults]);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // 监听页面可见性变化，确保从详情页返回时能正确恢复状态
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        isInitialized &&
        !hasRestoredState
      ) {
        // 页面重新可见且已初始化但未恢复状态，尝试恢复
        const savedState = restoreSearchState();
        if (savedState && savedState.query) {
          setSearchQuery(savedState.query);
          setSearchResults(savedState.results || []);
          setShowResults(savedState.showResults || false);
          setViewMode(savedState.viewMode || 'agg');
          setSelectedResources(savedState.selectedResources || []);
          setHasRestoredState(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInitialized, hasRestoredState, restoreSearchState]);

  useEffect(() => {
    // 当搜索参数变化时更新搜索状态
    const query = searchParams.get('q');

    // 检查是否是从详情页返回
    const isBackFromDetail = detectNavigationBack();

    // 只有在以下情况才更新搜索框值：
    // 1. 从详情页返回且URL参数与当前搜索词不同
    // 2. 用户主动导航到带查询参数的URL（如直接访问/search?q=xxx）
    // 3. 应用初始化时有URL查询参数
    const shouldUpdateSearchBox =
      (isBackFromDetail && query !== searchQuery) || // 从详情页返回
      (!isInitialized && query) || // 初始化时有查询参数
      (isInitialized &&
        !isNavigatingBack &&
        !hasRestoredState &&
        query !== searchQuery); // 主动导航到搜索页且查询不同

    if (
      query &&
      isInitialized &&
      !isNavigatingBack &&
      !hasRestoredState &&
      !isBackFromDetail &&
      shouldUpdateSearchBox
    ) {
      // 只有当需要更新搜索框时才设置搜索框的值
      setSearchQuery(query);
      // 清除之前的结果，重新搜索
      setSearchResults([]);
      setShowResults(false);
      // 使用queueMicrotask确保状态更新完成后再执行搜索
      queueMicrotask(() => {
        fetchSearchResults(query);
      });

      // 保存到搜索历史 (事件监听会自动更新界面)
      addSearchHistory(query);
    } else if (!query && isInitialized && !isNavigatingBack) {
      // 当没有URL参数且不是从详情页返回时，检查是否需要清空搜索状态
      // 如果当前有搜索内容但没有URL参数，说明用户可能进行了清除操作
      // 但是要避免在用户正在输入时干扰
      if (searchQuery && !hasRestoredState && showResults) {
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
      }
    }

    // 延迟重置导航状态，确保状态恢复完成
    if (isNavigatingBack) {
      setTimeout(() => {
        setIsNavigatingBack(false);
      }, 100);
    }
  }, [
    searchParams,
    fetchSearchResults,
    addSearchHistory,
    isInitialized,
    isNavigatingBack,
    detectNavigationBack,
    hasRestoredState,
  ]);

  // 处理搜索框清空时的逻辑
  useEffect(() => {
    // 只有在以下条件都满足时才清除搜索结果：
    // 1. 搜索框为空
    // 2. 当前显示搜索结果
    // 3. 不是从详情页返回的状态
    // 4. 已经初始化完成
    if (
      searchQuery === '' &&
      showResults &&
      !isNavigatingBack &&
      isInitialized &&
      !hasRestoredState
    ) {
      setSearchResults([]);
      setShowResults(false);
      setSearchHistory([]);
      // 清除本地存储的搜索状态
      if (typeof window !== 'undefined') {
        localStorage.removeItem('searchPageState');
      }
      // 清空搜索历史记录
      clearSearchHistory().catch(() => {
        // 静默处理错误
      });
    }
  }, [
    searchQuery,
    showResults,
    isNavigatingBack,
    isInitialized,
    hasRestoredState,
  ]);

  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        {/* 搜索框 */}
        <div className='mb-8'>
          <form onSubmit={handleSearch} className='max-w-3xl mx-auto'>
            <div className='relative group'>
              {/* 搜索图标 */}
              <div className='absolute left-4 top-1/2 -translate-y-1/2 z-10'>
                <Search className='h-5 w-5 text-gray-400 dark:text-gray-500 transition-colors group-focus-within:text-green-500' />
              </div>

              {/* 输入框 */}
              <input
                id='searchInput'
                type='text'
                value={searchQuery}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setSearchQuery(newValue);

                  // 触发实时搜索
                  handleRealtimeSearch(newValue);
                }}
                onKeyDown={(_e) => {
                  // 处理键盘事件
                }}
                placeholder='搜索电影、电视剧...'
                className='w-full h-14 pl-12 pr-14 text-base bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-2 border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-0 focus:border-green-400 dark:focus:border-green-500 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 ease-in-out text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
              />

              {/* 清空按钮 */}
              {searchQuery && (
                <button
                  type='button'
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearSearchState();
                  }}
                  className='absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-all duration-200 ease-in-out group/clear'
                  title='清空搜索'
                >
                  <X className='h-4 w-4 text-gray-500 dark:text-gray-400 group-hover/clear:text-gray-700 dark:group-hover/clear:text-gray-200 transition-colors' />
                </button>
              )}
            </div>

            {/* 调试信息 */}
            {process.env.NODE_ENV === 'development' && (
              <div className='text-xs text-gray-500 mt-2 text-center'>
                搜索框状态: "{searchQuery}" | 显示结果:{' '}
                {showResults ? '是' : '否'} | 历史记录数: {searchHistory.length}
              </div>
            )}
          </form>
        </div>

        {/* 搜索结果或搜索历史 */}
        <div className='max-w-[95%] mx-auto mt-12 overflow-visible'>
          {isLoading ? (
            <div className='flex justify-center items-center h-40'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
            </div>
          ) : showResults ? (
            <section className='mb-12'>
              {/* 标题 + 聚合开关 */}
              <div className='mb-8 flex items-center justify-between'>
                <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                  搜索结果
                </h2>
                <div className='flex items-center gap-4'>
                  {/* 指定资源指示器 */}
                  {viewMode === 'all' && selectedResources.length > 0 && (
                    <div className='flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm'>
                      <span>指定资源</span>
                      <span className='bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded text-xs'>
                        {selectedResources.length}
                      </span>
                    </div>
                  )}

                  {/* 聚合开关 */}
                  <label className='flex items-center gap-2 cursor-pointer select-none'>
                    <span className='text-sm text-gray-700 dark:text-gray-300'>
                      聚合
                    </span>
                    <div className='relative'>
                      <input
                        type='checkbox'
                        className='sr-only peer'
                        checked={viewMode === 'agg'}
                        onChange={handleViewModeToggle}
                      />
                      <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                      <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4'></div>
                    </div>
                  </label>
                </div>
              </div>
              <div
                key={`search-results-${viewMode}`}
                className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'
              >
                {viewMode === 'agg'
                  ? aggregatedResults.map(([mapKey, group]) => {
                      return (
                        <div key={`agg-${mapKey}`} className='w-full'>
                          <VideoCard
                            from='search'
                            items={group}
                            query={
                              searchQuery.trim() !== group[0].title
                                ? searchQuery.trim()
                                : ''
                            }
                          />
                        </div>
                      );
                    })
                  : searchResults.map((item) => (
                      <div
                        key={`all-${item.source}-${item.id}`}
                        className='w-full'
                      >
                        <VideoCard
                          id={item.id}
                          title={item.title}
                          poster={item.poster}
                          episodes={item.episodes.length}
                          source={item.source}
                          source_name={item.source_name}
                          douban_id={item.douban_id?.toString()}
                          query={
                            searchQuery.trim() !== item.title
                              ? searchQuery.trim()
                              : ''
                          }
                          year={item.year}
                          from='search'
                          type={item.episodes.length > 1 ? 'tv' : 'movie'}
                        />
                      </div>
                    ))}
                {searchResults.length === 0 && (
                  <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                    未找到相关结果
                  </div>
                )}
              </div>
            </section>
          ) : searchHistory.length > 0 ? (
            // 搜索历史
            <section className='mb-12'>
              <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
                搜索历史
                {searchHistory.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className='ml-3 text-sm text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400 dark:hover:text-red-500'
                  >
                    清空
                  </button>
                )}
              </h2>
              <div className='flex flex-wrap gap-2'>
                {searchHistory.map((item) => (
                  <div key={item} className='relative group'>
                    <button
                      onClick={() => handleHistoryClick(item)}
                      className='px-4 py-2 bg-gray-500/10 hover:bg-gray-300 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-gray-700/50 dark:hover:bg-gray-600 dark:text-gray-300'
                    >
                      {item}
                    </button>
                    {/* 删除按钮 */}
                    <button
                      aria-label='删除搜索历史'
                      onClick={(e) => handleHistoryDelete(item, e)}
                      className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </PageLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageClient />
    </Suspense>
  );
}
