"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Save, User, Award } from "lucide-react";
import { toast } from "sonner";
import {
  saveTeacherRemark,
  getTeacherRemarksForSection,
  saveCoScholasticGrades,
  getCoScholasticForSection,
} from "@/lib/actions/report-cards";

interface StudentOption {
  id: string;
  name: string;
  admissionNumber: string;
}

interface TeacherRemarksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  sectionId: string;
  academicYear: string;
  cycleName: string;
  examType?: string;
  students: StudentOption[];
  initialStudentId?: string | null;
  userRole: string;
  onSaved?: () => void;
}

const ACTIVITIES = [
  {
    key: "WORK_EDUCATION",
    label: "Work Education",
    desc: "Socially Useful Productive Work, practical tasks",
  },
  {
    key: "ART_EDUCATION",
    label: "Art Education",
    desc: "Visual arts, performing arts, creative expression",
  },
  {
    key: "HEALTH_AND_PHYSICAL_EDUCATION",
    label: "Health & Physical Education",
    desc: "Physical fitness, yoga, games, cleanliness",
  },
  {
    key: "DISCIPLINE",
    label: "Discipline & Moral Ethics",
    desc: "Attendance, values, sincerity, code of conduct",
  },
] as const;

type ActivityKey = typeof ACTIVITIES[number]["key"];
type GradeValue = "A" | "B" | "C";

interface ActivityState {
  grade: GradeValue | "";
  remarks: string;
}

