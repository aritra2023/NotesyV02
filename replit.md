# Notesy

## Overview

Notesy is a mobile-first AI-powered study assistant web app. Students organize subjects and sessions, then chat with an AI tutor powered by Gemini. Tagline: "Ask. Learn. Dominate."

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + Radix UI + Framer Motion + Zustand
- **Backend**: Express 5 + Node.js 24
- **Database**: PostgreSQL + Drizzle ORM (for invite storage only)
- **AI**: Google Gemini 1.5 Flash (user-provided API key, proxied via Express)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Routing**: wouter
- **State**: Zustand (localStorage persistence)

## Key Features

- **Subjects & Sessions**: Organized sidebar with accordion-style subjects and sessions
- **AI Chat**: Full markdown rendering (react-markdown + remark-gfm) with Gemini AI
- **Answer Modes**: Exam, Short Answer, Explanation, Normal
- **Color Mode**: Cycles heading colors in AI responses (Black/Purple/Blue/Green)
- **Font Mode**: Cycles AI response font (Normal/Caveat/Patrick Hand/Satisfy)
- **YouTube Search Mode**: Opens YouTube search results for queries
- **Export PDF**: Chat → HTML → browser print dialog
- **Session Sharing**: Invite links (tokens stored in PostgreSQL)
- **API Key Modal**: User provides their own Gemini API key (stored in localStorage)
- **Auth on Join**: Name + email + password register/login on the invite join page

## Architecture

- **Frontend** (`artifacts/notesy/`): React + Vite SPA at `/`
- **API Server** (`artifacts/api-server/`): Express at `/api`
  - `POST /api/chat` — proxies to Gemini API with answer mode system prompts
  - `POST /api/generate-title` — auto-generates session title from first message
  - `POST /api/invite` — creates invite token in PostgreSQL
  - `GET /api/invite/:token` — retrieves invite info
- **Database** (`lib/db/`): Drizzle ORM schema, `invites` table
- **State**: Zustand store in localStorage (subjects, sessions, messages, settings)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
