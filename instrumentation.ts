/**
 * Next.js instrumentation hook — runs once per Node server boot.
 * Used to bootstrap the first admin user when ADMIN_EMAIL / ADMIN_PASSWORD
 * are set. Skipped on edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrapAdmin } = await import("./lib/bootstrap-admin");
  await bootstrapAdmin();
}
