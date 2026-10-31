/**
 * The single gate on admin access. Fails closed: an unset, empty or
 * whitespace-only allowlist rejects every address, and an unverified user is
 * rejected even when the email matches exactly.
 */
export function isAllowedAdmin(
  email: string | null | undefined,
  adminEmail: string | null | undefined,
  emailVerified: boolean | string | undefined
): boolean {
  const allowed = adminEmail?.trim().toLowerCase();
  if (!allowed) return false;

  const candidate = email?.trim().toLowerCase();
  if (!candidate) return false;
  if (candidate !== allowed) return false;

  if (emailVerified === true || emailVerified === "true") return true;
  return false;
}
