# webscrapingboib

A Node.js/TypeScript project for scraping, processing, and emailing information from BOIB PDFs.

## Features

- Scrapes and processes BOIB PDF files stored in `BOIBpdfs/`
- Searches for specific keywords in PDFs (configurable via `.env`)
- Associates results with customers (configurable via `.env`)
- Sends email notifications using Zoho SMTP
- Logs output and results

## Project Structure

- `main.ts` — Main entry point for scraping and processing
- `modules/` — Shared/global logic
- `services/` — Business logic (PDF, email, customer, BOIB)
- `types/` — TypeScript type definitions
- `BOIBpdfs/` — Folder containing BOIB PDF files (organized by date)
- `.env` — Environment configuration (not tracked by git)
- `.env.template` — Example environment config (tracked by git)

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

## Environment Variables

See `.env.template` for all required variables:

- `ZOHO_USER`, `ZOHO_PASSWORD` — Zoho SMTP credentials
- `RECIPIENT1`, `RECIPIENT2`, `RECIPIENT3` — Email recipients
- `WORDTOSEARCH_1` ... `WORDTOSEARCH_9` — Keywords to search in PDFs
- `CUSTOMER_1` ... `CUSTOMER_7` — Customer names

## Output

- Results and logs are written to `output.log` and `lastBoibInfo.json`
- Processed PDFs are stored in `BOIBpdfs/`

## Development

- TypeScript configuration: `tsconfig.json`
- Logging: All logs go to `output.log`
- Add new keywords/customers by editing `.env`

## Notes

- `.env` is ignored by git; `.env.template` is tracked for reference
- Email sending uses Zoho SMTP (see `modules/global.ts`)
- For troubleshooting, check `output.log`

## License

MIT
