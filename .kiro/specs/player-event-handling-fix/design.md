# 设计文档

## 概述

本设计文档描述了如何修复视频播放器中的事件处理错误，特别是频繁点击导致的 `composedPath` 错误。解决方案采用多层防御策略，包括事件对象验证、polyfill 实现、防抖节流机制、错误边界和优雅降级。此外，当播放器发生严重错误影响正常播放时，系统将自动重建播放器实例并恢复播放状态，确保用户无缝的观看体验。

## 架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户交互层                              │
│              (点击、触摸、键盘等事件)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  事件拦截与验证层                            │
│  • 事件对象验证                                              │
│  • composedPath Polyfill                                    │
│  • 事件规范化                                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  防抖与节流层                                │
│  • 点击事件防抖 (200ms)                                      │
│  • timeupdate 节流 (500ms)                                  │
│  • 高频事件 RAF 优化                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  错误边界层                                  │
│  • Try-Catch 包装                                           │
│  • 错误分类与恢复                                            │
│  • 错误频率跟踪                                              │
│  • 严重错误检测                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              播放器健康监控层                                │
│  • 播放状态监控                                              │
│  • 错误严重程度评估                                          │
│  • 自动恢复决策                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              播放器实例管理层                                │
│  • 播放状态捕获与恢复                                        │
│  • 实例销毁与重建                                            │
│  • 自动播放恢复                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  播放器核心层                                │
│              (Artplayer 实例)                               │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计决策

1. **分层防御**: 采用多层防御策略，每一层都能独立处理特定类型的问题
2. **优雅降级**: 当某个功能不可用时，提供备用方案而不是崩溃
3. **性能优先**: 使用防抖、节流和 RAF 确保高性能
4. **浏览器兼容**: 针对不同浏览器提供特定的 polyfill 和处理逻辑
5. **自动恢复**: 当检测到严重错误时，自动重建播放器实例并恢复播放状态
6. **状态保持**: 在重建过程中保持所有播放状态（时间、音量、速率等）
7. **用户体验优先**: 重建过程对用户透明，显示加载指示器并自动恢复播放

## 组件和接口

### 1. EventValidator (事件验证器)

**职责**: 验证事件对象的完整性和有效性

```typescript
interface EventValidator {
  // 验证事件对象是否有效
  isValidEvent(event: any): boolean;

  // 确保事件对象具有必要的属性
  ensureEventProperties(event: any): Event;

  // 检查是否需要 polyfill
  needsPolyfill(event: any): boolean;
}
```

**实现要点**:

- 检查事件对象是否为 null 或 undefined
- 验证事件对象是否具有基本属性（type, target, currentTarget）
- 检测 composedPath 方法是否存在

### 2. ComposedPathPolyfill (composedPath 补丁)

**职责**: 为不支持 composedPath 的浏览器提供兼容实现

```typescript
interface ComposedPathPolyfill {
  // 为事件对象添加 composedPath 方法
  applyPolyfill(event: Event): void;

  // 手动构建事件传播路径
  buildEventPath(target: EventTarget | null): EventTarget[];

  // 检测浏览器是否支持 composedPath
  isSupported(): boolean;
}
```

**实现要点**:

- 优先使用原生 event.composedPath()
- 降级到 event.path（非标准但某些浏览器支持）
- 最终降级到手动 DOM 遍历
- 防止循环引用和无限遍历
- 添加安全检查防止访问受限节点

### 3. EventDebouncer (事件防抖器)

**职责**: 对频繁触发的事件进行防抖处理

```typescript
interface EventDebouncer {
  // 创建防抖函数
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void;

  // 取消待执行的防抖函数
  cancel(): void;

  // 立即执行防抖函数
  flush(): void;
}
```

**实现要点**:

- 使用 setTimeout 实现基本防抖
- 提供 leading 和 trailing 选项
- 支持取消和立即执行
- 清理定时器防止内存泄漏

### 4. EventThrottler (事件节流器)

**职责**: 限制事件处理器的执行频率

```typescript
interface EventThrottler {
  // 创建节流函数
  throttle<T extends (...args: any[]) => any>(
    func: T,
    interval: number
  ): (...args: Parameters<T>) => void;

  // 使用 RAF 的节流（用于动画相关事件）
  throttleRAF<T extends (...args: any[]) => any>(
    func: T
  ): (...args: Parameters<T>) => void;
}
```

**实现要点**:

- 基于时间戳的节流实现
- 对于 mousemove、touchmove 等使用 requestAnimationFrame
- 确保最后一次调用总是被执行
- 支持取消待执行的节流函数

### 5. ErrorBoundary (错误边界)

**职责**: 捕获和处理事件处理过程中的错误

