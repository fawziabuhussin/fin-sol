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
    "/projects/:path*",
    "/splits/:path*",
    "/savings/:path*",
    "/salary/:path*",
    "/settings/:path*",
    "/search/:path*",
    "/login",
    "/register",
    "/api/transactions/:path*",
    "/api/projects/:path*",
    "/api/quick-add/:path*",
    "/api/split-plans/:path*",
    "/api/split-installments/:path*",
    "/api/savings/:path*",
    "/api/salary/:path*",
  ],
};
