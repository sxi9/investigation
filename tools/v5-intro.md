# Walkthrough 5: security and operations

This round hardens accounts and makes the server something you can run for years: a second factor for local accounts, single sign-on through any OIDC provider, files that inherit their case's TLP, legal holds that no delete or purge can cross, retention that cleans the wastebasket on its own, consistent backups, a personal-data export for access and erasure requests, and a one-command deployment behind TLS. Screenshots come from `tools/capture/v5.cjs` against a fresh server started with an OIDC provider configured; the checks are listed at the end.

| Feature | Where | What it does |
| --- | --- | --- |
| Two-factor authentication | Account → Security (every user) | TOTP (RFC 6238, SHA-1, 6 digits, 30 s): QR code and secret, confirm with a code, then every password sign-in asks for a code. Single-use five-minute challenges; five wrong codes void the challenge. Turn off with your password; admins remove a lost factor from Operations. |
| Single sign-on | login page, when `OIDC_ISSUER` + `OIDC_CLIENT_ID` are set | Authorization code with PKCE and nonce; discovery from the issuer; RS256 id_token verified against the provider's JWKS (issuer, audience, expiry, nonce). First sign-in creates the account with `OIDC_DEFAULT_ROLE`; `OIDC_ADMINS` become admins; `OIDC_ALLOWED_DOMAINS` limits entry. SSO accounts have no password. |
| Per-file access | automatic | Uploads carry the case id; the server refuses uploads into cases you cannot edit and serves a file only to people who may see its case (TLP:RED grant, case scope, public flag). |
| Legal hold | Account → Operations (admin) | Stamped on the folder; delete refused on desk and board; the server ignores delete requests; retention skips it; set and release are logged on the case and audited. Only admins can change it, including through the sync API. |
| Retention | automatic + Operations | Wastebasket cases are hard-deleted after `CIB_RETENTION_DAYS` (30) every six hours; "Run now" with a chosen window. |
| Backups | Operations, `npm run backup`, `CIB_BACKUP_HOURS` | `VACUUM INTO` snapshot under `data/backups`, pruned to `CIB_BACKUPS_KEEP` (14). Files live content-addressed under `data/files` and can be rsynced. |
| Personal data | Operations | Person cards, comments, tasks and log lines naming a person across every case; download as JSON; each lookup audited. |
| Deployment | `Dockerfile`, `docker-compose.yml`, `deploy/Caddyfile`, `.env.example` | Multi-stage image (pages built, server runs as a non-root user with a health check); Caddy terminates TLS with automatic certificates for `CIB_DOMAIN`; secure cookies and proxy trust switched on. |

## How to turn it on

1. **Second factor**: sign in, open **Account** (bottom right) → **Security** → *Set up two-factor authentication*. Scan, type the six digits, *Confirm and turn on*.
2. **Single sign-on**: register the redirect URI `https://<host>/api/auth/oidc/callback` with your provider, then set `OIDC_ISSUER`, `OIDC_CLIENT_ID` (and `OIDC_CLIENT_SECRET` for confidential clients) in `.env`. Optional: `OIDC_LABEL`, `OIDC_DEFAULT_ROLE`, `OIDC_ADMINS`, `OIDC_ALLOWED_DOMAINS`.
3. **Deploy**: `cp .env.example .env`, set `CIB_DOMAIN`, `docker compose up -d`. The first visit creates the admin account. (This capture checks the files exist; the image build was not run on the capture machine.)
4. **Operations**: as an admin open **Account → Operations** for backups, retention, legal holds, personal-data lookups and second-factor resets.

