import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { SubjectTable } from "@/components/subjects/subject-table";
import { CreateSubjectDialog } from "@/components/subjects/create-subject-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Hash, BookmarkCheck, Sparkles } from "lucide-react";

export default async function SubjectsPage() {
  const ctx = await requireTenant();

  // Query all subjects belonging to the tenant's school
  const subjects = await prisma.subject.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: [{ code: "asc" }],
  });

  // Calculate summary metrics
  const totalSubjects = subjects.length;

  // Subjects added in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSubjects = subjects.filter(
    (s) => new Date(s.createdAt) >= thirtyDaysAgo
  ).length;

  // Count CBSE standard numeric codes (3 digits)
  const cbseStandardCodes = subjects.filter((s) =>
    /^\d{3}$/.test(s.code)
  ).length;

  const isAdmin = ctx.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subject Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Manage institutional curriculum subjects, CBSE course codes, and catalog offerings.
          </p>
        </div>

        {isAdmin && <CreateSubjectDialog />}
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Subjects
            </CardTitle>
            <BookOpen className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubjects}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered in school catalog
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique Subject Codes
            </CardTitle>
            <Hash className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubjects}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Catalog identifiers active
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              CBSE Standard Codes
            </CardTitle>
            <BookmarkCheck className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cbseStandardCodes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              3-digit board curriculum codes
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Additions
            </CardTitle>
            <Sparkles className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentSubjects}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Added in the past 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subjects Directory Table */}
      <SubjectTable initialSubjects={subjects} userRole={ctx.role} />
    </div>
  );
}
