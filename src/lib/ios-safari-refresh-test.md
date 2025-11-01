# iOS Safari 刷新功能测试指南

## 测试环境

- **设备**: iPhone/iPad
- **浏览器**: Safari
- **iOS 版本**: 建议 iOS 14+

## 测试步骤

### 1. 触发致命错误弹窗

在 iOS Safari 的开发者控制台中执行：

```javascript
// 方法1：使用测试函数（开发模式）
window.testFatalError();

// 方法2：手动触发错误
window.showFatalError({
  title: 'iOS Safari 刷新测试',
  message: '测试刷新功能是否正常工作',
  suggestion: '点击下方按钮测试刷新',
  enableCleanup: true,
  refreshTimeout: 3000,
  showFallbackButton: true,
});
```

### 2. 测试标准刷新按钮

1. 点击"刷新页面"按钮
2. 观察按钮状态变化（应显示"正在刷新..."）
3. 页面应该立即刷新

**预期结果**:

- ✅ 按钮立即变为禁用状态
- ✅ 按钮文本变为"正在刷新..."
- ✅ 页面在 1 秒内刷新
- ✅ 控制台显示 "检测到 iOS Safari，使用兼容刷新方式"

### 3. 测试强制刷新按钮

1. 再次触发错误弹窗
2. 点击"强制刷新"按钮
3. 观察页面刷新行为

**预期结果**:

- ✅ 页面 URL 带有时间戳参数 `?_refresh=xxxxx`
- ✅ 页面立即刷新
- ✅ 控制台显示 "iOS Safari: 使用带时间戳的 URL 刷新"

### 4. 测试清理功能

在触发错误前，创建一些资源：

```javascript
// 创建定时器
const timer1 = setTimeout(() => console.log('timer1'), 10000);
const timer2 = setInterval(() => console.log('timer2'), 1000);

// 创建事件监听器
window.addEventListener('test', () => console.log('test'));

// 触发错误弹窗
window.testFatalError();

// 点击刷新按钮，观察控制台
// 应该看到清理报告
```

**预期结果**:

- ✅ 控制台显示 "🧹 执行清理..."
- ✅ 控制台显示清理报告，包含停止的定时器数量
- ✅ 页面刷新前所有资源被清理

## 常见问题

### Q1: 点击刷新按钮后没有反应

**检查**:

1. 打开 Safari 开发者工具（设置 > Safari > 高级 > 网页检查器）
2. 查看控制台是否有错误
3. 确认是否看到 "检测到 iOS Safari" 的日志

**可能原因**:

- iOS 版本过低（< iOS 12）
- 浏览器不是原生 Safari
- 页面在 iframe 中运行

### Q2: 刷新后页面状态丢失

这是正常行为。页面刷新会重新加载所有资源。如果需要保持状态：

- 使用 localStorage 保存关键数据
- 使用 URL 参数传递状态

### Q3: 强制刷新添加了时间戳参数

这是预期行为。时间戳参数用于：

- 绕过浏览器缓存
- 确保获取最新的页面内容
- 提高刷新成功率

## 调试技巧

### 1. 查看用户代理

```javascript
console.log('User Agent:', navigator.userAgent);
console.log(
  '是否为 iOS Safari:',
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    /WebKit/.test(navigator.userAgent) &&
    !/CriOS|Chrome/.test(navigator.userAgent)
);
```

### 2. 监控刷新过程

```javascript
// 在刷新前执行
window.addEventListener('beforeunload', (e) => {
  console.log('页面即将卸载');
});

window.addEventListener('unload', (e) => {
  console.log('页面正在卸载');
});
```

### 3. 测试不同的刷新策略

```javascript
// 测试标准刷新
const executor = window.getRefreshExecutor?.(window.refreshCleanupManager);
if (executor) {
  executor.standardRefresh();
}

// 测试强制刷新
if (executor) {
  executor.forceRefresh();
}

// 测试导航刷新
if (executor) {
  executor.navigationRefresh();
}
```

## 性能测试

### 测量刷新响应时间

```javascript
let clickTime = 0;

document.getElementById('error-refresh-btn')?.addEventListener('click', () => {
  clickTime = performance.now();
  console.log('点击时间:', clickTime);
});

window.addEventListener('beforeunload', () => {
  const responseTime = performance.now() - clickTime;
  console.log('响应时间:', responseTime, 'ms');

  // 预期: < 100ms
  if (responseTime < 100) {
    console.log('✅ 响应时间优秀');
  } else if (responseTime < 200) {
    console.log('⚠️ 响应时间可接受');
  } else {
    console.log('❌ 响应时间过慢');
  }
});
```

## 兼容性检查清单

- [ ] iPhone Safari (iOS 14+)
- [ ] iPhone Safari (iOS 15+)
- [ ] iPhone Safari (iOS 16+)
- [ ] iPhone Safari (iOS 17+)
- [ ] iPad Safari (iPadOS 14+)
- [ ] iPad Safari (iPadOS 15+)
- [ ] iPad Safari (iPadOS 16+)
- [ ] iPad Safari (iPadOS 17+)

## 测试报告模板

```
测试日期: ____________________
设备型号: ____________________
iOS 版本: ____________________
Safari 版本: __________________

测试结果:
[ ] 标准刷新按钮正常工作
[ ] 强制刷新按钮正常工作
[ ] 清理功能正常执行
[ ] 响应时间 < 100ms
[ ] 无控制台错误

问题记录:
_________________________________
_________________________________
_________________________________

备注:
_________________________________
_________________________________
_________________________________
```

## 自动化测试（可选）

如果有 iOS 自动化测试环境，可以使用以下脚本：

```javascript
// Puppeteer 或 Playwright 测试脚本示例
async function testIOSSafariRefresh() {
  // 1. 打开页面
  await page.goto('https://your-app.com/play');

  // 2. 触发错误
  await page.evaluate(() => {
    window.testFatalError();
  });

  // 3. 等待弹窗出现
  await page.waitForSelector('.player-fatal-error');

  // 4. 点击刷新按钮
  const startTime = Date.now();
  await page.click('#error-refresh-btn');

  // 5. 等待页面刷新
  await page.waitForNavigation();
  const endTime = Date.now();

  // 6. 验证结果
  const responseTime = endTime - startTime;
  console.log('刷新响应时间:', responseTime, 'ms');

  return responseTime < 1000; // 应该在1秒内完成
}
```

## 总结

iOS Safari 的刷新功能现在应该能够正常工作。关键改进包括：

1. **同步执行**: 在用户手势上下文中立即执行刷新
2. **兼容方法**: 使用 `window.location.assign()` 而不是 `reload()`
3. **自动检测**: 自动识别 iOS Safari 并使用兼容策略
4. **清理优化**: 在刷新前快速清理资源

如果遇到任何问题，请查看控制台日志并参考上述故障排查指南。
