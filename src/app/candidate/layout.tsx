import Link from "next/link";

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/candidate" className="text-base font-semibold">
            QRify
          </Link>
          <nav className="flex gap-5 text-sm text-neutral-600">
            <Link href="/candidate" className="hover:text-neutral-900">
              Home
            </Link>
            <Link href="/candidate/profile" className="hover:text-neutral-900">
              Profile
            </Link>
            <Link href="/candidate/resumes" className="hover:text-neutral-900">
              Resumes
            </Link>
            <Link href="/candidate/applications" className="hover:text-neutral-900">
              Applications
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-10">{children}</div>
    </div>
  );
}
