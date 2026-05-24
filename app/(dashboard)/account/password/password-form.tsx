"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "./actions";

const initial: ChangePasswordState = {};

export function PasswordForm({ forced }: { forced: boolean }) {
  const [state, formAction, isPending] = useActionState<
    ChangePasswordState,
    FormData
  >(changePasswordAction, initial);
  const [signingOut, setSigningOut] = useState(false);

  // On success, sign the user out so they have to re-authenticate with the
  // new password. Clears the JWT cookie and bounces back to /login with a
  // success banner via the query param.
  useEffect(() => {
    if (state?.ok && !signingOut) {
      setSigningOut(true);
      signOut({ callbackUrl: "/login?changed=1" });
    }
  }, [state?.ok, signingOut]);

  return (
    <form action={formAction} className="space-y-4">
      <Field
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
      />
      <Field
        name="newPassword"
        label="New password (8+ characters)"
        autoComplete="new-password"
        minLength={8}
      />
      <Field
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        minLength={8}
      />

      {state?.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Updated. Signing you out — sign back in with your new password…
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {!forced && (
          <Link
            href="/"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:border-neutral-400 hover:text-neutral-900"
          >
            Cancel
          </Link>
        )}
        <button
          type="submit"
          disabled={isPending || signingOut}
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : signingOut ? "Signing out…" : "Update password"}
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  autoComplete,
  minLength,
}: {
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-xs font-medium uppercase tracking-widest text-neutral-500"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        required
        minLength={minLength}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300"
      />
    </div>
  );
}
