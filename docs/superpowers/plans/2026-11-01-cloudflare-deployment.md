# MarLynk → Cloudflare Workers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy MarLynk to Cloudflare Workers at `marlynk.ammararief.my.id` with every feature working, and fix the guest-link migration bug that silently drops links older than 24 hours.

**Architecture:** OpenNext (`@opennextjs/cloudflare@1.15.x`) adapts the existing Next.js 14 build to a single Cloudflare Worker. Turso and Upstash stay unchanged because both are HTTP-based. No cache layer (R2/D1/Durable Objects) is configured because every route in the app is dynamic SSR. Cron moves from `vercel.json` to a Cloudflare Cron Trigger handled by a custom worker.

**Tech Stack:** Next.js 14.2.35, React 18, TypeScript 5, Drizzle ORM 0.30 (libsql/web), NextAuth v4, Upstash Redis REST, `@opennextjs/cloudflare` 1.15.x, Wrangler 4, `node:test` + `tsx` for the new unit tests.

**Spec:** `docs/superpowers/specs/2026-11-01-cloudflare-deployment-design.md`

## Global Constraints

- Target hostname: `marlynk.ammararief.my.id` — exact string, no trailing slash.
- Worker name: `marlynk`.
- `next` pinned to exactly `14.2.35` (not `^14.2.35`). OpenNext 1.15.x peer range is `next: ^14.2.35`; this also closes CVE-2025-29927.
- `@opennextjs/cloudflare` pinned to `1.15.0`. Version 1.16+ requires Next 15/16 and will not work here.
- Cron schedule: `0 0 * * *` (daily, UTC).
- No R2, D1, Durable Objects, or Queue bindings. R2 is not enabled on this account and is not needed.
- Secrets are never printed to the terminal or echoed into responses. They are read from `.env` and piped to Wrangler via stdin.
- Non-secret vars live in `wrangler.jsonc` under `vars` so they survive redeploys; secrets are set with `wrangler secret put` and persist independently.
- Do not change the Drizzle schema, the migration files in `drizzle/`, the middleware redirect logic, or the NextAuth provider configuration.
- Package manager is pnpm (lockfile `pnpm-lock.yaml`, lockfileVersion 9.0). Do not introduce `package-lock.json`.

## Review Focus

Five conditions the spec implies but no single task's happy-path test covers. Each has a test in the task that owns the code.

1. **Guest with links older than 24h signs in** — a reasonable user expects every link they made to follow them into their account, not just yesterday's. This is the bug being fixed; Task 1 pins it.
2. **Guest viewing their own list after the fix** — broadening the migration query must not broaden the guest display window. Links older than 24h must stay hidden from the guest view (they are dead there). Task 1 pins both directions.
3. **Redirect under the Worker runtime** — `/{slug}` is served by middleware that imports Drizzle and `@libsql/client/web`. A reasonable user expects a redirect, not a 500 from a bundling or runtime incompatibility. Task 4 pins it.
4. **App boot with env read at module init** — `src/env.js` validates `process.env` when `src/server/db/index.ts` is first imported. If Worker env is not populated before that import, the app fails to start rather than erroring per-request. Task 4 pins it.
5. **OAuth callback on the new hostname** — GitHub and Google reject a redirect URI that does not exactly match what is registered, surfacing as `redirect_uri_mismatch`. Task 5 pins the exact values.

---

### Task 1: Fix guest link migration dropping links older than 24 hours

**Files:**
- Create: `src/server/api/link-filters.ts`
- Create: `src/server/api/link-filters.test.ts`
- Modify: `src/server/api/link.ts:39-52` (`getLinksByUserLinkId`)
- Modify: `src/components/links/link-list.tsx:26-28` (guest call site)
- Modify: `src/server/auth.ts:70-72` (sign-in migration call site)
- Modify: `package.json` (add `test` script and `tsx` devDependency)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type LinkQueryOptions = { createdAfter?: Date }`
  - `function buildUserLinkWhere(userLinkId: string, options?: LinkQueryOptions): SQL`
  - `function getLinksByUserLinkId(userLinkId: string, options?: LinkQueryOptions): Promise<ShortLink[]>`

**Why the filter is extracted:** `src/server/api/link.ts` imports `~/server/db` at module load, which reads `TURSO_URL` through `src/env.js`. Importing it from a test would require live credentials. The predicate builder has no such dependency, so it lives in its own module and is tested directly.

- [ ] **Step 1: Add the test runner**

Install `tsx`:

```bash
pnpm add -D tsx@4.19.2
```

Then add to `scripts` in `package.json`:

```json
"test": "tsx --test \"src/**/*.test.ts\""
```

The glob is quoted so `tsx` expands it, not the shell. Verified: the quoted form runs, the unquoted form also runs under `sh` but breaks under `zsh` (no match error).

- [ ] **Step 2: Write the failing test**

Create `src/server/api/link-filters.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";

