# Invoices Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Google-authenticated, single-user invoicing command center to the calgrimes.co.uk portfolio, backed by Neon Postgres.

**Architecture:** Auth.js v5 gates a `/invoices` admin area behind a single allowlisted Gmail address, with the user row stored in Neon via the Drizzle adapter. Invoices and their line items live in two Postgres tables, written atomically through `db.batch()` over Neon's HTTP driver. The dashboard reads all invoices server-side and passes them to pure aggregation functions that build recharts-ready time series and breakdowns; exports are generated on demand as a PDF (pdfkit) and an Outlook-openable `.eml` draft (nodemailer's MailComposer).

**Tech Stack:** Next.js 16.0.10 (App Router) · React 19.2.0 · TypeScript · Tailwind · Drizzle ORM 0.45.2 · @neondatabase/serverless 1.1.0 · next-auth 5.0.0-beta.32 · recharts 3.10.1 · pdfkit 0.20.2 · nodemailer 6.10.1 (already installed) · Vitest 4

**Spec:** `docs/superpowers/specs/2026-09-01-invoices-admin.md`

## Global Constraints

- **Money is integer minor units.** Never store or compute money as a float. `total_minor`, `unit_price_minor`, `amount_minor` are integer pence. Quantities are integer thousandths (`quantity_milli`).
- **Never wrap the Drizzle client in a `Proxy`.** Auth.js adapters introspect the adapter object; a Proxy breaks the auth chain silently with no error. Use a plain lazy `getDb()` function.
- **The DB client must be lazily initialised.** `neon()` throws when `DATABASE_URL` is unset and Next.js evaluates top-level module code at build time.
- **Pin `next-auth` to the exact version `5.0.0-beta.32`** — no caret range. Beta releases introduce breaking changes.
- **`drizzle-kit` and standalone Node scripts do not auto-load `.env.local`.** Always invoke them through `dotenv -e .env.local --`.
- **Chart colours use theme tokens** — `hsl(var(--border))`, `hsl(var(--muted-foreground))` — never hardcoded hex, because the site ships seven themes.
- **Invoice tables carry no tax columns.** The £12,500 figure is a personal YTD reporting threshold surfaced on the dashboard, not a per-invoice charge.
- **Admin email comparison fails closed.** An unset or empty `ADMIN_EMAIL` must reject every sign-in.
- **Test scope:** pure functions get Vitest tests (Vitest runs in `node` environment only — no jsdom, no component tests). UI tasks carry explicit manual verification steps instead.
- Existing deps to reuse rather than reinstall: `zod@^3.24`, `react-hook-form`, `@hookform/resolvers`, `framer-motion`, `lucide-react`, `nodemailer`, `@types/nodemailer`, and the `components/ui/*` shadcn primitives.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `vitest.config.ts` | Test runner config, `@/` alias |
| `neon.ts` | Neon project config |
| `drizzle.config.ts` | Drizzle Kit migration config |
| `lib/db/index.ts` | Lazy `getDb()` — the only place a DB client is constructed |
| `lib/db/schema/auth.ts` | Auth.js tables |
| `lib/db/schema/invoices.ts` | `invoices` + `invoice_line_items` + relations |
| `lib/db/schema/index.ts` | Schema barrel |
| `lib/auth-allowlist.ts` | Pure `isAllowedAdmin()` predicate — the security-critical unit |
| `lib/auth.ts` | Auth.js v5 instance (`handlers`, `auth`, `signIn`, `signOut`) |
| `lib/auth-guard.ts` | `getAdminSession()` / `requireAdmin()` |
| `types/next-auth.d.ts` | Session type augmentation for `isAdmin` |
| `lib/invoices/money.ts` | Minor/major/milli conversion + formatting |
| `lib/invoices/numbering.ts` | `nextInvoiceNumber()` |
| `lib/invoices/types.ts` | Shared invoice types + Zod schemas |
| `lib/invoices/repository.ts` | All DB reads/writes for invoices |
| `lib/invoices/actions.ts` | Server actions (create, set status) |
| `lib/invoices/aggregate.ts` | Pure dashboard aggregation |
| `lib/invoices/pdf.ts` | pdfkit invoice renderer |
| `lib/invoices/eml.ts` | MailComposer `.eml` builder |
| `app/admin/login/page.tsx` | Unguarded Google sign-in page |
| `app/api/auth/[...nextauth]/route.ts` | Auth.js route handlers |
| `app/(admin)/layout.tsx` | Guarded admin shell |
| `app/(admin)/invoices/page.tsx` | Dashboard |
| `app/(admin)/invoices/new/page.tsx` | Create form page |
| `app/(admin)/invoices/[id]/page.tsx` | Detail + export buttons |
| `app/api/invoices/[id]/pdf/route.ts` | PDF download |
| `app/api/invoices/[id]/eml/route.ts` | `.eml` download |
| `components/admin/admin-hotbar.tsx` | Server: session check |
| `components/admin/admin-hotbar-client.tsx` | Client: animated floating pill |
| `components/invoices/metric-configs.ts` | `METRIC_CONFIGS` registry |
| `components/invoices/metric-card.tsx` | Single metric tile |
| `components/invoices/ytd-threshold-card.tsx` | £12,500 YTD progress |
| `components/invoices/revenue-chart.tsx` | recharts line chart |
| `components/invoices/chart-tooltip.tsx` | Custom tooltip |
| `components/invoices/breakdown-chart.tsx` | Horizontal bar breakdown |
| `components/invoices/dashboard-filters.tsx` | Range + breakdown controls |
| `components/invoices/dashboard.tsx` | Client shell composing chart + filters |
| `components/invoices/invoice-table.tsx` | Invoice list |
| `components/invoices/invoice-form.tsx` | Create form |
| `components/invoices/export-buttons.tsx` | PDF / Outlook draft buttons |

**Modified:**

| Path | Change |
|---|---|
| `tsconfig.json:4` | `target: "es5"` → `"ES2020"` |
| `package.json` | New deps + `test` / `db:*` scripts |
| `components/common/site-footer.tsx` | Add "Admin Login" link |
| `app/(root)/layout.tsx` | Render `<AdminHotbar />` |
| `.env.copy` | Document the six new env vars |

---

## Task 1: Test infrastructure

Nothing else in this plan can be written test-first until Vitest runs. This task also fixes the `es5` compile target, which otherwise causes esbuild to downlevel modern syntax under test.

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/sanity.test.ts` (deleted at the end of this task)
- Modify: `tsconfig.json:4`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` runs Vitest over `**/*.test.ts` with the `@/` alias resolving to the repo root.

- [ ] **Step 1: Install Vitest**

```bash
npm i -D vitest@^4.1.11
```

- [ ] **Step 2: Write the config**

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "docs/**"],
  },
});
```

If `vitest/config` fails to resolve, Vitest's bundled Vite is missing — run `npm i -D vite@^7` and retry.

- [ ] **Step 3: Add the test scripts**

In `package.json`, add to `"scripts"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4: Bump the compile target**

In `tsconfig.json`, change line 4:

```diff
-    "target": "es5",
+    "target": "ES2020",
```

- [ ] **Step 5: Write a sanity test that proves the alias works**

Create `lib/sanity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("test harness", () => {
  it("resolves the @/ alias", () => {
    expect(cn("a", "b")).toBe("a b");
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm test`
Expected: PASS — 1 test. If the alias fails you get `Cannot find module '@/lib/utils'`.

- [ ] **Step 7: Verify the app still builds with the new target**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 8: Delete the sanity test and commit**

```bash
rm lib/sanity.test.ts
git add vitest.config.ts tsconfig.json package.json package-lock.json
git commit -m "chore: add vitest test infrastructure and bump ts target to ES2020"
```

---

## Task 2: Neon provisioning and the Drizzle client

**Files:**
- Create: `neon.ts`
- Create: `lib/db/index.ts`
- Create: `lib/db/index.test.ts`
- Modify: `.env` (local, gitignored), `.env.copy`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1's Vitest setup.
- Produces: `getDb(): NeonHttpDatabase<typeof schema>` from `@/lib/db` — the single DB client accessor used by every later task. Throws `Error("DATABASE_URL is not set")` when unconfigured; memoises the client across calls.

- [ ] **Step 1: Install the Neon CLI and authenticate — MANUAL CHECKPOINT**

```bash
npm i -g neon@latest
neon login
```

`neon login` opens a browser. **Stop here and ask Cal to complete the browser login before continuing.** Confirm with:

Run: `neon me`
Expected: prints the authenticated Neon account.

- [ ] **Step 2: Install Neon agent skills and MCP server**

```bash
neon skills -y
neon mcp -y
```

If either subcommand errors with "unknown command", run `neon --help` and report the actual subcommand names rather than improvising.

- [ ] **Step 3: Link the project**

```bash
neon link --project-id little-violet-67071336 --branch production -y
```

Run: `neon link --help` first if the flags are rejected.

- [ ] **Step 4: Initialise and overwrite the config**

```bash
neon config init
```

Then replace the entire contents of `neon.ts` with:

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({});
```

- [ ] **Step 5: Deploy the config**

```bash
neon deploy
```

- [ ] **Step 6: Capture the connection string into `.env`**

```bash
neon connection-string production --project-id little-violet-67071336
```

Append the result to `.env` (already gitignored) as:

```
DATABASE_URL=postgresql://...
```

If `neon connection-string` is not a valid subcommand, `neon link` may have written the variable already — check `.env` first, and fall back to copying the pooled connection string from the Neon console for the `production` branch.

- [ ] **Step 7: Document the variable**

Append to `.env.copy`:

```
# Neon Postgres (invoices)
DATABASE_URL=
```

- [ ] **Step 8: Install the database dependencies**

```bash
npm i drizzle-orm@^0.45.2 @neondatabase/serverless@^1.1.0
npm i -D drizzle-kit@^0.31.10 dotenv-cli@^10
```

- [ ] **Step 9: Write the failing test**

Create `lib/db/index.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = process.env.DATABASE_URL;

describe("getDb", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.DATABASE_URL = ORIGINAL;
  });

  it("throws a clear error when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    const { getDb } = await import("./index");
    expect(() => getDb()).toThrow("DATABASE_URL is not set");
  });

  it("memoises the client across calls", async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@ep-test.eu-west-2.aws.neon.tech/neondb";
    const { getDb } = await import("./index");
    expect(getDb()).toBe(getDb());
  });
});
```

- [ ] **Step 10: Run it to confirm it fails**

Run: `npm test -- lib/db/index.test.ts`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 11: Write the client**

Create `lib/db/index.ts`:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle(neon(url), { schema });
}

type Db = ReturnType<typeof createDb>;

// Deliberately a plain module-level lazy value, NOT a Proxy. Auth.js adapters
// introspect the adapter object, and a Proxy intercepts those checks and breaks
// the auth chain with no error.
let db: Db | null = null;

export function getDb(): Db {
  if (!db) {
    db = createDb();
  }
  return db;
}
```

This imports `./schema`, which does not exist yet — Task 3 creates it. To keep this task independently green, create a placeholder now:

```bash
mkdir -p lib/db/schema
printf 'export {};\n' > lib/db/schema/index.ts
```

- [ ] **Step 12: Run the tests**

Run: `npm test -- lib/db/index.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 13: Commit**

```bash
git add neon.ts lib/db package.json package-lock.json .env.copy
git commit -m "feat: provision neon project and add lazy drizzle client"
```

---

## Task 3: Database schema and migration

**Files:**
- Create: `lib/db/schema/auth.ts`
- Create: `lib/db/schema/invoices.ts`
- Modify: `lib/db/schema/index.ts` (replace the placeholder)
- Create: `lib/db/schema/schema.test.ts`
- Create: `drizzle.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `getDb()` from Task 2.
- Produces:
  - `users`, `accounts`, `sessions`, `verificationTokens` — Auth.js tables consumed by Task 4's `DrizzleAdapter`.
  - `invoices`, `invoiceLineItems`, `invoiceStatusEnum` — consumed by Task 8's repository.
  - `invoicesRelations`, `invoiceLineItemsRelations` — enable `db.query.invoices.findMany({ with: { lineItems: true } })`.
  - Type exports `Invoice`, `NewInvoice`, `InvoiceLineItem`, `NewInvoiceLineItem`, `InvoiceStatus`.

- [ ] **Step 1: Write the Auth.js schema**

Create `lib/db/schema/auth.ts`. Column names must match the Auth.js adapter exactly — they are camelCase in the database on purpose:

```ts
import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);
```

`next-auth` is not installed until Task 4, so `AdapterAccountType` will not resolve yet. Install the type dependency now so this task stays green:

```bash
npm i next-auth@5.0.0-beta.32
```

- [ ] **Step 2: Write the invoices schema**

Create `lib/db/schema/invoices.ts`:

```ts
import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "overdue",
  "void",
]);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull().unique(),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email").notNull(),
    clientAddress: text("client_address"),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    currency: text("currency").notNull().default("GBP"),
    totalMinor: integer("total_minor").notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("invoices_issue_date_idx").on(t.issueDate),
    index("invoices_status_idx").on(t.status),
    index("invoices_client_name_idx").on(t.clientName),
  ]
);

export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    // Quantity in thousandths: 7.5 hours -> 7500. Avoids float drift.
    quantityMilli: integer("quantity_milli").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    amountMinor: integer("amount_minor").notNull(),
  },
  (t) => [index("invoice_line_items_invoice_id_idx").on(t.invoiceId)]
);

export const invoicesRelations = relations(invoices, ({ many }) => ({
  lineItems: many(invoiceLineItems),
}));

export const invoiceLineItemsRelations = relations(
  invoiceLineItems,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [invoiceLineItems.invoiceId],
      references: [invoices.id],
    }),
  })
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type InvoiceStatus = Invoice["status"];
```

- [ ] **Step 3: Replace the schema barrel**

Overwrite `lib/db/schema/index.ts`:

```ts
export * from "./auth";
export * from "./invoices";
```

- [ ] **Step 4: Write the failing schema test**

This guards against column-name typos, which would otherwise fail silently at runtime inside the Auth.js adapter.

Create `lib/db/schema/schema.test.ts`:

```ts
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { accounts, invoiceLineItems, invoices, sessions, users } from "./index";

describe("auth schema", () => {
  it("uses the exact column names Auth.js expects", () => {
    expect(Object.keys(getTableColumns(users)).sort()).toEqual(
      ["email", "emailVerified", "id", "image", "name"].sort()
    );
    expect(Object.keys(getTableColumns(accounts))).toContain(
      "providerAccountId"
    );
    expect(Object.keys(getTableColumns(sessions))).toContain("sessionToken");
  });
});

describe("invoices schema", () => {
  it("stores money in integer minor units and carries no tax columns", () => {
    const cols = Object.keys(getTableColumns(invoices));
    expect(cols).toContain("totalMinor");
    expect(cols).not.toContain("taxRate");
    expect(cols).not.toContain("taxAmount");
  });

  it("stores line quantities in thousandths", () => {
    const cols = Object.keys(getTableColumns(invoiceLineItems));
    expect(cols).toContain("quantityMilli");
    expect(cols).toContain("unitPriceMinor");
    expect(cols).toContain("amountMinor");
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- lib/db/schema/schema.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Write the Drizzle Kit config**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 7: Add the database scripts**

In `package.json`, add to `"scripts"`:

```json
    "db:generate": "dotenv -e .env -- drizzle-kit generate",
    "db:migrate": "dotenv -e .env -- drizzle-kit migrate",
    "db:studio": "dotenv -e .env -- drizzle-kit studio"
