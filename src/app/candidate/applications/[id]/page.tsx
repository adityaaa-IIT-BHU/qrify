import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { fileServeUrl } from "@/lib/storage";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const application = await db.application.findUnique({
    where: { id },
    include: {
      candidateProfile: true,
      job: { include: { employer: true } },
      artifacts: { include: { resumeVersion: true } },
      answers: true,
    },
  });

  if (!application || application.candidateProfile.userId !== user.id) notFound();

  const resumeArtifact = application.artifacts.find((a) => a.type === "RESUME");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-neutral-500">{application.job.employer.name}</p>
        <h1 className="text-2xl font-semibold">{application.job.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Status: <span className="font-medium text-neutral-800">{application.status}</span>
          {application.matchScore !== null && ` · ${Math.round(application.matchScore)}% match`}
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-semibold">What was sent</p>
        <p className="mt-1 text-xs text-neutral-500">Immutable record of exactly what QRify submitted on your behalf.</p>

        {resumeArtifact?.resumeVersion?.fileUrl && (
          <a href={fileServeUrl(resumeArtifact.resumeVersion.fileUrl)} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm underline">
            View submitted resume →
          </a>
        )}

        {application.answers.length > 0 && (
          <div className="mt-4 space-y-3">
            {application.answers.map((a) => (
              <div key={a.id} className="border-t border-neutral-100 pt-3">
                <p className="text-sm font-medium">{a.questionText}</p>
                <p className="mt-1 text-sm text-neutral-600">{a.answerText}</p>
                <p className="mt-1 text-xs text-neutral-400">{a.source.replace(/_/g, " ").toLowerCase()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
