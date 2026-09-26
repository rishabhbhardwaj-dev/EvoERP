import { requireTenant, getFiscalYear } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ClassTable } from "@/components/classes/class-table";
import { CreateClassDialog } from "@/components/classes/create-class-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Layers, Users, Calendar } from "lucide-react";

export default async function ClassesPage() {
  const ctx = await requireTenant();
  const fy = getFiscalYear();

  // Query all classes belonging to the tenant's school
  const classes = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      sections: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          enrollments: true,
          sections: true,
        },
      },
    },
    orderBy: [{ academicYear: "desc" }, { name: "asc" }],
  });

  // Collect distinct academic years present in database, ensuring current FY is present
  const yearsSet = new Set<string>();
  yearsSet.add(fy.label);
  for (const c of classes) {
    if (c.academicYear) {
      yearsSet.add(c.academicYear);
    }
  }
  const academicYears = Array.from(yearsSet).sort().reverse();

  // Calculate high-level summary metrics
  const totalClasses = classes.length;
  const totalSections = classes.reduce((sum, c) => sum + c._count.sections, 0);
  const totalStudents = classes.reduce((sum, c) => sum + c._count.enrollments, 0);

  const isAdmin = ctx.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes & Sections</h1>
          <p className="text-sm text-muted-foreground">
            Configure academic classes, grades, and section divisions for your school.
          </p>
        </div>

        {isAdmin && (
          <CreateClassDialog defaultAcademicYear={fy.label} />
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Classes
            </CardTitle>
            <GraduationCap className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClasses}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active standards / grades
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sections
            </CardTitle>
            <Layers className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSections}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Classroom division rosters
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enrolled Students
            </CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Students assigned to classes
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Academic Year
            </CardTitle>
            <Calendar className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fy.label}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Indian Fiscal Year (Apr–Mar)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Class Listing */}
      <ClassTable
        initialClasses={classes}
        userRole={ctx.role}
        academicYears={academicYears}
      />
    </div>
  );
}
