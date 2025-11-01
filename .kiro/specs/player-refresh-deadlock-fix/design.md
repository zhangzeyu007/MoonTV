# Design Document

## Overview

本设计文档描述了播放器强制刷新卡死问题的修复方案。通过分析现有代码，我们发现问题的根源在于：

1. **事件监听器未清理**：页面存在大量全局事件监听器（error、unhandledrejection、visibilitychange 等），在刷新时未被正确清理
2. **定时器未停止**：网络监控、性能监控、播放进度保存等多个定时器在刷新时仍在运行
3. **异步操作未取消**：正在进行的网络请求和 Promise 可能阻塞页面卸载
4. **缺少超时保护**：刷新操作没有超时机制，一旦卡住就永久无响应
5. **HLS 实例未销毁**：HLS.js 实例可能持有资源引用，阻止页面正常卸载

## Architecture

### 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    Fatal Error Dialog                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Refresh Button (Enhanced)                            │  │
│  │  - Immediate cleanup trigger                          │  │
│  │  - Timeout protection                                 │  │
│  │  - Fallback strategies                                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Refresh Cleanup Manager (New)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Stop all timers and intervals                     │  │
│  │  2. Remove all event listeners                        │  │
│  │  3. Cancel pending network requests                   │  │
│  │  4. Destroy HLS instances                             │  │
│  │  5. Clear all references                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Refresh Executor (Enhanced)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Strategy 1: window.location.reload()                 │  │
│  │  Strategy 2: window.location.href = current URL       │  │
│  │  Strategy 3: Force navigation with replace            │  │
│  │  Timeout: 3 seconds per strategy                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

```
User Click Refresh Button
    │
    ▼
Log click event + timestamp
    │
    ▼
Disable button + Show loading state
    │
    ▼
Execute cleanup sequence
    │
    ├─> Stop all timers
    ├─> Remove event listeners
    ├─> Cancel network requests
    ├─> Destroy HLS instances
    └─> Clear references
    │
    ▼
Start refresh with timeout (3s)
    │
    ├─> Success: Page reloads
    │
    └─> Timeout: Try fallback strategy
        │
        ├─> Fallback 1: location.href
        │
        └─> Fallback 2: Show manual refresh prompt
```

## Components and Interfaces

### 1. RefreshCleanupManager

新增的清理管理器，负责在刷新前清理所有可能阻塞的资源。

```typescript
interface RefreshCleanupManager {
  /**
   * 执行完整的清理流程
   */
  executeCleanup(): void;

  /**
   * 停止所有定时器
   */
  stopAllTimers(): void;

  /**
   * 移除所有事件监听器
   */
  removeAllEventListeners(): void;

  /**
   * 取消所有网络请求
   */
  cancelAllRequests(): void;

  /**
   * 销毁HLS实例
   */
  destroyHlsInstances(): void;

  /**
   * 清理全局引用
   */
  clearGlobalReferences(): void;

  /**
   * 获取清理状态报告
   */
  getCleanupReport(): CleanupReport;
}

interface CleanupReport {
  timersStopped: number;
  listenersRemoved: number;
  requestsCancelled: number;
  hlsInstancesDestroyed: number;
  timestamp: number;
  success: boolean;
}
```

### 2. RefreshExecutor (Enhanced)

增强的刷新执行器，支持多种刷新策略和超时保护。

```typescript
interface RefreshExecutor {
  /**
   * 执行刷新操作（带超时保护）
   */
  executeRefresh(options?: RefreshOptions): Promise<void>;

  /**
   * 策略1：标准刷新
   */
  standardRefresh(): void;

  /**
   * 策略2：强制刷新
   */
  forceRefresh(): void;

  /**
   * 策略3：导航刷新
   */
  navigationRefresh(): void;

  /**
   * 显示手动刷新提示
   */
  showManualRefreshPrompt(): void;
}

interface RefreshOptions {
  timeout?: number; // 默认3000ms
  strategy?: 'standard' | 'force' | 'navigation';
  showLoadingState?: boolean; // 默认true
  logDetails?: boolean; // 默认true
}
```

### 3. Enhanced Fatal Error Dialog

增强的致命错误弹窗，集成清理和刷新逻辑。

