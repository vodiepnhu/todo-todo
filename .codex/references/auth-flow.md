# Auth Flow

## Runtime path

```text
tgtd-Frontend/src/app/(auth)/login/page.tsx
  -> features/auth/components/login-form.tsx
  -> browser Supabase client
  -> Supabase email/password auth
  -> session cookies
  -> /app
```

`tgtd-Frontend/src/middleware.ts` delegates session refresh to the Supabase middleware adapter. Authenticated users visiting `/login` or `/signup` go to `/app`. The `/app` server page calls `getUser()` and redirects unauthenticated users to `/login`.

## Demo account

- User-facing alias: `demo`
- Internal email: `demo@local.test`
- Password: `123456`
- Alias mapping: development only, enabled by `NEXT_PUBLIC_ENABLE_LOCAL_DEMO_ACCOUNT=true`.
- Seed guard: backend requires `ENABLE_LOCAL_DEMO_ACCOUNT=true` and rejects `NODE_ENV=production`.
- Seed command: `npm run seed:demo`.
- Seed owner: `tgtd-Backend/scripts/seed-demo.mjs`.
- Seed behavior: list by email, create or update one user, confirm email, and upsert `profiles.display_name = demo`.

The seed uses Supabase Admin API and never runs in browser code. Production login has no demo bypass.

## Signup and callback

- Signup uses real Supabase `signUp` with `display_name` user metadata.
- `tgtd-Frontend/src/app/auth/callback/route.ts` exchanges OAuth/email codes and redirects only to local paths.
- Profile/workspace initialization remains owned by the existing Supabase trigger; Phase 2 does not redesign schema.

## Verification boundary

Pure alias, redirect, password-policy, and production-seed-guard tests pass. Live demo creation/login/logout requires local Supabase services and remains unverified when those services are unavailable.
