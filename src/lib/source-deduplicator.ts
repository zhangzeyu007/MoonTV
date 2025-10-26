/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 源去重器
 * 识别和去除重复的播放源URL
 */

import { SourceCandidate } from './priority-queue-manager';

export interface DeduplicationStats {
  originalCount: number;
  deduplicatedCount: number;
  removedCount: number;
  duplicateGroups: number;
}

/**
 * 源去重器类
 */
export class SourceDeduplicator {
  /**
   * 去重播放源列表
   */
  deduplicate(sources: SourceCandidate[]): SourceCandidate[] {
    if (sources.length === 0) return [];

    console.log(`[Deduplicator] 开始去重，原始源数量: ${sources.length}`);

    const seen = new Map<string, SourceCandidate>();
    const duplicateGroups = new Map<string, SourceCandidate[]>();

    sources.forEach((source) => {
      const normalizedUrl = this.normalizeUrl(source.episodeUrl);

      if (!seen.has(normalizedUrl)) {
        seen.set(normalizedUrl, source);
        duplicateGroups.set(normalizedUrl, [source]);
      } else {
        // 记录重复的源
        const group = duplicateGroups.get(normalizedUrl) || [];
        group.push(source);
        duplicateGroups.set(normalizedUrl, group);

        // 如果已存在，保留优先级更高的
        const existing = seen.get(normalizedUrl)!;
        if ((source.priority || 0) > (existing.priority || 0)) {
          seen.set(normalizedUrl, source);
        }
      }
    });

    const deduplicatedSources = Array.from(seen.values());

    // 统计信息
    const stats: DeduplicationStats = {
      originalCount: sources.length,
      deduplicatedCount: deduplicatedSources.length,
      removedCount: sources.length - deduplicatedSources.length,
      duplicateGroups: Array.from(duplicateGroups.values()).filter(
        (g) => g.length > 1
      ).length,
    };

    console.log(
      `[Deduplicator] 去重完成: 原始=${stats.originalCount}, 去重后=${stats.deduplicatedCount}, 移除=${stats.removedCount}, 重复组=${stats.duplicateGroups}`
    );

    // 输出重复组详情（仅在有重复时）
    if (stats.duplicateGroups > 0) {
      duplicateGroups.forEach((group, normalizedUrl) => {
        if (group.length > 1) {
          console.log(
            `[Deduplicator] 重复组 (${
              group.length
            }个): ${normalizedUrl.substring(0, 60)}...`
          );
        }
      });
    }

    return deduplicatedSources;
  }

  /**
   * URL规范化
   */
  normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // 移除查询参数中的时间戳和随机参数
      urlObj.searchParams.delete('t');
      urlObj.searchParams.delete('r');
      urlObj.searchParams.delete('_');
      urlObj.searchParams.delete('timestamp');
      urlObj.searchParams.delete('random');
      urlObj.searchParams.delete('cache');

      // 统一协议为https（如果原本是http）
      if (urlObj.protocol === 'http:') {
        urlObj.protocol = 'https:';
      }

      // 移除末尾的斜杠
      let pathname = urlObj.pathname;
      if (pathname.endsWith('/') && pathname.length > 1) {
        pathname = pathname.slice(0, -1);
      }
      urlObj.pathname = pathname;

      // 排序查询参数（确保参数顺序不影响比较）
      const sortedParams = new URLSearchParams(
        Array.from(urlObj.searchParams.entries()).sort()
      );
      urlObj.search = sortedParams.toString();

      return urlObj.toString();
    } catch (error) {
      // 如果URL解析失败，返回原始URL
      console.warn(`[Deduplicator] URL解析失败: ${url}`, error);
      return url;
    }
  }

  /**
   * 检查两个URL是否指向同一个源
   */
  isSameSource(url1: string, url2: string): boolean {
    const normalized1 = this.normalizeUrl(url1);
    const normalized2 = this.normalizeUrl(url2);
    return normalized1 === normalized2;
  }

  /**
   * 查找重复的源
   */
  findDuplicates(sources: SourceCandidate[]): Map<string, SourceCandidate[]> {
    const groups = new Map<string, SourceCandidate[]>();

    sources.forEach((source) => {
      const normalizedUrl = this.normalizeUrl(source.episodeUrl);

      if (!groups.has(normalizedUrl)) {
        groups.set(normalizedUrl, []);
      }

      groups.get(normalizedUrl)!.push(source);
    });

    // 只返回有重复的组
    const duplicates = new Map<string, SourceCandidate[]>();
    groups.forEach((group, url) => {
      if (group.length > 1) {
        duplicates.set(url, group);
      }
    });

    return duplicates;
  }

  /**
   * 获取去重统计信息
   */
  getDeduplicationStats(sources: SourceCandidate[]): DeduplicationStats {
    const duplicates = this.findDuplicates(sources);
    const deduplicatedCount = sources.length - this.countDuplicates(duplicates);

    return {
      originalCount: sources.length,
      deduplicatedCount,
      removedCount: sources.length - deduplicatedCount,
      duplicateGroups: duplicates.size,
    };
  }

  /**
   * 计算重复源的数量
   */
  private countDuplicates(duplicates: Map<string, SourceCandidate[]>): number {
    let count = 0;
    duplicates.forEach((group) => {
      count += group.length - 1; // 每组保留1个，其余都是重复的
    });
    return count;
  }

  /**
   * 高级去重：基于域名和路径相似度
   */
  advancedDeduplicate(sources: SourceCandidate[]): SourceCandidate[] {
    if (sources.length === 0) return [];

    console.log(`[Deduplicator] 开始高级去重，原始源数量: ${sources.length}`);

    // 先进行基础去重
    let deduped = this.deduplicate(sources);

    // 再进行域名相似度去重
    deduped = this.deduplicateByDomainSimilarity(deduped);

    console.log(`[Deduplicator] 高级去重完成，最终源数量: ${deduped.length}`);

    return deduped;
  }

  /**
   * 基于域名相似度去重
   */
  private deduplicateByDomainSimilarity(
    sources: SourceCandidate[]
  ): SourceCandidate[] {
    const domainGroups = new Map<string, SourceCandidate[]>();

    sources.forEach((source) => {
      try {
        const url = new URL(source.episodeUrl);
        const domain = this.extractBaseDomain(url.hostname);

        if (!domainGroups.has(domain)) {
          domainGroups.set(domain, []);
        }

        domainGroups.get(domain)!.push(source);
      } catch (error) {
        // 如果URL解析失败，单独保留
        domainGroups.set(source.episodeUrl, [source]);
      }
    });

    // 从每个域名组中选择最佳源
    const result: SourceCandidate[] = [];

    domainGroups.forEach((group) => {
      if (group.length === 1) {
        result.push(group[0]);
      } else {
        // 选择优先级最高的源
        const best = group.reduce((prev, curr) =>
          (curr.priority || 0) > (prev.priority || 0) ? curr : prev
        );
        result.push(best);

        console.log(
          `[Deduplicator] 域名组去重: 保留 ${best.episodeUrl.substring(
            0,
            50
          )}... (${group.length}个候选)`
        );
      }
    });

    return result;
  }

  /**
   * 提取基础域名（去除子域名）
   */
  private extractBaseDomain(hostname: string): string {
    const parts = hostname.split('.');

    // 如果是IP地址，直接返回
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return hostname;
    }

    // 提取主域名（最后两部分）
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }

    return hostname;
  }
}

// 单例实例
export const sourceDeduplicator = new SourceDeduplicator();