```typescript
interface EnhancedFatalErrorConfig {
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
  onCleanupComplete?: (report: CleanupReport) => void;
  onRefreshTimeout?: () => void;
}
```

## Data Models

### CleanupState

```typescript
interface CleanupState {
  // 定时器追踪
  timers: Set<NodeJS.Timeout>;
  intervals: Set<NodeJS.Timeout>;

  // 事件监听器追踪
  eventListeners: Map<string, EventListenerInfo[]>;

  // 网络请求追踪
  pendingRequests: Set<AbortController>;

  // HLS实例追踪
  hlsInstances: Set<any>;

  // 清理状态
  isCleanupInProgress: boolean;
  lastCleanupTime: number;
}

interface EventListenerInfo {
  target: EventTarget;
  type: string;
  listener: EventListener;
  options?: AddEventListenerOptions;
}
```

### RefreshState

```typescript
interface RefreshState {
  // 刷新状态
  isRefreshing: boolean;
  refreshStartTime: number;
  currentStrategy: 'standard' | 'force' | 'navigation' | null;

  // 超时控制
  timeoutId: NodeJS.Timeout | null;
  hasTimedOut: boolean;

  // 尝试次数
  attemptCount: number;
  maxAttempts: number;

  // 日志
  logs: RefreshLog[];
}

interface RefreshLog {
  timestamp: number;
  action: string;
  status: 'pending' | 'success' | 'failed';
  details?: string;
}
```

## Error Handling

### 错误分类

1. **Cleanup Errors**: 清理过程中的错误

   - 处理：记录日志，继续执行后续清理步骤
   - 不阻塞刷新流程

2. **Refresh Timeout**: 刷新超时

   - 处理：尝试备用刷新策略
   - 最多尝试 3 种策略

3. **All Strategies Failed**: 所有刷新策略失败
   - 处理：显示手动刷新提示
   - 提供详细的错误信息和操作指南

### 错误恢复流程

```
Cleanup Error
    │
    ├─> Log error
    ├─> Continue next cleanup step
    └─> Proceed to refresh

Refresh Timeout (Strategy 1)
    │
    ├─> Log timeout
    ├─> Try Strategy 2
    └─> Set new timeout

Refresh Timeout (Strategy 2)
    │
    ├─> Log timeout
    ├─> Try Strategy 3
    └─> Set new timeout

All Strategies Failed
    │
    ├─> Log all failures
    ├─> Show manual refresh prompt
    └─> Provide keyboard shortcut hint (Ctrl+R / Cmd+R)
```

## Implementation Details

### 1. 清理管理器实现

