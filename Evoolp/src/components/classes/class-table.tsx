"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateSectionDialog } from "./create-section-dialog";
import { deleteClass } from "@/lib/actions/classes";
import { deleteSection } from "@/lib/actions/sections";
import type { AppRole } from "@/types/next-auth";
import { Search, Trash2, Users, Layers, AlertCircle, Loader2 } from "lucide-react";

export interface ClassWithDetails {
  id: string;
  name: string;
  academicYear: string;
  sections: Array<{
    id: string;
    name: string;
  }>;
  _count: {
    enrollments: number;
    sections: number;
  };
}

interface ClassTableProps {
  initialClasses: ClassWithDetails[];
  userRole: AppRole;
  academicYears: string[];
}

export function ClassTable({ initialClasses, userRole, academicYears }: ClassTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAdmin = userRole === "ADMIN";

  // Filter classes based on search term and selected academic year
  const filteredClasses = initialClasses.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesYear = selectedYear === "ALL" || c.academicYear === selectedYear;
    return matchesSearch && matchesYear;
  });

  function handleDeleteClass(classId: string, className: string) {
    if (!confirm(`Are you sure you want to delete "${className}"? This action cannot be undone.`)) {
      return;
    }

    setActionError(null);
    startTransition(async () => {
      const res = await deleteClass(classId);
      if (!res.success) {
        setActionError(res.error ?? "Failed to delete class.");
      }
    });
  }

  function handleDeleteSection(sectionId: string, sectionName: string, className: string) {
    if (!confirm(`Are you sure you want to delete Section "${sectionName}" from ${className}?`)) {
      return;
    }

    setActionError(null);
    startTransition(async () => {
      const res = await deleteSection(sectionId);
      if (!res.success) {
        setActionError(res.error ?? "Failed to delete section.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search classes by name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="yearFilter" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Academic Year:
          </label>
          <select
            id="yearFilter"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Academic Years</option>
            {academicYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Class Table */}
      <div className="rounded-lg border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[200px]">Class Name</TableHead>
              <TableHead className="w-[140px]">Academic Year</TableHead>
              <TableHead>Sections</TableHead>
              <TableHead className="w-[130px] text-right">Students</TableHead>
              {isAdmin && <TableHead className="w-[180px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClasses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Layers className="size-8 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">No classes found</p>
                    <p className="text-xs">
                      {searchTerm || selectedYear !== "ALL"
                        ? "Try clearing your search or filter to see more classes."
                        : "Get started by adding your school's first class."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredClasses.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary" />
                      {item.name}
                    </div>
                  </TableCell>

                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {item.academicYear}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.sections.length === 0 ? (
                        <span className="text-xs italic text-muted-foreground">No sections</span>
                      ) : (
                        item.sections.map((section) => (
                          <span
                            key={section.id}
                            className="group inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs font-medium"
                          >
                            <span>Section {section.name}</span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSection(section.id, section.name, item.name)}
                                title={`Delete Section ${section.name}`}
                                className="opacity-40 hover:opacity-100 hover:text-destructive transition-opacity"
                                disabled={isPending}
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))
                      )}

                      {isAdmin && (
                        <CreateSectionDialog classId={item.id} className={item.name} />
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1.5 font-medium text-xs">
                      <Users className="size-3.5 text-muted-foreground" />
                      {item._count.enrollments}
                    </div>
                  </TableCell>

                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClass(item.id, item.name)}
                        disabled={isPending || item._count.enrollments > 0}
                        title={
                          item._count.enrollments > 0
                            ? "Cannot delete class with active students"
                            : "Delete Class"
                        }
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2"
                      >
                        {isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="size-3.5 mr-1" />
                            Delete
                          </>
                        )}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
