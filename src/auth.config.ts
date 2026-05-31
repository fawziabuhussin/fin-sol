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
        path.startsWith("/transactions") ||
        path.startsWith("/projects") ||
        path.startsWith("/savings") ||
        path.startsWith("/salary") ||
        path.startsWith("/settings") ||
        path.startsWith("/search") ||
        path.startsWith("/api/transactions") ||
        path.startsWith("/api/projects") ||
        path.startsWith("/api/quick-add") ||
        path.startsWith("/api/savings") ||
        path.startsWith("/api/salary");
      const isAuthPage =
        path.startsWith("/login") || path.startsWith("/register");

      if (isProtected && !isLoggedIn) return false;
      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
