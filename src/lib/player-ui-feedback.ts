/**
 * 播放器用户界面反馈
 * 提供加载指示器、通知和错误页面
 */

import { refreshCleanupManager } from './refresh-cleanup-manager';
import { getRefreshExecutor } from './refresh-executor';

/**
 * 增强的致命错误配置接口
 */
export interface EnhancedFatalErrorConfig {
  title: string;
  message: string;
  suggestion: string;
  error?: Error;

  // 新增选项
  enableCleanup?: boolean; // 默认true
  refreshTimeout?: number; // 默认3000ms
  showFallbackButton?: boolean; // 默认true

  // 回调函数
  onRefresh?: () => void;
  onBack?: () => void;
  onCleanupComplete?: (report: any) => void;
  onRefreshTimeout?: () => void;
}

/**
 * 显示加载指示器
 */
export function showLoadingIndicator(
  message: string,
  attempt?: number,
  maxAttempts?: number
): void {
  // 移除已存在的指示器
  hideLoadingIndicator();

  const indicator = document.createElement('div');
  indicator.id = 'player-rebuild-indicator';
  indicator.className = 'player-rebuild-indicator';

  const progressText =
    attempt && maxAttempts ? ` (${attempt}/${maxAttempts})` : '';

  indicator.innerHTML = `
    <div class="rebuild-overlay"></div>
    <div class="rebuild-content">
      <div class="rebuild-spinner"></div>
      <div class="rebuild-message">${message}${progressText}</div>
    </div>
  `;

  // 添加样式
  const style = document.createElement('style');
  style.id = 'player-rebuild-indicator-style';
  style.textContent = `
    .player-rebuild-indicator {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .rebuild-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
    }

    .rebuild-content {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    .rebuild-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.2);
      border-top-color: #fff;
      border-radius: 50%;
      animation: rebuild-spin 0.8s linear infinite;
    }

    @keyframes rebuild-spin {
      to { transform: rotate(360deg); }
    }

    .rebuild-message {
      color: #fff;
      font-size: 16px;
      font-weight: 500;
      text-align: center;
      max-width: 300px;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(indicator);

  console.log(`🔄 显示加载指示器: ${message}${progressText}`);
}

/**
 * 隐藏加载指示器
 */
export function hideLoadingIndicator(): void {
  const indicator = document.getElementById('player-rebuild-indicator');
  if (indicator) {
    indicator.remove();
  }

  const style = document.getElementById('player-rebuild-indicator-style');
  if (style) {
    style.remove();
  }

  console.log('✅ 隐藏加载指示器');
}

/**
 * 通知用户
 */
export function notifyUser(
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  duration = 3000
): void {
  try {
    // 尝试使用播放器的 notice API
    if (typeof window !== 'undefined') {
      const player = (window as any).artPlayerInstance;
      if (player?.notice && typeof player.notice.show === 'function') {
        player.notice.show(message, duration);
        console.log(`📢 [${type.toUpperCase()}] ${message}`);
        return;
      }
    }

    // 降级到自定义通知
    showCustomNotification(message, type, duration);
  } catch (error) {
    console.warn('显示通知失败:', error);
    // 最终降级到控制台
    console.log(`📢 [${type.toUpperCase()}] ${message}`);
  }
}

/**
 * 显示自定义通知
 */
function showCustomNotification(
  message: string,
  type: 'success' | 'error' | 'info' | 'warning',
  duration: number
): void {
  const notification = document.createElement('div');
  notification.className = `player-notification player-notification-${type}`;

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  notification.innerHTML = `
    <span class="notification-icon">${icons[type]}</span>
    <span class="notification-message">${message}</span>
  `;

  // 添加样式（如果还没有）
  if (!document.getElementById('player-notification-style')) {
    const style = document.createElement('style');
    style.id = 'player-notification-style';
    style.textContent = `
      .player-notification {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: rgba(0, 0, 0, 0.9);
        color: #fff;
        border-radius: 8px;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: notification-slide-in 0.3s ease-out;
      }

      @keyframes notification-slide-in {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }

      .player-notification-success {
        border-left: 4px solid #4caf50;
      }

      .player-notification-error {
        border-left: 4px solid #f44336;
      }

      .player-notification-info {
        border-left: 4px solid #2196f3;
      }

      .player-notification-warning {
        border-left: 4px solid #ff9800;
      }

      .notification-icon {
        font-size: 18px;
        font-weight: bold;
      }

      .notification-message {
        flex: 1;
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // 自动移除
  setTimeout(() => {
    notification.style.animation = 'notification-slide-out 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, duration);

  console.log(`📢 [${type.toUpperCase()}] ${message}`);
}

/**
 * 显示致命错误页面（增强版）
 */
export function showFatalError(config: EnhancedFatalErrorConfig): void {
  const {
    enableCleanup = true,
    refreshTimeout = 3000,
    showFallbackButton = true,
  } = config;

  const errorPage = document.createElement('div');
  errorPage.className = 'player-fatal-error';

  // 构建按钮HTML
  const buttonsHtml = showFallbackButton
    ? `
      <button class="error-btn error-btn-primary" id="error-refresh-btn">刷新页面</button>
      <button class="error-btn error-btn-warning" id="error-force-refresh-btn" title="使用更激进的刷新策略">强制刷新</button>
      <button class="error-btn error-btn-secondary" id="error-back-btn">返回</button>
    `
    : `
      <button class="error-btn error-btn-primary" id="error-refresh-btn">刷新页面</button>
      <button class="error-btn error-btn-secondary" id="error-back-btn">返回</button>
    `;

  errorPage.innerHTML = `
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h2 class="error-title">${config.title}</h2>
      <p class="error-message">${config.message}</p>
      <p class="error-suggestion">${config.suggestion}</p>
      <div class="error-actions">
        ${buttonsHtml}
      </div>
      ${
        config.error
          ? `<details class="error-details">
        <summary>错误详情</summary>
        <pre class="error-stack">${
          config.error.stack || config.error.message
        }</pre>
      </details>`
          : ''
      }
    </div>
  `;

  // 添加样式
  const style = document.createElement('style');
  style.id = 'player-fatal-error-style';
  style.textContent = `
    .player-fatal-error {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.95);
      backdrop-filter: blur(8px);
    }

    .error-content {
      max-width: 500px;
      padding: 40px;
      text-align: center;
      color: #fff;
    }

    .error-icon {
      font-size: 64px;
      margin-bottom: 20px;
      animation: error-pulse 2s ease-in-out infinite;
    }

    @keyframes error-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .error-title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #fff;
    }

    .error-message {
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 12px;
      color: rgba(255, 255, 255, 0.9);
    }

    .error-suggestion {
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 32px;
      color: rgba(255, 255, 255, 0.7);
    }

    .error-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 24px;
    }

    .error-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .error-btn-primary {
      background: #2196f3;
      color: #fff;
    }

    .error-btn-primary:hover {
      background: #1976d2;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
    }

    .error-btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .error-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .error-btn-warning {
      background: #ff9800;
      color: #fff;
    }

    .error-btn-warning:hover {
      background: #f57c00;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(255, 152, 0, 0.4);
    }

    .error-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      pointer-events: none;
    }

    .error-details {
      text-align: left;
      margin-top: 24px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      cursor: pointer;
    }

    .error-details summary {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      user-select: none;
    }

    .error-stack {
      margin-top: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.8);
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
  `;

  document.head.appendChild(style);

  // 替换播放器容器或添加到 body
  const container = document.querySelector('.artplayer-app');
  if (container) {
    container.innerHTML = '';
    container.appendChild(errorPage);
  } else {
    document.body.appendChild(errorPage);
  }

  // 创建刷新执行器
  const refreshExecutor = getRefreshExecutor(refreshCleanupManager);

  // 绑定事件
  const refreshBtn = document.getElementById('error-refresh-btn');
  const forceRefreshBtn = document.getElementById('error-force-refresh-btn');
  const backBtn = document.getElementById('error-back-btn');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('🔄 用户点击刷新按钮', {
        timestamp: Date.now(),
        enableCleanup,
        refreshTimeout,
        userAgent: navigator.userAgent,
      });

      if (config.onRefresh) {
        config.onRefresh();
      } else {
        // iOS Safari 兼容：在用户手势上下文中同步执行刷新
        // 不使用 async/await，避免异步上下文导致刷新被阻止

        // 1. 立即显示加载状态
        refreshBtn.textContent = '正在刷新...';
        refreshBtn.setAttribute('disabled', 'true');

        // 2. 执行清理（如果启用）
        if (enableCleanup) {
          try {
            console.log('🧹 执行清理...');
            const report = refreshCleanupManager.executeCleanup();
            console.log('✅ 清理完成:', report);
          } catch (error) {
            console.warn('⚠️ 清理失败，但继续刷新:', error);
          }
        }

        // 3. 立即执行刷新（同步，在用户手势上下文中）
        try {
          console.log('🔄 立即执行刷新...');
          refreshExecutor.standardRefresh();
        } catch (error) {
          console.error('❌ 刷新失败:', error);
          // 刷新失败时恢复按钮状态
          refreshBtn.textContent = '刷新页面';
          refreshBtn.removeAttribute('disabled');
          alert('刷新失败，请手动刷新浏览器（iOS: 下拉页面刷新）');
        }
      }
    });
  }

  if (forceRefreshBtn) {
    forceRefreshBtn.addEventListener('click', () => {
      console.log('🔄 用户点击强制刷新按钮', {
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      });

      // iOS Safari 兼容：同步执行强制刷新

      // 1. 立即显示加载状态
      forceRefreshBtn.textContent = '正在刷新...';
      forceRefreshBtn.setAttribute('disabled', 'true');

      // 2. 执行清理
      if (enableCleanup) {
        try {
          console.log('🧹 执行清理...');
          refreshCleanupManager.executeCleanup();
        } catch (error) {
          console.warn('⚠️ 清理失败，但继续刷新:', error);
        }
      }

      // 3. 立即执行强制刷新
      try {
        console.log('🔄 立即执行强制刷新...');
        refreshExecutor.forceRefresh();
      } catch (error) {
        console.error('❌ 强制刷新失败:', error);
        forceRefreshBtn.textContent = '强制刷新';
        forceRefreshBtn.removeAttribute('disabled');
        alert('强制刷新失败，请手动刷新浏览器（iOS: 下拉页面刷新）');
      }
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (config.onBack) {
        config.onBack();
      } else {
        window.history.back();
      }
    });
  }

  console.error('❌ 显示致命错误页面:', config.title);
  console.log('配置:', {
    enableCleanup,
    refreshTimeout,
    showFallbackButton,
  });
}

