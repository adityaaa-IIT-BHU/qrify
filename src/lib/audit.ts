import { db } from "@/lib/db";

export type AuditActorType = "USER" | "SYSTEM" | "EMPLOYER";

export interface AuditEventInput {
  actorUserId?: string | null;
  actorType?: AuditActorType;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Append-only audit trail for security- and privacy-sensitive actions
 * (auth, consent changes, OAuth connects/disconnects, application
 * submission, data export/delete). Never throws into the caller's flow —
 * a logging failure must not block the underlying action.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType ?? "USER",
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata as never,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record event", input.action, err);
  }
}
