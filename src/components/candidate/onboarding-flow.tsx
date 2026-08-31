"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "connect" | "voice" | "review" | "consent";

interface VoicePrompt {
  key: string;
  text: string;
}

// Minimal ambient type for the Web Speech API — not in lib.dom.d.ts, and support is Chrome/Edge/Safari only.
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

export function OnboardingFlow({ githubConnected }: { githubConnected: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("connect");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // resume upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);

  // voice
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<VoicePrompt[]>([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [recording, setRecording] = useState(false);
  const [extractedSummary, setExtractedSummary] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // review fields
  const [headline, setHeadline] = useState("");
  const [location, setLocation] = useState("");
  const [workAuthorization, setWorkAuthorization] = useState("");

  // consent
  const [consentMode, setConsentMode] = useState<"REVIEW" | "ONE_TAP" | "INSTANT">("ONE_TAP");

  async function uploadResume() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("label", "Master resume");
      const res = await fetch("/api/candidate/resumes", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setResumeUploaded(true);
      setMessage("Resume parsed — we pulled your experience, skills, and projects from it.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function connectGithubSync() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/candidate/sync/github", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "GitHub sync failed");
      setMessage(`Synced ${data.projectsAdded} public repos and ${data.skillsAdded} languages from GitHub.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "GitHub sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function startVoice() {
    setBusy(true);
    try {
      const res = await fetch("/api/candidate/voice/session", { method: "POST" });
      const data = await res.json();
      setVoiceSessionId(data.session.id);
      setPrompts(data.prompts);
      setStep("voice");
    } finally {
      setBusy(false);
    }
  }

  function toggleRecording() {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setMessage("Voice capture isn't supported in this browser — type your answer instead.");
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript + " ";
      setAnswer((prev) => (prev ? prev + " " : "") + text.trim());
    };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  async function nextPrompt() {
    if (!voiceSessionId) return;
    const current = prompts[promptIndex];
    if (answer.trim()) {
      await fetch(`/api/candidate/voice/session/${voiceSessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptKey: current.key, promptText: current.text, rawText: answer.trim() }),
      });
    }
    setAnswer("");
    if (promptIndex + 1 < prompts.length) {
      setPromptIndex(promptIndex + 1);
    } else {
      setBusy(true);
      try {
        const res = await fetch(`/api/candidate/voice/session/${voiceSessionId}`, { method: "PATCH" });
        const data = await res.json();
        const counts = data.extraction
          ? `${data.extraction.experiences.length} experiences, ${data.extraction.skills.length} skills, ${data.extraction.projects.length} projects`
          : "nothing new";
        setExtractedSummary(`Pulled ${counts} from what you told us.`);
      } finally {
        setBusy(false);
        setStep("review");
      }
    }
  }

  async function saveReviewAndContinue() {
    setBusy(true);
    try {
      await fetch("/api/candidate/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(headline ? { headline } : {}),
          ...(location ? { location } : {}),
          ...(workAuthorization ? { workAuthorization } : {}),
        }),
      });
      setStep("consent");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      await fetch("/api/candidate/consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: consentMode }),
      });
      router.push("/candidate");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <ProgressDots step={step} />

      {step === "connect" && (
        <section className="mt-8 space-y-6">
          <h1 className="text-2xl font-semibold">Build your career profile</h1>
          <p className="text-sm text-neutral-600">Connect what you already have — this takes under a minute.</p>

          <div className="rounded-2xl border border-neutral-200 p-5">
            <p className="font-medium">Resume</p>
            <p className="mt-1 text-sm text-neutral-500">PDF or plain text. We&apos;ll extract your experience automatically.</p>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt" className="mt-3 text-sm" />
            <button
              onClick={uploadResume}
              disabled={busy}
              className="mt-3 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {resumeUploaded ? "Uploaded ✓" : "Upload"}
            </button>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-5">
            <p className="font-medium">GitHub</p>
            <p className="mt-1 text-sm text-neutral-500">
              {githubConnected ? "Connected — pull in your public repos as projects." : "Sign in with GitHub to connect it."}
            </p>
            {githubConnected ? (
              <button
                onClick={connectGithubSync}
                disabled={busy}
                className="mt-3 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                Sync GitHub
              </button>
            ) : (
              <a
                href={`/api/auth/oauth/github?next=${encodeURIComponent("/onboarding")}`}
                className="mt-3 inline-block rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium"
              >
                Connect GitHub
              </a>
            )}
          </div>

          {message && <p className="text-sm text-neutral-600">{message}</p>}

          <button onClick={startVoice} disabled={busy} className="w-full rounded-full bg-neutral-900 py-3 text-sm font-semibold text-white">
            Continue — tell QRify about yourself
          </button>
        </section>
      )}

      {step === "voice" && prompts.length > 0 && (
        <section className="mt-8 space-y-4">
          <p className="text-xs uppercase tracking-wide text-neutral-400">
            Question {promptIndex + 1} of {prompts.length}
          </p>
          <h1 className="text-xl font-semibold">{prompts[promptIndex].text}</h1>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Speak or type your answer…"
            rows={5}
            className="w-full rounded-xl border border-neutral-300 p-3 text-sm"
          />
          <div className="flex gap-3">
            <button
              onClick={toggleRecording}
              className={`rounded-full px-4 py-2 text-sm font-medium ${recording ? "bg-red-600 text-white" : "border border-neutral-300"}`}
            >
              {recording ? "Stop recording" : "🎤 Record"}
            </button>
            <button onClick={nextPrompt} disabled={busy} className="flex-1 rounded-full bg-neutral-900 py-2 text-sm font-semibold text-white">
              {promptIndex + 1 < prompts.length ? "Next" : "Finish"}
            </button>
          </div>
        </section>
      )}

      {step === "review" && (
        <section className="mt-8 space-y-4">
          <h1 className="text-2xl font-semibold">Review your profile</h1>
          {extractedSummary && <p className="text-sm text-emerald-700">{extractedSummary}</p>}
          <label className="block text-sm font-medium">
            Headline
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Backend Engineer" className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
          </label>
          <label className="block text-sm font-medium">
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bengaluru, India" className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
          </label>
          <label className="block text-sm font-medium">
            Work authorization
            <input value={workAuthorization} onChange={(e) => setWorkAuthorization(e.target.value)} placeholder="e.g. Indian citizen, no sponsorship needed" className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
          </label>
          <button onClick={saveReviewAndContinue} disabled={busy} className="w-full rounded-full bg-neutral-900 py-3 text-sm font-semibold text-white">
            Continue
          </button>
        </section>
      )}

      {step === "consent" && (
        <section className="mt-8 space-y-4">
          <h1 className="text-2xl font-semibold">How should QRify apply for you?</h1>
          <ConsentOption
            value="REVIEW"
            title="Review every application"
            description="See exactly what's being sent before it goes out."
            selected={consentMode === "REVIEW"}
            onSelect={setConsentMode}
          />
          <ConsentOption
            value="ONE_TAP"
            title="One-tap approval (recommended)"
            description="Everything is prepared automatically — you just tap Apply."
            selected={consentMode === "ONE_TAP"}
            onSelect={setConsentMode}
          />
          <ConsentOption
            value="INSTANT"
            title="Instant apply"
            description="For roles where every required answer is already covered, scanning submits automatically."
            selected={consentMode === "INSTANT"}
            onSelect={setConsentMode}
          />
          <button onClick={finish} disabled={busy} className="w-full rounded-full bg-neutral-900 py-3 text-sm font-semibold text-white">
            Your career profile is ready
          </button>
        </section>
      )}
    </div>
  );
}

function ConsentOption({
  value,
  title,
  description,
  selected,
  onSelect,
}: {
  value: "REVIEW" | "ONE_TAP" | "INSTANT";
  title: string;
  description: string;
  selected: boolean;
  onSelect: (v: "REVIEW" | "ONE_TAP" | "INSTANT") => void;
}) {
  return (
    <button
      onClick={() => onSelect(value)}
      className={`w-full rounded-2xl border p-4 text-left ${selected ? "border-neutral-900 bg-neutral-900/5" : "border-neutral-200"}`}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
    </button>
  );
}

function ProgressDots({ step }: { step: Step }) {
  const steps: Step[] = ["connect", "voice", "review", "consent"];
  return (
    <div className="flex gap-2">
      {steps.map((s) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${steps.indexOf(s) <= steps.indexOf(step) ? "bg-neutral-900" : "bg-neutral-200"}`} />
      ))}
    </div>
  );
}