```typescript
// src/lib/refresh-cleanup-manager.ts

class RefreshCleanupManager {
  private state: CleanupState;

  constructor() {
    this.state = {
      timers: new Set(),
      intervals: new Set(),
      eventListeners: new Map(),
      pendingRequests: new Set(),
      hlsInstances: new Set(),
      isCleanupInProgress: false,
      lastCleanupTime: 0,
    };
  }

  executeCleanup(): CleanupReport {
    const startTime = performance.now();
    this.state.isCleanupInProgress = true;

    const report: CleanupReport = {
      timersStopped: 0,
      listenersRemoved: 0,
      requestsCancelled: 0,
      hlsInstancesDestroyed: 0,
      timestamp: Date.now(),
      success: false,
    };

    try {
      // 1. 停止所有定时器
      report.timersStopped = this.stopAllTimers();

      // 2. 移除所有事件监听器
      report.listenersRemoved = this.removeAllEventListeners();

      // 3. 取消所有网络请求
      report.requestsCancelled = this.cancelAllRequests();

      // 4. 销毁HLS实例
      report.hlsInstancesDestroyed = this.destroyHlsInstances();

      // 5. 清理全局引用
      this.clearGlobalReferences();

      report.success = true;
      this.state.lastCleanupTime = Date.now();

      console.log('✅ 清理完成:', report);
    } catch (error) {
      console.error('❌ 清理过程出错:', error);
      report.success = false;
    } finally {
      this.state.isCleanupInProgress = false;
    }

    return report;
  }

  private stopAllTimers(): number {
    let count = 0;

    // 清理已追踪的定时器
    this.state.timers.forEach((timer) => {
      clearTimeout(timer);
      count++;
    });
    this.state.timers.clear();

    this.state.intervals.forEach((interval) => {
      clearInterval(interval);
      count++;
    });
    this.state.intervals.clear();

    // 清理已知的定时器引用
    const timerRefs = [
      'notificationDebounceRef',
      'errorDebounceRef',
      'saveProgressDebounceRef',
      'saveIntervalRef',
      'playbackRecoveryRef',
      'rebuildTimeoutRef',
      'networkQualityIntervalRef',
      'networkMonitorIntervalRef',
    ];

    timerRefs.forEach((refName) => {
      try {
        const ref = (window as any)[refName];
        if (ref?.current) {
          clearTimeout(ref.current);
          clearInterval(ref.current);
          ref.current = null;
          count++;
        }
      } catch (e) {
        // 忽略错误
      }
    });

    return count;
  }

  private removeAllEventListeners(): number {
    let count = 0;

    // 移除已追踪的事件监听器
    this.state.eventListeners.forEach((listeners, eventType) => {
      listeners.forEach((info) => {
        try {
          info.target.removeEventListener(
            info.type,
            info.listener,
            info.options
          );
          count++;
        } catch (e) {
          // 忽略错误
        }
      });
    });
    this.state.eventListeners.clear();

    // 移除已知的全局事件监听器
    const globalEvents = [
      'error',
      'unhandledrejection',
      'online',
      'offline',
      'visibilitychange',
      'pagehide',
      'keydown',
    ];

    globalEvents.forEach((eventType) => {
      try {
        // 克隆节点以移除所有监听器
        const target = eventType === 'visibilitychange' ? document : window;
        // 注意：这种方法会移除所有监听器，包括其他代码添加的
        // 更安全的方法是追踪我们自己添加的监听器
      } catch (e) {
        // 忽略错误
      }
    });

    return count;
  }

  private cancelAllRequests(): number {
    let count = 0;

    this.state.pendingRequests.forEach((controller) => {
      try {
        controller.abort();
        count++;
      } catch (e) {
        // 忽略错误
      }
    });
    this.state.pendingRequests.clear();

    return count;
  }

  private destroyHlsInstances(): number {
    let count = 0;

    this.state.hlsInstances.forEach((hls) => {
      try {
        if (hls && typeof hls.destroy === 'function') {
          hls.stopLoad();
          hls.detachMedia();
          hls.destroy();
          count++;
        }
      } catch (e) {
        // 忽略错误
      }
    });
    this.state.hlsInstances.clear();

    // 清理播放器中的HLS实例
    try {
      const player = (window as any).artPlayerInstance;
      if (player?.video?.hls) {
        player.video.hls.stopLoad();
        player.video.hls.detachMedia();
        player.video.hls.destroy();
        player.video.hls = null;
        count++;
      }
    } catch (e) {
      // 忽略错误
    }

    return count;
  }

  private clearGlobalReferences(): void {
    try {
      // 清理全局播放器引用
      if (typeof window !== 'undefined') {
        (window as any).artPlayerInstance = null;
        (window as any).testFatalError = null;
      }
    } catch (e) {
      // 忽略错误
    }
  }
}
```

### 2. 刷新执行器实现

