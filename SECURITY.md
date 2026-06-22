# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Clawtrl Autonomous, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Use [GitHub Security Advisories](https://github.com/portalfnd/clawtrlautonomous/security/advisories/new) to report privately
3. Include a clear description of the issue, reproduction steps, and potential impact

We will acknowledge receipt within 48 hours and provide a fix timeline within 7 days.

## Security Measures

### Dashboard API
- **Loopback-only access**: The dashboard API rejects non-loopback Host headers by default (prevents DNS rebinding)
- **Same-origin writes**: State-changing requests (POST/PUT/DELETE) require same-origin Origin/Referer headers (prevents CSRF)
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- **No poweredByHeader**: Next.js version fingerprint is suppressed

### Wallet Operations
- **Confirmation PIN**: Destructive operations (transfer, approve) require a confirmation token when `CLAWTRL_WALLET_CONFIRM_PIN` is set
- **Address allowlist**: Optional recipient allowlist at `wallet/address-allowlist.json`
- **Daily spend cap**: USDC transfers are capped by `CLAWTRL_WALLET_DAILY_CAP_USD`

### Webhook Proxy
- **HMAC verification**: All incoming webhooks are verified with `WEBHOOK_HMAC_SECRET`
- **Skill name validation**: Only `[a-z0-9][a-z0-9-]{0,63}` patterns are accepted
- **Body size limit**: 1MB max on webhook payloads

### Secrets Management
- Private keys and API tokens are loaded from environment variables only
- `.env` files are gitignored
- No secrets are logged to console or telemetry files

## Hardening Checklist for Operators

- [ ] Set `CLAWTRL_WALLET_CONFIRM_PIN` to a strong PIN
- [ ] Populate `wallet/address-allowlist.json` with known recipient addresses
- [ ] Set `CLAWTRL_WALLET_DAILY_CAP_USD` to a reasonable daily limit
- [ ] Keep `CLAWTRL_DASHBOARD_ALLOW_ANY_HOST` unset unless behind an authenticating proxy
- [ ] Use a dedicated GitHub PAT with minimal scopes (`repo`, `workflow`)
- [ ] Run the dashboard on a dedicated user account, not shared machines
