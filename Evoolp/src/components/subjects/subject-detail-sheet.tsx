"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EditSubjectDialog } from "./edit-subject-dialog";
import { DeleteSubjectDialog } from "./delete-subject-dialog";
import type { AppRole } from "@/types/next-auth";
import type { SubjectRecord } from "./subject-table";
import {
  BookOpen,
  Pencil,
  Trash2,
  Calendar,
  ShieldCheck,
  Hash,
  Clock,
  Layers,
} from "lucide-react";

interface SubjectDetailSheetProps {
  subject: SubjectRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: AppRole;
  onSubjectUpdated?: () => void;
}

export function SubjectDetailSheet({
  subject,
  open,
  onOpenChange,
  userRole,
  onSubjectUpdated,
}: SubjectDetailSheetProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (!subject) return null;

  const isAdmin = userRole === "ADMIN";

  function formatDate(d: Date | string | null | undefined): string {
    if (!d) return "Not recorded";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "Not recorded";
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateTime(d: Date | string | null | undefined): string {
    if (!d) return "Not recorded";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "Not recorded";
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Derive CBSE / standard code detection if 3 digits
  const isCbseCode = /^\d{3}$/.test(subject.code);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                  <BookOpen className="size-6" />
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold">
                    {subject.name}
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-2 mt-0.5 text-xs">
                    <span className="font-mono font-medium text-foreground">
                      Code: {subject.code}
                    </span>
                    <span>•</span>
                    <span>Curriculum Subject</span>
                  </SheetDescription>
                </div>
              </div>

              <div>
                <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {isCbseCode ? "CBSE Standard" : "Institutional"}
                </span>
              </div>
            </div>
          </SheetHeader>

          {/* Admin Quick Actions (Admin only) */}
          {isAdmin && (
            <div className="pt-4 pb-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                Subject Actions
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Pencil className="size-3.5" />
                  <span>Edit Details</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete Subject</span>
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-6 pt-4">
            {/* Subject Profile Card */}
            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2">
                <Layers className="size-4 text-primary" />
                <span>Curriculum Information</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Subject Name</span>
                  <p className="font-medium text-foreground mt-0.5">{subject.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Subject Code</span>
                  <p className="font-mono font-bold text-foreground mt-0.5 flex items-center gap-1">
                    <Hash className="size-3.5 text-muted-foreground" />
                    {subject.code}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Classification</span>
                  <p className="font-medium text-foreground mt-0.5">
                    {isCbseCode
                      ? "Standard CBSE Curriculum Code"
                      : "Institution-Specific Subject Code"}
                  </p>
                </div>
              </div>
            </div>

            {/* System Record & Audit Trail */}
            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2">
                <ShieldCheck className="size-4 text-primary" />
                <span>System Identifiers & Audit</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <span className="text-muted-foreground">Record Identifier (UUID)</span>
                  <p className="font-mono text-muted-foreground mt-0.5 select-all">
                    {subject.id}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Added to Catalog</span>
                  <p className="font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span>{formatDate(subject.createdAt)}</span>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Modified</span>
                  <p className="font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" />
                    <span>{formatDateTime(subject.updatedAt)}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Admin Action Dialogs */}
      {isAdmin && (
        <>
          <EditSubjectDialog
            subject={subject}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSuccess={() => {
              setIsEditDialogOpen(false);
              onSubjectUpdated?.();
            }}
          />

          <DeleteSubjectDialog
            subject={subject}
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            onSuccess={() => {
              setIsDeleteDialogOpen(false);
              onOpenChange(false);
              onSubjectUpdated?.();
            }}
          />
        </>
      )}
    </>
  );
}
