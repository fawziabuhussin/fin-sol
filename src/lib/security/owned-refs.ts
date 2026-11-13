import { prisma } from "@/lib/db";

/**
 * Thrown when a request references a row (category, project, …) that does not
 * belong to the signed-in user. Mapped to HTTP 400 by `handleApiError`.
 */
export class InvalidReferenceError extends Error {
  constructor(public readonly field: string) {
    super("INVALID_REFERENCE");
    this.name = "InvalidReferenceError";
  }
}

type Refs = {
  categoryId?: string | null;
  projectId?: string | null;
  payeeId?: string | null;
  paymentMethodId?: string | null;
  employerId?: string | null;
};

/**
 * Verifies every foreign key in `refs` is owned by `userId`. Without this, a
 * client could attach their rows to another tenant's category/project and
 * read its name back through joined queries.
 */
export async function assertOwnedRefs(userId: string, refs: Refs) {
  const checks: Promise<string | null>[] = [];
  const check = (field: string, count: Promise<number>) =>
    checks.push(count.then((n) => (n > 0 ? null : field)));

  if (refs.categoryId)
    check("categoryId", prisma.category.count({ where: { id: refs.categoryId, userId } }));
  if (refs.projectId)
    check("projectId", prisma.project.count({ where: { id: refs.projectId, userId } }));
  if (refs.payeeId)
    check("payeeId", prisma.payee.count({ where: { id: refs.payeeId, userId } }));
  if (refs.paymentMethodId)
    check(
      "paymentMethodId",
      prisma.paymentMethod.count({ where: { id: refs.paymentMethodId, userId } })
    );
  if (refs.employerId)
    check("employerId", prisma.employer.count({ where: { id: refs.employerId, userId } }));

  const bad = (await Promise.all(checks)).find(Boolean);
  if (bad) throw new InvalidReferenceError(bad);
}
