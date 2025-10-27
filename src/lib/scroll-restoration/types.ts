/**
 * 滚动恢复功能的类型定义
 */

import { SearchResult } from '@/lib/types';

/**
 * 滚动选项
 */
export interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  platform?: 'ios' | 'pc';
  useAnchor?: boolean;
  anchorKey?: string;
}

/**
 * 保存的滚动状态
 */
export interface SavedScrollState {
  // 滚动位置
  scrollPosition: number;

  // 锚点标识（用于辅助定位）
  anchorKey?: string;

  // 搜索查询
  query: string;

  // 搜索结果
  results: SearchResult[];

  // 是否显示结果
  showResults: boolean;

  // 视图模式
  viewMode: 'agg' | 'all';

  // 选择的资源
  selectedResources: string[];

  // 保存时间戳
  timestamp: number;
}

/**
 * 导航锁状态
 */
export interface NavigationLockState {
  // 是否激活
  active: boolean;

  // 锁定的滚动位置
  position: number;

  // 锁定时间戳
  timestamp: number;

  // 锚点标识
  anchorKey?: string;
}
