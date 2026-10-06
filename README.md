# Togo Todo

Shared Planner workspace for local development.

## Requirements

- Node.js 20+
- npm
- Local Supabase services for auth and database features

## Install

From repository root:

~~~bash
npm install
~~~

Copy environment templates:

~~~bash
cp tgtd-Frontend/.env.example tgtd-Frontend/.env.local
cp tgtd-Backend/.env.example tgtd-Backend/.env.local
~~~

Set public Supabase URL/anon key in `tgtd-Frontend/.env.local`. Set the local
Supabase URL and server-only auth secret in `tgtd-Backend/.env.local`:

~~~env
SUPABASE_INTERNAL_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=<Authentication Keys > Secret>
~~~

Get this value from `npx supabase status` under `Authentication Keys` → `Secret`.
Do not use the Storage `Secret Key`. Keep auth secrets only in backend
environment files.

## Start Supabase

Use existing local Supabase setup:

~~~bash
npx supabase start
npx supabase migration up --local
~~~

Docker remains required by Supabase CLI. Do not commit credentials or local
environment files.

## Run App

~~~bash
npm run dev
~~~

Open http://localhost:3000.

## Local Demo Account

Enable demo seeding in both local environment files:

~~~env
NEXT_PUBLIC_ENABLE_LOCAL_DEMO_ACCOUNT=true
ENABLE_LOCAL_DEMO_ACCOUNT=true
~~~

`ENABLE_LOCAL_DEMO_ACCOUNT=false` causes `npm run seed:demo` to stop before
connecting to Supabase. The flag is local-only; production demo seeding remains
blocked.

Seed the real Supabase auth account:

~~~bash
npm run seed:demo
~~~

Run migrations before seeding. If migration application stops partway, fix the
reported migration and rerun `npx supabase migration up --local`; completed
migrations are tracked and skipped.

Login:

- Alias: demo
- Email: demo@local.test
- Password: 123456

Demo seeding is blocked when `NODE_ENV=production`. No auth bypass exists. Do
not commit `.env.local` files or Supabase credentials.

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
