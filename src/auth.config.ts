import type { NextAuthConfig } from "next-auth";

/** App pages that require a signed-in user. */
export const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/subscriptions",
  "/splits",
  "/projects",
  "/savings",
  "/salary",
  "/showcase",
  "/settings",
  "/search",
];

/** Every API route except Auth.js itself and public sign-up. */
const PUBLIC_API_PREFIXES = ["/api/auth/"];

function isProtectedPath(path: string) {
  if (path.startsWith("/api/")) {
    return !PUBLIC_API_PREFIXES.some((p) => path.startsWith(p));
  }
  return PROTECTED_PAGE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isAuthPage = path.startsWith("/login") || path.startsWith("/register");

      if (isProtectedPath(path) && !isLoggedIn) {
        if (path.startsWith("/api/")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        return false;
      }
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
