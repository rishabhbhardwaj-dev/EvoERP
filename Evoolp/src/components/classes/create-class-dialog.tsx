"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClassSchema, type CreateClassInput } from "@/lib/validations/class";
import { createClass } from "@/lib/actions/classes";
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
import { PlusCircle, Loader2 } from "lucide-react";

interface CreateClassDialogProps {
  defaultAcademicYear: string;
}

export function CreateClassDialog({ defaultAcademicYear }: CreateClassDialogProps) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateClassInput>({
    resolver: zodResolver(createClassSchema),
    defaultValues: {
      name: "",
      academicYear: defaultAcademicYear,
      initialSections: "A, B",
    },
  });

  async function onSubmit(data: CreateClassInput) {
    setServerError(null);
    const result = await createClass(data);

    if (!result.success) {
      setServerError(result.error ?? "Failed to create class.");
      return;
    }

    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2"><PlusCircle className="size-4" /> Add Class</Button>} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
            <DialogDescription>
              Add a class (standard/grade) to your school structure for the academic year.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="className">
                Class Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="className"
                placeholder="e.g. Class 7 or Grade 1"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="academicYear">
                Academic Year <span className="text-destructive">*</span>
              </Label>
              <Input
                id="academicYear"
                placeholder="YYYY-YYYY (e.g. 2025-2026)"
                {...register("academicYear")}
              />
              {errors.academicYear && (
                <p className="text-xs text-destructive">{errors.academicYear.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Indian school academic year (April to March).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="initialSections">Initial Sections</Label>
              <Input
                id="initialSections"
                placeholder="e.g. A, B or A, B, C"
                {...register("initialSections")}
              />
              <p className="text-xs text-muted-foreground">
                Optional: Comma-separated section names. Defaults to &quot;A&quot; if left blank.
              </p>
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
                  Creating…
                </>
              ) : (
                "Create Class"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
