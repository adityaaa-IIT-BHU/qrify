import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveQrForRequest } from "@/lib/qr/resolve";
import { prepareApplication } from "@/lib/applications/service";
import { ApplyFlow } from "@/components/candidate/apply-flow";

export default async function ScanApplyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const user = await getCurrentUser();

  const resolved = await resolveQrForRequest(token, {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown",
    userAgent: h.get("user-agent"),
    referrer: h.get("referer"),
    resolvedCandidateUserId: user?.id,
  });

  if (!resolved.ok) {
    const messages: Record<typeof resolved.reason, string> = {
      invalid_qr: "This link isn't valid — it may have been revoked or mistyped.",
      rate_limited: "Too many scans from this connection — try again in a moment.",
      job_not_accepting_applications: "This role isn't accepting applications right now.",
    };
    return (
      <CenteredScreen>
        <p className="text-lg font-medium">{messages[resolved.reason]}</p>
        <Link href="/" className="mt-6 text-sm text-neutral-500 underline">
          Back to QRify
        </Link>
      </CenteredScreen>
    );
  }

  const job = resolved.job;

  if (!user) {
    return (
      <CenteredScreen>
        <p className="text-sm uppercase tracking-wide text-neutral-500">You scanned</p>
        <h1 className="mt-2 text-2xl font-semibold">{job.title}</h1>
        <p className="mt-6 max-w-xs text-sm text-neutral-600">
          Sign in to apply in about five seconds — QRify already knows how to match your profile to this role.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/j/${token}`)}`}
          className="mt-8 rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white"
        >
          Sign in to apply
        </Link>
        <Link href={`/signup?next=${encodeURIComponent(`/j/${token}`)}`} className="mt-4 text-sm text-neutral-500 underline">
          New to QRify? Build your profile
        </Link>
      </CenteredScreen>
    );
  }

  const candidateProfile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidateProfile) {
    return (
      <CenteredScreen>
        <p className="text-sm uppercase tracking-wide text-neutral-500">You scanned</p>
        <h1 className="mt-2 text-2xl font-semibold">{job.title}</h1>
        <p className="mt-6 max-w-xs text-sm text-neutral-600">
          Finish setting up your career profile once, and every future scan applies in seconds.
        </p>
        <Link href="/onboarding" className="mt-8 rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white">
          Complete your profile
        </Link>
      </CenteredScreen>
    );
  }

  const prepared = await prepareApplication(candidateProfile.id, job.id);

  return <ApplyFlow prepared={prepared} />;
}

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-6 text-center">
      {children}
    </main>
  );
}
