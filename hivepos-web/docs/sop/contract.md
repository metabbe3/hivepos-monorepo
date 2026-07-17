# Contract pipeline (frontend ↔ hivepos-api)

The OpenAPI spec is the **single source of truth** for every endpoint. Both repos build to it.

## Flow

```
contracts/openapi.yaml   ← you edit this (the ONLY hand-written contract file)
        │
   npm run gen:contract   (scripts/gen-contract.ts)
        ├─► lib/api/types.ts        openapi-typescript → typed paths/schemas (committed)
        └─► docs/contracts/*.md     per-domain tables (committed, agent build instructions)
```

## Adding / changing an endpoint

1. Edit `contracts/openapi.yaml` (add path + schemas, wrap data in the success envelope).
2. `npm run gen:contract` → regenerates `lib/api/types.ts` + `docs/contracts/*.md`.
3. Commit the YAML **and** regenerated files together (keeps lockstep).
4. Call it: `apiFetch<components["schemas"]["Foo"]>("/foo")`.

## Drift guard

`npm run gen:contract:check` regenerates and fails if the generated files differ from what's
committed. CI runs this on every PR — you cannot merge a contract change without regenerating.

## Where the spec lives (for now)

`// ponytail: openapi.yaml owned in web repo — relocate to hivepos-api once it can emit OpenAPI.`

Until hivepos-api can emit the spec itself (swag / oapi-codegen), the web repo authors it
spec-first. When both need the same field, change the YAML → regen → rebuild the Go DTOs to match.
