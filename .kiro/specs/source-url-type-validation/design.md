# 设计文档

## 概述

本设计解决源切换系统中的 URL 类型验证问题,防止因传递错误类型(数字而非字符串)导致的不可恢复播放器错误。系统将在切换前验证 URL 类型,在验证失败时触发适当的错误处理和用户恢复流程。

## 架构

### 组件关系图

```
┌─────────────────────────────────────────────────────────────┐
│                    AutoSourceSwitcher                        │
│  - 协调源切换流程                                             │
│  - 处理切换失败                                               │
│  - 触发恢复流程                                               │
└────────────┬────────────────────────────────┬────────────────┘
             │                                │
             ▼                                ▼
┌────────────────────────┐      ┌────────────────────────────┐
│  SourceSwitchExecutor  │      │  EnhancedSourceSelector    │
│  - URL类型验证         │      │  - 源有效性预检查          │
│  - 执行源切换          │      │  - 过滤无效源              │
│  - 状态恢复            │      │  - 性能数据管理            │
└────────────┬───────────┘      └────────────┬───────────────┘
             │                                │
             ▼                                ▼
┌────────────────────────┐      ┌────────────────────────────┐
│ PlayerRecoveryManager  │      │  SourcePerformanceDB       │
│  - 播放器重建          │      │  - 记录无效URL             │
│  - 显示恢复对话框      │      │  - 黑名单管理              │
└────────────────────────┘      └────────────────────────────┘
```

## 核心组件和接口

### 1. URL 验证器 (URLValidator)

新增独立的 URL 验证工具类:

```typescript
interface URLValidationResult {
  valid: boolean;
  url?: string;
  error?: string;
  errorType?: 'missing' | 'invalid_type' | 'malformed' | 'empty';
}

class URLValidator {
  /**
   * 验证并规范化源URL
   */
  static validateSourceURL(source: any): URLValidationResult;

  /**
   * 批量验证源列表
   */
  static validateSources(sources: any[]): {
    valid: any[];
    invalid: Array<{ source: any; error: string }>;
  };

  /**
   * 检查URL字符串格式
   */
  static isValidURLFormat(url: string): boolean;
}
```

### 2. SourceSwitchExecutor 增强

在 `performSwitch` 方法中添加验证逻辑:

```typescript
private async performSwitch(context: SwitchContext): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      // 1. 验证目标源URL
      const validation = URLValidator.validateSourceURL(context.targetSource);

      if (!validation.valid) {
        const error = new Error(
          `URL验证失败: ${validation.error} (类型: ${validation.errorType})`
        );
        (error as any).validationError = true;
        (error as any).errorType = validation.errorType;
        reject(error);
        return;
      }

      const targetUrl = validation.url!;

      // 2. 记录验证成功的URL
      console.log(`[SourceSwitchExecutor] URL验证通过: ${targetUrl}`);

      // 3. 设置超时保护
      this.switchTimeout = setTimeout(() => {
        reject(new Error('切换超时'));
      }, this.SWITCH_TIMEOUT);

      // 4. 执行切换
      if (typeof this.player.switchUrl === 'function') {
        this.player.switchUrl(targetUrl);
      } else {
        this.player.url = targetUrl;
      }

      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}
```

### 3. EnhancedSourceSelector 增强

在源评估阶段过滤无效源:

```typescript
public async evaluateSources(sources: any[]): Promise<SourceEvaluation[]> {
  const evaluations: SourceEvaluation[] = [];

  // 批量验证所有源
  const { valid, invalid } = URLValidator.validateSources(sources);

  // 记录无效源
  invalid.forEach(({ source, error }) => {
    const url = source.episodeUrl || source.url;
    console.warn(`[EnhancedSourceSelector] 源验证失败: ${url} - ${error}`);
    this.performanceDB.markSourceUnavailable(url, `url_validation_error: ${error}`);
  });

  // 只处理有效源
  for (const source of valid) {
    const episodeUrl = source.episodeUrl || source.url;

    // 检查黑名单
    if (this.performanceDB.isBlacklisted(episodeUrl)) {
      continue;
    }

    // 创建评估对象
    const perfData = this.performanceDB.getPerformanceData(episodeUrl);
    evaluations.push({
      source: source.source || source,
      episodeUrl,
      score: perfData ? this.calculateScore(perfData) : 50,
      pingTime: perfData?.lastPingTime || 0,
      successRate: perfData?.successRate || 0,
      lastUsedTime: perfData?.lastUsedTime || 0,
      errorCount: perfData?.failedAttempts || 0,
      available: perfData?.isAvailable !== false,
      priority: source.priority,
    });
  }

  evaluations.sort((a, b) => b.score - a.score);
  return evaluations;
}
```