```typescript
interface ErrorBoundary {
  // 包装事件处理器
  wrapHandler<T extends (...args: any[]) => any>(
    handler: T,
    context?: string
  ): T;

  // 处理错误
  handleError(error: Error, context: string): void;

  // 判断错误是否可恢复
  isRecoverableError(error: Error): boolean;

  // 重置错误状态
  reset(): void;
}
```

**实现要点**:

- 使用 try-catch 包装所有事件处理器
- 区分可恢复和不可恢复错误
- 跟踪错误频率和类型
- 实施指数退避策略
- 提供用户友好的错误提示

### 6. EventHandlerManager (事件处理器管理器)

**职责**: 统一管理所有事件处理器的注册和清理

```typescript
interface EventHandlerManager {
  // 注册事件处理器
  register(
    element: EventTarget,
    eventType: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void;

  // 注销事件处理器
  unregister(
    element: EventTarget,
    eventType: string,
    handler: EventListener
  ): void;

  // 清理所有事件处理器
  cleanup(): void;

  // 重置所有事件处理器
  reset(): void;
}
```

**实现要点**:

- 维护事件处理器注册表
- 自动应用验证、防抖、节流和错误边界
- 支持批量清理
- 防止重复注册

### 7. PlayerHealthMonitor (播放器健康监控器)

**职责**: 监控播放器健康状态并决定是否需要重建

```typescript
interface PlayerHealthMonitor {
  // 监控播放器健康状态
  monitorPlayerHealth(player: any): void;

  // 检查播放器是否健康
  isPlayerHealthy(player: any): boolean;

  // 评估错误严重程度
  assessErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical';

  // 判断是否需要重建播放器
  shouldRebuildPlayer(): boolean;

  // 重置健康状态
  resetHealthStatus(): void;
}
```

**实现要点**:

- 跟踪播放器错误频率和类型
- 监控播放器关键功能（播放、暂停、seek 等）
- 检测播放器卡死或无响应状态
- 根据错误严重程度和频率决定是否重建
- 防止频繁重建（最小间隔 2 秒）

### 8. PlayerStateManager (播放器状态管理器)

**职责**: 捕获和恢复播放器状态

```typescript
interface PlayerState {
  videoUrl: string;
  currentTime: number;
  volume: number;
  playbackRate: number;
  muted: boolean;
  paused: boolean;
  subtitles?: {
    enabled: boolean;
    track?: number;
  };
  quality?: string;
  // 其他播放器配置
}

interface PlayerStateManager {
  // 捕获当前播放器状态
  captureState(player: any): PlayerState;

  // 恢复播放器状态
  restoreState(player: any, state: PlayerState): Promise<void>;

  // 保存状态到存储
  saveState(state: PlayerState): void;

  // 从存储加载状态
  loadState(): PlayerState | null;

  // 清除保存的状态
  clearState(): void;
}
```

**实现要点**:

- 捕获所有关键播放状态
- 支持异步状态恢复
- 处理状态恢复失败的情况
- 可选的持久化存储（localStorage）
- 验证状态有效性

### 9. PlayerRecoveryManager (播放器恢复管理器)

**职责**: 协调播放器的销毁、重建和状态恢复

```typescript
interface PlayerRecoveryManager {
  // 执行播放器重建
  rebuildPlayer(
    player: any,
    container: HTMLElement,
    options: any
  ): Promise<any>;

  // 销毁播放器实例
  destroyPlayer(player: any): Promise<void>;

  // 创建新播放器实例
  createPlayer(container: HTMLElement, options: any): Promise<any>;

  // 完整的恢复流程
  recoverPlayer(
    player: any,
    container: HTMLElement,
    options: any
  ): Promise<any>;

  // 检查是否正在重建
  isRebuilding(): boolean;

  // 获取重建尝试次数
  getRebuildAttempts(): number;

  // 重置重建计数
  resetRebuildAttempts(): void;
}
```

**实现要点**:

- 完整的播放器生命周期管理
- 状态捕获 → 销毁 → 重建 → 状态恢复的完整流程
- 支持最多 3 次重建尝试
- 指数退避重试策略（2 秒、5 秒、10 秒）
- 防止并发重建
- 显示加载指示器
- 自动恢复播放
- 错误处理和回退机制

## 数据模型

### EventHandlerConfig (事件处理器配置)

```typescript
interface EventHandlerConfig {
  // 事件类型
  eventType: string;

  // 是否需要防抖
  debounce?: {
    enabled: boolean;
    delay: number;
    leading?: boolean;
    trailing?: boolean;
  };

  // 是否需要节流
  throttle?: {
    enabled: boolean;
    interval: number;
    useRAF?: boolean;
  };

  // 错误处理配置
  errorHandling?: {
    recoverable: boolean;
    maxRetries: number;
    retryDelay: number;
  };

  // 是否需要 composedPath polyfill
  needsPolyfill: boolean;
}
```

### ErrorRecord (错误记录)

