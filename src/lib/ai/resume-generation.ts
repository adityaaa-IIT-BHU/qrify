import "server-only";
import { extractStructured } from "@/lib/ai/client";
import { ResumeContentSchema, type ResumeContent } from "@/lib/ai/schemas";

export interface CandidateEvidenceForResume {
  headline: string | null;
  experiences: Array<{
    id: string;
    organizationName: string;
    roleTitle: string;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean;
    description: string | null;
    achievements: Array<{ description: string; metricValue: string | null; metricUnit: string | null }>;
  }>;
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    technologies: string[];
  }>;
  educations: Array<{
    id: string;
    institution: string;
    degree: string | null;
    fieldOfStudy: string | null;
    endDate: string | null;
  }>;
  skills: string[];
}

export interface TargetJobForResume {
  title: string;
  companyName: string;
  summary: string;
  mustHaveRequirements: string[];
  niceToHaveRequirements: string[];
}

const SYSTEM_PROMPT = `You generate a tailored resume for a specific job from a candidate's verified evidence. This is a retrieval-then-generation task, not creative writing.

Absolute rules:
- Every experience, project, and education entry you output MUST reuse one of the "id" values given in the input (as sourceExperienceId / sourceProjectId / sourceEducationId). Never invent an entry that isn't in the input.
- Every bullet point must be a truthful restatement or reasonable rephrasing of the candidate's own achievements/description for that entry. You may reorder, emphasize, and rephrase for clarity and relevance to the target job — you may NOT add a skill, technology, metric, or outcome that isn't already present in that entry's data.
- Do not change dates, employer names, or job titles.
- Prioritize (via ordering and bullet emphasis) the experiences/projects/skills most relevant to the target job's must-have requirements, but include the candidate's full real skill set — do not hide skills to appear more "focused" in a way that misrepresents breadth.
- "skills" output should be the candidate's own skill list, reordered by relevance to the target job — never add a skill not in the input list.
- Keep bullets concise (one line each), professional, and free of unsupported superlatives ("world-class", "10x") unless the candidate's own material uses a specific, stated metric.`;

export async function generateTailoredResume(
  evidence: CandidateEvidenceForResume,
  targetJob: TargetJobForResume,
): Promise<ResumeContent> {
  const payload = JSON.stringify({ candidateEvidence: evidence, targetJob }, null, 2);

  const result = await extractStructured({
    system: SYSTEM_PROMPT,
    untrustedInput: payload,
    schema: ResumeContentSchema,
    effort: "high",
    maxTokens: 8000,
  });

  return sanitizeAgainstSourceIds(result, evidence);
}

/** Defense in depth: drop any entry whose "source*Id" doesn't match a real input id, even though the prompt forbids it. */
function sanitizeAgainstSourceIds(
  content: ResumeContent,
  evidence: CandidateEvidenceForResume,
): ResumeContent {
  const experienceIds = new Set(evidence.experiences.map((e) => e.id));
  const projectIds = new Set(evidence.projects.map((p) => p.id));
  const educationIds = new Set(evidence.educations.map((e) => e.id));

  const experiences = content.experiences.filter((e) => experienceIds.has(e.sourceExperienceId));
  const projects = content.projects.filter((p) => projectIds.has(p.sourceProjectId));
  const educations = content.educations.filter((e) => educationIds.has(e.sourceEducationId));

  if (
    experiences.length !== content.experiences.length ||
    projects.length !== content.projects.length ||
    educations.length !== content.educations.length
  ) {
    console.warn("[resume-generation] dropped hallucinated source-id references from model output");
  }

  const validSkills = new Set(evidence.skills.map((s) => s.toLowerCase()));
  const skills = content.skills.filter((s) => validSkills.has(s.toLowerCase()));

  return { ...content, experiences, projects, educations, skills };
}
