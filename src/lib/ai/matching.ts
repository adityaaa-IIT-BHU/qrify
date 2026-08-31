/**
 * Deterministic, synchronous candidate <-> job evidence matcher.
 *
 * This is intentionally NOT an LLM call. The "5-second apply" promise
 * (docs/PRODUCT_SPEC.md § The Five-Second Application) only holds if the
 * scan -> apply path does no slow generation — so JD parsing and resume
 * tailoring happen off the hot path (at job-creation / on explicit
 * request), and *this* module — pure keyword/synonym overlap, no network
 * call — is what runs synchronously when a candidate scans a QR. It is
 * fully explainable (docs/AI_SYSTEM.md § Interpretability): every match is
 * traceable to the exact candidate evidence item that produced it.
 *
 * An LLM-generated *narrative* explanation of the same match (for the
 * recruiter dashboard) is a separate, async, non-blocking step — see
 * src/lib/ai/match-explanation.ts.
 */

export type RequirementKindLike = "MUST_HAVE" | "NICE_TO_HAVE" | "CONTEXTUAL" | "BOILERPLATE";

export interface RequirementLike {
  id: string;
  kind: RequirementKindLike;
  label: string;
}

export interface EvidenceItem {
  id: string;
  entityType: "skill" | "experience" | "project" | "certification";
  label: string;
  terms: string[];
}

export interface EvidenceSource {
  skills: Array<{ id: string; name: string }>;
  experiences: Array<{ id: string; roleTitle: string; organizationName: string; description: string | null }>;
  projects: Array<{ id: string; name: string; description: string | null; technologies: string[] }>;
  certifications: Array<{ id: string; name: string }>;
}

// A small, hand-curated synonym map for common tech/role terms. Deliberately
// conservative — false positives here mean a candidate looks matched to a
// requirement they don't actually meet, which is worse than a false
// negative (missed match just means a slightly lower score, not a false
// claim). Extend cautiously; see docs/AI_SYSTEM.md § Bias & Fairness.
const SYNONYMS: Record<string, string[]> = {
  javascript: ["js", "es6", "ecmascript"],
  typescript: ["ts"],
  postgresql: ["postgres", "psql"],
  kubernetes: ["k8s"],
  react: ["reactjs", "react.js"],
  node: ["nodejs", "node.js"],
  golang: ["go"],
  python: ["py"],
  "machine learning": ["ml"],
  "artificial intelligence": ["ai"],
  "amazon web services": ["aws"],
  "google cloud platform": ["gcp"],
  "continuous integration": ["ci/cd", "ci", "cd"],
};

function normalize(text: string): string[] {
  const lower = text.toLowerCase();
  const words = lower
    .replace(/[^a-z0-9+.# ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const expanded = new Set(words);
  for (const word of words) {
    for (const [canonical, variants] of Object.entries(SYNONYMS)) {
      if (word === canonical || variants.includes(word)) {
        expanded.add(canonical);
        for (const v of variants) expanded.add(v);
      }
    }
  }
  return [...expanded];
}

export function buildEvidenceItems(source: EvidenceSource): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  for (const s of source.skills) {
    items.push({ id: s.id, entityType: "skill", label: s.name, terms: normalize(s.name) });
  }
  for (const e of source.experiences) {
    const label = `${e.roleTitle} @ ${e.organizationName}`;
    items.push({
      id: e.id,
      entityType: "experience",
      label,
      terms: normalize([e.roleTitle, e.organizationName, e.description ?? ""].join(" ")),
    });
  }
  for (const p of source.projects) {
    items.push({
      id: p.id,
      entityType: "project",
      label: p.name,
      terms: normalize([p.name, p.description ?? "", p.technologies.join(" ")].join(" ")),
    });
  }
  for (const c of source.certifications) {
    items.push({ id: c.id, entityType: "certification", label: c.name, terms: normalize(c.name) });
  }

  return items;
}

export interface RequirementMatch {
  requirementId: string;
  label: string;
  kind: RequirementKindLike;
  matched: boolean;
  matchedEvidence: Array<{ id: string; entityType: EvidenceItem["entityType"]; label: string }>;
}

export interface MatchResult {
  score: number; // 0-100
  matches: RequirementMatch[];
  gaps: RequirementMatch[]; // unmatched MUST_HAVE requirements — surfaced to the candidate before INSTANT apply
}

const KIND_WEIGHT: Record<RequirementKindLike, number> = {
  MUST_HAVE: 3,
  NICE_TO_HAVE: 1,
  CONTEXTUAL: 0, // informational only, never scored
  BOILERPLATE: 0,
};

export function matchCandidateToJob(
  evidence: EvidenceItem[],
  requirements: RequirementLike[],
): MatchResult {
  const matches: RequirementMatch[] = requirements.map((req) => {
    const reqTerms = normalize(req.label);
    const matchedEvidence = evidence.filter((item) =>
      item.terms.some((term) => reqTerms.includes(term)),
    );
    return {
      requirementId: req.id,
      label: req.label,
      kind: req.kind,
      matched: matchedEvidence.length > 0,
      matchedEvidence: matchedEvidence.map((e) => ({ id: e.id, entityType: e.entityType, label: e.label })),
    };
  });

  const scored = matches.filter((m) => KIND_WEIGHT[m.kind] > 0);
  const totalWeight = scored.reduce((sum, m) => sum + KIND_WEIGHT[m.kind], 0);
  const earnedWeight = scored.reduce((sum, m) => sum + (m.matched ? KIND_WEIGHT[m.kind] : 0), 0);
  const score = totalWeight === 0 ? 100 : Math.round((earnedWeight / totalWeight) * 100);

  const gaps = matches.filter((m) => m.kind === "MUST_HAVE" && !m.matched);

  return { score, matches, gaps };
}
