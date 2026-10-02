"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  FileSpreadsheet,
  MessageSquare,
  Calculator,
  Loader2,
  X,
} from "lucide-react";
import type { ClassReportCardRosterItem } from "@/lib/actions/report-cards";

interface StudentRosterListProps {
  roster: ClassReportCardRosterItem[];
  cycleName: string;
  onSelectStudent: (studentId: string) => void;
  selectedStudentId?: string | null;
  selectedStudentIds: string[];
  onToggleSelectStudent: (studentId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchPrint: () => void;
  onExportCsv: () => void;
  onManageRemarks: () => void;
  onOpenMultiTerm?: () => void;
  isStaff: boolean;
  isExportingCsv?: boolean;
}

export function StudentRosterList({
  roster,
  cycleName,
  onSelectStudent,
  selectedStudentId,
  selectedStudentIds,
  onToggleSelectStudent,
  onSelectAll,
  onDeselectAll,
  onBatchPrint,
  onExportCsv,
  onManageRemarks,
  onOpenMultiTerm,
  isStaff,
  isExportingCsv = false,
}: StudentRosterListProps) {
  const [search, setSearch] = useState("");

  const filtered = roster.filter((item) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      item.studentName.toLowerCase().includes(term) ||
      item.admissionNumber.toLowerCase().includes(term)
    );
  });

  const readyCount = roster.filter((r) => r.status === "READY").length;
  const partialCount = roster.filter((r) => r.status === "PARTIAL").length;
  const noMarksCount = roster.filter((r) => r.status === "NO_MARKS").length;

  const isAllFilteredSelected =
    filtered.length > 0 && filtered.every((item) => selectedStudentIds.includes(item.studentId));
  const isSomeFilteredSelected =
    filtered.some((item) => selectedStudentIds.includes(item.studentId)) && !isAllFilteredSelected;

  return (
    <div className="space-y-4">
      {/* Roster Metric Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 border rounded-xl bg-card shadow-xs">
          <p className="text-xs text-muted-foreground font-semibold">
            Enrolled Cohort ({cycleName})
          </p>
          <p className="text-lg font-bold mt-0.5">{roster.length}</p>
        </div>
        <div className="p-3 border rounded-xl bg-card shadow-xs">
          <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle2 className="size-3.5" />
            Ready to Print
          </p>
          <p className="text-lg font-bold mt-0.5 text-emerald-700">{readyCount}</p>
        </div>
        <div className="p-3 border rounded-xl bg-card shadow-xs">
          <p className="text-xs text-amber-700 font-semibold flex items-center gap-1">
            <Clock className="size-3.5" />
            Partial Marks
          </p>
          <p className="text-lg font-bold mt-0.5 text-amber-700">{partialCount}</p>
        </div>
        <div className="p-3 border rounded-xl bg-card shadow-xs">
          <p className="text-xs text-gray-600 font-semibold flex items-center gap-1">
            <AlertCircle className="size-3.5" />
            No Marks Yet
          </p>
          <p className="text-lg font-bold mt-0.5 text-gray-700">{noMarksCount}</p>
        </div>
      </div>

      {/* Top Controls Bar: Search & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or admission no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
          {isStaff && onOpenMultiTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenMultiTerm}
              className="h-9 gap-1.5 text-xs shadow-xs"
              id="multi-term-button"
            >
              <Calculator className="size-3.5 text-primary" />
              Annual Multi-Term
            </Button>
          )}

          {isStaff && (
            <Button
              variant="outline"
              size="sm"
              onClick={onManageRemarks}
              className="h-9 gap-1.5 text-xs shadow-xs"
              id="manage-remarks-button"
            >
              <MessageSquare className="size-3.5 text-primary" />
              Manage Remarks
            </Button>
          )}

          {isStaff && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              disabled={isExportingCsv || roster.length === 0}
              className="h-9 gap-1.5 text-xs shadow-xs"
              id="export-csv-button"
            >
              {isExportingCsv ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-3.5 text-emerald-600" />
              )}
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Batch Selection Action Floating Bar */}
      {selectedStudentIds.length > 0 && (
        <div className="flex items-center justify-between gap-4 p-3 bg-primary/10 border border-primary/20 rounded-xl shadow-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {selectedStudentIds.length}
            </span>
            <span className="text-xs font-semibold text-foreground">
              Candidate{selectedStudentIds.length !== 1 ? "s" : ""} selected for batch operations
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeselectAll}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
              Clear Selection
            </Button>

            {isStaff && (
              <Button
                variant="outline"
                size="sm"
                onClick={onManageRemarks}
                className="h-8 gap-1.5 text-xs shadow-xs bg-background"
              >
                <MessageSquare className="size-3.5" />
                Remarks ({selectedStudentIds.length})
              </Button>
            )}

            <Button
              size="sm"
              onClick={onBatchPrint}
              disabled={selectedStudentIds.length === 0}
              className="h-8 gap-1.5 text-xs shadow-xs"
              id="batch-print-button"
            >
              <Printer className="size-3.5" />
              Batch Print ({selectedStudentIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Roster Table */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeFilteredSelected;
                    }}
                    onChange={() => {
                      if (isAllFilteredSelected) {
                        onDeselectAll();
                      } else {
                        onSelectAll();
                      }
                    }}
                    className="size-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    title={isAllFilteredSelected ? "Deselect All" : "Select All"}
                    id="select-all-roster-checkbox"
                  />
                </th>
                <th className="px-3 py-3 w-12 text-center">Sr.</th>
                <th className="px-4 py-3">Admission No</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3 text-center">Readiness</th>
                <th className="px-4 py-3 text-center">Marks Entered</th>
                <th className="px-4 py-3 text-center">Score Preview</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const isSelected = selectedStudentIds.includes(item.studentId);
                  return (
                    <tr
                      key={item.studentId}
                      className={`hover:bg-muted/40 transition-colors ${
                        isSelected ? "bg-primary/5" : selectedStudentId === item.studentId ? "bg-muted/60" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelectStudent(item.studentId)}
                          className="size-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          id={`select-student-${item.studentId}`}
                        />
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {item.admissionNumber}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {item.studentName}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.status === "READY" ? (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            READY
                          </span>
                        ) : item.status === "PARTIAL" ? (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            PARTIAL
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border border-border text-muted-foreground">
                            NO MARKS
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{item.enteredCount}</span> of {item.totalCount} subjects
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {item.overallPercentage !== null ? (
                          <span className="font-medium">
                            {item.overallPercentage}%{" "}
                            <span className="font-bold text-foreground">({item.overallGrade})</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={selectedStudentId === item.studentId ? "default" : "outline"}
                          className="h-8 gap-1.5 text-xs shadow-xs"
                          onClick={() => onSelectStudent(item.studentId)}
                          id={`view-report-card-${item.studentId}`}
                        >
                          <Eye className="size-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
