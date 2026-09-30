"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, User } from "lucide-react";
import type { RegisterStudentRow } from "@/lib/actions/attendance";
import type { AttendanceStatusType } from "@/lib/validations/attendance";
import { cn } from "cn";

interface AttendanceTableProps {
  records: RegisterStudentRow[];
  canEdit: boolean;
  onStatusChange: (studentId: string, status: AttendanceStatusType) => void;
  onRemarksChange: (studentId: string, remarks: string) => void;
}

const STATUS_CONFIG: Record<
  AttendanceStatusType,
  { label: string; short: string; activeClass: string; inactiveClass: string }
> = {
  PRESENT: {
    label: "Present",
    short: "P",
    activeClass:
      "bg-emerald-600 text-white shadow-xs border-emerald-600 hover:bg-emerald-700",
    inactiveClass:
      "border-border text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40",
  },
  ABSENT: {
    label: "Absent",
    short: "A",
    activeClass:
      "bg-rose-600 text-white shadow-xs border-rose-600 hover:bg-rose-700",
    inactiveClass:
      "border-border text-muted-foreground hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40",
  },
  LATE: {
    label: "Late",
    short: "L",
    activeClass:
      "bg-amber-500 text-white shadow-xs border-amber-500 hover:bg-amber-600",
    inactiveClass:
      "border-border text-muted-foreground hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40",
  },
  EXCUSED: {
    label: "Excused",
    short: "E",
    activeClass:
      "bg-blue-600 text-white shadow-xs border-blue-600 hover:bg-blue-700",
    inactiveClass:
      "border-border text-muted-foreground hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40",
  },
  HALF_DAY: {
    label: "Half Day",
    short: "H",
    activeClass:
      "bg-purple-600 text-white shadow-xs border-purple-600 hover:bg-purple-700",
    inactiveClass:
      "border-border text-muted-foreground hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-950/40",
  },
};

export function AttendanceTable({
  records,
  canEdit,
  onStatusChange,
  onRemarksChange,
}: AttendanceTableProps) {
  const [search, setSearch] = useState("");

  const filtered = records.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.admissionNumber.toLowerCase().includes(search.toLowerCase())
  );

  // Compute live breakdown counts
  const presentCount = records.filter((r) => r.status === "PRESENT").length;
  const absentCount = records.filter((r) => r.status === "ABSENT").length;
  const lateCount = records.filter((r) => r.status === "LATE").length;
  const excusedCount = records.filter((r) => r.status === "EXCUSED").length;
  const halfDayCount = records.filter((r) => r.status === "HALF_DAY").length;
  const total = records.length;
  const attendanceRate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Live Counter Pill & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search student or admission #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Breakdown Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-2.5 py-1 text-emerald-800 dark:text-emerald-300">
            Present: <strong className="font-semibold">{presentCount}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/50 px-2.5 py-1 text-rose-800 dark:text-rose-300">
            Absent: <strong className="font-semibold">{absentCount}</strong>
          </span>
          {lateCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 px-2.5 py-1 text-amber-800 dark:text-amber-300">
              Late: <strong className="font-semibold">{lateCount}</strong>
            </span>
          )}
          {excusedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/50 px-2.5 py-1 text-blue-800 dark:text-blue-300">
              Excused: <strong className="font-semibold">{excusedCount}</strong>
            </span>
          )}
          {halfDayCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-950/50 px-2.5 py-1 text-purple-800 dark:text-purple-300">
              Half Day: <strong className="font-semibold">{halfDayCount}</strong>
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            Rate: <strong className="font-semibold text-foreground">{attendanceRate}%</strong>
          </span>
        </div>
      </div>

      {/* Roll Call Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">#</TableHead>
              <TableHead className="w-36">Admission No</TableHead>
              <TableHead className="min-w-44">Student Name</TableHead>
              <TableHead className="w-64">Attendance Status</TableHead>
              <TableHead className="min-w-48">Remarks / Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No students found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((record, index) => {
                return (
                  <TableRow key={record.studentId} className="hover:bg-muted/40 transition-colors">
                    {/* Serial index */}
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {index + 1}
                    </TableCell>

                    {/* Admission number */}
                    <TableCell className="font-mono text-xs font-medium">
                      {record.admissionNumber}
                    </TableCell>

                    {/* Student Name */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <User className="size-3.5" />
                        </div>
                        <div>
                          <span className="font-medium text-sm text-foreground block">
                            {record.name}
                          </span>
                          {record.gender && (
                            <span className="text-[11px] text-muted-foreground">
                              {record.gender}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Status Toggle Button Group */}
                    <TableCell>
                      <div className="inline-flex items-center rounded-md border border-input p-0.5 bg-muted/20">
                        {(Object.keys(STATUS_CONFIG) as AttendanceStatusType[]).map((statusKey) => {
                          const config = STATUS_CONFIG[statusKey];
                          const isActive = record.status === statusKey;

                          return (
                            <button
                              key={statusKey}
                              type="button"
                              disabled={!canEdit}
                              onClick={() => onStatusChange(record.studentId, statusKey)}
                              className={cn(
                                "flex items-center justify-center px-2 py-1 text-xs font-semibold rounded transition-all select-none disabled:opacity-50 disabled:cursor-not-allowed",
                                isActive
                                  ? config.activeClass
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                              title={config.label}
                            >
                              <span className="sm:hidden">{config.short}</span>
                              <span className="hidden sm:inline">{config.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>

                    {/* Remarks Input */}
                    <TableCell>
                      <Input
                        value={record.remarks}
                        disabled={!canEdit}
                        placeholder={canEdit ? "Optional note…" : "—"}
                        onChange={(e) => onRemarksChange(record.studentId, e.target.value)}
                        className="h-8 text-xs max-w-xs"
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
