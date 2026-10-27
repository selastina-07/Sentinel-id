# SentinelID

SentinelID is a Next.js App Router account-security application. It includes server-side registration and sign-in, Argon2id password hashing, database-backed opaque sessions, risk-triggered email OTP, revocable trusted devices, login/audit history, and account-scoped session management.

Security records and dashboard counts come from PostgreSQL. A new account has no activity or trusted devices, and the interface displays an explicit empty state rather than sample security events.

## Requirements

- Node.js 20 or later
- PostgreSQL 14 or later
- An email provider for production OTP delivery (Resend is supported)

## Local setup

1. Install dependencies with `npm install`.
2. Create a PostgreSQL database and copy `.env.example` to `.env` with `Copy-Item .env.example .env`.
3. Set `DATABASE_URL` to the database connection string and create an `AUTH_SECRET` containing at least 32 random characters. For example, generate one with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```

4. For local-only OTP testing, set `EMAIL_PROVIDER="console"` in `.env`. This is accepted only when `NODE_ENV=development`; OTPs are printed in the development server terminal and are never returned to the browser. This mode does not send email.
5. Apply the schema and generate the Prisma client:

   ```powershell
   npm run db:migrate -- --name init
   npm run db:generate
   ```

6. Start the application with `npm run dev`, then open <http://localhost:3000>.

If you use `npm run db:migrate` again after changing the schema, Prisma will create a new migration. For production, apply committed migrations with `npm run db:deploy`; do not use `migrate dev` against production.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. |
| `AUTH_SECRET` | Yes | HMAC key for account-rate-limit identifiers and OTP hashes; use a randomly generated value with at least 32 characters. |
| `EMAIL_PROVIDER` | Yes for OTP | `resend` for production email, or `console` for development-only local testing. |
| `RESEND_API_KEY` | When using Resend | Resend API credential; keep it server-side. |
| `EMAIL_FROM` | When using Resend | Sender address verified with Resend. |
| `OTP_TTL_MINUTES` | No | OTP lifetime in minutes; defaults to 10. |
| `OTP_MAX_ATTEMPTS` | No | Failed submissions per challenge; defaults to 5. |
| `TRUSTED_DEVICE_DAYS` | No | Trusted-device lifetime; defaults to 30. |
| `IPINFO_TOKEN` | No | Optional IPinfo token for city/region/country lookups. Without it, location is recorded as unknown. |
| `TRUST_PROXY_HEADERS` | No | Set to `true` only when a trusted reverse proxy strips incoming IP headers and writes `X-Real-IP`. |

Malformed numeric OTP/trust settings fail explicitly instead of silently choosing another lifetime.
Supported bounds are 1–30 minutes for OTP lifetime, 1–10 attempts per challenge, and 1–365 days for device trust.

## Email delivery

For production, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM` using your deployment's secret manager. The sender domain/address must be configured with Resend. If delivery is missing or fails, SentinelID does not grant a session: it invalidates the challenge, records the delivery failure, and reports the configuration problem to the sign-in page.

`EMAIL_PROVIDER=console` is development-only and refuses to run if `NODE_ENV` is not `development`. It keeps OTPs in a short-lived, in-memory local inbox and shows the code only on that challenge's verification page, clearly labeled as development-only. It does not log the recipient or code. This inbox is cleared on successful verification or expiry, is lost when the development server restarts, and is unavailable outside development. Never use this provider in production; it does not send email.

## IP and location policy

SentinelID never treats a browser-submitted IP or location as authoritative. It reads `X-Real-IP` only on Vercel deployments or when `TRUST_PROXY_HEADERS=true`. Configure this only behind a proxy that removes any user-supplied `X-Real-IP` and sets its own value. Do not enable it when clients can reach the app directly or can control that header. The application does not select the first value in `X-Forwarded-For`.

IP geolocation is optional. When `IPINFO_TOKEN` is configured, IPinfo is called from the server with a short timeout. A failed lookup is logged server-side and location remains unknown; location is never inferred from browser input.

## Theme rule

New accounts receive the theme corresponding to server time in `Asia/Kolkata`: light from 05:00 inclusive until 12:00 exclusive, dark otherwise. If the user has not manually chosen a theme, a successful sign-in refreshes this initial preference using the server's current IST time. A manual theme choice is stored on the user profile and is never overwritten by later sign-ins. The chosen theme is shared across sessions/devices. The profile timezone is used to format event timestamps and defaults to `Asia/Kolkata`.

## Authentication and security behavior

- Passwords use Argon2id; they are never stored or logged in plain text.
- Session and trusted-device cookies are random, HTTP-only, `SameSite=Strict`, and `Secure` in production. Only token hashes are stored in PostgreSQL. Sessions have a seven-day fixed lifetime.
- A new browser/device, changed server-derived IP, changed known city/region, or expired/revoked trust triggers email OTP before a session is created. Device trust uses a separate 256-bit random token in an HTTP-only cookie; the user-agent is only one risk signal and is not a device credential.
- OTPs are cryptographically random, short-lived, HMAC-hashed with `AUTH_SECRET`, attempt-limited, and consumed atomically before a session is issued.
- Login requests are rate-limited to 10 per 15 minutes by normalized email and, when available, server-derived IP. OTP issuance is rate-limited to 5 per hour by account and IP; each challenge has its own attempt limit.
- Mutating server actions validate the request `Origin` against the host. Every authenticated read and mutation checks the user's session and scopes database operations to that user.
- Audit entries omit passwords, OTP values, session tokens, and trusted-device tokens. IPs are stored only when a configured trusted deployment header provides one.
- Rate-limit bucket keys are HMACs, not raw email addresses or IP addresses. Clean up expired rows periodically with `DELETE FROM "RateLimitBucket" WHERE "updatedAt" < NOW() - INTERVAL '2 days';`.

## Testing and verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

The unit tests cover IST theme boundaries, preservation of a manual theme, new-device/IP/location risk rules, and OTP expiry/reuse/attempt decisions. Database-backed end-to-end flows require a configured PostgreSQL database and email provider (or the local development console mode). After setup, exercise:

1. Register an account with a 12-character-or-longer password.
2. Sign in; a first sign-in requests OTP. With local console mode, the verification page displays the short-lived development-only code; submit it in the same form. The code is never written to the terminal.
3. Confirm the trusted device and session appear on their respective pages. Sign in again in the same browser; revoke the device and confirm the next sign-in asks for OTP.
4. Change the theme and timezone; sign out/in and confirm the manual theme is retained and timestamps use the saved timezone.
5. Revoke a session and confirm it no longer authorizes protected pages. Use a second browser to test revoking another session.

## Current provider requirements

This repository does not include production credentials or a PostgreSQL server. Configure `DATABASE_URL`, `AUTH_SECRET`, and a real email provider before deploying. Geolocation and trustworthy public-IP capture depend on optional provider/deployment configuration. Until those are supplied, missing IP/location values are deliberately shown as unknown.
