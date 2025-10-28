# Implementation Plan

- [x] 1. 创建 PiP 检测和浏览器识别工具函数

  - 在`src/lib/utils.ts`中添加 iOS Safari 检测函数
  - 创建 PiP 能力检测函数，返回支持的 API 类型（webkit/standard/none）
  - 添加浏览器环境信息收集函数
  - _Requirements: 2.1, 2.2_

- [x] 2. 重构 PiP 状态管理逻辑

  - [x] 2.1 优化 PiP 支持检测逻辑

    - 修改`src/app/play/page.tsx`中的`checkPiPSupport`函数
    - 使用新的检测工具函数识别 API 类型
    - 区分 iOS Safari 和其他浏览器环境
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 改进 PiP 状态变化监听
    - 优化`handlePiPChange`函数的事件监听逻辑
    - 确保正确监听 webkit 和标准 API 的事件
    - 添加状态变化的调试日志
    - _Requirements: 2.3, 2.4_

- [x] 3. 实现视频就绪状态检查机制

  - 创建`waitForVideoReady`辅助函数
  - 实现超时机制（默认 5 秒）
  - 根据浏览器类型使用不同的就绪状态阈值（iOS Safari 使用 HAVE_METADATA，其他使用 HAVE_CURRENT_DATA）
  - 添加视频状态检查的日志记录
  - _Requirements: 1.4, 4.2_

- [x] 4. 重写 PiP 切换处理函数

  - [x] 4.1 实现 iOS Safari 专用处理逻辑

    - 在`handleTogglePictureInPicture`函数中添加 iOS Safari 分支
    - 在用户手势上下文中同步调用`webkitSetPresentationMode`
    - 移除不必要的 async/await 以保持同步性
    - 在调用前检查视频就绪状态
    - _Requirements: 1.1, 1.2, 1.5, 2.5_

  - [x] 4.2 优化标准 API 处理逻辑

    - 保持现有标准 API 的处理流程
    - 添加视频就绪状态检查
    - 确保与 iOS Safari 逻辑的一致性
    - _Requirements: 3.1, 3.2_

  - [x] 4.3 添加详细的错误处理
    - 捕获并分类不同类型的错误（NotAllowedError, InvalidStateError 等）
    - 为每种错误类型提供用户友好的提示消息
    - 记录详细的错误信息到控制台
    - _Requirements: 1.3, 5.1, 5.2, 5.3, 5.4_

- [x] 5. 优化用户反馈机制

  - 改进成功/失败的通知消息
  - 根据错误类型显示不同的提示内容
  - 添加视频未就绪时的友好提示
  - 优化通知显示时长和样式
  - _Requirements: 3.4, 5.4_

- [x] 6. 添加调试和日志功能

  - 在关键步骤添加 console.log 输出
  - 记录 PiP API 调用的详细信息（API 类型、视频状态、时间戳等）
  - 在错误发生时记录完整的上下文信息
  - 添加开发环境的额外调试信息
  - _Requirements: 5.1, 5.2, 5.5_

- [x] 7. 更新 Artplayer 配置

  - 检查 Artplayer 初始化配置中的`pip`选项
  - 确保根据检测结果正确设置`pip`配置
  - 验证配置不会干扰自定义 PiP 实现
  - _Requirements: 2.1, 3.1_

- [ ]\* 8. 编写测试用例

  - [ ]\* 8.1 创建 PiP 检测功能的单元测试

    - 测试 iOS Safari 环境检测
    - 测试 API 类型识别
    - 测试浏览器信息收集
    - _Requirements: 2.1, 2.2_

  - [ ]\* 8.2 创建状态管理的单元测试

    - 测试状态初始化
    - 测试状态更新逻辑
    - 测试事件监听器管理
    - _Requirements: 2.3, 2.4_

  - [ ]\* 8.3 创建错误处理的单元测试
    - 测试各种错误场景
    - 验证错误消息生成
    - 测试错误分类逻辑
    - _Requirements: 5.3, 5.4_

- [x] 9. 进行跨浏览器测试

  - 在 iOS Safari 中测试画中画功能（不同 iOS 版本）
  - 在 macOS Safari 中验证功能正常
  - 在 Chrome（桌面和移动）中验证功能正常
  - 在其他浏览器中验证降级处理
  - 记录测试结果和发现的问题
  - _Requirements: 3.1, 3.2, 3.3_

- [ ]\* 10. 创建技术文档
  - 编写 PiP 功能使用说明
  - 记录已知问题和限制
  - 提供故障排查指南
  - 更新代码注释
  - _Requirements: 5.5_
