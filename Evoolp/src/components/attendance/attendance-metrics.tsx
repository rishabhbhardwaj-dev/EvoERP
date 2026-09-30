import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, UserX, BarChart3 } from "lucide-react";
import type { TodayAttendanceSummary } from "@/lib/actions/attendance";

interface AttendanceMetricsProps {
  summary: TodayAttendanceSummary;
}

export function AttendanceMetrics({ summary }: AttendanceMetricsProps) {
  const {
    totalSections,
    markedSections,
    unmarkedSections,
    totalStudentsMarked,
    totalPresent,
    totalAbsent,
    overallAttendancePercentage,
  } = summary;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Today's Overall Attendance % */}
      <Card className="shadow-xs border-emerald-500/20 bg-gradient-to-br from-card to-emerald-500/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Today&apos;s Attendance
          </CardTitle>
          <BarChart3 className="size-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {overallAttendancePercentage}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {totalPresent} of {totalStudentsMarked} marked students present
          </p>
        </CardContent>
      </Card>

      {/* Marked Sections */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Registers Marked
          </CardTitle>
          <CheckCircle2 className="size-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {markedSections} / {totalSections}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Class sections submitted today
          </p>
        </CardContent>
      </Card>

      {/* Pending / Unmarked Sections */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pending Registers
          </CardTitle>
          <Clock className="size-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {unmarkedSections}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sections awaiting roll call
          </p>
        </CardContent>
      </Card>

      {/* Total Absentees */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Absentees Today
          </CardTitle>
          <UserX className="size-4 text-rose-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {totalAbsent}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Students recorded absent
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
