"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getExamsForSection } from "@/lib/actions/exams";
import { ExamListTable } from "./exam-list-table";
import type { ExamSummary } from "@/lib/actions/exams";
import { Loader2 } from "lucide-react";

interface ClassOption {
  id: string;
  name: string;
  academicYear: string;
  sections: { id: string; name: string }[];
  enrolledCount?: number;
}

interface ExamWorkspaceProps {
  classes: ClassOption[];
  userRole: string;
}

export function ExamWorkspace({ classes, userRole }: ExamWorkspaceProps) {
  const router = useRouter();
  const firstClass = classes[0];

  const [selectedClassId, setSelectedClassId] = useState(
    firstClass?.id ?? ""
  );
  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? firstClass;
  const [selectedSectionId, setSelectedSectionId] = useState(
    selectedClass?.sections[0]?.id ?? ""
  );

  // Re-sync section when class changes
  useEffect(() => {
    const cls = classes.find((c) => c.id === selectedClassId);
    if (cls && cls.sections.length > 0) {
      const exists = cls.sections.some((s) => s.id === selectedSectionId);
      if (!exists) setSelectedSectionId(cls.sections[0].id);
    }
  }, [selectedClassId, classes, selectedSectionId]);

  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const enrolledCount = selectedClass?.enrolledCount ?? 0;

  // Fetch exams when class/section changes
  useEffect(() => {
    if (!selectedClassId || !selectedSectionId) {
      setExams([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getExamsForSection({
      classId: selectedClassId,
      sectionId: selectedSectionId,
    }).then((res) => {
      if (cancelled) return;
      setIsLoading(false);
      if (res.success && res.data) {
        setExams(res.data);
      } else {
        setExams([]);
      }
    });

    return () => { cancelled = true; };
  }, [selectedClassId, selectedSectionId]);

  const selectClass =
    "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-6">
      {/* Class / Section filters */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="space-y-1.5 flex-1">
            <label
              htmlFor="examClass"
              className="text-xs font-semibold text-muted-foreground"
            >
              Class / Standard
            </label>
            <select
              id="examClass"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className={selectClass + " w-full"}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.academicYear})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 flex-1">
            <label
              htmlFor="examSection"
              className="text-xs font-semibold text-muted-foreground"
            >
              Section / Division
            </label>
            <select
              id="examSection"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={!selectedClass || selectedClass.sections.length === 0}
              className={selectClass + " w-full disabled:opacity-50"}
            >
              {selectedClass?.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  Section {s.name}
                </option>
              ))}
              {(!selectedClass || selectedClass.sections.length === 0) && (
                <option value="">No sections available</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Exam table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Loading exams…</span>
        </div>
      ) : (
        <ExamListTable
          exams={exams}
          userRole={userRole}
          totalEnrolled={enrolledCount}
        />
      )}
    </div>
  );
}
