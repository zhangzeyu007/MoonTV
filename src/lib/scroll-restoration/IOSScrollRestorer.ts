/**
 * iOS 滚动恢复器
 * 专门处理 iOS Safari 的滚动位置恢复
 */

import type { ScrollRestorationConfig } from './config';
import { TIMING } from './constants';

export interface IIOSScrollRestorer {
  /**
   * iOS 专用滚动恢复
   */
  restore(targetPosition: number, anchorKey?: string): Promise<boolean>;

  /**
   * 验证滚动位置是否正确
   */
  verifyPosition(targetPosition: number, tolerance: number): boolean;

  /**
   * 重试滚动恢复
   */
  retryRestore(targetPosition: number, maxRetries: number): Promise<boolean>;
}

/**
 * iOS 滚动恢复器实现
 */
export class IOSScrollRestorer implements IIOSScrollRestorer {
  constructor(private config: ScrollRestorationConfig) {}

  /**
   * iOS 专用滚动恢复
   */
  async restore(targetPosition: number, anchorKey?: string): Promise<boolean> {
    // 1. 移除焦点避免干扰
    this.removeFocus();

    // 2. 尝试锚点定位（如果有）
    let didAnchorScroll = false;
    if (anchorKey && this.config.useAnchor) {
      didAnchorScroll = this.scrollToAnchor(anchorKey);
    }

    // 3. 精确数值滚动（如果没有锚点或需要微调）
    if (!didAnchorScroll) {
      this.scrollToPosition(targetPosition);
    }

    // 4. 延迟验证
    await this.delay(TIMING.VERIFY_DELAY);

    // 5. 验证并重试
    if (!this.verifyPosition(targetPosition, this.config.tolerance)) {
      console.log('[iOS滚动恢复] 需要重试');
      return await this.retryRestore(targetPosition, this.config.maxRetries);
    }

    console.log('[iOS滚动恢复] 成功');
    return true;
  }

  /**
   * 移除焦点避免干扰
   */
  private removeFocus(): void {
    try {
      if (
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur();
      }
    } catch (e) {
      // 忽略错误
    }
  }

  /**
   * 滚动到锚点
   */
  private scrollToAnchor(anchorKey: string): boolean {
    try {
      const anchorEl = document.querySelector(
        `[data-search-key="${anchorKey}"]`
      ) as HTMLElement | null;

      if (anchorEl) {
        anchorEl.scrollIntoView({ block: 'start', behavior: 'auto' });
        console.log('[iOS滚动恢复] 锚点定位成功', { anchorKey });
        return true;
      }
    } catch (e) {
      console.warn('[iOS滚动恢复] 锚点定位失败', e);
    }

    return false;
  }

  /**
   * 滚动到指定位置（使用多种方法）
   */
  private scrollToPosition(targetPosition: number): void {
    // 方法1: window.scrollTo
    window.scrollTo({ top: targetPosition, behavior: 'auto' });

    // 方法2: document.body.scrollTop
    if (document.body) {
      document.body.scrollTop = targetPosition;
    }

    // 方法3: document.documentElement.scrollTop
    if (document.documentElement) {
      document.documentElement.scrollTop = targetPosition;
    }

    console.log('[iOS滚动恢复] 已执行多种滚动方法', { targetPosition });
  }

  /**
   * 验证滚动位置是否正确
   */
  verifyPosition(targetPosition: number, tolerance: number): boolean {
    const currentPos = this.getCurrentScrollPosition();
    const diff = Math.abs(currentPos - targetPosition);

    console.log('[iOS滚动恢复] 验证结果', {
      targetPosition,
      currentPos,
      diff,
      tolerance,
      success: diff <= tolerance,
    });

    return diff <= tolerance;
  }

  /**
   * 重试滚动恢复
   */
  async retryRestore(
    targetPosition: number,
    maxRetries: number
  ): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      console.log(`[iOS滚动恢复] 重试 ${i + 1}/${maxRetries}`);

      // 使用多种方法强制滚动
      this.scrollToPosition(targetPosition);

      // 使用 RAF 确保在下一帧执行
      await this.nextFrame();

      // 验证
      if (this.verifyPosition(targetPosition, this.config.tolerance)) {
        console.log('[iOS滚动恢复] 重试成功');
        return true;
      }

      // 等待后重试
      await this.delay(this.config.retryInterval);
    }

    console.warn('[iOS滚动恢复] 重试失败');
    return false;
  }

  /**
   * 获取当前滚动位置
   */
  private getCurrentScrollPosition(): number {
    const methods = [
      () => (typeof window.scrollY === 'number' ? window.scrollY : 0),
      () => document.documentElement?.scrollTop || 0,
      () => document.body?.scrollTop || 0,
      () => document.scrollingElement?.scrollTop || 0,
    ];

    // 找到第一个非零值
    for (const method of methods) {
      try {
        const value = method();
        if (value > 0) {
          return value;
        }
      } catch (e) {
        continue;
      }
    }

    // 如果都是0，返回最大值
    return Math.max(
      ...methods.map((m) => {
        try {
          return m();
        } catch {
          return 0;
        }
      })
    );
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 等待下一帧
   */
  private nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
}
