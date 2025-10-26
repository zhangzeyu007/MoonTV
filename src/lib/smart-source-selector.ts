/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 智能源选择器
 * 协调整个源选择流程，提供统一的API接口
 */

import { FastTestResult } from './fast-source-tester';
import {
  priorityQueueManager,
  SourceCandidate,
} from './priority-queue-manager';
import {
  progressiveResultStream,
  TestOptions,
} from './progressive-result-stream';
import { sourceDeduplicator } from './source-deduplicator';

export interface SelectionOptions {
  mode: 'fast' | 'balanced' | 'comprehensive'; // 选择模式
  enableCDN: boolean; // 是否启用CDN优化
  enableCache: boolean; // 是否使用缓存
  timeout: number; // 超时时间
  maxConcurrency: number; // 最大并发数
  maxResults: number; // 最大返回数量
}

export interface SourceResult {
  source: any;
  episodeUrl: string;
  optimizedUrl?: string;
  score: number;
  pingTime: number;
  available: boolean;
  cdnOptimized: boolean;
  fromCache: boolean;
  priority?: number;
}

const DEFAULT_SELECTION_OPTIONS: SelectionOptions = {
  mode: 'balanced',
  enableCDN: true,
  enableCache: true,
  timeout: 2000,
  maxConcurrency: 6,
  maxResults: 3,
};

/**
 * 智能源选择器类
 */
export class SmartSourceSelector {
  /**
   * 智能选择最佳播放源（渐进式返回）
   */
  async *selectSourcesProgressive(
    sources: SourceCandidate[],
    options: Partial<SelectionOptions> = {}
  ): AsyncIterableIterator<SourceResult> {
    const opts: SelectionOptions = {
      ...DEFAULT_SELECTION_OPTIONS,
      ...options,
    };

    if (sources.length === 0) {
      console.log('[Smart Selector] 没有可用的播放源');
      return;
    }

    console.log(
      `[Smart Selector] 开始智能选择，共 ${sources.length} 个源，模式: ${opts.mode}`
    );

    // 去重
    const deduplicatedSources = sourceDeduplicator.deduplicate(sources);

    // 构建优先级队列
    const queue = priorityQueueManager.buildQueue(deduplicatedSources);

    // 配置测试选项
    const testOptions: Partial<TestOptions> = {
      maxConcurrency: opts.maxConcurrency,
      baseTimeout: opts.timeout,
      earlyTermination: opts.mode !== 'comprehensive',
      minAvailableSources: opts.maxResults,
      mode: opts.mode,
    };

    // 渐进式测试并返回结果
    let returnedCount = 0;
    for await (const testResult of progressiveResultStream.testSourcesProgressive(
      queue,
      testOptions
    )) {
      // 找到对应的源（从去重后的源中查找）
      const source = deduplicatedSources.find(
        (s) =>
          s.episodeUrl === testResult.url ||
          s.episodeUrl === testResult.originalUrl
      );

      if (source && testResult.available) {
        const result: SourceResult = {
          source: source.source,
          episodeUrl: source.episodeUrl,
          optimizedUrl: testResult.cdnOptimized ? testResult.url : undefined,
          score: testResult.score,
          pingTime: testResult.pingTime,
          available: testResult.available,
          cdnOptimized: testResult.cdnOptimized || false,
          fromCache: false, // TODO: 从测试结果中获取
          priority: source.priority,
        };

        returnedCount++;
        yield result;

        // 如果已返回足够数量的源，停止
        if (returnedCount >= opts.maxResults) {
          console.log(
            `[Smart Selector] 已返回 ${returnedCount} 个可用源，停止`
          );
          return;
        }
      }
    }

    console.log(
      `[Smart Selector] 渐进式选择完成，共返回 ${returnedCount} 个源`
    );
  }

  /**
   * 快速选择单个可用源
   */
  async selectFirstAvailable(
    sources: SourceCandidate[]
  ): Promise<SourceResult | null> {
    if (sources.length === 0) {
      console.log('[Smart Selector] 没有可用的播放源');
      return null;
    }

    console.log(
      `[Smart Selector] 快速选择第一个可用源，共 ${sources.length} 个候选`
    );

    // 构建优先级队列并取前3个
    const queue = priorityQueueManager.buildQueue(sources);
    const topSources = queue.dequeueBatch(3);

    // 快速选择第一个可用源
    const testResult = await progressiveResultStream.selectFirstAvailable(
      topSources
    );

    if (!testResult) {
      console.log('[Smart Selector] 未找到可用源');
      return null;
    }

    // 找到对应的源
    const source = sources.find(
      (s) =>
        s.episodeUrl === testResult.url ||
        s.episodeUrl === testResult.originalUrl
    );

    if (!source) {
      console.log('[Smart Selector] 未找到匹配的源');
      return null;
    }

    const result: SourceResult = {
      source: source.source,
      episodeUrl: source.episodeUrl,
      optimizedUrl: testResult.cdnOptimized ? testResult.url : undefined,
      score: testResult.score,
      pingTime: testResult.pingTime,
      available: testResult.available,
      cdnOptimized: testResult.cdnOptimized || false,
      fromCache: false,
      priority: source.priority,
    };

    console.log(
      `[Smart Selector] 快速选择完成: ${result.available ? '可用' : '不可用'}`
    );

    return result;
  }

