/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 优先级队列管理器
 * 基于历史数据和缓存信息构建测试优先级队列
 */

import { CachedSourceInfo, sourceCache } from './source-cache';

export interface SourceCandidate {
  source: any;
  episodeUrl: string;
  priority?: number; // 初始优先级
}

export interface SourcePriorityScore {
  url: string;
  totalScore: number; // 总分（0-100）
  healthScore: number; // 健康度分数
  speedScore: number; // 速度分数
  freshnessScore: number; // 新鲜度分数
  successRateScore: number; // 成功率分数
  calculatedAt: number; // 计算时间戳
}

/**
 * 优先级队列节点
 */
interface PriorityQueueNode<T> {
  item: T;
  priority: number;
}

/**
 * 优先级队列实现
 */
export class PriorityQueue<T> {
  private items: PriorityQueueNode<T>[] = [];

  /**
   * 入队
   */
  enqueue(item: T, priority: number): void {
    const node: PriorityQueueNode<T> = { item, priority };

    // 找到插入位置（按优先级从高到低排序）
    let added = false;
    for (let i = 0; i < this.items.length; i++) {
      if (priority > this.items[i].priority) {
        this.items.splice(i, 0, node);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(node);
    }
  }

  /**
   * 出队
   */
  dequeue(): T | null {
    if (this.isEmpty()) {
      return null;
    }
    const node = this.items.shift();
    return node ? node.item : null;
  }

  /**
   * 批量出队
   */
  dequeueBatch(count: number): T[] {
    const batch: T[] = [];
    for (let i = 0; i < count && !this.isEmpty(); i++) {
      const item = this.dequeue();
      if (item) {
        batch.push(item);
      }
    }
    return batch;
  }

  /**
   * 查看队首元素
   */
  peek(): T | null {
    if (this.isEmpty()) {
      return null;
    }
    return this.items[0].item;
  }

  /**
   * 队列是否为空
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * 队列大小
   */
  size(): number {
    return this.items.length;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.items = [];
  }

  /**
   * 转换为数组
   */
  toArray(): T[] {
    return this.items.map((node) => node.item);
  }
}

/**
 * 优先级队列管理器
 */
export class PriorityQueueManager {
  /**
   * 构建优先级队列
   */
  buildQueue(sources: SourceCandidate[]): PriorityQueue<SourceCandidate> {
    const queue = new PriorityQueue<SourceCandidate>();

    sources.forEach((source) => {
      const priority = this.calculatePriority(source);
      queue.enqueue(source, priority);
    });

    console.log(
      `[Priority Queue] 构建完成，共 ${queue.size()} 个源，优先级范围: ${this.getPriorityRange(
        sources
      )}`
    );

    return queue;
  }

  /**
   * 计算播放源的初始优先级
   */
  calculatePriority(source: SourceCandidate): number {
    // 如果已有初始优先级，使用它作为基础
    const basePriority = source.priority || 50;

    // 从缓存获取历史数据
    const cached = sourceCache.getCachedSource(source.episodeUrl);

    if (!cached) {
      return basePriority; // 默认中等优先级
    }

    // 基于历史数据计算优先级
    const healthScore = this.calculateHealthScore(cached);
    const speedScore = this.calculateSpeedScore(cached);
    const freshnessScore = this.calculateFreshnessScore(cached);
    const successRateScore = this.calculateSuccessRateScore(cached);

    // 综合评分（权重：健康度40%、速度30%、新鲜度20%、成功率10%）
    const totalScore =
      healthScore * 0.4 +
      speedScore * 0.3 +
      freshnessScore * 0.2 +
      successRateScore * 0.1;

    return Math.round(totalScore);
  }

  /**
   * 计算健康度评分
   */
  private calculateHealthScore(cached: CachedSourceInfo): number {
    return cached.healthScore * 100;
  }

  /**
   * 计算速度评分
   */
  private calculateSpeedScore(cached: CachedSourceInfo): number {
    const pingTime = cached.testResult.pingTime;

    if (pingTime <= 0) return 0;
    if (pingTime <= 100) return 100;
    if (pingTime <= 200) return 90;
    if (pingTime <= 500) return 70;
    if (pingTime <= 1000) return 50;
    if (pingTime <= 2000) return 30;
    return 10;
  }

  /**
   * 计算新鲜度评分
   */
  private calculateFreshnessScore(cached: CachedSourceInfo): number {
    const now = Date.now();
    const age = now - cached.lastTestTime;

    // 5分钟内：100分
    if (age <= 5 * 60 * 1000) return 100;
    // 10分钟内：80分
    if (age <= 10 * 60 * 1000) return 80;
    // 30分钟内：60分
    if (age <= 30 * 60 * 1000) return 60;
    // 1小时内：40分
    if (age <= 60 * 60 * 1000) return 40;
    // 超过1小时：20分
    return 20;
  }

  /**
   * 计算成功率评分
   */
  private calculateSuccessRateScore(cached: CachedSourceInfo): number {
    return cached.testResult.successRate * 100;
  }

  /**
   * 获取优先级范围（用于日志）
   */
  private getPriorityRange(sources: SourceCandidate[]): string {
    if (sources.length === 0) return 'N/A';

    const priorities = sources.map((s) => this.calculatePriority(s));
    const min = Math.min(...priorities);
    const max = Math.max(...priorities);

    return `${min.toFixed(0)}-${max.toFixed(0)}`;
  }

  /**
   * 获取源的详细优先级评分
   */
  getDetailedScore(source: SourceCandidate): SourcePriorityScore {
    const cached = sourceCache.getCachedSource(source.episodeUrl);

    if (!cached) {
      return {
        url: source.episodeUrl,
        totalScore: source.priority || 50,
        healthScore: 0,
        speedScore: 0,
        freshnessScore: 0,
        successRateScore: 0,
        calculatedAt: Date.now(),
      };
    }

    const healthScore = this.calculateHealthScore(cached);
    const speedScore = this.calculateSpeedScore(cached);
    const freshnessScore = this.calculateFreshnessScore(cached);
    const successRateScore = this.calculateSuccessRateScore(cached);

    const totalScore =
      healthScore * 0.4 +
      speedScore * 0.3 +
      freshnessScore * 0.2 +
      successRateScore * 0.1;

    return {
      url: source.episodeUrl,
      totalScore: Math.round(totalScore),
      healthScore: Math.round(healthScore),
      speedScore: Math.round(speedScore),
      freshnessScore: Math.round(freshnessScore),
      successRateScore: Math.round(successRateScore),
      calculatedAt: Date.now(),
    };
  }

  /**
   * 批量获取详细评分
   */
  getBatchDetailedScores(sources: SourceCandidate[]): SourcePriorityScore[] {
    return sources.map((source) => this.getDetailedScore(source));
  }
}

// 单例实例
export const priorityQueueManager = new PriorityQueueManager();
