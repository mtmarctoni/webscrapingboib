# Contributing

## Prerequisites

- **Node.js** >=22.13 (required by pnpm v11)
- **pnpm** >=11.0.0 (installed automatically via Corepack)
- **git** with `core.hooksPath` support

Enable Corepack to use the correct pnpm version:

```bash
corepack enable
corepack install
```

## Local Setup

```bash
# Clone and install
git clone <repo-url>
cd webscrapingboib
pnpm install

# Configure environment
cp .env.template .env
# Edit .env with your Zoho SMTP credentials, recipients, keywords, customers

# Verify setup
pnpm typecheck     # Should pass with zero errors
pnpm build         # Should compile without errors
pnpm test          # Should pass all tests
```

## Development Workflow

### Commands

| Command | Description |
|---|---|
| `pnpm start` | Compile and run the scraper |
| `pnpm dev` | Compile and run with `--watch` (auto-restart on changes) |
| `pnpm typecheck` | TypeScript type-check with no emit |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm test` | Run Vitest suite |
| `pnpm test:watch` | Run tests in watch mode (auto-rerun on changes) |
| `pnpm coverage` | Run tests with coverage report |
| `pnpm audit` | Security audit of dependencies |
| `pnpm try` | Remove state file and run fresh |

### Recommended Workflow for Features

1. Checkout `main`, pull latest, create a feature branch:
   ```bash
   git checkout main
   git pull
   git checkout -b feat/my-feature
   ```
2. Make changes — add domain logic first (pure functions), then infrastructure, then wire in the use case
3. Add tests for all new domain functions
4. Run the full suite:
   ```bash
   pnpm typecheck
   pnpm test
   pnpm build
   ```
5. Commit (pre-commit hooks will run typecheck automatically):
   ```bash
   git add -A
   git commit -m "feat: add my feature"
   ```
6. Push and create a PR:
   ```bash
   git push -u origin feat/my-feature
   gh pr create --base main
   ```

## Code Conventions

### Naming

| Pattern | When |
|---|---|
| `PascalCase` | Types, interfaces, classes, enums |
| `camelCase` | Functions, variables, parameters, methods |
| `UPPER_SNAKE_CASE` | Constants (only top-level immutable values) |
| `kebab-case` | File names, directory names |
| `.test.ts` | Test files (mirror source path under `tests/`) |

### File Organization

- One primary export per file (default export for the primary, named exports for types/interfaces)
- Keep files under 200 lines. If a file grows beyond, extract a new module
- Group imports: external → internal (alphabetical within each group)
- Use `.js` extensions for all relative imports (Node ESM requirement)

### Import Order

```typescript
// 1. External dependencies
import axios from "axios";
import * as cheerio from "cheerio";

// 2. Config (if infrastructure or application layer)
import type { AppConfig } from "../config/environment.js";

// 3. Domain types (if application layer)
import type { BoibState } from "../../domain/models/boib.js";

// 4. Domain functions
import { matchKeywords } from "../../domain/matchers/keywordMatcher.js";

// 5. Infrastructure (if application layer)
import type { HttpClient } from "../../infrastructure/http/client.js";
```

### Layer Import Rules

- **Domain code** must never import from `infrastructure/`, `application/`, or `main.ts`
- **Domain code** can import from `config/` (constants only, not environment.ts)
- **Infrastructure code** can import from `config/`
- **Application code** can import from all layers
- **No circular imports** — if A imports B, B must not import A (directly or transitively)

### Error Handling

- Domain parsers throw `Error` for malformed input. Callers catch and handle.
- Infrastructure wrappers wrap external errors in `HttpError` (built-in project error types as needed)
- The pipeline catches fatal errors and returns a `PipelineResult`, never crashes the thread
- `process.exit()` is called only in `main.ts`, never in any layer below

## Testing

### What to Test

- **All domain parsers**: Each parser function needs at least 2 tests (happy path + error/edge case)
- **All domain matchers**: Happy path, empty input, no matches, multiple matches, case-insensitivity
- **Infrastructure**: Tests are optional for this layer (add when behavior is critical or complex)
- **Application**: Not unit tested — covered by integration testing (manual or E2E)

### Test Conventions

- Tests live in `tests/` mirroring the `src/` structure
- Use `vitest` globals (`describe`, `it`, `expect`) — imported explicitly
- Test HTML strings should use the actual DOM structure of `caib.es` as closely as possible
- Avoid real HTTP calls in tests — test pure functions only
- Keep tests fast (target <1s for the full suite)

### Test Example

```typescript
import { describe, it, expect } from "vitest";
import { matchKeywords } from "../../../src/domain/matchers/keywordMatcher.js";

describe("matchKeywords", () => {
  it("returns matched documents", () => {
    const result = matchKeywords(docs, ["alpha"]);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no matches", () => {
    const result = matchKeywords(docs, ["nonexistent"]);
    expect(result).toEqual([]);
  });
});
```

## Pre-commit Hooks

The project uses git's native `core.hooksPath` (set by `postinstall` script). The hook at `.github/hooks/pre-commit` runs:

1. Block `.env` and secret files from being committed
2. Run `npx tsc --noEmit` on staged `.ts` files

To bypass for urgent fixes (e.g., fixing a broken hook):

```bash
git commit --no-verify
```

## CI / CD

The `.github/workflows/ci.yml` pipeline runs on every push and PR:

| Job | What it does | Timeout |
|---|---|---|
| `typecheck` | `tsc --noEmit` | 5 min |
| `audit` | `pnpm audit` | 5 min |
| `build` | `tsc` + verify `dist/src/main.js` | 5 min |
| `test` | `vitest run` | 5 min |
| `file-guard` | Check for committed secrets | 2 min |

The `.github/workflows/security.yml` pipeline runs TruffleHog and CodeQL:

| Job | Schedule | What it does |
|---|---|---|
| `trufflehog` | push, PR, weekly | Secret scanning with diff base |
| `codeql` | push, PR, weekly | Static analysis + code scanning alerts |

## First-Time Contributors

1. Look at `ARCHITECTURE.md` to understand the data flow
2. Start with a domain test — it's the easiest way to learn the codebase
3. Add a new `WORDTOSEARCH_N` keyword to an existing feature to understand the flow
4. Check `tests/` for examples of how tests are structured

## Environment Configuration

See `.env.template` for all available variables:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ZOHO_USER` | Yes | — | SMTP login email |
| `ZOHO_PASSWORD` | Yes | — | SMTP password |
| `WORDTOSEARCH_1` | Yes | — | First search keyword |
| `WORDTOSEARCH_2..9` | No | — | Additional keywords |
| `CUSTOMER_1..7` | No | — | Customer names to match |
| `RECIPIENT1..3` | No | — | Email recipients |
| `SEND_EMAIL` | No | `true` | Set to `false` to disable email |
