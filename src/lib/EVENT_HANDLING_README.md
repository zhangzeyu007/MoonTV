# 播放器事件处理系统

## 概述

本系统提供了健壮的事件处理机制，解决了视频播放器中频繁点击导致的 `composedPath` 错误和其他事件处理问题。

## 核心功能

### 1. composedPath Polyfill

- 自动检测浏览器支持
- 为不支持的浏览器提供兼容实现
- 防止循环引用和无限遍历
- 支持 Shadow DOM

### 2. 事件对象验证

- 验证事件对象的完整性
- 自动修复缺失的属性
- 规范化触摸和鼠标事件

### 3. 防抖和节流

- 防抖：限制函数执行频率（适用于点击、输入等）
- 节流：确保函数在指定时间间隔内最多执行一次（适用于滚动、resize 等）
- RAF 节流：使用 requestAnimationFrame 优化动画相关事件

### 4. 错误边界

- 自动捕获和处理事件处理错误
- 区分可恢复和不可恢复错误
- 错误频率跟踪和指数退避
- 自动恢复机制

### 5. 事件处理器管理

- 统一管理所有事件处理器
- 自动应用验证、防抖、节流和错误边界
- 支持批量清理和重置
- 性能指标收集

## 使用方法

### 初始化

在应用启动时调用：

```typescript
import { initPlayerEventHandling } from '@/lib/player-event-integration';

// 在组件挂载时初始化
useEffect(() => {
  initPlayerEventHandling();

  return () => {
    cleanupPlayerEvents();
  };
}, []);
```

### 创建安全的事件处理器

```typescript
import { createSafePlayerHandler } from '@/lib/player-event-integration';

const handleClick = createSafePlayerHandler((event) => {
  console.log('点击事件', event);
}, 'click');
```

### 注册播放器事件

```typescript
import {
  registerPlayerEvent,
  getPlayerEventConfig,
} from '@/lib/player-event-integration';

// 使用推荐配置
registerPlayerEvent(
  player,
  'click',
  handleClick,
  getPlayerEventConfig('click')
);
```

### 检查和重置

```typescript
import {
  shouldResetPlayerEvents,
  resetPlayerEvents,
} from '@/lib/player-event-integration';

// 检查是否需要重置
if (shouldResetPlayerEvents('player')) {
  console.warn('检测到连续错误，重置事件监听器');
  resetPlayerEvents();
}
```

## 事件配置预设

系统为不同类型的事件提供了推荐配置：

- **点击事件** (`click`, `dblclick`): 防抖 200ms
- **时间更新** (`timeupdate`): 节流 500ms
- **移动事件** (`mousemove`, `touchmove`): RAF 节流 ~60fps
- **进度事件** (`progress`): 节流 1000ms
- **窗口事件** (`resize`, `scroll`): 防抖 150ms

## 浏览器兼容性

- ✅ Chrome/Edge (Chromium)
- ✅ Safari/WebKit
- ✅ Firefox
- ✅ 移动浏览器

## 性能优化

- 使用 WeakMap 避免内存泄漏
- 自动清理定时器和 RAF 请求
- 事件委托减少监听器数量
- 智能防抖和节流策略

## 错误处理

系统会自动处理以下错误：

- composedPath 相关错误
- 事件对象属性访问错误
- 网络相关错误
- AbortError

可恢复错误会自动重试，不可恢复错误会记录并提供用户反馈。

## 监控和调试

获取事件统计：

```typescript
import { getPlayerEventStats } from '@/lib/player-event-integration';

const stats = getPlayerEventStats();
console.log('事件处理器数量:', stats.handlers);
console.log('事件指标:', stats.metrics);
console.log('错误统计:', stats.errors);
```

## 故障排除

### 问题：频繁点击导致错误

**解决方案**: 系统会自动应用防抖机制，无需额外配置。

### 问题：事件处理器未响应

**解决方案**: 检查是否正确初始化了事件处理系统：

```typescript
initPlayerEventHandling();
```

### 问题：连续错误导致播放器卡死

**解决方案**: 系统会自动检测连续错误并重置事件监听器。也可以手动重置：

```typescript
resetPlayerEvents();
```

## 已知限制

1. 某些浏览器可能不支持所有 Event API
2. Shadow DOM 支持可能因浏览器而异
3. 跨域 iframe 中的事件可能受限

## 更新日志

### v1.0.0 (2025-01-XX)

- ✅ 实现 composedPath polyfill
- ✅ 实现事件对象验证
- ✅ 实现防抖和节流机制
- ✅ 实现错误边界和恢复
- ✅ 实现事件处理器管理
- ✅ 集成到播放器代码
