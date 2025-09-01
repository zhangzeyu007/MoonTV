# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MoonTV is a cross-platform movie and TV show aggregation player built with Next.js 14, Tailwind CSS, and TypeScript. It supports multi-source searching, online playback, favorites synchronization, play history, and local/cloud storage.

## Key Technologies

- Next.js 14 (App Router)
- Tailwind CSS 3
- TypeScript
- Redis/Upstash/D1 for data storage
- ArtPlayer and HLS.js for video playback

## Development Commands

### Starting Development Server

```bash
pnpm dev
```

### Building for Production

```bash
pnpm build
```

### Running Tests

```bash
pnpm test
pnpm test:watch
```

### Linting and Formatting

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

- `src/app/` - Next.js App Router structure with pages and API routes
- `src/lib/` - Core business logic, database abstractions, and utilities
- `src/components/` - Reusable React components
- `public/` - Static assets
- `scripts/` - Build and configuration scripts

### Key Features

1. **Multi-source Search**: Aggregates content from multiple video APIs
2. **User Management**: Supports registration, login, and role-based access
3. **Playback Tracking**: Stores play history and favorites per user
4. **Admin Panel**: Dynamic configuration management via `/admin`
5. **Multiple Storage Backends**: localStorage, Redis, Upstash, Cloudflare D1

### Database Abstraction

The project uses a storage abstraction layer (`src/lib/db.ts`) that supports multiple backends:

- LocalStorage (default for development)
- Redis (via `src/lib/redis.db.ts`)
- Upstash Redis (via `src/lib/upstash.db.ts`)
- Cloudflare D1 (via `src/lib/d1.db.ts`)

Storage type is determined by the `NEXT_PUBLIC_STORAGE_TYPE` environment variable.

### Configuration Management

Configuration is managed through `config.json` and can be overridden at runtime via admin panel when using non-localStorage backends. The configuration includes API sources, cache settings, and site customization options.

### API Integration

Video sources are integrated via standard Apple CMS V10 API format. The system fetches content from multiple sources simultaneously and aggregates results.

## Deployment Options

Supports deployment to:

- Vercel
- Docker
- Cloudflare Pages

With storage options:

- localStorage (simplest, no persistence across devices)
- Redis/Upstash (recommended for multi-user deployments)
- Cloudflare D1 (for Cloudflare deployments)
