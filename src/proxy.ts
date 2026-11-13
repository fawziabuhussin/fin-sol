import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
}).auth;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/subscriptions/:path*",
    "/projects/:path*",
    "/splits/:path*",
    "/savings/:path*",
    "/salary/:path*",
    "/showcase/:path*",
    "/settings/:path*",
    "/search/:path*",
    "/login",
    "/register",
    // All API routes except Auth.js handlers (sign-in, session, register).
    "/api/((?!auth/).*)",
  ],
};
