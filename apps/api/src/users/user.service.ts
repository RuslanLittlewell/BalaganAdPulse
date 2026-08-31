import { prisma } from "../lib/prisma.js";
import { getPng, putPng } from "../lib/storage.js";

function avatarKey(userId: string): string {
  return `users/${userId}/avatar.png`;
}
import { ForbiddenError } from "../errors.js";
import { assertAvatarPath, assertAvatarPng } from "../lib/avatar.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signAccessToken } from "../auth/token.js";
import type { UpdateProfileInput } from "../auth/auth.schema.js";

export async function saveAvatar(userId: string, png: Buffer, avatarPath: string): Promise<void> {
  assertAvatarPng(png);
  assertAvatarPath(avatarPath);
  await putPng(avatarKey(userId), png);
  await prisma.user.update({
    where: { id: userId },
    // Not a URL any more: nothing fetches it. It records that a picture
    // exists and when it landed, which is all the profile needs to know.
    data: { image: new Date().toISOString(), avatarPath },
  });
}

/**
 * The profile carries the picture itself, as a data URL, rather than a link to
 * fetch it from. A separate endpoint would need the bearer token, so the
 * browser could never put it in an `<img src>` — the client had to fetch the
 * bytes by hand and every avatar-less user paid a 404 for the privilege.
 */
export async function profile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true, image: true, avatarPath: true },
  });
  return { ...user, image: await avatarDataUrl(userId, user.image) };
}

/** `image` is only a marker that one was uploaded; the bytes live in storage. */
async function avatarDataUrl(userId: string, marker: string | null): Promise<string | null> {
  if (!marker) return null;
  try {
    const bytes = await getPng(avatarKey(userId));
    return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    // A picture the storage service cannot serve is a missing picture, not a
    // broken profile: the caller still needs their name and email.
    return null;
  }
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (input.newPassword) {
    const matches = await verifyPassword(input.currentPassword ?? "", user.passwordHash);
    if (!matches) throw new ForbiddenError("Current password is incorrect");
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      ...(input.newPassword ? { passwordHash: await hashPassword(input.newPassword) } : {}),
    },
  });
  return {
    accessToken: await signAccessToken({
      sub: updated.id,
      name: updated.name,
      email: updated.email,
    }),
  };
}
