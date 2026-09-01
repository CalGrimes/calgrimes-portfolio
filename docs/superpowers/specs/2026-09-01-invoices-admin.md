# Invoices Admin — Design Spec

**Date:** 2026-09-01
**Repo:** `calgrimes-portfolio` (Next.js 16.0.10, React 19.2.0, App Router, Tailwind, shadcn-style `components/ui`)
**Host:** Vercel · **Source:** GitHub · **Database:** Neon Postgres (free tier), project `little-violet-67071336`, branch `production`

---

## 1. Problem

The portfolio site at `calgrimes.co.uk` is a fully static marketing site. Cal wants to run a
private, single-user invoicing command center behind it: create invoices, store them durably,
email them to clients, and see billing analytics over time.

The original instinct was SQLite. That does not work on Vercel — the function filesystem is
read-only outside `/tmp`, and `/tmp` is ephemeral and per-instance, so writes are lost between
requests and deploys. Neon Postgres is the chosen replacement: managed, free-tier, and
Postgres-compatible.

## 2. Goals

1. Google sign-in restricted to a single allowlisted Gmail address.
2. A discreet "Admin Login" link in the site footer, visible to everyone.
3. When (and only when) signed in as the allowed account, a stylish floating hotbar pinned
   bottom-left linking to `/invoices`.
4. `/invoices` — a dashboard/command center with revenue-over-time line chart, metric cards,
   and a breakdown chart with filtering.
5. Create new invoices from the UI.
6. Export a finished invoice as an Outlook-openable email draft with the invoice PDF attached.
7. All invoice data persisted in Neon and feeding the dashboard analytics.

## 3. Non-goals

- Multi-user, roles, or team accounts. Exactly one human uses this.
- Payment collection, Stripe, or payment links.
- Recurring invoices, reminders, or dunning.
- Client portal — clients only ever receive an email with a PDF.
- Porting ADZAP's preset system, saved views, column management, or its six React contexts.

---

## 4. Decisions

These were settled explicitly before planning. Each records the alternative rejected.

### 4.1 Auth — Auth.js v5 + Google + email allowlist

`next-auth@5.0.0-beta.32` with the Google provider and `@auth/drizzle-adapter` writing
`user` / `account` / `session` / `verificationToken` tables into Neon. Access is gated in
the `signIn` callback: the Google profile email must case-insensitively equal `ADMIN_EMAIL`
**and** be `email_verified`. Everyone else is rejected at the callback, before a row is ever
written.

*Verified:* `next-auth@beta` declares `next: ^14 || ^15 || ^16` and `react: ^18.2 || ^19`, so it
supports this project's Next 16.0.10 / React 19.2.0. Its `nodemailer` peer is marked
`optional: true`, so the repo's existing nodemailer 6.10.1 causes no install conflict.

*Rejected:* Clerk (the Vercel Marketplace native option). It would put the user record in
Clerk rather than Neon — contradicting the "store a single user (myself)" requirement — and
adds a second managed service for one person.

### 4.2 Money — integer minor units

All monetary values are stored as **integer pence** (`total_minor`, `unit_price_minor`,
`amount_minor`). No floats, no Postgres `numeric` (which Drizzle returns as strings).
Quantities are stored as **integer thousandths** (`quantity_milli`) so `7.5 hours` → `7500`,
avoiding float drift on line totals.

`amount_minor = round(quantity_milli × unit_price_minor / 1000)`

### 4.3 Invoice model — line items, no tax fields

Two tables: `invoices` and `invoice_line_items`. Per-line description, quantity, unit price
and amount; per-invoice client details, dates, currency, total, status and notes.

**No `tax_rate` / `tax_amount` columns.** Cal does not charge tax on invoices. The £12,500
figure is a *personal reporting threshold*, not a per-invoice charge — so it belongs on the
dashboard, not in the schema. Should tax ever need charging, a Drizzle migration adds nullable
columns with no backfill required, since historical invoices genuinely had no tax.

