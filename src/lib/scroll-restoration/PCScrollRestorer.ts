/**
 * PC 滚动恢复器
 * 处理 PC 端的滚动位置恢复
 */

import type { ScrollRestorationConfig } from './config';
import { TIMING } from './constants';

export interface IPCScrollRestorer {
  /**
   * PC 专用滚动恢复
   */
  restore(targetPosition: number): Promise<boolean>;
}

/**
 * PC 滚动恢复器实现
 */
export class PCScrollRestorer implements IPCScrollRestorer {
  constructor(private config: ScrollRestorationConfig) {}

  /**
   * PC 专用滚动恢复（使用 RAF 循环）
   */
  async restore(targetPosition: number): Promise<boolean> {
    const scrollingElement =
      document.scrollingElement || document.documentElement || document.body;

    if (!scrollingElement) {
      console.warn('[PC滚动恢复] 无法找到滚动元素');
      return false;
    }

    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = this.config.maxRetries;
      const tolerance = this.config.tolerance;

      const tryScroll = () => {
        // 设置滚动位置（使用多种方法）
        if (scrollingElement) {
          scrollingElement.scrollTop = targetPosition;
        }
        window.scrollTo(0, targetPosition);
        if (document.documentElement) {
          document.documentElement.scrollTop = targetPosition;
        }
        if (document.body) {
          document.body.scrollTop = targetPosition;
        }

        // 验证
        const current = scrollingElement
          ? scrollingElement.scrollTop
          : window.scrollY;

        const diff = Math.abs(current - targetPosition);

        console.log(`[PC滚动恢复] 尝试 ${attempts + 1}/${maxAttempts}`, {
          targetPosition,
          current,
          diff,
          tolerance,
        });

        if (diff <= tolerance) {
          console.log('[PC滚动恢复] 成功');
          resolve(true);
          return;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          console.warn('[PC滚动恢复] 达到最大重试次数，使用兜底方案');
          // 最后尝试
          setTimeout(() => {
            const maxScrollTop = this.getMaxScrollTop();
            window.scrollTo(0, Math.min(targetPosition, maxScrollTop));
            resolve(false);
          }, 120);
          return;
        }

        requestAnimationFrame(tryScroll);
      };

      if (document.readyState === 'complete') {
        console.log('[PC滚动恢复] 文档已加载完成，立即恢复');
        requestAnimationFrame(tryScroll);
      } else {
        console.log('[PC滚动恢复] 等待文档加载完成');
        const onLoad = () => {
          window.removeEventListener('load', onLoad);
          console.log('[PC滚动恢复] 文档加载完成，开始恢复');
          requestAnimationFrame(tryScroll);
        };
        window.addEventListener('load', onLoad);
      }
    });
  }

  /**
   * 获取最大可滚动高度
   */
  private getMaxScrollTop(): number {
    return Math.max(
      document.body.scrollHeight - window.innerHeight,
      document.documentElement.scrollHeight - window.innerHeight,
      0
    );
  }

  /**
   * 等待内容加载
   */
  async waitForContent(
    hasSearchResults: boolean,
    searchResultsLength: number
  ): Promise<void> {
    const maxWaitTime = TIMING.MAX_WAIT_CONTENT;
    const checkInterval = TIMING.CHECK_INTERVAL;
    let waitTime = 0;

    while (waitTime < maxWaitTime) {
      const hasScrollableContent =
        document.body.scrollHeight > window.innerHeight;
      const shouldProceed =
        hasScrollableContent ||
        (hasSearchResults && searchResultsLength > 0) ||
        waitTime >= maxWaitTime;

      console.log('[PC滚动恢复] 等待内容加载', {
        waitTime,
        hasScrollableContent,
        hasSearchResults,
        searchResultsLength,
        shouldProceed,
      });

      if (shouldProceed) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;
    }
  }
}
