## Post-MVP: edge-case testing pass + global Prisma exception filter (2026-09-02)

User asked for a thorough edge-case test pass across the backend (full automated suites + a
targeted matrix of RBAC/validation/locking/stats/clips edge cases against the live API — run via
a forked background agent, report-only, no fixes without asking first). 74/74 backend + 22/22
frontend tests passed; 40+ manually-probed edge cases (RBAC boundaries across all 4 roles, the
Scout read-vs-write regression, phase validation, lock idempotency, point-value smuggling,
clip-window validation, PPG filter edges, roster double-add, etc.) all behaved correctly. All test
artifacts (3 throwaway matches, their tags) were cleaned up afterward; real data
(`match-dunav-vs-sava`'s user tags, `match-morava-vs-drina`'s demo-generator tags) untouched.

**4 real bugs found, all one root cause**: no global Prisma exception filter existed, so any write
that references a foreign key without a pre-check leaked Prisma's raw `PrismaClientKnownRequestError`
straight through as an opaque `500 Internal server error` instead of a clean 4xx — `TagsService
.create()` (bad `playerId`), `CompilationsService.create()` (bad `actionTagId`), `RostersService
.removePlayer()` (player not actually on the roster), `PlayersService.create()` (bad `homeClubId`).

**Fix, per the user's explicit design call — a hybrid, not one approach exclusively**:
- `PrismaExceptionFilter` (`common/filters/prisma-exception.filter.ts`, registered globally via
  `APP_FILTER` in `app.module.ts`) maps `P2003` (FK violation) → 400, `P2025` (record not found) →
  404, `P2002` (unique conflict, bonus — wasn't one of the 4 but same shape) → 409 with the
  conflicting field named. This is the catch-all for every generic "bad ID" case not worth writing
  out by hand — fixes `CompilationsService` and `PlayersService.create()`'s bugs with zero
  service-level code (verified live: `POST /players` with a nonexistent `homeClubId` now returns
  `400 {"message":"One or more referenced records do not exist."}` instead of a 500).
- **Business-logic checks stay in the services** for the two cases with a real named concept worth
  a specific message: `TagsService.create()` gained `assertPlayerExists()`, checking `playerId`
  (and `relatedPlayerId` if present) before the insert → `404 "Player not found."`.
  `RostersService.removePlayer()` now checks the `RosterPlayer` row exists before deleting →
  `404 "Player is not on this roster."` (verified live against the real API). Deliberately did
  **not** turn `addPlayer`'s existing upsert-on-duplicate into a rejection — re-adding a player
  already on a roster to update their jersey number was independently verified as correct,
  intentional behavior during the edge-case pass, not a bug; changing it would have been an
  unrequested behavior change. Flagging this judgment call rather than silently reinterpreting the
  "player already exists → 400/409" guidance to mean something the existing tests didn't ask for.

8 new backend unit tests (2 in `tags.service.spec.ts` for the playerId/relatedPlayerId checks, 2 in
`rosters.service.spec.ts` for removePlayer, 4 in a new `prisma-exception.filter.spec.ts` covering
P2003/P2025/P2002/unrecognized-code fallback) — 82/82 backend tests passing, clean `nest build`,
22/22 frontend tests unaffected (frontend wasn't touched).

---

## Post-MVP: match phase field + real YouTube demo videos + generated demo stats (2026-09-01, later still)

Three asks in one go: (1) matches were displaying as an uninformative "Scheduled — SCHEDULED" in
every list, and the user wanted "meaningful names... like club name vs club name or the phase of
the match" — chose (per the user, asked first) to add a *real* `phase` field, not just fix the
display text; (2) connect to YouTube and attach real tournament videos to the seeded matches;
(3) generate random tags so every player has real stats, meaningful for exercising the Player
Edit page. Asked 4 clarifying questions first (phase-as-schema-change vs. display-only, how many
matches get real video, lock-after-tagging or not, and whether "every field in detail" meant more
scope right now) — all answered with the recommended option.

**Match phase** (`Match.phase`, nullable `MatchPhase` enum: `GROUP_STAGE`/`ROUND_OF_16`/
`QUARTERFINAL`/`SEMIFINAL`/`THIRD_PLACE`/`FINAL`, migration `20260901133634_add_match_phase`) —
nullable because not every match belongs to a bracket (a friendly or plain league game may have
none). Threaded through `createMatchSchema`/`updateMatchSchema`, `MatchesService.create`, and
every match-display spot in the frontend (`TournamentDetailPage`'s match list — now resolves and
shows real team names too, via a new `MatchListItem` component, instead of the old status-only
text; `MatchDetailPage`; `TaggingPage`'s header; `SelectMatchToTagPage`'s dropdown, which also
gained real team names via a new batched `useTeams()` hook in `teams/api.ts` since a `<select>`
`<option>` can't host its own per-row data-fetching component the way a list item can). All 6
seeded matches are tagged `GROUP_STAGE` (accurate — they're the round-robin group stage).

**A real bug this surfaced, caught by a failing test, not by inspection**: the "no phase chosen"
state of a plain `<select>` is an empty string, not an absent field, and `z.nativeEnum(...)
.optional()` rejects `""` as an invalid enum value rather than treating it as "not set" — silently
broke the entire "schedule a match" form (every submission failed validation on the `phase` field,
which had no error message wired up, so it looked like the button just did nothing). Fixed with a
`z.preprocess((val) => (val === "" ? undefined : val), ...)` wrapper in `match.dto.ts`.

**A second, purely self-inflicted bug while chasing the first one**: after fixing the schema above,
the same test kept failing with the identical symptom. Root cause: `packages/shared` is a
separately-built package (`dist/`) that both `apps/api` and `apps/web` import — editing its
`src/` doesn't change what either app actually sees at runtime until `pnpm --filter @3x3/shared
build` re-runs. Had edited the schema fix without rebuilding shared first, so the frontend was
still validating against the stale pre-fix compiled DTO. Worth remembering for next time: **any
edit under `packages/shared/src` needs an explicit rebuild before it's visible to either app** —
neither app's dev-server watcher rebuilds it automatically.

**Also recurred twice more this session**: the same orphaned-dev-server-process pattern from
earlier — `TaskStop`/a "killed" background task not actually killing the underlying `node.exe`,
leaving it holding port 3000 (and once, the Prisma client `.dll`, causing `prisma generate` to
fail with `EPERM`). Both times: checked `netstat -ano` for the PID actually `LISTENING` on the
port, `taskkill //PID <pid> //F` it directly (not trusting the harness's stop alone), confirmed
the port was free, then restarted cleanly. This is now a known, recurring quirk of this session's
process-management, not a one-off — worth checking `netstat` first whenever a restart "doesn't
seem to have worked."

**Real YouTube videos**: searched the web (not guessed — `WebSearch`, not a fabricated video ID)
for the official FIBA 3x3 YouTube channel (`@FIBA3x3`) and found 5 real full-game broadcasts from
FIBA 3x3 World Cup/Asia Cup 2026 official coverage, registered as `EXTERNAL` video sources on 5 of
the 6 seeded matches — no downloading, just linking, exactly what the app's own "Add YouTube link"
feature already does. `match-dunav-vs-sava` was deliberately left untouched (already has the
user's own real FILE upload + 2 real tags from their own testing — the new tooling never touches
a match that already has any tag or is locked).

**Demo activity generator** (`apps/api/scripts/populate-demo-activity.ts`, `pnpm --filter api
seed:demo-activity`) — a new, kept (not throwaway) script, since populating realistic demo
activity is likely to come up again. Deliberately drives the **real running API** as a real Scout
login, not direct Prisma writes — so RBAC, server-derived `pointValue`, and the stat-recompute
queue all run exactly as they would for an actual user. Generates ~24 weighted-random tagged
actions per match (shots weighted realistically more common than blocks/fouls; `ASSIST`'s related
player is a teammate, `STEAL`/`BLOCK`'s is an opponent — matching `ACTION_TYPES_WITH_RELATED_
PLAYER`'s existing convention exactly) across real roster players, then locks each match. Safe to
re-run anytime: any match with an existing tag or lock is skipped outright.

**Verified live, not just via the script's own success output**: queried the DB directly
afterward — 122 total tags, 102 `StatSnapshot` rows, all 20 seeded players now have real CAREER
points/games-played (e.g. Aleksandar Jovanović: 5 pts across 3 games). In a real browser: the
tournament's match list now reads "Group Stage — Dunav Seniori vs Sava Seniori — SCHEDULED" for
all 6 matches (not "Scheduled — SCHEDULED"); a player's dashboard shows real per-match history
rows each with a working "Tags & clips" link; clicking through to `match-dunav-vs-drina`'s tagging
screen shows 24 real tags with real player names and a working related-player display for `STEAL`
("Nikola Todorovic (Ognjen Ristic)"), all with "Deep link"s to the real YouTube video.
`match-dunav-vs-sava` confirmed still exactly as the user left it (2 tags, 1 FILE video, locked).

---

## Retried the real-playback hotkey verification (2026-09-01) — same environment limitation, now root-caused further

Picked up where the 2026-08-31 session left off: the one open gap was a literal `[`/`]`-during-
real-video-playback click-through, blocked last time by native `<video>` never leaving
`readyState: 0`. Restarted the whole stack cold this session (Docker Desktop wasn't running,
neither were the API/web dev servers — all three brought back up cleanly, no config drift) and
retried against the same `clipwindow-test.mp4` fixture match
(`cmthbysmt0005v76iykngcnao`) from last session.

**Same symptom reproduced, and now diagnosed further**: the native `<video>` element gets a valid
presigned MinIO URL (confirmed via `GET /videos/:id/playback-url` → 200) and stays stuck at
`readyState: 0` / `networkState: 2` (NETWORK_LOADING) indefinitely after `play()`. Went a level
deeper than last session's evidence:
- **The URL itself is genuinely fetchable from the same page context** — ran `fetch()` with a
  `Range: bytes=0-1023` header against the exact `currentSrc` the `<video>` element was using:
  got back `206 Partial Content`, `Content-Type: video/mp4`, correct `Content-Range`, and the
  actual 1024 bytes. Rules out CORS, auth, MinIO, or the presigned URL itself as the cause —
  this is the same conclusion last session reached via an external `curl`, now reached from
  *inside the exact page/tab* that fails to play it.
- **Traced the actual `<video>` element event sequence**: `abort` → `emptied` → `waiting` →
  `loadstart` → `stalled`, then nothing — never reaches `progress`, `loadedmetadata`, or any
  further event, even after 4s.
- **Codec/capability APIs both claim full support**: `canPlayType('video/mp4; codecs="avc1...`')`
  → `"probably"`, and `navigator.mediaCapabilities.decodingInfo(...)` →
  `{supported: true, smooth: true, powerEfficient: true}`. So the browser's own capability
  self-report says this should work; the actual decode pipeline just never progresses.

**Conclusion**: this is a real limitation of this automated/remote Chrome environment's video
decode path (GPU process or similar), not the app. Every layer the app controls — the presigned
URL, CORS, the HTTP range response, the codec, the DOM wiring — checks out. This is the same
category of issue as the Phase 3-era tab freeze noted below. Not fixed this session (there's
nothing in this codebase to fix); still worth a retry if a different/more stable browser
environment becomes available. Until then, treat the hotkey-mark logic as verified by every
means *not* dependent on real video decode (unit tests, button-driven marks with a stubbed time,
DTO/API round-trip) — see the 2026-08-31 clip-marking entry below for exactly what was and wasn't
covered that way.

---

## Post-MVP: dashboards never linked back to the clips that produced them (2026-09-01, later still)

User asked why they couldn't see "the videos scouts did" from a player's stats. Real gap, not a
misunderstanding: `DashboardsService` deliberately reads only from `StatSnapshot` (aggregated
numbers), never `ActionTag` — by design, so dashboards stay fast regardless of tag-history size —
but that also meant neither `MatchDashboardPage` nor `PlayerDashboardPage` had *any* link back to
the tags/clips that produced those numbers. Once there, found a second compounding gap: the tag
list itself (`TaggingPage`, the only place clips are actually shown) never displayed which player
a tag belonged to — `GET /matches/:matchId/tags` returned bare `playerId` strings, not names — so
even clicking through to a match wouldn't have told you which clip was whose.

**Fixed both, keeping `DashboardsService` untouched (its StatSnapshot-only design is still
correct — this isn't an aggregation problem, it's a missing link)**:
- `TagsService.listForMatch` now includes `player`/`relatedPlayer` (`id`/`firstName`/`lastName`)
  in the query — one line, `GET /matches/:matchId/tags` was already the source of truth for the
  tag list, it just wasn't asking for names. `TaggingPage`'s tag list now renders them inline
  (e.g. "6.3s — 2pt made (+2) — Aleksandar Jovanović — Clip: 2.4s–3.9s").
- `MatchDashboardPage` gained a top-of-page "View tags & clips" link to `/matches/:matchId/tag`.
- `PlayerDashboardPage`'s match-history table gained a "Tags & clips" link per row, using the
  `match.id` the endpoint already returned but the page never used for anything.

Added a backend test asserting the `include` is actually requested (73→74 backend tests, still
all passing); frontend build/tests unaffected (existing mocks just don't populate the new
optional fields, which render as nothing — no crash). **Verified live**: on the real
`match-dunav-vs-sava` — which the user had, in the meantime, genuinely re-tagged themselves with
working player selection (2 tags, both correctly attributed to Aleksandar Jovanović, with real
mark-in/out clip windows — direct confirmation the earlier Scout-read-access fix holds up in real
use, not just this session's tests) — confirmed the tag list now shows the player's name on both
tags, the match dashboard's "View tags & clips" link is present, and the player dashboard's "Tags
& clips" link correctly points at `/matches/match-dunav-vs-sava/tag`. Left that match exactly as
the user had it; a separate scratch tag created on `match-morava-vs-drina` to verify the
dashboard-link data shape was cleaned up (tag/snapshot deleted, lock reverted) the same way prior
test artifacts were.

**Also, twice this session**: the running API dev server (`nest start --watch`) crashed with
`MODULE_NOT_FOUND` after a manually-run `pnpm build` (a full `nest build`) raced with the watcher's
own incremental compile and left `dist/` briefly missing `main.js` — not a code bug, a
build-tooling collision. Both times: confirmed port 3000 was actually free (the process had fully
died, unlike the earlier orphaned-process incident), then `pnpm dev` again. Worth remembering:
don't run a manual `nest build` while the watch-mode dev server is also running.

---

## Post-MVP: fixed a real Scout bug — "can't select a player while tagging" (2026-09-01, later still)

User reported a concrete, reproducible problem: while tagging as a Scout, the Player and Related
Player dropdowns were empty, and the tagging screen's header showed "… vs …" instead of real team
names. Reproduced live in a real browser first, then traced the root cause via direct API calls
before touching any code — this was a real gap in the RBAC overhaul above, not a data problem.

**Root cause**: a Scout has *zero* `ClubMembership` rows by design (`isScout` is a global flag,
same shape as `isSuperadmin` — see the enum comment). But `TeamsService`/`RostersService`/
`ClubsService`'s **read** paths (`GET /teams/:teamId`, `GET /teams/:teamId/rosters/:tournamentId`,
`GET /clubs`) were still scoped to `clubContext.accessibleClubIds`, which is only ever non-empty
for someone with real club memberships. A Scout's `accessibleClubIds` was an empty array, so
*every* club-scoped read 403'd for them — not just the writes the original RBAC pass deliberately
restricted. That's why team names failed to load (blocked `GET /teams/:teamId`) and why the roster
that feeds the player dropdown came back `403 Forbidden` instead of a player list.

**Fix**: `ClubScopeGuard` now gives Scouts the same `accessibleClubIds: "ALL"` sentinel Superadmins
already get, but **read-only** — a Scout needs to see any club's teams/rosters to know who's on
the court, the same way they can already tag any match. The risk this introduces: `RostersService`
and `PlayersService`'s *write* guards used to check `clubContext.accessibleClubIds === "ALL"` as
their "is this an Admin" test — extending that sentinel to Scouts would have silently handed them
roster-write and player-record-write access too, which the original spec explicitly reserves for
Admin alone. Fixed by having both services check `user.isSuperadmin` directly for writes instead
(added `AuthenticatedUser` to their method signatures, updated `RostersController`/
`PlayersController` to pass it through) — decoupling "can read any club" from "can write here" so
the two can never be conflated again. `TeamsController`'s writes were already gated on
`user.isSuperadmin` explicitly (from the original RBAC pass), so those needed no change.

Added 2 new backend tests specifically asserting a Scout is rejected from roster/player writes
despite having read-everywhere access (the exact leak this fix prevents) — 73/73 backend tests
pass. **Verified live**: re-visited the exact tagging screen that was broken — team names now
resolve ("Tag match: Seniori vs Seniori" — see below) and both Player dropdowns show all 5 roster
players; selected a player, confirmed via direct API call that the resulting tag carries the
correct `playerId`. Also caught and fixed a second, smaller issue while there: **team names were
literally "Seniori vs Seniori"** in that exact match header, because both clubs' senior teams
share the generic name "Seniori" with no club prefix — renamed every seeded team to include its
club (`Dunav Seniori`, `Sava Seniori`, etc.) via the existing idempotent seed upsert (no reset
needed). Verified in a real browser afterward: `TeamDetailPage` now reads "Dunav Seniori", the
5-player roster with jersey numbers renders correctly, and `PlayerDetailPage` shows the enriched
bio data (e.g. Aleksandar Jovanović: Guard, 188cm, RIGHT-handed) from the earlier seed enrichment.

**Full functional pass across every module, via `curl` as all four roles (Superadmin/Scout/
CLUB_ADMIN/Coach) plus real-browser spot checks — not just the one bug above**: club/team/player/
roster/tournament/match reads all correctly scoped per role; team/roster/player-record/tournament/
match writes all correctly Admin-only (403 for Scout and CLUB_ADMIN alike); Scout-only video/tag/
lock writes still correctly reject Coach and CLUB_ADMIN; the full tag → lock → stat-recompute →
dashboard pipeline re-verified end-to-end with hand-checked numbers (tagged a 2pt make + assist-
credit and an offensive rebound on two different players, locked, polled recompute, confirmed
match/team/career dashboards matched exactly) — then **reverted that test lock and its tags**
afterward since locking has no undo in this app and `match-morava-vs-drina` needed to stay
untouched for the user's own tagging practice (direct SQL cleanup, local dev DB only, confirmed
`match-dunav-vs-sava`'s pre-existing lock/tags from the user's own earlier testing were left
completely alone). Also verified: clip resolution (`NONE`/`DEEP_LINK`/`CLIP` typing), compilation
building (open to Coach, by design), the video-delete-blocked-while-tagged guard, and that
CLUB_ADMIN's unaffected features (club profile update, invites) still work.

---

## Post-MVP: RBAC overhaul — dedicated Scout role, Admin-only management, read-only Coach (2026-09-01)

User asked for a real permission-model change, not just a new role: introduce `SCOUT` for two
specific named users (Nikola, Vukašin) who are the *only* ones who can upload match video / add
a YouTube link / tag matches (mark actions, create clips); make Admin the *only* role that can
create/edit tournaments and matches, manage teams and team rosters, and decide which players
played for which team in a tournament; and make Coach read-only (can view all stats/tags/clips
the Scouts produce, but can't upload, tag, manage tournaments/matches, or touch rosters).
Enforced server-side, not just hidden in the UI.

**This directly conflicted with the existing architecture, so before writing any code the
existing implementation was inspected first and four architecture-defining questions were put
to the user (not guessed):**
1. **"Admin" = Superadmin only** (not CLUB_ADMIN too). The existing `CLUB_ADMIN` role already had
   exactly this power, but scoped to its own club (4 seeded club-admin users). Chose to make it
   Superadmin-exclusive — CLUB_ADMIN loses tournament/match/team/roster/player-record management
   entirely, keeping only club-profile editing and inviting members (unaffected, not asked about).
2. **Scout is a global flag, not a club-scoped role.** The existing `Role` enum's own comment said
   `SCOUT` was designed to be club-scoped like `CLUB_ADMIN`/`COACH` (a `ClubMembership` row per
   club) — but two named scouts need to tag *any* match across *any* club, which the per-club
   model can't express without a membership row per club, maintained forever as clubs are added.
   Chose a new `User.isScout` boolean, the same global-bypass shape `isSuperadmin` already uses.
3. **Admin retains an override** — Superadmin can still upload video/tag/lock as a fallback (e.g.
   to fix a scout's mistake), same spirit as Superadmin's existing override to delete a played
   match. Scouts remain the only ones who do it as normal workflow.
4. **Player master-record management (name/DOB/height — separate from roster assignment) is also
   Admin-only now**, not just CLUB_ADMIN/COACH-of-home-club as before — for full consistency with
   "Admin is the only role that manages roster-adjacent data."
Data cleanup: **full `prisma migrate reset --force`** on the local dev Postgres container (same
approach already used once before in this project), then reseed clean rather than surgically
deleting duplicate test matches.

### Backend (`apps/api`)

**Schema**: `User` gained `isScout Boolean @default(false)` (migration `20260901092814_add_scout_flag`)
— deliberately the same shape as `isSuperadmin`: a flag with no `ClubMembership` row, not a
`Role.SCOUT` membership. `Role.SCOUT` itself stays in the shared enum (harmless, matches the
existing `PLAYER`-is-reserved pattern) but is no longer how Scout permission is actually granted;
updated its doc comment to explain why.

**Auth plumbing**: `isScout` flows through the same path `isSuperadmin` already used —
`JwtAccessPayload`/`AuthenticatedUser` gained the field, `AuthService.issueTokenPair` now signs it
into the access token (login/refresh/accept-invite all pass it through), and `GET /users/me`
returns it so the frontend can read `currentUser.isScout`.

**Every write path that used to check `MANAGE_ROLES = [CLUB_ADMIN, COACH]` against the caller's
club membership was rewritten**, each now checking a plain boolean condition instead of doing a
club/role lookup at all (video/tags no longer even need `ClubContext` — dropped it from every
public method signature and the corresponding controller params):
- `VideoService`/`TagsService` (upload/register/remove video; create/update/delete/lock tags):
  `user.isSuperadmin || user.isScout` — global, no club lookup.
- `MatchesService` (create/update/recordResult/remove) and `TournamentsService`
  (create/update/remove): `user.isSuperadmin` only. Tournament's old "any CLUB_ADMIN of some
  club can create a clubless tournament" branch and its `assertClubAdmin` helper are gone —
  simplified to one check.
- `TeamsController` (create/update/delete): was `@Roles(Role.CLUB_ADMIN)` via the club-scoped
  `RolesGuard`; switched to an explicit `if (!user.isSuperadmin) throw ForbiddenException`, same
  pattern `ClubsController.create()` already used — clearer than relying on `@Roles(Role.SUPERADMIN)`
  ever passing only because `ClubScopeGuard` never assigns that role to a real membership.
- `RostersService`/`PlayersService` (roster add/remove/create; player create/update/remove):
  simplified `assertTeamEditable`/`assertCanEditClub` to "superadmin bypasses, everyone else is
  rejected outright" — dropped the `EDIT_ROLES` club-role lookup entirely. Reads (`find`/`search`/
  `findOne`) are untouched and stay fully open.
- `MatchesService.remove()`: kept the existing behavior that Superadmin can delete even a PLAYED
  match (an intentional override, not a bug) — since only an Admin can ever reach `remove()` now,
  the old `!user.isSuperadmin` condition on that guard would've been permanently-dead code, so it
  was removed outright with a comment explaining why, rather than left as confusing dead code.

70/70 backend unit tests pass (rewrote fixtures across `video`/`tags`/`matches`/`tournaments`/
`rosters`/`players` specs to use `isScout`/`isSuperadmin` fixtures instead of club-membership
roles, and added new tests asserting a Coach/CLUB_ADMIN is rejected where they used to be allowed).

### Frontend (`apps/web`)

`CurrentUser` gained `isScout`. Every page that gated a write form on `CLUB_ADMIN`/`COACH`
club-membership now gates on `currentUser?.isSuperadmin` (matches/tournaments/teams/rosters/
players) or `currentUser?.isSuperadmin || currentUser?.isScout` (tagging) instead — same
"UI mirrors backend, backend is the real authority" pattern already used everywhere else in this
app: `TournamentsListPage`/`TournamentDetailPage` (create tournament/match), `MatchDetailPage`
(record result), `ClubDetailPage` (split what used to be one `isClubAdmin`-gated block into
`canManageTeams`/`canCreatePlayer`, both Superadmin-only now, vs. `isClubAdmin` which still gates
club-profile/invites, unaffected), `PlayerDetailPage` (edit), and `TeamDetailPage` (previously had
**no** gating at all on roster create/add/remove buttons — added `canManageRoster` gating there
for the first time, since Admin-only enforcement now actually matters for that page).

**`TaggingPage`** (the biggest one): added `canTag = isSuperadmin || isScout` and gated the
keydown hotkey handler, `markIn`/`markOut`, `handleActionType`, the video-registration panel, the
team/player pickers + action-type button grid, per-tag edit/delete buttons, and the lock button —
all behind it. What a Coach still sees on this exact page, unblocked: the video player itself (if
registered), the read-only tag list with clip links (`ClipBadge`), and — deliberately left
available to everyone, not just Scout/Admin — the compilation builder, since building a
compilation only reads existing tags/clips and the backend never restricted it either. When no
video is registered yet, a Coach sees a plain "no video registered yet" message instead of the
upload/YouTube-link panel.

**New page**: `SelectMatchToTagPage` (`/tag`, linked from `NavBar` only for Scout/Admin) — the
literal "select an existing Tournament → Match from dropdowns" entry point the user asked for:
a Tournament `<select>`, then a Match `<select>` scoped to it, navigating straight to the existing
`/matches/:matchId/tag` screen on selection. Scouts never get a tournament/match *creation* UI
anywhere — this page only ever lists what an Admin already created.

22/22 frontend tests pass (9 files — added `SelectMatchToTagPage.test.tsx` and a new "RBAC" describe
block in `TaggingPage.test.tsx` asserting a Coach sees no action buttons/lock button/video panel;
fixed `TeamDetailPage.test.tsx`, which had never needed a token/`, /users/me` mock before because
the page had no RBAC gating until this session — it does now, so the test needed both).

### Demo data (`apps/api/prisma/seed.ts`)

Full `prisma migrate reset --force` + reseed. Same 4 clubs/teams/players/tournament as before,
plus: **a `COACH` ClubMembership per club** (didn't exist in the seed before — Coach was never
actually seedable, only inferred from the invite flow), and **exactly two Scout users** —
`nikola.scout@3x3app.local` / `vukasin.scout@3x3app.local` (`isScout: true`, no `ClubMembership`
at all, seeded directly like the superadmin — the invite-accept flow structurally can't create
one since it always attaches a `ClubMembership` to a specific club, and a global permission has
no single inviting club). Also seeded **two real `SCHEDULED` matches** under the existing
tournament, pairing every club's senior team once (`match-dunav-vs-sava`, `match-morava-vs-drina`)
— deliberately left with no video/tags/lock, so the full workflow (Admin already scheduled these;
a Scout picks Tournament → Match, adds video, tags, locks; a Coach then views the result) is
something to actually click through live, not something the seed pre-fakes.

**Verified against the live stack, both via `curl` and a real connected browser, not just unit
tests**: logged in as Scout Nikola → registered a YouTube video and created a tag on
`match-dunav-vs-sava` via the real API (cleaned up afterward so the seed match stays pristine for
manual testing) → confirmed a Coach gets a real `403` (`"Only a Scout or Admin can manage this
match's video/tags."`) attempting the same, and a real `403` locking a match, while `GET`ting the
same match's tags still returns `200` with the Scout's tag visible → confirmed a `CLUB_ADMIN` gets
`403` creating a tournament/team/roster/player (each with the correct new message), while still
succeeding at sending a club invite (unaffected feature) → confirmed a Scout gets `403` trying to
create a tournament or match (no accidental Admin-power leakage) → confirmed Superadmin succeeds
creating a tournament (cleaned up afterward). In the real browser: logged in as Nikola, used the
actual `/tag` page's Tournament→Match dropdowns, landed on the real tagging screen showing the
upload/YouTube panel and "Lock match" button; switched to the Coach login in the same tab and
confirmed the identical URL now shows "No video registered for this match yet." with no tagging
controls at all, the `/tournaments` page shows no create form, and the "Tag a Match" nav link
itself is gone from `NavBar`.

---

# Progress / Handoff

**Read this file first at the start of any session, before doing anything else.** Update it after
every meaningful step (not just at session end) — new files created, a phase step finished, a
decision made, tooling installed, etc.

Full architecture/design rationale lives in the approved plan file:
`C:\Users\anast\.claude\plans\project-3x3-what-this-piped-flamingo.md` (this repo doesn't track that
path — it's outside the repo — so re-read it directly if the reasoning behind a design choice below
needs more detail than this file gives).

---

## Post-MVP: Synergy-style manual clip in/out marking (2026-08-31, after MVP completion)

User asked for Synergy Sports-style clip marking: press a key to mark a clip's start, keep
watching, press another key to mark its end, then tag the action — that exact window becomes
the clip, instead of always relying on the automatic 5s-before/3s-after padding. Confirmed with
the user: `[` marks in, `]` marks out (not literal "I"/"O" — `o` was already the Offensive
Rebound hotkey); the auto window stays as the fallback when no marks are set, it doesn't go away.

**Backend**: `ActionTag` gained two nullable columns, `clipInSec`/`clipOutSec` (migration
`20260831141643_action_tag_clip_window`) — set together or not at all, enforced by a zod
`superRefine` on `createTagSchema`/`updateTagSchema` in `packages/shared` (also requires
`clipOutSec > clipInSec`). `computeClipWindow()` (`clip-window.ts`) now prefers an explicit
mark over the automatic padding when both are present, clamping a negative in-point to 0 exactly
like the automatic window already did. Every clip-per-tag/unique-ID guarantee from Phase 5 is
unchanged — this only changes which window ffmpeg cuts, not the one-clip-per-tag model that was
already in place (that part of the user's ask — "each [clip] has a separate ID so a person can
exactly mark which action was played, who played it" — was already true before this change).

**Frontend**: `TaggingPage` adds `markIn()`/`markOut()` (bound to `[`/`]` in the existing
window-level hotkey listener, plus visible "Mark in"/"Mark out" buttons mirroring the existing
action-type button+hotkey pattern) and a live "In: Xs" / "In: Xs – Out: Ys" indicator with a
Clear control. When an action type is picked with both marks set, `clipInSec`/`clipOutSec` ride
along in the `createTag`/`updateTag` payload (edit flow reuses the same marks behind a
"Use marked in/out for the clip window" checkbox, mirroring `recaptureTimestamp`'s pattern).
Marks reset after each tag so the next one starts clean. The tag list shows a
"Clip: Xs – Ys" indicator whenever a tag carries a manual window, so it's visually distinguishable
from an auto-windowed one — closing the "clearly mark which action" half of the ask.

**A real bug caught by the frontend test suite itself, not manual testing**: the new tag-list
clip-window indicator originally checked `tag.clipInSec !== null` — but the existing
`TaggingPage.test.tsx` fixtures (predating this change) don't set that field at all, so it came
through as `undefined`, and `undefined !== null` is `true` — the guard passed, then
`tag.clipInSec.toFixed(1)` threw on `undefined`, crashing the whole page in two unrelated
existing tests. Fixed by switching the guard to `typeof tag.clipInSec === "number"`, which is
correct regardless of whether the API/mocks send `null` or omit the field entirely.

**Verified with concrete evidence, not just code review**:
- Backend, via direct API calls against the real running stack: uploaded a real video, created a
  tag with `clipInSec: 2, clipOutSec: 11` (a 9s window, deliberately different from the 8s auto
  default so the result is unambiguous), waited for the real ffmpeg job, downloaded the actual
  clip bytes, and ran `ffprobe` on them — **reported duration 9.13s**, matching the manual window
  (not the 8s default), the small drift being the same accepted `-c copy` keyframe-snap tradeoff
  already documented in Phase 5.
- Frontend, in a real connected browser: confirmed the tag list correctly renders
  "Clip: 2.0s – 11.0s" for that API-created tag; clicking the real "Mark in" button correctly
  showed the "In: 0.0s — press ] to mark out" indicator and enabled "Mark out"; clicking "Mark
  out" before the video's time had actually advanced was correctly rejected by the
  `t > markedInSec` guard (no false-positive 0-length window) — a genuine positive confirmation
  of the validation working, not a bug.
- 68 backend unit tests pass (7 new: DTO validation + clip-window math with an explicit mark), 19
  frontend tests pass (1 new: a full `[`/`]` mark → tag-creation flow via `fireEvent.keyDown`,
  asserting the created tag's payload carries the exact marked window).

**Known gap, honestly flagged, not silently skipped**: a full literal-keypress, real-video-time-
elapsing click-through was attempted but blocked by this session's automated browser environment
— native `<video>` playback never left `readyState: 0` despite the exact same presigned URL
being independently confirmed fetchable via a direct `curl` (200, correct byte count), and the
YouTube embed's play button didn't produce real elapsed time either. Both symptoms match this
session's earlier-observed video-decode-related tab instability (see the Phase 3-era note below
about a tab freeze), not anything about this feature's code — every piece of actual application
logic involved (DTO validation, clip-window math, hotkey wiring, button-driven mark/clear, guard
correctness, list rendering) was independently verified through means that don't depend on real
video decode. Worth a literal hotkey-during-real-playback pass next session if a more stable
browser environment is available.

---

## MVP COMPLETE — all 6 phases of the plan file are done (2026-08-31)

The full "build first" loop the plan file's intro describes — **upload/link video → tag → lock →
see stats + clips** — now works end-to-end, verified live, not just build-checked. Phase 5 (clip
generation) was the last phase in the plan; this session finished and verified it, so the
originally-scoped v1 build is complete.

**What actually works today, verified live**: log in → create/manage clubs, teams, players,
rosters → invite coaches by email → schedule tournaments/matches → record manual results OR
register a video (file upload via presigned MinIO URL, or a YouTube link) → tag actions with
keyboard shortcuts, point values always server-derived → lock a match → a background job computes
match/tournament/career stats automatically → dashboards show them → another background job
ffmpeg-cuts a real playable clip for every FILE-source tag (YouTube tags get an instant deep link
instead) → clips can be assembled into an ordered, mixed-source compilation and played back.

**What's deliberately still missing** (from the plan's own "build after v1" list — none of this
was ever in scope for this build, don't treat it as a bug or an oversight):
- Advanced stats: points-per-possession, +/-, shot-clock usage, clutch splits (the schema already
  has nullable columns reserved for this on `StatSnapshot` — `pointsPerPossession`, `plusMinus`,
  `avgPossessionSec` — so adding these later is a backfill, not a migration).
- Cross-club public player profiles (today player scouting requires login; there's no public
  unauthenticated view).
- PDF/Excel export of stats or compilations.
- `SCOUT` and `PLAYER` roles: both exist in the `Role` enum and are already handled correctly
  everywhere superadmin/CLUB_ADMIN/COACH are checked (they're just never assignable from any UI
  — no invite flow offers them, no self-service registration exists for a `PLAYER` login).
- Any real video transcoding/normalization pipeline — uploaded FILE videos are stored and played
  back exactly as uploaded; there's no re-encode step, thumbnailing, or format validation beyond
  `Content-Type` at upload time.

**Known rough edges worth knowing about, not fixed this session** (none block the MVP loop):
- `apps/web` has no styling beyond inline styles — a deliberate, repeatedly-confirmed deferral
  from Phase 0 onward, not forgotten.
- `pnpm --filter web lint` still doesn't work (`eslint` referenced in `package.json`'s `lint`
  script but never actually installed/configured) — flagged since Phase 0, still true.
- No E2E (Supertest-level) API test suite exists yet (`apps/api/test/jest-e2e.json` referenced by
  `package.json` but never created) — only unit tests exist at every phase so far.
- ffmpeg clip cuts use `-c copy` (stream copy) for speed, which snaps to the nearest keyframe —
  actual clip boundaries can drift a few hundred ms from the requested window (confirmed: a
  requested 8.000s window produced an 8.334s clip in this session's live test). This is the
  plan's own accepted tradeoff, not a bug.

---

## Where we are right now

**Phase 5 — Clip generation — DONE. This was the last phase in the plan file (see the MVP-complete
note above).** Built and verified end-to-end (2026-08-31, later still): a FILE-source tag gets a
real ffmpeg-cut clip via an in-process BullMQ worker; a YouTube tag gets an instant deep link, no
job at all. Compilations mix both source types in one ordered playlist.

### Phase 5 — backend (`apps/api`)

`ffmpeg-static` + `ffprobe-static` (bundled prebuilt binaries, no system ffmpeg install needed —
**actually ran both `.exe`s directly before writing any pipeline code** to confirm they work on
this Windows machine, not just assumed). `S3Service` gained clip-bucket methods
(`downloadVideoToFile`, `uploadClip`, `getClipPlaybackUrl`) alongside its existing video-bucket
ones.

**`ClipGenerationQueueService`/`ClipGenerationWorker`** (`common/queue/`, `modules/clips/`): same
producer/consumer split as Phase 4's stat-recompute queue, to avoid a TagsModule↔ClipsModule
circular dependency. `TagsService.create()` now creates a `ClipJob` (`status: QUEUED`) and
enqueues a job **only** when the tag's video is `FILE`-sourced — an `EXTERNAL` (YouTube) tag never
gets a `ClipJob` row at all. The worker: downloads the source video from MinIO to a temp file →
runs `ffmpeg -ss <start> -i <src> -t <duration> -c copy` (fast keyframe-snapped seek + stream
copy, the plan's explicit speed/precision tradeoff) → **checks the output file is actually
non-empty before trusting anything** (Phase 4 already taught this project that a job's reported
status isn't proof of anything) → uploads to the `clips` bucket → marks the `ClipJob` `COMPLETED`
with its `outputKey`. Any failure marks it `FAILED` with the error message, never crashes the
worker process. Temp files are always cleaned up (`finally` block).

`computeClipWindow(timestampSec)` (`modules/clips/clip-window.ts`) is a pure function: window end
is fixed at `timestampSec + CLIP_SECONDS_AFTER`, start is `max(0, timestampSec -
CLIP_SECONDS_BEFORE)` — a tag near the very start of a video gets a shorter clip, never a negative
`-ss`. `buildYoutubeDeepLink()` (`modules/clips/youtube-deep-link.ts`) handles both
`youtube.com/watch?v=` and `youtu.be/` URL shapes, floors the timestamp (`&t=Ns`). Both are pure,
DB-free, and unit-tested directly against edge cases (negative-clamp, both YouTube URL shapes).

**`ClipsService.resolveTagClip(tagId)`** is the single resolution path — `NONE` (tag has no
video), `DEEP_LINK` (EXTERNAL, built on read, no storage), or `CLIP` (FILE — job status, plus a
presigned playback URL once `COMPLETED`) — shared by both `GET /tags/:tagId/clip` and
`CompilationsService`, so the two can never drift apart. **`CompilationsModule`**: `POST
/compilations` (title + ordered `actionTagIds[]`, any authenticated user — tags are already
open-read, so `createdById` is attribution only, not an access boundary), `GET /compilations/:id`
(each item resolved to its clip/deep-link via the shared path above), `GET /compilations` (own
compilations; superadmin sees all).

**Note on a Prisma enum-nominal-typing snag** (same category as Phase 4's, much smaller): Prisma
generates its own `JobStatus` enum distinct from `@3x3/shared`'s even though the string values
match — assigning a Prisma-typed value into a hand-written return type using the shared enum
failed to compile. Fixed by importing `JobStatus` from `@prisma/client` in `ClipsService`/the
worker instead of `@3x3/shared` (equality comparisons across the two enums are fine, as
`VideoSourceType` comparisons elsewhere already showed — only direct assignment into a typed
position hits this).

12 new backend unit tests (`clip-window.spec.ts`, `youtube-deep-link.spec.ts`, plus 3 in
`tags.service.spec.ts` covering the FILE-creates-a-ClipJob / EXTERNAL-never-does /
no-videoAssetId-never-does branching). 53/53 backend tests passing.

**Verified against the live stack with real evidence, not just "HTTP 200" or "status:
COMPLETED"**: generated a real 20-second synthetic MP4 with ffmpeg itself (`testsrc` pattern),
uploaded it through the real presigned-URL flow, tagged it at 12s, polled the clip job to
`COMPLETED` (~1s), **downloaded the actual resulting clip bytes from its presigned URL and ran
ffprobe on them** — confirmed a real H.264 video, 320×240 (matching the source), **8.334s
duration** (requested window was exactly 8s; the ~0.3s drift is the expected keyframe-snap
artifact of `-c copy`, not a bug). Also registered a YouTube video, tagged it, confirmed `GET
/tags/:tagId/clip` returns a correctly-formed deep link (`&t=30s`) and that no `ClipJob` was ever
created for it. Built a compilation mixing both tags and confirmed `GET /compilations/:id`
resolves each item correctly, in order.

### Phase 5 — frontend (`apps/web`)

`ClipBadge` (`features/clips/ClipBadge.tsx`) renders inline in the tagging screen's tag list: a
`DEEP_LINK` tag shows an immediate link (no polling — there's no job), a `CLIP` tag polls `GET
/tags/:tagId/clip` every second only while `QUEUED`/`PROCESSING`, then shows either a play link
or a failed state — same "stop polling once settled" shape as Phase 4's
`useStatRecomputeStatus`. The tagging screen's tag list gained checkboxes feeding a
"build compilation" form (title + selected tags, in list order) that creates a `Compilation` and
navigates straight to it. `CompilationDetailPage` renders each item in order — an inline
`<video>` for a completed FILE clip, a link for a YouTube deep link, a status label otherwise.
`CompilationsListPage` + a `/compilations` nav entry. sr/en i18n throughout.

New test: `TaggingPage.test.tsx` gained a "compilation builder" describe block — selects a tag,
types a title, submits, asserts the exact POST body and that it navigates to the new
compilation's page. 18/18 frontend tests passing (also had to add the previously-missing
`GET /tags/:tagId/clip` mock to the shared test fetch handler — the existing two adapter-parity
tests were silently hitting an unhandled-route error on it before, harmless since they never
asserted on it, but worth fixing so the mock accurately models the real API surface).

**Verified in a real browser** (Chrome extension connected): opened the tagging screen for the
match used in the backend verification above — saw a "Play clip" link next to the FILE tag and a
"Deep link" link next to the YouTube tag, rendered distinctly as designed. **Clicked "Play clip"
and watched a real video actually play** (the ffmpeg `testsrc` color-bar pattern, counting down
from 10, 0:00→0:08) in a new tab pointed at the presigned MinIO URL — not just a link that
resolved, an actual playing video. Selected both tags, built a compilation named "Best plays vol
1", got navigated to its detail page, and confirmed the inline `<video>` for the FILE clip
actually played (pause icon appeared, timer advanced) sitting next to the YouTube "Deep link" —
genuinely mixed-source playback in one ordered list, the phase's actual testable deliverable.
Checked `/compilations` and confirmed the list page shows all compilations created this session.

---

## Where we are right now

**Phase 4 — Stat computation + dashboards — DONE.** Phases 0-3 are done (see below). This
session (2026-08-31, later still) built and verified Phase 4 end-to-end: locking a match
triggers a background stat-recompute job (BullMQ/Redis), which populates match/team/player
dashboards — every number independently hand-verified against a fixture of known tags, both via
`curl` and in a real browser.

### Phase 4 — backend (`apps/api`)

First module needing a background job queue — added `bullmq` + `ioredis`. `QueueModule`
(`src/common/queue/`, `@Global()`) provides a shared Redis connection (`REDIS_CONNECTION` token)
and `StatRecomputeQueueService` (the producer side — just `enqueueMatchRecompute(matchId)`).
`TagsModule`'s existing `lockMatch()` now enqueues a job on a match's **first** lock only (the
idempotent re-lock no-op still doesn't re-enqueue — covered by an updated unit test).

**`StatsModule`** (`src/modules/stats/`): the consumer is `StatRecomputeWorker`, a BullMQ
`Worker` created in-process (`onModuleInit`) rather than a separate deployable process — a
single worker is enough at this scale per the plan. The actual aggregation math lives in a pure,
DB-free function, `stat-aggregation.ts`'s `aggregateMatchTags()` — the single most
test-worth-investing-in piece of this phase, covered by hand-built fixtures asserting exact
expected points/rebounds/assists/etc., not just "some snapshot got created." `StatsService`
wraps it: **MATCH** scope (one `StatSnapshot` row per player/team touched by the match, computed
directly from that match's `ActionTag` rows) → **TOURNAMENT** scope (summed from the cached
MATCH rows within that tournament, never re-scanning raw tags) → **CAREER** scope, **players
only, not teams** — a "team career" isn't a coherent concept the way a player's is (judgment
call). `pointValueForActionType()` is reused for the point math rather than re-derived, so it
can never drift from what `TagsService` already used when a tag was created. `GET
/matches/:matchId/stat-recompute-status` lets the frontend (and this session's own verification)
poll for job completion instead of guessing with a fixed sleep.

**Real bug caught only by live verification, not by the type checker**: Prisma's compound-unique
`where()` (the `@@unique([scopeType, playerId, teamId, matchId, tournamentId])` constraint)
**rejects `null` at runtime** for nullable fields in the key, even though the columns and the
underlying index are genuinely nullable — a known Prisma limitation, not just a type-generation
gap. A cast had silenced the TypeScript error, so this shipped, built clean, and passed unit
tests — then failed every single recompute job at runtime with `Argument teamId must not be
null`, discovered only because a locked match's dashboard never populated during hand-verification.
Fixed by replacing `upsert`-by-compound-key with a plain `findFirst` (which handles `null` fine)
followed by `create`/`update`-by-id, in both `StatsService.upsertSnapshot` and
`DashboardsService`'s two `findUnique` calls. Re-verified live afterward — see below.

**`DashboardsModule`** (`src/modules/dashboards/`) reads only from `StatSnapshot`, **never**
live-aggregates `ActionTag` — `GET /matches/:matchId/dashboard` (box score, open read), `GET
/teams/:teamId/dashboard?tournamentId=` (tournament-scoped, 400 without `tournamentId` — teams
have no CAREER scope), `GET /players/:playerId/dashboard` (CAREER totals + per-match history).

**Stat-threshold scouting**: `PlayersModule`'s search gained `minPpg`/`maxPpg` (PPG = CAREER
`points / gamesPlayed`, 0 for a player with no CAREER row yet i.e. never played a locked match).
This is a derived ratio, not a stored column — deliberately filtered in the service layer after
fetching candidates rather than fought into a single Prisma query; fine at this data scale.

**Verified against the live stack with hand-calculated numbers, not just "a dashboard
rendered"**: scheduled a fresh match (KK Dunav Seniori vs KK Sava Seniori), tagged exactly 6
actions with known expected output (player-dunav-1: 2pt made + 2pt missed + assist → 2 pts,
1/2 on 2pt, 1 assist; player-dunav-2: 1 offensive rebound; player-sava-1: FT made + personal
foul → 1 pt, 1/1 FT, 1 foul), locked the match, polled `stat-recompute-status` until ready
(~1-2s), then fetched all three dashboard endpoints and confirmed **every single number matched
the hand calculation exactly** — match box score, both teams' tournament-scope rows, and
player-dunav-1's career row. Also verified the PPG filter: `minPpg=2` returned only the 2.0-PPG
player, `minPpg=0.5&maxPpg=1.5` returned only the 1.0-PPG player, and an unfiltered query
correctly included never-tagged players (implicit 0 PPG, not excluded). 41/41 backend unit
tests pass (12 new: stat-aggregation fixtures, updated lock/enqueue tests).

### Phase 4 — frontend (`apps/web`)

New `features/dashboards/` (`api.ts` + three pages): `MatchDashboardPage`
(`/matches/:matchId/dashboard`, box score tables for teams and players), `TeamDashboardPage`
(`/teams/:teamId/dashboard?tournamentId=`, linked from `TeamDetailPage` once a tournament's
selected), `PlayerDashboardPage` (`/players/:playerId/dashboard`, career totals + per-match
table, linked from `PlayerDetailPage`). `useStatRecomputeStatus` polls every second (via
TanStack Query's `refetchInterval`, stopping once `ready`) — `MatchDetailPage` uses it so a
locked match shows "Computing stats..." and then a real dashboard link once the job finishes,
making "lock → stats populate" something to actually watch happen rather than only provable via
`curl`. `PlayersListPage` gained Min/Max PPG filter inputs. New `dashboards` i18n namespace,
sr/en. 17/17 frontend tests pass (2 new, covering both the "still computing" and "ready, link
shown" states of the poll).

**Verified in a real browser** (Chrome extension was connected) against the exact fixture from
the backend verification above: match dashboard, team dashboard, and player dashboard all
rendered the exact hand-checked numbers with no discrepancy; the PPG filter narrowed the
players list to exactly the expected player. One false alarm during this pass, not a bug: a
`/teams/:teamId` request 403'd because the browser session had a stale non-superadmin login
left over from earlier manual testing (a club admin with no access to the other club's team) —
re-logging in as the seeded superadmin resolved it immediately; nothing wrong with the code.

### Judgment calls (Phase 4, not asked about further)
- Teams get MATCH and TOURNAMENT stat scopes only, never CAREER — "team career" doesn't map
  to a real concept the way a player's does.
- Locking a match does **not** touch `match.status`/scores — Phase 2's manual-result path and
  the tagging/stat-recompute path stay fully independent, as established in Phase 3.
- `stat-recompute-status`'s "ready" check is simply "does at least one MATCH-scope snapshot row
  exist for this match" — simpler than tracking BullMQ job IDs client-side, and sufficient since
  a match can currently only be locked (and therefore recomputed) once.

---

**Session update (2026-08-31, later still) — replaced test-junk seed data with 4 real-looking
clubs.** After a long testing pass (Phases 0-3), the dev DB had accumulated ad-hoc clutter from
live UI testing (an extra "KK NMG" club, duplicate players, throwaway matches/invites). At the
user's request, rewrote `apps/api/prisma/seed.ts` from the single "KK Primer" sample club to 4
clubs (KK Dunav/Beograd, KK Sava/Novi Sad, KK Morava/Nis, KK Drina/Kragujevac — fictional
river-name clubs, not real organizations), each with one `CLUB_ADMIN` login, 2 teams, 5 players,
and a roster already built for their senior team against one shared cross-club tournament
("Regionalni Kup 2026", `clubId: null`). The superadmin (`admin@3x3app.local`) is untouched.
**Ran `prisma migrate reset --force`** to actually wipe every row (not just re-run the idempotent
seed, which wouldn't have removed data created outside it) and reseed clean — this is a local-only
Postgres container, safe to reset freely. Hit one snag: a leftover `node dist/src/main.js` process
from earlier manual testing was still holding the Prisma query engine `.dll` open, causing `EPERM`
on `prisma generate` right after the reset — killed that stray process, regenerated cleanly,
rebuilt, and confirmed via `curl` that all 4 clubs list correctly and the new club-admin logins
work. The 4 club-admin passwords are hardcoded in `seed.ts` itself (same pattern the superadmin's
fallback password already used) — local-dev-only credentials, fine to commit, not real secrets;
see `seed.ts` for the actual values rather than duplicating them here where they'd drift out of
sync if ever changed.

**Phase 3 — Video upload + tagging UI — DONE.** Phases 0-2 are done (see below). This session
(2026-08-31, later still) built and verified Phase 3 end-to-end: register a video against a match
both ways (uploaded file via presigned MinIO URL, and a YouTube link), tag actions against it with
keyboard shortcuts, edit/delete pre-lock, lock the match, confirm further tag mutations are
rejected once locked.

### Phase 3 — backend (`apps/api`)

New modules wired into `app.module.ts`: `VideoModule` (`src/modules/video/`) and `TagsModule`
(`src/modules/tags/`). Added `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (first module
needing an AWS SDK) behind a small `S3Service` (`src/common/s3/s3.service.ts`) wrapping a
path-style `S3Client` pointed at MinIO via the already-existing `S3_*` env vars.

**VideoModule**: `POST /matches/:matchId/videos/upload-url` generates a presigned PUT URL for a
`fileKey` namespaced `matches/:matchId/<uuid>-<fileName>` (collision-proof across matches and
across repeated uploads of the same filename — covered by a unit test); the browser PUTs the raw
file bytes straight to MinIO, then `POST /matches/:matchId/videos` registers the `VideoAsset` row
(FILE or EXTERNAL via a discriminated-union zod schema). `GET /videos/:videoAssetId/playback-url`
returns a presigned GET URL for FILE sources or the raw `externalUrl` for EXTERNAL (no signing
needed for YouTube). `DELETE /videos/:videoAssetId` is blocked if any `ActionTag` already
references it. Role check mirrors `MatchesModule`'s: `CLUB_ADMIN`/`COACH` of the match's home or
away team's club, or superadmin.

**TagsModule**: `ActionTag` CRUD scoped to a match's home/away club. **`pointValue` is always
derived server-side** from `actionType` via the existing `pointValueForActionType()` helper —
the create/update DTOs don't even accept a client-supplied value being trusted; verified live that
a request smuggling `pointValue: 99` alongside `SHOT_2PT_MADE` still persists `pointValue: 2`.
All mutations (create/update/delete) are rejected once `match.lockedAt` is set. `POST
/matches/:matchId/lock` sets `lockedAt = now()`; deliberately does **not** touch
`match.status`/scores — Phase 2's manual-result path and this tagging path are parallel, not
sequential (a match can be tagged without ever having a manual result entered, and vice versa).
Locking is idempotent — locking an already-locked match is a no-op, not an error, so a coach
re-clicking "Lock match" never sees a failure.

New shared DTOs: `packages/shared/src/dto/{video,tag}.dto.ts`. 14 new backend unit tests (35/35
total passing) covering the lock-blocks-mutation guard, server-side point-value derivation
(including the "malicious client" case), presigned-key collision-freedom, and the
delete-blocked-while-tagged guard.

### Phase 3 — frontend (`apps/web`)

**`VideoPlayerAdapter`** (`features/video-tagging/player/`) — the core abstraction from the plan
file: `getCurrentTime/seekTo/play/pause/setPlaybackRate/getDuration/onTimeUpdate/onReady/destroy`.
Two implementations: `Html5VideoAdapter` (wraps a native `<video>`) and `YouTubeAdapter` (wraps
the YouTube IFrame Player API, polling `getCurrentTime()` every 250ms since YouTube has no native
`timeupdate` event). `VideoPlayer.tsx` is a small factory component — the *only* place in the app
that branches on `sourceType`; everything else (the tagging screen) only ever holds a
`VideoPlayerAdapter` reference.

**Real bug caught by writing a genuine adapter-parity test** (`TaggingPage.test.tsx` renders the
real tagging screen against a mocked jsdom `<video>` for FILE and a stubbed `window.YT.Player` for
EXTERNAL, asserting a hotkey press captures the *adapter's* current time identically through
both): the YouTube IFrame API doesn't nest its `<iframe>` inside the element you hand it — it
**replaces** that element in the DOM outright. Passing it the React-managed `containerRef`
directly meant YouTube silently tore that node out of the tree behind React's back; the symptom
was a permanently blank video pane with 0 DOM children even though the network request for the
embed itself succeeded (caught in real-browser testing, not just the unit test — see below).
Fixed in `VideoPlayer.tsx` by handing YouTube a plain, imperatively-created child `div` that React
never owns or reconciles, confirmed live afterward (see below).

Two more real gaps caught while building the tagging screen (fixed, not just noted):
- `usePlayers()` had no `enabled` gate, so the tagging screen's club-roster fallback query fired
  on *every* render even when a tournament roster already existed and made it moot. Added an
  `enabled` option to `usePlayers`, gated to only fire when the active team truly has no roster
  yet (and only once the roster query has actually settled, not mid-load).
- `TaggingPage` never auto-selected an already-registered video — a coach returning to tag a
  match would've had to re-pick it from a radio list on every single visit. Now auto-selects the
  first video once the list loads if nothing's chosen yet.

**Tagging screen** (`features/video-tagging/pages/TaggingPage.tsx`, route `/matches/:matchId/tag`,
linked from `MatchDetailPage`): video registration/selection at the top (delegates to
`features/video/VideoRegistrationPanel.tsx` — file upload via the presigned-URL flow, or a
YouTube-link form), then a two-pane tagging layout once a video's selected — player on the left,
team/player/related-player pickers and a 13-button action grid on the right, each button bound to
the fixed hotkeys in `ACTION_TYPE_HOTKEYS` (already existed from Phase 0 scaffolding) via a
`window.keydown` listener that ignores keystrokes while focus is inside any input/select/textarea.
Player pickers prefer the match's tournament roster per team, falling back to the team's whole
club roster if no roster's been built yet (judgment call — tagging should never be blocked on
roster-building first). Tags list below is scrollable, editable (re-pick action type/player/
related-player, with an explicit "use current video time" checkbox rather than silently
overwriting the original timestamp) and deletable pre-lock, all controls disabled once locked. A
sticky "Lock match" button flips to a disabled "Locked" state afterward. New `tagging` i18n
namespace (sr/en), including per-`ActionType` labels matching the existing
`ACTION_TYPE_I18N_KEY` constant's expected key shape.

**Verified against the live stack (not just build-verified)** — restarted the API to pick up the
new S3 SDK + modules, then via `curl` against the real running API + real MinIO: registered a
YouTube link, requested a presigned upload URL, `PUT` real bytes to MinIO, registered the FILE
`VideoAsset`, fetched its presigned playback URL and confirmed `curl`ing *that* URL actually
returns the uploaded bytes back (full round-trip through real object storage, not mocked) — tagged
a `SHOT_2PT_MADE` with a spoofed `pointValue: 99` in the request body and confirmed the stored row
has `pointValue: 2` (server-derived, client value ignored) — tagged a non-shot `STEAL` and
confirmed `pointValue: null` — edited and deleted tags pre-lock — locked the match and confirmed
create/edit/delete all now correctly 400 — confirmed re-locking is a no-op — confirmed a video
with no tags against it can be deleted (the has-tags-blocks-delete branch is unit-tested
separately). This is Phase 3's actual testable deliverable, confirmed working end-to-end against
real infrastructure, not assumed from code review.

**Also real-browser-verified this session** (Chrome extension was connected) — clicked through the
actual tagging screen: registered a YouTube link via the UI, watched the embedded player actually
render (this is what caught the DOM-replacement bug above — first attempt showed a permanently
blank pane), clicked an action button and watched a real tag appear in the list with the correct
`(+2)` point value, deleted it via the UI, clicked "Lock match" and watched every control disable
and the button switch to a greyed-out "Locked" state. `pnpm --filter @3x3/shared build`, `pnpm
--filter api build`, `pnpm --filter web build` all pass clean; `pnpm --filter api test` (35/35) and
the frontend Vitest suite (15/15, including the adapter-parity test) both green — all re-verified
independently after the DOM-replacement fix, not just trusted from before it.

**Not built (explicitly out of scope for Phase 3, per the plan file)**: stat computation/
dashboards (Phase 4, including anything that reads `ActionTag` for aggregation), clip generation/
BullMQ workers (Phase 5). `Match.lockedAt` now flips correctly but nothing downstream consumes it
yet — that's exactly what Phase 4's `stat-recompute` trigger is for.

---

## Where we are (Phase 2)

Phases 0-2 done. This session (2026-08-31, same day, earlier) built and verified Phase 2
end-to-end: create a tournament, schedule a match between two teams, record a manual result,
confirm it stuck.

**Session update (2026-08-31, later still) — real browser click-through of Phases 1+2, not just
component tests.** The Chrome extension connected this time, so every screen from both phases was
actually clicked through end-to-end for the first time: clubs list/detail, invite-a-coach (sent a
real invite, read it back out of Mailhog, accepted it via `/register`, logged in as the new
coach), roster builder (add/remove a player), players scouting search (city filter), tournament
detail, scheduling a match via the club→team cascading dropdowns, and recording a manual result
(status flip to `PLAYED` confirmed visually). Also confirmed frontend RBAC conditionality actually
matches the backend for a real non-superadmin session: as the coach, `/clubs` showed only their
own club, the "New team"/invite forms were correctly hidden (`CLUB_ADMIN`-only), and "New player"
was correctly shown (`COACH`-allowed) — this had only ever been asserted in mocked component
tests before now.

**Real bug found and fixed**: clicking "Log out" on `HomePage` cleared the stored tokens (via
`authStorage.clear()`) but never navigated anywhere — the page kept rendering the stale
logged-in view (name, email, club list) until the user manually navigated elsewhere, at which
point `RequireAuth` would catch the missing token and redirect. Not a security hole (the token was
genuinely gone, so a protected fetch or route change was always safe), but confusing/broken UX —
a user clicking Log out would reasonably conclude nothing happened. Fixed in
`apps/web/src/features/auth/api.ts`'s `useLogout()`: added `useNavigate()` and now calls
`navigate("/login", { replace: true })` after clearing storage/query cache. Verified the fix live
(logout now redirects to `/login` immediately) and added a regression test,
`apps/web/src/features/auth/pages/HomePage.test.tsx`, asserting both the redirect and that
`authStorage.getAccessToken()` is null afterward. All 13/13 frontend tests still pass.

Also worth noting for next time: Chrome's own form autofill kept injecting the *superadmin's*
saved login into unrelated fields (the invite-accept page's "Last name"/"Password" fields, and the
login form when logging in as a different user) — not an app bug, just something to watch for
when testing multiple accounts in the same browser profile; always verify field contents before
submitting rather than trusting autofill.

### Phase 2 — backend (`apps/api`)

`TournamentsModule` upgraded from Phase 1's read-only picker stub to full CRUD (list/get open to
any authenticated user; create/update/delete require `CLUB_ADMIN` of the organizing club, or
superadmin). New `MatchesModule`: schedule a match under a tournament (`POST
/tournaments/:tournamentId/matches`), pre-game field updates (`PATCH /matches/:matchId`, status
limited to SCHEDULED↔IN_PROGRESS — not PLAYED), and the manual-result-entry endpoint (`PATCH
/matches/:matchId/result`, flips `status` to `PLAYED`). New shared DTOs:
`packages/shared/src/dto/{tournament,match}.dto.ts`.

**RBAC decisions**: match create/update/result/delete require `CLUB_ADMIN`/`COACH` of *either* the
home team's club *or* the away team's club (not both) — either side of a matchup can schedule and
manage it. Tournament writes require `CLUB_ADMIN` of the `clubId` on the tournament; a clubless
(multi-club, no single organizer) tournament can be created by any `CLUB_ADMIN` of *some* club, but
only a superadmin can update/delete one once created (judgment call — a clubless tournament has no
natural single owner to defer to).

**Judgment calls**:
- Deleting a `PLAYED` match is blocked for everyone except superadmin — a wrong result should be
  *corrected* via another `PATCH .../result` call, not deleted and silently disappear from the
  record. Verified live (see below): a coach got a real 400 trying to delete a played match.
- `PATCH /matches/:matchId` (pre-game fields) explicitly refuses `status: PLAYED` in its zod
  schema — that transition only happens through `/result`, so there's exactly one code path that
  ever sets a match's score.
- Frontend match-creation team pickers are scoped to clubs the current user belongs to (fetched
  via the existing `useClubs()`/`useTeamsForClub()` hooks from Phase 1) for *both* home and away
  sides — not a global "any team in the system" picker, since no cross-club "list all teams"
  read endpoint exists yet (only `GET /clubs/:clubId/teams`). This is a real UI limitation (you
  can't schedule against an opponent club you have no membership in) even though the *backend*
  RBAC only requires a role in one of the two clubs. A global team-browse endpoint (mirroring
  the open-read pattern already used for `PlayersModule`/`TournamentsModule`) would remove this
  limitation — worth adding in a later phase if cross-club match scheduling from the UI turns out
  to matter; not added now since it wasn't asked for and would be scope creep on Phase 2.
- The tournament detail page's "manage roster" links per participating team resolve each team's
  `clubId` via a small `TeamRosterLink` subcomponent (calls the existing `useTeam(teamId)` hook)
  rather than adding a new backend endpoint just to carry `clubId` alongside match data — kept the
  API surface unchanged for this.
- `TeamDetailPage` now reads an optional `?tournamentId=` query param to pre-select the roster
  builder's tournament picker, so the tournament-detail page's roster links land on the right
  tournament immediately instead of requiring a second manual selection.

**Bug caught (and fixed) while writing unit tests**: `TournamentsService.create` wasn't declared
`async`, so its synchronous `ForbiddenException` throws (RBAC rejection) were raised directly
instead of being wrapped into a rejected promise — broke `rejects.toBeInstanceOf(...)`-style
assertions in tests, and would have been equally surprising for any real caller doing
`await tournamentsService.create(...).catch(...)` expecting a normal promise rejection. Fixed by
adding `async`. `apps/api` test count: **20/20 passing** (12 new: `matches.service.spec.ts` covers
home/away role resolution, the played-match delete guard, and the result status flip;
`tournaments.service.spec.ts` covers the club-scoped vs. clubless-tournament RBAC).

**Verified against the live stack (not just build-verified)** — both dev servers were already
running from the prior session's manual-testing setup, confirmed the API had hot-reloaded the new
modules (`GET /tournaments` returned `401 Unauthorized` rather than a 404, i.e. the route exists
and is now guarded, versus Phase 1 where it was `@Public`-equivalent open). Via curl, logged in as
seeded superadmin → created a second team under the seed club (`U18 Girls`, needed because the
seed data only ships one team and a match needs two) → `POST
/tournaments/seed-tournament-1/matches` (home: `seed-team-1`, away: the new team) → `PATCH
.../result` with `{homeScore:21, awayScore:17, endType:REGULAR_TIME, homeTeamFouls:5,
awayTeamFouls:8}` → `GET` the match back and confirmed the score/status/fouls all stuck
(`status: "PLAYED"`). Then logged in as the seeded coach and confirmed `DELETE` on that now-played
match is correctly rejected with `400` ("Cannot delete a played match — correct the result
instead."). This is Phase 2's actual testable deliverable (tournament → match → manual result),
confirmed working end-to-end.

### Phase 2 — frontend (`apps/web`)

New routes (behind `RequireAuth`, linked from `NavBar`): `/tournaments` (list + create, visible to
any `CLUB_ADMIN`), `/tournaments/:tournamentId` (detail: matches list, schedule-a-match form with
cascading home/away club→team pickers, and roster-builder deep links per participating team),
`/matches/:matchId` (result entry/edit, gated client-side by `CLUB_ADMIN`/`COACH` of either team's
club — same "UI conditionality mirrors backend RBAC, backend stays the real authority" pattern as
Phase 1). New feature folders: `features/tournaments/pages/{TournamentsListPage,
TournamentDetailPage}.tsx`, `features/matches/{api.ts,pages/MatchDetailPage.tsx}`.

Vitest+RTL tests added: `TournamentDetailPage.test.tsx` (select home/away club+team, submit,
confirm the match appears and both teams' roster-links resolve) and `MatchDetailPage.test.tsx`
(submit a result, confirm the status flips to PLAYED and the score renders). Both needed
`authStorage.setTokens(...)` set before rendering plus a mocked `/users/me` — unlike Phase 1's
`TeamDetailPage`, these pages call `useCurrentUser()` for RBAC gating, and that query is
`enabled: Boolean(accessToken)`, so without a token in `localStorage` the gated forms never render
and the tests would silently test nothing. Also caught a stale-`defaultValues` bug of its own kind
while building `MatchDetailPage`: `useForm`'s `defaultValues` are captured once at mount, but
`match` loads asynchronously and is still `undefined` on the first render — without a
`useEffect(() => reset(...), [match])` (same fix `PlayerDetailPage` already used in Phase 1), the
result-edit form would always show blank zeros instead of an already-recorded result's real
values. Caught by re-reading the Phase 1 pattern before writing this page, not by a failing test —
worth flagging as a recurring shape (any form editing async-loaded data needs this). `apps/web`
test count: **12/12 passing** (6 test files).

**Not verified**: an actual browser click-through — the Chrome browser extension was still not
connected in this session either (`tabs_context_mcp` returned the same "Browser extension is not
connected" as Phase 1), so this remains open across two phases now. Both `pnpm --filter api dev`
and `pnpm --filter web dev` are running (started in a prior session), so a manual click-through is
just a browser tab away whenever the extension is connected — worth doing before Phase 3 adds a
much harder-to-component-test video/tagging UI.

**Not built (explicitly out of scope for Phase 2, per the plan file)**: anything video/tagging/
stats/clips-related; a global cross-club "browse all teams" endpoint (see judgment-calls note
above — the match-scheduling team pickers are club-membership-scoped as a result).

### Phase 1 — backend (`apps/api`)

New modules, all wired into `app.module.ts`: `ClubsModule` (CRUD + club-scoped invite endpoints),
`TeamsModule`, `PlayersModule` (the scouting database — reads are open/cross-club on purpose),
`RostersModule`, a read-only `TournamentsModule` placeholder stub, and `MailModule` (nodemailer →
Mailhog, `src/modules/mail/`). New shared DTOs in `packages/shared/src/dto/{club,team,player,
roster,invite}.dto.ts`.

**RBAC decisions** (server-enforced, not just UI): Club/Team writes need `CLUB_ADMIN` in that
club (superadmin bypasses everywhere, as before). Player writes need `CLUB_ADMIN` or `COACH` of
the player's `homeClubId`; **player reads are deliberately open to any authenticated user** —
cross-club scouting is the point, so `GET /players` isn't club-scoped, unlike every other list
endpoint so far. Roster create/add/remove need `CLUB_ADMIN`/`COACH` of the team's club.

**Judgment calls** (not fully specified up front, decided and documented here rather than asked):
- `POST /teams/:teamId/rosters` is **idempotent** — if a roster already exists for that
  `teamId`+`tournamentId` pair it returns the existing one instead of erroring, since "build a
  roster" needs to be safe to call repeatedly from the UI (e.g. re-navigating to the same
  tournament picker shouldn't ever 409).
- `Player.homeClubId` is **required on create** and **not reassignable via update** in Phase 1 —
  moving a player between clubs is out of scope for now; the schema supports it later without a
  migration.
- Invite tokens are **never returned by the API** — the dev flow is to read the email from
  Mailhog's UI at `http://localhost:8025`. Verified this actually works (see below), not just
  assumed from code.
- Age-range player search (`minAge`/`maxAge`) translates to a `dateOfBirth` range filter; a
  player with a `null` `dateOfBirth` is correctly excluded by any age filter (can't evaluate an
  unknown age) — confirmed by both a curl check and a unit test.
- `apps/api` had `jest`/`ts-jest`/`@nestjs/testing` installed since Phase 0 scaffolding but **no
  jest config and no test files at all** — a pre-existing gap in the same category as the
  already-noted missing eslint wiring. Added a standard NestJS jest config block to
  `apps/api/package.json` (`rootDir: src`, `testRegex: *.spec.ts$`) so `pnpm --filter api test`
  actually runs something. Added unit tests for the two most business-rule-sensitive bits from
  this phase: `PlayersService.search`'s age→dateOfBirth filter translation, and
  `RostersService.createOrGet`'s idempotency/RBAC. **8/8 passing.** E2E Jest config
  (`test/jest-e2e.json`, referenced by `package.json`'s `test:e2e` script) still doesn't exist —
  not created this session either, flagging for whenever Phase 2+ wants Supertest-level API tests.

**Verified against the live stack (not just build-verified)** — booted the compiled API, then via
curl: logged in as seeded superadmin → `POST /clubs/seed-club-1/invites` (`newcoach@3x3app.local`,
COACH) → confirmed the email actually landed in Mailhog (`GET localhost:8025/api/v2/messages`,
checked subject+body+recipient) → cross-checked the emailed token against the DB row (matched) →
`POST /auth/invite/accept` as that token → got a real token pair → as the new coach, `POST
/teams/seed-team-1/rosters` (idempotent create) → added two seeded players with jersey numbers →
`GET` the roster back and confirmed both players present with correct jersey numbers. This is
Phase 1's actual testable deliverable, confirmed working end-to-end, not assumed from code review.

### Phase 1 — frontend (`apps/web`)

New feature folders mirroring the existing `features/auth` layout: `features/{clubs,teams,
players,rosters,tournaments}/api.ts` (TanStack Query hooks) `+ pages/`. New routes (all behind
`RequireAuth` except `/register`, added to `app/router.tsx`): `/register?token=` (invite accept),
`/clubs`, `/clubs/:clubId`, `/clubs/:clubId/teams/:teamId`, `/players`, `/players/:playerId`. A
new `components/NavBar.tsx` replaces the bare `LanguageSwitcher` on `HomePage` so `/clubs` and
`/players` are actually reachable from the UI (previously nothing linked to them since they
didn't exist). UI conditionality (which forms/buttons render) mirrors the backend's real RBAC
client-side — the backend stays the actual authority, same pattern as before.

Vitest+RTL tests added: `RegisterPage.test.tsx` (missing-token state, and that the URL's
`?token=` plus form fields get submitted correctly to `/auth/invite/accept`) and
`TeamDetailPage.test.tsx` (the full create-roster → add-player → remove-player interaction
against a stateful mocked `fetch`). **10/10 passing** (4 test files). One real bug caught by
writing these: constructing a mock `Response(jsonBody, { status: 204 })` throws under
undici/jsdom's fetch (a 204 response must have a null body per the Fetch spec) — silently broke
the remove-player mutation in the test until fixed to `new Response(null, { status: 204 })`; the
*real* backend already returns a true empty-body 204 via Nest's `@HttpCode(204)`, so this was a
test-mock-only bug, not a product bug, but worth knowing if anyone else mocks a 204 fetch response
in this repo later.

`pnpm --filter @3x3/shared build`, `pnpm --filter api build`, `pnpm --filter web build` all pass
clean. `pnpm --filter api test` (new) and the frontend Vitest suite both green.

**Not verified**: an actual browser click-through of the frontend screens — the Chrome browser
extension wasn't connected in this session's environment (`tabs_context_mcp` returned "Browser
extension is not connected"), so the frontend was verified via component-level Vitest+RTL
rendering of the real pages against a mocked API, not a real running browser against the real
running dev servers. The backend side of the same flow *was* verified against the real live
stack (see above). Worth an actual manual click-through next session if the Chrome extension is
available, to catch anything a component test wouldn't (routing glue, real network timing, CSS/
layout issues — though this app has no real styling yet).

**Not built (explicitly out of scope for Phase 1, per the plan file)**: Tournament CRUD beyond
the read-only picker stub, Match CRUD, anything video/tagging/stats/clips-related.

---

## Where we are right now (Phase 0)

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

1. **Phase 0 — Scaffolding & auth** *(done)*: monorepo, Docker Compose, full Prisma schema +
   migration + seed, NestJS/React skeletons, JWT auth + invite-only registration, i18n wiring.
   *Testable: log in as seeded superadmin.*
2. **Phase 1 — Club/Team/Player/Roster CRUD** *(done)*: full CRUD + list/detail screens, club user
   invite flow, basic scouting filters (club/city/age). *Testable: club admin invites a coach,
   coach builds a roster.*
3. **Phase 2 — Tournament/Match CRUD** *(done)*: manual match result entry independent of video,
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

Phases 0-3 are all done (see "Where we are right now" at the top of this file). Remaining:

1. Move to Phase 4 (Stat computation + dashboards): introduce Redis/BullMQ (Redis is already
   running in `infra/docker-compose.yml`, unused so far), a `stat-recompute` queue triggered on
   `Match.lockedAt` being set (Phase 3 built the trigger point but nothing consumes it yet),
   `StatsModule`/`DashboardsModule` computing `StatSnapshot` rows at MATCH→TOURNAMENT→CAREER scope
   per the plan file's aggregation design, team/player/match dashboards reading only from
   `StatSnapshot` (never live-aggregating `ActionTag`), and stat-threshold scouting search.
   *Testable: locking a match populates dashboards; scouting search by PPG works.* Verify a
   dashboard's numbers by hand against a small fixture match's tags before trusting the
   aggregation pipeline on real data, per the plan file's verification guidance.
2. Phase 3's `ClipJob`/`Compilation` models exist in the schema but nothing populates them yet —
   that's Phase 5, after stats.
