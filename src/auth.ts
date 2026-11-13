import NextAuth, { CredentialsSignin } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import type { DefaultSession } from "next-auth";
import { normalizeEmail, verifyPassword } from "@/lib/security/password";
import {
  MINUTE,
  clearHits,
  clientIp,
  isRateLimited,
  recordHit,
} from "@/lib/security/rate-limit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
  interface User {
    tokenVersion?: number;
  }
}

class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

const LOGIN_WINDOW = 15 * MINUTE;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 30;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (
          typeof credentials?.email !== "string" ||
          typeof credentials?.password !== "string" ||
          credentials.password.length > 200
        ) {
          return null;
        }
        const email = normalizeEmail(credentials.email);
        const password = credentials.password;
        const emailKey = `login:email:${email}`;
        const ipKey = `login:ip:${clientIp(request)}`;

        const [emailBlocked, ipBlocked] = await Promise.all([
          isRateLimited(emailKey, MAX_FAILURES_PER_EMAIL, LOGIN_WINDOW),
          isRateLimited(ipKey, MAX_FAILURES_PER_IP, LOGIN_WINDOW),
        ]);
        if (emailBlocked || ipBlocked) throw new RateLimitedError();

        // Case-insensitive lookup so legacy mixed-case e-mails keep working.
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        const valid = await verifyPassword(password, user?.passwordHash);

        if (!user || !valid) {
          await Promise.all([recordHit(emailKey), recordHit(ipKey)]);
          return null;
        }

        await clearHits(emailKey);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.email = user.email;
        token.tv = user.tokenVersion ?? 0;
        return token;
      }

      const select = { id: true, email: true, name: true, tokenVersion: true } as const;
      let dbUser = token.id
        ? await prisma.user.findUnique({ where: { id: token.id as string }, select })
        : null;

      // Stale session after a DB reset — recover by e-mail.
      if (!dbUser && token.email) {
        dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select,
        });
      }

      // Account deleted, or password changed / "sign out everywhere" used.
      if (!dbUser || dbUser.tokenVersion !== ((token.tv as number | undefined) ?? 0)) {
        return null;
      }

      token.id = dbUser.id;
      token.email = dbUser.email;
      token.name = dbUser.name;
      return token;
    },
  },
});