import { buildUserLinkWhere } from "~/server/api/link-filters";

const dialect = new SQLiteSyncDialect();
const render = (w: ReturnType<typeof buildUserLinkWhere>) => dialect.sqlToQuery(w);

test("omitting createdAfter filters only by userLinkId", () => {
  const q = render(buildUserLinkWhere("ul_1"));
  assert.match(q.sql, /"userLinkId"/);
  assert.doesNotMatch(q.sql, /created_at/);
  assert.deepEqual(q.params, ["ul_1"]);
});

test("passing createdAfter bounds the query to that instant", () => {
  const q = render(buildUserLinkWhere("ul_1", { createdAfter: new Date(1700000000000) }));
  assert.match(q.sql, /created_at/);
  assert.deepEqual(q.params, ["ul_1", 1700000000]);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '~/server/api/link-filters'`.

- [ ] **Step 4: Implement the predicate builder**

Create `src/server/api/link-filters.ts`:

```ts
import { and, eq, gte, type SQL } from "drizzle-orm";

import { links } from "~/server/db/schema";

export type LinkQueryOptions = { createdAfter?: Date };

/**
 * Builds the WHERE clause for a user's links.
 *
 * `createdAfter` is opt-in because the two callers need different windows:
 * the guest list must hide links past the guest TTL, while the sign-in
 * migration must move every guest link regardless of age.
 */
export function buildUserLinkWhere(
  userLinkId: string,
  options: LinkQueryOptions = {},
): SQL {
  const base = eq(links.userLinkId, userLinkId);

  if (!options.createdAfter) return base;

  // `and()` is typed `SQL | undefined`, but with two or more conditions it
  // always returns an SQL object at runtime.
  return and(base, gte(links.createdAt, options.createdAfter)) as SQL;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS — 2 tests.

- [ ] **Step 6: Rewire `getLinksByUserLinkId` to use the builder**

Replace lines 39-52 of `src/server/api/link.ts` with:

```ts
export async function getLinksByUserLinkId(
  userLinkId: string,
  options: LinkQueryOptions = {},
): Promise<ShortLink[]> {
  const shortLinks = await db.query.links.findMany({
    where: buildUserLinkWhere(userLinkId, options),
    orderBy: desc(links.createdAt),
  });
  return shortLinks;
}
```

Add the import at the top of the file:

```ts
import { type LinkQueryOptions, buildUserLinkWhere } from "~/server/api/link-filters";
```

Then narrow the `drizzle-orm` import on line 11. `and`, `gte`, and `lte` were used only by the old inline filter and must be dropped; `desc`, `eq`, and `sql` are still used elsewhere in the file:

```ts
import { desc, eq, sql } from "drizzle-orm";
```

`tsc --noEmit` will flag any import left behind, so Step 9 catches a mistake here.

- [ ] **Step 7: Keep the guest display window**

In `src/components/links/link-list.tsx`, replace the guest branch (lines 26-28) with:

```ts
    const createdAfter = new Date(Date.now() - GUEST_LINK_EXPIRE_TIME * 1000);
    return await getLinksByUserLinkId(userLinkIdCookie, { createdAfter });
```

Add the import:

```ts
import { GUEST_LINK_EXPIRE_TIME } from "~/lib/config";
```

`GUEST_LINK_EXPIRE_TIME` is in seconds; `Date` takes milliseconds, hence the `* 1000`.

- [ ] **Step 8: Let the sign-in migration take every guest link**

In `src/server/auth.ts`, the call at line 71 is inside the `existingUserLink` branch. Leave it as `getLinksByUserLinkId(userLinkIdCookie)` — no options — so it now returns links of any age. No edit is required to that line; verify it reads exactly that way after Step 6 changed the function's default.

Also confirm the sibling branch at lines 84-86 uses `getUserLinkById(userLinkIdCookie)`, which reads `userLink.links` from the relation and was never time-filtered. Both branches now migrate all links.

- [ ] **Step 9: Type-check the whole project**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. If `lte` is reported as an unused import in `src/server/api/link.ts`, remove it.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-lock.yaml src/server/api/link-filters.ts src/server/api/link-filters.test.ts src/server/api/link.ts src/components/links/link-list.tsx
git commit -m "$(cat <<'EOF'
fix: migrate all guest links on sign-in, not just the last 24h

getLinksByUserLinkId always applied a 24h window, which is correct for the
guest list (guest links expire) but wrong for the sign-in migration: links
older than a day were left behind and then deleted by cron.

The window is now opt-in via LinkQueryOptions.createdAfter. The guest list
passes it explicitly; the migration does not.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Upgrade Next.js and prepare the app for a non-Vercel runtime

**Files:**
- Modify: `package.json` (`next` version)
- Modify: `next.config.js`
- Modify: `src/app/layout.tsx`
- Delete: `vercel.json`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: a Next.js app that builds on `14.2.35` with no PPR flag, no Vercel-only analytics, and no image-optimizer dependency.

- [ ] **Step 1: Pin Next to 14.2.35**

```bash
pnpm add next@14.2.35
```

Verify the installed version:

```bash
node -p "require('./node_modules/next/package.json').version"
```

Expected: `14.2.35`

- [ ] **Step 2: Remove the PPR flag and disable image optimization**

In `next.config.js`, delete the entire `experimental: { ppr: true }` block and add `unoptimized: true` inside `images`. The file becomes:

```js
/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "t3.gstatic.com" }],
  },
};

export default config;
```

PPR is removed because no route sets `export const experimental_ppr`; the flag is inert. `unoptimized` is set because the only `<Image>` is a 16px favicon and Cloudflare Images bills per unique transformation.

- [ ] **Step 3: Drop Vercel Analytics**

In `src/app/layout.tsx`, delete the import line `import { Analytics } from "@vercel/analytics/react";` and the `<Analytics />` element. Then remove the dependency:

```bash
pnpm remove @vercel/analytics
```

- [ ] **Step 4: Delete the Vercel cron config**

```bash
git rm vercel.json
```

The daily cron is reimplemented as a Cloudflare Cron Trigger in Task 3.

- [ ] **Step 5: Build to verify**

Run: `pnpm build`
Expected: build completes and prints the route table. A warning that PPR is experimental must not appear.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.js src/app/layout.tsx
git commit -m "$(cat <<'EOF'
chore: upgrade to next 14.2.35 and drop Vercel-only config

14.2.35 is the last 14.2 release and closes CVE-2025-29927, a middleware
auth bypass reachable through the x-middleware-subrequest header.

Also removes the inert PPR flag, switches next/image to unoptimized (the
only image is a 16px favicon), drops @vercel/analytics, and deletes
vercel.json now that cron moves to Cloudflare.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add the OpenNext adapter and Worker configuration

**Files:**
- Modify: `package.json` (devDependencies, scripts)
- Modify: `next.config.js` (dev binding init)
- Create: `open-next.config.ts`
- Create: `wrangler.jsonc`
- Create: `custom-worker.ts`
- Modify: `.gitignore`
- Modify: `.env.example`
- Modify: `AGENTS.md` (commands table)

**Interfaces:**
- Consumes: the `14.2.35` build from Task 2.
- Produces:
  - `pnpm preview` — build + serve in the Workers runtime locally
  - `pnpm deploy` — build + deploy
  - Worker `marlynk` with a `scheduled()` handler that invokes `/api/cron`

- [ ] **Step 1: Install the adapter and Wrangler**

```bash
pnpm add -D @opennextjs/cloudflare@1.15.0 wrangler@4 @cloudflare/workers-types
```

Confirm the peer range is satisfied:

```bash
node -p "require('./node_modules/@opennextjs/cloudflare/package.json').version"
```

Expected: `1.15.0`

- [ ] **Step 2: Add the scripts**

Add to `scripts` in `package.json`, leaving existing entries untouched:

```json
"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
```

- [ ] **Step 3: Add the empty OpenNext config**

Create `open-next.config.ts`:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

No incremental cache, queue, or tag cache is configured. Every route is dynamic SSR, so OpenNext needs none of them.

- [ ] **Step 4: Add the Wrangler configuration**

Create `wrangler.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "marlynk",
  "main": "./custom-worker.ts",
  "upload_source_maps": true,
  "compatibility_date": "2026-11-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "observability": {
    "enabled": true
  },
  "vars": {
    "NEXTAUTH_URL": "https://marlynk.ammararief.my.id",
    "DOMAIN_URL": "https://marlynk.ammararief.my.id",
    "NODE_ENV": "production"
  },
  "routes": [
    {
      "pattern": "marlynk.ammararief.my.id",
      "custom_domain": true
    }
  ],
  "triggers": {
    "crons": ["0 0 * * *"]
  }
}
```

`nodejs_compat` is required by the adapter. The three `vars` are non-secret and live here so a redeploy does not erase them.

- [ ] **Step 5: Add the custom worker with the cron handler**

Create `custom-worker.ts`:

```ts
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types";

export default {
  fetch: handler.fetch,

  /**
   * Cloudflare Cron Trigger entry point. Calls the existing /api/cron route
   * in-process rather than over the network, so no public URL is needed and
   * the request cannot loop back through the Worker.
   */
  async scheduled(
    _controller: ScheduledController,
    env: { CRON_SECRET: string },
    ctx: ExecutionContext,
  ) {
    const response = await handler.fetch(
      new Request("https://marlynk.ammararief.my.id/api/cron", {
        method: "GET",
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      }),
      env,
      ctx,
    );

    if (!response.ok) {
      console.error(`cron failed: ${response.status} ${await response.text()}`);
    }
  },
};
```

The Cloudflare types are imported rather than declared globally: `@cloudflare/workers-types` is not installed in this project, and adding it to `tsconfig.json`'s `types` array would suppress `@types/node`, which the build relies on.

Install the types:

```bash
pnpm add -D @cloudflare/workers-types
```

- [ ] **Step 6: Ignore build artefacts**

Append to `.gitignore`:

```
# cloudflare / opennext
/.open-next/
/.wrangler/
.dev.vars*
cloudflare-env.d.ts
```

- [ ] **Step 7: Update the env template**

In `.env.example`, change the two URL entries to the production hostname and keep the localhost line as a comment for reference:

```
NEXTAUTH_URL="https://marlynk.ammararief.my.id"
# local: http://localhost:3000
```

```
DOMAIN_URL="https://marlynk.ammararief.my.id"
```

- [ ] **Step 8: Document the new commands**

In `AGENTS.md`, add rows to the Critical Commands table:

```
| `pnpm preview` | Build + run in the Workers runtime locally |
| `pnpm deploy` | Build + deploy to Cloudflare |
| `pnpm test` | Run unit tests (node:test via tsx) |
```

- [ ] **Step 9: Enable Cloudflare bindings during `next dev`**

Add to `next.config.js`, above the `config` declaration:

```js
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
```

The spec requires this. It is inert today because the Worker declares no bindings (no R2, KV, D1, or Durable Objects) — its only effect is that `next dev` would expose bindings if any are added later. It must be added here rather than in Task 2 because it imports `@opennextjs/cloudflare`, which is not installed until Step 1 of this task.

- [ ] **Step 10: Build the Worker**

Run: `pnpm exec opennextjs-cloudflare build`
Expected: `.open-next/worker.js` and `.open-next/assets/` exist, and the command exits 0.

If the build fails resolving `@libsql/client` or `drizzle-orm` for the middleware bundle, stop and report — that is Review Focus item 3 and needs the fallback described in the spec, not a silent workaround.

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.js open-next.config.ts wrangler.jsonc custom-worker.ts .gitignore .env.example AGENTS.md
git commit -m "$(cat <<'EOF'
build: add OpenNext adapter and Worker config for Cloudflare

Runs the app as a single Worker with nodejs_compat, no cache layer (every
route is dynamic SSR), and a cron trigger at 0 0 * * * handled by a custom
worker that calls /api/cron in-process.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Deploy to Cloudflare and verify runtime behaviour

**Files:**
- Create: `scripts/check-clicks.ts` (temporary; deleted in Task 5 Step 7)
- No application files are modified — this task configures the deployed Worker.

**Interfaces:**
- Consumes: the buildable Worker from Task 3.
- Produces: a live deployment at `https://marlynk.ammararief.my.id` with secrets installed.

- [ ] **Step 1: Confirm the Cloudflare login**

```bash
wrangler whoami
```

Expected: account `Marmdhn28@gmail.com's Account`, id `6691af46b1cbea948bb45ef274a9bfd6`.

- [ ] **Step 2: Deploy once to create the Worker**

```bash
pnpm deploy
```

Expected: deploy succeeds and prints a `workers.dev` URL. The custom domain may not resolve yet.

- [ ] **Step 3: Install the ten secrets from `.env` without echoing them**

Run this from the repository root. It reads `.env`, pipes each value to `wrangler secret put` via stdin, and prints only the key name:

```bash
set -a; . ./.env; set +a
for key in TURSO_URL TURSO_AUTH_TOKEN UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN NEXTAUTH_SECRET GITHUB_ID GITHUB_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET CRON_SECRET; do
  printf '%s' "${!key}" | wrangler secret put "$key" --name marlynk >/dev/null && echo "set: $key"
done
```

Expected: ten `set: <KEY>` lines. No values printed.

- [ ] **Step 4: Confirm the secrets are registered**

```bash
wrangler secret list --name marlynk
```

Expected: all ten names listed. Values are not readable by design.

- [ ] **Step 5: Redeploy so the new secrets are in scope**

```bash
pnpm deploy
```

Expected: exit 0.

- [ ] **Step 6: Verify the hostname resolves**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://marlynk.ammararief.my.id/
```

Expected: `200`.

If this fails with DNS not found, the OAuth token lacks zone write. Add a proxied CNAME for `marlynk` pointing at `marlynk.<subdomain>.workers.dev` from the dashboard, then retry.

- [ ] **Step 7: Verify the app boots (Review Focus item 4)**

```bash
curl -sS https://marlynk.ammararief.my.id/ | grep -o "Short links" | head -1
```

Expected: `Short links`.

A 500 here most likely means `src/env.js` threw during module init. Read the error:

```bash
wrangler tail marlynk --format pretty
```

- [ ] **Step 8: Verify slug redirect through the middleware (Review Focus item 3)**

Create a link in the browser, note its slug, then:

```bash
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://marlynk.ammararief.my.id/<SLUG>
```

Expected: `307` (or `308`) and a redirect URL equal to the target.

Then confirm the click counter moved. Create `scripts/check-clicks.ts` (temporary, delete after the check). The `scripts/` directory does not exist yet:

```bash
mkdir -p scripts
```

```ts
import { createClient } from "@libsql/client/web";

const url = process.env.TURSO_URL!.replace(/^libsql:\/\//, "https://");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const result = await client.execute({
  sql: "SELECT slug, clicks FROM link WHERE slug = ?",
  args: [process.argv[2]!],
});

console.log(JSON.stringify(result.rows[0] ?? null));
```

Run it with the slug as the argument:

```bash
set -a; . ./.env; set +a
npx tsx scripts/check-clicks.ts <SLUG>
```

Expected: `{"slug":"<SLUG>","clicks":N}` with `N` at least 1. Run the redirect twice and re-run; `N` must increase.

The `libsql://` to `https://` rewrite is required because the web client rejects the `libsql://` scheme. Verified against this project's database.

A 500 from the redirect means Drizzle or `@libsql/client/web` failed inside the middleware bundle — Review Focus item 3. Stop and report.

- [ ] **Step 9: Verify cron**

Start a local Worker that exposes the scheduled-test endpoint:

```bash
pnpm exec wrangler dev --test-scheduled
```

Then in a second terminal:

```bash
curl -sS "http://localhost:8787/cdn-cgi/local/scheduled?cron=0+0+*+*+*"
```

Expected: no error output, and the Worker log shows a request to `/api/cron` returning 200. The route is idempotent, so running it twice is safe.

The path is `cdn-cgi/local/scheduled`, confirmed against current Cloudflare docs. Older docs show `/__scheduled`; that form is outdated.

This step needs `CRON_SECRET` in the local environment, because `scheduled()` reads it from `env`. Wrangler loads `.env` for local dev, and `.env` already contains `CRON_SECRET`.

- [ ] **Step 10: Report the deployment URL and stop**

Do not modify `AGENTS.md` with the live URL until the OAuth step in Task 5 is confirmed, so the documented state matches reality.

---

### Task 5: OAuth callbacks and end-to-end verification

**Files:**
- Create: `scripts/age-link.ts` (temporary; deleted in Step 7)
- Modify: `AGENTS.md` (record the live URL)
- Modify: `.env.example` only if a value proved wrong (unlikely)

**Interfaces:**
- Consumes: the live deployment from Task 4.
- Produces: working GitHub and Google login.

- [ ] **Step 1: Hand the exact callback values to the user**

Report these two strings verbatim. The user updates both consoles; this session has no access to them.

```
GitHub → Authorization callback URL
https://marlynk.ammararief.my.id/api/auth/callback/github

Google → Authorized redirect URI
https://marlynk.ammararief.my.id/api/auth/callback/google
```

- [ ] **Step 2: Wait for the user to confirm both are saved**

Do not proceed to the sign-in checks before confirmation. A mismatch surfaces as `redirect_uri_mismatch` and is indistinguishable from other OAuth errors in the UI.

- [ ] **Step 3: Verify GitHub sign-in (Review Focus item 5)**

In the browser: open `https://marlynk.ammararief.my.id`, click sign in, choose GitHub, complete the flow.

Expected: the header shows the user avatar; no `redirect_uri_mismatch`, no `OAuthCallback` error page.

- [ ] **Step 4: Verify Google sign-in**

Same flow with Google.

Expected: signed in with no error.

- [ ] **Step 5: Verify the guest-link migration fix end to end**

This is the user-facing proof of Task 1. Requires a link older than 24 hours.

1. In a private window (no session), create a link. Note the slug.
2. Age it in Turso so it falls outside the guest window, using the same helper as Task 4 Step 8:

```ts
// scripts/age-link.ts — temporary, delete after the check
import { createClient } from "@libsql/client/web";

const url = process.env.TURSO_URL!.replace(/^libsql:\/\//, "https://");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

await client.execute({
  sql: "UPDATE link SET created_at = created_at - 172800 WHERE slug = ?",
  args: [process.argv[2]!],
});

const check = await client.execute({
  sql: "SELECT slug, created_at FROM link WHERE slug = ?",
  args: [process.argv[2]!],
});
console.log(JSON.stringify(check.rows[0] ?? null));
```

```bash
set -a; . ./.env; set +a
npx tsx scripts/age-link.ts <SLUG>
```

Expected: the row prints with an unchanged `slug`. `created_at` is now two days in the past.

3. Reload the page in the same private window. The link must **disappear** from the guest list (Review Focus item 2 — the display window must still apply).
4. Without clearing the `user-link-id` cookie, sign in with GitHub.
5. After sign-in, the link must **reappear** in the list.

Expected: hidden before sign-in, present after. If it is absent after sign-in, the migration call is still filtering — recheck Task 1 Step 8.

- [ ] **Step 6: Verify edit, delete, and QR**

- Edit a link's slug and target URL, then confirm the old slug 404s and the new slug redirects to the new target.
- Delete a link, then confirm it is gone from the list and the slug no longer redirects.
- Open the QR dialog and confirm a code renders.

- [ ] **Step 7: Record the live URL**

Now that everything passes, add to `AGENTS.md` under Key Conventions:

```
- **Production URL**: `https://marlynk.ammararief.my.id` (Cloudflare Worker `marlynk`)
```

Then remove the two temporary scripts if they still exist:

```bash
rm -f scripts/check-clicks.ts scripts/age-link.ts
```

- [ ] **Step 8: Commit**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
docs: record Cloudflare production URL

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Rollback

If the Worker cannot serve a working build after Task 4, the previous Vercel deployment is untouched — this plan never modifies or deletes it. To abandon the Cloudflare path:

```bash
wrangler delete marlynk
```

Then restore `vercel.json` and `@vercel/analytics` from git history. Tasks 1 and 2 are independent of the platform and are safe to keep either way.
