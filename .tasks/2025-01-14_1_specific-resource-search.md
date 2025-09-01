# 背景

文件名：2025-01-14_1_specific-resource-search.md
创建于：2025-01-14_15:30:00
创建者：zhangzeyu
主分支：main
任务分支：task/specific-resource-search_2025-01-14_1
Yolo 模式：Off

# 任务描述

在本地设置页面添加指定资源搜索功能，要求显示 config.json 中所有的资源的名称， 支持勾选，支持多选， 可以指定多个资源模糊搜素 ，保留原有的聚合搜素功能，默认开启聚合搜素功能，默认隐藏指定搜索功能， 关闭聚合搜索按钮后， 才可以使用指定资源搜索功能，这个功能只能对搜索页面使用， 修改过程要考虑不能影响其他页面功能， ui 样式符合原有的风格

# 项目概览

MoonTV 是一个基于 Next.js 的影视搜索应用，使用 config.json 配置多个 API 资源站点，支持聚合搜索功能。项目使用 Tailwind CSS 进行样式设计，支持深色/浅色主题。现有设置页面使用 localStorage 存储用户偏好。

⚠️ 警告：永远不要修改此部分 ⚠️
核心 RIPER-5 协议规则：

1. 必须在每个响应的开头用方括号声明当前模式
2. 未经明确许可，不能在模式之间转换
3. 在 EXECUTE 模式中，必须 100%忠实地遵循计划
4. 在 REVIEW 模式中，必须标记即使是最小的偏差
5. 必须将分析深度与问题重要性相匹配
   ⚠️ 警告：永远不要修改此部分 ⚠️

# 分析

通过代码分析发现：

1. **配置文件结构**：config.json 包含 api_site 对象，每个站点有 key、api、name、detail 等属性
2. **搜索流程**：用户输入 → /api/search → 从所有启用的 API 站点获取结果 → 聚合显示
3. **设置系统**：已有 SettingsButton 组件，使用 localStorage 存储用户偏好
4. **UI 风格**：使用 Tailwind CSS，现代化开关组件，深色/浅色主题支持
5. **搜索 API**：/api/search/route.ts 调用 getAvailableApiSites()获取所有启用的站点
6. **下游处理**：downstream.ts 中的 searchFromApi 函数处理单个站点的搜索

需要修改的关键文件：

- src/components/SettingsButton.tsx：添加指定资源选择功能
- src/app/search/page.tsx：添加指定资源搜索逻辑
- src/app/api/search/route.ts：支持指定资源搜索参数
- src/lib/config.ts：可能需要添加获取所有资源（包括禁用）的函数

# 提议的解决方案

1. 在 SettingsButton 组件中添加指定资源选择区域
2. 使用 localStorage 存储用户选择的指定资源列表
3. 修改搜索页面，添加指定资源搜索的 UI 控制
4. 修改搜索 API，支持指定资源参数
5. 确保 UI 风格与现有设计保持一致

# 当前执行步骤："1. 创建任务文件"

# 任务进度

[2025-01-14 15:30:00]

- 已修改：创建任务文件
- 更改：创建了指定资源搜索功能的任务文件
- 原因：记录功能开发计划和项目分析结果
- 阻碍因素：无
- 状态：未确认

# 最终审查

[待完成]
