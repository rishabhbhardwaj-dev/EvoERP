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
import { deleteSection } from "@/lib/actions/sections";
import type { AppRole } from "@/types/next-auth";
import { Search, Trash2, Users, Layers, AlertCircle, Loader2 } from "lucide-react";

export interface SectionRow {
  id: string;
  name: string;
  class: {
    id: string;
    name: string;
    academicYear: string;
  };
  _count: {
    enrollments: number;
  };
}

interface SectionsTableProps {
  sections: SectionRow[];
  userRole: AppRole;
  classesList: Array<{ id: string; name: string }>;
}

export function SectionsTable({ sections, userRole, classesList }: SectionsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAdmin = userRole === "ADMIN";

  const filteredSections = sections.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.class.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassId === "ALL" || s.class.id === selectedClassId;
    return matchesSearch && matchesClass;
  });

  function handleDeleteSection(sectionId: string, sectionName: string, className: string) {
    if (!confirm(`Are you sure you want to delete Section "${sectionName}" of ${className}? This action cannot be undone.`)) {
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
            placeholder="Search by section or class name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="classFilter" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Filter by Class:
          </label>
          <select
            id="classFilter"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Classes</option>
            {classesList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sections Table */}
      <div className="rounded-lg border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[180px]">Section Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead className="w-[140px]">Academic Year</TableHead>
              <TableHead className="w-[140px] text-right">Students</TableHead>
              {isAdmin && <TableHead className="w-[140px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="h-36 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Layers className="size-8 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">No sections found</p>
                    <p className="text-xs">
                      {searchTerm || selectedClassId !== "ALL"
                        ? "Try adjusting your search or class filter."
                        : "Create a class and sections to get started."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredSections.map((sec) => (
                <TableRow key={sec.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary font-bold text-xs">
                        {sec.name}
                      </span>
                      <span>Section {sec.name}</span>
                    </div>
                  </TableCell>

                  <TableCell className="font-medium text-sm">
                    {sec.class.name}
                  </TableCell>

                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {sec.class.academicYear}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1.5 font-medium text-xs">
                      <Users className="size-3.5 text-muted-foreground" />
                      {sec._count.enrollments}
                    </div>
                  </TableCell>

                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSection(sec.id, sec.name, sec.class.name)}
                        disabled={isPending || sec._count.enrollments > 0}
                        title={
                          sec._count.enrollments > 0
                            ? "Cannot delete section with active students"
                            : "Delete Section"
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
