/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 渐进式结果流
 * 管理测试结果的实时流式返回
 */

import { fastSourceTester, FastTestResult } from './fast-source-tester';
import { PriorityQueue, SourceCandidate } from './priority-queue-manager';

export interface TestOptions {
  maxConcurrency: number;
  baseTimeout: number;
  earlyTermination: boolean; // 是否启用早期终止
  minAvailableSources: number; // 早期终止的最小可用源数量
  mode: 'fast' | 'balanced' | 'comprehensive'; // 测试模式
}

export interface ProgressiveTestResult extends FastTestResult {
  index: number; // 测试顺序索引
  totalCount: number; // 总源数量
  availableCount: number; // 当前可用源数量
}

const DEFAULT_TEST_OPTIONS: TestOptions = {
  maxConcurrency: 6,
  baseTimeout: 2000,
  earlyTermination: true,
  minAvailableSources: 3,
  mode: 'balanced',
};

/**
 * 渐进式结果流管理器
 */
export class ProgressiveResultStream {
  /**
   * 渐进式批量测试（边测试边返回结果）
   */
  async *testSourcesProgressive(
    sources: PriorityQueue<SourceCandidate>,
    options: Partial<TestOptions> = {}
  ): AsyncIterableIterator<ProgressiveTestResult> {
    const opts: TestOptions = { ...DEFAULT_TEST_OPTIONS, ...options };
    const results: FastTestResult[] = [];
    let availableCount = 0;
    let testedCount = 0;
    const totalCount = sources.size();

    console.log(
      `[Progressive Stream] 开始渐进式测试 ${totalCount} 个源，模式: ${opts.mode}`
    );

    while (!sources.isEmpty()) {
      // 取出一批高优先级源
      const batch = sources.dequeueBatch(opts.maxConcurrency);
      const batchUrls = batch.map((s) => s.episodeUrl);

      // 并发测试这一批
      const batchResults = await fastSourceTester.batchQuickTest(
        batchUrls,
        true
      );

      // 处理每个测试结果
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const source = batch[i];

        results.push(result);
        testedCount++;

        // 构建渐进式结果
        const progressiveResult: ProgressiveTestResult = {
          ...result,
          index: testedCount,
          totalCount,
          availableCount,
        };

        if (result.available) {
          availableCount++;
          progressiveResult.availableCount = availableCount;

          // 立即返回可用源
          yield progressiveResult;

          console.log(
            `[Progressive Stream] 找到可用源 ${availableCount}/${
              opts.minAvailableSources
            }: ${source.episodeUrl.substring(0, 50)}...`
          );

          // 早期终止检查
          if (
            this.shouldTerminateEarly(
              opts,
              availableCount,
              testedCount,
              totalCount
            )
          ) {
            console.log(
              `[Progressive Stream] 早期终止：已找到 ${availableCount} 个可用源`
            );
            return;
          }
        }
      }
    }

    // 如果没有找到足够的可用源，返回所有不可用的源（用于备用）
    console.log(
      `[Progressive Stream] 测试完成，共 ${availableCount}/${totalCount} 个源可用`
    );

    for (const result of results) {
      if (!result.available) {
        yield {
          ...result,
          index: testedCount,
          totalCount,
          availableCount,
        };
      }
    }
  }

  /**
   * 判断是否应该早期终止
   */
  private shouldTerminateEarly(
    options: TestOptions,
    availableCount: number,
    testedCount: number,
    totalCount: number
  ): boolean {
    if (!options.earlyTermination) {
      return false;
    }

    switch (options.mode) {
      case 'fast':
        // 快速模式：找到1个可用源即可
        return availableCount >= 1;

      case 'balanced':
        // 平衡模式：找到足够数量的源或测试了50%的源
        if (availableCount >= options.minAvailableSources) {
          return true;
        }
        if (testedCount >= totalCount * 0.5 && availableCount >= 2) {
          return true;
        }
        return false;

      case 'comprehensive':
        // 全面模式：测试所有源
        return false;

      default:
        return false;
    }
  }

  /**
   * 快速选择第一个可用源
   */
  async selectFirstAvailable(
    sources: SourceCandidate[]
  ): Promise<ProgressiveTestResult | null> {
    if (sources.length === 0) return null;

    console.log(
      `[Progressive Stream] 快速选择第一个可用源，共 ${sources.length} 个候选`
    );

    // 只测试前3个源
    const testSources = sources.slice(0, 3);
    const urls = testSources.map((s) => s.episodeUrl);

    const results = await fastSourceTester.batchQuickTest(urls, true);

    // 找到第一个可用的源
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.available) {
        console.log(
          `[Progressive Stream] 找到可用源: ${testSources[
            i
          ].episodeUrl.substring(0, 50)}...`
        );
        return {
          ...result,
          index: i + 1,
          totalCount: sources.length,
          availableCount: 1,
        };
      }
    }

    // 如果没有可用源，返回第一个
    console.log('[Progressive Stream] 未找到可用源，返回第一个');
    return results[0]
      ? {
          ...results[0],
          index: 1,
          totalCount: sources.length,
          availableCount: 0,
        }
      : null;
  }

  /**
   * 收集所有渐进式结果到数组
   */
  async collectAll(
    sources: PriorityQueue<SourceCandidate>,
    options: Partial<TestOptions> = {}
  ): Promise<ProgressiveTestResult[]> {
    const results: ProgressiveTestResult[] = [];

    for await (const result of this.testSourcesProgressive(sources, options)) {
      results.push(result);
    }

    return results;
  }
}

// 单例实例
export const progressiveResultStream = new ProgressiveResultStream();
