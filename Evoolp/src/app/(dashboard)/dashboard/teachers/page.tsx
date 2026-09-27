import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { TeacherTable } from "@/components/teachers/teacher-table";
import { CreateTeacherDialog } from "@/components/teachers/create-teacher-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, Layers } from "lucide-react";

export default async function TeachersPage() {
  const ctx = await requireTenant();

  // Query all teachers belonging to the tenant's school with linked user details
  const teachers = await prisma.teacher.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ employeeCode: "asc" }],
  });

  // Collect distinct departments
  const departmentsSet = new Set<string>();
  for (const t of teachers) {
    if (t.department && t.department.trim().length > 0) {
      departmentsSet.add(t.department.trim());
    }
  }
  const departments = Array.from(departmentsSet).sort();

  // Calculate summary metrics
  const totalTeachers = teachers.length;
  const activeStaff = teachers.filter((t) => t.user.status === "ACTIVE").length;
  const inactiveStaff = teachers.filter((t) => t.user.status === "INACTIVE").length;
  const departmentsCount = departments.length;

  const isAdmin = ctx.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teacher Directory</h1>
          <p className="text-sm text-muted-foreground">
            Manage teaching staff profiles, employee codes, departments, and credentials.
          </p>
        </div>

        {isAdmin && <CreateTeacherDialog />}
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Teachers
            </CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTeachers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered in school records
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Staff
            </CardTitle>
            <UserCheck className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStaff}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently active & assigned
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inactive Staff
            </CardTitle>
            <UserX className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveStaff}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Deactivated or on leave
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Departments
            </CardTitle>
            <Layers className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departmentsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Staffed subject areas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Teachers Table */}
      <TeacherTable
        initialTeachers={teachers}
        departments={departments}
        userRole={ctx.role}
      />
    </div>
  );
}
