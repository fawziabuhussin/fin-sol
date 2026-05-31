import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isProtected =
        path.startsWith("/dashboard") ||
        path.startsWith("/api/insights") ||
        path.startsWith("/api/dashboard");
      const isAuthPage =
        path.startsWith("/login") || path.startsWith("/register");

      if (isProtected && !isLoggedIn) return false;
      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.id = user.id;
      }
      if (trigger === "update" && session?.activeHouseholdId) {
        token.activeHouseholdId = session.activeHouseholdId as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.activeHouseholdId =
          (token.activeHouseholdId as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