  /**
   * 批量选择多个最佳源
   */
  async selectBestSources(
    sources: SourceCandidate[],
    maxResults = 3
  ): Promise<SourceResult[]> {
    if (sources.length === 0) {
      console.log('[Smart Selector] 没有可用的播放源');
      return [];
    }

    console.log(
      `[Smart Selector] 批量选择最佳源，共 ${sources.length} 个候选，需要 ${maxResults} 个`
    );

    const results: SourceResult[] = [];

    // 使用渐进式选择收集结果
    for await (const result of this.selectSourcesProgressive(sources, {
      mode: 'balanced',
      maxResults,
    })) {
      results.push(result);
    }

    // 按评分排序
    results.sort((a, b) => b.score - a.score);

    console.log(`[Smart Selector] 批量选择完成，返回 ${results.length} 个源`);

    return results.slice(0, maxResults);
  }

  /**
   * 兼容旧API：快速播放源优选函数
   */
  async fastPreferSources(
    sources: Array<{ source: any; episodeUrl: string }>,
    maxSources = 3,
    enableCDNOptimization = true
  ): Promise<
    Array<{ source: any; episodeUrl: string; testResult: FastTestResult }>
  > {
    if (sources.length === 0) return [];

    console.log(
      `[Smart Selector] 兼容模式：快速测试 ${sources.length} 个播放源`
    );

    // 转换为SourceCandidate格式
    const candidates: SourceCandidate[] = sources.map((s) => ({
      source: s.source,
      episodeUrl: s.episodeUrl,
    }));

    // 使用新的选择逻辑
    const selectedSources = await this.selectBestSources(
      candidates,
      maxSources
    );

    // 转换回旧格式
    const results = selectedSources.map((result) => ({
      source: result.source,
      episodeUrl: result.episodeUrl,
      testResult: {
        url: result.optimizedUrl || result.episodeUrl,
        originalUrl: result.episodeUrl,
        available: result.available,
        pingTime: result.pingTime,
        score: result.score,
        testTime: Date.now(),
        cdnOptimized: result.cdnOptimized,
      } as FastTestResult,
    }));

    console.log(`[Smart Selector] 兼容模式完成，返回 ${results.length} 个源`);

    return results;
  }

  /**
   * 兼容旧API：超快速源选择
   */
  async ultraFastSourceSelect(
    sources: Array<{ source: any; episodeUrl: string }>
  ): Promise<{ source: any; episodeUrl: string } | null> {
    if (sources.length === 0) return null;
    if (sources.length === 1) return sources[0];

    console.log(
      `[Smart Selector] 兼容模式：超快速选择 ${sources.length} 个播放源`
    );

    // 转换为SourceCandidate格式
    const candidates: SourceCandidate[] = sources.map((s) => ({
      source: s.source,
      episodeUrl: s.episodeUrl,
    }));

    // 使用快速选择
    const result = await this.selectFirstAvailable(candidates);

    if (result && result.available) {
      console.log('[Smart Selector] 兼容模式：找到可用源');
      return {
        source: result.source,
        episodeUrl: result.episodeUrl,
      };
    }

    // 如果没有可用源，返回第一个
    console.log('[Smart Selector] 兼容模式：使用第一个源');
    return sources[0];
  }
}

// 单例实例
export const smartSourceSelector = new SmartSourceSelector();

// 导出便捷函数
export async function* selectSourcesProgressive(
  sources: SourceCandidate[],
  options?: Partial<SelectionOptions>
): AsyncIterableIterator<SourceResult> {
  yield* smartSourceSelector.selectSourcesProgressive(sources, options);
}

export async function selectFirstAvailable(
  sources: SourceCandidate[]
): Promise<SourceResult | null> {
  return smartSourceSelector.selectFirstAvailable(sources);
}

export async function selectBestSources(
  sources: SourceCandidate[],
  maxResults = 3
): Promise<SourceResult[]> {
  return smartSourceSelector.selectBestSources(sources, maxResults);
}
