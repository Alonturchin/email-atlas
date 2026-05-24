import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <LogoMark className="h-9 w-9" />
          <span className="text-xl font-semibold tracking-tight">
            Inbox <span className="text-orange-600">Atlas</span>
          </span>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold">Sign in</h1>
          <p className="mb-6 text-sm text-neutral-500">
            Use the credentials provided by your administrator.
          </p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <rect width="32" height="32" rx="6" fill="#0a0a0a" />
      <path d="M16 5 L27.5 27 L4.5 27 Z" fill="#ea580c" />
      <rect x="10.5" y="20" width="11" height="2.2" rx="0.4" fill="#0a0a0a" />
    </svg>
  );
}
