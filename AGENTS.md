# AGENTS.md

## Project Structure

- **App entry**: `src/app/page.tsx` (home page)
- **Layout**: `src/app/layout.tsx` (root layout with providers, header, footer)
- **API routes**: `src/app/api/` (auth, cron, user links)
- **Server code**: `src/server/` (db schema, actions, middleware, redis)
- **Components**: `src/components/` (ui, auth, links, layout, motion)

## Tech Stack

- **Framework**: Next.js 14 (PPR enabled)
- **DB**: SQLite via Drizzle ORM (Turso backend)
- **Auth**: NextAuth with GitHub/Google providers
- **Caching**: Upstash Redis (slug → URL mapping)
- **Styling**: Tailwind CSS (dark mode, HSL theme tokens)
- **Animation**: GSAP + Framer Motion
- **Form**: React Hook Form + Zod + safe-action

## Key Conventions

- **Component file**: Use `~` alias (e.g., `~/components/ui/button`)
- **Server-only code**: Wrap with `server-only` package
- **Dark mode**: Enabled by default (`class` mode, `dark` class on `<html>`)
- **Link shortening**: Middleware (`src/middleware.ts`) handles `/{slug}` → redirect + click count + Redis cache
- **Theme provider**: `ThemeProvider` wraps app with `defaultTheme="dark"`

## Critical Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run lint` | ESLint (ignores during build) |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:push` | Push schema to Turso |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:pull` | Pull schema from Turso |

## Environment Variables

Required (see `.env.example`):

- `TURSO_URL`, `TURSO_AUTH_TOKEN` (Turso DB)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (Redis)
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `GITHUB_ID`, `GITHUB_SECRET` (auth)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (auth)
- `DOMAIN_URL` (production only)
- `CRON_SECRET` (cron job)

## Gotchas

1. **Next.js ignores ESLint errors** during build (`ignoreDuringBuilds: true`)
2. **Middleware path matcher**: Excludes `/api/*`, `/_next/*`, static files
3. **NextAuth adapter**: Uses `@auth/drizzle-adapter` (not custom adapter)
4. **Generated migrations**: Stored in `drizzle/` folder (not in source)
5. **Env validation**: Use `SKIP_ENV_VALIDATION=1` to bypass in Docker

## Testing/Verification

- No test suite configured
- No CI workflows defined
- Type checking via `tsc` (not in scripts)
