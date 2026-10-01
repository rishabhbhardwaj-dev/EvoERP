"use client";

import { useState, useEffect } from "react";
import { getExamAnalytics, type ExamAnalyticsData } from "@/lib/actions/exams";
import {
  TrendingUp,
  Award,
  Users,
  CheckCircle2,
  XCircle,
  BarChart3,
  Loader2,
} from "lucide-react";

interface ExamAnalyticsCardProps {
  examId: string;
}

const GRADE_ORDER: Array<keyof ExamAnalyticsData["gradeDistribution"]> = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "D",
  "E",
];

const GRADE_COLORS: Record<string, string> = {
  A1: "bg-emerald-600 text-white dark:bg-emerald-500",
  A2: "bg-emerald-500 text-white dark:bg-emerald-600",
  B1: "bg-blue-600 text-white dark:bg-blue-500",
  B2: "bg-blue-500 text-white dark:bg-blue-600",
  C1: "bg-amber-500 text-white dark:bg-amber-600",
  C2: "bg-amber-600 text-white dark:bg-amber-700",
  D: "bg-orange-500 text-white dark:bg-orange-600",
  E: "bg-destructive text-white",
};

export function ExamAnalyticsCard({ examId }: ExamAnalyticsCardProps) {
  const [analytics, setAnalytics] = useState<ExamAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getExamAnalytics(examId)
      .then((res) => {
        if (isMounted) {
          if (res.success && res.data) {
            setAnalytics(res.data);
          } else {
            setAnalytics(null);
          }
        }
      })
      .catch((err) => {
        console.error("Error loading exam analytics:", err);
        if (isMounted) setAnalytics(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [examId]);

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground shadow-xs">
        <Loader2 className="size-4 animate-spin" />
        <span>Loading assessment analytics…</span>
      </div>
    );
  }

  if (!analytics || analytics.totalAppeared === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-6 text-center shadow-xs">
        <BarChart3 className="size-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm font-semibold text-muted-foreground">
          Analytics Pending
        </p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          Enter marks for students to generate class-level performance metrics and CBSE grade distribution.
        </p>
      </div>
    );
  }

  // Calculate highest grade count for bar scaling
  const maxGradeCount = Math.max(
    ...GRADE_ORDER.map((g) => analytics.gradeDistribution[g] ?? 0),
    1
  );

  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs space-y-5">
      {/* Title */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight">
            Cohort Assessment Performance
          </h3>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {analytics.totalAppeared} of {analytics.totalEnrolled} Students Evaluated
        </span>
      </div>

      {/* KPI metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Class Average */}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Class Average
          </p>
          <p className="text-xl font-bold mt-1 text-foreground">
            {analytics.classAverageMarks}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              / {analytics.maxMarks}
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {analytics.classAveragePercentage}% overall
          </p>
        </div>

        {/* Pass Rate */}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Pass Percentage
          </p>
          <p
            className={`text-xl font-bold mt-1 ${
              analytics.passPercentage >= 75
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {analytics.passPercentage}%
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {analytics.passedCount} Passed &bull; {analytics.failedCount} Below Passing
          </p>
        </div>

        {/* Highest Marks */}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Highest Score
          </p>
          <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {analytics.highestMarks}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {Math.round((analytics.highestMarks / analytics.maxMarks) * 100)}% of max
          </p>
        </div>

        {/* Lowest Marks */}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Lowest Score
          </p>
          <p className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">
            {analytics.lowestMarks}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pass line: {analytics.passingMarks}
          </p>
        </div>
      </div>

      {/* CBSE 8-Tier Grade Distribution Histogram */}
      <div className="space-y-2.5 pt-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          CBSE Grade Tier Distribution
        </p>

        <div className="grid grid-cols-8 gap-2 pt-2">
          {GRADE_ORDER.map((grade) => {
            const count = analytics.gradeDistribution[grade] ?? 0;
            const heightPercent =
              maxGradeCount > 0
                ? Math.max(Math.round((count / maxGradeCount) * 100), 8)
                : 8;

            return (
              <div
                key={grade}
                className="flex flex-col items-center justify-end h-28 space-y-1.5"
              >
                {/* Count badge */}
                <span className="text-[11px] font-bold text-foreground">
                  {count}
                </span>

                {/* Vertical bar */}
                <div className="w-full bg-muted/40 rounded-t-md h-20 flex items-end p-0.5">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-sm transition-all duration-500 ${
                      count > 0
                        ? GRADE_COLORS[grade] ?? "bg-primary"
                        : "bg-muted-foreground/20"
                    }`}
                  />
                </div>

                {/* Grade label */}
                <span className="text-xs font-bold text-foreground">{grade}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