```typescript
interface ErrorRecord {
  // 错误类型
  type: string;

  // 错误消息
  message: string;

  // 堆栈跟踪
  stack?: string;

  // 发生时间
  timestamp: number;

  // 事件上下文
  context: string;

  // 是否可恢复
  recoverable: boolean;

  // 重试次数
  retryCount: number;
}
```

### EventMetrics (事件指标)

```typescript
interface EventMetrics {
  // 事件类型
  eventType: string;

  // 触发次数
  triggerCount: number;

  // 实际执行次数（防抖/节流后）
  executionCount: number;

  // 平均响应时间
  averageResponseTime: number;

  // 错误次数
  errorCount: number;

  // 最后触发时间
  lastTriggerTime: number;
}
```

### PlayerHealthStatus (播放器健康状态)

```typescript
interface PlayerHealthStatus {
  // 是否健康
  isHealthy: boolean;

  // 错误计数
  errorCount: number;

  // 严重错误计数
  criticalErrorCount: number;

  // 最后一次错误时间
  lastErrorTime: number;

  // 连续错误次数
  consecutiveErrors: number;

  // 播放器是否响应
  isResponsive: boolean;

  // 最后一次健康检查时间
  lastHealthCheckTime: number;

  // 是否需要重建
  needsRebuild: boolean;

  // 重建原因
  rebuildReason?: string;
}
```

### PlayerRebuildConfig (播放器重建配置)

```typescript
interface PlayerRebuildConfig {
  // 最大重建尝试次数
  maxAttempts: number;

  // 重建延迟（毫秒）
  rebuildDelay: number;

  // 是否使用指数退避
  useExponentialBackoff: boolean;

  // 是否显示加载指示器
  showLoadingIndicator: boolean;

  // 是否自动恢复播放
  autoResume: boolean;

  // 重建超时时间（毫秒）
  rebuildTimeout: number;

  // 是否保存状态到存储
  persistState: boolean;
}
```

## 错误处理

### 错误分类

1. **可恢复错误（轻度）**:

   - composedPath 相关错误
   - 事件对象属性访问错误
   - 临时性网络错误
   - 单次播放失败

2. **需要重置的错误（中度）**:

   - 连续 3 次以上的事件处理错误
   - HLS 加载错误（可重试）
   - 播放器控制失效

3. **需要重建的错误（严重）**:

   - 播放器实例损坏
   - 关键功能完全失效（无法播放、暂停、seek）
   - 连续 5 次以上的播放失败
   - 播放器卡死超过 10 秒
   - 媒体解码严重错误

4. **不可恢复错误（致命）**:
   - 关键 DOM 元素缺失且无法重建
   - 浏览器不支持必要的 API
   - 内存耗尽
   - 3 次重建尝试全部失败

### 错误恢复策略

```typescript
// 轻度错误恢复流程
if (isComposedPathError(error)) {
  // 1. 应用 polyfill
  applyComposedPathPolyfill(event);

  // 2. 重试事件处理
  retryEventHandling(event);

  // 3. 如果仍然失败，使用降级方案
  if (stillFailing) {
    useFallbackEventHandling(event);
  }
}

// 中度错误 - 重置事件监听器
if (consecutiveErrors >= 3 && consecutiveErrors < 5) {
  // 1. 重置事件监听器
  resetEventListeners();

  // 2. 清理错误状态
  clearErrorState();

  // 3. 通知用户
  notifyUser('播放器已自动恢复');
}

// 严重错误 - 重建播放器
if (shouldRebuildPlayer(error, healthStatus)) {
  // 1. 显示加载指示器
  showLoadingIndicator('正在修复播放器...');

  // 2. 捕获当前播放状态
  const savedState = capturePlayerState(player);

  // 3. 销毁旧播放器实例
  await destroyPlayer(player);

  // 4. 清理所有事件监听器和资源
  cleanupAllResources();

  // 5. 等待短暂延迟（避免立即重建）
  await delay(2000);

  // 6. 创建新播放器实例
  const newPlayer = await createPlayer(container, options);

  // 7. 恢复播放状态
  await restorePlayerState(newPlayer, savedState);

  // 8. 自动恢复播放
  if (savedState.paused === false) {
    await newPlayer.play();
  }

  // 9. 隐藏加载指示器
  hideLoadingIndicator();

  // 10. 通知用户
  notifyUser('播放器已自动修复');

  // 11. 重置健康状态
  resetHealthStatus();
}

// 致命错误 - 显示错误页面
if (isFatalError(error) || rebuildAttempts >= 3) {
  // 1. 记录详细错误信息
  logDetailedError(error);

  // 2. 显示用户友好的错误消息（全屏覆盖）
  showUserFriendlyError({
    title: '播放器无法恢复',
    message: '很抱歉，播放器遇到了严重问题',
    suggestion: '请尝试刷新页面或更换浏览器',
    actions: [
      { label: '刷新页面', action: () => window.location.reload() },
      { label: '返回首页', action: () => router.push('/') },
    ],
  });

  // 3. 停止所有恢复尝试
  stopRecoveryAttempts();

  // 4. 确保错误弹窗显示（关键）
  // 注意：在调用 recoverPlayer 的地方，不要用 try-catch 吞掉错误
  // 或者在 catch 块中重新显示错误弹窗
}
```

