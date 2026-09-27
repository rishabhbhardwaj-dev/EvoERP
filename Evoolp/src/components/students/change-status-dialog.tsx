"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  changeStudentStatusSchema,
  type ChangeStudentStatusInput,
} from "@/lib/validations/student";
import { changeStudentStatus } from "@/lib/actions/students";
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
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface ChangeStatusDialogProps {
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    status: "ACTIVE" | "ALUMNI" | "TRANSFERRED";
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ChangeStatusDialog({
  student,
  open,
  onOpenChange,
  onSuccess,
}: ChangeStatusDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const targetDefaultStatus =
    student.status === "ACTIVE" ? "TRANSFERRED" : "ACTIVE";

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeStudentStatusInput>({
    resolver: zodResolver(changeStudentStatusSchema),
    defaultValues: {
      studentId: student.id,
      status: targetDefaultStatus,
      reason: "",
    },
  });

  const selectedStatus = watch("status");

  async function onSubmit(data: ChangeStudentStatusInput) {
    setServerError(null);
    const result = await changeStudentStatus(data);

    if (!result.success) {
      setServerError(result.error ?? "Failed to update status.");
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
              <RefreshCw className="size-5 text-primary" /> Update Student Status
            </DialogTitle>
            <DialogDescription>
              Transition status for {student.firstName} {student.lastName} ({student.admissionNumber}).
            </DialogDescription>
          </DialogHeader>

          {serverError && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="rounded-md border bg-muted/40 p-3 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Current Status:</span>
              <span className="font-semibold uppercase px-2 py-0.5 rounded bg-background border">
                {student.status}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="statusSelect">
                New Status <span className="text-destructive">*</span>
              </Label>
              <select
                id="statusSelect"
                {...register("status")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              >
                <option value="ACTIVE" disabled={student.status === "ACTIVE"}>
                  Active (Currently Enrolled & Attending)
                </option>
                <option value="TRANSFERRED" disabled={student.status === "TRANSFERRED"}>
                  Transferred (TC Issued / Left School)
                </option>
                <option value="ALUMNI" disabled={student.status === "ALUMNI"}>
                  Alumni (Graduated / Completed Studies)
                </option>
              </select>
              {errors.status && (
                <p className="text-xs text-destructive">{errors.status.message}</p>
              )}
            </div>

            {/* Explanation box */}
            <div className="rounded-md bg-muted/30 p-2.5 text-[11px] text-muted-foreground border">
              {selectedStatus === "TRANSFERRED" && (
                <p>
                  Setting status to <strong>Transferred</strong> marks the active term enrollment as <em>WITHDRAWN</em>. All past records remain permanently archived.
                </p>
              )}
              {selectedStatus === "ALUMNI" && (
                <p>
                  Setting status to <strong>Alumni</strong> marks the active term enrollment as <em>COMPLETED</em>.
                </p>
              )}
              {selectedStatus === "ACTIVE" && (
                <p>
                  Re-activating restores the student and their current academic enrollment to <em>ACTIVE</em>.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="statusReason">Reason for Transition (Optional)</Label>
              <Input
                id="statusReason"
                placeholder="e.g. TC issued for relocation, graduation completed"
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update Status"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
