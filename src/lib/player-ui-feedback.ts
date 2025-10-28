/**
 * 播放器用户界面反馈
 * 提供加载指示器、通知和错误页面
 */

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
 * 显示致命错误页面
 */
export function showFatalError(config: {
  title: string;
  message: string;
  suggestion: string;
  error?: Error;
  onRefresh?: () => void;
  onBack?: () => void;
}): void {
  const errorPage = document.createElement('div');
  errorPage.className = 'player-fatal-error';
  errorPage.innerHTML = `
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h2 class="error-title">${config.title}</h2>
      <p class="error-message">${config.message}</p>
      <p class="error-suggestion">${config.suggestion}</p>
      <div class="error-actions">
        <button class="error-btn error-btn-primary" id="error-refresh-btn">刷新页面</button>
        <button class="error-btn error-btn-secondary" id="error-back-btn">返回</button>
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

  // 绑定事件
  const refreshBtn = document.getElementById('error-refresh-btn');
  const backBtn = document.getElementById('error-back-btn');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (config.onRefresh) {
        config.onRefresh();
      } else {
        window.location.reload();
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
