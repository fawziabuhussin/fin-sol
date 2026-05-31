# Smart Financial OS (المالية الذكية)

Premium RTL FinTech app for cash flow, home construction, Jam'iya savings, and AI-powered financial insights. Migrated from Excel workbook structure.

## Stack

- **Next.js 16** (App Router) + React + Tailwind CSS v4
- **Prisma 7** + PostgreSQL (Neon-ready)
- **Auth.js** (credentials, multi-household)
- **Recharts** + **Framer Motion**

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Set `DATABASE_URL` (Neon PostgreSQL) and `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

3. Push schema to database:

```bash
npm run db:push
```

4. Import Excel data (optional):

```bash
npm run import:excel -- "/path/to/9686F4E.xlsx" your@email.com
```

Default demo user after import: `demo@fin-sol.local` / `demo1234`

5. Run dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → register or login → `/dashboard`.

## Smart Engine

- `POST /api/insights/generate` — regenerates liquidity, investment, anomaly, and Keren insights
- Dashboard auto-generates insights on first visit if none exist

## Project structure

```
prisma/schema.prisma     # Full domain model
src/lib/insights/engine.ts
src/lib/dashboard-data.ts
scripts/import-excel.ts
src/app/dashboard/       # RTL dashboard wireframe
```

## Deploy (Vercel)

1. Connect repo to Vercel
2. Add `DATABASE_URL`, `AUTH_SECRET` env vars
3. Run `prisma db push` against production DB (or migrate)
4. Deploy
