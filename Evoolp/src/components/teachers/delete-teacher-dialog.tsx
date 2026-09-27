"use client";

import { useState } from "react";
import { deleteTeacher } from "@/lib/actions/teachers";
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

export interface DeleteTeacherData {
  id: string;
  employeeCode: string;
  user: {
    name: string;
    email: string;
  };
}

interface DeleteTeacherDialogProps {
  teacher: DeleteTeacherData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteTeacherDialog({
  teacher,
  open,
  onOpenChange,
  onSuccess,
}: DeleteTeacherDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleDelete() {
    setIsSubmitting(true);
    setServerError(null);

    const result = await deleteTeacher(teacher.id);

    setIsSubmitting(false);

    if (!result.success) {
      setServerError(result.error ?? "Failed to delete teacher record.");
      return;
    }

    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            <DialogTitle>Delete Teacher Record</DialogTitle>
          </div>
          <DialogDescription>
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-foreground">
              {teacher.user.name} ({teacher.employeeCode})
            </span>
            ?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {serverError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-semibold">Important Staff Deletion Notice:</p>
            <p className="text-[11px] leading-relaxed">
              Permanent deletion will remove both the teacher profile and the linked login user account (
              <span className="font-mono">{teacher.user.email}</span>). A pre-deletion snapshot will be preserved in the security audit trail.
            </p>
            <p className="text-[11px] font-medium pt-1">
              Tip: If this staff member has left the institution, consider setting their status to <strong>Inactive</strong> instead of permanently deleting their record.
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Permanently Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
