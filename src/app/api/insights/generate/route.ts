import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveHouseholdId, requireHouseholdAccess } from "@/lib/household";
import { generateInsights } from "@/lib/insights/engine";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const householdId = await getActiveHouseholdId(session.user.id);
    if (!householdId) {
      return NextResponse.json({ error: "No household" }, { status: 400 });
    }

    await requireHouseholdAccess(session.user.id, householdId);
    const count = await generateInsights(householdId);

    return NextResponse.json({ generated: count });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }
}
