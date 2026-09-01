"use client";

import { useState } from "react";

export function VerifyEmailBanner() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      await fetch("/api/auth/verify-email/resend", { method: "POST" });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>Verify your email to publish a job QR — candidates can only apply to jobs from a verified employer.</p>
      {sent ? (
        <span className="text-xs font-medium">Sent — check your inbox</span>
      ) : (
        <button onClick={resend} disabled={busy} className="text-xs font-medium underline">
          {busy ? "Sending…" : "Resend verification email"}
        </button>
      )}
    </div>
  );
}
