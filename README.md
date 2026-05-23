# webscrapingboib

A Node.js/TypeScript project for scraping, processing, and emailing information from BOIB PDFs.

## Features

- Scrapes and processes BOIB PDF files stored in `BOIBpdfs/`
- Searches for specific keywords in PDFs (configurable via `.env`)
- Associates results with customers (configurable via `.env`)
- Sends email notifications using Zoho SMTP
- Logs output and results

## Project Structure

```
src/
  main.ts              — Entry point: loads config, wires dependencies, runs pipeline
  config/
    environment.ts     — .env loader + validation → typed AppConfig
    constants.ts       — ALLOWED_DOMAIN, MONTHS, timeouts, URLs
  domain/
    models/
      boib.ts          — All data models: BoibState, SectionLink, DocListItem, ScrapeResult
    parsers/
      boibParser.ts    — Parse bulletin HTML → structured metadata (pure functions)
    matchers/
      keywordMatcher.ts — Filter docs by keywords (pure)
      customerMatcher.ts — Find customer names in HTML tables (pure)
  infrastructure/
    http/
      client.ts        — Single axios instance with retry, URL whitelist, timeouts
    storage/
      fileSystem.ts    — readJson, writeJson, mkdir, PDF magic byte validation
      paths.ts         — Path sanitization, folder name building
    email/
      transport.ts     — Nodemailer transport factory
      template.ts      — Email body composition + attachment building
    logger.ts          — Console + ora spinner abstraction
  application/
    useCases/
      scrapeBoib.ts    — Full orchestration: fetch → parse → match → download → notify
    pipeline.ts        — Error handling + cleanup wrapper

tests/                 — Vitest test suite (domain layer tests)
BOIBpdfs/              — Downloaded PDFs organized by date
.env                   — Environment configuration (not tracked by git)
.env.template          — Example environment config (tracked by git)
```

## Setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Configure environment**
   - Copy `.env.template` to `.env` and fill in your values (Zoho credentials, recipients, keywords, customers)
3. **Run the project**
   ```bash
   pnpm start
   # or
   bash run-node-project.bat
   ```

## Development

```bash
pnpm typecheck    # TypeScript type check (no emit)
pnpm build        # Compile to dist/
pnpm test         # Run Vitest suite
pnpm test:watch   # Run tests in watch mode
pnpm coverage     # Run tests with coverage report
pnpm audit        # Security audit
```

## Environment Variables

See `.env.template` for all required variables:

- `ZOHO_USER`, `ZOHO_PASSWORD` — Zoho SMTP credentials
- `RECIPIENT1`, `RECIPIENT2`, `RECIPIENT3` — Email recipients
- `WORDTOSEARCH_1` ... `WORDTOSEARCH_9` — Keywords to search in PDFs
- `CUSTOMER_1` ... `CUSTOMER_7` — Customer names
- `SEND_EMAIL` — Set to `false` to disable email sending

## Architecture

The codebase follows a **layered architecture** with clear separation of concerns:

- **Config layer**: Environment loading and validation — returns a typed, immutable config object
- **Domain layer**: Pure business logic — parsing, matching, data models. No external dependencies.
- **Infrastructure layer**: Thin wrappers around external libraries (axios, cheerio, nodemailer, fs). All I/O lives here.
- **Application layer**: Orchestrates the workflow by composing domain and infrastructure functions
- **Entry point**: `main.ts` — wires dependencies and runs the pipeline

This design makes the domain logic fully testable without mocking (all domain functions are pure), and isolates external dependencies behind interfaces.

## Output

- Results and logs are written to `lastBoibInfo.json`
- Processed PDFs are stored in `BOIBpdfs/`

## Notes

- `.env` is ignored by git; `.env.template` is tracked for reference
- Email sending uses Zoho SMTP (see `src/config/constants.ts`)
- For troubleshooting, check console output

## License

MIT
