import { db } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";

/**
 * Account deletion — deactivates the account rather than a hard purge.
 *
 * Scope decision (see docs/PRIVACY.md § Before Launch): `User` and
 * `CandidateProfile` are soft-deleted (excluded from login/session checks
 * immediately — see src/lib/auth/session.ts and the login route), all
 * sessions are revoked, and OAuth tokens are hard-deleted (no reason to
 * keep third-party credentials for a deactivated account).
 *
 * `Application`/`Job` rows the candidate submitted are deliberately left
 * intact — an employer's historical applicant record for a real submitted
 * application is a legitimate record to retain, not something this action
 * should silently corrupt via cascading deletes. Whether QRify should
 * offer a *further* full-erasure path beyond deactivation is a legal
 * question (retention obligations vs. erasure rights) — flagged, not
 * decided in code. See docs/PRIVACY.md.
 */
export async function deactivateAccount(userId: string): Promise<void> {
  const profile = await db.candidateProfile.findUnique({ where: { userId } });

  await db.$transaction([
    db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.oAuthConnection.deleteMany({ where: { userId } }),
    db.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }),
    ...(profile ? [db.candidateProfile.update({ where: { id: profile.id }, data: { deletedAt: new Date() } })] : []),
  ]);

  await recordAuditEvent({ actorUserId: userId, action: "account.deactivated", targetType: "User", targetId: userId });
}