### 4. AutoSourceSwitcher 错误处理增强

在 `performSwitch` 方法中处理验证错误:

```typescript
private async performSwitch(context: SwitchContext): Promise<boolean> {
  const startTime = Date.now();

  this.emit('switch-start', {
    from: context.currentSource,
    to: context.targetSource,
    reason: context.reason,
  });

  try {
    const success = await this.switchExecutor.switchSource(context);

    if (success) {
      // 成功处理逻辑...
      return true;
    } else {
      // 失败处理逻辑...
      return false;
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // 检查是否为验证错误
    if (error.validationError) {
      console.error('[AutoSourceSwitcher] URL验证错误:', error.message);

      // 标记源为不可用
      const targetUrl = context.targetSource?.episodeUrl || context.targetSource?.url;
      if (targetUrl) {
        this.sourceSelector.markSourceUnavailable(
          targetUrl,
          `validation_error: ${error.errorType}`
        );
      }

      // 记录失败
      this.statistics.recordSwitch({
        timestamp: Date.now(),
        fromSource: context.currentSource?.name || 'unknown',
        toSource: targetUrl || 'unknown',
        reason: context.reason,
        loadDuration: duration,
        success: false,
        errorMessage: error.message,
        networkQuality: this.loadingMonitor.getLoadingState().networkQuality,
      });

      // 触发失败事件
      this.emit('switch-failed', {
        source: context.targetSource,
        error: error.message,
        errorType: 'validation',
      });

      // 尝试下一个源
      return false;
    }

    // 其他错误类型的处理...
    throw error;
  }
}
```

### 5. 恢复流程集成

在 `handleAllSourcesFailed` 中触发手动恢复:

```typescript
private handleAllSourcesFailed(): void {
  console.error('[AutoSourceSwitcher] 所有源都已失败');

  this.stop();

  // 触发所有源失败事件
  this.emit('all-sources-failed', {
    triedSources: Array.from(this.triedSources),
    switchAttempts: this.switchAttempts,
  });

  // 显示手动恢复对话框
  this.showManualRecoveryDialog();
}

private showManualRecoveryDialog(): void {
  const availableSources = this.getAvailableSources()
    .filter(s => s.available)
    .slice(0, 5); // 最多显示5个源

  if (availableSources.length === 0) {
    // 没有可用源,显示致命错误
    showFatalError({
      title: '无可用播放源',
      message: '所有播放源都已失败,无法继续播放',
      suggestion: '请稍后重试或联系管理员',
    });
    return;
  }

  // 显示源选择对话框
  showSourceSelectionDialog({
    title: '自动切换失败',
    message: '自动源切换已尝试多次但均失败,请手动选择播放源',
    sources: availableSources,
    onSelect: async (source) => {
      const success = await this.manualSwitch(source.source);
      if (!success) {
        notifyUser('切换失败,请尝试其他源', 'error');
      }
    },
    onCancel: () => {
      showFatalError({
        title: '播放已停止',
        message: '您已取消源选择',
        suggestion: '请刷新页面重试',
      });
    },
  });
}
```

### 6. 新增源选择对话框组件

```typescript
interface SourceSelectionDialogConfig {
  title: string;
  message: string;
  sources: SourceEvaluation[];
  onSelect: (source: SourceEvaluation) => void;
  onCancel: () => void;
}

function showSourceSelectionDialog(config: SourceSelectionDialogConfig): void {
  // 创建对话框DOM
  // 显示可用源列表
  // 绑定选择和取消事件
}
```

## 数据模型

