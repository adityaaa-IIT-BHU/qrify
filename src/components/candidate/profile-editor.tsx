"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initial: {
    headline: string;
    location: string;
    workAuthorization: string;
    noticePeriodDays: string;
  };
  consentMode: "REVIEW" | "ONE_TAP" | "INSTANT";
}

export function ProfileEditor({ initial, consentMode }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [mode, setMode] = useState(consentMode);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await fetch("/api/candidate/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: form.headline,
          location: form.location,
          workAuthorization: form.workAuthorization,
          noticePeriodDays: form.noticePeriodDays ? Number(form.noticePeriodDays) : null,
        }),
      });
      if (mode !== consentMode) {
        await fetch("/api/candidate/consent", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
      }
      setSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Headline" value={form.headline} onChange={(v) => setForm({ ...form, headline: v })} />
      <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
      <Field label="Work authorization" value={form.workAuthorization} onChange={(v) => setForm({ ...form, workAuthorization: v })} />
      <Field
        label="Notice period (days)"
        value={form.noticePeriodDays}
        onChange={(v) => setForm({ ...form, noticePeriodDays: v })}
        type="number"
      />

      <div>
        <p className="text-sm font-medium">Application mode</p>
        <div className="mt-2 flex gap-2">
          {(["REVIEW", "ONE_TAP", "INSTANT"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${mode === m ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}
            >
              {m.replace("_", "-")}
            </button>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={busy} className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-60">
        {saved ? "Saved ✓" : "Save changes"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm font-normal"
      />
    </label>
  );
}
