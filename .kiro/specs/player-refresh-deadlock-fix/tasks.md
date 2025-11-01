# Implementation Plan

- [x] 1. 创建清理管理器模块

  - 创建 `src/lib/refresh-cleanup-manager.ts` 文件
  - 实现 `RefreshCleanupManager` 类，包含清理状态追踪和清理方法
  - 实现 `stopAllTimers()` 方法，清理所有定时器和间隔器
  - 实现 `removeAllEventListeners()` 方法，移除全局事件监听器
  - 实现 `cancelAllRequests()` 方法，取消待处理的网络请求
  - 实现 `destroyHlsInstances()` 方法，销毁 HLS 实例
  - 实现 `clearGlobalReferences()` 方法，清理全局引用
  - 实现 `executeCleanup()` 方法，执行完整清理流程并返回报告
  - 导出 `CleanupReport` 和 `CleanupState` 类型定义
  - _Requirements: 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2. 创建刷新执行器模块

  - 创建 `src/lib/refresh-executor.ts` 文件
  - 实现 `RefreshExecutor` 类，包含刷新状态管理和多种刷新策略
  - 实现 `standardRefresh()` 方法，使用 `window.location.reload()`
  - 实现 `forceRefresh()` 方法，使用 `window.location.href` 赋值
  - 实现 `navigationRefresh()` 方法，使用 `window.location.replace()`
  - 实现 `executeRefresh()` 方法，支持超时保护和策略切换
  - 实现 `handleRefreshTimeout()` 方法，处理刷新超时并尝试备用策略
  - 实现 `showRefreshingState()` 方法，更新按钮加载状态
  - 实现 `showManualRefreshPrompt()` 方法，显示手动刷新提示
  - 实现日志记录功能，追踪刷新流程的每个步骤
  - 导出 `RefreshOptions`、`RefreshState` 和 `RefreshLog` 类型定义
  - _Requirements: 1.1, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 增强致命错误弹窗

  - 修改 `src/lib/player-ui-feedback.ts` 中的 `showFatalError` 函数
  - 更新 `showFatalError` 函数签名，支持 `EnhancedFatalErrorConfig` 配置
  - 在刷新按钮点击事件中集成 `RefreshCleanupManager` 和 `RefreshExecutor`
  - 添加详细的日志记录，包括点击时间戳和配置信息
  - 添加"强制刷新"备用按钮，使用更激进的刷新策略
  - 实现按钮禁用和加载状态显示
  - 添加按钮样式，包括禁用状态和加载动画
  - 导出 `EnhancedFatalErrorConfig` 类型定义
  - _Requirements: 1.1, 1.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4. 更新播放器页面集成

  - 修改 `src/app/play/page.tsx`，在组件挂载时初始化清理管理器
  - 追踪所有创建的定时器和间隔器，添加到清理管理器
  - 追踪所有添加的事件监听器，添加到清理管理器
  - 追踪所有创建的 AbortController，添加到清理管理器
  - 追踪所有创建的 HLS 实例，添加到清理管理器
  - 在组件卸载时执行清理（作为备用保护）
  - 更新全局错误处理器，使用增强的 `showFatalError`
  - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. 添加调试和监控功能

  - 在 `RefreshCleanupManager` 中添加 `getCleanupReport()` 方法
  - 在 `RefreshExecutor` 中添加 `getRefreshLogs()` 方法
  - 在控制台输出详细的清理和刷新日志
  - 添加性能监控，记录清理和刷新的耗时
  - 在开发模式下添加测试函数，模拟刷新卡死场景
  - 添加错误边界，捕获清理和刷新过程中的异常
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]\* 6. 编写单元测试

  - 创建 `src/lib/__tests__/refresh-cleanup-manager.test.ts`
  - 测试 `stopAllTimers()` 方法的正确性
  - 测试 `removeAllEventListeners()` 方法的正确性
  - 测试 `cancelAllRequests()` 方法的正确性
  - 测试 `destroyHlsInstances()` 方法的正确性
  - 测试 `executeCleanup()` 方法的完整流程
  - 创建 `src/lib/__tests__/refresh-executor.test.ts`
  - 测试各种刷新策略的执行
  - 测试超时机制和策略切换
  - 测试日志记录功能
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2_

- [ ]\* 7. 编写集成测试

  - 创建 `src/__tests__/player-refresh-integration.test.tsx`
  - 测试完整的刷新流程（清理 + 刷新）
  - 测试超时场景和备用策略触发
  - 测试手动刷新提示显示
  - 测试多次点击防护
  - 测试按钮状态更新
  - _Requirements: 1.1, 3.1, 3.2, 3.3, 5.1, 5.2, 5.3_

- [ ]\* 8. 性能优化和验证

  - 验证清理操作在 50ms 内完成
  - 验证按钮点击到视觉反馈在 100ms 内
  - 验证清理到刷新触发在 200ms 内
  - 优化清理逻辑，减少不必要的操作
  - 添加性能监控指标
  - _Requirements: 1.4, 5.4_

- [ ]\* 9. 文档和示例
  - 更新 `src/lib/player-ui-feedback.ts` 的 JSDoc 注释
  - 添加使用示例到 README 或文档
  - 创建故障排查指南
  - 添加开发者调试指南
  - _Requirements: 2.1, 2.4_
