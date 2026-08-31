import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, destroySession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { deactivateAccount } from "@/lib/candidate/account";

const DeleteSchema = z.object({
  confirm: z.literal(true),
  password: z.string().optional(),
});

/** Deactivates the current user's account — see src/lib/candidate/account.ts for exact scope. */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "You must confirm this action" }, { status: 400 });
  }

  // If the account has a password, require it as a second confirmation —
  // a hijacked session cookie alone shouldn't be able to delete the account.
  if (user.passwordHash) {
    if (!parsed.data.password || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
    }
  }

  await deactivateAccount(user.id);
  await destroySession();

  return NextResponse.json({ ok: true });
}
