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
import { PlusCircle, Loader2 } from "lucide-react";

interface ClassOption {
  id: string;
  name: string;
  academicYear: string;
}

interface CreateSectionStandaloneDialogProps {
  classes: ClassOption[];
}

export function CreateSectionStandaloneDialog({ classes }: CreateSectionStandaloneDialogProps) {
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
      classId: classes[0]?.id ?? "",
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

    reset({ classId: classes[0]?.id ?? "", name: "" });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2" disabled={classes.length === 0}>
            <PlusCircle className="size-4" /> Add Section
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
            <DialogDescription>
              Create a new section under an existing class standard.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="classSelect">
                Select Class <span className="text-destructive">*</span>
              </Label>
              <select
                id="classSelect"
                {...register("classId")}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.academicYear})
                  </option>
                ))}
              </select>
              {errors.classId && (
                <p className="text-xs text-destructive">{errors.classId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sectionNameInput">
                Section Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sectionNameInput"
                placeholder="e.g. B, C, Rose"
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
