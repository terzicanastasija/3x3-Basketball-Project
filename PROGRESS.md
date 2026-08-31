# Progress / Handoff

**Read this file first at the start of any session, before doing anything else.** Update it after
every meaningful step (not just at session end) — new files created, a phase step finished, a
decision made, tooling installed, etc.

Full architecture/design rationale lives in the approved plan file:
`C:\Users\anast\.claude\plans\project-3x3-what-this-piped-flamingo.md` (this repo doesn't track that
path — it's outside the repo — so re-read it directly if the reasoning behind a design choice below
needs more detail than this file gives).

---

## Where we are right now

**Phase 0 — Scaffolding & Auth — DONE. Full stack verified end-to-end against a real DB.**

**Session update (2026-08-31)**: Docker is now working. Docker Desktop had actually completed
its first-run setup the previous evening (Aug 30) and ran fine for hours, then crashed around
07:01 this morning after a token-refresh call hit a transient DNS failure (`login.docker.com: no
such host`), which took the GPU process and then the whole app down with it — nothing wrong with
the underlying WSL2/Docker setup itself, it just wasn't running. Relaunched Docker Desktop
manually (`Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`); it came back up
clean (`docker ps` responds, `wsl -l -v` shows `docker-desktop` Running). From there, completed
the rest of Phase 0:
- `docker compose -f infra/docker-compose.yml up -d` — postgres, minio, redis, mailhog all up
  (postgres and minio report healthy).
