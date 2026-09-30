"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AttendanceTable } from "./attendance-table";
import {
  getAttendanceRegister,
  saveAttendanceRegister,
  type AttendanceRegisterData,
  type RegisterStudentRow,
} from "@/lib/actions/attendance";
import type { AttendanceStatusType } from "@/lib/validations/attendance";
import { toast } from "sonner";
import {
  CheckCircle,
  AlertCircle,
  Lock,
  Loader2,
  Users,
  Check,
  X,
  FileText,
} from "lucide-react";
import type { AppRole } from "@/types/next-auth";

export interface ClassOption {
  id: string;
  name: string;
  academicYear: string;
  sections: Array<{
    id: string;
    name: string;
  }>;
}

interface AttendanceRegisterProps {
  classes: ClassOption[];
  userRole: AppRole;
}

/**
 * Returns today's date formatted as YYYY-MM-DD.
 */
function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns yesterday's date formatted as YYYY-MM-DD.
 */
function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AttendanceRegister({ classes, userRole }: AttendanceRegisterProps) {
  const todayStr = getTodayString();
  const yesterdayStr = getYesterdayString();

  // Selected filters
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id ?? ""
  );
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    selectedClass?.sections[0]?.id ?? ""
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Register session data
  const [registerData, setRegisterData] = useState<AttendanceRegisterData | null>(null);
  const [records, setRecords] = useState<RegisterStudentRow[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, startTransition] = useTransition();

  // Synchronize section selection when class changes
  useEffect(() => {
    if (selectedClass && selectedClass.sections.length > 0) {
      const currentSectionExists = selectedClass.sections.some(
        (s) => s.id === selectedSectionId
      );
      if (!currentSectionExists) {
        setSelectedSectionId(selectedClass.sections[0].id);
      }
    } else {
      setSelectedSectionId("");
    }
  }, [selectedClassId, selectedClass, selectedSectionId]);

  // Load register data
  const loadRegister = useCallback(async () => {
    if (!selectedClassId || !selectedSectionId || !selectedDate) {
      setRegisterData(null);
      setRecords([]);
      return;
    }

    setIsLoading(true);
    try {
      const res = await getAttendanceRegister({
        classId: selectedClassId,
        sectionId: selectedSectionId,
        date: selectedDate,
      });

      if (res.success && res.data) {
        setRegisterData(res.data);
        setRecords(res.data.records);
        setNotes(res.data.notes || "");
      } else {
        toast.error(res.error ?? "Failed to load register.");
        setRegisterData(null);
        setRecords([]);
      }
    } catch {
      toast.error("An unexpected error occurred while fetching register.");
      setRegisterData(null);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId, selectedSectionId, selectedDate]);

  useEffect(() => {
    loadRegister();
  }, [loadRegister]);

  // Bulk actions
  function handleMarkAll(status: AttendanceStatusType) {
    if (!registerData?.canEdit) return;
    setRecords((prev) => prev.map((r) => ({ ...r, status })));
    toast.info(`Marked all ${records.length} students as ${status}.`);
  }

  function handleStatusChange(studentId: string, status: AttendanceStatusType) {
    setRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r))
    );
  }

  function handleRemarksChange(studentId: string, remarks: string) {
    setRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, remarks } : r))
    );
  }

  // Submit register
  function handleSubmit() {
    if (!selectedClass || !selectedSectionId || records.length === 0) {
      toast.error("No student records to submit.");
      return;
    }

    startTransition(async () => {
      const res = await saveAttendanceRegister({
        classId: selectedClassId,
        sectionId: selectedSectionId,
        date: selectedDate,
        academicYear: selectedClass.academicYear,
        notes: notes.trim() || undefined,
        records: records.map((r) => ({
          studentId: r.studentId,
          status: r.status,
          remarks: r.remarks.trim() || undefined,
        })),
      });

      if (res.success) {
        toast.success(
          registerData?.isExisting
            ? "Attendance register updated successfully."
            : "Attendance register submitted successfully."
        );
        loadRegister();
      } else {
        toast.error(res.error ?? "Failed to save attendance.");
      }
    });
  }

  const isSunday = new Date(selectedDate).getUTCDay() === 0;

  return (
    <div className="space-y-6">
      {/* Control Bar: Class, Section, and Date Pickers */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          {/* Class Selector */}
          <div className="space-y-1.5">
            <label htmlFor="classSelect" className="text-xs font-semibold text-muted-foreground">
              Class / Standard
            </label>
            <select
              id="classSelect"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.academicYear})
                </option>
              ))}
            </select>
          </div>

          {/* Section Selector */}
          <div className="space-y-1.5">
            <label htmlFor="sectionSelect" className="text-xs font-semibold text-muted-foreground">
              Section / Division
            </label>
            <select
              id="sectionSelect"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={!selectedClass || selectedClass.sections.length === 0}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
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

          {/* Date Picker */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="datePicker" className="text-xs font-semibold text-muted-foreground">
                Attendance Date
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className={`text-[11px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                    selectedDate === todayStr
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(yesterdayStr)}
                  className={`text-[11px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                    selectedDate === yesterdayStr
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Yesterday
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                id="datePicker"
                type="date"
                max={todayStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Bulk Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!registerData?.canEdit || records.length === 0}
              onClick={() => handleMarkAll("PRESENT")}
              className="flex-1 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 h-9"
            >
              <Check className="size-3.5 mr-1" />
              All Present
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!registerData?.canEdit || records.length === 0}
              onClick={() => handleMarkAll("ABSENT")}
              className="flex-1 border-rose-600/30 text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 h-9"
            >
              <X className="size-3.5 mr-1" />
              All Absent
            </Button>
          </div>
        </div>
      </div>

      {/* Status Advisory Banners */}
      {isSunday && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>Notice: The selected date is a Sunday. Please ensure attendance is expected.</span>
        </div>
      )}

      {registerData && !registerData.canEdit && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
          <Lock className="size-4 shrink-0 text-amber-600" />
          <span>
            <strong>Read-Only Register:</strong> {userRole === "TEACHER" ? "Teachers are" : "Users are"} authorized to mark or modify attendance
            only for today and yesterday. Older dates are locked and require an Administrator.
          </span>
        </div>
      )}

      {registerData?.isExisting && (
        <div className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="size-4 shrink-0 text-blue-600" />
            <span>
              Attendance previously recorded by <strong>{registerData.markedByName || "Staff"}</strong>.
              {registerData.canEdit ? " You can review and update records below." : ""}
            </span>
          </div>
          {registerData.markedAt && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Saved {new Date(registerData.markedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}

      {/* Main Roll Call Register */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-lg border bg-card text-muted-foreground gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-sm">Loading attendance register…</span>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-lg border bg-card text-center p-6 space-y-2">
          <Users className="size-8 text-muted-foreground/60" />
          <h3 className="font-semibold text-base">No Enrolled Students Found</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            No active student enrollments were found for this class and section. Please ensure students
            are admitted and assigned to this section before marking attendance.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AttendanceTable
            records={records}
            canEdit={registerData?.canEdit ?? false}
            onStatusChange={handleStatusChange}
            onRemarksChange={handleRemarksChange}
          />

          {/* Register Footer: Session Notes & Submission */}
          <div className="rounded-lg border bg-card p-4 space-y-3 shadow-xs">
            <div className="space-y-1.5">
              <label htmlFor="sessionNotes" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3.5" />
                Session Notes / Remarks (Optional)
              </label>
              <input
                id="sessionNotes"
                value={notes}
                disabled={!registerData?.canEdit}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  registerData?.canEdit
                    ? "Add any class-level notes (e.g. Sports Day, Rainy day, Special assembly)…"
                    : "No session notes recorded."
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-muted-foreground">
                Total Enrolled Students: <strong>{records.length}</strong>
              </div>

              {registerData?.canEdit && (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSaving || records.length === 0}
                  className="w-full sm:w-auto px-6 font-semibold"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Saving Register…
                    </>
                  ) : registerData?.isExisting ? (
                    "Update Attendance Register"
                  ) : (
                    "Submit Attendance Register"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
