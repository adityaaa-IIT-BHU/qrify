import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
  const applications = profile
    ? await db.application.findMany({
        where: { candidateProfileId: profile.id },
        orderBy: { createdAt: "desc" },
        include: { job: { include: { employer: true } } },
      })
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Applications</h1>

      {applications.length === 0 && <p className="text-sm text-neutral-500">Scan a QRify job code to see your applications here.</p>}

      <div className="space-y-3">
        {applications.map((a) => (
          <Link
            key={a.id}
            href={`/candidate/applications/${a.id}`}
            className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <div>
              <p className="text-sm font-medium">{a.job.title}</p>
              <p className="text-xs text-neutral-500">
                {a.job.employer.name} · {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "Not submitted"}
              </p>
            </div>
            <StatusBadge status={a.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SUBMITTED: "bg-blue-100 text-blue-700",
    SHORTLISTED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-red-100 text-red-700",
    AWAITING_REVIEW: "bg-amber-100 text-amber-700",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? "bg-neutral-100 text-neutral-600"}`}>{status}</span>;
}
