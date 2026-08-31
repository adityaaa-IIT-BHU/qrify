import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";
import { getStorage } from "../src/lib/storage";
import { buildApplyUrl } from "../src/lib/qr/generate";

// A standalone client, not the src/lib/db.ts singleton — that module is
// guarded with `import "server-only"` (throws outside the Next.js server
// bundle graph), which a plain tsx script doesn't run inside of.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DEMO_PASSWORD = "Demo1234!";

async function main() {
  console.log("Seeding QRify demo data…\n");

  // ── Employer ──────────────────────────────────────────────────────────
  const employerUser = await upsertUser("employer@qrify.app", "Priya Recruiter");
  let employer = await db.employer.findFirst({ where: { name: "Acme Labs" } });
  if (!employer) {
    employer = await db.employer.create({
      data: {
        name: "Acme Labs",
        domain: "acmelabs.example",
        verifiedStatus: "DOMAIN_VERIFIED",
        members: { create: { userId: employerUser.id, role: "OWNER", joinedAt: new Date() } },
      },
    });
  }

  // ── Candidate ─────────────────────────────────────────────────────────
  const candidateUser = await upsertUser("candidate@qrify.app", "Aditi Sharma");
  let candidateProfile = await db.candidateProfile.findUnique({ where: { userId: candidateUser.id } });
  if (!candidateProfile) {
    candidateProfile = await db.candidateProfile.create({
      data: {
        userId: candidateUser.id,
        headline: "Backend Engineer",
        location: "Bengaluru, India",
        phone: "+91 98765 43210",
        workAuthorization: "Indian citizen — no sponsorship required",
        noticePeriodDays: 30,
        remotePreference: "HYBRID",
        links: { githubUsername: "aditi-dev", portfolio: "https://aditi.dev" },
        profileCompleteness: 90,
        consentPolicy: { create: { mode: "ONE_TAP" } },
        preference: {
          create: {
            preferredRoles: ["Backend Engineer", "Platform Engineer"],
            preferredLocations: ["Bengaluru", "Remote"],
            remoteOk: true,
            hybridOk: true,
            onsiteOk: false,
            industries: ["Fintech", "Developer Tools"],
          },
        },
      },
    });

    const source = await db.profileSource.create({
      data: { candidateProfileId: candidateProfile.id, type: "MANUAL", lastSyncedAt: new Date() },
    });

    const skills = [
      "Node.js", "TypeScript", "PostgreSQL", "React", "Python", "AWS",
      "Kubernetes", "Docker", "Redis", "GraphQL", "REST APIs", "System Design",
    ];
    for (const name of skills) {
      await db.skill.create({ data: { candidateProfileId: candidateProfile.id, name, category: "technical", sourceId: source.id, confidence: 1 } });
    }

    const exp1 = await db.experience.create({
      data: {
        candidateProfileId: candidateProfile.id,
        organizationName: "Finlytics",
        roleTitle: "Backend Engineer",
        location: "Bengaluru, India",
        startDate: new Date("2022-06-01"),
        isCurrent: true,
        description: "Own the payments settlement service handling reconciliation across 12 banking partners.",
        sourceId: source.id,
        confidence: 1,
      },
    });
    await db.achievement.create({
      data: {
        candidateProfileId: candidateProfile.id,
        experienceId: exp1.id,
        description: "Rebuilt the settlement pipeline in Node.js and PostgreSQL, cutting reconciliation latency",
        metricValue: "70",
        metricUnit: "%",
        sourceId: source.id,
        confidence: 1,
      },
    });

    const exp2 = await db.experience.create({
      data: {
        candidateProfileId: candidateProfile.id,
        organizationName: "CampusCred (college project)",
        roleTitle: "Founding Engineer",
        location: "Remote",
        startDate: new Date("2021-01-01"),
        endDate: new Date("2022-05-01"),
        isCurrent: false,
        description: "Built the initial REST API and Postgres schema for a student credit-building app.",
        sourceId: source.id,
        confidence: 0.9,
      },
    });
    await db.achievement.create({
      data: {
        candidateProfileId: candidateProfile.id,
        experienceId: exp2.id,
        description: "Shipped the MVP that onboarded 500 student users in the first month",
        metricValue: "500",
        metricUnit: "users",
        sourceId: source.id,
        confidence: 0.9,
      },
    });

    await db.project.create({
      data: {
        candidateProfileId: candidateProfile.id,
        name: "qrify-cli",
        description: "A small open-source CLI for batch-generating signed QR codes, built to learn Go.",
        repoUrl: "https://github.com/aditi-dev/qrify-cli",
        technologies: ["Go", "Cobra"],
        sourceId: source.id,
        confidence: 1,
      },
    });

    await db.education.create({
      data: {
        candidateProfileId: candidateProfile.id,
        institution: "IIT (BHU) Varanasi",
        degree: "B.Tech",
        fieldOfStudy: "Computer Science",
        startDate: new Date("2018-07-01"),
        endDate: new Date("2022-05-01"),
        sourceId: source.id,
        confidence: 1,
      },
    });

    await db.candidateAnswer.create({
      data: {
        candidateProfileId: candidateProfile.id,
        questionKey: "WORK_AUTHORIZATION",
        answerText: "Yes, I am authorized to work in India without sponsorship.",
        isReusable: true,
        approvedForReuse: true,
      },
    });
    await db.candidateAnswer.create({
      data: {
        candidateProfileId: candidateProfile.id,
        questionKey: "NOTICE_PERIOD",
        answerText: "30 days.",
        isReusable: true,
        approvedForReuse: true,
      },
    });

    // Master resume. Stored as plain text here (not react-pdf) purely because
    // @react-pdf/renderer's hyphenation dependency has a resolver bug under
    // tsx's CJS/ESM interop — it works fine through Next's own bundler, which
    // is what the real upload/tailoring routes use (see docs/HANDOVER.md).
    const resume = await db.resume.create({
      data: { candidateProfileId: candidateProfile.id, label: "Master resume", kind: "MASTER" },
    });
    const resumeText = [
      "Aditi Sharma",
      "candidate@qrify.app | +91 98765 43210 | Bengaluru, India | github.com/aditi-dev | aditi.dev",
      "",
      "Backend Engineer",
      "Backend engineer with 3 years building payments infrastructure — Node.js, PostgreSQL, and distributed systems at scale.",
      "",
      "EXPERIENCE",
      "Backend Engineer — Finlytics (2022–Present)",
      "- Rebuilt the settlement pipeline in Node.js and PostgreSQL, cutting reconciliation latency by 70%",
      "",
      "Founding Engineer — CampusCred (2021–2022)",
      "- Shipped the MVP REST API and Postgres schema that onboarded 500 student users in month one",
      "",
      "PROJECTS",
      "qrify-cli — Open-source CLI for batch-generating signed QR codes (Go, Cobra)",
      "",
      "SKILLS",
      skills.join(", "),
      "",
      "EDUCATION",
      "IIT (BHU) Varanasi — B.Tech, Computer Science (2018–2022)",
    ].join("\n");
    const storageKey = `resumes/${candidateProfile.id}/${resume.id}/v1.txt`;
    await getStorage().putObject({ key: storageKey, body: Buffer.from(resumeText, "utf8"), contentType: "text/plain" });
    await db.resumeVersion.create({
      data: { resumeId: resume.id, versionNumber: 1, fileUrl: storageKey, fileType: "text/plain", isCurrent: true },
    });
  }

  // ── Jobs ──────────────────────────────────────────────────────────────
  const primaryJob = await upsertJob(employer.id, employerUser.id, {
    title: "Senior Backend Engineer",
    rawDescription:
      "We're looking for a Senior Backend Engineer to own core services powering our payments platform. 5+ years with Node.js and PostgreSQL required. Kubernetes and Redis are a plus.",
    location: "Bengaluru, India (Hybrid)",
    employmentType: "full_time",
    seniority: "Senior",
    compensationMin: 2800000,
    compensationMax: 4200000,
    requirements: [
      { kind: "MUST_HAVE", category: "SKILL", label: "Node.js", confidence: 0.95 },
      { kind: "MUST_HAVE", category: "SKILL", label: "PostgreSQL", confidence: 0.95 },
      { kind: "MUST_HAVE", category: "EXPERIENCE_YEARS", label: "5+ years backend experience", confidence: 0.9 },
      { kind: "NICE_TO_HAVE", category: "TOOL", label: "Kubernetes", confidence: 0.8 },
      { kind: "NICE_TO_HAVE", category: "TOOL", label: "Redis", confidence: 0.8 },
      { kind: "CONTEXTUAL", category: "DOMAIN", label: "Payments infrastructure", confidence: 0.7 },
    ],
    screeningQuestions: [
      { questionText: "Are you authorized to work in India?", questionType: "TEXT", required: true, canonicalKey: "WORK_AUTHORIZATION", order: 0 },
      { questionText: "What is your notice period?", questionType: "TEXT", required: true, canonicalKey: "NOTICE_PERIOD", order: 1 },
    ],
  });

  await upsertJob(employer.id, employerUser.id, {
    title: "Product Manager, Growth",
    rawDescription: "Own the growth roadmap for our consumer app. 3+ years PM experience, strong analytics background, SQL fluency.",
    location: "Remote (India)",
    employmentType: "full_time",
    seniority: "Mid",
    requirements: [
      { kind: "MUST_HAVE", category: "EXPERIENCE_YEARS", label: "3+ years product management", confidence: 0.9 },
      { kind: "MUST_HAVE", category: "SKILL", label: "SQL", confidence: 0.85 },
      { kind: "NICE_TO_HAVE", category: "DOMAIN", label: "Consumer growth experience", confidence: 0.7 },
    ],
    screeningQuestions: [],
  });

  await upsertJob(employer.id, employerUser.id, {
    title: "Machine Learning Engineer",
    rawDescription: "Build and ship ML models for fraud detection. Experience with Python, PyTorch, and production ML pipelines required.",
    location: "Bengaluru, India",
    employmentType: "full_time",
    seniority: "Mid-Senior",
    requirements: [
      { kind: "MUST_HAVE", category: "SKILL", label: "Python", confidence: 0.95 },
      { kind: "MUST_HAVE", category: "SKILL", label: "PyTorch", confidence: 0.85 },
      { kind: "NICE_TO_HAVE", category: "DOMAIN", label: "Fraud detection", confidence: 0.7 },
    ],
    screeningQuestions: [],
  });

  await upsertJob(employer.id, employerUser.id, {
    title: "Management Consultant",
    rawDescription: "Join our strategy team advising Series B-D startups on go-to-market. MBA or equivalent experience preferred.",
    location: "Mumbai, India",
    employmentType: "full_time",
    seniority: "Mid",
    requirements: [
      { kind: "MUST_HAVE", category: "EDUCATION", label: "MBA or equivalent", confidence: 0.7 },
      { kind: "MUST_HAVE", category: "RESPONSIBILITY", label: "Client-facing strategy work", confidence: 0.8 },
    ],
    screeningQuestions: [],
  });

  await upsertJob(employer.id, employerUser.id, {
    title: "Growth Marketing Manager",
    rawDescription: "Run paid acquisition and lifecycle marketing across our funnel. 2+ years performance marketing experience.",
    location: "Remote",
    employmentType: "full_time",
    seniority: "Mid",
    requirements: [
      { kind: "MUST_HAVE", category: "EXPERIENCE_YEARS", label: "2+ years performance marketing", confidence: 0.85 },
      { kind: "NICE_TO_HAVE", category: "TOOL", label: "Google Ads", confidence: 0.6 },
    ],
    screeningQuestions: [],
  });

  await upsertJob(employer.id, employerUser.id, {
    title: "Product Designer",
    rawDescription: "Design end-to-end product experiences for our mobile app. Portfolio required. Figma fluency expected.",
    location: "Bengaluru, India",
    employmentType: "full_time",
    seniority: "Mid",
    portfolioRequired: true,
    requirements: [
      { kind: "MUST_HAVE", category: "PORTFOLIO", label: "Design portfolio", confidence: 0.9 },
      { kind: "MUST_HAVE", category: "TOOL", label: "Figma", confidence: 0.85 },
    ],
    screeningQuestions: [
      { questionText: "Link to your portfolio?", questionType: "TEXT", required: true, canonicalKey: "NONE", order: 0 },
    ],
  });

  await upsertJob(employer.id, employerUser.id, {
    title: "Software Engineering Intern",
    rawDescription: "Summer internship for students graduating in 2027. Any experience with a backend language (Python, Node.js, Java, Go) welcome.",
    location: "Bengaluru, India",
    employmentType: "internship",
    seniority: "Intern",
    requirements: [
      { kind: "NICE_TO_HAVE", category: "SKILL", label: "Python", confidence: 0.6 },
      { kind: "NICE_TO_HAVE", category: "SKILL", label: "Node.js", confidence: 0.6 },
      { kind: "CONTEXTUAL", category: "EDUCATION", label: "Currently pursuing a CS degree", confidence: 0.7 },
    ],
    screeningQuestions: [],
  });

  const qrToken = await db.qRToken.findFirst({ where: { jobId: primaryJob.id, type: "APPLY" } })
    ?? (await db.qRToken.create({ data: { jobId: primaryJob.id, type: "APPLY" } }));

  console.log("Done.\n");
  console.log("Candidate login:  candidate@qrify.app /", DEMO_PASSWORD);
  console.log("Employer login:   employer@qrify.app /", DEMO_PASSWORD);
  console.log("Demo apply link:  " + buildApplyUrl(qrToken.id));
  console.log("\nScan that link's QR (or open it directly) while signed in as the candidate to see the 5-second apply flow.");
}

