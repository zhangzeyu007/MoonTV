# 滚动位置恢复模块

这个模块提供了一套完整的滚动位置恢复解决方案，特别优化了 iOS Safari 的兼容性。

## 功能特性

- ✅ 自动保存和恢复滚动位置
- ✅ iOS Safari 特殊优化
- ✅ 锚点辅助定位
- ✅ 智能重试机制
- ✅ 导航锁保护
- ✅ 小值回写保护
- ✅ BFCache 支持
- ✅ 性能优化（RAF 节流）

## 快速开始

### 1. 在搜索页面中使用

```typescript
import { useScrollRestoration } from '@/hooks/useScrollRestoration';

function SearchPage() {
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  // 使用滚动恢复 Hook
  const {
    restorePosition,
    clearPosition,
    isIOS,
  } = useScrollRestoration({
    enabled: true,
    hasResults: showResults,
    resultsCount: searchResults.length,
  });

  // 在搜索结果加载完成后恢复滚动位置
  useEffect(() => {
    if (showResults && searchResults.length > 0) {
      // 延迟恢复，确保 DOM 已渲染
      setTimeout(() => {
        restorePosition();
      }, 100);
    }
  }, [showResults, searchResults.length, restorePosition]);

  // 清空搜索时清除滚动位置
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    clearPosition();
  };

  return (
    // ... 你的组件 JSX
  );
}
```

### 2. VideoCard 自动集成

VideoCard 组件已经自动集成了滚动位置保存功能。当用户点击视频卡片时，会自动：

1. 获取当前滚动位置
2. 设置导航锁
3. 保存滚动位置和锚点

无需额外配置！

## API 文档

### useScrollRestoration Hook

#### 参数

```typescript
interface UseScrollRestorationOptions {
  enabled?: boolean; // 是否启用滚动恢复，默认 true
  hasResults?: boolean; // 是否有搜索结果
  resultsCount?: number; // 搜索结果数量
  isLoading?: boolean; // 是否正在加载
}
```

#### 返回值

```typescript
interface UseScrollRestorationReturn {
  manager: ScrollPositionManager; // 滚动位置管理器实例
  savePosition: (anchorKey?: string) => void; // 保存当前滚动位置
  restorePosition: () => Promise<boolean>; // 恢复滚动位置
  clearPosition: () => void; // 清除保存的滚动位置
  getCurrentPosition: () => number; // 获取当前滚动位置
  lockNavigation: (position: number, anchorKey?: string) => void; // 设置导航锁
  unlockNavigation: () => void; // 释放导航锁
  isIOS: boolean; // 是否为 iOS 平台
}
```

## 核心模块

### ScrollPositionManager

统一管理滚动位置的获取、保存和恢复。

```typescript
import {
  ScrollPositionManager,
  platformDetector,
  navigationLockManager,
} from '@/lib/scroll-restoration';

const manager = new ScrollPositionManager(
  platformDetector,
  navigationLockManager
);

// 获取当前滚动位置
const position = manager.getCurrentScrollPosition();

// 保存滚动位置
manager.saveScrollPosition(position, 'anchor-key');

// 恢复滚动位置
await manager.restoreScrollPosition();

// 清除滚动位置
manager.clearScrollPosition();
```

### PlatformDetector

检测用户的浏览器平台和设备类型。

```typescript
import { platformDetector } from '@/lib/scroll-restoration';

const isIOS = platformDetector.isIOS();
const isSafari = platformDetector.isSafari();
const platform = platformDetector.getPlatform(); // 'ios' | 'android' | 'pc'
const supportsAPI = platformDetector.supportsAPI('scrollRestoration');
```

### NavigationLockManager

管理导航锁，防止跳转过程中的错误覆盖。

```typescript
import { navigationLockManager } from '@/lib/scroll-restoration';

// 设置导航锁
navigationLockManager.lock(1000, 'anchor-key');

// 检查是否已锁定
const isLocked = navigationLockManager.isLocked();

// 获取锁定的滚动位置
const position = navigationLockManager.getLockedPosition();

// 释放导航锁
navigationLockManager.unlock();
```