/**
 * 隐藏致命错误页面
 */
export function hideFatalError(): void {
  const errorPage = document.querySelector('.player-fatal-error');
  if (errorPage) {
    errorPage.remove();
  }

  const style = document.getElementById('player-fatal-error-style');
  if (style) {
    style.remove();
  }

  console.log('✅ 隐藏致命错误页面');
}

/**
 * 测试致命错误弹窗显示
 * 用于开发和调试
 */
export function testFatalErrorDisplay(): void {
  console.log('🧪 开始测试致命错误弹窗...');

  // 创建一个模拟的 composedPath 错误
  const testError = new Error(
    "undefined is not an object (evaluating 'e.composedPath')"
  );
  testError.stack = `Error: undefined is not an object (evaluating 'e.composedPath')
    at HTMLDivElement.handleClick (play/page.tsx:2500:15)
    at HTMLDivElement.dispatch (artplayer.js:1234:20)`;

  // 显示致命错误弹窗
  showFatalError({
    title: '播放器无法恢复',
    message: '很抱歉，播放器遇到了严重问题，多次修复尝试均失败',
    suggestion: '请尝试刷新页面或更换浏览器',
    error: testError,
  });

  // 验证弹窗是否显示
  setTimeout(() => {
    const errorPage = document.querySelector('.player-fatal-error');
    const refreshBtn = document.getElementById('error-refresh-btn');
    const backBtn = document.getElementById('error-back-btn');

    if (errorPage) {
      console.log('✅ 致命错误弹窗正确显示');
    } else {
      console.error('❌ 致命错误弹窗未显示');
    }

    if (refreshBtn) {
      console.log('✅ 刷新按钮存在');
    } else {
      console.error('❌ 刷新按钮不存在');
    }

    if (backBtn) {
      console.log('✅ 返回按钮存在');
    } else {
      console.error('❌ 返回按钮不存在');
    }

    // 测试按钮功能
    if (refreshBtn) {
      console.log('🧪 测试刷新按钮点击（不会真正刷新）');
      // 不实际触发点击，只验证按钮存在
    }

    console.log('🧪 测试完成！请手动验证弹窗显示和按钮功能');
  }, 100);
}

