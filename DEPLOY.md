# Production Container

Package runs Togo Todo as one Next.js container. Supabase stays external and
provides auth, database, storage, and API access.

## Requirements

- Docker Engine with Compose v2
- Supabase project with migrations applied
- Supabase URL, publishable key, and secret key

## Configure

```bash
cp .env.production.example .env.production
```

Fill `.env.production`. Keep this file private. `APP_ENCRYPTION_SECRET` must be
long and random. Generate one with:

```bash
openssl rand -hex 32
```

`NEXT_PUBLIC_*` values are compiled into browser assets. Rebuild after changing
them.

## Apply migrations

Apply every file in `supabase/migrations` to target Supabase before starting the
app. Supabase CLI can do this from repository root:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Or apply migration files through Supabase dashboard SQL editor.

## Seed demo data

This step creates the test account and travel fixture. It is idempotent and is
isolated behind the `demo` Compose profile.

```bash
docker compose --env-file .env.production --profile demo build seed
docker compose --env-file .env.production --profile demo run --rm seed
```

Login after startup with:

- Email: `demo@local.test`
- Password: `123456`

Do not run demo seeding against a real production account or production data.

## Run app

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

Open `http://localhost:3000` or configured host and port.

Useful commands:

```bash
docker compose --env-file .env.production logs -f app
docker compose --env-file .env.production restart app
docker compose --env-file .env.production down
```

Do not commit `.env.production`, Supabase secret keys, or AI provider keys.