**Instead:** the dashboard carries a **YTD threshold card** showing total billed in the current
calendar year against £12,500, with a progress bar that changes state as it approaches and
crosses the threshold.

### 4.4 Outlook export — `.eml` with `X-Unsent: 1`, PDF attached

Clicking "Send to client" downloads `invoice-INV-2026-0007.eml`: a MIME message addressed to
the client, with subject and body pre-filled and the invoice PDF attached.

The message carries the header **`X-Unsent: 1`**, which is what makes Outlook open it as an
editable draft with a Send button rather than as a read-only received message.

> **Honest limitation, corrected from the original option description:** the editable-draft
> behaviour is an Outlook desktop feature (Windows and Mac). `X-Unsent` is not honoured by
> Apple Mail or Outlook on the web — there the `.eml` opens as a viewable message that must be
> forwarded rather than sent. Since Outlook is the stated target this is acceptable, but it is
> not universal, and the UI copy should say "Download Outlook draft" rather than implying every
> client behaves identically.

*Built with:* `MailComposer` from `nodemailer/lib/mail-composer` — nodemailer is **already a
dependency** (6.10.1) and ships `MailComposer` with TypeScript types via the installed
`@types/nodemailer`. `compile().build()` returns `Promise<Buffer>`. Zero new dependencies for
the `.eml` path.

*PDF built with:* `pdfkit` — Node-native, built-in Helvetica (no font files to ship), no React
reconciler involvement. Rejected `@react-pdf/renderer`, whose React peer range is a recurring
friction point on React 19.

### 4.5 Database access — Drizzle over Neon HTTP, `db.batch()` for atomicity

`drizzle-orm/neon-http` with `@neondatabase/serverless`. The HTTP driver does **not** support
interactive transactions, but it **does** support `db.batch([...])`, which runs its statements
in a single transaction.

*Verified in `drizzle-orm@0.45.2` typings:* `neon-http/driver.d.ts` exposes
`batch<U extends BatchItem<'pg'>, T extends Readonly<[U, ...U[]]>>(batch: T): Promise<BatchResponse<T>>`.

Creating an invoice therefore generates the invoice UUID in application code, then batches the
invoice insert and all line-item inserts into one atomic call — no WebSocket pool needed.

**Critical constraint:** the DB client must be exposed as a plain lazy `getDb()` function.
It must **not** be wrapped in a JavaScript `Proxy`. Auth.js adapters introspect the adapter
object (checking method existence, iterating properties); a Proxy intercepts those checks and
breaks the auth chain silently, producing hangs with no error.

Lazy initialisation is required because `neon()` throws when `DATABASE_URL` is unset, and
Next.js evaluates top-level module code at build time — an eager client crashes `next build`
on any deploy where the env var is not yet present.

### 4.6 Dashboard scope — ADZAP's chart language, simpler shell

Ported from `/Users/calgr/Documents/personal/Businesses/ADZAP/caxlabs-adjet/client/src/app/(protected)/statistics`:

- recharts `LineChart` with dual Y axes (`left` / `right` per metric)
- a `METRIC_CONFIGS` registry driving colour, label, icon, axis and description per metric
- clickable `Legend` that toggles series visibility
- grid and data-point toggles
- a custom tooltip component
- `MetricCard` with value, delta and up/down trend
- `hsl(var(--border))` / `hsl(var(--muted-foreground))` theme tokens so charts follow the
  site's seven themes rather than hardcoding ADZAP's warm-neutral palette

Deliberately **not** ported: `StatisticsReportContext` and the five sibling contexts, preset
save/load, `localStorage` preferences, `useTableColumnManagement` / `useEnhancedTableState`,
comparison-period mode, and the attribution selector.

*Version note:* ADZAP runs recharts 2.15.4; this project will install recharts 3.10.1, which
supports React 19. The `Legend` `onClick` payload is read defensively (`e?.dataKey`) exactly as
the reference does, so the toggle survives the major-version difference — but legend toggling
must be manually verified once, as it is the one API surface most likely to have shifted.

---

## 5. Data model

