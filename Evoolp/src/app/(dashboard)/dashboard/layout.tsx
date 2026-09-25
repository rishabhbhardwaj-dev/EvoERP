import { redirect } from "next/navigation";
import { requireTenant, ROLE_LABELS } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await requireTenant().catch(() => null);
  if (!ctx) redirect("/login");

  const school = await prisma.school.findUnique({
    where: { id: ctx.schoolId },
    select: { name: true },
  });

  return (
    <div className="flex h-screen">
      <Sidebar role={ctx.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName={ctx.name}
          userEmail={ctx.email}
          roleLabel={ROLE_LABELS[ctx.role]}
          schoolName={school?.name ?? "EvoERP"}
        />
        <Breadcrumbs />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
