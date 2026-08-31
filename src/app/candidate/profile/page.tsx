import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCandidateProfile } from "@/lib/candidate/profile";
import { ProfileEditor } from "@/components/candidate/profile-editor";
import { SourceSyncRow } from "@/components/candidate/source-sync-row";
import { DeleteAccount } from "@/components/candidate/delete-account";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await ensureCandidateProfile(user.id);
  const [sources, skills, experiences, consentPolicy] = await Promise.all([
    db.profileSource.findMany({ where: { candidateProfileId: profile.id } }),
    db.skill.count({ where: { candidateProfileId: profile.id } }),
    db.experience.count({ where: { candidateProfileId: profile.id, deletedAt: null } }),
    db.consentPolicy.findUnique({ where: { candidateProfileId: profile.id } }),
  ]);

  const githubConnection = await db.oAuthConnection.findFirst({ where: { userId: user.id, provider: "GITHUB" } });
  const githubSource = sources.find((s) => s.type === "GITHUB");
  const resumeSource = sources.filter((s) => s.type === "RESUME_UPLOAD").sort((a, b) => (b.lastSyncedAt?.getTime() ?? 0) - (a.lastSyncedAt?.getTime() ?? 0))[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {experiences} experience entries · {skills} skills tracked
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="mb-2 text-sm font-medium">Connected sources</p>
        <SourceSyncRow
          label="GitHub"
          lastSyncedAt={githubSource?.lastSyncedAt?.toISOString() ?? null}
          syncUrl={githubConnection ? "/api/candidate/sync/github" : undefined}
          connectHref={githubConnection ? undefined : "/api/auth/oauth/github?next=/candidate/profile"}
          sourceId={githubSource && githubSource.status === "ACTIVE" ? githubSource.id : undefined}
        />
        <SourceSyncRow
          label="Resume"
          lastSyncedAt={resumeSource?.lastSyncedAt?.toISOString() ?? null}
          sourceId={resumeSource && resumeSource.status === "ACTIVE" ? resumeSource.id : undefined}
        />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <ProfileEditor
          initial={{
            headline: profile.headline ?? "",
            location: profile.location ?? "",
            workAuthorization: profile.workAuthorization ?? "",
            noticePeriodDays: profile.noticePeriodDays?.toString() ?? "",
          }}
          consentMode={consentPolicy?.mode ?? "ONE_TAP"}
        />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="mb-3 text-sm font-medium">Danger zone</p>
        <DeleteAccount hasPassword={Boolean(user.passwordHash)} />
      </div>
    </div>
  );
}
