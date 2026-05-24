# webscrapingboib

A Node.js/TypeScript project for scraping, processing, and emailing information from BOIB PDFs.

📖 **Documentation**
- [Architecture](ARCHITECTURE.md) — Layer design, data flow, ADRs, extension patterns
- [Contributing](CONTRIBUTING.md) — Setup, workflow, conventions, testing
- [Security](SECURITY.md) — Threat model, mitigations, operator checklist

## Quick Start

```bash
pnpm install
cp .env.template .env    # Edit with your credentials
pnpm start
```

## Features

- Scrapes and processes BOIB PDF files stored in `BOIBpdfs/`
- Searches for specific keywords in PDFs (configurable via `.env`)
- Associates results with customers (configurable via `.env`)
- Sends email notifications using Zoho SMTP

## Directory Structure

```
src/
  main.ts                    — Entry point (~20 lines)
  config/
    environment.ts           — .env loader + validation → typed AppConfig
    constants.ts             — URLs, month names, timeouts, sizes
  domain/
    models/boib.ts           — Data models: BoibState, SectionLink, DocListItem
    parsers/boibParser.ts    — HTML → structured data (pure functions)
    matchers/
      keywordMatcher.ts      — Filter docs by keywords (pure)
      customerMatcher.ts     — Find customer names in HTML tables (pure)
  infrastructure/
    http/client.ts           — Axios with retry + URL whitelist
    storage/
      fileSystem.ts          — JSON R/W, PDF magic byte validation
      paths.ts               — Path sanitization, folder naming
    email/
      transport.ts           — Nodemailer transport factory
      template.ts            — Email body composition
    logger.ts                — Console + ora spinner abstraction
  application/
    pipeline.ts              — Error handling wrapper
    useCases/scrapeBoib.ts   — Full workflow orchestration

tests/                       — Vitest test suite
BOIBpdfs/                    — Downloaded PDFs organized by date
```

## Development Commands

| Command | Purpose |
|---|---|
| `pnpm typecheck` | TypeScript type check |
| `pnpm build` | Compile to `dist/` |
| `pnpm test` | Run Vitest suite |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm coverage` | Tests with coverage report |
| `pnpm audit` | Security audit |
| `pnpm start` | Compile and run |
| `pnpm dev` | Compile and watch for changes |

## Environment Variables

See `.env.template` for all available variables.

| Variable | Required | Purpose |
|---|---|---|
| `ZOHO_USER` | Yes | SMTP login email |
| `ZOHO_PASSWORD` | Yes | SMTP password |
| `WORDTOSEARCH_1` | Yes | First search keyword |
| `WORDTOSEARCH_2..9` | No | Additional keywords |
| `CUSTOMER_1..7` | No | Customer names to match in HTML tables |
| `RECIPIENT1..3` | No | Email recipients |
| `SEND_EMAIL` | No | Set to `false` to disable email |

## License

MIT