### 指数退避实现

```typescript
function calculateBackoffDelay(retryCount: number): number {
  const baseDelay = 1000; // 1秒
  const maxDelay = 30000; // 30秒
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

  // 添加随机抖动避免雷鸣群效应
  const jitter = Math.random() * 0.3 * delay;
  return delay + jitter;
}
```

### 播放器重建流程

```typescript
async function rebuildPlayerFlow(
  player: any,
  container: HTMLElement,
  options: any,
  attemptNumber: number = 1
): Promise<any> {
  try {
    console.log(`开始第 ${attemptNumber} 次播放器重建...`);

    // 1. 检查是否超过最大尝试次数
    if (attemptNumber > 3) {
      throw new Error('超过最大重建尝试次数');
    }

    // 2. 显示加载指示器
    showLoadingIndicator(`正在修复播放器 (${attemptNumber}/3)...`);

    // 3. 捕获播放状态
    const savedState = playerStateManager.captureState(player);
    console.log('已捕获播放状态:', savedState);

    // 4. 销毁旧实例
    await playerRecoveryManager.destroyPlayer(player);
    console.log('已销毁旧播放器实例');

    // 5. 清理所有资源
    cleanupPlayerEvents();
    console.log('已清理事件监听器');

    // 6. 等待延迟（指数退避）
    const delay = calculateRebuildDelay(attemptNumber);
    await sleep(delay);

    // 7. 创建新实例
    const newPlayer = await playerRecoveryManager.createPlayer(
      container,
      options
    );
    console.log('已创建新播放器实例');

    // 8. 恢复状态
    await playerStateManager.restoreState(newPlayer, savedState);
    console.log('已恢复播放状态');

    // 9. 自动恢复播放
    if (!savedState.paused) {
      await newPlayer.play();
      console.log('已恢复播放');
    }

    // 10. 隐藏加载指示器
    hideLoadingIndicator();

    // 11. 通知用户
    notifyUser('播放器已自动修复', 'success');

    // 12. 重置健康状态和重建计数
    playerHealthMonitor.resetHealthStatus();
    playerRecoveryManager.resetRebuildAttempts();

    return newPlayer;
  } catch (error) {
    console.error(`第 ${attemptNumber} 次重建失败:`, error);

    // 如果还有重试机会，递归重试
    if (attemptNumber < 3) {
      const retryDelay = calculateRebuildDelay(attemptNumber + 1);
      console.log(`将在 ${retryDelay}ms 后进行第 ${attemptNumber + 1} 次重建`);

      await sleep(retryDelay);
      return rebuildPlayerFlow(player, container, options, attemptNumber + 1);
    } else {
      // 所有尝试都失败，显示错误页面
      hideLoadingIndicator();
      showFatalError({
        title: '播放器无法恢复',
        message: '很抱歉，播放器遇到了严重问题，多次修复尝试均失败',
        suggestion: '请尝试刷新页面或更换浏览器',
        error: error,
      });
      throw error;
    }
  }
}

// 计算重建延迟（指数退避）
function calculateRebuildDelay(attemptNumber: number): number {
  const delays = [2000, 5000, 10000]; // 2秒、5秒、10秒
  return delays[attemptNumber - 1] || 10000;
}

// 睡眠函数
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

## 测试策略

### 单元测试

1. **EventValidator 测试**:

   - 测试各种无效事件对象
   - 测试边界情况（null, undefined, 空对象）
   - 测试属性验证逻辑

2. **ComposedPathPolyfill 测试**:

   - 测试 DOM 遍历逻辑
   - 测试循环引用检测
   - 测试不同浏览器环境

3. **防抖节流测试**:

   - 测试时间精度
   - 测试取消和立即执行
   - 测试内存泄漏

4. **ErrorBoundary 测试**:

   - 测试错误捕获
   - 测试错误分类
   - 测试恢复逻辑

5. **PlayerHealthMonitor 测试**:

   - 测试健康状态评估
   - 测试错误严重程度判断
   - 测试重建决策逻辑

6. **PlayerStateManager 测试**:

   - 测试状态捕获完整性
   - 测试状态恢复准确性
   - 测试异常状态处理

7. **PlayerRecoveryManager 测试**:
   - 测试播放器销毁流程
   - 测试播放器创建流程
   - 测试完整重建流程
   - 测试重试机制
   - 测试并发重建防护

### 集成测试

1. **频繁点击测试**:

   - 模拟用户快速点击播放器
   - 验证无错误抛出
   - 验证播放器响应正常

2. **跨浏览器测试**:

   - Chrome: 测试标准 composedPath
   - Safari: 测试 WebKit 特定行为
   - Firefox: 测试 event.path 降级
   - Edge: 测试 Chromium 兼容性

3. **性能测试**:
   - 测试事件处理延迟
   - 测试内存使用
   - 测试 CPU 占用

### 端到端测试

1. **用户场景测试**:

   - 正常播放和控制
   - 频繁切换播放/暂停
   - 快速拖动进度条
   - 连续调整音量

2. **错误恢复测试**:

   - 触发 composedPath 错误
   - 验证自动恢复
   - 验证播放状态保持

3. **播放器重建测试**:

   - 模拟严重错误触发重建
   - 验证状态完整保存
   - 验证播放器完全销毁
   - 验证新实例正确创建
   - 验证状态准确恢复
   - 验证自动播放恢复
   - 验证加载指示器显示

4. **重建失败测试**:

   - 模拟第一次重建失败
   - 验证自动重试
   - 验证指数退避延迟
   - 模拟所有重建失败
   - 验证错误页面显示

5. **边界情况测试**:
   - 重建过程中用户操作
   - 快速连续触发重建
   - 网络断开时重建
   - 页面切换时重建

## 性能优化

### 1. 事件处理优化

- 使用事件委托减少监听器数量
- 对非关键事件使用防抖
- 对高频事件使用节流或 RAF
- 及时清理不再需要的监听器

### 2. 内存优化

- 使用 WeakMap 存储事件处理器引用
- 及时清理定时器和 RAF 请求
- 避免闭包中的大对象引用
- 定期清理错误记录

### 3. 响应时间优化

- 关键事件（点击、键盘）不使用防抖
- 使用 passive 事件监听器
- 避免在事件处理器中进行重排重绘
- 使用 RAF 批量处理 DOM 更新

## 浏览器兼容性

### Chrome/Edge (Chromium)

- 原生支持 composedPath
- 使用标准事件处理
- 无需特殊处理

### Safari/WebKit

- 支持 composedPath 但可能有 bug
- 需要额外的事件对象验证
- 使用 webkit 前缀的某些 API

### Firefox

- 支持 composedPath
- 可能需要 event.path 降级
- 标准事件处理

### 降级方案

```typescript
function getEventPath(event: Event): EventTarget[] {
  // 1. 尝试原生 composedPath
  if (typeof event.composedPath === 'function') {
    try {
      return event.composedPath();
    } catch (e) {
      console.warn('composedPath 调用失败，使用降级方案');
    }
  }

  // 2. 尝试非标准 path 属性
  if ((event as any).path) {
    return (event as any).path;
  }

  // 3. 手动遍历 DOM
  return buildEventPathManually(event.target);
}
```

## 实施计划

### 阶段 1: 核心基础设施 (已完成)

1. ✅ 实现 EventValidator
2. ✅ 实现 ComposedPathPolyfill
3. ✅ 实现基础的错误边界

### 阶段 2: 防抖节流机制 (已完成)

1. ✅ 实现 EventDebouncer
2. ✅ 实现 EventThrottler
3. ✅ 集成到事件处理流程

### 阶段 3: 错误处理增强 (已完成)

1. ✅ 实现错误分类逻辑
2. ✅ 实现错误恢复机制
3. ✅ 实现指数退避
4. ✅ 添加用户通知

### 阶段 4: 播放器健康监控 (1-2 天)

1. 实现 PlayerHealthMonitor
2. 实现健康状态评估逻辑
3. 实现错误严重程度判断
4. 实现重建决策机制
5. 集成到播放器生命周期

### 阶段 5: 播放器状态管理 (1 天)

1. 实现 PlayerStateManager
2. 实现状态捕获逻辑
3. 实现状态恢复逻辑
4. 实现状态验证
5. 添加持久化支持（可选）

### 阶段 6: 播放器恢复管理 (2-3 天)

1. 实现 PlayerRecoveryManager
2. 实现播放器销毁流程
3. 实现播放器创建流程
4. 实现完整重建流程
5. 实现重试机制和指数退避
6. 实现并发重建防护
7. 添加加载指示器
8. 实现用户通知

### 阶段 7: 集成和测试 (2-3 天)

1. 集成所有新组件到播放器页面
2. 编写单元测试
3. 编写集成测试
4. 进行端到端测试
5. 跨浏览器测试
6. 性能测试和优化

### 阶段 8: 监控和优化 (持续)

1. 添加性能监控
2. 收集错误日志和重建统计
3. 根据反馈优化
4. 调整重建阈值和策略

## 播放器自动重建详细设计

### 触发条件

播放器自动重建会在以下情况下触发：

1. **连续播放失败**: 连续 5 次以上播放失败
2. **播放器卡死**: 播放器无响应超过 10 秒
3. **严重媒体错误**: 媒体解码错误且无法恢复
4. **播放器实例损坏**: 关键方法调用失败
5. **HLS 严重错误**: HLS 连续失败且无法通过重置修复

### 重建决策逻辑

```typescript
function shouldRebuildPlayer(
  error: Error,
  healthStatus: PlayerHealthStatus
): boolean {
  // 1. 检查是否在冷却期内（防止频繁重建）
  const now = Date.now();
  const timeSinceLastRebuild = now - lastRebuildTime;
  if (timeSinceLastRebuild < 30000) {
    // 30秒内不重复重建
    console.log('在重建冷却期内，跳过重建');
    return false;
  }

  // 2. 检查错误严重程度
  const severity = assessErrorSeverity(error);
  if (severity === 'critical') {
    console.log('检测到致命错误，触发重建');
    return true;
  }

  // 3. 检查连续错误次数
  if (healthStatus.consecutiveErrors >= 5) {
    console.log('连续错误次数过多，触发重建');
    return true;
  }

  // 4. 检查严重错误计数
  if (healthStatus.criticalErrorCount >= 3) {
    console.log('严重错误次数过多，触发重建');
    return true;
  }

  // 5. 检查播放器响应性
  if (!healthStatus.isResponsive) {
    console.log('播放器无响应，触发重建');
    return true;
  }

  // 6. 检查健康状态标记
  if (healthStatus.needsRebuild) {
    console.log('健康监控标记需要重建');
    return true;
  }

  return false;
}
```

### 状态捕获详细实现

```typescript
function capturePlayerState(player: any): PlayerState {
  try {
    const state: PlayerState = {
      // 基本播放信息
      videoUrl: player.url || '',
      currentTime: player.currentTime || 0,
      volume: player.volume || 0.7,
      playbackRate: player.playbackRate || 1,
      muted: player.muted || false,
      paused: player.paused !== false,

      // 字幕信息
      subtitles: {
        enabled: player.subtitle?.show || false,
        track: player.subtitle?.index || 0,
      },

      // 质量信息
      quality: player.quality?.name || 'auto',

      // 其他配置
      fullscreen: player.fullscreen || false,
      pip: player.pip || false,
      aspectRatio: player.aspectRatio || 'default',
      flip: player.flip || 'normal',
      playbackRate: player.playbackRate || 1,

      // 自定义配置
      customConfig: {
        autoplay: player.autoplay,
        loop: player.loop,
        screenshot: player.screenshot,
        hotkey: player.hotkey,
      },
    };

    console.log('已捕获播放器状态:', state);
    return state;
  } catch (error) {
    console.error('捕获播放器状态失败:', error);
    // 返回最小状态
    return {
      videoUrl: '',
      currentTime: 0,
      volume: 0.7,
      playbackRate: 1,
      muted: false,
      paused: true,
    };
  }
}
```

### 播放器销毁详细实现

```typescript
async function destroyPlayer(player: any): Promise<void> {
  try {
    console.log('开始销毁播放器实例...');

    // 1. 暂停播放
    if (player && !player.paused) {
      try {
        player.pause();
      } catch (e) {
        console.warn('暂停播放失败:', e);
      }
    }

    // 2. 停止HLS加载
    if (player?.video?.hls) {
      try {
        player.video.hls.stopLoad();
        player.video.hls.detachMedia();
        player.video.hls.destroy();
        player.video.hls = null;
      } catch (e) {
        console.warn('销毁HLS实例失败:', e);
      }
    }

    // 3. 移除所有事件监听器
    cleanupPlayerEvents();

    // 4. 销毁播放器实例
    if (player && typeof player.destroy === 'function') {
      try {
        player.destroy(false); // false = 不移除容器
      } catch (e) {
        console.warn('销毁播放器失败:', e);
      }
    }

    // 5. 清理DOM引用
    const container = document.querySelector('.artplayer-app');
    if (container) {
      // 清空容器但不移除
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    }

    // 6. 清理全局引用
    if (window.artPlayerInstance) {
      window.artPlayerInstance = null;
    }

    // 7. 强制垃圾回收（如果可用）
    if (window.gc) {
      window.gc();
    }

    console.log('播放器实例已销毁');
  } catch (error) {
    console.error('销毁播放器时发生错误:', error);
    throw error;
  }
}
```

### 播放器创建详细实现

```typescript
async function createPlayer(
  container: HTMLElement,
  options: any
): Promise<any> {
  try {
    console.log('开始创建新播放器实例...');

    // 1. 验证容器
    if (!container) {
      throw new Error('播放器容器不存在');
    }

    // 2. 确保容器为空
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // 3. 创建新的Artplayer实例
    const newPlayer = new Artplayer({
      ...options,
      container: container,
    });

    // 4. 等待播放器就绪
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('播放器初始化超时'));
      }, 10000);

      newPlayer.on('ready', () => {
        clearTimeout(timeout);
        resolve(null);
      });

      newPlayer.on('error', (error: any) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // 5. 初始化事件处理
    initPlayerEventHandling();

    // 6. 保存全局引用
    window.artPlayerInstance = newPlayer;

    console.log('新播放器实例创建成功');
    return newPlayer;
  } catch (error) {
    console.error('创建播放器失败:', error);
    throw error;
  }
}
```

### 状态恢复详细实现

```typescript
async function restorePlayerState(
  player: any,
  state: PlayerState
): Promise<void> {
  try {
    console.log('开始恢复播放器状态...');

    // 1. 恢复视频URL（如果不同）
    if (state.videoUrl && player.url !== state.videoUrl) {
      player.switchUrl(state.videoUrl);
    }

    // 2. 等待视频加载
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('视频加载超时'));
      }, 10000);

      const checkReady = () => {
        if (player.video.readyState >= 2) {
          clearTimeout(timeout);
          resolve(null);
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });

    // 3. 恢复播放时间
    if (state.currentTime > 0) {
      player.currentTime = state.currentTime;
      console.log(`已恢复播放时间: ${state.currentTime}秒`);
    }

    // 4. 恢复音量
    if (typeof state.volume === 'number') {
      player.volume = state.volume;
      console.log(`已恢复音量: ${state.volume}`);
    }

    // 5. 恢复播放速率
    if (state.playbackRate) {
      player.playbackRate = state.playbackRate;
      console.log(`已恢复播放速率: ${state.playbackRate}x`);
    }

    // 6. 恢复静音状态
    if (state.muted !== undefined) {
      player.muted = state.muted;
    }

    // 7. 恢复字幕
    if (state.subtitles?.enabled && player.subtitle) {
      player.subtitle.show = true;
      if (state.subtitles.track !== undefined) {
        player.subtitle.switch(state.subtitles.track);
      }
    }

    // 8. 恢复全屏状态
    if (state.fullscreen && player.fullscreen !== state.fullscreen) {
      player.fullscreen = state.fullscreen;
    }

    // 9. 恢复画中画状态
    if (state.pip && player.pip !== state.pip) {
      player.pip = state.pip;
    }

    console.log('播放器状态恢复完成');
  } catch (error) {
    console.error('恢复播放器状态失败:', error);
    // 不抛出错误，允许播放器以默认状态运行
  }
}
```

### 用户界面反馈

```typescript
// 加载指示器组件
function showLoadingIndicator(message: string): void {
  const indicator = document.createElement('div');
  indicator.id = 'player-rebuild-indicator';
  indicator.className = 'player-rebuild-indicator';
  indicator.innerHTML = `
    <div class="rebuild-spinner"></div>
    <div class="rebuild-message">${message}</div>
  `;

  document.body.appendChild(indicator);
}