/**
 * 测试刷新卡死场景
 * 模拟刷新操作被阻塞的情况
 */
export function testRefreshDeadlock(): void {
  console.log('🧪 开始测试刷新卡死场景...');

  // 创建一些阻塞资源
  const blockingTimers: NodeJS.Timeout[] = [];
  const blockingIntervals: NodeJS.Timeout[] = [];

  // 创建多个定时器
  for (let i = 0; i < 10; i++) {
    const timer = setTimeout(() => {
      console.log(`定时器 ${i} 执行`);
    }, 10000);
    blockingTimers.push(timer);
  }

  // 创建多个间隔器
  for (let i = 0; i < 5; i++) {
    const interval = setInterval(() => {
      console.log(`间隔器 ${i} 执行`);
    }, 1000);
    blockingIntervals.push(interval);
  }

  // 添加事件监听器
  const blockingListener = () => {
    console.log('阻塞事件监听器执行');
  };
  window.addEventListener('beforeunload', blockingListener);

  console.log('✅ 已创建阻塞资源:', {
    定时器: blockingTimers.length,
    间隔器: blockingIntervals.length,
    事件监听器: 1,
  });

  // 显示致命错误弹窗
  showFatalError({
    title: '测试刷新卡死场景',
    message: '已创建多个阻塞资源，测试刷新清理功能',
    suggestion: '点击刷新按钮，观察清理和刷新流程',
    enableCleanup: true,
    refreshTimeout: 3000,
    showFallbackButton: true,
    onCleanupComplete: (report) => {
      console.log('🧪 清理完成报告:', report);
    },
    onRefreshTimeout: () => {
      console.log('🧪 刷新超时触发');
    },
  });

  console.log('🧪 测试场景已设置，请点击刷新按钮观察行为');
}

