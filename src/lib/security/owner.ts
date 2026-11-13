import { normalizeEmail } from "@/lib/security/password";

/**
 * Personal, hard-coded data (the original owner's default subscription list,
 * employer payslip templates) must never be applied to other accounts.
 * Those features are enabled only for e-mails listed in OWNER_EMAILS
 * (comma-separated env var).
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const owners = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
  return owners.includes(normalizeEmail(email));
}
