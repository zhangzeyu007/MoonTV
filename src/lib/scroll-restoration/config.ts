/**
 * 滚动恢复配置
 */

/**
 * 滚动恢复配置接口
 */
export interface ScrollRestorationConfig {
  // 平台类型
  platform: 'ios' | 'pc';

  // 最大重试次数
  maxRetries: number;

  // 重试间隔（毫秒）
  retryInterval: number;

  // 位置容差（像素）
  tolerance: number;

  // 是否启用锚点定位
  useAnchor: boolean;

  // 是否启用调试日志
  debug: boolean;

  // 更新频率（毫秒）
  updateInterval: number;
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: Record<'ios' | 'pc', ScrollRestorationConfig> = {
  ios: {
    platform: 'ios',
    maxRetries: 5,
    retryInterval: 100,
    tolerance: 10,
    useAnchor: true,
    debug: false,
    updateInterval: 200,
  },
  pc: {
    platform: 'pc',
    maxRetries: 40,
    retryInterval: 0, // 使用 RAF
    tolerance: 8,
    useAnchor: false,
    debug: false,
    updateInterval: 100,
  },
};

/**
 * 获取平台配置
 */
export function getPlatformConfig(
  platform: 'ios' | 'pc'
): ScrollRestorationConfig {
  return DEFAULT_CONFIG[platform];
}
