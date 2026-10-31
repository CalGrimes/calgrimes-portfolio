import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./lib/db/schema/auth.ts", "./lib/db/schema/invoices.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
