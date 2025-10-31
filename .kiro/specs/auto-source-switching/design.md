# 设计文档

## 概述

本设计文档描述了视频播放器自动源切换功能的实现方案。该功能通过监控视频加载状态，在加载时间超过阈值时自动切换到备用播放源，从而提升用户观看体验。设计采用模块化架构，与现有的智能源选择器、备用源管理器和性能监控系统无缝集成。

## 架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      播放器层                                │
│              (Artplayer 实例)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  加载监控层                                  │
│  • 加载状态跟踪                                              │
│  • 超时检测                                                  │
│  • 网络质量感知                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  切换决策层                                  │
│  • 切换条件评估                                              │
│  • 冷却期管理                                                │
│  • 错误计数跟踪                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  源选择层                                    │
│  • 智能源评估                                                │
│  • 备用源生成                                                │
│  • 历史数据分析                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  源切换执行层                                │
│  • 状态保存                                                  │
│  • 源切换                                                    │
│  • 状态恢复                                                  │
│  • 用户反馈                                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  统计与日志层                                │
│  • 切换历史记录                                              │
│  • 性能统计                                                  │
│  • 错误分析                                                  │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计决策

1. **渐进式超时策略**: 根据网络质量动态调整超时阈值，避免过早或过晚切换
2. **智能冷却机制**: 防止频繁切换源造成的体验下降，同时允许致命错误立即切换
3. **状态保持**: 切换过程中保持播放进度、音量等所有播放器状态
4. **错误分类**: 区分不同类型的加载失败，采取相应的恢复策略
5. **历史学习**: 记录每个源的性能数据，优化后续选择
6. **用户控制**: 提供手动切换选项，不完全依赖自动化

## 组件和接口

### 1. LoadingMonitor (加载监控器)

**职责**: 监控视频加载状态和时间

```typescript
interface LoadingState {
  isLoading: boolean;
  loadStartTime: number;
  loadDuration: number;
  loadingStage: 'initial' | 'buffering' | 'seeking' | 'ready';
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

interface LoadingMonitor {
  // 开始监控加载
  startMonitoring(videoElement: HTMLVideoElement): void;

  // 停止监控
  stopMonitoring(): void;

  // 获取当前加载状态
  getLoadingState(): LoadingState;

  // 检查是否超时
  isLoadingTimeout(): boolean;

  // 获取超时阈值（根据网络质量）
  getTimeoutThreshold(): number;

  // 重置监控状态
  reset(): void;
}
```

**实现要点**:

- 监听 `loadstart`、`waiting`、`canplay`、`playing` 等事件
- 记录加载开始时间戳
- 实时计算加载时长
- 根据网络质量动态调整超时阈值
- 区分初始加载和播放中缓冲

### 2. SwitchDecisionMaker (切换决策器)

**职责**: 评估是否应该切换源

```typescript
interface SwitchConditions {
  isLoadingTimeout: boolean;
  isCooldownExpired: boolean;
  hasMinimumAttemptTime: boolean;
  hasEnoughErrors: boolean;
  hasAvailableBackups: boolean;
}

interface SwitchDecisionMaker {
  // 评估是否应该切换源
  shouldSwitchSource(): boolean;

  // 获取切换条件详情
  getSwitchConditions(): SwitchConditions;

  // 记录源切换
  recordSourceSwitch(): void;

  // 记录源错误
  recordSourceError(): void;

  // 重置决策状态
  reset(): void;

  // 获取冷却剩余时间
  getCooldownRemaining(): number;
}
```

**实现要点**:

- 实施多条件评估逻辑
- 管理 10 秒冷却期
- 跟踪每个源的错误计数
- 强制超时条件（6 秒）优先级最高
- 提供详细的决策理由日志

### 3. SourceSelector (源选择器)

**职责**: 选择最佳备用源

```typescript
interface SourceEvaluation {
  source: any;
  score: number;
  pingTime: number;
  successRate: number;
  lastUsedTime: number;
  errorCount: number;
  available: boolean;
}

interface SourceSelector {
  // 评估所有可用源
  evaluateSources(sources: any[]): Promise<SourceEvaluation[]>;

  // 选择最佳源
  selectBestSource(
    sources: any[],
    excludeSources?: Set<string>
  ): Promise<SourceEvaluation | null>;

  // 获取下一个备用源
  getNextBackupSource(): SourceEvaluation | null;

  // 更新源性能数据
  updateSourcePerformance(
    source: any,
    success: boolean,
    loadTime: number
  ): void;

  // 标记源为不可用
  markSourceUnavailable(source: any): void;

  // 重置源选择状态
  reset(): void;
}
```