```

`drizzle-kit` does not read `.env` on its own — the `dotenv -e .env --` prefix is required on every one of these.

- [ ] **Step 8: Generate and apply the migration**

```bash
npm run db:generate
npm run db:migrate
```

- [ ] **Step 9: Verify the tables exist in Neon**

Run: `npm run db:studio` and confirm six tables are present: `user`, `account`, `session`, `verificationToken`, `invoices`, `invoice_line_items`.
Expected: all six listed, `invoices.total_minor` typed `integer`.

- [ ] **Step 10: Commit**

```bash
git add lib/db drizzle.config.ts package.json package-lock.json
git commit -m "feat: add auth and invoice database schema"
```

---

## Task 4: Auth.js with Google and the admin allowlist

The allowlist predicate is extracted into a pure function so the security-critical logic is unit tested rather than buried in a callback.

**Files:**
- Create: `lib/auth-allowlist.ts`
- Create: `lib/auth-allowlist.test.ts`
- Create: `lib/auth.ts`
- Create: `types/next-auth.d.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Modify: `.env`, `.env.copy`

**Interfaces:**
- Consumes: `getDb()` (Task 2); `users`, `accounts`, `sessions`, `verificationTokens` (Task 3).
- Produces:
  - `isAllowedAdmin(email: string | null | undefined, adminEmail: string | null | undefined, emailVerified: boolean | undefined): boolean`
  - `handlers`, `auth`, `signIn`, `signOut` from `@/lib/auth`
  - `session.user.isAdmin: boolean` and `session.user.id: string` on the augmented `Session` type

- [ ] **Step 1: Write the failing allowlist test**

Create `lib/auth-allowlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isAllowedAdmin } from "./auth-allowlist";

const ADMIN = "calgrimes29@gmail.com";

describe("isAllowedAdmin", () => {
  it("accepts the exact allowlisted address when verified", () => {
    expect(isAllowedAdmin(ADMIN, ADMIN, true)).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isAllowedAdmin("CalGrimes29@Gmail.com", ADMIN, true)).toBe(true);
  });

  it("tolerates surrounding whitespace on both sides", () => {
    expect(isAllowedAdmin(`  ${ADMIN} `, ` ${ADMIN}`, true)).toBe(true);
  });

  it("rejects an unverified email", () => {
    expect(isAllowedAdmin(ADMIN, ADMIN, false)).toBe(false);
    expect(isAllowedAdmin(ADMIN, ADMIN, undefined)).toBe(false);
  });

  it("rejects any other address", () => {
    expect(isAllowedAdmin("someone@gmail.com", ADMIN, true)).toBe(false);
  });

  it("does not treat gmail dot-aliases as equal", () => {
    expect(isAllowedAdmin("cal.grimes29@gmail.com", ADMIN, true)).toBe(false);
  });

  it("fails closed when the allowlist is unset or empty", () => {
    expect(isAllowedAdmin(ADMIN, undefined, true)).toBe(false);
    expect(isAllowedAdmin(ADMIN, "", true)).toBe(false);
    expect(isAllowedAdmin(ADMIN, "   ", true)).toBe(false);
  });

  it("rejects a missing profile email", () => {
    expect(isAllowedAdmin(null, ADMIN, true)).toBe(false);
    expect(isAllowedAdmin(undefined, ADMIN, true)).toBe(false);
    expect(isAllowedAdmin("", ADMIN, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- lib/auth-allowlist.test.ts`
Expected: FAIL — `Cannot find module './auth-allowlist'`.

- [ ] **Step 3: Write the predicate**

Create `lib/auth-allowlist.ts`:

```ts
/**
 * The single gate on admin access. Fails closed: an unset, empty or
 * whitespace-only allowlist rejects every address.
 */
export function isAllowedAdmin(
  email: string | null | undefined,
  adminEmail: string | null | undefined,
  emailVerified: boolean | undefined
): boolean {
  if (emailVerified !== true) return false;

  const allowed = adminEmail?.trim().toLowerCase();
  if (!allowed) return false;

  const candidate = email?.trim().toLowerCase();
  if (!candidate) return false;

  return candidate === allowed;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- lib/auth-allowlist.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Install the adapter**

```bash
npm i @auth/drizzle-adapter@^1.11.3
```

`next-auth@5.0.0-beta.32` was already installed in Task 3 Step 1. Confirm `package.json` pins it exactly — `"next-auth": "5.0.0-beta.32"` with no caret. Edit it if npm added one.

- [ ] **Step 6: Augment the session type**

Create `types/next-auth.d.ts`:

```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}
```

- [ ] **Step 7: Write the Auth.js instance**

Create `lib/auth.ts`. The config is a function so `getDb()` is not called at module load — that keeps `next build` safe when `DATABASE_URL` is absent:

```ts
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { isAllowedAdmin } from "@/lib/auth-allowlist";
import { getDb } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  session: { strategy: "database" },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  callbacks: {
    signIn({ profile }) {
      return isAllowedAdmin(
        profile?.email,
        process.env.ADMIN_EMAIL,
        profile?.email_verified as boolean | undefined
      );
    },
    session({ session, user }) {
      session.user.id = user.id;
      session.user.isAdmin = isAllowedAdmin(
        user.email,
        process.env.ADMIN_EMAIL,
        true
      );
      return session;
    },
  },
}));
```

The `session` callback passes `true` for `emailVerified` deliberately: a row only exists in `user` because `signIn` already verified it, and Auth.js's `AdapterUser` does not carry the Google `email_verified` claim.

- [ ] **Step 8: Add the route handlers**

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 9: Create the Google OAuth client — MANUAL CHECKPOINT**

**Stop and ask Cal to do this in the browser:**

1. Go to Google Cloud Console → APIs & Services → Credentials.
2. Create an OAuth 2.0 Client ID, type **Web application**.
3. Add both Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://calgrimes.co.uk/api/auth/callback/google`
4. Copy the Client ID and Client Secret.

- [ ] **Step 10: Set the environment variables**

Generate the secret and append everything to `.env`:

```bash
npx auth secret
```

`.env` should now contain:

```
DATABASE_URL=postgresql://...
AUTH_SECRET=...
AUTH_GOOGLE_ID=...apps.googleusercontent.com
AUTH_GOOGLE_SECRET=...
ADMIN_EMAIL=calgrimes29@gmail.com
```

Append the names (values blank) to `.env.copy`:

```
# Auth.js — admin sign-in
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ADMIN_EMAIL=
AUTH_URL=
```

- [ ] **Step 11: Typecheck and commit**

Run: `npx tsc --noEmit && npm test`
Expected: exit 0; all tests pass.

```bash
git add lib/auth.ts lib/auth-allowlist.ts lib/auth-allowlist.test.ts types/next-auth.d.ts app/api/auth package.json package-lock.json .env.copy
git commit -m "feat: add google sign-in restricted to a single admin allowlist"
```

---

## Task 5: Admin guard, login page, and footer link

**Files:**
- Create: `lib/auth-guard.ts`
- Create: `app/admin/login/page.tsx`
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/invoices/page.tsx` (placeholder, replaced in Task 14)
- Modify: `components/common/site-footer.tsx`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth` (Task 4).
- Produces:
  - `getAdminSession(): Promise<Session | null>` — returns the session only when `user.isAdmin`, else `null`.
  - `requireAdmin(): Promise<Session>` — same, but redirects to `/admin/login` instead of returning `null`.

The login page lives at `app/admin/login/` — **outside** the `(admin)` route group — so the guarded layout never wraps it. Putting it inside would create a redirect loop.

- [ ] **Step 1: Write the guard**

Create `lib/auth-guard.ts`:

```ts
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";

export async function getAdminSession(): Promise<Session | null> {
  const session = await auth();
  return session?.user?.isAdmin ? session : null;
}

export async function requireAdmin(): Promise<Session> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}
```

- [ ] **Step 2: Write the login page**

Create `app/admin/login/page.tsx`. Sign-in runs through a server action, so no client component is needed:

```tsx
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth";
import { getAdminSession } from "@/lib/auth-guard";

export const metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getAdminSession()) {
    redirect("/invoices");
  }

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8">
        <div className="space-y-2 text-center">
          <h1 className="font-heading text-2xl">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Restricted to a single account.
          </p>
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            That account is not authorised.
          </p>
        ) : null}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/invoices" });
          }}
        >
          <Button type="submit" className="w-full">
            Continue with Google
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the guarded admin layout**

Create `app/(admin)/layout.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth-guard";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container flex-1 py-10">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Add a placeholder dashboard page**

Create `app/(admin)/invoices/page.tsx` — Task 14 replaces this entirely:

```tsx
export default function InvoicesPage() {
  return <h1 className="font-heading text-3xl">Invoices</h1>;
}
```

- [ ] **Step 5: Add the footer link**

In `components/common/site-footer.tsx`, replace the `<footer>` body so the social row keeps its current layout and the admin link sits beneath it:

```tsx
  return (
    <footer className={cn(className)}>
      <div className="container flex items-center justify-center gap-8 mt-10 py-10 md:h-24">
        {SocialLinks.map((item, ind) => (
          <CustomTooltip icon={item.icon} text={item.username} key={ind}>
            <Link
              href={item.link}
              target="_blank"
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  size: "sm",
                }),
                "h-10 w-10 p-2"
              )}
            >
              <item.icon className="h-5 w-5" />
            </Link>
          </CustomTooltip>
        ))}
      </div>
      <div className="container flex items-center justify-center pb-8">
        <Link
          href="/admin/login"
          className="text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
        >
          Admin Login
        </Link>
      </div>
    </footer>
  );
```

- [ ] **Step 6: Manual verification — the whole auth loop**

Run: `npm run dev`

Verify each of these in the browser:

1. Any public page shows a dim "Admin Login" link at the bottom of the footer.
2. Clicking it lands on `/admin/login` with a "Continue with Google" button.
3. Visiting `/invoices` while signed out redirects to `/admin/login`.
4. Signing in with the allowlisted Gmail lands on `/invoices` and shows the placeholder heading.
5. Signing in with **any other** Google account is rejected and returns to `/admin/login`.
6. In Neon (`npm run db:studio`), the `user` table has exactly one row.

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add lib/auth-guard.ts app/admin app/\(admin\) components/common/site-footer.tsx
git commit -m "feat: guard admin routes and add footer admin login link"
```

---

## Task 6: Floating admin hotbar

**Files:**
- Create: `components/admin/admin-hotbar.tsx`
- Create: `components/admin/admin-hotbar-client.tsx`
- Modify: `app/(root)/layout.tsx`

**Interfaces:**
- Consumes: `getAdminSession()` (Task 5).
- Produces: `<AdminHotbar />` — an async server component rendering `null` for everyone except the signed-in admin.

- [ ] **Step 1: Write the server wrapper**

Create `components/admin/admin-hotbar.tsx`:

```tsx
import { getAdminSession } from "@/lib/auth-guard";

import { AdminHotbarClient } from "./admin-hotbar-client";

export async function AdminHotbar() {
  const session = await getAdminSession();
  if (!session) return null;

  return <AdminHotbarClient />;
}
```

- [ ] **Step 2: Write the client pill**

Create `components/admin/admin-hotbar-client.tsx`. `framer-motion` and `lucide-react` are already dependencies:

```tsx
"use client";

import { motion } from "framer-motion";
import { FilePlus2, LogOut, Receipt } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/invoices/new", label: "New invoice", icon: FilePlus2 },
];

export function AdminHotbarClient() {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
      className="fixed bottom-6 left-6 z-50"
      onHoverStart={() => setExpanded(true)}
      onHoverEnd={() => setExpanded(false)}
    >
      <div
        className={cn(
          "flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-1.5",
          "shadow-lg shadow-black/5 backdrop-blur-md",
          "supports-[backdrop-filter]:bg-background/60"
        )}
      >
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={cn(
              "group flex h-9 items-center gap-2 rounded-full px-2.5",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <motion.span
              initial={false}
              animate={{
                width: expanded ? "auto" : 0,
                opacity: expanded ? 1 : 0,
              }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap text-xs font-medium"
            >
              {label}
            </motion.span>
          </Link>
        ))}

        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />

        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            aria-label="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Render it on the public site**

In `app/(root)/layout.tsx`, add the import and render the hotbar inside the flex column, after `<SiteFooter />`:

```diff
+import { AdminHotbar } from "@/components/admin/admin-hotbar";
 import { MainNav } from "@/components/common/main-nav";
 import { ModeToggle } from "@/components/common/mode-toggle";
 import { SiteFooter } from "@/components/common/site-footer";
 import { routesConfig } from "@/config/routes";
```

```diff
       <main className="container flex-1">{children}</main>
       <SiteFooter />
+      <AdminHotbar />
     </div>
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`

1. Signed out, on `/` — **no** hotbar anywhere on the page.
2. Sign in as the admin, return to `/` — a pill appears bottom-left, floating up into place.
3. Hovering expands it to show "Invoices" and "New invoice" labels.
4. The receipt icon navigates to `/invoices`.
5. The sign-out button ends the session; the hotbar disappears on reload.
6. Toggle through several themes with the mode toggle — the pill's border, background and text stay legible in each.

- [ ] **Step 5: Commit**

```bash
git add components/admin app/\(root\)/layout.tsx
git commit -m "feat: add floating admin hotbar for the signed-in admin"
```

---

## Task 7: Money and invoice-number helpers

Pure functions, no I/O. These underpin every monetary value in the app, so they are tested first and hardest.

**Files:**
- Create: `lib/invoices/money.ts`
- Create: `lib/invoices/money.test.ts`
- Create: `lib/invoices/numbering.ts`
- Create: `lib/invoices/numbering.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `toMinor(major: string | number): number` — `"1234.56"` → `123456`. Throws on malformed input.
  - `toMajor(minor: number): number` — `123456` → `1234.56`.
  - `toMilli(qty: string | number): number` — `"7.5"` → `7500`. Throws on malformed input.
  - `fromMilli(milli: number): number` — `7500` → `7.5`.
  - `computeLineAmountMinor(quantityMilli: number, unitPriceMinor: number): number`
  - `formatMoney(minor: number, currency?: string, locale?: string): string`
  - `nextInvoiceNumber(existing: string[], year: number): string` — `"INV-2026-0007"`

- [ ] **Step 1: Write the failing money test**

Create `lib/invoices/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  computeLineAmountMinor,
  formatMoney,
  fromMilli,
  toMajor,
  toMilli,
  toMinor,
} from "./money";

