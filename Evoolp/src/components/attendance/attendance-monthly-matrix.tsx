"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Printer,
  Search,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import {
  getMonthlyAttendanceMatrix,
  exportMonthlyAttendanceCsv,
  type MonthlyAttendanceMatrixData,
} from "@/lib/actions/attendance";
import { AttendanceDefaultersCard } from "./attendance-defaulters-card";
import { toast } from "sonner";
import { cn } from "cn";
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

interface AttendanceMonthlyMatrixProps {
  classes: ClassOption[];
  userRole: AppRole;
}

const ACADEMIC_MONTHS = [
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function AttendanceMonthlyMatrix({
  classes,
}: AttendanceMonthlyMatrixProps) {
  // Current date for default selection
  const currentMonthNum = new Date().getMonth() + 1;

  // Selected filters
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id ?? ""
  );
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    selectedClass?.sections[0]?.id ?? ""
  );

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data state
  const [matrixData, setMatrixData] =
    useState<MonthlyAttendanceMatrixData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, startExportTransition] = useTransition();

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

  // Determine calendar year from academic year and month
  // E.g., for "2025-2026", Apr-Dec is 2025, Jan-Mar is 2026
  const getCalendarYear = useCallback((): number => {
    if (!selectedClass) return new Date().getFullYear();
    const parts = selectedClass.academicYear.split("-");
    const startYear = parseInt(parts[0], 10);
    const endYear = parseInt(parts[1], 10);

    if (isNaN(startYear) || isNaN(endYear)) return new Date().getFullYear();

    return selectedMonth >= 4 ? startYear : endYear;
  }, [selectedClass, selectedMonth]);

  // Load monthly matrix data
  const loadMatrix = useCallback(async () => {
    if (!selectedClassId || !selectedSectionId) {
      setMatrixData(null);
      return;
    }

    setIsLoading(true);
    try {
      const year = getCalendarYear();
      const res = await getMonthlyAttendanceMatrix({
        classId: selectedClassId,
        sectionId: selectedSectionId,
        academicYear: selectedClass?.academicYear,
        year,
        month: selectedMonth,
      });

      if (res.success && res.data) {
        setMatrixData(res.data);
      } else {
        toast.error(res.error ?? "Failed to load monthly attendance matrix.");
        setMatrixData(null);
      }
    } catch (err) {
      console.error("Error loading monthly matrix:", err);
      toast.error("An unexpected error occurred while fetching monthly matrix.");
      setMatrixData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId, selectedSectionId, selectedClass, selectedMonth, getCalendarYear]);

  // Trigger fetch whenever selection changes
  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  // Handle CSV export
  const handleExportCsv = () => {
    if (!selectedClassId || !selectedSectionId) return;

    startExportTransition(async () => {
      try {
        const year = getCalendarYear();
        const res = await exportMonthlyAttendanceCsv({
          classId: selectedClassId,
          sectionId: selectedSectionId,
          academicYear: selectedClass?.academicYear,
          year,
          month: selectedMonth,
        });

        if (res.success && res.data) {
          const blob = new Blob([res.data.csvContent], {
            type: "text/csv;charset=utf-8;",
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", res.data.fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success("Attendance matrix exported successfully.");
        } else {
          toast.error(res.error ?? "Failed to export CSV.");
        }
      } catch (err) {
        console.error("Error exporting CSV:", err);
        toast.error("An unexpected error occurred during CSV export.");
      }
    });
  };

  // Handle Print Report
  const handlePrint = () => {
    window.print();
  };

  // Filter students by name or admission number
  const filteredStudents =
    matrixData?.students.filter((st) => {
      const q = searchQuery.toLowerCase();
      return (
        st.name.toLowerCase().includes(q) ||
        st.admissionNumber.toLowerCase().includes(q)
      );
    }) ?? [];

  return (
    <div className="space-y-6">
      {/* Print-Only Official Report Header */}
      <div className="hidden print:block border-b pb-4 mb-4 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wide">
          Institutional Monthly Attendance Register
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {selectedClass?.name} — Section{" "}
          {selectedClass?.sections.find((s) => s.id === selectedSectionId)?.name} |{" "}
          {matrixData?.monthName} {matrixData?.year} | Academic Year:{" "}
          {matrixData?.academicYear}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Total Working Days: {matrixData?.totalWorkingDays ?? 0} | Printed on:{" "}
          {new Date().toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Filter and Action Bar (Hidden on print) */}
      <div className="rounded-xl border bg-card p-4 shadow-xs print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Cascading Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Class Selector */}
            <div className="w-44">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Class
              </label>
              <Select
                value={selectedClassId}
                onValueChange={(val) => {
                  if (val) setSelectedClassId(val);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name} ({c.academicYear})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section Selector */}
            <div className="w-36">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Section
              </label>
              <Select
                value={selectedSectionId}
                onValueChange={(val) => {
                  if (val) setSelectedSectionId(val);
                }}
                disabled={!selectedClass || selectedClass.sections.length === 0}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {selectedClass?.sections.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      Section {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Academic Month Selector */}
            <div className="w-40">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Month ({getCalendarYear()})
              </label>
              <Select
                value={String(selectedMonth)}
                onValueChange={(val) => {
                  if (val) setSelectedMonth(Number(val));
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_MONTHS.map((m) => (
                    <SelectItem
                      key={m.value}
                      value={String(m.value)}
                      className="text-xs"
                    >
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isExporting || isLoading || !matrixData}
              className="gap-1.5 text-xs h-9"
            >
              {isExporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span>Export CSV</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={isLoading || !matrixData}
              className="gap-1.5 text-xs h-9"
            >
              <Printer className="size-3.5" />
              <span>Print Matrix</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Analytics Card */}
      {matrixData && (
        <AttendanceDefaultersCard
          analytics={matrixData.analytics}
          classAndSectionLabel={`${matrixData.className} — Section ${matrixData.sectionName}`}
          monthAndYearLabel={`${matrixData.monthName} ${matrixData.year}`}
        />
      )}

      {/* Attendance Matrix Table Section */}
      <div className="space-y-4">
        {/* Table Search & Legend Bar (Hidden on print) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search student or admission #…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          {/* Legend Badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-emerald-800 dark:text-emerald-300 font-semibold">
              P = Present
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 text-rose-800 dark:text-rose-300 font-semibold">
              A = Absent
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-amber-800 dark:text-amber-300 font-semibold">
              L = Late
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.5 text-blue-800 dark:text-blue-300 font-semibold">
              E = Excused
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 text-purple-800 dark:text-purple-300 font-semibold">
              H = Half Day
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              - = No Session
            </span>
          </div>
        </div>

        {/* Matrix Calendar Table */}
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden print:border-none print:shadow-none">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium">Loading monthly attendance matrix…</p>
            </div>
          ) : !matrixData ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <FileSpreadsheet className="size-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No Class Selected</p>
              <p className="text-xs mt-1">Please select a class and section to load the matrix.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                    <th className="sticky left-0 z-20 bg-muted/95 backdrop-blur-xs px-3 py-2.5 w-10 text-center border-r">
                      #
                    </th>
                    <th className="sticky left-10 z-20 bg-muted/95 backdrop-blur-xs px-3 py-2.5 min-w-36 border-r">
                      Student Name
                    </th>
                    <th className="px-2 py-2.5 w-24 border-r font-mono text-[11px]">
                      Adm No
                    </th>

                    {/* Day 1 to daysInMonth Columns */}
                    {Array.from({ length: matrixData.daysInMonth }, (_, i) => i + 1).map(
                      (day) => {
                        const dateObj = new Date(
                          Date.UTC(matrixData.year, matrixData.month - 1, day)
                        );
                        const dayOfWeek = DAY_NAMES[dateObj.getUTCDay()];
                        const isSunday = dateObj.getUTCDay() === 0;
                        const hasSession = matrixData.markedDates.includes(day);

                        return (
                          <th
                            key={day}
                            className={cn(
                              "px-1 py-1.5 text-center min-w-8 border-r text-[10px]",
                              isSunday
                                ? "bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                                : hasSession
                                ? "bg-muted/60"
                                : "text-muted-foreground"
                            )}
                            title={`Day ${day} (${dayOfWeek}) ${
                              hasSession ? "— Session Marked" : "— No Session"
                            }`}
                          >
                            <span className="block font-bold">{day}</span>
                            <span className="text-[9px] uppercase font-normal opacity-75">
                              {dayOfWeek}
                            </span>
                          </th>
                        );
                      }
                    )}

                    {/* Summary Columns */}
                    <th className="px-2 py-2.5 text-center min-w-16 border-r text-emerald-700 dark:text-emerald-400">
                      P
                    </th>
                    <th className="px-2 py-2.5 text-center min-w-16 border-r text-rose-700 dark:text-rose-400">
                      A
                    </th>
                    <th className="px-2 py-2.5 text-center min-w-16 border-r">
                      Other
                    </th>
                    <th className="px-2 py-2.5 text-center min-w-20 border-r">
                      Attended
                    </th>
                    <th className="px-3 py-2.5 text-center min-w-20 font-bold">
                      Rate
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={matrixData.daysInMonth + 8}
                        className="p-8 text-center text-muted-foreground text-xs"
                      >
                        No students found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const otherCount =
                        st.stats.late + st.stats.excused + st.stats.halfDay;

                      return (
                        <tr
                          key={st.studentId}
                          className="hover:bg-muted/30 transition-colors group"
                        >
                          {/* Serial index */}
                          <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 px-3 py-2 text-center font-mono text-[11px] text-muted-foreground border-r">
                            {idx + 1}
                          </td>

                          {/* Student Name */}
                          <td className="sticky left-10 z-10 bg-card group-hover:bg-muted/30 px-3 py-2 font-medium text-foreground border-r whitespace-nowrap">
                            <span>{st.name}</span>
                            {st.gender && (
                              <span className="ml-1 text-[10px] text-muted-foreground lowercase">
                                ({st.gender[0]})
                              </span>
                            )}
                          </td>

                          {/* Admission Number */}
                          <td className="px-2 py-2 font-mono text-[11px] text-muted-foreground border-r whitespace-nowrap">
                            {st.admissionNumber}
                          </td>

                          {/* Daily attendance cells (1..daysInMonth) */}
                          {Array.from(
                            { length: matrixData.daysInMonth },
                            (_, i) => i + 1
                          ).map((day) => {
                            const dayRecord = st.dailyStatus[day];
                            const status = dayRecord?.status;
                            const hasSessionOnDay =
                              matrixData.markedDates.includes(day);

                            const dateObj = new Date(
                              Date.UTC(matrixData.year, matrixData.month - 1, day)
                            );
                            const isSunday = dateObj.getUTCDay() === 0;

                            let content = "-";
                            let cellClass = "text-muted-foreground/40";

                            if (status === "PRESENT") {
                              content = "P";
                              cellClass =
                                "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold";
                            } else if (status === "ABSENT") {
                              content = "A";
                              cellClass =
                                "bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold";
                            } else if (status === "LATE") {
                              content = "L";
                              cellClass =
                                "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold";
                            } else if (status === "EXCUSED") {
                              content = "E";
                              cellClass =
                                "bg-blue-500/15 text-blue-700 dark:text-blue-400 font-bold";
                            } else if (status === "HALF_DAY") {
                              content = "H";
                              cellClass =
                                "bg-purple-500/15 text-purple-700 dark:text-purple-400 font-bold";
                            } else if (!hasSessionOnDay) {
                              content = "-";
                              cellClass = isSunday
                                ? "bg-rose-50/30 dark:bg-rose-950/10 text-rose-300 dark:text-rose-900"
                                : "text-muted-foreground/30";
                            }

                            return (
                              <td
                                key={day}
                                className={cn(
                                  "px-1 py-1.5 text-center border-r font-mono text-[11px] select-none",
                                  cellClass
                                )}
                                title={
                                  status
                                    ? `Day ${day}: ${status}${
                                        dayRecord?.remarks
                                          ? ` (${dayRecord.remarks})`
                                          : ""
                                      }`
                                    : hasSessionOnDay
                                    ? `Day ${day}: Not marked`
                                    : `Day ${day}: No session held`
                                }
                              >
                                {content}
                              </td>
                            );
                          })}

                          {/* Present Count */}
                          <td className="px-2 py-2 text-center font-semibold text-emerald-700 dark:text-emerald-400 border-r">
                            {st.stats.present}
                          </td>

                          {/* Absent Count */}
                          <td className="px-2 py-2 text-center font-semibold text-rose-700 dark:text-rose-400 border-r">
                            {st.stats.absent}
                          </td>

                          {/* Other Count */}
                          <td className="px-2 py-2 text-center text-muted-foreground border-r font-mono">
                            {otherCount}
                          </td>

                          {/* Attended / Total */}
                          <td className="px-2 py-2 text-center text-muted-foreground border-r font-medium">
                            <span className="font-semibold text-foreground">
                              {st.stats.attendedDays}
                            </span>
                            <span className="text-[10px] opacity-70">
                              /{st.stats.workingDays}
                            </span>
                          </td>

                          {/* Attendance Rate & Defaulter Tag */}
                          <td className="px-3 py-2 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold",
                                matrixData.totalWorkingDays === 0
                                  ? "text-muted-foreground"
                                  : st.stats.isDefaulter
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              )}
                            >
                              {matrixData.totalWorkingDays === 0
                                ? "—"
                                : `${st.stats.percentage}%`}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
