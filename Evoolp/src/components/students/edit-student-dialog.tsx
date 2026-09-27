"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateStudentSchema,
  type UpdateStudentInput,
} from "@/lib/validations/student";
import { updateStudent } from "@/lib/actions/students";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";

export interface EditStudentData {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  category: "GENERAL" | "SC" | "ST" | "OBC";
  rteCandidate: boolean;
  address: string | null;
}

interface EditStudentDialogProps {
  student: EditStudentData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditStudentDialog({
  student,
  open,
  onOpenChange,
  onSuccess,
}: EditStudentDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const formattedDob = student.dateOfBirth
    ? typeof student.dateOfBirth === "string"
      ? student.dateOfBirth.split("T")[0]
      : student.dateOfBirth.toISOString().split("T")[0]
    : "";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateStudentInput>({
    resolver: zodResolver(updateStudentSchema),
    defaultValues: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: formattedDob,
      gender: student.gender,
      category: student.category,
      rteCandidate: student.rteCandidate,
      address: student.address ?? "",
    },
  });

  // Sync form defaults when student changes
  useEffect(() => {
    reset({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: formattedDob,
      gender: student.gender,
      category: student.category,
      rteCandidate: student.rteCandidate,
      address: student.address ?? "",
    });
    setServerError(null);
  }, [student, reset, formattedDob]);

  async function onSubmit(data: UpdateStudentInput) {
    setServerError(null);
    const result = await updateStudent(data);

    if (!result.success) {
      setServerError(result.error ?? "Failed to update student profile.");
      return;
    }

    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Student Profile</DialogTitle>
            <DialogDescription>
              Update demographic and address details. Institutional identifiers remain immutable.
            </DialogDescription>
          </DialogHeader>

          {serverError && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {/* Admission Number (Read-only / Immutable) */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="editAdmissionNumber" className="text-muted-foreground">
                Admission Number (Immutable)
              </Label>
              <Input
                id="editAdmissionNumber"
                value={student.admissionNumber}
                disabled
                className="bg-muted font-mono cursor-not-allowed text-muted-foreground"
              />
              <p className="text-[11px] text-muted-foreground">
                Permanent institutional registration number cannot be modified.
              </p>
            </div>

            {/* First Name */}
            <div className="space-y-1.5">
              <Label htmlFor="editFirstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="editFirstName"
                placeholder="First name"
                {...register("firstName")}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-1.5">
              <Label htmlFor="editLastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="editLastName"
                placeholder="Last name"
                {...register("lastName")}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-1.5">
              <Label htmlFor="editDateOfBirth">Date of Birth</Label>
              <Input
                id="editDateOfBirth"
                type="date"
                {...register("dateOfBirth")}
              />
              {errors.dateOfBirth && (
                <p className="text-xs text-destructive">{errors.dateOfBirth.message}</p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-1.5">
              <Label htmlFor="editGender">Gender</Label>
              <select
                id="editGender"
                {...register("gender")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              >
                <option value="">Select Gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="editCategory">Category (Reservation)</Label>
              <select
                id="editCategory"
                {...register("category")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              >
                <option value="GENERAL">General</option>
                <option value="OBC">OBC (Other Backward Classes)</option>
                <option value="SC">SC (Scheduled Caste)</option>
                <option value="ST">ST (Scheduled Tribe)</option>
              </select>
            </div>

            {/* RTE Candidate Checkbox */}
            <div className="space-y-1.5 flex flex-col justify-center">
              <div className="flex items-center gap-2 pt-2">
                <input
                  id="editRteCandidate"
                  type="checkbox"
                  className="size-4 rounded border-input text-primary focus:ring-primary"
                  {...register("rteCandidate")}
                />
                <Label htmlFor="editRteCandidate" className="text-sm font-normal cursor-pointer">
                  RTE Candidate (25% Quota)
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Right to Education Act reserved seat status.
              </p>
            </div>

            {/* Address */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="editAddress">Residential Address</Label>
              <Input
                id="editAddress"
                placeholder="Street address, locality, city, pin code"
                {...register("address")}
              />
              {errors.address && (
                <p className="text-xs text-destructive">{errors.address.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving Changes…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
