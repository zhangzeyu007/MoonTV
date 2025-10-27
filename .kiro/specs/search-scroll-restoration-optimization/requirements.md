# Requirements Document

## Introduction

本文档定义了搜索页滚动位置恢复功能的优化需求。该功能旨在提升用户从视频播放页返回搜索页时的体验，确保能够流畅、准确地恢复到离开前的滚动位置，特别是在 Safari 移动端（iOS）上提供更好的兼容性和用户体验。

## Glossary

- **Search Page**: 搜索页面，用户搜索视频内容的页面
- **Scroll Position**: 滚动位置，页面在垂直方向上的滚动偏移量
- **Scroll Restoration**: 滚动位置恢复，从其他页面返回时恢复之前的滚动位置
- **iOS Safari**: 苹果移动设备上的 Safari 浏览器
- **BFCache**: 浏览器的前进/后退缓存机制
- **Navigation Lock**: 导航锁，防止在页面跳转过程中错误保存滚动位置的机制
- **Scroll Cache**: 滚动位置缓存，实时保存当前滚动位置的内存缓存
- **Anchor Positioning**: 锚点定位，通过 DOM 元素定位来辅助滚动恢复
- **Smooth Scrolling**: 平滑滚动，浏览器的滚动动画效果
- **RequestAnimationFrame**: 浏览器的帧动画 API，用于优化滚动操作
- **LocalStorage**: 浏览器本地存储，用于持久化保存滚动位置

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望从视频播放页返回搜索页时，能够立即看到我离开前浏览的位置，以便继续浏览其他视频而不需要重新滚动

#### Acceptance Criteria

1. WHEN 用户从搜索页点击视频卡片跳转到播放页时，THE Search Page SHALL 保存当前的精确滚动位置到本地存储
2. WHEN 用户从播放页返回搜索页时，THE Search Page SHALL 在 500 毫秒内恢复到之前保存的滚动位置
3. THE Search Page SHALL 在滚动位置恢复后，确保目标位置的误差不超过 10 像素
4. WHEN 滚动位置恢复完成时，THE Search Page SHALL 不产生可见的跳动或闪烁效果

### Requirement 2

**User Story:** 作为 iOS Safari 用户，我希望滚动位置恢复功能在我的设备上能够稳定工作，以便获得与其他平台一致的用户体验

#### Acceptance Criteria

1. WHEN 用户使用 iOS Safari 浏览器时，THE Search Page SHALL 使用 window.scrollTo 方法进行滚动恢复
2. THE Search Page SHALL 禁用浏览器的平滑滚动行为，使用 behavior: 'auto' 确保立即滚动
3. WHEN iOS Safari 的滚动恢复失败时，THE Search Page SHALL 自动重试最多 5 次，每次间隔 100 毫秒
4. THE Search Page SHALL 同时设置 document.body.scrollTop 和 document.documentElement.scrollTop 以提高兼容性
5. WHEN 页面从 BFCache 恢复时，THE Search Page SHALL 监听 pageshow 事件并重新触发滚动恢复

### Requirement 3

**User Story:** 作为用户，我希望系统能够准确捕获我点击视频卡片时的滚动位置，即使我在快速滚动过程中点击

#### Acceptance Criteria

1. THE Search Page SHALL 使用 requestAnimationFrame 实时更新滚动位置缓存
2. WHEN 用户滚动页面时，THE Search Page SHALL 在每一帧更新内存中的滚动位置缓存
3. WHEN 用户点击视频卡片时，THE Search Page SHALL 立即从内存缓存读取当前滚动位置并保存
4. THE Search Page SHALL 设置导航锁，防止在页面跳转过程中被错误的滚动事件覆盖保存的位置
5. THE Search Page SHALL 使用多种方法获取滚动位置（window.scrollY、document.documentElement.scrollTop、document.body.scrollTop、document.scrollingElement.scrollTop），并选择第一个非零值

### Requirement 4

**User Story:** 作为用户，我希望滚动位置恢复功能不会影响页面的正常加载速度和响应性能

#### Acceptance Criteria

1. THE Search Page SHALL 使用 useLayoutEffect 在 DOM 渲染前执行滚动恢复，避免可见的布局跳动
2. THE Search Page SHALL 限制滚动位置保存频率，在 iOS 上最多每 200 毫秒保存一次，在 PC 上最多每 100 毫秒保存一次
3. WHEN 页面内容尚未完全加载时，THE Search Page SHALL 等待内容加载完成后再执行滚动恢复
4. THE Search Page SHALL 在滚动恢复过程中不阻塞用户的其他交互操作
5. THE Search Page SHALL 使用异步方式处理滚动位置的保存和恢复，避免阻塞主线程

