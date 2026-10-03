"use client";

import { useState, useTransition } from "react";
import {
  getMyAttendance,
  type MyAttendanceData,
} from "@/lib/actions/attendance";
import type { AttendanceStatusType } from "@/lib/validations/attendance";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  Filter,
  Loader2,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<
  AttendanceStatusType,
  { label: string; badge: string }
> = {
  PRESENT: {
    label: "Present",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  ABSENT: {
    label: "Absent",
    badge: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  LATE: {
    label: "Late Arrival",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  HALF_DAY: {
    label: "Half Day",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  },
  EXCUSED: {
    label: "Excused Leave",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
};

const MONTHS = [
  { value: "0", label: "All Months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

interface StudentAttendanceViewProps {
  initialData: MyAttendanceData;
  userRole: "STUDENT" | "PARENT";
}

export function StudentAttendanceView({
  initialData,
  userRole,
}: StudentAttendanceViewProps) {
  const [data, setData] = useState<MyAttendanceData>(initialData);
  const [selectedStudentId, setSelectedStudentId] = useState(
    initialData.studentId
  );
  const [selectedMonth, setSelectedMonth] = useState<string>("0");
  const [isPending, startTransition] = useTransition();

  const isParent = userRole === "PARENT";

  function handleFilterChange(childId: string, monthVal: string) {
    setSelectedStudentId(childId);
    setSelectedMonth(monthVal);

    startTransition(async () => {
      const monthNum = parseInt(monthVal, 10);
      const res = await getMyAttendance({
        studentId: isParent ? childId : undefined,
        month: monthNum > 0 ? monthNum : undefined,
      });

      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error ?? "Failed to update attendance view.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Child Selector (For Parent Role) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {data.studentName}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Adm #{data.admissionNumber}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Class {data.className} — Section {data.sectionName} | Academic Year {data.academicYear}
            </p>
          </div>
        </div>

        {/* Controls: Parent Ward Selector & Month Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {isParent && data.childrenProfiles && data.childrenProfiles.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="child-select" className="text-xs font-medium text-muted-foreground">
                Ward:
              </label>
              <select
                id="child-select"
                value={selectedStudentId}
                onChange={(e) => handleFilterChange(e.target.value, selectedMonth)}
                disabled={isPending}
                aria-label="Select ward"
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                {data.childrenProfiles.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name} ({child.className}-{child.sectionName})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              aria-label="Filter by month"
              value={selectedMonth}
              onChange={(e) => handleFilterChange(selectedStudentId, e.target.value)}
              disabled={isPending}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {isPending && <Loader2 className="size-4 animate-spin text-primary" />}
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Attendance Percentage & CBSE Compliance */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Attendance Rate</span>
            {data.isDefaulter ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                <ShieldAlert className="size-3" /> Shortage (&lt;75%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="size-3" /> CBSE Compliant
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">{data.percentage}%</span>
            <span className="text-xs text-muted-foreground">
              ({data.attendedDays} / {data.totalSessions} days)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Mandatory CBSE examination threshold is 75%.
          </p>
        </div>

        {/* Card 2: Present Count */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Present Days</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {data.presentCount}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Full-day present sessions recorded.
          </p>
        </div>

        {/* Card 3: Absent Count */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Absent Sessions</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
              <XCircle className="size-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-red-600 dark:text-red-400">
            {data.absentCount}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Unexcused absences in register.
          </p>
        </div>

        {/* Card 4: Exceptions Breakdown */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Exceptions</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-medium">
            <span className="text-amber-700 dark:text-amber-400">Late: {data.lateCount}</span>
            <span className="text-orange-700 dark:text-orange-400">Half Day: {data.halfDayCount}</span>
            <span className="text-blue-700 dark:text-blue-400">Excused: {data.excusedCount}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Half-day counts as 0.5 day attended.
          </p>
        </div>
      </div>

      {/* Attendance History Register Table */}
      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Attendance History Log</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {data.sessions.length} sessions listed
          </span>
        </div>

        {data.sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <AlertTriangle className="size-10 text-muted-foreground/50 mb-3" />
            <p className="font-semibold text-foreground text-sm">No attendance records found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              No roll call entries exist for the selected filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Day</th>
                  <th className="px-6 py-3">Class &amp; Section</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.sessions.map((s) => {
                  const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.PRESENT;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-foreground font-mono">
                        {s.date}
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground">
                        {s.dayOfWeek}
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground">
                        {s.className} - {s.sectionName}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${cfg.badge}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground italic">
                        {s.remarks ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
