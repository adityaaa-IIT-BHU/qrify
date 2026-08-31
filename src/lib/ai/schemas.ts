import { z } from "zod";

/**
 * Every AI output in QRify is constrained to one of these schemas via
 * `client.messages.parse({ output_config: { format: zodOutputFormat(...) } })`
 * (see src/lib/ai/client.ts). No freeform-text parsing anywhere — see
 * docs/AI_SYSTEM.md for why (hallucination surface, silent format drift).
 */

// ── Job Description extraction ────────────────────────────────────────────

export const RequirementKindSchema = z.enum([
  "MUST_HAVE",
  "NICE_TO_HAVE",
  "CONTEXTUAL",
  "BOILERPLATE",
]);

export const RequirementCategorySchema = z.enum([
  "SKILL",
  "EXPERIENCE_YEARS",
  "EDUCATION",
  "TOOL",
  "LANGUAGE",
  "CERTIFICATION",
  "DOMAIN",
  "RESPONSIBILITY",
  "WORK_AUTHORIZATION",
  "PORTFOLIO",
]);

export const JobRequirementExtractionSchema = z.object({
  kind: RequirementKindSchema,
  category: RequirementCategorySchema,
  label: z.string().describe("short human-readable requirement, e.g. '5+ years Node.js'"),
  confidence: z.number().min(0).max(1),
});

export const ScreeningQuestionExtractionSchema = z.object({
  questionText: z.string(),
  questionType: z.enum(["TEXT", "BOOLEAN", "SINGLE_SELECT", "MULTI_SELECT", "NUMBER"]),
  options: z.array(z.string()).nullable(),
  required: z.boolean(),
  canonicalKey: z
    .enum([
      "WORK_AUTHORIZATION",
      "NOTICE_PERIOD",
      "RELOCATION",
      "SALARY_EXPECTATION",
      "REMOTE_PREFERENCE",
      "MOTIVATION",
      "NONE",
    ])
    .describe("maps to CandidateAnswer.questionKey when this is a recurring, reusable question"),
});

export const JobDescriptionExtractionSchema = z.object({
  title: z.string(),
  seniority: z.string().nullable(),
  location: z.string().nullable(),
  employmentType: z
    .enum(["full_time", "part_time", "internship", "contract", "unspecified"]),
  remotePolicy: z.enum(["remote", "hybrid", "onsite", "unspecified"]),
  compensationMin: z.number().nullable(),
  compensationMax: z.number().nullable(),
  compensationCurrency: z.string().nullable(),
  workAuthorizationRequirement: z.string().nullable(),
  portfolioRequired: z.boolean(),
  requirements: z.array(JobRequirementExtractionSchema).max(40),
  screeningQuestions: z.array(ScreeningQuestionExtractionSchema).max(15),
  recruiterEmail: z.string().nullable(),
  summary: z.string().describe("1-2 sentence plain-English summary of the role"),
});
export type JobDescriptionExtraction = z.infer<typeof JobDescriptionExtractionSchema>;

// ── Candidate fact extraction (resume / voice transcript) ─────────────────

export const ExtractedExperienceSchema = z.object({
  organizationName: z.string(),
  roleTitle: z.string(),
  location: z.string().nullable(),
  startDate: z.string().nullable().describe("ISO date, best-effort, null if unknown"),
  endDate: z.string().nullable(),
  isCurrent: z.boolean(),
  description: z.string().nullable(),
  achievements: z
    .array(
      z.object({
        description: z.string(),
        metricValue: z.string().nullable(),
        metricUnit: z.string().nullable(),
      }),
    )
    .max(10),
  confidence: z.number().min(0).max(1),
});

export const ExtractedEducationSchema = z.object({
  institution: z.string(),
  degree: z.string().nullable(),
  fieldOfStudy: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  grade: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const ExtractedProjectSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  url: z.string().nullable(),
  repoUrl: z.string().nullable(),
  technologies: z.array(z.string()).max(20),
  confidence: z.number().min(0).max(1),
});

