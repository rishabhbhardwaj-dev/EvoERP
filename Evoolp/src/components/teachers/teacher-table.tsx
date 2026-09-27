"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TeacherDetailSheet } from "./teacher-detail-sheet";
import type { AppRole } from "@/types/next-auth";
import { Search, GraduationCap, Mail, UserCheck, Eye } from "lucide-react";

export interface TeacherRecord {
  id: string;
  employeeCode: string;
  department: string | null;
  qualification: string | null;
  createdAt: Date | string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: "ACTIVE" | "INACTIVE";
    createdAt: Date | string;
  };
}

interface TeacherTableProps {
  initialTeachers: TeacherRecord[];
  departments: string[];
  userRole: AppRole;
}

export function TeacherTable({
  initialTeachers,
  departments,
  userRole,
}: TeacherTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Selected teacher for slide-over detail sheet
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Derive current teacher record so revalidation updates reflect immediately
  const selectedTeacher =
    initialTeachers.find((t) => t.id === selectedTeacherId) ?? null;

  // Filter teachers based on search term, department, and status
  const filteredTeachers = initialTeachers.filter((teacher) => {
    // Search query matches name, email, or employeeCode
    const name = teacher.user.name.toLowerCase();
    const email = teacher.user.email.toLowerCase();
    const code = teacher.employeeCode.toLowerCase();
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      name.includes(query) || email.includes(query) || code.includes(query);

    // Department filter
    const matchesDepartment =
      selectedDepartment === "ALL" ||
      (selectedDepartment === "UNASSIGNED"
        ? !teacher.department || teacher.department.trim() === ""
        : teacher.department === selectedDepartment);

    // Status filter
    const matchesStatus =
      selectedStatus === "ALL" || teacher.user.status === selectedStatus;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or employee code…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredTeachers.length}</span> of{" "}
            <span className="font-semibold text-foreground">{initialTeachers.length}</span> teachers
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="deptFilter"
              className="text-xs font-medium text-muted-foreground whitespace-nowrap"
            >
              Department:
            </label>
            <select
              id="deptFilter"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-0.5 text-xs shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
              <option value="UNASSIGNED">Unassigned</option>
            </select>
          </div>

          {/* Account Status Filter */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="statusFilter"
              className="text-xs font-medium text-muted-foreground whitespace-nowrap"
            >
              Status:
            </label>
            <select
              id="statusFilter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-0.5 text-xs shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Active Filters Clear Button */}
          {(searchTerm !== "" || selectedDepartment !== "ALL" || selectedStatus !== "ALL") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedDepartment("ALL");
                setSelectedStatus("ALL");
              }}
              className="text-xs text-primary underline-offset-4 hover:underline ml-1"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Teachers Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[120px] font-semibold text-xs">Employee Code</TableHead>
              <TableHead className="font-semibold text-xs">Teacher Name</TableHead>
              <TableHead className="font-semibold text-xs">Email</TableHead>
              <TableHead className="font-semibold text-xs">Department</TableHead>
              <TableHead className="font-semibold text-xs">Qualification</TableHead>
              <TableHead className="w-[100px] font-semibold text-xs">Status</TableHead>
              <TableHead className="w-[80px] text-right font-semibold text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeachers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <UserCheck className="size-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-muted-foreground">
                      No teachers found matching your filters.
                    </p>
                    <p className="text-xs text-muted-foreground/75">
                      Try clearing filters or search terms to inspect staff records.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTeachers.map((t) => {
                const initials = t.user.name
                  .split(" ")
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <TableRow
                    key={t.id}
                    onClick={() => {
                      setSelectedTeacherId(t.id);
                      setIsDetailOpen(true);
                    }}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    {/* Employee Code */}
                    <TableCell className="font-mono text-xs font-semibold">
                      <span className="inline-flex rounded-md border bg-muted/50 px-2 py-0.5 text-xs text-foreground">
                        {t.employeeCode}
                      </span>
                    </TableCell>

                    {/* Teacher Name */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {initials || "T"}
                        </div>
                        <span className="text-sm font-semibold">{t.user.name}</span>
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      <div className="flex items-center gap-1.5">
                        <Mail className="size-3.5 shrink-0 text-muted-foreground/70" />
                        <span>{t.user.email}</span>
                      </div>
                    </TableCell>

                    {/* Department */}
                    <TableCell>
                      {t.department ? (
                        <span className="inline-flex rounded-md border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {t.department}
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>

                    {/* Qualification */}
                    <TableCell className="text-xs text-muted-foreground">
                      {t.qualification ? (
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="size-3.5 shrink-0 text-muted-foreground/70" />
                          <span>{t.qualification}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {t.user.status === "ACTIVE" ? (
                        <span className="inline-flex rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </TableCell>

                    {/* Action Trigger */}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTeacherId(t.id);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="size-3.5" />
                        <span>View</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Slide-over 360-degree Teacher Detail Sheet */}
      <TeacherDetailSheet
        teacher={selectedTeacher}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        userRole={userRole}
      />
    </div>
  );
}
