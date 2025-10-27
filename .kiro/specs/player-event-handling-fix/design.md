# 设计文档

## 概述

本设计文档描述了如何修复视频播放器中的事件处理错误，特别是频繁点击导致的 `composedPath` 错误。解决方案采用多层防御策略，包括事件对象验证、polyfill 实现、防抖节流机制、错误边界和优雅降级。

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

## 错误处理

### 错误分类

1. **可恢复错误**:

   - composedPath 相关错误
   - 事件对象属性访问错误
   - 临时性网络错误

2. **不可恢复错误**:
   - 播放器实例不存在
   - 关键 DOM 元素缺失
   - 严重的内存错误

### 错误恢复策略

```typescript
// 错误恢复流程
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

// 连续错误处理
if (consecutiveErrors >= 3) {
  // 1. 重置事件监听器
  resetEventListeners();

  // 2. 清理错误状态
  clearErrorState();

  // 3. 通知用户
  notifyUser('播放器已自动恢复');
}

// 不可恢复错误
if (isNonRecoverableError(error)) {
  // 1. 记录详细错误信息
  logDetailedError(error);

  // 2. 显示用户友好的错误消息
  showUserFriendlyError();

  // 3. 提供恢复建议
  suggestRecoveryActions();
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

### 阶段 1: 核心基础设施 (1-2 天)

1. 实现 EventValidator
2. 实现 ComposedPathPolyfill
3. 实现基础的错误边界

### 阶段 2: 防抖节流机制 (1 天)

1. 实现 EventDebouncer
2. 实现 EventThrottler
3. 集成到事件处理流程

### 阶段 3: 错误处理增强 (1-2 天)

1. 实现错误分类逻辑
2. 实现错误恢复机制
3. 实现指数退避
4. 添加用户通知

### 阶段 4: 集成和测试 (2-3 天)

1. 集成所有组件到播放器
2. 编写单元测试
3. 进行跨浏览器测试
4. 性能测试和优化

### 阶段 5: 监控和优化 (持续)

1. 添加性能监控
2. 收集错误日志
3. 根据反馈优化
