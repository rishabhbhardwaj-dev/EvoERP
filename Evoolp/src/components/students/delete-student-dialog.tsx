"use client";

import { useState } from "react";
import { deleteStudent } from "@/lib/actions/students";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, AlertCircle } from "lucide-react";

interface DeleteStudentDialogProps {
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteStudentDialog({
  student,
  open,
  onOpenChange,
  onSuccess,
}: DeleteStudentDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setServerError(null);

    const result = await deleteStudent(student.id);

    if (!result.success) {
      setServerError(result.error ?? "Failed to delete student record.");
      setIsDeleting(false);
      return;
    }

    setIsDeleting(false);
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" /> Delete Student Record
          </DialogTitle>
          <DialogDescription>
            You are about to permanently delete the student record for{" "}
            <strong>
              {student.firstName} {student.lastName}
            </strong>{" "}
            ({student.admissionNumber}).
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-300">
          <p className="font-semibold">Recommended Practice:</p>
          <p className="mt-0.5">
            If this student has attended classes or left the school, use <strong>Status Transition</strong> to mark them as <em>Transferred</em> or <em>Alumni</em> instead of deleting. Hard deletion is reserved for entry errors.
          </p>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Confirm Deletion"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
