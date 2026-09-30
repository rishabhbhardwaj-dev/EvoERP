"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Users,
  Percent,
  Clock,
  UserX,
} from "lucide-react";
import { cn } from "cn";
import type { MonthlyAttendanceDefaulter } from "@/lib/actions/attendance";

export interface AttendanceAnalyticsData {
  totalStudents: number;
  totalWorkingDays: number;
  averagePercentage: number;
  statusCounts: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    halfDay: number;
  };
  defaulters: MonthlyAttendanceDefaulter[];
}

export interface AttendanceDefaultersCardProps {
  analytics: AttendanceAnalyticsData;
  classAndSectionLabel?: string;
  monthAndYearLabel?: string;
  className?: string;
}

export function AttendanceDefaultersCard({
  analytics,
  classAndSectionLabel,
  monthAndYearLabel,
  className,
}: AttendanceDefaultersCardProps) {
  const {
    totalStudents,
    totalWorkingDays,
    averagePercentage,
    statusCounts,
    defaulters,
  } = analytics;

  const hasSessions = totalWorkingDays > 0;
  const hasDefaulters = defaulters.length > 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Average Attendance % */}
        <div className="rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Class Attendance</span>
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-lg",
                averagePercentage >= 75
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              <Percent className="size-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-bold tracking-tight",
                averagePercentage >= 75
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}
            >
              {averagePercentage}%
            </span>
            <span className="text-[11px] text-muted-foreground">
              {averagePercentage >= 75 ? "Target met" : "Below 75% target"}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                averagePercentage >= 85
                  ? "bg-emerald-500"
                  : averagePercentage >= 75
                  ? "bg-amber-500"
                  : "bg-rose-500"
              )}
              style={{ width: `${Math.min(100, Math.max(0, averagePercentage))}%` }}
            />
          </div>
        </div>

        {/* Working Days */}
        <div className="rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Working Days</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="size-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {totalWorkingDays}
            </span>
            <span className="text-[11px] text-muted-foreground">sessions</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {monthAndYearLabel ? `In ${monthAndYearLabel}` : "Marked registers"}
          </p>
        </div>

        {/* Total Enrolled Students */}
        <div className="rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Students</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users className="size-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {totalStudents}
            </span>
            <span className="text-[11px] text-muted-foreground">roster</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {classAndSectionLabel ?? "Enrolled in section"}
          </p>
        </div>

        {/* Defaulters (<75%) */}
        <div className="rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Defaulters (&lt;75%)</span>
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-lg",
                hasDefaulters
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {hasDefaulters ? (
                <AlertTriangle className="size-3.5" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-bold tracking-tight",
                hasDefaulters
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {defaulters.length}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {hasDefaulters ? "require notice" : "all compliant"}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            CBSE 75% minimum quota
          </p>
        </div>
      </div>

      {/* Monthly Category / Status Breakdown Bar */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly Attendance Distribution
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cumulative status distribution across all {totalStudents} students for {totalWorkingDays} working days.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Present:</span>
            <strong className="font-semibold">{statusCounts.present}</strong>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 text-xs text-rose-700 dark:text-rose-400">
            <span className="size-2 rounded-full bg-rose-500" />
            <span>Absent:</span>
            <strong className="font-semibold">{statusCounts.absent}</strong>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">
            <span className="size-2 rounded-full bg-amber-500" />
            <span>Late:</span>
            <strong className="font-semibold">{statusCounts.late}</strong>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-400">
            <span className="size-2 rounded-full bg-blue-500" />
            <span>Excused:</span>
            <strong className="font-semibold">{statusCounts.excused}</strong>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-50 dark:bg-purple-950/30 px-3 py-1.5 text-xs text-purple-700 dark:text-purple-400">
            <span className="size-2 rounded-full bg-purple-500" />
            <span>Half Day:</span>
            <strong className="font-semibold">{statusCounts.halfDay}</strong>
          </div>
        </div>
      </div>

      {/* CBSE 75% Attendance Defaulters List */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <div className="border-b bg-muted/30 px-5 py-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                hasDefaulters
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {hasDefaulters ? (
                <UserX className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                CBSE Attendance Defaulters (&lt;75% Threshold)
              </h3>
              <p className="text-xs text-muted-foreground">
                Standard CBSE guidelines mandate a minimum 75% attendance for institutional exam eligibility.
              </p>
            </div>
          </div>

          {hasDefaulters && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300 self-start sm:self-auto">
              <AlertTriangle className="size-3" />
              {defaulters.length} {defaulters.length === 1 ? "Student" : "Students"} Defaulter
            </span>
          )}
        </div>

        {/* Content based on state */}
        {!hasSessions ? (
          <div className="p-8 text-center">
            <Clock className="mx-auto size-9 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-foreground">
              No Attendance Sessions Recorded
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              No attendance registers have been marked for this month yet. Once teachers mark attendance, defaulters will be calculated automatically.
            </p>
          </div>
        ) : !hasDefaulters ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto size-9 text-emerald-500/80 mb-2" />
            <p className="text-sm font-medium text-foreground">
              All Students Fully Compliant
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
              Zero students are below the 75% threshold in {classAndSectionLabel ?? "this section"}. Every enrolled student satisfies the mandatory CBSE attendance quota for {monthAndYearLabel ?? "this month"}.
            </p>
          </div>
        ) : (
          <div className="divide-y text-xs">
            <div className="grid grid-cols-12 gap-2 bg-muted/20 px-5 py-2.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              <span className="col-span-1 text-center">#</span>
              <span className="col-span-3">Admission No</span>
              <span className="col-span-4">Student Name</span>
              <span className="col-span-2 text-right">Attended / Total</span>
              <span className="col-span-2 text-right">Attendance %</span>
            </div>

            {defaulters.map((d, index) => (
              <div
                key={d.studentId}
                className="grid grid-cols-12 gap-2 px-5 py-3 items-center hover:bg-muted/30 transition-colors"
              >
                <span className="col-span-1 text-center font-mono text-muted-foreground">
                  {index + 1}
                </span>
                <span className="col-span-3 font-mono font-medium text-foreground">
                  {d.admissionNumber}
                </span>
                <div className="col-span-4 font-medium text-foreground">
                  <span>{d.name}</span>
                  {d.gender && (
                    <span className="ml-1 text-[11px] text-muted-foreground lowercase">
                      ({d.gender})
                    </span>
                  )}
                </div>
                <div className="col-span-2 text-right text-muted-foreground font-medium">
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    {d.attendedDays}
                  </span>{" "}
                  / {d.workingDays} d
                </div>
                <div className="col-span-2 text-right">
                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 font-bold text-rose-700 dark:text-rose-400">
                    {d.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
