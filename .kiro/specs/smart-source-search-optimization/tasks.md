# Implementation Plan

- [x] 1. 优化现有快速源测试器核心功能

  - 实现自适应超时机制，根据网络质量动态调整超时时间
  - 优化并发控制逻辑，支持动态并发数调整
  - 添加网络质量检测功能，使用 Navigator.connection API
  - _Requirements: 1.1, 1.2, 6.1, 6.2_

- [x] 2. 实现优先级队列管理器

  - [x] 2.1 创建 PriorityQueueManager 类
    - 实现优先级计算算法（健康度 40%、速度 30%、新鲜度 20%、成功率 10%）
    - 实现队列构建和排序逻辑
    - 添加批量出队方法支持并发测试
    - _Requirements: 4.1, 4.2_
  - [x] 2.2 集成缓存数据到优先级计算
    - 从 Source Cache 读取历史数据
    - 计算源的健康度评分
    - 计算速度评分和新鲜度评分
    - _Requirements: 2.5, 4.2_

- [x] 3. 实现渐进式结果流

  - [x] 3.1 创建 Progressive Result Stream
    - 使用 AsyncIterableIterator 实现流式返回
    - 实现边测试边返回机制
    - 添加早期终止逻辑
    - _Requirements: 1.3, 7.1, 7.2_
  - [x] 3.2 修改 Smart Source Selector 支持渐进式返回
    - 添加 selectSourcesProgressive 方法
    - 实现 selectFirstAvailable 快速选择方法
    - 更新现有 selectBestSources 方法
    - _Requirements: 1.1, 7.3_

- [x] 4. 实现分层测试策略

  - [x] 4.1 创建 Multi-Layer Tester 类
    - 实现 Layer 1: 缓存检查逻辑
    - 实现 Layer 2: 快速测试（HEAD 请求）
    - 实现 Layer 3: 深度验证（可选）
    - _Requirements: 1.1, 1.2_
  - [x] 4.2 实现分层测试结果聚合
    - 定义 LayeredTestResult 数据模型
    - 实现最终评分计算逻辑
    - 添加测试耗时统计
    - _Requirements: 4.3, 8.1_

- [x] 5. 实现智能源去重器

  - [x] 5.1 创建 Source Deduplicator 类
    - 实现 URL 规范化算法
    - 实现去重逻辑（基于规范化 URL）
    - 保留优先级更高的重复源
    - _Requirements: 6.5_
  - [x] 5.2 集成到源选择流程
    - 在测试前执行去重
    - 记录去重统计信息
    - _Requirements: 8.2_

- [x] 6. 优化缓存策略

  - [x] 6.1 实现动态缓存过期时间
    - 基于健康度计算过期时间
    - 基于测试次数调整可靠性
    - 更新 Source Cache 配置
    - _Requirements: 2.3, 2.4_
  - [x] 6.2 实现智能缓存预热器
    - 创建 Smart Cache Preloader 类
    - 实现热门源识别算法（基于访问频率）
    - 实现后台预热任务调度
    - _Requirements: 2.1, 2.2_
  - [ ]\* 6.3 添加缓存统计和监控
    - 实现缓存命中率统计
    - 添加预热效果监控
    - 记录缓存性能指标
    - _Requirements: 8.2, 8.3_

- [x] 7. 实现 CDN 和地理位置优化

  - [x] 7.1 创建 Geo Router 类
    - 实现地理距离计算（Haversine 公式）
    - 实现基于地理位置的源排序
    - 集成到优先级计算中
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 7.2 优化 CDN Optimizer
    - 改进 CDN 节点选择算法
    - 添加 CDN 评分到综合评分中
    - 优化 CDN 缓存策略
    - _Requirements: 3.4, 3.5, 4.3_

- [x] 8. 实现综合评分算法

  - [x] 8.1 创建综合评分计算函数
    - 实现多维度评分（可用性 45%、延迟 30%、健康度 15%、地理 5%、CDN5%）
    - 实现延迟评分算法
    - 实现地理位置评分算法
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 8.2 集成到源选择流程
    - 更新 selectBestSources 使用新评分算法
    - 按综合评分排序源列表
    - _Requirements: 4.4, 4.5_

- [x] 9. 实现预测性预加载器

  - [x] 9.1 创建 Predictive Preloader 类
    - 实现下一集预测算法
    - 实现相似内容推荐算法
    - 实现后台预加载任务
    - _Requirements: 2.1_
  - [ ]\* 10.2 集成用户行为分析
    - 记录用户观看历史
    - 分析用户偏好模式
    - 优化预测准确率
    - _Requirements: 8.3_

- [x] 10. 实现负载均衡算法

  - [x] 10.1 创建源负载监控
    - 记录活跃连接数
    - 记录最近失败次数
    - 记录平均响应时间
    - _Requirements: 6.5_
  - [x] 10.2 实现负载均衡选择算法
    - 计算源负载评分
    - 避免过载源
    - 分散请求到多个源
    - _Requirements: 4.5_

- [x] 11. 添加性能监控和日志

  - [x] 11.1 实现 Performance Monitor 类
    - 记录首个源返回时间
    - 记录总测试时间
    - 记录可用源比率
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 11.2 添加详细日志输出
    - 记录测试开始和完成信息
    - 记录 CDN 优化统计
    - 记录缓存命中统计
    - _Requirements: 8.4, 8.5_
  - [ ]\* 12.3 实现性能指标上报
    - 计算 P50、P95、P99 指标
    - 上报到分析平台
    - 生成性能报告
    - _Requirements: 8.1_

- [x] 12. 优化错误处理和降级策略

  - [x] 12.1 实现 SourceTestError 错误类
    - 定义错误类型（timeout、network、cors、unknown）
    - 实现错误处理函数
    - 更新缓存标记失败源
    - _Requirements: 1.4, 6.4_
  - [x] 12.2 实现降级策略
    - 所有源失败时返回原始列表
    - localStorage 失败时降级为内存缓存
    - CDN 优化失败时使用原始 URL
    - _Requirements: 3.5, 6.4_

- [x] 13. 更新现有代码集成新功能

  - [x] 13.1 更新 fast-source-tester.ts
    - 集成优先级队列
    - 集成渐进式返回
    - 集成自适应超时
    - _Requirements: 1.1, 1.2, 6.1_
  - [x] 13.2 更新 source-cache.ts
    - 集成动态过期时间
    - 添加预热支持
    - 优化缓存清理逻辑
    - _Requirements: 2.3, 2.4_
  - [x] 13.3 更新 cdn-optimizer.ts
    - 集成地理路由
    - 优化 CDN 选择算法
    - 添加 CDN 评分
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 13.4 更新 backup-source-manager.ts
    - 集成负载均衡
    - 优化备用源生成
    - 添加智能切换逻辑
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 14. 创建统一的 Smart Source Selector 入口

  - [x] 14.1 创建 smart-source-selector.ts
    - 实现 SmartSourceSelector 类
    - 集成所有优化组件
    - 提供统一的 API 接口
    - _Requirements: 1.1, 4.1_
  - [x] 14.2 导出便捷函数
    - 导出 selectSourcesProgressive
    - 导出 selectFirstAvailable
    - 导出 selectBestSources
    - _Requirements: 7.1, 7.2, 7.3_

- [ ]\* 16. 编写文档和示例
  - 编写 API 使用文档
  - 添加代码注释
  - 创建使用示例
  - _Requirements: 8.4_
