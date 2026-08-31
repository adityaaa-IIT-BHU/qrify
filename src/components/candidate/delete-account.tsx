"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/candidate/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, password: hasPassword ? password : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete account");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete account");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-sm font-medium text-red-600 underline">
        Delete my account
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-800">
        This deactivates your account, revokes every session, and disconnects Google/GitHub — immediately, and it
        can&apos;t be undone from here. Applications you&apos;ve already submitted stay on record with the employers you
        sent them to.
      </p>
      {hasPassword && (
        <input
          type="password"
          placeholder="Confirm your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-red-300 p-2 text-sm"
        />
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={deleteAccount}
          disabled={busy || (hasPassword && !password)}
          className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Deleting…" : "Yes, delete my account"}
        </button>
        <button onClick={() => setConfirming(false)} className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium">
          Cancel
        </button>
      </div>
    </div>
  );
}
