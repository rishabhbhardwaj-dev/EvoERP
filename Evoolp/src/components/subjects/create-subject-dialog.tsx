"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createSubjectSchema,
  type CreateSubjectInput,
} from "@/lib/validations/subject";
import { createSubject } from "@/lib/actions/subjects";
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
import { PlusCircle, Loader2, AlertCircle } from "lucide-react";

const STANDARD_SUBJECT_SUGGESTIONS = [
  { name: "Mathematics", code: "041" },
  { name: "Science", code: "086" },
  { name: "Social Science", code: "087" },
  { name: "English Core", code: "301" },
  { name: "English Language & Literature", code: "184" },
  { name: "Hindi Course A", code: "002" },
  { name: "Hindi Course B", code: "085" },
  { name: "Sanskrit", code: "122" },
  { name: "Physics", code: "042" },
  { name: "Chemistry", code: "043" },
  { name: "Biology", code: "044" },
  { name: "Computer Science", code: "083" },
  { name: "Information Technology", code: "402" },
  { name: "History", code: "027" },
  { name: "Geography", code: "029" },
  { name: "Economics", code: "030" },
  { name: "Accountancy", code: "055" },
  { name: "Business Studies", code: "054" },
  { name: "Physical Education", code: "048" },
];

export function CreateSubjectDialog() {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSubjectInput>({
    resolver: zodResolver(createSubjectSchema),
    defaultValues: {
      name: "",
      code: "",
    },
  });

  async function onSubmit(data: CreateSubjectInput) {
    setServerError(null);
    const result = await createSubject({
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
    });

    if (!result.success) {
      setServerError(result.error ?? "Failed to create subject.");
      return;
    }

    reset();
    setOpen(false);
  }

  function handleSelectSuggestion(suggestion: { name: string; code: string }) {
    setValue("name", suggestion.name, { shouldValidate: true });
    setValue("code", suggestion.code, { shouldValidate: true });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <PlusCircle className="size-4" /> Add Subject
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Subject to Catalog</DialogTitle>
          <DialogDescription>
            Register a curriculum subject in your school master catalog.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Quick suggestions */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Quick Suggestions (CBSE Standard)
            </Label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {STANDARD_SUBJECT_SUGGESTIONS.slice(0, 8).map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => handleSelectSuggestion(s)}
                  className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  {s.name} ({s.code})
                </button>
              ))}
            </div>
          </div>

          {/* Subject Name */}
          <div className="space-y-2">
            <Label htmlFor="subjectName">
              Subject Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subjectName"
              placeholder="e.g. Mathematics or Computer Science"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Subject Code */}
          <div className="space-y-2">
            <Label htmlFor="subjectCode">
              Subject Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subjectCode"
              placeholder="e.g. 041, MATH6, ENG-101, or PHY/LAB"
              {...register("code")}
              onChange={(e) => {
                // Keep input synchronized uppercase
                e.target.value = e.target.value.toUpperCase();
                register("code").onChange(e);
              }}
            />
            {errors.code && (
              <p className="text-xs text-destructive">{errors.code.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Unique institutional or CBSE code (letters, numbers, hyphens, slashes, or dots).
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? "Adding…" : "Add Subject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
