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
  secret: process.env.AUTH_SECRET,
  trustHost: true,
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
        profile?.email_verified as boolean | string | undefined
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
