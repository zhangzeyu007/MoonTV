/**
 * 平台检测器
 * 检测用户的浏览器平台和设备类型
 */

export interface IPlatformDetector {
  /**
   * 检测是否为 iOS 设备
   */
  isIOS(): boolean;

  /**
   * 检测是否为 Safari 浏览器
   */
  isSafari(): boolean;

  /**
   * 获取平台类型
   */
  getPlatform(): 'ios' | 'android' | 'pc';

  /**
   * 检测是否支持特定 API
   */
  supportsAPI(apiName: string): boolean;
}

/**
 * 平台检测器实现
 */
export class PlatformDetector implements IPlatformDetector {
  private cachedIsIOS: boolean | null = null;
  private cachedIsSafari: boolean | null = null;
  private cachedPlatform: 'ios' | 'android' | 'pc' | null = null;

  /**
   * 检测是否为 iOS 设备
   */
  isIOS(): boolean {
    if (this.cachedIsIOS !== null) {
      return this.cachedIsIOS;
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      this.cachedIsIOS = false;
      return false;
    }

    const userAgent =
      navigator.userAgent || navigator.vendor || (window as any).opera || '';

    // 检测 iPad、iPhone、iPod
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent);

    // 排除 Windows Phone
    const isNotWindowsPhone = !(window as any).MSStream;

    this.cachedIsIOS = isIOSDevice && isNotWindowsPhone;
    return this.cachedIsIOS;
  }

  /**
   * 检测是否为 Safari 浏览器
   */
  isSafari(): boolean {
    if (this.cachedIsSafari !== null) {
      return this.cachedIsSafari;
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      this.cachedIsSafari = false;
      return false;
    }

    const userAgent = navigator.userAgent || '';

    // Safari 特征：包含 Safari 但不包含 Chrome 或 Chromium
    const hasSafari = /Safari/.test(userAgent);
    const hasChrome = /Chrome|Chromium/.test(userAgent);

    this.cachedIsSafari = hasSafari && !hasChrome;
    return this.cachedIsSafari;
  }

  /**
   * 获取平台类型
   */
  getPlatform(): 'ios' | 'android' | 'pc' {
    if (this.cachedPlatform !== null) {
      return this.cachedPlatform;
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      this.cachedPlatform = 'pc';
      return 'pc';
    }

    if (this.isIOS()) {
      this.cachedPlatform = 'ios';
      return 'ios';
    }

    const userAgent = navigator.userAgent || '';

    // 检测 Android
    if (/Android/.test(userAgent)) {
      this.cachedPlatform = 'android';
      return 'android';
    }

    // 默认为 PC
    this.cachedPlatform = 'pc';
    return 'pc';
  }

  /**
   * 检测是否支持特定 API
   */
  supportsAPI(apiName: string): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    switch (apiName) {
      case 'scrollRestoration':
        return 'scrollRestoration' in window.history;

      case 'scrollTo':
        return typeof window.scrollTo === 'function';

      case 'scrollIntoView':
        return typeof Element.prototype.scrollIntoView === 'function';

      case 'requestAnimationFrame':
        return typeof window.requestAnimationFrame === 'function';

      case 'localStorage':
        try {
          const test = '__storage_test__';
          localStorage.setItem(test, test);
          localStorage.removeItem(test);
          return true;
        } catch (e) {
          return false;
        }

      case 'pageshow':
        return 'onpageshow' in window;

      case 'visibilitychange':
        return typeof document.visibilityState !== 'undefined';

      default:
        return apiName in window;
    }
  }

  /**
   * 清除缓存（用于测试）
   */
  clearCache(): void {
    this.cachedIsIOS = null;
    this.cachedIsSafari = null;
    this.cachedPlatform = null;
  }
}

// 导出单例实例
export const platformDetector = new PlatformDetector();
