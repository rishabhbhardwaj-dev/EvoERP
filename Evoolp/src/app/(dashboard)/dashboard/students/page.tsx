import { requireTenant, getFiscalYear } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { StudentTable } from "@/components/students/student-table";
import { CreateStudentDialog } from "@/components/students/create-student-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, ShieldCheck, Award } from "lucide-react";

export default async function StudentsPage() {
  const ctx = await requireTenant();
  const fy = getFiscalYear();

  // Query all students belonging to the tenant's school with enrollment data
  const students = await prisma.student.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      enrollments: {
        include: {
          class: { select: { id: true, name: true, academicYear: true } },
          section: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  // Query classes with sections for dropdown filters and admission dialog
  const classes = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      sections: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: [{ academicYear: "desc" }, { name: "asc" }],
  });

  // Collect distinct academic years
  const yearsSet = new Set<string>();
  yearsSet.add(fy.label);
  for (const c of classes) {
    if (c.academicYear) yearsSet.add(c.academicYear);
  }
  for (const s of students) {
    for (const e of s.enrollments) {
      if (e.academicYear) yearsSet.add(e.academicYear);
    }
  }
  const academicYears = Array.from(yearsSet).sort().reverse();

  // Calculate metrics
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === "ACTIVE").length;
  const rteStudents = students.filter((s) => s.rteCandidate).length;
  const reservedStudents = students.filter((s) => s.category !== "GENERAL").length;

  const isAdmin = ctx.role === "ADMIN";

  const classesList = classes.map((c) => ({
    id: c.id,
    name: `${c.name} (${c.academicYear})`,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Directory</h1>
          <p className="text-sm text-muted-foreground">
            Manage student profiles, demographics, admissions, and academic enrollments.
          </p>
        </div>

        {isAdmin && (
          <CreateStudentDialog
            classes={classes}
            defaultAcademicYear={fy.label}
          />
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Students
            </CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered in school records
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Students
            </CardTitle>
            <UserCheck className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently enrolled & attending
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              RTE Candidates
            </CardTitle>
            <ShieldCheck className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rteStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              25% Right to Education quota
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reserved Category
            </CardTitle>
            <Award className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reservedStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              OBC / SC / ST affirmative action
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <StudentTable
        initialStudents={students}
        userRole={ctx.role}
        academicYears={academicYears}
        classesList={classesList}
      />
    </div>
  );
}
