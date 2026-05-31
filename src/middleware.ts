import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
}).auth;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
    "/api/insights/:path*",
    "/api/dashboard/:path*",
  ],
};