describe("toMinor", () => {
  it("converts whole and fractional amounts", () => {
    expect(toMinor("1234.56")).toBe(123456);
    expect(toMinor("80")).toBe(8000);
    expect(toMinor("0.05")).toBe(5);
    expect(toMinor("0")).toBe(0);
  });

  it("pads a single decimal place", () => {
    expect(toMinor("12.5")).toBe(1250);
  });

  it("strips currency symbols, commas and whitespace", () => {
    expect(toMinor(" £1,234.56 ")).toBe(123456);
  });

  it("handles negatives", () => {
    expect(toMinor("-40.25")).toBe(-4025);
  });

  it("accepts numbers without float drift", () => {
    expect(toMinor(1234.56)).toBe(123456);
    expect(toMinor(0.29)).toBe(29);
    expect(toMinor(1.005)).toBe(101);
  });

  it("throws on malformed input", () => {
    expect(() => toMinor("abc")).toThrow(/valid money amount/);
    expect(() => toMinor("1.234")).toThrow(/valid money amount/);
    expect(() => toMinor("")).toThrow(/valid money amount/);
  });
});

describe("toMajor", () => {
  it("is the inverse of toMinor", () => {
    expect(toMajor(123456)).toBe(1234.56);
    expect(toMajor(5)).toBe(0.05);
    expect(toMajor(-4025)).toBe(-40.25);
  });
});

describe("toMilli / fromMilli", () => {
  it("converts quantities to thousandths", () => {
    expect(toMilli("7.5")).toBe(7500);
    expect(toMilli("1")).toBe(1000);
    expect(toMilli("0.125")).toBe(125);
    expect(toMilli(2.25)).toBe(2250);
  });

  it("round-trips", () => {
    expect(fromMilli(7500)).toBe(7.5);
    expect(fromMilli(1000)).toBe(1);
  });

  it("throws on more than three decimal places", () => {
    expect(() => toMilli("0.1234")).toThrow(/valid quantity/);
  });
});

describe("computeLineAmountMinor", () => {
  it("multiplies quantity by unit price", () => {
    // 7.5 hours at £80.00 = £600.00
    expect(computeLineAmountMinor(7500, 8000)).toBe(60000);
    // 1 unit at £1234.56
    expect(computeLineAmountMinor(1000, 123456)).toBe(123456);
  });

  it("rounds half up to the nearest penny", () => {
    // 0.333 units at £1.00 = £0.333 -> 33p
    expect(computeLineAmountMinor(333, 100)).toBe(33);
    // 0.335 units at £1.00 = £0.335 -> 34p
    expect(computeLineAmountMinor(335, 100)).toBe(34);
  });

  it("returns an integer for every input", () => {
    expect(Number.isInteger(computeLineAmountMinor(1234, 5678))).toBe(true);
  });
});