**实现要点**:

- 集成智能源选择器（SmartSourceSelector）
- 考虑历史成功率和响应时间
- 优先选择未尝试过的源
- 维护源性能数据库
- 支持源黑名单机制

### 4. SourceSwitchExecutor (源切换执行器)

**职责**: 执行源切换操作

```typescript
interface SwitchContext {
  currentSource: any;
  targetSource: any;
  currentTime: number;
  volume: number;
  playbackRate: number;
  paused: boolean;
  reason: string;
}

interface SourceSwitchExecutor {
  // 执行源切换
  switchSource(context: SwitchContext): Promise<boolean>;

  // 保存播放器状态
  capturePlayerState(): SwitchContext;

  // 恢复播放器状态
  restorePlayerState(context: SwitchContext): Promise<void>;

  // 显示切换提示
  showSwitchNotification(
    message: string,
    type: 'info' | 'success' | 'error'
  ): void;

  // 检查是否正在切换
  isSwitching(): boolean;

  // 取消切换
  cancelSwitch(): void;
}
```

**实现要点**:

- 完整的状态捕获和恢复
- 平滑的切换过渡
- 2 秒切换超时保护
- 用户友好的提示信息
- 切换失败回滚机制

### 5. SwitchStatistics (切换统计器)

**职责**: 记录和分析切换数据

```typescript
interface SwitchRecord {
  timestamp: number;
  fromSource: string;
  toSource: string;
  reason: string;
  loadDuration: number;
  success: boolean;
  errorMessage?: string;
  networkQuality: string;
}

interface SourceStats {
  sourceName: string;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  averageLoadTime: number;
  successRate: number;
  lastUsedTime: number;
  errorReasons: Map<string, number>;
}

interface SwitchStatistics {
  // 记录切换事件
  recordSwitch(record: SwitchRecord): void;

  // 获取切换历史
  getSwitchHistory(limit?: number): SwitchRecord[];

  // 获取源统计数据
  getSourceStats(sourceName: string): SourceStats | null;

  // 获取所有源统计
  getAllSourceStats(): SourceStats[];

  // 导出统计数据
  exportStats(): string;

  // 清除历史数据
  clearHistory(): void;

  // 获取切换成功率
  getOverallSuccessRate(): number;
}
```

**实现要点**:

- 持久化存储切换历史（localStorage）
- 实时统计分析
- 集成到性能监控系统
- 支持数据导出
- 提供可视化数据接口

### 6. AutoSourceSwitcher (自动源切换器)

**职责**: 协调所有组件，提供统一的自动切换接口

```typescript
interface AutoSwitchConfig {
  enabled: boolean;
  timeoutThreshold: number;
  cooldownPeriod: number;
  minimumAttemptTime: number;
  errorThreshold: number;
  maxSwitchAttempts: number;
  networkAdaptive: boolean;
}

interface AutoSourceSwitcher {
  // 初始化自动切换
  initialize(
    player: any,
    sources: any[],
    config?: Partial<AutoSwitchConfig>
  ): void;

  // 启动自动切换
  start(): void;

  // 停止自动切换
  stop(): void;

  // 手动触发切换
  manualSwitch(targetSource?: any): Promise<boolean>;

  // 获取可用源列表
  getAvailableSources(): SourceEvaluation[];

  // 获取当前配置
  getConfig(): AutoSwitchConfig;

  // 更新配置
  updateConfig(config: Partial<AutoSwitchConfig>): void;

  // 获取切换统计
  getStatistics(): SwitchStatistics;

  // 重置切换器
  reset(): void;

  // 销毁切换器
  destroy(): void;
}
```

**实现要点**:

- 协调所有子组件
- 提供简单的 API 接口
- 支持配置热更新
- 自动清理资源
- 线程安全的状态管理

## 数据模型

### LoadingTimeoutConfig (加载超时配置)

