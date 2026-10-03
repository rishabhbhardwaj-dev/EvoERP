"use client";

import { useState, useTransition } from "react";
import {
  getReportsWorkspaceData,
  exportReportCsvAction,
  type ReportsWorkspaceData,
} from "@/lib/actions/reports";
import type { ReportType } from "@/lib/validations/report";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  BarChart3,
  Users,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Download,
  Filter,
  FileSpreadsheet,
  BookOpen,
} from "lucide-react";

interface ReportsWorkspaceProps {
  initialData: ReportsWorkspaceData;
}

export function ReportsWorkspace({ initialData }: ReportsWorkspaceProps) {
  const [data, setData] = useState<ReportsWorkspaceData>(initialData);
  const [reportType, setReportType] = useState<ReportType>(initialData.reportType);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  const filteredSections = selectedClassId
    ? data.sectionsList.filter((s) => s.classId === selectedClassId)
    : data.sectionsList;

  const handleFilterChange = (newReportType: ReportType, classId: string, sectionId: string) => {
    setReportType(newReportType);
    startTransition(async () => {
      const res = await getReportsWorkspaceData({
        reportType: newReportType,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
      });

      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "Failed to load report data.");
      }
    });
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await exportReportCsvAction({
        reportType,
        classId: selectedClassId || undefined,
        sectionId: selectedSectionId || undefined,
      });

      if (res.success && res.data) {
        const blob = new Blob([res.data.csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", res.data.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${res.data.filename} successfully!`);
      } else {
        toast.error(res.error || "Failed to export CSV.");
      }
    } catch {
      toast.error("An error occurred during CSV export.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Reports & Institutional Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive enrollment metrics, attendance compliance registers, and academic performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground border">
            Role: {data.role}
          </span>
          {data.role === "ADMIN" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
          )}
        </div>
      </div>

      {/* Report Type Tabs & Filter Bar */}
      <Card className="border bg-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center space-x-1 rounded-lg bg-muted p-1 border">
              <button
                type="button"
                onClick={() => {
                  setReportType("enrollment");
                  handleFilterChange("enrollment", selectedClassId, selectedSectionId);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  reportType === "enrollment"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Enrollment
              </button>

              <button
                type="button"
                onClick={() => {
                  setReportType("attendance");
                  handleFilterChange("attendance", selectedClassId, selectedSectionId);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  reportType === "attendance"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Attendance
              </button>

              <button
                type="button"
                onClick={() => {
                  setReportType("academic");
                  handleFilterChange("academic", selectedClassId, selectedSectionId);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  reportType === "academic"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Academic
              </button>
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Filter:</span>
              </div>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedClassId(val);
                  setSelectedSectionId("");
                  handleFilterChange(reportType, val, "");
                }}
                className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Classes</option>
                {data.classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.academicYear})
                  </option>
                ))}
              </select>

              <select
                value={selectedSectionId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSectionId(val);
                  handleFilterChange(reportType, selectedClassId, val);
                }}
                className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Sections</option>
                {filteredSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state indicator */}
      {isPending && (
        <div className="text-center py-4 text-xs text-muted-foreground animate-pulse">
          Refreshing report data...
        </div>
      )}

      {/* Tab Content 1: Enrollment */}
      {reportType === "enrollment" && data.enrollment && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Enrolled
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.enrollment.totalStudents}</div>
                <p className="text-xs text-muted-foreground mt-1">School student population</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Active Students
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {data.enrollment.activeStudents}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Currently attending</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Inactive / Left
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {data.enrollment.inactiveStudents}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Withdrawn or archived</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Gender Ratio
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-semibold mt-1">
                  M: {data.enrollment.genderDistribution.male} | F:{" "}
                  {data.enrollment.genderDistribution.female}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Other/Unspecified:{" "}
                  {data.enrollment.genderDistribution.other +
                    data.enrollment.genderDistribution.unspecified}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Class Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                Class-Wise Enrollment Breakdown
              </CardTitle>
              <CardDescription className="text-xs">
                Student count and active status aggregated by class.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.enrollment.classDistribution.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No enrollment records found.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Class Name</TableHead>
                        <TableHead className="text-xs">Academic Year</TableHead>
                        <TableHead className="text-xs text-right">Total Students</TableHead>
                        <TableHead className="text-xs text-right">Active Students</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.enrollment.classDistribution.map((c) => (
                        <TableRow key={c.classId}>
                          <TableCell className="text-xs font-medium">{c.className}</TableCell>
                          <TableCell className="text-xs">{c.academicYear}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">
                            {c.totalStudents}
                          </TableCell>
                          <TableCell className="text-xs text-right text-emerald-600 font-semibold">
                            {c.activeStudents}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab Content 2: Attendance Analytics */}
      {reportType === "attendance" && data.attendance && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Sessions
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.attendance.totalSessions}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Recorded daily registers ({data.attendance.totalRecords} entries)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Overall Attendance
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {data.attendance.overallPercentage}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Weighted average attendance</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Present Count
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {data.attendance.presentCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Absent: {data.attendance.absentCount} | Late: {data.attendance.lateCount}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  CBSE Shortage Defaulters
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {data.attendance.cbseShortageRiskList.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Students below 75% cutoff</p>
              </CardContent>
            </Card>
          </div>

          {/* Class Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Class & Section Attendance Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                Attendance metrics and CBSE shortage risk counts by section.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.attendance.classComparison.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No attendance session records found for the selected filter.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Class</TableHead>
                        <TableHead className="text-xs">Section</TableHead>
                        <TableHead className="text-xs text-right">Sessions</TableHead>
                        <TableHead className="text-xs text-right">Present</TableHead>
                        <TableHead className="text-xs text-right">Absent</TableHead>
                        <TableHead className="text-xs text-right">Late/Half</TableHead>
                        <TableHead className="text-xs text-right">Attendance %</TableHead>
                        <TableHead className="text-xs text-right">Defaulters (&lt;75%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.attendance.classComparison.map((comp) => (
                        <TableRow key={`${comp.classId}_${comp.sectionId}`}>
                          <TableCell className="text-xs font-medium">{comp.className}</TableCell>
                          <TableCell className="text-xs font-medium">{comp.sectionName}</TableCell>
                          <TableCell className="text-xs text-right">{comp.totalSessions}</TableCell>
                          <TableCell className="text-xs text-right text-emerald-600 font-medium">
                            {comp.presentCount}
                          </TableCell>
                          <TableCell className="text-xs text-right text-destructive font-medium">
                            {comp.absentCount}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            {comp.lateCount + comp.halfDayCount}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold">
                            {comp.attendancePercentage}%
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {comp.defaultersCount > 0 ? (
                              <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                                {comp.defaultersCount}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CBSE Shortage Risk List */}
          {data.attendance.cbseShortageRiskList.length > 0 && (
            <Card className="border-destructive/30">
              <CardHeader className="bg-destructive/5 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  CBSE Attendance Shortage Risk Register (&lt; 75%)
                </CardTitle>
                <CardDescription className="text-xs text-destructive/80">
                  Students failing to meet the mandatory 75% attendance threshold.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Student Name</TableHead>
                        <TableHead className="text-xs">Adm. No.</TableHead>
                        <TableHead className="text-xs">Class & Section</TableHead>
                        <TableHead className="text-xs text-right">Recorded Days</TableHead>
                        <TableHead className="text-xs text-right">Attended Days</TableHead>
                        <TableHead className="text-xs text-right">Attendance %</TableHead>
                        <TableHead className="text-xs text-center">CBSE Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.attendance.cbseShortageRiskList.map((st) => (
                        <TableRow key={st.studentId}>
                          <TableCell className="text-xs font-medium">{st.studentName}</TableCell>
                          <TableCell className="text-xs font-mono">{st.admissionNumber}</TableCell>
                          <TableCell className="text-xs">
                            {st.className} - {st.sectionName}
                          </TableCell>
                          <TableCell className="text-xs text-right">{st.totalRecordedDays}</TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            {st.effectiveAttendedDays}
                          </TableCell>
                          <TableCell className="text-xs text-right font-bold text-destructive">
                            {st.attendancePercentage}%
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                              Shortage Risk
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab Content 3: Academic Performance */}
      {reportType === "academic" && data.academic && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Exams Conducted
                </CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.academic.totalExams}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Processed {data.academic.totalResults} student marks entries
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Overall Pass Rate
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {data.academic.passPercentage}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Passed: {data.academic.passedCount} | Failed: {data.academic.failedCount}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Average Score
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.academic.overallAverageMarks}%</div>
                <p className="text-xs text-muted-foreground mt-1">Overall subject mean score</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Top Grades (A1 & A2)
                </CardTitle>
                <GraduationCap className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {data.academic.gradeDistribution.A1 + data.academic.gradeDistribution.A2}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Distinction grade entries</p>
              </CardContent>
            </Card>
          </div>

          {/* Grade Distribution Bar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                CBSE 8-Point Grade Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {Object.entries(data.academic.gradeDistribution).map(([grade, count]) => (
                  <div
                    key={grade}
                    className="flex flex-col items-center justify-center p-2.5 rounded-lg border bg-muted/40"
                  >
                    <span className="text-xs font-bold text-muted-foreground">{grade}</span>
                    <span className="text-base font-extrabold mt-0.5">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Subject Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Subject-Wise Performance Register
              </CardTitle>
              <CardDescription className="text-xs">
                Exam counts, pass rates, and mark ranges grouped by academic subject.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.academic.subjectPerformance.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No exam results found for the selected filter.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Subject Name</TableHead>
                        <TableHead className="text-xs">Code</TableHead>
                        <TableHead className="text-xs text-right">Exams</TableHead>
                        <TableHead className="text-xs text-right">Results</TableHead>
                        <TableHead className="text-xs text-right">Pass %</TableHead>
                        <TableHead className="text-xs text-right">Avg Score %</TableHead>
                        <TableHead className="text-xs text-right">Highest %</TableHead>
                        <TableHead className="text-xs text-right">Lowest %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.academic.subjectPerformance.map((sp) => (
                        <TableRow key={sp.subjectId}>
                          <TableCell className="text-xs font-medium">{sp.subjectName}</TableCell>
                          <TableCell className="text-xs font-mono">{sp.subjectCode}</TableCell>
                          <TableCell className="text-xs text-right">{sp.examCount}</TableCell>
                          <TableCell className="text-xs text-right">{sp.totalResults}</TableCell>
                          <TableCell className="text-xs text-right text-emerald-600 font-semibold">
                            {sp.passPercentage}%
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold">
                            {sp.averageMarks}%
                          </TableCell>
                          <TableCell className="text-xs text-right text-emerald-600 font-medium">
                            {sp.highestMarks}%
                          </TableCell>
                          <TableCell className="text-xs text-right text-amber-600 font-medium">
                            {sp.lowestMarks}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
