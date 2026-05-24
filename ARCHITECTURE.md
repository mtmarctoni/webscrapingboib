# Architecture

This document describes the architectural design, data flow, and design decisions for the BOIB scraper project. It is the source of truth for understanding how the system works and how to extend it.

---

## Layer Overview

```
                +-----------+
                |  main.ts  |  Entry point
                +-----------+
                     |
                     v
                +-----------+
                |  config/  |  Typed configuration (no runtime deps)
                +-----------+
                     |
                     v
    +-------------------------------+
    |       application/            |  Orchestration layer
    |  pipeline.ts                  |  Error handling + lifecycle
    |  useCases/scrapeBoib.ts       |  Full workflow orchestration
    +-------------------------------+
         |          |          |
    v    v    v
+--------+  +--------+  +--------+
| domain |  | infra  |  | infra  |
| /parsers| | /http  |  | /email |
| /matchers| | /storage|  | /logger|
+--------+  +--------+  +--------+
```

### Layer Rules

| Layer | May Import From | Must Not Import From |
|---|---|---|
| `config/` | `constants.ts`, `dotenv` | Any other project layer |
| `domain/` | `config/` (constants only) | `infrastructure/`, `application/` |
| `infrastructure/` | `config/` | `domain/`, `application/` |
| `application/` | `config/`, `domain/`, `infrastructure/` | Nothing below |
| `main.ts` | All layers | Nothing |

The key constraint: **domain code never imports infrastructure code.** This keeps the business logic pure and testable without mocking.

---

## Data Flow

### Full Execution Flow (Normal)

```
main.ts
  |
  |-- loadConfig()                               # Validate .env, build AppConfig
  |-- createHttpClient(config)                    # Axios with retry + timeout
  |-- createFileSystem(config)                    # FS with path validation
  |-- createEmailTransport(config)                # Nodemailer SMTP
  |-- createLogger()                              # Console + ora spinner
  |
  |-- runScrapePipeline(config, deps)             # application/pipeline.ts
       |
       |-- runScrape(config, deps)                # application/useCases/scrapeBoib.ts
            |
            |-- fs.readJson<BoibState>(stateFile) # Load previous state from disk
            |
            |-- http.get(baseUrl)                 # Fetch BOIB homepage
            |-- parseBulletin(html, baseUrl)       # Extract latest bulletin metadata
            |
            |-- Compare meta.link vs previous state
            |   |-- If same → return early (no new bulletin)
            |   |-- If different → continue
            |
            |-- http.get(linkUltimoBoletin)        # Fetch section menu
            |-- parseSectionMenu(html, domainUrl)   # Extract section links
            |
            |-- For each section:
            |   |-- http.get(section.link)          # Fetch doc list
            |   |-- parseDocList(html, sectionId)    # Extract document entries
            |
            |-- matchKeywords(allDocs, wordsToSearch) # Filter by keywords
            |
            |-- If matches found:
            |   |-- For each PDF link:
            |   |   |-- http.getBuffer(link, maxSize)   # Download
            |   |   |-- fs.validatePdf(data)            # Magic byte check
            |   |   |-- fs.writeFile(filePath, data)    # Save to disk
            |   |
            |   |-- For each HTML link:
            |   |   |-- http.get(link)
            |   |   |-- matchCustomers(html, customers)  # Table cell search
            |
            |-- fs.writeJson(stateFile, state)         # Persist updated state
            |
            |-- If sendEmail:
                 |-- composeEmail(result, config)       # Build email body
                 |-- email.send(mailOptions)            # Send via SMTP
```

### Early Exit (No New Bulletin)

```
runScrape()
  |-- fs.readJson(stateFile)
  |-- http.get(baseUrl)
  |-- parseBulletin(html)
  |-- Compare → same link
  |-- Return ScrapeResult { success: true, emailSent: false }
```

### Error Path (Fatal)

```
runScrapePipeline()
  |-- try:
  |   |-- runScrape(config, deps)
  |-- catch:
      |-- logger.error(message)
      |-- logger.error(stack)
      |-- Return PipelineResult { success: false, error }
```

Note: The old architecture had a safety `writeDataBase()` in the error handler before `process.exit()`. This is intentionally removed because the state is now persisted progressively (written at the end of each operation), so a crash in the middle doesn't corrupt data. If this behavior needs to be restored, add a `finally` block in `pipeline.ts`.

---