```
user, account, session, verificationToken     ← Auth.js standard schema

invoices
  id               uuid pk
  number           text unique         "INV-2026-0007"
  client_name      text not null
  client_email     text not null
  client_address   text
  issue_date       date not null
  due_date         date not null
  currency         text not null default 'GBP'
  total_minor      integer not null
  status           enum('draft','sent','paid','overdue','void') default 'draft'
  notes            text
  paid_at          timestamptz
  created_at       timestamptz not null default now()
  updated_at       timestamptz not null default now()
  indexes: issue_date, status, client_name

invoice_line_items
  id               uuid pk
  invoice_id       uuid fk → invoices.id on delete cascade
  position         integer not null
  description      text not null
  quantity_milli   integer not null     7.5  → 7500
  unit_price_minor integer not null     £80  → 8000
  amount_minor     integer not null     £600 → 60000
  index: invoice_id
```

## 6. Dashboard metrics

| Metric | Axis | Definition |
|---|---|---|
| `billed` | left | Sum of `total_minor` for invoices issued in the bucket |
| `paid` | left | Sum of `total_minor` where `status = 'paid'` |
| `outstanding` | left | Sum of `total_minor` where status is `sent` or `overdue` |
| `count` | right | Number of invoices issued in the bucket |
| `avgInvoice` | right | `billed / count`, `0` when `count = 0` |

Breakdown dimensions: **client**, **status**, **month**.
Date ranges: 30d / 90d / 6m / 12m / YTD / all.
Granularity: `day` for ranges ≤ 90 days, `week` for ≤ 12 months, `month` beyond.

## 7. Routes

| Route | Access | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | public | Auth.js handlers |
| `/admin/login` | public | Google sign-in page + rejection message |
| `/invoices` | admin | Dashboard |
| `/invoices/new` | admin | Create invoice form |
| `/invoices/[id]` | admin | Single invoice detail + export buttons |
| `/api/invoices/[id]/pdf` | admin | `application/pdf` download |
| `/api/invoices/[id]/eml` | admin | `message/rfc822` download |

Admin routes live in an `app/(admin)/` route group with its own layout, so they never inherit
the marketing nav from `app/(root)/layout.tsx`.

## 8. Environment variables

| Name | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Neon | Pooled Postgres connection string |
| `AUTH_SECRET` | generated | Auth.js session encryption |
| `AUTH_GOOGLE_ID` | Google Cloud | OAuth client id |
| `AUTH_GOOGLE_SECRET` | Google Cloud | OAuth client secret |
| `ADMIN_EMAIL` | manual | The single allowlisted Gmail address |
| `AUTH_URL` | manual | `https://calgrimes.co.uk` in production |

Google OAuth redirect URIs to register:
- `http://localhost:3000/api/auth/callback/google`
- `https://calgrimes.co.uk/api/auth/callback/google`

## 9. Manual checkpoints

Three steps cannot be automated and will block execution until Cal completes them:

1. **`neon login`** — opens a browser for Neon account auth.
2. **Google Cloud Console** — create the OAuth 2.0 client, add both redirect URIs, copy the
   client id and secret.
3. **Vercel env vars** — push all six variables to the linked Vercel project.

## 10. Risks

| Risk | Mitigation |
|---|---|
| `neon` CLI subcommands differ from the given steps | Each CLI step is followed by a verification command; if one errors, run `neon --help` before improvising |
| recharts v3 `Legend.onClick` payload shape differs from v2 | Read `e?.dataKey` defensively; manual verification step in the chart task |
| `tsconfig` `target: es5` breaks modern library output under Vitest | Bump `target` to `ES2020` in Task 1 |
| Auth.js beta releases introduce breaking changes | Pin the exact version `5.0.0-beta.32`, do not use a caret range |
| `X-Unsent` ignored outside Outlook desktop | Documented in §4.4; UI copy says "Outlook draft" |
| Neon free tier scales compute to zero | Cold query latency of a few hundred ms on first load; acceptable for a single-user dashboard |