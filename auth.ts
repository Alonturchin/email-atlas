import NextAuth, { type DefaultSession } from "next-auth";
// Type-only import forces TS to resolve the `next-auth/jwt` subpath so the
// `declare module` augmentation below is recognized by `next build`'s strict
// type check. Without this, augmentation fails with "module not found".
import type { JWT as _JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
// Silence "unused import" — _JWT is consumed implicitly by the augmentation.
type _Unused = _JWT;

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "MEMBER";
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    role?: "ADMIN" | "MEMBER";
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "MEMBER";
    mustChangePassword: boolean;
  }
}

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT strategy is required when using credentials provider — the database
  // session strategy can't issue sessions for credentials sign-ins.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = SignInSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Best-effort touch — don't fail the login if this errors.
        prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger }) => {
      if (user) {
        token.id = user.id as string;
        token.role = (user.role ?? "MEMBER") as "ADMIN" | "MEMBER";
        token.mustChangePassword = user.mustChangePassword ?? false;
      }
      // Re-hydrate from DB when client calls update() so role/password changes
      // propagate without forcing a re-login.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, mustChangePassword: true },
        });
        if (fresh) {
          token.role = fresh.role;
          token.mustChangePassword = fresh.mustChangePassword;
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.mustChangePassword = token.mustChangePassword;
      return session;
    },
  },
});
