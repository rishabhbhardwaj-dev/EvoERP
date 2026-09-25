import type { AppRole } from "@/types/next-auth";

export interface NavItem {
  label: string;
  href: string;
  roles: AppRole[];
}

/**
 * Role-based sidebar navigation.
 * ADMIN — everything. TEACHER — attendance/exams/classes.
 * STUDENT — own data. PARENT — child data.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
  { label: "Students", href: "/dashboard/students", roles: ["ADMIN", "TEACHER"] },
  { label: "Teachers", href: "/dashboard/teachers", roles: ["ADMIN"] },
  { label: "Classes", href: "/dashboard/classes", roles: ["ADMIN", "TEACHER"] },
  { label: "Sections", href: "/dashboard/sections", roles: ["ADMIN", "TEACHER"] },
  { label: "Subjects", href: "/dashboard/subjects", roles: ["ADMIN", "TEACHER"] },
  { label: "Attendance", href: "/dashboard/attendance", roles: ["ADMIN", "TEACHER"] },
  { label: "Exams", href: "/dashboard/exams", roles: ["ADMIN", "TEACHER"] },
  { label: "My Attendance", href: "/dashboard/my-attendance", roles: ["STUDENT", "PARENT"] },
  { label: "My Grades", href: "/dashboard/my-grades", roles: ["STUDENT", "PARENT"] },
  { label: "My Fees", href: "/dashboard/my-fees", roles: ["STUDENT", "PARENT"] },
  { label: "Notices", href: "/dashboard/notices", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
  { label: "Users", href: "/dashboard/users", roles: ["ADMIN"] },
  { label: "Reports", href: "/dashboard/reports", roles: ["ADMIN"] },
  { label: "Audit Log", href: "/dashboard/audit", roles: ["ADMIN"] },
  { label: "Settings", href: "/dashboard/settings", roles: ["ADMIN"] },
];

export function navForRole(role: AppRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