## Layer Details

### `src/config/` — Configuration

All environment variable loading, validation, and constant definitions.

| File | Responsibility |
|---|---|
| `constants.ts` | Immutable constants: domain URLs, month names, timeouts, size limits, SMTP defaults |
| `environment.ts` | Load `.env`, validate required vars, build typed `AppConfig` |

#### Design Decision: No Global State

The old architecture had `export let lastBoibInfo` in `global.ts` — a mutable global that any file could import and modify. The new architecture passes all configuration as a typed `AppConfig` object created at startup and never mutated.

```typescript
// Before (old code in modules/global.ts):
export let lastBoibInfo: BoibInfo = { ... };
export let previousBoibInfo: BoibInfo = { ... };

// After:
const config = loadConfig();  // Immutable AppConfig, created once
```

---

### `src/domain/` — Pure Business Logic

Contains all business rules and data models. Has **no imports from infrastructure** — no axios, no cheerio, no fs, no nodemailer. This is why domain code is trivially testable.

#### Models (`domain/models/boib.ts`)

```typescript
export interface BoibState {
  ultimoBoletin: string;
  isExtraordinary: boolean;
  idBoib: string;
  idAnualBoib: string;
  dateLastBoib: string;
  linkUltimoBoletin: string;
  customersMatched: string[];
  sectionLinks: SectionLink[];
  numMatches: number;
}

export interface ScrapeResult {
  success: boolean;
  state: BoibState;
  downloadedPdfPaths: string[];
  numMatches: number;
  emailSent: boolean;
}

export function createEmptyBoibState(): BoibState;
```

The `ScrapeResult` type is the return value of the entire application — it flows from the use case through the pipeline and back to `main.ts`.

#### Parsers (`domain/parsers/boibParser.ts`)

Pure functions that take raw HTML strings and return structured data.

```typescript
parseBulletin(html: string, baseUrl: string): BulletinMetadata
parseSectionMenu(html: string, domainUrl: string): { sections: SectionLink[], isExtraordinary: boolean }
parseDocList(html: string, sectionId: number, domainUrl: string, allowedDomain: string): DocListItem[]
```

**Important**: These parsers depend on the specific DOM structure of `caib.es`. If the website changes its HTML, these are the files that need updating.

#### Matchers (`domain/matchers/`)

Pure functions for filtering and searching.

| Function | Input | Output | Pure? |
|---|---|---|---|
| `matchKeywords(docs, words)` | `DocListItem[]`, `string[]` | `DocListItem[]` | Yes |
| `matchCustomers(htmlText, customers, docId)` | `string`, `string[]`, `string` | `CustomerMatch[]` | Yes |

---

### `src/infrastructure/` — External I/O

Thin wrappers around external libraries. Each file exposes a factory function that accepts the config and returns an interface. This makes it easy to:

1. Swap implementations (e.g., `nodemailer` → `SendGrid`)
2. Mock for tests (e.g., `createMockFileSystem()`)
3. Centralize security controls (timeouts, URL whitelist, PDF validation)

| File | Library | Exports | Key Responsibility |
|---|---|---|---|
| `http/client.ts` | axios | `createHttpClient(config): HttpClient` | URL whitelist, retry, timeouts |
| `storage/fileSystem.ts` | fs | `createFileSystem(config): FileSystem` | JSON R/W, PDF magic bytes, mkdir |
| `storage/paths.ts` | path | `sanitizePathSegment()`, `buildDownloadFolderName()`, `resolveSafePath()` | Path traversal prevention |
| `email/transport.ts` | nodemailer | `createEmailTransport(config): EmailTransport` | SMTP setup |
| `email/template.ts` | none | `composeEmail(result, config): EmailContent` | Plain text email body |
| `logger.ts` | ora | `createLogger(): Logger` | Console + spinner |

#### Infrastructure Interfaces

```typescript
export interface HttpClient {
  get(url: string): Promise<AxiosResponse>;
  getBuffer(url: string, maxSize: number): Promise<Buffer>;
}

export interface FileSystem {
  readJson<T>(filePath: string): Promise<T | null>;
  writeJson<T>(filePath: string, data: T): Promise<void>;
  mkdir(dirPath: string): Promise<void>;
  readdir(dirPath: string): Promise<string[]>;
  writeFile(filePath: string, data: Buffer): Promise<void>;
  validatePdf(data: Buffer): boolean;
}

export interface EmailTransport {
  send(options: MailOptions): Promise<void>;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  spinner(text: string): SpinnerHandle;
}
```

