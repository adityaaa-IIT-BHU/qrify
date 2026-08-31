"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SAMPLE_JD = `Senior Backend Engineer — Acme Labs

We're looking for a Senior Backend Engineer to join our platform team in Bengaluru (hybrid).

Requirements:
- 5+ years of backend engineering experience
- Strong experience with Node.js or Go, and PostgreSQL
- Experience designing REST APIs at scale
- Nice to have: Kubernetes, Redis, exposure to event-driven architectures

You'll own core services powering our payments platform, mentor junior engineers, and work closely with product on system design.

Are you authorized to work in India? (yes/no)
What is your notice period?`;

export function NewJobForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [rawDescription, setRawDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, rawDescription }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(data.error ?? "Something went wrong");
      router.push(`/employer/jobs/${data.job?.id ?? data.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Turn a job description into a 5-second application</h1>
        <p className="mt-1 text-sm text-neutral-500">Paste it below — QRify parses requirements and screening questions automatically.</p>
      </div>

      <label className="block text-sm font-medium">
        Company name
        <input
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Acme Labs"
          className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 text-sm font-normal"
        />
      </label>

      <label className="block text-sm font-medium">
        Job description
        <textarea
          required
          minLength={30}
          rows={14}
          value={rawDescription}
          onChange={(e) => setRawDescription(e.target.value)}
          placeholder="Paste the full job description…"
          className="mt-1 w-full rounded-lg border border-neutral-300 p-3 text-sm font-normal"
        />
        <button
          type="button"
          onClick={() => setRawDescription(SAMPLE_JD)}
          className="mt-1 text-xs text-neutral-500 underline"
        >
          Use a sample JD
        </button>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={busy} className="w-full rounded-full bg-neutral-900 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Parsing job description…" : "Parse with AI"}
      </button>
    </form>
  );
}
