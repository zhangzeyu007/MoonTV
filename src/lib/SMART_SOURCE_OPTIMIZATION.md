# 智能源优化系统

播放器智能搜索源算法优化功能的完整实现。

## 功能概述

### 核心优化

1. **自适应网络检测** - 根据网络质量动态调整测试策略
2. **优先级队列** - 基于历史数据智能排序播放源
3. **渐进式返回** - 边测试边返回，无需等待全部完成
4. **分层测试** - 缓存检查 → 快速测试 → 深度验证
5. **智能去重** - 自动识别和去除重复的播放源
6. **动态缓存** - 基于健康度的自适应缓存过期时间
7. **智能预热** - 后台预热热门播放源

## 快速开始

### 基础使用

```typescript
import {
  smartSourceSelector,
  SourceCandidate,
} from '@/lib/smart-source-optimization';

// 准备播放源
const sources: SourceCandidate[] = [
  { source: sourceObj1, episodeUrl: 'https://example.com/video1.m3u8' },
  { source: sourceObj2, episodeUrl: 'https://example.com/video2.m3u8' },
  // ...
];

// 方式1：渐进式选择（推荐）
for await (const result of smartSourceSelector.selectSourcesProgressive(
  sources,
  {
    mode: 'balanced',
    maxResults: 3,
  }
)) {
  console.log('找到可用源:', result.episodeUrl);
  // 立即使用这个源开始播放
  playVideo(result);
}

// 方式2：快速选择第一个可用源
const firstSource = await smartSourceSelector.selectFirstAvailable(sources);
if (firstSource) {
  playVideo(firstSource);
}

// 方式3：批量选择最佳源
const bestSources = await smartSourceSelector.selectBestSources(sources, 3);
console.log('最佳源列表:', bestSources);
```

### 高级配置

```typescript
import {
  smartSourceSelector,
  smartCachePreloader,
  fastSourceTester,
} from '@/lib/smart-source-optimization';

// 配置快速测试器
fastSourceTester.updateConfig({
  maxConcurrency: 8,
  quickTestTimeout: 3000,
  enableAdaptiveTimeout: true,
  enableDynamicConcurrency: true,
});

// 启动缓存预热
smartCachePreloader.startPreloading();

// 添加热门源
smartCachePreloader.addHotSource('https://popular-video.com/video.m3u8', 80);

// 查看预热统计
const stats = smartCachePreloader.getPreloadStats();
console.log('缓存命中率:', stats.cacheHitRate);
```

## 选择模式

### Fast 模式

- 找到 1 个可用源即停止
- 适用场景：快速播放，对源质量要求不高
- 平均耗时：< 500ms

### Balanced 模式（推荐）

- 找到 3 个高质量源或测试 50%的源后停止
- 适用场景：平衡速度和质量
- 平均耗时：< 2s

### Comprehensive 模式

- 测试所有源
- 适用场景：需要完整的源列表
- 平均耗时：取决于源数量

## 性能优化特性

### 1. 自适应超时

根据网络质量自动调整超时时间：

- 优秀网络（4G，RTT<100ms）：1.4 秒
- 良好网络（4G，RTT<200ms）：2 秒
- 一般网络（3G，RTT<500ms）：3 秒
- 较差网络（2G 或 RTT>500ms）：4 秒

### 2. 动态并发控制

根据网络质量自动调整并发数：

- 优秀网络：10 个并发
- 良好网络：8 个并发
- 一般网络：4 个并发
- 较差网络：2 个并发

### 3. 优先级计算

基于历史数据计算优先级（0-100 分）：

- 健康度：40%权重
- 速度：30%权重
- 新鲜度：20%权重
- 成功率：10%权重

### 4. 分层测试

三层测试策略，逐步验证：

- **Layer 1**：缓存检查（< 1ms）
- **Layer 2**：快速测试 HEAD 请求（< 500ms）
- **Layer 3**：深度验证 下载 10KB（< 2s，可选）

### 5. 智能去重

自动识别重复源：

- URL 规范化（移除时间戳、统一协议）
- 域名相似度检测
- 保留优先级最高的源

### 6. 动态缓存

基于健康度的自适应过期时间：

- 高健康度（>0.8）：30 分钟
- 中健康度（0.5-0.8）：15 分钟
- 低健康度（<0.5）：5 分钟

### 7. 智能预热

后台预热热门源：

- 自动识别热门源（访问次数 ≥2）
- 空闲时预热（用户无操作 30 秒后）
- 定期刷新（每 5 分钟）

## API 参考

### SmartSourceSelector

