/**
 * 播放器自动恢复集成
 * 提供统一的API用于播放器自动恢复功能
 */

import {
  assessErrorSeverity,
  shouldRebuildPlayer as checkShouldRebuild,
} from './error-boundary';
import { resetPlayerEvents } from './player-event-integration';
import { playerHealthMonitor } from './player-health-monitor';
import { playerRecoveryManager } from './player-recovery-manager';
import { notifyUser } from './player-ui-feedback';

/**
 * 错误严重程度级别
 */
export type ErrorLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * 处理播放器错误并决定恢复策略
 */
export async function handlePlayerError(
  error: Error,
  player: any,
  container: HTMLElement,
  options: any
): Promise<any | null> {
  // 1. 评估错误严重程度
  const severity = assessErrorSeverity(error);

  console.log(`处理播放器错误 [${severity}]:`, error.message);

  // 2. 根据严重程度采取不同的恢复策略
  switch (severity) {
    case 'low':
      // 轻度错误：仅记录，不采取行动
      console.log('轻度错误，继续监控');
      return null;

    case 'medium': {
      // 中度错误：检查是否需要重置事件监听器
      const consecutiveErrors =
        playerHealthMonitor.getHealthStatus().consecutiveErrors;
      if (consecutiveErrors >= 3 && consecutiveErrors < 5) {
        console.log('中度错误且连续错误达到阈值，重置事件监听器');
        resetPlayerEvents();
        notifyUser('播放器已自动恢复', 'info');
      }
      return null;
    }

    case 'high':
    case 'critical':
      // 严重/致命错误：检查是否需要重建播放器
      if (checkShouldRebuild()) {
        console.log('严重错误且满足重建条件，开始重建播放器');
        try {
          const newPlayer = await playerRecoveryManager.recoverPlayer(
            player,
            container,
            options
          );
          return newPlayer;
        } catch (rebuildError) {
          console.error('播放器重建失败:', rebuildError);
          // 重建失败会自动显示错误页面（在 recoverPlayer 中处理）
          return null;
        }
      } else {
        console.log('严重错误但不满足重建条件（可能在冷却期）');
        return null;
      }

    default:
      return null;
  }
}

/**
 * 检查播放器健康状态
 */
export function checkPlayerHealth(player: any): boolean {
  return playerHealthMonitor.isPlayerHealthy(player);
}

/**
 * 手动触发播放器重建
 */
export async function manualRebuildPlayer(
  player: any,
  container: HTMLElement,
  options: any
): Promise<any> {
  console.log('手动触发播放器重建');
  return playerRecoveryManager.recoverPlayer(player, container, options);
}

/**
 * 重置播放器健康状态
 */
export function resetPlayerHealthStatus(): void {
  playerHealthMonitor.resetHealthStatus();
}

/**
 * 获取播放器健康状态
 */
export function getPlayerHealthStatus() {
  return playerHealthMonitor.getHealthStatus();
}

/**
 * 配置重建选项
 */
export function configureRebuild(config: {
  maxAttempts?: number;
  showLoadingIndicator?: boolean;
  autoResume?: boolean;
  persistState?: boolean;
}): void {
  playerRecoveryManager.setConfig(config);
}

/**
 * 检查是否正在重建
 */
export function isRebuilding(): boolean {
  return playerRecoveryManager.isRebuilding();
}

/**
 * 获取重建尝试次数
 */
export function getRebuildAttempts(): number {
  return playerRecoveryManager.getRebuildAttempts();
}
