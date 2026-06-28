import { LockKeyhole } from "lucide-react";
import { authConfigured, sanitizeNextPath } from "@/lib/session";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const configured = authConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center bg-console-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-md border border-console-line bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#dd4814] text-white">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-console-ink">Operator Login</h1>
            <p className="text-sm text-console-muted">Ubuntu Ops Control Console</p>
          </div>
        </div>

        {!configured ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Web authentication is not configured.
          </div>
        ) : null}

        {params.error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Invalid operator password.
          </div>
        ) : null}

        <form action="/auth/login" method="post" className="space-y-4">
          <input type="hidden" name="next" value={nextPath} />
          <label className="block text-sm font-medium text-console-ink">
            Password
            <input
              className="mt-2 w-full rounded-md border border-console-line px-3 py-2 text-console-ink outline-none transition focus:border-[#dd4814] focus:ring-2 focus:ring-[#dd4814]/20"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button
            className="w-full rounded-md bg-[#dd4814] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c13f12]"
            type="submit"
            disabled={!configured}
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
