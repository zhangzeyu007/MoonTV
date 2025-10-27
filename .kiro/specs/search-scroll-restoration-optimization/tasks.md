# Implementation Plan

- [x] 1. 创建核心工具模块和类型定义

  - 创建 `src/lib/scroll-restoration/` 目录结构
  - 定义 TypeScript 接口和类型（ScrollPositionManager、PlatformDetector 等）
  - 创建配置文件定义默认配置
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 2. 实现平台检测器

  - [x] 2.1 创建 PlatformDetector 类
    - 实现 isIOS() 方法检测 iOS 设备
    - 实现 isSafari() 方法检测 Safari 浏览器
    - 实现 getPlatform() 方法返回平台类型
    - 实现 supportsAPI() 方法检测 API 支持
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 添加用户代理检测逻辑
    - 解析 navigator.userAgent
    - 检测 iPad、iPhone、iPod 设备
    - 处理边界情况和降级策略
    - _Requirements: 2.1_

- [x] 3. 实现滚动位置缓存系统

  - [x] 3.1 创建 ScrollPositionCache 类
    - 实现内存缓存机制
    - 实现 update() 方法更新缓存
    - 实现 get() 方法获取缓存值
    - 实现 clear() 方法清除缓存
    - _Requirements: 3.1, 3.2_
  - [x] 3.2 实现 RAF 节流的滚动监听
    - 使用 requestAnimationFrame 节流滚动事件
    - 实现多方法获取滚动位置（window.scrollY、documentElement.scrollTop 等）
    - 选择第一个非零值作为当前位置
    - _Requirements: 3.3, 3.5, 4.1_
  - [x] 3.3 实现频率限制的 LocalStorage 保存
    - iOS 端限制为每 200ms 保存一次
    - PC 端限制为每 100ms 保存一次
    - 实现小值回写保护逻辑
    - _Requirements: 4.2, 5.2_

- [x] 4. 实现导航锁管理器

  - [x] 4.1 创建 NavigationLockManager 类
    - 实现 lock() 方法设置导航锁
    - 实现 unlock() 方法释放导航锁
    - 实现 isLocked() 方法检查锁状态
    - 实现 getLockedPosition() 方法获取锁定位置
    - _Requirements: 3.4_
  - [x] 4.2 集成到全局对象
    - 将锁状态存储到 window.**SEARCH_NAV_LOCK**
    - 在组件挂载时清理遗留的导航锁
    - 添加调试日志输出
    - _Requirements: 3.4, 7.2_

- [x] 5. 实现 iOS 滚动恢复器

  - [x] 5.1 创建 IOSScrollRestorer 类
    - 实现 restore() 主恢复方法
    - 实现 verifyPosition() 位置验证方法
    - 实现 retryRestore() 重试机制
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 5.2 实现多方法滚动策略
    - 使用 window.scrollTo({ top, behavior: 'auto' })
    - 同时设置 document.body.scrollTop
    - 同时设置 document.documentElement.scrollTop
    - _Requirements: 2.2, 2.4_
  - [x] 5.3 实现锚点辅助定位
    - 检查是否有保存的 anchorKey
    - 使用 querySelector 查找锚点元素
    - 使用 scrollIntoView 进行锚点定位
    - 锚点定位后再进行数值微调
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 5.4 实现智能重试机制
    - 延迟 150ms 后验证滚动位置
    - 如果误差超过 10px，触发重试
    - 最多重试 5 次，每次间隔 100ms
    - 使用 requestAnimationFrame 确保在下一帧执行
    - _Requirements: 2.3, 1.3_
  - [x] 5.5 实现 BFCache 支持
    - 监听 pageshow 事件
    - 检测 event.persisted 标志
    - 从 LocalStorage 恢复滚动位置
    - _Requirements: 2.5, 8.5_

- [x] 6. 实现 PC 滚动恢复器

  - [x] 6.1 创建 PCScrollRestorer 类
    - 实现 restore() 主恢复方法
    - 使用 RAF 循环进行滚动
    - 实现位置验证和容差检查
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 6.2 实现 RAF 循环滚动算法
    - 获取 scrollingElement
    - 在 RAF 回调中设置滚动位置
    - 验证当前位置与目标位置的差距
    - 如果在容差范围内则完成，否则继续循环
    - 最多循环 40 次
    - _Requirements: 1.2, 1.3, 4.1_
  - [x] 6.3 实现等待内容加载逻辑
    - 检查 document.body.scrollHeight > window.innerHeight
    - 检查是否有搜索结果
    - 最多等待 3.5 秒
    - 每 100ms 检查一次
    - _Requirements: 4.3_

