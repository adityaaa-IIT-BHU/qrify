import "server-only";
import type { Job } from "@/generated/prisma/client";
import { QRifyNativeProvider } from "@/lib/providers/qrify-native.provider";
import { EmailApplicationProvider } from "@/lib/providers/email.provider";
import { AtsApiProvider, RedirectPrefillProvider, BrowserAssistProvider } from "@/lib/providers/stubs";
import type { ApplicationProvider } from "@/lib/providers/types";

export type { ApplicationProvider, DeliverInput, DeliverResult } from "@/lib/providers/types";

const nativeProvider = new QRifyNativeProvider();
const emailProvider = new EmailApplicationProvider();
const atsProvider = new AtsApiProvider();
const redirectProvider = new RedirectPrefillProvider();
const browserAssistProvider = new BrowserAssistProvider();

/** QRifyNativeProvider always runs. Any additional providers that canHandle() the job run alongside it. */
export function selectProviders(job: Job): ApplicationProvider[] {
  const supplementary = [atsProvider, redirectProvider, browserAssistProvider, emailProvider].filter(
    (p) => p.availability === "AVAILABLE" && p.canHandle(job),
  );
  return [nativeProvider, ...supplementary];
}

export function allProviders(): ApplicationProvider[] {
  return [nativeProvider, emailProvider, atsProvider, redirectProvider, browserAssistProvider];
}
