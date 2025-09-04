<!--
 * @Description:
 * @Author: 张泽雨
 * @Date: 2025-09-01 23:02:01
 * @LastEditors: 张泽雨
 * @LastEditTime: 2025-09-02 08:55:48
 * @FilePath: /MoonTV/CLAUDE.md
-->

# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

MoonTV 是一个基于 Next.js 14、Tailwind CSS 和 TypeScript 构建的跨平台影视聚合播放器。它支持多源搜索、在线播放、收藏同步、播放历史记录以及本地/云存储。

## 关键技术

- Next.js 14 (App Router)
- Tailwind CSS 3
- TypeScript
- Redis/Upstash/D1 用于数据存储
- ArtPlayer 和 HLS.js 用于视频播放

## 开发命令

### 启动开发服务器

```bash
pnpm dev
```

### 构建生产版本

```bash
pnpm build
```

### 运行测试

```bash
pnpm test
pnpm test:watch
```

### 代码检查和格式化

```bash
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

### 类型检查

```bash
pnpm typecheck
```

## 项目架构

### 核心结构

- `src/app/` - Next.js App Router 结构，包含页面和 API 路由
- `src/lib/` - 核心业务逻辑、数据库抽象和工具
- `src/components/` - 可复用的 React 组件
- `public/` - 静态资源
- `scripts/` - 构建和配置脚本

### 主要功能

1. **多源搜索**: 聚合来自多个视频 API 的内容，支持可选的资源过滤
2. **用户管理**: 支持注册、登录和基于角色的访问控制
3. **播放跟踪**: 为每个用户存储播放历史和收藏
4. **管理面板**: 通过 `/admin` 进行动态配置管理
5. **多种存储后端**: localStorage、Redis、Upstash、Cloudflare D1

### 数据库抽象

项目使用存储抽象层 (`src/lib/db.ts`) 来支持多种后端：

- LocalStorage (开发环境默认)
- Redis (通过 `src/lib/redis.db.ts`)
- Upstash Redis (通过 `src/lib/upstash.db.ts`)
- Cloudflare D1 (通过 `src/lib/d1.db.ts`)

存储类型由 `NEXT_PUBLIC_STORAGE_TYPE` 环境变量决定。

### 配置管理

配置通过 `config.json` 进行管理，在使用非 localStorage 后端时可通过管理面板在运行时覆盖。配置包括 API 源、缓存设置和站点自定义选项。

### API 集成

视频源通过标准的 Apple CMS V10 API 格式集成。系统同时从多个源获取内容并聚合结果。搜索 API 现在支持通过 `resources` 查询参数进行资源过滤。

### 搜索功能

搜索功能已增强，允许按特定资源进行过滤。API 端点 `/api/search` 现在接受一个可选的 `resources` 参数，该参数是以逗号分隔的资源键列表，用于指定搜索范围。

## 部署选项

支持部署到：

- Vercel
- Docker
- Cloudflare Pages

存储选项：

- localStorage (最简单，设备间无持久性)
- Redis/Upstash (推荐用于多用户部署)
- Cloudflare D1 (用于 Cloudflare 部署)
