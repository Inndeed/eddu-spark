# Eddu Quiz

Eddu Quiz is a browser-based internal live quiz game inspired by Kahoot and rebuilt for EDDU’s workshop and training context.

This version is designed for:

- full CI-driven visual styling from `CI/20260710-113406.jpeg`
- host login via Supabase Auth
- public player join via live session code
- Supabase-backed persistence
- Railway deployment for the long-running Node + WebSocket service
- Vercel kept as a secondary deployment or ops helper path, not the primary host

## Stack

- React 19 + TypeScript + Vite
- Express + WebSocket
- Supabase Auth + Postgres
- Railway deploy target

## Local development

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Fill in these values:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
APP_BASE_URL=
```

3. Install and run:

```bash
npm install
npm run dev
```

This starts:

- Vite client at `http://localhost:5173`
- API/WebSocket server at `http://localhost:8787`

If Supabase env vars are missing, the UI will show a setup-required state instead of pretending the app is fully live.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run:

```sql
-- use the file below
supabase/schema.sql
```

3. Create at least one host user:

```bash
npm run host:create -- --email host@example.com --password your-password --name "Host Name" --role admin
```

This command:

- creates the auth user if needed
- upserts the matching row into `public.host_users`

4. Start the app. On first server boot with a clean database, the seed quiz sets are inserted automatically.

## Railway deployment

The repo already includes `railway.json` for config-as-code deployment.

Recommended deploy flow:

1. Push this repo to GitHub.
2. Create a new Railway project and deploy from the GitHub repo.
3. Set the service variables from `.env.example`.
4. Generate the public Railway domain.
5. Set `APP_BASE_URL` to that generated Railway URL.
6. Trigger a redeploy after env vars are saved.

### Public App URL

Use the root Railway domain as the user-facing app URL:

- `https://eddu-spark-production.up.railway.app/`

Use this URL when:

- opening the app in a browser
- sharing the main app entry with internal users
- deriving player-facing links such as `/play` and `/play/join/:joinCode`

Do not share `/api/health` as the app link. That endpoint is not a web page.

### Ops / Health URL

This endpoint is for Railway and verification tools only:

- `https://eddu-spark-production.up.railway.app/api/health`

Use it only for:

- Railway health checks
- smoke verification
- debugging deploy status

If someone opens this URL directly, JSON is the expected result.

The production service uses:

- `npm run build` during build
- `npm run start` as the start command
- `/api/health` as the health check path

Current production app URL:

- `https://eddu-spark-production.up.railway.app`

Release verification:

```bash
npm run verify:release
```

This runs the product surface audit, script typecheck, production build, lint, and public smoke check in one pass.

Final production gate after Supabase + host smoke env is available:

```bash
npm run verify:production
```

This runs the full release verification, Supabase schema/storage readiness check, live smoke readiness check, and authenticated host/player smoke flow.

Public smoke check only:

```bash
npm run smoke:public
```

Product surface audit only:

```bash
npm run audit:product
```

This audit guards against old public-facing product concepts returning by accident, such as old product naming, team fields, multi-mode labels, or the removed leaderboard-every-round toggle.
It also guards the Host Live projector layout so the controls stay in the compact left rail instead of regressing into the old top bar.

GitHub verification:

- Pushes and pull requests run `audit:product`, `typecheck:scripts`, `build`, and `lint`.
- The public Railway smoke check can be run manually from GitHub Actions with `run_public_smoke=true`.
- The Supabase schema and Storage readiness check can be run manually with `run_supabase_check=true` after adding `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- The authenticated host/player live smoke check can be run manually with `run_live_smoke=true` after adding `SMOKE_HOST_EMAIL` and `SMOKE_HOST_PASSWORD`; it runs `check:live-smoke` before creating a room.
- Add `expected_commit_sha` in the manual workflow when you want to prove Railway is serving a specific release commit.
- Supabase readiness is intentionally not part of the default CI because it requires production secrets.

Supabase readiness check:

```bash
npm run check:supabase
```

This read-only check requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It verifies the expected tables, `quiz_questions.image_path`, `quiz_questions.image_alt`, and the public `question-images` Storage bucket.

Local verification scripts automatically load `.env` and `.env.local` when those files exist.

To check a different deployment URL:

```bash
npm run smoke:public -- https://your-railway-domain.up.railway.app
```

To prove production is serving a specific commit:

```bash
EXPECTED_COMMIT_SHA=eac06ed npm run smoke:public
```

Authenticated live smoke check:

```bash
npm run check:live-smoke
```

```bash
SMOKE_HOST_EMAIL=host@example.com \
SMOKE_HOST_PASSWORD=... \
npm run smoke:live
```

You can also put those values in `.env` or `.env.local`. `check:live-smoke` and `smoke:live` can auto-discover the public Supabase URL + anon key from deployed frontend assets; if you prefer explicit env, they still accept either `SUPABASE_URL` / `SUPABASE_ANON_KEY` or `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. This launches a real room from the first available quiz set, joins two public players, rejects a duplicate name, opens one question, rejects a duplicate submission, submits both players, verifies WebSocket broadcasts, shows the leaderboard, and finishes the room. Use `SMOKE_QUIZ_SET_ID` when you want to target a specific quiz set. Set `SMOKE_CAPACITY_CHECK=true` to also launch a separate room, join 100 players, and verify that player 101 is rejected. For GitHub Actions, set these secrets: `SMOKE_HOST_EMAIL`, `SMOKE_HOST_PASSWORD`, and optionally `SMOKE_QUIZ_SET_ID`; then enable `run_capacity_check=true` when you want the 100-player check.

The smoke check verifies:

- `/api/health` returns `status: ok`
- the server is running in Supabase-backed mode
- `APP_BASE_URL` matches the public URL
- release metadata is exposed when available, including app `version` and platform `commitSha`
- the deployed `commitSha` matches `EXPECTED_COMMIT_SHA` when that env value is provided
- the landing page references built JS/CSS assets
- the built assets are reachable
- brand, icon, and workshop audio assets are reachable
- public SPA deep links return the app shell, including `/play`, `/play/join/:joinCode`, `/host`, and `/host/live/:joinCode`
- key API routes return JSON instead of falling through to HTML, including public player session/join errors and host auth gating
- the public `/ws` WebSocket endpoint opens, accepts a session subscription message, and returns a protocol error for invalid messages

Important:

- open the root URL when you want to use the app
- use `/api/health` only when you intentionally want machine-readable deploy status

## Vercel note

Vercel is useful here as a secondary helper for previews or future refactors, but the intended v1 production shape remains Railway-first because the app depends on a long-running live session engine plus WebSocket fanout.

## Core product flow

1. Go to `/host`
2. Sign in with a Supabase-backed host account
3. Create or edit a quiz set
4. Launch a live session to get a 6-character join code
5. Share `/play` or the QR deep link with participants
6. Participants enter room code, then name, then join the session
7. Run the game from the live console

## Important files

- `server/index.ts`: Express API + WebSocket server + host auth gate
- `server/session-store.ts`: live-session engine backed by Supabase
- `server/supabase.ts`: server-side Supabase client helpers
- `src/lib/supabase.ts`: browser auth client
- `supabase/schema.sql`: required database schema
- `railway.json`: deployment config

## Notes

- Host APIs require a valid Supabase session plus a matching active row in `public.host_users`.
- Player flow remains account-free and uses `code -> name -> play`.
- The Node server remains the authoritative source for timers, scoring, and session progression.
- The app is designed to run publicly as one Railway service. Full host/player game verification still requires a real host account and a live session, while `npm run smoke:public` covers public health and asset rollout.

## Production checklist

- Railway envs must include `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `APP_BASE_URL`, and `NODE_ENV=production`.
- `APP_BASE_URL` must be the public root URL, for example `https://eddu-spark-production.up.railway.app`, not `/api/health`.
- Supabase must include `quiz_questions.image_path` and `quiz_questions.image_alt` before question image upload is verified in production.
- Create at least one active host user in `public.host_users` using `npm run host:create`.
- The `question-images` Supabase Storage bucket must exist as a public bucket, or the deployed app must be able to create it on boot with the service role.
- Run `npm run check:supabase` from a configured environment before a live workshop.