- [x] 7. 实现滚动位置管理器（统一接口）

  - [x] 7.1 创建 ScrollPositionManager 类
    - 集成 PlatformDetector
    - 集成 ScrollPositionCache
    - 集成 NavigationLockManager
    - 集成 IOSScrollRestorer 和 PCScrollRestorer
    - _Requirements: 1.1, 1.2_
  - [x] 7.2 实现 getCurrentScrollPosition() 方法
    - 使用多种方法获取滚动位置
    - 返回第一个非零值或最大值
    - 更新内存缓存
    - _Requirements: 3.3, 3.5_
  - [x] 7.3 实现 setScrollPosition() 方法
    - 根据平台选择恢复策略
    - iOS 使用 IOSScrollRestorer
    - PC 使用 PCScrollRestorer
    - 支持锚点定位选项
    - _Requirements: 1.1, 2.1, 6.5_
  - [x] 7.4 实现 saveScrollPosition() 方法
    - 检查导航锁状态
    - 实现小值回写保护
    - 保存到 LocalStorage
    - 保存 anchorKey（如果有）
    - _Requirements: 3.1, 3.4, 5.2, 6.1_
  - [x] 7.5 实现 restoreScrollPosition() 方法
    - 从 LocalStorage 加载保存状态
    - 检查状态是否过期（24 小时）
    - 根据平台调用相应的恢复器
    - 清除导航锁
    - _Requirements: 1.2, 2.1, 5.1_
  - [x] 7.6 实现 clearScrollPosition() 方法
    - 清除内存缓存
    - 清除 LocalStorage
    - 释放导航锁
    - _Requirements: 5.3_

- [x] 8. 优化搜索页面集成

  - [x] 8.1 重构现有滚动位置保存逻辑
    - 移除重复的滚动位置获取代码
    - 使用 ScrollPositionManager 统一管理
    - 简化 useEffect 依赖
    - _Requirements: 1.1, 4.5_
  - [x] 8.2 优化视频卡片点击处理
    - 在 VideoCard 组件中集成导航锁
    - 点击时立即捕获滚动位置
    - 保存 anchorKey 到状态
    - _Requirements: 3.1, 3.3, 6.1_
  - [x] 8.3 优化滚动恢复触发时机
    - 使用 useLayoutEffect 提前执行
    - 等待搜索结果加载完成
    - 根据平台选择恢复策略
    - _Requirements: 1.2, 4.1, 4.3_
  - [x] 8.4 优化浏览器原生行为控制
    - 设置 window.history.scrollRestoration = 'manual'
    - 临时禁用 CSS scroll-behavior: smooth
    - 恢复完成后还原设置
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 9. 实现页面可见性处理

  - [x] 9.1 添加 visibilitychange 事件监听
    - 页面隐藏时保存滚动位置
    - 页面可见时尝试恢复滚动位置
    - iOS 端增强恢复逻辑
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 9.2 添加 beforeunload 和 pagehide 事件监听
    - 页面卸载前保存滚动位置
    - 处理 BFCache 场景
    - _Requirements: 8.4, 8.5_
  - [x] 9.3 添加 popstate 事件监听
    - 检测浏览器后退导航
    - 触发滚动位置恢复
    - _Requirements: 8.1_

- [x] 10. 实现调试和监控功能

  - [x] 10.1 添加调试日志系统
    - 创建 DebugLogger 类
    - 通过 localStorage.enableDebugConsole 控制
    - 输出关键步骤和参数
    - 区分 iOS 和 PC 端日志
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 10.2 添加性能监控
    - 创建 MetricsCollector 类
    - 记录滚动恢复时间
    - 记录位置准确度
    - 记录成功率
    - _Requirements: 7.3_
  - [x] 10.3 添加开发环境调试信息
    - 在页面上显示实时滚动位置
    - 显示平台类型和状态
    - 显示待恢复位置
    - _Requirements: 7.4_

- [x] 11. 处理边界情况和错误

  - [x] 11.1 实现滚动位置边界检查
    - 检查目标位置是否超过最大可滚动高度
    - 自动调整到有效范围
    - _Requirements: 5.1_
  - [x] 11.2 实现小值回写保护
    - 检查当前值和之前保存值的差距
    - 如果当前值很小且之前有大值，忽略保存
    - _Requirements: 5.2_
  - [x] 11.3 实现错误处理和降级
    - 捕获 LocalStorage 异常
    - 捕获滚动操作异常
    - 静默处理错误，不影响用户体验
    - _Requirements: 5.4, 5.5_

- [x] 12. 优化搜索模式切换处理

  - [x] 12.1 保存和恢复 viewMode
    - 在保存状态时包含 viewMode
    - 恢复时先设置 viewMode
    - _Requirements: 10.1, 10.2_
  - [x] 12.2 处理模式切换时的滚动位置
    - 切换模式时清除滚动位置
    - 等待结果重新加载后再恢复
    - 确保锚点定位能找到正确元素
    - _Requirements: 10.3, 10.4, 10.5_

- [x] 13. 清理和重构现有代码

  - [x] 13.1 移除冗余的滚动位置处理代码
    - 删除重复的 getScrollTop 实现
    - 删除重复的 setScrollTop 实现
    - 统一使用 ScrollPositionManager
    - _Requirements: 1.1, 4.5_
  - [x] 13.2 简化 useEffect 依赖
    - 减少不必要的依赖项
    - 使用 useCallback 优化回调函数
    - 避免循环依赖
    - _Requirements: 4.5_
  - [x] 13.3 优化组件结构
    - 提取可复用的 hooks
    - 减少组件复杂度
    - 改善代码可读性
    - _Requirements: 4.5_

- [ ]\* 14. 编写测试

  - 编写 ScrollPositionManager 单元测试
  - 编写 PlatformDetector 单元测试
  - 编写 NavigationLockManager 单元测试
  - 编写端到端测试验证完整流程
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_

- [ ]\* 15. 编写文档
  - 更新 README 说明滚动恢复功能
  - 添加 API 文档
  - 添加故障排查指南
  - 添加性能优化建议
  - _Requirements: 7.1, 7.2_
