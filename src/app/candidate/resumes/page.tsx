import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ResumeUploader } from "@/components/candidate/resume-uploader";
import { fileServeUrl } from "@/lib/storage";

export default async function ResumesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
  const resumes = profile
    ? await db.resume.findMany({
        where: { candidateProfileId: profile.id, deletedAt: null },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Resume vault</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every version you upload or QRify generates is kept — nothing gets overwritten.
        </p>
      </div>

      <ResumeUploader />

      <div className="space-y-3">
        {resumes.length === 0 && <p className="text-sm text-neutral-500">No resumes yet.</p>}
        {resumes.map((r) => {
          const latest = r.versions[0];
          return (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
              <div>
                <p className="text-sm font-medium">
                  {r.label} <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{r.kind}</span>
                </p>
                <p className="text-xs text-neutral-500">v{latest?.versionNumber ?? 1} · {new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
              {latest?.fileUrl && (
                <a href={fileServeUrl(latest.fileUrl)} target="_blank" rel="noreferrer" className="text-sm underline">
                  View PDF
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
