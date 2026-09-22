import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";

/**
 * Tenant context derived from the authenticated session.
 * Client-supplied schoolIds are never trusted — always resolve server-side.
 */
export interface TenantContext {
  userId: string;
  schoolId: string;
  role: Role;
  name: string;
  email: string;
}

export class TenantError extends Error {
  constructor(message = "No tenant context available") {
    super(message);
    this.name = "TenantError";
  }
}

/** Reads the full tenant context from the current session (or null). */
export async function getTenantContext(): Promise<TenantContext | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.schoolId || !user.role) return null;
  return {
    userId: user.id,
    schoolId: user.schoolId,
    role: user.role,
    name: user.name ?? "",
    email: user.email ?? "",
  };
}

/**
 * Tenant middleware helper: extracts schoolId from the authenticated session.
 * Throws when called outside an authenticated request.
 */
export async function getSchoolId(): Promise<string> {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthenticated: cannot resolve schoolId");
  return ctx.schoolId;
}

/** Like getTenantContext() but throws instead of returning null. */
export async function requireTenant(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError();
  return ctx;
}

/** Asserts the current user holds one of the given roles. */
export async function requireRole(...roles: Role[]): Promise<TenantContext> {
  const ctx = await requireTenant();
  if (!roles.includes(ctx.role)) {
    throw new TenantError(`Forbidden: requires role ${roles.join(" | ")}`);
  }
  return ctx;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

/**
 * Indian fiscal year: April 1 to March 31.
 * Returns the label "YYYY-YYYY" (e.g. "2025-2026") and its bounds.
 */
export interface FiscalYear {
  label: string;
  start: Date;
  end: Date;
}

export function getFiscalYear(date: Date = new Date()): FiscalYear {
  const year = date.getFullYear();
  // April = month index 3. FY starts in April of `startYear`.
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return {
    label: `${startYear}-${startYear + 1}`,
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
  };
}