- `prisma migrate dev --name init` — applied cleanly, `_prisma_migrations` created.
- Added the hand-written CHECK constraint migration that was TODO'd in the schema comment:
  `apps/api/prisma/migrations/20260831072500_action_tag_point_value_check/migration.sql` —
  `ALTER TABLE "ActionTag" ADD CONSTRAINT "ActionTag_pointValue_check" CHECK ("pointValue" IS
  NULL OR "pointValue" IN (1, 2))`. Applied via a second `prisma migrate dev` run (no schema.prisma
  change needed — Prisma can't express CHECK constraints natively, so this stays a permanent
  hand-maintained migration; don't expect `prisma migrate dev` to regenerate it from the schema).
- `prisma db seed` — seeded superadmin (`admin@3x3app.local`), sample club/coach/team/players/
  tournament, idempotently.
- Rebuilt (`pnpm --filter api build`) and booted the real compiled API (`node dist/src/main.js`)
  — no more `P1001`, Nest starts clean.
- **Logged in for real**: `POST /auth/login` with the seeded superadmin credentials (from
  `apps/api/.env`'s `SEED_SUPERADMIN_EMAIL`/`_PASSWORD`) returned a valid access+refresh token
  pair. This is Phase 0's actual testable deliverable — confirmed working.
- Stopped the test API process afterward (was only run manually to verify; not left running).

**Note for next session**: `apps/api/.env`'s Postgres/MinIO/Redis ports must match
`infra/docker-compose.yml` — they already do, no changes needed, just noting where to look if a
container port ever changes. Also: `prisma` reported a major version update is available
(5.22.0 → 8.0.0-rc.12) — not acted on, flagging in case it's worth planning a deliberate upgrade
later rather than picking it up accidentally.

### Historical context (superseded by the above, kept for the crash forensics)

Backend was code-complete and verified up to the DB as of the previous session:

`pnpm install` succeeded, `prisma generate` succeeded, `apps/api` builds clean (`pnpm --filter api
build`), and the compiled API **boots successfully** — Nest wires up every module, all routes map
correctly (`POST /auth/login`, `POST /auth/refresh`, `POST /auth/invite/accept`, `GET /users/me`),
env validation passes — and fails only at `PrismaService.onModuleInit`'s `$connect()` with
`P1001: Can't reach database server at localhost:5432`, which is expected: **Postgres isn't
running yet** (Docker Desktop installed but its engine has never been started — needs the user to
do the GUI first-run: launch it, accept EULA, let WSL2 backend init).

**Next concrete step is on the user**: launch Docker Desktop and let it finish first-run setup,
then say so — at that point run `docker compose -f infra/docker-compose.yml up -d`,
`prisma migrate dev`, apply the manual `pointValue` CHECK constraint migration, `prisma db seed`,
and confirm login against a real DB. While waiting, work can continue on the `apps/web` (Vite/React)
skeleton, which doesn't need the DB to scaffold (only to actually log in end-to-end).

**Nothing has been committed to git yet.** All scaffolded files are untracked. Should commit soon
— this is a good checkpoint (backend code-complete and build/boot-verified) — see the git workflow
policy below.

**Session update (2026-08-30, after a machine restart)**: Docker Desktop is still not running —
the restart did not start it automatically, and `docker ps` still fails with the same
"daemon is running?" error as before. The user is launching it manually; this remains the sole
blocker for finishing Phase 0 end-to-end. `node_modules` survived the restart intact (pnpm's
`.pnpm` store was untouched), so no reinstall was needed.

While waiting on Docker, closed two of the three gaps `apps/web` had flagged as "not yet done":
- **Vitest wired up for real** — `vite.config.ts` now uses `vitest/config`'s `defineConfig` with
  `test: { environment: "jsdom", globals: true }`; `tsconfig.json` adds `"types": ["vitest/globals"]`.
  Added `@testing-library/user-event` as a devDependency (installed, lockfile updated).
  Two new test files: `src/lib/api-client.test.ts` (5 tests — token attachment, skipAuth,
  401-retry-after-refresh, refresh-failure clears tokens, non-401 error message propagation) and
  `src/features/auth/pages/LoginPage.test.tsx` (2 tests — empty-form validation blocks submit,
  valid submit POSTs to `/auth/login`). All mock `fetch` directly; none need a real API or DB.
  `pnpm --filter web test` — **7/7 passing**.
- **i18n language switcher** — `src/components/LanguageSwitcher.tsx` (SR/EN toggle via
  `i18n.changeLanguage`), wired into both `LoginPage` and `HomePage` (top-right). `i18n/index.ts`
  now sets explicit `detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] }`
  so the chosen language persists across reloads predictably (previously relied on
  `i18next-browser-languagedetector`'s implicit defaults).
- Still not done: no styling beyond inline styles (intentional, deferred per original spec).
- **Note**: `pnpm --filter web lint` fails — `eslint` isn't actually installed/configured despite
  the `lint` script existing in `package.json`. Pre-existing gap, not introduced this session;
  left alone since it's outside what was asked. Worth fixing before it's relied on.

`pnpm --filter web build` reverified clean after these changes (135 modules).

### Bugs caught and fixed during this verification pass
- `Player.homeClub` relation was missing its opposite field on `Club` — Prisma schema validation
  caught this immediately (`prisma generate` failed with a clear error). Fixed by adding
  `Club.homePlayers Player[] @relation("PlayerHomeClub")` and naming the relation explicitly.
- `ClubScopeGuard` assigned Prisma's generated `Role` enum value directly into a
  `Record<string, Role>` typed against `@3x3/shared`'s `Role` — these are two nominally distinct
  TS enums with identical string values (Prisma generates its own from `schema.prisma`; it can't
  import the shared TS enum). Fixed with an explicit boundary cast:
  `apps/api/src/common/mappers/role.mapper.ts` (`toSharedRole`). **Any future code that reads a
  `role` column from Prisma and needs it typed as `@3x3/shared`'s `Role` should reuse this mapper**,
  not repeat the cast inline.
- `apps/api/package.json`'s `start` script pointed at `dist/main.js`; `nest build`'s actual output
  is `dist/src/main.js` (mirrors `src/` under `dist/`). Fixed the script path.
- **`packages/shared` needed a dual CJS/ESM build.** It was originally built as a single CommonJS
  output (matching `tsconfig.base.json`'s `module: "commonjs"`, needed by NestJS's `require()`-based
  runtime). `apps/web`'s production build (`vite build`, which uses Rollup) failed with
  `"loginSchema" is not exported by ".../dist/index.js"` — Rollup cannot statically detect named
  exports through TypeScript's compiled `__exportStar` CJS re-export helper (a genuine, known
  limitation, not something to paper over). Fixed by giving `packages/shared` a real dual build:
  `tsconfig.cjs.json` (commonjs → `dist/cjs`) and `tsconfig.esm.json` (ESNext → `dist/esm`,
  declarations disabled there since the CJS build's `.d.ts` already covers types), wired through
  `package.json`'s `exports` map (`require` → cjs, `import` → esm, `types` → cjs's `.d.ts`).
  `pnpm --filter @3x3/shared build` now runs both passes. **Any future package meant to be
  consumed by both `apps/api` (CJS) and `apps/web` (ESM/Vite) needs this same dual-build pattern**
  — don't reintroduce a single-format `dist/`.

---

## Decisions made (don't re-litigate these without asking)

### Product / architecture (confirmed with user before planning)
- **Stack**: TypeScript everywhere — React (Vite) frontend + NestJS backend.
- **Database/ORM**: PostgreSQL + Prisma.
- **Video storage**: S3-compatible object storage. Cloudflare R2 in prod, **MinIO** for local dev.
  YouTube/external links are the other supported video source (URL only, no object storage).
- **Deployment target**: not decided yet — plan/work targets local dev (Docker Compose) only.
- **Auth**: custom JWT/RBAC (not a third-party auth provider) — matches spec's "email + password
  is enough to start."

### Judgment calls made during planning (documented in the plan file, adopted without further asking)
- pnpm workspaces + **Turborepo** for the monorepo.
- **zod** schemas in `packages/shared` as the single source of truth for validation, adapted via
  `nestjs-zod` (backend) and `@hookform/resolvers/zod` + react-hook-form (frontend).
- **BullMQ + Redis** for two background job queues: `clip-generation` (ffmpeg, FILE-sourced video
  only) and `stat-recompute` (triggered on match lock). Redis added now, not deferred.
- Video tagging screen uses a `VideoPlayerAdapter` interface with two implementations
  (`Html5VideoAdapter`, `YouTubeAdapter`) so all tagging/hotkey logic is source-agnostic.
- Clips: FILE sources get real ffmpeg-cut clips; YouTube sources get a timestamped deep link
  instead (no export — ToS + no local file to cut). This is a deliberate capability split, not
  a gap.
- Stat aggregation: `StatSnapshot` computed only on match lock, in three layers — MATCH scope
  (full recompute from `ActionTag`, cheap since it's one match), then TOURNAMENT and CAREER scope
  computed by summing MATCH-scope rows (not re-scanning raw tags), keeping recompute cost
  proportional to matches touched, not total system size.
- RBAC: role lives per-club on `ClubMembership`; `User.isSuperadmin` is a separate global boolean
  (added after initially missing it from the schema — SUPERADMIN has no club scope, so it can't
  live on ClubMembership). Club scope (`accessibleClubIds`) resolved once per request by
  `ClubScopeGuard` and attached to `request.clubContext`.
- i18n: `react-i18next`, default locale `sr`, English JSON scaffolded empty/placeholder alongside
  from day one.

### Process / workflow decisions (from the user directly)
- **Git workflow** (set before any coding started): after each logical chunk of work, create a
  clean local commit with a good message, then push to `origin/main` on GitHub automatically —
  no need to ask before each commit/push. One commit per logical change, not one giant commit per
  session. Still confirm before destructive git ops (force-push, reset --hard, etc.). This is also
  written into `CLAUDE.md` at the repo root and saved to memory (`feedback_git_workflow` in the
  Claude Code memory store) so it persists across sessions.
- **This PROGRESS.md workflow**: update after every meaningful step; read first at the start of
  any future session.

---

## Environment state (this machine)

- **Node.js**: v24.19.0 — installed via `winget install --id OpenJS.NodeJS.LTS`.
- **npm**: 11.17.0 (bundled with Node install).
- **pnpm**: 11.24.0 — installed via `npm install -g pnpm` (note: `corepack enable` failed with an
  `EPERM` writing to `C:\Program Files\nodejs\pnpm` — likely needs an elevated shell; worked around
  with the global npm install instead, so corepack is still NOT enabled on this machine).
- **Docker Desktop**: 4.88.1 — installed via `winget install --id Docker.DockerDesktop`, but
  **the engine has never been started**. `docker --version` works but `docker ps` fails
  (`failed to connect to the docker API ... daemon is running`). Docker Desktop needs its GUI
  first-run walked through by the user (EULA, WSL2 backend init) before `docker compose` will
  work — this was deliberately deferred so scaffolding could proceed without blocking on it.
- **No `pnpm install` has been run yet** — no `node_modules` exist anywhere in the repo yet, so
  nothing scaffolded so far has actually been build- or run-verified.
- No `.env` file exists yet at `apps/api/.env` — only the root `.env.example` template. Needs to
  be copied and filled in (values already sensible for local dev as templated) before the API can
  boot.

---

## Full phase plan (from the approved plan file)

1. **Phase 0 — Scaffolding & auth** *(current)*: monorepo, Docker Compose, full Prisma schema +
   migration + seed, NestJS/React skeletons, JWT auth + invite-only registration, i18n wiring.
   *Testable: log in as seeded superadmin.*
2. **Phase 1 — Club/Team/Player/Roster CRUD**: full CRUD + list/detail screens, club user invite
   flow, basic scouting filters (club/city/age). *Testable: club admin invites a coach, coach
   builds a roster.*
3. **Phase 2 — Tournament/Match CRUD**: manual match result entry independent of video,
   roster-per-tournament wired to real tournaments. *Testable: full non-video loop.*
4. **Phase 3 — Video upload + tagging UI**: `VideoModule`, `TagsModule`, both player adapters,
   keyboard-shortcut tagging, match lock (status flip only, no jobs yet). *Testable: tag a match
   against both a file and a YouTube link, edit/delete pre-lock, lock it.*
5. **Phase 4 — Stat computation + dashboards**: introduce Redis/BullMQ, `stat-recompute` queue,
   `StatsModule`/`DashboardsModule`, team/player/match dashboards, stat-threshold scouting search.
6. **Phase 5 — Clip generation**: `clip-generation` queue + ffmpeg worker for FILE sources;
   YouTube deep-link construction; `ClipsModule` + compilation builder.

Deferred to "build after v1" (per original spec): advanced stats (PPP, +/-, shot-clock usage,
clutch splits), cross-club public player profiles, PDF/Excel export, Scout role activation,
Player self-service login.

---

## What's been completed in Phase 0 so far

### Root
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `turbo.json`, `.gitignore`,
  `.env.example`.

### `infra/`
- `docker-compose.yml` — Postgres 16, MinIO (+ `minio-init` bucket-creation step for `videos`/
  `clips` buckets), Redis, Mailhog.

### `packages/shared/` (enums/constants/dto shared between frontend and backend)
- `package.json`, `tsconfig.json`.
- `src/enums/`: `role.enum.ts`, `action-type.enum.ts` (incl. `pointValueForActionType` — enforces
  1pt/2pt-only, never 3), `match.enum.ts` (`MatchStatus`, `MatchEndType`),
  `tournament-format.enum.ts`, `video.enum.ts` (`VideoSourceType`, `VideoProcessingStatus`,
  `JobStatus`), `player.enum.ts` (`Handedness`, `StatScope`), `index.ts`.
- `src/constants/`: `rules.constants.ts` (shot clock 12s, match 10min/21pt, team foul
  bonus at 7/two-shot at 10, clip window 5s before/3s after), `hotkeys.constant.ts`
  (`ACTION_TYPE_HOTKEYS` map + i18n key mapping), `index.ts`.
- `src/dto/auth.dto.ts` — zod schemas: `loginSchema`, `refreshSchema`, `acceptInviteSchema`.
- `src/index.ts` — re-exports everything.

### `apps/api/` (NestJS backend)
- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`.
- `prisma/schema.prisma` — **full v1 data model written**: `Club`, `User` (incl.
  `isSuperadmin` boolean — added after catching that SUPERADMIN needs a non-club-scoped flag),
  `ClubMembership`, `Invite`, `RefreshToken`, `Team`, `Player`, `Roster`/`RosterPlayer`,
  `Tournament`, `Match`, `VideoAsset`, `ActionTag` (source of truth), `ClipJob`,
  `Compilation`/`CompilationItem`, `StatSnapshot` (derived/cached, `StatScope` enum
  discriminator), `ScoutNote`, `ActivityLog`. **Not yet migrated** (no DB running yet).
  **TODO**: after the first `prisma migrate dev`, add a follow-up manual migration with a raw-SQL
  `CHECK` constraint on `ActionTag.pointValue` (must be NULL, 1, or 2 — never 3) — Prisma doesn't
  express DB-level CHECK constraints natively at this version.
- `src/prisma/prisma.service.ts`, `prisma.module.ts` — global Prisma module.
- `src/config/env.validation.ts` — zod-validated env schema (`validateEnv`).
- `src/common/decorators/`: `public.decorator.ts` (`@Public()`), `roles.decorator.ts`
  (`@Roles(...)`), `current-user.decorator.ts` (`@CurrentUser()`), `club-context.decorator.ts`
  (`@CurrentClubContext()`).
- `src/common/types/authenticated-request.ts` — `AuthenticatedUser`, `ClubContext`,
  `AuthenticatedRequest` types.
- `src/common/guards/`: `jwt-auth.guard.ts`, `club-scope.guard.ts` (resolves
  `accessibleClubIds`/`roleByClubId` once per request; `'ALL'` sentinel for superadmin),
  `roles.guard.ts` (checks `@Roles()` against club-scoped role; superadmin bypasses; routes
  without a `:clubId` param currently pass through — noted as a TODO for modules with
  indirect club ownership, e.g. `:teamId`/`:matchId`, to resolve their owning club explicitly).
- `src/modules/auth/`: `strategies/jwt.strategy.ts`, `auth.service.ts` (login, refresh-with-
  rotation, invite-accept, argon2 password hashing, SHA-256-hashed refresh token storage),
  `auth.controller.ts` (`POST /auth/login`, `/auth/refresh`, `/auth/invite/accept`, all
  `@Public()`), `auth.module.ts`.
- `src/modules/users/`: `users.controller.ts` (`GET /users/me`), `users.service.ts`,
  `users.module.ts`.

### Also completed in `apps/api/` (this pass)
- `src/app.module.ts` — wires `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`,
  `PrismaModule`, `AuthModule`, `UsersModule`; registers `JwtAuthGuard` → `ClubScopeGuard` →
  `RolesGuard` as global guards via `APP_GUARD` (order matters, see inline comment).
- `src/main.ts` — Nest bootstrap, CORS restricted to `APP_BASE_URL` (the Vite dev origin),
  `app.listen(PORT)`.
- `prisma/seed.ts` — upserts a superadmin (`isSuperadmin: true`, argon2-hashed password from
  `SEED_SUPERADMIN_EMAIL`/`SEED_SUPERADMIN_PASSWORD`), plus a sample club (`KK Primer`), a coach
  user, a team, 4 sample players, and a sample tournament — all idempotent via `upsert` on fixed
  seed IDs, safe to re-run.
- `apps/api/.env` created (gitignored) with local-dev-appropriate values matching
  `infra/docker-compose.yml`.
- `apps/api/package.json` `start` script fixed to `node dist/src/main.js`.
- `src/common/mappers/role.mapper.ts` — `toSharedRole()` boundary cast (see bug notes above).

### `apps/web/` (Vite + React) — **scaffolded and build-verified.**
- `package.json`, `vite.config.ts` (port 5173), `tsconfig.json`, `index.html`.
- `src/main.tsx`, `src/App.tsx` (wraps `QueryClientProvider` + `RouterProvider`).
- `src/app/router.tsx` (`/login`, `/` behind `RequireAuth`), `src/app/RequireAuth.tsx`
  (redirects to `/login` if no access token in storage).
- `src/i18n/` — react-i18next, `sr` default + fully-populated `en` (small string set so far),
  `locales/{sr,en}/common.json`.
- `src/lib/`: `auth-storage.ts` (localStorage token persistence), `api-client.ts` (`apiFetch`
  wrapper — attaches bearer token, retries once after a silent `/auth/refresh` on 401, throws
  `ApiError`), `query-client.ts` (TanStack Query client).
- `src/features/auth/`: `api.ts` (`useLogin`, `useCurrentUser`, `useLogout` — TanStack Query
  hooks), `pages/LoginPage.tsx` (react-hook-form + zod resolver using `@3x3/shared`'s
  `loginSchema` directly), `pages/HomePage.tsx` (shows current user + club memberships, logout
  button) — this is genuinely enough to log in against the API end-to-end once the DB is up.
- `pnpm --filter web build` succeeds (135 modules, clean Vite production build).
- Vitest wired up (`jsdom` env, `globals: true`) with tests for `api-client` and `LoginPage`
  (7/7 passing) and an SR/EN `LanguageSwitcher` component — see session update above for detail.
- **Not yet done**: no adapter tests (video player adapters don't exist yet, Phase 3), no styling
  beyond inline styles (intentional — visual design is a separate step per the original spec).

### Dependencies — installed and verified
- `pnpm install` succeeded at repo root (had to set `allowBuilds: true` for `@nestjs/core`,
  `@prisma/client`, `@prisma/engines`, `argon2`, `prisma`, and later `esbuild` (added when
  `apps/web` deps came in) in `pnpm-workspace.yaml` — pnpm 11 blocks native postinstall scripts
  by default; all six are legitimate and needed. If a future `pnpm install` reports
  `ERR_PNPM_IGNORED_BUILDS` for a new package, that's expected — add it to `allowBuilds: true`
  in `pnpm-workspace.yaml` the same way, don't just ignore the warning.
  `corepack enable` still doesn't work on this machine (EPERM) — pnpm is the global npm install,
  not corepack-managed. Not an issue day-to-day, just don't expect `corepack` commands to work.
- `pnpm --filter @3x3/shared build` — succeeds (dual CJS/ESM, see bug notes above).
- `pnpm --filter api build` — succeeds.
- `pnpm --filter web build` — succeeds (134 modules, clean production Vite build).
- `apps/api` boots successfully up to the DB connection attempt (see "Where we are" above).

---

## Immediate next steps (in order)

Phase 0 is done — steps 1-4 below (Docker, migrate, seed, real login) are all verified complete
as of the 2026-08-31 session update above. Remaining:

1. Commit this session's work (the CHECK-constraint migration + PROGRESS.md update — everything
   else was already committed in prior sessions per git history).
2. Start `apps/web` against the now-live API and confirm the login flow works from the browser
   too (only the raw HTTP call via `curl` has been verified so far, not the UI).
3. Move to Phase 1 (Club/Team/Player/Roster CRUD).