/**
 * 获取刷新系统状态
 * 用于调试和监控
 */
export function getRefreshSystemStatus(): {
  cleanupManager: any;
  refreshExecutor: any;
} {
  const cleanupReport = refreshCleanupManager.getCleanupReport();
  const refreshExecutor = getRefreshExecutor(refreshCleanupManager);
  const refreshState = refreshExecutor.getRefreshState();
  const refreshLogs = refreshExecutor.getRefreshLogs();

  const status = {
    cleanupManager: {
      lastCleanupTime: cleanupReport?.timestamp || 0,
      lastCleanupSuccess: cleanupReport?.success || false,
      isCleaningUp: refreshCleanupManager.isCleaningUp(),
    },
    refreshExecutor: {
      isRefreshing: refreshState.isRefreshing,
      currentStrategy: refreshState.currentStrategy,
      attemptCount: refreshState.attemptCount,
      maxAttempts: refreshState.maxAttempts,
      hasTimedOut: refreshState.hasTimedOut,
      logsCount: refreshLogs.length,
      recentLogs: refreshLogs.slice(-5),
    },
  };

  console.log('📊 刷新系统状态:', status);
  return status;
}

/**
 * 添加性能监控
 * 记录清理和刷新的耗时
 */
export function monitorRefreshPerformance(): void {
  console.log('📊 开始监控刷新性能...');

  // 监控清理性能
  const originalExecuteCleanup = refreshCleanupManager.executeCleanup.bind(
    refreshCleanupManager
  );
  refreshCleanupManager.executeCleanup = function () {
    const startTime = performance.now();
    const result = originalExecuteCleanup();
    const duration = performance.now() - startTime;

    console.log(`⏱️ 清理耗时: ${duration.toFixed(2)}ms`, {
      timersStopped: result.timersStopped,
      listenersRemoved: result.listenersRemoved,
      requestsCancelled: result.requestsCancelled,
      hlsInstancesDestroyed: result.hlsInstancesDestroyed,
    });

    // 性能警告
    if (duration > 50) {
      console.warn(`⚠️ 清理耗时超过50ms: ${duration.toFixed(2)}ms`);
    }

    return result;
  };

  console.log('✅ 性能监控已启用');
}

/**
 * 在开发模式下自动启用调试功能
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // 添加全局测试函数
  (window as any).testFatalError = testFatalErrorDisplay;
  (window as any).testRefreshDeadlock = testRefreshDeadlock;
  (window as any).getRefreshSystemStatus = getRefreshSystemStatus;
  (window as any).monitorRefreshPerformance = monitorRefreshPerformance;

  console.log('🔧 开发模式：刷新调试功能已启用');
  console.log('💡 可用的调试函数:');
  console.log('  - window.testFatalError() - 测试致命错误弹窗');
  console.log('  - window.testRefreshDeadlock() - 测试刷新卡死场景');
  console.log('  - window.getRefreshSystemStatus() - 获取刷新系统状态');
  console.log('  - window.monitorRefreshPerformance() - 启用性能监控');
}
