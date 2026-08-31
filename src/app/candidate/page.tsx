import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export default async function CandidateHomePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
  const applications = profile
    ? await db.application.findMany({
        where: { candidateProfileId: profile.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { job: { include: { employer: true } } },
      })
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
        <p className="mt-1 text-sm text-neutral-500">Your career profile powers every application you scan into.</p>
      </div>

      {profile && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Profile completeness</p>
            <span className="text-sm text-neutral-500">{profile.profileCompleteness}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-neutral-100">
            <div className="h-2 rounded-full bg-neutral-900" style={{ width: `${profile.profileCompleteness}%` }} />
          </div>
          {profile.profileCompleteness < 100 && (
            <Link href="/candidate/profile" className="mt-3 inline-block text-sm underline">
              Finish your profile
            </Link>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-medium">Recent applications</p>
        {applications.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Nothing yet — scan a QRify job code to apply in seconds.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {applications.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{a.job.title}</p>
                  <p className="text-xs text-neutral-500">{a.job.employer.name}</p>
                </div>
                <Link href={`/candidate/applications/${a.id}`} className="text-xs underline">
                  {a.status}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
