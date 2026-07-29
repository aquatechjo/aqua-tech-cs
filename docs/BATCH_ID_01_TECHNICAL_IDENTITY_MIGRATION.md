# ID-01 — Technical Identity Migration

## Purpose

Complete the technical rename from the historical `aquaflow` identifier to
`aqua-tech-cs` without interrupting active sessions, website intake, seeded
environments, or internal Design System consumers.

## Canonical identifiers

| Surface | Canonical value |
|---|---|
| Application package | `aqua-tech-cs` |
| Product-theme ID | `aqua-tech-cs` |
| Product-theme export | `aquaTechCsTheme` |
| DOM product selector | `data-aqua-product="aqua-tech-cs"` |
| Session cookie | `aqua-tech-cs_session` |
| Website intake header | `X-Aqua-Tech-CS-Intake-Secret` |
| Local folder and future repository | `aqua-tech-cs` |

## Compatibility window

- Existing `aquaflow_session` cookies remain readable so applying this batch
  does not force an immediate logout.
- New logins issue only `aqua-tech-cs_session` and expire the legacy cookie.
- Logout invalidates tokens received under either cookie name and expires both.
- Website intake prefers `X-Aqua-Tech-CS-Intake-Secret`, keeps Bearer
  authentication unchanged, and temporarily accepts
  `X-AquaFlow-Intake-Secret`.
- The internal Design System exports `aquaTechCsTheme` while retaining the
  deprecated `aquaFlowTheme` alias and legacy CSS selector.
- The seed checks both historical and current welcome-marker IDs before
  creating a notification.

The legacy cookie can be removed after the seven-day session lifetime has
elapsed from production deployment. The legacy intake header should be removed
only after the website and n8n configurations send the canonical header.

## Deliberately unchanged

- Database table and column names.
- Historical migration and batch records.
- Existing database rows and audit history.
- Environment-secret values.
- Public product label `Aqua tech CS`.

No database migration is required.

## Local folder migration

Apply and commit the source batch inside the current `aquaflow` folder first.
After the working tree is clean, close any running development server and
rename the local folder from the parent directory:

```powershell
Set-Location "C:\Users\HP\Desktop"
Rename-Item -LiteralPath "aquaflow" -NewName "aqua-tech-cs"
Set-Location "C:\Users\HP\Desktop\aqua-tech-cs"
```

Future GitHub, Vercel, and integration projects should use `aqua-tech-cs`. Do
not rename an existing deployed project until its configured paths and
integrations have been checked.

## Quality gates

- Design System synchronization.
- Visual-contract update for the deliberate selector and package change.
- ESLint and TypeScript.
- Unit tests for canonical and legacy cookie/header behavior.
- Production build.
- Source scan confirming remaining `aquaflow` references are documented
  compatibility aliases or historical records.
