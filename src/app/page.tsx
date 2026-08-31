import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-neutral-50">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">QRify</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-neutral-600 hover:text-neutral-900">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-full bg-neutral-900 px-4 py-2 font-medium text-white">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-6 pt-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 sm:text-6xl">
          Your job application
          <br />
          in 5 seconds.
        </h1>
        <p className="mt-6 max-w-lg text-lg text-neutral-600">
          Scan. We understand the role. We understand you. Done. QRify is the identity layer between candidates and
          employers — build your profile once, apply anywhere, instantly.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link href="/signup" className="rounded-full bg-neutral-900 px-8 py-4 text-base font-semibold text-white">
            Build your career profile
          </Link>
          <Link
            href="/employer/jobs/new"
            className="rounded-full border border-neutral-300 px-8 py-4 text-base font-semibold text-neutral-900"
          >
            Create a job QR — free
          </Link>
        </div>

        <div className="mt-20 grid w-full grid-cols-1 gap-6 text-left sm:grid-cols-3">
          <Step n="1" title="Paste a job description">
            Any employer pastes a JD. QRify parses it into structured requirements in seconds.
          </Step>
          <Step n="2" title="Get a QR code">
            Print it, post it, put it on a slide. It never changes even as the role is edited.
          </Step>
          <Step n="3" title="Scan → Applied">
            A returning candidate scans, QRify matches their profile, and submits — usually in about five seconds.
          </Step>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-5xl px-6 py-10 text-center text-xs text-neutral-400">
        QRify — the application identity layer for recruiting.
      </footer>
    </main>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <span className="text-xs font-semibold text-neutral-400">STEP {n}</span>
      <h3 className="mt-2 text-lg font-semibold text-neutral-900">{title}</h3>
      <p className="mt-2 text-sm text-neutral-600">{children}</p>
    </div>
  );
}
