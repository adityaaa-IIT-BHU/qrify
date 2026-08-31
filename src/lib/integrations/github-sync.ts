import "server-only";

/**
 * GitHub profile sync — deterministic, not AI-extracted. GitHub's API
 * already returns structured data (repo name, description, language,
 * topics), so there is no fabrication risk in using it directly as
 * evidence; source = ProfileSourceType.GITHUB, confidence = 1.0.
 *
 * Scope used: read:user + user:email (see src/lib/auth/oauth.ts). No
 * elevated `repo` scope requested — `/user/repos` returns the authenticated
 * user's *public* repos with only basic auth, which is all profile sync
 * needs (least privilege, matches docs/SECURITY.md).
 */

interface GithubRepo {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  topics: string[];
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  pushed_at: string;
}

export interface GithubSyncResult {
  bio: string | null;
  projects: Array<{
    name: string;
    description: string | null;
    url: string;
    repoUrl: string;
    technologies: string[];
  }>;
  languageSkills: string[];
}

export async function fetchGithubSyncData(accessToken: string): Promise<GithubSyncResult> {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" };

  const [userRes, reposRes] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/repos?sort=pushed&per_page=100&affiliation=owner", { headers }),
  ]);

  if (!userRes.ok) throw new Error(`GitHub /user failed: ${userRes.status}`);
  if (!reposRes.ok) throw new Error(`GitHub /user/repos failed: ${reposRes.status}`);

  const user = (await userRes.json()) as { bio: string | null };
  const repos = (await reposRes.json()) as GithubRepo[];

  const activeRepos = repos
    .filter((r) => !r.fork && !r.archived)
    .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime())
    .slice(0, 15);

  const languageCounts = new Map<string, number>();
  for (const repo of activeRepos) {
    if (repo.language) languageCounts.set(repo.language, (languageCounts.get(repo.language) ?? 0) + 1);
  }

  return {
    bio: user.bio,
    projects: activeRepos.map((r) => ({
      name: r.name,
      description: r.description,
      url: r.html_url,
      repoUrl: r.html_url,
      technologies: [r.language, ...r.topics].filter((t): t is string => Boolean(t)),
    })),
    languageSkills: [...languageCounts.entries()].sort((a, b) => b[1] - a[1]).map(([lang]) => lang),
  };
}