```typescript
interface LoadingTimeoutConfig {
  // 基础超时时间（毫秒）
  baseTimeout: number;

  // 网络质量超时映射
  networkTimeouts: {
    excellent: number; // 6000ms
    good: number; // 6000ms
    fair: number; // 8000ms
    poor: number; // 10000ms
  };

  // 强制超时时间（无论网络质量）
  forceTimeout: number; // 6000ms

  // 缓冲超时时间（播放中）
  bufferingTimeout: number; // 8000ms
}
```

### SwitchCooldownConfig (切换冷却配置)

```typescript
interface SwitchCooldownConfig {
  // 标准冷却期（毫秒）
  standardCooldown: number; // 10000ms

  // 最小源尝试时间（毫秒）
  minimumAttemptTime: number; // 5000ms

  // 错误阈值
  errorThreshold: number; // 3次

  // 致命错误立即切换
  fatalErrorImmediateSwitch: boolean; // true
}
```

### SourcePerformanceData (源性能数据)

```typescript
interface SourcePerformanceData {
  // 源标识
  sourceId: string;
  sourceName: string;
  sourceUrl: string;

  // 性能指标
  averageLoadTime: number;
  minLoadTime: number;
  maxLoadTime: number;
  lastLoadTime: number;

  // 成功率
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number;

  // 错误统计
  errorTypes: Map<string, number>;
  lastError: string | null;
  lastErrorTime: number;

  // 使用历史
  firstUsedTime: number;
  lastUsedTime: number;
  usageCount: number;

  // 网络相关
  averagePingTime: number;
  lastPingTime: number;

  // 可用性
  isAvailable: boolean;
  unavailableReason: string | null;
  unavailableSince: number | null;
}
```

## 错误处理

### 错误分类

1. **初始加载超时（轻度）**:

   - 视频开始加载后 6 秒仍未就绪
   - 触发自动源切换
   - 不影响播放器稳定性

2. **播放中缓冲超时（中度）**:

   - 播放过程中缓冲超过 8 秒
   - 先尝试恢复当前源（重新加载片段）
   - 失败后触发源切换

3. **网络断开（中度）**:

   - 检测到网络离线
   - 暂停自动切换
   - 等待网络恢复后自动重试

4. **所有源失败（严重）**:

   - 所有可用源都已尝试且失败
   - 停止自动切换
   - 显示错误页面和手动选项

5. **HLS 严重错误（严重）**:
   - 媒体解码错误
   - 格式不支持
   - 立即切换源，不等待超时

### 错误恢复策略

```typescript
// 初始加载超时恢复
if (isInitialLoadingTimeout()) {
  console.log('检测到初始加载超时，开始切换源');

  // 1. 检查是否满足切换条件
  if (!shouldSwitchSource()) {
    console.log('不满足切换条件，继续等待');
    return;
  }

  // 2. 选择最佳备用源
  const nextSource = await sourceSelector.selectBestSource(
    availableSources,
    triedSources
  );

  if (!nextSource) {
    console.error('没有可用的备用源');
    showAllSourcesFailedError();
    return;
  }

  // 3. 执行源切换
  const success = await sourceSwitchExecutor.switchSource({
    currentSource: currentSource,
    targetSource: nextSource,
    currentTime: player.currentTime,
    volume: player.volume,
    playbackRate: player.playbackRate,
    paused: player.paused,
    reason: 'loading_timeout',
  });

  if (success) {
    console.log('源切换成功');
    switchStatistics.recordSwitch({
      timestamp: Date.now(),
      fromSource: currentSource.name,
      toSource: nextSource.source.name,
      reason: 'loading_timeout',
      loadDuration: loadingMonitor.getLoadingState().loadDuration,
      success: true,
      networkQuality: loadingMonitor.getLoadingState().networkQuality,
    });
  } else {
    console.error('源切换失败');
    // 记录失败并尝试下一个源
    switchStatistics.recordSwitch({
      timestamp: Date.now(),
      fromSource: currentSource.name,
      toSource: nextSource.source.name,
      reason: 'loading_timeout',
      loadDuration: loadingMonitor.getLoadingState().loadDuration,
      success: false,
      errorMessage: '切换失败',
      networkQuality: loadingMonitor.getLoadingState().networkQuality,
    });
  }
}

// 播放中缓冲超时恢复
if (isBufferingTimeout()) {
  console.log('检测到播放中缓冲超时');

  // 1. 先尝试恢复当前源
  const recovered = await tryRecoverCurrentSource();

  if (recovered) {
    console.log('当前源恢复成功');
    return;
  }

  // 2. 恢复失败，切换源
  console.log('当前源恢复失败，开始切换源');
  // ... 执行切换逻辑（同上）
}

// 网络断开恢复
if (isNetworkOffline()) {
  console.log('检测到网络断开，暂停自动切换');

  // 暂停播放器
  if (!player.paused) {
    player.pause();
  }

  // 等待网络恢复
  const networkRecovered = await waitForNetworkRecovery();

  if (networkRecovered) {
    console.log('网络已恢复，尝试恢复播放');

    // 重新加载当前源
    const recovered = await tryRecoverCurrentSource();

    if (recovered) {
      console.log('播放恢复成功');
      player.play();
    } else {
      console.log('播放恢复失败，切换源');
      // 执行源切换
    }
  }
}

// 所有源失败处理
if (allSourcesFailed()) {
  console.error('所有可用源都已失败');

  // 停止自动切换
  autoSourceSwitcher.stop();

  // 显示错误页面
  showAllSourcesFailedError({
    title: '无法播放视频',
    message: '所有播放源都不可用，请稍后重试',
    actions: [
      {
        label: '重新尝试',
        action: () => {
          // 重置所有源状态
          sourceSelector.reset();
          triedSources.clear();
          // 从第一个源重新开始
          autoSourceSwitcher.start();
        },
      },
      {
        label: '返回',
        action: () => {
          router.back();
        },
      },
    ],
  });
}
```

