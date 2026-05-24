"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signInAction, type SignInState } from "./actions";

const initial: SignInState = {};

export function LoginForm() {
  const sp = useSearchParams();
  const from = sp.get("from") ?? "/";
  const justChanged = sp.get("changed") === "1";
  const [state, formAction, isPending] = useActionState(signInAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="from" value={from} />

      {justChanged && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Password updated. Sign in with your new password.
        </p>
      )}

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-xs font-medium uppercase tracking-widest text-neutral-500"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-xs font-medium uppercase tracking-widest text-neutral-500"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300"
        />
      </div>

      {state?.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
