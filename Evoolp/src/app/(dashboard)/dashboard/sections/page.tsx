import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { SectionsTable } from "@/components/classes/sections-table";
import { CreateSectionStandaloneDialog } from "@/components/classes/create-section-standalone-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, GraduationCap, Users } from "lucide-react";

export default async function SectionsPage() {
  const ctx = await requireTenant();

  // Query all sections under the tenant's school
  const sections = await prisma.section.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      class: {
        select: { id: true, name: true, academicYear: true },
      },
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: [
      { class: { name: "asc" } },
      { name: "asc" },
    ],
  });

  // Query available classes for section creation dropdown
  const classes = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true, academicYear: true },
    orderBy: [{ academicYear: "desc" }, { name: "asc" }],
  });

  const totalSections = sections.length;
  const totalClasses = classes.length;
  const totalStudents = sections.reduce((sum, s) => sum + s._count.enrollments, 0);

  const isAdmin = ctx.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sections Directory</h1>
          <p className="text-sm text-muted-foreground">
            Manage classroom division rosters and sections across all academic classes.
          </p>
        </div>

        {isAdmin && (
          <CreateSectionStandaloneDialog classes={classes} />
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
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
              Active classroom divisions
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Parent Classes
            </CardTitle>
            <GraduationCap className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClasses}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Standards with sections
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
              Assigned across sections
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sections Table */}
      <SectionsTable
        sections={sections}
        userRole={ctx.role}
        classesList={classes.map((c) => ({ id: c.id, name: `${c.name} (${c.academicYear})` }))}
      />
    </div>
  );
}
