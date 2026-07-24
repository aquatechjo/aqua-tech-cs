# AquaFlow

AquaFlow is Aqua Tech's private internal core system. It manages the company's
people, attendance, leave, clients, projects, tasks, time, capacity, service
requests, notifications, and audited operations while remaining ready to integrate with specialized external tools.

It is not a public SaaS product and does not provide public registration.

## Stack

- Next.js 16
- React 19
- Prisma 7
- PostgreSQL
- Bootstrap 5

## Local setup

1. Copy `.env.example` to `.env` and set the required values.
2. Install packages:

   ```bash
   npm install
   ```

3. Apply database migrations:

   ```bash
   npm run db:deploy
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

## Quality checks

Run the complete local gate before committing:

```bash
npm run check
```

The gate runs ESLint, TypeScript, unit tests, Prisma generation, and the
production build.

## Safe first seed

The seed has no built-in credentials. Set `SEED_OWNER_EMAIL` and a unique
`SEED_OWNER_PASSWORD` of at least 12 characters before running:

```bash
npm run db:seed
```

Never commit `.env` or production credentials.

Implementation notes:

- [Batch 0 — Security Foundation](docs/BATCH_0_SECURITY_FOUNDATION.md)
- [Batch 1 — Organization Structure](docs/BATCH_1_ORGANIZATION_STRUCTURE.md)
- [Batch 2 — Project Execution](docs/BATCH_2_PROJECT_EXECUTION.md)
- [Batch 3 — Operational Finance](docs/BATCH_3_OPERATIONAL_FINANCE.md)
- [Batch 4 — Sales CRM & Pipeline](docs/BATCH_4_SALES_CRM_PIPELINE.md)
- [Batch 5 — Time & Capacity](docs/BATCH_5_TIME_CAPACITY.md)
- [Batch 6 — People, Attendance & Leave](docs/BATCH_6_PEOPLE_ATTENDANCE_LEAVE.md)
