"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSectionSchema, type CreateSectionInput } from "@/lib/validations/class";
import { createSection } from "@/lib/actions/sections";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";

interface CreateSectionDialogProps {
  classId: string;
  className: string;
}

export function CreateSectionDialog({ classId, className: targetClassName }: CreateSectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSectionInput>({
    resolver: zodResolver(createSectionSchema),
    defaultValues: {
      classId,
      name: "",
    },
  });

  async function onSubmit(data: CreateSectionInput) {
    setServerError(null);
    const result = await createSection(data);

    if (!result.success) {
      setServerError(result.error ?? "Failed to create section.");
      return;
    }

    reset({ classId, name: "" });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <Plus className="size-3" /> Add Section
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add Section to {targetClassName}</DialogTitle>
            <DialogDescription>
              Create a new section (e.g. B, C, or Rose) under {targetClassName}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <input type="hidden" {...register("classId")} value={classId} />

            <div className="space-y-2">
              <Label htmlFor={`sectionName-${classId}`}>
                Section Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`sectionName-${classId}`}
                placeholder="e.g. B, C, Blue"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {serverError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add Section"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