## 测试策略

### 单元测试

1. **LoadingMonitor 测试**:

   - 测试加载时间计算准确性
   - 测试超时检测逻辑
   - 测试网络质量感知
   - 测试不同加载阶段识别

2. **SwitchDecisionMaker 测试**:

   - 测试多条件评估逻辑
   - 测试冷却期管理
   - 测试错误计数跟踪
   - 测试强制超时优先级

3. **SourceSelector 测试**:

   - 测试源评分算法
   - 测试历史数据影响
   - 测试源黑名单机制
   - 测试并发源测试

4. **SourceSwitchExecutor 测试**:

   - 测试状态保存和恢复
   - 测试切换超时处理
   - 测试切换失败回滚
   - 测试用户提示显示

5. **SwitchStatistics 测试**:
   - 测试数据记录准确性
   - 测试统计计算正确性
   - 测试数据持久化
   - 测试数据导出功能

### 集成测试

1. **完整切换流程测试**:

   - 模拟加载超时触发切换
   - 验证源选择逻辑
   - 验证状态保持
   - 验证切换成功

2. **多次切换测试**:

   - 模拟连续多次切换
   - 验证冷却期生效
   - 验证源黑名单
   - 验证最终失败处理

3. **网络环境测试**:

   - 测试不同网络质量下的超时阈值
   - 测试网络断开恢复
   - 测试网络波动场景

4. **边界情况测试**:
   - 只有一个源的情况
   - 所有源都失败的情况
   - 切换过程中用户操作
   - 快速连续触发切换

### 端到端测试

1. **用户场景测试**:

   - 正常播放无需切换
   - 加载慢自动切换
   - 播放中卡顿切换
   - 手动切换源

2. **性能测试**:

   - 测试切换响应时间
   - 测试内存使用
   - 测试 CPU 占用
   - 测试长时间运行稳定性

3. **兼容性测试**:
   - 不同浏览器测试
   - 不同设备测试
   - 不同网络环境测试
   - 不同视频格式测试

## 性能优化

### 1. 监控优化

- 使用节流减少状态检查频率（每秒一次）
- 避免在监控中进行重排重绘
- 使用 requestAnimationFrame 优化 UI 更新
- 及时清理事件监听器

### 2. 切换优化

- 预加载备用源（在后台测试可用性）
- 使用 HLS 预加载优化切换速度
- 复用播放器实例，避免重建
- 批量更新播放器状态

### 3. 内存优化

- 限制切换历史记录数量（最多 100 条）
- 定期清理过期的性能数据
- 使用 WeakMap 存储临时数据
- 及时释放不再使用的资源

### 4. 网络优化

- 并发测试多个源（最多 3 个）
- 使用 HEAD 请求快速测试可用性
- 实施请求超时保护
- 复用 TCP 连接

## 浏览器兼容性

### 支持的浏览器

- Chrome/Edge (Chromium) 90+
- Safari 14+
- Firefox 88+
- iOS Safari 14+
- Android Chrome 90+

