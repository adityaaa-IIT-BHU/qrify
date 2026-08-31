import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { OnboardingFlow } from "@/components/candidate/onboarding-flow";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) return null; // proxy.ts already redirects unauthenticated visitors

  const githubConnection = await db.oAuthConnection.findFirst({ where: { userId: user.id, provider: "GITHUB" } });

  return (
    <main className="min-h-dvh bg-neutral-50 px-6 py-16">
      <OnboardingFlow githubConnected={Boolean(githubConnection)} />
    </main>
  );
}
