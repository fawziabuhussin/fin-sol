import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      activeHouseholdId?: string | null;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email as string;
        const password = credentials.password as string;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const membership = await prisma.householdMember.findFirst({
          where: { userId: user.id },
          orderBy: { joinedAt: "asc" },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          activeHouseholdId: membership?.householdId ?? null,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.id = user.id;
        const activeHouseholdId =
          "activeHouseholdId" in user
            ? (user as { activeHouseholdId?: string }).activeHouseholdId
            : undefined;
        if (activeHouseholdId) {
          token.activeHouseholdId = activeHouseholdId;
        } else {
          const membership = await prisma.householdMember.findFirst({
            where: { userId: user.id },
            orderBy: { joinedAt: "asc" },
          });
          token.activeHouseholdId = membership?.householdId ?? null;
        }
      }
      if (trigger === "update" && session?.activeHouseholdId) {
        token.activeHouseholdId = session.activeHouseholdId as string;
      }
      return token;
    },
  },
});
