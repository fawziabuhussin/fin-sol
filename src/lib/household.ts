import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { HouseholdRole } from "@/generated/prisma/client";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function getActiveHouseholdId(userId: string): Promise<string | null> {
  const session = await auth();
  if (session?.user?.activeHouseholdId) {
    return session.user.activeHouseholdId;
  }
  const membership = await prisma.householdMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
  return membership?.householdId ?? null;
}

export async function requireHouseholdAccess(
  userId: string,
  householdId: string
) {
  const member = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId, userId } },
  });
  if (!member) throw new Error("FORBIDDEN");
  return member;
}

export async function ensureHouseholdForUser(
  userId: string,
  householdName = "المنزل"
) {
  const existing = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
  });
  if (existing) return existing.household;

  const household = await prisma.household.create({
    data: {
      name: householdName,
      members: {
        create: { userId, role: HouseholdRole.OWNER },
      },
    },
  });
  return household;
}