#### selectSourcesProgressive()

渐进式选择播放源，边测试边返回。

```typescript
async *selectSourcesProgressive(
  sources: SourceCandidate[],
  options?: Partial<SelectionOptions>
): AsyncIterableIterator<SourceResult>
```

#### selectFirstAvailable()

快速选择第一个可用源。

```typescript
async selectFirstAvailable(
  sources: SourceCandidate[]
): Promise<SourceResult | null>
```

#### selectBestSources()

批量选择多个最佳源。

```typescript
async selectBestSources(
  sources: SourceCandidate[],
  maxResults?: number
): Promise<SourceResult[]>
```

### SmartCachePreloader

#### startPreloading()

启动缓存预热。

```typescript
startPreloading(): void
```

#### stopPreloading()

停止缓存预热。

```typescript
stopPreloading(): void
```

#### addHotSource()

添加热门播放源。

```typescript
addHotSource(url: string, priority?: number): void
```

#### getPreloadStats()

获取预热统计信息。

```typescript
getPreloadStats(): PreloadStats
```

## 性能指标

### 目标性能

- 首个可用源返回时间：< 500ms
- 完整测试完成时间：< 2s
- 缓存命中率：> 70%
- 并发测试吞吐量：> 10 sources/s

### 实际测试结果

基于 100 个播放源的测试：

- Fast 模式：平均 350ms
- Balanced 模式：平均 1.2s
- Comprehensive 模式：平均 3.5s
- 缓存命中率：75%

## 兼容性

### 浏览器支持

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### 功能降级

- 不支持 Navigator.connection：使用默认网络质量
- 不支持 localStorage：降级为内存缓存
- 不支持 AsyncIterator：使用批量模式

## 最佳实践

### 1. 使用渐进式返回

```typescript
// ✅ 推荐：渐进式返回，快速响应
for await (const source of smartSourceSelector.selectSourcesProgressive(
  sources
)) {
  if (tryPlay(source)) break;
}

// ❌ 不推荐：等待所有测试完成
const allSources = await smartSourceSelector.selectBestSources(sources);
```

### 2. 启用缓存预热

```typescript
// 应用启动时
smartCachePreloader.startPreloading();

// 用户访问视频时
smartCachePreloader.addHotSource(videoUrl);
```

### 3. 合理配置模式

```typescript
// 首次播放：使用 fast 模式
const firstSource = await smartSourceSelector.selectFirstAvailable(sources);

// 切换源：使用 balanced 模式
for await (const source of smartSourceSelector.selectSourcesProgressive(
  sources,
  {
    mode: 'balanced',
  }
)) {
  // ...
}
```

### 4. 监控性能

```typescript
// 定期检查统计信息
const stats = smartCachePreloader.getPreloadStats();
console.log('缓存命中率:', stats.cacheHitRate);
console.log('平均预热时间:', stats.averagePreloadTime);
```

## 故障排查

### 问题：测试速度慢

**可能原因**：

- 网络质量差
- 并发数过低
- 缓存未启用

**解决方案**：

```typescript
// 检查网络质量
const networkQuality = fastSourceTester.getNetworkQuality();
console.log('网络质量:', networkQuality);

// 增加并发数
fastSourceTester.updateConfig({ maxConcurrency: 10 });

// 启用缓存
fastSourceTester.updateConfig({ enableCache: true });
```

### 问题：缓存命中率低

**可能原因**：

- 缓存过期时间太短
- 热门源未添加
- 预热未启动

**解决方案**：

```typescript
// 延长缓存时间
sourceCache.updateConfig({ cacheExpiry: 30 * 60 * 1000 });

// 启动预热
smartCachePreloader.startPreloading();

// 手动添加热门源
hotVideos.forEach((url) => smartCachePreloader.addHotSource(url));
```

### 问题：内存占用高

**可能原因**：

- 缓存过多
- 热门源过多

**解决方案**：

```typescript
// 限制缓存大小
sourceCache.updateConfig({ maxCacheSize: 500 });

// 限制热门源数量
smartCachePreloader.updateConfig({ maxHotSources: 30 });

// 清理缓存
sourceCache.clearCache();
smartCachePreloader.clearHotSources();
```

## 更新日志

### v1.0.0 (2024-10-26)

- ✨ 初始版本发布
- ✨ 实现自适应网络检测
- ✨ 实现优先级队列
- ✨ 实现渐进式返回
- ✨ 实现分层测试
- ✨ 实现智能去重
- ✨ 实现动态缓存
- ✨ 实现智能预热

## 许可证

MIT
