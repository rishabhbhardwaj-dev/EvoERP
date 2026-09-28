"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateSubjectSchema,
  type UpdateSubjectInput,
} from "@/lib/validations/subject";
import { updateSubject } from "@/lib/actions/subjects";
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
import { Loader2, AlertCircle, Lock } from "lucide-react";

export interface EditSubjectData {
  id: string;
  name: string;
  code: string;
}

interface EditSubjectDialogProps {
  subject: EditSubjectData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditSubjectDialog({
  subject,
  open,
  onOpenChange,
  onSuccess,
}: EditSubjectDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateSubjectInput>({
    resolver: zodResolver(updateSubjectSchema),
    defaultValues: {
      id: subject.id,
      name: subject.name,
      code: subject.code,
    },
  });

  // Keep form values in sync when selected subject changes
  useEffect(() => {
    reset({
      id: subject.id,
      name: subject.name,
      code: subject.code,
    });
    setServerError(null);
  }, [subject, reset]);

  async function onSubmit(data: UpdateSubjectInput) {
    setServerError(null);
    const result = await updateSubject({
      id: subject.id,
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
    });

    if (!result.success) {
      setServerError(result.error ?? "Failed to update subject.");
      return;
    }

    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Subject Details</DialogTitle>
          <DialogDescription>
            Update catalog name and code for {subject.name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Immutable Record ID Banner */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Catalog Record ID</span>
              <span className="font-mono text-muted-foreground flex items-center gap-1">
                <Lock className="size-3 text-muted-foreground" />
                {subject.id}
              </span>
            </div>
          </div>

          {/* Subject Name */}
          <div className="space-y-1">
            <Label htmlFor="edit-subject-name" className="text-xs font-medium">
              Subject Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-subject-name"
              {...register("name")}
              placeholder="e.g. Mathematics or Computer Science"
              className="h-8 text-xs"
            />
            {errors.name && (
              <p className="text-[11px] text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Subject Code */}
          <div className="space-y-1">
            <Label htmlFor="edit-subject-code" className="text-xs font-medium">
              Subject Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-subject-code"
              {...register("code")}
              placeholder="e.g. 041, MATH6, ENG-101, or PHY/LAB"
              className="h-8 text-xs font-mono uppercase"
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
                register("code").onChange(e);
              }}
            />
            {errors.code && (
              <p className="text-[11px] text-destructive">{errors.code.message}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Unique institutional or CBSE code. Letters, numbers, hyphens, slashes, or dots.
            </p>
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
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
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
