/**
 * composedPath Polyfill 实现
 * 为不支持 composedPath 的浏览器提供兼容实现
 */

import { IComposedPathPolyfill } from './event-handler-utils';

/**
 * ComposedPath Polyfill 类
 */
export class ComposedPathPolyfill implements IComposedPathPolyfill {
  private static instance: ComposedPathPolyfill | null = null;
  private supported: boolean | null = null;

  /**
   * 获取单例实例
   */
  public static getInstance(): ComposedPathPolyfill {
    if (!ComposedPathPolyfill.instance) {
      ComposedPathPolyfill.instance = new ComposedPathPolyfill();
    }
    return ComposedPathPolyfill.instance;
  }

  /**
   * 检测浏览器是否支持 composedPath
   */
  public isSupported(): boolean {
    if (this.supported !== null) {
      return this.supported;
    }

    if (
      typeof Event === 'undefined' ||
      typeof Event.prototype === 'undefined'
    ) {
      this.supported = false;
      return false;
    }

    try {
      // 创建一个测试事件
      const testEvent = new Event('test');
      this.supported = typeof testEvent.composedPath === 'function';
    } catch (e) {
      this.supported = false;
    }

    return this.supported;
  }

  /**
   * 为事件对象添加 composedPath 方法
   */
  public applyPolyfill(event: Event): void {
    if (!event || typeof event !== 'object') {
      console.warn('无效的事件对象，无法应用 polyfill');
      return;
    }

    // 如果已经有 composedPath 方法，尝试调用验证
    if (typeof (event as any).composedPath === 'function') {
      try {
        (event as any).composedPath();
        return; // 原生方法可用，无需 polyfill
      } catch (e) {
        console.warn('原生 composedPath 方法失败，应用 polyfill');
      }
    }

    // 应用 polyfill
    const buildPath = this.buildEventPath.bind(this);
    try {
      Object.defineProperty(event, 'composedPath', {
        value: function (this: Event) {
          return buildPath(this.target);
        },
        writable: false,
        enumerable: false,
        configurable: true,
      });
    } catch (defineError) {
      // 如果无法定义属性，使用替代方案
      console.warn('无法定义 composedPath 属性，使用替代方案');
      (event as any).safeComposedPath = function () {
        return buildPath(event.target);
      };
    }
  }

  /**
   * 手动构建事件传播路径
   */
  public buildEventPath(target: EventTarget | null): EventTarget[] {
    const path: EventTarget[] = [];

    if (!target) {
      return path;
    }

    let current: any = target;
    const visited = new WeakSet<any>(); // 防止循环引用
    let iterations = 0;
    const maxIterations = 100; // 防止无限循环

    try {
      // 遍历 DOM 树构建路径
      while (current && iterations < maxIterations) {
        // 检查是否已访问过（防止循环）
        if (visited.has(current)) {
          console.warn('检测到循环引用，停止遍历');
          break;
        }

        // 检查是否为有效的 DOM 节点
        if (typeof current === 'object' && current !== null) {
          // 添加到路径
          if (!path.includes(current)) {
            path.push(current);
          }

          // 标记为已访问
          visited.add(current);

          // 获取父节点
          const nextParent = this.getParentNode(current);

          // 检查是否到达顶层或遇到无效引用
          if (!nextParent || nextParent === current) {
            break;
          }

          // 检查是否到达 document 或 window
          if (
            nextParent === document ||
            nextParent === window ||
            (typeof Document !== 'undefined' &&
              nextParent instanceof Document) ||
            (typeof Window !== 'undefined' && nextParent instanceof Window)
          ) {
            if (!path.includes(nextParent)) {
              path.push(nextParent);
            }
            break;
          }

          current = nextParent;
        } else {
          break;
        }

        iterations++;
      }

      // 确保 document 和 window 在路径末尾
      if (path.length > 0) {
        if (typeof document !== 'undefined' && !path.includes(document)) {
          path.push(document);
        }
        if (typeof window !== 'undefined' && !path.includes(window)) {
          path.push(window);
        }
      }
    } catch (error) {
      console.warn('构建事件路径时出错:', error);
      // 返回至少包含 target 的路径
      if (target && !path.includes(target)) {
        path.push(target);
      }
    }

    return path;
  }

  /**
   * 安全地获取父节点
   */
  private getParentNode(node: any): any {
    if (!node || typeof node !== 'object') {
      return null;
    }

    try {
      // 优先使用 parentNode
      if (node.parentNode) {
        return node.parentNode;
      }

      // Shadow DOM 支持
      if (node.host) {
        return node.host;
      }

      // 备用方案
      if (node.parentElement) {
        return node.parentElement;
      }

      // 对于某些特殊节点，尝试获取 ownerDocument
      if (node.ownerDocument && node !== node.ownerDocument) {
        return node.ownerDocument;
      }
    } catch (error) {
      // 访问受限，返回 null
      return null;
    }

    return null;
  }
}

/**
 * 获取事件传播路径（带降级支持）
 */
export function getEventPath(event: Event): EventTarget[] {
  if (!event || typeof event !== 'object') {
    console.warn('无效的事件对象');
    return [];
  }

  // 1. 尝试原生 composedPath
  if (typeof event.composedPath === 'function') {
    try {
      const path = event.composedPath();
      if (Array.isArray(path) && path.length > 0) {
        return path;
      }
    } catch (e) {
      console.warn('原生 composedPath 调用失败，使用降级方案');
    }
  }

  // 2. 尝试非标准 path 属性
  if ((event as any).path && Array.isArray((event as any).path)) {
    return (event as any).path;
  }

  // 3. 使用 polyfill 手动构建
  const polyfill = ComposedPathPolyfill.getInstance();
  return polyfill.buildEventPath(event.target);
}

/**
 * 初始化全局 composedPath polyfill
 * 应该在应用启动时调用一次
 */
export function initGlobalComposedPathPolyfill(): void {
  if (typeof Event === 'undefined' || typeof Event.prototype === 'undefined') {
    console.warn('Event API 不可用，无法初始化 composedPath polyfill');
    return;
  }

  const polyfill = ComposedPathPolyfill.getInstance();

  // 检查是否需要 polyfill
  if (polyfill.isSupported()) {
    console.log('✅ 浏览器原生支持 composedPath');

    // 即使支持，也增强安全性
    const originalComposedPath = Event.prototype.composedPath;

    try {
      Object.defineProperty(Event.prototype, 'composedPath', {
        value: function (this: Event) {
          try {
            // 尝试调用原生方法
            const result = originalComposedPath.call(this);
            return Array.isArray(result) ? result : [];
          } catch (error) {
            // 原生方法失败，使用降级实现
            console.warn('🔄 composedPath 原生实现失败，使用安全降级');
            return polyfill.buildEventPath(this.target);
          }
        },
        writable: false,
        enumerable: false,
        configurable: true,
      });
      console.log('✅ 已增强 Event.prototype.composedPath 安全性');
    } catch (wrapError) {
      console.warn('无法包装 Event.prototype.composedPath 方法:', wrapError);
    }
  } else {
    // 不支持，添加 polyfill
    try {
      Object.defineProperty(Event.prototype, 'composedPath', {
        value: function (this: Event) {
          return polyfill.buildEventPath(this.target);
        },
        writable: false,
        enumerable: false,
        configurable: true,
      });
      console.log('✅ 已添加 Event.prototype.composedPath polyfill');
    } catch (defineError) {
      console.warn(
        '无法添加 Event.prototype.composedPath polyfill:',
        defineError
      );
    }
  }
}

// 导出单例实例
export const composedPathPolyfill = ComposedPathPolyfill.getInstance();
