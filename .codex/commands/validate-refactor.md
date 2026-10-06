# Validate Refactor

Run from target once a runtime exists:

```bash
npm install
npm run lint
npm test -- --reporter=dot
npm run build
npm run test:e2e
```

Also verify:

- auth redirect and session refresh;
- project membership and RLS boundaries;
- activity create/update/delete/event confirmation;
- plan child writes and embedding fallback;
- project and Home chat scope;
- mock/degraded AI and Maps paths;
- canonical and legacy-compatible routes;
- no secrets in tracked files or `.codex`;
- target status and file inventory.

Report every failure as baseline, migration regression, or environment blocker.
