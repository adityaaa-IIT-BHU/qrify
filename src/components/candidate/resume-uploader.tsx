"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ResumeUploader() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("label", file.name.replace(/\.(pdf|txt)$/i, ""));
      const res = await fetch("/api/candidate/resumes", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setMessage("Uploaded and parsed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-sm font-medium">Upload a resume</p>
      <p className="mt-1 text-sm text-neutral-500">PDF or plain text. Your first upload becomes your master resume.</p>
      <div className="mt-3 flex items-center gap-3">
        <input ref={fileInputRef} type="file" accept=".pdf,.txt" className="text-sm" />
        <button onClick={upload} disabled={busy} className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
