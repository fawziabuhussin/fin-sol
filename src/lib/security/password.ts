import bcrypt from "bcryptjs";
import { z } from "zod";

const BCRYPT_COST = 12;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt ignores bytes beyond 72

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`)
  .max(PASSWORD_MAX_LENGTH, "كلمة المرور طويلة جداً")
  .refine((v) => /\p{L}/u.test(v) && /\d/.test(v), {
    message: "كلمة المرور يجب أن تحتوي على حروف وأرقام",
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("البريد الإلكتروني غير صالح")
  .max(254);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

let dummyHash: Promise<string> | null = null;

/**
 * Always runs a bcrypt comparison — even when the account does not exist —
 * so response timing does not reveal which e-mails are registered.
 */
export async function verifyPassword(
  password: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash) {
    dummyHash ??= bcrypt.hash("timing-equalizer", BCRYPT_COST);
    await bcrypt.compare(password, await dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}
