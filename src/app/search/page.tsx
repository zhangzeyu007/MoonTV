/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
'use client';

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
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
  const [pendingScrollPosition, setPendingScrollPosition] = useState<
    number | null
  >(null);

  // 调试开关（与“启用调试控制台”联动）
  const debugEnabledRef = useRef(false);
  useEffect(() => {
    // 清理导航锁，避免停留状态导致后续保存被误跳过
    try {
      if ((window as any).__SEARCH_NAV_LOCK__?.active) {
        console.log('[搜索页] 挂载时清理导航锁');
        (window as any).__SEARCH_NAV_LOCK__ = { active: false };
      }
    } catch (_) {
      /* noop: ensure eslint no-empty satisfied */
    }

    if (typeof window === 'undefined') return;
    const readFlag = () => {
      try {
        const flag = localStorage.getItem('enableDebugConsole');
        debugEnabledRef.current = flag ? JSON.parse(flag) : false;
      } catch (_) {
        debugEnabledRef.current = false;
      }
    };
    readFlag();
    const onLocalStorageChange = (e: CustomEvent) => {
      if ((e as any).detail?.key === 'enableDebugConsole') {
        readFlag();
      }
    };
    window.addEventListener(
      'localStorageChange',
      onLocalStorageChange as EventListener
    );
    return () => {
      window.removeEventListener(
        'localStorageChange',
        onLocalStorageChange as EventListener
      );
    };
  }, []);

  // iOS 检测
  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  // 使用ref存储最新的搜索参数，避免闭包问题
  const searchQueryRef = useRef(searchQuery);
  const viewModeRef = useRef<'agg' | 'all'>('agg');
  const selectedResourcesRef = useRef<string[]>([]);

  // 防抖定时器ref，用于实时搜索
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 实时滚动位置缓存，确保在点击时能获取到正确的滚动位置
  const currentScrollPositionRef = useRef<number>(0);

  // 统一滚动工具：在 iOS 上优先使用 scrollingElement
  const getScrollingElement = useCallback(() => {
    if (typeof document === 'undefined')
      return null as unknown as HTMLElement | null;
    return (
      (document.scrollingElement as HTMLElement | null) ||
      (document.documentElement as HTMLElement | null) ||
      (document.body as HTMLElement | null)
    );
  }, []);

  const getScrollTop = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    const el = getScrollingElement();
    if (el && typeof (el as any).scrollTop === 'number')
      return el.scrollTop || 0;
    return typeof window.scrollY === 'number' ? window.scrollY : 0;
  }, [getScrollingElement]);

  // 全局滚动位置获取函数，供VideoCard等组件使用
  const getCurrentScrollPosition = useCallback(() => {
    // 尝试多种方法获取滚动位置，确保在iOS上也能正确获取
    const scrollMethods = [
      {
        name: 'window.scrollY',
        value: typeof window.scrollY === 'number' ? window.scrollY : 0,
      },
      {
        name: 'document.documentElement.scrollTop',
        value: document.documentElement?.scrollTop || 0,
      },
      { name: 'document.body.scrollTop', value: document.body?.scrollTop || 0 },
      {
        name: 'document.scrollingElement.scrollTop',
        value: document.scrollingElement?.scrollTop || 0,
      },
    ];

    // 找到第一个非零值，或者使用最大值
    const validScrolls = scrollMethods.filter((method) => method.value > 0);

    let currentScroll = 0;
    if (validScrolls.length > 0) {
      // 如果有有效的滚动值，使用第一个（通常是最准确的）
      currentScroll = validScrolls[0].value;
      // // console.log('[全局滚动位置获取] 使用有效方法:', validScrolls[0].name, currentScroll);
    } else {
      // 如果所有方法都返回0，尝试使用最大值（可能都是0，但确保逻辑正确）
      currentScroll = Math.max(...scrollMethods.map((m) => m.value));
      // // console.log('[全局滚动位置获取] 所有方法返回0，使用最大值:', currentScroll);
    }

    // 更新缓存
    currentScrollPositionRef.current = currentScroll;
    return currentScroll;
  }, []);

  // 滚动位置缓存更新函数
  const updateScrollCache = useCallback((position: number) => {
    currentScrollPositionRef.current = position;
    // // console.log('[滚动位置缓存更新] 手动更新缓存:', position);
  }, []);

  // 将滚动位置获取函数和缓存更新函数暴露给全局，供VideoCard使用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).getSearchPageScrollPosition = getCurrentScrollPosition;
      (window as any).updateSearchPageScrollCache = updateScrollCache;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).getSearchPageScrollPosition;
        delete (window as any).updateSearchPageScrollCache;
      }
    };
  }, [getCurrentScrollPosition, updateScrollCache]);

  const setScrollTop = useCallback(
    (y: number) => {
      if (typeof window === 'undefined') return;
      const el = getScrollingElement();

      if (isIOS) {
        // iOS: 使用window.scrollTo，禁用平滑滚动
        window.scrollTo({ top: y, behavior: 'auto' });
      } else {
        // PC端: 恢复原有逻辑，临时禁用平滑滚动以避免 UA/CSS 干扰
        const htmlEl =
          typeof document !== 'undefined'
            ? (document.documentElement as HTMLElement)
            : null;
        let prevBehavior: string | null = null;
        try {
          if (htmlEl) {
            prevBehavior = htmlEl.style.scrollBehavior || null;
            htmlEl.style.scrollBehavior = 'auto';
          }
        } catch (_) {
          /* ignore */
        }
        if (el) el.scrollTop = y;
        // 兜底一次，避免某些 WebKit 场景忽略 scrollTop 赋值
        window.scrollTo(0, y);
        // 还原 scroll-behavior 设置
        try {
          if (htmlEl) {
            if (prevBehavior === null)
              htmlEl.style.removeProperty('scroll-behavior');
            else htmlEl.style.scrollBehavior = prevBehavior;
          }
        } catch (_) {
          /* ignore */
        }
      }
    },
    [getScrollingElement, isIOS]
  );

  // 简化的锚点定位和滚动函数
  const _anchorThenScroll = useCallback(
    (
      anchorKey: string | null | undefined,
      target: number | null | undefined
    ) => {
      if (!anchorKey && !target) return;

      const performScroll = () => {
        try {
          if (debugEnabledRef.current) {
            console.log('[搜索页][滚动恢复-开始]', {
              isIOS,
              anchorKey,
              target,
              windowScrollY:
                typeof window.scrollY === 'number'
                  ? window.scrollY
                  : 'undefined',
              documentScrollTop: document.documentElement?.scrollTop || 0,
              bodyScrollTop: document.body?.scrollTop || 0,
              scrollingElementScrollTop:
                document.scrollingElement?.scrollTop || 0,
              ts: new Date().toISOString(),
            });
          }
          // 先锚点定位（如果有）
          if (anchorKey) {
            const el = document.querySelector(
              `[data-search-key="${anchorKey}"]`
            ) as HTMLElement | null;
            if (el) {
              el.scrollIntoView({ block: 'start', behavior: 'auto' });
            }
          }

          // 再精确滚动到目标位置（如果有）
          if (typeof target === 'number' && target > 0) {
            if (isIOS) {
              // iOS使用window.scrollTo
              window.scrollTo({ top: target, behavior: 'auto' });
            } else {
              // PC端使用原有逻辑
              setScrollTop(target);
            }
          }

          // 滚动后延迟校验位置
          setTimeout(() => {
            if (debugEnabledRef.current) {
              console.log('[搜索页][滚动恢复-结束]', {
                isIOS,
                anchorKey,
                target,
                windowScrollY:
                  typeof window.scrollY === 'number'
                    ? window.scrollY
                    : 'undefined',
                documentScrollTop: document.documentElement?.scrollTop || 0,
                bodyScrollTop: document.body?.scrollTop || 0,
                scrollingElementScrollTop:
                  document.scrollingElement?.scrollTop || 0,
                ts: new Date().toISOString(),
              });
            }
          }, 100);
        } catch (_) {
          /* ignore */
        }
      };

      // 如果元素已存在，直接执行
      if (anchorKey) {
        const el = document.querySelector(
          `[data-search-key="${anchorKey}"]`
        ) as HTMLElement | null;
        if (el) {
          if (debugEnabledRef.current) {
            console.log('[搜索页][滚动恢复-元素已存在，直接滚动]', {
              anchorKey,
              target,
            });
          }
          performScroll();
          return;
        }
      } else if (typeof target === 'number') {
        if (debugEnabledRef.current) {
          console.log('[搜索页][滚动恢复-无锚点，使用目标位置]', {
            target,
          });
        }
        performScroll();
        return;
      }

      // 元素不存在时，等待一段时间后重试（简化逻辑）
      if (anchorKey) {
        let attempts = 0;
        const maxAttempts = 10;
        const checkElement = () => {
          const el = document.querySelector(
            `[data-search-key="${anchorKey}"]`
          ) as HTMLElement | null;
          if (el || attempts >= maxAttempts) {
            if (debugEnabledRef.current) {
              console.log('[搜索页][滚动恢复-等待完成]', {
                anchorKey,
                attempts,
                found: !!el,
              });
            }
            performScroll();
            return;
          }
          attempts++;
          setTimeout(checkElement, 100);
        };
        checkElement();
      }
    },
    [setScrollTop, isIOS]
  );

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

    // 导航锁：若在跳转流程中，避免保存小值覆盖
    const navLock = (window as any).__SEARCH_NAV_LOCK__;
    if (navLock?.active) {
      console.log('[搜索页][状态保存] 检测到导航锁，跳过保存', navLock);
      return;
    }

    const currentScrollY = getScrollTop();

    const searchState = {
      query: searchQuery,
      results: searchResults,
      showResults: showResults,
      viewMode: viewMode,
      selectedResources: selectedResources,
      scrollPosition: currentScrollY,
      timestamp: Date.now(),
    };

    try {
      // 小值回写保护：已有更大有效值时，避免以小值覆盖
      try {
        const prev = localStorage.getItem('searchPageState');
        const prevParsed = prev ? JSON.parse(prev) : {};
        const prevScroll =
          typeof prevParsed.scrollPosition === 'number'
            ? prevParsed.scrollPosition
            : 0;
        if (
          prevScroll > 0 &&
          currentScrollY > 0 &&
          currentScrollY < 200 &&
          prevScroll > currentScrollY + 200
        ) {
          console.log('[搜索页][状态保存] 小值回写被忽略', {
            prevScroll,
            currentScrollY,
          });
          return;
        }
      } catch (_) {
        /* noop: ensure eslint no-empty satisfied */
      }

      localStorage.setItem('searchPageState', JSON.stringify(searchState));
    } catch (error) {
      // 静默处理错误
    }
  }, [
    searchQuery,
    searchResults,
    showResults,
    viewMode,
    selectedResources,
    getScrollTop,
  ]);

  // 保存当前滚动位置
  const saveScrollPosition = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      // 如果存在导航锁，跳过保存，避免覆盖点击时记录的更大值
      const navLock = (window as any).__SEARCH_NAV_LOCK__;
      if (navLock?.active) {
        console.log('[搜索页][滚动保存] 检测到导航锁，跳过保存', navLock);
        return;
      }

      const currentState = localStorage.getItem('searchPageState');
      const parsedState = currentState ? JSON.parse(currentState) : {};

      // 获取当前滚动位置，使用多种方法确保准确性
      const scrollMethods = [
        {
          name: 'window.scrollY',
          value: typeof window.scrollY === 'number' ? window.scrollY : 0,
        },
        {
          name: 'document.documentElement.scrollTop',
          value: document.documentElement?.scrollTop || 0,
        },
        {
          name: 'document.body.scrollTop',
          value: document.body?.scrollTop || 0,
        },
        {
          name: 'document.scrollingElement.scrollTop',
          value: document.scrollingElement?.scrollTop || 0,
        },
      ];

      // 找到第一个非零值，或者使用最大值
      const validScrolls = scrollMethods.filter((method) => method.value > 0);

      let currentScroll = 0;
      let _scrollMethod = '';

      if (validScrolls.length > 0) {
        // 如果有有效的滚动值，使用第一个（通常是最准确的）
        currentScroll = validScrolls[0].value;
        _scrollMethod = validScrolls[0].name;
      } else {
        // 如果所有方法都返回0，尝试使用最大值（可能都是0，但确保逻辑正确）
        currentScroll = Math.max(...scrollMethods.map((m) => m.value));
        _scrollMethod = 'Math.max(all methods)';
      }

      // 更新实时缓存
      currentScrollPositionRef.current = currentScroll;

      // 保护：若当前滚动极小且已有更大有效值，避免被小值回写
      const prevSaved =
        typeof parsedState.scrollPosition === 'number'
          ? parsedState.scrollPosition
          : 0;
      if (
        prevSaved > 0 &&
        currentScroll > 0 &&
        currentScroll < 200 &&
        prevSaved > currentScroll + 200
      ) {
        console.log('[搜索页][滚动保存] 小值回写被忽略', {
          prevSaved,
          currentScroll,
        });
        return;
      }

      // 添加调试日志
      // console.log('[滚动位置保存]', {
      //   isIOS,
      //   scrollMethod,
      //   currentScroll,
      //   windowScrollY: typeof window.scrollY === 'number' ? window.scrollY : 'undefined',
      //   documentScrollTop: document.documentElement?.scrollTop || 0,
      //   bodyScrollTop: document.body?.scrollTop || 0,
      //   scrollingElementScrollTop: getScrollingElement()?.scrollTop || 0,
      //   timestamp: new Date().toISOString()
      // });

      parsedState.scrollPosition = currentScroll;
      parsedState.timestamp = Date.now();
      localStorage.setItem('searchPageState', JSON.stringify(parsedState));

      // console.log('[滚动位置保存] localStorage已更新:', {
      //   scrollPosition: currentScroll,
      //   timestamp: parsedState.timestamp
      // });
    } catch (error) {
      // console.error('[滚动位置保存] 错误:', error);
    }
  }, [getScrollTop, isIOS, getScrollingElement]);

  // 在用户滚动时实时保存滚动位置（rAF 节流）
  useEffect(() => {
    let ticking = false;
    let lastSaveTime = 0;
    const saveInterval = isIOS ? 200 : 100; // iOS端降低保存频率，避免过度触发

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          const now = Date.now();

          // 立即更新滚动位置缓存，不依赖保存频率
          const currentPos = getCurrentScrollPosition();
          currentScrollPositionRef.current = currentPos;

          // 限制保存频率，避免过度写入localStorage
          if (now - lastSaveTime >= saveInterval) {
            saveScrollPosition();
            lastSaveTime = now;
          }
          ticking = false;
        });
      }
    };

    // iOS端使用更稳定的滚动监听配置
    const scrollOptions = isIOS
      ? { passive: true, capture: false }
      : { passive: true };

    window.addEventListener('scroll', onScroll, scrollOptions);

    // 页面加载完成后延迟更新滚动位置缓存，确保页面完全渲染
    const updateInitialScrollPosition = () => {
      // 延迟执行，确保页面完全渲染和滚动位置稳定
      setTimeout(() => {
        const currentPos = getCurrentScrollPosition();
        // // console.log('[滚动位置初始化] 页面加载完成，更新滚动位置缓存:', currentPos);

        // 如果初始位置为0，再尝试几次获取
        if (currentPos === 0) {
          let attempts = 0;
          const maxAttempts = 5;
          const retryInterval = 200;

          const retryGetPosition = () => {
            attempts++;
            const retryPos = getCurrentScrollPosition();
            // // console.log(`[滚动位置初始化] 重试获取位置 ${attempts}/${maxAttempts}:`, retryPos);

            if (retryPos > 0 || attempts >= maxAttempts) {
              // // console.log('[滚动位置初始化] 最终位置:', retryPos);
            } else {
              setTimeout(retryGetPosition, retryInterval);
            }
          };

          setTimeout(retryGetPosition, retryInterval);
        }
      }, 100);
    };

    if (document.readyState === 'complete') {
      updateInitialScrollPosition();
    } else {
      window.addEventListener('load', updateInitialScrollPosition);
    }

    return () => {
      window.removeEventListener('scroll', onScroll as EventListener);
      window.removeEventListener('load', updateInitialScrollPosition);
    };
  }, [saveScrollPosition, isIOS, getCurrentScrollPosition]);

  // 调试：滚动过程信息打印（仅在启用调试时输出，节流）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ticking = false;
    let lastLogTs = 0;
    let lastPos = 0;
    const logInterval = 300; // ms

    const onScrollDebug = () => {
      if (!debugEnabledRef.current) return;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          const now = Date.now();
          if (now - lastLogTs >= logInterval) {
            const scrollMethods = [
              {
                name: 'window.scrollY',
                value: typeof window.scrollY === 'number' ? window.scrollY : 0,
              },
              {
                name: 'document.documentElement.scrollTop',
                value: document.documentElement?.scrollTop || 0,
              },
              {
                name: 'document.body.scrollTop',
                value: document.body?.scrollTop || 0,
              },
              {
                name: 'document.scrollingElement.scrollTop',
                value: document.scrollingElement?.scrollTop || 0,
              },
            ];
            const values = scrollMethods.map((m) => m.value);
            const current = Math.max(...values);
            const delta = current - lastPos;
            lastPos = current;

            console.log('[搜索页][滚动中]', {
              isIOS,
              current,
              delta,
              methods: scrollMethods,
              ts: new Date().toISOString(),
            });
            lastLogTs = now;
          }
          ticking = false;
        });
      }
    };

    window.addEventListener('scroll', onScrollDebug, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollDebug as EventListener);
    };
  }, [isIOS]);

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

  // 检测是否为从详情页返回 - 简化逻辑
  const detectNavigationBack = useCallback(() => {
    if (typeof window === 'undefined') return false;

    // 检查是否有保存的搜索状态
    const savedState = localStorage.getItem('searchPageState');
    if (!savedState) return false;

    try {
      const parsedState = JSON.parse(savedState);
      const timeDiff = Date.now() - parsedState.timestamp;

      // 如果保存的状态时间戳很近（30分钟内），认为是从详情页返回
      const isRecentState = timeDiff < 30 * 60 * 1000; // 30分钟内

      // 简化逻辑：只要有最近的状态就认为是返回导航
      // navigation back detected based on recent timestamp
      return isRecentState;
    } catch (error) {
      return false;
    }
  }, []);

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
        // 关键调试：返回搜索页时的初始参数
        console.log('[搜索页][初始化][返回] 恢复状态参数', {
          isIOS,
          urlQuery,
          isBackNavigation,
          savedQuery: savedState?.query,
          savedResults: Array.isArray(savedState?.results)
            ? savedState.results.length
            : 0,
          savedShowResults: !!savedState?.showResults,
          savedViewMode: savedState?.viewMode,
          savedSelectedResources: savedState?.selectedResources?.length || 0,
          savedScrollPosition: savedState?.scrollPosition || 0,
          ts: new Date().toISOString(),
        });
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

        // 保存待恢复的滚动位置
        if (
          savedState.scrollPosition !== undefined &&
          savedState.scrollPosition > 0
        ) {
          setPendingScrollPosition(savedState.scrollPosition);
          // 关键调试：记录待恢复的滚动位置
          console.log('[搜索页][初始化][返回] 设定待恢复滚动位置', {
            pendingScrollPosition: savedState.scrollPosition,
            windowScrollY:
              typeof window.scrollY === 'number' ? window.scrollY : 'undefined',
            documentScrollTop: document.documentElement?.scrollTop || 0,
            bodyScrollTop: document.body?.scrollTop || 0,
            scrollingElementScrollTop:
              document.scrollingElement?.scrollTop || 0,
          });
        }

        // 从详情页返回时，需要刷新数据但保持滚动位置
        if (savedState.query) {
          // 延迟刷新数据，确保状态先恢复
          setTimeout(() => {
            fetchSearchResults(savedState.query).then(() => {
              // 数据刷新完成后，如果还有待恢复的滚动位置，重新触发滚动恢复
              if (pendingScrollPosition !== null) {
                // 使用setTimeout确保DOM更新完成
                setTimeout(() => {
                  setPendingScrollPosition(pendingScrollPosition);
                }, 100);
              }
            });
          }, 50);
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

  // 显式控制浏览器的滚动恢复，避免与我们自定义逻辑冲突
  useLayoutEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('scrollRestoration' in window.history)
    )
      return;
    const prev = window.history.scrollRestoration;
    try {
      window.history.scrollRestoration = 'manual';
    } catch (e) {
      /* ignore */
    }
    return () => {
      try {
        window.history.scrollRestoration = prev as 'auto' | 'manual';
      } catch (e) {
        /* ignore */
      }
    };
  }, []);

  // 页面卸载时保存滚动位置
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveScrollPosition();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveScrollPosition();
      }
    };

    const handlePageHide = () => {
      // pagehide 可用于 bfcache 场景
      saveScrollPosition();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [saveScrollPosition]);

  // 统一的滚动位置恢复逻辑（使用 useLayoutEffect 提前于绘制）
  useLayoutEffect(() => {
    if (pendingScrollPosition !== null) {
      // 关键调试：开始进行滚动恢复
      console.log('[搜索页][滚动恢复] 开始', {
        pendingScrollPosition,
        isIOS,
        documentReadyState: document.readyState,
        showResults,
        searchResultsLength: searchResults.length,
        currentWindowScrollY:
          typeof window.scrollY === 'number' ? window.scrollY : 'undefined',
        currentDocumentScrollTop: document.documentElement?.scrollTop || 0,
        currentBodyScrollTop: document.body?.scrollTop || 0,
        currentScrollingElementScrollTop:
          document.scrollingElement?.scrollTop || 0,
        ts: new Date().toISOString(),
      });

      const getMaxScrollTop = () =>
        Math.max(
          document.body.scrollHeight - window.innerHeight,
          document.documentElement.scrollHeight - window.innerHeight,
          0
        );
      const targetPosition = Math.max(
        0,
        Math.min(pendingScrollPosition, getMaxScrollTop())
      );

      // 关键调试：输出计算得到的目标位置
      console.log('[搜索页][滚动恢复] 目标位置计算', {
        originalPosition: pendingScrollPosition,
        maxScrollTop: getMaxScrollTop(),
        targetPosition,
        documentHeight: document.documentElement.scrollHeight,
        bodyHeight: document.body.scrollHeight,
        windowHeight: window.innerHeight,
      });

      if (targetPosition === 0) {
        // console.log('[滚动位置恢复] 目标位置为0，跳过恢复');
        setPendingScrollPosition(null);
        return;
      }

      if (isIOS) {
        // iOS端简化滚动恢复逻辑
        const restoreScrollIOS = () => {
          // 关键调试：iOS 恢复开始
          console.log('[搜索页][滚动恢复][iOS] 开始', {
            targetPosition,
            currentScrollY: window.scrollY,
            currentScrollTop: getScrollingElement()?.scrollTop || 0,
          });

          // 移除焦点避免干扰
          try {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
              // console.log('[滚动位置恢复] 已移除焦点');
            }
          } catch (_) {
            /* noop: ignore anchor scroll failure */
          }

          // 先尝试锚点定位
          let didAnchorScroll = false;
          try {
            const saved = localStorage.getItem('searchPageState');
            const parsed = saved ? JSON.parse(saved) : null;
            if (parsed?.anchorKey) {
              const anchorEl = document.querySelector(
                `[data-search-key="${parsed.anchorKey}"]`
              ) as HTMLElement | null;
              if (anchorEl) {
                anchorEl.scrollIntoView({ block: 'start', behavior: 'auto' });
                didAnchorScroll = true;
                console.log(
                  '[搜索页][滚动恢复][iOS] 锚点定位成功，跳过数值滚动',
                  {
                    anchorKey: parsed.anchorKey,
                  }
                );
              }
            }
          } catch (_) {
            /* ignore */
          }

          // 如果已通过锚点成功定位，则跳过数值滚动，避免覆盖锚点定位结果
          if (!didAnchorScroll) {
            // 精确滚动到目标位置 - 使用多种方法确保成功
            window.scrollTo({ top: targetPosition, behavior: 'auto' });

            // 同时设置其他滚动属性，确保iOS兼容性
            if (document.body) {
              document.body.scrollTop = targetPosition;
            }
            if (document.documentElement) {
              document.documentElement.scrollTop = targetPosition;
            }
          }

          console.log('[搜索页][滚动恢复][iOS] 已执行多种滚动方法', {
            targetPosition,
          });

          // 更新缓存
          currentScrollPositionRef.current = targetPosition;

          // 改进的验证和重试机制 - 使用与保存时相同的检测方法
          setTimeout(() => {
            // 使用与保存时相同的滚动位置检测方法
            const scrollMethods = [
              {
                name: 'window.scrollY',
                value: typeof window.scrollY === 'number' ? window.scrollY : 0,
              },
              {
                name: 'document.documentElement.scrollTop',
                value: document.documentElement?.scrollTop || 0,
              },
              {
                name: 'document.body.scrollTop',
                value: document.body?.scrollTop || 0,
              },
              {
                name: 'document.scrollingElement.scrollTop',
                value: document.scrollingElement?.scrollTop || 0,
              },
            ];

            // 找到第一个非零值，或者使用最大值
            const validScrolls = scrollMethods.filter(
              (method) => method.value > 0
            );
            const currentPos =
              validScrolls.length > 0
                ? validScrolls[0].value
                : Math.max(...scrollMethods.map((m) => m.value));
            const _currentScrollTop = getScrollingElement()?.scrollTop || 0;
            const diff = Math.abs(currentPos - targetPosition);

            console.log('[搜索页][滚动恢复][iOS] 验证结果', {
              targetPosition,
              currentPos,
              currentScrollTop: _currentScrollTop,
              diff,
              success: diff <= 10,
              methods: scrollMethods,
            });

            if (diff > 10) {
              console.log('[搜索页][滚动恢复][iOS] 需要重试滚动');
              // 使用多种方法确保滚动成功
              window.scrollTo({ top: targetPosition, behavior: 'auto' });
              if (document.body) document.body.scrollTop = targetPosition;
              if (document.documentElement)
                document.documentElement.scrollTop = targetPosition;

              // 延迟验证，给页面更多时间渲染
              setTimeout(() => {
                const retryScrollMethods = [
                  {
                    name: 'window.scrollY',
                    value:
                      typeof window.scrollY === 'number' ? window.scrollY : 0,
                  },
                  {
                    name: 'document.documentElement.scrollTop',
                    value: document.documentElement?.scrollTop || 0,
                  },
                  {
                    name: 'document.body.scrollTop',
                    value: document.body?.scrollTop || 0,
                  },
                  {
                    name: 'document.scrollingElement.scrollTop',
                    value: document.scrollingElement?.scrollTop || 0,
                  },
                ];

                const retryValidScrolls = retryScrollMethods.filter(
                  (method) => method.value > 0
                );
                const finalPos =
                  retryValidScrolls.length > 0
                    ? retryValidScrolls[0].value
                    : Math.max(...retryScrollMethods.map((m) => m.value));
                const finalDiff = Math.abs(finalPos - targetPosition);

                console.log('[搜索页][滚动恢复][iOS] 最终结果', {
                  targetPosition,
                  finalPos,
                  finalDiff,
                  success: finalDiff <= 10,
                  methods: retryScrollMethods,
                });

                // 如果仍然失败，尝试最后一次强制滚动
                if (finalDiff > 10) {
                  console.log('[搜索页][滚动恢复][iOS] 最后一次强制滚动尝试');

                  // 尝试多种强制滚动方法
                  try {
                    // 方法1: 直接设置scrollTop
                    if (document.body) document.body.scrollTop = targetPosition;
                    if (document.documentElement)
                      document.documentElement.scrollTop = targetPosition;

                    // 方法2: 使用window.scrollTo
                    window.scrollTo(0, targetPosition);

                    // 方法3: 使用scrollIntoView（如果找到目标元素）
                    const saved = localStorage.getItem('searchPageState');
                    const parsed = saved ? JSON.parse(saved) : null;
                    if (parsed?.anchorKey) {
                      const anchorEl = document.querySelector(
                        `[data-search-key="${parsed.anchorKey}"]`
                      ) as HTMLElement | null;
                      if (anchorEl) {
                        // 计算元素相对于目标位置的位置
                        const elementTop = anchorEl.offsetTop;
                        const offset = targetPosition - elementTop;
                        if (offset > 0) {
                          anchorEl.scrollIntoView({
                            block: 'start',
                            behavior: 'auto',
                          });
                          // 再微调位置
                          setTimeout(() => {
                            window.scrollTo(0, targetPosition);
                          }, 50);
                        }
                      }
                    }

                    // 方法4: 使用requestAnimationFrame确保在下一帧执行
                    requestAnimationFrame(() => {
                      window.scrollTo(0, targetPosition);
                      if (document.body)
                        document.body.scrollTop = targetPosition;
                      if (document.documentElement)
                        document.documentElement.scrollTop = targetPosition;
                    });
                  } catch (error) {
                    // console.error('[滚动位置恢复] iOS强制滚动失败:', error);
                  }
                }

                setPendingScrollPosition(null);
              }, 150); // 增加延迟时间
            } else {
              setPendingScrollPosition(null);
            }
          }, 150); // 增加初始验证延迟
        };

        // 等待内容加载完成，iOS需要更多时间确保DOM完全渲染
        if (document.readyState === 'complete') {
          // console.log('[滚动位置恢复] iOS文档已加载完成，延迟恢复确保DOM渲染');
          // 即使文档状态是complete，也延迟一下确保DOM完全渲染
          setTimeout(() => {
            restoreScrollIOS();
          }, 100);
        } else {
          // console.log('[滚动位置恢复] iOS等待文档加载完成');
          const onLoad = () => {
            window.removeEventListener('load', onLoad);
            // console.log('[滚动位置恢复] iOS文档加载完成，延迟恢复');
            // 延迟恢复，确保搜索结果完全渲染
            setTimeout(() => {
              restoreScrollIOS();
            }, 200);
          };
          window.addEventListener('load', onLoad);
        }

        // 额外的容错机制：在页面完全稳定后再次尝试恢复
        const fallbackRestore = () => {
          if (pendingScrollPosition !== null) {
            // console.log('[滚动位置恢复] iOS容错恢复尝试');
            setTimeout(() => {
              if (pendingScrollPosition !== null) {
                // console.log('[滚动位置恢复] iOS执行容错恢复');
                window.scrollTo(0, pendingScrollPosition);
                if (document.body)
                  document.body.scrollTop = pendingScrollPosition;
                if (document.documentElement)
                  document.documentElement.scrollTop = pendingScrollPosition;
                setPendingScrollPosition(null);
              }
            }, 1000); // 1秒后尝试容错恢复
          }
        };

        // 监听页面稳定事件
        if (document.readyState === 'complete') {
          setTimeout(fallbackRestore, 2000); // 2秒后尝试容错恢复
        } else {
          window.addEventListener('load', () => {
            setTimeout(fallbackRestore, 2000); // 2秒后尝试容错恢复
          });
        }
      } else {
        // PC端保持原有逻辑
        const restoreScrollPC = () => {
          // console.log('[滚动位置恢复] PC开始恢复:', {
          //   targetPosition,
          //   currentScrollY: window.scrollY,
          //   currentScrollTop: getScrollingElement()?.scrollTop || 0
          // });

          const scrollingElement =
            (typeof document !== 'undefined' && document.scrollingElement) ||
            (typeof document !== 'undefined' &&
              (document.documentElement || (document.body as HTMLElement))) ||
            null;

          let attempts = 0;
          const maxAttempts = 40;
          const tolerance = 8;
          const tryScroll = () => {
            if (scrollingElement) {
              scrollingElement.scrollTop = targetPosition;
            }
            window.scrollTo(0, targetPosition);
            if (document.documentElement)
              document.documentElement.scrollTop = targetPosition;
            if (document.body)
              (document.body as HTMLElement).scrollTop = targetPosition;
            const current = scrollingElement
              ? scrollingElement.scrollTop
              : window.scrollY;

            // console.log('[滚动位置恢复] PC尝试滚动:', {
            //   attempt: attempts + 1,
            //   targetPosition,
            //   current,
            //   diff: Math.abs(current - targetPosition),
            //   success: Math.abs(current - targetPosition) <= tolerance
            // });

            if (Math.abs(current - targetPosition) <= tolerance) {
              // console.log('[滚动位置恢复] PC恢复成功');
              // 更新缓存
              currentScrollPositionRef.current = targetPosition;
              setPendingScrollPosition(null);
              return;
            }
            attempts += 1;
            if (attempts >= maxAttempts) {
              // console.log('[滚动位置恢复] PC达到最大重试次数，使用兜底方案');
              setTimeout(() => {
                window.scrollTo(0, Math.min(targetPosition, getMaxScrollTop()));
                setPendingScrollPosition(null);
              }, 120);
              return;
            }
            requestAnimationFrame(tryScroll);
          };

          if (document.readyState === 'complete') {
            // console.log('[滚动位置恢复] PC文档已加载完成，立即恢复');
            requestAnimationFrame(tryScroll);
          } else {
            // console.log('[滚动位置恢复] PC等待文档加载完成');
            const onLoad = () => {
              window.removeEventListener('load', onLoad);
              // console.log('[滚动位置恢复] PC文档加载完成，开始恢复');
              requestAnimationFrame(tryScroll);
            };
            window.addEventListener('load', onLoad);
          }
        };

        // 等待内容加载
        const maxWaitTime = 3500;
        const checkInterval = 100;
        let waitTime = 0;
        const waitForContent = () => {
          const hasScrollableContent =
            document.body.scrollHeight > window.innerHeight;
          const hasSearchResults = showResults && searchResults.length > 0;
          const shouldProceed =
            hasScrollableContent || hasSearchResults || waitTime >= maxWaitTime;

          // console.log('[滚动位置恢复] PC等待内容加载:', {
          //   waitTime,
          //   hasScrollableContent,
          //   hasSearchResults,
          //   shouldProceed
          // });

          if (shouldProceed) {
            restoreScrollPC();
          } else {
            waitTime += checkInterval;
            setTimeout(waitForContent, checkInterval);
          }
        };
        waitForContent();
      }
    }
  }, [
    pendingScrollPosition,
    showResults,
    searchResults.length,
    isIOS,
    setScrollTop,
    getScrollTop,
  ]);

  // 在组件作用域提供可复用的强制滚动恢复函数，供多个 effect 使用
  const _forceRestoreScroll = useCallback(
    (target: number) => {
      if (typeof window === 'undefined' || typeof document === 'undefined')
        return;
      const maxAttempts = isIOS ? 120 : 40; // iOS需要更多重试
      let attempts = 0;
      const tolerance = 8;
      const getMaxScrollTop = () =>
        Math.max(
          document.body.scrollHeight - window.innerHeight,
          document.documentElement.scrollHeight - window.innerHeight,
          0
        );
      const trySet = () => {
        const clamped = Math.max(0, Math.min(target, getMaxScrollTop()));
        setScrollTop(clamped);
        const current = getScrollTop();
        if (Math.abs(current - clamped) <= tolerance) return;
        attempts += 1;
        if (attempts >= maxAttempts) return;
        requestAnimationFrame(trySet);
      };

      if (document.readyState !== 'complete') {
        const onLoad = () => {
          window.removeEventListener('load', onLoad);
          requestAnimationFrame(trySet);
        };
        window.addEventListener('load', onLoad);
        requestAnimationFrame(trySet);
      } else {
        requestAnimationFrame(trySet);
      }
    },
    [setScrollTop, getScrollTop, isIOS]
  );

  // 处理 bfcache（返回缓存）场景，确保从播放页返回时也能恢复
  useEffect(() => {
    if (!isIOS) return; // 只在iOS上执行

    const restoreFromStorage = () => {
      try {
        const saved = localStorage.getItem('searchPageState');
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (parsed?.scrollPosition > 0) {
          setPendingScrollPosition(parsed.scrollPosition);
        }
      } catch (_) {
        /* ignore */
      }
    };

    const onPageShow = (event: Event) => {
      // 简化iOS恢复逻辑，减少延迟和重试
      if (event && 'persisted' in event && (event as any).persisted) {
        // 从缓存恢复
        setTimeout(restoreFromStorage, 100);
      } else {
        // 正常页面显示
        restoreFromStorage();
      }
    };

    const onPopState = () => {
      restoreFromStorage();
    };

    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('popstate', onPopState);
    };
  }, [isIOS]);

  // iOS: 页面再次可见时的增强恢复逻辑
  useEffect(() => {
    if (!isIOS) return; // 只在iOS上执行

    const attemptOnVisible = () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const saved = localStorage.getItem('searchPageState');
        if (!saved) return;
        const parsed = JSON.parse(saved);

        if (parsed?.scrollPosition > 0) {
          // console.log('[iOS页面可见] 尝试恢复滚动位置:', {
          //   scrollPosition: parsed.scrollPosition,
          //   currentScrollY: window.scrollY,
          //   timestamp: new Date().toISOString()
          // });

          // 使用增强的滚动恢复逻辑
          const targetPosition = parsed.scrollPosition;
          let attempts = 0;
          const maxAttempts = 5;

          const tryScroll = () => {
            attempts++;
            // console.log(`[iOS页面可见] 尝试滚动 ${attempts}/${maxAttempts}:`, {
            //   targetPosition,
            //   currentScrollY: window.scrollY,
            //   currentScrollTop: getScrollingElement()?.scrollTop || 0
            // });

            // 尝试多种滚动方法
            window.scrollTo({ top: targetPosition, behavior: 'auto' });

            // 验证滚动是否成功
            setTimeout(() => {
              const currentPos = window.scrollY;
              const diff = Math.abs(currentPos - targetPosition);

              // console.log(`[iOS页面可见] 验证结果 ${attempts}:`, {
              //   targetPosition,
              //   currentPos,
              //   diff,
              //   success: diff <= 20
              // });

              if (diff <= 20 || attempts >= maxAttempts) {
                // console.log('[iOS页面可见] 滚动恢复完成:', {
                //   finalPosition: currentPos,
                //   targetPosition,
                //   success: diff <= 20,
                //   attempts
                // });
              } else {
                // 重试
                setTimeout(tryScroll, 100);
              }
            }, 50);
          };

          // 延迟执行，确保页面完全可见
          setTimeout(tryScroll, 100);
        }
      } catch (error) {
        // console.error('[iOS页面可见] 恢复滚动位置失败:', error);
      }
    };

    document.addEventListener('visibilitychange', attemptOnVisible);
    return () =>
      document.removeEventListener('visibilitychange', attemptOnVisible);
  }, [isIOS, getScrollingElement]);

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

          // 恢复滚动位置
          if (
            savedState.scrollPosition !== undefined &&
            savedState.scrollPosition > 0
          ) {
            setPendingScrollPosition(savedState.scrollPosition);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInitialized, hasRestoredState, restoreSearchState]);

  // 全局滚动位置监控和错误报告机制
  useEffect(() => {
    if (!isIOS) return; // 只在iOS上执行

    let errorCount = 0;
    const maxErrors = 3;
    const reportInterval = 5000; // 5秒报告一次

    const monitorScrollPosition = () => {
      try {
        const currentPos = window.scrollY;
        const saved = localStorage.getItem('searchPageState');

        if (saved) {
          const parsed = JSON.parse(saved);
          const savedPosition = parsed.scrollPosition || 0;
          const diff = Math.abs(currentPos - savedPosition);

          // 如果滚动位置差异过大，记录错误
          if (diff > 50 && savedPosition > 0) {
            errorCount++;
            // console.warn('[滚动位置监控] 检测到位置偏差:', {
            //   currentPos,
            //   savedPosition,
            //   diff,
            //   errorCount,
            //   timestamp: new Date().toISOString()
            // });

            if (errorCount >= maxErrors) {
              // console.error('[滚动位置监控] 滚动位置频繁偏差，可能存在iOS兼容性问题:', {
              //   currentPos,
              //   savedPosition,
              //   diff,
              //   errorCount,
              //   userAgent: navigator.userAgent,
              //   timestamp: new Date().toISOString()
              // });
              errorCount = 0; // 重置计数器
            }
          } else if (diff <= 50) {
            // 位置正常，重置错误计数
            errorCount = 0;
          }
        }
      } catch (error) {
        // console.error('[滚动位置监控] 监控失败:', error);
      }
    };

    // 定期监控滚动位置
    const intervalId = setInterval(monitorScrollPosition, reportInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [isIOS]);

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
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
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
              <div className='text-xs text-gray-500 mt-2 text-center space-y-1'>
                <div>
                  搜索框状态: "{searchQuery}" | 显示结果:{' '}
                  {showResults ? '是' : '否'} | 历史记录数:{' '}
                  {searchHistory.length}
                </div>
                <div className='text-xs text-blue-500'>
                  滚动调试: iOS={isIOS ? '是' : '否'} | 待恢复位置:{' '}
                  {pendingScrollPosition || '无'} | 当前滚动:{' '}
                  {Math.round(window.scrollY || 0)}px
                </div>
                <div className='text-xs text-green-500'>
                  状态: 已初始化={isInitialized ? '是' : '否'} | 导航返回=
                  {isNavigatingBack ? '是' : '否'} | 已恢复=
                  {hasRestoredState ? '是' : '否'}
                </div>
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
                        <div
                          key={`agg-${mapKey}`}
                          data-search-key={`agg-${mapKey}`}
                          className='w-full'
                        >
                          <VideoCard
                            from='search'
                            items={group}
                            query={
                              searchQuery.trim() !== group[0].title
                                ? searchQuery.trim()
                                : ''
                            }
                            anchorKey={`agg-${mapKey}`}
                          />
                        </div>
                      );
                    })
                  : searchResults.map((item) => (
                      <div
                        key={`all-${item.source}-${item.id}`}
                        data-search-key={`all-${item.source}-${item.id}`}
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
                          anchorKey={`all-${item.source}-${item.id}`}
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