### 兼容性处理

```typescript
// 检测浏览器支持
function detectBrowserSupport(): {
  supportsHLS: boolean;
  supportsNativeHLS: boolean;
  supportsMediaSource: boolean;
} {
  const video = document.createElement('video');

  return {
    supportsHLS: Hls.isSupported(),
    supportsNativeHLS:
      video.canPlayType('application/vnd.apple.mpegurl') !== '',
    supportsMediaSource: 'MediaSource' in window,
  };
}

// 根据浏览器调整配置
function adjustConfigForBrowser(config: AutoSwitchConfig): AutoSwitchConfig {
  const support = detectBrowserSupport();

  // Safari 特殊处理
  if (isSafariBrowser()) {
    return {
      ...config,
      timeoutThreshold: config.timeoutThreshold + 2000, // Safari 加载较慢
      cooldownPeriod: config.cooldownPeriod + 2000,
    };
  }

  // 移动设备特殊处理
  if (isMobileDevice()) {
    return {
      ...config,
      timeoutThreshold: config.timeoutThreshold + 1000,
      networkAdaptive: true, // 移动设备更依赖网络自适应
    };
  }

  return config;
}
```

## 实施计划

### 阶段 1: 核心组件实现（2-3 天）

1. 实现 LoadingMonitor
2. 实现 SwitchDecisionMaker
3. 实现基础的切换逻辑

### 阶段 2: 源选择优化（1-2 天）

1. 增强 SourceSelector
2. 集成智能源选择器
3. 实现源性能数据库

### 阶段 3: 切换执行（1-2 天）

1. 实现 SourceSwitchExecutor
2. 实现状态保存和恢复
3. 实现用户反馈

### 阶段 4: 统计和日志（1 天）

1. 实现 SwitchStatistics
2. 集成到性能监控系统
3. 实现数据导出

### 阶段 5: 集成和测试（2-3 天）

1. 集成所有组件
2. 编写单元测试
3. 编写集成测试
4. 进行端到端测试

### 阶段 6: 优化和调试（1-2 天）

1. 性能优化
2. 浏览器兼容性测试
3. 用户体验优化
4. 文档完善

## 配置示例

```typescript
// 默认配置
const DEFAULT_AUTO_SWITCH_CONFIG: AutoSwitchConfig = {
  enabled: true,
  timeoutThreshold: 6000, // 6秒
  cooldownPeriod: 10000, // 10秒
  minimumAttemptTime: 5000, // 5秒
  errorThreshold: 3, // 3次错误
  maxSwitchAttempts: 5, // 最多尝试5个源
  networkAdaptive: true, // 启用网络自适应
};

// 使用示例
const autoSwitcher = new AutoSourceSwitcher();

autoSwitcher.initialize(artPlayer, availableSources, {
  enabled: true,
  timeoutThreshold: 6000,
  networkAdaptive: true,
});

autoSwitcher.start();

// 监听切换事件
autoSwitcher.on('switch-start', (event) => {
  console.log('开始切换源:', event);
});

autoSwitcher.on('switch-success', (event) => {
  console.log('切换成功:', event);
});

autoSwitcher.on('switch-failed', (event) => {
  console.error('切换失败:', event);
});

autoSwitcher.on('all-sources-failed', () => {
  console.error('所有源都失败了');
});
```

## 监控和调试

### 监控指标

1. **切换频率**: 每小时切换次数
2. **切换成功率**: 成功切换 / 总切换次数
3. **平均切换时间**: 从触发到完成的平均时间
4. **源性能排名**: 各源的平均加载时间和成功率
5. **网络质量分布**: 不同网络质量下的切换情况

### 调试工具

```typescript
// 开发模式调试工具
if (process.env.NODE_ENV === 'development') {
  // 全局调试对象
  window.autoSwitchDebug = {
    // 获取当前状态
    getState: () => autoSwitcher.getState(),

    // 强制触发切换
    forceSwitch: () => autoSwitcher.manualSwitch(),

    // 获取统计数据
    getStats: () => autoSwitcher.getStatistics(),

    // 模拟加载超时
    simulateTimeout: () => {
      loadingMonitor.simulateTimeout();
    },

    // 导出日志
    exportLogs: () => {
      return autoSwitcher.getStatistics().exportStats();
    },
  };

  console.log('自动源切换调试工具已加载: window.autoSwitchDebug');
}
```
