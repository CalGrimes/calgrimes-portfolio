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