---

### `src/application/` — Orchestration

Connects infrastructure to domain logic. Contains the actual workflow logic.

#### `useCases/scrapeBoib.ts`

The main use case. Accepts `AppConfig` and `Dependencies` (the four infrastructure interfaces), returns `ScrapeResult`. This is the only file that knows the full flow: fetch → parse → match → download → notify.

```typescript
export interface Dependencies {
  http: HttpClient;
  fs: FileSystem;
  email: EmailTransport;
  logger: Logger;
}

export async function runScrape(config: AppConfig, deps: Dependencies): Promise<ScrapeResult>
```

#### `pipeline.ts`

Error handling wrapper around `runScrape`. Catches fatal errors, logs them, and returns a structured result. The entry point (`main.ts`) decides whether to `process.exit(1)` based on the result.

```typescript
export async function runScrapePipeline(config: AppConfig, deps: Dependencies): Promise<PipelineResult>
```

---

### `src/main.ts` — Entry Point

The thinnest possible entry point. Responsibilities:

1. Load configuration
2. Create infrastructure instances
3. Run the pipeline
4. Exit with appropriate code

```typescript
async function main(): Promise<void> {
  console.log("----------");
  console.log(new Date(Date.now()));

  let config: AppConfig;
  try {
    config = loadConfig();
  } catch (err: unknown) {
    console.error(`Configuration error: ...`);
    process.exit(1);
  }

  const http = createHttpClient(config);
  const fs = createFileSystem(config);
  const email = createEmailTransport(config);
  const logger = createLogger();

  const result = await runScrapePipeline(config, { http, fs, email, logger });

  console.log("----------");
  process.exit(result.success ? 0 : 1);
}
```

---

## Testing Strategy

### Domain Tests (Unit)

Domain layer tests use Vitest and test pure functions with realistic HTML fixtures. No mocking required — domain functions have no I/O dependencies.

```
tests/domain/
  matchers/
    keywordMatcher.test.ts    # 4 tests — keyword matching logic
    customerMatcher.test.ts   # TODO: HTML table cell scanning
  parsers/
    boibParser.test.ts        # 6 tests — HTML → structured data
```

### Infrastructure Tests (Integration)

Not yet implemented. If added, they should use `nock` for HTTP mocking and `memfs` for filesystem mocking. These tests validate that infrastructure wrappers work correctly (retries, timeouts, path sanitization real behavior).

### Test Convention

- Test files mirror the `src/` structure under `tests/`
- Use `vitest run` locally, `pnpm test` in CI
- Coverage reports exclude infrastructure and main.ts

---

## Extension Patterns

### How to Add a New Parser

