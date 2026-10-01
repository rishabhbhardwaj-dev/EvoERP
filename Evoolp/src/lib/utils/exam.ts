import type { GradeLabelValue } from "@/lib/validations/exam";

export type { GradeLabelValue };

/**
 * Computes the CBSE scholastic grade label from a percentage score.
 * Boundaries (inclusive): A1=91-100, A2=81-90, B1=71-80, B2=61-70,
 * C1=51-60, C2=41-50, D=33-40, E=<33.
 * Pure synchronous utility function.
 */
export function computeGrade(percentage: number): GradeLabelValue {
  if (percentage >= 91) return "A1";
  if (percentage >= 81) return "A2";
  if (percentage >= 71) return "B1";
  if (percentage >= 61) return "B2";
  if (percentage >= 51) return "C1";
  if (percentage >= 41) return "C2";
  if (percentage >= 33) return "D";
  return "E";
}
