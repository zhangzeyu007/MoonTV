# 播放进度保存优化修复总结

## 问题描述

播放页面播放器在滑动进度条时出现卡死现象，主要原因是进度保存功能与用户拖拽操作冲突。

## 问题根本原因

1. **频繁的进度保存**：`timeupdate`事件每 250ms 触发一次，导致频繁的进度保存操作
2. **拖拽期间冲突**：用户拖拽进度条时，`timeupdate`事件仍在触发，导致保存操作与用户操作冲突
3. **缺少 seek 事件处理**：没有监听`seeking`和`seeked`事件来暂停拖拽期间的进度保存

## 修复方案

### 1. 添加拖拽状态管理

```typescript
const isSeekingRef = useRef<boolean>(false);
const saveProgressDebounceRef = useRef<NodeJS.Timeout | null>(null);
```

### 2. 优化进度保存函数

- 添加防抖机制，避免过于频繁的保存操作
- 在拖拽期间暂停进度保存
- 区分立即保存和防抖保存两种模式

```typescript
const saveCurrentPlayProgress = async (immediate = false) => {
  // 如果正在拖拽，不保存
  if (isSeekingRef.current) {
    return;
  }

  // 防抖机制
  if (!immediate) {
    // 清除之前的防抖定时器
    if (saveProgressDebounceRef.current) {
      clearTimeout(saveProgressDebounceRef.current);
    }

    // 设置新的防抖定时器
    saveProgressDebounceRef.current = setTimeout(async () => {
      await performSaveProgress();
    }, 1000); // 1秒防抖延迟
    return;
  }

  await performSaveProgress();
};
```

### 3. 添加 seek 事件监听

```typescript
// 监听拖拽开始事件
artPlayerRef.current.on('video:seeking', () => {
  isSeekingRef.current = true;
  console.log('开始拖拽进度条');
});

// 监听拖拽结束事件
artPlayerRef.current.on('video:seeked', () => {
  isSeekingRef.current = false;
  console.log('结束拖拽进度条');
  // 拖拽结束后立即保存一次进度
  saveCurrentPlayProgress(true);
});
```

### 4. 优化保存时机

- 拖拽期间：暂停所有进度保存
- 拖拽结束：立即保存一次进度
- 暂停时：立即保存
- 页面卸载/隐藏：立即保存
- 正常播放：使用防抖机制，减少保存频率

## 修复效果

1. **解决卡死问题**：拖拽期间暂停进度保存，避免操作冲突
2. **提升流畅性**：减少不必要的保存操作，提升拖拽体验
3. **保持数据完整性**：在关键时机（拖拽结束、暂停、页面卸载）立即保存进度
4. **优化性能**：使用防抖机制，减少频繁的数据库操作

## 测试建议

1. 测试进度条拖拽是否流畅
2. 测试拖拽后进度是否正确保存
3. 测试暂停、页面切换时的进度保存
4. 测试长时间播放的进度保存频率

## 技术细节

- 使用`isSeekingRef`来跟踪拖拽状态
- 使用`saveProgressDebounceRef`实现防抖机制
- 区分立即保存和防抖保存两种模式
- 在组件卸载时清理所有定时器