1. Create `src/domain/parsers/<name>Parser.ts`
2. Export a pure function: `(html: string, ...params) => ParsedResult`
3. Import cheerio locally (it's a parsing utility, not infrastructure)
4. Add tests in `tests/domain/parsers/<name>Parser.test.ts`
5. Call the parser from `scrapeBoib.ts` or from another parser

### How to Add a New Matcher

1. Create `src/domain/matchers/<name>Matcher.ts`
2. Export a pure function operating on domain types
3. Add tests
4. Use in `scrapeBoib.ts` or compose with existing matchers

### How to Add a New Data Source

1. Add config fields to `AppConfig` in `config/environment.ts`
2. Add constants to `config/constants.ts`
3. Create infrastructure wrappers (e.g., `infrastructure/http/newApi.ts`)
4. Create domain parsers for the response format
5. Add orchestration logic in `scrapeBoib.ts`
6. Add tests for the parsers and matchers

---

## Design Decisions (ADRs)

### ADR-001: Layered Architecture Over Flat Structure

**Date**: 2026-05-23

**Context**: The original codebase was a flat structure with mutable global state in `modules/global.ts` and all logic in `services/`. Every service directly imported and mutated globals, making the data flow invisible and testing impossible.

**Decision**: Adopt a 3-layer architecture (config → domain → infrastructure → application) with explicit dependency injection. Domain code is pure. Infrastructure is abstracted behind interfaces. Application layer orchestrates.

**Consequences**:
- Positive: Testable, maintainable, clear data flow
- Positive: New features can be added without touching unrelated code
- Negative: More files than before (18 vs 7)
- Negative: Slightly more boilerplate for dependency wiring

### ADR-002: Vitest Over Node Test Runner

**Date**: 2026-05-23

**Context**: Needed a test framework for the newly testable domain layer.

**Decision**: Use Vitest over Node's built-in test runner or Jest. Why:
- Vitest is native ESM (matches the project's `"type": "module"`)
- Vitest is faster (esbuild-based transform)
- Vitest has a Jest-compatible API (familiar patterns)
- Vitest has built-in coverage via v8

**Consequences**:
- Positive: Fast tests, ESM-native
- Negative: Requires esbuild build approval for pnpm
- Negative: One more devDependency

### ADR-003: Config Validation at Startup, Not at Use

**Date**: 2026-05-23

**Context**: The old architecture validated env vars at module load time via side effects in `modules/global.ts`.

**Decision**: Move all env loading and validation into `loadConfig()`, called once at startup in `main.ts`. If validation fails, the process exits before any work begins. All downstream code receives a validated, typed `AppConfig` object.

**Consequences**:
- Positive: Fail fast — don't fetch BOIB if email config is wrong
- Positive: Easy to test config validation in isolation
- Negative: Config is read-only at runtime; can't be hot-reloaded

### ADR-004: `.js` Extensions in Imports

**Date**: 2026-05-23

**Context**: Node.js ESM requires explicit file extensions in import paths.

**Decision**: Use `.js` extensions in all TypeScript source imports (e.g., `import { x } from "./config.js"`). Use `moduleResolution: "NodeNext"` in tsconfig so TypeScript resolves `.js` → `.ts` at compile time and the compiled output keeps `.js` for Node runtime.

**Consequences**:
- Positive: Works correctly with Node.js ESM at runtime
- Positive: TypeScript verifies imports at compile time
- Negative: Editors may show squiggly lines if not configured for NodeNext

### ADR-005: PDF Magic Byte Validation

**Date**: 2026-05-23

**Context**: CodeQL flagged untrusted network data being written to disk without validation.

**Decision**: Add PDF magic byte validation (`%PDF` header = bytes `25 50 44 46`) before writing any downloaded content to disk. The check lives in `infrastructure/storage/fileSystem.ts` as `validatePdf()`.

**Consequences**:
- Positive: Prevents writing non-PDF content (HTML error pages, redirects, malware)
- Positive: CodeQL finding resolved
- Negative: Adds ~5% overhead to each write (negligible)

---

## Security Architecture

See `SECURITY.md` for the full threat model and operational checklist. Key architecture-level security properties:

- **URL whitelisting**: All HTTP requests are validated against `config.allowedDomain` before dispatch
- **Path traversal prevention**: User-influenced path segments are sanitized and resolved paths are validated against the intended base directory
- **Content validation**: PDF magic bytes verified before writes
- **CRLF injection prevention**: Email content is sanitized with `sanitizeForEmail()`
- **Compile-time safety**: TypeScript strict mode with `noUncheckedIndexedAccess`
- **Supply chain**: Weekly Dependabot updates, CodeQL SAST, TruffleHog secret scanning

---

## File Responsibility Matrix

| File | Layer | Lines | Reads | Writes |
|---|---|---|---|---|
| `main.ts` | Entry | 42 | — | stdout, exit code |
| `config/constants.ts` | Config | 26 | — | — |
| `config/environment.ts` | Config | 87 | `.env`, stdout | — |
| `domain/models/boib.ts` | Domain | 45 | — | — |
| `domain/parsers/boibParser.ts` | Domain | 115 | cheerio (DOM only) | — |
| `domain/matchers/keywordMatcher.ts` | Domain | 22 | — | — |
| `domain/matchers/customerMatcher.ts` | Domain | 42 | cheerio (DOM only) | — |
| `infrastructure/http/client.ts` | Infra | 67 | network | network |
| `infrastructure/storage/fileSystem.ts` | Infra | 45 | disk | disk |
| `infrastructure/storage/paths.ts` | Infra | 25 | — | — |
| `infrastructure/email/transport.ts` | Infra | 28 | config | SMTP |
| `infrastructure/email/template.ts` | Infra | 53 | — | — |
| `infrastructure/logger.ts` | Infra | 39 | — | stderr/stdout |
| `application/pipeline.ts` | App | 28 | — | — |
| `application/useCases/scrapeBoib.ts` | App | 171 | all infra | all infra |
