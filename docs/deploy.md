# Deploy

Two images behind a **Caddy** edge: single origin, cookies just work, easy rollback.

```
Internet → Caddy :80/:443 ─┬─ /api/* → hivepos-api:8080 (Go)
                           └─ /*     → hivepos-web:3000 (Next standalone)
```

## Local (full stack)

```bash
docker compose up --build
# http://localhost  (Caddy routes /api → Go, / → web)
```

`docker-compose.yml` builds `web` from this repo and `api` from the sibling `../hivepos-api`,
plus `postgres` + `caddy`. Edit compose env (`POSTGRES_*`, `JWT_SECRET`, etc.) for your setup.

## Production

- Build & push both images to a registry (GHCR): see `.github/workflows/ci.yml` (Docker steps;
  push gated on `secrets.GITHUB_TOKEN` + registry config).
- On the host: `docker compose pull && docker compose up -d`.
- Caddy auto-TLS for a real domain (add the domain to `Caddyfile` in prod).

// ponytail: deploy target (VPS host / SSH / watchtower) not pinned — CI builds + tests + docker
// build for now; wire `deploy:` steps to your actual host when known.

## CI

`.github/workflows/ci.yml` runs on every push/PR:
1. `npm ci`
2. `npm run gen:contract:check` (contract drift guard)
3. `npx tsc --noEmit`
4. `npm test`
5. `npm run build`
6. Docker build (push to GHCR on `main`)
