import { getAdminSession } from "@/lib/auth-guard";

import { AdminHotbarClient } from "./admin-hotbar-client";

export async function AdminHotbar() {
  const session = await getAdminSession();
  if (!session) return null;

  return <AdminHotbarClient />;
}
