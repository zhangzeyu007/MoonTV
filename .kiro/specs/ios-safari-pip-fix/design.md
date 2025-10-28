# Design Document

## Overview

本设计文档描述了 iOS Safari 画中画功能优化的技术方案。当前问题的根本原因是 iOS Safari 对画中画 API 的调用有严格的限制，特别是需要在有效的用户手势上下文中调用，并且视频元素必须处于就绪状态。本设计将通过改进 API 调用时机、增强错误处理和优化用户交互流程来解决这些问题。

## Architecture

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Play Page Component                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           PiP Detection & State Management            │  │
│  │  - Browser capability detection                       │  │
│  │  - PiP state tracking (active/inactive)               │  │
│  │  - Event listener management                          │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              PiP Control Handler                      │  │
│  │  - User gesture validation                            │  │
│  │  - Video readiness check                              │  │
│  │  - API selection (WebKit vs Standard)                 │  │
│  │  - Error handling & user feedback                     │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 UI Components                         │  │
│  │  - PiP toggle button                                  │  │
│  │  - Visual feedback (notifications)                    │  │
│  │  - Error messages                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Browser APIs Layer                        │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │  WebKit PiP API      │    │  Standard PiP API        │  │
│  │  (iOS Safari)        │    │  (Chrome, Firefox, etc)  │  │
│  │                      │    │                          │  │
│  │  - webkitSet         │    │  - requestPicture        │  │
│  │    PresentationMode  │    │    InPicture             │  │
│  │  - webkit            │    │  - exitPicture           │  │
│  │    presentationmode  │    │    InPicture             │  │
│  │    changed event     │    │  - enterpicture          │  │
│  │                      │    │    inpicture event       │  │
│  │                      │    │  - leavepicture          │  │
│  │                      │    │    inpicture event       │  │
│  └──────────────────────┘    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Video Element (HTML5)                      │
│  - Artplayer video instance                                  │
│  - HLS.js integration                                        │
│  - Playback state management                                 │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计决策

1. **API 优先级策略**: iOS Safari 环境下优先使用 WebKit 专用 API，其他环境使用标准 API
2. **用户手势保证**: 确保所有 PiP 操作都在用户手势的同步调用栈中执行
3. **视频就绪检测**: 在调用 PiP API 前验证视频元素的 readyState
4. **渐进式降级**: 当 PiP 不可用时提供友好的用户提示

## Components and Interfaces

### 1. PiP Detection Module

**职责**: 检测浏览器对画中画功能的支持情况

**接口**:

```typescript
interface PiPDetectionResult {
  isSupported: boolean;
  apiType: 'webkit' | 'standard' | 'none';
  requiresUserGesture: boolean;
}

function detectPiPSupport(): PiPDetectionResult;
```

**实现细节**:

- 检测`webkitSetPresentationMode`方法的存在（iOS Safari）
- 检测`document.pictureInPictureEnabled`属性（标准 API）
- 识别 iOS Safari 环境（需要特殊处理）
- 返回支持类型和约束条件

### 2. PiP State Manager

**职责**: 管理画中画状态和事件监听

**接口**:

```typescript
interface PiPState {
  isActive: boolean;
  isSupported: boolean;
  apiType: 'webkit' | 'standard' | 'none';
}

interface PiPStateManager {
  state: PiPState;
  initialize(videoElement: HTMLVideoElement): void;
  cleanup(): void;
  onStateChange(callback: (isActive: boolean) => void): void;
}
```

**实现细节**:

- 使用 React hooks 管理状态（useState）
- 监听`webkitpresentationmodechanged`事件（WebKit）
- 监听`enterpictureinpicture`和`leavepictureinpicture`事件（标准 API）
- 提供状态变化回调机制

### 3. PiP Control Handler

**职责**: 处理画中画的进入和退出操作

**接口**:

```typescript
interface PiPControlOptions {
  videoElement: HTMLVideoElement;
  apiType: 'webkit' | 'standard';
  onSuccess?: (mode: 'enter' | 'exit') => void;
  onError?: (error: PiPError) => void;
}

interface PiPError {
  code: 'NOT_SUPPORTED' | 'NOT_READY' | 'USER_GESTURE_REQUIRED' | 'UNKNOWN';
  message: string;
  suggestion: string;
}

async function togglePictureInPicture(
  options: PiPControlOptions
): Promise<void>;
```

**实现细节**:

#### iOS Safari 专用处理

```typescript
// 1. 检查视频就绪状态
if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
  // 等待视频元数据加载
  await waitForVideoReady(video, timeout);
}

// 2. 在用户手势上下文中同步调用
const currentMode = video.webkitPresentationMode;
const targetMode =
  currentMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture';

// 3. 直接调用，不使用async/await（保持同步性）
video.webkitSetPresentationMode(targetMode);
```

