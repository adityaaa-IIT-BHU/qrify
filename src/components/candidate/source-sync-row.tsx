"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SourceSyncRow({
  label,
  lastSyncedAt,
  syncUrl,
  connectHref,
}: {
  label: string;
  lastSyncedAt: string | null;
  syncUrl?: string;
  connectHref?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update() {
    if (!syncUrl) return;
    setBusy(true);
    try {
      await fetch(syncUrl, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-neutral-100 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-neutral-500">{lastSyncedAt ? `Last synced: ${new Date(lastSyncedAt).toLocaleString()}` : "Not connected"}</p>
      </div>
      {syncUrl ? (
        <button onClick={update} disabled={busy} className="text-xs font-medium underline">
          {busy ? "Syncing…" : "Update"}
        </button>
      ) : connectHref ? (
        <a href={connectHref} className="text-xs font-medium underline">
          Connect
        </a>
      ) : null}
    </div>
  );
}
