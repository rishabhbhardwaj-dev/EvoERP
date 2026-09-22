import { prisma } from "@/lib/prisma";

export interface AuditEntry {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

/**
 * Writes an audit log entry: userId, action, entityType, entityId,
 * oldValues, newValues (tenant-scoped by schoolId).
 * Failures are logged but never break the main operation.
 */
export async function logAudit(
  schoolId: string,
  entry: AuditEntry,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        schoolId,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValues: entry.oldValues ?? undefined,
        newValues: entry.newValues ?? undefined,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit log:", error);
  }
}

/**
 * Returns only the fields that changed between two objects,
 * ready to pass as oldValues/newValues to logAudit().
 */
export function diffChanges<T extends Record<string, unknown>>(
  oldObj: T,
  newObj: Partial<T>,
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const key of Object.keys(newObj)) {
    if (oldObj[key] !== newObj[key]) {
      oldValues[key] = oldObj[key];
      newValues[key] = newObj[key];
    }
  }
  return { oldValues, newValues };
}
