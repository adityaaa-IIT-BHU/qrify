"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PrepareResult } from "@/lib/applications/service";

interface Props {
  prepared: PrepareResult;
}

type Phase = "ready" | "review" | "applying" | "applied" | "error";

export function ApplyFlow({ prepared }: Props) {
  const { serverPrepareMs } = prepared;
  const mountedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>(prepared.eligibleForFastApply ? "ready" : "review");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const autoSubmit = prepared.consentMode === "INSTANT" && prepared.eligibleForFastApply;

  useEffect(() => {
    if (autoSubmit) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    setPhase("applying");
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/applications/${prepared.applicationId}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setElapsedMs(serverPrepareMs + (Date.now() - mountedAt));
      setPhase("applied");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
    }
  }

  async function submitAnswersThenApply() {
    setPhase("applying");
    setErrorMessage(null);
    try {
      const missing = prepared.missingRequiredQuestionIds;
      if (missing.length > 0) {
        const payload = missing.map((id) => ({ screeningQuestionId: id, answerText: answers[id] ?? "" }));
        if (payload.some((a) => !a.answerText.trim())) {
          setPhase("review");
          setErrorMessage("Please answer every required question.");
          return;
        }
        const res = await fetch(`/api/applications/${prepared.applicationId}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: payload }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Could not save answers");
      }
      await submit();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setPhase("review");
    }
  }

  if (phase === "applied") {
    return (
      <Screen>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">✓</div>
        <h1 className="mt-6 text-2xl font-semibold">Applied</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {prepared.jobTitle} · {prepared.companyName}
        </p>
        {elapsedMs !== null && (
          <p className="mt-4 text-sm font-medium text-emerald-700">{(elapsedMs / 1000).toFixed(1)} seconds, scan to submit</p>
        )}
        <Link
          href={`/candidate/applications/${prepared.applicationId}`}
          className="mt-8 text-sm text-neutral-600 underline"
        >
          View what was sent
        </Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <p className="text-sm uppercase tracking-wide text-neutral-500">{prepared.companyName}</p>
      <h1 className="mt-1 text-2xl font-semibold">{prepared.jobTitle}</h1>

      <div className="mt-6 w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Matched from your profile</p>
        <p className="mt-2 text-2xl font-semibold text-neutral-900">{prepared.matchResult.score}% match</p>
        <ul className="mt-3 space-y-1">
          {prepared.matchResult.matches
            .filter((m) => m.matched)
            .slice(0, 5)
            .map((m) => (
              <li key={m.requirementId} className="text-sm text-neutral-600">
                <span className="text-emerald-600">✓</span> {m.label}
              </li>
            ))}
        </ul>
        {prepared.matchResult.gaps.length > 0 && (
          <p className="mt-3 text-xs text-amber-600">
            {prepared.matchResult.gaps.length} must-have requirement{prepared.matchResult.gaps.length > 1 ? "s" : ""} not
            found in your profile.
          </p>
        )}

        <div className="mt-4 border-t border-neutral-100 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Resume</p>
          <p className="mt-1 text-sm text-neutral-700">
            {prepared.hasResume ? "Ready to send" : "No resume on file yet"}
            {prepared.resumeFileUrl && (
              <>
                {" "}
                ·{" "}
                <a href={prepared.resumeFileUrl} target="_blank" rel="noreferrer" className="underline">
                  preview
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      {phase === "review" && (
        <div className="mt-6 w-full max-w-sm space-y-4 text-left">
          {!prepared.hasResume && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              You need a resume on file before applying.{" "}
              <Link href="/candidate/resumes" className="underline">
                Upload one
              </Link>
              .
            </p>
          )}
          {prepared.missingRequiredQuestionIds.map((qId) => {
            const q = prepared.answers.find((a) => a.screeningQuestionId === qId);
            return (
              <label key={qId} className="block">
                <span className="text-sm font-medium text-neutral-800">{q?.questionText}</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
                  rows={2}
                  value={answers[qId] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [qId]: e.target.value }))}
                />
              </label>
            );
          })}
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          {prepared.hasResume && (
            <button
              onClick={submitAnswersThenApply}
              className="w-full rounded-full bg-neutral-900 py-3 text-sm font-medium text-white"
            >
              Submit application
            </button>
          )}
        </div>
      )}

      {(phase === "ready" || phase === "applying") && (
        <button
          onClick={submit}
          disabled={phase === "applying"}
          className="mt-8 w-full max-w-sm rounded-full bg-neutral-900 py-4 text-base font-semibold text-white disabled:opacity-60"
        >
          {phase === "applying" ? "Applying…" : "Apply →"}
        </button>
      )}

      {phase === "error" && (
        <div className="mt-6 w-full max-w-sm">
          <p className="text-sm text-red-600">{errorMessage}</p>
          <button onClick={submit} className="mt-3 w-full rounded-full bg-neutral-900 py-3 text-sm font-medium text-white">
            Try again
          </button>
        </div>
      )}
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-neutral-50 px-6 py-16 text-center">{children}</main>
  );
}
