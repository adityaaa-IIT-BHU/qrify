import { describe, expect, it } from "vitest";
import { buildEvidenceItems, matchCandidateToJob } from "@/lib/ai/matching";

describe("buildEvidenceItems + matchCandidateToJob", () => {
  const evidence = buildEvidenceItems({
    skills: [
      { id: "skill-node", name: "Node.js" },
      { id: "skill-pg", name: "PostgreSQL" },
    ],
    experiences: [
      {
        id: "exp-1",
        roleTitle: "Backend Engineer",
        organizationName: "Acme",
        description: "Built payments infrastructure with Go and Kubernetes.",
      },
    ],
    projects: [
      { id: "proj-1", name: "qrify-cli", description: "A CLI tool", technologies: ["Go", "Cobra"] },
    ],
    certifications: [],
  });

  it("matches an exact skill name", () => {
    const result = matchCandidateToJob(evidence, [
      { id: "req-1", kind: "MUST_HAVE", label: "Node.js" },
    ]);
    expect(result.matches[0].matched).toBe(true);
    expect(result.matches[0].matchedEvidence[0].id).toBe("skill-node");
    expect(result.score).toBe(100);
  });

  it("matches via a synonym (postgres <-> postgresql)", () => {
    const result = matchCandidateToJob(evidence, [
      { id: "req-1", kind: "MUST_HAVE", label: "Postgres" },
    ]);
    expect(result.matches[0].matched).toBe(true);
  });

  it("matches technology mentioned in a project, not just skills", () => {
    const result = matchCandidateToJob(evidence, [
      { id: "req-1", kind: "NICE_TO_HAVE", label: "Go" },
    ]);
    expect(result.matches[0].matched).toBe(true);
    expect(result.matches[0].matchedEvidence.some((e) => e.entityType === "project")).toBe(true);
  });

  it("reports a gap for an unmatched MUST_HAVE requirement", () => {
    const result = matchCandidateToJob(evidence, [
      { id: "req-1", kind: "MUST_HAVE", label: "Rust" },
    ]);
    expect(result.matches[0].matched).toBe(false);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].requirementId).toBe("req-1");
    expect(result.score).toBe(0);
  });

  it("weights MUST_HAVE more heavily than NICE_TO_HAVE in the score", () => {
    const result = matchCandidateToJob(evidence, [
      { id: "req-1", kind: "MUST_HAVE", label: "Node.js" }, // matched, weight 3
      { id: "req-2", kind: "NICE_TO_HAVE", label: "Rust" }, // unmatched, weight 1
    ]);
    // earned 3 / total 4 = 75%
    expect(result.score).toBe(75);
  });

  it("never scores CONTEXTUAL or BOILERPLATE requirements", () => {
    const result = matchCandidateToJob(evidence, [
      { id: "req-1", kind: "CONTEXTUAL", label: "Rust" },
      { id: "req-2", kind: "BOILERPLATE", label: "Equal opportunity employer" },
    ]);
    expect(result.score).toBe(100); // no scored requirements -> defaults to 100
    expect(result.gaps).toHaveLength(0); // gaps only ever come from MUST_HAVE
  });

  it("does not false-positive match unrelated single-letter tokens", () => {
    const result = matchCandidateToJob(evidence, [
      { id: "req-1", kind: "MUST_HAVE", label: "R programming language for statistics" },
    ]);
    expect(result.matches[0].matched).toBe(false);
  });
});
