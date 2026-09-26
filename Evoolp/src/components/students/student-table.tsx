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
import type { AppRole } from "@/types/next-auth";
import { Search, Users, GraduationCap } from "lucide-react";

export interface StudentWithEnrollments {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  category: "GENERAL" | "SC" | "ST" | "OBC";
  rteCandidate: boolean;
  status: "ACTIVE" | "ALUMNI" | "TRANSFERRED";
  address: string | null;
  enrollments: Array<{
    id: string;
    academicYear: string;
    status: "ACTIVE" | "COMPLETED" | "WITHDRAWN";
    class: {
      id: string;
      name: string;
      academicYear: string;
    };
    section: {
      id: string;
      name: string;
    };
  }>;
}

interface StudentTableProps {
  initialStudents: StudentWithEnrollments[];
  userRole: AppRole;
  academicYears: string[];
  classesList: Array<{ id: string; name: string }>;
}

export function StudentTable({
  initialStudents,
  academicYears,
  classesList,
}: StudentTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedRte, setSelectedRte] = useState<string>("ALL");

  // Filter students based on all criteria
  const filteredStudents = initialStudents.filter((student) => {
    // Search query
    const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
    const admNo = student.admissionNumber.toLowerCase();
    const query = searchTerm.toLowerCase();
    const matchesSearch = fullName.includes(query) || admNo.includes(query);

    // Academic Year filter
    const matchesYear =
      selectedYear === "ALL" ||
      student.enrollments.some((e) => e.academicYear === selectedYear);

    // Class filter
    const matchesClass =
      selectedClassId === "ALL" ||
      student.enrollments.some((e) => e.class.id === selectedClassId);

    // Status filter
    const matchesStatus =
      selectedStatus === "ALL" || student.status === selectedStatus;

    // Category filter
    const matchesCategory =
      selectedCategory === "ALL" || student.category === selectedCategory;

    // RTE filter
    const matchesRte =
      selectedRte === "ALL" ||
      (selectedRte === "RTE" ? student.rteCandidate : !student.rteCandidate);

    return (
      matchesSearch &&
      matchesYear &&
      matchesClass &&
      matchesStatus &&
      matchesCategory &&
      matchesRte
    );
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
              placeholder="Search by name or admission no…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredStudents.length}</span> of{" "}
            <span className="font-semibold text-foreground">{initialStudents.length}</span> students
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {/* Academic Year */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="yearFilter" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Year:
            </label>
            <select
              id="yearFilter"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-0.5 text-xs shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">All Years</option>
              {academicYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="classFilter" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Class:
            </label>
            <select
              id="classFilter"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-0.5 text-xs shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">All Classes</option>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="categoryFilter" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Category:
            </label>
            <select
              id="categoryFilter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-0.5 text-xs shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">All Categories</option>
              <option value="GENERAL">General</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
            </select>
          </div>

          {/* RTE Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="rteFilter" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              RTE:
            </label>
            <select
              id="rteFilter"
              value={selectedRte}
              onChange={(e) => setSelectedRte(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-0.5 text-xs shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">All Seats</option>
              <option value="RTE">RTE (25% Quota)</option>
              <option value="NON_RTE">General Seats</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="statusFilter" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
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
              <option value="TRANSFERRED">Transferred</option>
              <option value="ALUMNI">Alumni</option>
            </select>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="rounded-lg border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[140px]">Admission No.</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead className="w-[180px]">Class & Section</TableHead>
              <TableHead className="w-[120px]">Academic Year</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="w-[100px]">RTE</TableHead>
              <TableHead className="w-[100px] text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Users className="size-8 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">No students found</p>
                    <p className="text-xs">
                      {searchTerm ||
                      selectedYear !== "ALL" ||
                      selectedClassId !== "ALL" ||
                      selectedCategory !== "ALL" ||
                      selectedStatus !== "ALL" ||
                      selectedRte !== "ALL"
                        ? "Try clearing search or filters to see more students."
                        : "Admit your school's first student to get started."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((st) => {
                const activeEnrollment =
                  st.enrollments.find((e) => e.status === "ACTIVE") ?? st.enrollments[0];

                return (
                  <TableRow key={st.id}>
                    {/* Admission Number */}
                    <TableCell className="font-mono text-xs font-semibold">
                      <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-foreground">
                        {st.admissionNumber}
                      </span>
                    </TableCell>

                    {/* Student Name */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {st.firstName[0]}
                          {st.lastName[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">
                            {st.firstName} {st.lastName}
                          </span>
                          {st.gender && (
                            <span className="text-[11px] text-muted-foreground capitalize">
                              {st.gender.toLowerCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Class & Section */}
                    <TableCell>
                      {activeEnrollment ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <GraduationCap className="size-3.5 text-primary shrink-0" />
                          <span>{activeEnrollment.class.name}</span>
                          <span className="rounded-md border bg-muted/60 px-1.5 py-0.2 text-[11px]">
                            Sec {activeEnrollment.section.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>

                    {/* Academic Year */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {activeEnrollment?.academicYear ?? "—"}
                    </TableCell>

                    {/* Category */}
                    <TableCell>
                      <span className="inline-flex rounded-md border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {st.category}
                      </span>
                    </TableCell>

                    {/* RTE Status */}
                    <TableCell>
                      {st.rteCandidate ? (
                        <span className="inline-flex rounded-md bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:text-green-400">
                          RTE 25%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-right">
                      {st.status === "ACTIVE" && (
                        <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Active
                        </span>
                      )}
                      {st.status === "TRANSFERRED" && (
                        <span className="inline-flex rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          Transferred
                        </span>
                      )}
                      {st.status === "ALUMNI" && (
                        <span className="inline-flex rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400">
                          Alumni
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
