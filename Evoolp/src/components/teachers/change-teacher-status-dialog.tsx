"use client";

import { useState } from "react";
import { toggleTeacherStatus } from "@/lib/actions/teachers";
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
import { Loader2, AlertCircle, UserX, UserCheck } from "lucide-react";

export interface StatusTeacherData {
  id: string;
  employeeCode: string;
  user: {
    name: string;
    status: "ACTIVE" | "INACTIVE";
  };
}

interface ChangeTeacherStatusDialogProps {
  teacher: StatusTeacherData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ChangeTeacherStatusDialog({
  teacher,
  open,
  onOpenChange,
  onSuccess,
}: ChangeTeacherStatusDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isCurrentActive = teacher.user.status === "ACTIVE";
  const targetStatus: "ACTIVE" | "INACTIVE" = isCurrentActive ? "INACTIVE" : "ACTIVE";

  async function handleStatusChange(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setServerError(null);

    const result = await toggleTeacherStatus({
      teacherId: teacher.id,
      status: targetStatus,
      reason: reason.trim() || undefined,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setServerError(result.error ?? "Failed to change teacher status.");
      return;
    }

    setReason("");
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isCurrentActive ? (
              <div className="flex size-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                <UserX className="size-4" />
              </div>
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <UserCheck className="size-4" />
              </div>
            )}
            <DialogTitle>
              {isCurrentActive ? "Deactivate Teacher Profile" : "Reactivate Teacher Profile"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isCurrentActive
              ? `Deactivate ${teacher.user.name} (${teacher.employeeCode}). This will mark the staff member as Inactive in the directory and suspend active teaching assignments.`
              : `Reactivate ${teacher.user.name} (${teacher.employeeCode}) and restore active standing in the staff directory.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleStatusChange} className="space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
            <p className="font-medium text-foreground">
              Transition:{" "}
              <span className="font-semibold text-muted-foreground">
                {teacher.user.status}
              </span>{" "}
              $\rightarrow${" "}
              <span className={targetStatus === "ACTIVE" ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                {targetStatus}
              </span>
            </p>
            <p className="text-muted-foreground text-[11px]">
              {targetStatus === "INACTIVE"
                ? "Recommended alternative to permanent deletion. Preserves historical audit records."
                : "Staff member will be restored to active duties in the school roster."}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="status-reason" className="text-xs font-medium">
              Administrative Reason (Optional)
            </Label>
            <Input
              id="status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Sabbatical, medical leave, or resignation"
              className="h-8 text-xs"
            />
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
              type="submit"
              size="sm"
              variant={isCurrentActive ? "destructive" : "default"}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Updating…
                </>
              ) : isCurrentActive ? (
                "Deactivate Staff"
              ) : (
                "Reactivate Staff"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