#### 标准 API 处理

```typescript
// 1. 检查视频就绪状态
if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
  await waitForVideoReady(video, timeout);
}

// 2. 调用标准API
if (document.pictureInPictureElement) {
  await document.exitPictureInPicture();
} else {
  await video.requestPictureInPicture();
}
```

### 4. Video Readiness Checker

**职责**: 确保视频元素在调用 PiP API 前处于就绪状态

**接口**:

```typescript
interface VideoReadinessOptions {
  minReadyState: number; // HTMLMediaElement.HAVE_METADATA or HAVE_CURRENT_DATA
  timeout: number; // 毫秒
}

function waitForVideoReady(
  video: HTMLVideoElement,
  options: VideoReadinessOptions
): Promise<void>;

function isVideoReady(video: HTMLVideoElement, minReadyState: number): boolean;
```

**实现细节**:

- 检查`video.readyState`属性
- iOS Safari 要求至少`HAVE_METADATA` (readyState >= 1)
- 标准 API 建议`HAVE_CURRENT_DATA` (readyState >= 2)
- 提供超时机制（默认 5 秒）
- 监听`loadedmetadata`和`canplay`事件

### 5. User Gesture Validator

**职责**: 验证操作是否在有效的用户手势上下文中

**接口**:

```typescript
interface UserGestureContext {
  isValid: boolean;
  eventType?: string; // 'click', 'touchend', etc.
  timestamp: number;
}

function validateUserGesture(): UserGestureContext;
```

**实现细节**:

- iOS Safari 要求 PiP 操作必须在用户手势的同步调用栈中
- 避免在异步操作（setTimeout, Promise.then）后调用
- 记录手势事件类型和时间戳用于调试

### 6. Error Handler & User Feedback

**职责**: 处理错误并向用户提供反馈

**接口**:

```typescript
interface FeedbackOptions {
  type: 'success' | 'error' | 'warning';
  message: string;
  duration?: number; // 毫秒
}

function showFeedback(options: FeedbackOptions): void;

function handlePiPError(error: PiPError): void;
```

**错误类型和处理**:

| 错误代码              | 原因             | 用户提示                     | 技术处理                 |
| --------------------- | ---------------- | ---------------------------- | ------------------------ |
| NOT_SUPPORTED         | 浏览器不支持 PiP | "当前浏览器不支持画中画功能" | 隐藏 PiP 按钮            |
| NOT_READY             | 视频未就绪       | "视频加载中，请稍后再试"     | 等待视频就绪后重试       |
| USER_GESTURE_REQUIRED | 缺少用户手势     | "请直接点击按钮进入画中画"   | 确保在点击事件中同步调用 |
| PERMISSION_DENIED     | 用户拒绝权限     | "画中画权限被拒绝"           | 记录日志，不自动重试     |
| UNKNOWN               | 未知错误         | "切换画中画失败，请重试"     | 记录详细错误信息         |

## Data Models

### PiP Configuration State

```typescript
interface PiPConfiguration {
  // 检测结果
  detection: {
    isSupported: boolean;
    apiType: 'webkit' | 'standard' | 'none';
    browserInfo: {
      isIOSSafari: boolean;
      isSafari: boolean;
      isWebKit: boolean;
      userAgent: string;
    };
  };

  // 运行时状态
  runtime: {
    isActive: boolean;
    lastToggleTime: number;
    errorCount: number;
    lastError: PiPError | null;
  };

  // 配置选项
  options: {
    enableAutoRetry: boolean;
    maxRetryAttempts: number;
    videoReadyTimeout: number;
    debugMode: boolean;
  };
}
```

### Video Element State

```typescript
interface VideoElementState {
  readyState: number;
  paused: boolean;
  currentTime: number;
  duration: number;
  networkState: number;
  error: MediaError | null;

  // WebKit specific
  webkitPresentationMode?: 'inline' | 'picture-in-picture' | 'fullscreen';
  webkitSupportsFullscreen?: boolean;
}
```

## Error Handling

### 错误处理策略

1. **分层错误处理**

   - API 层：捕获浏览器 API 异常
   - 业务层：处理业务逻辑错误
   - UI 层：向用户展示友好提示

2. **错误恢复机制**

   - 视频未就绪：等待并重试
   - 用户手势丢失：提示用户重新点击
   - 网络问题：建议刷新页面

3. **错误日志记录**
   ```typescript
   interface PiPErrorLog {
     timestamp: number;
     errorCode: string;
     errorMessage: string;
     browserInfo: BrowserInfo;
     videoState: VideoElementState;
     stackTrace?: string;
   }
   ```

