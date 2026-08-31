import { AuthForm } from "@/components/shared/auth-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-6 py-16">
      <AuthForm
        mode="signup"
        next={next ?? "/onboarding"}
        error={error}
        googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID)}
        githubEnabled={Boolean(process.env.GITHUB_CLIENT_ID)}
      />
    </main>
  );
}
