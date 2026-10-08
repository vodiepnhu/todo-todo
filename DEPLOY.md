# Production Container

Togo Todo runs in one Next.js container. Supabase stays external and provides
auth, database, storage, and API access.

## 1. Requirements

- Docker Desktop with Compose v2
- Git
- Node.js 20+
- Supabase account

Docker must be running before using `docker compose`.

## 2. Clone package

Run from the directory where you want the package:

```bash
git clone -b version-1.0 https://github.com/vodiepnhu/todo-todo.git
cd todo-todo
```

All commands below run from this repository root. Do not copy the env file from
the parent directory.

## 3. Create Supabase project

Create a project in Supabase Dashboard. Copy these values:

- Project URL: `https://YOUR_PROJECT_REF.supabase.co`
- Project ref: `YOUR_PROJECT_REF`, the part before `.supabase.co`
- Publishable key
- Secret key
- Database password

Log in to Supabase CLI:

```bash
npx supabase login
```

This opens a browser. Finish login before continuing.

This repository may not contain a local Supabase config yet. Create it once:

```bash
npx supabase init
```

Link the local migrations to the hosted project. Replace `YOUR_PROJECT_REF`
with the real ID. Do not type angle brackets:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

When prompted, enter the Supabase database password. This is not the secret
API key.

## 4. Apply database migrations

```bash
npx supabase db push
```

If this says `Cannot find project ref`, run the `supabase link` command above
first from the repository root.

## 5. Configure environment

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set at least:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_INTERNAL_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
APP_ENCRYPTION_SECRET=YOUR_LONG_RANDOM_SECRET
OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY
```

Generate `APP_ENCRYPTION_SECRET` with:

```bash
openssl rand -hex 32
```

Keep `.env.production` private. `NEXT_PUBLIC_*` values are compiled into the
browser bundle, so rebuild after changing them.

## 6. Seed demo account and travel data

This creates six wishlists, 90 activities, places, plan details, and the test
account. Seed is idempotent and isolated behind the `demo` Compose profile.

```bash
docker compose --env-file .env.production --profile demo run --rm seed
```

Demo login:

- Email: `demo@local.test`
- Password: `123456`

Use the complete email above. The `demo` shortcut is intentionally disabled in
the production container, even when the demo seed profile is used.

Do not run demo seeding against real production data.

## 7. Build and start app

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

Open `http://localhost:3000`.

## 8. Logs and stop

```bash
docker compose --env-file .env.production logs -f app
docker compose --env-file .env.production restart app
docker compose --env-file .env.production down
```

## Security

Never commit or send `.env.production`, Supabase secret keys, database
passwords, or AI provider keys. For a real production project, skip demo seed
and use a real account instead.

## Troubleshooting login

If the login page says `Unable to sign in. Check your credentials.`:

1. Use `demo@local.test`, not `demo`.
2. Check that `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the real publishable key,
   not the secret key or the example placeholder.
3. Rebuild after changing any `NEXT_PUBLIC_*` value:

```bash
docker compose --env-file .env.production up -d --build
```

Do not duplicate environment variable names in `.env.production`; the last
duplicate value can override the correct value.
