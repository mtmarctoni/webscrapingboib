# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it via email to the repository owner. Do not open a public issue for security-related bugs.

## Threat Model

This application is a web scraper that:

1. Fetches public bulletin data from `https://www.caib.es`
2. Downloads PDF documents
3. Searches for customer names in HTML content
4. Emails results via SMTP

### Assets

- SMTP credentials (`ZOHO_USER`, `ZOHO_PASSWORD`)
- Customer names (business-sensitive)
- Search keywords (business-sensitive)
- Downloaded PDFs (public government documents)

### Trust Boundaries

- **Untrusted**: The BOIB website (`caib.es`) and any scraped content
- **Semi-trusted**: The environment where this runs (assumed hardened)
- **Trusted**: Local filesystem, email transport to configured recipients

### Mitigations in Place

- All HTTP requests are restricted to `caib.es` domain via `isAllowedUrl()` whitelist
- Request timeouts (15s) and size limits (10MB) on all network calls
- Path traversal sanitization on all file system writes
- Email subject/body CRLF sanitization to prevent header injection
- `rejectUnauthorized: true` on HTTPS agent
- `strict: true` TypeScript for compile-time safety
- Pre-commit hooks block `.env` files
- CI runs secret scanning (TruffleHog), dependency audit, and CodeQL

### Known Limitations

- No PDF integrity verification (magic bytes check)
- No rate limiting between requests
- No runtime schema validation for `lastBoibInfo.json`
- Parser relies on specific DOM structure of BOIB website

## Security Best Practices for Operators

1. **Never commit `.env` files** -- the pre-commit hook and CI will block them
2. **Use a dedicated email account** for SMTP (do not reuse personal accounts)
3. **Enable 2FA** on the Zoho account used for sending
4. **Review Dependabot PRs** weekly for security updates
5. **Monitor CI security workflow failures** -- they indicate potential issues
6. **Run with least privilege** -- the process does not need root/admin access
7. **Rotate SMTP passwords** every 90 days

## Security Audit Checklist

Run this checklist before every deployment:

- [ ] `pnpm audit` passes with zero vulnerabilities
- [ ] `tsc --noEmit` passes with no errors
- [ ] `.env` is not present in the working tree (`git status` is clean)
- [ ] `ZOHO_PASSWORD` is not empty and is a strong password
- [ ] `SEND_EMAIL` is set to `"true"` only in production
- [ ] `BOIBpdfs/` directory has appropriate permissions (not world-writable)
