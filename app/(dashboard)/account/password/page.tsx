import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PasswordForm } from "./password-form";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Change password</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Signed in as <span className="text-neutral-900">{session.user.email}</span>
      </p>

      {session.user.mustChangePassword && (
        <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          You're using a temporary password. Set a new one before continuing to
          the dashboard.
        </div>
      )}

      <div className="mt-6 rounded-md border border-neutral-200 bg-white p-6">
        <PasswordForm forced={session.user.mustChangePassword} />
      </div>
    </div>
  );
}
