# 播放器刷新卡死问题修复

## 概述

本修复解决了播放器强制刷新弹窗点击刷新按钮后出现卡死的问题。通过引入清理管理器和刷新执行器，确保页面能够正常刷新。

## 核心组件

### 1. RefreshCleanupManager (清理管理器)

负责在页面刷新前清理所有可能阻塞的资源。

**位置**: `src/lib/refresh-cleanup-manager.ts`

**功能**:

- 停止所有定时器和间隔器
- 移除所有事件监听器
- 取消待处理的网络请求
- 销毁 HLS 实例
- 清理全局引用

**使用示例**:

```typescript
import { refreshCleanupManager } from '@/lib/refresh-cleanup-manager';

// 执行清理
const report = refreshCleanupManager.executeCleanup();
console.log('清理报告:', report);
```

### 2. RefreshExecutor (刷新执行器)

负责执行页面刷新操作，支持多种策略和超时保护。

**位置**: `src/lib/refresh-executor.ts`

**功能**:

- 支持 3 种刷新策略（standard、force、navigation）
- 内置超时保护（默认 3 秒）
- 自动尝试备用策略
- 详细的日志记录

**使用示例**:

```typescript
import { getRefreshExecutor } from '@/lib/refresh-executor';
import { refreshCleanupManager } from '@/lib/refresh-cleanup-manager';

const executor = getRefreshExecutor(refreshCleanupManager);

// 执行刷新
await executor.executeRefresh({
  timeout: 3000,
  strategy: 'standard',
  showLoadingState: true,
  enableCleanup: true,
});
```

### 3. Enhanced Fatal Error Dialog (增强的错误弹窗)

集成了清理和刷新逻辑的致命错误弹窗。

**位置**: `src/lib/player-ui-feedback.ts`

**新增功能**:

- 自动清理资源
- 多策略刷新
- 强制刷新备用按钮
- 超时保护

**使用示例**:

```typescript
import { showFatalError } from '@/lib/player-ui-feedback';

showFatalError({
  title: '播放器遇到严重错误',
  message: '播放器事件处理出现问题，无法继续播放',
  suggestion: '请点击下方按钮刷新页面以恢复正常播放',
  error: error,
  enableCleanup: true,
  refreshTimeout: 3000,
  showFallbackButton: true,
});
```

## 刷新流程

```
用户点击刷新按钮
    ↓
记录点击事件
    ↓
禁用按钮 + 显示加载状态
    ↓
执行清理流程
    ├─ 停止所有定时器
    ├─ 移除事件监听器
    ├─ 取消网络请求
    ├─ 销毁HLS实例
    └─ 清理全局引用
    ↓
启动刷新（带3秒超时）
    ├─ 成功: 页面重新加载
    └─ 超时: 尝试备用策略
        ├─ 策略1: window.location.reload()
        ├─ 策略2: window.location.href = url
        └─ 策略3: window.location.replace(url)
    ↓
所有策略失败
    ↓
显示手动刷新提示
```

## 调试功能

在开发模式下，以下调试函数会自动添加到 `window` 对象：

### 1. 测试致命错误弹窗

```javascript
window.testFatalError();
```

### 2. 测试刷新卡死场景

```javascript
window.testRefreshDeadlock();
```

创建阻塞资源并测试清理功能。

### 3. 获取刷新系统状态

```javascript
window.getRefreshSystemStatus();
```

返回清理管理器和刷新执行器的当前状态。

### 4. 启用性能监控

```javascript
window.monitorRefreshPerformance();
```

监控清理和刷新操作的耗时。

## 性能指标

- **清理操作**: 应在 50ms 内完成
- **按钮响应**: 点击到视觉反馈 < 100ms
- **刷新触发**: 清理到刷新 < 200ms
- **总体时间**: 正常情况下 < 500ms

## iOS Safari 特殊处理

iOS Safari 对页面刷新有严格的限制，特别是在异步上下文中。我们的实现包含了以下 iOS Safari 兼容性优化：

### 1. 同步执行

- 刷新操作在用户点击事件的同步上下文中立即执行
- 不使用 `async/await`，避免异步上下文导致刷新被阻止

### 2. 兼容的刷新方法

- **标准刷新**: 使用 `window.location.assign()` 而不是 `reload()`
- **强制刷新**: 添加时间戳参数绕过缓存
- **导航刷新**: 使用 `assign()` 而不是 `replace()`

### 3. 自动检测

系统会自动检测 iOS Safari 浏览器并使用兼容的刷新策略。

检测条件：

- 设备是 iPad/iPhone/iPod
- 使用 WebKit 引擎
- 不是 Chrome 或 Firefox

## 故障排查

### 问题: iOS Safari 上刷新按钮点击后无响应

**原因**:
iOS Safari 会阻止在异步上下文中执行的页面导航操作。

**已修复**:

- ✅ 刷新操作现在在用户手势的同步上下文中执行
- ✅ 自动检测 iOS Safari 并使用兼容的刷新方法
- ✅ 移除了 async/await，确保同步执行

**备用方案**:
如果自动刷新仍然失败，用户可以：

1. 下拉页面手动刷新（iOS Safari 原生手势）
2. 点击地址栏并按回车
3. 关闭标签页重新打开

### 问题: 刷新按钮点击后无响应（其他浏览器）

**可能原因**:

1. 清理过程被阻塞
2. 刷新策略失败
3. 超时时间过短

**解决方案**:

1. 检查控制台日志，查看清理报告
2. 使用 `window.getRefreshSystemStatus()` 查看状态
3. 尝试点击"强制刷新"按钮

### 问题: 所有刷新策略都失败

**可能原因**:

1. 浏览器限制
2. 扩展程序干扰
3. 网络问题

**解决方案**:

1. 使用键盘快捷键手动刷新（Ctrl+R / Cmd+R）
2. 禁用浏览器扩展后重试
3. 检查网络连接

## 配置选项

### EnhancedFatalErrorConfig

```typescript
interface EnhancedFatalErrorConfig {
  title: string; // 错误标题
  message: string; // 错误消息
  suggestion: string; // 建议操作
  error?: Error; // 错误对象
  enableCleanup?: boolean; // 是否启用清理（默认true）
  refreshTimeout?: number; // 刷新超时时间（默认3000ms）
  showFallbackButton?: boolean; // 是否显示强制刷新按钮（默认true）
  onRefresh?: () => void; // 自定义刷新回调
  onBack?: () => void; // 自定义返回回调
  onCleanupComplete?: (report) => void; // 清理完成回调
  onRefreshTimeout?: () => void; // 刷新超时回调
}
```

## 更新日志

### v1.0.0 (2024-11-01)

- ✅ 创建清理管理器模块
- ✅ 创建刷新执行器模块
- ✅ 增强致命错误弹窗
- ✅ 更新播放器页面集成
- ✅ 添加调试和监控功能

## 相关文件

- `src/lib/refresh-cleanup-manager.ts` - 清理管理器
- `src/lib/refresh-executor.ts` - 刷新执行器
- `src/lib/player-ui-feedback.ts` - UI 反馈（包含增强的错误弹窗）
- `src/app/play/page.tsx` - 播放器页面（集成点）

## 技术规格

详细的技术规格和设计文档请参考：

- `.kiro/specs/player-refresh-deadlock-fix/requirements.md` - 需求文档
- `.kiro/specs/player-refresh-deadlock-fix/design.md` - 设计文档
- `.kiro/specs/player-refresh-deadlock-fix/tasks.md` - 任务列表