describe("formatMoney", () => {
  it("formats GBP in en-GB by default", () => {
    expect(formatMoney(123456)).toBe("£1,234.56");
    expect(formatMoney(0)).toBe("£0.00");
  });

  it("honours an explicit currency", () => {
    expect(formatMoney(123456, "USD", "en-US")).toBe("$1,234.56");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- lib/invoices/money.test.ts`
Expected: FAIL — `Cannot find module './money'`.

- [ ] **Step 3: Write the money helpers**

Create `lib/invoices/money.ts`:

```ts
const MONEY_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;
const QUANTITY_PATTERN = /^(-)?(\d+)(?:\.(\d{1,3}))?$/;

function clean(input: string): string {
  return input.trim().replace(/[,\s£$€]/g, "");
}

/** "1234.56" -> 123456. Parses as a string to avoid float drift. */
export function toMinor(major: string | number): number {
  const raw = typeof major === "number" ? major.toFixed(2) : major;
  const match = MONEY_PATTERN.exec(clean(raw));
  if (!match) {
    throw new Error(`Not a valid money amount: ${String(major)}`);
  }
  const [, sign, whole, frac = ""] = match;
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return sign ? -minor : minor;
}

/** 123456 -> 1234.56 */
export function toMajor(minor: number): number {
  return minor / 100;
}

/** "7.5" -> 7500. Quantities carry three decimal places. */
export function toMilli(quantity: string | number): number {
  const raw = typeof quantity === "number" ? quantity.toFixed(3) : quantity;
  const match = QUANTITY_PATTERN.exec(clean(raw));
  if (!match) {
    throw new Error(`Not a valid quantity: ${String(quantity)}`);
  }
  const [, sign, whole, frac = ""] = match;
  const milli = Number(whole) * 1000 + Number(frac.padEnd(3, "0"));
  return sign ? -milli : milli;
}

/** 7500 -> 7.5 */
export function fromMilli(milli: number): number {
  return milli / 1000;
}

/** amount = round(quantity x unit price), all in integer sub-units. */
export function computeLineAmountMinor(
  quantityMilli: number,
  unitPriceMinor: number
): number {
  return Math.round((quantityMilli * unitPriceMinor) / 1000);
}

export function formatMoney(
  minor: number,
  currency = "GBP",
  locale = "en-GB"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(toMajor(minor));
}
```

`toMilli` with a numeric input uses `toFixed(3)`, so `toMilli(0.1234)` rounds rather than throwing — only string input is validated strictly. The test only asserts the throw for the string form, which is what forms submit.

- [ ] **Step 4: Run the money tests**

Run: `npm test -- lib/invoices/money.test.ts`
Expected: PASS — 15 tests.

- [ ] **Step 5: Write the failing numbering test**

Create `lib/invoices/numbering.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { nextInvoiceNumber } from "./numbering";

describe("nextInvoiceNumber", () => {
  it("starts at 0001 when there are no invoices", () => {
    expect(nextInvoiceNumber([], 2026)).toBe("INV-2026-0001");
  });

  it("increments past the highest existing number for the year", () => {
    expect(
      nextInvoiceNumber(["INV-2026-0001", "INV-2026-0007", "INV-2026-0003"], 2026)
    ).toBe("INV-2026-0008");
  });

  it("ignores invoices from other years", () => {
    expect(
      nextInvoiceNumber(["INV-2025-0042", "INV-2026-0002"], 2026)
    ).toBe("INV-2026-0003");
  });

  it("restarts numbering in a new year", () => {
    expect(nextInvoiceNumber(["INV-2025-0042"], 2026)).toBe("INV-2026-0001");
  });

  it("ignores malformed numbers rather than throwing", () => {
    expect(
      nextInvoiceNumber(["INV-2026-abc", "", "INV-2026-0004"], 2026)
    ).toBe("INV-2026-0005");
  });

  it("keeps zero padding past four digits", () => {
    expect(nextInvoiceNumber(["INV-2026-9999"], 2026)).toBe("INV-2026-10000");
  });
});
```

- [ ] **Step 6: Run it to confirm it fails**

Run: `npm test -- lib/invoices/numbering.test.ts`
Expected: FAIL — `Cannot find module './numbering'`.

- [ ] **Step 7: Write the numbering helper**

Create `lib/invoices/numbering.ts`:

```ts
/** Sequential per calendar year: INV-2026-0001, INV-2026-0002, ... */
export function nextInvoiceNumber(existing: string[], year: number): string {
  const prefix = `INV-${year}-`;

  const highest = existing
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number.parseInt(number.slice(prefix.length), 10))
    .filter((sequence) => Number.isFinite(sequence))
    .reduce((max, sequence) => Math.max(max, sequence), 0);

  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}
```

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS — all tests across money, numbering, allowlist, schema and db.

- [ ] **Step 9: Commit**

```bash
git add lib/invoices/money.ts lib/invoices/money.test.ts lib/invoices/numbering.ts lib/invoices/numbering.test.ts
git commit -m "feat: add money and invoice numbering helpers"
```

---

## Task 8: Invoice types and repository

**Files:**
- Create: `lib/invoices/types.ts`
- Create: `lib/invoices/types.test.ts`
- Create: `lib/invoices/repository.ts`

**Interfaces:**
- Consumes: `getDb()` (Task 2); `invoices`, `invoiceLineItems`, `InvoiceStatus` (Task 3); `toMinor`, `toMilli`, `computeLineAmountMinor` (Task 7); `nextInvoiceNumber` (Task 7).
- Produces:
  - `invoiceFormSchema` — Zod schema for the create form; `InvoiceFormValues` its inferred type.
  - `toNewInvoiceRecords(values, { id, number }): { invoice, lineItems }` — pure translation from form values to DB rows.
  - `InvoiceWithLines = Invoice & { lineItems: InvoiceLineItem[] }`
  - `listInvoices(): Promise<InvoiceWithLines[]>` — all invoices, newest issue date first.
  - `getInvoice(id: string): Promise<InvoiceWithLines | null>`
  - `createInvoice(values: InvoiceFormValues): Promise<{ id: string; number: string }>`
  - `setInvoiceStatus(id: string, status: InvoiceStatus): Promise<void>`

- [ ] **Step 1: Write the failing types test**

Create `lib/invoices/types.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { invoiceFormSchema, toNewInvoiceRecords } from "./types";

const validValues = {
  clientName: "Acme Ltd",
  clientEmail: "sarah@acme.com",
  clientAddress: "1 High Street\nLondon",
  issueDate: "2026-09-01",
  dueDate: "2026-09-30",
  currency: "GBP",
  status: "draft" as const,
  notes: "Thanks!",
  lineItems: [
    { description: "Consulting", quantity: "7.5", unitPrice: "80.00" },
    { description: "Setup fee", quantity: "1", unitPrice: "250" },
  ],
};

describe("invoiceFormSchema", () => {
  it("accepts a well-formed invoice", () => {
    expect(invoiceFormSchema.safeParse(validValues).success).toBe(true);
  });

  it("rejects an invalid client email", () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      clientEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one line item", () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      lineItems: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a due date before the issue date", () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      issueDate: "2026-09-30",
      dueDate: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric unit price", () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      lineItems: [{ description: "x", quantity: "1", unitPrice: "free" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("toNewInvoiceRecords", () => {
  const records = toNewInvoiceRecords(validValues, {
    id: "11111111-1111-1111-1111-111111111111",
    number: "INV-2026-0007",
  });

  it("converts money to integer minor units", () => {
    // 7.5 x £80 = £600, plus £250 = £850
    expect(records.invoice.totalMinor).toBe(85000);
    expect(records.lineItems[0].amountMinor).toBe(60000);
    expect(records.lineItems[1].amountMinor).toBe(25000);
  });

  it("converts quantities to thousandths", () => {
    expect(records.lineItems[0].quantityMilli).toBe(7500);
    expect(records.lineItems[1].quantityMilli).toBe(1000);
  });

  it("stamps the id and number onto the invoice", () => {
    expect(records.invoice.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(records.invoice.number).toBe("INV-2026-0007");
  });

  it("links every line item to the invoice and preserves order", () => {
    expect(records.lineItems.map((l) => l.invoiceId)).toEqual([
      "11111111-1111-1111-1111-111111111111",
      "11111111-1111-1111-1111-111111111111",
    ]);
    expect(records.lineItems.map((l) => l.position)).toEqual([0, 1]);
  });

  it("makes the total the sum of the line amounts", () => {
    const sum = records.lineItems.reduce((acc, l) => acc + l.amountMinor, 0);
    expect(records.invoice.totalMinor).toBe(sum);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- lib/invoices/types.test.ts`
Expected: FAIL — `Cannot find module './types'`.

- [ ] **Step 3: Write the types and translation**

Create `lib/invoices/types.ts`:

```ts
import { z } from "zod";

import type {
  Invoice,
  InvoiceLineItem,
  NewInvoice,
  NewInvoiceLineItem,
} from "@/lib/db/schema";

import { computeLineAmountMinor, toMilli, toMinor } from "./money";

export type InvoiceWithLines = Invoice & { lineItems: InvoiceLineItem[] };

const moneyString = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((value) => {
    try {
      toMinor(value);
      return true;
    } catch {
      return false;
    }
  }, "Enter an amount like 1234.56");

const quantityString = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((value) => {
    try {
      return toMilli(value) > 0;
    } catch {
      return false;
    }
  }, "Enter a quantity like 7.5");

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Required").max(500),
  quantity: quantityString,
  unitPrice: moneyString,
});

export const invoiceFormSchema = z
  .object({
    clientName: z.string().trim().min(1, "Required").max(200),
    clientEmail: z.string().trim().email("Enter a valid email"),
    clientAddress: z.string().trim().max(1000).optional().or(z.literal("")),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    currency: z.string().trim().length(3).default("GBP"),
    status: z.enum(["draft", "sent", "paid", "overdue", "void"]).default("draft"),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
  })
  .refine((values) => values.dueDate >= values.issueDate, {
    message: "Due date cannot be before the issue date",
    path: ["dueDate"],
  });

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

/** Pure translation from validated form values to insertable rows. */
export function toNewInvoiceRecords(
  values: InvoiceFormValues,
  identity: { id: string; number: string }
): { invoice: NewInvoice; lineItems: NewInvoiceLineItem[] } {
  const lineItems: NewInvoiceLineItem[] = values.lineItems.map(
    (line, position) => {
      const quantityMilli = toMilli(line.quantity);
      const unitPriceMinor = toMinor(line.unitPrice);
      return {
        invoiceId: identity.id,
        position,
        description: line.description,
        quantityMilli,
        unitPriceMinor,
        amountMinor: computeLineAmountMinor(quantityMilli, unitPriceMinor),
      };
    }
  );

  const totalMinor = lineItems.reduce((sum, line) => sum + line.amountMinor, 0);

  return {
    invoice: {
      id: identity.id,
      number: identity.number,
      clientName: values.clientName,
      clientEmail: values.clientEmail,
      clientAddress: values.clientAddress || null,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      currency: values.currency,
      totalMinor,
      status: values.status,
      notes: values.notes || null,
    },
    lineItems,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- lib/invoices/types.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Write the repository**

Create `lib/invoices/repository.ts`. `createInvoice` batches both inserts into one transaction — the HTTP driver has no interactive transactions, but `db.batch()` runs its statements atomically:

```ts
import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import type { InvoiceStatus } from "@/lib/db/schema";
import { invoiceLineItems, invoices } from "@/lib/db/schema";

import { nextInvoiceNumber } from "./numbering";
import type { InvoiceFormValues, InvoiceWithLines } from "./types";
import { toNewInvoiceRecords } from "./types";

export async function listInvoices(): Promise<InvoiceWithLines[]> {
  return getDb().query.invoices.findMany({
    with: {
      lineItems: { orderBy: [asc(invoiceLineItems.position)] },
    },
    orderBy: [desc(invoices.issueDate), desc(invoices.createdAt)],
  });
}

export async function getInvoice(id: string): Promise<InvoiceWithLines | null> {
  const invoice = await getDb().query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: {
      lineItems: { orderBy: [asc(invoiceLineItems.position)] },
    },
  });
  return invoice ?? null;
}

export async function createInvoice(
  values: InvoiceFormValues
): Promise<{ id: string; number: string }> {
  const db = getDb();

  const year = Number(values.issueDate.slice(0, 4));
  const existing = await db
    .select({ number: invoices.number })
    .from(invoices);

  const number = nextInvoiceNumber(
    existing.map((row) => row.number),
    year
  );

  // The id is generated here rather than by the database so both inserts can be
  // built up front and sent as a single atomic batch.
  const id = crypto.randomUUID();
  const records = toNewInvoiceRecords(values, { id, number });

  await db.batch([
    db.insert(invoices).values(records.invoice),
    db.insert(invoiceLineItems).values(records.lineItems),
  ]);

  return { id, number };
}

export async function setInvoiceStatus(
  id: string,
  status: InvoiceStatus
): Promise<void> {
  await getDb()
    .update(invoices)
    .set({
      status,
      updatedAt: new Date(),
      paidAt: status === "paid" ? new Date() : null,
    })
    .where(eq(invoices.id, id));
}
```

- [ ] **Step 6: Install `server-only`**

```bash
npm i server-only
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. If `db.batch` is not found on the type, confirm `drizzle-orm` resolved to 0.45.2 — `batch` is exposed on the `neon-http` driver only.

- [ ] **Step 8: Verify a round trip against the real database**

Create a throwaway script `scripts/smoke-invoice.ts`:

```ts
import { createInvoice, getInvoice, listInvoices } from "@/lib/invoices/repository";

const created = await createInvoice({
  clientName: "Smoke Test Ltd",
  clientEmail: "smoke@example.com",
  clientAddress: null as unknown as string,
  issueDate: "2026-09-01",
  dueDate: "2026-09-30",
  currency: "GBP",
  status: "draft",
  notes: "",
  lineItems: [{ description: "Consulting", quantity: "7.5", unitPrice: "80.00" }],
});

console.log("created", created);
console.log("total", (await getInvoice(created.id))?.totalMinor);
console.log("count", (await listInvoices()).length);
```

Run: `npx dotenv -e .env -- npx tsx scripts/smoke-invoice.ts`
Expected: `created { id: ..., number: 'INV-2026-0001' }`, `total 60000`, `count 1`.

`server-only` will throw outside a React Server Component context — if it does, temporarily comment out the `import "server-only"` line for this check and restore it after.

- [ ] **Step 9: Clean up and commit**

```bash
rm scripts/smoke-invoice.ts
git add lib/invoices/types.ts lib/invoices/types.test.ts lib/invoices/repository.ts package.json package-lock.json
git commit -m "feat: add invoice validation schema and repository"
```

---

## Task 9: Dashboard aggregation

The analytical core. Entirely pure, so it is tested exhaustively here and the chart components stay dumb.

**Files:**
- Create: `lib/invoices/aggregate.ts`
- Create: `lib/invoices/aggregate.test.ts`

**Interfaces:**
- Consumes: `InvoiceWithLines` (Task 8); `toMajor` (Task 7).
- Produces:
  - `MetricKey = "billed" | "paid" | "outstanding" | "count" | "avgInvoice"`
  - `Granularity = "day" | "week" | "month"`
  - `DateRangeKey = "30d" | "90d" | "6m" | "12m" | "ytd" | "all"`
  - `SeriesPoint = { date: string; dateFormatted: string } & Record<MetricKey, number>` — money in **major** units, ready for the chart axis.
  - `resolveRange(key: DateRangeKey, today: Date): { from: string; to: string }`
  - `granularityFor(from: string, to: string): Granularity`
  - `buildTimeSeries(rows, opts): SeriesPoint[]`
  - `buildBreakdown(rows, dimension: BreakdownDimension): BreakdownRow[]` where `BreakdownRow = { key: string; label: string; billedMinor: number; count: number; share: number }`
  - `computeMetrics(rows): Record<MetricKey, { current: number; previous: number; change: number; trend: "up" | "down" | "neutral" }>` — takes current and previous row sets
  - `ytdBilledMinor(rows, year): number`
  - `YTD_THRESHOLD_MINOR = 1_250_000`

- [ ] **Step 1: Write the failing aggregation test**

Create `lib/invoices/aggregate.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  YTD_THRESHOLD_MINOR,
  buildBreakdown,
  buildTimeSeries,
  computeMetrics,
  granularityFor,
  resolveRange,
  ytdBilledMinor,
} from "./aggregate";
import type { AggregatableInvoice } from "./aggregate";

function invoice(
  partial: Partial<AggregatableInvoice> & Pick<AggregatableInvoice, "issueDate">
): AggregatableInvoice {
  return {
    id: partial.id ?? crypto.randomUUID(),
    number: partial.number ?? "INV-2026-0001",
    clientName: partial.clientName ?? "Acme Ltd",
    status: partial.status ?? "sent",
    issueDate: partial.issueDate,
    totalMinor: partial.totalMinor ?? 10000,
    currency: partial.currency ?? "GBP",
  };
}

describe("resolveRange", () => {
  const today = new Date("2026-09-01T12:00:00Z");

  it("resolves a rolling 30 day window", () => {
    expect(resolveRange("30d", today)).toEqual({
      from: "2026-08-03",
      to: "2026-09-01",
    });
  });

  it("resolves year to date from January 1st", () => {
    expect(resolveRange("ytd", today)).toEqual({
      from: "2026-01-01",
      to: "2026-09-01",
    });
  });

  it("resolves 'all' to a wide open window", () => {
    expect(resolveRange("all", today).from).toBe("1970-01-01");
    expect(resolveRange("all", today).to).toBe("2026-09-01");
  });
});

describe("granularityFor", () => {
  it("uses days for short ranges", () => {
    expect(granularityFor("2026-08-03", "2026-09-01")).toBe("day");
  });

  it("uses weeks for ranges up to a year", () => {
    expect(granularityFor("2026-01-01", "2026-09-01")).toBe("week");
  });

  it("uses months beyond a year", () => {
    expect(granularityFor("2023-01-01", "2026-09-01")).toBe("month");
  });
});

describe("buildTimeSeries", () => {
  const rows = [
    invoice({ issueDate: "2026-08-01", totalMinor: 100000, status: "paid" }),
    invoice({ issueDate: "2026-08-01", totalMinor: 50000, status: "sent" }),
    invoice({ issueDate: "2026-08-03", totalMinor: 20000, status: "overdue" }),
  ];

  it("buckets by day and returns money in major units", () => {
    const series = buildTimeSeries(rows, {
      from: "2026-08-01",
      to: "2026-08-03",
      granularity: "day",
    });

    expect(series).toHaveLength(3);
    expect(series[0]).toMatchObject({
      date: "2026-08-01",
      billed: 1500,
      paid: 1000,
      outstanding: 500,
      count: 2,
      avgInvoice: 750,
    });
  });

  it("emits empty buckets for days with no invoices", () => {
    const series = buildTimeSeries(rows, {
      from: "2026-08-01",
      to: "2026-08-03",
      granularity: "day",
    });
    expect(series[1]).toMatchObject({
      date: "2026-08-02",
      billed: 0,
      count: 0,
      avgInvoice: 0,
    });
  });

  it("counts overdue as outstanding", () => {
    const series = buildTimeSeries(rows, {
      from: "2026-08-03",
      to: "2026-08-03",
      granularity: "day",
    });
    expect(series[0].outstanding).toBe(200);
  });

  it("excludes invoices outside the window", () => {
    const series = buildTimeSeries(rows, {
      from: "2026-08-02",
      to: "2026-08-03",
      granularity: "day",
    });
    expect(series.reduce((sum, p) => sum + p.count, 0)).toBe(1);
  });

  it("buckets by month", () => {
    const series = buildTimeSeries(
      [
        invoice({ issueDate: "2026-07-15", totalMinor: 100000 }),
        invoice({ issueDate: "2026-08-01", totalMinor: 50000 }),
        invoice({ issueDate: "2026-08-28", totalMinor: 50000 }),
      ],
      { from: "2026-07-01", to: "2026-08-31", granularity: "month" }
    );
    expect(series.map((p) => p.date)).toEqual(["2026-07-01", "2026-08-01"]);
    expect(series[1].billed).toBe(1000);
  });

  it("never divides by zero when computing the average", () => {
    const series = buildTimeSeries([], {
      from: "2026-08-01",
      to: "2026-08-01",
      granularity: "day",
    });
    expect(series[0].avgInvoice).toBe(0);
  });
});

describe("buildBreakdown", () => {
  const rows = [
    invoice({ clientName: "Acme Ltd", totalMinor: 120000, issueDate: "2026-08-01" }),
    invoice({ clientName: "Acme Ltd", totalMinor: 40000, issueDate: "2026-08-02" }),
    invoice({ clientName: "Globex", totalMinor: 40000, issueDate: "2026-08-03" }),
  ];

  it("groups by client, sorted by amount descending", () => {
    const breakdown = buildBreakdown(rows, "client");
    expect(breakdown.map((b) => b.label)).toEqual(["Acme Ltd", "Globex"]);
    expect(breakdown[0].billedMinor).toBe(160000);
    expect(breakdown[0].count).toBe(2);
  });

  it("computes each row's share of the total", () => {
    const breakdown = buildBreakdown(rows, "client");
    expect(breakdown[0].share).toBeCloseTo(0.8);
    expect(breakdown[1].share).toBeCloseTo(0.2);
  });

  it("groups by status", () => {
    const breakdown = buildBreakdown(
      [
        invoice({ status: "paid", totalMinor: 10000, issueDate: "2026-08-01" }),
        invoice({ status: "sent", totalMinor: 30000, issueDate: "2026-08-01" }),
      ],
      "status"
    );
    expect(breakdown.map((b) => b.key)).toEqual(["sent", "paid"]);
  });

  it("groups by month", () => {
    const breakdown = buildBreakdown(
      [
        invoice({ issueDate: "2026-07-01", totalMinor: 10000 }),
        invoice({ issueDate: "2026-08-01", totalMinor: 30000 }),
      ],
      "month"
    );
    expect(breakdown[0].key).toBe("2026-08");
  });

  it("returns an empty array with no rows", () => {
    expect(buildBreakdown([], "client")).toEqual([]);
  });
});

describe("computeMetrics", () => {
  const current = [
    invoice({ issueDate: "2026-08-01", totalMinor: 100000, status: "paid" }),
    invoice({ issueDate: "2026-08-02", totalMinor: 100000, status: "sent" }),
  ];
  const previous = [
    invoice({ issueDate: "2026-07-01", totalMinor: 100000, status: "paid" }),
  ];

  it("computes current values in major units", () => {
    const metrics = computeMetrics(current, previous);
    expect(metrics.billed.current).toBe(2000);
    expect(metrics.paid.current).toBe(1000);
    expect(metrics.outstanding.current).toBe(1000);
    expect(metrics.count.current).toBe(2);
    expect(metrics.avgInvoice.current).toBe(1000);
  });

  it("computes percentage change against the previous period", () => {
    const metrics = computeMetrics(current, previous);
    expect(metrics.billed.previous).toBe(1000);
    expect(metrics.billed.change).toBeCloseTo(100);
    expect(metrics.billed.trend).toBe("up");
  });

  it("reports a neutral trend when the previous period is empty", () => {
    const metrics = computeMetrics(current, []);
    expect(metrics.billed.change).toBe(0);
    expect(metrics.billed.trend).toBe("neutral");
  });

  it("reports a downward trend when billing falls", () => {
    const metrics = computeMetrics(previous, current);
    expect(metrics.billed.trend).toBe("down");
  });
});

describe("ytdBilledMinor", () => {
  it("sums only the given calendar year", () => {
    const rows = [
      invoice({ issueDate: "2025-12-31", totalMinor: 500000 }),
      invoice({ issueDate: "2026-01-01", totalMinor: 300000 }),
      invoice({ issueDate: "2026-08-01", totalMinor: 200000 }),
    ];
    expect(ytdBilledMinor(rows, 2026)).toBe(500000);
  });

  it("excludes voided invoices", () => {
    const rows = [
      invoice({ issueDate: "2026-01-01", totalMinor: 300000 }),
      invoice({ issueDate: "2026-02-01", totalMinor: 100000, status: "void" }),
    ];
    expect(ytdBilledMinor(rows, 2026)).toBe(300000);
  });

  it("exposes the reporting threshold as 12,500 in minor units", () => {
    expect(YTD_THRESHOLD_MINOR).toBe(1250000);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- lib/invoices/aggregate.test.ts`
Expected: FAIL — `Cannot find module './aggregate'`.

- [ ] **Step 3: Write the aggregation module**

Create `lib/invoices/aggregate.ts`:

```ts
import type { InvoiceStatus } from "@/lib/db/schema";

import { toMajor } from "./money";

export const YTD_THRESHOLD_MINOR = 1_250_000; // £12,500

export type MetricKey =
  | "billed"
  | "paid"
  | "outstanding"
  | "count"
  | "avgInvoice";

export type Granularity = "day" | "week" | "month";
export type DateRangeKey = "30d" | "90d" | "6m" | "12m" | "ytd" | "all";
export type BreakdownDimension = "client" | "status" | "month";

/** The minimum shape the dashboard needs — line items are irrelevant here. */
export type AggregatableInvoice = {
  id: string;
  number: string;
  clientName: string;
  status: InvoiceStatus;
  issueDate: string; // YYYY-MM-DD
  totalMinor: number;
  currency: string;
};

export type SeriesPoint = { date: string; dateFormatted: string } & Record<
  MetricKey,
  number
>;

export type BreakdownRow = {
  key: string;
  label: string;
  billedMinor: number;
  count: number;
  share: number;
};

export type MetricData = {
  current: number;
  previous: number;
  change: number;
  trend: "up" | "down" | "neutral";
};

const OUTSTANDING_STATUSES: InvoiceStatus[] = ["sent", "overdue"];

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export function resolveRange(
  key: DateRangeKey,
  today: Date
): { from: string; to: string } {
  const to = iso(today);

  switch (key) {
    case "30d":
      return { from: iso(addDays(today, -29)), to };
    case "90d":
      return { from: iso(addDays(today, -89)), to };
    case "6m":
      return { from: iso(addMonths(today, -6)), to };
    case "12m":
      return { from: iso(addMonths(today, -12)), to };
    case "ytd":
      return { from: `${today.getUTCFullYear()}-01-01`, to };
    case "all":
      return { from: "1970-01-01", to };
  }
}

export function granularityFor(from: string, to: string): Granularity {
  const days =
    (Date.parse(to) - Date.parse(from)) / (1000 * 60 * 60 * 24);
  if (days <= 90) return "day";
  if (days <= 366) return "week";
  return "month";
}

/** The bucket start date an invoice falls into, as YYYY-MM-DD. */
function bucketStart(dateIso: string, granularity: Granularity): string {
  const date = new Date(`${dateIso}T00:00:00Z`);

  if (granularity === "month") {
    return `${dateIso.slice(0, 7)}-01`;
  }

  if (granularity === "week") {
    // Snap back to Monday.
    const day = date.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    return iso(addDays(date, offset));
  }

  return dateIso;
}

function bucketSequence(
  from: string,
  to: string,
  granularity: Granularity
): string[] {
  const buckets: string[] = [];
  let cursor = bucketStart(from, granularity);
  const last = bucketStart(to, granularity);

  while (cursor <= last) {
    buckets.push(cursor);
    const date = new Date(`${cursor}T00:00:00Z`);
    cursor =
      granularity === "day"
        ? iso(addDays(date, 1))
        : granularity === "week"
          ? iso(addDays(date, 7))
          : iso(addMonths(date, 1));
  }

  return buckets;
}

function formatBucket(bucket: string, granularity: Granularity): string {
  const date = new Date(`${bucket}T00:00:00Z`);
  if (granularity === "month") {
    return date.toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function buildTimeSeries(
  rows: AggregatableInvoice[],
  options: { from: string; to: string; granularity: Granularity }
): SeriesPoint[] {
  const { from, to, granularity } = options;

  const inWindow = rows.filter(
    (row) => row.issueDate >= from && row.issueDate <= to
  );

  const grouped = new Map<string, AggregatableInvoice[]>();
  for (const row of inWindow) {
    const bucket = bucketStart(row.issueDate, granularity);
    const existing = grouped.get(bucket);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(bucket, [row]);
    }
  }

  return bucketSequence(from, to, granularity).map((bucket) => {
    const bucketRows = grouped.get(bucket) ?? [];

    const billedMinor = bucketRows.reduce((sum, r) => sum + r.totalMinor, 0);
    const paidMinor = bucketRows
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + r.totalMinor, 0);
    const outstandingMinor = bucketRows
      .filter((r) => OUTSTANDING_STATUSES.includes(r.status))
      .reduce((sum, r) => sum + r.totalMinor, 0);
    const count = bucketRows.length;

    return {
      date: bucket,
      dateFormatted: formatBucket(bucket, granularity),
      billed: toMajor(billedMinor),
      paid: toMajor(paidMinor),
      outstanding: toMajor(outstandingMinor),
      count,
      avgInvoice: count === 0 ? 0 : toMajor(Math.round(billedMinor / count)),
    };
  });
}

export function buildBreakdown(
  rows: AggregatableInvoice[],
  dimension: BreakdownDimension
): BreakdownRow[] {
  if (rows.length === 0) return [];

  const keyOf = (row: AggregatableInvoice): string => {
    if (dimension === "client") return row.clientName;
    if (dimension === "status") return row.status;
    return row.issueDate.slice(0, 7);
  };

  const grouped = new Map<string, { billedMinor: number; count: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const entry = grouped.get(key) ?? { billedMinor: 0, count: 0 };
    entry.billedMinor += row.totalMinor;
    entry.count += 1;
    grouped.set(key, entry);
  }

  const total = rows.reduce((sum, row) => sum + row.totalMinor, 0);

  return [...grouped.entries()]
    .map(([key, entry]) => ({
      key,
      label: dimension === "status" ? key[0].toUpperCase() + key.slice(1) : key,
      billedMinor: entry.billedMinor,
      count: entry.count,
      share: total === 0 ? 0 : entry.billedMinor / total,
    }))
    .sort((a, b) => b.billedMinor - a.billedMinor || a.key.localeCompare(b.key));
}

function metric(current: number, previous: number): MetricData {
  const change = previous === 0 ? 0 : ((current - previous) / previous) * 100;
  return {
    current,
    previous,
    change,
    trend: change > 0 ? "up" : change < 0 ? "down" : "neutral",
  };
}

function totals(rows: AggregatableInvoice[]) {
  const billedMinor = rows.reduce((sum, r) => sum + r.totalMinor, 0);
  const paidMinor = rows
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + r.totalMinor, 0);
  const outstandingMinor = rows
    .filter((r) => OUTSTANDING_STATUSES.includes(r.status))
    .reduce((sum, r) => sum + r.totalMinor, 0);

  return {
    billed: toMajor(billedMinor),
    paid: toMajor(paidMinor),
    outstanding: toMajor(outstandingMinor),
    count: rows.length,
    avgInvoice:
      rows.length === 0 ? 0 : toMajor(Math.round(billedMinor / rows.length)),
  };
}

export function computeMetrics(
  current: AggregatableInvoice[],
  previous: AggregatableInvoice[]
): Record<MetricKey, MetricData> {
  const now = totals(current);
  const before = totals(previous);

  return {
    billed: metric(now.billed, before.billed),
    paid: metric(now.paid, before.paid),
    outstanding: metric(now.outstanding, before.outstanding),
    count: metric(now.count, before.count),
    avgInvoice: metric(now.avgInvoice, before.avgInvoice),
  };
}

export function ytdBilledMinor(
  rows: AggregatableInvoice[],
  year: number
): number {
  const prefix = String(year);
  return rows
    .filter(
      (row) => row.issueDate.startsWith(prefix) && row.status !== "void"
    )
    .reduce((sum, row) => sum + row.totalMinor, 0);
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- lib/invoices/aggregate.test.ts`
Expected: PASS — 22 tests.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: all green.

```bash
git add lib/invoices/aggregate.ts lib/invoices/aggregate.test.ts
git commit -m "feat: add invoice dashboard aggregation"
```

---

## Task 10: Metric registry and cards

Ports ADZAP's `METRIC_CONFIGS` registry and `MetricCard`, swapping its hardcoded warm-neutral hex values for this site's theme tokens.

**Files:**
- Create: `components/invoices/metric-configs.ts`
- Create: `components/invoices/metric-card.tsx`
- Create: `components/invoices/ytd-threshold-card.tsx`
- Modify: `package.json` (install recharts)

**Interfaces:**
- Consumes: `MetricKey`, `MetricData`, `YTD_THRESHOLD_MINOR` (Task 9); `formatMoney`, `toMajor` (Task 7).
- Produces:
  - `METRIC_CONFIGS: Record<MetricKey, MetricConfig>` where `MetricConfig = { color: string; name: string; icon: LucideIcon; description: string; yAxis: "left" | "right"; format: (value: number) => string }`
  - `<MetricCard title metric formatValue? size? />`
  - `<YtdThresholdCard billedMinor year />`

- [ ] **Step 1: Install recharts**

```bash
npm i recharts@^3.10.1
```

- [ ] **Step 2: Write the metric registry**

Create `components/invoices/metric-configs.ts`. Colours are explicit hex because recharts strokes cannot be Tailwind classes — but they are chosen to read on both light and dark backgrounds:

```ts
import {
  Banknote,
  CircleDollarSign,
  Clock,
  FileText,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import type { MetricKey } from "@/lib/invoices/aggregate";

export type MetricConfig = {
  color: string;
  name: string;
  icon: LucideIcon;
  description: string;
  yAxis: "left" | "right";
  kind: "money" | "count";
};

export const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  billed: {
    color: "#0EA5E9",
    name: "Billed",
    icon: Banknote,
    description: "Total value of invoices issued",
    yAxis: "left",
    kind: "money",
  },
  paid: {
    color: "#10B981",
    name: "Paid",
    icon: CircleDollarSign,
    description: "Value of invoices marked paid",
    yAxis: "left",
    kind: "money",
  },
  outstanding: {
    color: "#F59E0B",
    name: "Outstanding",
    icon: Clock,
    description: "Sent or overdue and not yet paid",
    yAxis: "left",
    kind: "money",
  },
  count: {
    color: "#8B5CF6",
    name: "Invoices",
    icon: FileText,
    description: "Number of invoices issued",
    yAxis: "right",
    kind: "count",
  },
  avgInvoice: {
    color: "#F43F5E",
    name: "Avg invoice",
    icon: TrendingUp,
    description: "Mean invoice value",
    yAxis: "right",
    kind: "money",
  },
};

export const DEFAULT_VISIBLE_METRICS: MetricKey[] = [
  "billed",
  "paid",
  "outstanding",
];
```

- [ ] **Step 3: Write the metric card**

Create `components/invoices/metric-card.tsx`:

```tsx
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

import type { MetricData } from "@/lib/invoices/aggregate";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  metric: MetricData;
  icon?: LucideIcon;
  accentColor?: string;
  formatValue?: (value: number) => string;
  size?: "primary" | "secondary";
  className?: string;
}

export function MetricCard({
  title,
  metric,
  icon: Icon,
  accentColor,
  formatValue = (value) => value.toLocaleString("en-GB"),
  size = "secondary",
  className,
}: MetricCardProps) {
  const isPrimary = size === "primary";
  const hasComparison = metric.previous !== 0;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
        {Icon ? (
          <Icon
            className="h-3.5 w-3.5"
            style={accentColor ? { color: accentColor } : undefined}
            aria-hidden
          />
        ) : null}
        {title}
      </span>

      <div
        className={cn(
          "font-semibold leading-none tracking-tight text-foreground",
          isPrimary ? "text-3xl" : "text-xl"
        )}
      >
        {formatValue(metric.current)}
      </div>

      {hasComparison ? (
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className={cn(
              "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold",
              metric.trend === "up" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              metric.trend === "down" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
              metric.trend === "neutral" && "bg-muted text-muted-foreground"
            )}
          >
            {metric.trend === "up" ? (
              <ArrowUp className="h-3 w-3" aria-hidden />
            ) : metric.trend === "down" ? (
              <ArrowDown className="h-3 w-3" aria-hidden />
            ) : null}
            {`${metric.change > 0 ? "+" : ""}${metric.change.toFixed(1)}%`}
          </span>
          <span className="text-xs text-muted-foreground">
            vs previous period
          </span>
        </div>
      ) : (
        <span className="mt-0.5 text-xs text-muted-foreground">
          No prior period
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the YTD threshold card**

Create `components/invoices/ytd-threshold-card.tsx`. This is the £12,500 personal reporting tracker that replaces per-invoice tax handling:

```tsx
import { AlertTriangle, Landmark } from "lucide-react";

import { YTD_THRESHOLD_MINOR } from "@/lib/invoices/aggregate";
import { formatMoney } from "@/lib/invoices/money";
import { cn } from "@/lib/utils";

interface YtdThresholdCardProps {
  billedMinor: number;
  year: number;
  className?: string;
}

export function YtdThresholdCard({
  billedMinor,
  year,
  className,
}: YtdThresholdCardProps) {
  const ratio = billedMinor / YTD_THRESHOLD_MINOR;
  const percent = Math.min(ratio, 1) * 100;
  const crossed = billedMinor >= YTD_THRESHOLD_MINOR;
  const approaching = !crossed && ratio >= 0.8;
  const remaining = YTD_THRESHOLD_MINOR - billedMinor;

  return (
    <div className={cn("rounded-lg border bg-card p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <Landmark className="h-3.5 w-3.5" aria-hidden />
            {`${year} billed to date`}
          </span>
          <div className="text-3xl font-semibold leading-none tracking-tight">
            {formatMoney(billedMinor)}
          </div>
        </div>

        {crossed || approaching ? (
          <span
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold",
              crossed
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {crossed ? "Threshold crossed" : "Approaching"}
          </span>
        ) : null}
      </div>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress toward the ${formatMoney(YTD_THRESHOLD_MINOR)} reporting threshold`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            crossed
              ? "bg-rose-500"
              : approaching
                ? "bg-amber-500"
                : "bg-emerald-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {crossed
          ? `${formatMoney(billedMinor - YTD_THRESHOLD_MINOR)} over the ${formatMoney(YTD_THRESHOLD_MINOR)} reporting threshold.`
          : `${formatMoney(remaining)} remaining before the ${formatMoney(YTD_THRESHOLD_MINOR)} reporting threshold.`}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add components/invoices package.json package-lock.json
git commit -m "feat: add invoice metric registry, metric card and ytd threshold card"
```

---

## Task 11: Revenue line chart

Ports ADZAP's `CustomChart`: recharts `LineChart`, dual Y axes, clickable legend, grid and data-point toggles, custom tooltip.

**Files:**
- Create: `components/invoices/chart-tooltip.tsx`
- Create: `components/invoices/revenue-chart.tsx`

**Interfaces:**
- Consumes: `SeriesPoint`, `MetricKey` (Task 9); `METRIC_CONFIGS` (Task 10); `formatMoney`, `toMinor` (Task 7).
- Produces:
  - `<RevenueChart data visibleMetrics onToggleMetric showGrid onToggleGrid showDataPoints onToggleDataPoints currency />`
  - `<ChartTooltip />` — recharts `content` component.

- [ ] **Step 1: Write the tooltip**

Create `components/invoices/chart-tooltip.tsx`:

```tsx
"use client";

import type { TooltipProps } from "recharts";

import { METRIC_CONFIGS } from "@/components/invoices/metric-configs";
import type { MetricKey } from "@/lib/invoices/aggregate";
import { formatMoney } from "@/lib/invoices/money";

function formatMetric(key: MetricKey, value: number, currency: string): string {
  return METRIC_CONFIGS[key].kind === "money"
    ? formatMoney(Math.round(value * 100), currency)
    : value.toLocaleString("en-GB");
}

export function ChartTooltip({
  active,
  payload,
  label,
  currency = "GBP",
}: TooltipProps<number, string> & { currency?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 shadow-md">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="space-y-1">
        {payload.map((entry) => {
          const key = String(entry.dataKey) as MetricKey;
          const config = METRIC_CONFIGS[key];
          if (!config) return null;

          return (
            <li
              key={key}
              className="flex items-center justify-between gap-6 text-xs"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                  aria-hidden
                />
                <span className="text-muted-foreground">{config.name}</span>
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatMetric(key, Number(entry.value ?? 0), currency)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Write the chart**

Create `components/invoices/revenue-chart.tsx`:

```tsx
"use client";

import * as React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/invoices/chart-tooltip";
import { METRIC_CONFIGS } from "@/components/invoices/metric-configs";
import { Button } from "@/components/ui/button";
import type { MetricKey, SeriesPoint } from "@/lib/invoices/aggregate";

const AXIS_TICK = {
  fontSize: 10,
  fill: "hsl(var(--muted-foreground))",
  fontWeight: 400,
};

const AXIS_LINE = { stroke: "hsl(var(--border))", strokeWidth: 0.5 };

function compact(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
}

interface RevenueChartProps {
  data: SeriesPoint[];
  visibleMetrics: MetricKey[];
  onToggleMetric: (metric: MetricKey) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showDataPoints: boolean;
  onToggleDataPoints: () => void;
  currency?: string;
}

export function RevenueChart({
  data,
  visibleMetrics,
  onToggleMetric,
  showGrid,
  onToggleGrid,
  showDataPoints,
  onToggleDataPoints,
  currency = "GBP",
}: RevenueChartProps) {
  const keys = Object.keys(METRIC_CONFIGS) as MetricKey[];

  const hasLeft = keys.some(
    (key) => visibleMetrics.includes(key) && METRIC_CONFIGS[key].yAxis === "left"
  );
  const hasRight = keys.some(
    (key) =>
      visibleMetrics.includes(key) && METRIC_CONFIGS[key].yAxis === "right"
  );

  const lines = React.useMemo(
    () =>
      keys.map((key) => {
        const config = METRIC_CONFIGS[key];
        return (
          <Line
            key={key}
            yAxisId={config.yAxis}
            type="monotone"
            dataKey={key}
            stroke={config.color}
            strokeWidth={1.75}
            dot={
              showDataPoints
                ? { fill: config.color, strokeWidth: 1, r: 1.5 }
                : false
            }
            activeDot={
              showDataPoints
                ? { r: 3, stroke: config.color, strokeWidth: 1 }
                : false
            }
            name={config.name}
            hide={!visibleMetrics.includes(key)}
          />
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleMetrics, showDataPoints]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant={showGrid ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={onToggleGrid}
        >
          Grid
        </Button>
        <Button
          type="button"
          variant={showDataPoints ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={onToggleDataPoints}
        >
          Points
        </Button>
      </div>

      <div className="h-[280px] w-full sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
          >
            {showGrid ? (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.6}
                strokeWidth={0.5}
              />
            ) : null}

            <XAxis
              dataKey="dateFormatted"
              tick={AXIS_TICK}
              height={30}
              interval="preserveStartEnd"
              axisLine={AXIS_LINE}
              tickLine={AXIS_LINE}
            />

            {hasLeft ? (
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={AXIS_TICK}
                width={44}
                axisLine={AXIS_LINE}
                tickLine={AXIS_LINE}
                tickFormatter={compact}
              />
            ) : null}

            {hasRight ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={AXIS_TICK}
                width={40}
                axisLine={AXIS_LINE}
                tickLine={AXIS_LINE}
                tickFormatter={compact}
              />
            ) : null}

            <Tooltip
              content={<ChartTooltip currency={currency} />}
              cursor={{
                stroke: "hsl(var(--border))",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
            />

            <Legend
              // Payload shape is read defensively: recharts v3 changed parts of
              // this signature versus the v2 reference implementation.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={(entry: any) => {
                const dataKey = entry?.dataKey;
                if (dataKey) onToggleMetric(String(dataKey) as MetricKey);
              }}
              wrapperStyle={{ cursor: "pointer", paddingTop: 16, fontSize: 12 }}
              iconSize={10}
            />

            {lines}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

Both `YAxis` elements are conditional. If every visible metric sits on one axis the other is not rendered — but each `Line` still references its own `yAxisId`, and recharts tolerates a hidden line pointing at an absent axis because `hide` short-circuits the render.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. If recharts' `TooltipProps` generic signature has changed in v3, widen the tooltip props to `any` rather than fighting the types — the runtime shape is what matters.

- [ ] **Step 4: Commit**

```bash
git add components/invoices/revenue-chart.tsx components/invoices/chart-tooltip.tsx
git commit -m "feat: add recharts revenue line chart"
```

Manual verification of legend toggling happens in Task 14, once the chart has real data behind it.

---

## Task 12: Breakdown chart and dashboard filters

**Files:**
- Create: `components/invoices/breakdown-chart.tsx`
- Create: `components/invoices/dashboard-filters.tsx`

**Interfaces:**
- Consumes: `BreakdownRow`, `BreakdownDimension`, `DateRangeKey` (Task 9); `formatMoney` (Task 7).
- Produces:
  - `<BreakdownChart rows currency />` — horizontal bars, share-weighted widths.
  - `<DashboardFilters range onRangeChange dimension onDimensionChange />`
  - `RANGE_OPTIONS: { value: DateRangeKey; label: string }[]`

- [ ] **Step 1: Write the breakdown chart**

Create `components/invoices/breakdown-chart.tsx`. Plain CSS bars rather than recharts — with at most a handful of clients, a bar list is more legible than a chart and stays theme-token clean:

```tsx
import type { BreakdownRow } from "@/lib/invoices/aggregate";
import { formatMoney } from "@/lib/invoices/money";

interface BreakdownChartProps {
  rows: BreakdownRow[];
  currency?: string;
}

export function BreakdownChart({ rows, currency = "GBP" }: BreakdownChartProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No invoices in this period.
      </p>
    );
  }

  const max = rows[0].billedMinor || 1;

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="truncate font-medium">{row.label}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">
                {formatMoney(row.billedMinor, currency)}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {`${(row.share * 100).toFixed(0)}% · ${row.count} ${
                  row.count === 1 ? "invoice" : "invoices"
                }`}
              </span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(row.billedMinor / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Write the filters**

Create `components/invoices/dashboard-filters.tsx`. Uses native `<select>` — the repo has no shadcn `Select` primitive installed, and adding `@radix-ui/react-select` for two dropdowns is not worth the dependency:

```tsx
"use client";

import type {
  BreakdownDimension,
  DateRangeKey,
} from "@/lib/invoices/aggregate";
import { cn } from "@/lib/utils";

export const RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
];

const DIMENSION_OPTIONS: { value: BreakdownDimension; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "status", label: "Status" },
  { value: "month", label: "Month" },
];

const selectClass = cn(
  "h-9 rounded-md border border-input bg-background px-3 text-sm",
  "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
);

interface DashboardFiltersProps {
  range: DateRangeKey;
  onRangeChange: (range: DateRangeKey) => void;
  dimension: BreakdownDimension;
  onDimensionChange: (dimension: BreakdownDimension) => void;
}

export function DashboardFilters({
  range,
  onRangeChange,
  dimension,
  onDimensionChange,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Period
        <select
          className={selectClass}
          value={range}
          onChange={(event) =>
            onRangeChange(event.target.value as DateRangeKey)
          }
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Break down by
        <select
          className={selectClass}
          value={dimension}
          onChange={(event) =>
            onDimensionChange(event.target.value as BreakdownDimension)
          }
        >
          {DIMENSION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add components/invoices/breakdown-chart.tsx components/invoices/dashboard-filters.tsx
git commit -m "feat: add breakdown chart and dashboard filters"
```

---

## Task 13: Invoice creation form

**Files:**
- Create: `lib/invoices/actions.ts`
- Create: `components/invoices/invoice-form.tsx`
- Create: `app/(admin)/invoices/new/page.tsx`

**Interfaces:**
- Consumes: `invoiceFormSchema`, `InvoiceFormValues`, `createInvoice`, `setInvoiceStatus` (Task 8); `requireAdmin` (Task 5); `computeLineAmountMinor`, `toMilli`, `toMinor`, `formatMoney` (Task 7).
- Produces:
  - `createInvoiceAction(values: InvoiceFormValues): Promise<{ ok: true; id: string } | { ok: false; error: string }>`
  - `setInvoiceStatusAction(id: string, status: InvoiceStatus): Promise<void>`
  - `<InvoiceForm />`

- [ ] **Step 1: Write the server actions**

Create `lib/invoices/actions.ts`. Every action re-checks admin access — a server action is a public HTTP endpoint, and the layout guard does not protect it:

```ts
"use server";

import { revalidatePath } from "next/cache";

import type { InvoiceStatus } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-guard";

import { createInvoice, setInvoiceStatus } from "./repository";
import type { InvoiceFormValues } from "./types";
import { invoiceFormSchema } from "./types";

export async function createInvoiceAction(
  values: InvoiceFormValues
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireAdmin();

  const parsed = invoiceFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid invoice" };
  }

  try {
    const { id } = await createInvoice(parsed.data);
    revalidatePath("/invoices");
    return { ok: true, id };
  } catch (error) {
    console.error("createInvoiceAction failed", error);
    return { ok: false, error: "Could not save the invoice. Please try again." };
  }
}

export async function setInvoiceStatusAction(
  id: string,
  status: InvoiceStatus
): Promise<void> {
  await requireAdmin();
  await setInvoiceStatus(id, status);
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
}
```

- [ ] **Step 2: Write the form**

Create `components/invoices/invoice-form.tsx`. `react-hook-form`, `@hookform/resolvers` and the `components/ui/form` primitives are all already installed:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { createInvoiceAction } from "@/lib/invoices/actions";
import {
  computeLineAmountMinor,
  formatMoney,
  toMilli,
  toMinor,
} from "@/lib/invoices/money";
import type { InvoiceFormValues } from "@/lib/invoices/types";
import { invoiceFormSchema } from "@/lib/invoices/types";

function safeLineTotal(quantity: string, unitPrice: string): number {
  try {
    return computeLineAmountMinor(toMilli(quantity), toMinor(unitPrice));
  } catch {
    return 0;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function InvoiceForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientAddress: "",
      issueDate: today(),
      dueDate: inDays(30),
      currency: "GBP",
      status: "draft",
      notes: "",
      lineItems: [{ description: "", quantity: "1", unitPrice: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const watchedLines = form.watch("lineItems");
  const total = watchedLines.reduce(
    (sum, line) => sum + safeLineTotal(line.quantity, line.unitPrice),
    0
  );

  async function onSubmit(values: InvoiceFormValues) {
    setSubmitting(true);
    const result = await createInvoiceAction(values);
    setSubmitting(false);

    if (!result.ok) {
      toast({
        title: "Could not save invoice",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Invoice saved" });
    router.push(`/invoices/${result.id}`);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="clientName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Ltd" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clientEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="sarah@acme.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clientAddress"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Client address</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="Optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="issueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg">Line items</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({ description: "", quantity: "1", unitPrice: "" })
              }
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Add line
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((item, index) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_100px_120px_110px_40px] sm:items-end"
              >
                <FormField
                  control={form.control}
                  name={`lineItems.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Consulting" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`lineItems.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Qty</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" placeholder="7.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`lineItems.${index}.unitPrice`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Unit price</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" placeholder="80.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pb-2 text-right text-sm font-semibold tabular-nums">
                  {formatMoney(
                    safeLineTotal(
                      watchedLines[index]?.quantity ?? "0",
                      watchedLines[index]?.unitPrice ?? "0"
                    )
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-1 h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-baseline justify-end gap-4 border-t pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-semibold tabular-nums">
              {formatMoney(total)}
            </span>
          </div>
        </section>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Payment terms, bank details, thanks…"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/invoices")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Create invoice"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

- [ ] **Step 3: Write the page**

Create `app/(admin)/invoices/new/page.tsx`:

```tsx
import Link from "next/link";

import { InvoiceForm } from "@/components/invoices/invoice-form";

export const metadata = { title: "New invoice" };

export default function NewInvoicePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-1">
        <Link
          href="/invoices"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to dashboard
        </Link>
        <h1 className="font-heading text-3xl">New invoice</h1>
      </div>

      <InvoiceForm />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, sign in, go to `/invoices/new`.

1. The form opens with today's date and a due date 30 days out.
2. Typing `7.5` qty and `80.00` unit price shows `£600.00` on that line and in the total.
3. "Add line" appends a row; the trash button removes it and is disabled when only one line remains.
4. Submitting with an empty client name shows a field error and does not save.
5. Submitting a due date before the issue date shows an error on the due date field.
6. A valid submit shows a "Invoice saved" toast and navigates to `/invoices/<id>` (a 404 for now — Task 17 builds that page).
7. In `npm run db:studio`, the new `invoices` row has `total_minor = 60000` and one `invoice_line_items` row.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit && npm test`
Expected: exit 0, all tests pass.

```bash
git add lib/invoices/actions.ts components/invoices/invoice-form.tsx app/\(admin\)/invoices/new
git commit -m "feat: add invoice creation form and server actions"
```

---

## Task 14: Invoice table and dashboard assembly

Brings Tasks 9–12 together into the `/invoices` command center.

**Files:**
- Create: `components/invoices/invoice-table.tsx`
- Create: `components/invoices/dashboard.tsx`
- Modify: `app/(admin)/invoices/page.tsx` (replaces the Task 5 placeholder)

**Interfaces:**
- Consumes: `listInvoices` (Task 8); every export from `aggregate.ts` (Task 9); `METRIC_CONFIGS`, `MetricCard`, `YtdThresholdCard` (Task 10); `RevenueChart` (Task 11); `BreakdownChart`, `DashboardFilters` (Task 12).
- Produces:
  - `<InvoiceTable invoices />`
  - `<Dashboard invoices />` — the client shell owning range, dimension and chart-toggle state.

- [ ] **Step 1: Write the invoice table**

Create `components/invoices/invoice-table.tsx`:

```tsx
import Link from "next/link";

import type { AggregatableInvoice } from "@/lib/invoices/aggregate";
import { formatMoney } from "@/lib/invoices/money";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AggregatableInvoice["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  overdue: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  void: "bg-muted text-muted-foreground line-through",
};

export function InvoiceTable({
  invoices,
}: {
  invoices: AggregatableInvoice[];
}) {
  if (invoices.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No invoices yet. Create your first one to start tracking.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">Number</th>
            <th scope="col" className="py-2 pr-4 font-medium">Client</th>
            <th scope="col" className="py-2 pr-4 font-medium">Issued</th>
            <th scope="col" className="py-2 pr-4 font-medium">Due</th>
            <th scope="col" className="py-2 pr-4 font-medium">Status</th>
            <th scope="col" className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              className="border-b transition-colors last:border-0 hover:bg-muted/50"
            >
              <td className="py-3 pr-4">
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {invoice.number}
                </Link>
              </td>
              <td className="py-3 pr-4">{invoice.clientName}</td>
              <td className="py-3 pr-4 text-muted-foreground">
                {invoice.issueDate}
              </td>
              <td className="py-3 pr-4 text-muted-foreground">
                {invoice.dueDate}
              </td>
              <td className="py-3 pr-4">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium capitalize",
                    STATUS_STYLES[invoice.status]
                  )}
                >
                  {invoice.status}
                </span>
              </td>
              <td className="py-3 text-right font-semibold tabular-nums">
                {formatMoney(invoice.totalMinor, invoice.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`AggregatableInvoice` has no `dueDate` field — add it to that type in `lib/invoices/aggregate.ts`:

```diff
 export type AggregatableInvoice = {
   id: string;
   number: string;
   clientName: string;
   status: InvoiceStatus;
   issueDate: string; // YYYY-MM-DD
+  dueDate: string; // YYYY-MM-DD
   totalMinor: number;
   currency: string;
 };
```

Then update the `invoice()` helper in `lib/invoices/aggregate.test.ts` to supply it:

```diff
     issueDate: partial.issueDate,
+    dueDate: partial.dueDate ?? partial.issueDate,
     totalMinor: partial.totalMinor ?? 10000,
```

- [ ] **Step 2: Run the tests to confirm the type change broke nothing**

Run: `npm test -- lib/invoices/aggregate.test.ts`
Expected: PASS — 22 tests, unchanged.

- [ ] **Step 3: Write the dashboard shell**

Create `components/invoices/dashboard.tsx`:

```tsx
"use client";

import Link from "next/link";
import * as React from "react";

import { BreakdownChart } from "@/components/invoices/breakdown-chart";
import { DashboardFilters } from "@/components/invoices/dashboard-filters";
import { MetricCard } from "@/components/invoices/metric-card";
import {
  DEFAULT_VISIBLE_METRICS,
  METRIC_CONFIGS,
} from "@/components/invoices/metric-configs";
import { RevenueChart } from "@/components/invoices/revenue-chart";
import { YtdThresholdCard } from "@/components/invoices/ytd-threshold-card";
import { Button } from "@/components/ui/button";
import type {
  AggregatableInvoice,
  BreakdownDimension,
  DateRangeKey,
  MetricKey,
} from "@/lib/invoices/aggregate";
import {
  buildBreakdown,
  buildTimeSeries,
  computeMetrics,
  granularityFor,
  resolveRange,
  ytdBilledMinor,
} from "@/lib/invoices/aggregate";
import { formatMoney } from "@/lib/invoices/money";

/** The window immediately before [from, to], of equal length. */
function previousWindow(from: string, to: string) {
  const span = Date.parse(to) - Date.parse(from);
  const prevTo = new Date(Date.parse(from) - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - span);
  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  };
}

export function Dashboard({ invoices }: { invoices: AggregatableInvoice[] }) {
  const [range, setRange] = React.useState<DateRangeKey>("12m");
  const [dimension, setDimension] = React.useState<BreakdownDimension>("client");
  const [visibleMetrics, setVisibleMetrics] = React.useState<MetricKey[]>(
    DEFAULT_VISIBLE_METRICS
  );
  const [showGrid, setShowGrid] = React.useState(true);
  const [showDataPoints, setShowDataPoints] = React.useState(true);

  // Stable per render pass; the dashboard does not need to tick over midnight.
  const today = React.useMemo(() => new Date(), []);
  const year = today.getUTCFullYear();

  const { from, to } = React.useMemo(
    () => resolveRange(range, today),
    [range, today]
  );

  const inRange = React.useMemo(
    () =>
      invoices.filter(
        (invoice) => invoice.issueDate >= from && invoice.issueDate <= to
      ),
    [invoices, from, to]
  );

  const previous = React.useMemo(() => {
    const window = previousWindow(from, to);
    return invoices.filter(
      (invoice) =>
        invoice.issueDate >= window.from && invoice.issueDate <= window.to
    );
  }, [invoices, from, to]);

  const series = React.useMemo(
    () => buildTimeSeries(invoices, { from, to, granularity: granularityFor(from, to) }),
    [invoices, from, to]
  );

  const metrics = React.useMemo(
    () => computeMetrics(inRange, previous),
    [inRange, previous]
  );

  const breakdown = React.useMemo(
    () => buildBreakdown(inRange, dimension),
    [inRange, dimension]
  );

  const ytdMinor = React.useMemo(
    () => ytdBilledMinor(invoices, year),
    [invoices, year]
  );

  const toggleMetric = React.useCallback((metric: MetricKey) => {
    setVisibleMetrics((current) =>
      current.includes(metric)
        ? current.filter((key) => key !== metric)
        : [...current, metric]
    );
  }, []);

  const moneyFormat = React.useCallback(
    (value: number) => formatMoney(Math.round(value * 100)),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {`${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"} on record`}
          </p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">New invoice</Link>
        </Button>
      </div>

      <DashboardFilters
        range={range}
        onRangeChange={setRange}
        dimension={dimension}
        onDimensionChange={setDimension}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <YtdThresholdCard
          billedMinor={ytdMinor}
          year={year}
          className="lg:col-span-1"
        />

        <div className="grid grid-cols-2 gap-5 rounded-lg border bg-card p-5 lg:col-span-2 lg:grid-cols-4">
          {(["billed", "paid", "outstanding", "count"] as MetricKey[]).map(
            (key) => (
              <MetricCard
                key={key}
                title={METRIC_CONFIGS[key].name}
                metric={metrics[key]}
                icon={METRIC_CONFIGS[key].icon}
                accentColor={METRIC_CONFIGS[key].color}
                formatValue={
                  METRIC_CONFIGS[key].kind === "money" ? moneyFormat : undefined
                }
              />
            )
          )}
        </div>
      </div>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-heading text-lg">Billing over time</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Click a legend entry to show or hide that series.
        </p>
        <RevenueChart
          data={series}
          visibleMetrics={visibleMetrics}
          onToggleMetric={toggleMetric}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((value) => !value)}
          showDataPoints={showDataPoints}
          onToggleDataPoints={() => setShowDataPoints((value) => !value)}
        />
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 font-heading text-lg">Breakdown</h2>
        <BreakdownChart rows={breakdown} />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Write the page**

Overwrite `app/(admin)/invoices/page.tsx`:

```tsx
import { Dashboard } from "@/components/invoices/dashboard";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import type { AggregatableInvoice } from "@/lib/invoices/aggregate";
import { listInvoices } from "@/lib/invoices/repository";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoices = await listInvoices();

  // Line items are irrelevant to the dashboard; pass only what it aggregates.
  const rows: AggregatableInvoice[] = invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    clientName: invoice.clientName,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalMinor: invoice.totalMinor,
    currency: invoice.currency,
  }));

  return (
    <div className="space-y-6">
      <Dashboard invoices={rows} />

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 font-heading text-lg">All invoices</h2>
        <InvoiceTable invoices={rows} />
      </section>
    </div>
  );
}
```

`dynamic = "force-dynamic"` is required — the page reads the session and live invoice data, so it must never be statically prerendered.

- [ ] **Step 5: Seed enough data to see the charts work**

Create `scripts/seed-invoices.ts`:

```ts
import { createInvoice } from "@/lib/invoices/repository";

const clients = [
  { name: "Acme Ltd", email: "sarah@acme.com" },
  { name: "Globex", email: "ops@globex.com" },
  { name: "Initech", email: "billing@initech.com" },
];

const statuses = ["paid", "paid", "sent", "overdue", "draft"] as const;

for (let index = 0; index < 24; index += 1) {
  const date = new Date();
  date.setMonth(date.getMonth() - Math.floor(index / 2));
  date.setDate(1 + (index % 2) * 14);
  const issueDate = date.toISOString().slice(0, 10);

  date.setDate(date.getDate() + 30);
  const dueDate = date.toISOString().slice(0, 10);

  const client = clients[index % clients.length];

  await createInvoice({
    clientName: client.name,
    clientEmail: client.email,
    clientAddress: "",
    issueDate,
    dueDate,
    currency: "GBP",
    status: statuses[index % statuses.length],
    notes: "",
    lineItems: [
      {
        description: "Consulting",
        quantity: String(4 + (index % 6)),
        unitPrice: "80.00",
      },
    ],
  });
}

console.log("seeded 24 invoices");
```

Run: `npx dotenv -e .env -- npx tsx scripts/seed-invoices.ts`
Expected: `seeded 24 invoices`.

- [ ] **Step 6: Manual verification — the dashboard**

Run: `npm run dev`, sign in, open `/invoices`.

1. Four metric cards show non-zero values with up/down deltas.
2. The YTD card shows this year's billed total, with a coloured progress bar toward £12,500.
3. The line chart renders three series (Billed, Paid, Outstanding) across the last 12 months.
4. **Clicking a legend entry hides and re-shows that series** — this is the one recharts v3 API most likely to have shifted from the v2 reference. If clicking does nothing, log the `onClick` argument in `revenue-chart.tsx` and read `dataKey` from wherever it actually sits in the payload.
5. Toggling "Grid" and "Points" changes the chart.
6. Switching the period to "Last 30 days" re-buckets the X axis to days.
7. Switching "Break down by" between Client, Status and Month re-sorts the bar list.
8. The table lists all 24 invoices with coloured status pills.
9. Cycle through all seven themes — axis labels, gridlines and tooltip stay legible in each.

- [ ] **Step 7: Clean up and commit**

```bash
rm scripts/seed-invoices.ts
git add components/invoices lib/invoices/aggregate.ts lib/invoices/aggregate.test.ts app/\(admin\)/invoices/page.tsx
git commit -m "feat: assemble the invoices dashboard"
```

Leave the seeded rows in the database for now — Tasks 15–17 need invoices to export. Delete them from Drizzle Studio before the first real invoice.

---

## Task 15: Invoice PDF generation

**Files:**
- Create: `lib/invoices/pdf.ts`
- Create: `app/api/invoices/[id]/pdf/route.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `InvoiceWithLines` (Task 8); `getInvoice` (Task 8); `formatMoney`, `fromMilli` (Task 7); `getAdminSession` (Task 5).
- Produces: `renderInvoicePdf(invoice: InvoiceWithLines): Promise<Buffer>`

- [ ] **Step 1: Install pdfkit**

```bash
npm i pdfkit@^0.20.2
npm i -D @types/pdfkit@^0.17.6
```

- [ ] **Step 2: Write the renderer**

Create `lib/invoices/pdf.ts`. pdfkit's built-in Helvetica means no font files ship with the bundle:

```ts
import "server-only";

import PDFDocument from "pdfkit";

import { fromMilli, formatMoney } from "./money";
import type { InvoiceWithLines } from "./types";

const ISSUER = {
  name: "Cal Grimes",
  email: "calgrimes29@gmail.com",
  site: "calgrimes.co.uk",
};

export function renderInvoicePdf(invoice: InvoiceWithLines): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const money = (minor: number) => formatMoney(minor, invoice.currency);

    // Header
    doc.font("Helvetica-Bold").fontSize(24).text("INVOICE", { align: "left" });
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(10).fillColor("#666666");
    doc.text(invoice.number);
    doc.fillColor("#000000");

    // Issuer, right aligned on the header row
    doc.font("Helvetica-Bold").fontSize(11).text(ISSUER.name, 350, 50, {
      align: "right",
      width: 195,
    });
    doc.font("Helvetica").fontSize(9).fillColor("#666666");
    doc.text(ISSUER.email, 350, doc.y, { align: "right", width: 195 });
    doc.text(ISSUER.site, 350, doc.y, { align: "right", width: 195 });
    doc.fillColor("#000000");

    // Bill to
    doc.moveDown(3);
    const detailsTop = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).text("BILL TO", 50, detailsTop);
    doc.font("Helvetica").fontSize(10);
    doc.text(invoice.clientName, 50, doc.y + 2);
    doc.fillColor("#666666").fontSize(9);
    doc.text(invoice.clientEmail);
    if (invoice.clientAddress) {
      doc.text(invoice.clientAddress, { width: 240 });
    }
    doc.fillColor("#000000");

    // Dates
    doc.font("Helvetica-Bold").fontSize(9).text("ISSUED", 350, detailsTop, {
      align: "right",
      width: 195,
    });
    doc.font("Helvetica").fontSize(10).text(invoice.issueDate, 350, doc.y, {
      align: "right",
      width: 195,
    });
    doc.font("Helvetica-Bold").fontSize(9).text("DUE", 350, doc.y + 6, {
      align: "right",
      width: 195,
    });
    doc.font("Helvetica").fontSize(10).text(invoice.dueDate, 350, doc.y, {
      align: "right",
      width: 195,
    });

    // Line item table
    let y = Math.max(doc.y, detailsTop + 90) + 20;

    const columns = { description: 50, qty: 330, unit: 390, amount: 470 };
    const widths = { description: 270, qty: 50, unit: 70, amount: 75 };

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#666666");
    doc.text("DESCRIPTION", columns.description, y, { width: widths.description });
    doc.text("QTY", columns.qty, y, { width: widths.qty, align: "right" });
    doc.text("UNIT", columns.unit, y, { width: widths.unit, align: "right" });
    doc.text("AMOUNT", columns.amount, y, { width: widths.amount, align: "right" });
    doc.fillColor("#000000");

    y += 14;
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#dddddd").stroke();
    y += 10;

    doc.font("Helvetica").fontSize(10);
    for (const line of invoice.lineItems) {
      const height = doc.heightOfString(line.description, {
        width: widths.description,
      });

      doc.text(line.description, columns.description, y, {
        width: widths.description,
      });
      doc.text(String(fromMilli(line.quantityMilli)), columns.qty, y, {
        width: widths.qty,
        align: "right",
      });
      doc.text(money(line.unitPriceMinor), columns.unit, y, {
        width: widths.unit,
        align: "right",
      });
      doc.text(money(line.amountMinor), columns.amount, y, {
        width: widths.amount,
        align: "right",
      });

      y += Math.max(height, 12) + 8;

      if (y > 700) {
        doc.addPage();
        y = 50;
      }
    }

    // Total
    doc.moveTo(330, y).lineTo(545, y).strokeColor("#dddddd").stroke();
    y += 10;
    doc.font("Helvetica-Bold").fontSize(12);
    doc.text("TOTAL", columns.unit - 60, y, { width: 130, align: "right" });
    doc.text(money(invoice.totalMinor), columns.amount, y, {
      width: widths.amount,
      align: "right",
    });

    // Notes
    if (invoice.notes) {
      doc.font("Helvetica").fontSize(9).fillColor("#666666");
      doc.text(invoice.notes, 50, y + 40, { width: 495 });
      doc.fillColor("#000000");
    }

    doc.end();
  });
}
```

- [ ] **Step 3: Write the download route**

Create `app/api/invoices/[id]/pdf/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth-guard";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { getInvoice } from "@/lib/invoices/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) {
    return new NextResponse("Not found", { status: 404 });
  }

  const pdf = await renderInvoicePdf(invoice);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
```

The route returns `404` rather than redirecting when unauthenticated, so an unauthorised caller cannot distinguish a real invoice id from a fake one.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, sign in, and visit `/api/invoices/<a real id>/pdf` (copy an id from Drizzle Studio).

1. A PDF downloads named `invoice-INV-2026-0001.pdf`.
2. Opening it shows the invoice number, client block, issue and due dates, one row per line item with quantity/unit/amount, and a total matching the dashboard.
3. Quantities show as `7.5`, not `7500`.
4. Signed out (or in a private window), the same URL returns 404.

- [ ] **Step 5: Commit**

```bash
git add lib/invoices/pdf.ts app/api/invoices package.json package-lock.json
git commit -m "feat: render invoices as pdf"
```

---

## Task 16: Outlook `.eml` draft generation

**Files:**
- Create: `lib/invoices/eml.ts`
- Create: `lib/invoices/eml.test.ts`
- Create: `app/api/invoices/[id]/eml/route.ts`

**Interfaces:**
- Consumes: `InvoiceWithLines` (Task 8); `renderInvoicePdf` (Task 15); `formatMoney` (Task 7).
- Produces:
  - `buildInvoiceEmailFields(invoice): { to: string; subject: string; text: string }` — pure, tested.
  - `buildInvoiceEml(invoice, pdf: Buffer): Promise<Buffer>`

No new dependencies: `nodemailer@6.10.1` and `@types/nodemailer` are already installed, and `MailComposer` ships inside nodemailer at `nodemailer/lib/mail-composer`.

- [ ] **Step 1: Write the failing test**

Create `lib/invoices/eml.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildInvoiceEmailFields, buildInvoiceEml } from "./eml";
import type { InvoiceWithLines } from "./types";

const invoice = {
  id: "11111111-1111-1111-1111-111111111111",
  number: "INV-2026-0007",
  clientName: "Acme Ltd",
  clientEmail: "sarah@acme.com",
  clientAddress: null,
  issueDate: "2026-09-01",
  dueDate: "2026-09-30",
  currency: "GBP",
  totalMinor: 240000,
  status: "sent",
  notes: null,
  paidAt: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
  lineItems: [],
} as unknown as InvoiceWithLines;

describe("buildInvoiceEmailFields", () => {
  const fields = buildInvoiceEmailFields(invoice);

  it("addresses the client", () => {
    expect(fields.to).toBe("sarah@acme.com");
  });

  it("puts the number and formatted total in the subject", () => {
    expect(fields.subject).toContain("INV-2026-0007");
    expect(fields.subject).toContain("£2,400.00");
  });

  it("names the client and the due date in the body", () => {
    expect(fields.text).toContain("Acme Ltd");
    expect(fields.text).toContain("2026-09-30");
  });
});

describe("buildInvoiceEml", () => {
  it("produces a MIME message Outlook opens as an editable draft", async () => {
    const eml = (
      await buildInvoiceEml(invoice, Buffer.from("%PDF-1.4 fake"))
    ).toString("utf8");

    // X-Unsent is what makes Outlook show a Send button instead of a read-only view.
    expect(eml).toMatch(/^X-Unsent: 1$/m);
    expect(eml).toMatch(/^To: .*sarah@acme\.com/m);
    expect(eml).toContain("INV-2026-0007");
  });

  it("attaches the pdf under the invoice number", async () => {
    const eml = (
      await buildInvoiceEml(invoice, Buffer.from("%PDF-1.4 fake"))
    ).toString("utf8");

    expect(eml).toContain("application/pdf");
    expect(eml).toContain("invoice-INV-2026-0007.pdf");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- lib/invoices/eml.test.ts`
Expected: FAIL — `Cannot find module './eml'`.

- [ ] **Step 3: Write the builder**

Create `lib/invoices/eml.ts`:

```ts
import MailComposer from "nodemailer/lib/mail-composer";

import { formatMoney } from "./money";
import type { InvoiceWithLines } from "./types";

const SENDER_NAME = "Cal Grimes";

export function buildInvoiceEmailFields(invoice: InvoiceWithLines): {
  to: string;
  subject: string;
  text: string;
} {
  const total = formatMoney(invoice.totalMinor, invoice.currency);

  return {
    to: invoice.clientEmail,
    subject: `Invoice ${invoice.number} — ${total}`,
    text: [
      `Hi ${invoice.clientName},`,
      "",
      `Please find invoice ${invoice.number} attached, for ${total}.`,
      `It is due on ${invoice.dueDate}.`,
      "",
      "Any questions, just reply to this email.",
      "",
      "Thanks,",
      SENDER_NAME,
    ].join("\n"),
  };
}

/**
 * Builds an .eml file. The `X-Unsent: 1` header is what makes Outlook open it
 * as an editable draft with a Send button rather than as a received message.
 * Apple Mail and Outlook on the web ignore the header and show it read-only.
 */
export async function buildInvoiceEml(
  invoice: InvoiceWithLines,
  pdf: Buffer
): Promise<Buffer> {
  const fields = buildInvoiceEmailFields(invoice);

  const composer = new MailComposer({
    to: `${invoice.clientName} <${fields.to}>`,
    subject: fields.subject,
    text: fields.text,
    headers: { "X-Unsent": "1" },
    attachments: [
      {
        filename: `invoice-${invoice.number}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });

  return composer.compile().build();
}
```

No `from` is set: Outlook fills in the sending account when the draft opens, which is the desired behaviour.

- [ ] **Step 4: Run the tests**

Run: `npm test -- lib/invoices/eml.test.ts`
Expected: PASS — 5 tests. If the `To:` assertion fails, MailComposer may have folded the long header across lines — relax the regex to `/sarah@acme\.com/` and keep the `X-Unsent` assertion strict.

- [ ] **Step 5: Write the download route**

Create `app/api/invoices/[id]/eml/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth-guard";
import { buildInvoiceEml } from "@/lib/invoices/eml";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { getInvoice } from "@/lib/invoices/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) {
    return new NextResponse("Not found", { status: 404 });
  }

  const pdf = await renderInvoicePdf(invoice);
  const eml = await buildInvoiceEml(invoice, pdf);

  return new NextResponse(new Uint8Array(eml), {
    headers: {
      "Content-Type": "message/rfc822",
      "Content-Disposition": `attachment; filename="invoice-${invoice.number}.eml"`,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 6: Manual verification — the Outlook round trip**

Run: `npm run dev`, sign in, visit `/api/invoices/<a real id>/eml`.

1. A file downloads named `invoice-INV-2026-0001.eml`.
2. Double-clicking it opens **Outlook desktop** with a composable draft: To is the client's address, the subject reads `Invoice INV-… — £…`, the body is filled in, and the PDF is attached.
3. There is a **Send** button, not a Reply/Forward bar. If it opens read-only, `X-Unsent` was not written — inspect the raw file with a text editor and confirm the header is present at the top level, not inside a MIME part.
4. The attachment opens and matches the PDF from Task 15.

- [ ] **Step 7: Commit**

```bash
git add lib/invoices/eml.ts lib/invoices/eml.test.ts app/api/invoices
git commit -m "feat: export invoices as outlook eml drafts"
```

---

## Task 17: Invoice detail page and export buttons

**Files:**
- Create: `components/invoices/export-buttons.tsx`
- Create: `app/(admin)/invoices/[id]/page.tsx`

**Interfaces:**
- Consumes: `getInvoice` (Task 8); `setInvoiceStatusAction` (Task 13); `formatMoney`, `fromMilli` (Task 7).
- Produces: `<ExportButtons invoiceId invoiceNumber />`, and the `/invoices/[id]` route that Task 13's form already redirects to.

- [ ] **Step 1: Write the export buttons**

Create `components/invoices/export-buttons.tsx`. Both exports are plain anchors — the routes set `Content-Disposition: attachment`, so the browser downloads without any client JavaScript:

```tsx
import { FileDown, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ExportButtons({ invoiceId }: { invoiceId: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild variant="outline">
        <a href={`/api/invoices/${invoiceId}/pdf`} download>
          <FileDown className="mr-2 h-4 w-4" aria-hidden />
          Download PDF
        </a>
      </Button>

      <Button asChild>
        <a href={`/api/invoices/${invoiceId}/eml`} download>
          <Mail className="mr-2 h-4 w-4" aria-hidden />
          Download Outlook draft
        </a>
      </Button>
    </div>
  );
}
```

The label says "Outlook draft" rather than "Send to client" — the file is a draft that Cal still sends by hand, and the editable-draft behaviour is Outlook-specific.

- [ ] **Step 2: Write the detail page**

Create `app/(admin)/invoices/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExportButtons } from "@/components/invoices/export-buttons";
import { Button } from "@/components/ui/button";
import type { InvoiceStatus } from "@/lib/db/schema";
import { setInvoiceStatusAction } from "@/lib/invoices/actions";
import { formatMoney, fromMilli } from "@/lib/invoices/money";
import { getInvoice } from "@/lib/invoices/repository";

export const dynamic = "force-dynamic";

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "void"];

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const money = (minor: number) => formatMoney(minor, invoice.currency);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-1">
        <Link
          href="/invoices"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to dashboard
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl">{invoice.number}</h1>
            <p className="text-sm text-muted-foreground">
              {`${invoice.clientName} · issued ${invoice.issueDate} · due ${invoice.dueDate}`}
            </p>
          </div>
          <span className="text-3xl font-semibold tabular-nums">
            {money(invoice.totalMinor)}
          </span>
        </div>
      </div>

      <ExportButtons invoiceId={invoice.id} />

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 font-heading text-lg">Line items</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 font-medium">Description</th>
              <th scope="col" className="py-2 text-right font-medium">Qty</th>
              <th scope="col" className="py-2 text-right font-medium">Unit</th>
              <th scope="col" className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((line) => (
              <tr key={line.id} className="border-b last:border-0">
                <td className="py-3">{line.description}</td>
                <td className="py-3 text-right tabular-nums">
                  {fromMilli(line.quantityMilli)}
                </td>
                <td className="py-3 text-right tabular-nums">
                  {money(line.unitPriceMinor)}
                </td>
                <td className="py-3 text-right font-medium tabular-nums">
                  {money(line.amountMinor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 font-heading text-lg">Status</h2>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <form
              key={status}
              action={async () => {
                "use server";
                await setInvoiceStatusAction(id, status);
              }}
            >
              <Button
                type="submit"
                size="sm"
                variant={invoice.status === status ? "default" : "outline"}
                className="capitalize"
              >
                {status}
              </Button>
            </form>
          ))}
        </div>
      </section>

      {invoice.notes ? (
        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-2 font-heading text-lg">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {invoice.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Manual verification — the full loop**

Run: `npm run dev`, sign in.

1. `/invoices` → click an invoice number → the detail page loads with matching totals.
2. "Download PDF" downloads the PDF.
3. "Download Outlook draft" downloads the `.eml`.
4. Clicking a status button updates the highlighted status and, on returning to `/invoices`, the table pill and the Paid/Outstanding metric cards have changed accordingly.
5. Creating a new invoice from `/invoices/new` now lands on a working detail page.

- [ ] **Step 4: Typecheck, test, commit**

Run: `npx tsc --noEmit && npm test`
Expected: exit 0, all tests pass.

```bash
git add components/invoices/export-buttons.tsx app/\(admin\)/invoices/\[id\]
git commit -m "feat: add invoice detail page with pdf and outlook exports"
```

---

## Task 18: Production deployment

**Files:**
- Modify: `.env.copy` (final pass)
- Modify: `README.md`

**Interfaces:**
- Consumes: everything.
- Produces: a working `/invoices` on `https://calgrimes.co.uk`.

- [ ] **Step 1: Upgrade the Vercel CLI and link the project**

The installed CLI is 53.4.0, which predates several commands used below.

```bash
npm i -g vercel@latest
vercel link
```

- [ ] **Step 2: Push the environment variables — MANUAL CHECKPOINT**

```bash
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production
vercel env add AUTH_GOOGLE_ID production
vercel env add AUTH_GOOGLE_SECRET production
vercel env add ADMIN_EMAIL production
vercel env add AUTH_URL production        # https://calgrimes.co.uk
```

Each prompts for the value interactively. **Ask Cal to paste each secret** rather than reading them out of `.env` into the transcript.

Repeat for the `preview` environment if preview deploys should also reach the database — otherwise preview builds will render `/invoices` as a 500. Preview URLs are not registered as Google redirect URIs, so sign-in will not work there regardless; leaving preview unset is the simpler choice.

- [ ] **Step 3: Verify the variables landed**

Run: `vercel env ls`
Expected: all six listed for `production`. Names only — never echo the values.

- [ ] **Step 4: Confirm the production build compiles**

Run: `npm run build`
Expected: exit 0. Watch specifically for a build-time `DATABASE_URL is not set` — if it appears, something is calling `getDb()` at module scope rather than inside a request. Every call must be inside a function.

- [ ] **Step 5: Deploy a preview and smoke test it**

```bash
vercel
```

Open the preview URL and confirm the public site renders, the footer shows "Admin Login", and no hotbar appears while signed out.

- [ ] **Step 6: Promote to production**

```bash
vercel --prod
```

- [ ] **Step 7: Verify production end to end**

On `https://calgrimes.co.uk`:

1. The footer shows "Admin Login".
2. Signing in with the allowlisted Gmail lands on `/invoices` with the seeded data.
3. Signing in with any other Google account is rejected.
4. The hotbar appears bottom-left on the public site once signed in.
5. Downloading a PDF and an `.eml` both work from the production domain.
6. `https://calgrimes.co.uk/invoices` in a signed-out private window redirects to `/admin/login`.

- [ ] **Step 8: Clear the seed data**

Delete the 24 seeded invoices from Drizzle Studio (`npm run db:studio`) so the dashboard starts from real numbers.

- [ ] **Step 9: Document the setup**

Append to `README.md`:

```markdown
## Admin invoices

A single-user invoicing dashboard lives at `/invoices`, behind Google sign-in
restricted to `ADMIN_EMAIL`. Data is stored in Neon Postgres.

| Command | Purpose |
|---|---|
| `npm test` | Run the Vitest suite |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply migrations to Neon |
| `npm run db:studio` | Browse the database |

Required environment variables are listed in `.env.copy`. See
`docs/superpowers/specs/2026-09-01-invoices-admin.md` for the design rationale.
```

- [ ] **Step 10: Commit**

```bash
git add README.md .env.copy
git commit -m "docs: document the invoices admin setup"
```

---

## Self-Review

Checked against `docs/superpowers/specs/2026-09-01-invoices-admin.md`:

**Spec coverage** — every numbered goal maps to a task:

| Spec goal | Task |
|---|---|
| §2.1 Google sign-in, single allowlisted address | 4 |
| §2.2 "Admin Login" footer link | 5 |
| §2.3 Floating hotbar, admin only | 6 |
| §2.4 Dashboard: line chart, metrics, breakdown, filtering | 9–12, 14 |
| §2.5 Create invoices | 8, 13 |
| §2.6 Outlook export with PDF attached | 15, 16, 17 |
| §2.7 Data in Neon feeding analytics | 2, 3, 8, 14 |
| §4.3 YTD £12,500 threshold card | 9 (`YTD_THRESHOLD_MINOR`), 10 (`YtdThresholdCard`), 14 (rendered) |
| §7 All seven routes | 4 (auth), 5 (login, dashboard), 13 (new), 15 (pdf), 16 (eml), 17 (detail) |
| §8 All six env vars | 2 (`DATABASE_URL`), 4 (rest), 18 (production) |
| §9 Three manual checkpoints | 2 step 1, 4 step 9, 18 step 2 |

**Deviations worth flagging to the executor:**

1. **`AggregatableInvoice` gains `dueDate` in Task 14, not Task 9.** The table needs it and the aggregation does not. Task 14 Step 1 carries the exact diff for both the type and its test helper, so the change is explicit rather than discovered.
2. **`next-auth` is installed in Task 3, not Task 4.** The Auth.js schema imports `AdapterAccountType`, so the package must exist a task earlier for Task 3 to typecheck on its own. Task 4 Step 5 re-checks that the version stayed pinned.
3. **Task 14 leaves seed data in the database** because Tasks 15–17 need invoices to export. Task 18 Step 8 removes it.

**Type consistency** — verified across tasks: `getDb` (2→3,4,8), `isAllowedAdmin` (4→4), `getAdminSession`/`requireAdmin` (5→6,13,15,16), `toMinor`/`toMilli`/`computeLineAmountMinor`/`formatMoney`/`fromMilli` (7→8,10,11,12,13,15,16,17), `nextInvoiceNumber` (7→8), `InvoiceWithLines`/`InvoiceFormValues`/`toNewInvoiceRecords` (8→13,15,16), `AggregatableInvoice`/`SeriesPoint`/`MetricKey`/`BreakdownRow`/`MetricData` (9→10,11,12,14), `METRIC_CONFIGS` (10→11,14), `RevenueChart` (11→14), `renderInvoicePdf` (15→16,17), `buildInvoiceEml` (16→17).

**Known-uncertain surfaces**, each with a stated fallback in its step rather than an assumption:

- `neon` CLI subcommand names (Task 2) — verify with `neon --help` before improvising.
- recharts v3 `Legend.onClick` payload (Tasks 11, 14) — read `dataKey` defensively; Task 14 Step 6.4 is the explicit check.
- recharts v3 `TooltipProps` generics (Task 11 Step 3) — widen to `any` rather than fight the types.
- MailComposer header folding (Task 16 Step 4) — relax the `To:` regex, keep `X-Unsent` strict.