## 配置

默认配置在 `config.ts` 中定义：

```typescript
export const DEFAULT_CONFIG = {
  ios: {
    platform: 'ios',
    maxRetries: 5, // 最大重试次数
    retryInterval: 100, // 重试间隔（毫秒）
    tolerance: 10, // 位置容差（像素）
    useAnchor: true, // 是否启用锚点定位
    debug: false, // 是否启用调试日志
    updateInterval: 200, // 更新频率（毫秒）
  },
  pc: {
    platform: 'pc',
    maxRetries: 40,
    retryInterval: 0, // 使用 RAF
    tolerance: 8,
    useAnchor: false,
    debug: false,
    updateInterval: 100,
  },
};
```

## 常量

常用常量在 `constants.ts` 中定义：

```typescript
// LocalStorage 键名
export const STORAGE_KEYS = {
  SEARCH_PAGE_STATE: 'searchPageState',
  DEBUG_CONSOLE: 'enableDebugConsole',
};

// 时间常量（毫秒）
export const TIMING = {
  STATE_EXPIRY: 24 * 60 * 60 * 1000, // 24小时
  RECENT_STATE_THRESHOLD: 30 * 60 * 1000, // 30分钟
  MAX_WAIT_CONTENT: 3500, // 最大等待内容加载时间
  // ...
};

// 位置常量（像素）
export const POSITION = {
  SMALL_VALUE_THRESHOLD: 200, // 小值阈值
  SMALL_VALUE_DIFF: 200, // 小值差异
  IOS_TOLERANCE: 10, // iOS容差
  PC_TOLERANCE: 8, // PC容差
};
```

## 调试

启用调试日志：

```typescript
// 在浏览器控制台中
localStorage.setItem('enableDebugConsole', 'true');

// 或在代码中
if (typeof window !== 'undefined') {
  localStorage.setItem('enableDebugConsole', 'true');
}
```

调试日志会输出：

- 滚动位置的保存和恢复过程
- 平台检测结果
- 导航锁状态
- 重试次数和结果
- 性能指标

## 故障排查

### 滚动位置恢复失败

1. 检查是否启用了滚动恢复：`enabled: true`
2. 检查是否有保存的状态：查看 localStorage 中的 `searchPageState`
3. 检查是否有导航锁干扰：查看控制台日志
4. 检查页面内容是否已加载完成

### iOS Safari 特殊问题

1. 确保使用了 `window.scrollTo({ top, behavior: 'auto' })`
2. 检查是否同时设置了多个滚动属性
3. 查看重试日志，确认重试是否成功
4. 检查 BFCache 事件是否正确触发

### 性能问题

1. 检查滚动事件的触发频率
2. 确认 RAF 节流是否正常工作
3. 查看 LocalStorage 写入频率
4. 检查是否有内存泄漏

## 最佳实践

1. **在搜索结果加载完成后再恢复滚动位置**

   ```typescript
   useEffect(() => {
     if (showResults && searchResults.length > 0) {
       setTimeout(() => restorePosition(), 100);
     }
   }, [showResults, searchResults.length]);
   ```

2. **清空搜索时清除滚动位置**

   ```typescript
   const handleClearSearch = () => {
     clearPosition();
     // ... 其他清理逻辑
   };
   ```

3. **使用锚点辅助定位**

   ```typescript
   <div data-search-key={`item-${id}`}>
     <VideoCard anchorKey={`item-${id}`} />
   </div>
   ```

4. **处理页面可见性变化**
   Hook 已自动处理 `visibilitychange`、`beforeunload`、`pagehide` 等事件

## 浏览器兼容性

- iOS Safari 12+
- Chrome 80+
- Firefox 75+
- Edge 80+
- Safari 13+

对于不支持的浏览器，会自动降级为基本功能。
