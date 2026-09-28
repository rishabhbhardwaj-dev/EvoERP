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
import { SubjectDetailSheet } from "./subject-detail-sheet";
import type { AppRole } from "@/types/next-auth";
import { Search, BookOpen, Hash, Calendar, ArrowUpDown, Eye } from "lucide-react";

export interface SubjectRecord {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface SubjectTableProps {
  initialSubjects: SubjectRecord[];
  userRole: AppRole;
}

type SortField = "name" | "code" | "createdAt";
type SortDirection = "asc" | "desc";

export function SubjectTable({ initialSubjects, userRole }: SubjectTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Selected subject for slide-over detail sheet
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Derive current subject record so revalidation updates reflect immediately
  const selectedSubject =
    initialSubjects.find((s) => s.id === selectedSubjectId) ?? null;

  // Filter subjects based on name or code search
  const filteredSubjects = initialSubjects.filter((subject) => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;

    const matchesName = subject.name.toLowerCase().includes(query);
    const matchesCode = subject.code.toLowerCase().includes(query);

    return matchesName || matchesCode;
  });

  // Sort filtered subjects
  const sortedSubjects = [...filteredSubjects].sort((a, b) => {
    let comparison = 0;
    if (sortField === "name") {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === "code") {
      comparison = a.code.localeCompare(b.code);
    } else if (sortField === "createdAt") {
      comparison =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Bar & Counter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by subject name or code…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-3">
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              Clear search
            </button>
          )}

          <div className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {sortedSubjects.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">
              {initialSubjects.length}
            </span>{" "}
            subjects
          </div>
        </div>
      </div>

      {/* Subjects Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[180px]">
                <button
                  type="button"
                  onClick={() => toggleSort("code")}
                  className="flex items-center gap-1.5 font-semibold text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Hash className="size-3.5" />
                  Subject Code
                  <ArrowUpDown className="size-3 text-muted-foreground" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("name")}
                  className="flex items-center gap-1.5 font-semibold text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <BookOpen className="size-3.5" />
                  Subject Name
                  <ArrowUpDown className="size-3 text-muted-foreground" />
                </button>
              </TableHead>
              <TableHead className="w-[200px]">
                <button
                  type="button"
                  onClick={() => toggleSort("createdAt")}
                  className="flex items-center gap-1.5 font-semibold text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Calendar className="size-3.5" />
                  Added To Catalog
                  <ArrowUpDown className="size-3 text-muted-foreground" />
                </button>
              </TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSubjects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <BookOpen className="size-8 text-muted-foreground/50" />
                    <p className="font-medium text-sm">
                      {searchTerm
                        ? "No subjects match your search."
                        : "No subjects registered in catalog yet."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {searchTerm
                        ? "Try refining your subject name or code keyword."
                        : userRole === "ADMIN"
                        ? "Click 'Add Subject' above to register curriculum subjects."
                        : "Contact an administrator to add curriculum subjects."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedSubjects.map((subject) => (
                <TableRow
                  key={subject.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedSubjectId(subject.id);
                    setIsDetailOpen(true);
                  }}
                >
                  <TableCell className="font-mono text-xs font-semibold">
                    <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary">
                      {subject.code}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {subject.name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(subject.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSubjectId(subject.id);
                        setIsDetailOpen(true);
                      }}
                    >
                      <Eye className="size-3.5" />
                      <span>View</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Slide-over 360-degree Subject Detail Sheet */}
      <SubjectDetailSheet
        subject={selectedSubject}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        userRole={userRole}
      />
    </div>
  );
}
