"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  transferSectionSchema,
  type TransferSectionInput,
} from "@/lib/validations/student";
import { transferStudentSection } from "@/lib/actions/students";
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
import { Loader2, AlertCircle, ArrowRightLeft } from "lucide-react";

interface TransferSectionDialogProps {
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    activeEnrollment?: {
      classId: string;
      className: string;
      sectionId: string;
      sectionName: string;
    } | null;
  };
  availableSections: Array<{ id: string; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TransferSectionDialog({
  student,
  availableSections,
  open,
  onOpenChange,
  onSuccess,
}: TransferSectionDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  // Eligible sections: sections in the same class except the current section
  const eligibleSections = availableSections.filter(
    (sec) => sec.id !== student.activeEnrollment?.sectionId
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransferSectionInput>({
    resolver: zodResolver(transferSectionSchema),
    defaultValues: {
      studentId: student.id,
      targetSectionId: eligibleSections[0]?.id ?? "",
      reason: "",
    },
  });

  async function onSubmit(data: TransferSectionInput) {
    setServerError(null);
    const result = await transferStudentSection(data);

    if (!result.success) {
      setServerError(result.error ?? "Failed to transfer section.");
      return;
    }

    reset();
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="size-5 text-primary" /> Transfer Section
            </DialogTitle>
            <DialogDescription>
              Transfer {student.firstName} {student.lastName} ({student.admissionNumber}) to another section within {student.activeEnrollment?.className ?? "their class"}.
            </DialogDescription>
          </DialogHeader>

          {serverError && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="space-y-4 py-4">
            {/* Current Placement Display */}
            <div className="rounded-md border bg-muted/40 p-3 text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Class Standard:</span>
                <p className="font-semibold mt-0.5">{student.activeEnrollment?.className ?? "Unassigned"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Current Section:</span>
                <p className="font-semibold mt-0.5">Section {student.activeEnrollment?.sectionName ?? "—"}</p>
              </div>
            </div>

            {/* Target Section Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="targetSectionId">
                Target Section <span className="text-destructive">*</span>
              </Label>
              <select
                id="targetSectionId"
                {...register("targetSectionId")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              >
                {eligibleSections.length === 0 ? (
                  <option value="">No other sections available in this class</option>
                ) : (
                  eligibleSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name}
                    </option>
                  ))
                )}
              </select>
              {errors.targetSectionId && (
                <p className="text-xs text-destructive">{errors.targetSectionId.message}</p>
              )}
            </div>

            {/* Reason for Transfer */}
            <div className="space-y-1.5">
              <Label htmlFor="transferReason">Administrative Reason (Optional)</Label>
              <Input
                id="transferReason"
                placeholder="e.g. Section balancing, language stream change"
                {...register("reason")}
              />
              {errors.reason && (
                <p className="text-xs text-destructive">{errors.reason.message}</p>
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
            <Button
              type="submit"
              disabled={isSubmitting || eligibleSections.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Transferring…
                </>
              ) : (
                "Transfer Student"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
