'use client';

import { createContext, ReactNode, useContext, useEffect, useRef } from 'react';

const SiteContext = createContext<{ siteName: string; announcement?: string }>({
  // 默认值
  siteName: 'MoonTV',
  announcement:
    '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
});

export const useSite = () => useContext(SiteContext);

export function SiteProvider({
  children,
  siteName,
  announcement,
}: {
  children: ReactNode;
  siteName: string;
  announcement?: string;
}) {
  const erudaRef = useRef<any>(null);

  // 初始化日志缓冲与 console 代理
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (!Array.isArray(w.__APP_LOGS)) {
      w.__APP_LOGS = [];
    }

    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    const pushLog = (level: string, args: unknown[]) => {
      try {
        const msg = args
          .map((a) => {
            try {
              if (typeof a === 'string') return a;
              return JSON.stringify(a);
            } catch (_) {
              return String(a);
            }
          })
          .join(' ');
        w.__APP_LOGS.push({ time: Date.now(), level, msg });
        if (w.__APP_LOGS.length > 2000) {
          w.__APP_LOGS.splice(0, w.__APP_LOGS.length - 2000);
        }
      } catch (_) {
        // ignore
      }
    };

    // 代理 console，避免重复代理
    if (!w.__APP_CONSOLE_HOOKED__) {
      w.__APP_CONSOLE_HOOKED__ = true;
      console.log = (...args) => {
        pushLog('log', args);
        originalConsole.log.apply(console, args as any);
      };
      console.info = (...args) => {
        pushLog('info', args);
        originalConsole.info.apply(console, args as any);
      };
      console.warn = (...args) => {
        pushLog('warn', args);
        originalConsole.warn.apply(console, args as any);
      };
      console.error = (...args) => {
        pushLog('error', args);
        originalConsole.error.apply(console, args as any);
      };
      console.debug = (...args) => {
        pushLog('debug', args);
        originalConsole.debug?.apply(console, args as any);
      };
    }

    return () => {
      // 不恢复 console，避免卸载后无法追踪日志；整个应用生命周期常驻
    };
  }, []);

  // 监听开关，动态加载/销毁 eruda
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;

    const loadEruda = async () => {
      try {
        const mod = await import(/* webpackChunkName: "eruda" */ 'eruda');
        if (!erudaRef.current) {
          erudaRef.current = mod.default;
          erudaRef.current.init();
          erudaRef.current.show();
        } else {
          // 已存在则确保显示
          erudaRef.current.show();
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('加载调试控制台失败', e);
      }
    };

    const unloadEruda = () => {
      try {
        if (erudaRef.current && erudaRef.current.destroy) {
          erudaRef.current.destroy();
        }
      } catch (_) {
        // ignore
      } finally {
        erudaRef.current = null;
      }
    };

    const applyByFlag = () => {
      try {
        const flag = localStorage.getItem('enableDebugConsole');
        const enabled = flag ? JSON.parse(flag) : false;
        if (enabled) loadEruda();
        else unloadEruda();
      } catch (_) {
        // ignore
      }
    };

    applyByFlag();

    const onLocalStorageChange = (e: CustomEvent) => {
      if (e.detail?.key === 'enableDebugConsole') {
        applyByFlag();
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
      // 页面卸载时销毁
      unloadEruda();
    };
  }, []);
  return (
    <SiteContext.Provider value={{ siteName, announcement }}>
      {children}
    </SiteContext.Provider>
  );
}
