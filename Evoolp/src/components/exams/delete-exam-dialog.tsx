"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteExam } from "@/lib/actions/exams";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, AlertCircle, ShieldAlert } from "lucide-react";

export interface DeleteExamData {
  id: string;
  name: string;
  resultCount: number;
  subjectName: string;
  className: string;
  sectionName: string;
}

interface DeleteExamDialogProps {
  exam: DeleteExamData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteExamDialog({
  exam,
  open,
  onOpenChange,
  onSuccess,
}: DeleteExamDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setServerError(null);
    setIsSubmitting(false);
  }, [open, exam]);

  const hasResults = exam.resultCount > 0;

  async function handleDelete() {
    if (hasResults) return;
    setIsSubmitting(true);
    setServerError(null);

    const result = await deleteExam(exam.id);
    setIsSubmitting(false);

    if (!result.success) {
      setServerError(result.error ?? "Failed to delete exam.");
      return;
    }

    onOpenChange(false);
    onSuccess?.();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            <DialogTitle>Delete Exam</DialogTitle>
          </div>
          <DialogDescription>
            You are about to permanently delete{" "}
            <span className="font-semibold text-foreground">
              {exam.name}
            </span>{" "}
            for {exam.className} / Section {exam.sectionName} — {exam.subjectName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {hasResults ? (
            /* Blocked state */
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="size-4 shrink-0" />
                Cannot Delete — Marks Exist
              </div>
              <p className="text-[11px] leading-relaxed">
                This exam has{" "}
                <strong>{exam.resultCount}</strong> mark record(s) entered. Remove
                all marks before deleting the exam definition.
              </p>
            </div>
          ) : (
            /* Allowed state */
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
              <p className="font-semibold">Permanent Deletion Notice:</p>
              <p className="text-[11px] leading-relaxed">
                This action cannot be undone. The exam definition will be
                permanently removed. A pre-deletion snapshot is recorded in the
                security audit trail.
              </p>
            </div>
          )}
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
            disabled={hasResults || isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete Exam"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
