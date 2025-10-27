/**
 * 事件对象验证器
 * 验证事件对象的完整性和有效性
 */

import { composedPathPolyfill } from './composed-path-polyfill';
import { IEventValidator } from './event-handler-utils';

/**
 * EventValidator 类
 */
export class EventValidator implements IEventValidator {
  private static instance: EventValidator | null = null;

  /**
   * 获取单例实例
   */
  public static getInstance(): EventValidator {
    if (!EventValidator.instance) {
      EventValidator.instance = new EventValidator();
    }
    return EventValidator.instance;
  }

  /**
   * 验证事件对象是否有效
   */
  public isValidEvent(event: any): boolean {
    // 基本类型检查
    if (!event || typeof event !== 'object') {
      return false;
    }

    // 检查必要的属性
    if (typeof event.type !== 'string') {
      return false;
    }

    // target 可以为 null（某些事件），但如果存在必须是对象
    if (event.target !== null && typeof event.target !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * 确保事件对象具有必要的属性
   */
  public ensureEventProperties(event: any): Event {
    if (!this.isValidEvent(event)) {
      throw new Error('无效的事件对象');
    }

    // 确保 target 属性存在
    if (!event.target && event.currentTarget) {
      try {
        Object.defineProperty(event, 'target', {
          value: event.currentTarget,
          writable: false,
          enumerable: false,
          configurable: true,
        });
      } catch (e) {
        // 如果无法定义属性，至少记录警告
        console.warn('无法为事件对象定义 target 属性');
      }
    }

    // 确保 currentTarget 属性存在
    if (!event.currentTarget && event.target) {
      try {
        Object.defineProperty(event, 'currentTarget', {
          value: event.target,
          writable: false,
          enumerable: false,
          configurable: true,
        });
      } catch (e) {
        console.warn('无法为事件对象定义 currentTarget 属性');
      }
    }

    // 确保 composedPath 方法存在
    if (this.needsPolyfill(event)) {
      composedPathPolyfill.applyPolyfill(event);
    }

    // 确保 preventDefault 和 stopPropagation 方法存在
    if (typeof event.preventDefault !== 'function') {
      event.preventDefault = function () {
        // 空实现
      };
    }

    if (typeof event.stopPropagation !== 'function') {
      event.stopPropagation = function () {
        // 空实现
      };
    }

    return event as Event;
  }

  /**
   * 检查是否需要 polyfill
   */
  public needsPolyfill(event: any): boolean {
    if (!event || typeof event !== 'object') {
      return false;
    }

    // 检查 composedPath 方法是否存在
    if (typeof event.composedPath !== 'function') {
      return true;
    }

    // 检查 composedPath 方法是否可用
    try {
      const path = event.composedPath();
      return !Array.isArray(path);
    } catch (e) {
      return true;
    }
  }

  /**
   * 规范化触摸和鼠标事件
   */
  public normalizePointerEvent(event: any): any {
    if (!this.isValidEvent(event)) {
      return event;
    }

    const eventType = event.type;

    // 触摸事件规范化
    if (eventType.startsWith('touch')) {
      // 确保 touches 和 changedTouches 存在
      if (!event.touches) {
        event.touches = [];
      }
      if (!event.changedTouches) {
        event.changedTouches = [];
      }

      // 为触摸事件添加鼠标事件兼容属性
      if (event.changedTouches.length > 0) {
        const touch = event.changedTouches[0];
        if (!event.clientX) event.clientX = touch.clientX;
        if (!event.clientY) event.clientY = touch.clientY;
        if (!event.pageX) event.pageX = touch.pageX;
        if (!event.pageY) event.pageY = touch.pageY;
      }
    }

    // 鼠标事件规范化
    if (eventType.startsWith('mouse') || eventType === 'click') {
      // 确保坐标属性存在
      if (typeof event.clientX !== 'number') event.clientX = 0;
      if (typeof event.clientY !== 'number') event.clientY = 0;
      if (typeof event.pageX !== 'number') {
        event.pageX =
          event.clientX + (document.documentElement.scrollLeft || 0);
      }
      if (typeof event.pageY !== 'number') {
        event.pageY = event.clientY + (document.documentElement.scrollTop || 0);
      }
    }

    return event;
  }

  /**
   * 验证并修复事件对象
   */
  public validateAndFix(event: any): Event | null {
    try {
      // 验证事件对象
      if (!this.isValidEvent(event)) {
        console.warn('事件对象验证失败');
        return null;
      }

      // 确保必要属性存在
      const fixedEvent = this.ensureEventProperties(event);

      // 规范化指针事件
      return this.normalizePointerEvent(fixedEvent);
    } catch (error) {
      console.error('验证和修复事件对象时出错:', error);
      return null;
    }
  }
}

// 导出单例实例
export const eventValidator = EventValidator.getInstance();

/**
 * 快捷函数：验证事件对象
 */
export function validateEvent(event: any): boolean {
  return eventValidator.isValidEvent(event);
}

/**
 * 快捷函数：确保事件属性
 */
export function ensureEvent(event: any): Event {
  return eventValidator.ensureEventProperties(event);
}

/**
 * 快捷函数：验证并修复事件
 */
export function validateAndFixEvent(event: any): Event | null {
  return eventValidator.validateAndFix(event);
}
