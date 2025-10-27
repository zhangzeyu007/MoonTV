/**
 * 滚动恢复常量
 */

/**
 * LocalStorage 键名
 */
export const STORAGE_KEYS = {
  SEARCH_PAGE_STATE: 'searchPageState',
  DEBUG_CONSOLE: 'enableDebugConsole',
} as const;

/**
 * 全局对象键名
 */
export const GLOBAL_KEYS = {
  NAV_LOCK: '__SEARCH_NAV_LOCK__',
  GET_SCROLL_POSITION: 'getSearchPageScrollPosition',
  UPDATE_SCROLL_CACHE: 'updateSearchPageScrollCache',
} as const;

/**
 * 时间常量（毫秒）
 */
export const TIMING = {
  STATE_EXPIRY: 24 * 60 * 60 * 1000, // 24小时
  RECENT_STATE_THRESHOLD: 30 * 60 * 1000, // 30分钟
  MAX_WAIT_CONTENT: 3500, // 最大等待内容加载时间
  CHECK_INTERVAL: 100, // 检查间隔
  IOS_SAVE_INTERVAL: 200, // iOS保存间隔
  PC_SAVE_INTERVAL: 100, // PC保存间隔
  VERIFY_DELAY: 150, // 验证延迟
  RETRY_DELAY: 100, // 重试延迟
} as const;

/**
 * 位置常量（像素）
 */
export const POSITION = {
  SMALL_VALUE_THRESHOLD: 200, // 小值阈值
  SMALL_VALUE_DIFF: 200, // 小值差异
  IOS_TOLERANCE: 10, // iOS容差
  PC_TOLERANCE: 8, // PC容差
} as const;
