import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { userCanManageJob } from "@/lib/employer/access";
import { JobDetail } from "@/components/employer/job-detail";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  if (!(await userCanManageJob(user.id, id))) notFound();

  const job = await db.job.findUnique({
    where: { id },
    include: { requirements: true, screeningQuestions: { orderBy: { order: "asc" } } },
  });
  if (!job) notFound();

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-semibold">{job.title}</h1>
        <p className="text-sm text-neutral-500">{job.status}</p>
      </div>
      <div className="pt-4">
        <JobDetail job={job} />
      </div>
    </div>
  );
}
