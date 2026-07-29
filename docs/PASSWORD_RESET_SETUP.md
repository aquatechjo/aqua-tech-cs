# Aqua Tech CS password reset setup

## Owner account

The protected system owner email is:

`info.aquatech.jo@gmail.com`

Running the seed updates the existing Aqua Tech `OWNER` account to this email. The seed requires `SEED_OWNER_PASSWORD` and refuses a different `SEED_OWNER_EMAIL`.

## Required environment variables

```env
APP_ORIGIN="https://your-aqua-tech-cs-domain.example"
RESEND_API_KEY="re_..."
PASSWORD_RESET_FROM="Aqua Tech CS <system@aquatechagency.com>"
SEED_OWNER_EMAIL="info.aquatech.jo@gmail.com"
SEED_OWNER_PASSWORD="a-strong-password-at-least-12-characters"
```

`APP_ORIGIN` is mandatory in production so reset links cannot be built from an untrusted request host.

## Email domain

Verify a domain or sending subdomain in Resend before production use. The address configured in `PASSWORD_RESET_FROM` must use that verified domain.

## Deployment order

1. Configure the environment variables.
2. Run `npm run db:deploy`.
3. Run `npm run db:seed` once to normalize the owner email and password.
4. Run `npm run check`.
5. Test the complete flow from `/forgot-password`.

## Security behavior

- Reset tokens are random and only their SHA-256 hashes are stored.
- Tokens expire after 20 minutes and can be used once.
- A new request invalidates older unused tokens.
- Successful reset invalidates every active session for the user.
- Forgot-password responses do not disclose whether an account exists.
- Requests are rate limited by IP, account, and token.
- Owner email, role, active status, and team-panel password changes are protected.
