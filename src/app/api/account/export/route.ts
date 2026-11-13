import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";

/** Downloads everything the user owns as JSON (data portability). */
export async function GET() {
  try {
    const user = await requireUser();
    const userId = user.id;

    const [
      profile,
      categories,
      paymentMethods,
      payees,
      transactions,
      subscriptions,
      projects,
      savingsPlans,
      savingsAssets,
      employers,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, locale: true, createdAt: true },
      }),
      prisma.category.findMany({ where: { userId } }),
      prisma.paymentMethod.findMany({ where: { userId } }),
      prisma.payee.findMany({ where: { userId } }),
      prisma.transaction.findMany({ where: { userId }, orderBy: { occurredAt: "asc" } }),
      prisma.subscription.findMany({
        where: { userId },
        include: { payments: true, monthSkips: true },
      }),
      prisma.project.findMany({
        where: { userId },
        include: { paymentPlans: { include: { installments: true } } },
      }),
      prisma.savingsPlan.findMany({ where: { userId }, include: { entries: true } }),
      prisma.savingsAsset.findMany({ where: { userId }, include: { entries: true } }),
      prisma.employer.findMany({ where: { userId }, include: { salarySlips: true } }),
    ]);

    const body = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: "Fin$ol",
        profile,
        categories,
        paymentMethods,
        payees,
        transactions,
        subscriptions,
        projects,
        savingsPlans,
        savingsAssets,
        employers,
      },
      null,
      2
    );

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="finsol-export-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
