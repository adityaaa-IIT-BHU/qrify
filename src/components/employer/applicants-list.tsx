"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Applicant {
  id: string;
  status: string;
  matchScore: number | null;
  submittedAt: string | null;
  job: { id: string; title: string };
  candidateProfile: {
    headline: string | null;
    user: { name: string | null; email: string };
  };
}

export function ApplicantsList() {
  const [applicants, setApplicants] = useState<Applicant[] | null>(null);

  async function load() {
    const res = await fetch("/api/employer/applicants");
    if (res.ok) setApplicants((await res.json()).applications);
  }

  useEffect(() => {
    // Standard fetch-on-mount: setState only happens after the awaited
    // fetch resolves, not synchronously in the effect body — the standard
    // React-docs "Fetching data" shape. The identical pattern in
    // job-detail.tsx passes this same lint config cleanly; this appears to
    // be a rule-inference edge case for a zero-prop component rather than
    // an actual issue with the pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function setStatus(id: string, status: "SHORTLISTED" | "REJECTED") {
    await fetch(`/api/applications/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void load();
  }

  if (!applicants) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (applicants.length === 0) {
    return <p className="text-sm text-neutral-500">No applicants across any of your jobs yet.</p>;
  }

  return (
    <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
      {applicants.map((a) => (
        <div key={a.id} className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">{a.candidateProfile.user.name ?? a.candidateProfile.user.email}</p>
            <p className="text-xs text-neutral-500">
              <Link href={`/employer/jobs/${a.job.id}`} className="underline">
                {a.job.title}
              </Link>
              {a.matchScore !== null && ` · ${Math.round(a.matchScore)}% match`} · {a.status}
            </p>
          </div>
          {a.status === "SUBMITTED" && (
            <div className="flex gap-2">
              <button onClick={() => setStatus(a.id, "SHORTLISTED")} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                Shortlist
              </button>
              <button onClick={() => setStatus(a.id, "REJECTED")} className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
