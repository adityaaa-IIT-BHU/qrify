import "server-only";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import type { OAuthProfile, OAuthProviderConfig } from "@/lib/auth/oauth";

interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
}

/**
 * Finds the User for this OAuth identity, or creates one. Matching order:
 * (1) an existing OAuthConnection for this exact provider account, then
 * (2) an existing User by verified email (account linking), then create new.
 */
export async function findOrCreateUserFromOAuth(
  config: OAuthProviderConfig,
  profile: OAuthProfile,
  tokens: TokenBundle,
): Promise<{ userId: string; isNewUser: boolean }> {
  const providerEnum = config.id.toUpperCase() as "GOOGLE" | "GITHUB" | "LINKEDIN";

  const existingConnection = await db.oAuthConnection.findUnique({
    where: { provider_providerAccountId: { provider: providerEnum, providerAccountId: profile.providerAccountId } },
  });

  const tokenExpiresAt = tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null;

  if (existingConnection) {
    await db.oAuthConnection.update({
      where: { id: existingConnection.id },
      data: {
        accessTokenEnc: encryptSecret(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : existingConnection.refreshTokenEnc,
        scope: tokens.scope ?? existingConnection.scope,
        tokenExpiresAt,
        lastSyncedAt: new Date(),
        profileSnapshot: profile.raw as never,
      },
    });
    return { userId: existingConnection.userId, isNewUser: false };
  }

  let user = profile.email ? await db.user.findUnique({ where: { email: profile.email } }) : null;
  let isNewUser = false;

  if (!user) {
    if (!profile.email) {
      throw new Error(`${config.id} did not return an email address — cannot create or link an account`);
    }
    user = await db.user.create({
      data: { email: profile.email, name: profile.name, image: profile.avatarUrl, emailVerifiedAt: new Date() },
    });
    isNewUser = true;
  }

  await db.oAuthConnection.create({
    data: {
      userId: user.id,
      provider: providerEnum,
      providerAccountId: profile.providerAccountId,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      scope: tokens.scope,
      tokenExpiresAt,
      lastSyncedAt: new Date(),
      profileSnapshot: profile.raw as never,
    },
  });

  return { userId: user.id, isNewUser };
}
