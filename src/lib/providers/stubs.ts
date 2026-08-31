import type { Job } from "@/generated/prisma/client";
import type { ApplicationProvider, DeliverInput, DeliverResult, MissingFieldsInput } from "@/lib/providers/types";

/**
 * Deliberately unimplemented adapters — present so the ApplicationProvider
 * interface is complete and testable (docs/CODE_QUALITY: "clearly labeled
 * adapter/mock so the architecture is testable without misleading anyone"),
 * NOT because they're wired up. Every one throws/fails loudly rather than
 * silently no-opping if something ever routes an application to them.
 *
 * Why these are stubs, not real integrations, in this MVP — see
 * docs/RESEARCH.md for the full evidence grading:
 *   - AtsApiProvider: Greenhouse/Lever/Ashby/SmartRecruiters application
 *     submission APIs exist but require a per-employer commercial
 *     partnership + API credentials QRify doesn't have in the MVP window.
 *   - RedirectPrefillProvider: most ATS public apply forms don't expose a
 *     documented prefill-via-URL contract; building one per-ATS is P1/P2 work.
 *   - BrowserAssistProvider: intentionally never built to bypass CAPTCHA or
 *     ToS — see docs/SECURITY.md § Non-Negotiables. Any future version must
 *     only automate flows a platform explicitly permits.
 */

export class AtsApiProvider implements ApplicationProvider {
  readonly type = "ATS_API" as const;
  readonly availability = "NOT_IMPLEMENTED" as const;

  canHandle(_job: Job): boolean {
    return false; // no Integration row currently reaches CONNECTED status for any ATS type
  }

  getMissingFields(_input: MissingFieldsInput): string[] {
    return ["ats_integration_not_configured"];
  }

  async deliver(_input: DeliverInput): Promise<DeliverResult> {
    return { success: false, error: "ATS API delivery is not implemented in this MVP (P1 roadmap item)" };
  }
}

export class RedirectPrefillProvider implements ApplicationProvider {
  readonly type = "REDIRECT_PREFILL" as const;
  readonly availability = "NOT_IMPLEMENTED" as const;

  canHandle(_job: Job): boolean {
    return false;
  }

  getMissingFields(_input: MissingFieldsInput): string[] {
    return ["redirect_prefill_not_configured"];
  }

  async deliver(_input: DeliverInput): Promise<DeliverResult> {
    return { success: false, error: "Redirect-prefill delivery is not implemented in this MVP (P1/P2 roadmap item)" };
  }
}

export class BrowserAssistProvider implements ApplicationProvider {
  readonly type = "BROWSER_ASSIST" as const;
  readonly availability = "NOT_IMPLEMENTED" as const;

  canHandle(_job: Job): boolean {
    return false;
  }

  getMissingFields(_input: MissingFieldsInput): string[] {
    return ["browser_assist_not_configured"];
  }

  async deliver(_input: DeliverInput): Promise<DeliverResult> {
    return {
      success: false,
      error: "Browser-assisted delivery is not implemented — QRify will never bypass CAPTCHA/anti-bot protections to build this (see docs/SECURITY.md)",
    };
  }
}
