# MoneyPlan

A personal finance web app to track net worth, transactions, budgets, and get AI-powered financial insights.

## Features

- **Dashboard** — Monthly income/expense summary, spending by category, budget health score
- **Transactions** — Manual entry + CSV upload with automatic Gemini AI categorisation
- **Net Worth** — Track assets & liabilities, visualise trends over time
- **Budgets** — Set monthly limits per category, track progress with alerts
- **AI Chat** — Natural language queries about your finances powered by Gemini
- **Reports** — 6-month history with 3-month spending forecast

## Tech Stack

- **Framework** — Next.js 14 (App Router)
- **Database** — Neon Postgres (serverless)
- **ORM** — Drizzle ORM
- **Auth** — NextAuth.js v5 (Google OAuth + email/password)
- **UI** — Tailwind CSS + shadcn/ui
- **Charts** — Recharts
- **AI** — Google Gemini

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-username/moneyplan.git
cd moneyplan
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in all values (see comments in the file for where to get each one).

### 3. Set up the database

Create a free Postgres database at [neon.tech](https://neon.tech), paste the connection string into `DATABASE_URL`, then run migrations:

```bash
npm run db:migrate
```

### 4. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:3000/api/auth/callback/google` as an Authorized Redirect URI
4. Copy the Client ID and Secret into `.env.local`

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Drizzle migrations from schema changes |
| `npm run db:migrate` | Apply pending migrations to the database |
| `npm run db:studio` | Open Drizzle Studio (database UI) |

## Project Structure

```
src/
├── app/
│   ├── (app)/          # Authenticated app pages
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── net-worth/
│   │   ├── budgets/
│   │   ├── ai-chat/
│   │   └── reports/
│   ├── (auth)/         # Auth pages (sign-in)
│   └── api/            # API routes
├── components/
│   ├── ui/             # Base UI components (Button, Dialog, Avatar…)
│   ├── layout/         # Sidebar, header
│   ├── dashboard/
│   ├── net-worth/
│   ├── budgets/
│   ├── ai-chat/
│   └── reports/
└── lib/
    ├── schema.ts       # Drizzle database schema
    ├── db.ts           # Database client
    ├── auth.ts         # NextAuth config
    ├── accounts.ts     # Net worth logic
    ├── transactions.ts # Transaction helpers
    ├── budgets.ts      # Budget logic
    ├── dashboard.ts    # Dashboard aggregations
    ├── reports.ts      # Reports & forecast
    └── gemini.ts       # Gemini AI integration
```

## Deployment

Deploy to [Vercel](https://vercel.com) — add the same environment variables from `.env.example` in the Vercel dashboard under Project Settings → Environment Variables.

## Security

- All secrets live in `.env.local` which is listed in `.gitignore` and never committed
- All app routes are protected by NextAuth middleware
- Database queries are always scoped to the authenticated user's ID
