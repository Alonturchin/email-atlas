"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

async function assertAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}

const CreateSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export type CreateUserState = { error?: string; ok?: boolean };

export async function createUserAction(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  await assertAdmin();

  const parsed = CreateSchema.safeParse({
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
    name: String(formData.get("name") ?? "").trim() || undefined,
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? "MEMBER"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: `${first.path.join(".")}: ${first.message}` };
  }

  const { email, name, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: `A user with email ${email} already exists.` };

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role,
      mustChangePassword: true,
    },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUserAction(formData: FormData) {
  const session = await assertAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  if (userId === session.user.id) {
    // Can't delete yourself — would lock you out.
    return;
  }
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}

const ResetSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8),
});

export type ResetPasswordState = { error?: string; ok?: boolean };

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  await assertAdmin();

  const parsed = ResetSchema.safeParse({
    userId: String(formData.get("userId") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: `${first.path.join(".")}: ${first.message}` };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { passwordHash, mustChangePassword: true },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
