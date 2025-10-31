# 实现计划

- [x] 1. 创建 URL 验证工具类

  - 实现 `URLValidator` 类,包含 `validateSourceURL`、`validateSources` 和 `isValidURLFormat` 方法
  - 添加详细的验证逻辑,检测缺失、类型错误、格式错误和空字符串
  - 实现 URL 规范化功能,优先使用 `episodeUrl`,其次使用 `url`
  - 返回结构化的 `URLValidationResult` 对象
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. 增强 SourceSwitchExecutor 的 URL 验证

  - 在 `performSwitch` 方法开始时集成 `URLValidator.validateSourceURL`
  - 验证失败时创建带有 `validationError` 标志的错误对象
  - 添加详细的验证日志,包括 URL 值和类型信息
  - 确保验证通过后才执行播放器切换操作
  - _需求: 1.1, 1.2, 1.3, 1.5_

- [x] 3. 增强 EnhancedSourceSelector 的源过滤

  - 在 `evaluateSources` 方法中使用 `URLValidator.validateSources` 批量验证
  - 过滤掉验证失败的源,并记录到性能数据库
  - 使用 `markSourceUnavailable` 标记无效源,包含验证错误类型
  - 确保只返回 URL 有效的源评估结果
  - _需求: 4.1, 4.2, 4.4, 4.5_

- [x] 4. 扩展 SourcePerformanceData 数据模型

  - 在 `SourcePerformanceData` 接口中添加 `validationErrors`、`lastValidationError` 和 `lastValidationErrorTime` 字段
  - 更新 `SourcePerformanceDatabase.updatePerformanceData` 方法以记录验证错误
  - 更新 `markSourceUnavailable` 方法以区分验证错误和其他错误类型
  - 确保验证错误数据正确持久化到 localStorage
  - _需求: 3.1, 3.2, 4.2_

- [x] 5. 增强 AutoSourceSwitcher 的错误处理

  - 在 `performSwitch` 方法中添加 try-catch 块捕获验证错误
  - 检查错误对象的 `validationError` 标志,区分验证错误和其他错误
  - 验证错误时标记源为不可用并记录到统计数据
  - 触发 `switch-failed` 事件,包含错误类型信息
  - 验证错误时返回 false 而不是抛出异常,允许尝试下一个源
  - _需求: 2.1, 2.2, 3.2, 4.4_

- [x] 7. 扩展 SwitchRecord 数据模型

  - 在 `SwitchRecord` 接口中添加 `errorType` 字段
  - 更新所有记录切换的代码,包含错误类型信息
  - 确保验证错误、超时错误、网络错误和播放器错误被正确分类
  - _需求: 3.2, 3.3_

- [x] 8. 改进错误日志记录

  - 在 URL 验证失败时记录完整的 targetSource 对象结构
  - 在切换失败时记录完整的切换上下文(当前源、目标源、原因)
  - 在 `restorePlayerState` 失败时记录播放器状态
  - 为所有错误日志添加时间戳
  - 实现 unhandledrejection 事件监听器,捕获未处理的 Promise 拒绝
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 9. 处理所有源失败的场景

  - 在 `handleAllSourcesFailed` 中检查是否有任何有效源
  - 没有有效源时显示"无可用播放源"致命错误
  - 有有效源但都失败时显示手动恢复对话框
  - 确保用户始终有明确的下一步操作选项
  - _需求: 2.4, 2.5, 4.3_

- [x] 10. 集成到播放器页面
  - 在播放器初始化时设置 unhandledrejection 监听器
  - 监听 AutoSourceSwitcher 的 `all-sources-failed` 事件
  - 确保手动恢复对话框在播放器容器中正确显示
  - 测试完整的错误恢复流程
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_
