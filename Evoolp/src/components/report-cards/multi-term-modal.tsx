"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Calculator, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PrintableReportCard } from "./printable-report-card";
import {
  getMultiTermReportCard,
  type ExamCycleOption,
  type MultiTermReportCardData,
} from "@/lib/actions/report-cards";

interface StudentOption {
  id: string;
  name: string;
  admissionNumber: string;
}

interface MultiTermModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId?: string;
  sectionId?: string;
  academicYear: string;
  cycles: ExamCycleOption[];
  students: StudentOption[];
  initialStudentId?: string | null;
}

interface TermWeightState {
  cycleId: string;
  cycleName: string;
  cycleKey: string;
  examIds: string[];
  enabled: boolean;
  weight: number;
}

export function MultiTermModal({
  open,
  onOpenChange,
  academicYear,
  cycles,
  students,
  initialStudentId,
}: MultiTermModalProps) {
  const [activeStudentId, setActiveStudentId] = useState<string>(
    initialStudentId || students[0]?.id || ""
  );

  const [terms, setTerms] = useState<TermWeightState[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiledData, setCompiledData] = useState<MultiTermReportCardData | null>(null);

  // Initialize terms whenever cycles or modal open state changes
  useEffect(() => {
    if (!open) {
      setCompiledData(null);
      return;
    }

    if (initialStudentId && students.some((s) => s.id === initialStudentId)) {
      setActiveStudentId(initialStudentId);
    } else if (students.length > 0 && !students.some((s) => s.id === activeStudentId)) {
      setActiveStudentId(students[0].id);
    }

    // Default distribution: enable all cycles with equal integer split
    const count = cycles.length;
    const defaultWeight = count > 0 ? Math.floor(100 / count) : 0;
    const remainder = count > 0 ? 100 - defaultWeight * count : 0;

    const initialTerms: TermWeightState[] = cycles.map((c, idx) => ({
      cycleId: c.cycleId,
      cycleName: c.cycleName,
      cycleKey: `${c.examType || "EXAM"}::${c.cycleName.toLowerCase().trim()}`,
      examIds: c.examIds,
      enabled: true,
      weight: idx === count - 1 ? defaultWeight + remainder : defaultWeight,
    }));

    setTerms(initialTerms);
    setCompiledData(null);
  }, [open, cycles, initialStudentId, students, activeStudentId]);

  const enabledTerms = terms.filter((t) => t.enabled);
  const totalWeight = Math.round(enabledTerms.reduce((sum, t) => sum + (t.weight || 0), 0) * 100) / 100;
  const isWeightValid = Math.abs(totalWeight - 100) < 0.01;
  const hasMinTerms = enabledTerms.length >= 2;
  const canCompile = hasMinTerms && isWeightValid && !isCompiling && Boolean(activeStudentId);

  async function handleCompile() {
    if (!canCompile || !activeStudentId) return;

    setIsCompiling(true);
    try {
      const res = await getMultiTermReportCard({
        studentId: activeStudentId,
        academicYear,
        terms: enabledTerms.map((t) => ({
          termName: t.cycleName,
          cycleKey: t.cycleKey,
          weight: t.weight,
          examIds: t.examIds,
        })),
      });

      if (res.success && res.data) {
        setCompiledData(res.data);
      } else {
        toast.error(res.error ?? "Failed to compile multi-term annual report card.");
      }
    } catch (err) {
      console.error("Multi-term compilation error:", err);
      toast.error("An unexpected network error occurred while compiling annual report card.");
    } finally {
      setIsCompiling(false);
    }
  }

  const selectClass =
    "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 print:hidden">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Calculator className="size-5 text-primary" />
            Annual Multi-Term Synthesis Engine
          </DialogTitle>
          <DialogDescription>
            Synthesize scholastic performance across dynamic evaluation cycles with weighted percentage normalization.
          </DialogDescription>
        </DialogHeader>

        {compiledData ? (
          /* Render Compiled Report Card */
          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-center print:hidden border-b pb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompiledData(null)}
                className="gap-1.5"
              >
                <ArrowLeft className="size-3.5" />
                Adjust Terms &amp; Weights
              </Button>
              <span className="text-xs text-muted-foreground">
                Compiled for: <strong>{compiledData.student.name}</strong> ({compiledData.student.admissionNumber})
              </span>
            </div>
            <PrintableReportCard multiTermData={compiledData} onClose={() => onOpenChange(false)} />
          </div>
        ) : (
          /* Configuration Matrix View */
          <div className="space-y-6 pt-2">
            {/* Candidate Selector */}
            <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
              <label
                htmlFor="multi-term-student-select"
                className="text-xs font-semibold text-muted-foreground"
              >
                Select Candidate
              </label>
              <select
                id="multi-term-student-select"
                value={activeStudentId}
                onChange={(e) => setActiveStudentId(e.target.value)}
                className={selectClass + " w-full font-medium"}
                disabled={isCompiling}
              >
                {students.map((s, idx) => (
                  <option key={s.id} value={s.id}>
                    {idx + 1}. {s.name} ({s.admissionNumber})
                  </option>
                ))}
              </select>
            </div>

            {/* Terms and Weights Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Configure Evaluation Terms &amp; Weights
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select a minimum of 2 cycles. Configured weights must sum to exactly 100%.
                  </p>
                </div>
                {/* Weight Indicator */}
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold border ${
                    isWeightValid && hasMinTerms
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-amber-50 text-amber-800 border-amber-300"
                  }`}
                >
                  {isWeightValid && hasMinTerms ? (
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="size-3.5 text-amber-600" />
                  )}
                  <span>Total Weight: {totalWeight}%</span>
                </div>
              </div>

              {cycles.length < 2 ? (
                <div className="p-8 text-center border rounded-xl bg-card text-muted-foreground text-sm space-y-1">
                  <AlertCircle className="size-6 mx-auto text-muted-foreground mb-2" />
                  <p className="font-semibold text-foreground">At Least 2 Cycles Required</p>
                  <p className="text-xs max-w-sm mx-auto">
                    Annual multi-term compilation requires at least two conducted evaluation cycles in this standard.
                  </p>
                </div>
              ) : (
                <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 w-16 text-center">Include</th>
                        <th className="px-4 py-3">Evaluation Cycle</th>
                        <th className="px-4 py-3 text-center">Subjects</th>
                        <th className="px-4 py-3 w-40 text-right">Weight Percentage (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {terms.map((term, idx) => (
                        <tr
                          key={term.cycleId}
                          className={`hover:bg-muted/40 transition-colors ${
                            !term.enabled ? "opacity-50" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={term.enabled}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setTerms((prev) =>
                                  prev.map((t, i) =>
                                    i === idx ? { ...t, enabled: checked } : t
                                  )
                                );
                              }}
                              className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {term.cycleName}
                            <span className="block text-[11px] text-muted-foreground font-mono">
                              {term.cycleKey}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {term.examIds.length} subjects
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                step={1}
                                value={term.weight}
                                disabled={!term.enabled || isCompiling}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setTerms((prev) =>
                                    prev.map((t, i) =>
                                      i === idx ? { ...t, weight: val } : t
                                    )
                                  );
                                }}
                                className="w-20 h-8 rounded-md border border-input bg-background px-2 text-right text-xs font-semibold outline-none focus:border-ring focus:ring-1 focus:ring-ring disabled:bg-muted/50"
                              />
                              <span className="text-xs text-muted-foreground font-medium">%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Validation Warning Callouts */}
              {!hasMinTerms && cycles.length >= 2 && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="size-3.5" />
                  Please select at least two terms for annual compilation.
                </p>
              )}
              {hasMinTerms && !isWeightValid && (
                <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                  <AlertCircle className="size-3.5" />
                  Configured weights sum to {totalWeight}%. They must sum to exactly 100.00%.
                </p>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCompile}
                disabled={!canCompile}
                className="gap-2 shadow-xs"
                id="compile-multi-term-button"
              >
                {isCompiling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Calculator className="size-4" />
                )}
                Compile Annual Report Card
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
