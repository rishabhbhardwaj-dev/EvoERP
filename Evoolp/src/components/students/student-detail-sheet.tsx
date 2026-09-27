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
import { EditStudentDialog } from "./edit-student-dialog";
import { TransferSectionDialog } from "./transfer-section-dialog";
import { ChangeStatusDialog } from "./change-status-dialog";
import { DeleteStudentDialog } from "./delete-student-dialog";
import type { AppRole } from "@/types/next-auth";
import {
  User,
  GraduationCap,
  MapPin,
  Mail,
  ShieldCheck,
  Pencil,
  History,
  CheckCircle2,
  ArrowRightLeft,
  RefreshCw,
  Trash2,
} from "lucide-react";

export interface StudentDetailRecord {
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
  createdAt: Date | string;
  parent?: {
    id: string;
    name: string;
    email: string;
  } | null;
  enrollments: Array<{
    id: string;
    academicYear: string;
    status: "ACTIVE" | "COMPLETED" | "WITHDRAWN";
    createdAt?: Date | string;
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

interface StudentDetailSheetProps {
  student: StudentDetailRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: AppRole;
  classesWithSections?: Array<{
    id: string;
    name: string;
    sections: Array<{ id: string; name: string }>;
  }>;
  onStudentUpdated?: () => void;
}

export function StudentDetailSheet({
  student,
  open,
  onOpenChange,
  userRole,
  classesWithSections,
  onStudentUpdated,
}: StudentDetailSheetProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (!student) return null;

  const isAdmin = userRole === "ADMIN";
  const activeEnrollment =
    student.enrollments.find((e) => e.status === "ACTIVE") ?? student.enrollments[0];

  // Helper for formatting dates
  function formatDate(d: Date | string | null | undefined): string {
    if (!d) return "Not provided";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "Not provided";
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // Calculate age from date of birth
  function calculateAge(d: Date | string | null | undefined): string | null {
    if (!d) return null;
    const birthDate = new Date(d);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? `${age} yrs` : null;
  }

  const ageLabel = calculateAge(student.dateOfBirth);

  // Available sections for the student's active class
  const activeClass = classesWithSections?.find(
    (c) => c.id === activeEnrollment?.class.id
  );
  const availableSections = activeClass?.sections ?? [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto p-0 gap-0"
        >
          {/* Header Banner */}
          <div className="border-b bg-muted/30 p-6">
            <SheetHeader className="p-0 gap-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                    {student.firstName[0]}
                    {student.lastName[0]}
                  </div>
                  <div>
                    <SheetTitle className="text-xl font-bold">
                      {student.firstName} {student.lastName}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs font-semibold rounded-md bg-muted px-2 py-0.5 text-foreground">
                        {student.admissionNumber}
                      </span>

                      {student.status === "ACTIVE" && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" /> Active
                        </span>
                      )}
                      {student.status === "TRANSFERRED" && (
                        <span className="inline-flex rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          Transferred
                        </span>
                      )}
                      {student.status === "ALUMNI" && (
                        <span className="inline-flex rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400">
                          Alumni
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Edit Trigger for Admin */}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => setIsEditDialogOpen(true)}
                  >
                    <Pencil className="size-3.5" />
                    <span>Edit Profile</span>
                  </Button>
                )}
              </div>
              <SheetDescription className="text-xs text-muted-foreground mt-1">
                Student Profile, Academic History & Institutional Status
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-6">
            {/* Admin Management Actions Bar */}
            {isAdmin && (
              <div className="rounded-lg border bg-card p-3 shadow-xs space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Administrative Actions
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => setIsTransferDialogOpen(true)}
                    disabled={!activeEnrollment || student.status !== "ACTIVE"}
                  >
                    <ArrowRightLeft className="size-3.5" /> Transfer Section
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => setIsStatusDialogOpen(true)}
                  >
                    <RefreshCw className="size-3.5" /> Change Status
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </div>
            )}

            {/* Current Academic Placement */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <GraduationCap className="size-4 text-primary" /> Current Academic Placement
              </h3>

              {activeEnrollment ? (
                <div className="rounded-lg border bg-card p-4 grid grid-cols-2 gap-3 shadow-xs">
                  <div>
                    <p className="text-xs text-muted-foreground">Class & Section</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {activeEnrollment.class.name} — Section {activeEnrollment.section.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Academic Year</p>
                    <p className="text-sm font-semibold font-mono text-foreground mt-0.5">
                      {activeEnrollment.academicYear}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Enrollment Status</p>
                    <span className="inline-flex rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {activeEnrollment.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Admitted On</p>
                    <p className="text-xs text-foreground mt-0.5">
                      {formatDate(student.createdAt)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No active enrollment assigned.
                </div>
              )}
            </div>

            {/* Demographics & Category */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="size-4 text-primary" /> Personal Demographics
              </h3>

              <div className="rounded-lg border bg-card p-4 grid grid-cols-2 gap-y-3.5 gap-x-4 shadow-xs text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Date of Birth</p>
                  <p className="font-medium mt-0.5">
                    {formatDate(student.dateOfBirth)}
                    {ageLabel && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({ageLabel})
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Gender</p>
                  <p className="font-medium capitalize mt-0.5">
                    {student.gender ? student.gender.toLowerCase() : "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <div className="mt-0.5">
                    <span className="inline-flex rounded-md border bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
                      {student.category}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">RTE Status</p>
                  <div className="mt-0.5">
                    {student.rteCandidate ? (
                      <span className="inline-flex rounded-md bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
                        RTE 25% Quota
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">General Seat</span>
                    )}
                  </div>
                </div>

                <div className="col-span-2 border-t pt-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground" /> Residential Address
                  </p>
                  <p className="text-xs text-foreground mt-1 whitespace-pre-wrap">
                    {student.address || "No address on file."}
                  </p>
                </div>
              </div>
            </div>

            {/* Parent / Guardian Information */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" /> Parent / Guardian Information
              </h3>

              <div className="rounded-lg border bg-card p-4 shadow-xs text-sm">
                {student.parent ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Guardian Name:</span>
                      <span className="font-medium">{student.parent.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Contact Email:</span>
                      <span className="font-mono text-xs text-primary flex items-center gap-1">
                        <Mail className="size-3" /> {student.parent.email}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-2 text-center text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">No linked parent account</p>
                    <p className="text-[11px] mt-0.5">
                      Parent portal access credentials have not been linked to this student profile yet.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Enrollment History */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="size-4 text-primary" /> Enrollment History
              </h3>

              <div className="rounded-lg border bg-card overflow-hidden shadow-xs">
                {student.enrollments.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    No historical enrollments found.
                  </p>
                ) : (
                  <div className="divide-y text-xs">
                    {student.enrollments.map((en) => (
                      <div
                        key={en.id}
                        className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground">
                            {en.class.name} — Section {en.section.name}
                          </p>
                          <p className="text-muted-foreground font-mono">
                            Year: {en.academicYear}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 font-medium ${
                              en.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : en.status === "COMPLETED"
                                ? "bg-purple-500/10 text-purple-700 dark:text-purple-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {en.status}
                          </span>
                          {en.createdAt && (
                            <p className="text-[10px] text-muted-foreground">
                              {formatDate(en.createdAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Admin Action Modals */}
      {isAdmin && (
        <>
          <EditStudentDialog
            student={student}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSuccess={() => {
              onStudentUpdated?.();
            }}
          />

          <TransferSectionDialog
            student={{
              id: student.id,
              admissionNumber: student.admissionNumber,
              firstName: student.firstName,
              lastName: student.lastName,
              activeEnrollment: activeEnrollment
                ? {
                    classId: activeEnrollment.class.id,
                    className: activeEnrollment.class.name,
                    sectionId: activeEnrollment.section.id,
                    sectionName: activeEnrollment.section.name,
                  }
                : null,
            }}
            availableSections={availableSections}
            open={isTransferDialogOpen}
            onOpenChange={setIsTransferDialogOpen}
            onSuccess={() => {
              onStudentUpdated?.();
            }}
          />

          <ChangeStatusDialog
            student={{
              id: student.id,
              admissionNumber: student.admissionNumber,
              firstName: student.firstName,
              lastName: student.lastName,
              status: student.status,
            }}
            open={isStatusDialogOpen}
            onOpenChange={setIsStatusDialogOpen}
            onSuccess={() => {
              onStudentUpdated?.();
            }}
          />

          <DeleteStudentDialog
            student={{
              id: student.id,
              admissionNumber: student.admissionNumber,
              firstName: student.firstName,
              lastName: student.lastName,
            }}
            open={isDeleteDialogOpen}
            onOpenChange={(isOpen) => {
              setIsDeleteDialogOpen(isOpen);
              if (!isOpen) onOpenChange(false);
            }}
            onSuccess={() => {
              onOpenChange(false);
              onStudentUpdated?.();
            }}
          />
        </>
      )}
    </>
  );
}
