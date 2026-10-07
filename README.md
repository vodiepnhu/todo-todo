# Togo Todo

Shared Planner workspace for local development.

## Requirements

- Node.js 20+
- npm
- Local Supabase services for auth and database features

## Local Setup

Run steps from repository root.

### 1. Install dependencies

~~~bash
npm install
~~~

### 2. Create local environment files

Run once on a fresh checkout. Do not overwrite existing `.env.local` files.

~~~bash
test -f tgtd-Frontend/.env.local || cp tgtd-Frontend/.env.example tgtd-Frontend/.env.local
test -f tgtd-Backend/.env.local || cp tgtd-Backend/.env.example tgtd-Backend/.env.local
~~~

### 3. Start Supabase

~~~bash
npx supabase start
npx supabase status
~~~

Keep these values from `npx supabase status`:

- `Project URL` under `APIs`
- `Publishable` under `Authentication Keys`
- `Secret` under `Authentication Keys`

Do not use `Storage -> Secret Key` as the auth secret.

### 4. Fill environment values

Set frontend values in `tgtd-Frontend/.env.local`:

~~~env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=<Authentication Keys -> Secret>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Authentication Keys -> Publishable>
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
NEXT_PUBLIC_ENABLE_LOCAL_DEMO_ACCOUNT=true
APP_ENCRYPTION_SECRET=<long random local secret>
~~~

Set backend values in `tgtd-Backend/.env.local`:

~~~env
SUPABASE_INTERNAL_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=<Authentication Keys -> Secret>
ENABLE_LOCAL_DEMO_ACCOUNT=true
~~~

Generate a local encryption secret when needed:

~~~bash
openssl rand -hex 32
~~~

Copy its output into `APP_ENCRYPTION_SECRET`. `SUPABASE_SECRET_KEY` is needed
by Next server routes that call the backend package; keep it server-only and
never rename it to `NEXT_PUBLIC_SUPABASE_SECRET_KEY`. Never commit `.env.local`.

Optional integrations stay degraded when keys are empty:

- `OPENROUTER_API_KEY`: planner LLM calls
- `GOOGLE_MAPS_SERVER_API_KEY`: server-side place lookup
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`: browser Maps features
- `EMBEDDING_API_KEY`: remote embeddings
- `LANGSMITH_API_KEY`: agent tracing

For Google sign-up/sign-in, enable Google in Supabase Auth Providers and add
`http://localhost:3000/auth/callback` and `http://localhost:3000/reset-password`
to the Supabase redirect allow list. Add
the Supabase Auth callback URL shown by the provider configuration to Google
Cloud OAuth authorized redirect URIs. Do not put Google client secrets in
`NEXT_PUBLIC_*` variables.

### 5. Apply database migrations

~~~bash
npx supabase migration up --local
~~~

Run this before seeding. If it stops partway, rerun after fixing the reported
migration. Completed migrations are skipped.

### 6. Seed the local demo account

~~~bash
npm run seed:demo
~~~

Expected output:

~~~text
Demo account ready: demo@local.test / 123456
~~~

This creates a real Supabase auth account. Production demo seeding remains
blocked. No auth bypass exists.

To copy draft plans from legacy local account `demo1` into new `demo` account:

~~~bash
npm run copy:demo-drafts
~~~

This copies only `PLANNING` items from source-owned workspaces, including linked
places and plan details. Existing source data stays unchanged. The operation is
safe to rerun; pending actions, chat history, and completed plans are excluded.

### 7. Load travel test data

Travel seed source lives in `tgtd-Backend/fixtures/travel-test-seed.json`. It
contains six projects (`Sydney`, `Bowral`, `Taipei`, `TaiChung`, `Bangkok`, and
`Personal`), 15 activities per project, famous landmarks, varied dates and
times, all 14 categories, places, travel details, activities, food, preparation,
todo, cost, and note fields.

Run migrations first, then load the fixture:

~~~bash
npx supabase migration up --local
npm run seed:demo
npm run seed:demo-data
~~~

The normal command is idempotent: deterministic IDs upsert the fixture and
preserve unrelated local data. Expected seed counts are 6 projects, 90 items,
90 places, 90 item-place links, and at least 90 rows in each plan checklist
table.

To remove old demo projects before loading exactly this fixture:

~~~bash
npm run seed:demo-data -- --replace
~~~

`--replace` deletes only `PERSONAL` workspaces owned by
`demo@local.test`, including their items and plan data through database cascade.
Do not use it when that account contains local data you want to keep. It never
runs automatically.

### 8. Start the app

~~~bash
npm run dev
~~~

Open http://localhost:3000. Restart after changing `.env.local`.

Login:

- Alias: `demo`
- Password: `123456`

## Checks

~~~bash
npm run lint
npm run typecheck
npm test
npm --workspace tgtd-Backend test
npm run build:webpack
~~~

The root project coordinates active workspaces:

- tgtd-Frontend: Next.js application
- tgtd-Backend: server-only backend package and demo seed

Do not import backend internals through source paths. Use public package
exports when backend consumers are added.
