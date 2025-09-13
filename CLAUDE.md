# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MoonTV is a cross-platform movie and TV show aggregator player built with Next.js 14, Tailwind CSS, and TypeScript. It supports multi-source search, online playback, favorites synchronization, watch history, and local/cloud storage.

## Key Technologies

- Next.js 14 (App Router)
- Tailwind CSS 3
- TypeScript
- Redis/Upstash/D1 for data storage
- ArtPlayer and HLS.js for video playback

## Development Commands

### Start Development Server

```bash
pnpm dev
```

### Build Production Version

```bash
pnpm build
```

### Run Tests

```bash
pnpm test
pnpm test:watch
```

### Code Checking and Formatting

```bash
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

### Type Checking

```bash
pnpm typecheck
```

## Project Architecture

### Core Structure

- `src/app/` - Next.js App Router structure containing pages and API routes
- `src/lib/` - Core business logic, database abstraction, and utilities
- `src/components/` - Reusable React components
- `public/` - Static assets
- `scripts/` - Build and configuration scripts

### Main Features

1. **Multi-source Search**: Aggregates content from multiple video APIs with optional resource filtering
2. **User Management**: Supports registration, login, and role-based access control
3. **Playback Tracking**: Stores watch history and favorites for each user
4. **Admin Panel**: Dynamic configuration management via `/admin`
5. **Multiple Storage Backends**: localStorage, Redis, Upstash, Cloudflare D1

### Database Abstraction

The project uses a storage abstraction layer (`src/lib/db.ts`) to support multiple backends:

- LocalStorage (default for development)
- Redis (via `src/lib/redis.db.ts`)
- Upstash Redis (via `src/lib/upstash.db.ts`)
- Cloudflare D1 (via `src/lib/d1.db.ts`)

Storage type is determined by the `NEXT_PUBLIC_STORAGE_TYPE` environment variable.

### Configuration Management

Configuration is managed through `config.json` and can be overridden at runtime via the admin panel when using non-localStorage backends. Configuration includes API sources, cache settings, and site customization options.

### API Integration

Video sources are integrated through the standard Apple CMS V10 API format. The system fetches content from multiple sources simultaneously and aggregates results. The search API now supports resource filtering through the `resources` query parameter.

### Search Functionality

Search functionality has been enhanced to allow filtering by specific resources. The API endpoint `/api/search` now accepts an optional `resources` parameter, which is a comma-separated list of resource keys to specify the search scope.

## Deployment Options

Supported deployment platforms:

- Vercel
- Docker
- Cloudflare Pages

Storage options:

- localStorage (simplest, no persistence across devices)
- Redis/Upstash (recommended for multi-user deployments)
- Cloudflare D1 (for Cloudflare deployments)
