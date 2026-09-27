"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateTeacherSchema, type UpdateTeacherInput } from "@/lib/validations/teacher";
import { updateTeacher } from "@/lib/actions/teachers";
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

const STANDARD_DEPARTMENTS = [
  "Mathematics",
  "Science",
  "Social Science",
  "English",
  "Hindi",
  "Computer Science",
  "Physical Education",
  "Arts & Craft",
  "Music",
  "Sanskrit",
];

export interface EditTeacherData {
  id: string;
  employeeCode: string;
  department: string | null;
  qualification: string | null;
  user: {
    name: string;
    email: string;
  };
}

interface EditTeacherDialogProps {
  teacher: EditTeacherData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditTeacherDialog({
  teacher,
  open,
  onOpenChange,
  onSuccess,
}: EditTeacherDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateTeacherInput>({
    resolver: zodResolver(updateTeacherSchema),
    defaultValues: {
      id: teacher.id,
      name: teacher.user.name,
      department: teacher.department ?? "",
      qualification: teacher.qualification ?? "",
    },
  });

  // Keep form fields synced whenever the selected teacher changes
  useEffect(() => {
    reset({
      id: teacher.id,
      name: teacher.user.name,
      department: teacher.department ?? "",
      qualification: teacher.qualification ?? "",
    });
    setServerError(null);
  }, [teacher, reset]);

  async function onSubmit(data: UpdateTeacherInput) {
    setServerError(null);
    const result = await updateTeacher(data);

    if (!result.success) {
      setServerError(result.error ?? "Failed to update teacher profile.");
      return;
    }

    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Staff Profile</DialogTitle>
          <DialogDescription>
            Update professional and biographical details for {teacher.user.name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Immutable Identifiers Banner */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Employee Code</span>
              <span className="font-mono font-semibold text-foreground flex items-center gap-1">
                <Lock className="size-3 text-muted-foreground" />
                {teacher.employeeCode}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Login Email</span>
              <span className="font-mono text-muted-foreground flex items-center gap-1">
                <Lock className="size-3 text-muted-foreground" />
                {teacher.user.email}
              </span>
            </div>
          </div>

          {/* Teacher Name */}
          <div className="space-y-1">
            <Label htmlFor="edit-teacher-name" className="text-xs font-medium">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-teacher-name"
              {...register("name")}
              placeholder="e.g. Sunita Rao"
              className="h-8 text-xs"
            />
            {errors.name && (
              <p className="text-[11px] text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Department */}
          <div className="space-y-1">
            <Label htmlFor="edit-teacher-dept" className="text-xs font-medium">
              Department
            </Label>
            <Input
              id="edit-teacher-dept"
              list="edit-dept-suggestions"
              {...register("department")}
              placeholder="e.g. Science"
              className="h-8 text-xs"
            />
            <datalist id="edit-dept-suggestions">
              {STANDARD_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept} />
              ))}
            </datalist>
            {errors.department && (
              <p className="text-[11px] text-destructive">{errors.department.message}</p>
            )}
          </div>

          {/* Qualification */}
          <div className="space-y-1">
            <Label htmlFor="edit-teacher-qual" className="text-xs font-medium">
              Qualification
            </Label>
            <Input
              id="edit-teacher-qual"
              {...register("qualification")}
              placeholder="e.g. M.Sc, B.Ed"
              className="h-8 text-xs"
            />
            {errors.qualification && (
              <p className="text-[11px] text-destructive">{errors.qualification.message}</p>
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