```typescript
// src/lib/refresh-executor.ts

class RefreshExecutor {
  private state: RefreshState;
  private cleanupManager: RefreshCleanupManager;

  constructor(cleanupManager: RefreshCleanupManager) {
    this.cleanupManager = cleanupManager;
    this.state = {
      isRefreshing: false,
      refreshStartTime: 0,
      currentStrategy: null,
      timeoutId: null,
      hasTimedOut: false,
      attemptCount: 0,
      maxAttempts: 3,
      logs: [],
    };
  }

  async executeRefresh(options: RefreshOptions = {}): Promise<void> {
    const {
      timeout = 3000,
      strategy = 'standard',
      showLoadingState = true,
      logDetails = true,
    } = options;

    if (this.state.isRefreshing) {
      console.warn('刷新操作已在进行中');
      return;
    }

    this.state.isRefreshing = true;
    this.state.refreshStartTime = Date.now();
    this.state.attemptCount++;

    this.log(
      '开始刷新操作',
      'pending',
      `策略: ${strategy}, 超时: ${timeout}ms`
    );

    try {
      // 1. 执行清理
      if (logDetails) {
        console.log('🧹 执行清理...');
      }
      const cleanupReport = this.cleanupManager.executeCleanup();

      if (logDetails) {
        console.log('✅ 清理完成:', cleanupReport);
      }

      // 2. 显示加载状态
      if (showLoadingState) {
        this.showRefreshingState();
      }

      // 3. 设置超时保护
      this.state.timeoutId = setTimeout(() => {
        this.handleRefreshTimeout(strategy);
      }, timeout);

      // 4. 执行刷新策略
      this.log('执行刷新策略', 'pending', strategy);

      switch (strategy) {
        case 'standard':
          this.standardRefresh();
          break;
        case 'force':
          this.forceRefresh();
          break;
        case 'navigation':
          this.navigationRefresh();
          break;
      }

      // 如果代码执行到这里，说明刷新成功
      this.log('刷新成功', 'success');
    } catch (error) {
      this.log('刷新失败', 'failed', String(error));
      console.error('❌ 刷新失败:', error);

      // 尝试下一个策略
      if (this.state.attemptCount < this.state.maxAttempts) {
        const nextStrategy = this.getNextStrategy(strategy);
        console.log(`尝试备用策略: ${nextStrategy}`);
        await this.executeRefresh({ ...options, strategy: nextStrategy });
      } else {
        // 所有策略都失败了
        this.showManualRefreshPrompt();
      }
    }
  }

  private standardRefresh(): void {
    console.log('🔄 执行标准刷新: window.location.reload()');
    this.state.currentStrategy = 'standard';
    window.location.reload();
  }

  private forceRefresh(): void {
    console.log('🔄 执行强制刷新: window.location.href');
    this.state.currentStrategy = 'force';
    window.location.href = window.location.href;
  }

  private navigationRefresh(): void {
    console.log('🔄 执行导航刷新: window.location.replace()');
    this.state.currentStrategy = 'navigation';
    window.location.replace(window.location.href);
  }

  private handleRefreshTimeout(currentStrategy: string): void {
    this.state.hasTimedOut = true;
    this.log('刷新超时', 'failed', `策略: ${currentStrategy}`);

    console.warn(`⏱️ 刷新超时 (策略: ${currentStrategy})`);

    // 清除超时定时器
    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
      this.state.timeoutId = null;
    }

    // 尝试下一个策略
    if (this.state.attemptCount < this.state.maxAttempts) {
      const nextStrategy = this.getNextStrategy(currentStrategy);
      console.log(`尝试备用策略: ${nextStrategy}`);
      this.executeRefresh({ strategy: nextStrategy as any });
    } else {
      this.showManualRefreshPrompt();
    }
  }

  private getNextStrategy(current: string): string {
    const strategies = ['standard', 'force', 'navigation'];
    const currentIndex = strategies.indexOf(current);
    return strategies[(currentIndex + 1) % strategies.length];
  }

  private showRefreshingState(): void {
    // 更新按钮状态
    const refreshBtn = document.getElementById('error-refresh-btn');
    if (refreshBtn) {
      refreshBtn.textContent = '正在刷新...';
      refreshBtn.setAttribute('disabled', 'true');
      refreshBtn.style.opacity = '0.6';
      refreshBtn.style.cursor = 'not-allowed';
    }
  }

  private showManualRefreshPrompt(): void {
    console.error('❌ 所有刷新策略均失败');

    // 更新错误提示
    const errorMessage = document.querySelector('.error-message');
    if (errorMessage) {
      errorMessage.textContent = '自动刷新失败，请手动刷新浏览器';
    }

    const errorSuggestion = document.querySelector('.error-suggestion');
    if (errorSuggestion) {
      errorSuggestion.innerHTML = `
        请使用以下方式手动刷新：<br>
        • Windows/Linux: 按 Ctrl + R 或 F5<br>
        • Mac: 按 Cmd + R<br>
        • 或点击浏览器的刷新按钮
      `;
    }

    // 恢复按钮状态，允许用户再次尝试
    const refreshBtn = document.getElementById('error-refresh-btn');
    if (refreshBtn) {
      refreshBtn.textContent = '重试刷新';
      refreshBtn.removeAttribute('disabled');
      refreshBtn.style.opacity = '1';
      refreshBtn.style.cursor = 'pointer';
    }
  }

  private log(
    action: string,
    status: RefreshLog['status'],
    details?: string
  ): void {
    const log: RefreshLog = {
      timestamp: Date.now(),
      action,
      status,
      details,
    };
    this.state.logs.push(log);

    console.log(`[Refresh] ${action} - ${status}`, details || '');
  }
}
```

