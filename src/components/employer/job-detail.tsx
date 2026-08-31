"use client";

import { useEffect, useState } from "react";

interface Requirement {
  id: string;
  kind: string;
  category: string;
  label: string;
}
interface ScreeningQuestion {
  id: string;
  questionText: string;
  required: boolean;
}
interface JobData {
  id: string;
  title: string;
  status: string;
  location: string | null;
  compensationMin: number | null;
  compensationMax: number | null;
  recruiterEmail: string | null;
  workAuthorizationRequirement: string | null;
  requirements: Requirement[];
  screeningQuestions: ScreeningQuestion[];
}

interface Applicant {
  id: string;
  status: string;
  matchScore: number | null;
  submittedAt: string | null;
  candidateProfile: { user: { name: string | null; email: string } };
  artifacts: Array<{ type: string; resumeVersionId: string | null }>;
}

export function JobDetail({ job }: { job: JobData }) {
  const [location, setLocation] = useState(job.location ?? "");
  const [recruiterEmail, setRecruiterEmail] = useState(job.recruiterEmail ?? "");
  const [saving, setSaving] = useState(false);

  const [qr, setQr] = useState<{ applyUrl: string; pngDataUrl: string; svg: string } | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);

  const [applicants, setApplicants] = useState<Applicant[] | null>(null);

  useEffect(() => {
    void loadApplicants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadApplicants() {
    const res = await fetch(`/api/employer/jobs/${job.id}/applicants`);
    if (res.ok) setApplicants((await res.json()).applications);
  }

  async function saveDetails() {
    setSaving(true);
    try {
      await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: location || null, recruiterEmail: recruiterEmail || null }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function generateQr() {
    setGeneratingQr(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "APPLY" }),
      });
      const data = await res.json();
      setQr(data);
    } finally {
      setGeneratingQr(false);
    }
  }

  async function setStatus(applicationId: string, status: "SHORTLISTED" | "REJECTED") {
    await fetch(`/api/applications/${applicationId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void loadApplicants();
  }

  const mustHave = job.requirements.filter((r) => r.kind === "MUST_HAVE");
  const niceToHave = job.requirements.filter((r) => r.kind === "NICE_TO_HAVE");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Parsed requirements</h2>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-neutral-500">Must-have</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {mustHave.map((r) => (
                  <li key={r.id} className="rounded-full bg-neutral-900 px-3 py-1 text-xs text-white">
                    {r.label}
                  </li>
                ))}
              </ul>
            </div>
            {niceToHave.length > 0 && (
              <div>
                <p className="text-xs font-medium text-neutral-500">Nice-to-have</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {niceToHave.map((r) => (
                    <li key={r.id} className="rounded-full border border-neutral-300 px-3 py-1 text-xs">
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {job.screeningQuestions.length > 0 && (
            <div className="mt-5 border-t border-neutral-100 pt-4">
              <p className="text-xs font-medium text-neutral-500">Screening questions</p>
              <ul className="mt-2 space-y-1 text-sm">
                {job.screeningQuestions.map((q) => (
                  <li key={q.id}>
                    • {q.questionText} {q.required && <span className="text-neutral-400">(required)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4">
            <label className="text-sm font-medium">
              Location
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm font-normal" />
            </label>
            <label className="text-sm font-medium">
              Recruiter email (optional)
              <input value={recruiterEmail} onChange={(e) => setRecruiterEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm font-normal" />
            </label>
          </div>
          <button onClick={saveDetails} disabled={saving} className="mt-3 rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Applicants ({applicants?.length ?? 0})</h2>
          {applicants && applicants.length === 0 && <p className="mt-3 text-sm text-neutral-500">No applicants yet — share the QR code.</p>}
          <ul className="mt-3 divide-y divide-neutral-100">
            {applicants?.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{a.candidateProfile.user.name ?? a.candidateProfile.user.email}</p>
                  <p className="text-xs text-neutral-500">
                    {a.matchScore !== null ? `${Math.round(a.matchScore)}% match` : ""} · {a.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStatus(a.id, "SHORTLISTED")} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    Shortlist
                  </button>
                  <button onClick={() => setStatus(a.id, "REJECTED")} className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="h-fit rounded-2xl border border-neutral-200 bg-white p-6 text-center">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Application QR</h2>
        {qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.pngDataUrl} alt="Application QR code" className="mx-auto mt-4 h-56 w-56" />
            <p className="mt-3 break-all text-xs text-neutral-500">{qr.applyUrl}</p>
            <div className="mt-4 flex flex-col gap-2">
              <a href={qr.pngDataUrl} download={`qrify-${job.id}.png`} className="rounded-full border border-neutral-300 py-2 text-xs font-medium">
                Download PNG
              </a>
              <a
                href={`data:image/svg+xml;utf8,${encodeURIComponent(qr.svg)}`}
                download={`qrify-${job.id}.svg`}
                className="rounded-full border border-neutral-300 py-2 text-xs font-medium"
              >
                Download SVG
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(qr.applyUrl)}
                className="rounded-full bg-neutral-900 py-2 text-xs font-medium text-white"
              >
                Copy link
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-neutral-500">Generate a QR code candidates can scan to apply.</p>
            <button onClick={generateQr} disabled={generatingQr} className="mt-4 w-full rounded-full bg-neutral-900 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {generatingQr ? "Generating…" : "Generate QR"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
