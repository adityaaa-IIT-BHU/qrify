"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SourceSyncRow({
  label,
  lastSyncedAt,
  syncUrl,
  connectHref,
  sourceId,
}: {
  label: string;
  lastSyncedAt: string | null;
  syncUrl?: string;
  connectHref?: string;
  /** When set, shows a "Disconnect" action that removes the facts this source produced. */
  sourceId?: string;
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

  async function disconnect() {
    if (!sourceId) return;
    if (!confirm(`Disconnect ${label}? This removes the profile facts it added.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/candidate/sources/${sourceId}`, { method: "DELETE" });
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
      <div className="flex items-center gap-3">
        {syncUrl ? (
          <button onClick={update} disabled={busy} className="text-xs font-medium underline">
            {busy ? "Syncing…" : "Update"}
          </button>
        ) : connectHref ? (
          <a href={connectHref} className="text-xs font-medium underline">
            Connect
          </a>
        ) : null}
        {sourceId && (
          <button onClick={disconnect} disabled={busy} className="text-xs font-medium text-red-600 underline">
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
