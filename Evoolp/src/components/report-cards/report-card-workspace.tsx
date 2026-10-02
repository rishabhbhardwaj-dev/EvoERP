"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getAvailableExamCyclesForSection,
  getClassReportCardRoster,
  getStudentReportCard,
  exportClassReportCardSummaryCsv,
  type ExamCycleOption,
  type ClassReportCardRosterItem,
  type ReportCardData,
} from "@/lib/actions/report-cards";
import { StudentRosterList } from "./student-roster-list";
import { ReportCardModal } from "./report-card-modal";
import { BatchReportCardModal } from "./batch-report-card-modal";
import { TeacherRemarksDialog } from "./teacher-remarks-dialog";
import { MultiTermModal } from "./multi-term-modal";

interface ClassOption {
  id: string;
  name: string;
  academicYear: string;
  sections: { id: string; name: string }[];
}

interface ReportCardWorkspaceProps {
  classes: ClassOption[];
  userRole: string;
}

export function ReportCardWorkspace({
  classes,
  userRole,
}: ReportCardWorkspaceProps) {
  const isStaff = userRole === "ADMIN" || userRole === "TEACHER";
  const firstClass = classes[0];

  const [selectedClassId, setSelectedClassId] = useState(firstClass?.id ?? "");
  const selectedClass =
    classes.find((c) => c.id === selectedClassId) ?? firstClass;
  const [selectedSectionId, setSelectedSectionId] = useState(
    selectedClass?.sections[0]?.id ?? ""
  );

  // Sync section when class changes
  useEffect(() => {
    const cls = classes.find((c) => c.id === selectedClassId);
    if (cls && cls.sections.length > 0) {
      const exists = cls.sections.some((s) => s.id === selectedSectionId);
      if (!exists) {
        setSelectedSectionId(cls.sections[0].id);
      }
    }
  }, [selectedClassId, classes, selectedSectionId]);

  // Available cycles
  const [cycles, setCycles] = useState<ExamCycleOption[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [isLoadingCycles, setIsLoadingCycles] = useState(false);

  // Roster data
  const [roster, setRoster] = useState<ClassReportCardRosterItem[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);

  // Client-side batch selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Modals state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [reportCardData, setReportCardData] = useState<ReportCardData | null>(null);
  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [remarksDialogOpen, setRemarksDialogOpen] = useState(false);
  const [multiTermModalOpen, setMultiTermModalOpen] = useState(false);

  // Export CSV state
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // 1. Fetch cycles when class & section change
  useEffect(() => {
    if (!selectedClassId || !selectedSectionId || !selectedClass) {
      setCycles([]);
      setSelectedCycleId("");
      return;
    }

    let cancelled = false;
    setIsLoadingCycles(true);

    getAvailableExamCyclesForSection({
      classId: selectedClassId,
      sectionId: selectedSectionId,
      academicYear: selectedClass.academicYear,
    }).then((res) => {
      if (cancelled) return;
      setIsLoadingCycles(false);
      if (res.success && res.data && res.data.length > 0) {
        setCycles(res.data);
        setSelectedCycleId(res.data[0].cycleId);
      } else {
        setCycles([]);
        setSelectedCycleId("");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedClassId, selectedSectionId, selectedClass]);

  // Selected cycle object
  const activeCycle = cycles.find((c) => c.cycleId === selectedCycleId);

  // 2. Clear selections whenever class, section, or cycle changes
  useEffect(() => {
    setSelectedStudentIds([]);
  }, [selectedClassId, selectedSectionId, selectedCycleId]);

  // 3. Fetch roster when cycle changes
  useEffect(() => {
    if (!selectedClassId || !selectedSectionId || !selectedClass || !activeCycle) {
      setRoster([]);
      return;
    }

    let cancelled = false;
    setIsLoadingRoster(true);

    getClassReportCardRoster({
      classId: selectedClassId,
      sectionId: selectedSectionId,
      academicYear: selectedClass.academicYear,
      examIds: activeCycle.examIds,
    }).then((res) => {
      if (cancelled) return;
      setIsLoadingRoster(false);
      if (res.success && res.data) {
        setRoster(res.data);
      } else {
        setRoster([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedClassId, selectedSectionId, selectedClass, activeCycle]);

  // 4. Open Single Student Report Card Preview
  async function handleSelectStudent(studentId: string) {
    if (!selectedClass || !activeCycle) return;

    setSelectedStudentId(studentId);

    try {
      const res = await getStudentReportCard({
        studentId,
        academicYear: selectedClass.academicYear,
        examIds: activeCycle.examIds,
        cycleName: activeCycle.cycleName,
      });

      if (res.success && res.data) {
        setReportCardData(res.data);
        setSingleModalOpen(true);
      } else {
        toast.error(res.error ?? "Failed to compile student report card.");
      }
    } catch {
      toast.error("An error occurred while compiling report card.");
    }
  }

  // 5. Selection Handlers
  function handleToggleSelectStudent(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  }

  function handleSelectAll() {
    setSelectedStudentIds(roster.map((r) => r.studentId));
  }

  function handleDeselectAll() {
    setSelectedStudentIds([]);
  }

  // 6. CSV Export Action
  async function handleExportCsv() {
    if (!selectedClass || !activeCycle || !selectedClassId || !selectedSectionId) {
      toast.error("Please select a valid class, section, and evaluation cycle first.");
      return;
    }

    setIsExportingCsv(true);
    try {
      const res = await exportClassReportCardSummaryCsv({
        classId: selectedClassId,
        sectionId: selectedSectionId,
        academicYear: selectedClass.academicYear,
        examIds: activeCycle.examIds,
        cycleName: activeCycle.cycleName,
      });

      if (res.success && res.data) {
        // Create Blob with UTF-8 encoding preserved
        const blob = new Blob([res.data.csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(
          `Exported summary for ${res.data.totalStudents} candidate(s).`
        );
      } else {
        toast.error(res.error ?? "Failed to export report card CSV.");
      }
    } catch (err) {
      console.error("CSV Export error:", err);
      toast.error("An unexpected error occurred while exporting report card CSV.");
    } finally {
      setIsExportingCsv(false);
    }
  }

  const rosterStudents = roster.map((r) => ({
    id: r.studentId,
    name: r.studentName,
    admissionNumber: r.admissionNumber,
  }));

  const selectClass =
    "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-6">
      {/* Selection Filter Bar */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {/* Class Select */}
          <div className="space-y-1.5">
            <label
              htmlFor="rc-class"
              className="text-xs font-semibold text-muted-foreground"
            >
              Class / Standard
            </label>
            <select
              id="rc-class"
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

          {/* Section Select */}
          <div className="space-y-1.5">
            <label
              htmlFor="rc-section"
              className="text-xs font-semibold text-muted-foreground"
            >
              Section / Division
            </label>
            <select
              id="rc-section"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className={selectClass + " w-full"}
              disabled={!selectedClass?.sections.length}
            >
              {selectedClass?.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  Section {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Exam Cycle Select */}
          <div className="space-y-1.5">
            <label
              htmlFor="rc-cycle"
              className="text-xs font-semibold text-muted-foreground"
            >
              Evaluation Cycle
            </label>
            <select
              id="rc-cycle"
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className={selectClass + " w-full"}
              disabled={isLoadingCycles || cycles.length === 0}
            >
              {cycles.length === 0 ? (
                <option value="">No evaluation cycles found</option>
              ) : (
                cycles.map((c) => (
                  <option key={c.cycleId} value={c.cycleId}>
                    {c.cycleName} ({c.examCount} subjects)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      {isLoadingCycles || isLoadingRoster ? (
        <div className="border rounded-xl bg-card p-12 text-center shadow-xs">
          <Loader2 className="size-6 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">
            Loading class roster and evaluation cycles...
          </p>
        </div>
      ) : cycles.length === 0 ? (
        <div className="border rounded-xl bg-card p-12 text-center shadow-xs">
          <AlertCircle className="size-8 text-muted-foreground mx-auto mb-2" />
          <h3 className="font-semibold text-base">No Evaluation Cycles Found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            No examinations have been created for {selectedClass?.name} - Section{" "}
            {selectedClass?.sections.find((s) => s.id === selectedSectionId)?.name} in{" "}
            {selectedClass?.academicYear}.
          </p>
        </div>
      ) : (
        <StudentRosterList
          roster={roster}
          cycleName={activeCycle?.cycleName ?? "Examination"}
          onSelectStudent={handleSelectStudent}
          selectedStudentId={selectedStudentId}
          selectedStudentIds={selectedStudentIds}
          onToggleSelectStudent={handleToggleSelectStudent}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onBatchPrint={() => setBatchModalOpen(true)}
          onExportCsv={handleExportCsv}
          onManageRemarks={() => setRemarksDialogOpen(true)}
          onOpenMultiTerm={() => setMultiTermModalOpen(true)}
          isStaff={isStaff}
          isExportingCsv={isExportingCsv}
        />
      )}

      {/* Single Printable Report Card Modal (Stage 1 Compatible) */}
      <ReportCardModal
        open={singleModalOpen}
        onOpenChange={setSingleModalOpen}
        reportCardData={reportCardData}
      />

      {/* Batch Printable Report Cards Modal (Stage 2 N+1 Free Engine) */}
      {activeCycle && selectedClass && (
        <BatchReportCardModal
          open={batchModalOpen}
          onOpenChange={setBatchModalOpen}
          studentIds={selectedStudentIds}
          classId={selectedClassId}
          sectionId={selectedSectionId}
          academicYear={selectedClass.academicYear}
          examIds={activeCycle.examIds}
          cycleName={activeCycle.cycleName}
          cycleKey={`${activeCycle.examType || "EXAM"}::${activeCycle.cycleName.toLowerCase().trim()}`}
        />
      )}

      {/* Teacher Remarks & Co-Scholastic Editor Dialog (Stage 2) */}
      {activeCycle && selectedClass && (
        <TeacherRemarksDialog
          open={remarksDialogOpen}
          onOpenChange={setRemarksDialogOpen}
          classId={selectedClassId}
          sectionId={selectedSectionId}
          academicYear={selectedClass.academicYear}
          cycleName={activeCycle.cycleName}
          examType={activeCycle.examType}
          students={rosterStudents}
          initialStudentId={selectedStudentIds[0] || selectedStudentId}
          userRole={userRole}
          onSaved={() => {
            // Re-fetch report card data if single preview was loaded
            if (selectedStudentId && singleModalOpen) {
              handleSelectStudent(selectedStudentId);
            }
          }}
        />
      )}

      {/* Annual Multi-Term Compilation Modal (Stage 2) */}
      {selectedClass && (
        <MultiTermModal
          open={multiTermModalOpen}
          onOpenChange={setMultiTermModalOpen}
          classId={selectedClassId}
          sectionId={selectedSectionId}
          academicYear={selectedClass.academicYear}
          cycles={cycles}
          students={rosterStudents}
          initialStudentId={selectedStudentIds[0] || selectedStudentId}
        />
      )}
    </div>
  );
}