export const ExtractedSkillSchema = z.object({
  name: z.string(),
  category: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const ExtractedCertificationSchema = z.object({
  name: z.string(),
  issuer: z.string().nullable(),
  issueDate: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const CandidateFactExtractionSchema = z.object({
  headline: z.string().nullable(),
  experiences: z.array(ExtractedExperienceSchema).max(25),
  educations: z.array(ExtractedEducationSchema).max(10),
  projects: z.array(ExtractedProjectSchema).max(25),
  skills: z.array(ExtractedSkillSchema).max(60),
  certifications: z.array(ExtractedCertificationSchema).max(20),
  notes: z
    .string()
    .nullable()
    .describe("anything notable the extractor could not confidently place into a structured field"),
});
export type CandidateFactExtraction = z.infer<typeof CandidateFactExtractionSchema>;

// ── Evidence -> requirement match explanation (narrative, non-scoring) ────
// The numeric match score itself is computed deterministically
// (src/lib/ai/matching.ts) — this schema is only for the human-readable
// "why this candidate matches" narrative shown to recruiters, generated
// off the candidate-facing hot path.

export const MatchExplanationSchema = z.object({
  matchedRequirements: z
    .array(
      z.object({
        requirementLabel: z.string(),
        evidenceSummary: z.string().describe("grounded in candidate evidence, 1 sentence"),
      }),
    )
    .max(20),
  gaps: z.array(z.string()).max(10).describe("must-have requirements with no supporting evidence"),
  overallSummary: z.string().describe("2-3 sentence recruiter-facing summary"),
});
export type MatchExplanation = z.infer<typeof MatchExplanationSchema>;

// ── Tailored resume content ────────────────────────────────────────────────

export const ResumeExperienceEntrySchema = z.object({
  sourceExperienceId: z.string().describe("Experience.id this entry is grounded in"),
  organizationName: z.string(),
  roleTitle: z.string(),
  location: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  isCurrent: z.boolean(),
  bullets: z
    .array(z.string())
    .max(6)
    .describe("each bullet must be traceable to candidate evidence — no invented claims"),
});

export const ResumeContentSchema = z.object({
  headline: z.string(),
  summary: z.string().describe("2-3 sentence professional summary, grounded in evidence"),
  experiences: z.array(ResumeExperienceEntrySchema).max(10),
  projects: z
    .array(
      z.object({
        sourceProjectId: z.string(),
        name: z.string(),
        description: z.string(),
        technologies: z.array(z.string()),
      }),
    )
    .max(6),
  skills: z.array(z.string()).max(30).describe("ordered by relevance to the target job"),
  educations: z
    .array(
      z.object({
        sourceEducationId: z.string(),
        institution: z.string(),
        degree: z.string().nullable(),
        fieldOfStudy: z.string().nullable(),
        endDate: z.string().nullable(),
      }),
    )
    .max(5),
});
export type ResumeContent = z.infer<typeof ResumeContentSchema>;

// ── Factuality / groundedness check ────────────────────────────────────────

export const FactualityCheckSchema = z.object({
  claims: z
    .array(
      z.object({
        text: z.string(),
        verdict: z.enum(["grounded", "unsupported", "exaggerated"]),
        explanation: z.string().nullable(),
      }),
    )
    .max(60),
  overallPass: z.boolean().describe("false if ANY claim is unsupported or exaggerated"),
});
export type FactualityCheck = z.infer<typeof FactualityCheckSchema>;

// ── Screening-question answer drafting ─────────────────────────────────────

export const ScreeningAnswerDraftSchema = z.object({
  answerText: z.string(),
  groundedFactRefs: z
    .array(z.string())
    .describe("ids of the ProfileFact/Experience/etc. rows this answer is grounded in, empty if none needed (e.g. yes/no on notice period)"),
  confidence: z.number().min(0).max(1),
  needsCandidateReview: z
    .boolean()
    .describe("true if this is subjective/sensitive enough that silent reuse would be inappropriate"),
});
export type ScreeningAnswerDraft = z.infer<typeof ScreeningAnswerDraftSchema>;

// ── Outreach message drafting ──────────────────────────────────────────────

export const OutreachMessageSchema = z.object({
  message: z.string().max(1200),
  referencedEvidence: z.array(z.string()).describe("candidate evidence ids referenced in the message"),
});
export type OutreachMessage = z.infer<typeof OutreachMessageSchema>;
