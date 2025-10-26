/**
 * 智能源优化 - 统一导出
 * 提供所有源优化功能的统一入口
 */

// 核心组件
export { backupSourceManager } from './backup-source-manager';
export type { CDNOptimizedSource } from './cdn-optimizer';
export { cdnOptimizer } from './cdn-optimizer';
export type { FastTestResult, SourceTestConfig } from './fast-source-tester';
export { fastSourceTester } from './fast-source-tester';
export type { CachedSourceInfo, SourceTestResult } from './source-cache';
export { sourceCache } from './source-cache';

// 新增优化组件
export type {
  CacheCheckResult,
  DeepValidationResult,
  LayeredTestResult,
  QuickTestResult,
} from './multi-layer-tester';
export { multiLayerTester } from './multi-layer-tester';
export type {
  SourceCandidate,
  SourcePriorityScore,
} from './priority-queue-manager';
export { PriorityQueue, priorityQueueManager } from './priority-queue-manager';
export type {
  ProgressiveTestResult,
  TestOptions,
} from './progressive-result-stream';
export { progressiveResultStream } from './progressive-result-stream';
export type { HotSource, PreloadStats } from './smart-cache-preloader';
export { smartCachePreloader } from './smart-cache-preloader';
export type { SelectionOptions, SourceResult } from './smart-source-selector';
export {
  selectBestSources,
  selectFirstAvailable,
  selectSourcesProgressive,
  smartSourceSelector,
} from './smart-source-selector';
export type { DeduplicationStats } from './source-deduplicator';
export { sourceDeduplicator } from './source-deduplicator';

// 便捷函数
export { fastPreferSources, ultraFastSourceSelect } from './fast-source-tester';
