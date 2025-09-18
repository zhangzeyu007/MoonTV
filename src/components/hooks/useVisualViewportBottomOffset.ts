/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react';

export interface UseVisualViewportBottomOffsetOptions {
  enableOnIOSOnly?: boolean;
  throttleMs?: number;
}

function isIOSUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function nowTs(): number {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();
}

/**
 * Compute bottom offset in pixels required to visually pin an element to the
 * visual viewport bottom on iOS Safari, where fixed elements anchor to the
 * layout viewport.
 *
 * offsetPx = max(0, window.innerHeight - (vv.height + vv.offsetTop))
 *
 * - Falls back to 0 if visualViewport is unavailable or disabled.
 */
export function useVisualViewportBottomOffset(
  options?: UseVisualViewportBottomOffsetOptions
): number {
  const { enableOnIOSOnly = true, throttleMs = 80 } = options || {};

  const shouldEnable = useMemo(() => {
    return enableOnIOSOnly ? isIOSUserAgent() : true;
  }, [enableOnIOSOnly]);

  const [offsetPx, setOffsetPx] = useState<number>(0);
  const lastEmitRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!shouldEnable) {
      setOffsetPx(0);
      return;
    }

    const vv: any = (window as any).visualViewport;
    if (!vv) {
      setOffsetPx(0);
      return;
    }

    const compute = () => {
      try {
        const innerH = window.innerHeight;
        const vvHeight = typeof vv.height === 'number' ? vv.height : innerH;
        const vvOffsetTop = typeof vv.offsetTop === 'number' ? vv.offsetTop : 0;
        const raw = innerH - (vvHeight + vvOffsetTop);
        const next = raw > 0 ? raw : 0;
        const now = nowTs();
        if (now - lastEmitRef.current >= throttleMs) {
          lastEmitRef.current = now;
          setOffsetPx((prev) => (prev !== next ? next : prev));
        }
      } catch (_) {
        setOffsetPx(0);
      }
    };

    compute();

    const onVvResize = () => compute();
    const onVvScroll = () => compute();
    const onWinResize = () => compute();

    if (typeof vv.addEventListener === 'function') {
      vv.addEventListener('resize', onVvResize);
      vv.addEventListener('scroll', onVvScroll);
    }
    window.addEventListener('resize', onWinResize);

    return () => {
      try {
        if (typeof vv.removeEventListener === 'function') {
          vv.removeEventListener('resize', onVvResize);
          vv.removeEventListener('scroll', onVvScroll);
        }
        window.removeEventListener('resize', onWinResize);
      } catch (_) {
        /* noop */
      }
    };
  }, [shouldEnable, throttleMs]);

  return offsetPx;
}

export default useVisualViewportBottomOffset;
