"use client";

import { useState, useEffect } from "react";
import { deleteSubject } from "@/lib/actions/subjects";
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
import { Loader2, AlertTriangle, AlertCircle } from "lucide-react";

export interface DeleteSubjectData {
  id: string;
  name: string;
  code: string;
}

interface DeleteSubjectDialogProps {
  subject: DeleteSubjectData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteSubjectDialog({
  subject,
  open,
  onOpenChange,
  onSuccess,
}: DeleteSubjectDialogProps) {
  const [typedCode, setTypedCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset confirmation input when dialog opens or subject changes
  useEffect(() => {
    setTypedCode("");
    setServerError(null);
    setIsSubmitting(false);
  }, [open, subject]);

  const isConfirmed = typedCode.trim().toUpperCase() === subject.code.toUpperCase();

  async function handleDelete() {
    if (!isConfirmed) return;

    setIsSubmitting(true);
    setServerError(null);

    const result = await deleteSubject(subject.id, typedCode.trim().toUpperCase());

    setIsSubmitting(false);

    if (!result.success) {
      setServerError(result.error ?? "Failed to delete subject.");
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
            <DialogTitle>Delete Subject from Catalog</DialogTitle>
          </div>
          <DialogDescription>
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-foreground">
              {subject.name} ({subject.code})
            </span>
            ?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
            <p className="font-semibold">Permanent Deletion Notice:</p>
            <p className="text-[11px] leading-relaxed">
              This action cannot be undone. It will permanently remove{" "}
              <strong>{subject.name}</strong> from your institution&apos;s curriculum catalog.
              A complete pre-deletion snapshot is logged in the security audit trail.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-subject-confirmation" className="text-xs font-medium">
              To confirm, type{" "}
              <span className="font-mono font-bold text-foreground">{subject.code}</span> below:
            </Label>
            <Input
              id="delete-subject-confirmation"
              placeholder={subject.code}
              value={typedCode}
              onChange={(e) => setTypedCode(e.target.value)}
              className="h-8 text-xs font-mono uppercase"
              autoComplete="off"
            />
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
            disabled={!isConfirmed || isSubmitting}
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
