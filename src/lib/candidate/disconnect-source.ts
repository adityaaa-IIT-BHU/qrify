import { db } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { recomputeProfileCompleteness } from "@/lib/candidate/apply-extraction";

/**
 * Disconnects a ProfileSource and removes the facts it produced.
 *
 * `Experience`/`Education`/`Project`/`Certification` are soft-deleted
 * (they have `deletedAt`, so history/audit stays intact). `Skill` and
 * `Achievement` don't carry a `deletedAt` column — each `Skill` row is
 * keyed uniquely by (candidateProfileId, name) with a single `sourceId`
 * (the most recent source to touch it), so hard-deleting the ones this
 * source owns is the correct behavior, not a shortcut: there's no
 * "soft" state that's meaningfully different for a fact with no other
 * corroborating source on file.
 */
export async function disconnectSource(candidateProfileId: string, sourceId: string, actorUserId: string): Promise<void> {
  const source = await db.profileSource.findUnique({ where: { id: sourceId } });
  if (!source || source.candidateProfileId !== candidateProfileId) {
    throw new Error("Source not found");
  }

  const now = new Date();
  await db.$transaction([
    db.experience.updateMany({ where: { sourceId, candidateProfileId }, data: { deletedAt: now } }),
    db.education.updateMany({ where: { sourceId, candidateProfileId }, data: { deletedAt: now } }),
    db.project.updateMany({ where: { sourceId, candidateProfileId }, data: { deletedAt: now } }),
    db.certification.updateMany({ where: { sourceId, candidateProfileId }, data: { deletedAt: now } }),
    db.achievement.deleteMany({ where: { sourceId, candidateProfileId } }),
    db.skill.deleteMany({ where: { sourceId, candidateProfileId } }),
    db.profileSource.update({ where: { id: sourceId }, data: { status: "DISCONNECTED" } }),
  ]);

  await recordAuditEvent({
    actorUserId,
    action: "profile.source_disconnected",
    targetType: "ProfileSource",
    targetId: sourceId,
    metadata: { sourceType: source.type },
  });

  await recomputeProfileCompleteness(candidateProfileId);
}
