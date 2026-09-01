import Link from "next/link";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/employer/jobs" className="text-base font-semibold">
            QRify for Employers
          </Link>
          <nav className="flex items-center gap-5 text-sm text-neutral-600">
            <Link href="/employer/jobs" className="hover:text-neutral-900">
              Jobs
            </Link>
            <Link href="/employer/applicants" className="hover:text-neutral-900">
              Applicants
            </Link>
            <Link href="/employer/jobs/new" className="rounded-full bg-neutral-900 px-4 py-1.5 text-white">
              + New job
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
