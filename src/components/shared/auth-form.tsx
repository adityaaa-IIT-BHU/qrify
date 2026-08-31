"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  mode: "login" | "signup";
  next: string;
  error?: string;
  githubEnabled: boolean;
  googleEnabled: boolean;
}

export function AuthForm({ mode, next, error, githubEnabled, googleEnabled }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(error ?? null);
  const [magicSent, setMagicSent] = useState(false);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push(next);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function requestMagicLink() {
    if (!email) {
      setFormError("Enter your email first");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setMagicSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col">
      <h1 className="text-2xl font-semibold">{mode === "login" ? "Sign in" : "Create your account"}</h1>

      <div className="mt-6 space-y-2">
        {googleEnabled && (
          <a
            href={`/api/auth/oauth/google?next=${encodeURIComponent(next)}`}
            className="block w-full rounded-full border border-neutral-300 py-2.5 text-center text-sm font-medium"
          >
            Continue with Google
          </a>
        )}
        {githubEnabled && (
          <a
            href={`/api/auth/oauth/github?next=${encodeURIComponent(next)}`}
            className="block w-full rounded-full border border-neutral-300 py-2.5 text-center text-sm font-medium"
          >
            Continue with GitHub
          </a>
        )}
      </div>

      {(googleEnabled || githubEnabled) && (
        <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
          <div className="h-px flex-1 bg-neutral-200" />
          or
          <div className="h-px flex-1 bg-neutral-200" />
        </div>
      )}

      {magicSent ? (
        <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
          Check your email — we sent a sign-in link to {email}.
        </p>
      ) : (
        <form onSubmit={submitPassword} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            onClick={requestMagicLink}
            disabled={busy}
            className="w-full text-center text-xs text-neutral-500 underline"
          >
            Or email me a sign-in link instead
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-neutral-500">
        {mode === "login" ? (
          <>
            New to QRify?{" "}
            <Link href={`/signup?next=${encodeURIComponent(next)}`} className="underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
