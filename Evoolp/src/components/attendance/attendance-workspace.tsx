"use client";

import { useState } from "react";
import { AttendanceMetrics } from "./attendance-metrics";
import { AttendanceRegister } from "./attendance-register";
import { AttendanceMonthlyMatrix } from "./attendance-monthly-matrix";
import type { ClassOption } from "./attendance-register";
import type { TodayAttendanceSummary } from "@/lib/actions/attendance";
import type { AppRole } from "@/types/next-auth";
import { CalendarDays, CalendarRange } from "lucide-react";
import { cn } from "cn";

interface AttendanceWorkspaceProps {
  classes: ClassOption[];
  userRole: AppRole;
  summary: TodayAttendanceSummary;
  initialTab?: "daily" | "monthly";
}

export function AttendanceWorkspace({
  classes,
  userRole,
  summary,
  initialTab = "daily",
}: AttendanceWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"daily" | "monthly">(initialTab);

  return (
    <div className="space-y-6">
      {/* Workspace View Switcher (Hidden when printing monthly report) */}
      <div className="flex border-b border-border print:hidden">
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all select-none",
              activeTab === "daily"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            <CalendarDays className="size-4" />
            <span>Daily Register</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("monthly")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all select-none",
              activeTab === "monthly"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            <CalendarRange className="size-4" />
            <span>Monthly Matrix &amp; Analytics</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Daily Register Workspace */}
      {activeTab === "daily" && (
        <div className="space-y-6">
          <AttendanceMetrics summary={summary} />
          <AttendanceRegister classes={classes} userRole={userRole} />
        </div>
      )}

      {/* Tab 2: Monthly Matrix & Defaulters Analytics */}
      {activeTab === "monthly" && (
        <div className="space-y-6">
          <AttendanceMonthlyMatrix classes={classes} userRole={userRole} />
        </div>
      )}
    </div>
  );
}
