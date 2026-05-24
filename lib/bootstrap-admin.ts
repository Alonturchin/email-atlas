import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Create the first admin from ADMIN_EMAIL + ADMIN_PASSWORD env vars, IF those
 * are set and no user with that email exists yet. Runs once per container
 * boot via instrumentation.ts. Safe to re-run — it's a no-op on subsequent calls.
 */
export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("[auth] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin bootstrap");
    return;
  }
  if (password === "change_me_on_first_login") {
    console.log("[auth] ADMIN_PASSWORD is still the placeholder — skipping bootstrap");
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Promote to admin if they exist as a member, but never overwrite their password.
      if (existing.role !== "ADMIN") {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: "ADMIN" },
        });
        console.log(`[auth] promoted existing user to ADMIN: ${email}`);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "ADMIN",
        mustChangePassword: true,
      },
    });
    console.log(`[auth] bootstrapped first admin: ${email}`);
  } catch (err) {
    console.error("[auth] bootstrap-admin failed:", err);
  }
}