### URL 验证结果

```typescript
interface URLValidationResult {
  valid: boolean; // 是否有效
  url?: string; // 规范化后的URL
  error?: string; // 错误描述
  errorType?: 'missing' | 'invalid_type' | 'malformed' | 'empty';
}
```

### 扩展的切换记录

```typescript
interface SwitchRecord {
  timestamp: number;
  fromSource: string;
  toSource: string;
  reason: string;
  loadDuration: number;
  success: boolean;
  errorMessage?: string;
  errorType?: 'validation' | 'timeout' | 'network' | 'player'; // 新增
  networkQuality: NetworkQuality;
}
```

### 扩展的源性能数据

```typescript
interface SourcePerformanceData {
  // 现有字段...

  // 新增验证相关字段
  validationErrors: number; // 验证错误次数
  lastValidationError?: string; // 最后一次验证错误
  lastValidationErrorTime?: number; // 最后验证错误时间
}
```

## 错误处理

### 错误类型层次

```
播放器错误
├── 验证错误 (ValidationError)
│   ├── URL缺失 (missing)
│   ├── 类型错误 (invalid_type)
│   ├── 格式错误 (malformed)
│   └── 空字符串 (empty)
├── 切换错误 (SwitchError)
│   ├── 超时 (timeout)
│   └── 播放器错误 (player)
└── 网络错误 (NetworkError)
    ├── 加载超时 (loading_timeout)
    └── 连接失败 (connection_failed)
```

### 错误处理流程

```
URL验证失败
    ↓
标记源为不可用
    ↓
记录验证错误
    ↓
尝试下一个源
    ↓
所有源失败?
    ├─ 否 → 继续尝试
    └─ 是 → 显示手动恢复对话框
              ↓
         用户选择源?
              ├─ 是 → 手动切换
              └─ 否 → 显示致命错误
```

## 测试策略

### 单元测试

1. **URLValidator 测试**

   - 测试各种无效 URL 类型(数字、null、undefined、对象)
   - 测试有效 URL 格式
   - 测试边界情况(空字符串、特殊字符)

2. **SourceSwitchExecutor 测试**

   - 测试 URL 验证集成
   - 测试验证失败时的错误处理
   - 测试验证成功后的切换流程

3. **EnhancedSourceSelector 测试**
   - 测试源列表过滤
   - 测试无效源标记
   - 测试性能数据更新

### 集成测试

1. **端到端切换流程**

   - 模拟包含无效 URL 的源列表
   - 验证系统跳过无效源
   - 验证最终选择有效源

2. **错误恢复流程**

   - 模拟所有源验证失败
   - 验证手动恢复对话框显示
   - 验证用户手动选择源

3. **性能数据持久化**
   - 验证验证错误被正确记录
   - 验证黑名单功能
   - 验证数据在页面刷新后保持

### 手动测试场景

1. **场景 1: 单个源 URL 类型错误**

   - 设置一个源的 URL 为数字
   - 验证系统跳过该源并选择下一个

2. **场景 2: 所有源 URL 类型错误**

   - 设置所有源的 URL 为无效类型
   - 验证显示手动恢复对话框

3. **场景 3: 混合有效和无效源**
   - 设置部分源有效,部分无效
   - 验证系统只使用有效源

## 性能考虑

1. **验证性能**

   - URL 验证应该是同步且快速的操作
   - 批量验证使用单次遍历
   - 验证结果可缓存

2. **错误处理开销**

   - 验证失败时避免重复日志
   - 使用节流限制错误通知频率
   - 性能数据更新使用批处理

3. **内存管理**
   - 限制性能数据库记录数量
   - 定期清理过期的黑名单条目
   - 避免在错误对象中存储大量数据

## 安全考虑

1. **URL 注入防护**

   - 验证 URL 格式防止 XSS
   - 清理特殊字符
   - 限制 URL 长度

2. **错误信息泄露**

   - 用户界面显示通用错误消息
   - 详细错误仅记录到控制台
   - 不在客户端暴露服务器路径

3. **DoS 防护**
   - 限制验证失败重试次数
   - 实施指数退避策略
   - 防止无限循环验证