### iOS Safari 特定错误处理

iOS Safari 的 PiP API 调用失败的常见原因：

1. **NotAllowedError**:

   - 原因：不在用户手势上下文中调用
   - 解决：确保在 click/touchend 事件处理器中同步调用

2. **InvalidStateError**:

   - 原因：视频元素未就绪或已销毁
   - 解决：检查 readyState 并等待视频加载

3. **NotSupportedError**:
   - 原因：视频格式不支持 PiP
   - 解决：检查视频编码格式，提示用户

## Testing Strategy

### 单元测试

1. **PiP 检测功能测试**

   - 测试不同浏览器环境的检测结果
   - 模拟 iOS Safari 环境
   - 验证 API 类型识别

2. **状态管理测试**

   - 测试状态初始化
   - 测试状态更新逻辑
   - 测试事件监听器的添加和移除

3. **错误处理测试**
   - 测试各种错误场景
   - 验证错误消息生成
   - 测试错误恢复逻辑

### 集成测试

1. **PiP 功能端到端测试**

   - 测试完整的进入/退出流程
   - 测试视频播放状态保持
   - 测试 UI 反馈

2. **跨浏览器兼容性测试**
   - iOS Safari (不同版本)
   - macOS Safari
   - Chrome (桌面和移动)
   - Firefox

### 手动测试清单

#### iOS Safari 测试

- [ ] 视频加载完成后点击画中画按钮
- [ ] 视频播放中点击画中画按钮
- [ ] 视频暂停时点击画中画按钮
- [ ] 画中画模式下切换集数
- [ ] 画中画模式下退出
- [ ] 快速连续点击画中画按钮
- [ ] 网络不稳定时使用画中画
- [ ] 切换到其他应用后返回

#### 其他浏览器测试

- [ ] 验证现有功能不受影响
- [ ] 测试标准 API 路径
- [ ] 测试错误提示一致性

## Implementation Notes

### 关键实现要点

1. **保持用户手势上下文**

   ```typescript
   // ❌ 错误：异步操作后调用
   button.onclick = async () => {
     await someAsyncOperation();
     video.webkitSetPresentationMode('picture-in-picture'); // 失败！
   };

   // ✅ 正确：同步调用
   button.onclick = () => {
     // 先同步调用PiP API
     video.webkitSetPresentationMode('picture-in-picture');

     // 然后执行其他异步操作
     someAsyncOperation().then(() => {
       // ...
     });
   };
   ```

2. **视频就绪检查优化**

   ```typescript
   // 对于iOS Safari，使用更宽松的就绪状态检查
   const minReadyState = isIOSSafari
     ? HTMLMediaElement.HAVE_METADATA // readyState >= 1
     : HTMLMediaElement.HAVE_CURRENT_DATA; // readyState >= 2
   ```

3. **事件监听器清理**

   ```typescript
   useEffect(() => {
     const video = artPlayerRef.current?.video;
     if (!video) return;

     const handler = () => {
       /* ... */
     };
     video.addEventListener('webkitpresentationmodechanged', handler);

     return () => {
       video.removeEventListener('webkitpresentationmodechanged', handler);
     };
   }, [artPlayerRef.current]);
   ```

4. **调试信息输出**
   ```typescript
   if (process.env.NODE_ENV === 'development') {
     console.log('[PiP Debug]', {
       apiType,
       readyState: video.readyState,
       currentMode: video.webkitPresentationMode,
       timestamp: Date.now(),
     });
   }
   ```

### 性能优化

1. **避免重复检测**: 缓存浏览器能力检测结果
2. **事件防抖**: 防止快速连续点击导致的问题
3. **懒加载**: 只在需要时初始化 PiP 相关功能

### 兼容性考虑

1. **iOS 版本兼容性**: iOS 9+支持 WebKit PiP API
2. **Safari 版本兼容性**: Safari 9+支持
3. **降级方案**: 不支持时隐藏功能，不影响其他功能

## Design Rationale

### 为什么优先使用 WebKit API？

iOS Safari 对 WebKit API 的支持更成熟，且是 Apple 推荐的方式。标准 API 在 iOS Safari 中可能存在兼容性问题。

### 为什么需要同步调用？

iOS Safari 的安全策略要求 PiP 操作必须在用户手势的同步调用栈中执行，任何异步操作都会导致用户手势上下文丢失。

### 为什么需要视频就绪检查？

未就绪的视频元素无法进入画中画模式，提前检查可以避免不必要的 API 调用失败和用户困惑。

### 为什么需要详细的错误处理？

画中画功能涉及多个浏览器 API 和用户权限，详细的错误处理可以帮助用户理解问题并采取正确的操作。