async function upsertUser(email: string, name: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return db.user.create({ data: { email, name, passwordHash, emailVerifiedAt: new Date() } });
}

interface SeedJobInput {
  title: string;
  rawDescription: string;
  location: string;
  employmentType: string;
  seniority: string;
  compensationMin?: number;
  compensationMax?: number;
  portfolioRequired?: boolean;
  requirements: Array<{ kind: "MUST_HAVE" | "NICE_TO_HAVE" | "CONTEXTUAL" | "BOILERPLATE"; category: string; label: string; confidence: number }>;
  screeningQuestions: Array<{ questionText: string; questionType: "TEXT" | "BOOLEAN" | "SINGLE_SELECT" | "MULTI_SELECT" | "NUMBER"; required: boolean; canonicalKey: string; order: number }>;
}

async function upsertJob(employerId: string, createdById: string, input: SeedJobInput) {
  const existing = await db.job.findFirst({ where: { employerId, title: input.title } });
  if (existing) return existing;

  const job = await db.job.create({
    data: {
      employerId,
      createdById,
      title: input.title,
      rawDescription: input.rawDescription,
      status: "ACTIVE",
      location: input.location,
      employmentType: input.employmentType,
      seniority: input.seniority,
      compensationMin: input.compensationMin,
      compensationMax: input.compensationMax,
      portfolioRequired: input.portfolioRequired ?? false,
      requirements: { create: input.requirements.map((r) => ({ kind: r.kind, category: r.category as never, label: r.label, confidence: r.confidence })) },
      screeningQuestions: {
        create: input.screeningQuestions.map((q) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          required: q.required,
          canonicalKey: q.canonicalKey === "NONE" ? null : q.canonicalKey,
          order: q.order,
        })),
      },
    },
  });
  return job;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
