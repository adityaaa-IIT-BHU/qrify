"use client";

import { useState } from "react";

interface VaultAnswer {
  id: string;
  questionKey: string;
  answerText: string;
  approvedForReuse: boolean;
}

const LABELS: Record<string, string> = {
  WORK_AUTHORIZATION: "Work authorization",
  NOTICE_PERIOD: "Notice period",
  RELOCATION: "Willing to relocate",
  SALARY_EXPECTATION: "Salary expectation",
  REMOTE_PREFERENCE: "Remote preference",
  MOTIVATION: "Why you're job hunting",
};

const ADDABLE_KEYS = Object.keys(LABELS);

export function AnswerVault({ initial }: { initial: VaultAnswer[] }) {
  const [answers, setAnswers] = useState(initial);
  // Keyed by answer id, only holds entries the user has actually edited —
  // an id with no entry here just renders `a.answerText` (see the JSX
  // fallback below). No effect needed to keep this "in sync" with
  // `answers`: a fresh save already updates `answers` itself, and a newly
  // added answer starts with no draft override, which is correct.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newText, setNewText] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/candidate/answers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerText: drafts[id] }),
      });
      if (res.ok) setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, answerText: drafts[id] } : a)));
    } finally {
      setBusy(false);
    }
  }

  async function toggleReuse(id: string, approvedForReuse: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/candidate/answers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedForReuse }),
      });
      if (res.ok) setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, approvedForReuse } : a)));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/candidate/answers/${id}`, { method: "DELETE" });
      if (res.ok) setAnswers((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!newKey || !newText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/candidate/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionKey: newKey, answerText: newText.trim() }),
      });
      if (res.ok) {
        const { answer } = await res.json();
        setAnswers((prev) => [...prev.filter((a) => a.questionKey !== newKey), answer]);
        setNewKey("");
        setNewText("");
      }
    } finally {
      setBusy(false);
    }
  }

  const availableKeys = ADDABLE_KEYS.filter((k) => !answers.some((a) => a.questionKey === k));

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Reusable answers to common screening questions. Only answers marked &ldquo;reusable&rdquo; are auto-filled into new
        applications — nothing here is used without your approval.
      </p>

      {answers.map((a) => (
        <div key={a.id} className="rounded-lg border border-neutral-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{LABELS[a.questionKey] ?? a.questionKey}</p>
            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
              <input
                type="checkbox"
                checked={a.approvedForReuse}
                onChange={(e) => toggleReuse(a.id, e.target.checked)}
                disabled={busy}
              />
              Reusable
            </label>
          </div>
          <textarea
            value={drafts[a.id] ?? a.answerText}
            onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
            rows={2}
            className="mt-2 w-full rounded-md border border-neutral-300 p-2 text-sm"
          />
          <div className="mt-2 flex gap-3">
            <button onClick={() => save(a.id)} disabled={busy} className="text-xs font-medium underline">
              Save
            </button>
            <button onClick={() => remove(a.id)} disabled={busy} className="text-xs font-medium text-red-600 underline">
              Remove
            </button>
          </div>
        </div>
      ))}

      {availableKeys.length > 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-3">
          <p className="text-sm font-medium">Add a saved answer</p>
          <select value={newKey} onChange={(e) => setNewKey(e.target.value)} className="mt-2 w-full rounded-md border border-neutral-300 p-2 text-sm">
            <option value="">Choose a question…</option>
            {availableKeys.map((k) => (
              <option key={k} value={k}>
                {LABELS[k]}
              </option>
            ))}
          </select>
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Your answer…"
            rows={2}
            className="mt-2 w-full rounded-md border border-neutral-300 p-2 text-sm"
          />
          <button onClick={add} disabled={busy || !newKey || !newText.trim()} className="mt-2 rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60">
            Add
          </button>
        </div>
      )}
    </div>
  );
}