### Requirement 5

**User Story:** 作为用户，我希望系统能够智能处理各种边界情况，确保滚动位置恢复功能的稳定性

#### Acceptance Criteria

1. WHEN 保存的滚动位置超过页面最大可滚动高度时，THE Search Page SHALL 自动调整到最大可滚动位置
2. WHEN 保存的滚动位置小于 200 像素且之前保存的位置大于 200 像素时，THE Search Page SHALL 忽略小值回写，保留之前的大值
3. WHEN 用户主动进行新的搜索时，THE Search Page SHALL 清除之前保存的滚动位置
4. WHEN 本地存储失败时，THE Search Page SHALL 静默处理错误，不影响页面正常功能
5. WHEN 滚动位置恢复失败时，THE Search Page SHALL 记录错误日志但不向用户显示错误信息

### Requirement 6

**User Story:** 作为用户，我希望滚动位置恢复功能能够与锚点定位配合使用，提供更精确的位置恢复

#### Acceptance Criteria

1. WHEN 用户点击视频卡片时，THE Search Page SHALL 保存该卡片的唯一标识符（anchorKey）到本地存储
2. WHEN 从播放页返回时，THE Search Page SHALL 首先尝试使用 anchorKey 定位到目标元素
3. WHEN 锚点元素存在时，THE Search Page SHALL 使用 scrollIntoView 方法将元素滚动到视口顶部
4. WHEN 锚点定位完成后，THE Search Page SHALL 再使用精确的数值位置进行微调
5. WHEN 锚点元素不存在时，THE Search Page SHALL 直接使用数值位置进行滚动恢复

### Requirement 7

**User Story:** 作为开发者，我希望能够通过调试工具监控滚动位置恢复的过程，以便快速定位和解决问题

#### Acceptance Criteria

1. THE Search Page SHALL 提供调试开关，通过 localStorage 的 enableDebugConsole 标志控制
2. WHEN 调试开关启用时，THE Search Page SHALL 在控制台输出滚动恢复的关键步骤和参数
3. THE Search Page SHALL 记录滚动位置的保存时机、保存值、恢复时机和恢复结果
4. THE Search Page SHALL 在页面上显示实时的滚动位置信息（仅在开发环境）
5. THE Search Page SHALL 记录 iOS 和 PC 端的不同处理逻辑和执行路径

### Requirement 8

**User Story:** 作为用户，我希望滚动位置恢复功能能够处理页面可见性变化，确保在各种场景下都能正常工作

#### Acceptance Criteria

1. WHEN 页面从隐藏状态变为可见状态时，THE Search Page SHALL 检查是否需要恢复滚动位置
2. WHEN 用户切换浏览器标签页返回搜索页时，THE Search Page SHALL 尝试恢复滚动位置
3. THE Search Page SHALL 监听 visibilitychange 事件，在页面隐藏时保存滚动位置
4. THE Search Page SHALL 监听 beforeunload 和 pagehide 事件，确保在页面卸载前保存滚动位置
5. WHEN 页面通过 BFCache 恢复时，THE Search Page SHALL 监听 pageshow 事件并触发滚动恢复

### Requirement 9

**User Story:** 作为用户，我希望滚动位置恢复功能不会与浏览器的原生滚动恢复机制冲突

#### Acceptance Criteria

1. THE Search Page SHALL 在组件挂载时将 window.history.scrollRestoration 设置为 'manual'
2. THE Search Page SHALL 在组件卸载时恢复 window.history.scrollRestoration 的原始值
3. THE Search Page SHALL 临时禁用 CSS 的 scroll-behavior: smooth 属性，在滚动恢复时使用 'auto' 行为
4. THE Search Page SHALL 在滚动恢复完成后恢复 CSS 的 scroll-behavior 属性
5. THE Search Page SHALL 确保自定义滚动恢复逻辑优先于浏览器原生行为

### Requirement 10

**User Story:** 作为用户，我希望滚动位置恢复功能能够适应不同的搜索模式（聚合模式和全部模式），确保在切换模式后仍能正确恢复位置

#### Acceptance Criteria

1. THE Search Page SHALL 在保存滚动位置时同时保存当前的搜索模式（viewMode）
2. WHEN 从播放页返回时，THE Search Page SHALL 先恢复搜索模式，再恢复滚动位置
3. WHEN 用户切换搜索模式时，THE Search Page SHALL 清除之前保存的滚动位置
4. THE Search Page SHALL 在搜索结果重新加载完成后再执行滚动恢复
5. THE Search Page SHALL 确保在不同搜索模式下，锚点定位能够正确找到对应的元素
