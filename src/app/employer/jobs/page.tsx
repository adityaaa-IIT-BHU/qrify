import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export default async function EmployerJobsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const memberships = await db.employerMember.findMany({ where: { userId: user.id }, select: { employerId: true } });
  const jobs = await db.job.findMany({
    where: { employerId: { in: memberships.map((m) => m.employerId) }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } }, qrTokens: true },
  });

  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
        <p className="text-lg font-medium">No jobs yet</p>
        <p className="mt-1 text-sm text-neutral-500">Paste a job description and get a QR code in seconds.</p>
        <Link href="/employer/jobs/new" className="mt-6 inline-block rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white">
          Create your first job
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Jobs</h1>
      <div className="space-y-3">
        {jobs.map((job) => (
          <Link key={job.id} href={`/employer/jobs/${job.id}`} className="block rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{job.title}</p>
                <p className="text-sm text-neutral-500">{job.location ?? "Location not specified"}</p>
              </div>
              <div className="text-right text-sm text-neutral-500">
                <p className="font-medium text-neutral-900">{job._count.applications} applicants</p>
                <p>{job.status}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
