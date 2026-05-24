"use client";

import { useActionState, useState } from "react";
import { Trash2, KeyRound, UserPlus } from "lucide-react";
import {
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  type CreateUserState,
  type ResetPasswordState,
} from "./actions";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "MEMBER";
  createdAt: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}

interface Props {
  users: UserRow[];
  currentUserId: string;
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function UsersAdminClient({ users, currentUserId }: Props) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Users</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Admins can create members, reset passwords, and revoke access. Members
        can browse the gallery and favorite campaigns, but can't see this page.
      </p>

      <CreateUserForm />

      <section className="mt-10">
        <h2 className="mb-3 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
          {users.length} {users.length === 1 ? "user" : "users"}
        </h2>
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-left">Last login</th>
                <th className="px-4 py-2 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {users.map((u) => (
                <UserRowItem
                  key={u.id}
                  user={u}
                  isSelf={u.id === currentUserId}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CreateUserForm() {
  const [state, formAction, isPending] = useActionState<
    CreateUserState,
    FormData
  >(createUserAction, {});

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-neutral-500" />
        <h2 className="text-sm font-medium">Add a user</h2>
      </div>
      <form action={formAction} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="email"
            name="email"
            required
            placeholder="email@example.com"
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
          />
          <input
            type="text"
            name="name"
            placeholder="display name (optional)"
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <input
            type="text"
            name="password"
            required
            minLength={8}
            placeholder="temporary password (8+ chars)"
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
          />
          <select
            name="role"
            defaultValue="MEMBER"
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {isPending ? "Adding…" : "Add user"}
          </button>
        </div>
      </form>
      {state?.error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          User created. Share the temp password with them out-of-band.
        </p>
      )}
    </section>
  );
}

function UserRowItem({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  return (
    <tr className="text-sm text-neutral-900">
      <td className="px-4 py-3 align-top font-medium">
        {user.email}
        {isSelf && (
          <span className="ml-2 rounded-sm border border-neutral-200 px-1 py-px text-[9px] font-medium uppercase tracking-widest text-neutral-500">
            you
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-top text-neutral-700">
        {user.name || "—"}
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={
            user.role === "ADMIN"
              ? "rounded-sm bg-orange-600 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-white"
              : "rounded-sm border border-neutral-300 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-neutral-700"
          }
        >
          {user.role}
        </span>
        {user.mustChangePassword && (
          <span
            className="ml-2 text-[10px] uppercase tracking-widest text-neutral-500"
            title="Must change password on next login (planned)"
          >
            temp pw
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-top text-neutral-500">
        {DATE_FMT.format(new Date(user.createdAt))}
      </td>
      <td className="px-4 py-3 align-top text-neutral-500">
        {user.lastLoginAt ? DATE_FMT.format(new Date(user.lastLoginAt)) : "never"}
      </td>
      <td className="px-4 py-3 align-top text-right">
        <div className="flex justify-end gap-1">
          <ResetPasswordButton userId={user.id} email={user.email} />
          {!isSelf && (
            <form action={deleteUserAction}>
              <input type="hidden" name="userId" value={user.id} />
              <button
                type="submit"
                aria-label={`Delete ${user.email}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}

function ResetPasswordButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    ResetPasswordState,
    FormData
  >(resetPasswordAction, {});

  if (state?.ok && open) {
    // Auto-close on success
    setTimeout(() => setOpen(false), 600);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Reset password for ${email}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-900"
      >
        <KeyRound className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 px-4">
          <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold">Reset password</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Setting a new temporary password for{" "}
              <span className="text-neutral-900">{email}</span>.
            </p>
            <form action={formAction} className="mt-4 space-y-3">
              <input type="hidden" name="userId" value={userId} />
              <input
                type="text"
                name="password"
                required
                minLength={8}
                autoFocus
                placeholder="new temporary password (8+ chars)"
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
              />
              {state?.error && (
                <p className="text-xs text-red-700">{state.error}</p>
              )}
              {state?.ok && (
                <p className="text-xs text-emerald-700">Password updated.</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
