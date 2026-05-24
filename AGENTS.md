# AGENTS.md

## Project

Scrapes BOIB (Balearic Islands Official Bulletin) PDFs, matches keywords + customer names, emails results. Node.js ESM + TypeScript.

## Architecture (Layered)

```
config/  →  domain/  →  infrastructure/  →  application/  →  main.ts
```

- **config/** — env loading + validation (environment.ts), shared constants (constants.ts)
- **domain/** — pure functions, zero I/O (parsers, matchers, models)
- **infrastructure/** — I/O wrappers (HTTP, file system, email, logger)
- **application/** — use case orchestration + error pipeline
- **main.ts** — dependency injection, ~20 lines

**Rule**: Domain must never import infrastructure/ or application/. Application wires them together.

## Key Files

| File | Role |
|---|---|
| `src/main.ts` | Entry point, DI wiring |
| `src/config/environment.ts` | `loadConfig()` — validates env and returns typed `AppConfig` |
| `src/application/useCases/scrapeBoib.ts` | Full workflow orchestration |
| `src/application/pipeline.ts` | Error handling wrapper around the use case |
| `src/domain/parsers/boibParser.ts` | HTML → structured data (3 pure parsers) |
| `src/domain/matchers/keywordMatcher.ts` | Filter docs by keywords |
| `src/domain/matchers/customerMatcher.ts` | Find customer names in HTML tables |

## Testing

- **Vitest** — test files in `tests/` mirroring `src/` structure
- Run: `pnpm test`, watch: `pnpm test:watch`, coverage: `pnpm coverage`
- Domain layer must be fully tested. Infrastructure tests are optional (use nock/memfs).

## Linting & Formatting

**Biome** v2.4.15 — single tool for lint + format + import organization.
- Config: `biome.json` (2-space, double quotes, trailing commas, 100-char width)
- `pnpm lint` / `pnpm lint:fix` / `pnpm format` / `pnpm format:check`

## CI Pipeline

Runs on every push/PR: typecheck → **lint** → audit → build → test → file-guard.
Security scan: TruffleHog + CodeQL (push/PR/weekly).

## Pre-commit Hook

Runs on staged .ts files: `tsc --noEmit` then `biome check --staged`.
Bypass with `git commit --no-verify`.

## Environment

Enforced by code at startup via `loadConfig()`. Required: `ZOHO_USER`, `ZOHO_PASSWORD`, `WORDTOSEARCH_1`.
Optional: `WORDTOSEARCH_2..9`, `CUSTOMER_1..7`, `RECIPIENT1..3`, `SEND_EMAIL`.
Template: `.env.template`.

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, merge target |
| `develop` | Active development |
| `feat/*` | Feature branches off main → PR to main |

## Constraints

- pnpm only (never npm)
- `moduleResolution: "NodeNext"` — all relative imports need `.js` extension
- `pnpm-workspace.yaml` — only `onlyBuiltDependencies: [esbuild]`; do not change unless a new dep needs build approval
- The `dist/`, `coverage/`, and `BOIBpdfs/` directories are gitignored; never commit them