### 3. 增强的致命错误弹窗

修改 `src/lib/player-ui-feedback.ts` 中的 `showFatalError` 函数：

```typescript
export function showFatalError(config: EnhancedFatalErrorConfig): void {
  const {
    enableCleanup = true,
    refreshTimeout = 3000,
    showFallbackButton = true,
  } = config;

  // 创建清理管理器和刷新执行器
  const cleanupManager = new RefreshCleanupManager();
  const refreshExecutor = new RefreshExecutor(cleanupManager);

  // ... 现有的DOM创建代码 ...

  // 增强的刷新按钮事件处理
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      console.log('🔄 用户点击刷新按钮', {
        timestamp: Date.now(),
        enableCleanup,
        refreshTimeout,
      });

      if (config.onRefresh) {
        config.onRefresh();
      } else {
        // 使用增强的刷新执行器
        await refreshExecutor.executeRefresh({
          timeout: refreshTimeout,
          strategy: 'standard',
          showLoadingState: true,
          logDetails: true,
        });
      }
    });
  }

  // 添加强制刷新按钮（备用选项）
  if (showFallbackButton) {
    const forceRefreshBtn = document.createElement('button');
    forceRefreshBtn.className = 'error-btn error-btn-warning';
    forceRefreshBtn.id = 'error-force-refresh-btn';
    forceRefreshBtn.textContent = '强制刷新';
    forceRefreshBtn.title = '使用更激进的刷新策略';

    const actions = errorPage.querySelector('.error-actions');
    if (actions) {
      actions.appendChild(forceRefreshBtn);
    }

    forceRefreshBtn.addEventListener('click', async () => {
      console.log('🔄 用户点击强制刷新按钮');
      await refreshExecutor.executeRefresh({
        timeout: 2000,
        strategy: 'force',
        showLoadingState: true,
        logDetails: true,
      });
    });
  }
}
```

## Testing Strategy

### 单元测试

1. **RefreshCleanupManager 测试**

   - 测试各个清理方法是否正确执行
   - 测试清理报告的准确性
   - 测试错误处理

2. **RefreshExecutor 测试**
   - 测试各种刷新策略
   - 测试超时机制
   - 测试策略切换逻辑
   - 测试日志记录

### 集成测试

1. **完整刷新流程测试**

   - 模拟用户点击刷新按钮
   - 验证清理流程执行
   - 验证刷新操作触发

2. **超时场景测试**
   - 模拟刷新超时
   - 验证备用策略触发
   - 验证手动刷新提示显示

### 手动测试

1. **正常刷新测试**

   - 触发致命错误弹窗
   - 点击刷新按钮
   - 验证页面正常刷新

2. **卡死场景测试**

   - 在刷新前添加阻塞代码
   - 验证超时保护生效
   - 验证备用策略执行

3. **多次点击测试**
   - 快速多次点击刷新按钮
   - 验证防重复点击机制
   - 验证按钮状态更新

## Performance Considerations

1. **清理性能**

   - 清理操作应在 50ms 内完成
   - 避免阻塞主线程
   - 使用异步清理（如果可能）

2. **刷新响应时间**

   - 按钮点击到视觉反馈：< 100ms
   - 清理到刷新触发：< 200ms
   - 总体刷新时间：< 500ms（正常情况）

3. **内存管理**
   - 及时清理追踪的引用
   - 避免内存泄漏
   - 限制日志数量

## Security Considerations

1. **XSS 防护**

   - 错误信息需要转义
   - 避免执行用户输入的代码

2. **资源清理**

   - 确保敏感数据被清除
   - 避免泄露用户信息

3. **日志安全**
   - 不记录敏感信息
   - 限制日志详细程度（生产环境）