function hideLoadingIndicator(): void {
  const indicator = document.getElementById('player-rebuild-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// 通知组件
function notifyUser(message: string, type: 'success' | 'error' | 'info'): void {
  const player = window.artPlayerInstance;
  if (player?.notice) {
    player.notice.show(message, 3000);
  } else {
    // 降级到浏览器通知
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

// 错误页面
function showFatalError(config: {
  title: string;
  message: string;
  suggestion: string;
  error?: Error;
}): void {
  const errorPage = document.createElement('div');
  errorPage.className = 'player-fatal-error';
  errorPage.innerHTML = `
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h2>${config.title}</h2>
      <p>${config.message}</p>
      <p class="error-suggestion">${config.suggestion}</p>
      <div class="error-actions">
        <button onclick="window.location.reload()">刷新页面</button>
        <button onclick="window.history.back()">返回</button>
      </div>
      ${
        config.error
          ? `<details class="error-details">
        <summary>错误详情</summary>
        <pre>${config.error.stack || config.error.message}</pre>
      </details>`
          : ''
      }
    </div>
  `;

  // 替换播放器容器
  const container = document.querySelector('.artplayer-app');
  if (container) {
    container.innerHTML = '';
    container.appendChild(errorPage);
  }
}
```

### 性能优化考虑

1. **防止频繁重建**:

   - 30 秒冷却期
   - 最多 3 次重建尝试
   - 指数退避延迟

2. **资源清理**:

   - 完全销毁旧实例
   - 清理所有事件监听器
   - 清理 HLS 实例
   - 清理 DOM 引用

3. **状态恢复优化**:

   - 异步恢复非关键状态
   - 超时保护
   - 失败降级

4. **用户体验**:
   - 显示加载进度
   - 提供清晰的反馈
   - 自动恢复播放
   - 错误时提供操作选项

### 监控和日志

```typescript
// 重建统计
interface RebuildStats {
  totalRebuilds: number;
  successfulRebuilds: number;
  failedRebuilds: number;
  averageRebuildTime: number;
  rebuildReasons: Map<string, number>;
  lastRebuildTime: number;
}

// 记录重建事件
function logRebuildEvent(
  success: boolean,
  reason: string,
  duration: number,
  error?: Error
): void {
  const event = {
    timestamp: Date.now(),
    success,
    reason,
    duration,
    error: error?.message,
    stack: error?.stack,
  };

  // 发送到监控系统
  performanceMonitor.recordRebuildEvent(event);

  // 本地日志
  console.log('播放器重建事件:', event);
}
```

## 致命错误弹窗显示保证机制

### 问题分析

当播放器重建失败时，`playerRecoveryManager.recoverPlayer()` 会调用 `showFatalError()` 并抛出错误。但如果调用方使用 `try-catch` 捕获了这个错误而没有重新抛出或显示弹窗，用户将看不到错误提示。

### 解决方案

#### 方案 1: 在调用方正确处理错误（推荐）

```typescript
// 在 play/page.tsx 中
try {
  const newPlayer = await playerRecoveryManager.recoverPlayer(
    artPlayerRef.current,
    container,
    playerOptions
  );

  if (newPlayer) {
    artPlayerRef.current = newPlayer;
    console.log('✅ 播放器自动重建成功');
  }
} catch (rebuildError) {
  console.error('播放器自动恢复失败:', rebuildError);

  // 关键：不要吞掉错误，确保弹窗已经显示
  // recoverPlayer 内部已经调用了 showFatalError
  // 这里只需要记录日志，不需要额外处理

  // 可选：如果需要额外的错误处理逻辑
  // 例如：停止其他恢复尝试、清理资源等
}
```

#### 方案 2: 添加全局错误捕获

```typescript
// 在播放器初始化时添加全局错误监听
window.addEventListener('error', (event) => {
  const error = event.error;

  // 检测 composedPath 相关错误
  if (error && error.message && error.message.includes('composedPath')) {
    console.error('捕获到 composedPath 全局错误:', error);

    // 直接显示致命错误弹窗
    showFatalError({
      title: '播放器遇到严重错误',
      message: '播放器事件处理出现问题，无法继续播放',
      suggestion: '请点击下方按钮刷新页面以恢复正常',
      error: error,
    });

    // 阻止错误继续传播
    event.preventDefault();
  }
});

// 捕获未处理的 Promise 拒绝
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;

  if (error && error.message && error.message.includes('composedPath')) {
    console.error('捕获到 composedPath Promise 拒绝:', error);

    showFatalError({
      title: '播放器遇到严重错误',
      message: '播放器事件处理出现问题，无法继续播放',
      suggestion: '请点击下方按钮刷新页面以恢复正常',
      error: error,
    });

    event.preventDefault();
  }
});
```

#### 方案 3: 增强 PlayerRecoveryManager

```typescript
// 在 PlayerRecoveryManager 中添加状态跟踪
export class PlayerRecoveryManager {
  private fatalErrorShown = false;

  public async recoverPlayer(
    player: any,
    container: HTMLElement,
    options: any
  ): Promise<any> {
    try {
      return await this.rebuildPlayer(player, container, options);
    } catch (error) {
      if (this.rebuildAttempts < this.config.maxAttempts) {
        console.log(`将进行第 ${this.rebuildAttempts + 1} 次重建尝试...`);
        return await this.recoverPlayer(player, container, options);
      } else {
        console.error('所有重建尝试均失败');

        // 确保只显示一次致命错误
        if (!this.fatalErrorShown) {
          this.fatalErrorShown = true;

          // 显示致命错误页面
          showFatalError({
            title: '播放器无法恢复',
            message: '很抱歉，播放器遇到了严重问题，多次修复尝试均失败',
            suggestion: '请尝试刷新页面或更换浏览器',
            error: error as Error,
          });
        }

        throw error;
      }
    }
  }

  // 重置标志
  public resetFatalErrorFlag(): void {
    this.fatalErrorShown = false;
  }
}
```

### 实施建议

1. **优先使用方案 1**：确保调用方正确处理错误，不要吞掉错误
2. **补充方案 2**：添加全局错误捕获作为安全网，捕获任何未被处理的 composedPath 错误
3. **可选方案 3**：如果需要更严格的控制，可以在 PlayerRecoveryManager 中添加状态跟踪

### 测试验证

```typescript
// 测试代码：模拟 composedPath 错误
function testFatalErrorDisplay() {
  // 1. 触发 composedPath 错误
  const fakeEvent = {};
  try {
    // @ts-ignore
    fakeEvent.composedPath();
  } catch (error) {
    console.log('成功触发 composedPath 错误');
  }

  // 2. 验证致命错误弹窗是否显示
  setTimeout(() => {
    const errorPage = document.querySelector('.player-fatal-error');
    if (errorPage) {
      console.log('✅ 致命错误弹窗正确显示');
    } else {
      console.error('❌ 致命错误弹窗未显示');
    }
  }, 1000);
}
```