export function TeacherRemarksDialog({
  open,
  onOpenChange,
  classId,
  sectionId,
  academicYear,
  cycleName,
  examType = "EVALUATION",
  students,
  initialStudentId,
  userRole,
  onSaved,
}: TeacherRemarksDialogProps) {
  const isStaff = userRole === "ADMIN" || userRole === "TEACHER";
  const cycleKey = `${examType}::${cycleName.toLowerCase().trim()}`;

  const [activeStudentId, setActiveStudentId] = useState<string>(
    initialStudentId || students[0]?.id || ""
  );

  // In-memory caches for section data so switching students is instantaneous
  const [remarksCache, setRemarksCache] = useState<Record<string, string>>({});
  const [coScholasticCache, setCoScholasticCache] = useState<
    Record<string, Record<string, ActivityState>>
  >({});
  const [isLoadingSection, setIsLoadingSection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Active student form state
  const [currentRemark, setCurrentRemark] = useState("");
  const [currentGrades, setCurrentGrades] = useState<Record<ActivityKey, ActivityState>>({
    WORK_EDUCATION: { grade: "", remarks: "" },
    ART_EDUCATION: { grade: "", remarks: "" },
    HEALTH_AND_PHYSICAL_EDUCATION: { grade: "", remarks: "" },
    DISCIPLINE: { grade: "", remarks: "" },
  });

  // 1. When dialog opens, initialize student selection and fetch section data
  useEffect(() => {
    if (!open) return;

    if (initialStudentId && students.some((s) => s.id === initialStudentId)) {
      setActiveStudentId(initialStudentId);
    } else if (students.length > 0 && !students.some((s) => s.id === activeStudentId)) {
      setActiveStudentId(students[0].id);
    }

    let cancelled = false;
    setIsLoadingSection(true);

    Promise.all([
      getTeacherRemarksForSection({ classId, sectionId, academicYear, cycleKey }),
      getCoScholasticForSection({ classId, sectionId, academicYear, term: cycleName }),
    ])
      .then(([, coRes]) => {
        if (cancelled) return;
        setIsLoadingSection(false);

        const newRemarks: Record<string, string> = {};

        const newCoScholastics: Record<string, Record<string, ActivityState>> = {};
        if (coRes.success && coRes.data) {
          for (const item of coRes.data) {
            if (!newCoScholastics[item.studentId]) {
              newCoScholastics[item.studentId] = {};
            }
            newCoScholastics[item.studentId][item.activity] = {
              grade: item.grade as GradeValue,
              remarks: item.remarks || "",
            };
          }
        }

        setRemarksCache(newRemarks);
        setCoScholasticCache(newCoScholastics);
      })
      .catch((err) => {
        if (cancelled) return;
        setIsLoadingSection(false);
        console.error("Error fetching section appraisal data:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [open, classId, sectionId, academicYear, cycleKey, cycleName, initialStudentId, students, activeStudentId]);

  // 2. Synchronize active student form when active student or cache changes
  useEffect(() => {
    if (!activeStudentId) return;

    const cachedRemark = remarksCache[activeStudentId] ?? "";
    setCurrentRemark(cachedRemark);

    const studentCo = coScholasticCache[activeStudentId] ?? {};
    setCurrentGrades({
      WORK_EDUCATION: studentCo.WORK_EDUCATION ?? { grade: "", remarks: "" },
      ART_EDUCATION: studentCo.ART_EDUCATION ?? { grade: "", remarks: "" },
      HEALTH_AND_PHYSICAL_EDUCATION: studentCo.HEALTH_AND_PHYSICAL_EDUCATION ?? {
        grade: "",
        remarks: "",
      },
      DISCIPLINE: studentCo.DISCIPLINE ?? { grade: "", remarks: "" },
    });
  }, [activeStudentId, remarksCache, coScholasticCache]);

  const activeStudent = students.find((s) => s.id === activeStudentId);

  // 3. Save current active student appraisals
  async function handleSaveAppraisal() {
    if (!activeStudentId || !activeStudent || !isStaff) return;

    setIsSaving(true);
    let saveFailed = false;

    try {
      // A. Save Teacher Remark if provided
      if (currentRemark.trim()) {
        const remRes = await saveTeacherRemark({
          studentId: activeStudentId,
          academicYear,
          cycleKey,
          cycleName,
          remarks: currentRemark.trim(),
        });

        if (!remRes.success) {
          toast.error(remRes.error ?? "Failed to save teacher remark.");
          saveFailed = true;
        } else {
          setRemarksCache((prev) => ({
            ...prev,
            [activeStudentId]: currentRemark.trim(),
          }));
        }
      }

      // B. Save Co-Scholastic Entries if any are selected
      const entriesToSave = Object.entries(currentGrades)
        .filter(([, val]) => val.grade !== "")
        .map(([activity, val]) => ({
          activity: activity as ActivityKey,
          grade: val.grade as GradeValue,
          remarks: val.remarks.trim() ? val.remarks.trim() : undefined,
        }));

      if (entriesToSave.length > 0) {
        const coRes = await saveCoScholasticGrades({
          studentId: activeStudentId,
          academicYear,
          term: cycleName,
          entries: entriesToSave,
        });

        if (!coRes.success) {
          toast.error(coRes.error ?? "Failed to record co-scholastic grades.");
          saveFailed = true;
        } else {
          setCoScholasticCache((prev) => ({
            ...prev,
            [activeStudentId]: { ...currentGrades },
          }));
        }
      }

      if (!saveFailed) {
        toast.success(`Appraisal recorded for ${activeStudent.name}.`);
        onSaved?.();
      }
    } catch (err) {
      console.error("Save appraisal error:", err);
      toast.error("An unexpected error occurred while saving appraisals.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectClass =
    "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Award className="size-5 text-primary" />
            Student Appraisals &amp; Co-Scholastic Evaluation
          </DialogTitle>
          <DialogDescription>
            Record official institutional remarks and CBSE co-scholastic grades for {cycleName}.
          </DialogDescription>
        </DialogHeader>

        {isLoadingSection ? (
          <div className="py-12 text-center space-y-2">
            <Loader2 className="size-6 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Loading section appraisals...</p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Student Selector */}
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <label
                htmlFor="appraisal-student-select"
                className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"
              >
                <User className="size-3.5" />
                Select Candidate
              </label>
              <select
                id="appraisal-student-select"
                value={activeStudentId}
                onChange={(e) => setActiveStudentId(e.target.value)}
                className={selectClass + " w-full font-medium"}
                disabled={isSaving}
              >
                {students.map((s, idx) => (
                  <option key={s.id} value={s.id}>
                    {idx + 1}. {s.name} ({s.admissionNumber})
                  </option>
                ))}
              </select>
            </div>

            {/* Section A: Class Teacher's Remarks */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="teacher-remarks-input"
                  className="text-xs font-bold uppercase tracking-wider text-foreground"
                >
                  Class Teacher&apos;s Remarks
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {currentRemark.length} / 1000 characters
                </span>
              </div>
              <textarea
                id="teacher-remarks-input"
                rows={3}
                maxLength={1000}
                placeholder="Enter qualitative observations on candidate conduct, academic improvement, and classroom participation..."
                value={currentRemark}
                onChange={(e) => setCurrentRemark(e.target.value)}
                disabled={!isStaff || isSaving}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring disabled:bg-muted/50 resize-y"
              />
            </div>

            {/* Section B: Co-Scholastic Activities */}
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Co-Scholastic Activities &amp; Discipline (CBSE 3-Point Scale)
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assign grades A (Outstanding), B (Proficient), or C (Developing).
                </p>
              </div>

              <div className="space-y-3">
                {ACTIVITIES.map((act) => {
                  const state = currentGrades[act.key] ?? { grade: "", remarks: "" };
                  return (
                    <div
                      key={act.key}
                      className="border rounded-xl p-3 bg-card shadow-xs space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-foreground">{act.label}</p>
                          <p className="text-[11px] text-muted-foreground">{act.desc}</p>
                        </div>
                        {/* 3-Point Grade Buttons */}
                        <div className="flex items-center gap-1.5 self-start sm:self-auto">
                          {(["A", "B", "C"] as GradeValue[]).map((g) => (
                            <button
                              key={g}
                              type="button"
                              disabled={!isStaff || isSaving}
                              onClick={() => {
                                setCurrentGrades((prev) => ({
                                  ...prev,
                                  [act.key]: {
                                    ...prev[act.key],
                                    grade: prev[act.key]?.grade === g ? "" : g,
                                  },
                                }));
                              }}
                              className={`size-8 rounded-md text-xs font-bold transition-colors ${
                                state.grade === g
                                  ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20"
                                  : "border border-input bg-background hover:bg-muted text-muted-foreground"
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Optional Trait Feedback */}
                      <input
                        type="text"
                        maxLength={250}
                        placeholder="Optional feedback (e.g. Enthusiastic participation, disciplined conduct)..."
                        value={state.remarks}
                        disabled={!isStaff || isSaving}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCurrentGrades((prev) => ({
                            ...prev,
                            [act.key]: {
                              ...prev[act.key],
                              remarks: val,
                            },
                          }));
                        }}
                        className="w-full h-8 rounded-md border border-input bg-transparent px-2.5 text-xs placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring disabled:bg-muted/50"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Close
          </Button>
          {isStaff && (
            <Button
              size="sm"
              onClick={handleSaveAppraisal}
              disabled={isSaving || isLoadingSection || !activeStudentId}
              className="gap-2 shadow-xs"
              id="save-appraisal-button"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save Appraisal
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
