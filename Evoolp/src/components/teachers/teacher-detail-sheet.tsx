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
import { EditTeacherDialog } from "./edit-teacher-dialog";
import { ChangeTeacherStatusDialog } from "./change-teacher-status-dialog";
import { DeleteTeacherDialog } from "./delete-teacher-dialog";
import type { AppRole } from "@/types/next-auth";
import {
  GraduationCap,
  Mail,
  Pencil,
  RefreshCw,
  Trash2,
  Calendar,
  Building2,
  ShieldCheck,
  Briefcase,
} from "lucide-react";

export interface TeacherDetailRecord {
  id: string;
  employeeCode: string;
  department: string | null;
  qualification: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: "ACTIVE" | "INACTIVE";
    createdAt: Date | string;
  };
}

interface TeacherDetailSheetProps {
  teacher: TeacherDetailRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: AppRole;
  onTeacherUpdated?: () => void;
}

export function TeacherDetailSheet({
  teacher,
  open,
  onOpenChange,
  userRole,
  onTeacherUpdated,
}: TeacherDetailSheetProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (!teacher) return null;

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

  const initials = teacher.user.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base">
                  {initials || "T"}
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold">
                    {teacher.user.name}
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-2 mt-0.5 text-xs">
                    <span className="font-mono font-medium text-foreground">
                      {teacher.employeeCode}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{teacher.user.role.toLowerCase()}</span>
                  </SheetDescription>
                </div>
              </div>

              <div>
                {teacher.user.status === "ACTIVE" ? (
                  <span className="inline-flex rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Administrative Quick Actions (Admin only) */}
          {isAdmin && (
            <div className="pt-4 pb-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                Staff Actions
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Pencil className="size-3.5" />
                  <span>Edit Profile</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setIsStatusDialogOpen(true)}
                >
                  <RefreshCw className="size-3.5" />
                  <span>
                    {teacher.user.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete</span>
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-6 pt-4">
            {/* Identity & Credentials Card */}
            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2">
                <ShieldCheck className="size-4 text-primary" />
                <span>Identity & System Account</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Full Name</span>
                  <p className="font-medium text-foreground mt-0.5">{teacher.user.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Employee Code</span>
                  <p className="font-mono font-medium text-foreground mt-0.5">
                    {teacher.employeeCode}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Login Email</span>
                  <p className="font-mono text-foreground mt-0.5 flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" />
                    <span>{teacher.user.email}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Academic & Professional Profile */}
            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2">
                <Briefcase className="size-4 text-primary" />
                <span>Professional Details</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Department</span>
                  <p className="font-medium text-foreground mt-0.5">
                    {teacher.department ? (
                      <span className="inline-flex rounded-md border bg-muted/50 px-2 py-0.5 text-xs">
                        {teacher.department}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground">Unassigned</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Qualification</span>
                  <p className="font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                    {teacher.qualification ? (
                      <>
                        <GraduationCap className="size-3.5 text-primary shrink-0" />
                        <span>{teacher.qualification}</span>
                      </>
                    ) : (
                      <span className="italic text-muted-foreground">Not recorded</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Institutional Record & Timeline */}
            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2">
                <Building2 className="size-4 text-primary" />
                <span>Institutional Record</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Registration Date</span>
                  <p className="font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span>{formatDate(teacher.createdAt)}</span>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Account Status</span>
                  <p className="font-medium text-foreground mt-0.5 capitalize">
                    {teacher.user.status.toLowerCase()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Action Dialogs */}
      {isAdmin && (
        <>
          <EditTeacherDialog
            teacher={teacher}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSuccess={() => {
              setIsEditDialogOpen(false);
              onTeacherUpdated?.();
            }}
          />

          <ChangeTeacherStatusDialog
            teacher={teacher}
            open={isStatusDialogOpen}
            onOpenChange={setIsStatusDialogOpen}
            onSuccess={() => {
              setIsStatusDialogOpen(false);
              onTeacherUpdated?.();
            }}
          />

          <DeleteTeacherDialog
            teacher={teacher}
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            onSuccess={() => {
              setIsDeleteDialogOpen(false);
              onOpenChange(false);
              onTeacherUpdated?.();
            }}
          />
        </>
      )}
    </>
  );
}
